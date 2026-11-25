/* Megalodon · análisis al estilo de los menús de Wireshark, sin DOM:
   - Analizar › Información experta: mensajes y severidades tal como los emite Wireshark
     (packet-tcp.c: SYN y SYN+ACK son Chat con «server port», FIN es Chat, RST es Warning;
     retransmisión sospechada es Note; las líneas de petición y respuesta HTTP son Chat).
   - Archivo › Exportar objetos › HTTP: paquete, host, tipo, tamaño y nombre de cada cuerpo.
   - Herramientas › Credenciales: paquete, protocolo, usuario e información (HTTP Basic, FTP, NTLMSSP).
   - Seguir flujo UDP. */
const EXPERT_SEV = [
  ['error', 'Error', 'Errores'],
  ['warn', 'Warning', 'Avisos'],
  ['note', 'Note', 'Notas'],
  ['chat', 'Chat', 'Conversación'],
];
function expertInfo(pkts) {
  const groups = new Map();
  const add = (sev, group, proto, summary, p) => {
    const k = `${sev}|${proto}|${summary}`;
    const g = groups.get(k) || groups.set(k, { sev, group, proto, summary, nos: [] }).get(k);
    g.nos.push(p.no);
  };
  for (const p of pkts) {
    const f = p.f;
    if (f['tcp.flags.syn'] && f['tcp.flags.syn'][0]) {
      if (f['tcp.flags.ack'][0]) add('chat', 'Sequence', 'TCP', `Connection establish acknowledge (SYN+ACK): server port ${f['tcp.srcport'][0]}`, p);
      else add('chat', 'Sequence', 'TCP', `Connection establish request (SYN): server port ${f['tcp.dstport'][0]}`, p);
    }
    if (f['tcp.flags.fin'] && f['tcp.flags.fin'][0]) add('chat', 'Sequence', 'TCP', 'Connection finish (FIN)', p);
    if (f['tcp.flags.reset'] && f['tcp.flags.reset'][0]) add('warn', 'Sequence', 'TCP', 'Connection reset (RST)', p);
    if (f['tcp.analysis.retransmission']) add('note', 'Sequence', 'TCP', 'This frame is a (suspected) retransmission', p);
    if (f['http.request'] && !f['tcp.analysis.retransmission']) add('chat', 'Sequence', 'HTTP', `${f['http.request.method'][0]} ${f['http.request.uri'][0]} ${f['http.request.version'] ? f['http.request.version'][0] : 'HTTP/1.1'}\\r\\n`, p);
    if (f['http.response'] && !f['tcp.analysis.retransmission']) add('chat', 'Sequence', 'HTTP', `HTTP/1.1 ${f['http.response.code'][0]} ${f['http.response.phrase'] ? f['http.response.phrase'][0] : ''}\\r\\n`, p);
  }
  const order = Object.fromEntries(EXPERT_SEV.map(([k], i) => [k, i]));
  const items = [...groups.values()].sort((a, b) => order[a.sev] - order[b.sev] || a.nos[0] - b.nos[0]);
  const count = Object.fromEntries(EXPERT_SEV.map(([k]) => [k, items.filter(i => i.sev === k).reduce((s, i) => s + i.nos.length, 0)]));
  return { items, count };
}

