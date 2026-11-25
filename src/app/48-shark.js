/* Megalodon · megalodón 3D del hero de inicio, en WebGL2 puro (sin dependencias ni red).
   Malla procedural: cuerpo solevado por secciones, aletas con perfil alar, boca construida según la anatomía
   documentada (arcos de mandíbula con encía, palatocuadrado que protruye, 26 + 24 dientes aserrados) y mordisco
   con la secuencia de Tricas (1985) a cámara lenta. Nado carangiforme en el vertex shader, piel con contrasombreado,
   dentículos, branquias y cáusticas; agua con absorción por canal, rayos de luz con sombra del tiburón y nieve marina.
   Vista «Plano técnico»: escaneo de cabeza a cola con cotas anatómicas que siguen al animal.
   Todo vive en su propio ámbito: SHARK.mount(slot) devuelve la función de desmontaje para el enrutador. */
const SHARK = (() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const sstep = (a, b, x) => smooth((x - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/* ======================= 1. Anatomía (fracciones de la longitud L = 1) ======================= */
function curve(us, vs) {                                   // Hermite con tangentes centradas
  const n = us.length, m = vs.map((_, i) => {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    return (vs[b] - vs[a]) / (us[b] - us[a]);
  });
  return u => {
    u = clamp(u, us[0], us[n - 1]);
    let i = 0; while (i < n - 2 && u > us[i + 1]) i++;
    const h = us[i + 1] - us[i], t = (u - us[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * vs[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * vs[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
// Perfil lamniforme: hocico cónico, tronco fusiforme alto, pedúnculo estrecho con quilla lateral.
const U  = [0, .008, .025, .05, .09, .14, .2, .28, .36, .46, .58, .7, .8, .87, .925];
const HT = curve(U, [0, .011, .025, .04, .056, .072, .086, .098, .103, .098, .078, .05, .028, .016, .011]);
const HB = curve(U, [0, .008, .02, .033, .049, .067, .083, .096, .099, .092, .07, .043, .024, .013, .009]);
const WD = curve(U, [0, .011, .026, .041, .057, .072, .084, .093, .095, .088, .068, .044, .026, .016, .011]);
const ZC = u => .009 * Math.pow(Math.max(0, 1 - u / .22), 2) - .005 * Math.exp(-(((u - .42) / .22) ** 2));
const KEEL = u => .0042 * sstep(.8, .865, u);
const sgnpow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
const wrapPi = p => p > Math.PI ? p - TAU : p < -Math.PI ? p + TAU : p;

function bodyPt(u, phi) {                                   // phi = 0 lomo, ±π vientre, + flanco derecho (z+)
  const c = ZC(u), cs = Math.cos(phi), sn = Math.sin(phi);
  const y = c + (cs >= 0 ? HT(u) : HB(u)) * sgnpow(cs, .86);
  let z = WD(u) * sgnpow(sn, .86);
  const k = KEEL(u);
  if (k) z += Math.sign(sn) * k * Math.exp(-(((Math.abs(wrapPi(phi)) - Math.PI / 2) / .2) ** 2));
  return [.5 - u, y, z];
}
const center = u => [.5 - u, ZC(u), 0];

// Boca: línea de la boca en ángulo phiM(u). Delante de UF no hay boca; detrás de UC es una costura soldada.
const UF = .04, UC = .148, PM = 2.02;
const phiM = u => u <= UF ? Math.PI : u >= UC ? PM : PM + (Math.PI - PM) * (1 - Math.sqrt((u - UF) / (UC - UF)));
const HINGE_U = UC + .014, HINGE = [.5 - HINGE_U, ZC(HINGE_U) - .3 * HB(HINGE_U)];

/* ======================= 2. Malla ======================= */
// Vértice: pos3 · normal3 · P4 (parámetros de superficie) · Q4 (mandíbula, labio, distancia al labio, flexión) · material
const STRIDE = 15;
const VB = [], IB = [];
function vert(p, n, P, Q, mat) { VB.push(p[0], p[1], p[2], n[0], n[1], n[2], P[0], P[1], P[2], P[3], Q[0], Q[1], Q[2], Q[3], mat); return VB.length / STRIDE - 1; }
const vpos = i => [VB[i * STRIDE], VB[i * STRIDE + 1], VB[i * STRIDE + 2]];
const vnrm = i => [VB[i * STRIDE + 3], VB[i * STRIDE + 4], VB[i * STRIDE + 5]];
function tri(a, b, c) {                                     // garantiza el sentido antihorario hacia fuera (gl_FrontFacing = piel)
  const g = cross(sub(vpos(b), vpos(a)), sub(vpos(c), vpos(a)));
  const n = add(add(vnrm(a), vnrm(b)), vnrm(c));
  if (dot(g, n) < 0) IB.push(a, c, b); else IB.push(a, b, c);
}

function bodyNormal(u, phi) {
  const e = 1e-4, uu = Math.max(u, .0016);
  const du = sub(bodyPt(uu + e, phi), bodyPt(uu - e, phi));
  const dp = sub(bodyPt(uu, phi + e), bodyPt(uu, phi - e));
  let n = norm(cross(du, dp));
  if (dot(n, sub(bodyPt(uu, phi), center(uu))) < 0) n = mul(n, -1);
  return n;
}

function buildBody() {
  const NS = 230, NU = 76, NL = 36, UEND = .925;
  const up = [], lo = [];
  for (let i = 0; i < NS; i++) {
    const u = UEND * Math.pow(i / (NS - 1), 1.22), pm = phiM(u);
    const tipN = i === 0;
    const rowU = [], rowL = [];
    for (let j = 0; j < NU; j++) {
      const phi = -pm + 2 * pm * j / (NU - 1);
      const inJaw = u > UF - .01 && u < UC;
      const lipUp = inJaw ? .22 * Math.exp(-(((pm - Math.abs(phi)) / .2) ** 2)) * (1 - sstep(UC - .03, UC, u)) : 0;
      rowU.push(vert(bodyPt(u, phi), tipN ? [1, 0, 0] : bodyNormal(u, phi), [u, phi, 0, 0], [0, lipUp, u <= UC ? pm - Math.abs(phi) : 9, 0], 0));
    }
    for (let j = 0; j < NL; j++) {
      // detrás de la comisura la costura está soldada: se reutiliza el vértice del lado superior (sin grietas)
      if (u > UC && j === 0) { rowL.push(rowU[NU - 1]); continue; }
      const s = j / (NL - 1), phi = pm + (TAU - 2 * pm) * s, pn = wrapPi(phi);
      const w = u <= UC ? 1 : (1 - sstep(UC, UC + .075, u)) * sstep(0, .28, Math.min(s, 1 - s));
      rowL.push(vert(bodyPt(u, phi), tipN ? [1, 0, 0] : bodyNormal(u, phi), [u, phi, 0, 0], [w, 0, u <= UC ? Math.abs(pn) - pm : 9, 0], 0));
    }
    up.push(rowU); lo.push(rowL);
  }
  for (const g of [up, lo]) for (let i = 0; i < NS - 1; i++) for (let j = 0; j < g[i].length - 1; j++) {
    const a = g[i][j], b = g[i + 1][j], c = g[i + 1][j + 1], d = g[i][j + 1];
    tri(a, b, c); tri(a, c, d);
  }
  // tapa de la cola (queda dentro de la aleta caudal)
  const uE = UEND, cE = vert(center(uE), [-1, 0, 0], [uE, 0, 0, 0], [0, 0, 9, 0], 0);
  for (const row of [up[NS - 1], lo[NS - 1]]) for (let j = 0; j < row.length - 1; j++) tri(cE, row[j + 1], row[j]);
}

/* Aletas: superficie media entre un borde de ataque y uno de salida (Bézier cuadráticas), con perfil alar. */
const bez = (p, t) => { const a = 1 - t; return [a * a * p[0][0] + 2 * a * t * p[1][0] + t * t * p[2][0], a * a * p[0][1] + 2 * a * t * p[1][1] + t * t * p[2][1], a * a * p[0][2] + 2 * a * t * p[1][2] + t * t * p[2][2]]; };
function fin({ le, te, T0, mat, flex = 0, NSs = 30, NC = 20 }) {
  const pn = norm(cross(sub(te[0], le[0]), sub(le[2], le[0])));
  const mid = (s, c) => lerp3(bez(le, s), bez(te, s), c);
  const th = (s, c) => T0 * Math.pow(Math.max(0, 1 - s), .6) * 2.6 * Math.sqrt(Math.max(c, 0)) * Math.max(0, 1 - c);
  const surf = (s, c, sd) => add(mid(s, c), mul(pn, sd * th(s, c) * .5));
  for (const sd of [1, -1]) {
    const g = [];
    // orientación: la normal paramétrica debe apuntar hacia el lado sd del plano
    const e = 1e-3, ref = cross(sub(surf(.31, .4, sd), surf(.29, .4, sd)), sub(surf(.3, .41, sd), surf(.3, .39, sd)));
    const flip = dot(ref, mul(pn, sd)) < 0 ? -1 : 1;
    for (let i = 0; i <= NSs; i++) {
      const s = Math.pow(i / NSs, 1.1), row = [];
      for (let j = 0; j <= NC; j++) {
        const c = (1 - Math.cos(Math.PI * j / NC)) / 2;
        const s0 = clamp(s - e, 0, 1), s1 = clamp(s + e, 0, 1), c0 = clamp(c - e, 0, 1), c1 = clamp(c + e, 0, 1);
        let n = cross(sub(surf(s1, c, sd), surf(s0, c, sd)), sub(surf(s, c1, sd), surf(s, c0, sd)));
        n = Math.hypot(...n) < 1e-12 ? mul(pn, sd) : mul(norm(n), flip);
        const p = surf(s, c, sd);
        row.push(vert(p, n, [.5 - p[0], s, c, 1 - th(s, c) / (T0 * .999)], [0, 0, 9, flex * s], mat));
      }
      g.push(row);
    }
    for (let i = 0; i < NSs; i++) for (let j = 0; j < NC; j++) { const a = g[i][j], b = g[i + 1][j], c = g[i + 1][j + 1], d = g[i][j + 1]; tri(a, b, c); tri(a, c, d); }
  }
}
const inward = (u, phi, k = .82) => lerp3(center(u), bodyPt(u, phi), k);
const X = u => .5 - u;

function buildFins() {
  // Primera dorsal: alta, triangular, borde de salida cóncavo (falcada)
  const tD = u => ZC(u) + HT(u);
  fin({ le: [inward(.335, 0, .85), [X(.37), tD(.37) + .085, 0], [X(.445), tD(.445) + .122, 0]],
        te: [inward(.445, 0, .85), [X(.452), tD(.45) + .035, 0], [X(.445), tD(.445) + .122, 0]], T0: .016, mat: 1, flex: .9 });
  // Segunda dorsal y anal: diminutas
  fin({ le: [inward(.755, 0, .8), [X(.765), tD(.765) + .018, 0], [X(.79), tD(.79) + .026, 0]],
        te: [inward(.79, 0, .8), [X(.792), tD(.79) + .01, 0], [X(.79), tD(.79) + .026, 0]], T0: .006, mat: 1, flex: .6, NSs: 10, NC: 10 });
  const bD = u => ZC(u) - HB(u);
  fin({ le: [inward(.77, Math.PI, .8), [X(.78), bD(.78) - .016, 0], [X(.805), bD(.805) - .024, 0]],
        te: [inward(.805, Math.PI, .8), [X(.806), bD(.805) - .008, 0], [X(.805), bD(.805) - .024, 0]], T0: .006, mat: 5, flex: .6, NSs: 10, NC: 10 });
  for (const sd of [1, -1]) {
    // Pectorales: largas y falcadas, hacia fuera, abajo y atrás
    const p0 = inward(.258, sd * 2.16, .86), q0 = inward(.352, sd * 2.34, .86);
    const tip = add(p0, [-.14, -.095, .15 * sd]);
    fin({ le: [p0, add(p0, [-.004, -.052, .09 * sd]), tip], te: [q0, add(q0, [-.03, -.05, .09 * sd]), tip], T0: .022, mat: 2, flex: -1 });
    // Pélvicas
    const r0 = inward(.565, sd * 2.62, .85), r1 = inward(.615, sd * 2.7, .85), rt = add(r0, [-.068, -.036, .03 * sd]);
    fin({ le: [r0, add(r0, [-.02, -.026, .018 * sd]), rt], te: [r1, add(r1, [-.02, -.012, .012 * sd]), rt], T0: .008, mat: 5, NSs: 14, NC: 12 });
  }
  // Caudal semilunar (lóbulos casi simétricos, el superior algo mayor)
  const fork = [X(.935), ZC(.935) + .002, 0];
  fin({ le: [[X(.858), tD(.858) * .7, 0], [X(.955), .135, 0], [X(1.105), .205, 0]],
        te: [fork, [X(.99), .115, 0], [X(1.105), .205, 0]], T0: .014, mat: 1, flex: .55 });
  fin({ le: [[X(.872), bD(.872) * .7, 0], [X(.948), -.112, 0], [X(1.065), -.158, 0]],
        te: [fork, [X(.972), -.072, 0], [X(1.065), -.158, 0]], T0: .012, mat: 1, flex: .55 });
}

/* ======================= Boca, según la anatomía documentada =======================
   - Abierta, cada mandíbula es un arco en herradura cubierto por una banda gruesa de encía.
   - La mandíbula superior (palatocuadrado) no está soldada al cráneo: al morder protruye hacia delante
     y hacia abajo y deja la encía al descubierto (Tricas 1985; Wilga et al. 2001).
   - Unos 26 dientes funcionales arriba y 24 abajo (≈24 expuestos por mandíbula, Marine Dynamics):
     superiores anchos y aserrados, inferiores estrechos y puntiagudos; detrás, filas de reemplazo tumbadas. */
const MOUTH_MID = [.5 - (UF + UC) / 2 - .015, 0, 0];
const archLip = t => { t = clamp(t, -1, 1); const u = UF + (UC - UF) * Math.abs(t); return bodyPt(u, (t < 0 ? -1 : 1) * phiM(u)); };
const archU = t => UF + (UC - UF) * Math.abs(t);
const GUM = { rh: .0056, rv: .0066 };
const protW = t => 1 - Math.pow(Math.abs(t), 1.6) * .85;   // el frente del palatocuadrado protruye más que las comisuras
// Marco local del arco: T a lo largo del labio, In hacia dentro de la cabeza (contra la normal de la piel),
// Dup sobre la piel, perpendicular al labio y hacia la mandíbula superior.
function archFrame(t) {
  t = clamp(t, -1, 1);
  const P = archLip(t), e = .004, u = archU(t), sd = t < 0 ? -1 : 1;
  const T = norm(sub(archLip(Math.min(1, t + e)), archLip(Math.max(-1, t - e))));
  const n = u <= UF + 1e-6 ? [0, -1, 0] : bodyNormal(u, sd * phiM(u));
  let In = mul(n, -1); In = norm(sub(In, mul(T, dot(In, T))));
  let Dup = norm(cross(T, In));
  // hacia la mandíbula superior: un poco más adelante y por encima de la línea de la boca
  const toUp = sub(bodyPt(Math.max(0, u - .008), sd * Math.max(0, phiM(u) - .12)), P);
  if (dot(Dup, toUp) < 0) Dup = mul(Dup, -1);
  return { P, T, In, Dup, Up: Dup, u };
}
const gumCenter = (f, lower) => add(add(f.P, mul(f.In, GUM.rh * 1.25)), mul(f.Dup, (lower ? -1 : 1) * GUM.rv * .42));
const gumPt = (f, lower, a, k = 1) => add(add(gumCenter(f, lower), mul(f.In, GUM.rh * Math.cos(a) * k)), mul(f.Dup, GUM.rv * Math.sin(a) * k));

function buildMouth() {
  const NT = 121, NA = 28, NR = 22;
  const frames = Array.from({ length: NT }, (_, i) => archFrame(-1 + 2 * i / (NT - 1)));
  for (const lower of [false, true]) {
    const w = lower ? 1 : 0, up = lower ? 0 : 1;
    // 1) encía: tubo elíptico a lo largo del arco
    const g = frames.map((f, i) => Array.from({ length: NA + 1 }, (_, j) => {
      const a = TAU * j / NA, p = gumPt(f, lower, a);
      const n = norm(add(mul(f.In, Math.cos(a) / GUM.rh), mul(f.Up, Math.sin(a) / GUM.rv)));
      return vert(p, n, [f.u, -1 + 2 * i / (NT - 1), j / NA, 0], [w, up * protW(-1 + 2 * i / (NT - 1)), 0, 0], 7);
    }));
    for (let i = 0; i < NT - 1; i++) for (let j = 0; j < NA; j++) { tri(g[i][j], g[i + 1][j], g[i + 1][j + 1]); tri(g[i][j], g[i + 1][j + 1], g[i][j + 1]); }
    // 2) paladar (arriba) o suelo con lengua (abajo): del borde interno de la encía a la garganta
    const uTh = UC + .035, cT = center(uTh);
    const throat = [.5 - uTh, lower ? cT[1] - .5 * HB(uTh) : cT[1] + .3 * HT(uTh), 0];
    const ref = lower ? [0, 1, 0] : [0, -1, 0];   // normales hacia el interior de la boca
    const S = (i, r) => {
      const f = frames[i], tt = -1 + 2 * i / (NT - 1), e0 = gumPt(f, lower, 0), rr = Math.pow(r, .85);
      const p = lerp3(e0, throat, rr);
      const vault = lower ? .0055 * Math.sin(Math.PI * r) * (1 - tt * tt) - .006 * Math.sin(Math.PI * r) * Math.abs(tt)
                          : .011 * Math.sin(Math.PI * r) * Math.sqrt(Math.max(0, 1 - tt * tt));
      return add(p, [0, vault, 0]);
    };
    const s = [];
    for (let i = 0; i < NT; i++) {
      const row = [];
      for (let k = 0; k <= NR; k++) {
        const r = k / NR, p = S(i, r);
        const di = sub(S(Math.min(NT - 1, i + 1), r), S(Math.max(0, i - 1), r)), dr = sub(S(i, Math.min(1, r + .02)), S(i, Math.max(0, r - .02)));
        let n = norm(cross(di, dr)); if (dot(n, ref) < 0) n = mul(n, -1);
        row.push(vert(p, n, [archU(-1 + 2 * i / (NT - 1)), -1 + 2 * i / (NT - 1), r, 1], [w, lower ? 0 : Math.pow(1 - r, 2) * protW(-1 + 2 * i / (NT - 1)), r, 0], 6));
      }
      s.push(row);
    }
    for (let i = 0; i < NT - 1; i++) for (let k = 0; k < NR; k++) { tri(s[i][k], s[i + 1][k], s[i + 1][k + 1]); tri(s[i][k], s[i + 1][k + 1], s[i][k + 1]); }
  }
}

/* Diente: corona triangular con bordes convexos y aserrados, raíz hundida en la encía. */
function tooth(base, A, T, h, b, jawW, lipUp, u, slant, narrow) {
  const N = norm(cross(T, A)), K = 11, o = [];
  const root = add(base, mul(A, -.22 * h));
  const tip = add(add(base, mul(A, h)), mul(T, slant * b));
  const bl = add(root, mul(T, -b / 2)), br = add(root, mul(T, b / 2));
  const edge = (from, out, k) => {
    const t = k / K, p = lerp3(from, tip, t);
    const conv = (narrow ? .03 : .085) * b * Math.sin(Math.PI * Math.pow(t, .8));          // borde convexo
    const zig = (k % 2 && k < K) ? .02 * b * (1 - t * .6) : 0;                            // aserrado fino
    const neck = narrow ? -.12 * b * Math.exp(-(((t - .25) / .12) ** 2)) : 0;               // cuello estrecho de los inferiores
    return [add(p, mul(out, conv + zig + neck)), t];
  };
  for (let k = 0; k <= K; k++) o.push(edge(bl, mul(T, -1), k));
  for (let k = K - 1; k >= 0; k--) o.push(edge(br, T, k));
  for (const sd of [1, -1]) {
    const c = add(add(base, mul(A, h * .3)), mul(N, sd * (narrow ? .2 : .15) * b));
    for (let k = 0; k < o.length - 1; k++) {
      const p1 = o[k][0], p2 = o[k + 1][0];
      const fn = norm(cross(sub(p1, c), sub(p2, c))), nf = dot(fn, mul(N, sd)) < 0 ? mul(fn, -1) : fn;
      const ne = q => norm(add(mul(nf, .55), mul(norm(sub(o[q][0], c)), .45)));
      const Q = [jawW, lipUp, 9, 0];
      tri(vert(c, mul(N, sd), [u, .3, 0, 0], Q, 3), vert(p1, ne(k), [u, o[k][1], 0, 0], Q, 3), vert(p2, ne(k + 1), [u, o[k + 1][1], 0, 0], Q, 3));
    }
  }
}
function buildTeeth() {
  // perfil de tamaños por posición (anterior → comisura); el tercero superior es el diente intermedio, más pequeño
  const UPPER = [1, .98, .72, .94, .9, .86, .8, .74, .67, .6, .52, .45, .38];
  const LOWER = [.9, .94, .92, .9, .86, .8, .74, .67, .6, .52, .45, .38];
  let seed = 41; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - .5;
  for (const lower of [false, true]) for (const sd of [1, -1]) {
    // longitud del arco de un lado, para repartir los dientes sin solaparse
    const M = 240, cum = [0];
    for (let i = 1; i <= M; i++) cum.push(cum[i - 1] + Math.hypot(...sub(gumCenter(archFrame(sd * i / M), lower), gumCenter(archFrame(sd * (i - 1) / M), lower))));
    const len = cum[M], prof = lower ? LOWER : UPPER;
    const share = prof.reduce((a, b) => a + b, 0);
    const tAt = s => { let i = 1; while (i < M && cum[i] < s) i++; return sd * (i - 1 + (s - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1])) / M; };
    let acc = len * .012;
    prof.forEach((f, k) => {
      const slot = len * .976 * f / share;
      const t = tAt(acc + slot / 2); acc += slot;
      const fr = archFrame(t), dist = mul(fr.T, sd);                                         // hacia la comisura
      for (const row of [0, 1]) {
        const a = lower ? (row ? Math.PI / 2 - .75 : Math.PI / 2 + .5) : (row ? -Math.PI / 2 + .75 : -Math.PI / 2 - .5);
        const base = gumPt(fr, lower, a, .82);
        let A = norm(add(add(mul(fr.Dup, lower ? .6 : -.85), [0, lower ? .75 : -.5, 0]), mul(fr.In, -.1)));   // hacia la otra mandíbula, algo hacia fuera
        if (row) A = norm(add(mul(A, .45), mul(fr.In, 1)));                                   // reemplazo: tumbado hacia dentro
        A = norm(sub(A, mul(dist, dot(A, dist))));
        A = norm(add(A, mul(fr.In, rnd() * .1)));
        const sc = (row ? .74 : 1) * (1 + rnd() * .08);
        const bw = slot * (lower ? .68 : .97) * sc, h = bw * (lower ? 1.95 : 1.42) * (k === 2 && !lower ? .92 : 1);
        const slant = lower ? .02 + .1 * k / prof.length : .02 + .5 * Math.pow(k / prof.length, 1.2);
        tooth(base, A, dist, h, bw, lower ? 1 : 0, lower ? 0 : protW(t), fr.u, slant, lower);
      }
    });
  }
}
function buildEyes() {
  const r = .0064;
  for (const sd of [1, -1]) {
    const S = bodyPt(.088, sd * 1.03), n0 = bodyNormal(.088, sd * 1.03), C = sub(S, mul(n0, r * .42));
    const NA = 18, NB = 12, g = [];
    for (let i = 0; i <= NB; i++) { const row = [], th = Math.PI * i / NB; for (let j = 0; j <= NA; j++) { const ph = TAU * j / NA, n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; row.push(vert(add(C, mul(n, r)), n, [.088, 0, 0, 0], [0, 0, 9, 0], 4)); } g.push(row); }
    for (let i = 0; i < NB; i++) for (let j = 0; j < NA; j++) { tri(g[i][j], g[i + 1][j], g[i + 1][j + 1]); tri(g[i][j], g[i + 1][j + 1], g[i][j + 1]); }
  }
}
// la malla se construye al montar por primera vez (ver ensureGL), no al cargar la página

/* Puntos anatómicos para las cotas del plano técnico (posición en reposo + peso de mandíbula) */
const tD0 = u => ZC(u) + HT(u);
const ANCHORS = [
  { id: 'hoc', p: bodyPt(.03, 1.75), w: 0, t: ['Hocico', 'ampollas de Lorenzini'] },
  { id: 'ojo', p: bodyPt(.088, 1.03), w: 0, t: ['Ojo', 'tapetum lucidum'] },
  { id: 'die', p: lerp3(bodyPt(.1, phiM(.1)), center(.1), .1), w: 1, t: ['Dientes aserrados', '2 filas · reemplazo continuo'], te: ['Serrated teeth', '2 rows · constant replacement'] },
  { id: 'bra', p: bodyPt(.215, 1.45), w: 0, t: ['Hendiduras branquiales', '5 por lado'], te: ['Gill slits', '5 per side'] },
  { id: 'dor', p: [X(.445), tD0(.445) + .122, 0], w: 0, t: ['Primera dorsal', 'estabiliza el balanceo'], te: ['First dorsal', 'steadies the roll'] },
  { id: 'pec', p: add(inward(.258, 2.16, .86), [-.14, -.095, .15]), w: 0, t: ['Aleta pectoral', 'sustentación y giro'], te: ['Pectoral fin', 'lift and turning'] },
  { id: 'qui', p: bodyPt(.875, Math.PI / 2), w: 0, t: ['Quilla del pedúnculo', 'reduce la resistencia'], te: ['Caudal keel', 'cuts drag'] },
  { id: 'cau', p: [X(1.105), .205, 0], w: 0, t: ['Caudal semilunar', 'nado carangiforme'], te: ['Lunate tail', 'carangiform swimming'] },
];


/* ======================= 3. WebGL2 ======================= */
let cv = null, gl = null, svg = null, host = null;   // se asignan al montar

const GLSL_COMMON = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 w = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), w.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), w.x), w.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; } return s; }
`;
const GLSL_WATER = `
uniform vec3 uDeep, uShallow, uSunDir, uSunCol, uSigma;
uniform float uTime, uBlue, uSurfY;
vec3 waterCol(vec3 d){
  float up = d.y;
  vec3 c = mix(uDeep * .22, uDeep, smoothstep(-.75, .05, up));
  c = mix(c, uShallow, smoothstep(-.08, .9, up));
  float s = max(dot(d, uSunDir), 0.);
  c += uSunCol * (.05 * pow(s, 6.) + .12 * pow(s, 40.));
  return mix(c, vec3(.010, .034, .078) * (1. + .6 * smoothstep(-.4, .7, up)), uBlue);
}
float caustic(vec2 p, float t){
  float c = 0.;
  for (int k = 0; k < 2; k++){
    float fk = float(k);
    vec2 q = p * (1. + fk * .73) + vec2(t * .07, -t * .05) * (fk > .5 ? -1.4 : 1.);
    q += .38 * vec2(noise(q * .7 + t * .15), noise(q * .7 - t * .15 + 5.3));
    vec2 i = floor(q), f = fract(q); float d1 = 8., d2 = 8.;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash12(i + g), hash12(i + g + 19.7));
      o = .5 + .42 * sin(t * .55 + 6.2831 * o);
      float d = length(g + o - f);
      if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    c += pow(clamp(1. - (d2 - d1) * 2.4, 0., 1.), 7.);
  }
  return c * .6;
}
`;

/* ---- tiburón ---- */
const VS_SHARK = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec4 aP; layout(location=3) in vec4 aQ; layout(location=4) in float aMat;
uniform mat4 uModel, uVP;
uniform float uBeat, uGape, uLift, uProt, uAmp;
uniform vec2 uHinge;
out vec3 vW; out vec3 vN; out vec3 vRN; out vec4 vP; out vec4 vQ; out float vMat; out float vU;
const float K = 6.2831853 / 1.1;
void main(){
  vec3 p = aPos, n = aNrm;
  if (aQ.x > 0.){                                    // mandíbula inferior: giro alrededor de la bisagra
    float a = uGape * aQ.x, c = cos(a), s = sin(a); vec2 d = p.xy - uHinge;
    vec2 r = uHinge + vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
    p.xy = vec2(r.x, min(r.y, p.y));                 // detrás de la bisagra la garganta no sube: solo se distiende
    if (d.x > 0.) n.xy = vec2(c * n.x + s * n.y, -s * n.x + c * n.y);
  }
  float u0 = .5 - aPos.x;
  float hw = (1. - aQ.x) * (1. - smoothstep(.06, .24, u0));
  if (hw > 0.){                                      // el hocico se levanta al morder
    float a = -.2 * uLift * hw, c = cos(a), s = sin(a); vec2 pv = vec2(.26, 0.), d = p.xy - pv;
    p.xy = pv + vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
    n.xy = vec2(c * n.x + s * n.y, -s * n.x + c * n.y);
  }
  p += aQ.y * uProt * vec3(.008, -.0105, 0.);         // protrusión del palatocuadrado: adelante y abajo, enseña la encía
  // nado carangiforme: onda lateral con envolvente creciente hacia la cola
  float u = clamp(.5 - p.x, 0., 1.15);
  float ph = K * u - uBeat;
  float A = uAmp * (.004 + .11 * pow(u, 2.6));
  float lat = A * sin(ph) - .004 * uAmp * sin(-uBeat);
  float dA = uAmp * .286 * pow(max(u, 1e-4), 1.6);
  float dl = dA * sin(ph) + A * K * cos(ph);
  float inv = inversesqrt(1. + dl * dl), cs = inv, sn = dl * inv;
  float zl = p.z;
  if (aQ.w > 0.) zl += aQ.w * .012 * uAmp * sin(uBeat - 1.9);          // las aletas verticales ceden con retraso
  if (aQ.w < 0.) p.y += -aQ.w * .006 * sin(uBeat * .5 + 1.);            // aleteo leve de las pectorales
  p = vec3(p.x + zl * sn, p.y, lat + zl * cs);
  n = vec3(n.x * cs + n.z * sn, n.y, -n.x * sn + n.z * cs);
  vec4 w = uModel * vec4(p, 1.);
  vW = w.xyz; vN = normalize(mat3(uModel) * n); vRN = aNrm; vP = aP; vQ = aQ; vMat = aMat; vU = u;
  gl_Position = uVP * w;
}`;
const FS_SHARK = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vRN; in vec4 vP; in vec4 vQ; in float vMat; in float vU;
uniform vec3 uCam, uBpLine, uAcc;
uniform float uScan, uEnc, uAmbK, uEye;
out vec4 o;
${GLSL_COMMON}
${GLSL_WATER}
vec3 bump(vec3 N, vec3 pos, float h){
  vec3 dpx = dFdx(pos), dpy = dFdy(pos); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx); float det = dot(dpx, r1);
  if (abs(det) < 1e-12) return N;
  vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - g);
}
float line(float x, float w){ float f = abs(fract(x - .5) - .5), d = fwidth(x); return 1. - smoothstep(w * d, (w + 1.2) * d, f); }
float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float gills(float u, float a, out float h){
  float g = 0.; h = 0.;
  for (int k = 0; k < 5; k++){
    float fk = float(k), t = (a - .8) / 1.3, len = k == 4 ? .8 : 1.;
    float m = smoothstep(0., .1, t) * (1. - smoothstep(len - .12, len, t));
    float ul = .185 + fk * .0172 + .0078 * sin(clamp(t, 0., 1.) * 3.1416) + .004 * t;
    float d = u - ul, w = .0009 + .0006 * m;
    g = max(g, m * (1. - smoothstep(w * .3, w, abs(d))));
    h += m * (.9 * exp(-pow((d - .0032) / .0032, 2.)) - .7 * exp(-pow(d / .0011, 2.)));
  }
  return g;
}
vec3 shade(vec3 alb, vec3 N, vec3 V, float rough, float f0, float sss, float ck){
  vec3 L = uSunDir;
  vec3 sun = uSunCol * .72 * exp(-uSigma * max(uSurfY - vW.y, 0.) * .9);
  float ndl = dot(N, L);
  float wrap = clamp((ndl + .3) / 1.3, 0., 1.);
  float c = caustic(vW.xz * 5.2 + vW.y * 1.4, uTime) * smoothstep(-.2, .85, N.y) * ck;
  vec3 amb = mix(uDeep * 1.4 + uShallow * .25, uShallow * 1.3, clamp(N.y * .5 + .5, 0., 1.)) * uAmbK;   // el agua dispersa luz desde todas partes
  amb = mix(amb, vec3(dot(amb, vec3(.3, .5, .2))), .45);
  vec3 col = alb * (sun * wrap * (1. + 2.4 * c) + amb);
  vec3 H = normalize(L + V);
  float nl = max(ndl, 0.), nv = max(dot(N, V), 1e-3), nh = max(dot(N, H), 0.), vh = max(dot(V, H), 0.);
  float a = rough * rough, a2 = a * a, dd = nh * nh * (a2 - 1.) + 1.;
  float D = a2 / (3.14159 * dd * dd), k = (rough + 1.) * (rough + 1.) / 8.;
  float G = (nl / (nl * (1. - k) + k)) * (nv / (nv * (1. - k) + k));
  float F = f0 + (1. - f0) * pow(1. - vh, 5.);
  col += sun * min(D * G * F / (4. * nv * max(nl, 1e-3) + 1e-4), 24.) * nl * (1. + 1.6 * c);
  float fr = f0 + (1. - f0) * pow(1. - nv, 5.);
  vec3 R = reflect(-V, N);
  col += mix(uDeep, uShallow * 1.7, smoothstep(-.3, .9, R.y)) * fr * .55;
  float tr = pow(clamp(dot(V, -L) * .5 + .5, 0., 1.), 3.) * sss;
  col += alb * sun * tr * .55;
  return col;
}
void main(){
  vec3 V = normalize(uCam - vW);
  vec3 N0 = normalize(vN), N = N0;
  int mat = int(vMat + .5);
  float u = vU;
  vec3 alb = vec3(.5); vec3 emit = vec3(0.);
  float rough = .42, f0 = .028, sss = 0., ck = 1., h = 0., bk = 0.;
  bool inside = !gl_FrontFacing && mat == 0;
  if (!gl_FrontFacing) N = -N;
  if (mat == 0 && inside){                            // interior de la boca: encía y paladar
    alb = vec3(.025, .006, .009); rough = .4; ck = 0.;
  } else if (mat == 0){
    float py = mod(vP.y + 3.14159265, 6.2831853) - 3.14159265;   // ángulo envuelto por fragmento
    float a = abs(py), side = py < 0. ? -1. : 1.;
    // límite del contrasombreado: irregular a gran escala, con «llamas» medianas y borde nítido
    float edge = 1.74 + .26 * (fbm(vec2(u * 7., 3.1 + side)) - .5) + .13 * (fbm(vec2(u * 34., 7. + side)) - .5);
    edge -= .14 * exp(-pow((u - .37) / .08, 2.)) - .22 * exp(-pow((u - .1) / .06, 2.)) - .08 * smoothstep(.75, .9, u);
    float ew = fwidth(a) * 1.5 + .006;
    float ven = smoothstep(edge - ew, edge + ew, a);
    vec3 dors = vec3(.085, .092, .1) * (.78 + .44 * fbm(vec2(u * 30., py * 5.)));
    dors = mix(dors, vec3(.11, .1, .092), .35 * fbm(vec2(u * 6., py * 2.) + 4.));
    dors *= 1. + .35 * smoothstep(.6, 1.7, a);                                  // aclara hacia el flanco
    vec3 belly = vec3(.84, .85, .84) * (.92 + .08 * fbm(vec2(u * 28., py * 9.)));
    alb = mix(dors, belly, ven);
    alb *= 1. - .18 * exp(-pow((a - edge + .1) / .12, 2.)) * (1. - ven);    // el gris se oscurece justo encima del límite
    float gh, g = gills(u, a, gh);
    alb = mix(alb, vec3(.025, .015, .02), g); h += gh;
    vec2 ep = vec2(u - .088, (a - 1.03) * .058);                       // cuenca del ojo
    float ed = length(ep);
    alb *= 1. - .4 * exp(-pow((ed - .0088) / .003, 2.)); h += .6 * exp(-pow((ed - .009) / .0035, 2.));
    if (u < .1){                                                        // ampollas de Lorenzini y narina
      vec2 q = vec2(u * 520., py * 34.), id = floor(q), f = fract(q) - .5;
      float r = hash12(id + side * 13.);
      float pore = step(.72, r) * (1. - smoothstep(.06, .13, length(f + (vec2(hash12(id + 3.), hash12(id + 7.)) - .5) * .5)));
      float m = smoothstep(.1, .03, u) * smoothstep(1.,  1.4, a);
      alb *= 1. - .35 * pore * m; h -= pore * m * .4;
      float nd = length(vec2((u - .029) / .0075, (a - 2.25) / .085));
      alb = mix(alb, vec3(.02), 1. - smoothstep(.6, 1., nd));
    }
    float sc = 1.;                                                       // cicatrices de viejas peleas
    vec2 pp = vec2(u, a * .06);
    sc = min(sc, segD(pp, vec2(.31, 1.0 * .06), vec2(.37, 1.22 * .06)));
    sc = min(sc, segD(pp, vec2(.43, .62 * .06), vec2(.475, .74 * .06)));
    sc = min(sc, segD(pp, vec2(.225, .52 * .06), vec2(.255, .43 * .06)));
    sc = min(sc, segD(pp, vec2(.53, 1.28 * .06), vec2(.585, 1.42 * .06)));
    sc = min(sc, segD(pp, vec2(.125, .72 * .06), vec2(.14, .95 * .06)));
    float scar = (1. - smoothstep(.0007, .0016, sc)) * (side > 0. ? 1. : .6);
    alb = mix(alb, vec3(.3, .31, .33), scar * .4 * (1. - ven)); h += scar * .35;
    float fade = 1. - clamp(max(fwidth(u * 260.), fwidth(py * 520.)) * .8, 0., 1.);
    h += fade * .22 * (noise(vec2(u * 260., py * 520.)) - .5);        // dentículos dérmicos
    h += .4 * (fbm(vec2(u * 42., py * 16.)) - .5) * (1. - clamp(fwidth(u * 42.) * 2., 0., 1.));                    // relieve muscular
    h += .25 * sin(u * 190. - a * 9.) * smoothstep(.3, .45, u) * (1. - smoothstep(.85, .9, u)) * fade; // miómeros
    bk = .0013;
    rough = mix(.34, .5, ven); sss = .12 * ven;
  } else if (mat == 1 || mat == 2 || mat == 5){
    vec3 dark = vec3(.12, .145, .165) * (.82 + .35 * fbm(vP.yz * vec2(10., 7.) + vP.x * 3.));
    vec3 light = vec3(.79, .8, .79);
    alb = dark;
    if (mat == 2 && vRN.y < -.05) alb = mix(light, vec3(.035), smoothstep(.74, .9, vP.y));   // punta negra bajo la pectoral
    if (mat == 5) alb = mix(light, dark, .45);
    float thin = clamp(vP.w, 0., 1.);
    alb = mix(alb, alb * 1.35 + .02, smoothstep(.55, 1., thin) * .5);
    sss = thin * (mat == 5 ? .35 : .9); rough = .4;
    h = .5 * (fbm(vec2(vP.y * 26., vP.z * 50.)) - .5) + .3 * sin(vP.z * 120. + vP.y * 8.) * .2; bk = .0008;
  } else if (mat == 7){                               // encía: banda gruesa, rosada y húmeda
    vec3 gum = vec3(.78, .33, .36) * (.88 + .24 * fbm(vec2(vP.y * 90., vP.z * 6.)));
    float crev = pow(abs(sin(vP.y * 3.14159 * 13.)), 6.) * .25;              // surcos entre dientes
    alb = gum * (1. - crev);
    h = .5 * fbm(vec2(vP.y * 160., vP.z * 9.)) + crev; bk = .0009;
    rough = .26; f0 = .03; sss = .9; ck = .35;
  } else if (mat == 6){                               // paladar y suelo de la boca: carne roja, garganta negra
    float r = vQ.z;
    alb = mix(vec3(.62, .2, .23), vec3(.3, .045, .06), smoothstep(.05, .55, r));
    alb *= .84 + .16 * sin(r * 70. + vP.y * 3.);                              // pliegues transversales del paladar
    alb = mix(alb, vec3(.012, .002, .004), smoothstep(.55, .98, r));
    h = .5 * fbm(vec2(vP.y * 60., r * 18.)) + .35 * sin(r * 70. + vP.y * 3.); bk = .0008;
    rough = .22; f0 = .03; sss = .6; ck = .1;
  } else if (mat == 3){
    float t = vP.y;
    alb = mix(vec3(.62, .55, .44), vec3(.95, .94, .9), smoothstep(.16, .55, t));
    alb = mix(alb, vec3(.78, .83, .85), smoothstep(.86, 1., t) * .5);        // punta translúcida
    alb = mix(alb, vec3(.55, .2, .22), 1. - smoothstep(.1, .2, t));          // donde la encía la abraza
    rough = .17; f0 = .05; sss = .4 + .8 * t; ck = .3;
  } else {
    // ojo: al morder rota hacia atrás y deja ver el tejido blanco que lo protege
    alb = mix(vec3(.01), vec3(.72, .7, .66), uEye); rough = mix(.07, .35, uEye); f0 = .06; ck = .2;
    emit = vec3(.03, .22, .15) * pow(max(dot(N, V), 0.), 5.) * .8 * (1. - uEye);   // brillo del tapetum
  }
  if (bk > 0.) N = bump(N, vW, h * bk);
  vec3 col = shade(alb, N, V, rough, f0, sss, ck) + emit;
  if (mat == 6 || mat == 7) col += alb * vec3(.55, .22, .22) * .5 * (mat == 6 ? 1. - smoothstep(.2, .9, vQ.z) : 1.);   // luz que entra y se dispersa en la boca
  if (mat == 6) col *= mix(1.1, .3, smoothstep(.15, .95, vQ.z));                          // oclusión hacia la garganta
  // absorción del agua por canal (Beer-Lambert) y luz dispersada
  vec3 T = exp(-uSigma * length(uCam - vW));
  col = col * T + waterCol(-V) * (1. - T);
  // plano técnico: barrido de escáner de la cabeza a la cola
  if (uBlue > 0.){
    float m = smoothstep(uScan + .006, uScan - .006, u);
    float l = 0.;
    if (mat == 0) l = max(max(line(u * 40., .5) * .4, line(u * 10., .9)), line(vP.y * 3.8197, .5) * .55);
    else if (mat == 3) l = .7;
    else if (mat == 6 || mat == 7) l = line(vP.y * 12., .5);
    else if (mat == 4) l = 1.;
    else l = max(line(vP.y * 8., .5), line(vP.z * 6., .5)) * .6;
    float rim = pow(1. - abs(dot(N0, V)), 2.4);
    vec3 bp = vec3(.01, .04, .09) + uBpLine * (l * .85 + rim * 1.2) + uBpLine * .06 * max(dot(N, uSunDir), 0.);
    if (inside || mat == 6 || mat == 7) bp = vec3(.004, .015, .035) + uBpLine * l * .25;
    col = mix(col, bp, m * uBlue);
    col += uAcc * exp(-abs(u - uScan) * 240.) * 2.2 * step(.002, uBlue) * step(uBlue, .998);
  }
  o = vec4(col * uEnc, 1.);
}`;

/* ---- fondo ---- */
const VS_FULL = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
out vec2 vUv;
void main(){ vec2 p = P[gl_VertexID]; vUv = p * .5 + .5; gl_Position = vec4(p, 0, 1); }`;
const FS_BG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec3 uRight, uUp, uFwd;
uniform vec2 uTan, uShift;
uniform float uEnc;
out vec4 o;
${GLSL_COMMON}
${GLSL_WATER}
void main(){
  vec2 nd = vUv * 2. - 1.;
  vec3 d = normalize(uFwd + uRight * (nd.x - uShift.x) * uTan.x + uUp * (nd.y - uShift.y) * uTan.y);
  vec3 c = waterCol(d);
  // superficie lejana: ondulación brillante cuando se mira hacia arriba
  float up = d.y;
  if (up > .2){
    vec2 sp = d.xz / up * 1.6;
    float r = fbm(sp * 2.2 + vec2(uTime * .05, -uTime * .04));
    c += mix(uShallow, uSunCol * .2, .4) * smoothstep(.25, .9, up) * (.25 + .9 * pow(r, 3.)) * (1. - uBlue);
  }
  // partículas muy lejanas y turbidez
  c *= .92 + .16 * fbm(nd * vec2(3., 2.) + uTime * .01);
  o = vec4(c * uEnc, 0.);
}`;

/* ---- nieve marina ---- */
const VS_SNOW = `#version 300 es
layout(location=0) in vec4 aSeed;
uniform mat4 uView, uProj;
uniform float uTime, uPx, uFocus, uAperture, uBlue;
uniform vec3 uBox, uCenter, uFlow;
out float vA; out float vB;
void main(){
  vec3 p = aSeed.xyz * uBox + uFlow * uTime + vec3(sin(uTime * .31 + aSeed.w * 40.), sin(uTime * .23 + aSeed.w * 17.), cos(uTime * .27 + aSeed.w * 23.)) * .012;
  p = mod(p, uBox) - uBox * .5 + uCenter;
  vec4 v = uView * vec4(p, 1.);
  float z = max(-v.z, .02);
  float r = .0012 + .0034 * aSeed.w * aSeed.w;
  float coc = abs(z - uFocus) * uAperture;
  float px = uPx * (r + coc) / z;
  gl_PointSize = mix(clamp(px * 2., 1.5, 90.), clamp(uPx * .006 / z, 4., 11.), uBlue);
  vA = clamp(r * r / ((r + coc) * (r + coc)), .015, 1.) * smoothstep(.06, .35, z) * (.35 + .65 * fract(aSeed.w * 7.31));
  vB = smoothstep(-.7, .9, p.y);
  gl_Position = uProj * v;
}`;
const FS_SNOW = `#version 300 es
precision highp float;
in float vA; in float vB;
uniform vec3 uSnow, uAcc;
uniform float uBlue, uEnc;
out vec4 o;
void main(){
  vec2 q = gl_PointCoord * 2. - 1.;
  float d = dot(q, q);
  vec3 c = uSnow * (.35 + .9 * vB) * exp(-d * 3.2) * vA * step(d, 1.);
  float sq = max(abs(q.x), abs(q.y));
  float box = smoothstep(.55, .66, sq) * (1. - smoothstep(.84, .95, sq));
  c = mix(c, uAcc * box * .55 * (.4 + .6 * vB), uBlue);
  o = vec4(c * uEnc, 0.);
}`;

/* ---- posproceso ---- */
const FS_BRIGHT = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uEnc; out vec4 o;
void main(){
  vec3 c = vec3(0.);
  c += texture(uTex, vUv + uTexel * vec2(-1, -1)).rgb; c += texture(uTex, vUv + uTexel * vec2(1, -1)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(-1, 1)).rgb;  c += texture(uTex, vUv + uTexel * vec2(1, 1)).rgb;
  c = c * .25 / uEnc;
  float l = dot(c, vec3(.2126, .7152, .0722));
  o = vec4(c * smoothstep(.55, 1.6, l) * uEnc, 1.);
}`;
const FS_BLUR = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv).rgb * .2270270270;
  c += (texture(uTex, vUv + uDir * 1.3846153846).rgb + texture(uTex, vUv - uDir * 1.3846153846).rgb) * .3162162162;
  c += (texture(uTex, vUv + uDir * 3.2307692308).rgb + texture(uTex, vUv - uDir * 3.2307692308).rgb) * .0702702703;
  o = vec4(c, 1.);
}`;
const FS_COMP = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes, uSunSS;
uniform float uTime, uBlue, uExposure, uEnc, uDpr, uShaft;
uniform vec3 uShaftCol, uBpLine;
out vec4 o;
${GLSL_COMMON}
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
float gl1(float x, float w){ float f = abs(fract(x - .5) - .5); return 1. - smoothstep(w * .5, w * .5 + 1., f); }
void main(){
  vec4 s = texture(uScene, vUv);
  vec3 col = s.rgb / uEnc;
  vec2 asp = vec2(uRes.x / uRes.y, 1.);
  // rayos de luz: abanico desde el sol, con sombra volumétrica del tiburón
  vec2 d = (vUv - uSunSS) * asp;
  float ang = atan(d.x, -d.y);
  float sh = noise(vec2(ang * 11., uTime * .045)) * .62 + noise(vec2(ang * 29. + 4., uTime * .08)) * .38;
  sh = pow(sh, 2.4) * 2.6;
  float dist = length(d);
  float fall = exp(-max(dist - .45, 0.) * 1.15);
  float occ = 0.; vec2 stp = (uSunSS - vUv) * (.4 / 20.), p = vUv;
  for (int i = 0; i < 20; i++){ p += stp; vec2 q = clamp(p, 0., 1.); occ += texture(uScene, q).a * step(p.y, 1.); }
  float vis = 1. - .88 * occ / 20.;
  col += uShaftCol * uShaft * sh * fall * vis * mix(1., .45, s.a) * (1. - .7 * uBlue);
  col += texture(uBloom, vUv).rgb / uEnc * .6;
  vec3 g = aces(col * uExposure);
  if (uBlue > 0.){
    float lum = dot(g, vec3(.3, .55, .15));
    g = mix(g, mix(vec3(.012, .045, .1), vec3(.66, .88, 1.), lum), uBlue * .5);

  }
  vec2 q = (vUv - .5) * asp;
  g *= 1. - .32 * dot(q, q) * .9;
  g = pow(g, vec3(1. / 2.2));
  g += (hash12(vUv * uRes + fract(uTime * 7.) * 91.) - .5) * .022;
  o = vec4(g, 1.);
}`;

