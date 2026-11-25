/* Megalodon · vistas: inicio (con el hueco del tiburón), módulos, laboratorio libre, chuleta y glosario. */
let CUR_WS = null;
const CAP_CACHE = {};
const capPkts = k => CAP_CACHE[k] || (CAP_CACHE[k] = dissectAll(SCENARIOS[k]()).pkts);
const capName = k => `${SCENARIO_FILES[k] || k}.pcapng`;
const TASK_TYPES = { filter: ['Filtro', 'filter'], packet: ['Paquete', 'target'], text: ['Respuesta', 'terminal'], choice: ['Test', 'list'] };
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const plain = s => String(s).replace(/[`*]/g, '');
const isNarrow = () => matchMedia('(max-width: 1023px)').matches;

/* ---------- Inicio ---------- */
function viewHome(main) {
  const xp = S.xp(), lv = S.level(), solved = Object.keys(S.get().done).length, total = MODULES.reduce((s, m) => s + m.tasks.length, 0), badges = Object.keys(S.get().badges).length;
  const next = MODULES.find(m => !m.extra && modProgress(m).done < m.tasks.length) || MODULES[0];
  const started = solved > 0;
  main.innerHTML = `
  <section class="hero" aria-labelledby="hero-t">
    <div class="hero-art" id="hero-slot">
      <picture><source type="image/avif" srcset="${HERO_IMG.avif}"><img class="hero-img" src="${HERO_IMG.webp}" width="${HERO_IMG.w}" height="${HERO_IMG.h}" alt="Megalodón dibujado como un plano técnico azul" decoding="async" fetchpriority="high"></picture>
    </div>
    <div class="hero-copy">
      <p class="eyebrow">Laboratorio de Wireshark · eWPT</p>
      <h1 id="hero-t">Megalodon</h1>
      <p class="lead">Aprende a leer la red como un pentester: capturas de un ataque real en miniatura, filtros que se validan mientras escribes y retos guiados desde el saludo TCP hasta la inyección SQL.</p>
      <div class="row cta">
        <a class="btn primary lg" href="#/m/${next.id}">${ic('play')}${started ? `${t('continue')}: módulo ${next.n}` : 'Empezar por el módulo 1'}</a>
        <a class="btn ghost lg" href="#/lab">${ic('flask')}Laboratorio libre</a>
      </div>
    </div>
  </section>
  <section class="wrap stats3" aria-label="${t('progress')}">
    <div class="stat card"><span class="stat-ic ok">${ic('trophy')}</span><div><p class="stat-v"><span class="num">${xp}</span> XP</p><p class="stat-l">${t('level')}: <strong>${lv.name}</strong>${lv.next ? ` · ${lv.next - xp} XP para el siguiente` : ''}</p>${lv.next ? `<div class="meter" role="progressbar" aria-label="Progreso de nivel" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(100 * (xp - lv.min) / (lv.next - lv.min))}"><i data-w="${100 * (xp - lv.min) / (lv.next - lv.min)}"></i></div>` : ''}</div></div>
    <div class="stat card"><span class="stat-ic">${ic('target')}</span><div><p class="stat-v"><span class="num">${solved}</span> / ${total}</p><p class="stat-l">retos resueltos</p></div></div>
    <div class="stat card"><span class="stat-ic">${ic('award')}</span><div><p class="stat-v"><span class="num">${badges}</span> / ${MODULES.length}</p><p class="stat-l">insignias</p></div></div>
  </section>
  <section class="wrap" aria-labelledby="mods-t">
    <div class="sec-h"><h2 id="mods-t">Módulos</h2><p class="muted">Del primer SYN a los ataques web. Cada módulo trae su captura, una lección corta y retos con pistas.</p></div>
    <div class="mgrid">${MODULES.filter(m => !m.extra).map(modCard).join('')}</div>
    <div class="sec-h sub"><h3>${t('extra')}: SOC, DFIR y Directorio Activo</h3><p class="muted">Para cuando termines los seis primeros.</p></div>
    <div class="mgrid">${MODULES.filter(m => m.extra).map(modCard).join('')}</div>
  </section>
  <section class="wrap how" aria-labelledby="how-t">
    <h2 id="how-t">Cómo funciona</h2>
    <ol class="steps3">
      <li class="card"><span class="stepn">1</span><h3>Lee y prueba</h3><p>Cada lección es corta y trae botones «Pruébalo» que aplican el filtro en la captura.</p></li>
      <li class="card"><span class="stepn">2</span><h3>Resuelve</h3><p>Escribe filtros, selecciona paquetes o responde. Se comprueba contra la captura al instante.</p></li>
      <li class="card"><span class="stepn">3</span><h3>Llévatelo</h3><p>Exporta cada captura en .pcapng y repite el reto en tu Wireshark de verdad.</p></li>
    </ol>
  </section>
  ${siteFooter()}`;
  $$('.meter i', main).forEach(i => { i.style.width = `${Math.max(2, Math.min(100, +i.dataset.w))}%`; });
  $('.hero', main).style.setProperty('--hero-bg', HERO_IMG.bg);
}
function modCard(m) {
  const p = modProgress(m), earned = S.get().badges[m.id];
  return `<a class="mcard card" href="#/m/${m.id}">
    <div class="row between"><span class="mic">${ic(m.icon)}</span>${earned ? `<span class="pill ok">${ic('award', 'sm')}${esc(m.badge)}</span>` : `<span class="pill">${m.mins} ${t('minutes')}</span>`}</div>
    <p class="eyebrow">Módulo ${m.n}</p><h3>${esc(m.title)}</h3><p class="muted sm">${esc(m.sub)}</p>
    <div class="mfoot"><div class="meter ${p.done === p.total ? 'full' : ''}" role="progressbar" aria-label="Retos de ${esc(m.title)}" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.done}"><i></i></div><span class="sm ${p.done === p.total ? 'okt' : 'muted'}">${p.done}/${p.total}</span></div>
  </a>`;
}
function siteFooter() {
  return `<footer class="foot wrap"><p>Megalodon · laboratorio de Wireshark sin conexión. Contenido basado en la <a href="https://www.wireshark.org/docs/" target="_blank" rel="noopener noreferrer">documentación pública de Wireshark</a>; las capturas son sintéticas y los dominios, de prueba.</p><p>Yoandy Ramírez Delgado · Huelva, España</p></footer>`;
}
function viewModules(main) {
  main.innerHTML = `<div class="wrap page"><div class="sec-h"><p class="eyebrow">${t('modules')}</p><h1>Ruta de aprendizaje</h1><p class="muted">Seis módulos principales para el eWPT y dos extra de SOC y Directorio Activo.</p></div>
    <h2 class="vh">Módulos principales</h2><div class="mgrid">${MODULES.filter(m => !m.extra).map(modCard).join('')}</div>
    <div class="sec-h sub"><h2>${t('extra')}</h2></div><div class="mgrid">${MODULES.filter(m => m.extra).map(modCard).join('')}</div></div>${siteFooter()}`;
}

/* ---------- Módulo ---------- */
function viewModule(main, { id, q }) {
  const m = MODULES.find(x => x.id === id);
  if (!m) return viewNotFound(main);
  let tab = q.get('t') ? 'tasks' : 'lesson';
  const p = modProgress(m), nextM = MODULES[MODULES.indexOf(m) + 1];
  main.innerHTML = `<div class="mod">
    <header class="mod-h wrap-wide">
      <a class="back sm" href="#/modulos">${ic('chevL', 'sm')}${t('modules')}</a>
      <div class="mod-title"><span class="mic lg">${ic(m.icon)}</span><div><p class="eyebrow">Módulo ${m.n}${m.extra ? ` · ${t('extra')}` : ''} · ${m.mins} ${t('minutes')}</p><h1>${esc(m.title)}</h1></div></div>
      <div class="mod-prog"><div class="meter ${p.done === p.total ? 'full' : ''}" role="progressbar" aria-label="Retos resueltos" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.done}"><i></i></div><span class="sm" data-prog>${p.done}/${p.total} ${t('tasks').toLowerCase()}</span><span class="pill ${S.get().badges[m.id] ? 'ok' : ''}" data-badge>${ic('award', 'sm')}${esc(m.badge)}</span></div>
    </header>
    <div class="mod-grid wrap-wide">
      <div class="mod-side">
        <div class="seg" role="tablist" aria-label="Secciones del módulo">
          <button role="tab" id="tab-lesson" aria-controls="pan-lesson" data-tab="lesson">${ic('book', 'sm')}${t('lesson')}</button>
          <button role="tab" id="tab-tasks" aria-controls="pan-tasks" data-tab="tasks">${ic('target', 'sm')}${t('tasks')} <span class="num" data-tc>${p.done}/${p.total}</span></button>
          <button role="tab" id="tab-ws" aria-controls="pan-ws" data-tab="ws" class="only-narrow">${ic('rows', 'sm')}${t('wireshark')}</button>
        </div>
        <div id="pan-lesson" role="tabpanel" aria-labelledby="tab-lesson" class="pan lesson" tabindex="-1">
          ${t('lessonsInSpanish') ? `<p class="note sm">${ic('lang', 'sm')}${t('lessonsInSpanish')}</p>` : ''}
          <p class="intro">${md(m.intro)}</p>
          ${m.lessons.map((l, i) => `<section class="lcard card" id="l-${i}" aria-labelledby="lh-${i}"><h2 id="lh-${i}"><span class="ln">${i + 1}</span>${esc(l.h)}</h2>${l.p.map(x => `<p>${md(x)}</p>`).join('')}${l.ladder !== undefined ? `<div class="ladder-slot" data-stream="${l.ladder}"></div>` : ''}${l.try ? `<div class="tries"><p class="tries-h">${ic('play', 'sm')}${t('tryIt')}</p>${l.try.map(([f, d]) => `<button class="try" type="button" data-f="${esc(f)}"><code>${esc(f)}</code><span>${esc(d)}</span></button>`).join('')}</div>` : ''}</section>`).join('')}
          <button class="btn primary" data-go-tasks type="button">${ic('target')}Ir a los retos</button>
        </div>
        <div id="pan-tasks" role="tabpanel" aria-labelledby="tab-tasks" class="pan tasks" tabindex="-1">
          ${m.tasks.map((x, i) => taskCard(x, i)).join('')}
          <div class="mod-end card ${p.done === p.total ? '' : 'hide'}" data-end>${ic('award')}<div><h2>${t('moduleDone')}</h2><p>${t('badgeEarned')} <strong class="okt">${esc(m.badge)}</strong>.</p></div>${nextM ? `<a class="btn primary" href="#/m/${nextM.id}">${t('next')}${ic('arrowR')}</a>` : ''}</div>
        </div>
      </div>
      <div class="mod-ws" id="pan-ws" role="tabpanel" aria-labelledby="tab-ws"></div>
    </div>
  </div>`;
  const meter = $('.mod-prog .meter i', main);
  const sync = () => { const pr = modProgress(m); meter.style.width = `${Math.max(2, pr.pct)}%`; $('.mod-prog .meter', main).classList.toggle('full', pr.done === pr.total); $('[data-prog]', main).textContent = `${pr.done}/${pr.total} ${t('tasks').toLowerCase()}`; $('[data-tc]', main).textContent = `${pr.done}/${pr.total}`; };
  sync();
  let refreshFilterPreview = () => {}, refreshSelPreview = () => {};
  const ws = new Workspace($('#pan-ws', main), { raw: SCENARIOS[m.cap](), name: capName(m.cap), onFilter: () => refreshFilterPreview(), onSelect: () => refreshSelPreview() });
  CUR_WS = ws;
  const setTab = k => {
    if (k === 'ws' && !isNarrow()) k = 'lesson';
    tab = k;
    $$('.seg [role=tab]', main).forEach(b => { const on = b.dataset.tab === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $('#pan-lesson', main).hidden = k !== 'lesson'; $('#pan-tasks', main).hidden = k !== 'tasks';
    main.querySelector('.mod').dataset.tab = k;
    if (k === 'ws') ws.renderRows(true);
  };
  const seg = $('.seg', main);
  seg.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  seg.addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const vis = $$('[role=tab]', seg).filter(b => b.offsetParent), i = vis.findIndex(b => b.dataset.tab === tab), j = (i + (e.key === 'ArrowRight' ? 1 : -1) + vis.length) % vis.length;
    setTab(vis[j].dataset.tab); vis[j].focus();
  });
  setTab(tab);
  const showWs = () => { if (isNarrow()) setTab('ws'); };
  $$('.try', main).forEach(b => b.onclick = () => { ws.setFilter(b.dataset.f); showWs(); });
  $('[data-go-tasks]', main).onclick = () => { setTab('tasks'); $('#pan-tasks', main).focus(); window.scrollTo({ top: 0, behavior: REDUCED.matches ? 'auto' : 'smooth' }); };
  $$('.ladder-slot', main).forEach(sl => sl.append(ladderSVG(ws.pkts, +sl.dataset.stream, no => { ws.setFilter(`tcp.stream eq ${sl.dataset.stream}`); ws.select(no); showWs(); })));
  if (q.get('l')) { const el = $(`#l-${q.get('l')}`, main); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 30); }
  if (q.get('t')) { const el = $(`#task-${q.get('t')}`, main); if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 30); }

  /* retos */
  refreshFilterPreview = () => $$('[data-curf]', main).forEach(el => { el.innerHTML = ws.filterText ? `<code>${esc(ws.filterText)}</code> · ${ws.view.length} paquetes` : `<span class="muted">${t('none')}</span>`; });
  refreshSelPreview = () => { const p = ws.selected(); $$('[data-cursel]', main).forEach(el => { el.innerHTML = p ? `<strong>n.º ${p.no}</strong> · <span class="mono">${esc(p.info.slice(0, 64))}</span>` : `<span class="muted">${t('none')}</span>`; }); };
  refreshFilterPreview(); refreshSelPreview();
  const fb = (card, kind, html) => { const el = $('.task-fb', card); el.className = `task-fb ${kind}`; el.innerHTML = html; if (kind === 'bad') { card.classList.remove('nope'); void card.offsetWidth; card.classList.add('nope'); } };
  const succeed = (task, card) => {
    const xp = S.solve(task.id);
    card.dataset.state = 'done'; card.classList.add('just');
    fb(card, 'ok', `${ic('ok')}<span>${md(task.ok)}</span>`);
    $('.txp', card).innerHTML = `${ic('check', 'sm')}+${xp} XP`;
    $$('input, .task-act button', card).forEach(el => { el.disabled = true; });
    toast(`<strong>+${xp} XP</strong> · ${t('solved')}`, 'ok', 'sparkles');
    sync();
    if (modProgress(m).done === m.tasks.length && S.earnBadge(m.id)) {
      $('[data-end]', main).classList.remove('hide'); $('[data-badge]', main).classList.add('ok');
      setTimeout(() => celebrate(m, nextM), 500);
    }
  };
  $$('.task', main).forEach(card => {
    const task = m.tasks.find(x => x.id === card.dataset.id);
    const hintBtn = $('[data-hint]', card);
    const renderHints = () => {
      const n = S.hintsUsed(task.id);
      $('.task-hints', card).innerHTML = task.hints.slice(0, n).map((h, i) => `<p class="hint">${ic('hint', 'sm')}<span><strong>${t('hint')} ${i + 1}:</strong> ${md(h)}</span></p>`).join('');
      hintBtn.hidden = n >= task.hints.length || S.isDone(task.id);
      hintBtn.querySelector('span').textContent = `${t('hint')} ${n + 1}/${task.hints.length}`;
      if (!S.isDone(task.id)) $('.txp', card).textContent = `+${XP_BY_HINTS[Math.min(3, n)]} XP`;
    };
    hintBtn.onclick = () => { S.useHint(task.id); renderHints(); const last = $$('.hint', card).pop(); if (last) last.classList.add('new'); };
    renderHints();
    if (task.type === 'filter') $('[data-check]', card).onclick = () => {
      if (!ws.filterText) return fb(card, 'bad', `${ic('info')}<span>Escribe un filtro en la barra de Wireshark y pulsa ${t('apply')} (o Enter).</span>`);
      const mine = new Set(ws.view.map(p => p.no)), ref = new Set(applyFilter(ws.pkts, task.ref).map(p => p.no));
      const allow = task.mode === 'covers' ? new Set(applyFilter(ws.pkts, task.allow).map(p => p.no)) : ref;
      const missing = [...ref].filter(n => !mine.has(n)), extra = [...mine].filter(n => !allow.has(n));
      if (!missing.length && !extra.length) return succeed(task, card);
      const parts = [`Tu filtro muestra <strong>${mine.size}</strong> paquetes${task.mode === 'covers' ? '' : `; la solución, <strong>${ref.size}</strong>`}.`];
      if (missing.length) parts.push(`Te faltan ${missing.length}.`);
      if (extra.length) parts.push(`Te sobran ${extra.length} (por ejemplo, el n.º ${extra[0]}).`);
      fb(card, 'bad', `${ic('ko')}<span>${parts.join(' ')}</span>`);
    };
    if (task.type === 'packet') $('[data-check]', card).onclick = () => {
      const p = ws.selected();
      if (!p) return fb(card, 'bad', `${ic('info')}<span>Selecciona un paquete en la lista.</span>`);
      const r = parseFilter(task.match);
      if (r.test(p)) succeed(task, card); else fb(card, 'bad', `${ic('ko')}<span>El n.º ${p.no} no es el que buscamos. Fíjate en la columna Info.</span>`);
    };
    if (task.type === 'text') {
      const inp = $('input', card);
      const check = () => {
        const v = inp.value.trim();
        if (!v) return fb(card, 'bad', `${ic('info')}<span>Escribe tu respuesta.</span>`);
        const ok = task.ans.some(a => task.list ? v.split(/[\s,;]+/).filter(Boolean).map(Number).sort((x, y) => x - y).join(',') === a : task.exact ? v === a : norm(v) === norm(a));
        if (ok) succeed(task, card); else fb(card, 'bad', `${ic('ko')}<span>${task.exact && task.ans.some(a => norm(a) === norm(v)) ? 'Casi: revisa mayúsculas y símbolos, las contraseñas se copian exactas.' : 'No es eso. Vuelve a mirar la captura o pide una pista.'}</span>`);
      };
      $('[data-check]', card).onclick = check;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    }
    if (task.type === 'choice') $$('[data-opt]', card).forEach(b => b.onclick = () => {
      if (+b.dataset.opt === task.ans) { b.classList.add('right'); b.setAttribute('aria-checked', 'true'); succeed(task, card); }
      else { b.classList.add('wrong'); b.disabled = true; fb(card, 'bad', `${ic('ko')}<span>No es esa. Descártala y prueba otra.</span>`); }
    });
    if (S.isDone(task.id)) { $$('input, .task-act button', card).forEach(el => { el.disabled = true; }); if (task.type === 'choice') { const r = $(`[data-opt="${task.ans}"]`, card); r.classList.add('right'); r.setAttribute('aria-checked', 'true'); } }
  });
  const onResize = () => { if (!isNarrow() && tab === 'ws') setTab('lesson'); };
  addEventListener('resize', onResize);
  return () => { removeEventListener('resize', onResize); ws.destroy(); CUR_WS = null; };
}
function taskCard(x, i) {
  const done = S.isDone(x.id), [tl, ti] = TASK_TYPES[x.type];
  const act = x.type === 'filter' ? `<p class="sm">${t('yourFilter')}: <span data-curf></span></p><button class="btn sm primary" data-check type="button">${ic('check', 'sm')}${t('check')}</button>`
    : x.type === 'packet' ? `<p class="sm">${t('selected')}: <span data-cursel></span></p><button class="btn sm primary" data-check type="button">${ic('check', 'sm')}${t('check')}</button>`
      : x.type === 'text' ? `<div class="ans"><label class="vh" for="a-${x.id}">${t('answer')}</label><input id="a-${x.id}" class="tinput mono" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t('answer')}…"><button class="btn sm primary" data-check type="button">${ic('check', 'sm')}${t('check')}</button></div>`
        : `<div class="opts" role="radiogroup" aria-labelledby="q-${x.id}">${x.opts.map((o, j) => `<button class="opt" type="button" role="radio" aria-checked="false" data-opt="${j}"><span class="ob" aria-hidden="true"></span>${esc(o)}</button>`).join('')}</div>`;
  const xp = done ? S.get().done[x.id].xp : XP_BY_HINTS[Math.min(3, S.hintsUsed(x.id))];
  return `<article class="task card" id="task-${x.id}" data-id="${x.id}" data-state="${done ? 'done' : 'todo'}" aria-labelledby="q-${x.id}">
    <div class="task-h"><span class="tnum" aria-hidden="true"><span class="tn-n">${i + 1}</span><span class="tn-ok">${ic('check', 'sm')}</span></span><span class="ttype">${ic(ti, 'sm')}${tl}</span><span class="txp">${done ? `${ic('check', 'sm')}+${xp} XP` : `+${xp} XP`}</span></div>
    <p class="tq" id="q-${x.id}"><span class="vh">Reto ${i + 1}${done ? ', resuelto' : ''}: </span>${md(x.q)}</p>
    <div class="task-act">${act}</div>
    <div class="task-fb ${done ? 'ok' : ''}" aria-live="polite">${done ? `${ic('ok')}<span>${md(x.ok)}</span>` : ''}</div>
    <div class="task-hints"></div>
    <div class="task-foot"><button class="btn sm ghost" data-hint type="button">${ic('hint', 'sm')}<span>${t('hint')}</span></button></div>
  </article>`;
}
function celebrate(m, nextM) {
  const d = openDialog({ title: t('moduleDone'), cls: 'narrow celebrate', body: `<div class="badge-big" aria-hidden="true">${ic('award')}</div><p class="center">${t('badgeEarned')}</p><p class="center badge-name">${esc(m.badge)}</p><p class="center muted sm">+${BONUS_MODULE} XP de bonus · ${S.xp()} XP en total · ${t('level')}: ${S.level().name}</p>`,
    footer: `<button class="btn ghost" data-close>${t('close')}</button>${nextM ? `<a class="btn primary" href="#/m/${nextM.id}" data-next>${t('next')}${ic('arrowR')}</a>` : ''}` });
  $('[data-close]', d).onclick = () => closeDialog();
  const n = $('[data-next]', d); if (n) n.onclick = () => closeDialog(true);
}

