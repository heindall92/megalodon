/* Megalodon · constructores de paquetes byte a byte (Ethernet II, ARP, IPv4, ICMP, UDP, TCP, DNS, DHCP, TLS, SMB2, NTLMSSP, Kerberos)
   y lectura/escritura de pcap y pcapng. Sin DOM: se prueba en Node. */
const TE = new TextEncoder(), TD = new TextDecoder('utf-8', { fatal: false });
const txt = s => Array.from(TE.encode(s));
const u16 = n => [(n >>> 8) & 255, n & 255];
const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = n => [n & 255, (n >>> 8) & 255];
const le32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const macB = s => s.split(':').map(h => parseInt(h, 16));
const ipB = s => s.split('.').map(Number);
const utf16 = s => { const o = []; for (const ch of s) { const c = ch.charCodeAt(0); o.push(c & 255, c >> 8); } return o; };

/* Generador pseudoaleatorio con semilla: cada captura sale idéntica en cada carga */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function csum(bytes, init = 0) {
  let s = init;
  for (let i = 0; i < bytes.length; i += 2) s += (bytes[i] << 8) + (i + 1 < bytes.length ? bytes[i + 1] : 0);
  while (s >>> 16) s = (s & 0xffff) + (s >>> 16);
  return (~s) & 0xffff;
}

const eth = (dst, src, type, payload) => [...macB(dst), ...macB(src), ...u16(type), ...payload];

function ipv4(h, payload) {
  const hdr = [0x45, h.tos || 0, ...u16(20 + payload.length), ...u16(h.id & 0xffff), ...u16(h.df === false ? 0 : 0x4000), h.ttl || 64, h.proto, 0, 0, ...ipB(h.src), ...ipB(h.dst)];
  const c = csum(hdr); hdr[10] = c >> 8; hdr[11] = c & 255;
  return [...hdr, ...payload];
}
function pseudo(src, dst, proto, len) { const p = [...ipB(src), ...ipB(dst), 0, proto, ...u16(len)]; let s = 0; for (let i = 0; i < p.length; i += 2) s += (p[i] << 8) + p[i + 1]; return s; }

function tcpSeg(src, dst, t) {
  const opts = t.opts || [];
  const hl = 20 + opts.length;
  const seg = [...u16(t.sport), ...u16(t.dport), ...u32(t.seq >>> 0), ...u32((t.ack || 0) >>> 0), (hl / 4) << 4, t.flags, ...u16(t.win == null ? 64240 : t.win), 0, 0, 0, 0, ...opts, ...(t.data || [])];
  const c = csum(seg, pseudo(src, dst, 6, seg.length)); seg[16] = c >> 8; seg[17] = c & 255;
  return seg;
}
function udpDg(src, dst, sport, dport, data) {
  const seg = [...u16(sport), ...u16(dport), ...u16(8 + data.length), 0, 0, ...data];
  let c = csum(seg, pseudo(src, dst, 17, seg.length)); if (c === 0) c = 0xffff; seg[6] = c >> 8; seg[7] = c & 255;
  return seg;
}
const SYN_OPTS = [2, 4, 0x05, 0xb4, 1, 3, 3, 8, 1, 1, 4, 2]; /* MSS 1460, NOP, WS ×256, NOP, NOP, SACK permitido */
const F = { FIN: 1, SYN: 2, RST: 4, PSH: 8, ACK: 16, URG: 32 };