function compile(vs, fs, name) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(name + ': ' + gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ': ' + gl.getProgramInfoLog(p));
  const cache = {};
  const loc = n => n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n));
  return {
    p, use() { gl.useProgram(p); return this; },
    f(n, ...v) { const l = loc(n); if (l) gl['uniform' + v.length + 'f'](l, ...v); return this; },
    v3(n, a) { const l = loc(n); if (l) gl.uniform3fv(l, a); return this; },
    m4(n, m) { const l = loc(n); if (l) gl.uniformMatrix4fv(l, false, m); return this; },
    i(n, v) { const l = loc(n); if (l) gl.uniform1i(l, v); return this; },
  };
}

let P, sharkVAO, sharkCount, snowVAO, SNOW_N, hdr, enc, T = {};
function initGL() {
  const ext = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  hdr = !!ext; enc = hdr ? 1 : .35;
  P = {
    shark: compile(VS_SHARK, FS_SHARK, 'shark'), bg: compile(VS_FULL, FS_BG, 'bg'), snow: compile(VS_SNOW, FS_SNOW, 'snow'),
    bright: compile(VS_FULL, FS_BRIGHT, 'bright'), blur: compile(VS_FULL, FS_BLUR, 'blur'), comp: compile(VS_FULL, FS_COMP, 'comp'),
  };
  sharkVAO = gl.createVertexArray(); gl.bindVertexArray(sharkVAO);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(VB), gl.STATIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(IB), gl.STATIC_DRAW);
  const S = STRIDE * 4;
  [[0, 3, 0], [1, 3, 3], [2, 4, 6], [3, 4, 10], [4, 1, 14]].forEach(([l, n, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, S, o * 4); });
  sharkCount = IB.length;
  SNOW_N = 1600;
  const seeds = new Float32Array(SNOW_N * 4); let r = 11;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
  snowVAO = gl.createVertexArray(); gl.bindVertexArray(snowVAO);
  const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
  gl.bindVertexArray(null);
  T = {};
}
function texTarget(w, h, fmt) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt === 'f' ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, fmt === 'f' ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, fb, w, h };
}
function freeTargets() {
  for (const k in T) { const o = T[k]; if (o.t) gl.deleteTexture(o.t); if (o.fb) gl.deleteFramebuffer(o.fb); if (o.rb) o.rb.forEach(r => gl.deleteRenderbuffer(r)); }
  T = {};
}
function makeTargets(w, h) {
  freeTargets();
  const fmt = hdr ? 'f' : 'b';
  const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
  const ms = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
  const rc = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rc);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, hdr ? gl.RGBA16F : gl.RGBA8, w, h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rc);
  const rd = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rd);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rd);
  T.ms = { fb: ms, rb: [rc, rd], w, h };
  T.scene = texTarget(w, h, fmt);
  const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
  T.b1 = texTarget(bw, bh, fmt); T.b2 = texTarget(bw, bh, fmt);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}