/* ---------- Laboratorio libre ---------- */
function viewLab(main, { q }) {
  let cap = q.get('cap') && SCENARIOS[q.get('cap')] ? q.get('cap') : 'm1';
  const f = q.get('f') || '';
  if (f && !q.get('cap')) { const r = parseFilter(f); if (r.ok) cap = Object.keys(SCENARIOS).find(k => capPkts(k).some(r.test)) || cap; }
  main.innerHTML = `<div class="lab">
    <div class="lab-h wrap-wide"><div><p class="eyebrow">${t('lab')}</p><h1>Laboratorio libre</h1></div>
      <div class="row"><label class="sm" for="lab-cap">${t('captures')}</label><select id="lab-cap" class="sel">${MODULES.map(m => `<option value="${m.cap}" ${m.cap === cap ? 'selected' : ''}>${m.n}. ${esc(m.title)} (${capName(m.cap)})</option>`).join('')}<option value="__own" hidden>Tu captura</option></select></div>
    </div>
    <div class="lab-ws wrap-wide"></div>
  </div>`;
  const sel = $('#lab-cap', main);
  const ws = new Workspace($('.lab-ws', main), { raw: SCENARIOS[cap](), name: capName(cap), filter: f, allowImport: true, onImport: name => { const o = sel.querySelector('[value=__own]'); o.hidden = false; o.textContent = `Tu captura: ${name}`; sel.value = '__own'; } });
  CUR_WS = ws;
  sel.onchange = () => { if (sel.value !== '__own') { ws.load(SCENARIOS[sel.value](), capName(sel.value)); history.replaceState(null, '', `#/lab?cap=${sel.value}`); } };
  return () => { ws.destroy(); CUR_WS = null; };
}

