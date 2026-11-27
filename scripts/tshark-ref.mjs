// Megalodon · genera la referencia de tshark de una captura para contrastar el motor en las pruebas sin necesitar Wireshark.
// Uso: node scripts/tshark-ref.mjs m9   (necesita tshark en el PATH; escribe tests/tshark/<captura>.json)
// Guarda, tal como las da tshark: Protocolo e Info de cada trama, las tramas que deja pasar cada filtro de la captura
// (Pruébalo, retos y chuleta) y la tabla de Telephony › RTP › RTP Streams.
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadEngine } from '../tests/load.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const k = process.argv[2] || 'm9';
const E = loadEngine();
if (!E.SCENARIOS[k]) throw new Error(`No existe la captura ${k}`);
const dir = mkdtempSync(join(tmpdir(), 'megalodon-')), file = join(dir, `${k}.pcapng`);
writeFileSync(file, E.writePcapng(E.SCENARIOS[k]()));
const ts = (...a) => execFileSync('tshark', ['-r', file, ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
const version = execFileSync('tshark', ['-v'], { encoding: 'utf8' }).split(/\r?\n/)[0];

const columns = ts('-T', 'fields', '-E', 'separator=\t', '-e', '_ws.col.Protocol', '-e', '_ws.col.Info').split(/\r?\n/).filter(Boolean).map(l => l.split('\t'));
const filters = new Set();
for (const m of E.MODULES.filter(x => x.cap === k)) {
  for (const l of m.lessons) for (const [f] of l.try || []) filters.add(f);
  for (const t of m.tasks) for (const f of [t.ref, t.match, t.proof, t.allow]) if (f) filters.add(f);
}
const pk = E.dissectAll(E.SCENARIOS[k]()).pkts;
for (const g of E.CHEATS) for (const [f] of g.items) { const r = E.parseFilter(f); if (r.ok && pk.some(r.test)) filters.add(f); }
const byFilter = {};
for (const f of filters) byFilter[f] = ts('-Y', f, '-T', 'fields', '-e', 'frame.number').split(/\r?\n/).filter(Boolean).map(Number);
/* RTP Streams: «Src IP Port Dst IP Port SSRC Payload… Pkts Lost (x%) MinΔ MeanΔ MaxΔ MinJ MeanJ MaxJ [X]» */
const rtp = ts('-q', '-z', 'rtp,streams').split(/\r?\n/).filter(l => /^\s+\d+\.\d+\s+\d+\.\d+\s+\d/.test(l)).map(l => {
  const m = l.trim().match(/^\S+\s+\S+\s+(\S+)\s+(\d+)\s+(\S+)\s+(\d+)\s+0x([0-9A-F]+)\s+.*?\s(\d+)\s+(\d+)\s+\(\S+\)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);
  return { src: m[1], sport: +m[2], dst: m[3], dport: +m[4], ssrc: parseInt(m[5], 16), pkts: +m[6], lost: +m[7], meanDelta: +m[9], maxDelta: +m[10], meanJitter: +m[12], maxJitter: +m[13] };
});
mkdirSync(join(ROOT, 'tests/tshark'), { recursive: true });
writeFileSync(join(ROOT, `tests/tshark/${k}.json`), JSON.stringify({ capture: k, tshark: version, columns, filters: byFilter, rtp }, null, 0) + '\n');
rmSync(dir, { recursive: true, force: true });
console.log(`tests/tshark/${k}.json · ${version} · ${columns.length} tramas · ${filters.size} filtros · ${rtp.length} flujos RTP`);