/* ======================= 4. Escena, cámara y estado ======================= */
const M4 = {
  persp(fy, asp, n, f, sx, sy) { const t = 1 / Math.tan(fy / 2), nf = 1 / (n - f); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, -sx, -sy, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]); },
  look(e, t, up) { const f = norm(sub(t, e)), r = norm(cross(f, up)), u = cross(r, f); return new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, e), -dot(u, e), dot(f, e), 1]); },
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  xf(m, p) { const x = p[0], y = p[1], z = p[2]; return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]]; },
};
function model(yaw, pitch, roll, pos) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Ry · Rz · Rx (columnas)
  const Rz = [[cp, sp, 0], [-sp, cp, 0], [0, 0, 1]], Rx = [[1, 0, 0], [0, cr, sr], [0, -sr, cr]];
  const ry = v => [cy * v[0] + sy * v[2], v[1], -sy * v[0] + cy * v[2]];
  const rz = v => [Rz[0][0] * v[0] + Rz[1][0] * v[1], Rz[0][1] * v[0] + Rz[1][1] * v[1], v[2]];
  const rx = v => [v[0], Rx[1][1] * v[1] + Rx[2][1] * v[2], Rx[1][2] * v[1] + Rx[2][2] * v[2]];
  const R = v => ry(rz(rx(v)));
  const c0 = R([1, 0, 0]), c1 = R([0, 1, 0]), c2 = R([0, 0, 1]);
  return new Float32Array([...c0, 0, ...c1, 0, ...c2, 0, ...pos, 1]);
}
const THEMES = {
  dark:  { deep: [.005, .026, .05], shallow: [.03, .17, .25], sun: [3.6, 3.9, 3.8], sigma: [.34, .13, .085], snow: [.42, .62, .7], shaft: [.15, .36, .44], exposure: 1.2, shaftK: .75, amb: 1.5 },
  light: { deep: [.03, .24, .33], shallow: [.36, .78, .84], sun: [4.4, 4.7, 4.4], sigma: [.24, .08, .06], snow: [.75, .95, .95], shaft: [.45, .8, .8], exposure: .78, shaftK: .55, amb: .62 },
};
const ACC = [.12, .83, .54], BPL = [.5, .78, 1];
const SUN = norm([.22, 1, .32]);
const OMEGA = TAU * .42, BITEP = 11, BITE_START = 6.4, BITE = BITE_START + 1.05;   // BITE: instante de boca abierta del todo
const st = { t: 0, mix: 0, mixTo: 0, mixV: 0, blue: 0, blueTo: 0, px: 0, py: 0, tx: 0, ty: 0 };   // el hero es siempre oscuro

