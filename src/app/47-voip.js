/* Megalodon · Telefonía (como el menú Telephony de Wireshark): Llamadas VoIP, Flujo SIP y Flujos RTP con análisis,
   reproducción con Web Audio API (el audio se decodifica aquí, sin red ni <audio>) y exportación a WAV. */
const VOIP_ST_ES = { setup: 'EN ESTABLECIMIENTO', ringing: 'SONANDO', incall: 'EN CURSO', done: 'COMPLETADA', rejected: 'RECHAZADA', cancelled: 'CANCELADA' };
let VOIP_AUDIO = null;                                       // { ctx, src, raf } de lo que suena ahora
function voipStop() {
  if (!VOIP_AUDIO) return;
  const a = VOIP_AUDIO; VOIP_AUDIO = null;
  try { a.src.onended = null; a.src.stop(); } catch { /* ya parado */ }
  cancelAnimationFrame(a.raf);
  if (a.onStop) a.onStop();
}
/* Mezcla uno o varios flujos (alineados por su hora de inicio) y lo reproduce. onTick recibe el segundo actual. */
function voipPlay(tracks, onTick, onStop) {
  voipStop();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { toast(L('Este navegador no tiene Web Audio API.', 'This browser has no Web Audio API.'), 'err'); return false; }
  const rate = tracks[0].rate, t0 = Math.min(...tracks.map(x => x.start)), len = Math.max(...tracks.map(x => Math.round((x.start - t0) * rate) + x.samples.length));
  const mix = new Float32Array(len);
  for (const x of tracks) { const off = Math.round((x.start - t0) * rate); for (let i = 0; i < x.samples.length; i++) mix[off + i] += x.samples[i] / tracks.length * (tracks.length > 1 ? 1.6 : 1); }
  for (let i = 0; i < len; i++) mix[i] = Math.max(-1, Math.min(1, mix[i]));
  const ctx = (voipPlay.ctx = voipPlay.ctx || new AC());
  if (ctx.state === 'suspended') ctx.resume();
  const buf = ctx.createBuffer(1, len, rate); buf.getChannelData(0).set(mix);
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
  const startAt = ctx.currentTime + 0.05;
  const a = (VOIP_AUDIO = { ctx, src, raf: 0, onStop });
  const tick = () => { if (VOIP_AUDIO !== a) return; onTick && onTick(Math.max(0, ctx.currentTime - startAt), buf.duration); a.raf = requestAnimationFrame(tick); };
  src.onended = () => { if (VOIP_AUDIO === a) voipStop(); };
  src.start(startAt); tick();
  return true;
}

function openVoip(ws, tab = 'calls', callId = null) {
  const body = document.createElement('div');
  const tabs = [['calls', L('Llamadas', 'Calls'), 'phone'], ['flow', L('Flujo SIP', 'SIP flow'), 'swap'], ['rtp', 'RTP', 'wave']];
  body.innerHTML = `<div class="seg" role="tablist" aria-label="${t('voip')}">${tabs.map(([k, l, i]) => `<button role="tab" id="vo-${k}" aria-controls="vo-p" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${ic(i, 'sm')}${l}</button>`).join('')}</div><div id="vo-p" role="tabpanel" class="st-p" tabindex="0"></div>`;
  const panel = $('#vo-p', body);
  const show = (k, cid = callId) => {
    voipStop(); tab = k; callId = cid;
    $$('[role=tab]', body).forEach(b => { const on = b.dataset.tab === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    panel.setAttribute('aria-labelledby', `vo-${k}`);
    if (k === 'calls') callsPanel(ws, panel, show); else if (k === 'flow') sipFlowPanel(ws, panel, callId); else rtpPanel(ws, panel, callId);
  };
  $('.seg', body).addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab, null); });
  $('.seg', body).addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const i = tabs.findIndex(x => x[0] === tab), j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    show(tabs[j][0], null); $(`#vo-${tabs[j][0]}`, body).focus();
  });
  openDialog({ title: `${ic('phone')} ${t('voip')}`, body, wide: true, onClose: voipStop });
  show(tab, callId);
}

