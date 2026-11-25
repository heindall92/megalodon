/* Megalodon · cambio de tema con efecto: Gota, Lluvia o Fundido.
   Adaptado del Theme Switch de Pin UI (MIT, © Rachit Thakur, github.com/shadcn-labs/Pin-UI): la física de la gota
   (cae con s = v0·t + ½·g·t², se estira con la velocidad conservando el volumen, se aplasta al llegar, el botón cede
   y vuelve con un muelle y salen dos ondas) y la idea de inundar la escena desde el punto de impacto.
   Aquí la escena es toda la aplicación: el tema nuevo se revela sobre la página real con View Transitions,
   en un círculo (Gota) o en charcos que crecen y se unen hasta cubrirlo todo (Lluvia).
   La cobertura de la lluvia no se adivina: cada charco nace dentro de su celda y crece hasta la diagonal de esa celda,
   así que al acabar la página queda cubierta entera. Movimiento reducido o sin View Transitions: cambio sin efecto.
   Una pulsación a mitad de efecto lo termina y aplica el tema pedido al momento (interrumpible). */
const FX_KINDS = ['drop', 'rain', 'fade'];
const FX_THEME = {
  light: { drop: '#ffffff', ink: 'rgba(20, 63, 148, 0.55)', ring: 'rgba(15, 23, 42, 0.22)' },
  dark: { drop: '#12151b', ink: 'rgba(12, 16, 24, 0.85)', ring: 'rgba(255, 255, 255, 0.28)' },
};
const FX_EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const FX_EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';
const FX_DROP = { g: 2400, v0: 160, lead: 90, maxStretch: 0.2, perV: 1 / 10000, w: 22, h: 30, squash: 220, floodDelay: 40, flood: 1050, ripple: 900, stagger: 120 };
const FX_RAIN = { cell: 210, window: 620, grow: 720, total: 1450, keys: 36 };
const FX_WATCHDOG = 4000;

/* La pantalla es más alta que la escena de Pin UI y el botón está arriba: la gota entra desde fuera de la vista
   (lead) con algo menos de gravedad para que la caída se vea, y la inundación dura un poco más porque recorre toda la ventana. */
/* Oscilador amortiguado muestreado en una curva linear(): el muelle del botón cuando la gota lo golpea */
function springLinear(dur, bounce) {
  const zeta = 1 - bounce, w = 2 * Math.PI / dur, wd = w * Math.sqrt(1 - zeta * zeta), pts = [];
  for (let i = 0, n = 48; i <= n; i++) {
    const t = dur * i / n;
    pts.push(i === n ? '1' : (1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t))).toFixed(4));
  }
  return `linear(${pts.join(', ')})`;
}
const FX_SPRING = window.CSS && CSS.supports('transition-timing-function', 'linear(0, 1)') ? springLinear(0.52, 0.3) : FX_EASE_OUT;

let FX_RUN = null;                                         // { vt, done } mientras hay un efecto en marcha
const fxKind = () => (FX_KINDS.includes(S.get().settings.themeFx) ? S.get().settings.themeFx : 'drop');
const fxDone = a => a.finished.then(() => {}, () => {});
const fxWait = ms => new Promise(r => setTimeout(r, ms));
const easeOut3 = p => 1 - Math.pow(1 - p, 3);

/* Punto de impacto: el centro del botón de tema si se ve; si no, arriba a la derecha */
function fxOrigin() {
  const b = $('[data-theme-btn]'), r = b && b.getBoundingClientRect();
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, btn: b } : { x: innerWidth - 48, y: 40, btn: null };
}

/* Punto de entrada: cambia al tema `next` con el efecto elegido en Ajustes */
function switchTheme(next) {
  const busy = !!FX_RUN;
  if (busy) { const r = FX_RUN; FX_RUN = null; r.vt.skipTransition(); r.layer.remove(); document.documentElement.classList.remove('fx-vt'); }   // interrumpir: lo último que se pide manda, al momento
  const kind = fxKind();
  const plain = busy || kind === 'fade' || REDUCED.matches || !document.startViewTransition || document.visibilityState !== 'visible';
  if (plain) { S.set('theme', next); applyTheme(kind === 'fade'); return; }
  const o = fxOrigin(), root = document.documentElement;
  const layer = document.createElement('div');
  layer.className = 'fx-layer'; layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  let drop = null, k = null;
  if (kind === 'drop') {                                   // la gota ya está arriba, fuera de la vista, antes de la captura
    drop = fxMakeDrop(FX_THEME[next].drop);
    drop.style.left = `${o.x - FX_DROP.w / 2}px`; drop.style.top = `${o.y - FX_DROP.h}px`;
    k = fxFall(o.y); drop.style.transform = k.frames[0].transform;
    layer.append(drop);
  }
  root.classList.add('fx-vt');
  const vt = document.startViewTransition(() => { S.set('theme', next); applyTheme(false); });
  const run = FX_RUN = { vt, layer };
  const watchdog = setTimeout(() => vt.skipTransition(), FX_WATCHDOG);
  const effect = vt.ready.then(() => (kind === 'drop' ? fxDropRun(next, o, drop, k, layer) : fxRainRun(next, o, layer)), () => {});
  Promise.allSettled([vt.finished, effect]).then(() => {
    clearTimeout(watchdog);
    layer.remove(); if (!FX_RUN) root.classList.remove('fx-vt');
    if (o.btn) o.btn.getAnimations().forEach(a => a.cancel());
    if (FX_RUN === run) FX_RUN = null;
  });
}

