/* Megalodon · espacio de trabajo tipo Wireshark: barra de filtros con validación y autocompletado,
   lista de paquetes virtualizada y coloreada, árbol de detalle por capas y vista hexadecimal sincronizada. */
const ROW_H = 28, PHEAD_H = 30;
const COLOR_NAMES = { bad: 'Bad TCP', rst: 'TCP RST', arp: 'ARP', icmp: 'ICMP', smb: 'SMB / Kerberos', http: 'HTTP', synfin: 'TCP SYN/FIN', tcp: 'TCP', udp: 'UDP' };

function filterFor(node) {
  if (!node || !node.field) return '';
  const def = FIELDS[node.field]; if (!def) return '';
  if (def.t === 'p') return node.field;
  const v = node.v;
  if (v === undefined || v === true) return node.field;
  if (def.t === 's') return `${node.field} == "${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (node.field === 'tcp.flags') return `tcp.flags == 0x${Number(v).toString(16).padStart(3, '0')}`;
  return `${node.field} == ${v}`;
}
const treeKey = (node, depth) => depth + ':' + node.label.split(/[,:(\[]/)[0].trim();

class Workspace {
  constructor(host, opts = {}) {
    this.host = host; this.opts = opts; this.id = nextId('ws');
    this.name = opts.name || 'captura.pcapng'; this.raw = opts.raw || [];
    this.filterText = ''; this.parsed = parseFilter(''); this.view = []; this.sel = null; this.selNode = null; this.expanded = new Set();
    this.colorize = S.get().settings.colorize; this.acItems = []; this.acIdx = -1;
    this.build();
    this.load(this.raw, this.name, opts.filter || '');
    this.unsub = S.on(() => { const s = S.get().settings; if (s.relative !== this.relative) this.redissect(); if (s.colorize !== this.colorize) { this.colorize = s.colorize; this.syncColorBtn(); this.renderRows(true); } });
  }
  build() {
    const id = this.id, imp = this.opts.allowImport;
    this.host.innerHTML = `<section class="ws" aria-label="${t('wireshark')}">
      <div class="ws-bar">
        <div class="fbar" data-state="empty">
          <span class="fbar-ic" aria-hidden="true">${ic('filter')}</span>
          <label class="vh" for="${id}-f">Filtro de visualización</label>
          <input id="${id}-f" class="finput mono" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-ac" aria-describedby="${id}-msg" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t('filterPh'))}">
          <button class="ibtn sm" data-clear type="button" aria-label="${t('clear')}">${ic('x')}</button>
          <button class="btn sm primary" data-apply type="button" aria-label="${t('apply')}">${ic('enter')}<span>${t('apply')}</span></button>
          <ul class="ac" id="${id}-ac" role="listbox" aria-label="Sugerencias" hidden></ul>
        </div>
        <div class="ws-tools" role="toolbar" aria-label="Herramientas">
          <button class="tbtn" data-follow type="button" title="${t('follow')} (F)">${ic('follow')}<span>${t('follow')}</span></button>
          <button class="tbtn" data-stats type="button" title="${t('stats')} (S)">${ic('stats')}<span>${t('stats')}</span></button>
          <button class="tbtn" data-color type="button" aria-pressed="true">${ic('sparkles')}<span>${t('colorize')}</span></button>
          ${imp ? `<button class="tbtn" data-open type="button">${ic('upload')}<span>${t('open')}</span></button><input type="file" class="vh" data-file accept=".pcap,.pcapng,.cap,application/vnd.tcpdump.pcap" tabindex="-1" aria-hidden="true">` : ''}
          <button class="tbtn" data-export type="button">${ic('download')}<span>Exportar</span></button>
        </div>
      </div>
      <p class="fmsg" id="${id}-msg" aria-live="polite"></p>
      <div class="ws-panes">
        <div class="pane plist" role="grid" aria-label="${t('packetList')}" aria-colcount="7" tabindex="0">
          <div class="prow phead" role="row" aria-rowindex="1">
            <span role="columnheader" class="c-no">${t('no')}</span><span role="columnheader" class="c-t">${t('time')}</span><span role="columnheader" class="c-s">${t('src')}</span><span role="columnheader" class="c-d">${t('dst')}</span><span role="columnheader" class="c-p">${t('proto')}</span><span role="columnheader" class="c-l">${t('len')}</span><span role="columnheader" class="c-i">${t('info')}</span>
          </div>
          <div class="pbody" role="rowgroup"><div class="pspacer"></div><p class="pempty" hidden>${t('emptyResult')}</p></div>
        </div>
        <div class="pane ptree" aria-label="${t('detail')}" role="region"><ul class="tree" role="tree" aria-label="${t('detail')}" tabindex="0"></ul><p class="pane-empty">${t('noPacket')}</p></div>
        <div class="pane phex" role="region" aria-label="${t('hexView')}" tabindex="0"><div class="hex mono"></div></div>
      </div>
      <div class="ws-status"><span data-count></span><span class="dot" aria-hidden="true"></span><span data-name class="mono"></span><span class="grow"></span><span data-legend class="legend"></span></div>
      ${imp ? `<div class="drop" hidden>${ic('upload')}<span>${t('importDrop')}</span></div>` : ''}
    </section>`;
    const r = this.host;
    this.$ = { fbar: $('.fbar', r), input: $('.finput', r), ac: $('.ac', r), msg: $('.fmsg', r), list: $('.plist', r), body: $('.pbody', r), spacer: $('.pspacer', r), empty: $('.pempty', r),
      tree: $('.tree', r), treeEmpty: $('.ptree .pane-empty', r), hex: $('.hex', r), count: $('[data-count]', r), name: $('[data-name]', r), color: $('[data-color]', r), legend: $('[data-legend]', r) };
    this.rows = new Map();
    const inp = this.$.input;
    inp.addEventListener('input', () => { this.validate(); this.complete(); });
    inp.addEventListener('keydown', e => this.onFilterKey(e));
    inp.addEventListener('blur', () => setTimeout(() => this.closeAc(), 120));
    inp.addEventListener('focus', () => this.complete());
    $('[data-apply]', r).onclick = () => this.apply();
    $('[data-clear]', r).onclick = () => { inp.value = ''; this.validate(); this.apply(); inp.focus(); };
    $('[data-follow]', r).onclick = () => this.follow();
    $('[data-stats]', r).onclick = () => openStats(this);
    this.$.color.onclick = () => S.set('colorize', !S.get().settings.colorize);
    $('[data-export]', r).onclick = () => this.exportDialog();
    this.$.ac.addEventListener('mousedown', e => { const li = e.target.closest('[role=option]'); if (li) { e.preventDefault(); this.acceptAc(+li.dataset.i); } });
    this.$.list.addEventListener('scroll', () => { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.renderRows(); }); }, { passive: true });
    this.$.body.addEventListener('click', e => { const row = e.target.closest('.prow'); if (row) this.select(+row.dataset.no, { focusList: true }); });
    this.$.body.addEventListener('dblclick', e => { const row = e.target.closest('.prow'); if (row) this.follow(); });
    this.$.list.addEventListener('keydown', e => this.onListKey(e));
    this.$.tree.addEventListener('click', e => this.onTreeClick(e));
    this.$.tree.addEventListener('keydown', e => this.onTreeKey(e));
    this.$.hex.addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (b) this.selectByte(+b.dataset.o); });
    new ResizeObserver(() => this.renderRows(true)).observe(this.$.body);
    if (this.opts.allowImport) {
      const file = $('[data-file]', r), drop = $('.drop', r);
      $('[data-open]', r).onclick = () => file.click();
      file.onchange = () => { if (file.files[0]) this.importFile(file.files[0]); file.value = ''; };
      const ws = $('.ws', r); let depth = 0;
      ws.addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { depth++; drop.hidden = false; e.preventDefault(); } });
      ws.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
      ws.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.hidden = true; } });
      ws.addEventListener('drop', e => { e.preventDefault(); depth = 0; drop.hidden = true; const f = e.dataTransfer.files[0]; if (f) this.importFile(f); });
    }
    this.syncColorBtn();
  }
  syncColorBtn() { this.$.color.setAttribute('aria-pressed', String(this.colorize)); this.host.querySelector('.ws').classList.toggle('nocolor', !this.colorize); }

  /* ---------- datos ---------- */
  load(raw, name, filter = '') {
    this.raw = raw; this.name = name; this.sel = null; this.selNode = null;
    this.redissect(true);
    this.$.input.value = filter; this.validate(); this.apply(true);
    this.$.name.textContent = name;
    if (this.view.length) this.select(this.view[0].no);
  }
  redissect(silent) {
    this.relative = S.get().settings.relative;
    const keep = this.sel;
    this.pkts = dissectAll(this.raw, { relative: this.relative }).pkts;
    this.byNo = new Map(this.pkts.map(p => [p.no, p]));
    if (!silent) { this.parsed = parseFilter(this.filterText); this.view = this.parsed.ok ? this.pkts.filter(this.parsed.test) : this.pkts; this.renderRows(true); this.status(); if (keep) this.select(keep, { keepNode: true }); }
  }
  async importFile(f) {
    try {
      if (f.size > 64 * 1024 * 1024) throw new Error('El archivo pesa más de 64 MB; este laboratorio está pensado para capturas pequeñas.');
      const raw = readCapture(new Uint8Array(await f.arrayBuffer()));
      if (!raw.length) throw new Error('La captura no tiene paquetes Ethernet que pueda leer.');
      this.load(raw, f.name, '');
      toast(`Abierta <strong>${esc(f.name)}</strong>: ${fmtNum(raw.length)} paquetes`, 'ok', 'file');
      if (this.opts.onImport) this.opts.onImport(f.name);
    } catch (err) { toast(esc(err.message || 'No se pudo leer la captura'), 'err'); }
  }
  exportDialog() {
    const base = this.name.replace(/\.(pcapng|pcap|cap)$/i, '');
    const d = openDialog({ title: 'Exportar captura', cls: 'narrow', body: `<p class="muted">Se descarga a tu equipo y la abres tal cual en Wireshark.</p>
      <div class="stack-sm">
        <button class="choice" data-k="all-ng">${ic('download')}<span><strong>Captura completa · .pcapng</strong><small>${fmtNum(this.pkts.length)} paquetes, formato moderno</small></span></button>
        <button class="choice" data-k="all-pcap">${ic('download')}<span><strong>Captura completa · .pcap</strong><small>Formato clásico, lo abre cualquier herramienta</small></span></button>
        <button class="choice" data-k="view-ng" ${this.view.length === this.pkts.length ? 'disabled' : ''}>${ic('filter')}<span><strong>Solo los mostrados · .pcapng</strong><small>${fmtNum(this.view.length)} paquetes con el filtro actual</small></span></button>
      </div>` });
    $$('[data-k]', d).forEach(b => b.onclick = () => {
      const k = b.dataset.k, subset = k.startsWith('view') ? this.view.map(p => this.raw[p.no - 1]) : this.raw;
      const ng = k.endsWith('ng');
      download(ng ? writePcapng(subset, `Megalodon · ${base}`) : writePcap(subset), `${base}${k.startsWith('view') ? '-filtrado' : ''}.${ng ? 'pcapng' : 'pcap'}`, 'application/vnd.tcpdump.pcap');
      closeDialog(); toast('Captura exportada', 'ok', 'download');
    });
  }

  /* ---------- filtro ---------- */
  validate() {
    const v = this.$.input.value, r = parseFilter(v);
    this.$.fbar.dataset.state = r.empty ? 'empty' : r.ok ? 'ok' : 'bad';
    this.$.input.setAttribute('aria-invalid', String(!r.ok));
    this.$.msg.className = 'fmsg ' + (r.ok ? '' : 'bad');
    this.$.msg.innerHTML = r.ok ? '' : `${ic('ko', 'sm')}<span>${esc(r.error)}</span>`;
    return r;
  }
  apply(silent) {
    const v = this.$.input.value.trim(), r = this.validate();
    this.closeAc();
    if (!r.ok) { if (!silent) { this.$.fbar.classList.remove('shake'); void this.$.fbar.offsetWidth; this.$.fbar.classList.add('shake'); } return false; }
    this.filterText = v; this.parsed = r;
    this.view = r.empty ? this.pkts : this.pkts.filter(r.test);
    this.$.list.scrollTop = 0;
    this.renderRows(true); this.status();
    if (this.sel && !this.view.some(p => p.no === this.sel)) { if (this.view.length) this.select(this.view[0].no); else this.clearSel(); }
    else if (this.sel) this.scrollTo(this.sel);
    if (!silent && this.opts.onFilter) this.opts.onFilter(v, this.view);
    return true;
  }
  setFilter(v, applyNow = true) { this.$.input.value = v; this.validate(); if (applyNow) this.apply(); }
  focusFilter() { this.$.input.focus(); this.$.input.select(); }
  complete() {
    const inp = this.$.input, r = filterComplete(inp.value, inp.selectionStart ?? inp.value.length);
    this.acItems = r.items.filter(it => !(it.v === inp.value.slice(r.start, r.end) && !it.more)); this.acRange = r; this.acIdx = -1;
    if (!this.acItems.length || document.activeElement !== inp) return this.closeAc();
    this.$.ac.innerHTML = this.acItems.map((it, i) => `<li role="option" id="${this.id}-o${i}" data-i="${i}" aria-selected="false"><code>${esc(it.v)}</code><span>${esc(it.d)}</span></li>`).join('');
    this.$.ac.hidden = false; inp.setAttribute('aria-expanded', 'true');
  }
  closeAc() { this.$.ac.hidden = true; this.$.input.setAttribute('aria-expanded', 'false'); this.$.input.removeAttribute('aria-activedescendant'); this.acIdx = -1; }
  moveAc(d) {
    if (this.$.ac.hidden) return false;
    const n = this.acItems.length; this.acIdx += d;
    if (this.acIdx >= n) this.acIdx = -1; else if (this.acIdx < -1) this.acIdx = n - 1;
    $$('[role=option]', this.$.ac).forEach((li, i) => li.setAttribute('aria-selected', String(i === this.acIdx)));
    if (this.acIdx >= 0) { this.$.input.setAttribute('aria-activedescendant', `${this.id}-o${this.acIdx}`); $(`#${this.id}-o${this.acIdx}`).scrollIntoView({ block: 'nearest' }); } else this.$.input.removeAttribute('aria-activedescendant');
    return true;
  }
  acceptAc(i) {
    const it = this.acItems[i]; if (!it) return;
    const inp = this.$.input, { start, end } = this.acRange, v = inp.value;
    const add = it.kind === 'op' ? it.v + ' ' : it.v + (it.more ? '' : ' ');
    inp.value = v.slice(0, start) + add + v.slice(end).replace(/^\s+/, '');
    const pos = start + add.length; inp.setSelectionRange(pos, pos);
    this.validate(); this.complete();
  }
  onFilterKey(e) {
    if (e.key === 'ArrowDown') { if (this.moveAc(1)) e.preventDefault(); }
    else if (e.key === 'ArrowUp') { if (this.moveAc(-1)) e.preventDefault(); }
    else if (e.key === 'Tab' && !this.$.ac.hidden && this.acItems.length && !e.shiftKey) { e.preventDefault(); this.acceptAc(this.acIdx >= 0 ? this.acIdx : 0); }
    else if (e.key === 'Enter') { e.preventDefault(); if (!this.$.ac.hidden && this.acIdx >= 0) this.acceptAc(this.acIdx); else this.apply(); }
    else if (e.key === 'Escape') { if (!this.$.ac.hidden) { e.preventDefault(); e.stopPropagation(); this.closeAc(); } }
  }

  /* ---------- lista virtualizada ---------- */
  renderRows(force) {
    const body = this.$.body, n = this.view.length;
    this.$.spacer.style.height = `${n * ROW_H}px`;
    this.$.empty.hidden = n > 0 || !this.pkts.length;
    this.$.list.setAttribute('aria-rowcount', String(n + 1));
    const h = Math.max(0, this.$.list.clientHeight - PHEAD_H) || 400, top = this.$.list.scrollTop;
    const a = Math.max(0, Math.floor(top / ROW_H) - 6), b = Math.min(n, Math.ceil((top + h) / ROW_H) + 6);
    if (force) { this.rows.forEach(el => el.remove()); this.rows.clear(); }
    const want = new Set();
    for (let i = a; i < b; i++) {
      const p = this.view[i]; want.add(p.no);
      let el = this.rows.get(p.no);
      if (!el) {
        el = document.createElement('div');
        el.className = `prow c-${p.color || 'none'}`; el.dataset.no = p.no; el.id = `${this.id}-r${p.no}`; el.setAttribute('role', 'row');
        el.innerHTML = `<span role="gridcell" class="c-no">${p.no}</span><span role="gridcell" class="c-t">${p.rel.toFixed(6)}</span><span role="gridcell" class="c-s">${esc(p.src)}</span><span role="gridcell" class="c-d">${esc(p.dst)}</span><span role="gridcell" class="c-p">${esc(p.proto)}</span><span role="gridcell" class="c-l">${p.len}</span><span role="gridcell" class="c-i">${esc(p.info)}</span>`;
        this.$.body.append(el); this.rows.set(p.no, el);
      }
      el.style.transform = `translateY(${i * ROW_H}px)`;
      el.setAttribute('aria-rowindex', String(i + 2));
      el.setAttribute('aria-selected', String(p.no === this.sel));
    }
    this.rows.forEach((el, no) => { if (!want.has(no)) { el.remove(); this.rows.delete(no); } });
  }
  scrollTo(no) {
    const i = this.view.findIndex(p => p.no === no); if (i < 0) return;
    const sc = this.$.list, y = i * ROW_H, vis = sc.clientHeight - PHEAD_H;
    if (y < sc.scrollTop) sc.scrollTop = y; else if (y + ROW_H > sc.scrollTop + vis) sc.scrollTop = y + ROW_H - vis;
    this.renderRows();
  }
  status() {
    const n = this.pkts.length, m = this.view.length;
    this.$.count.innerHTML = `${t('packets')}: <strong>${fmtNum(n)}</strong> · ${t('displayed')}: <strong>${fmtNum(m)}</strong>${n ? ` (${(100 * m / n).toFixed(1).replace('.', LANG === 'en' ? '.' : ',')} %)` : ''}`;
    const used = [...new Set(this.view.map(p => p.color).filter(Boolean))];
    this.$.legend.innerHTML = this.colorize ? Object.keys(COLOR_NAMES).filter(k => used.includes(k)).map(k => `<span class="lg c-${k}"><i aria-hidden="true"></i>${COLOR_NAMES[k]}</span>`).join('') : '';
  }
  onListKey(e) {
    const i = this.view.findIndex(p => p.no === this.sel), page = Math.max(1, Math.floor((this.$.list.clientHeight - PHEAD_H) / ROW_H) - 1);
    const go = j => { e.preventDefault(); const p = this.view[Math.max(0, Math.min(this.view.length - 1, j))]; if (p) this.select(p.no, { focusList: true }); };
    if (e.key === 'ArrowDown') go(i + 1); else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'PageDown') go(i + page); else if (e.key === 'PageUp') go(i - page);
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(this.view.length - 1);
    else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); this.$.tree.focus(); }
  }

  /* ---------- selección, árbol y bytes ---------- */
  clearSel() { this.sel = null; this.selNode = null; this.$.tree.innerHTML = ''; this.$.treeEmpty.hidden = false; this.$.hex.innerHTML = ''; this.$.list.removeAttribute('aria-activedescendant'); }
  select(no, { focusList = false, keepNode = false } = {}) {
    const p = this.byNo.get(no); if (!p) return;
    const prevNode = keepNode && this.selNode ? this.selNode.label : null;
    this.sel = no; this.selNode = null;
    this.rows.forEach((el, k) => el.setAttribute('aria-selected', String(k === no)));
    this.scrollTo(no);
    this.$.list.setAttribute('aria-activedescendant', `${this.id}-r${no}`);
    if (focusList) this.$.list.focus({ preventScroll: true });
    if (!p.tree.some((n, d) => this.expanded.has(treeKey(n, 0)))) this.expanded.add(treeKey(p.tree[p.tree.length - 1], 0));
    this.renderTree(p); this.renderHex(p);
    if (prevNode) { const f = this.flat.find(x => x.node.label === prevNode); if (f) this.selectNode(f.node); }
    if (this.opts.onSelect) this.opts.onSelect(p);
  }
  selected() { return this.sel ? this.byNo.get(this.sel) : null; }
  renderTree(p) {
    this.$.treeEmpty.hidden = true;
    this.flat = [];
    let k = 0;
    const walk = (nodes, depth, parentId) => nodes.map(n => {
      const id = `${this.id}-n${k++}`, key = treeKey(n, depth), kids = n.kids.length > 0, open = kids && this.expanded.has(key);
      this.flat.push({ id, node: n, depth, key, parentId, kids, open });
      const f = filterFor(n);
      return `<li role="treeitem" id="${id}" aria-level="${depth + 1}" aria-selected="false" ${kids ? `aria-expanded="${open}"` : ''}>
        <div class="tn" data-id="${id}">${kids ? `<span class="tw" aria-hidden="true">${ic('chevR', 'sm')}</span>` : '<span class="tw"></span>'}<span class="tl">${esc(n.label)}</span>${f ? `<button class="tf" type="button" tabindex="-1" data-f="${esc(f)}" aria-label="${t('applyAsFilter')}: ${esc(f)}" title="${t('applyAsFilter')}: ${esc(f)}">${ic('filter', 'sm')}</button>` : ''}</div>
        ${kids ? `<ul role="group"${open ? '' : ' hidden'}>${walk(n.kids, depth + 1, id)}</ul>` : ''}</li>`;
    }).join('');
    this.$.tree.innerHTML = walk(p.tree, 0, null);
    this.$.tree.removeAttribute('aria-activedescendant');
  }
  visibleFlat() { return this.flat.filter(f => { let pid = f.parentId; while (pid) { const par = this.flat.find(x => x.id === pid); if (!par.open) return false; pid = par.parentId; } return true; }); }
  toggle(f, open = !f.open) {
    if (!f.kids) return;
    f.open = open; open ? this.expanded.add(f.key) : this.expanded.delete(f.key);
    const li = $(`#${f.id}`); li.setAttribute('aria-expanded', String(open)); $(':scope > ul', li).hidden = !open;
  }
  selectNode(node, focus) {
    const f = this.flat.find(x => x.node === node); if (!f) return;
    let pid = f.parentId; while (pid) { const par = this.flat.find(x => x.id === pid); this.toggle(par, true); pid = par.parentId; }
    this.selNode = node;
    $$('[role=treeitem]', this.$.tree).forEach(li => li.setAttribute('aria-selected', String(li.id === f.id)));
    this.$.tree.setAttribute('aria-activedescendant', f.id);
    $(`#${f.id} > .tn`).scrollIntoView({ block: 'nearest' });
    if (focus) this.$.tree.focus({ preventScroll: true });
    this.highlight(node);
  }
  onTreeClick(e) {
    const fb = e.target.closest('.tf'); if (fb) { this.setFilter(fb.dataset.f); toast(`${t('applyAsFilter')}: <code>${esc(fb.dataset.f)}</code>`, 'info', 'filter'); return; }
    const tn = e.target.closest('.tn'); if (!tn) return;
    const f = this.flat.find(x => x.id === tn.dataset.id);
    if (e.target.closest('.tw') || this.selNode === f.node) this.toggle(f);
    this.selectNode(f.node, true);
  }
  onTreeKey(e) {
    const vis = this.visibleFlat(); if (!vis.length) return;
    let i = vis.findIndex(f => f.node === this.selNode);
    const cur = vis[i];
    const go = j => { e.preventDefault(); const f = vis[Math.max(0, Math.min(vis.length - 1, j))]; this.selectNode(f.node, true); };
    if (e.key === 'ArrowDown') go(i + 1); else if (e.key === 'ArrowUp') go(i < 0 ? 0 : i - 1);
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(vis.length - 1);
    else if (e.key === 'ArrowRight' && cur) { e.preventDefault(); if (cur.kids && !cur.open) this.toggle(cur, true); else if (cur.kids) go(i + 1); }
    else if (e.key === 'ArrowLeft' && cur) { e.preventDefault(); if (cur.kids && cur.open) this.toggle(cur, false); else if (cur.parentId) this.selectNode(this.flat.find(x => x.id === cur.parentId).node, true); else this.$.list.focus(); }
    else if (e.key === 'Enter' && cur) { e.preventDefault(); const f = filterFor(cur.node); if (f) { this.setFilter(f); toast(`${t('applyAsFilter')}: <code>${esc(f)}</code>`, 'info', 'filter'); } else this.toggle(cur); }
    else if (e.key === ' ' && cur) { e.preventDefault(); this.toggle(cur); }
  }
  renderHex(p) {
    const b = p.b, lines = [];
    for (let o = 0; o < b.length; o += 16) {
      let hx = '', as = '';
      for (let i = o; i < o + 16; i++) {
        if (i < b.length) { const v = b[i]; hx += `<span data-o="${i}">${v.toString(16).padStart(2, '0')}</span>`; as += `<span data-o="${i}">${v >= 32 && v < 127 ? esc(String.fromCharCode(v)) : '·'}</span>`; }
        else { hx += '<span class="pad">  </span>'; }
        if (i === o + 7) hx += '<span class="gap"> </span>';
      }
      lines.push(`<div class="hl-row"><span class="off">${o.toString(16).padStart(4, '0')}</span><span class="hx">${hx}</span><span class="as">${as}</span></div>`);
    }
    this.$.hex.innerHTML = lines.join('');
    this.byteEls = new Map(); $$('[data-o]', this.$.hex).forEach(el => { const o = +el.dataset.o; (this.byteEls.get(o) || this.byteEls.set(o, []).get(o)).push(el); });
  }
  highlight(node) {
    $$('.on, .on2', this.$.hex).forEach(el => el.classList.remove('on', 'on2'));
    if (!node) return;
    const top = this.flat.find(x => x.node === node); let root = top; while (root && root.parentId) root = this.flat.find(x => x.id === root.parentId);
    if (root && root.node !== node) for (let o = root.node.s; o < root.node.s + root.node.n; o++) (this.byteEls.get(o) || []).forEach(el => el.classList.add('on2'));
    for (let o = node.s; o < node.s + node.n; o++) (this.byteEls.get(o) || []).forEach(el => el.classList.add('on'));
    const first = (this.byteEls.get(node.s) || [])[0]; if (first && node.n) first.scrollIntoView({ block: 'nearest' });
  }
  selectByte(o) {
    let best = null;
    for (const f of this.flat) if (f.node.n > 0 && o >= f.node.s && o < f.node.s + f.node.n && (!best || f.depth > best.depth || (f.depth === best.depth && f.node.n < best.node.n))) best = f;
    if (best) this.selectNode(best.node);
  }

  follow(stream) {
    const p = this.selected();
    const st = stream ?? (p && p.tcpStream);
    if (st === undefined || st === null) { toast('Selecciona un paquete TCP para seguir su flujo.', 'info', 'follow'); return; }
    openFollow(this, st);
  }
  destroy() { this.unsub && this.unsub(); this.host.innerHTML = ''; }
}
