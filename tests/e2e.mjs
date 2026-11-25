// Megalodon · pruebas de extremo a extremo en Chromium real (Playwright) y accesibilidad con axe-core.
// Uso: node tests/e2e.mjs   (compila antes con npm run build)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const pick = (...ids) => { for (const id of ids) { try { return require.resolve(id); } catch { /* siguiente */ } } throw new Error(`No encuentro ${ids[0]}`); };
const { chromium } = require(pick('playwright', '/opt/node-tools/node_modules/playwright'));
const AXE = readFileSync(pick('axe-core/axe.min.js', '/home/user/bluejr/node_modules/axe-core/axe.min.js'), 'utf8');
const URL0 = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

let pass = 0, fail = 0;
const results = [];
async function t(name, fn) {
  const t0 = Date.now();
  try { await fn(); pass++; results.push(`ok   ${name} (${Date.now() - t0} ms)`); }
  catch (e) { fail++; results.push(`FAIL ${name}\n     ${String(e && e.stack || e).split('\n').slice(0, 3).join('\n     ')}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

async function page(browser, opts = {}) {
  const ctx = await browser.newContext({ bypassCSP: !!opts.axe, viewport: opts.viewport || { width: 1280, height: 800 }, colorScheme: opts.theme || 'dark', reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  // ninguna petición de red: solo file:, data: y blob:
  await ctx.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) r.continue(); else { p.errors.push('RED ' + u); r.abort(); } });
  await p.goto(URL0 + (opts.hash || ''));
  await p.waitForSelector('#main h1');
  p.close2 = () => ctx.close();
  return p;
}
const axe = async (p, label) => {
  await p.addScriptTag({ content: AXE });
  const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(x => `${x.id} (${x.nodes.length}): ${x.nodes[0].target}`));
  assert(!v.length, `${label}: ${v.join(' · ')}`);
};

const browser = await chromium.launch({ args: GL });

await t('la CSP es estricta y no hay recursos externos', async () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  for (const d of ["default-src 'none'", "connect-src 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"]) assert(csp.includes(d), `falta ${d}`);
  assert(/script-src 'sha256-[^']+'(;|$)/.test(csp), 'script-src solo por hash');
  assert(!/unsafe-inline|unsafe-eval/.test(csp), 'sin unsafe-*');
});

await t('inicio: carga sin errores y monta el megalodón 3D', async () => {
  const p = await page(browser);
  await p.waitForSelector('.hero-art.live canvas.shark-cv');
  const s = await p.evaluate(() => SHARK.stats());
  assert(s.vertices > 40000 && s.triangles > 60000, `malla: ${JSON.stringify(s)}`);
  assert(s.running, 'la animación corre');
  assert(await p.isHidden('.hero-art picture'), 'el póster queda oculto bajo el 3D');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('megalodón: pausa accesible y vista de plano técnico con cotas', async () => {
  const p = await page(browser);
  await p.waitForSelector('[data-shark-pause]');
  const pb = p.locator('[data-shark-pause]');
  assert(/Pausar/.test(await pb.getAttribute('aria-label')), 'etiqueta inicial');
  await pb.focus(); await p.keyboard.press('Enter');
  assert(/Reanudar/.test(await pb.getAttribute('aria-label')), 'etiqueta tras pausar');
  assert(!(await p.evaluate(() => SHARK.stats().running)), 'se detiene');
  await p.click('[data-shark-mode]');
  assert(await p.getAttribute('[data-shark-mode]', 'aria-pressed') === 'true', 'aria-pressed');
  await p.waitForFunction(() => document.querySelectorAll('.shark-callouts g').length === 8);
  const labels = await p.$$eval('.shark-callouts text.k', ns => ns.map(n => n.textContent));
  assert(labels.includes('Dientes aserrados') && labels.includes('Hendiduras branquiales'), labels.join(', '));
  await p.close2();
});

await t('megalodón: se desmonta al salir de inicio y vuelve al regresar', async () => {
  const p = await page(browser);
  await p.waitForSelector('canvas.shark-cv');
  await p.evaluate(() => { location.hash = '#/glosario'; });
  await p.waitForSelector('#main h1');
  assert(await p.locator('canvas.shark-cv').count() === 0, 'el lienzo sale del DOM');
  assert(!(await p.evaluate(() => SHARK.stats().running)), 'el bucle se para');
  await p.evaluate(() => { location.hash = '#/'; });
  await p.waitForSelector('.hero-art.live canvas.shark-cv');
  assert(await p.locator('.shark-hud').count() === 1, 'un único panel de control');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('movimiento reducido: un fotograma fijo con la boca abierta y botón para animar', async () => {
  const p = await page(browser, { reduced: true });
  await p.waitForSelector('canvas.shark-cv');
  assert(!(await p.evaluate(() => SHARK.stats().running)), 'quieto');
  assert(/Reanudar/.test(await p.getAttribute('[data-shark-pause]', 'aria-label')), 'ofrece reanudar');
  await p.click('[data-shark-pause]');
  assert(await p.evaluate(() => SHARK.stats().running), 'anima si se pide');
  await p.close2();
});

await t('sin WebGL2 se queda el póster y nada falla', async () => {
  const b2 = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  const p = await page(b2);
  assert(await p.isVisible('.hero-img'), 'póster visible');
  assert(await p.locator('.shark-hud').count() === 0, 'sin controles del 3D');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2(); await b2.close();
});

await t('módulo 1: el filtro se valida y un reto resuelto suma XP', async () => {
  const p = await page(browser, { hash: '#/m/m1' });
  const inp = p.locator('.finput');
  await inp.fill('tcp.flgs.syn == 1'); await inp.press('Enter');
  assert(await p.getAttribute('.fbar', 'data-state') === 'bad', 'filtro erróneo en rojo');
  await inp.fill('tcp.flags.syn==1 && tcp.flags.ack==0'); await inp.press('Enter');
  assert(await p.getAttribute('.fbar', 'data-state') === 'ok', 'filtro válido en verde');
  await p.evaluate(() => { location.hash = '#/m/m1?t=m1-syn'; });
  await p.waitForSelector('#task-m1-syn');
  await p.locator('.finput').fill('tcp.flags.syn==1 && tcp.flags.ack==0'); await p.locator('.finput').press('Enter');
  await p.click('#task-m1-syn [data-check]');
  await p.waitForSelector('#task-m1-syn[data-state="done"]');
  assert(+(await p.textContent('[data-xp]')) > 0, 'XP sumada');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('búsqueda Ctrl K encuentra una lección', async () => {
  const p = await page(browser);
  await p.keyboard.press('Control+k');
  await p.keyboard.type('Kerberos');
  await p.waitForFunction(() => /Kerberos/i.test(document.querySelector('#dlg')?.textContent || ''));
  await p.close2();
});

await t('herramientas: información experta, objetos HTTP (texto, nunca HTML) y credenciales', async () => {
  const p = await page(browser, { hash: '#/lab?cap=m6' });
  await p.keyboard.press('e');
  await p.waitForSelector('.tbl.ex');
  assert(/20/.test(await p.textContent('.ex-chip.sev-warn')), 'contador de avisos');
  await p.click('.tbl.ex [data-show]');
  await p.waitForFunction(() => document.querySelector('.finput').value.startsWith('frame.number in {'));
  await p.waitForTimeout(250);
  await p.click('[data-objects]');
  const rows = await p.locator('.dlg tbody tr').count();
  assert(rows > 20, `objetos: ${rows}`);
  await p.click('.dlg [aria-label="Ver robots.txt"]');
  assert(/Disallow: \/backup\.zip/.test(await p.textContent('.ob-prev pre')), 'vista previa de robots.txt');
  const viewIdx = await p.$$eval('.dlg tbody tr', trs => trs.findIndex(tr => /buscar\.html/.test(tr.textContent)));
  await p.locator('.dlg tbody tr').nth(viewIdx).locator('[data-view]').click();
  assert(await p.locator('.ob-prev pre *').count() === 0, 'el HTML de la captura se muestra como texto');
  const dl = p.waitForEvent('download');
  await p.click('.dlg [aria-label="Guardar robots.txt"]');
  assert((await dl).suggestedFilename() === 'robots.txt', 'descarga con nombre seguro');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await p.evaluate(() => { location.hash = '#/lab?cap=m3'; }); await p.waitForSelector('[data-creds]');
  await p.click('[data-creds]');
  assert(/backup/.test(await p.textContent('.dlg tbody')), 'usuario FTP');
  await p.click('.dlg [data-i="0"]');
  await p.waitForFunction(() => /Credenciales: admin/.test(document.querySelector('.tree [aria-selected="true"]')?.textContent || ''));
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('buscar (Ctrl F) por hex, ir al paquete (Ctrl G), formato de tiempo y flujo UDP', async () => {
  const p = await page(browser, { hash: '#/lab?cap=m6' });
  await p.keyboard.press('Control+f');
  await p.selectOption('#fd-k', 'hex'); await p.fill('#fd-q', '50 4b 03 04'); await p.press('#fd-q', 'Enter');
  await p.waitForFunction(() => /paquete 58/.test(document.querySelector('[data-msg]').textContent));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await p.locator('.finput').fill('http'); await p.locator('.finput').press('Enter');
  await p.keyboard.press('Control+g'); await p.fill('#fd-n', '1'); await p.press('#fd-n', 'Enter');
  await p.waitForFunction(() => /oculto por el filtro/.test(document.querySelector('[data-msg2]').textContent));
  await p.fill('#fd-n', '58'); await p.press('#fd-n', 'Enter');
  await p.waitForSelector('.prow[data-no="58"][aria-selected="true"]');
  await p.evaluate(() => { location.hash = '#/lab?cap=m8'; }); await p.waitForSelector('[data-tfmt]');
  await p.locator('.finput').fill('http.request && ip.dst == 203.0.113.66'); await p.locator('.finput').press('Enter');
  await p.selectOption('[data-tfmt]', 'dview');
  const times = await p.$$eval('.prow:not(.phead) .c-t', els => els.map(e => +e.textContent));
  assert(times.slice(1).every(x => Math.abs(x - 60) < 1), `intervalos ${times}`);
  await p.locator('.finput').fill('dns.qry.name contains "exfil"'); await p.locator('.finput').press('Enter');
  await p.click('.prow:not(.phead) >> nth=0'); await p.keyboard.press('f');
  await p.waitForFunction(() => /Seguir flujo UDP/.test(document.querySelector('#dlg h2')?.textContent || ''));
  assert(/exfil-lab/.test(await p.textContent('.fs-body')), 'contenido del flujo UDP');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('curso completo: los 58 retos se resuelven desde la interfaz y se ganan las 8 insignias', async () => {
  const p = await page(browser, { hash: '#/modulos' });
  const mods = await p.evaluate(() => MODULES.map(m => ({ id: m.id, tasks: m.tasks.map(x => ({ id: x.id, type: x.type, ref: x.ref, match: x.match, ans: x.ans })) })));
  let solved = 0;
  for (const m of mods) {
    await p.evaluate(([id, t0]) => { location.hash = `#/m/${id}?t=${t0}`; }, [m.id, m.tasks[0].id]);   // abre la pestaña de retos
    await p.waitForSelector(`#task-${m.tasks[0].id}`);
    for (const x of m.tasks) {
      const card = `#task-${x.id}`;
      await p.evaluate(sel => document.querySelector(sel).scrollIntoView(), card);
      if (x.type === 'filter' || x.type === 'packet') { await p.locator('.finput').fill(x.ref || x.match); await p.locator('.finput').press('Enter'); }
      if (x.type === 'packet') { await p.locator('.prow:not(.phead)').first().click(); }
      if (x.type === 'text') await p.fill(`${card} input`, String(x.ans[0]));
      if (x.type === 'choice') await p.click(`${card} [data-opt="${x.ans}"]`);
      else await p.click(`${card} [data-check]`);
      await p.waitForSelector(`${card}[data-state="done"]`, { timeout: 4000 }).catch(() => { throw new Error(`no se resuelve ${x.id}`); });
      solved++;
      if (x === m.tasks[m.tasks.length - 1]) {                     // último reto: aparece la celebración de la insignia
        await p.waitForFunction(() => document.querySelector('#dlg').open);
        await p.keyboard.press('Escape'); await p.waitForTimeout(250);
      }
    }
  }
  assert(solved === 58, `${solved} retos`);
  const st = await p.evaluate(() => ({ badges: Object.keys(S.get().badges).length, xp: S.xp() }));
  assert(st.badges === 8, `insignias ${st.badges}`);
  assert(st.xp > 0, 'XP');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

for (const theme of ['dark', 'light']) await t(`axe 0 infracciones en los diálogos nuevos · ${theme === 'dark' ? 'oscuro' : 'claro'}`, async () => {
  const p = await page(browser, { hash: '#/lab?cap=m6', theme, axe: true });
  try {
    for (const open of [() => p.click('[data-expert]'), () => p.click('[data-objects]'), async () => { await p.click('[data-objects]'); await p.click('.dlg [aria-label="Ver robots.txt"]'); }, () => p.click('[data-creds]'), () => p.click('[data-find]'), async () => { await p.keyboard.press('s'); await p.click('#st-ends'); }]) {
      await open(); await p.waitForTimeout(350);
      await axe(p, 'diálogo');
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    }
  } finally { await p.close2(); }
});

for (const [w, h] of [[1280, 800], [390, 844]]) for (const theme of ['dark', 'light']) {
  await t(`axe 0 infracciones · ${w} px · ${theme === 'dark' ? 'oscuro' : 'claro'}`, async () => {
    for (const hash of ['', '#/modulos', '#/m/m1', '#/lab', '#/chuleta', '#/glosario']) {
      const p = await page(browser, { viewport: { width: w, height: h }, theme, hash, axe: true });
      try {
        if (hash === '') { await p.waitForSelector('.shark-hud'); await p.evaluate(() => SHARK.pause()); await p.click('[data-shark-mode]'); }
        await p.waitForTimeout(300);
        await axe(p, `${hash || 'inicio'}`);
      } finally { await p.close2(); }
    }
  });
}

await browser.close();
console.log(results.join('\n'));
console.log(`\n${pass} correctas · ${fail} fallidas`);
process.exit(fail ? 1 : 0);