/* Captura en construcción: reloj, identificadores IP por host y paquetes */
class Cap {
  constructor(seed = 7, t0 = 1795000000) { this.t = t0; this.pkts = []; this.r = rng(seed); this.ipid = {}; }
  wait(s) { this.t += s; return this; }
  jitter(a, b) { this.t += a + (b - a) * this.r(); return this; }
  push(bytes) { this.pkts.push({ t: Math.round(this.t * 1e6) / 1e6, b: Uint8Array.from(bytes) }); this.t += 0.00002 + this.r() * 0.00008; }
  nextId(ip) { this.ipid[ip] = ((this.ipid[ip] ?? Math.floor(this.r() * 40000)) + 1) & 0xffff; return this.ipid[ip]; }
  ip(a, b, proto, payload, ttl) { this.push(eth(b.mac, a.mac, 0x0800, ipv4({ src: a.ip, dst: b.ip, proto, ttl: ttl || a.ttl || 64, id: this.nextId(a.ip) }, payload))); }
  udp(a, b, sport, dport, data) { this.ip(a, b, 17, udpDg(a.ip, b.ip, sport, dport, data)); }
  icmpEcho(a, b, type, id, seq, data) { const m = [type, 0, 0, 0, ...u16(id), ...u16(seq), ...data]; const c = csum(m); m[2] = c >> 8; m[3] = c & 255; this.ip(a, b, 1, m); }
  arp(op, a, sha, spa, tha, tpa, dstMac) {
    this.push(eth(dstMac || (op === 1 ? 'ff:ff:ff:ff:ff:ff' : tha), a.mac, 0x0806, [0, 1, 8, 0, 6, 4, 0, op, ...macB(sha), ...ipB(spa), ...macB(tha), ...ipB(tpa), ...new Array(18).fill(0)]));
  }
  rawTcp(a, b, t) { this.ip(a, b, 6, tcpSeg(a.ip, b.ip, t)); }
  tcp(c, s, sport, dport) { return new Conn(this, c, s, sport, dport); }
}

/* Conexión TCP que lleva solo la cuenta de secuencias y acuses */
class Conn {
  constructor(cap, c, s, sport, dport) {
    this.cap = cap; this.h = { c, s }; this.p = { c: sport, s: dport };
    this.seq = { c: Math.floor(cap.r() * 4e9) >>> 0, s: Math.floor(cap.r() * 4e9) >>> 0 }; this.ackd = { c: 0, s: 0 };
    this.rtt = 0.0004 + cap.r() * 0.0012;
  }
  o(d) { return d === 'c' ? 's' : 'c'; }
  pk(d, flags, data = [], extra = {}) {
    const o = this.o(d);
    this.cap.rawTcp(this.h[d], this.h[o], { sport: this.p[d], dport: this.p[o], seq: this.seq[d], ack: flags & F.ACK ? this.seq[o] : 0, flags, data, win: extra.win ?? (d === 'c' ? 64240 : 65160), opts: extra.opts });
    this.seq[d] = (this.seq[d] + data.length + (flags & (F.SYN | F.FIN) ? 1 : 0)) >>> 0;
  }
  handshake() { this.pk('c', F.SYN, [], { opts: SYN_OPTS }); this.cap.wait(this.rtt); this.pk('s', F.SYN | F.ACK, [], { opts: SYN_OPTS }); this.cap.wait(this.rtt * 0.6); this.pk('c', F.ACK, [], { win: 502 }); return this; }
  send(d, data, opts = {}) {
    const bytes = typeof data === 'string' ? txt(data) : data;
    for (let i = 0; i < bytes.length; i += 1460) {
      const ch = bytes.slice(i, i + 1460), last = i + 1460 >= bytes.length;
      this.pk(d, F.ACK | (last ? F.PSH : 0), ch, { win: d === 'c' ? 502 : 509 });
      this.cap.wait(0.00005);
    }
    if (opts.noAck) return this;
    this.cap.wait(this.rtt * 0.5); this.pk(this.o(d), F.ACK, [], { win: d === 'c' ? 509 : 502 });
    return this;
  }
  /* Retransmisión: repite el último segmento con datos sin avanzar la secuencia */
  retrans(d, data, after = 0.2) { const bytes = typeof data === 'string' ? txt(data) : data; const back = (this.seq[d] - bytes.length) >>> 0; const keep = this.seq[d]; this.seq[d] = back; this.cap.wait(after); this.pk(d, F.ACK | F.PSH, bytes, { win: 502 }); this.seq[d] = keep; return this; }
  fin(d) { this.pk(d, F.FIN | F.ACK, [], { win: 502 }); this.cap.wait(this.rtt); this.pk(this.o(d), F.FIN | F.ACK, [], { win: 509 }); this.cap.wait(this.rtt * 0.5); this.pk(d, F.ACK, [], { win: 502 }); return this; }
  fin4(d) { this.pk(d, F.FIN | F.ACK, [], { win: 502 }); this.cap.wait(this.rtt * 0.5); this.pk(this.o(d), F.ACK, [], { win: 509 }); this.cap.wait(this.rtt); this.pk(this.o(d), F.FIN | F.ACK, [], { win: 509 }); this.cap.wait(this.rtt * 0.5); this.pk(d, F.ACK, [], { win: 502 }); return this; }
  rst(d, withAck = true) { this.pk(d, F.RST | (withAck ? F.ACK : 0), [], { win: 0 }); return this; }
  http(req, res, gap = 0.01) { this.send('c', req); this.cap.wait(gap); this.send('s', res); return this; }
}

