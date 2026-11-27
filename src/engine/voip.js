/* Megalodon · Telefonía, como el menú Telephony de Wireshark, sin DOM:
   - voipCalls: Telephony › VoIP Calls. Un diálogo INVITE por fila con su estado (CALL SETUP, RINGING, IN CALL, COMPLETED, REJECTED, CANCELLED).
   - sipFlow: Telephony › SIP Flows / Flow Sequence. Mensajes SIP, flujos RTP y teclas DTMF entre los equipos, en orden de tiempo.
   - rtpStreams: Telephony › RTP › RTP Streams con el análisis de cada flujo (RFC 3550): perdidos, delta máximo y jitter.
   - rtpAudio: decodifica G.711 (µ-law y A-law) a PCM para el reproductor; los huecos son silencio y los eventos DTMF se oyen como su par de tonos. */

/* G.711 → PCM lineal de 16 bits (ITU-T G.711) */
function ulawDec(u) { u = ~u & 0xff; const t = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4); return u & 0x80 ? 0x84 - t : t - 0x84; }
function alawDec(a) { a ^= 0x55; let t = (a & 0x0f) << 4; const seg = (a & 0x70) >> 4; if (seg === 0) t += 8; else if (seg === 1) t += 0x108; else t = (t + 0x108) << (seg - 1); return a & 0x80 ? t : -t; }

const VOIP_STATE = { setup: 'CALL SETUP', ringing: 'RINGING', incall: 'IN CALL', done: 'COMPLETED', rejected: 'REJECTED', cancelled: 'CANCELLED' };

function voipCalls(pkts) {
  const byCid = new Map();
  for (const p of pkts) if (p.sip && p.sip.callId) (byCid.get(p.sip.callId) || byCid.set(p.sip.callId, []).get(p.sip.callId)).push(p);
  const streams = rtpStreams(pkts), out = [];
  for (const [callId, list] of byCid) {
    const inv = list.find(p => p.sip.req && p.sip.method === 'INVITE');
    if (!inv) continue;                                        // REGISTER y OPTIONS no son llamadas
    let st = 'setup', last = null;
    for (const p of list) {
      const s = p.sip;
      if (!s.req && s.cseqM === 'INVITE') {
        if (s.code === 180 || s.code === 183) st = st === 'setup' ? 'ringing' : st;
        else if (s.code >= 200 && s.code < 300) st = 'incall';
        else if (s.code === 487) st = 'cancelled';
        else if (s.code >= 300) st = 'rejected';
        if (s.code >= 200) last = s.code;
      }
      if (s.req && s.method === 'CANCEL') st = 'cancelled';
      if (s.req && s.method === 'BYE' && st === 'incall') st = 'done';
    }
    const first = list[0], end = list[list.length - 1];
    out.push({
      callId, state: st, stateName: VOIP_STATE[st], from: inv.f['sip.from.addr'] ? inv.f['sip.from.addr'][0] : '', to: inv.f['sip.to.addr'] ? inv.f['sip.to.addr'][0] : '',
      caller: inv.src, callee: inv.dst, start: first.rel, stop: end.rel, dur: +(end.rel - first.rel).toFixed(6), pkts: list.length, nos: list.map(p => p.no),
      comment: `INVITE${last ? ' ' + last : ''}`, streams: streams.filter(s => s.callId === callId).map(s => s.key),
      filter: `sip.Call-ID == "${callId}"`,
    });
  }
  return out;
}