const voipEmpty = () => `<p class="muted">${L('No hay SIP ni RTP en esta captura. La encontrarás en el módulo 9 (VoIP).', 'There is no SIP or RTP in this capture. You will find it in module 9 (VoIP).')}</p>`;

/* ---------- Telefonía › Llamadas VoIP ---------- */
function callsPanel(ws, panel, show) {
  const calls = voipCalls(ws.pkts);
  if (!calls.length) { panel.innerHTML = voipEmpty(); return; }
  panel.innerHTML = `<div class="tbl-wrap" tabindex="0" role="region" aria-label="${L('Llamadas VoIP', 'VoIP Calls')}"><table class="tbl"><caption class="vh">${L('Llamadas VoIP', 'VoIP Calls')}</caption><thead><tr><th scope="col" class="n">${L('Inicio', 'Start')}</th><th scope="col" class="n">${L('Fin', 'Stop')}</th><th scope="col">${L('Llama', 'Initial speaker')}</th><th scope="col">${L('De', 'From')}</th><th scope="col">${L('A', 'To')}</th><th scope="col" class="n">${L('Paquetes', 'Packets')}</th><th scope="col">${L('Estado', 'State')}</th><th scope="col">${L('Comentario', 'Comments')}</th><th scope="col">Call-ID</th><th scope="col"><span class="vh">${L('Acciones', 'Actions')}</span></th></tr></thead>
    <tbody>${calls.map((c, i) => `<tr><td class="n mono">${c.start.toFixed(3)}</td><td class="n mono">${c.stop.toFixed(3)}</td><td class="mono">${esc(c.caller)}</td><td class="mono">${esc(c.from)}</td><td class="mono">${esc(c.to)}</td><td class="n">${c.pkts}</td>
      <td><span class="ex-chip ${c.state === 'done' || c.state === 'incall' ? 'sev-chat' : c.state === 'rejected' ? 'sev-warn' : 'sev-note'}">${LANG === 'en' ? c.stateName : VOIP_ST_ES[c.state]}</span></td><td class="mono sm">${esc(c.comment)}</td><td class="mono sm">${esc(c.callId)}</td>
      <td><div class="row"><button class="btn sm ghost" type="button" data-flow="${i}">${ic('swap', 'sm')}${L('Flujo', 'Flow')}</button>${c.streams.length ? `<button class="btn sm ghost" type="button" data-rtp="${i}">${ic('wave', 'sm')}RTP</button>` : ''}<button class="btn sm ghost" type="button" data-f="${i}">${ic('filter', 'sm')}${t('filterThis')}</button></div></td></tr>`).join('')}</tbody></table></div>
    <p class="sm muted">${L('Una fila por cada INVITE con su Call-ID. Los REGISTER y OPTIONS no son llamadas: los verás en el Flujo SIP.', 'One row per INVITE with its Call-ID. REGISTER and OPTIONS are not calls: you will see them in the SIP Flow.')}</p>`;
  $$('[data-flow]', panel).forEach(b => b.onclick = () => show('flow', calls[+b.dataset.flow].callId));
  $$('[data-rtp]', panel).forEach(b => b.onclick = () => show('rtp', calls[+b.dataset.rtp].callId));
  $$('[data-f]', panel).forEach(b => b.onclick = () => { ws.setFilter(calls[+b.dataset.f].filter); closeDialog(); });
}

