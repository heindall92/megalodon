/* Megalodon · diálogos del espacio de trabajo: Seguir flujo (TCP y UDP), Estadísticas (conversaciones, endpoints, jerarquía, E/S),
   Información experta, Exportar objetos HTTP, Credenciales, Buscar e Ir al paquete. */
function openFollow(ws, stream, kind = 'tcp') {
  const udp = kind === 'udp', sid = p => udp ? (p.f['udp.stream'] ? p.f['udp.stream'][0] : undefined) : p.tcpStream;
  const streams = [...new Set(ws.pkts.map(sid).filter(x => x !== undefined))].sort((a, b) => a - b);
  let cur = stream;
  const body = document.createElement('div');
  const render = () => {
    const fs = udp ? followUdp(ws.pkts, cur) : followTcp(ws.pkts, cur);
    const idx = streams.indexOf(cur);
    body.innerHTML = `<div class="fs-head">
        <div class="fs-ends"><span class="who cli">${ic('arrowR', 'sm')}${t('client')} <code>${esc(fs.client)}</code></span><span class="who srv">${ic('arrowL', 'sm')}${t('server')} <code>${esc(fs.server)}</code></span></div>
        <div class="row"><button class="ibtn" data-prev ${idx <= 0 ? 'disabled' : ''} aria-label="${t('prevStream')}">${ic('chevL')}</button><span class="mono sm">${kind}.stream eq ${cur}</span><button class="ibtn" data-next ${idx >= streams.length - 1 ? 'disabled' : ''} aria-label="${t('nextStream')}">${ic('chevR')}</button></div>
      </div>
      <div class="fs-body mono" tabindex="0" aria-label="Contenido del flujo">${fs.chunks.length ? fs.chunks.map(c => `<pre class="${c.client ? 'cli' : 'srv'}"><span class="vh">${c.client ? t('client') : t('server')}: </span>${esc(c.text)}</pre>`).join('') : `<p class="muted">${udp ? 'Este flujo UDP no lleva datos.' : 'Este flujo no lleva datos: solo saludo y cierre (o un RST).'}</p>`}</div>
      <p class="sm muted fs-sum">${t('client')} → ${t('server')}: <strong>${fmtNum(fs.cBytes)}</strong> bytes · ${t('server')} → ${t('client')}: <strong>${fmtNum(fs.sBytes)}</strong> bytes · ${fs.chunks.length} bloques</p>`;
    $('[data-prev]', body).onclick = () => { cur = streams[idx - 1]; render(); };
    $('[data-next]', body).onclick = () => { cur = streams[idx + 1]; render(); };
  };
  render();
  const d = openDialog({ title: `${ic('follow')} ${udp ? t('followUdp') : t('follow')}`, body, wide: true, footer: `<button class="btn ghost" data-close>${t('close')}</button><button class="btn primary" data-filt>${ic('filter')}${t('filterStream')}</button>` });
  $('[data-close]', d).onclick = () => closeDialog();
  $('[data-filt]', d).onclick = () => { ws.setFilter(`${kind}.stream eq ${cur}`); closeDialog(); };
}

function openStats(ws, tab = 'conv') {
  const body = document.createElement('div');
  const tabs = [['conv', t('conv'), 'swap'], ['ends', t('endpoints'), 'network'], ['hier', t('hier'), 'layers'], ['io', t('io'), 'activity']];
  body.innerHTML = `<div class="seg" role="tablist" aria-label="${t('stats')}">${tabs.map(([k, l, i]) => `<button role="tab" id="st-${k}" aria-controls="st-p" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${ic(i, 'sm')}${l}</button>`).join('')}</div><div id="st-p" role="tabpanel" class="st-p" tabindex="0"></div>`;
  const panel = $('#st-p', body);
  const show = k => {
    tab = k;
    $$('[role=tab]', body).forEach(b => { const on = b.dataset.tab === k; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    panel.setAttribute('aria-labelledby', `st-${k}`);
    if (k === 'conv') convPanel(ws, panel); else if (k === 'ends') endsPanel(ws, panel); else if (k === 'hier') hierPanel(ws, panel); else ioPanel(ws, panel);
  };
  $('.seg', body).addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
  $('.seg', body).addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const i = tabs.findIndex(x => x[0] === tab), j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    show(tabs[j][0]); $(`#st-${tabs[j][0]}`, body).focus();
  });
  openDialog({ title: `${ic('stats')} ${t('stats')}`, body, wide: true });
  show(tab);
}

