/* Megalodon · armazón: barra superior, enrutado, búsqueda (Ctrl K), ajustes, ayuda, atajos y tema. */
const ROUTES = [
  [/^\/?$/, viewHome, 'home'], [/^\/modulos$/, viewModules, 'modules'], [/^\/m\/(m\d)$/, viewModule, 'modules'],
  [/^\/lab$/, viewLab, 'lab'], [/^\/chuleta$/, viewCheat, 'cheat'], [/^\/glosario$/, viewGlossary, 'glossary'],
];
const NAV = [['home', '#/', 'home'], ['modules', '#/modulos', 'layers'], ['lab', '#/lab', 'flask'], ['cheat', '#/chuleta', 'cheat'], ['glossary', '#/glosario', 'glossary']];
let cleanup = null, firstRoute = true;

function resolvedTheme() { const th = S.get().settings.theme; return th === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : th; }
function applyTheme(animate) {
  const th = resolvedTheme(), root = document.documentElement;
  if (animate && !REDUCED.matches) { root.classList.add('theming'); clearTimeout(applyTheme.tm); applyTheme.tm = setTimeout(() => root.classList.remove('theming'), 320); }
  root.dataset.theme = th;
  const b = $('[data-theme-btn]'); if (b) b.setAttribute('aria-label', th === 'light' ? t('themeToDark') : t('themeToLight'));
}
function applyLang() { LANG = S.get().settings.lang; document.documentElement.lang = LANG; $('#skip').textContent = t('skip'); }

