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
  const b = $('[data-theme-btn]'); if (b) b.setAttribute('aria-checked', String(th === 'dark'));
}
function applyLang() { LANG = S.get().settings.lang; document.documentElement.lang = LANG; $('#skip').textContent = t('skip'); }

/* Armazón al estilo de BlueJr y RiskManager-Jr: barra lateral plegable (carril de iconos que se despliega
   por encima al pasar el ratón o con el teclado), barra superior flotante con buscador, interruptores ES|EN
   y claro|oscuro, y barra de pestañas abajo en el móvil. */
const MOBILE_MQ = matchMedia('(max-width: 900px)');
let CUR_MOD = null, indY = null;
function sideOpen() { return S.get().settings.side !== false; }
function renderShell() { renderSide(); renderTop(); renderTabbar(); applyTheme(false); markNav(); }
function renderSide() {
  indY = null;                                             // tras repintar, el indicador se coloca sin animar
  const xp = S.xp(), lv = S.level();
  const mods = MODULES.map((m, i) => {
    const p = modProgress(m), st = p.done === p.total ? 'ok' : p.done ? 'mid' : '';
    return `<li data-i="${i + 2}"><a href="#/m/${m.id}" class="sub" data-mod="${m.id}" title="${esc(`${m.n}. ${mT(m, 'title')}`)}"><span class="dotn ${st}" aria-hidden="true"><b>${m.n}</b></span><span class="txt">${esc(mT(m, 'title'))}</span><span class="cnt num">${p.done}/${p.total}</span></a></li>`;
  }).join('');
  const item = ([k, h, i], n) => `<a href="${h}" data-nav="${k}" data-i="${n}" title="${esc(t(k))}">${ic(i)}<span class="txt">${t(k)}</span></a>`;
  const pct = lv.next ? Math.round(100 * (xp - lv.min) / (lv.next - lv.min)) : 100;
  $('#side').setAttribute('aria-label', t('navMain'));
  $('#side').innerHTML = `
    <a class="side-brand" href="#/" aria-label="Megalodon · ${t('home')}"><span class="logo" aria-hidden="true">${ic('fish')}</span><span class="brand-txt"><b>Megalodon</b><small>${t('brandSub')}</small></span></a>
    <nav class="side-nav" aria-label="${t('navMain')}">
      <span class="side-ind" aria-hidden="true"></span>
      ${item(NAV[0], 0)}${item(NAV[1], 1)}
      <ul aria-label="${t('modules')}">${mods}</ul>
      ${NAV.slice(2).map((n, k) => item(n, 10 + k)).join('')}
    </nav>
    <div class="side-foot">
      <a class="lvl" href="#/modulos" title="${t('level')}: ${esc(lvName(lv))}"><span class="lvl-ic" aria-hidden="true">${ic('trophy')}</span><span class="lvl-txt"><b>${esc(lvName(lv))} · <span class="num" data-xp>${xp}</span> XP</b><span class="meter" role="progressbar" aria-label="${t('levelProg')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i data-w="${Math.max(3, pct)}"></i></span></span></a>
    </div>`;
  $$('[data-i]', $('#side')).forEach(el => el.style.setProperty('--i', el.dataset.i));   // la CSP prohíbe style en línea
  $$('[data-w]', $('#side')).forEach(el => { el.style.width = `${el.dataset.w}%`; });
  document.body.classList.toggle('side-mini', !sideOpen());
}
/* Progreso en su sitio: no se repinta el lateral, así el indicador y el foco no se mueven */
function updateSide() {
  MODULES.forEach(m => {
    const a = $(`.side-nav [data-mod="${m.id}"]`); if (!a) return;
    const p = modProgress(m);
    $('.cnt', a).textContent = `${p.done}/${p.total}`;
    $('.dotn', a).className = `dotn ${p.done === p.total ? 'ok' : p.done ? 'mid' : ''}`;
  });
  const xp = S.xp(), lv = S.level(), pct = lv.next ? Math.round(100 * (xp - lv.min) / (lv.next - lv.min)) : 100;
  const l = $('.lvl'); if (!l) return;
  $('.lvl-txt b', l).innerHTML = `${esc(lvName(lv))} · <span class="num" data-xp>${xp}</span> XP`;
  l.title = `${t('level')}: ${lvName(lv)}`;
  const m = $('.meter', l); m.setAttribute('aria-valuenow', String(pct)); $('i', m).style.width = `${Math.max(3, pct)}%`;
}
function renderTop() {
  const th = resolvedTheme();
  $('#top').innerHTML = `<div class="top-in">
      <button class="ibtn only-desk" type="button" data-side aria-label="${t('sideToggle')}" aria-expanded="${sideOpen()}" title="${t('sideToggle')} ( [ )">${ic('panel')}</button>
      <a class="brand-m" href="#/" aria-label="Megalodon · ${t('home')}"><span class="logo" aria-hidden="true">${ic('fish')}</span><b>Megalodon</b></a>
      <span class="grow"></span>
      <button class="search-btn" type="button" data-search aria-label="${t('search')} (Ctrl K)">${ic('search')}<span class="sb-t">${t('search')}…</span><kbd>Ctrl K</kbd></button>
      <div class="lang-sw" role="group" aria-label="${t('langSwitch')}"><button type="button" data-lang="es" aria-pressed="${LANG === 'es'}" lang="es" aria-label="Español">ES</button><button type="button" data-lang="en" aria-pressed="${LANG === 'en'}" lang="en" aria-label="English">EN</button></div>
      <button class="theme-sw" type="button" role="switch" data-theme-btn aria-checked="${th === 'dark'}" aria-label="${t('themeSwitch')}"><span class="track" aria-hidden="true">${ic('sun')}${ic('moon')}</span><span class="knob" aria-hidden="true"></span></button>
      <button class="ibtn only-desk" type="button" data-help aria-label="${t('help')}" title="${t('help')}">${ic('help')}</button>
      <button class="ibtn only-desk" type="button" data-keys aria-label="${t('shortcuts')}" title="${t('shortcuts')} (?)">${ic('keyboard')}</button>
      <button class="ibtn only-desk" type="button" data-settings aria-label="${t('settings')}" title="${t('settings')}">${ic('settings')}</button>
    </div>`;
  const top = $('#top');
  $('[data-search]', top).onclick = openSearch;
  $('[data-help]', top).onclick = openHelp;
  $('[data-keys]', top).onclick = openKeys;
  $('[data-settings]', top).onclick = openSettings;
  $('[data-theme-btn]', top).onclick = toggleTheme;
  $('[data-side]', top).onclick = toggleSide;
  $$('[data-lang]', top).forEach(b => b.onclick = () => setLang(b.dataset.lang));
}
function renderTabbar() {
  const tb = $('#tabbar');
  tb.setAttribute('aria-label', t('navMobile'));
  tb.innerHTML = NAV.slice(0, 4).map(([k, h, i]) => `<a href="${h}" data-nav="${k}">${ic(i)}<span>${t(k)}</span></a>`).join('') + `<button type="button" data-more aria-haspopup="dialog">${ic('more')}<span>${t('more')}</span></button>`;
  $('[data-more]', tb).onclick = openMore;
}
function openMore() {
  const d = openDialog({ title: `${ic('more')} ${t('more')}`, cls: 'narrow sheet', body: `<div class="more-list">
      <a href="#/glosario" data-go>${ic('glossary')}<span>${t('glossary')}</span>${ic('chevR', 'sm')}</a>
      <button type="button" data-a="settings">${ic('settings')}<span>${t('settings')}</span>${ic('chevR', 'sm')}</button>
      <button type="button" data-a="help">${ic('help')}<span>${t('help')}</span>${ic('chevR', 'sm')}</button>
      <button type="button" data-a="keys">${ic('keyboard')}<span>${t('shortcuts')}</span>${ic('chevR', 'sm')}</button>
    </div>` });
  $('[data-go]', d).onclick = () => closeDialog(true);
  $$('[data-a]', d).forEach(b => b.onclick = () => { closeDialog(true); ({ settings: openSettings, help: openHelp, keys: openKeys })[b.dataset.a](); });
}
function toggleSide() {
  S.set('side', !sideOpen());
  document.body.classList.toggle('side-mini', !sideOpen());
  const b = $('[data-side]'); if (b) b.setAttribute('aria-expanded', String(sideOpen()));
  setTimeout(moveIndicator, 340);
}
function setLang(l) {
  if (l === LANG) return;
  S.set('lang', l); applyLang(); SEARCH_INDEX = null; renderShell(); route();
  toast(l === 'en' ? 'Interface in English. Lessons stay in Spanish.' : 'Interfaz en español.', 'info', 'lang');
}
/* Indicador del lateral: se desliza hasta el elemento activo (solo transform, sin mover la página) */
function moveIndicator() {
  const nav = $('.side-nav'), ind = $('.side-ind'), act = nav && $('a[aria-current="page"]', nav);
  if (!ind) return;
  if (!act) { ind.style.opacity = '0'; return; }
  const y = act.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop, h = act.offsetHeight;   // no offsetTop: los <li> no son el padre de referencia
  if (indY === null || REDUCED.matches) { ind.style.transition = 'none'; ind.style.transform = `translateY(${y}px)`; ind.style.height = `${h}px`; ind.style.opacity = '1'; indY = y; requestAnimationFrame(() => { ind.style.transition = ''; }); return; }
  ind.style.height = `${h}px`; ind.style.opacity = '1'; ind.style.transform = `translateY(${y}px)`; indY = y;
}
function closeMenu() {}
function toggleTheme() { S.set('theme', resolvedTheme() === 'light' ? 'dark' : 'light'); applyTheme(true); }
let CUR_NAV = 'home';
function markNav() {
  $$('[data-nav]').forEach(a => { const on = a.dataset.nav === CUR_NAV && !(CUR_MOD && a.closest('.side-nav')); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $$('[data-mod]').forEach(a => { if (a.dataset.mod === CUR_MOD) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  requestAnimationFrame(moveIndicator);
}

function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?'), q = new URLSearchParams(qs || '');
  if (cleanup) { try { cleanup(); } catch { /* vista ya desmontada */ } cleanup = null; }
  closeMenu();
  if ($('#dlg').open) closeDialog(true);
  const main = $('#main');
  let hit = null;
  for (const [re, fn, nav] of ROUTES) { const m = path.match(re); if (m) { hit = { fn, nav, id: m[1] }; break; } }
  CUR_NAV = hit ? hit.nav : ''; CUR_MOD = hit && hit.fn === viewModule ? hit.id : null;
  main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
  cleanup = hit ? hit.fn(main, { id: hit.id, q }) || null : (viewNotFound(main), null);
  $$('.meter[aria-valuemax]', main).forEach(mt => { const i = mt.firstElementChild; if (i && !i.style.width) i.style.width = `${Math.max(2, 100 * (+mt.getAttribute('aria-valuenow')) / (+mt.getAttribute('aria-valuemax')))}%`; });
  markNav();
  const h1 = $('h1', main);
  document.title = `${h1 && hit && hit.nav !== 'home' ? h1.textContent + ' · ' : ''}Megalodon · ${L('Laboratorio de Wireshark', 'Wireshark lab')}`;
  if (!firstRoute) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  firstRoute = false;
}

/* ---------- Búsqueda ---------- */
let SEARCH_INDEX = null;
function searchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  const ix = [];
  const K = { page: L('Página', 'Page'), mod: L('Módulo', 'Module'), les: L('Lección', 'Lesson'), task: L('Reto', 'Challenge'), glo: t('glossary'), flt: L('Filtro', 'Filter'), fld: L('Campo', 'Field'), act: L('Acción', 'Action') };
  NAV.forEach(([k, h, i]) => ix.push({ ty: 'page', i, title: t(k), go: h }));
  MODULES.forEach(m => {
    ix.push({ ty: 'mod', i: m.icon, title: `${m.n}. ${mT(m, 'title')}`, d: mT(m, 'sub'), go: `#/m/${m.id}`, body: LANG === 'en' ? `${m.title} ${m.sub}` : '' });
    m.lessons.forEach((l, j) => ix.push({ ty: 'les', i: 'book', title: l.h, d: `${K.mod} ${m.n} · ${plain(l.p[0]).slice(0, 90)}`, go: `#/m/${m.id}?l=${j}`, body: plain(l.p.join(' ')) }));
    m.tasks.forEach(x => ix.push({ ty: 'task', i: 'target', title: plain(x.q), d: `${K.mod} ${m.n} · ${mT(m, 'title')}`, go: `#/m/${m.id}?t=${x.id}` }));
  });
  GLOSSARY.forEach(([term, d]) => ix.push({ ty: 'glo', i: 'glossary', title: term, d, go: `#/glosario?q=${encodeURIComponent(term)}` }));
  CHEATS.forEach(g => g.items.forEach(([f, d]) => { if (!/\s{3}| vs /.test(f)) ix.push({ ty: 'flt', i: 'filter', title: f, d, go: `#/lab?f=${encodeURIComponent(f)}`, mono: true }); }));
  FIELD_DEFS.forEach(([n, , d]) => ix.push({ ty: 'fld', i: 'tree', title: n, d, go: `#/lab?f=${encodeURIComponent(n)}`, mono: true }));
  ix.push({ ty: 'act', i: 'sun', title: L('Cambiar tema claro u oscuro', 'Toggle light or dark theme'), act: toggleTheme }, { ty: 'act', i: 'lang', title: L('Interfaz en inglés', 'Interface in Spanish'), act: () => setLang(LANG === 'en' ? 'es' : 'en') }, { ty: 'act', i: 'panel', title: t('sideToggle'), act: toggleSide }, { ty: 'act', i: 'settings', title: t('settings'), act: openSettings }, { ty: 'act', i: 'keyboard', title: t('shortcuts'), act: openKeys }, { ty: 'act', i: 'help', title: t('help'), act: openHelp });
  ix.forEach(x => { x.k = K[x.ty]; });
  ix.forEach(x => { x.nt = norm(x.title); x.nd = norm((x.d || '') + ' ' + (x.body || '')); });
  return (SEARCH_INDEX = ix);
}
function openSearch() {
  const body = document.createElement('div');
  body.innerHTML = `<div class="sbox"><span aria-hidden="true">${ic('search')}</span><label class="vh" for="s-q">${t('search')}</label><input id="s-q" type="text" role="combobox" aria-expanded="true" aria-controls="s-r" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${esc(t('searchPh'))}"></div><ul id="s-r" class="sres" role="listbox" aria-label="${L('Resultados', 'Results')}"></ul><p class="sm muted s-foot"><kbd>↑</kbd><kbd>↓</kbd> ${L('moverte', 'move')} · <kbd>Enter</kbd> ${L('abrir', 'open')} · <kbd>Esc</kbd> ${L('cerrar', 'close')}</p>`;
  openDialog({ title: `${ic('search')} ${t('search')}`, body, cls: 'search' });
  const inp = $('#s-q'), list = $('#s-r');
  let res = [], idx = 0;
  const draw = () => {
    const v = norm(inp.value), ix = searchIndex();
    if (!v) res = ix.filter(x => x.ty === 'mod' || x.ty === 'page').slice(0, 14);
    else res = ix.map(x => ({ x, s: x.nt.startsWith(v) ? 3 : x.nt.includes(v) ? 2 : x.nd.includes(v) ? 1 : 0 })).filter(r => r.s).sort((a, b) => b.s - a.s || a.x.title.length - b.x.title.length).slice(0, 30).map(r => r.x);
    idx = 0;
    list.innerHTML = res.length ? res.map((x, i) => `<li role="option" id="s-o${i}" aria-selected="${i === idx}" data-i="${i}"><span class="s-ic">${ic(x.i, 'sm')}</span><span class="s-t"><span class="${x.mono ? 'mono' : ''}">${esc(x.title.length > 110 ? x.title.slice(0, 108) + '…' : x.title)}</span>${x.d ? `<small>${esc(x.d.length > 100 ? x.d.slice(0, 98) + '…' : x.d)}</small>` : ''}</span><span class="s-k">${x.k}</span></li>`).join('') : `<li class="s-none" role="option" aria-disabled="true">${L('Nada por aquí. Prueba con «syn», «cookie» o «dns».', 'Nothing here. Try “syn”, “cookie” or “dns”.')}</li>`;
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
    <div class="set-row"><div><p>${t('language')}</p><p class="sm muted">${L('Interfaz en español o inglés. Las lecciones están en español.', 'Interface in Spanish or English. Lessons are in Spanish.')}</p></div><div data-set="lang">${seg(t('language'), st.lang, [['es', 'Español'], ['en', 'English']])}</div></div>
    ${sw('relative', L('Números de secuencia relativos', 'Relative sequence numbers'), L('Como Wireshark por defecto: Seq y Ack empiezan en 0. Desactívalo para ver los valores reales.', 'Wireshark’s default: Seq and Ack start at 0. Turn it off to see the real values.'))}
    ${sw('colorize', L('Colorear paquetes', 'Colorize packets'), L('Reglas de color de Wireshark: TCP, HTTP, RST, problemas…', 'Wireshark coloring rules: TCP, HTTP, RST, problems…'))}
    <div class="set-row danger-zone"><div><p>${t('resetProgress')}</p><p class="sm muted">${L(`${solved} retos y ${S.xp()} XP guardados en este navegador.`, `${solved} challenges and ${S.xp()} XP saved in this browser.`)}</p></div><button type="button" class="btn danger sm" data-reset ${solved || S.xp() ? '' : 'disabled'}>${ic('reset', 'sm')}${t('resetProgress')}</button></div>` });
  $$('[data-set]', d).forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    $$('[role=radio]', g).forEach(x => x.setAttribute('aria-checked', String(x === b)));
    const k = g.dataset.set; S.set(k, b.dataset.v);
    if (k === 'theme') applyTheme(true);
    if (k === 'lang') { applyLang(); SEARCH_INDEX = null; renderShell(); closeDialog(true); route(); openSettings(); }
    if (k === 'theme') renderTop();
  }));
  $$('[data-sw]', d).forEach(b => b.onclick = () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); S.set(b.dataset.sw, v); });
  $('[data-reset]', d).onclick = async () => {
    const nd = Object.keys(S.get().done).length, nb = Object.keys(S.get().badges).length;
    const ok = await confirmDialog({ title: L('¿Borrar todo tu progreso?', 'Reset all your progress?'), text: L(`Se borrarán <strong>${nd} retos</strong>, <strong>${nb} insignias</strong> y <strong>${S.xp()} XP</strong>. Tus ajustes se mantienen. No se puede deshacer.`, `This deletes <strong>${nd} challenges</strong>, <strong>${nb} badges</strong> and <strong>${S.xp()} XP</strong>. Your settings stay. It cannot be undone.`), ok: t('resetConfirm') });
    if (ok) { S.reset(); toast(L('Progreso borrado. A empezar de cero.', 'Progress reset. Back to square one.'), 'info', 'reset'); route(); }
  };
}
function openHelp() {
  openDialog({ title: `${ic('help')} ${t('help')}`, wide: true, body: LANG === 'en' ? `<div class="help">
    <section><h3>${ic('rows', 'sm')}The three panes</h3><p>At the top, the <strong>packet list</strong>. In the middle, the layered <strong>detail tree</strong>. At the bottom, the <strong>bytes</strong>. Clicking a field highlights its bytes, and clicking a byte opens its field.</p></section>
    <section><h3>${ic('filter', 'sm')}The filter bar</h3><p>It turns <span class="okt">green</span> when the filter is valid and <span class="badt">red</span> when it is not, with the reason below. <kbd>Tab</kbd> accepts the suggestion and <kbd>Enter</kbd> applies. In the tree, each field’s ${ic('filter', 'sm')} button turns it into a filter (“Apply as Filter”).</p></section>
    <section><h3>${ic('target', 'sm')}Challenges</h3><p>Four kinds: write a <strong>filter</strong> (it must show exactly the solution’s packets), pick a <strong>packet</strong>, type an <strong>answer</strong> or choose an option. Each challenge gives 10 XP; each hint takes a little off. Finishing a module gives a badge and 20 extra XP.</p></section>
    <section><h3>${ic('flask', 'sm')}Analyst tools</h3><p>Expert Information (<kbd>E</kbd>), HTTP objects, cleartext credentials, Statistics (<kbd>S</kbd>) with conversations, endpoints and I/O graph, Follow TCP/UDP stream (<kbd>F</kbd>), Find Packet (<kbd>Ctrl F</kbd>), Go to Packet (<kbd>Ctrl G</kbd>) and the time display format, as in Wireshark.</p></section>
    <section><h3>${ic('upload', 'sm')}Your captures</h3><p>In the Free lab you can open your own .pcap or .pcapng files (or drag them in). Everything is processed in your browser: nothing leaves your device.</p></section>
    <section><h3>${ic('book', 'sm')}Sources</h3><p>Field names, coloring rules and the Info column follow Wireshark 4.x; the engine was checked packet by packet against tshark. Official guide: <a href="https://www.wireshark.org/docs/wsug_html_chunked/" target="_blank" rel="noopener noreferrer">Wireshark User's Guide</a> · <a href="https://www.wireshark.org/docs/man-pages/wireshark-filter.html" target="_blank" rel="noopener noreferrer">wireshark-filter(4)</a>.</p></section>
  </div>` : `<div class="help">
    <section><h3>${ic('rows', 'sm')}Las tres zonas</h3><p>Arriba, la <strong>lista de paquetes</strong>. En medio, el <strong>árbol de detalle</strong> por capas. Abajo, los <strong>bytes</strong>. Al pulsar un campo se iluminan sus bytes, y al pulsar un byte se abre su campo.</p></section>
    <section><h3>${ic('filter', 'sm')}La barra de filtros</h3><p>Se pone <span class="okt">verde</span> si el filtro es válido y <span class="badt">roja</span> si no, con el motivo debajo. <kbd>Tab</kbd> acepta la sugerencia y <kbd>Enter</kbd> aplica. En el árbol, el botón ${ic('filter', 'sm')} de cada campo lo convierte en filtro («Aplicar como filtro»).</p></section>
    <section><h3>${ic('target', 'sm')}Retos</h3><p>Hay cuatro tipos: escribir un <strong>filtro</strong> (debe mostrar exactamente los paquetes de la solución), elegir un <strong>paquete</strong>, escribir una <strong>respuesta</strong> o elegir una opción. Cada reto da 10 XP; cada pista resta un poco. Completar un módulo da una insignia y 20 XP extra.</p></section>
    <section><h3>${ic('flask', 'sm')}Herramientas de analista</h3><p>Información experta (<kbd>E</kbd>), objetos HTTP, credenciales en claro, Estadísticas (<kbd>S</kbd>) con conversaciones, endpoints y gráfico de E/S, seguir flujo TCP/UDP (<kbd>F</kbd>), Buscar paquete (<kbd>Ctrl F</kbd>), Ir al paquete (<kbd>Ctrl G</kbd>) y formato de tiempo, como en Wireshark.</p></section>
    <section><h3>${ic('upload', 'sm')}Tus capturas</h3><p>En el Laboratorio libre puedes abrir tus .pcap o .pcapng (o arrastrarlos). Todo se procesa en tu navegador: nada sale de tu equipo.</p></section>
    <section><h3>${ic('book', 'sm')}Fuentes</h3><p>Nombres de campos, reglas de color y formato de la columna Info siguen a Wireshark 4.x; el motor se ha comprobado paquete a paquete contra tshark. Guía oficial: <a href="https://www.wireshark.org/docs/wsug_html_chunked/" target="_blank" rel="noopener noreferrer">Wireshark User's Guide</a> · <a href="https://www.wireshark.org/docs/man-pages/wireshark-filter.html" target="_blank" rel="noopener noreferrer">wireshark-filter(4)</a>.</p></section>
  </div>` });
}
function openKeys() {
  openDialog({ title: `${ic('keyboard')} ${t('shortcuts')}`, cls: 'narrow', body: `<table class="tbl keys"><caption class="vh">${t('shortcuts')}</caption><tbody>${SHORTCUTS.map(([k, es, en]) => `<tr><th scope="row">${k.split(' ').map(x => `<kbd>${LANG === 'en' ? ({ Inicio: 'Home', Fin: 'End', 'Mayús': 'Shift' })[x] || x : x}</kbd>`).join(' ')}</th><td>${LANG === 'en' ? en : es}</td></tr>`).join('')}</tbody></table>` });
}

function onKey(e) {
  const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
  if ((e.ctrlKey || e.metaKey) && CUR_WS && !$('#dlg').open && ['f', 'g'].includes(e.key.toLowerCase())) { e.preventDefault(); openFind(CUR_WS, e.key.toLowerCase() === 'g' ? 'goto' : 'find'); return; }
  if (typing || $('#dlg').open || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/' && CUR_WS) { e.preventDefault(); CUR_WS.focusFilter(); }
  else if (e.key === '?') { e.preventDefault(); openKeys(); }
  else if (e.key === '[' && !MOBILE_MQ.matches) { e.preventDefault(); toggleSide(); }
  else if (e.key === 'T' && e.shiftKey) toggleTheme();
  else if ((e.key === 'f' || e.key === 'F') && !e.shiftKey && CUR_WS) CUR_WS.follow();
  else if ((e.key === 's' || e.key === 'S') && !e.shiftKey && CUR_WS) openStats(CUR_WS);
  else if ((e.key === 'e' || e.key === 'E') && !e.shiftKey && CUR_WS) openExpert(CUR_WS);
}

function boot() {
  applyLang(); renderShell(); route();
  setTimeout(() => document.body.classList.add('ready'), 700);          // la entrada escalonada solo en la primera carga
  addEventListener('hashchange', route);
  addEventListener('keydown', onKey);
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (S.get().settings.theme === 'system') applyTheme(true); });
  let lastXp = S.xp();
  S.on(() => {                                             // el lateral refleja al momento retos, insignias y XP
    updateSide();
    if (S.xp() > lastXp) { const l = $('.lvl'); if (l) { l.classList.remove('bump'); void l.offsetWidth; l.classList.add('bump'); } }
    lastXp = S.xp();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
