/* Megalodon · buscador (Ctrl K) que se abre desde la píldora de búsqueda.
   Adaptado de la Search Card de Pin UI (MIT, © Rachit Thakur, github.com/shadcn-labs/Pin-UI): la píldora crece hasta ser
   una tarjeta (la misma superficie, sin saltos), los recientes con su baldosa, una lámina que se desliza bajo la fila activa,
   la papelera que aparece en esa fila, «Borrar todo» y «Restaurar», y las fichas de categoría con un contador que rueda.
   Movimiento con curvas, sin muelles: ease-in-out para lo que cambia de tamaño y ease-out para lo que aparece.
   Teclado: ↑ ↓ para moverse, Enter para abrir, Supr para quitar un reciente y Esc (primero borra, luego cierra). */
const SC_CATS = [['mod', ['Módulos', 'Modules']], ['les', ['Lecciones', 'Lessons']], ['task', ['Retos', 'Challenges']], ['glo', ['Glosario', 'Glossary']], ['flt', ['Filtros', 'Filters']], ['fld', ['Campos', 'Fields']], ['nav', ['Páginas y acciones', 'Pages and actions']]];
const SC_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)', SC_MORPH = 'cubic-bezier(0.45, 0, 0.15, 1)', SC_INOUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const catOf = x => (x.ty === 'page' || x.ty === 'act' ? 'nav' : x.ty);
const catName = c => tx(SC_CATS.find(x => x[0] === c)[1]);
let scOn = new Set(SC_CATS.map(c => c[0]));                // categorías activas durante la sesión
let scCleared = null;                                      // lo que se vació con «Borrar todo», para «Restaurar»
let SC = null;

const searchOpen = () => !!(SC && SC.dlg.open);

function openSearch() {
  if (searchOpen()) { closeSearch(); return; }
  if ($('#dlg').open) closeDialog(true);
  let dlg = $('#sdlg');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'sdlg'; dlg.className = 'scard';
    document.body.append(dlg);
    dlg.addEventListener('cancel', e => { e.preventDefault(); scEsc(); });
    dlg.addEventListener('click', e => { if (e.target === dlg) closeSearch(); });   // fuera de la tarjeta
  }
  dlg.setAttribute('aria-label', t('search'));
  dlg.innerHTML = `<div class="sc-wrap"><div class="sc-card" data-card>
    <div class="sc-bar" data-bar><span class="sc-glass" aria-hidden="true">${ic('search')}</span><label class="vh" for="s-q">${t('search')}</label><input id="s-q" class="sc-input" type="text" role="combobox" aria-expanded="true" aria-controls="s-r" aria-autocomplete="list" aria-describedby="s-help" autocomplete="off" spellcheck="false" placeholder="${esc(t('searchPh'))}"><button type="button" class="sc-x" data-sx aria-label="${t('close')}">${ic('x')}</button></div>
    <div class="sc-body" data-body>
      <div class="sc-panel"><div class="sc-head"><span class="sc-label" id="s-lab"></span><span data-act></span></div>
        <div class="sc-listwrap" data-wrap><span class="sc-sheet" aria-hidden="true"></span><ul id="s-r" class="sc-list" role="listbox" aria-labelledby="s-lab"></ul></div></div>
      <div class="sc-chips" role="group" aria-label="${L('Categorías de la búsqueda', 'Search categories')}" data-chips></div>
      <p class="sc-foot sm muted" id="s-help"><kbd>↑</kbd><kbd>↓</kbd> ${L('moverte', 'move')} · <kbd>Enter</kbd> ${L('abrir', 'open')} · <kbd>${L('Supr', 'Del')}</kbd> ${L('quitar reciente', 'remove recent')} · <kbd>Esc</kbd> ${L('cerrar', 'close')}</p>
    </div></div></div>`;
  SC = { dlg, card: $('[data-card]', dlg), inp: $('#s-q', dlg), list: $('#s-r', dlg), wrap: $('[data-wrap]', dlg), sheet: $('.sc-sheet', dlg), res: [], mode: '', idx: 0, ret: document.activeElement && document.activeElement !== document.body && document.activeElement.id !== 'main' ? document.activeElement : $('[data-search]'), closing: false, sheetShown: false };
  scPlace();
  scDraw(true); scChips();
  SC.inp.addEventListener('input', () => scDraw());
  SC.inp.addEventListener('keydown', scKeys);
  /* la lista es la que se desplaza (un listbox): la lámina la acompaña sin deslizarse */
  SC.list.addEventListener('scroll', () => { const el = $(`#s-o${SC.idx}`); if (el && SC.sheetShown) { SC.sheet.style.transition = 'none'; SC.sheet.style.transform = `translateY(${el.offsetTop - SC.list.scrollTop}px)`; requestAnimationFrame(() => { SC.sheet.style.transition = ''; }); } }, { passive: true });
  SC.list.addEventListener('pointermove', e => { const li = e.target.closest('[data-i]'); if (li && +li.dataset.i !== SC.idx) { SC.idx = +li.dataset.i; scMark(false); } });
  SC.list.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]'); if (rm) { e.stopPropagation(); scRemove(+rm.dataset.rm); return; }
    const li = e.target.closest('[data-i]'); if (li) scGo(+li.dataset.i);
  });
  $('[data-sx]', dlg).onclick = () => { if (SC.inp.value) { SC.inp.value = ''; scDraw(); SC.inp.focus(); } else closeSearch(); };
  document.body.classList.add('sc-open');
  dlg.showModal();
  SC.inp.focus();
  scMorph(true);
}

