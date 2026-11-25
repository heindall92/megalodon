// Carga el motor y el contenido en un contexto de Node con el mismo ámbito compartido que en el navegador.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const FILES = ['src/engine/net.js', 'src/engine/scenarios.js', 'src/engine/fields.js', 'src/engine/dissect.js', 'src/engine/filter.js', 'src/engine/stats.js', 'src/engine/analyze.js', 'src/content/modules.js', 'src/content/reference.js'];
export function loadEngine() {
  const ctx = vm.createContext({ console, btoa, atob, TextEncoder, TextDecoder, Uint8Array, DataView, Math, Date, Map, Set, JSON });
  const code = FILES.map(f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  const names = ['SCENARIOS', 'SCENARIO_FILES', 'MODULES', 'GLOSSARY', 'CHEATS', 'FIELD_DEFS', 'dissectAll', 'parseFilter', 'applyFilter', 'filterComplete', 'suggestField', 'writePcapng', 'writePcap', 'readCapture', 'conversations', 'protocolHierarchy', 'followTcp', 'flowLadder', 'endpoints', 'ioGraph', 'csum', 'expertInfo', 'httpObjects', 'credentials', 'followUdp', 'httpBody'];
  vm.runInContext(`${code}\n;globalThis.__E = { ${names.map(n => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ')} };`, ctx, { filename: 'megalodon-engine.js' });
  return ctx.__E;
}
