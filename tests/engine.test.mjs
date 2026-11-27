import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadEngine } from './load.mjs';

const E = loadEngine();
const caps = {};
const cap = k => caps[k] || (caps[k] = E.dissectAll(E.SCENARIOS[k]()).pkts);
const fv = (p, k) => (p.f[k] || [])[0];

test('las nueve capturas se generan y se disecan sin errores', () => {
  for (const k of Object.keys(E.SCENARIOS)) {
    const pk = cap(k);
    assert.ok(pk.length > 10, `${k}: ${pk.length} paquetes`);
    assert.ok(E.SCENARIO_FILES[k], `${k} tiene nombre de fichero`);
  }
});

test('las capturas son deterministas (misma semilla, mismos bytes)', () => {
  for (const k of Object.keys(E.SCENARIOS)) {
    const a = E.SCENARIOS[k](), b = E.SCENARIOS[k]();
    assert.equal(a.length, b.length);
    a.forEach((p, i) => assert.deepEqual(Array.from(p.b), Array.from(b[i].b), `${k} #${i + 1}`));
  }
});

test('pcapng y pcap: exportar y volver a leer conserva cada paquete', () => {
  for (const k of Object.keys(E.SCENARIOS)) {
    const raw = E.SCENARIOS[k]();
    for (const write of [E.writePcapng, E.writePcap]) {
      const back = E.readCapture(write(raw));
      assert.equal(back.length, raw.length, `${k}: número de paquetes`);
      back.forEach((p, i) => { assert.deepEqual(Array.from(p.b), Array.from(raw[i].b)); assert.ok(Math.abs(p.t - raw[i].t) < 1e-5); });
    }
  }
});

test('cada reto tiene solución comprobable contra su captura', () => {
  let n = 0;
  for (const m of E.MODULES) {
    const pk = cap(m.cap);
    for (const t of m.tasks) {
      n++;
      if (t.type === 'filter') {
        const r = E.parseFilter(t.ref); assert.ok(r.ok, `${t.id}: el filtro de referencia no compila (${r.error})`);
        assert.ok(pk.filter(r.test).length > 0, `${t.id}: el filtro de referencia no encuentra paquetes`);
      } else if (t.type === 'packet') {
        const r = E.parseFilter(t.match); assert.ok(r.ok, `${t.id}: ${t.match}`);
        assert.ok(pk.filter(r.test).length > 0, `${t.id}: ningún paquete cumple ${t.match}`);
      } else if (t.type === 'choice') {
        assert.ok(Number.isInteger(t.ans) && t.ans >= 0 && t.ans < t.opts.length, `${t.id}: respuesta fuera de rango`);
      } else if (t.type === 'text') {
        assert.ok(Array.isArray(t.ans) && t.ans.length, `${t.id}: sin respuestas aceptadas`);
        if (t.proof) { const r = E.parseFilter(t.proof); assert.ok(r.ok, `${t.id}: prueba ${t.proof}`); assert.ok(pk.filter(r.test).length > 0, `${t.id}: la prueba no encuentra el dato`); }
      } else assert.fail(`${t.id}: tipo desconocido ${t.type}`);
      assert.ok(t.hints && t.hints.length, `${t.id}: sin pistas`);
    }
  }
  assert.ok(n >= 50, `${n} retos`);
});

test('los botones «Pruébalo» de las lecciones usan filtros válidos', () => {
  let n = 0;
  for (const m of E.MODULES) for (const l of m.lessons) for (const [f] of (l.try || [])) {
    n++; const r = E.parseFilter(f); assert.ok(r.ok, `${m.id}: «${f}» no compila`);
    assert.ok(cap(m.cap).filter(r.test).length > 0, `${m.id}: «${f}» no muestra ningún paquete`);
  }
  assert.ok(n >= 40, `${n} botones Pruébalo`);
});

