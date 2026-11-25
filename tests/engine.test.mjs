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
