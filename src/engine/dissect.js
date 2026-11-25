/* Megalodon · disector: convierte bytes en columnas, árbol de detalle con rangos de bytes y campos filtrables.
   Imita los nombres y textos de Wireshark 4.x para que lo aprendido sirva en la herramienta real. */
const hx = (n, w = 2) => (n >>> 0).toString(16).padStart(w, '0');
const mac = (b, o) => Array.from(b.subarray(o, o + 6), x => hx(x)).join(':');
const ip4 = (b, o) => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
const be16 = (b, o) => (b[o] << 8) | b[o + 1];
const be32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const rd16 = (b, o) => b[o] | (b[o + 1] << 8);
const rd32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const text = (b, s, e) => TD.decode(b.subarray(s, e));
const ascii = (b, s, e) => { let o = ''; for (let i = s; i < e; i++) o += String.fromCharCode(b[i]); return o; };
const u16le = (b, s, n) => { let o = ''; for (let i = 0; i + 1 < n; i += 2) o += String.fromCharCode(b[s + i] | (b[s + i + 1] << 8)); return o; };
const FLAG_NAMES = [[1, 'FIN'], [2, 'SYN'], [4, 'RST'], [8, 'PSH'], [16, 'ACK'], [32, 'URG']];
const ETYPE = { 17: 'AES128-CTS-HMAC-SHA1-96', 18: 'AES256-CTS-HMAC-SHA1-96', 23: 'ARCFOUR-HMAC-MD5 (RC4)' };
const KRB = { 10: 'AS-REQ', 11: 'AS-REP', 12: 'TGS-REQ', 13: 'TGS-REP', 30: 'KRB-ERROR' };
const DNS_T = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV' };
const DHCP_T = { 1: 'Discover', 2: 'Offer', 3: 'Request', 4: 'Decline', 5: 'ACK', 6: 'NAK', 7: 'Release', 8: 'Inform' };
const TLS_CT = { 20: 'Change Cipher Spec', 21: 'Alert', 22: 'Handshake', 23: 'Application Data' };
const TLS_HS = { 1: 'Client Hello', 2: 'Server Hello', 4: 'New Session Ticket', 8: 'Encrypted Extensions', 11: 'Certificate', 15: 'Certificate Verify', 16: 'Client Key Exchange', 20: 'Finished' };
const SMB_CMD = { 0: 'Negotiate Protocol', 1: 'Session Setup', 2: 'Session Logoff', 3: 'Tree Connect', 4: 'Tree Disconnect', 5: 'Create', 6: 'Close', 8: 'Read', 9: 'Write', 16: 'GetInfo' };
const NT_ST = { 0: 'STATUS_SUCCESS', 0xc0000016: 'STATUS_MORE_PROCESSING_REQUIRED', 0xc000006d: 'STATUS_LOGON_FAILURE', 0xc0000022: 'STATUS_ACCESS_DENIED' };
const HTTP_RE = /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|CONNECT|TRACE) \S+ HTTP\/\d\.\d$/;

/* DER (ASN.1) genérico para Kerberos */
function derNodes(b, s, e) {
  const out = [];
  while (s + 2 <= e) {
    const tag = b[s]; let len = b[s + 1], hs = 2;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = len * 256 + b[s + 2 + i]; hs += n; }
    const cs = s + hs, ce = Math.min(e, cs + len), node = { tag, s, cs, ce };
    if (tag & 0x20) node.kids = derNodes(b, cs, ce);
    out.push(node); s = ce;
  }
  return out;
}
const derCtx = (seq, n) => seq && seq.kids && seq.kids.find(k => k.tag === 0xa0 + n);
const derFirst = n => n && n.kids && n.kids[0];
const derStr = (b, n) => n ? text(b, n.cs, n.ce) : '';
const derInt = (b, n) => { let v = 0; for (let i = n.cs; i < n.ce; i++) v = v * 256 + b[i]; return v; };
const princNames = (b, p) => { const seq = derFirst(p); const names = derFirst(derCtx(seq, 1)); return names && names.kids ? names.kids.map(k => derStr(b, k)) : []; };

/* Lector de nombres DNS con compresión (punteros 0xc0) */
function dnsReadName(b, s, o, end) {
  const labels = []; let p = o, next = -1, hops = 0;
  while (p < end && hops < 40) {
    const l = b[p];
    if (l === 0) { p++; break; }
    if ((l & 0xc0) === 0xc0) { if (next < 0) next = p + 2; p = s + (((l & 0x3f) << 8) | b[p + 1]); hops++; continue; }
    labels.push(ascii(b, p + 1, p + 1 + l)); p += 1 + l;
  }
  return { name: labels.join('.') || '<Root>', end: next < 0 ? p : next };
}

