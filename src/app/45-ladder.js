/* Megalodon · diagrama de escalera animado de un flujo TCP (módulo 1). Cada flecha es un paquete; al pulsarla se selecciona en Wireshark. */
function ladderSVG(pkts, stream, onPick) {
  const L = flowLadder(pkts, stream); if (!L) return document.createElement('div');
  const W = 560, ax = 150, bx = 470, top = 64, rh = 40, H = top + L.steps.length * rh + 16;
  const phase = s => s.flags.includes('SYN') ? 'hs' : s.flags.includes('FIN') || s.flags.includes('RST') || (s.len === 0 && L.steps.some(x => x.flags.includes('FIN') && x.no < s.no)) ? 'fin' : 'data';
  const names = { hs: 'Saludo', data: 'Datos', fin: 'Cierre' };
  const groups = [];
  L.steps.forEach((s, i) => { const ph = phase(s); if (!groups.length || groups[groups.length - 1].ph !== ph) groups.push({ ph, a: i, b: i }); else groups[groups.length - 1].b = i; });
  const wrap = document.createElement('figure');
  wrap.className = 'ladder';
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Diagrama del flujo TCP ${stream}: ${L.steps.length} paquetes entre ${L.a}:${L.pa} y ${L.b}:${L.pb}">
    <text class="lh" x="${ax}" y="20" text-anchor="middle">Kali</text><text class="lh2" x="${ax}" y="38" text-anchor="middle">${L.a}:${L.pa}</text>
    <text class="lh" x="${bx}" y="20" text-anchor="middle">Servidor web</text><text class="lh2" x="${bx}" y="38" text-anchor="middle">${L.b}:${L.pb}</text>
    <line class="life" x1="${ax}" x2="${ax}" y1="48" y2="${H - 6}"/><line class="life" x1="${bx}" x2="${bx}" y1="48" y2="${H - 6}"/>
    ${groups.map(g => `<g class="ph ph-${g.ph}"><rect x="8" y="${top + g.a * rh - 12}" width="74" height="${(g.b - g.a + 1) * rh - 8}" rx="8"/><text x="45" y="${top + ((g.a + g.b) / 2) * rh + 8}" text-anchor="middle">${names[g.ph]}</text></g>`).join('')}
    ${L.steps.map((s, i) => {
      const y = top + i * rh, x1 = s.fromA ? ax : bx, x2 = s.fromA ? bx : ax, dir = s.fromA ? 1 : -1, mid = (ax + bx) / 2;
      const lab = s.flags.join(', ') + (s.app ? ` · ${s.app}` : '');
      return `<g class="step ${s.flags.includes('RST') ? 'rst' : ''} ${s.app ? 'app' : ''}" data-no="${s.no}" data-i="${i}" tabindex="0" role="button" aria-label="Paquete ${s.no}: ${esc(lab)}, Seq ${s.seq}, Ack ${s.ack}, Len ${s.len}">
        <line class="ar" x1="${x1}" y1="${y}" x2="${x2 - dir * 7}" y2="${y + 12}" pathLength="1"/>
        <path class="hd" d="M ${x2} ${y + 12.3} l ${-dir * 10} -7 l 0 9 z"/>
        <text class="sl" x="${mid}" y="${y - 3}" text-anchor="middle">${esc(lab)}</text>
        <text class="sn" x="${mid}" y="${y + 26}" text-anchor="middle">#${s.no} · Seq=${s.seq}${s.flags.includes('ACK') ? ` Ack=${s.ack}` : ''} Len=${s.len}</text>
      </g>`;
    }).join('')}
  </svg>
  <figcaption class="row between"><span class="sm muted">Pulsa una flecha para abrir ese paquete en Wireshark.</span><button class="btn sm ghost" type="button" data-replay>${ic('reset', 'sm')}Repetir animación</button></figcaption>`;
  const steps = $$('.step', wrap);
  steps.forEach((g, i) => { g.style.setProperty('--d', `${i * 110}ms`); });
  const play = () => { if (REDUCED.matches) return; wrap.classList.remove('play'); void wrap.offsetWidth; wrap.classList.add('play'); };
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { play(); io.disconnect(); } }, { threshold: 0.35 });
  io.observe(wrap);
  $('[data-replay]', wrap).onclick = play;
  const pick = g => { steps.forEach(x => x.classList.toggle('on', x === g)); onPick && onPick(+g.dataset.no); };
  steps.forEach(g => { g.addEventListener('click', () => pick(g)); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g); } }); });
  return wrap;
}