/* Flujo SIP: callId concreto o todas las conversaciones SIP. Cada flecha lleva el número de trama para saltar a ella. */
function sipFlow(pkts, callId = null) {
  const items = [], hosts = [];
  const host = ip => { if (!hosts.includes(ip)) hosts.push(ip); };
  for (const p of pkts) {
    if (!p.sip || (callId && p.sip.callId !== callId)) continue;
    const s = p.sip;
    host(p.src); host(p.dst);
    items.push({ no: p.no, rel: p.rel, from: p.src, to: p.dst, kind: 'sip', label: s.req ? s.method : `${s.code} ${s.phrase}`, sdp: !!s.sdp,
      comment: s.req ? `SIP ${s.method}${s.method === 'INVITE' || s.method === 'REGISTER' ? ` ${s.method === 'INVITE' ? 'To' : 'From'}: ${s.method === 'INVITE' ? s.to : s.from}` : ''}` : `SIP Status ${s.cseqM ? `(${s.cseqM})` : ''}`.trim(), callId: s.callId });
  }
  for (const st of rtpStreams(pkts)) {
    if (callId && st.callId !== callId) continue;
    host(st.src); host(st.dst);
    items.push({ no: st.firstNo, rel: st.start, from: st.src, to: st.dst, kind: 'rtp', label: `RTP (${st.codec})`, comment: `RTP, ${st.pkts} paquetes. Duración: ${st.dur.toFixed(2)} s SSRC: 0x${st.ssrc.toString(16).toUpperCase()}`, callId: st.callId, key: st.key });
    for (const d of st.dtmf) items.push({ no: d.no, rel: d.rel, from: st.src, to: st.dst, kind: 'dtmf', label: `DTMF ${d.digit}`, comment: `RTP Event: ${d.name}`, callId: st.callId });
  }
  items.sort((a, b) => a.rel - b.rel || a.no - b.no);
  return { hosts, items };
}

/* Flujos RTP (origen, destino y SSRC) con su análisis, idéntico al de Telephony › RTP › RTP Streams (ver rtpAnalysis). */
function rtpStreams(pkts) {
  const m = new Map();
  for (const p of pkts) {
    if (!p.rtp) continue;
    const r = p.rtp, sp = p.f['udp.srcport'][0], dp = p.f['udp.dstport'][0], key = `${p.src}:${sp}>${p.dst}:${dp}|${r.ssrc}`;
    let s = m.get(key);
    if (!s) m.set(key, s = { key, src: p.src, sport: sp, dst: p.dst, dport: dp, ssrc: r.ssrc, callId: r.callId, setup: r.setup, codec: '', rate: r.rate, list: [] });
    if (!r.ev && !s.codec) { s.codec = r.codec; s.pt = r.pt; s.rate = r.rate; }
    s.list.push(p);
  }
  return [...m.values()].map(s => {
    const a = rtpAnalysis(s.list, s.rate);
    const dtmf = [];
    for (const p of s.list) if (p.rtp.ev && p.rtp.marker) dtmf.push({ no: p.no, rel: p.rel, id: p.rtp.ev.id, digit: DTMF_CH[p.rtp.ev.id] || '?', name: DTMF_EV[p.rtp.ev.id] || `Event ${p.rtp.ev.id}` });
    const { list, ...rest } = s;
    return { ...rest, codec: s.codec || 'telephone-event', pkts: list.length, nos: list.map(p => p.no), firstNo: list[0].no, start: list[0].rel, dur: +(list[list.length - 1].rel - list[0].rel).toFixed(6),
      dtmf, digits: dtmf.map(d => d.digit).join(''), filter: `rtp.ssrc == 0x${s.ssrc.toString(16).padStart(8, '0')}`, ...a };
  });
}

/* Mismo algoritmo que rtppacket_analyse() de Wireshark (ui/tap-rtp-analysis.c, 4.6), en milisegundos:
   - jitter J = (15·J + |D|) / 16, con D = Δllegada − Δmarca de tiempo respecto al último paquete en orden (RFC 3550);
   - los eventos telephone-event no actualizan el jitter (reloj 0), pero sí la referencia de tiempo y de marca de tiempo,
     así que el primer paquete de audio tras una tecla «salta»: por eso el flujo con DTMF muestra más jitter;
   - el delta y el jitter máximos y medios solo cuentan paquetes «normales» (sin marcador y que no son el primero). */