/* Mordisco según Tricas (1985): elevación del hocico + descenso de la mandíbula (apertura máxima a 0,167 s),
   protrusión del palatocuadrado mientras se cierra (máximo a 0,307 s), cierre a 0,443 s y bajada del hocico.
   Aquí va a cámara lenta (×4,5) con una pausa breve en la apertura máxima para que se vea la dentadura. */
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3), easeIO = x => { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
function biteState(t) {
  const d = ((t - BITE_START) % BITEP + BITEP) % BITEP;
  const open = easeOut(d / .75) * (1 - easeIO((d - 1.3) / 1.1));
  const lift = easeOut(d / .7) * (1 - easeIO((d - 2.6) / 1.8));
  const prot = easeOut((d - 1.3) / .7) * (1 - easeIO((d - 2.7) / 1.5));
  const shake = d > 2 && d < 3.4 ? Math.sin((d - 2) * TAU * 3.2) * Math.exp(-(d - 2) * 1.8) : 0;
  const eye = sstep(.1, .45, d) * (1 - sstep(2.8, 3.5, d));
  return { open, lift, prot, shake, eye };
}
let W = 1, H = 1, DPR = 1, quality = 1, NARROW = false;
function frameState(t) {
  const B = biteState(t), b = B.lift;
  const s = {
    t, lift: B.lift, prot: B.prot, eye: B.eye, beat: OMEGA * t,
    gape: .095 + .025 * (.5 + .5 * Math.sin(t * 1.1)) + .56 * B.open,
    yaw: -2.3 + .06 * Math.sin(t * .21) + .015 * Math.sin(OMEGA * t) + st.px * .1 + .045 * B.shake,
    pitch: .2 + .05 * Math.sin(t * .17 + 1) + .07 * b + st.py * .06,
    roll: -.12 + .05 * Math.sin(t * .13),
  };
  const head = [Math.cos(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.sin(s.yaw) * Math.cos(s.pitch)];
  s.head = head;
  s.pos = add(mul(head, .05 * b), [0, .018 * Math.sin(t * .3), 0]);
  s.M = model(s.yaw, s.pitch, s.roll, s.pos);
  // cámara: ligeramente por debajo, con paralaje del puntero
  const az = .02 + st.px * .07, el = -.13 + st.py * .05, dist = NARROW ? 1.4 : 1.6;
  const tgt = [.04, NARROW ? .02 : .0, 0];
  s.cam = add(tgt, [Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist]);
  s.V = M4.look(s.cam, tgt, [0, 1, 0]);
  const fov = .56, asp = W / H;
  s.shift = NARROW ? [.1, -.04] : [.34, .02];
  s.P = M4.persp(fov, asp, .02, 30, s.shift[0], s.shift[1]);
  s.VP = M4.mul(s.P, s.V);
  s.tan = [Math.tan(fov / 2) * asp, Math.tan(fov / 2)];
  const f = norm(sub(tgt, s.cam)), r = norm(cross(f, [0, 1, 0]));
  s.basis = { f, r, u: cross(r, f) };
  return s;
}
const pal = () => { const a = THEMES.dark, b = THEMES.light, m = st.mix, o = {}; for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], m)) : lerp(a[k], b[k], m); return o; };

