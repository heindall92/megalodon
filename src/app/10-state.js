/* Megalodon · estado y progreso guardados en localStorage («megalodon.v1»). */
const STORE_KEY = 'megalodon.v1';
const LEVELS = [[0, 'Alevín'], [80, 'Tintorera'], [200, 'Tiburón martillo'], [380, 'Gran blanco'], [600, 'Megalodón']];
const LEVELS_EN = ['Shark pup', 'Blue shark', 'Hammerhead', 'Great white', 'Megalodon'];
const lvName = lv => (LANG === 'en' ? LEVELS_EN[lv.i] : lv.name);
const XP_BY_HINTS = [10, 8, 6, 5];
const BONUS_MODULE = 20;
const S = (() => {
  const base = () => ({ v: 1, done: {}, hints: {}, badges: {}, settings: { theme: 'system', lang: 'es', relative: true, colorize: true } });
  let st = base();
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const o = JSON.parse(raw); if (o && o.v === 1) st = { ...base(), ...o, settings: { ...base().settings, ...(o.settings || {}) } }; } } catch { /* almacenamiento no disponible: se trabaja en memoria */ }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch { /* sin persistencia */ } };
  const listeners = new Set();
  const emit = () => listeners.forEach(f => f());
  return {
    get: () => st,
    on: f => { listeners.add(f); return () => listeners.delete(f); },
    set(k, v) { st.settings[k] = v; save(); emit(); },
    hintsUsed: id => st.hints[id] || 0,
    useHint(id) { st.hints[id] = (st.hints[id] || 0) + 1; save(); },
    isDone: id => !!st.done[id],
    solve(id) {
      if (st.done[id]) return 0;
      const xp = XP_BY_HINTS[Math.min(XP_BY_HINTS.length - 1, st.hints[id] || 0)];
      st.done[id] = { xp, at: Date.now() }; save(); emit(); return xp;
    },
    earnBadge(mid) { if (st.badges[mid]) return false; st.badges[mid] = Date.now(); save(); emit(); return true; },
    xp() { return Object.values(st.done).reduce((s, d) => s + d.xp, 0) + Object.keys(st.badges).length * BONUS_MODULE; },
    level() { const x = this.xp(); let i = 0; LEVELS.forEach(([min], j) => { if (x >= min) i = j; }); return { i, name: LEVELS[i][1], next: LEVELS[i + 1] ? LEVELS[i + 1][0] : null, min: LEVELS[i][0] }; },
    reset() { const keep = st.settings; st = base(); st.settings = keep; save(); emit(); },
  };
})();
const modProgress = m => { const done = m.tasks.filter(x => S.isDone(x.id)).length; return { done, total: m.tasks.length, pct: Math.round(100 * done / m.tasks.length) }; };