/* ---- Capa de aplicación ---- */
function dnsName(n) { const o = []; for (const l of n.split('.')) { o.push(l.length, ...txt(l)); } o.push(0); return o; }
/* answers: [{name?, type:'A'|'CNAME'|'TXT', ttl, data}] — el nombre de la pregunta se comprime con el puntero 0xc00c */
function dnsMsg(id, q, qtype, resp, answers = [], rcode = 0) {
  const types = { A: 1, CNAME: 5, TXT: 16, AAAA: 28, SRV: 33 };
  const flags = resp ? 0x8180 | rcode : 0x0100;
  const out = [...u16(id), ...u16(flags), 0, 1, ...u16(answers.length), 0, 0, 0, 0, ...dnsName(q), ...u16(types[qtype]), 0, 1];
  for (const a of answers) {
    let rd;
    if (a.type === 'A') rd = ipB(a.data); else if (a.type === 'CNAME') rd = dnsName(a.data); else rd = [a.data.length, ...txt(a.data)];
    out.push(...(a.name && a.name !== q ? dnsName(a.name) : [0xc0, 0x0c]), ...u16(types[a.type]), 0, 1, ...u32(a.ttl || 300), ...u16(rd.length), ...rd);
  }
  return out;
}
function dhcpMsg(op, type, xid, chaddr, o) {
  const b = [op, 1, 6, 0, ...u32(xid), 0, 0, op === 1 ? 0x80 : 0, 0, ...ipB(o.ciaddr || '0.0.0.0'), ...ipB(o.yiaddr || '0.0.0.0'), ...ipB(o.siaddr || '0.0.0.0'), 0, 0, 0, 0, ...macB(chaddr), ...new Array(10).fill(0), ...new Array(64).fill(0), ...new Array(128).fill(0), 99, 130, 83, 99, 53, 1, type];
  if (o.req) b.push(50, 4, ...ipB(o.req));
  if (o.server) b.push(54, 4, ...ipB(o.server));
  if (o.lease) b.push(51, 4, ...u32(o.lease));
  if (o.mask) b.push(1, 4, ...ipB(o.mask));
  if (o.router) b.push(3, 4, ...ipB(o.router));
  if (o.dns) b.push(6, 4, ...ipB(o.dns));
  if (o.host) b.push(12, o.host.length, ...txt(o.host));
  if (o.prl) b.push(55, 4, 1, 3, 6, 15);
  b.push(255); while (b.length < 300) b.push(0);
  return b;
}
function tlsRec(type, body, ver = 0x0303) { return [type, ...u16(ver), ...u16(body.length), ...body]; }
function tlsClientHello(r, sni, alpn = 'http/1.1') {
  const rand = Array.from({ length: 32 }, () => Math.floor(r() * 256)), sid = Array.from({ length: 32 }, () => Math.floor(r() * 256));
  const ciphers = [0x1301, 0x1302, 0x1303, 0xc02b, 0xc02f, 0xc02c, 0xc030];
  const ext = (t, d) => [...u16(t), ...u16(d.length), ...d];
  const sn = [...u16(sni.length + 3), 0, ...u16(sni.length), ...txt(sni)];
  const al = [...u16(alpn.length + 1), alpn.length, ...txt(alpn)];
  const key = Array.from({ length: 32 }, () => Math.floor(r() * 256));
  const exts = [...ext(0, sn), ...ext(10, [0, 4, 0, 0x1d, 0, 0x17]), ...ext(13, [0, 6, 4, 3, 8, 4, 4, 1]), ...ext(16, al), ...ext(43, [4, 3, 4, 3, 3]), ...ext(45, [1, 1]), ...ext(51, [...u16(36), 0, 0x1d, ...u16(32), ...key])];
  const body = [3, 3, ...rand, 32, ...sid, ...u16(ciphers.length * 2), ...ciphers.flatMap(u16), 1, 0, ...u16(exts.length), ...exts];
  return tlsRec(22, [1, 0, ...u16(body.length), ...body], 0x0301);
}
function tlsServerHello(r) {
  const rand = Array.from({ length: 32 }, () => Math.floor(r() * 256)), sid = Array.from({ length: 32 }, () => Math.floor(r() * 256));
  const key = Array.from({ length: 32 }, () => Math.floor(r() * 256));
  const ext = (t, d) => [...u16(t), ...u16(d.length), ...d];
  const exts = [...ext(43, [3, 4]), ...ext(51, [0, 0x1d, ...u16(32), ...key])];
  const body = [3, 3, ...rand, 32, ...sid, 0x13, 0x01, 0, ...u16(exts.length), ...exts];
  return tlsRec(22, [2, 0, ...u16(body.length), ...body]);
}
const tlsApp = (r, n) => tlsRec(23, Array.from({ length: n }, () => Math.floor(r() * 256)));
const tlsCCS = () => tlsRec(20, [1]);