/* misma deformación que el vertex shader, para las cotas */
function deformJS(p0, w, s) {
  let [x, y, z] = p0;
  if (w > 0) { const a = s.gape * w, c = Math.cos(a), sn = Math.sin(a), dx = x - HINGE[0], dy = y - HINGE[1]; x = HINGE[0] + c * dx + sn * dy; y = Math.min(y, HINGE[1] - sn * dx + c * dy); }
  const u0 = .5 - p0[0], hw = (1 - w) * (1 - sstep(.06, .24, u0));
  if (hw > 0) { const a = -.2 * s.lift * hw, c = Math.cos(a), sn = Math.sin(a), dx = x - .26, dy = y; x = .26 + c * dx + sn * dy; y = -sn * dx + c * dy; }
  const K = TAU / 1.1, u = clamp(.5 - x, 0, 1.15), ph = K * u - s.beat, A = .004 + .11 * Math.pow(u, 2.6);
  const lat = A * Math.sin(ph) - .004 * Math.sin(-s.beat), dA = .286 * Math.pow(Math.max(u, 1e-4), 1.6), dl = dA * Math.sin(ph) + A * K * Math.cos(ph);
  const inv = 1 / Math.sqrt(1 + dl * dl);
  return [x + z * dl * inv, y, lat + z * inv];
}

