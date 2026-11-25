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

const browser = await chromium.launch();

await t('la CSP es estricta y no hay recursos externos', async () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  for (const d of ["default-src 'none'", "connect-src 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"]) assert(csp.includes(d), `falta ${d}`);
  assert(/script-src 'sha256-[^']+'(;|$)/.test(csp), 'script-src solo por hash');
  assert(!/unsafe-inline|unsafe-eval/.test(csp), 'sin unsafe-*');
});

await t('inicio: carga sin errores con la ilustración de la portada', async () => {
  const p = await page(browser);
  await p.waitForFunction(() => { const i = document.querySelector('.hero-img'); return i && i.complete && i.naturalWidth > 0; });
  const im = await p.$eval('.hero-img', i => ({ w: i.naturalWidth, h: i.naturalHeight, src: i.currentSrc.slice(0, 22), alt: i.alt }));
  assert(im.w === 1983 && im.h === 793, `tamaño ${im.w}×${im.h}`);
  assert(/^data:image\/(avif|webp)/.test(im.src), `formato ${im.src}`);
  assert(/plano técnico/.test(im.alt), 'texto alternativo');
  assert(await p.locator('canvas').count() === 0, 'sin lienzo 3D');
  assert(!(await p.evaluate(() => typeof SHARK !== 'undefined')), 'sin el módulo 3D');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('portada: el tiburón de la ilustración queda a la derecha del título, sin taparse', async () => {
  // zona del tiburón en la imagen original (1983 × 793): de la punta del hocico al borde de la aleta caudal
  const SHARK_BOX = { x0: 1215, x1: 1760, y0: 45, y1: 760 };
  for (const [w, side] of [[1280, false], [1440, false], [1920, false], [1280, true]]) {
    const p = await page(browser, { viewport: { width: w, height: Math.round(w * .62) } });
    if (side) { await p.keyboard.press('['); await p.waitForTimeout(450); }
    await p.waitForFunction(() => { const i = document.querySelector('.hero-img'); return i && i.complete && i.naturalWidth > 0; });
    const r = await p.evaluate(B => {
      const img = document.querySelector('.hero-img'), box = img.getBoundingClientRect(), t = document.querySelector('#hero-t').getBoundingClientRect();
      // object-fit: cover con object-position leído del CSS
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v) / 100);
      const s = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
      const ox = box.left + (box.width - img.naturalWidth * s) * px, oy = box.top + (box.height - img.naturalHeight * s) * py;
      return { titleRight: t.right, sharkLeft: ox + B.x0 * s, sharkRight: ox + B.x1 * s, heroRight: box.right };
    }, SHARK_BOX);
    assert(r.sharkLeft > r.titleRight - 10, `${w}px${side ? ' (lateral plegado)' : ''}: el tiburón (${Math.round(r.sharkLeft)}) queda bajo el título (${Math.round(r.titleRight)})`);
    assert(r.sharkRight < r.heroRight + 60, `${w}px: el tiburón se sale por la derecha`);
    await p.close2();
  }
});