test('el analizador de filtros acepta la sintaxis de Wireshark y rechaza errores con posición', () => {
  for (const f of ['tcp', 'ip.addr == 192.168.56.10', 'tcp.port in {80, 443}', 'tcp.port in {443, 4430..4434}', 'http.request.method == "POST"', 'dns.qry.name contains "ewpt"', 'not arp', 'tcp.flags.syn==1 && tcp.flags.ack==0', 'frame.len > 100 || udp', 'http.host matches "lab"', 'tcp.stream eq 0'])
    assert.ok(E.parseFilter(f).ok, f);
  for (const f of ['tcp.port ==', 'ip.addr = = 1', '(tcp', 'tcp.flgs.syn == 1', '== 80']) {
    const r = E.parseFilter(f);
    assert.equal(r.ok, false, f);
  }
  // Wireshark 4.x: los elementos del conjunto se separan con comas (guía de usuario, 6.4)
  const sinComas = E.parseFilter('tcp.port in {80 443}');
  assert.equal(sinComas.ok, false); assert.match(String(sinComas.error || sinComas.msg || JSON.stringify(sinComas)), /comas/);
  const err = E.parseFilter('tcp.flgs.syn == 1');
  assert.match(JSON.stringify(err), /tcp\.flags/, 'sugiere el campo correcto');
  assert.ok(E.parseFilter('').ok, 'el filtro vacío lo muestra todo');
});

test('estadísticas: conversaciones, jerarquía y Follow TCP Stream del módulo 1', () => {
  const pk = cap('m1');
  const conv = E.conversations(pk);
  assert.ok(conv && Object.keys(conv).length, 'hay conversaciones');
  assert.ok(E.protocolHierarchy(pk), 'hay jerarquía de protocolos');
  const fl = E.followTcp(pk, 0);
  assert.ok(JSON.stringify(fl).includes('GET /'), 'el flujo 0 contiene la petición GET');
});

test('checksums de Internet (RFC 1071) correctos', () => {
  // ejemplo clásico de cabecera IPv4 con checksum 0xb861
  const hdr = [0x45, 0x00, 0x00, 0x73, 0x00, 0x00, 0x40, 0x00, 0x40, 0x11, 0x00, 0x00, 0xc0, 0xa8, 0x00, 0x01, 0xc0, 0xa8, 0x00, 0xc7];
  assert.equal(E.csum(hdr), 0xb861);
});

test('información experta con los mensajes y severidades de Wireshark', () => {
  const m1 = E.expertInfo(cap('m1'));
  const rst = m1.items.find(i => i.summary === 'Connection reset (RST)');
  assert.ok(rst && rst.sev === 'warn', 'RST es Warning');
  assert.deepEqual(rst.nos.length, 1, 'un RST en el módulo 1 (puerto 8080)');
  assert.ok(m1.items.some(i => i.sev === 'chat' && i.summary === 'Connection establish request (SYN): server port 80'));
  assert.ok(m1.items.some(i => i.sev === 'chat' && i.summary === 'Connection establish acknowledge (SYN+ACK): server port 80'));
  const fin = m1.items.find(i => i.summary === 'Connection finish (FIN)');
  assert.equal(fin.nos.length, 4, 'cuatro FIN, como dice el reto m1-fin');
  const m2 = E.expertInfo(cap('m2'));
  assert.equal(m2.count.note, 1, 'la retransmisión del CSS es una Note');
  assert.ok(m2.items[0].sev === 'note', 'ordenado por severidad');
  assert.equal(E.expertInfo(cap('m6')).count.warn, E.parseFilter('tcp.flags.reset == 1').test && cap('m6').filter(E.parseFilter('tcp.flags.reset == 1').test).length);
});