/* La tarjeta nace donde está la píldora: mismo borde izquierdo y misma altura, dentro de la pantalla */
function scPlace() {
  const pill = $('[data-search]'), pr = pill && pill.getBoundingClientRect(), W = innerWidth, cw = Math.min(640, W - 24);
  const left = Math.min(Math.max(pr && pr.width ? pr.left - 6 : (W - cw) / 2, 12), W - cw - 12), top = Math.max(8, pr && pr.width ? pr.top - 6 : 72);
  SC.card.style.setProperty('--sc-l', `${left}px`); SC.card.style.setProperty('--sc-t', `${top}px`); SC.card.style.setProperty('--sc-w', `${cw}px`);
  SC.pr = pr && pr.width ? pr : null;
}
function scMorph(open) {
  const { card } = SC, body = $('[data-body]', card), bar = $('[data-bar]', card);
  if (REDUCED.matches || !SC.pr) {
    return card.animate({ opacity: open ? [0, 1] : [1, 0], transform: open ? ['scale(0.98)', 'none'] : ['none', 'scale(0.98)'] }, { duration: REDUCED.matches ? 120 : 200, easing: SC_EASE }).finished.catch(() => {});
  }
  const pr = SC.pr, cr = card.getBoundingClientRect(), br = bar.getBoundingClientRect();
  const pill = `inset(${(pr.top - cr.top).toFixed(1)}px ${(cr.right - pr.right).toFixed(1)}px ${(cr.bottom - pr.bottom).toFixed(1)}px ${(pr.left - cr.left).toFixed(1)}px round ${pr.height / 2}px)`;
  const full = 'inset(0px 0px 0px 0px round 26px)';
  const dx = pr.left - br.left - 6, dy = pr.top + pr.height / 2 - (br.top + br.height / 2);
  const anims = [
    card.animate({ clipPath: open ? [pill, full] : [full, pill] }, { duration: open ? 560 : 420, easing: SC_MORPH, delay: open ? 0 : 90, fill: 'both' }),
    bar.animate({ transform: open ? [`translate(${dx}px, ${dy}px)`, 'none'] : ['none', `translate(${dx}px, ${dy}px)`] }, { duration: open ? 560 : 420, easing: SC_MORPH, delay: open ? 0 : 90, fill: 'both' }),
    body.animate(open ? { opacity: [0, 1], transform: ['translateY(-6px)', 'none'] } : { opacity: [1, 0], transform: ['none', 'translateY(-4px)'] }, open ? { duration: 400, delay: 140, easing: SC_EASE, fill: 'backwards' } : { duration: 140, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }),
  ];
  const all = Promise.all(anims.map(a => a.finished)).catch(() => {});
  if (open) all.then(() => anims.forEach(a => a.cancel()));   // sin recorte al terminar: la sombra y el foco se ven enteros
  return all;
}
function closeSearch(after) {
  if (!searchOpen() || SC.closing) return;
  SC.closing = true;
  const s = SC;
  s.dlg.classList.add('closing');
  scMorph(false).then(() => {
    s.dlg.close(); s.dlg.classList.remove('closing'); s.closing = false;
    document.body.classList.remove('sc-open');
    if (after) after(); else if (s.ret && s.ret.isConnected) s.ret.focus();
  });
}
function scEsc() { if (SC.inp.value) { SC.inp.value = ''; scDraw(); } else closeSearch(); }