/* ---------- Gota ---------- */
let fxId = 0;
function fxMakeDrop(color) {
  const el = document.createElement('div'), id = `fx-shade-${++fxId}`;
  const body = 'M12 0.5C12 0.5 2 12.6 2 21a10 10 0 0 0 20 0C22 12.6 12 0.5 12 0.5Z';
  el.className = 'fx-drop';
  el.innerHTML = `<svg viewBox="0 0 24 32" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient></defs><path d="${body}" fill="${color}" stroke="rgba(127,127,127,0.35)" stroke-width="0.6"/><path d="${body}" fill="url(#${id})" opacity="0.5"/><ellipse cx="8.2" cy="20" rx="2" ry="3.6" transform="rotate(18 8.2 20)" fill="#fff" opacity="0.4"/></svg>`;
  return el;
}
function fxFall(cy) {
  const dist = cy + FX_DROP.lead, { g, v0 } = FX_DROP, T = (-v0 + Math.sqrt(v0 * v0 + 2 * g * dist)) / g, frames = [];
  let sy = 1;
  for (let i = 0, n = 30; i <= n; i++) {
    const t = T * i / n, s = v0 * t + 0.5 * g * t * t;
    sy = 1 + Math.min(FX_DROP.maxStretch, (v0 + g * t) * FX_DROP.perV);
    frames.push({ offset: i / n, transform: `translateY(${(s - dist).toFixed(2)}px) scale(${(1 / Math.sqrt(sy)).toFixed(4)}, ${sy.toFixed(4)})` });
  }
  return { frames, ms: T * 1000, sy };
}
function fxPress(btn) {
  if (!btn) return Promise.resolve();
  const down = btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.92)' }], { duration: 90, easing: FX_EASE_OUT, fill: 'forwards' });
  return fxDone(down).then(() => { const up = btn.animate([{ transform: 'scale(0.92)' }, { transform: 'scale(1)' }], { duration: 520, easing: FX_SPRING, fill: 'forwards' }); down.cancel(); return fxDone(up).then(() => up.cancel()); });
}
function fxRipples(layer, x, y, color) {
  return Promise.all([0, 1].map(i => {
    const r = document.createElement('div');
    r.className = 'fx-ripple'; r.style.left = `${x}px`; r.style.top = `${y}px`; r.style.color = color;
    layer.append(r);
    return fxDone(r.animate([{ transform: 'scale(1.1)', opacity: 1 }, { transform: `scale(${5 + i * 2.5})`, opacity: 0 }], { duration: FX_DROP.ripple, delay: i * FX_DROP.stagger, easing: FX_EASE_OUT, fill: 'both' }));
  }));
}
async function fxDropRun(next, o, drop, k, layer) {
  const W = innerWidth, H = innerHeight, R = Math.ceil(Math.hypot(Math.max(o.x, W - o.x), Math.max(o.y, H - o.y))) + 2;
  const at = `at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px`;
  /* el tema nuevo espera cerrado en el punto de impacto y se abre cuando llega la gota */
  const flood = document.documentElement.animate({ clipPath: [`circle(0px ${at})`, `circle(${R}px ${at})`] }, { duration: FX_DROP.flood, delay: k.ms + FX_DROP.floodDelay, easing: FX_EASE_DRAWER, fill: 'both', pseudoElement: '::view-transition-new(root)' });
  await fxDone(drop.animate(k.frames, { duration: k.ms, easing: 'linear', fill: 'forwards' }));
  const squash = drop.animate([
    { transform: `translateY(0) scale(${(1 / Math.sqrt(k.sy)).toFixed(4)}, ${k.sy.toFixed(4)})`, opacity: 1 },
    { transform: 'translateY(0) scale(1.55, 0.5)', opacity: 1, offset: 0.3 },
    { transform: 'translateY(0) scale(2.4, 0.12)', opacity: 0 },
  ], { duration: FX_DROP.squash, easing: FX_EASE_OUT, fill: 'forwards' });
  await Promise.all([fxDone(squash), fxPress(o.btn), fxRipples(layer, o.x, o.y, FX_THEME[next].ring), fxDone(flood)]);
}

