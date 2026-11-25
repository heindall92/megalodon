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
  const ctx = await browser.newContext({ bypassCSP: !!(opts.axe || opts.bypass), viewport: opts.viewport || { width: 1280, height: 800 }, colorScheme: opts.theme || 'dark', reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
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
  // logo de la marca (barra lateral) y favicon: el tiburón sobre baldosa azul marino, incrustados
  const logo = await p.$eval('.side-brand .logo', i => ({ tag: i.tagName, w: i.naturalWidth, alt: i.getAttribute('alt'), src: i.src.slice(0, 22), box: i.getBoundingClientRect().width }));
  assert(logo.tag === 'IMG' && logo.w === 128 && logo.alt === '' && logo.src === 'data:image/webp;base64' && logo.box === 38, `logo ${JSON.stringify(logo)}`);
  const fav = await p.$eval('link[rel="icon"]', l => ({ type: l.type, href: l.href.slice(0, 22) }));
  assert(fav.type === 'image/png' && fav.href === 'data:image/png;base64,', `favicon ${JSON.stringify(fav)}`);
  assert(await p.locator('.side-brand .i, .brand-m .i').count() === 0, 'sin el pececito de antes');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('portada: el tiburón de la ilustración queda a la derecha del texto, sin taparse', async () => {
  // zona del tiburón en la imagen original (1983 × 793): de la punta de la aleta pectoral a la cola
  const SHARK_BOX = { x0: 1215, x1: 1760 };
  // también con una fuente del sistema ancha (DejaVu Sans, la de Linux sin Inter): el texto crece hacia la derecha
  for (const [w, side, wide] of [[1280, false, false], [1440, false, false], [1920, false, false], [1280, true, false], [1280, false, true], [1440, false, true]]) {
    const p = await page(browser, { viewport: { width: w, height: Math.round(w * .62) }, bypass: wide });
    if (wide) await p.addStyleTag({ content: '.hero-copy, .hero-copy * { font-family: "DejaVu Sans", Verdana, sans-serif !important; }' });
    if (side) { await p.keyboard.press('['); await p.waitForTimeout(450); }
    await p.waitForFunction(() => { const i = document.querySelector('.hero-img'); return i && i.complete && i.naturalWidth > 0; });
    const r = await p.evaluate(B => {
      const img = document.querySelector('.hero-img'), box = img.getBoundingClientRect();
      const textRight = Math.max(...['#hero-t', '.hero-copy .lead', '.hero-copy .cta'].map(q => {
        const el = document.querySelector(q), rg = document.createRange(); rg.selectNodeContents(el);
        return Math.max(...[...rg.getClientRects()].map(c => c.right));                 // el texto real, no la caja del bloque
      }));
      const [px] = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v) / 100);
      const s = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
      const ox = box.left + (box.width - img.naturalWidth * s) * px;
      return { textRight, sharkLeft: ox + B.x0 * s, sharkRight: ox + B.x1 * s, heroRight: box.right };
    }, SHARK_BOX);
    const tag = `${w}px${side ? ' con la barra plegada' : ''}${wide ? ' con fuente ancha' : ''}`;
    assert(r.sharkLeft > r.textRight + 8, `${tag}: el tiburón (${Math.round(r.sharkLeft)}) queda bajo el texto (${Math.round(r.textRight)})`);
    assert(r.sharkRight < r.heroRight + 24, `${tag}: la cola se sale por la derecha (${Math.round(r.sharkRight)} > ${Math.round(r.heroRight)})`);
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

await t('buscador: la píldora se abre en tarjeta, guarda recientes, los quita y filtra por categorías', async () => {
  const p = await page(browser, { hash: '#/modulos' });
  await p.keyboard.press('Control+k');
  await p.waitForFunction(() => document.querySelector('#sdlg')?.open && document.activeElement?.id === 's-q');
  assert(/Sugerencias/.test(await p.textContent('#s-lab')), 'sin recientes: sugerencias');
  assert(await p.evaluate(() => getComputedStyle(document.querySelector('.top .search-btn')).visibility) === 'hidden', 'la píldora se convierte en la tarjeta');
  // la tarjeta nace donde está la píldora (mismo borde izquierdo, recortado a la pantalla)
  const pos = await p.evaluate(() => [document.querySelector('.sc-card').getBoundingClientRect().left, document.querySelector('.top .search-btn').getBoundingClientRect().left]);
  assert(Math.abs(pos[0] - (pos[1] - 6)) < 2, `posición ${pos}`);
  await p.keyboard.type('Kerberos');
  await p.waitForFunction(() => /Kerberos/i.test(document.querySelector('#s-r')?.textContent || ''));
  assert(/resultado/.test(await p.textContent('#s-lab')), 'contador de resultados');
  assert(await p.getAttribute('#s-q', 'aria-activedescendant') === 's-o0', 'opción activa');
  // Esc primero borra, luego cierra
  await p.keyboard.press('Escape');
  assert(await p.inputValue('#s-q') === '', 'Esc borra la búsqueda');
  assert(await p.evaluate(() => document.querySelector('#sdlg').open), 'sigue abierta');
  await p.keyboard.type('Kerberos'); await p.waitForTimeout(100);
  const first = await p.evaluate(() => searchIndex().find(x => /Kerberos/i.test(x.title)) && document.querySelector('#s-o0 .sc-title').textContent);
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => location.hash !== '#/modulos');
  assert(first, 'primer resultado');
  await p.waitForFunction(() => !document.querySelector('#sdlg').open);
  // reciente guardado; también se guarda un filtro
  await p.click('[data-search]'); await p.waitForSelector('#sdlg[open]');
  await p.waitForFunction(() => /Recientes/.test(document.querySelector('#s-lab').textContent));
  assert((await p.$$('#s-r .sc-row')).length === 1, 'un reciente');
  await p.keyboard.type('ip.addr'); await p.waitForTimeout(80); await p.keyboard.press('Enter');
  await p.waitForFunction(() => location.hash.startsWith('#/lab'));
  await p.reload(); await p.waitForSelector('#main h1');
  await p.keyboard.press('Control+k'); await p.waitForSelector('#sdlg[open] .sc-row');
  assert((await p.$$('#s-r .sc-row')).length === 2, 'dos recientes tras recargar');
  assert(/ip\.addr/.test(await p.textContent('#s-o0')), 'el último va primero');
  // la papelera de la fila activa lo quita; Supr quita el activo
  await p.hover('#s-o0'); await p.click('#s-o0 [data-rm]');
  await p.waitForFunction(() => document.querySelectorAll('#s-r .sc-row').length === 1);
  // «Borrar todo» y «Restaurar»
  await p.click('#sdlg [data-sclear]');
  await p.waitForFunction(() => /Sugerencias/.test(document.querySelector('#s-lab').textContent));
  assert(await p.isVisible('#sdlg [data-srestore]'), 'se puede restaurar');
  await p.click('#sdlg [data-srestore]');
  await p.waitForFunction(() => /Recientes/.test(document.querySelector('#s-lab').textContent) && document.querySelectorAll('#s-r .sc-row').length === 1);
  await p.keyboard.press('Delete');
  await p.waitForFunction(() => /Sugerencias/.test(document.querySelector('#s-lab').textContent));
  assert(await p.evaluate(() => JSON.parse(localStorage.getItem('megalodon.v1')).recent.length) === 0, 'recientes vacíos en el almacenamiento');
  // fichas: quitar «Lecciones» deja 6 categorías y excluye lecciones de los resultados
  await p.fill('#s-q', 'kerberos');
  await p.waitForFunction(() => /LECCI|Lecci/i.test(document.querySelector('#s-r').textContent));
  await p.click('[data-cx="les"]');
  await p.waitForFunction(() => document.querySelector('.sc-count span').textContent === '6');
  assert(!(await p.$('.sc-row .t-les')), 'sin lecciones');
  assert(/6 de 7/.test(await p.getAttribute('[data-call]', 'aria-label')), 'etiqueta accesible del contador');
  await p.click('[data-call]');
  await p.waitForFunction(() => document.querySelector('.sc-count span').textContent === '7' && document.querySelector('.sc-row .t-les'));
  // fuera de la tarjeta cierra y el foco vuelve a la píldora
  await p.mouse.click(1200, 760);
  await p.waitForFunction(() => !document.querySelector('#sdlg').open);
  assert(await p.evaluate(() => document.activeElement?.matches('[data-search]')), 'foco de vuelta a la píldora');
  assert(!p.errors.length, p.errors.join(' | '));
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
  await p.keyboard.press('Shift+T');                       // a mitad de la gota: se interrumpe y manda lo último
  await p.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await p.waitForTimeout(200);
  assert(await p.locator('.fx-layer').count() === 0, 'sin capas huérfanas tras interrumpir');
  assert(!(await p.evaluate(() => document.documentElement.classList.contains('fx-vt'))), 'sin clase de efecto pegada');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('efectos de tema: la gota cae sobre el botón y la lluvia cubre la pantalla; con movimiento reducido, directo', async () => {
  for (const fx of ['drop', 'rain']) {
    const p = await page(browser, { theme: 'light', hash: '#/modulos' });
    await p.evaluate(f => { const o = JSON.parse(localStorage.getItem('megalodon.v1') || '{"v":1}'); o.settings = { ...(o.settings || {}), themeFx: f }; localStorage.setItem('megalodon.v1', JSON.stringify(o)); }, fx);
    await p.reload(); await p.waitForSelector('#main h1');
    await p.click('[data-theme-btn]');
    await p.waitForSelector(fx === 'drop' ? '.fx-layer .fx-drop' : '.fx-layer .fx-canvas', { timeout: 2000 });
    if (fx === 'drop') {                                   // la gota cae hacia el centro del botón
      const d = await p.evaluate(() => { const b = document.querySelector('[data-theme-btn]').getBoundingClientRect(), g = document.querySelector('.fx-drop'); return Math.abs(parseFloat(g.style.left) + 11 - (b.left + b.width / 2)); });
      assert(d < 1, `gota centrada (${d})`);
    }
    // el tema se aplica en la actualización de la View Transition, uno o dos fotogramas después de crear la capa del efecto
    await p.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 1500 });
    assert(await p.locator('.fx-layer').count() === 1, 'el efecto sigue en marcha cuando el tema ya ha cambiado');
    await p.waitForFunction(() => !document.querySelector('.fx-layer'), null, { timeout: 5000 });
    assert(!p.errors.length, `${fx}: ${p.errors.join(' | ')}`);
    await p.close2();
  }
  const r = await page(browser, { theme: 'dark', hash: '#/modulos', reduced: true });
  await r.click('[data-theme-btn]');
  assert(await r.evaluate(() => document.documentElement.dataset.theme) === 'light', 'directo');
  assert(await r.locator('.fx-layer').count() === 0, 'sin efecto con movimiento reducido');
  await r.close2();
  // el efecto se elige en Ajustes
  const s2 = await page(browser, { hash: '#/modulos' });
  await s2.click('[data-settings]'); await s2.waitForSelector('[data-set="themeFx"]');
  await s2.click('[data-set="themeFx"] [data-v="rain"]');
  assert(await s2.evaluate(() => JSON.parse(localStorage.getItem('megalodon.v1')).settings.themeFx) === 'rain', 'se guarda Lluvia');
  await s2.close2();
});

await t('portada sin barra: los controles flotan sobre la ilustración; el resto de páginas conserva la barra', async () => {
  const p = await page(browser, { theme: 'light' });
  const bar = () => p.evaluate(() => { const s = getComputedStyle(document.querySelector('.top-in')); return s.backgroundColor + '|' + s.boxShadow; });
  assert(/rgba\(0, 0, 0, 0\)\|none/.test(await bar()), `sin barra en la portada: ${await bar()}`);
  const g = await p.evaluate(() => { const h = document.querySelector('.hero').getBoundingClientRect(), s = document.querySelector('.top .search-btn').getBoundingClientRect(), t = document.querySelector('[data-theme-btn]').getBoundingClientRect(), side = document.querySelector('[data-side]').getBoundingClientRect(); return { inside: s.top > h.top && t.top > h.top && s.bottom < h.top + 120, leftOfSearch: side.right <= s.left, searchLeft: s.left < h.left + h.width / 3, themeRight: t.left > h.left + h.width / 2 }; });
  assert(g.inside && g.leftOfSearch && g.searchLeft && g.themeRight, `controles sobre el hero ${JSON.stringify(g)}`);
  // la píldora sigue siendo legible sobre la ilustración oscura en modo claro
  const fg = await p.$eval('.top .search-btn .sb-t', e => getComputedStyle(e).color);
  assert(fg === 'rgb(232, 238, 247)', `texto claro sobre el hero: ${fg}`);
  await p.click('.side-nav [data-nav="cheat"]'); await p.waitForSelector('.cgrid');
  assert(!/rgba\(0, 0, 0, 0\)\|none/.test(await bar()), 'barra en las demás páginas');
  await p.close2();
});

await t('perfil: nombre, tipo, rol propio y color se guardan, se ven en el lateral y el texto nunca es HTML', async () => {
  const p = await page(browser, { hash: '#/perfil' });
  assert(/Configura tu perfil/.test(await p.textContent('.acct')), 'invitación en el lateral');
  assert(await p.getAttribute('.acct', 'aria-current') === 'page', 'el lateral marca el perfil');
  await p.fill('#pf-name', '<img src=x onerror=alert(1)> Ana López');
  await p.check('[name="pf-kind"][value="switch"]');
  await p.selectOption('#pf-role', 'other');
  await p.waitForSelector('#pf-other', { state: 'visible' });
  assert(await p.evaluate(() => document.activeElement.id) === 'pf-other', 'foco al campo del rol propio');
  await p.fill('#pf-other', 'Red Team');
  await p.check('[name="pf-color"][value="coral"]', { force: true });
  await p.waitForFunction(() => /Guardado/.test(document.querySelector('[data-saved]').textContent));
  assert(await p.locator('.pf-hero img, .acct img').count() === 0, 'el nombre no se interpreta como HTML');
  assert(/<img src=x/.test(await p.textContent('.pf-name')), 'el nombre se ve como texto');
  assert(/Red Team · Cambio de carrera/.test(await p.textContent('.acct')), 'rol y tipo en el lateral');
  assert(await p.$eval('.acct .av', e => e.className).then(c => /av-coral/.test(c)), 'color del avatar');
  await p.reload(); await p.waitForSelector('#pf-name');
  assert(await p.inputValue('#pf-name') === '<img src=x onerror=alert(1)> Ana López', 'persiste el nombre');
  assert(await p.inputValue('#pf-other') === 'Red Team' && await p.isChecked('[name="pf-kind"][value="switch"]'), 'persisten rol y tipo');
  // inglés: el tipo y el rol cambian de idioma (se guardan como claves)
  await p.click('[data-lang="en"]'); await p.waitForFunction(() => document.documentElement.lang === 'en');
  assert(/Career switcher/.test(await p.textContent('.acct')), 'tipo en inglés');
  await p.click('[data-lang="es"]'); await p.waitForFunction(() => document.documentElement.lang === 'es');
  // vaciar el perfil no toca el progreso
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('megalodon.v1')); o.done = { 'm1-syn': { xp: 10, at: Date.now() } }; localStorage.setItem('megalodon.v1', JSON.stringify(o)); });
  await p.reload(); await p.waitForSelector('#pf-name');
  assert(/1 reto/.test(await p.getAttribute('.hm', 'aria-label')), 'la actividad cuenta el reto de hoy');
  await p.click('[data-clear]'); await p.click('[data-yes]');
  await p.waitForFunction(() => document.querySelector('#pf-name') && document.querySelector('#pf-name').value === '');
  assert(/Configura tu perfil/.test(await p.textContent('.acct')), 'perfil vaciado');
  assert(await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('megalodon.v1')).done).length) === 1, 'el progreso se mantiene');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('perfil en el peor caso: nombre de 60 caracteres sin espacios y rol largo, sin desbordar en 1280 ni en 390 px', async () => {
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const p = await page(browser, { viewport: vp, hash: '#/perfil' });
    await p.fill('#pf-name', 'W'.repeat(80));
    assert((await p.inputValue('#pf-name')).length === 60, 'máximo 60');
    await p.selectOption('#pf-role', 'other'); await p.fill('#pf-other', 'M'.repeat(60));
    assert((await p.inputValue('#pf-other')).length === 40, 'máximo 40');
    await p.waitForTimeout(150);
    assert(await p.evaluate(() => document.documentElement.scrollWidth) <= vp.width, `sin desbordar a ${vp.width}`);
    assert(await p.evaluate(() => { const c = document.querySelector('.pf-id').getBoundingClientRect(), n = document.querySelector('.pf-name').getBoundingClientRect(); return n.right <= c.right + 0.5; }), 'el nombre se parte dentro de la tarjeta');
    if (vp.width > 900) assert(await p.evaluate(() => { const a = document.querySelector('.acct'), b = a.querySelector('.acct-txt b'); return b.scrollWidth > b.clientWidth && a.getBoundingClientRect().right <= document.querySelector('#side').getBoundingClientRect().right; }), 'en el lateral se recorta con puntos suspensivos');
    await p.close2();
  }
});