/* ======================= 5. Render ======================= */
function resize() {
  const r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
  NARROW = W < 761;
  DPR = Math.min(window.devicePixelRatio || 1, 1.75) * quality;
  const w = Math.max(1, Math.round(W * DPR)), h = Math.max(1, Math.round(H * DPR));
  if (cv.width !== w || cv.height !== h || !T.ms) { cv.width = w; cv.height = h; makeTargets(w, h); }
  if (!running) draw(st.t);
}
function draw(t) {
  if (!T.ms) return;
  const s = frameState(t), C = pal(), w = cv.width, h = cv.height;
  const scan = lerp(-.06, 1.2, smooth(st.blue));
  // 1) escena HDR multimuestreada
  gl.bindFramebuffer(gl.FRAMEBUFFER, T.ms.fb); gl.viewport(0, 0, w, h);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const water = prog => prog.v3('uDeep', C.deep).v3('uShallow', C.shallow).v3('uSunDir', SUN).v3('uSunCol', C.sun).v3('uSigma', C.sigma).f('uTime', t).f('uBlue', smooth(st.blue)).f('uSurfY', 1.3).f('uEnc', enc);
  water(P.bg.use()).v3('uRight', s.basis.r).v3('uUp', s.basis.u).v3('uFwd', s.basis.f).f('uTan', ...s.tan).f('uShift', ...s.shift);
  gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
  water(P.shark.use()).m4('uModel', s.M).m4('uVP', s.VP).f('uBeat', s.beat).f('uGape', s.gape).f('uLift', s.lift).f('uProt', s.prot).f('uEye', s.eye).f('uAmp', 1)
    .f('uHinge', HINGE[0], HINGE[1]).f('uAmbK', C.amb).v3('uCam', s.cam).v3('uBpLine', BPL).v3('uAcc', ACC).f('uScan', scan);
  gl.bindVertexArray(sharkVAO); gl.drawElements(gl.TRIANGLES, sharkCount, gl.UNSIGNED_INT, 0);
  // nieve marina: aditiva, sin escribir profundidad ni alfa (el alfa es la máscara del tiburón)
  gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE); gl.depthMask(false);
  const flow = add(mul(s.head, -.055), [0, -.006, 0]);
  P.snow.use().m4('uView', s.V).m4('uProj', s.P).f('uTime', t).f('uPx', s.P[5] * h / 2).f('uFocus', NARROW ? 2.5 : 1.7).f('uAperture', .018)
    .f('uBox', 3.2, 2.2, 3.2).f('uCenter', s.cam[0] * .5, 0, s.cam[2] * .5 - .1).v3('uFlow', flow).v3('uSnow', C.snow).v3('uAcc', ACC).f('uBlue', smooth(st.blue)).f('uEnc', enc);
  gl.bindVertexArray(snowVAO); gl.drawArrays(gl.POINTS, 0, SNOW_N);
  gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  // 2) resolver el MSAA
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.ms.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.scene.fb);
  gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  // 3) bloom a un cuarto de resolución
  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, T.b1.fb); gl.viewport(0, 0, T.b1.w, T.b1.h);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.scene.t);
  P.bright.use().i('uTex', 0).f('uTexel', 1 / w, 1 / h).f('uEnc', enc); gl.drawArrays(gl.TRIANGLES, 0, 3);
  for (let k = 0; k < 2; k++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.b2.fb); gl.bindTexture(gl.TEXTURE_2D, T.b1.t);
    P.blur.use().i('uTex', 0).f('uDir', (k + 1) / T.b1.w, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.b1.fb); gl.bindTexture(gl.TEXTURE_2D, T.b2.t);
    P.blur.use().i('uTex', 0).f('uDir', 0, (k + 1) / T.b1.h); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // 4) composición final
  const sc = M4.xf(s.VP, add(s.cam, mul(SUN, 20)));
  const sunSS = sc[3] > 0 ? [sc[0] / sc[3] * .5 + .5, sc[1] / sc[3] * .5 + .5] : [.6, 1.8];
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.scene.t);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.b1.t);
  P.comp.use().i('uScene', 0).i('uBloom', 1).f('uRes', w, h).f('uSunSS', sunSS[0], sunSS[1]).f('uTime', t).f('uBlue', smooth(st.blue))
    .f('uExposure', C.exposure).f('uEnc', enc).f('uDpr', DPR).f('uShaft', C.shaftK).v3('uShaftCol', C.shaft).v3('uBpLine', BPL);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.activeTexture(gl.TEXTURE0);
  callouts(s);
}

