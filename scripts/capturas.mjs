// Megalodon · capturas reales para el README.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const pick = (...ids) => { for (const id of ids) { try { return require.resolve(id); } catch { /* siguiente */ } } };
const { chromium } = require(pick('playwright', '/opt/node-tools/node_modules/playwright'));
const URL0 = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const OUT = fileURLToPath(new URL('../docs/capturas/', import.meta.url));
/* Perfil de ejemplo para las capturas: nombre, tipo, rol, recientes y algo de actividad repartida en varios días */
const DAY = 864e5, NOW = Date.UTC(2026, 10, 25, 12);
const DEMO = { profile: { name: 'Lucía Navarro', kind: 'student', role: 'soc', color: 'turquesa' }, recent: ['mod:m3', 'flt:http.request.method == "POST"', 'glo:SYN', 'act:theme'],
  done: Object.fromEntries(['m1-syn', 'm1-port', 'm1-synack', 'm1-ack', 'm1-stream', 'm1-rst', 'm1-fin', 'm1-count', 'm2-req', 'm2-post', 'm2-ua', 'm2-err', 'm3-basic', 'm3-auth'].map((k, i) => [k, { xp: 10, at: NOW - [0, 0, 1, 2, 2, 2, 4, 7, 8, 8, 11, 15, 16, 22][i] * DAY }])) };
const SHOTS = [
  { f: 'inicio-oscuro', w: 1280, h: 800, t: 0, init: DEMO },
  { f: 'inicio-claro', w: 1280, h: 800, t: 0, theme: 'light', init: DEMO },
  { f: 'movil', w: 390, h: 844, t: 7.45 },
  { f: 'modulo-1', w: 1280, h: 800, t: 0, hash: '#/m/m1' },
  { f: 'experto', w: 1280, h: 800, t: 0, hash: '#/lab?cap=m6', act: async p => { await p.click('[data-expert]'); } },
  { f: 'objetos-http', w: 1280, h: 800, t: 0, hash: '#/lab?cap=m6', act: async p => { await p.click('[data-objects]'); await p.click('.dlg [aria-label="Ver robots.txt"]'); } },
  { f: 'beacon', w: 1280, h: 800, t: 0, hash: '#/lab?cap=m8', act: async p => { await p.locator('.finput').fill('http.request && ip.dst == 203.0.113.66'); await p.locator('.finput').press('Enter'); await p.selectOption('[data-tfmt]', 'dview'); } },
  { f: 'lateral-plegado', w: 1280, h: 800, t: 0, hash: '#/m/m2', act: async p => { await p.keyboard.press('['); await p.hover('.side-nav [data-mod="m6"]'); } },
  { f: 'ingles-claro', w: 1280, h: 800, t: 0, theme: 'light', hash: '#/lab?cap=m3', act: async p => { await p.click('[data-lang="en"]'); await p.waitForSelector('.ws'); await p.waitForTimeout(3200); } },
  { f: 'movil-pestanas', w: 390, h: 844, t: 0, hash: '#/m/m1', dsf: 2 },
  { f: 'movil-mas', w: 390, h: 844, t: 0, theme: 'light', hash: '#/chuleta', dsf: 2, init: DEMO, act: async p => { await p.click('[data-more]'); } },
  { f: 'perfil', w: 1280, h: 900, t: 0, theme: 'light', hash: '#/perfil', init: DEMO },
  { f: 'acerca', w: 1280, h: 800, t: 0, theme: 'light', hash: '#/acerca', init: DEMO },
  { f: 'buscador', w: 1280, h: 800, t: 0, init: DEMO, act: async p => { await p.keyboard.press('Control+k'); await p.waitForTimeout(700); await p.keyboard.press('ArrowDown'); } },
  { f: 'tema-gota', w: 1280, h: 800, t: 0, hash: '#/modulos', init: DEMO, motion: true, act: async p => {
    // el efecto se congela a mitad para la foto: inundación al 55 % y las ondas saliendo
    await p.waitForFunction(() => document.body.classList.contains('ready')); await p.waitForTimeout(300);
    await p.click('[data-theme-btn]');
    await p.waitForFunction(() => { const f = document.getAnimations().find(a => a.effect?.pseudoElement === '::view-transition-new(root)'); return f && document.querySelector('.fx-ripple') && f.currentTime > f.effect.getTiming().delay; });
    await p.evaluate(() => { const all = document.getAnimations(); all.forEach(a => a.pause()); const f = all.find(a => a.effect?.pseudoElement === '::view-transition-new(root)'); f.currentTime = f.effect.getTiming().delay + 150; document.querySelectorAll('.fx-ripple').forEach(r => r.getAnimations().forEach(a => { a.currentTime = 260; })); });
  }, nowait: true },
];
const still = await chromium.launch({ args: ['--force-prefers-reduced-motion'] });   // la deriva lenta de la portada, quieta para la captura
const moving = await chromium.launch();               // para captar el efecto de tema a mitad
for (const s of SHOTS.filter(x => !process.env.ONLY || process.env.ONLY.split(",").includes(x.f))) {
  const b = s.motion ? moving : still;
  const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dsf || 1, colorScheme: s.theme || 'dark' });
  if (s.init) await ctx.addInitScript(d => { if (!sessionStorage.demo) { sessionStorage.demo = 1; localStorage.setItem('megalodon.v1', JSON.stringify({ v: 1, hints: {}, badges: { m1: Date.now() }, settings: { theme: 'system', lang: 'es', themeFx: 'drop' }, ...d })); } }, s.init);
  const p = await ctx.newPage();
  await p.goto(URL0 + (s.hash || '')); await p.waitForSelector('#main h1');
  if (!s.hash) await p.waitForFunction(() => { const i = document.querySelector('.hero-img'); return i && i.complete && i.naturalWidth > 0; });
  if (s.act) { if (/lab/.test(s.hash || '') && !/ingles/.test(s.f)) await p.waitForSelector('.ws'); await s.act(p); await p.waitForTimeout(500); }
  if (!s.nowait) await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}${s.f}.png`, clip: s.clip, fullPage: !!s.full, timeout: 180000 });
  console.log(s.f);
  await ctx.close();
}
await still.close(); await moving.close();
