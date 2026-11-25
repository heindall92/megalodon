import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './load.mjs';

const E = loadEngine();
const caps = {};
const cap = k => caps[k] || (caps[k] = E.dissectAll(E.SCENARIOS[k]()).pkts);

test('las ocho capturas se generan y se disecan sin errores', () => {
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