function dissectAll(raw, opts = {}) {
  const rel = opts.relative !== false;
  const tcpConv = new Map(), udpConv = new Map(), tlsVer = new Map(), httpPending = new Map();
  const t0 = raw.length ? raw[0].t : 0;
  const pkts = raw.map((r, i) => dissectOne(r, i, raw[i - 1]));
  // segunda pasada: la versión TLS se conoce al ver el Server Hello; Wireshark la aplica a todo el flujo
  for (const p of pkts) if (p.resIn) { p.f['http.response_in'] = [p.resIn]; const h = p.tree.find(n => n.label === 'Hypertext Transfer Protocol'); if (h) h.kids.push({ label: `[Respuesta en la trama: ${p.resIn}]`, s: 0, n: 0, field: 'http.response_in', kids: [] }); }
  for (const p of pkts) if (p.tlsKind && tlsVer.has(p.tcpStream)) { p.proto = p.tlsKind === 'ch' ? 'TLSv1.2' : 'TLSv1.3'; }
  return { pkts, tcpCount: tcpConv.size, udpCount: udpConv.size };

  function dissectOne(r, i, prev) {
    const b = r.b, P = { no: i + 1, t: r.t, rel: r.t - t0, delta: prev ? r.t - prev.t : 0, b, len: b.length, f: Object.create(null), protos: [], layers: {}, tree: [], info: '', proto: 'Ethernet', src: '', dst: '' };
    const set = (k, v) => { (P.f[k] || (P.f[k] = [])).push(v); };
    const node = (parent, label, s, n, field, v) => { const nd = { label, s, n, field, v, kids: [] }; (parent ? parent.kids : P.tree).push(nd); if (field && v !== undefined) set(field, v); return nd; };
    const layer = (name, s, e) => { P.protos.push(name); P.layers[name] = [s, e]; set(name, true); };
    const fr = node(null, `Frame ${P.no}: ${b.length} bytes en el cable (${b.length * 8} bits), ${b.length} bytes capturados`, 0, b.length);
    layer('frame', 0, b.length);
    set('frame.number', P.no); set('frame.len', b.length); set('frame.time_relative', +P.rel.toFixed(6)); set('frame.time_delta', +P.delta.toFixed(6));
    node(fr, `Hora de llegada (epoch): ${r.t.toFixed(6)}`, 0, 0);
    node(fr, `[Tiempo desde el paquete anterior: ${P.delta.toFixed(6)} s]`, 0, 0);
    node(fr, `[Tiempo desde el primer paquete: ${P.rel.toFixed(6)} s]`, 0, 0);
    node(fr, `Número de trama: ${P.no}`, 0, 0);
    node(fr, `Longitud de la trama: ${b.length} bytes`, 0, 0);
    const protoNode = node(fr, '', 0, 0);
    if (b.length < 14) { P.info = 'Trama demasiado corta'; protoNode.label = '[Protocolos: eth]'; return P; }
    // ---- Ethernet ----
    const dst = mac(b, 0), src = mac(b, 6), et = be16(b, 12);
    const en = node(null, `Ethernet II, Src: ${src}, Dst: ${dst === 'ff:ff:ff:ff:ff:ff' ? 'Broadcast (ff:ff:ff:ff:ff:ff)' : dst}`, 0, 14);
    layer('eth', 0, 14);
    node(en, `Destino: ${dst}`, 0, 6, 'eth.dst', dst); node(en, `Origen: ${src}`, 6, 6, 'eth.src', src);
    set('eth.addr', src); set('eth.addr', dst);
    node(en, `Tipo: ${et === 0x0800 ? 'IPv4' : et === 0x0806 ? 'ARP' : 'Desconocido'} (0x${hx(et, 4)})`, 12, 2, 'eth.type', et);
    P.src = src; P.dst = dst === 'ff:ff:ff:ff:ff:ff' ? 'Broadcast' : dst; P.proto = 'Ethernet';
    const stack = ['eth', 'ethertype'];
    if (et === 0x0806 && b.length >= 42) arp(14);
    else if (et === 0x0800 && b.length >= 34) ipv4(14);
    else P.info = `Ethernet II, tipo 0x${hx(et, 4)}`;
    stack.push(...P.protos.filter(x => !['frame', 'eth'].includes(x)));
    const protocols = stack.join(':');
    protoNode.label = `[Protocolos en la trama: ${protocols}]`; set('frame.protocols', protocols);
    P.color = colorOf(P);
    return P;

    function arp(o) {
      const op = be16(b, o + 6), sha = mac(b, o + 8), spa = ip4(b, o + 14), tha = mac(b, o + 18), tpa = ip4(b, o + 24);
      layer('arp', o, o + 28); P.proto = 'ARP';
      const n = node(null, `Address Resolution Protocol (${op === 1 ? 'request' : 'reply'})`, o, 28);
      node(n, 'Tipo de hardware: Ethernet (1)', o, 2); node(n, 'Tipo de protocolo: IPv4 (0x0800)', o + 2, 2);
      node(n, `Opcode: ${op === 1 ? 'request' : 'reply'} (${op})`, o + 6, 2, 'arp.opcode', op);
      node(n, `MAC del emisor: ${sha}`, o + 8, 6, 'arp.src.hw_mac', sha); node(n, `IP del emisor: ${spa}`, o + 14, 4, 'arp.src.proto_ipv4', spa);
      node(n, `MAC de destino: ${tha}`, o + 18, 6, 'arp.dst.hw_mac', tha); node(n, `IP de destino: ${tpa}`, o + 24, 4, 'arp.dst.proto_ipv4', tpa);
      P.info = op === 1 ? `Who has ${tpa}? Tell ${spa}` : `${spa} is at ${sha}`;
    }

    function ipv4(o) {
      const ihl = (b[o] & 15) * 4, tot = be16(b, o + 2), id = be16(b, o + 4), fl = be16(b, o + 6), ttl = b[o + 8], pr = b[o + 9], sip = ip4(b, o + 12), dip = ip4(b, o + 16);
      const end = Math.min(b.length, o + tot);
      layer('ip', o, o + ihl); P.proto = 'IPv4'; P.src = sip; P.dst = dip;
      const n = node(null, `Internet Protocol Version 4, Src: ${sip}, Dst: ${dip}`, o, ihl);
      node(n, `0100 .... = Versión: 4`, o, 1); node(n, `.... ${(ihl / 4).toString(2).padStart(4, '0')} = Longitud de cabecera: ${ihl} bytes (${ihl / 4})`, o, 1);
      node(n, `Longitud total: ${tot}`, o + 2, 2, 'ip.len', tot); node(n, `Identificación: 0x${hx(id, 4)} (${id})`, o + 4, 2, 'ip.id', id);
      const fn = node(n, `Flags: 0x${hx(fl >> 13, 1)}${fl & 0x4000 ? ', Don\'t fragment' : ''}`, o + 6, 2);
      node(fn, `.${fl & 0x4000 ? 1 : 0}.. .... = Don't fragment: ${fl & 0x4000 ? 'Set' : 'Not set'}`, o + 6, 1, 'ip.flags.df', fl & 0x4000 ? 1 : 0);
      node(n, `Tiempo de vida (TTL): ${ttl}`, o + 8, 1, 'ip.ttl', ttl);
      node(n, `Protocolo: ${pr === 6 ? 'TCP' : pr === 17 ? 'UDP' : pr === 1 ? 'ICMP' : pr} (${pr})`, o + 9, 1, 'ip.proto', pr);
      node(n, `Checksum de cabecera: 0x${hx(be16(b, o + 10), 4)}`, o + 10, 2);
      node(n, `Dirección de origen: ${sip}`, o + 12, 4, 'ip.src', sip); node(n, `Dirección de destino: ${dip}`, o + 16, 4, 'ip.dst', dip);
      set('ip.addr', sip); set('ip.addr', dip);
      const p = o + ihl;
      if (pr === 6 && end - p >= 20) tcp(p, end, sip, dip);
      else if (pr === 17 && end - p >= 8) udp(p, end, sip, dip);
      else if (pr === 1 && end - p >= 8) icmp(p, end);
      else P.info = `IPv4, protocolo ${pr}`;
    }

    function icmp(o, end) {
      const ty = b[o], code = b[o + 1], id = be16(b, o + 4), sq = be16(b, o + 6);
      layer('icmp', o, end); P.proto = 'ICMP';
      const n = node(null, 'Internet Control Message Protocol', o, end - o);
      node(n, `Tipo: ${ty} (${ty === 8 ? 'Echo (ping) request' : ty === 0 ? 'Echo (ping) reply' : 'otro'})`, o, 1, 'icmp.type', ty);
      node(n, `Código: ${code}`, o + 1, 1);
      P.info = ty === 8 || ty === 0 ? `Echo (ping) ${ty === 8 ? 'request' : 'reply'}  id=0x${hx(id, 4)}, seq=${sq}` : `ICMP tipo ${ty}`;
    }

    function udp(o, end, sip, dip) {
      const sp = be16(b, o), dp = be16(b, o + 2), ul = be16(b, o + 4);
      const key = [sip + ':' + sp, dip + ':' + dp].sort().join('|');
      if (!udpConv.has(key)) udpConv.set(key, udpConv.size);
      const st = udpConv.get(key); P.udpStream = st;
      layer('udp', o, o + 8); P.proto = 'UDP';
      const n = node(null, `User Datagram Protocol, Src Port: ${sp}, Dst Port: ${dp}`, o, 8);
      node(n, `Puerto de origen: ${sp}`, o, 2, 'udp.srcport', sp); node(n, `Puerto de destino: ${dp}`, o + 2, 2, 'udp.dstport', dp);
      set('udp.port', sp); set('udp.port', dp);
      node(n, `Longitud: ${ul}`, o + 4, 2, 'udp.length', ul); node(n, `Checksum: 0x${hx(be16(b, o + 6), 4)}`, o + 6, 2);
      node(n, `[Índice de flujo: ${st}]`, o, 0, 'udp.stream', st);
      P.info = `${sp} → ${dp} Len=${ul - 8}`;
      const p = o + 8;
      if ((sp === 53 || dp === 53) && end - p >= 12) dns(p, end);
      else if ((sp === 67 || dp === 67 || sp === 68 || dp === 68) && end - p >= 240) dhcp(p, end);
    }

    function tcp(o, end, sip, dip) {
      const sp = be16(b, o), dp = be16(b, o + 2), seq = be32(b, o + 4), ack = be32(b, o + 8), hl = (b[o + 12] >> 4) * 4, fl = b[o + 13] | ((b[o + 12] & 1) << 8), win = be16(b, o + 14);
      const p = o + hl, len = Math.max(0, end - p);
      const a = sip + ':' + sp, z = dip + ':' + dp, key = [a, z].sort().join('|');
      let c = tcpConv.get(key);
      if (!c || ((fl & 0x12) === 0x02 && c.closed)) { c = { id: tcpConv.size, dir: {}, closed: false }; tcpConv.set(key + (tcpConv.has(key) ? '#' + tcpConv.size : ''), c); tcpConv.set(key, c); }
      const me = c.dir[a] || (c.dir[a] = { base: fl & 2 ? seq : (seq - 1) >>> 0, ws: -1, maxNext: 0 }), other = c.dir[z];
      if (fl & 2) { me.base = seq; let q = o + 20; while (q < p) { const k = b[q]; if (k === 0) break; if (k === 1) { q++; continue; } if (k === 3) me.ws = b[q + 2]; q += b[q + 1] || 1; } }
      if (fl & 5) c.closed = c.closed || !!(fl & 4);
      const rs = rel ? (seq - me.base) >>> 0 : seq, ra = fl & 16 ? (rel && other ? (ack - other.base) >>> 0 : ack) : 0;
      const nxt = (rs + len + (fl & 3 ? 1 : 0)) >>> 0;
      const retrans = len > 0 && rel && (seq - me.base) >>> 0 < me.maxNext && !(fl & 2);
      if (rel) me.maxNext = Math.max(me.maxNext, (seq - me.base + len + (fl & 3 ? 1 : 0)) >>> 0);
      const scaled = !(fl & 2) && me.ws >= 0 && other && other.ws >= 0 ? win * 2 ** me.ws : win;
      P.tcpStream = c.id; layer('tcp', o, o + hl); P.proto = 'TCP';
      const flagStr = FLAG_NAMES.filter(([m]) => fl & m).map(([, n]) => n).join(', ');
      const n = node(null, `Transmission Control Protocol, Src Port: ${sp}, Dst Port: ${dp}, Seq: ${rs}${fl & 16 ? `, Ack: ${ra}` : ''}, Len: ${len}`, o, hl);
      node(n, `Puerto de origen: ${sp}`, o, 2, 'tcp.srcport', sp); node(n, `Puerto de destino: ${dp}`, o + 2, 2, 'tcp.dstport', dp);
      set('tcp.port', sp); set('tcp.port', dp);
      node(n, `[Índice de flujo: ${c.id}]`, o, 0, 'tcp.stream', c.id);
      node(n, `[Longitud del segmento TCP: ${len}]`, o, 0, 'tcp.len', len);
      node(n, `Número de secuencia: ${rs}${rel ? '    (número relativo)' : ''}`, o + 4, 4, 'tcp.seq', rs);
      node(n, `Número de secuencia (bruto): ${seq}`, o + 4, 4, 'tcp.seq_raw', seq);
      node(n, `[Siguiente número de secuencia: ${nxt}${rel ? '    (relativo)' : ''}]`, o, 0, 'tcp.nxtseq', nxt);
      node(n, `Número de acuse: ${ra}${rel && fl & 16 ? '    (relativo)' : ''}`, o + 8, 4, 'tcp.ack', ra);
      node(n, `Número de acuse (bruto): ${ack}`, o + 8, 4, 'tcp.ack_raw', ack);
      node(n, `${(hl / 4).toString(2).padStart(4, '0')} .... = Longitud de cabecera: ${hl} bytes (${hl / 4})`, o + 12, 1, 'tcp.hdr_len', hl);
      const fn = node(n, `Flags: 0x${hx(fl, 3)} (${flagStr || '<ninguno>'})`, o + 12, 2, 'tcp.flags', fl);
      const bit = (m, nm, f, txtName) => node(fn, `${'.... ...'.slice(0, 0)}${txtName}: ${fl & m ? 'Set' : 'Not set'}`, o + 13, 1, f, fl & m ? 1 : 0);
      bit(32, 'URG', 'tcp.flags.urg', '.... ..0. .... = Urgent'.replace('0', fl & 32 ? 1 : 0));
      bit(16, 'ACK', 'tcp.flags.ack', `.... ...${fl & 16 ? 1 : 0} .... = Acknowledgment`);
      bit(8, 'PSH', 'tcp.flags.push', `.... .... ${fl & 8 ? 1 : 0}... = Push`);
      bit(4, 'RST', 'tcp.flags.reset', `.... .... .${fl & 4 ? 1 : 0}.. = Reset`);
      bit(2, 'SYN', 'tcp.flags.syn', `.... .... ..${fl & 2 ? 1 : 0}. = Syn`);
      bit(1, 'FIN', 'tcp.flags.fin', `.... .... ...${fl & 1 ? 1 : 0} = Fin`);
      node(n, `Ventana: ${win}`, o + 14, 2, 'tcp.window_size_value', win);
      if (scaled !== win) node(n, `[Ventana calculada: ${scaled}]`, o + 14, 2);
      node(n, `Checksum: 0x${hx(be16(b, o + 16), 4)}`, o + 16, 2);
      const optInfo = [];
      if (hl > 20) {
        const on = node(n, `Opciones: (${hl - 20} bytes)`, o + 20, hl - 20);
        let q = o + 20;
        while (q < p) {
          const k = b[q];
          if (k === 0) { node(on, 'Fin de la lista de opciones (EOL)', q, 1); break; }
          if (k === 1) { node(on, 'No-Operation (NOP)', q, 1); q++; continue; }
          const l = b[q + 1] || 2;
          if (k === 2) { const v = be16(b, q + 2); node(on, `Maximum segment size: ${v} bytes`, q, l, 'tcp.options.mss_val', v); optInfo.push(`MSS=${v}`); }
          else if (k === 3) { node(on, `Window scale: ${b[q + 2]} (multiplicar por ${2 ** b[q + 2]})`, q, l); optInfo.push(`WS=${2 ** b[q + 2]}`); }
          else if (k === 4) { node(on, 'SACK permitido', q, l); optInfo.push('SACK_PERM'); }
          else node(on, `Opción ${k}`, q, l);
          q += l;
        }
      }
      if (retrans) { const an = node(n, '[Análisis SEQ/ACK]', o, 0); node(an, '[Este segmento es una retransmisión]', o, 0, 'tcp.analysis.retransmission', 1); }
      if (len) { node(n, `Datos TCP (${len} bytes)`, p, len, 'tcp.payload', text(b, p, Math.min(end, p + 256))); }
      P.info = `${retrans ? '[TCP Retransmission] ' : ''}${sp} → ${dp} [${flagStr}] Seq=${rs}${fl & 16 ? ` Ack=${ra}` : ''} Win=${scaled} Len=${len}${optInfo.length ? ' ' + optInfo.join(' ') : ''}`;
      if (!len || retrans) return;
      if (sp === 445 || dp === 445) { if (b[p] === 0 && b[p + 4] === 0xfe) return smb(p, end); }
      if (sp === 88 || dp === 88) return kerberos(p + 4, end, p);
      if (sp === 21 || dp === 21) return ftp(p, end, dp === 21);
      const head = ascii(b, p, Math.min(end, p + 24));
      if (/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|CONNECT|TRACE) |^HTTP\/1\.[01] \d{3}/.test(head)) return http(p, end, sip, dip);
      if (b[p] >= 20 && b[p] <= 23 && b[p + 1] === 3) return tls(p, end, c.id);
    }

    function dns(o, end) {
      const id = be16(b, o), fl = be16(b, o + 2), qd = be16(b, o + 4), an = be16(b, o + 6), resp = fl >> 15, rc = fl & 15;
      layer('dns', o, end); P.proto = 'DNS';
      const n = node(null, `Domain Name System (${resp ? 'response' : 'query'})`, o, end - o);
      node(n, `ID de transacción: 0x${hx(id, 4)}`, o, 2, 'dns.id', id);
      const fn = node(n, `Flags: 0x${hx(fl, 4)} ${resp ? 'Standard query response' : 'Standard query'}${rc === 3 ? ', No such name' : rc ? `, rcode ${rc}` : resp ? ', No error' : ''}`, o + 2, 2);
      node(fn, `${resp}... .... .... .... = Response: ${resp ? 'Message is a response' : 'Message is a query'}`, o + 2, 2, 'dns.flags.response', resp);
      if (resp) node(fn, `.... .... .... ${rc.toString(2).padStart(4, '0')} = Reply code: ${rc === 0 ? 'No error' : rc === 3 ? 'No such name (NXDOMAIN)' : rc} (${rc})`, o + 2, 2, 'dns.flags.rcode', rc);
      node(n, `Preguntas: ${qd}`, o + 4, 2); node(n, `Respuestas: ${an}`, o + 6, 2, 'dns.count.answers', an);
      let p = o + 12, qn = '', qt = 1;
      const qs = node(n, 'Queries', p, 0);
      for (let i = 0; i < qd && p < end; i++) {
        const r = dnsReadName(b, o, p, end); qt = be16(b, r.end); qn = r.name;
        const q = node(qs, `${qn}: type ${DNS_T[qt] || qt}, class IN`, p, r.end + 4 - p);
        node(q, `Nombre: ${qn}`, p, r.end - p, 'dns.qry.name', qn); set('dns.qry.name.len', qn.length);
        node(q, `Tipo: ${DNS_T[qt] || qt} (${qt})`, r.end, 2, 'dns.qry.type', qt);
        p = r.end + 4;
      }
      qs.n = p - qs.s;
      const ans = [];
      if (an) {
        const as = node(n, 'Answers', p, 0);
        for (let i = 0; i < an && p + 10 <= end; i++) {
          const r = dnsReadName(b, o, p, end), ty = be16(b, r.end), ttl = be32(b, r.end + 4), rl = be16(b, r.end + 8), d = r.end + 10;
          let val = '', field = null;
          if (ty === 1) { val = ip4(b, d); field = 'dns.a'; }
          else if (ty === 5) { val = dnsReadName(b, o, d, end).name; field = 'dns.cname'; }
          else if (ty === 16) { val = ascii(b, d + 1, d + 1 + b[d]); field = 'dns.txt'; }
          else if (ty === 28) { val = Array.from({ length: 8 }, (_, k) => be16(b, d + k * 2).toString(16)).join(':'); }
          const a = node(as, `${r.name}: type ${DNS_T[ty] || ty}, class IN, ${ty === 1 ? 'addr' : ty === 5 ? 'cname' : ty === 16 ? 'txt' : 'data'} ${val}`, p, d + rl - p);
          node(a, `Nombre: ${r.name}`, p, r.end - p, 'dns.resp.name', r.name);
          node(a, `TTL: ${ttl} (${ttl} segundos)`, r.end + 4, 4, 'dns.resp.ttl', ttl);
          if (field) node(a, `${ty === 1 ? 'Address' : ty === 5 ? 'CNAME' : 'TXT'}: ${val}`, d, rl, field, val);
          ans.push(ty === 16 ? 'TXT' : `${DNS_T[ty] || ty} ${val}`); p = d + rl;
        }
        as.n = p - as.s;
      }
      P.info = `Standard query${resp ? ' response' : ''} 0x${hx(id, 4)}${rc === 3 ? ' No such name' : ''} ${DNS_T[qt] || qt} ${qn}${ans.length ? ' ' + ans.join(' ') : ''}`;
    }

    function dhcp(o, end) {
      const op = b[o], xid = be32(b, o + 4);
      layer('dhcp', o, end); P.proto = 'DHCP';
      const n = node(null, `Dynamic Host Configuration Protocol (${op === 1 ? 'Request' : 'Reply'})`, o, end - o);
      node(n, `ID de transacción: 0x${hx(xid, 8)}`, o + 4, 4);
      node(n, `Tu IP (yiaddr): ${ip4(b, o + 16)}`, o + 16, 4); node(n, `MAC del cliente: ${mac(b, o + 28)}`, o + 28, 6);
      let p = o + 240, ty = 0;
      while (p < end && b[p] !== 255) {
        const k = b[p]; if (k === 0) { p++; continue; } const l = b[p + 1];
        if (k === 53) { ty = b[p + 2]; node(n, `Opción (53) Tipo de mensaje DHCP: ${DHCP_T[ty]} (${ty})`, p, l + 2, 'dhcp.option.dhcp', ty); }
        else if (k === 12) { const h = ascii(b, p + 2, p + 2 + l); node(n, `Opción (12) Nombre del equipo: ${h}`, p, l + 2, 'dhcp.option.hostname', h); }
        else if (k === 50) node(n, `Opción (50) IP solicitada: ${ip4(b, p + 2)}`, p, l + 2);
        else if (k === 54) node(n, `Opción (54) Servidor DHCP: ${ip4(b, p + 2)}`, p, l + 2);
        else node(n, `Opción (${k})`, p, l + 2);
        p += l + 2;
      }
      P.info = `DHCP ${DHCP_T[ty] || ''} - Transaction ID 0x${hx(xid, 8)}`;
    }

    function http(o, end) {
      const lines = []; let p = o, bodyAt = end;
      while (p < end) {
        let q = p; while (q + 1 < end && !(b[q] === 13 && b[q + 1] === 10)) q++;
        if (q + 1 >= end) { lines.push([p, end]); p = end; break; }
        if (q === p) { bodyAt = q + 2; break; }
        lines.push([p, q]); p = q + 2;
      }
      layer('http', o, end); P.proto = 'HTTP';
      const first = text(b, ...lines[0]), isReq = !first.startsWith('HTTP/');
      const n = node(null, 'Hypertext Transfer Protocol', o, end - o);
      const fl = node(n, first + '\\r\\n', lines[0][0], lines[0][1] - lines[0][0] + 2);
      let ctype = '', host = '', uri = '';
      if (isReq) {
        const [m, u, v] = first.split(' '); uri = u;
        set('http.request', 1);
        node(fl, `Método: ${m}`, lines[0][0], m.length, 'http.request.method', m);
        node(fl, `URI: ${u}`, lines[0][0] + m.length + 1, u.length, 'http.request.uri', u);
        if (u.includes('?')) set('http.request.uri.query', u.slice(u.indexOf('?') + 1));
        node(fl, `Versión: ${v}`, lines[0][1] - v.length, v.length, 'http.request.version', v);
        P.info = first;
      } else {
        const m = first.match(/^(HTTP\/\d\.\d) (\d{3}) ?(.*)$/) || [];
        set('http.response', 1);
        node(fl, `Versión: ${m[1]}`, lines[0][0], 8);
        node(fl, `Código de estado: ${m[2]}`, lines[0][0] + 9, 3, 'http.response.code', +m[2]);
        node(fl, `Frase: ${m[3]}`, lines[0][0] + 13, (m[3] || '').length, 'http.response.phrase', m[3] || '');
        P.info = first;
      }
      const H = { 'host': 'http.host', 'user-agent': 'http.user_agent', 'referer': 'http.referer', 'cookie': 'http.cookie', 'set-cookie': 'http.set_cookie', 'authorization': 'http.authorization', 'www-authenticate': 'http.www_authenticate', 'location': 'http.location', 'server': 'http.server', 'content-type': 'http.content_type', 'content-length': 'http.content_length' };
      for (const [s, e] of lines.slice(1)) {
        const line = text(b, s, e), i = line.indexOf(':'), k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
        const f = H[k], hn = node(n, line + '\\r\\n', s, e - s + 2, f, f === 'http.content_length' ? +v : v);
        if (k === 'host') host = v;
        if (k === 'content-type') ctype = v.split(';')[0];
        if (k === 'cookie') v.split(/;\s*/).forEach(pair => node(hn, `Par de cookie: ${pair}`, s, e - s, 'http.cookie_pair', pair));
        if (k === 'authorization' && /^basic /i.test(v)) { let dec = ''; try { dec = atob(v.slice(6).trim()); } catch { dec = '?'; } node(hn, `Credenciales: ${dec}`, s, e - s, 'http.authbasic', dec); }
      }
      node(n, '\\r\\n', bodyAt - 2, 2);
      if (isReq) { const full = host ? `http://${host}${uri}` : uri; if (host) node(n, `[URI completa: ${full}]`, o, 0, 'http.request.full_uri', full); (httpPending.get(P.tcpStream) || httpPending.set(P.tcpStream, []).get(P.tcpStream)).push({ P, uri, full, t: P.t }); }
      else { const q = (httpPending.get(P.tcpStream) || []).shift(); if (q) { P.reqIn = q.P.no; q.P.resIn = P.no; node(n, `[Petición en la trama: ${q.P.no}]`, o, 0, 'http.request_in', q.P.no); node(n, `[Tiempo desde la petición: ${(P.t - q.t).toFixed(9)} s]`, o, 0, 'http.time', +(P.t - q.t).toFixed(9)); node(n, `[URI pedida: ${q.uri}]`, o, 0, 'http.request.uri', q.uri); if (q.full !== q.uri) node(n, `[URI completa pedida: ${q.full}]`, o, 0, 'http.request.full_uri', q.full); } }
      if (ctype === 'application/json') { P.proto = 'HTTP/JSON'; P.info += ` , JSON (${ctype})`; }
      else if (ctype) P.info += `  (${ctype})`;
      if (bodyAt < end) {
        const body = text(b, bodyAt, end);
        node(n, `Cuerpo (${end - bodyAt} bytes)`, bodyAt, end - bodyAt, 'http.file_data', body);
        if (ctype === 'application/json') { layer('json', bodyAt, end); node(null, 'JavaScript Object Notation: application/json', bodyAt, end - bodyAt); }
        if (ctype === 'application/x-www-form-urlencoded') {
          layer('urlencoded-form', bodyAt, end);
          const fn = node(null, 'HTML Form URL Encoded: application/x-www-form-urlencoded', bodyAt, end - bodyAt);
          let q = bodyAt;
          for (const pair of body.split('&')) {
            const [k, v = ''] = pair.split('='), dk = decodeURIComponent(k.replace(/\+/g, ' ')), dv = (() => { try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch { return v; } })();
            const item = node(fn, `Elemento del formulario: "${dk}" = "${dv}"`, q, TE.encode(pair).length);
            node(item, `Clave: ${dk}`, q, TE.encode(k).length, 'urlencoded-form.key', dk);
            node(item, `Valor: ${dv}`, q + TE.encode(k).length + 1, TE.encode(v).length, 'urlencoded-form.value', dv);
            q += TE.encode(pair).length + 1;
          }
        }
      }
    }

    function ftp(o, end, isReq) {
      const line = text(b, o, end).replace(/\r?\n$/, '');
      layer('ftp', o, end); P.proto = 'FTP';
      const n = node(null, 'File Transfer Protocol (FTP)', o, end - o);
      const ln = node(n, line + '\\r\\n', o, end - o);
      if (isReq) {
        const [cmd, ...rest] = line.split(' '), arg = rest.join(' ');
        node(ln, `Orden: ${cmd}`, o, cmd.length, 'ftp.request.command', cmd);
        if (arg) node(ln, `Argumento: ${arg}`, o + cmd.length + 1, arg.length, 'ftp.request.arg', arg);
        P.info = `Request: ${line}`;
      } else {
        const code = parseInt(line, 10);
        node(ln, `Código de respuesta: ${code}`, o, 3, 'ftp.response.code', code);
        P.info = `Response: ${line}`;
      }
    }

    function tls(o, end, stream) {
      layer('tls', o, end); P.proto = 'TLS';
      const parts = []; let p = o, kind = '';
      while (p + 5 <= end) {
        const ct = b[p], ver = be16(b, p + 1), l = be16(b, p + 3);
        if (!(ct >= 20 && ct <= 23) || b[p + 1] !== 3) break;
        const e = Math.min(end, p + 5 + l);
        let label = TLS_CT[ct];
        const rn = node(null, '', p, e - p);
        const opaque = ct === 23 && tlsVer.get(stream) === 13;
        node(rn, opaque ? `Tipo opaco: ${TLS_CT[ct]} (${ct})  ← en TLS 1.3 el tipo real va cifrado dentro` : `Tipo de contenido: ${TLS_CT[ct]} (${ct})`, p, 1, opaque ? 'tls.record.opaque_type' : 'tls.record.content_type', ct);
        node(rn, `Versión: 0x${hx(ver, 4)}`, p + 1, 2, 'tls.record.version', ver);
        node(rn, `Longitud: ${l}`, p + 3, 2);
        if (ct === 22 && e - p > 9) {
          const ht = b[p + 5]; label = TLS_HS[ht] || `Handshake ${ht}`;
          const hn = node(rn, `Handshake Protocol: ${label}`, p + 5, e - p - 5);
          node(hn, `Tipo de handshake: ${label} (${ht})`, p + 5, 1, 'tls.handshake.type', ht);
          if (ht === 1 || ht === 2) hello(hn, p + 9, e, ht, stream, (s) => { if (s) label += ` (SNI=${s})`; });
          if (ht === 1) kind = 'ch';
        } else if (ct === 23) node(rn, `Datos de aplicación cifrados: ${l} bytes`, p + 5, e - p - 5, 'tls.app_data', `${l} bytes cifrados`);
        else if (ct === 20) node(rn, 'Mensaje Change Cipher Spec', p + 5, e - p - 5);
        rn.label = `TLS Record Layer: ${TLS_CT[ct]} Protocol: ${label}`;
        parts.push(label); p = e;
      }
      P.tlsKind = kind || 'rec';
      const tnode = { label: 'Transport Layer Security', s: o, n: end - o, kids: P.tree.splice(P.tree.length - parts.length) };
      P.tree.push(tnode);
      P.info = parts.join(', ');
    }

    function hello(n, h, e, ht, stream, cb) {
      let p = h + 2; const rnd = Array.from(b.subarray(p, p + 32), x => hx(x)).join('');
      node(n, `Versión: 0x${hx(be16(b, h), 4)}`, h, 2);
      node(n, `Random: ${rnd}`, p, 32); p += 32;
      const sl = b[p]; node(n, `Longitud del Session ID: ${sl}`, p, 1); p += 1 + sl;
      if (ht === 1) { const cl = be16(b, p); node(n, `Cipher Suites (${cl / 2} suites)`, p, cl + 2); p += 2 + cl; p += 1 + b[p]; }
      else { const cs = be16(b, p); node(n, `Cipher Suite: 0x${hx(cs, 4)}${cs === 0x1301 ? ' (TLS_AES_128_GCM_SHA256)' : ''}`, p, 2, 'tls.handshake.ciphersuite', cs); p += 3; }
      if (p + 2 > e) return cb('');
      const el = be16(b, p), ee = Math.min(e, p + 2 + el); p += 2;
      let sni = '';
      while (p + 4 <= ee) {
        const t = be16(b, p), l = be16(b, p + 2), d = p + 4;
        if (t === 0) { const nl = be16(b, d + 3); sni = ascii(b, d + 5, d + 5 + nl); const x = node(n, `Extension: server_name (len=${l}) name=${sni}`, p, l + 4); node(x, `Server Name: ${sni}`, d + 5, nl, 'tls.handshake.extensions_server_name', sni); }
        else if (t === 16) { let q = d + 2; const names = []; while (q < d + l) { const sl2 = b[q]; names.push(ascii(b, q + 1, q + 1 + sl2)); q += 1 + sl2; } const x = node(n, `Extension: application_layer_protocol_negotiation (len=${l})`, p, l + 4); names.forEach(s => node(x, `ALPN Next Protocol: ${s}`, d, l, 'tls.handshake.extensions_alpn_str', s)); }
        else if (t === 43) {
          const x = node(n, `Extension: supported_versions (len=${l})`, p, l + 4);
          if (ht === 2) { const v = be16(b, d); node(x, `Supported Version: ${v === 0x0304 ? 'TLS 1.3' : 'TLS 1.2'} (0x${hx(v, 4)})`, d, 2, 'tls.handshake.extensions.supported_version', v); if (v === 0x0304) tlsVer.set(stream, 13); }
          else for (let q = d + 1; q < d + l; q += 2) { const v = be16(b, q); node(x, `Supported Version: ${v === 0x0304 ? 'TLS 1.3' : 'TLS 1.2'} (0x${hx(v, 4)})`, q, 2, 'tls.handshake.extensions.supported_version', v); }
        }
        else node(n, `Extension: ${({ 10: 'supported_groups', 13: 'signature_algorithms', 51: 'key_share' })[t] || 'tipo ' + t} (len=${l})`, p, l + 4);
        p = d + l;
      }
      cb(sni);
    }

    function smb(o, end) {
      const h = o + 4, cmd = rd16(b, h + 12), st = rd32(b, h + 8), flags = rd32(b, h + 16), resp = flags & 1, mid = rd32(b, h + 24), tree = rd32(b, h + 36);
      layer('nbss', o, o + 4); layer('smb2', h, end); P.proto = 'SMB2';
      node(null, `NetBIOS Session Service (longitud ${(b[o + 1] << 16) | be16(b, o + 2)})`, o, 4);
      const n = node(null, 'SMB2 (Server Message Block Protocol version 2)', h, end - h);
      const hn = node(n, 'Cabecera SMB2', h, 64);
      node(hn, `Estado NT: ${NT_ST[st] || '0x' + hx(st, 8)} (0x${hx(st, 8)})`, h + 8, 4, 'smb2.nt_status', st);
      node(hn, `Orden: ${SMB_CMD[cmd] || cmd} (${cmd})`, h + 12, 2, 'smb2.cmd', cmd);
      node(hn, `Flags: ${resp ? 'Respuesta' : 'Petición'}`, h + 16, 4);
      node(hn, `Message ID: ${mid}`, h + 24, 8); node(hn, `Tree ID: 0x${hx(tree, 8)}`, h + 36, 4);
      const body = h + 64, name = SMB_CMD[cmd] || `Cmd ${cmd}`;
      let info = `${name} ${resp ? 'Response' : 'Request'}`;
      if (resp && st) info += `, Error: ${NT_ST[st] || '0x' + hx(st, 8)}`;
      const bn = node(n, `${info}`, body, end - body);
      if (cmd === 1) {
        const off = rd16(b, body + (resp ? 4 : 12)), len = rd16(b, body + (resp ? 6 : 14));
        if (len >= 12 && ascii(b, h + off, h + off + 7) === 'NTLMSSP') info += ', ' + ntlm(bn, h + off, h + off + len);
      } else if (cmd === 3 && !resp) {
        const off = rd16(b, body + 4), len = rd16(b, body + 6), path = u16le(b, h + off, len);
        node(bn, `Tree: ${path}`, h + off, len, 'smb2.tree', path); info += ` Tree: ${path}`;
      }
      P.info = info;
    }

    function ntlm(parent, s, e) {
      const ty = rd32(b, s + 8); layer('ntlmssp', s, e);
      const n = node(parent, 'NTLM Secure Service Provider', s, e - s);
      node(n, 'Identificador NTLMSSP: NTLMSSP', s, 8);
      const names = { 1: 'NTLMSSP_NEGOTIATE', 2: 'NTLMSSP_CHALLENGE', 3: 'NTLMSSP_AUTH' };
      node(n, `Tipo de mensaje: ${names[ty]} (0x${hx(ty, 8)})`, s + 8, 4, 'ntlmssp.messagetype', ty);
      if (ty === 2) { const ch = Array.from(b.subarray(s + 24, s + 32), x => hx(x)).join(''); node(n, `NTLM Server Challenge: ${ch}`, s + 24, 8, 'ntlmssp.ntlmserverchallenge', ch); }
      if (ty === 3) {
        const fld = (at) => ({ len: rd16(b, s + at), off: rd32(b, s + at + 4) });
        const dom = fld(28), usr = fld(36), ws = fld(44);
        const d = u16le(b, s + dom.off, dom.len), u = u16le(b, s + usr.off, usr.len), w = u16le(b, s + ws.off, ws.len);
        node(n, `Dominio: ${d}`, s + dom.off, dom.len, 'ntlmssp.auth.domain', d);
        node(n, `Usuario: ${u}`, s + usr.off, usr.len, 'ntlmssp.auth.username', u);
        node(n, `Equipo: ${w}`, s + ws.off, ws.len, 'ntlmssp.auth.hostname', w);
        return `NTLMSSP_AUTH, User: ${d}\\${u}`;
      }
      return names[ty] || 'NTLMSSP';
    }

    function kerberos(o, end, rm) {
      const top = derNodes(b, o, end)[0]; if (!top) return;
      const mt = top.tag & 0x1f; layer('kerberos', rm, end); P.proto = 'KRB5';
      const n = node(null, 'Kerberos', rm, end - rm);
      node(n, `Record Mark: ${end - o} bytes`, rm, 4);
      const m = node(n, KRB[mt] ? KRB[mt].toLowerCase().replace('-', '-') : 'kerberos', top.s, top.ce - top.s);
      const seq = derFirst(top);
      node(m, `msg-type: krb-${(KRB[mt] || '').toLowerCase()} (${mt})`, top.s, 0, 'kerberos.msg_type', mt);
      const strs = (label, field, list, at) => list.forEach(s => node(m, `${label}: ${s}`, at.cs, at.ce - at.cs, field, s));
      if (mt === 10 || mt === 12) {
        const body = derFirst(derCtx(seq, 4));
        const cn = derCtx(body, 1); if (cn) strs('CNameString', 'kerberos.CNameString', princNames(b, cn), cn);
        const rl = derCtx(body, 2); if (rl) node(m, `realm: ${derStr(b, derFirst(rl))}`, rl.cs, rl.ce - rl.cs, 'kerberos.realm', derStr(b, derFirst(rl)));
        const sn = derCtx(body, 3); if (sn) strs('SNameString', 'kerberos.SNameString', princNames(b, sn), sn);
        const et = derFirst(derCtx(body, 8)); if (et && et.kids) et.kids.forEach(k => node(m, `ENCTYPE (que acepta el cliente): ${ETYPE[derInt(b, k)] || ''} (${derInt(b, k)})`, k.s, k.ce - k.s, 'kerberos.ENCTYPE', derInt(b, k)));
      } else if (mt === 11 || mt === 13) {
        const cr = derCtx(seq, 3); if (cr) node(m, `crealm: ${derStr(b, derFirst(cr))}`, cr.cs, cr.ce - cr.cs, 'kerberos.realm', derStr(b, derFirst(cr)));
        const cn = derCtx(seq, 4); if (cn) strs('CNameString', 'kerberos.CNameString', princNames(b, cn), cn);
        const tk = derFirst(derFirst(derCtx(seq, 5)));
        const tr = derCtx(tk, 1); if (tr) node(m, `realm: ${derStr(b, derFirst(tr))}`, tr.cs, tr.ce - tr.cs, 'kerberos.realm', derStr(b, derFirst(tr)));
        const ts = derCtx(tk, 2); if (ts) strs('SNameString', 'kerberos.SNameString', princNames(b, ts), ts);
        const te = derFirst(derCtx(derFirst(derCtx(tk, 3)), 0)); if (te) node(m, `etype del ticket: ${ETYPE[derInt(b, te)] || ''} (${derInt(b, te)})`, te.s, te.ce - te.s, 'kerberos.etype', derInt(b, te));
        const ee = derFirst(derCtx(derFirst(derCtx(seq, 6)), 0)); if (ee) node(m, `etype de enc-part: ${ETYPE[derInt(b, ee)] || ''} (${derInt(b, ee)})`, ee.s, ee.ce - ee.s, 'kerberos.etype', derInt(b, ee));
      }
      P.info = KRB[mt] || 'Kerberos';
    }
  }
}