await t('acerca de: autor, ecosistema con enlaces seguros, «Estás aquí» en Megalodon y versión', async () => {
  const p = await page(browser, { hash: '#/acerca' });
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert((await p.textContent('h1')).includes(`v${pkg.version}`), 'versión del package.json');
  assert(/Yoandy Ramírez Delgado/.test(await p.textContent('.author')), 'autor');
  const ext = await p.$$eval('a[target="_blank"]', as => as.map(a => [a.href, a.rel]));
  assert(ext.length >= 20, `enlaces externos: ${ext.length}`);
  assert(ext.every(([h, r]) => /^https:\/\//.test(h) && /noopener/.test(r) && /noreferrer/.test(r)), 'https y rel=noopener noreferrer');
  const names = await p.$$eval('.eco h3', hs => hs.map(h => h.textContent));
  for (const n of ['Megalodon', 'Blue-Jr', 'WhiteFox', 'Atlas GRC', 'Astrolabio', 'ARGOS', 'Rosetta', 'ENS Compliance Studio', 'KAIROS', 'CTEM-Nexus', 'ENS AD Auditor', 'MCP-Shield', 'Norvik']) assert(names.includes(n), `falta ${n}`);
  assert(await p.locator('.eco-here').count() === 1 && /Megalodon/.test(await p.textContent('.eco.here h3')), '«Estás aquí» solo en Megalodon');
  assert(await p.getAttribute('.side-nav [data-nav="about"]', 'aria-current') === 'page', 'lateral');
  await p.click('[data-lang="en"]'); await p.waitForFunction(() => document.documentElement.lang === 'en');
  assert(/You are here/.test(await p.textContent('.eco.here')) && /GRC and security tools/.test(await p.textContent('#main')), 'en inglés');
  assert(!p.errors.length, p.errors.join(' | '));
  await p.close2();
});

await t('móvil: sin lateral, barra de pestañas abajo y hoja «Más» con perfil, glosario, acerca de, ajustes, ayuda y atajos; se cierra arrastrando', async () => {
  const p = await page(browser, { viewport: { width: 390, height: 844 }, hash: '#/m/m1' });
  assert(await p.$eval('#side', el => getComputedStyle(el).display) === 'none', 'lateral oculto');
  const tb = await p.$eval('#tabbar', el => { const r = el.getBoundingClientRect(); return { d: getComputedStyle(el).display, b: Math.round(r.bottom), n: el.children.length }; });
  assert(tb.d !== 'none' && tb.b >= 820 && tb.b <= 844 && tb.n === 5, `tab bar ${JSON.stringify(tb)}`);
  assert(await p.getAttribute('#tabbar [data-nav="modules"]', 'aria-current') === 'page', 'Módulos activo en el módulo');
  assert(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'sin scroll horizontal');
  await p.click('#tabbar [data-nav="lab"]'); await p.waitForSelector('.lab');
  assert(await p.getAttribute('#tabbar [data-nav="lab"]', 'aria-current') === 'page', 'Lab activo');
  await p.click('[data-more]'); await p.waitForSelector('.more-list');
  assert((await p.$$('.more-list > *')).length === 6, 'seis entradas');
  assert(/Configura tu perfil/.test(await p.textContent('.more-acct')), 'entrada del perfil');
  await p.click('.more-list [data-a="settings"]');
  await p.waitForFunction(() => /Ajustes/.test(document.querySelector('#dlg h2')?.textContent || ''));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('[data-more]'); await p.waitForSelector('.more-list');
  await p.click('.more-list [href="#/glosario"]'); await p.waitForSelector('.gl');
  assert(!(await p.evaluate(() => document.querySelector('#dlg').open)), 'la hoja se cierra al navegar');
  // arrastrar hacia abajo cierra la hoja (por distancia); un arrastre corto la devuelve a su sitio
  await p.click('[data-more]'); await p.waitForSelector('.more-list'); await p.waitForTimeout(500);
  const box = await p.$eval('#dlg .dlg-in', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20, h: r.height }; });
  await p.mouse.move(box.x, box.y); await p.mouse.down();
  for (let i = 1; i <= 6; i++) { await p.mouse.move(box.x, box.y + i * 5); await p.waitForTimeout(40); }   // lento: ni distancia ni velocidad
  await p.waitForTimeout(80); await p.mouse.up();
  await p.waitForTimeout(350);
  assert(await p.evaluate(() => document.querySelector('#dlg').open), 'arrastre corto: sigue abierta');
  await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x, box.y + box.h * 0.6, { steps: 12 }); await p.mouse.up();
  await p.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 2000 });
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
    await p.click('[data-theme-btn]'); await p.waitForFunction(() => !document.querySelector('.fx-layer')); await axe(p, 'inglés claro');
  } finally { await p.close2(); }
  const m = await page(browser, { viewport: { width: 390, height: 844 }, theme: 'light', hash: '#/lab', axe: true });
  try { await m.click('[data-more]'); await m.waitForSelector('.more-list'); await m.waitForTimeout(350); await axe(m, 'hoja Más'); } finally { await m.close2(); }
});

for (const [w, h] of [[1280, 800], [390, 844]]) for (const theme of ['dark', 'light']) {
  await t(`axe 0 infracciones · ${w} px · ${theme === 'dark' ? 'oscuro' : 'claro'}`, async () => {
    for (const hash of ['', '#/modulos', '#/m/m1', '#/lab', '#/chuleta', '#/glosario', '#/perfil', '#/acerca']) {
      const p = await page(browser, { viewport: { width: w, height: h }, theme, hash, axe: true });
      try {
        await p.waitForTimeout(300);
        await axe(p, `${hash || 'inicio'}`);
        if (!hash) { await p.keyboard.press('Control+k'); await p.waitForSelector('#sdlg[open]'); await p.waitForTimeout(700); await axe(p, 'buscador abierto'); await p.keyboard.type('syn'); await p.waitForTimeout(200); await axe(p, 'buscador con resultados'); }
      } finally { await p.close2(); }
    }
  });
}

await browser.close();
console.log(results.join('\n'));
console.log(`\n${pass} correctas · ${fail} fallidas`);
process.exit(fail ? 1 : 0);
