/* Megalodon · estadísticas: conversaciones, jerarquía de protocolos, E/S, Follow Stream y diagrama de flujo. */
function conversations(pkts) {
  const kinds = { eth: new Map(), ip: new Map(), tcp: new Map(), udp: new Map() };
  const add = (map, a, b, key, p, extra) => {
    let c = map.get(key);
    if (!c) map.set(key, c = { a, b, ...extra, pkts: 0, bytes: 0, ab: 0, abBytes: 0, ba: 0, baBytes: 0, start: p.rel, end: p.rel });
    const fwd = p.dirKey === undefined ? true : p.dirKey;
    c.pkts++; c.bytes += p.len; c.end = p.rel;
    if (fwd) { c.ab++; c.abBytes += p.len; } else { c.ba++; c.baBytes += p.len; }
  };
  for (const p of pkts) {
    const f = p.f;
    if (f['eth.src']) { const s = f['eth.src'][0], d = f['eth.dst'][0], k = [s, d].sort().join('|'); p.dirKey = !kinds.eth.has(k) || kinds.eth.get(k).a === s; add(kinds.eth, s, d, k, p); }
    if (f['ip.src']) { const s = f['ip.src'][0], d = f['ip.dst'][0], k = [s, d].sort().join('|'); p.dirKey = !kinds.ip.has(k) || kinds.ip.get(k).a === s; add(kinds.ip, s, d, k, p); }
    if (f.tcp) { const k = f['tcp.stream'][0], s = f['ip.src'][0], c = kinds.tcp.get(k); p.dirKey = !c || c.a === s; add(kinds.tcp, s, f['ip.dst'][0], k, p, { pa: f['tcp.srcport'][0], pb: f['tcp.dstport'][0], stream: k }); }
    if (f.udp) { const k = f['udp.stream'][0], s = f['ip.src'][0], c = kinds.udp.get(k); p.dirKey = !c || c.a === s; add(kinds.udp, s, f['ip.dst'][0], k, p, { pa: f['udp.srcport'][0], pb: f['udp.dstport'][0], stream: k }); }
    delete p.dirKey;
  }
  const out = {};
  for (const k in kinds) out[k] = [...kinds[k].values()].map(c => ({ ...c, dur: +(c.end - c.start).toFixed(6) }));
  return out;
}

function protocolHierarchy(pkts) {
  const root = { name: 'frame', pkts: 0, bytes: 0, kids: new Map() };
  for (const p of pkts) {
    const stack = (p.f['frame.protocols'] || ['eth'])[0].split(':').filter(x => x !== 'ethertype');
    let n = root; n.pkts++; n.bytes += p.len;
    for (const name of stack) { if (!n.kids.has(name)) n.kids.set(name, { name, pkts: 0, bytes: 0, kids: new Map() }); n = n.kids.get(name); n.pkts++; n.bytes += p.len; }
  }
  const total = root.pkts || 1;
  const conv = (n, depth) => ({ name: n.name, depth, pkts: n.pkts, bytes: n.bytes, pct: +(100 * n.pkts / total).toFixed(1), kids: [...n.kids.values()].sort((a, b) => b.pkts - a.pkts).map(k => conv(k, depth + 1)) });
  return conv(root, 0);
}

function ioGraph(pkts, interval = 1, test = null) {
  if (!pkts.length) return { interval, buckets: [] };
  const last = pkts[pkts.length - 1].rel, n = Math.max(1, Math.floor(last / interval) + 1);
  const buckets = Array.from({ length: n }, (_, i) => ({ t: +(i * interval).toFixed(3), all: 0, hit: 0, bytes: 0 }));
  for (const p of pkts) { const b = buckets[Math.min(n - 1, Math.floor(p.rel / interval))]; b.all++; b.bytes += p.len; if (test && test(p)) b.hit++; }
  return { interval, buckets };
}

function followTcp(pkts, stream) {
  const mine = pkts.filter(p => p.tcpStream === stream);
  if (!mine.length) return null;
  const first = mine[0], cli = first.f['ip.src'][0] + ':' + first.f['tcp.srcport'][0];
  const chunks = []; let cBytes = 0, sBytes = 0;
  for (const p of mine) {
    const len = p.f['tcp.len'][0];
    if (!len || p.f['tcp.analysis.retransmission']) continue;
    const r = p.layers.tcp, data = p.b.subarray(r[1], r[1] + len);
    const fromClient = p.f['ip.src'][0] + ':' + p.f['tcp.srcport'][0] === cli;
    const txt = TD.decode(data).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '.');
    const last = chunks[chunks.length - 1];
    if (last && last.client === fromClient) { last.text += txt; last.bytes += len; last.frames.push(p.no); }
    else chunks.push({ client: fromClient, text: txt, bytes: len, frames: [p.no] });
    if (fromClient) cBytes += len; else sBytes += len;
  }
  const [cip, cport] = cli.split(':'), sip = first.f['ip.dst'][0], sport = first.f['tcp.dstport'][0];
  return { stream, client: `${cip}:${cport}`, server: `${sip}:${sport}`, chunks, cBytes, sBytes, filter: `tcp.stream eq ${stream}` };
}

/* Datos para el diagrama de escalera (M1): una flecha por paquete de un flujo TCP */
function flowLadder(pkts, stream) {
  const mine = pkts.filter(p => p.tcpStream === stream);
  if (!mine.length) return null;
  const a = mine[0].f['ip.src'][0], b = mine[0].f['ip.dst'][0];
  return {
    a, b, pa: mine[0].f['tcp.srcport'][0], pb: mine[0].f['tcp.dstport'][0],
    steps: mine.map(p => {
      const fl = p.f['tcp.flags'][0], names = FLAG_NAMES.filter(([m]) => fl & m).map(([, n]) => n);
      const app = p.f.http ? (p.f['http.request.method'] ? `${p.f['http.request.method'][0]} ${p.f['http.request.uri'][0]}` : `${p.f['http.response.code'][0]} ${p.f['http.response.phrase'][0]}`) : '';
      return { no: p.no, rel: p.rel, fromA: p.f['ip.src'][0] === a, flags: names, seq: p.f['tcp.seq'][0], ack: p.f['tcp.ack'][0], len: p.f['tcp.len'][0], app };
    }),
  };
}

function endpoints(pkts) {
  const m = new Map();
  for (const p of pkts) for (const [k, dir] of [['ip.src', 'tx'], ['ip.dst', 'rx']]) {
    const a = p.f[k] && p.f[k][0]; if (!a) continue;
    const e = m.get(a) || m.set(a, { addr: a, pkts: 0, bytes: 0, tx: 0, rx: 0 }).get(a);
    e.pkts++; e.bytes += p.len; e[dir]++;
  }
  return [...m.values()].sort((x, y) => y.pkts - x.pkts);
}