function convPanel(ws, panel) {
  const c = conversations(ws.pkts);
  const kinds = [['tcp', 'TCP'], ['udp', 'UDP'], ['ip', 'IPv4'], ['eth', 'Ethernet']];
  let k = 'tcp';
  const draw = () => {
    const rows = c[k], ports = k === 'tcp' || k === 'udp';
    const fl = r => k === 'tcp' ? `tcp.stream eq ${r.stream}` : k === 'udp' ? `udp.stream eq ${r.stream}` : k === 'ip' ? `ip.addr == ${r.a} && ip.addr == ${r.b}` : `eth.addr == ${r.a} && eth.addr == ${r.b}`;
    panel.innerHTML = `<div class="chips" role="group" aria-label="Tipo de conversación">${kinds.map(([x, l]) => `<button class="chip ${x === k ? 'on' : ''}" aria-pressed="${x === k}" data-k="${x}">${l} <span class="num">${c[x].length}</span></button>`).join('')}</div>
      <div class="tbl-wrap" tabindex="0" role="region" aria-label="${t('stats')}"><table class="tbl"><caption class="vh">Conversaciones ${k}</caption><thead><tr><th scope="col">${k === 'eth' ? 'Dirección A' : 'IP A'}</th>${ports ? '<th scope="col" class="n">Puerto A</th>' : ''}<th scope="col">${k === 'eth' ? 'Dirección B' : 'IP B'}</th>${ports ? '<th scope="col" class="n">Puerto B</th>' : ''}<th scope="col" class="n">Paquetes</th><th scope="col" class="n">Bytes</th><th scope="col" class="n">A → B</th><th scope="col" class="n">B → A</th><th scope="col" class="n">Inicio</th><th scope="col" class="n">Duración</th><th scope="col"><span class="vh">Acción</span></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr><td class="mono">${esc(r.a)}</td>${ports ? `<td class="n mono">${r.pa}</td>` : ''}<td class="mono">${esc(r.b)}</td>${ports ? `<td class="n mono">${r.pb}</td>` : ''}<td class="n">${r.pkts}</td><td class="n">${fmtNum(r.bytes)}</td><td class="n">${r.ab}</td><td class="n">${r.ba}</td><td class="n mono">${r.start.toFixed(3)}</td><td class="n mono">${r.dur.toFixed(3)}</td><td><button class="ibtn sm" data-f="${esc(fl(r))}" aria-label="${t('filterThis')}: ${esc(fl(r))}" title="${t('filterThis')}">${ic('filter', 'sm')}</button></td></tr>`).join('')}</tbody></table></div>
      <p class="sm muted">Pista: en un escaneo verás muchas conversaciones TCP de 2 o 3 paquetes desde el mismo origen.</p>`;
    $$('[data-k]', panel).forEach(b => b.onclick = () => { k = b.dataset.k; draw(); });
    $$('[data-f]', panel).forEach(b => b.onclick = () => { ws.setFilter(b.dataset.f); closeDialog(); });
  };
  draw();
}

function hierPanel(ws, panel) {
  const h = protocolHierarchy(ws.pkts), rows = [];
  const walk = n => { rows.push(n); n.kids.forEach(walk); };
  walk(h);
  panel.innerHTML = `<div class="tbl-wrap" tabindex="0" role="region" aria-label="${t('stats')}"><table class="tbl hier"><caption class="vh">${t('hier')}</caption><thead><tr><th scope="col">Protocolo</th><th scope="col" class="n">% paquetes</th><th scope="col" class="bar-col"><span class="vh">Barra</span></th><th scope="col" class="n">Paquetes</th><th scope="col" class="n">Bytes</th><th scope="col"><span class="vh">Acción</span></th></tr></thead>
    <tbody>${rows.map(r => { const name = r.name === 'frame' ? 'Frame' : r.name; const f = r.name === 'frame' ? '' : r.name; return `<tr><td><span class="ind" data-d="${Math.min(r.depth, 8)}">${esc(name)}</span></td><td class="n">${r.pct.toFixed(1)} %</td><td class="bar-col"><span class="bar" data-w="${r.pct}"></span></td><td class="n">${r.pkts}</td><td class="n">${fmtNum(r.bytes)}</td><td>${f && FIELDS[f] ? `<button class="ibtn sm" data-f="${esc(f)}" aria-label="${t('filterThis')}: ${esc(f)}">${ic('filter', 'sm')}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
  $$('.bar', panel).forEach(b => { b.style.width = `${b.dataset.w}%`; });
  $$('.ind', panel).forEach(s => { s.style.paddingInlineStart = `${s.dataset.d * 16}px`; });
  $$('[data-f]', panel).forEach(b => b.onclick = () => { ws.setFilter(b.dataset.f); closeDialog(); });
}

function ioPanel(ws, panel) {
  const last = ws.pkts.length ? ws.pkts[ws.pkts.length - 1].rel : 0;
  const opts = [0.01, 0.1, 1, 10, 60].filter(x => last / x <= 400 && last / x >= 3);
  let iv = opts.includes(1) ? 1 : opts[0] || 1;
  const draw = () => {
    const test = ws.parsed && ws.parsed.ok && !ws.parsed.empty ? ws.parsed.test : null;
    const g = ioGraph(ws.pkts, iv, test), max = Math.max(1, ...g.buckets.map(b => b.all));
    const W = 720, H = 240, pl = 36, pb = 26, bw = (W - pl - 8) / g.buckets.length;
    const y = v => H - pb - (v / max) * (H - pb - 10);
    const ticks = [0, Math.ceil(max / 2), max];
    const xl = Math.max(1, Math.ceil(g.buckets.length / 8));
    panel.innerHTML = `<div class="row between"><div class="row sm"><span class="lgd all"><i></i>${t('allPackets')}</span>${test ? `<span class="lgd hit"><i></i>${t('matching')}: <code>${esc(ws.filterText)}</code></span>` : '<span class="muted">Aplica un filtro para compararlo con el total.</span>'}</div>
      <label class="row sm">${t('interval')} <select data-iv>${(opts.length ? opts : [iv]).map(o => `<option value="${o}" ${o === iv ? 'selected' : ''}>${o} s</option>`).join('')}</select></label></div>
      <svg class="io" viewBox="0 0 ${W} ${H}" role="img" aria-label="Paquetes por intervalo de ${iv} segundos: máximo ${max}">
        ${ticks.map(v => `<line class="gl" x1="${pl}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
        ${g.buckets.map((b, i) => `<rect class="b-all" x="${pl + i * bw + bw * 0.12}" y="${y(b.all)}" width="${Math.max(1, bw * 0.76)}" height="${H - pb - y(b.all)}" rx="${Math.min(3, bw / 4)}"><title>${b.t} s: ${b.all} paquetes${test ? `, ${b.hit} cumplen el filtro` : ''}</title></rect>${test && b.hit ? `<rect class="b-hit" x="${pl + i * bw + bw * 0.12}" y="${y(b.hit)}" width="${Math.max(1, bw * 0.76)}" height="${H - pb - y(b.hit)}" rx="${Math.min(3, bw / 4)}"/>` : ''}`).join('')}
        ${g.buckets.map((b, i) => i % xl === 0 ? `<text class="ax" x="${pl + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${+b.t.toFixed(2)}</text>` : '').join('')}
      </svg><p class="sm muted">Eje horizontal: segundos desde el primer paquete. Un pico que se repite a intervalos fijos puede ser un beacon.</p>`;
    $('[data-iv]', panel).onchange = e => { iv = +e.target.value; draw(); };
  };
  draw();
}


/* ---------- Endpoints (Estadísticas › Endpoints › IPv4) ---------- */
function endsPanel(ws, panel) {
  const rows = endpoints(ws.pkts);
  panel.innerHTML = `<div class="tbl-wrap" tabindex="0" role="region" aria-label="${t('endpoints')}"><table class="tbl"><caption class="vh">${t('endpoints')} IPv4</caption><thead><tr><th scope="col">Dirección</th><th scope="col" class="n">Paquetes</th><th scope="col" class="n">Bytes</th><th scope="col" class="n">Enviados</th><th scope="col" class="n">Recibidos</th><th scope="col"><span class="vh">Acción</span></th></tr></thead>
    <tbody>${rows.map(e => `<tr><td class="mono">${esc(e.addr)}</td><td class="n">${fmtNum(e.pkts)}</td><td class="n">${fmtNum(e.bytes)}</td><td class="n">${fmtNum(e.tx)}</td><td class="n">${fmtNum(e.rx)}</td><td><button class="btn sm ghost" type="button" data-f="ip.addr == ${esc(e.addr)}">${ic('filter', 'sm')}${t('filterThis')}</button></td></tr>`).join('')}</tbody></table></div>
    <p class="sm muted">Cada IP que aparece en la captura. Un equipo que solo recibe, o uno que habla con muchos, suele ser el primer hilo del que tirar.</p>`;
  $$('[data-f]', panel).forEach(b => b.onclick = () => { ws.setFilter(b.dataset.f); closeDialog(); });
}

/* ---------- Analizar › Información experta ---------- */
const SEV_LABEL = { error: 'Error', warn: 'Aviso', note: 'Nota', chat: 'Conversación' };
function openExpert(ws) {
  const ex = expertInfo(ws.pkts), body = document.createElement('div');
  body.innerHTML = `<p class="muted sm">Wireshark resume aquí lo que le llama la atención de cada paquete, de más grave a más rutinario. Los mensajes se muestran en inglés, como en Wireshark, para que los reconozcas.</p>
    <div class="ex-sum">${EXPERT_SEV.map(([k, en]) => `<span class="ex-chip sev-${k}"><strong>${fmtNum(ex.count[k])}</strong> ${SEV_LABEL[k]} <small>(${en})</small></span>`).join('')}</div>
    ${ex.items.length ? `<div class="tbl-wrap" tabindex="0" role="region" aria-label="${t('expert')}"><table class="tbl ex"><caption class="vh">${t('expert')}</caption><thead><tr><th scope="col">Severidad</th><th scope="col">Resumen</th><th scope="col">Protocolo</th><th scope="col" class="n">Cantidad</th><th scope="col">Paquetes</th></tr></thead>
    <tbody>${ex.items.map((it, i) => `<tr><td><span class="ex-chip sev-${it.sev}">${SEV_LABEL[it.sev]}</span></td><td class="mono">${esc(it.summary)}</td><td>${esc(it.proto)}</td><td class="n">${fmtNum(it.nos.length)}</td>
      <td><div class="ex-nos">${it.nos.slice(0, 8).map(n => `<button class="btn sm ghost mono" type="button" data-no="${n}" aria-label="Ir al paquete ${n}">${n}</button>`).join('')}${it.nos.length > 1 ? `<button class="btn sm ghost" type="button" data-show="${i}">${ic('filter', 'sm')}Mostrar</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">No hay entradas: esta captura no tiene TCP ni HTTP que comentar.</p>'}`;
  openDialog({ title: `${ic('alert')} ${t('expert')}`, body, wide: true });
  $$('[data-no]', body).forEach(b => b.onclick = () => { closeDialog(); ws.select(+b.dataset.no, { focusList: true }); });
  $$('[data-show]', body).forEach(b => b.onclick = () => { closeDialog(); ws.setFilter(`frame.number in {${ex.items[+b.dataset.show].nos.join(', ')}}`); });
}

/* ---------- Archivo › Exportar objetos › HTTP ---------- */
function openObjects(ws) {
  const objs = httpObjects(ws.pkts), body = document.createElement('div');
  const isText = o => /^(text\/|application\/(json|javascript|xml|x-www-form-urlencoded))/i.test(o.type);
  body.innerHTML = objs.length ? `<p class="muted sm">Los cuerpos HTTP reconstruidos de la captura: páginas, scripts, JSON, formularios y ficheros. Así se recupera lo que se descargó (o se robó) por HTTP sin cifrar.</p>
    <div class="tbl-wrap" tabindex="0" role="region" aria-label="${t('objects')}"><table class="tbl"><caption class="vh">${t('objects')}</caption><thead><tr><th scope="col" class="n">Paquete</th><th scope="col">Host</th><th scope="col">Tipo de contenido</th><th scope="col" class="n">Tamaño</th><th scope="col">Nombre</th><th scope="col"><span class="vh">Acciones</span></th></tr></thead>
    <tbody>${objs.map((o, i) => `<tr><td class="n"><button class="btn sm ghost mono" type="button" data-no="${o.no}" aria-label="Ir al paquete ${o.no}">${o.no}</button></td><td class="mono">${esc(o.host)}</td><td class="mono sm">${esc(o.type || '—')}</td><td class="n">${fmtNum(o.size)} B</td><td class="mono">${esc(o.name)}</td>
      <td><div class="row">${isText(o) ? `<button class="btn sm ghost" type="button" data-view="${i}" aria-label="Ver ${esc(o.name)}">${ic('eye', 'sm')}Ver</button>` : ''}<button class="btn sm ghost" type="button" data-save="${i}" aria-label="Guardar ${esc(o.name)}">${ic('download', 'sm')}Guardar</button></div></td></tr>`).join('')}</tbody></table></div>
    <div class="ob-prev" hidden><p class="sm"><strong data-pn></strong></p><pre class="mono" tabindex="0"></pre></div>`
    : '<p class="muted">Esta captura no lleva objetos HTTP. Prueba con los módulos 2, 3 o 6.</p>';
  openDialog({ title: `${ic('file')} ${t('objects')}`, body, wide: true });
  $$('[data-no]', body).forEach(b => b.onclick = () => { closeDialog(); ws.select(+b.dataset.no, { focusList: true }); });
  $$('[data-save]', body).forEach(b => b.onclick = () => { const o = objs[+b.dataset.save]; download(o.data, o.name, 'application/octet-stream'); toast(`Guardado: <code>${esc(o.name)}</code>`, 'ok', 'download'); });
  $$('[data-view]', body).forEach(b => b.onclick = () => {
    const o = objs[+b.dataset.view], pv = $('.ob-prev', body);
    pv.hidden = false; $('[data-pn]', pv).textContent = `${o.name} · paquete ${o.no}`;
    $('pre', pv).textContent = new TextDecoder().decode(o.data);                 // texto, nunca HTML interpretado
    $('pre', pv).focus();
  });
}

/* ---------- Herramientas › Credenciales ---------- */
function openCreds(ws) {
  const cr = credentials(ws.pkts), body = document.createElement('div');
  body.innerHTML = cr.length ? `<p class="muted sm">Usuarios que viajan por protocolos que Wireshark sabe leer (HTTP Basic, FTP, NTLMSSP). Pulsa el paquete para ir al campo exacto del árbol.</p>
    <div class="tbl-wrap" tabindex="0" role="region" aria-label="${t('creds')}"><table class="tbl"><caption class="vh">${t('creds')}</caption><thead><tr><th scope="col" class="n">Paquete</th><th scope="col">Protocolo</th><th scope="col">Usuario</th><th scope="col">Información</th></tr></thead>
    <tbody>${cr.map((c, i) => `<tr><td class="n"><button class="btn sm ghost mono" type="button" data-i="${i}" aria-label="Ir al paquete ${c.no}">${c.no}</button></td><td>${esc(c.proto)}</td><td class="mono">${esc(c.user)}</td><td class="sm">${esc(c.info)}</td></tr>`).join('')}</tbody></table></div>
    <p class="sm muted">Wireshark no muestra aquí los formularios POST: esos los buscas tú con <code>http.request.method == "POST"</code>.</p>`
    : '<p class="muted">No hay credenciales en esta captura. Las encontrarás en los módulos 3 (HTTP Basic y FTP) y 7 (NTLMSSP).</p>';
  openDialog({ title: `${ic('lock')} ${t('creds')}`, body, wide: true });
  $$('[data-i]', body).forEach(b => b.onclick = () => { const c = cr[+b.dataset.i]; closeDialog(); ws.revealField(c.no, c.field); });
}

/* ---------- Editar › Buscar paquete (Ctrl F) e Ir al paquete (Ctrl G) ---------- */
function openFind(ws, mode = 'find') {
  const body = document.createElement('div');
  body.innerHTML = `<div class="seg" role="tablist" aria-label="${t('findPkt')}"><button role="tab" id="fd-find" aria-selected="${mode === 'find'}" data-m="find">${ic('search', 'sm')}${t('findPkt')}</button><button role="tab" id="fd-goto" aria-selected="${mode === 'goto'}" data-m="goto">${ic('target', 'sm')}${t('gotoPkt')}</button></div>
    <form class="fd" data-p="find" ${mode === 'find' ? '' : 'hidden'} aria-labelledby="fd-find">
      <div class="row wrap"><label class="sm" for="fd-k">Buscar por</label><select id="fd-k" class="sel"><option value="filter">Filtro de visualización</option><option value="str">Cadena en los bytes</option><option value="hex">Valor hexadecimal</option></select>
      <label class="row sm"><input type="checkbox" id="fd-c"> Distinguir mayúsculas</label></div>
      <label class="vh" for="fd-q">Qué buscar</label><input id="fd-q" class="tinput mono" type="text" autocomplete="off" spellcheck="false" placeholder="p. ej. http.cookie, password o 50 4b 03 04">
      <div class="row"><button class="btn primary sm" type="submit">${ic('search', 'sm')}Buscar siguiente</button><span class="sm" data-msg aria-live="polite"></span></div>
    </form>
    <form class="fd" data-p="goto" ${mode === 'goto' ? '' : 'hidden'} aria-labelledby="fd-goto">
      <label class="sm" for="fd-n">Número de paquete (1 a ${fmtNum(ws.pkts.length)})</label><input id="fd-n" class="tinput mono" type="number" min="1" max="${ws.pkts.length}" inputmode="numeric">
      <div class="row"><button class="btn primary sm" type="submit">${ic('target', 'sm')}Ir</button><span class="sm" data-msg2 aria-live="polite"></span></div>
    </form>`;
  openDialog({ title: `${ic('search')} ${t('findPkt')}`, body, cls: 'narrow' });
  const show = m => { $$('[role=tab]', body).forEach(b => b.setAttribute('aria-selected', String(b.dataset.m === m))); $$('form', body).forEach(f => { f.hidden = f.dataset.p !== m; }); $(m === 'find' ? '#fd-q' : '#fd-n', body).focus(); };
  $$('[role=tab]', body).forEach(b => b.onclick = () => show(b.dataset.m));
  show(mode);
  const msg = $('[data-msg]', body);
  $('[data-p=find]', body).onsubmit = e => {
    e.preventDefault();
    const r = findPacket(ws, $('#fd-k', body).value, $('#fd-q', body).value, $('#fd-c', body).checked);
    msg.className = `sm ${r.ok ? 'okt' : 'bad'}`; msg.textContent = r.msg;
  };
  $('[data-p=goto]', body).onsubmit = e => {
    e.preventDefault();
    const n = +$('#fd-n', body).value, m2 = $('[data-msg2]', body);
    if (!ws.byNo.has(n)) { m2.className = 'sm bad'; m2.textContent = `No existe el paquete ${n}.`; return; }
    if (!ws.view.some(p => p.no === n)) { m2.className = 'sm bad'; m2.textContent = `El paquete ${n} está oculto por el filtro actual. Bórralo para verlo.`; return; }
    closeDialog(); ws.select(n, { focusList: true });
  };
}
/* Busca el siguiente paquete mostrado, tras el seleccionado y dando la vuelta, como Wireshark. */
function findPacket(ws, kind, q, cs) {
  q = String(q || '');
  if (!q.trim()) return { ok: false, msg: 'Escribe qué buscar.' };
  let test;
  if (kind === 'filter') { const r = parseFilter(q); if (!r.ok) return { ok: false, msg: r.error || 'El filtro no es válido.' }; test = r.test; }
  else if (kind === 'hex') {
    const h = q.replace(/0x|[\s:.-]/gi, '');
    if (!/^([0-9a-f]{2})+$/i.test(h)) return { ok: false, msg: 'Escribe bytes en hexadecimal, por pares: 50 4b 03 04' };
    const nd = h.match(/../g).map(x => parseInt(x, 16));
    test = p => { const b = p.b; outer: for (let i = 0; i + nd.length <= b.length; i++) { for (let j = 0; j < nd.length; j++) if (b[i + j] !== nd[j]) continue outer; return true; } return false; };
  } else {
    const needle = cs ? q : q.toLowerCase();
    test = p => { const s = TD.decode(p.b); return (cs ? s : s.toLowerCase()).includes(needle); };
  }
  const v = ws.view, start = Math.max(-1, v.findIndex(p => p.no === ws.sel));
  for (let k = 1; k <= v.length; k++) {
    const p = v[(start + k) % v.length];
    if (test(p)) { ws.select(p.no); return { ok: true, msg: `Encontrado en el paquete ${p.no}${(start + k) >= v.length && start >= 0 ? ' (se ha dado la vuelta)' : ''}.` }; }
  }
  return { ok: false, msg: 'No aparece en ningún paquete mostrado.' };
}
