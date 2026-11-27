// Interfaz en inglés: los mensajes de error del motor de filtros (en español) se traducen todos,
// y las claves de STRINGS existen en los dos idiomas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEngine } from './load.mjs';

const E = loadEngine();
const ws = readFileSync(new URL('../src/app/30-workspace.js', import.meta.url), 'utf8');
const fErr = new Function('LANG', ws.slice(ws.indexOf('const FERR_EN'), ws.indexOf('const treeKey')) + '; return fErr;')('en');
const SPANISH = /[áéíóúñ¿«»]|\b(falta|el|la|del|para|campo|valor|se esperaba|no es|termina|conjunto|vale)\b/i;

const BAD = ['ip.src = 1', 'tcp.port | 80', 'ip.addr == 999.1.1.1', 'tcp.port == abc', 'htp', 'tcp.flg == 2', 'tcp.port in {80 443}', 'tcp.port in {}',
  'http == 1', 'tcp.port == 80 http', 'tcp.port contains "a"', '(tcp', 'ip.src ==', 'eth.addr == zz', 'http.host matches "("', 'http.host == "abc',
  '&& tcp', 'len(tcp', 'len(tcp.len', 'tcp.port in 80', 'tcp.port #', 'http contains', 'http.host matches 1'];

test('cada error del filtro tiene traducción inglesa', () => {
  const seen = new Set();
  for (const f of BAD) {
    const r = E.parseFilter(f);
    assert.equal(r.ok, false, `«${f}» debería ser inválido`);
    const en = fErr(r.error);
    assert.ok(!SPANISH.test(en), `sin traducir: «${f}» → ${r.error} → ${en}`);
    seen.add(r.error.replace(/«[^»]*»/g, '«»'));
  }
  assert.ok(seen.size >= 15, `solo ${seen.size} mensajes distintos cubiertos`);
});

test('en español los mensajes no cambian', () => {
  const fEs = new Function('LANG', ws.slice(ws.indexOf('const FERR_EN'), ws.indexOf('const treeKey')) + '; return fErr;')('es');
  const r = E.parseFilter('ip.src = 1');
  assert.equal(fEs(r.error), r.error);
});

test('STRINGS tiene las mismas claves en es y en', () => {
  const src = readFileSync(new URL('../src/app/05-i18n.js', import.meta.url), 'utf8');
  const STRINGS = new Function(src.slice(0, src.indexOf('let LANG')) + '; return STRINGS;')();
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.es).sort());
});

test('cada módulo tiene título, subtítulo e insignia en inglés', () => {
  for (const m of E.MODULES) for (const k of ['title_en', 'sub_en', 'badge_en']) assert.ok(m[k] && !/[áéíóúñ]/.test(m[k]), `${m.id}.${k}`);
});

test('el árbol de detalle en inglés no deja etiquetas en español en ningún paquete', () => {
  const treeLabel = new Function('LANG', ws.slice(ws.indexOf('const TREE_EN'), ws.indexOf('const treeKey')) + '; return treeLabel;')('en');
  const ES_TREE = /[áéíóúñ]|\b(de|del|la|el|los|bytes en|capturados|longitud|puerto|número|ventana|tipo|origen|destino|orden|petición|respuesta|cuerpo|usuario|equipo|dominio|opción|cabecera|relativo|bruto|segundos|multiplicar|ninguno|otro|desconocido)\b/i;
  const bad = new Set(); let n = 0;
  const walk = nodes => nodes.forEach(x => { n++; const en = treeLabel(x.label); if (!/\\r\\n$/.test(x.label) && ES_TREE.test(en.replace(/"[^"]*"|: .*$/, ''))) bad.add(en.replace(/\d+/g, 'N')); walk(x.kids); });
  for (const k of Object.keys(E.SCENARIOS)) E.dissectAll(E.SCENARIOS[k]()).pkts.forEach(p => walk(p.tree));
  assert.ok(n > 5000, `solo ${n} nodos`);
  assert.deepEqual([...bad].slice(0, 40), []);
});

test('los módulos bilingües (con intro_en) traen en inglés cada lección, reto, pista, opción y botón Pruébalo', () => {
  const ES = /[áéíóúñ¿¡]|\b(el|la|los|las|del|una|que|para|con|pista|paquete)\b/i;
  const bi = E.MODULES.filter(m => m.intro_en);
  assert.ok(bi.some(m => m.id === 'm9'), 'el módulo 9 es bilingüe');
  for (const m of bi) {
    assert.ok(!ES.test(m.intro_en.replace(/`[^`]*`/g, '')), `${m.id}.intro_en`);
    for (const [i, l] of m.lessons.entries()) {
      assert.ok(l.h_en && l.p_en && l.p_en.length === l.p.length, `${m.id} lección ${i + 1}`);
      for (const x of [l.h_en, ...l.p_en]) assert.ok(!ES.test(x.replace(/`[^`]*`|\*\*[^*]*\*\*/g, '')), `${m.id} lección ${i + 1}: ${x.slice(0, 60)}`);
      for (const tr of l.try || []) assert.ok(tr[2] && !ES.test(tr[2]), `${m.id} Pruébalo «${tr[0]}» sin inglés`);
    }
    for (const x of m.tasks) {
      assert.ok(x.q_en && x.ok_en && x.hints_en && x.hints_en.length === x.hints.length, `${x.id}: falta inglés`);
      if (x.type === 'choice') assert.ok(x.opts_en && x.opts_en.length === x.opts.length, `${x.id}: opciones`);
      for (const s of [x.q_en, x.ok_en, ...x.hints_en, ...(x.opts_en || [])]) assert.ok(!ES.test(s.replace(/`[^`]*`|«[^»]*»/g, '')), `${x.id}: ${s.slice(0, 60)}`);
    }
  }
});