function renderTop() {
  const xp = S.xp(), lv = S.level();
  $('#top').innerHTML = `<div class="top-in">
    <a class="brand" href="#/" aria-label="Megalodon · ${t('home')}"><span class="logo" aria-hidden="true">${ic('fish')}</span><span class="brand-t">Megalodon</span></a>
    <nav class="nav" aria-label="Principal">${NAV.map(([k, h, i]) => `<a href="${h}" data-nav="${k}">${ic(i, 'sm')}<span>${t(k)}</span></a>`).join('')}</nav>
    <div class="top-acts">
      <button class="search-btn" type="button" data-search aria-label="${t('search')} (Ctrl K)">${ic('search')}<span class="sb-t">${t('search')}…</span><kbd>Ctrl K</kbd></button>
      <a class="xp-chip" href="#/modulos" title="${t('level')}: ${lv.name}" aria-label="${xp} XP, ${t('level')} ${lv.name}">${ic('trophy', 'sm')}<span class="num" data-xp>${xp}</span><span class="xp-u">XP</span></a>
      <button class="ibtn hide-narrow" type="button" data-help aria-label="${t('help')}" title="${t('help')}">${ic('help')}</button>
      <button class="ibtn hide-narrow" type="button" data-keys aria-label="${t('shortcuts')}" title="${t('shortcuts')} (?)">${ic('keyboard')}</button>
      <button class="ibtn" type="button" data-settings aria-label="${t('settings')}" title="${t('settings')}">${ic('settings')}</button>
      <button class="ibtn theme-btn" type="button" data-theme-btn aria-label="${t('themeToLight')}"><span class="sun">${ic('sun')}</span><span class="moon">${ic('moon')}</span></button>
      <button class="ibtn" type="button" data-menu aria-label="${t('menu')}" aria-expanded="false" aria-controls="mnav">${ic('menu')}</button>
    </div>
  </div>
  <nav id="mnav" class="mnav" aria-label="Principal (móvil)" hidden>${NAV.map(([k, h, i]) => `<a href="${h}" data-nav="${k}">${ic(i)}<span>${t(k)}</span></a>`).join('')}<button type="button" data-help>${ic('help')}<span>${t('help')}</span></button><button type="button" data-keys>${ic('keyboard')}<span>${t('shortcuts')}</span></button></nav>`;
  const top = $('#top');
  $$('[data-search]', top).forEach(b => b.onclick = openSearch);
  $$('[data-help]', top).forEach(b => b.onclick = () => { closeMenu(); openHelp(); });
  $$('[data-keys]', top).forEach(b => b.onclick = () => { closeMenu(); openKeys(); });
  $('[data-settings]', top).onclick = openSettings;
  $('[data-theme-btn]', top).onclick = toggleTheme;
  const mb = $('[data-menu]', top), mn = $('#mnav');
  mb.onclick = () => { const open = mn.hidden; mn.hidden = !open; mb.setAttribute('aria-expanded', String(open)); if (open) $('a', mn).focus(); };
  $$('a', mn).forEach(a => a.addEventListener('click', closeMenu));
  applyTheme(false); markNav();
}
function closeMenu() { const mn = $('#mnav'); if (mn && !mn.hidden) { mn.hidden = true; $('[data-menu]').setAttribute('aria-expanded', 'false'); } }
function toggleTheme() { S.set('theme', resolvedTheme() === 'light' ? 'dark' : 'light'); applyTheme(true); }
let CUR_NAV = 'home';
function markNav() { $$('[data-nav]').forEach(a => { if (a.dataset.nav === CUR_NAV) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }

function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?'), q = new URLSearchParams(qs || '');
  if (cleanup) { try { cleanup(); } catch { /* vista ya desmontada */ } cleanup = null; }
  closeMenu();
  if ($('#dlg').open) closeDialog(true);
  const main = $('#main');
  let hit = null;
  for (const [re, fn, nav] of ROUTES) { const m = path.match(re); if (m) { hit = { fn, nav, id: m[1] }; break; } }
  CUR_NAV = hit ? hit.nav : '';
  main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
  cleanup = hit ? hit.fn(main, { id: hit.id, q }) || null : (viewNotFound(main), null);
  $$('.meter[aria-valuemax]', main).forEach(mt => { const i = mt.firstElementChild; if (i && !i.style.width) i.style.width = `${Math.max(2, 100 * (+mt.getAttribute('aria-valuenow')) / (+mt.getAttribute('aria-valuemax')))}%`; });
  markNav();
  const h1 = $('h1', main);
  document.title = `${h1 && hit && hit.nav !== 'home' ? h1.textContent + ' · ' : ''}Megalodon · Laboratorio de Wireshark`;
  if (!firstRoute) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  firstRoute = false;
}

/* ---------- Búsqueda ---------- */
let SEARCH_INDEX = null;
function searchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  const ix = [];
  NAV.forEach(([k, h, i]) => ix.push({ k: 'Página', i, title: t(k), go: h }));
  MODULES.forEach(m => {
    ix.push({ k: 'Módulo', i: m.icon, title: `${m.n}. ${m.title}`, d: m.sub, go: `#/m/${m.id}` });
    m.lessons.forEach((l, j) => ix.push({ k: 'Lección', i: 'book', title: l.h, d: `Módulo ${m.n} · ${plain(l.p[0]).slice(0, 90)}`, go: `#/m/${m.id}?l=${j}`, body: plain(l.p.join(' ')) }));
    m.tasks.forEach(x => ix.push({ k: 'Reto', i: 'target', title: plain(x.q), d: `Módulo ${m.n} · ${m.title}`, go: `#/m/${m.id}?t=${x.id}` }));
  });
  GLOSSARY.forEach(([term, d]) => ix.push({ k: 'Glosario', i: 'glossary', title: term, d, go: `#/glosario?q=${encodeURIComponent(term)}` }));
  CHEATS.forEach(g => g.items.forEach(([f, d]) => { if (!/\s{3}| vs /.test(f)) ix.push({ k: 'Filtro', i: 'filter', title: f, d, go: `#/lab?f=${encodeURIComponent(f)}`, mono: true }); }));
  FIELD_DEFS.forEach(([n, , d]) => ix.push({ k: 'Campo', i: 'tree', title: n, d, go: `#/lab?f=${encodeURIComponent(n)}`, mono: true }));
  ix.push({ k: 'Acción', i: 'sun', title: 'Cambiar tema claro u oscuro', act: toggleTheme }, { k: 'Acción', i: 'settings', title: t('settings'), act: openSettings }, { k: 'Acción', i: 'keyboard', title: t('shortcuts'), act: openKeys }, { k: 'Acción', i: 'help', title: t('help'), act: openHelp });
  ix.forEach(x => { x.nt = norm(x.title); x.nd = norm((x.d || '') + ' ' + (x.body || '')); });
  return (SEARCH_INDEX = ix);
}
function openSearch() {
  const body = document.createElement('div');
  body.innerHTML = `<div class="sbox"><span aria-hidden="true">${ic('search')}</span><label class="vh" for="s-q">${t('search')}</label><input id="s-q" type="text" role="combobox" aria-expanded="true" aria-controls="s-r" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${esc(t('searchPh'))}"></div><ul id="s-r" class="sres" role="listbox" aria-label="Resultados"></ul><p class="sm muted s-foot"><kbd>↑</kbd><kbd>↓</kbd> moverte · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> cerrar</p>`;
  openDialog({ title: `${ic('search')} ${t('search')}`, body, cls: 'search' });
  const inp = $('#s-q'), list = $('#s-r');
  let res = [], idx = 0;
  const draw = () => {
    const v = norm(inp.value), ix = searchIndex();
    if (!v) res = ix.filter(x => x.k === 'Módulo' || x.k === 'Página').slice(0, 14);
    else res = ix.map(x => ({ x, s: x.nt.startsWith(v) ? 3 : x.nt.includes(v) ? 2 : x.nd.includes(v) ? 1 : 0 })).filter(r => r.s).sort((a, b) => b.s - a.s || a.x.title.length - b.x.title.length).slice(0, 30).map(r => r.x);
    idx = 0;
    list.innerHTML = res.length ? res.map((x, i) => `<li role="option" id="s-o${i}" aria-selected="${i === idx}" data-i="${i}"><span class="s-ic">${ic(x.i, 'sm')}</span><span class="s-t"><span class="${x.mono ? 'mono' : ''}">${esc(x.title.length > 110 ? x.title.slice(0, 108) + '…' : x.title)}</span>${x.d ? `<small>${esc(x.d.length > 100 ? x.d.slice(0, 98) + '…' : x.d)}</small>` : ''}</span><span class="s-k">${x.k}</span></li>`).join('') : `<li class="s-none" role="option" aria-disabled="true">Nada por aquí. Prueba con «syn», «cookie» o «dns».</li>`;
    inp.setAttribute('aria-activedescendant', res.length ? 's-o0' : '');
  };
  const go = i => { const x = res[i]; if (!x) return; closeDialog(true); if (x.act) x.act(); else if (location.hash === x.go) route(); else location.hash = x.go; };
  const mark = () => { $$('[role=option]', list).forEach((li, i) => li.setAttribute('aria-selected', String(i === idx))); const el = $(`#s-o${idx}`); if (el) { el.scrollIntoView({ block: 'nearest' }); inp.setAttribute('aria-activedescendant', el.id); } };
  inp.addEventListener('input', draw);
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(res.length - 1, idx + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(idx); }
  });
  list.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) go(+li.dataset.i); });
  draw(); inp.focus();
}