await t('movimiento reducido: la ilustración queda quieta', async () => {
  const p = await page(browser, { reduced: true });
  assert(await p.$eval('.hero-img', i => getComputedStyle(i).animationName) === 'none', 'sin deriva');
  await p.close2();
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

await t('armazón: lateral plegable con [, carril que se despliega al pasar el ratón y estado guardado', async () => {
  const p = await page(browser, { hash: '#/m/m2' });
  const w = () => p.$eval('#side', el => Math.round(el.getBoundingClientRect().width));
  const open = await w();
  assert(open > 200, `abierto ${open}`);
  assert(await p.getAttribute('.side-nav [data-mod="m2"]', 'aria-current') === 'page', 'm2 activo en el lateral');
  assert(await p.$eval('.side-ind', el => getComputedStyle(el).opacity) === '1', 'indicador visible');
  await p.keyboard.press('[');
  await p.waitForTimeout(450);
  assert(await p.evaluate(() => document.body.classList.contains('side-mini')), 'clase side-mini');
  assert(await p.getAttribute('[data-side]', 'aria-expanded') === 'false', 'aria-expanded false');
  const rail = await p.$eval('.app', el => parseFloat(getComputedStyle(el).gridTemplateColumns));
  assert(rail < 100, `carril ${rail}`);
  await p.hover('.side-nav [data-nav="lab"]');
  await p.waitForTimeout(450);
  assert(await p.$eval('.side-nav [data-nav="lab"] .txt', el => +getComputedStyle(el).opacity) > 0.9, 'etiquetas visibles al pasar el ratón');
  await p.mouse.move(900, 400);
  await p.reload(); await p.waitForSelector('#main h1');
  assert(await p.evaluate(() => document.body.classList.contains('side-mini')), 'plegado se recuerda');
  await p.click('[data-side]'); await p.waitForTimeout(400);
  assert(!(await p.evaluate(() => document.body.classList.contains('side-mini'))), 'se vuelve a abrir con el botón');
  await p.click('.side-nav [data-nav="lab"]'); await p.waitForSelector('.lab');
  assert(await p.getAttribute('.side-nav [data-nav="lab"]', 'aria-current') === 'page', 'lab activo');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('idioma: el interruptor ES|EN cambia toda la interfaz y se recuerda', async () => {
  const p = await page(browser, { hash: '#/m/m3' });
  await p.click('[data-lang="en"]');
  await p.waitForFunction(() => document.documentElement.lang === 'en');
  assert(await p.getAttribute('[data-lang="en"]', 'aria-pressed') === 'true', 'EN pulsado');
  assert(/Cookies and cleartext credentials/.test(await p.textContent('#main h1')), 'título del módulo en inglés');
  assert(/Challenges/.test(await p.textContent('#tab-tasks')), 'pestaña Retos → Challenges');
  assert(/Modules/.test(await p.textContent('.side-nav [data-nav="modules"]')), 'lateral en inglés');
  assert(/Lessons and challenges are written in Spanish/.test(await p.textContent('#pan-lesson')), 'aviso honesto de lecciones en español');
  assert(/Wireshark lab/.test(await p.title()), 'título del documento');
  await p.fill('.finput', 'ip.src = 1');
  await p.waitForFunction(() => /A single “=” is not valid/.test(document.querySelector('.fmsg').textContent));
  await p.click('[data-stats]'); await p.waitForTimeout(250);
  assert(/Packets/.test(await p.textContent('.dlg thead')), 'cabeceras de estadísticas');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await p.goto(URL0 + '#/'); await p.reload(); await p.waitForSelector('#main h1');
  assert(/Start with module 1|Continue/.test(await p.textContent('.hero .cta')), 'inicio en inglés tras recargar');
  assert(/Shark pup/.test(await p.textContent('.lvl')), 'nivel en inglés');
  await p.click('[data-lang="es"]');
  await p.waitForFunction(() => document.documentElement.lang === 'es');
  assert(/Empezar por el módulo 1|Continuar/.test(await p.textContent('.hero .cta')), 'vuelta al español');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('tema: el interruptor claro|oscuro es un role=switch y cambia data-theme', async () => {
  const p = await page(browser, { theme: 'dark', hash: '#/chuleta' });
  const sw = '[data-theme-btn]';
  assert(await p.getAttribute(sw, 'role') === 'switch', 'role switch');
  assert(await p.getAttribute(sw, 'aria-checked') === 'true', 'oscuro marcado');
  await p.click(sw);
  await p.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  assert(await p.getAttribute(sw, 'aria-checked') === 'false', 'claro desmarcado');
  await p.keyboard.press('Shift+T');
  await p.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('móvil: sin lateral, barra de pestañas abajo y hoja «Más» con glosario, ajustes, ayuda y atajos', async () => {
  const p = await page(browser, { viewport: { width: 390, height: 844 }, hash: '#/m/m1' });
  assert(await p.$eval('#side', el => getComputedStyle(el).display) === 'none', 'lateral oculto');
  const tb = await p.$eval('#tabbar', el => { const r = el.getBoundingClientRect(); return { d: getComputedStyle(el).display, b: Math.round(r.bottom), n: el.children.length }; });
  assert(tb.d !== 'none' && tb.b >= 820 && tb.b <= 844 && tb.n === 5, `tab bar ${JSON.stringify(tb)}`);
  assert(await p.getAttribute('#tabbar [data-nav="modules"]', 'aria-current') === 'page', 'Módulos activo en el módulo');
  assert(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'sin scroll horizontal');
  await p.click('#tabbar [data-nav="lab"]'); await p.waitForSelector('.lab');
  assert(await p.getAttribute('#tabbar [data-nav="lab"]', 'aria-current') === 'page', 'Lab activo');
  await p.click('[data-more]'); await p.waitForSelector('.more-list');
  assert((await p.$$('.more-list > *')).length === 4, 'cuatro entradas');
  await p.click('.more-list [data-a="settings"]');
  await p.waitForFunction(() => /Ajustes/.test(document.querySelector('#dlg h2')?.textContent || ''));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('[data-more]'); await p.waitForSelector('.more-list');
  await p.click('.more-list [data-go]'); await p.waitForSelector('.gl');
  assert(!(await p.evaluate(() => document.querySelector('#dlg').open)), 'la hoja se cierra al navegar');
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

await t('axe 0 infracciones · lateral plegado, inglés y hoja «Más»', async () => {
  const p = await page(browser, { hash: '#/m/m1', axe: true });
  try {
    await p.keyboard.press('['); await p.waitForTimeout(450); await axe(p, 'lateral plegado');
    await p.click('[data-lang="en"]'); await p.waitForTimeout(300); await axe(p, 'inglés');
    await p.click('[data-theme-btn]'); await p.waitForTimeout(400); await axe(p, 'inglés claro');
  } finally { await p.close2(); }
  const m = await page(browser, { viewport: { width: 390, height: 844 }, theme: 'light', hash: '#/lab', axe: true });
  try { await m.click('[data-more]'); await m.waitForSelector('.more-list'); await m.waitForTimeout(350); await axe(m, 'hoja Más'); } finally { await m.close2(); }
});

for (const [w, h] of [[1280, 800], [390, 844]]) for (const theme of ['dark', 'light']) {
  await t(`axe 0 infracciones · ${w} px · ${theme === 'dark' ? 'oscuro' : 'claro'}`, async () => {
    for (const hash of ['', '#/modulos', '#/m/m1', '#/lab', '#/chuleta', '#/glosario']) {
      const p = await page(browser, { viewport: { width: w, height: h }, theme, hash, axe: true });
      try {
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