/* Reglas de color (orden y espíritu de las de Wireshark) */
const COLOR_RULES = [
  { id: 'bad', name: 'Bad TCP', filter: 'tcp.analysis.retransmission', test: p => p.f['tcp.analysis.retransmission'] },
  { id: 'rst', name: 'TCP RST', filter: 'tcp.flags.reset == 1', test: p => p.f['tcp.flags.reset'] && p.f['tcp.flags.reset'][0] },
  { id: 'arp', name: 'ARP', filter: 'arp', test: p => p.f.arp },
  { id: 'icmp', name: 'ICMP', filter: 'icmp', test: p => p.f.icmp },
  { id: 'smb', name: 'SMB / Kerberos', filter: 'smb2 || kerberos', test: p => p.f.smb2 || p.f.kerberos },
  { id: 'http', name: 'HTTP', filter: 'http || tcp.port == 80', test: p => p.f.http || (p.f['tcp.port'] && p.f['tcp.port'].includes(80)) },
  { id: 'synfin', name: 'TCP SYN/FIN', filter: 'tcp.flags.syn == 1 || tcp.flags.fin == 1', test: p => p.f['tcp.flags'] && (p.f['tcp.flags'][0] & 3) },
  { id: 'tcp', name: 'TCP', filter: 'tcp', test: p => p.f.tcp },
  { id: 'udp', name: 'UDP', filter: 'udp', test: p => p.f.udp },
];
function colorOf(p) { const r = COLOR_RULES.find(r => r.test(p)); return r ? r.id : ''; }