/* ---------- Ajustes, ayuda y atajos ---------- */
function openSettings() {
  const st = S.get().settings;
  const seg = (name, val, opts) => `<div class="seg sm" role="radiogroup" aria-label="${name}">${opts.map(([v, l, i]) => `<button type="button" role="radio" aria-checked="${v === val}" data-v="${v}">${i ? ic(i, 'sm') : ''}${l}</button>`).join('')}</div>`;
  const sw = (k, label, desc) => `<div class="set-row"><div><p id="sw-${k}">${label}</p><p class="sm muted">${desc}</p></div><button type="button" class="switch" role="switch" aria-checked="${!!st[k]}" aria-labelledby="sw-${k}" data-sw="${k}"><i></i></button></div>`;
  const solved = Object.keys(S.get().done).length;
  const d = openDialog({ title: `${ic('settings')} ${t('settings')}`, body: `
    <div class="set-row"><div><p>${t('theme')}</p></div><div data-set="theme">${seg(t('theme'), st.theme, [['light', t('light'), 'sun'], ['dark', t('dark'), 'moon'], ['system', t('system'), null]])}</div></div>
    <div class="set-row"><div><p>${t('language')}</p><p class="sm muted">Interfaz en español o inglés. Las lecciones están en español.</p></div><div data-set="lang">${seg(t('language'), st.lang, [['es', 'Español'], ['en', 'English']])}</div></div>
    ${sw('relative', 'Números de secuencia relativos', 'Como Wireshark por defecto: Seq y Ack empiezan en 0. Desactívalo para ver los valores reales.')}
    ${sw('colorize', 'Colorear paquetes', 'Reglas de color de Wireshark: TCP, HTTP, RST, problemas…')}
    <div class="set-row danger-zone"><div><p>${t('resetProgress')}</p><p class="sm muted">${solved} retos y ${S.xp()} XP guardados en este navegador.</p></div><button type="button" class="btn danger sm" data-reset ${solved || S.xp() ? '' : 'disabled'}>${ic('reset', 'sm')}${t('resetProgress')}</button></div>` });
  $$('[data-set]', d).forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    $$('[role=radio]', g).forEach(x => x.setAttribute('aria-checked', String(x === b)));
    const k = g.dataset.set; S.set(k, b.dataset.v);
    if (k === 'theme') applyTheme(true);
    if (k === 'lang') { applyLang(); SEARCH_INDEX = null; renderTop(); closeDialog(true); route(); openSettings(); }
  }));
  $$('[data-sw]', d).forEach(b => b.onclick = () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); S.set(b.dataset.sw, v); });
  $('[data-reset]', d).onclick = async () => {
    const ok = await confirmDialog({ title: '¿Borrar todo tu progreso?', text: `Se borrarán <strong>${Object.keys(S.get().done).length} retos</strong>, <strong>${Object.keys(S.get().badges).length} insignias</strong> y <strong>${S.xp()} XP</strong>. Tus ajustes se mantienen. No se puede deshacer.`, ok: t('resetConfirm') });
    if (ok) { S.reset(); toast('Progreso borrado. A empezar de cero.', 'info', 'reset'); route(); }
  };
}
function openHelp() {
  openDialog({ title: `${ic('help')} ${t('help')}`, wide: true, body: `<div class="help">
    <section><h3>${ic('rows', 'sm')}Las tres zonas</h3><p>Arriba, la <strong>lista de paquetes</strong>. En medio, el <strong>árbol de detalle</strong> por capas. Abajo, los <strong>bytes</strong>. Al pulsar un campo se iluminan sus bytes, y al pulsar un byte se abre su campo.</p></section>
    <section><h3>${ic('filter', 'sm')}La barra de filtros</h3><p>Se pone <span class="okt">verde</span> si el filtro es válido y <span class="badt">roja</span> si no, con el motivo debajo. <kbd>Tab</kbd> acepta la sugerencia y <kbd>Enter</kbd> aplica. En el árbol, el botón ${ic('filter', 'sm')} de cada campo lo convierte en filtro («Aplicar como filtro»).</p></section>
    <section><h3>${ic('target', 'sm')}Retos</h3><p>Hay cuatro tipos: escribir un <strong>filtro</strong> (debe mostrar exactamente los paquetes de la solución), elegir un <strong>paquete</strong>, escribir una <strong>respuesta</strong> o elegir una opción. Cada reto da 10 XP; cada pista resta un poco. Completar un módulo da una insignia y 20 XP extra.</p></section>
    <section><h3>${ic('upload', 'sm')}Tus capturas</h3><p>En el Laboratorio libre puedes abrir tus .pcap o .pcapng (o arrastrarlos). Todo se procesa en tu navegador: nada sale de tu equipo.</p></section>
    <section><h3>${ic('book', 'sm')}Fuentes</h3><p>Nombres de campos, reglas de color y formato de la columna Info siguen a Wireshark 4.x; el motor se ha comprobado paquete a paquete contra tshark. Guía oficial: <a href="https://www.wireshark.org/docs/wsug_html_chunked/" target="_blank" rel="noopener noreferrer">Wireshark User's Guide</a> · <a href="https://www.wireshark.org/docs/man-pages/wireshark-filter.html" target="_blank" rel="noopener noreferrer">wireshark-filter(4)</a>.</p></section>
  </div>` });
}
function openKeys() {
  openDialog({ title: `${ic('keyboard')} ${t('shortcuts')}`, cls: 'narrow', body: `<table class="tbl keys"><caption class="vh">${t('shortcuts')}</caption><tbody>${SHORTCUTS.map(([k, es, en]) => `<tr><th scope="row">${k.split(' ').map(x => `<kbd>${x}</kbd>`).join(' ')}</th><td>${LANG === 'en' ? en : es}</td></tr>`).join('')}</tbody></table>` });
}

function onKey(e) {
  const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
  if (typing || $('#dlg').open || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/' && CUR_WS) { e.preventDefault(); CUR_WS.focusFilter(); }
  else if (e.key === '?') { e.preventDefault(); openKeys(); }
  else if (e.key === 'T' && e.shiftKey) toggleTheme();
  else if ((e.key === 'f' || e.key === 'F') && !e.shiftKey && CUR_WS) CUR_WS.follow();
  else if ((e.key === 's' || e.key === 'S') && !e.shiftKey && CUR_WS) openStats(CUR_WS);
}

function boot() {
  applyLang(); renderTop(); route();
  addEventListener('hashchange', route);
  addEventListener('keydown', onKey);
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (S.get().settings.theme === 'system') applyTheme(true); });
  S.on(() => { const el = $('[data-xp]'); if (el && +el.textContent !== S.xp()) { el.textContent = S.xp(); const chip = el.closest('.xp-chip'); chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); chip.setAttribute('aria-label', `${S.xp()} XP, ${t('level')} ${S.level().name}`); } });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