test('exportar objetos HTTP: cuerpos exactos y nombres seguros', () => {
  const objs = E.httpObjects(cap('m2'));
  const idx = objs.find(o => o.no === 8);
  assert.equal(idx.name, 'index.html'); assert.equal(idx.host, 'tienda.ewpt.local');
  assert.equal(idx.size, cap('m2').find(p => p.no === 8).f['http.content_length'][0], 'el tamaño coincide con Content-Length');
  assert.match(new TextDecoder().decode(idx.data), /<title>Tienda ACME<\/title>/);
  for (const k of Object.keys(E.SCENARIOS)) for (const o of E.httpObjects(cap(k))) {
    assert.match(o.name, /^[\w.\-]+$/, `${k}: nombre seguro ${o.name}`);
    assert.ok(!o.name.startsWith('.'), 'sin ficheros ocultos');
  }
  assert.ok(E.httpObjects(cap('m6')).some(o => o.name === 'robots.txt'), 'robots.txt del módulo 6');
});

test('credenciales: HTTP Basic, FTP y NTLMSSP', () => {
  const c3 = E.credentials(cap('m3'));
  assert.equal(JSON.stringify(c3.map(c => [c.proto, c.user])), JSON.stringify([['HTTP', 'admin'], ['FTP', 'backup']]));
  assert.equal(JSON.stringify(E.credentials(cap('m7')).map(c => c.user)), JSON.stringify(['MEGACORP\\svc_backup']));
  assert.equal(E.credentials(cap('m1')).length, 0);
});

test('seguir flujo UDP: la consulta DNS y su respuesta', () => {
  const pk = cap('m4');
  const s = pk.find(p => p.f['udp.stream']).f['udp.stream'][0];
  const fl = E.followUdp(pk, s);
  assert.equal(fl.filter, `udp.stream eq ${s}`);
  assert.ok(fl.chunks.length >= 2 && fl.chunks.some(c => !c.client), 'pregunta y respuesta');
  assert.match(fl.chunks[0].text, /ewpt/, 'el nombre consultado se lee en el flujo');
});

test('los retos que usan las herramientas tienen la respuesta que dicen', () => {
  const task = id => E.MODULES.flatMap(m => m.tasks).find(t => t.id === id);
  // m6-expert: los avisos de la información experta
  assert.ok(task('m6-expert').ans.includes(String(E.expertInfo(cap('m6')).count.warn)));
  // m6-robots: robots.txt esconde backup.zip
  const robots = E.httpObjects(cap('m6')).find(o => o.name === 'robots.txt');
  assert.match(new TextDecoder().decode(robots.data), /Disallow: \/backup\.zip/);
  // m6-zip: el paquete elegido lleva la firma 50 4B 03 04 y es el único con ella
  const zipHex = [0x50, 0x4b, 0x03, 0x04], has = b => { for (let i = 0; i + 4 <= b.length; i++) if (zipHex.every((x, j) => b[i + j] === x)) return true; return false; };
  const withZip = cap('m6').filter(p => has(p.b));
  assert.equal(withZip.length, 1);
  assert.ok(E.parseFilter(task('m6-zip').match).test(withZip[0]));
  // m8-beacon: intervalo entre peticiones al C2
  const b = cap('m8').filter(E.parseFilter(task('m8-beacon').proof).test);
  const d = b.slice(1).map((p, i) => p.t - b[i].t);
  assert.ok(d.length >= 4 && d.every(x => Math.abs(x - 60) < 1), `intervalos ${d.map(x => x.toFixed(2))}`);
  // m8-exfdata: concatenar los trozos en orden y decodificar
  const q = cap('m8').filter(E.parseFilter('dns.qry.name contains "exfil" && dns.flags.response == 0').test).map(p => p.f['dns.qry.name'][0]);
  const parts = q.map(n => n.split('.')).sort((x, y) => +x[1] - +y[1]).map(x => x[0]).join('');
  assert.match(Buffer.from(parts, 'base64').toString(), new RegExp(`db:${task('m8-exfdata').ans[0].replace(/[!]/g, '\\$&')}`));
});