function rtpAnalysis(list, rate = 8000) {
  let cycles = 0, prevSeq = null, firstExt = null, maxExt = 0, seqErrors = 0, n = 0;
  let time = 0, seqTs = 0, tsCycles = 0, prevRawTs = 0, J = 0, maxJ = 0, meanJ = 0, maxDelta = 0, maxDeltaNo = 0, meanDelta = 0, lastSeq = 0;
  for (const p of list) {
    const r = p.rtp, now = p.t * 1000;
    if (prevSeq !== null && r.seq < prevSeq && prevSeq - r.seq > 0x8000) cycles += 0x10000;
    const ext = cycles + r.seq;
    if (prevSeq !== null && r.ts < prevRawTs && prevRawTs - r.ts > 0x80000000) tsCycles += 0x100000000;
    const extTs = tsCycles + r.ts; prevRawTs = r.ts; prevSeq = r.seq;
    if (firstExt === null) { firstExt = maxExt = ext; lastSeq = r.seq; time = now; seqTs = extTs; n = 1; continue; }
    const inOrder = seqTs <= extTs;
    if (inOrder && (lastSeq + 1) % 0x10000 === r.seq) lastSeq = r.seq;
    else if (inOrder && (lastSeq + 1 < r.seq || lastSeq - r.seq > 0xff00)) { lastSeq = r.seq; seqErrors++; }
    else if (lastSeq + 1 > r.seq) seqErrors++;
    const clock = r.ev ? 0 : (p.rtp.rate || rate);
    let delta, cur = 0;
    if (clock) {
      const nominal = (extTs - seqTs) / (clock / 1000);
      cur = (15 * J + Math.abs(now - (time + nominal))) / 16;
      delta = now - time; J = cur;
    } else delta = now - time;
    if (!r.marker && inOrder) {
      if (delta > maxDelta) { maxDelta = delta; maxDeltaNo = p.no; }
      meanDelta = (meanDelta * (n - 1) + delta) / n;
      if (clock) { maxJ = Math.max(maxJ, J); meanJ = (meanJ * (n - 1) + cur) / n; }
    }
    if (inOrder) { time = now; seqTs = extTs; }
    maxExt = Math.max(maxExt, ext); n++;
  }
  const expected = list.length ? maxExt - firstExt + 1 : 0, lost = expected - list.length;
  return { expected, lost, lostPct: expected ? +(100 * lost / expected).toFixed(2) : 0, seqErrors, maxDelta: +maxDelta.toFixed(3), maxDeltaNo, meanDelta: +meanDelta.toFixed(3),
    maxJitter: +maxJ.toFixed(3), meanJitter: +meanJ.toFixed(3), status: lost || seqErrors ? 'problems' : 'ok' };
}

/* Audio de un flujo como Float32Array a su frecuencia (8 kHz en G.711). La posición la da la marca de tiempo RTP:
   lo perdido queda en silencio, igual que en el reproductor RTP de Wireshark. */
function rtpAudio(pkts, key, opts = {}) {
  const list = pkts.filter(p => p.rtp && `${p.src}:${p.f['udp.srcport'][0]}>${p.dst}:${p.f['udp.dstport'][0]}|${p.rtp.ssrc}` === key);
  if (!list.length) return null;
  const rate = list.find(p => !p.rtp.ev)?.rtp.rate || 8000, ts0 = list[0].rtp.ts;
  let len = 0;
  for (const p of list) len = Math.max(len, ((p.rtp.ts - ts0) >>> 0) + (p.rtp.ev ? p.rtp.ev.dur : p.b.length - p.rtp.off));
  const out = new Float32Array(Math.min(len, rate * 600));
  const dtmfHz = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], A: [697, 1633], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], B: [770, 1633], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], C: [852, 1633], '*': [941, 1209], 0: [941, 1336], '#': [941, 1477], D: [941, 1633] };
  for (const p of list) {
    const r = p.rtp, at = (r.ts - ts0) >>> 0;
    if (r.ev) {
      const f = dtmfHz[DTMF_CH[r.ev.id]]; if (!f || opts.dtmf === false) continue;
      for (let i = 0; i < r.ev.dur && at + i < out.length; i++) out[at + i] = 0.22 * (Math.sin(2 * Math.PI * f[0] * i / rate) + Math.sin(2 * Math.PI * f[1] * i / rate));
      continue;
    }
    const dec = r.pt === 8 ? alawDec : r.pt === 0 ? ulawDec : null; if (!dec) continue;
    for (let i = r.off; i < p.b.length && at + i - r.off < out.length; i++) out[at + i - r.off] = dec(p.b[i]) / 32768;
  }
  return { rate, samples: out, dur: out.length / rate, pkts: list.length };
}

/* WAV PCM de 16 bits, mono: lo que exporta el reproductor RTP de Wireshark */
function wavFile(samples, rate) {
  const n = samples.length, dv = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32768))), true);
  return new Uint8Array(dv.buffer);
}