/* SMB2 sobre NetBIOS y NTLMSSP */
function smb2(cmd, resp, mid, sess, tree, status, body) {
  const h = [0xfe, ...txt('SMB'), ...le16(64), ...le16(resp ? 1 : 0), ...le32(status || 0), ...le16(cmd), ...le16(resp ? 1 : 31), ...le32(resp ? 1 : 0), ...le32(0), ...le32(mid), 0, 0, 0, 0, ...le32(0), ...le32(tree || 0), ...le32(0), ...le32(sess || 0), ...new Array(16).fill(0)];
  const m = [...h, ...body];
  return [0, (m.length >> 16) & 255, (m.length >> 8) & 255, m.length & 255, ...m];
}
function smbSessReq(blob) { return [...le16(25), 0, 1, ...le32(1), ...le32(0), ...le16(64 + 24), ...le16(blob.length), ...new Array(8).fill(0), ...blob]; }
function smbSessResp(blob) { return [...le16(9), ...le16(0), ...le16(64 + 8), ...le16(blob.length), ...blob]; }
function smbTreeReq(path) { const p = utf16(path); return [...le16(9), 0, 0, ...le16(64 + 8), ...le16(p.length), ...p]; }
const smbTreeResp = () => [...le16(16), 1, 0, ...le32(0), ...le32(0), ...le32(0x001f01ff)];
const NTLM_FLAGS = 0xe2088297;
function ntlmNeg() { return [...txt('NTLMSSP'), 0, ...le32(1), ...le32(NTLM_FLAGS), ...le16(0), ...le16(0), ...le32(0), ...le16(0), ...le16(0), ...le32(0)]; }
function avPairs(dom, host) { const p = (id, s) => { const v = utf16(s); return [...le16(id), ...le16(v.length), ...v]; }; return [...p(2, dom), ...p(1, host), ...p(4, dom.toLowerCase() + '.test'), ...p(3, host.toLowerCase() + '.' + dom.toLowerCase() + '.test'), ...le16(0), ...le16(0)]; }
function ntlmChal(r, dom, host) {
  const tn = utf16(dom), ti = avPairs(dom, host), off = 48;
  return [...txt('NTLMSSP'), 0, ...le32(2), ...le16(tn.length), ...le16(tn.length), ...le32(off), ...le32(NTLM_FLAGS), ...Array.from({ length: 8 }, () => Math.floor(r() * 256)), ...new Array(8).fill(0), ...le16(ti.length), ...le16(ti.length), ...le32(off + tn.length), ...tn, ...ti];
}
function ntlmAuth(r, dom, user, ws) {
  const rnd = n => Array.from({ length: n }, () => Math.floor(r() * 256));
  const blob = [1, 1, 0, 0, 0, 0, 0, 0, ...rnd(8), ...rnd(8), 0, 0, 0, 0, ...avPairs(dom, 'DC01'), 0, 0, 0, 0];
  const nt = [...rnd(16), ...blob], lm = new Array(24).fill(0);
  const d = utf16(dom), u = utf16(user), w = utf16(ws), sk = rnd(16);
  let off = 64; const fld = a => { const f = [...le16(a.length), ...le16(a.length), ...le32(off)]; off += a.length; return f; };
  const fl = [fld(lm), fld(nt), fld(d), fld(u), fld(w), fld(sk)];
  return [...txt('NTLMSSP'), 0, ...le32(3), ...fl.flat(), ...le32(NTLM_FLAGS), ...lm, ...nt, ...d, ...u, ...w, ...sk];
}