/* Cuerpo HTTP en bytes: lo que va tras la línea en blanco dentro de la capa HTTP del paquete. */
function httpBody(p) {
  const r = p.layers && p.layers.http; if (!r) return new Uint8Array();
  const b = p.b.subarray(r[0], r[1]);
  for (let i = 0; i + 3 < b.length; i++) if (b[i] === 13 && b[i + 1] === 10 && b[i + 2] === 13 && b[i + 3] === 10) return b.subarray(i + 4);
  return new Uint8Array();
}
const EXT_BY_TYPE = { 'text/html': 'html', 'text/css': 'css', 'application/javascript': 'js', 'text/javascript': 'js', 'application/json': 'json', 'text/plain': 'txt', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'application/zip': 'zip', 'application/octet-stream': 'bin', 'application/x-www-form-urlencoded': 'txt' };
function safeName(uri, type, no) {
  const path = String(uri || '/').split('?')[0];
  let base = decodeURIComponent(path.split('/').filter(Boolean).pop() || '').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(0, 80);
  const ext = EXT_BY_TYPE[String(type || '').split(';')[0].trim().toLowerCase()] || 'bin';
  if (!base) base = `index.${ext}`;
  else if (!/\.\w{1,5}$/.test(base)) base += `.${ext}`;
  return base || `objeto-${no}.${ext}`;
}
function httpObjects(pkts) {
  const byNo = new Map(pkts.map(p => [p.no, p]));
  const out = [];
  for (const p of pkts) {
    const f = p.f;
    if (!f['http'] || f['tcp.analysis.retransmission']) continue;
    const isResp = !!f['http.response'];
    const body = httpBody(p);
    if (!body.length) continue;
    const req = isResp && f['http.request_in'] ? byNo.get(f['http.request_in'][0]) : p;
    const host = req && req.f['http.host'] ? req.f['http.host'][0] : (isResp ? p.src : p.dst);
    const uri = isResp ? (f['http.request.uri'] ? f['http.request.uri'][0] : '/') : f['http.request.uri'][0];
    const type = f['http.content_type'] ? f['http.content_type'][0] : (isResp ? '' : 'application/x-www-form-urlencoded');
    out.push({ no: p.no, host, type, size: body.length, uri, name: safeName(uri, type, p.no), data: body, dir: isResp ? 'respuesta' : 'petición' });
  }
  return out;
}

function credentials(pkts) {
  const out = [], ftpUser = new Map();
  for (const p of pkts) {
    const f = p.f;
    if (f['http.authbasic']) {
      const v = String(f['http.authbasic'][0]), i = v.indexOf(':');
      out.push({ no: p.no, proto: 'HTTP', user: i < 0 ? v : v.slice(0, i), info: 'Basic', field: 'http.authbasic' });
    }
    if (f['ftp.request.command']) {
      const cmd = String(f['ftp.request.command'][0]).toUpperCase(), arg = f['ftp.request.arg'] ? String(f['ftp.request.arg'][0]) : '';
      if (cmd === 'USER') ftpUser.set(p.tcpStream, { user: arg, no: p.no });
      if (cmd === 'PASS') { const u = ftpUser.get(p.tcpStream); out.push({ no: p.no, proto: 'FTP', user: u ? u.user : 'n.a.', info: u ? `Usuario en el paquete ${u.no}` : '', field: 'ftp.request.arg' }); }
    }
    if (f['ntlmssp.auth.username']) {
      const dom = f['ntlmssp.auth.domain'] ? f['ntlmssp.auth.domain'][0] : '';
      out.push({ no: p.no, proto: 'NTLMSSP', user: `${dom ? dom + '\\' : ''}${f['ntlmssp.auth.username'][0]}`, info: 'Autenticación NTLMSSP (AUTHENTICATE)', field: 'ntlmssp.auth.username' });
    }
  }
  return out;
}

function followUdp(pkts, stream) {
  const mine = pkts.filter(p => p.f['udp.stream'] && p.f['udp.stream'][0] === stream);
  if (!mine.length) return null;
  const first = mine[0], cli = first.f['ip.src'][0] + ':' + first.f['udp.srcport'][0];
  const chunks = []; let cBytes = 0, sBytes = 0;
  for (const p of mine) {
    const r = p.layers.udp; if (!r) continue;
    const ulen = p.f['udp.length'] ? p.f['udp.length'][0] : 8, data = p.b.subarray(r[1], r[0] + ulen); if (!data.length) continue;   // la capa UDP es solo la cabecera
    const fromClient = p.f['ip.src'][0] + ':' + p.f['udp.srcport'][0] === cli;
    const txt = TD.decode(data).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '.');
    chunks.push({ client: fromClient, text: txt, bytes: data.length, frames: [p.no] });
    if (fromClient) cBytes += data.length; else sBytes += data.length;
  }
  return { stream, client: cli, server: `${first.f['ip.dst'][0]}:${first.f['udp.dstport'][0]}`, chunks, cBytes, sBytes, filter: `udp.stream eq ${stream}`, udp: true };
}