/* cotas del plano técnico */
const NS_SVG = 'http://www.w3.org/2000/svg';
let calloutNodes = null;
function hideCallouts() { if (calloutNodes) { svg.replaceChildren(); calloutNodes = null; } }
function callouts(s) {
  const show = st.blue > .02;
  host.classList.toggle('blue', st.blueTo > .5);
  if (!show) { if (calloutNodes) { svg.replaceChildren(); calloutNodes = null; } return; }
  if (!calloutNodes) {
    calloutNodes = ANCHORS.map(a => {
      const g = document.createElementNS(NS_SVG, 'g');
      const pl = document.createElementNS(NS_SVG, 'polyline'); pl.setAttribute('class', 'ld');
      const rc = document.createElementNS(NS_SVG, 'rect'); rc.setAttribute('class', 'plate'); rc.setAttribute('rx', 6);
      const dt = document.createElementNS(NS_SVG, 'circle'); dt.setAttribute('class', 'dot'); dt.setAttribute('r', 3);
      const t1 = document.createElementNS(NS_SVG, 'text'); t1.setAttribute('class', 'k'); t1.textContent = (LANG === 'en' ? a.te : a.t)[0];
      const t2 = document.createElementNS(NS_SVG, 'text'); t2.textContent = (LANG === 'en' ? a.te : a.t)[1];
      g.append(pl, rc, dt, t1, t2); svg.append(g);
      return { a, g, pl, rc, dt, t1, t2, w: 0 };
    });
  }
  const scanU = lerp(-.06, 1.2, smooth(st.blue));
  const pts = calloutNodes.map(n => {
    const q = M4.xf(s.VP, M4.xf(s.M, deformJS(n.a.p, n.a.w, s)));
    return { n, x: (q[0] / q[3] * .5 + .5) * W, y: (1 - (q[1] / q[3] * .5 + .5)) * H, u: .5 - n.a.p[0] };
  });
  // columnas de etiquetas: a la derecha del tiburón, fuera del texto principal
  const minX = NARROW ? 0 : W * .5;
  pts.forEach(o => {
    const n = o.n, vis = scanU > o.u && !(NARROW && ['qui', 'hoc', 'bra', 'pec'].includes(n.a.id));
    n.g.style.opacity = vis ? 1 : 0;
    if (!vis) return;
    if (!n.w) n.w = Math.max(n.t1.getComputedTextLength(), n.t2.getComputedTextLength()) + 20;
    const up = ['dor', 'cau', 'ojo', 'hoc'].includes(n.a.id);
    let lx = clamp(o.x + (n.a.id === 'cau' ? -40 : 46), Math.max(minX, 12), W - n.w - 12);
    let ly = clamp(o.y + (up ? -64 : 58), 70, H - 110);
    if (n.a.id === 'die') { lx = clamp(o.x + 30, Math.max(minX, 12), W - n.w - 12); ly = clamp(o.y + 92, 70, H - 110); }
    if (n.a.id === 'hoc') { lx = clamp(o.x + 10, Math.max(minX, 12), W - n.w - 12); ly = clamp(o.y - 110, 70, H - 110); }
    o.lx = lx; o.ly = ly;
  });
  const placed = [];
  pts.filter(o => o.lx !== undefined && o.n.g.style.opacity === '1').sort((p, q) => p.ly - q.ly).forEach(o => {
    for (const r of placed) if (o.lx < r.lx + r.n.w + 8 && r.lx < o.lx + o.n.w + 8 && Math.abs(o.ly - r.ly) < 46) o.ly = r.ly + 46;
    o.ly = Math.min(o.ly, H - 110); placed.push(o);
  });
  placed.forEach(o => {
    const n = o.n, lx = o.lx, ly = o.ly;
    n.pl.setAttribute('points', `${o.x},${o.y} ${lx},${ly + 16} ${lx + 8},${ly + 16}`);
    n.dt.setAttribute('cx', o.x); n.dt.setAttribute('cy', o.y);
    n.rc.setAttribute('x', lx + 8); n.rc.setAttribute('y', ly - 2); n.rc.setAttribute('width', n.w); n.rc.setAttribute('height', 38);
    n.t1.setAttribute('x', lx + 18); n.t1.setAttribute('y', ly + 13);
    n.t2.setAttribute('x', lx + 18); n.t2.setAttribute('y', ly + 28);
  });
}