/* ---------- Chuleta ---------- */
function viewCheat(main) {
  main.innerHTML = `<div class="wrap page"><div class="sec-h"><p class="eyebrow">${t('cheat')}</p><h1>Chuleta de filtros</h1><p class="muted">Los filtros de visualización que más vas a usar. Cópialos o pruébalos directamente en el laboratorio.</p></div>
    <div class="cgrid">${CHEATS.map(g => `<section class="card cs" aria-labelledby="cs-${esc(norm(g.h).replace(/\W+/g, '-'))}"><h2 id="cs-${esc(norm(g.h).replace(/\W+/g, '-'))}">${esc(g.h)}</h2><ul>${g.items.map(([f, d]) => {
      const real = !/\s{3}| vs /.test(f);
      return `<li><div class="cs-f"><code>${esc(f)}</code><p>${esc(d)}</p></div><div class="cs-a">${real ? `<button class="ibtn sm" type="button" data-copy="${esc(f)}" aria-label="${t('copy')}: ${esc(f)}">${ic('copy')}</button><a class="ibtn sm" href="#/lab?f=${encodeURIComponent(f)}" aria-label="Probar en el laboratorio: ${esc(f)}">${ic('play')}</a>` : ''}</div></li>`;
    }).join('')}</ul></section>`).join('')}</div>
    <section class="card cs fields"><h2>Todos los campos del laboratorio</h2><p class="muted sm">Escribe cualquiera en la barra de filtros: el autocompletado los conoce todos.</p>
      <div class="tbl-wrap" tabindex="0" role="region" aria-label="Campos de filtro"><table class="tbl"><caption class="vh">Campos de filtro</caption><thead><tr><th scope="col">Campo</th><th scope="col">Tipo</th><th scope="col">Qué es</th></tr></thead><tbody>${FIELD_DEFS.map(([n, ty, d]) => `<tr><td><code>${n}</code></td><td class="sm muted">${({ p: 'protocolo', u: 'número', b: 'booleano', s: 'texto', ip: 'IPv4', mac: 'MAC', f: 'decimal' })[ty]}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table></div></section>
  </div>${siteFooter()}`;
  $$('[data-copy]', main).forEach(b => b.onclick = () => copyText(b.dataset.copy, b));
}

/* ---------- Glosario ---------- */
function viewGlossary(main, { q }) {
  main.innerHTML = `<div class="wrap page"><div class="sec-h"><p class="eyebrow">${t('glossary')}</p><h1>Glosario</h1><p class="muted">${GLOSSARY.length} términos de redes y pentesting explicados sin rodeos.</p></div>
    <div class="gsearch"><span aria-hidden="true">${ic('search')}</span><label class="vh" for="g-q">Buscar en el glosario</label><input id="g-q" type="search" class="tinput" placeholder="Filtra términos…" autocomplete="off"></div>
    <p class="sm muted" id="g-n" aria-live="polite"></p>
    <dl class="gl">${GLOSSARY.map(([term, d]) => `<div class="card gi" id="g-${esc(norm(term).replace(/\W+/g, '-'))}"><dt>${esc(term)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl></div>${siteFooter()}`;
  const inp = $('#g-q', main), items = $$('.gi', main);
  const run = () => { const v = norm(inp.value); let n = 0; items.forEach((el, i) => { const hit = !v || norm(GLOSSARY[i][0] + ' ' + GLOSSARY[i][1]).includes(v); el.hidden = !hit; n += hit; }); $('#g-n', main).textContent = v ? `${n} de ${GLOSSARY.length} términos` : ''; };
  inp.addEventListener('input', run);
  if (q.get('q')) { inp.value = q.get('q'); run(); const first = items.find(x => !x.hidden); if (first) first.classList.add('flash'); }
}
function viewNotFound(main) { main.innerHTML = `<div class="wrap page"><h1>404</h1><p>${t('notFound')}</p><a class="btn primary" href="#/">${t('home')}</a></div>`; }