function scItems() {
  const ix = searchIndex(), v = norm(SC.inp.value), on = x => scOn.has(catOf(x));
  if (!v) {
    const rec = S.recent().map(id => ix.find(x => x.id === id)).filter(Boolean);
    if (rec.length) return { mode: 'recent', list: rec.filter(on) };
    return { mode: 'suggest', list: ix.filter(x => (x.ty === 'mod' || x.ty === 'page') && on(x)).slice(0, 10) };
  }
  return { mode: 'results', list: ix.filter(on).map(x => ({ x, s: x.nt.startsWith(v) ? 3 : x.nt.includes(v) ? 2 : x.nd.includes(v) ? 1 : 0 })).filter(r => r.s).sort((a, b) => b.s - a.s || a.x.title.length - b.x.title.length).slice(0, 30).map(r => r.x) };
}
function scDraw(stagger) {
  const { mode, list } = scItems();
  SC.mode = mode; SC.res = list; SC.idx = 0;
  $('#s-lab').textContent = mode === 'recent' ? L('Recientes', 'Recent') : mode === 'suggest' ? L('Sugerencias', 'Suggestions') : L(`${list.length} ${list.length === 1 ? 'resultado' : 'resultados'}`, `${list.length} ${list.length === 1 ? 'result' : 'results'}`);
  const act = $('[data-act]', SC.dlg);
  act.innerHTML = mode === 'recent' ? `<button type="button" class="sc-act" data-sclear>${L('Borrar todo', 'Clear all')}</button>` : mode === 'suggest' && scCleared ? `<button type="button" class="sc-act" data-srestore>${ic('restore', 'sm')}${L('Restaurar', 'Restore')}</button>` : '';
  const c = $('[data-sclear]', act), r = $('[data-srestore]', act);
  if (c) c.onclick = () => { scCleared = S.recent(); S.setRecent([]); scDraw(); SC.inp.focus(); };
  if (r) r.onclick = () => { S.setRecent(scCleared); scCleared = null; scOn = new Set(SC_CATS.map(x => x[0])); scChips(); scDraw(); SC.inp.focus(); };
  const empty = !scOn.size ? L('No hay categorías activas. Pulsa «Categorías» para recuperarlas.', 'No categories selected. Press “Categories” to bring them back.')
    : mode === 'results' ? L(`Nada para «${SC.inp.value.trim()}». Prueba con «syn», «cookie» o «dns».`, `Nothing for “${SC.inp.value.trim()}”. Try “syn”, “cookie” or “dns”.`)
    : L('Ninguno de tus recientes está en las categorías activas.', 'None of your recent searches is in the selected categories.');
  SC.list.innerHTML = list.length ? list.map((x, i) => `<li role="option" id="s-o${i}" class="sc-row" aria-selected="${i === 0}" data-i="${i}"><span class="sc-tile t-${catOf(x)}" aria-hidden="true">${ic(x.i)}</span><span class="sc-t"><span class="sc-title${x.mono ? ' mono' : ''}">${esc(x.title.length > 110 ? x.title.slice(0, 108) + '…' : x.title)}</span>${x.d ? `<small>${esc(x.d.length > 100 ? x.d.slice(0, 98) + '…' : x.d)}</small>` : ''}</span><span class="sc-k">${x.k}</span>${mode === 'recent' ? `<span class="sc-rm" data-rm="${i}" aria-hidden="true">${ic('trash', 'sm')}<span class="sc-tip">${L('Quitar', 'Remove')}</span></span>` : ''}</li>`).join('')
    : `<li class="sc-empty" role="option" aria-disabled="true" aria-selected="false">${esc(empty)}</li>`;
  SC.inp.setAttribute('aria-activedescendant', list.length ? 's-o0' : '');
  SC.sheetShown = false;
  scMark(false);
  if (stagger && !REDUCED.matches) $$('.sc-row', SC.list).forEach((li, i) => li.animate({ opacity: [0, 1], transform: ['translateY(8px)', 'none'] }, { duration: 360, delay: 100 + i * 45, easing: SC_EASE, fill: 'backwards' }));
}
/* La lámina se desliza bajo la fila activa; la primera vez aparece en su sitio, sin deslizarse */
function scMark(scroll = true) {
  $$('[role=option][data-i]', SC.list).forEach((li, i) => li.setAttribute('aria-selected', String(i === SC.idx)));
  const el = $(`#s-o${SC.idx}`), sh = SC.sheet;
  if (!el) { sh.style.opacity = '0'; SC.sheetShown = false; return; }
  SC.inp.setAttribute('aria-activedescendant', el.id);
  if (scroll) el.scrollIntoView({ block: 'nearest' });
  if (!SC.sheetShown || REDUCED.matches) { sh.style.transition = 'none'; requestAnimationFrame(() => { sh.style.transition = ''; }); }
  sh.style.transform = `translateY(${el.offsetTop - SC.list.scrollTop}px)`; sh.style.height = `${el.offsetHeight}px`; sh.style.opacity = '1';
  SC.sheetShown = true;
}
function scKeys(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); SC.idx = Math.min(SC.res.length - 1, SC.idx + 1); scMark(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); SC.idx = Math.max(0, SC.idx - 1); scMark(); }
  else if (e.key === 'Enter') { e.preventDefault(); scGo(SC.idx); }
  else if (e.key === 'Delete' && SC.mode === 'recent' && SC.res.length) { e.preventDefault(); scRemove(SC.idx); }
}
function scGo(i) {
  const x = SC.res[i]; if (!x) return;
  S.addRecent(x.id);
  closeSearch(() => { if (x.act) x.act(); else if (location.hash === x.go) route(); else location.hash = x.go; });
}
/* Quitar un reciente: la fila se pliega y la lista se recoloca */
function scRemove(i) {
  const x = SC.res[i], li = $(`#s-o${i}`); if (!x || !li) return;
  S.removeRecent(x.id);
  const done = () => { const keep = Math.min(i, SC.res.length - 2); scDraw(); SC.idx = Math.max(0, keep); scMark(); SC.inp.focus(); };
  if (REDUCED.matches) return done();
  SC.sheet.style.opacity = '0';
  li.animate({ height: [`${li.offsetHeight}px`, '0px'], opacity: [1, 0], paddingBlock: ['8px', '0px'] }, { duration: 260, easing: SC_INOUT, fill: 'forwards' }).finished.then(done, done);
}