/* DER mínimo para Kerberos v5 (RFC 4120) */
function derLen(n) { return n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]; }
const der = (tag, c) => [tag, ...derLen(c.length), ...c];
const dInt = n => { const b = []; let v = n; do { b.unshift(v & 255); v = Math.floor(v / 256); } while (v > 0); if (b[0] & 0x80) b.unshift(0); return der(2, b); };
const dStr = s => der(0x1b, txt(s));
const dSeq = (...xs) => der(0x30, xs.flat());
const dCtx = (n, c) => der(0xa0 + n, c);
const dTime = s => der(0x18, txt(s));
const princ = (type, names) => dSeq(dCtx(0, dInt(type)), dCtx(1, dSeq(...names.map(dStr))));
function krbReq(msg, o) {
  const body = dSeq(dCtx(0, der(3, [0, 0x40, 0x81, 0x00, 0x10])), ...(o.cname ? [dCtx(1, princ(1, [o.cname]))] : []), dCtx(2, dStr(o.realm)), dCtx(3, princ(2, o.sname)), dCtx(5, dTime('20370913024805Z')), dCtx(7, dInt(o.nonce)), dCtx(8, dSeq(...o.etypes.map(dInt))));
  const m = der(msg === 10 ? 0x6a : 0x6c, dSeq(dCtx(1, dInt(5)), dCtx(2, dInt(msg)), dCtx(4, body)));
  return [...u32(m.length), ...m];
}
function krbRep(msg, o, r) {
  const enc = (et, n) => dSeq(dCtx(0, dInt(et)), dCtx(1, dInt(2)), dCtx(2, der(4, Array.from({ length: n }, () => Math.floor(r() * 256)))));
  const ticket = der(0x61, dSeq(dCtx(0, dInt(5)), dCtx(1, dStr(o.realm)), dCtx(2, princ(2, o.sname)), dCtx(3, enc(o.tktEtype, 120))));
  const m = der(msg === 11 ? 0x6b : 0x6d, dSeq(dCtx(0, dInt(5)), dCtx(1, dInt(msg)), dCtx(3, dStr(o.realm)), dCtx(4, princ(1, [o.cname])), dCtx(5, ticket), dCtx(6, enc(18, 80))));
  return [...u32(m.length), ...m];
}