/* ---------- Módulo 9 · VoIP: SIP, SDP, RTP, RTCP y DTMF ---------- */
const TSHARK_M9 = JSON.parse(readFileSync(new URL('./tshark/m9.json', import.meta.url), 'utf8'));
const task9 = id => E.MODULES.find(m => m.id === 'm9').tasks.find(t => t.id === id);
const V = () => E.VOIP_M9;
const uq = v => String(v ?? '').replace(/^"(.*)"$/, '$1');      // Wireshark guarda los parámetros Digest con sus comillas

test('MD5 y Digest: iguales a node:crypto y al ejemplo de la RFC 2617', () => {
  for (const s of ['', 'abc', 'message digest', 'x'.repeat(1000), '1001:voip.local:verano2026', 'ñandú €'])
    assert.equal(E.md5Hex(s), createHash('md5').update(s).digest('hex'), s.slice(0, 20));
  assert.equal(E.digestResponse({ user: 'Mufasa', realm: 'testrealm@host.com', pass: 'Circle Of Life', method: 'GET', uri: '/dir/index.html', nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093', nc: '00000001', cnonce: '0a4f113b', qop: 'auth' }), '6629fae49393a05397450978507c4ef1');
});

test('el response Digest del REGISTER de la captura es el de la contraseña de Alicia (y no el de otras)', () => {
  const p = cap('m9').find(x => fv(x, 'sip.auth.digest.response') && uq(fv(x, 'sip.auth.username')) === '1001');
  const f = k => uq(fv(p, k)), md5 = s => createHash('md5').update(s).digest('hex');
  const resp = pass => md5(`${md5(`${f('sip.auth.username')}:${f('sip.auth.realm')}:${pass}`)}:${f('sip.auth.nonce')}:${f('sip.auth.nc')}:${f('sip.auth.cnonce')}:${f('sip.auth.qop')}:${md5(`REGISTER:${f('sip.auth.uri')}`)}`);
  assert.equal(f('sip.auth.digest.response'), resp(V().pass), 'un diccionario con la contraseña la encuentra');
  for (const wrong of ['1001', 'verano2025', 'Verano2026']) assert.notEqual(f('sip.auth.digest.response'), resp(wrong));
  // los tres intentos del escáner son Digest válidos de contraseñas que no son la buena: la centralita contesta 403
  const tries = cap('m9').filter(x => uq(fv(x, 'sip.auth.username')) === V().victim && fv(x, 'sip.Method') === 'REGISTER');
  assert.equal(tries.length, V().guesses.length);
  tries.forEach((x, i) => assert.equal(uq(fv(x, 'sip.auth.digest.response')), md5(`${md5(`${V().victim}:${V().realm}:${V().guesses[i]}`)}:${uq(fv(x, 'sip.auth.nonce'))}:${md5(`REGISTER:sip:${V().realm}`)}`)));
});

test('G.711: µ-law y A-law decodifican como la tabla de la ITU-T y la ida y vuelta conserva la señal', () => {
  assert.deepEqual([0, -1, 32767, -32768, 1000].map(E.ulawEnc), [0xff, 0x7f, 0x80, 0x00, 0xce]);
  assert.deepEqual([0xff, 0x7f, 0x80, 0x00, 0xce].map(E.ulawDec), [0, 0, 32124, -32124, 988]);
  assert.deepEqual([0xd5, 0x55, 0xaa, 0x2a].map(E.alawDec), [8, -8, 32256, -32256]);
  for (let s = -32000; s <= 32000; s += 37) { const d = E.ulawDec(E.ulawEnc(s)); assert.ok(Math.abs(d - s) <= Math.max(8, Math.abs(s) / 15), `${s} → ${d}`); }
});

test('SIP: petición, respuesta, cabeceras, Digest y SDP con los campos de Wireshark', () => {
  const pk = cap('m9'), inv = pk.find(p => fv(p, 'sip.Method') === 'INVITE');
  assert.equal(inv.f['frame.protocols'][0], 'eth:ethertype:ip:udp:sip:sdp');
  assert.equal(inv.proto, 'SIP/SDP');
  assert.equal(fv(inv, 'sip.r-uri'), `sip:${V().dest}@${V().realm}`);
  assert.equal(fv(inv, 'sip.Call-ID'), V().callId);
  assert.equal(fv(inv, 'sip.from.user'), V().user); assert.equal(fv(inv, 'sip.to.user'), V().dest);
  assert.equal(fv(inv, 'sip.CSeq.seq'), 101); assert.equal(fv(inv, 'sip.CSeq.method'), 'INVITE');
  assert.equal(fv(inv, 'sip.Via.sent-by.address'), E.VOIP_HOSTS.tel.ip); assert.match(fv(inv, 'sip.Via.branch'), /^z9hG4bK/);
  assert.equal(fv(inv, 'sdp.connection_info.address'), E.VOIP_HOSTS.tel.ip); assert.equal(fv(inv, 'sdp.media.port'), V().portTel);
  assert.deepEqual([...inv.f['sdp.mime.type']], ['PCMU', 'telephone-event']);
  assert.equal(inv.info, 'Request: INVITE sip:*97@voip.local | ');
  const c401 = pk.find(p => fv(p, 'sip.Status-Code') === 401);
  assert.equal(fv(c401, 'sip.auth.realm'), `"${V().realm}"`, 'con comillas, como Wireshark'); assert.equal(uq(fv(c401, 'sip.auth.nonce')), V().nonce); assert.equal(fv(c401, 'sip.CSeq.method'), 'REGISTER');
  assert.equal(c401.info, 'Status: 401 Unauthorized | ');
  assert.equal(pk.find(p => fv(p, 'sip.Status-Code') === 200).info, 'Status: 200 OK (REGISTER)  (1 binding) | ');
  assert.equal(pk[0].info, 'Request: REGISTER sip:voip.local  (1 binding) | ');
  // la Content-Length de cada mensaje SIP coincide con los bytes de su cuerpo
  for (const p of pk.filter(x => x.f.sip)) {
    const r = p.layers.sip, s = new TextDecoder().decode(p.b.subarray(r[0], r[1]));
    assert.equal(new TextEncoder().encode(s.slice(s.indexOf('\r\n\r\n') + 4)).length, fv(p, 'sip.Content-Length'), `trama ${p.no}`);
  }
});

test('RTP se asocia a la llamada por el SDP, como en Wireshark, y RTCP va en el puerto siguiente', () => {
  const pk = cap('m9'), sdpFrames = new Map(pk.filter(p => p.f.sdp).map(p => [p.no, p]));
  const rtp = pk.filter(p => p.f.rtp), rtcp = pk.filter(p => p.f.rtcp);
  assert.ok(rtp.length > 550, `${rtp.length} RTP`); assert.equal(rtcp.length, 2 * V().rtcpAt.length);
  // como Wireshark, los dos sentidos se atribuyen a la oferta SDP (el INVITE) y van a una dirección anunciada en la llamada
  const announced = new Set([...sdpFrames.values()].map(s => `${fv(s, 'sdp.connection_info.address')}:${fv(s, 'sdp.media.port')}`));
  for (const p of [...rtp, ...rtcp]) {
    const s = sdpFrames.get(fv(p, p.f.rtp ? 'rtp.setup-frame' : 'rtcp.setup-frame')); assert.ok(s, `trama ${p.no}: setup-frame apunta a un SDP`);
    assert.equal(fv(s, 'sip.Method'), 'INVITE'); assert.equal(fv(s, 'sip.Call-ID'), V().callId);
    const off = p.f.rtcp ? 1 : 0;
    assert.ok(announced.has(`${p.dst}:${fv(p, 'udp.dstport') - off}`) || announced.has(`${p.src}:${fv(p, 'udp.srcport') - off}`), `trama ${p.no}: va a (o viene de) lo anunciado`);
  }
  for (const p of rtcp) assert.ok([V().portTel + 1, V().portPbx + 1].includes(fv(p, 'udp.dstport')));
  assert.equal(pk.filter(p => p.f.udp && !p.f.sip && !p.f.rtp && !p.f.rtcp).length, 0, 'ningún UDP sin disecar');
  // antes del primer SDP no hay RTP posible: el mismo paquete sin el INVITE delante es UDP a secas
  const raw = E.SCENARIOS.m9(), alone = E.dissectAll([raw[rtp[0].no - 1]]).pkts[0];
  assert.ok(alone.f.udp && !alone.f.rtp);
});

test('análisis de flujos RTP: perdidos, delta máximo y jitter recalculados desde los paquetes', () => {
  const pk = cap('m9'), st = E.rtpStreams(pk);
  assert.equal(st.length, 2);
  for (const s of st) {
    const mine = pk.filter(p => p.f.rtp && fv(p, 'rtp.ssrc') === s.ssrc);
    const seqs = mine.map(p => fv(p, 'rtp.seq')), lost = Math.max(...seqs) - Math.min(...seqs) + 1 - new Set(seqs).size;
    assert.equal(s.lost, lost, `0x${s.ssrc.toString(16)}: perdidos`);
    // delta máximo entre paquetes normales (Wireshark no cuenta los que llevan marcador)
    const deltas = mine.slice(1).map((p, i) => [(p.t - mine[i].t) * 1000, fv(p, 'rtp.marker')]).filter(([, mk]) => !mk).map(([d]) => d);
    assert.ok(Math.abs(s.maxDelta - Math.max(...deltas)) < 1e-3);
    // sin eventos DTMF, el jitter de Wireshark es el de la RFC 3550 (A.8)
    if (!mine.some(p => p.f.rtpevent)) {
      let j = 0, prev = null, mx = 0;
      for (const p of mine) { const tr = p.t * 8000 - fv(p, 'rtp.timestamp'); if (prev !== null) { j += (Math.abs(tr - prev) - j) / 16; if (!fv(p, 'rtp.marker')) mx = Math.max(mx, j / 8); } prev = tr; }
      assert.ok(Math.abs(s.maxJitter - mx) < 1e-3, `jitter máx ${s.maxJitter} vs ${mx}`);
    }
  }
  // y todo coincide con Telephony › RTP › RTP Streams de tshark (tests/tshark/m9.json)
  for (const r of TSHARK_M9.rtp) {
    const s = st.find(x => x.ssrc === r.ssrc && x.src === r.src && x.sport === r.sport);
    assert.ok(s, `flujo 0x${r.ssrc.toString(16)}`);
    for (const k of ['pkts', 'lost', 'maxDelta', 'meanDelta', 'maxJitter', 'meanJitter']) assert.ok(Math.abs(s[k] - r[k]) < 0.0015, `0x${r.ssrc.toString(16)} ${k}: ${s[k]} frente a ${r[k]} de tshark`);
  }
  const down = st.find(s => s.src === E.VOIP_HOSTS.pbx.ip), up = st.find(s => s.src === E.VOIP_HOSTS.tel.ip);
  assert.equal(down.lost, V().lostPbx.length); assert.equal(up.lost, 0);
  assert.ok(down.maxDelta > 60 && down.lost > 0 && up.maxDelta < 21, 'la red falla en el sentido centralita → teléfono');
  assert.ok(up.maxJitter > down.maxJitter, 'el jitter alto del teléfono lo causan los DTMF, como en Wireshark');
  assert.equal(down.status, 'problems'); assert.equal(up.status, 'ok');
  // el último RTCP del teléfono informa de los mismos perdidos
  const last = pk.filter(p => p.f.rtcp && p.src === E.VOIP_HOSTS.tel.ip).pop();
  assert.equal(fv(last, 'rtcp.ssrc.cum_nr'), down.lost); assert.equal(fv(last, 'rtcp.ssrc.identifier'), down.ssrc);
  assert.ok(task9('m9-lost').ans.includes(String(down.lost)));
  assert.ok(E.parseFilter(task9('m9-rtcp').match).test(last));
  // m9-rtp: el SSRC del reto es el del flujo de la centralita y equivale a rtp && ip.src
  const a = pk.filter(E.parseFilter(task9('m9-rtp').ref).test).map(p => p.no), b = pk.filter(E.parseFilter('rtp && ip.src == 10.20.0.5').test).map(p => p.no);
  assert.deepEqual(a, b); assert.equal(a.length, down.pkts);
});

test('DTMF: los eventos RFC 4733 dan el PIN del reto y cada tecla acaba con tres paquetes E', () => {
  const pk = cap('m9'), st = E.rtpStreams(pk).find(s => s.src === E.VOIP_HOSTS.tel.ip);
  assert.equal(st.digits, V().pin);
  assert.ok(task9('m9-dtmf').ans.includes(V().pin.replace('#', '')));
  const ev = pk.filter(p => p.f.rtpevent);
  assert.equal(ev.filter(p => fv(p, 'rtpevent.end_of_event') === 1).length, 3 * V().pin.length);
  assert.equal(ev.filter(p => fv(p, 'rtp.marker') === 1).length, V().pin.length);
  const byTs = new Map(); ev.forEach(p => { const k = fv(p, 'rtp.timestamp'); (byTs.get(k) || byTs.set(k, []).get(k)).push(p); });
  for (const [, g] of byTs) {
    assert.equal(new Set(g.map(p => fv(p, 'rtpevent.event_id'))).size, 1, 'una tecla por marca de tiempo');
    const d = g.map(p => fv(p, 'rtpevent.duration')); assert.deepEqual(d, [...d].sort((x, y) => x - y), 'la duración solo crece');
  }
  assert.equal(ev[0].info, 'Payload type=RTP Event, DTMF Four 4');
  assert.equal(ev.find(p => fv(p, 'rtpevent.end_of_event') === 1).info, 'Payload type=RTP Event, DTMF Four 4 (end)');
});

test('Telefonía: llamadas VoIP, flujo SIP, audio y WAV', () => {
  const pk = cap('m9'), calls = E.voipCalls(pk);
  assert.deepEqual([...calls].map(c => [c.stateName, c.to]), [['COMPLETED', `sip:${V().dest}@${V().realm}`], ['REJECTED', `sip:${V().fraudNumber}@${V().realm}`]]);
  assert.equal(calls[0].callId, task9('m9-callid').ans[0]); assert.equal(calls[0].streams.length, 2); assert.equal(calls[1].streams.length, 0);
  const fl = E.sipFlow(pk);
  assert.equal(fl.items.filter(i => i.kind === 'sip').length, pk.filter(p => p.f.sip).length);
  assert.deepEqual([...fl.hosts].sort(), ['10.20.0.21', '10.20.0.5', '10.20.0.66']);
  assert.deepEqual([...fl.items].map(i => i.rel), [...fl.items].map(i => i.rel).sort((x, y) => x - y), 'en orden de tiempo');
  const one = E.sipFlow(pk, V().callId);
  assert.deepEqual([...one.items].filter(i => i.kind === 'sip').map(i => i.label), ['INVITE', '100 Trying', '180 Ringing', '200 OK', 'ACK', 'BYE', '200 OK']);
  assert.equal(one.items.filter(i => i.kind === 'dtmf').map(i => i.label.slice(-1)).join(''), V().pin);
  const down = E.rtpStreams(pk).find(s => s.src === E.VOIP_HOSTS.pbx.ip), au = E.rtpAudio(pk, down.key);
  assert.equal(au.rate, 8000); assert.equal(au.samples.length, V().slots * 160);
  for (const k of V().lostPbx) assert.ok(au.samples.subarray(k * 160, k * 160 + 160).every(x => x === 0), `ranura ${k} perdida = silencio`);
  assert.ok(au.samples.subarray(40 * 160, 41 * 160).some(x => Math.abs(x) > 0.02), 'la locución suena');
  const wav = E.wavFile(au.samples, au.rate), dv = new DataView(wav.buffer);
  assert.equal(new TextDecoder().decode(wav.subarray(0, 4)), 'RIFF'); assert.equal(new TextDecoder().decode(wav.subarray(8, 12)), 'WAVE');
  assert.equal(dv.getUint32(24, true), 8000); assert.equal(dv.getUint16(34, true), 16); assert.equal(wav.length, 44 + au.samples.length * 2);
  assert.equal(E.voipCalls(cap('m1')).length, 0); assert.equal(E.rtpStreams(cap('m4')).length, 0);
});

test('RTCP Receiver Report y escáner SIP', () => {
  const raw = E.SCENARIOS.m9(), c = new E.Cap(1, raw[raw.length - 1].t + 1), { tel, pbx } = E.VOIP_HOSTS;
  c.pkts = raw.slice();
  c.udp(tel, pbx, V().portTel + 1, V().portPbx + 1, E.rtcpRR({ ssrc: V().ssrcTel, rb: { ssrc: V().ssrcPbx, fraction: 12, cum: 9, extHigh: 4609, jitter: 31, lsr: 0, dlsr: 0 } }));
  const rr = E.dissectAll(c.pkts).pkts.pop();
  assert.equal(rr.info, 'Receiver Report   ');
  assert.equal(fv(rr, 'rtcp.pt'), 201); assert.equal(fv(rr, 'rtcp.length'), 7); assert.equal(fv(rr, 'rtcp.ssrc.fraction'), 12); assert.equal(fv(rr, 'rtcp.ssrc.cum_nr'), 9); assert.equal(fv(rr, 'rtcp.ssrc.jitter'), 31);
  const scan = cap('m9').filter(E.parseFilter(task9('m9-scan').proof).test);
  assert.ok(scan.length >= 8 && scan.every(p => p.src === E.VOIP_HOSTS.atk.ip));
  assert.ok(task9('m9-scan').ans.includes(fv(scan[0], 'sip.User-Agent')));
  assert.equal(cap('m9').filter(p => fv(p, 'sip.Status-Code') === 403).length, V().guesses.length + 1, 'tres contraseñas y el INVITE rechazados');
});

test('módulo 9 contrastado con tshark: Protocolo e Info de cada trama y el resultado de cada filtro', () => {
  const pk = cap('m9');
  assert.match(TSHARK_M9.tshark, /^TShark \(Wireshark\) 4\./);
  assert.equal(TSHARK_M9.columns.length, pk.length);
  const bad = TSHARK_M9.columns.map(([proto, info], i) => [i + 1, proto, info]).filter(([no, proto, info]) => pk[no - 1].proto !== proto || pk[no - 1].info !== info);
  assert.deepEqual(bad.slice(0, 5).map(([no, proto, info]) => `${no}: ${pk[no - 1].proto} «${pk[no - 1].info}» ≠ ${proto} «${info}»`), []);
  const m9 = E.MODULES.find(m => m.id === 'm9'), used = new Set();
  for (const l of m9.lessons) for (const [f] of l.try) used.add(f);
  for (const x of m9.tasks) for (const f of [x.ref, x.match, x.proof]) if (f) used.add(f);
  for (const f of used) assert.ok(TSHARK_M9.filters[f], `falta en la referencia: ${f}. Regenera con node scripts/tshark-ref.mjs m9`);
  for (const [f, nos] of Object.entries(TSHARK_M9.filters)) {
    const r = E.parseFilter(f); assert.ok(r.ok, f);
    assert.equal(pk.filter(r.test).map(p => p.no).join(','), nos.join(','), `«${f}» no deja pasar las mismas tramas que tshark`);
  }
});