/* Fichas: la primera cuenta las categorías activas y las recupera todas; cada una se quita con su ✕ */
function scChips() {
  const box = $('[data-chips]', SC.dlg), n = scOn.size, total = SC_CATS.length;
  box.innerHTML = `<button type="button" class="sc-chip lead" data-call aria-label="${esc(L(`Categorías: ${n} de ${total} activas. Recuperarlas todas`, `Categories: ${n} of ${total} selected. Restore them all`))}"><span class="sc-count" aria-hidden="true"><span>${n}</span></span>${L('Categorías', 'Categories')}</button>` +
    SC_CATS.filter(c => scOn.has(c[0])).map(([c]) => `<span class="sc-chip c-${c}" data-c="${c}"><button type="button" class="sc-cx" data-cx="${c}" aria-label="${esc(L(`Quitar ${catName(c)}`, `Remove ${catName(c)}`))}">${ic('x', 'sm')}</button>${esc(catName(c))}</span>`).join('');
  $('[data-call]', box).onclick = () => { if (scOn.size === total) return; const from = scOn.size; scOn = new Set(SC_CATS.map(x => x[0])); scChips(); scRoll(from, total); scDraw(); };
  $$('[data-cx]', box).forEach(b => b.onclick = () => {
    const c = b.dataset.cx, chip = b.parentElement, from = scOn.size;
    const next = () => { scOn.delete(c); scChips(); scRoll(from, scOn.size); scDraw(); const f = $('[data-cx]', box) || $('[data-call]', box); f.focus(); };
    if (REDUCED.matches) return next();
    chip.animate({ opacity: [1, 0], transform: ['scale(1)', 'scale(0.8)'] }, { duration: 180, easing: SC_EASE, fill: 'forwards' }).finished.then(next, next);
  });
}
/* El contador rueda: el número viejo sale hacia arriba y el nuevo entra desde abajo */
function scRoll(from, to) {
  const box = $('.sc-count', SC.dlg); if (!box || from === to || REDUCED.matches) return;
  const now = box.firstElementChild, old = document.createElement('span');
  old.textContent = from; old.className = 'old'; box.append(old);
  const up = to < from ? 1 : -1;
  old.animate({ transform: ['none', `translateY(${-12 * up}px)`], opacity: [1, 0] }, { duration: 320, easing: SC_INOUT, fill: 'forwards' }).finished.then(() => old.remove(), () => old.remove());
  now.animate({ transform: [`translateY(${12 * up}px)`, 'none'], opacity: [0, 1] }, { duration: 320, easing: SC_INOUT });
}
addEventListener('resize', () => { if (searchOpen() && !SC.closing) scPlace(); });