/* ---- pcap / pcapng ---- */
function writePcap(pkts) {
  const parts = [], hdr = new DataView(new ArrayBuffer(24));
  hdr.setUint32(0, 0xa1b2c3d4, true); hdr.setUint16(4, 2, true); hdr.setUint16(6, 4, true); hdr.setUint32(16, 262144, true); hdr.setUint32(20, 1, true);
  parts.push(new Uint8Array(hdr.buffer));
  for (const p of pkts) {
    const h = new DataView(new ArrayBuffer(16)), sec = Math.floor(p.t), us = Math.round((p.t - sec) * 1e6);
    h.setUint32(0, sec, true); h.setUint32(4, us, true); h.setUint32(8, p.b.length, true); h.setUint32(12, p.b.length, true);
    parts.push(new Uint8Array(h.buffer), p.b);
  }
  const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0)); let o = 0; for (const x of parts) { out.set(x, o); o += x.length; }
  return out;
}
/* Lee pcap (µs y ns, ambos órdenes de bytes) y pcapng (SHB, IDB, EPB, SPB). Solo enlace Ethernet (1). */
function readCapture(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.length < 24) throw new Error('El archivo es demasiado pequeño para ser una captura.');
  const m = dv.getUint32(0, true), pkts = [];
  if ([0xa1b2c3d4, 0xd4c3b2a1, 0xa1b23c4d, 0x4d3cb2a1].includes(m)) {
    const le = m === 0xa1b2c3d4 || m === 0xa1b23c4d, ns = m === 0xa1b23c4d || m === 0x4d3cb2a1;
    const link = dv.getUint32(20, le); if (link !== 1) throw new Error(`Tipo de enlace ${link} no soportado: Megalodon solo lee Ethernet.`);
    let o = 24;
    while (o + 16 <= u8.length) {
      const s = dv.getUint32(o, le), f = dv.getUint32(o + 4, le), cl = dv.getUint32(o + 8, le);
      if (o + 16 + cl > u8.length) break;
      pkts.push({ t: s + f / (ns ? 1e9 : 1e6), b: u8.slice(o + 16, o + 16 + cl) }); o += 16 + cl;
    }
    return pkts;
  }
  if (m === 0x0a0d0d0a) {
    let o = 0, le = true; const ifs = [];
    while (o + 12 <= u8.length) {
      let type = dv.getUint32(o, le);
      if (type === 0x0a0d0d0a) { le = dv.getUint32(o + 8, true) === 0x1a2b3c4d; type = 0x0a0d0d0a; }
      const len = dv.getUint32(o + 4, le); if (len < 12 || o + len > u8.length) break;
      if (type === 1) {
        const link = dv.getUint16(o + 8, le); let res = 6;
        let p = o + 16; while (p + 4 <= o + len - 4) { const code = dv.getUint16(p, le), ol = dv.getUint16(p + 2, le); if (code === 0) break; if (code === 9) { const v = u8[p + 4]; res = v & 0x80 ? -(v & 0x7f) : v; } p += 4 + ((ol + 3) & ~3); }
        ifs.push({ link, div: res < 0 ? 2 ** -res : 10 ** res });
      } else if (type === 6) {
        const i = ifs[dv.getUint32(o + 8, le)] || { link: 1, div: 1e6 }; if (i.link !== 1) throw new Error(`Tipo de enlace ${i.link} no soportado: Megalodon solo lee Ethernet.`);
        const ts = dv.getUint32(o + 12, le) * 4294967296 + dv.getUint32(o + 16, le), cl = dv.getUint32(o + 20, le);
        pkts.push({ t: ts / i.div, b: u8.slice(o + 28, o + 28 + cl) });
      } else if (type === 3) { const ol = dv.getUint32(o + 8, le); pkts.push({ t: pkts.length ? pkts[pkts.length - 1].t : 0, b: u8.slice(o + 12, o + 12 + Math.min(ol, len - 16)) }); }
      o += len;
    }
    return pkts;
  }
  throw new Error('No reconozco el formato: abre un .pcap o .pcapng.');
}

/* pcapng mínimo: SHB + IDB (Ethernet, µs) + un EPB por paquete */
function writePcapng(pkts, comment = 'Megalodon') {
  const parts = [], pad4 = n => (n + 3) & ~3;
  const block = (type, body) => { const len = 12 + body.length, b = new Uint8Array(len), dv = new DataView(b.buffer); dv.setUint32(0, type, true); dv.setUint32(4, len, true); b.set(body, 8); dv.setUint32(len - 4, len, true); parts.push(b); };
  const opt = (code, bytes) => { const o = new Uint8Array(4 + pad4(bytes.length)), dv = new DataView(o.buffer); dv.setUint16(0, code, true); dv.setUint16(2, bytes.length, true); o.set(bytes, 4); return o; };
  const cat = arrs => { const out = new Uint8Array(arrs.reduce((a, b) => a + b.length, 0)); let o = 0; for (const x of arrs) { out.set(x, o); o += x.length; } return out; };
  const shb = new Uint8Array(16), sdv = new DataView(shb.buffer); sdv.setUint32(0, 0x1a2b3c4d, true); sdv.setUint16(4, 1, true); sdv.setUint16(6, 0, true); sdv.setInt32(8, -1, true); sdv.setInt32(12, -1, true);
  block(0x0a0d0d0a, cat([shb, opt(4, TE.encode(comment)), new Uint8Array(4)]));
  const idb = new Uint8Array(8), idv = new DataView(idb.buffer); idv.setUint16(0, 1, true); idv.setUint32(4, 262144, true);
  block(1, cat([idb, opt(9, new Uint8Array([6])), new Uint8Array(4)]));
  for (const p of pkts) {
    const us = Math.round(p.t * 1e6), h = new Uint8Array(20), dv = new DataView(h.buffer);
    dv.setUint32(0, 0, true); dv.setUint32(4, Math.floor(us / 4294967296), true); dv.setUint32(8, us % 4294967296, true); dv.setUint32(12, p.b.length, true); dv.setUint32(16, p.b.length, true);
    block(6, cat([h, p.b, new Uint8Array(pad4(p.b.length) - p.b.length)]));
  }
  return cat(parts);
}