/* ======================= 6. Montaje, bucle y controles ======================= */
let running = false, paused = false, visible = true, last = 0, clock = 0, frames = 0, ft = 0, rmOverride = false;
let glOk = null, geoReady = false, unmount = null;
const isStill = () => paused || (REDUCED.matches && !rmOverride);
function springs(dt) {
  const db = st.blueTo - st.blue; st.blue = Math.abs(db) < .002 ? st.blueTo : st.blue + Math.sign(db) * Math.min(Math.abs(db), dt / 1.6);
  st.px += (st.tx - st.px) * Math.min(1, dt * 2.2); st.py += (st.ty - st.py) * Math.min(1, dt * 2.2);
}
function loop(now) {
  if (!running) return;
  if (!host || !cv.isConnected) { running = false; return; }
  const dt = clamp((now - (last || now)) / 1000, 0, .05); last = now;
  clock += dt; st.t = clock; springs(dt);
  draw(st.t);
  ft += dt; frames++;                                   // calidad adaptativa: baja la resolución interna si va lento
  if (frames >= 90) { const avg = ft / frames; frames = 0; ft = 0; if (avg > .024 && quality > .6) { quality = Math.max(.6, quality - .15); resize(); } }
  requestAnimationFrame(loop);
}
function startAllowed() { if (running || isStill() || !visible || document.hidden || !host) return; running = true; last = 0; requestAnimationFrame(loop); }
function stop() { running = false; }
function settle() { if (running || !host) return; st.blue = st.blueTo; st.px = st.tx; st.py = st.ty; draw(st.t); }
function ensureGL() {
  if (glOk !== null) return glOk;
  cv = document.createElement('canvas');
  cv.className = 'shark-cv';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', LANG === 'en' ? 'A realistic megalodon swims through shafts of light. Every few seconds it bites: it lifts its snout, opens its horseshoe mouth and thrusts the upper jaw forward, showing the gum and the serrated teeth.' : 'Un megalodón realista nada entre rayos de luz. Cada pocos segundos muerde: eleva el hocico, abre la boca en herradura y adelanta la mandíbula superior enseñando la encía y los dientes aserrados.');
  gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) return (glOk = false);
  try {
    if (!geoReady) { buildBody(); buildMouth(); buildFins(); buildTeeth(); buildEyes(); geoReady = true; }
    initGL();
  } catch (err) { console.error(err); gl = null; return (glOk = false); }
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); });
  cv.addEventListener('webglcontextrestored', () => { initGL(); T = {}; resize(); startAllowed(); });
  return (glOk = true);
}
function mount(slot) {
  if (unmount) unmount();
  if (!ensureGL()) return null;                          // sin WebGL2: se queda el póster
  host = slot.closest('.hero') || slot;
  svg = document.createElementNS(NS_SVG, 'svg'); svg.setAttribute('class', 'shark-callouts'); svg.setAttribute('aria-hidden', 'true');
  calloutNodes = null;
  slot.append(cv, svg);
  const hud = document.createElement('div');
  hud.className = 'shark-hud';
  hud.setAttribute('role', 'group');
  hud.setAttribute('aria-label', LANG === 'en' ? '3D megalodon' : 'Megalodón 3D');
  hud.innerHTML = `<button type="button" class="btn ghost sm" data-shark-mode aria-pressed="false">${ic('layers', 'sm')}${LANG === 'en' ? 'Blueprint' : 'Plano técnico'}</button><button type="button" class="ibtn" data-shark-pause>${ic('pause')}</button>`;
  host.append(hud);
  const modeBtn = hud.querySelector('[data-shark-mode]'), pauseBtn = hud.querySelector('[data-shark-pause]');
  const sync = () => {
    const still = isStill();
    pauseBtn.innerHTML = ic(still ? 'play' : 'pause');
    pauseBtn.setAttribute('aria-label', LANG === 'en' ? (still ? 'Resume the megalodon animation' : 'Pause the megalodon animation') : (still ? 'Reanudar la animación del megalodón' : 'Pausar la animación del megalodón'));
    modeBtn.setAttribute('aria-pressed', String(st.blueTo > .5));
  };
  modeBtn.onclick = () => { st.blueTo = st.blueTo > .5 ? 0 : 1; sync(); if (!running) settle(); };
  pauseBtn.onclick = () => {
    if (isStill()) { paused = false; rmOverride = REDUCED.matches; startAllowed(); }
    else { paused = true; stop(); }
    sync();
  };
  const onMove = e => { if (e.pointerType !== 'mouse') return; const r = host.getBoundingClientRect(); st.tx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); st.ty = clamp(-((e.clientY - r.top) / r.height * 2 - 1), -1, 1); };
  const onLeave = () => { st.tx = 0; st.ty = 0; };
  const onVis = () => document.hidden ? stop() : startAllowed();
  const onRM = () => { rmOverride = false; if (REDUCED.matches) { stop(); st.t = clock = BITE; settle(); } else startAllowed(); sync(); };
  host.addEventListener('pointermove', onMove); host.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVis); REDUCED.addEventListener('change', onRM);
  const ro = new ResizeObserver(() => resize()); ro.observe(cv);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? startAllowed() : stop(); }); io.observe(cv);
  if (REDUCED.matches && !rmOverride) st.t = clock = BITE;   // movimiento reducido: un fotograma con la boca abierta
  resize(); draw(st.t);
  slot.classList.add('live');
  sync(); startAllowed();
  unmount = () => {
    stop(); ro.disconnect(); io.disconnect();
    host && host.removeEventListener('pointermove', onMove); host && host.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', onVis); REDUCED.removeEventListener('change', onRM);
    hud.remove(); svg.remove(); cv.remove(); slot.classList.remove('live'); host = null; unmount = null;
  };
  return () => unmount && unmount();
}
return {
  mount,
  // para pruebas y capturas: congela en un instante exacto
  seek(t) { stop(); st.t = clock = t; settle(); },
  pause() { paused = true; stop(); },
  setMode(m) { st.blueTo = m === 'blue' ? 1 : 0; settle(); },
  stats: () => ({ vertices: VB.length / STRIDE, triangles: IB.length / 3, hdr, quality, running }),
};
})();