/* ---------- Telefonía › Flujo SIP (diagrama de secuencia) ---------- */
function sipFlowPanel(ws, panel, callId) {
  const calls = voipCalls(ws.pkts), all = sipFlow(ws.pkts);
  if (!all.items.length) { panel.innerHTML = voipEmpty(); return; }
  const fl = callId ? sipFlow(ws.pkts, callId) : all, H = fl.hosts, n = H.length;
  const col = n <= 2 ? 320 : 230, left = 96, W = left + Math.max(1, n - 1) * col + 120, top = 52, rh = 34, Hh = top + fl.items.length * rh + 14;
  const x = ip => left + 40 + H.indexOf(ip) * col;
  const names = { '10.20.0.5': 'pbx.voip.local', '10.20.0.21': L('Teléfono 1001', 'Phone 1001'), '10.20.0.66': L('Escáner', 'Scanner') };
  panel.innerHTML = `<div class="row between wrap"><label class="row sm vpick">${L('Mostrar', 'Show')} <select class="sel" data-cid><option value="">${L('Todos los mensajes SIP y RTP', 'All SIP and RTP messages')}</option>${calls.map(c => `<option value="${esc(c.callId)}" ${c.callId === callId ? 'selected' : ''}>${esc(c.from)} → ${esc(c.to)}</option>`).join('')}</select></label><span class="sm muted">${fl.items.length} ${L('flechas', 'arrows')}</span></div>
    <figure class="ladder vflow"><div class="vflow-sc" tabindex="0" role="region" aria-label="${L('Diagrama de flujo', 'Flow diagram')}"><svg viewBox="0 0 ${W} ${Hh}" width="${W}" role="group" aria-label="${L(`Flujo SIP entre ${n} equipos: ${fl.items.length} mensajes`, `SIP flow between ${n} hosts: ${fl.items.length} messages`)}">
      ${H.map(ip => `<text class="lh" x="${x(ip)}" y="16" text-anchor="middle">${esc(names[ip] || ip)}</text><text class="lh2" x="${x(ip)}" y="32" text-anchor="middle">${esc(ip)}</text><line class="life" x1="${x(ip)}" x2="${x(ip)}" y1="40" y2="${Hh - 4}"/>`).join('')}
      ${fl.items.map((s, i) => {
        const y = top + i * rh, x1 = x(s.from), x2 = x(s.to), dir = x2 >= x1 ? 1 : -1, mid = (x1 + x2) / 2, lab = s.label + (s.sdp ? ' (SDP)' : '');
        const cls = s.kind === 'rtp' ? 'rtp' : s.kind === 'dtmf' ? 'dtmf' : /^[45]\d\d/.test(s.label) ? 'rst' : /^2\d\d/.test(s.label) ? 'app' : '';
        return `<g class="step ${cls}" data-no="${s.no}" tabindex="0" role="button" aria-label="${L('Paquete', 'Packet')} ${s.no}, ${s.rel.toFixed(3)} s: ${esc(s.from)} → ${esc(s.to)} ${esc(lab)}">
          <rect class="hit" x="0" y="${y - rh + 8}" width="${W}" height="${rh}"/>
          <text class="sn" x="8" y="${y + 4}">${s.rel.toFixed(3)}</text>
          <line class="ar" x1="${x1}" y1="${y}" x2="${x2 - dir * 7}" y2="${y}"/><path class="hd" d="M ${x2} ${y} l ${-dir * 9} -5 l 0 10 z"/>
          <text class="sl" x="${mid}" y="${y - 6}" text-anchor="middle">${esc(lab)}</text>
        </g>`;
      }).join('')}
    </svg></div><figcaption class="sm muted">${L('Pulsa una flecha para ir a ese paquete. Las verdes son respuestas 2xx, las rojas rechazos o retos y las moradas, audio RTP y teclas DTMF.', 'Click an arrow to jump to that packet. Green arrows are 2xx responses, red ones rejections or challenges, purple ones RTP audio and DTMF keys.')}</figcaption></figure>`;
  $('[data-cid]', panel).onchange = e => sipFlowPanel(ws, panel, e.target.value || null);
  $$('.step', panel).forEach(g => {
    const go = () => { closeDialog(); ws.select(+g.dataset.no, { focusList: true }); };
    g.addEventListener('click', go); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}

/* ---------- Telefonía › RTP › Flujos RTP + análisis + reproductor ---------- */
function rtpPanel(ws, panel, callId) {
  const all = rtpStreams(ws.pkts), list = callId ? all.filter(s => s.callId === callId) : all;
  if (!all.length) { panel.innerHTML = voipEmpty(); return; }
  const ms = v => v.toFixed(2);
  panel.innerHTML = `<div class="tbl-wrap" tabindex="0" role="region" aria-label="${L('Flujos RTP', 'RTP Streams')}"><table class="tbl"><caption class="vh">${L('Flujos RTP y su análisis', 'RTP streams and their analysis')}</caption><thead><tr><th scope="col">${L('Origen → destino · SSRC', 'Source → destination · SSRC')}</th><th scope="col">${L('Carga', 'Payload')}</th><th scope="col" class="n">${L('Paquetes', 'Packets')}</th><th scope="col" class="n">${L('Perdidos', 'Lost')}</th><th scope="col" class="n">${L('Delta máx.', 'Max delta')}</th><th scope="col" class="n">${L('Jitter máx. / medio', 'Max / mean jitter')}</th><th scope="col">DTMF</th><th scope="col">${L('Estado', 'Status')}</th><th scope="col"><span class="vh">${L('Acciones', 'Actions')}</span></th></tr></thead>
    <tbody>${list.map((s, i) => `<tr><td class="mono sm">${esc(s.src)}:${s.sport}<br>→ ${esc(s.dst)}:${s.dport}<br><span class="muted">0x${s.ssrc.toString(16).padStart(8, '0')}</span></td><td class="sm">${esc(s.codec.replace(/^ITU-T /, ''))}</td><td class="n">${fmtNum(s.pkts)}</td>
      <td class="n ${s.lost ? 'badt' : ''}">${s.lost} (${s.lostPct.toLocaleString(LANG === 'en' ? 'en-GB' : 'es-ES')} %)</td><td class="n mono"><button class="btn sm ghost mono" type="button" data-no="${s.maxDeltaNo}" aria-label="${ms(s.maxDelta)} ms: ${L('ir al paquete', 'go to packet')} ${s.maxDeltaNo}">${ms(s.maxDelta)}</button></td><td class="n mono">${ms(s.maxJitter)} / ${ms(s.meanJitter)}</td>
      <td class="mono">${esc(s.digits) || '—'}</td><td>${s.status === 'ok' ? `<span class="okt">OK</span>` : `<span class="badt">${L('Problemas', 'Problems')}</span>`}</td>
      <td><div class="row nowrap"><button class="btn sm ghost" type="button" data-play="${i}" aria-pressed="false">${ic('play', 'sm')}<span>${L('Reproducir', 'Play')}</span></button><button class="ibtn sm" type="button" data-wav="${i}" aria-label="${L('Guardar como WAV', 'Save as WAV')}" title="${L('Guardar como WAV', 'Save as WAV')}">${ic('download', 'sm')}</button><button class="ibtn sm" type="button" data-f="${i}" aria-label="${t('filterThis')}: ${esc(s.filter)}" title="${t('filterThis')}">${ic('filter', 'sm')}</button></div></td></tr>`).join('')}</tbody></table></div>
    ${list.length > 1 ? `<div class="row"><button class="btn sm" type="button" data-both aria-pressed="false">${ic('volume', 'sm')}<span>${L('Reproducir los dos sentidos', 'Play both directions')}</span></button></div>` : ''}
    <div class="vwave" hidden><p class="sm"><strong data-wn></strong> · <span class="mono" data-wt>0,0 s</span></p><svg viewBox="0 0 600 80" preserveAspectRatio="none" role="img" data-wsvg></svg></div>
    <p class="sm muted">${L('Tiempos en milisegundos. Perdidos: números de secuencia que faltan. Delta: tiempo entre paquetes seguidos (lo normal son 20 ms). Jitter: RFC 3550, calculado igual que Wireshark. Los eventos DTMF no suman jitter, pero el audio que llega justo después «salta», así que un flujo con teclas puede marcar jitter alto con la red limpia. Al reproducir, lo perdido suena a silencio y las teclas DTMF, a su par de tonos.', 'Times in milliseconds. Lost: missing sequence numbers. Delta: time between consecutive packets (20 ms is normal). Jitter: RFC 3550, computed the way Wireshark does. DTMF events add no jitter, but the audio right after them «jumps», so a stream with key presses can show high jitter on a clean network. On playback, lost audio is silence and DTMF keys sound as their tone pair.')}</p>`;
  const wave = $('.vwave', panel), wsvg = $('[data-wsvg]', panel);
  const audioOf = s => { const a = rtpAudio(ws.pkts, s.key); return a && { ...a, start: s.start, s }; };
  const drawWave = (tracks, label) => {
    const rate = tracks[0].rate, t0 = Math.min(...tracks.map(x => x.start)), dur = Math.max(...tracks.map(x => x.start - t0 + x.dur)), N = 300, peak = new Float32Array(N);
    for (const x of tracks) { const off = (x.start - t0) * rate; for (let i = 0; i < x.samples.length; i++) { const b = Math.min(N - 1, Math.floor((off + i) / (dur * rate) * N)); peak[b] = Math.max(peak[b], Math.abs(x.samples[i])); } }
    wsvg.innerHTML = `${Array.from(peak, (v, i) => `<rect class="wv" x="${i * 2}" y="${40 - Math.max(0.5, v * 38)}" width="1.4" height="${Math.max(1, v * 76)}"/>`).join('')}<line class="wph" x1="0" x2="0" y1="0" y2="80"/>`;
    wsvg.setAttribute('aria-label', L(`Forma de onda de ${label}, ${dur.toFixed(1)} segundos`, `Waveform of ${label}, ${dur.toFixed(1)} seconds`));
    $('[data-wn]', wave).textContent = label; wave.hidden = false;
  };
  const resetBtns = () => $$('[data-play], [data-both]', panel).forEach(b => { b.setAttribute('aria-pressed', 'false'); b.innerHTML = b.dataset.both !== undefined ? `${ic('volume', 'sm')}<span>${L('Reproducir los dos sentidos', 'Play both directions')}</span>` : `${ic('play', 'sm')}<span>${L('Reproducir', 'Play')}</span>`; });
  const play = (btn, tracks, label) => {
    if (btn.getAttribute('aria-pressed') === 'true') { voipStop(); return; }
    drawWave(tracks, label);
    const ph = $('.wph', wsvg), wt = $('[data-wt]', wave);
    const ok = voipPlay(tracks, (s, d) => { const x = Math.min(600, s / d * 600); ph.setAttribute('x1', x); ph.setAttribute('x2', x); wt.textContent = `${s.toFixed(1).replace('.', LANG === 'en' ? '.' : ',')} s`; }, resetBtns);
    if (!ok) return;
    resetBtns(); btn.setAttribute('aria-pressed', 'true'); btn.innerHTML = `${ic('stop', 'sm')}<span>${L('Parar', 'Stop')}</span>`;
  };
  $$('[data-play]', panel).forEach(b => b.onclick = () => { const s = list[+b.dataset.play], a = audioOf(s); if (a) play(b, [a], `${s.src} → ${s.dst}`); });
  const both = $('[data-both]', panel);
  if (both) both.onclick = () => { const tr = list.map(audioOf).filter(Boolean); play(both, tr, L('los dos sentidos', 'both directions')); };
  $$('[data-wav]', panel).forEach(b => b.onclick = () => { const s = list[+b.dataset.wav], a = audioOf(s); if (!a) return; const name = `rtp-${s.src}-${s.sport}-a-${s.dst}-${s.dport}.wav`.replace(/[^\w.-]/g, '_'); download(wavFile(a.samples, a.rate), name, 'audio/wav'); toast(`${L('Guardado', 'Saved')}: <code>${esc(name)}</code>`, 'ok', 'download'); });
  $$('[data-f]', panel).forEach(b => b.onclick = () => { ws.setFilter(list[+b.dataset.f].filter); closeDialog(); });
  $$('[data-no]', panel).forEach(b => b.onclick = () => { closeDialog(); ws.select(+b.dataset.no, { focusList: true }); });
}