/* ---------- Lluvia ---------- */
function fxRainPlan(W, H, o) {
  const cols = Math.max(2, Math.ceil(W / FX_RAIN.cell)), rows = Math.max(2, Math.ceil(H / FX_RAIN.cell)), cw = W / cols, ch = H / rows;
  const reach = Math.hypot(cw, ch) * 1.03;                 // desde cualquier punto de su celda llega a toda la celda
  const spots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) spots.push({ x: (c + 0.12 + Math.random() * 0.76) * cw, y: (r + 0.12 + Math.random() * 0.76) * ch, rmax: reach * (1 + Math.random() * 0.15) });
  /* la primera gota cae sobre el botón: el cambio empieza donde se ha pulsado */
  const near = spots.reduce((b, s) => (Math.hypot(s.x - o.x, s.y - o.y) < Math.hypot(b.x - o.x, b.y - o.y) ? s : b));
  near.x = o.x; near.y = o.y; near.land = 120; near.rmax = Math.max(near.rmax, Math.hypot(cw, ch) * 1.6);
  spots.filter(s => s !== near).sort(() => Math.random() - 0.5).forEach((s, i, a) => { s.land = 160 + FX_RAIN.window * Math.pow((i + 1) / a.length, 0.85) * (0.85 + Math.random() * 0.15); });
  return spots;
}
const fxCircle = (x, y, r) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0Z`;
async function fxRainRun(next, o, layer) {
  const W = innerWidth, H = innerHeight, spots = fxRainPlan(W, H, o);
  const radius = (s, t) => s.rmax * easeOut3(Math.min(1, Math.max(0, (t - s.land) / FX_RAIN.grow)));
  /* los charcos son un único trazado de círculos (misma estructura en cada fotograma, así se interpola) */
  const frames = [];
  for (let i = 0; i <= FX_RAIN.keys; i++) { const t = FX_RAIN.total * i / FX_RAIN.keys; frames.push({ clipPath: `path('${spots.map(s => fxCircle(s.x, s.y, radius(s, t))).join('')}')` }); }
  const flood = document.documentElement.animate(frames, { duration: FX_RAIN.total, easing: 'linear', fill: 'both', pseudoElement: '::view-transition-new(root)' });
  /* la lluvia: trazos inclinados por el viento, más cerca = más rápido, más largo y más opaco; cada gota que toca suelo deja onda */
  const dpr = Math.min(devicePixelRatio || 1, 2), cv = document.createElement('canvas');
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.className = 'fx-canvas';
  layer.append(cv);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const wind = 0.22, col = FX_THEME[next].ink, ring = FX_THEME[next].ring;
  const streaks = [...spots.map(s => ({ x: s.x, y: s.y, land: s.land, z: 1, hit: true })), ...Array.from({ length: Math.round(W * H / 9000) }, () => ({ x: Math.random() * W * 1.1, y: Math.random() * H, land: 60 + Math.random() * (FX_RAIN.window + 380), z: 0.35 + Math.random() * 0.5, hit: false }))];
  streaks.forEach(d => { d.v = 1.6 + d.z * 1.6; d.len = 10 + d.z * 22; d.w = 0.8 + d.z * 1.1; d.a = 0.25 + d.z * 0.6; d.fall = d.y + 40; });
  if (o.btn) setTimeout(() => fxPress(o.btn), 120);
  const t0 = performance.now();
  await new Promise(res => {
    const frame = now => {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';
      for (const d of streaks) {
        const dt = d.land - t;                             // ms hasta tocar suelo
        if (dt > 0) {
          const dy = dt * d.v; if (dy > d.fall) continue;
          const y = d.y - dy, x = d.x - dy * wind;
          ctx.strokeStyle = col; ctx.globalAlpha = d.a; ctx.lineWidth = d.w;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - d.len * wind, y - d.len); ctx.stroke();
        } else if (d.hit && -dt < 520) {                   // onda en el punto de impacto
          const p = -dt / 520;
          ctx.strokeStyle = ring; ctx.globalAlpha = 1 - p; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(d.x, d.y, 4 + p * 46, (4 + p * 46) * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (t < FX_RAIN.total) requestAnimationFrame(frame); else res();
    };
    requestAnimationFrame(frame);
  });
  await fxDone(flood);
}
