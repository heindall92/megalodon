// Megalodon · capturas reales para el README (Chromium con WebGL por software).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const pick = (...ids) => { for (const id of ids) { try { return require.resolve(id); } catch { /* siguiente */ } } };
const { chromium } = require(pick('playwright', '/opt/node-tools/node_modules/playwright'));
const URL0 = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const OUT = fileURLToPath(new URL('../docs/capturas/', import.meta.url));
const SHOTS = [
  { f: 'inicio-oscuro', w: 1280, h: 800, t: 7.45 },
  { f: 'mordisco', w: 1280, h: 800, t: 7.45, clip: { x: 575, y: 70, width: 400, height: 300 }, dsf: 2 },
  { f: 'protrusion', w: 1280, h: 800, t: 8.6, clip: { x: 575, y: 70, width: 400, height: 300 }, dsf: 2 },
  { f: 'plano-tecnico', w: 1280, h: 800, t: 5, mode: 'blue' },
  { f: 'inicio-claro', w: 1280, h: 800, t: 3, theme: 'light', full: true },
  { f: 'movil', w: 390, h: 844, t: 7.45 },
  { f: 'modulo-1', w: 1280, h: 800, t: 0, hash: '#/m/m1' },
  { f: 'experto', w: 1280, h: 800, t: 0, hash: '#/lab?cap=m6', act: async p => { await p.click('[data-expert]'); } },
  { f: 'objetos-http', w: 1280, h: 800, t: 0, hash: '#/lab?cap=m6', act: async p => { await p.click('[data-objects]'); await p.click('.dlg [aria-label="Ver robots.txt"]'); } },
  { f: 'beacon', w: 1280, h: 800, t: 0, hash: '#/lab?cap=m8', act: async p => { await p.locator('.finput').fill('http.request && ip.dst == 203.0.113.66'); await p.locator('.finput').press('Enter'); await p.selectOption('[data-tfmt]', 'dview'); } },
  { f: 'lateral-plegado', w: 1280, h: 800, t: 0, hash: '#/m/m2', act: async p => { await p.keyboard.press('['); await p.hover('.side-nav [data-mod="m6"]'); } },
  { f: 'ingles-claro', w: 1280, h: 800, t: 0, theme: 'light', hash: '#/lab?cap=m3', act: async p => { await p.click('[data-lang="en"]'); await p.waitForSelector('.ws'); await p.waitForTimeout(3200); } },
  { f: 'movil-pestanas', w: 390, h: 844, t: 0, hash: '#/m/m1', dsf: 2 },
  { f: 'movil-mas', w: 390, h: 844, t: 0, theme: 'light', hash: '#/chuleta', dsf: 2, act: async p => { await p.click('[data-more]'); } },
];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const s of SHOTS) {
  const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dsf || 1, colorScheme: s.theme || 'dark' });
  const p = await ctx.newPage();
  await p.goto(URL0 + (s.hash || '')); await p.waitForSelector('#main h1');
  if (!s.hash) { await p.waitForSelector('canvas.shark-cv'); await p.evaluate(([t, m]) => { SHARK.pause(); SHARK.setMode(m || 'real'); SHARK.seek(t); }, [s.t, s.mode]); }
  if (s.act) { if (/lab/.test(s.hash || '') && !/ingles/.test(s.f)) await p.waitForSelector('.ws'); await s.act(p); await p.waitForTimeout(500); }
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}${s.f}.png`, clip: s.clip, fullPage: !!s.full, timeout: 180000 });
  console.log(s.f);
  await ctx.close();
}
await b.close();
