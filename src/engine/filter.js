/* Megalodon · filtros de visualización al estilo Wireshark: analizador, evaluador, errores en español y autocompletado.
   Semántica de Wireshark 4.x: «==» se cumple si CUALQUIER valor coincide; «a != b» exige que el campo exista y NINGÚN valor sea b
   (por eso «tcp.port != 80» no muestra ARP, pero «!(tcp.port == 80)» sí); «matches» ignora mayúsculas. */
const F_OPS = { '==': 'eq', 'eq': 'eq', '!=': 'ne', 'ne': 'ne', '===': 'all_eq', '!==': 'any_ne', '>': 'gt', 'gt': 'gt', '<': 'lt', 'lt': 'lt', '>=': 'ge', 'ge': 'ge', '<=': 'le', 'le': 'le', 'contains': 'contains', 'matches': 'matches', '~': 'matches', 'in': 'in', '&': 'bitand' };
const F_FUNCS = { len: 'u', lower: 's', upper: 's', count: 'u' };
class FilterError extends Error { constructor(msg, pos, len = 1) { super(msg); this.pos = pos; this.len = len; } }

function fLex(src) {
  const toks = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const s = i;
    if (c === '"') {
      let v = ''; i++;
      while (i < src.length && src[i] !== '"') { if (src[i] === '\\' && i + 1 < src.length) { const n = src[++i]; v += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n; } else v += src[i]; i++; }
      if (src[i] !== '"') throw new FilterError('Falta cerrar las comillas de la cadena', s, src.length - s);
      i++; toks.push({ k: 'str', v, s, e: i }); continue;
    }
    const three = src.substr(i, 3), two = src.substr(i, 2);
    if (three === '===' || three === '!==') { toks.push({ k: 'op', v: three, s, e: i += 3 }); continue; }
    if (['==', '!=', '>=', '<=', '&&', '||', '^^', '..'].includes(two)) { toks.push({ k: ['&&', '||', '^^'].includes(two) ? 'log' : two === '..' ? 'range' : 'op', v: two, s, e: i += 2 }); continue; }
    if ('<>~&'.includes(c)) { toks.push({ k: 'op', v: c, s, e: ++i }); continue; }
    if (c === '!') { toks.push({ k: 'not', v: c, s, e: ++i }); continue; }
    if ('(){}[],'.includes(c)) { toks.push({ k: c, v: c, s, e: ++i }); continue; }
    if (c === '=') throw new FilterError('Un solo «=» no vale: para comparar usa «==»', s, 1);
    if (c === '|' || c === '^') throw new FilterError(`«${c}» suelto no vale: usa «${c}${c}»`, s, 1);
    const m = src.slice(i).match(/^[A-Za-z0-9_.:\-\/$*%+@]+/);
    if (!m) throw new FilterError(`Carácter inesperado «${c}»`, s, 1);
    let w = m[0];
    const dd = w.indexOf('..'); if (dd > 0) w = w.slice(0, dd);
    i += w.length;
    const lw = w.toLowerCase();
    if (['and', 'or', 'xor'].includes(lw)) toks.push({ k: 'log', v: lw === 'and' ? '&&' : lw === 'or' ? '||' : '^^', s, e: i });
    else if (lw === 'not') toks.push({ k: 'not', v: '!', s, e: i });
    else if (F_OPS[lw] && /^[a-z]+$/.test(lw)) toks.push({ k: 'op', v: lw, s, e: i });
    else toks.push({ k: 'word', v: w, s, e: i });
  }
  return toks;
}

function parseFilter(src) {
  const text = String(src || '').trim();
  if (!text) return { ok: true, empty: true, test: () => true, fields: [] };
  try {
    const toks = fLex(text); let p = 0; const used = new Set();
    const peek = () => toks[p], eat = k => (toks[p] && toks[p].k === k ? toks[p++] : null);
    const expect = (k, what) => { const t = eat(k); if (!t) { const at = toks[p] || { s: text.length, e: text.length + 1 }; throw new FilterError(`Se esperaba ${what}`, at.s, at.e - at.s); } return t; };
    const orExpr = () => { let l = andExpr(); for (let t; (t = peek()) && t.k === 'log' && t.v !== '&&';) { p++; const r = andExpr(); l = t.v === '||' ? { k: 'or', l, r } : { k: 'xor', l, r }; } return l; };
    const andExpr = () => { let l = notExpr(); while (peek() && peek().k === 'log' && peek().v === '&&') { p++; l = { k: 'and', l, r: notExpr() }; } return l; };
    const notExpr = () => eat('not') ? { k: 'not', x: notExpr() } : primary();
    const operand = () => {
      const t = peek();
      if (!t) throw new FilterError('El filtro termina antes de tiempo: falta un valor', text.length, 1);
      if (t.k === 'word' && F_FUNCS[t.v.toLowerCase()] && toks[p + 1] && toks[p + 1].k === '(') {
        p += 2; const fn = t.v.toLowerCase(); const a = expect('word', 'un campo dentro de la función'); fieldOf(a); expect(')', '«)» para cerrar la función');
        return { k: 'fn', fn, field: a.v, t: F_FUNCS[fn], s: t.s };
      }
      if (t.k === 'word' && FIELDS[t.v]) { p++; used.add(t.v); return { k: 'field', field: t.v, t: FIELDS[t.v].t, s: t.s, e: t.e }; }
      if (t.k === 'word' || t.k === 'str') { p++; return { k: 'lit', v: t.v, quoted: t.k === 'str', s: t.s, e: t.e }; }
      throw new FilterError(`No se esperaba «${t.v}» aquí`, t.s, t.e - t.s);
    };
    const fieldOf = t => { if (!FIELDS[t.v]) throw unknown(t); used.add(t.v); return t.v; };
    const unknown = t => { const sug = suggestField(t.v); return new FilterError(`«${t.v}» no es un campo ni un protocolo conocido${sug ? `. ¿Querías decir «${sug}»?` : ''}`, t.s, t.e - t.s); };
    function primary() {
      if (eat('(')) { const x = orExpr(); expect(')', '«)» para cerrar el paréntesis'); return x; }
      const t = peek();
      if (!t) throw new FilterError('El filtro termina antes de tiempo', text.length, 1);
      if (t.k === 'log' || t.k === 'op') throw new FilterError(`«${t.v}» necesita algo a su izquierda`, t.s, t.e - t.s);
      const left = operand();
      if (left.k === 'lit') {
        if (left.quoted || !peek() || peek().k !== 'op') throw unknown({ v: left.v, s: left.s, e: left.e });
        throw unknown({ v: left.v, s: left.s, e: left.e });
      }
      const o = peek();
      if (!o || o.k !== 'op') return { k: 'exists', x: left };
      p++;
      const op = F_OPS[o.v];
      if (op === 'in') {
        expect('{', '«{» después de «in»'); const set = [];
        while (true) {
          const a = valueTok(left); set.push(eat('range') ? { lo: a, hi: valueTok(left) } : a);
          if (eat('}')) break;
          if (!peek()) throw new FilterError('Falta «}» para cerrar el conjunto', text.length, 1);
          if (!eat(',')) throw new FilterError('Separa los valores del conjunto con comas: {80, 443}', peek().s, peek().e - peek().s);
        }
        if (!set.length) throw new FilterError('El conjunto de «in» está vacío', o.s, o.e - o.s);
        return { k: 'in', x: left, set };
      }
      if ((op === 'contains' || op === 'matches') && !['s', 'p'].includes(left.t) && left.t !== 'mac') throw new FilterError(`«${o.v}» solo funciona con campos de texto; ${left.field || left.fn} es numérico`, o.s, o.e - o.s);
      if (op === 'matches') { const v = expect('str', 'una expresión regular entre comillas tras «matches»'); let re; try { re = new RegExp(v.v, 'i'); } catch { throw new FilterError('La expresión regular no es válida', v.s, v.e - v.s); } return { k: 'cmp', op, x: left, v: re }; }
      if (op === 'contains' && left.t === 'p') { const v = peek(); if (!v || !['str', 'word'].includes(v.k)) throw new FilterError('Falta el texto a buscar tras «contains»', o.e, 1); p++; return { k: 'cmp', op, x: left, v: { s: v.v } }; }
      return { k: 'cmp', op, x: left, v: valueTok(left), opTok: o };
    }
    function valueTok(left) {
      const t = peek();
      if (!t || !['word', 'str'].includes(t.k)) { const at = t || { s: text.length, e: text.length + 1 }; throw new FilterError(`Falta el valor con el que comparar ${left.field || ''}`.trim(), at.s, at.e - at.s); }
      if (t.k === 'word' && FIELDS[t.v]) { p++; used.add(t.v); return { field: t.v, t: FIELDS[t.v].t }; }
      p++; return coerce(left.t, t);
    }
    function coerce(type, t) {
      const v = t.v, bad = why => new FilterError(why, t.s, t.e - t.s);
      if (type === 'u' || type === 'f' || type === 'b') {
        if (type === 'b' && /^(true|false)$/i.test(v)) return { n: /^true$/i.test(v) ? 1 : 0 };
        const n = /^0x[0-9a-f]+$/i.test(v) ? parseInt(v, 16) : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
        if (t.k === 'str' || Number.isNaN(n)) throw bad(`«${v}» no es un número válido para este campo`);
        return { n };
      }
      if (type === 'ip') {
        const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/);
        if (!m || m.slice(1, 5).some(x => +x > 255) || (m[5] && +m[5] > 32)) throw bad(`«${v}» no es una dirección IPv4 válida (p. ej. 192.168.56.10 o 192.168.56.0/24)`);
        const bits = m[5] === undefined ? 32 : +m[5];
        return { ip: ipNum(v.split('/')[0]), mask: bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0 };
      }
      if (type === 'mac') { const s = v.toLowerCase().replace(/-/g, ':'); if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(s)) throw bad(`«${v}» no es una MAC válida (p. ej. 08:00:27:4d:65:67)`); return { s }; }
      if (type === 'p') throw bad('Un protocolo no se compara con un valor: escribe solo su nombre, p. ej. «http»');
      return { s: v };
    }
    const ast = orExpr();
    if (p < toks.length) { const t = toks[p]; throw new FilterError(t.k === 'word' || t.k === 'str' ? `Falta un operador lógico («&&» o «||») antes de «${t.v}»` : `No se esperaba «${t.v}» aquí`, t.s, t.e - t.s); }
    return { ok: true, ast, fields: [...used], test: pkt => evalNode(ast, pkt) };
  } catch (e) {
    if (e instanceof FilterError) return { ok: false, error: e.message, pos: e.pos, len: e.len };
    throw e;
  }
}

function ipNum(s) { return s.split('.').reduce((a, x) => a * 256 + +x, 0) >>> 0; }
function valuesOf(x, pkt) {
  if (x.k === 'fn') {
    const vs = pkt.f[x.field] || [];
    if (x.fn === 'count') return [vs.length];
    if (x.fn === 'len') return vs.map(v => String(v).length);
    return vs.map(v => x.fn === 'lower' ? String(v).toLowerCase() : String(v).toUpperCase());
  }
  if (x.t === 'p') { const r = pkt.layers && pkt.layers[x.field]; if (!r) return []; let o = ''; for (let i = r[0]; i < r[1]; i++) o += String.fromCharCode(pkt.b[i]); return [o]; }
  return pkt.f[x.field] || [];
}
function cmpOne(op, a, v, t) {
  if (v.field) return false;
  if (op === 'contains') return String(a).includes(v.s);
  if (op === 'matches') return v.test(String(a));
  if (t === 'ip') { const n = ipNum(a); const eq = ((n & v.mask) >>> 0) === ((v.ip & v.mask) >>> 0); if (op === 'eq' || op === 'all_eq') return eq; if (op === 'ne' || op === 'any_ne') return !eq; const d = n - v.ip; return op === 'gt' ? d > 0 : op === 'lt' ? d < 0 : op === 'ge' ? d >= 0 : d <= 0; }
  const A = v.n !== undefined ? Number(a) : String(a), B = v.n !== undefined ? v.n : v.s;
  switch (op) {
    case 'eq': case 'all_eq': return A === B; case 'ne': case 'any_ne': return A !== B;
    case 'gt': return A > B; case 'lt': return A < B; case 'ge': return A >= B; case 'le': return A <= B;
    case 'bitand': return (Number(a) & v.n) !== 0;
  }
  return false;
}
function evalNode(n, pkt) {
  switch (n.k) {
    case 'or': return evalNode(n.l, pkt) || evalNode(n.r, pkt);
    case 'and': return evalNode(n.l, pkt) && evalNode(n.r, pkt);
    case 'xor': return evalNode(n.l, pkt) !== evalNode(n.r, pkt);
    case 'not': return !evalNode(n.x, pkt);
    case 'exists': return n.x.k === 'fn' ? valuesOf(n.x, pkt).some(Boolean) : !!pkt.f[n.x.field];
    case 'in': { const vs = valuesOf(n.x, pkt); return vs.some(a => n.set.some(s => s.lo ? cmpOne('ge', a, s.lo, n.x.t) && cmpOne('le', a, s.hi, n.x.t) : cmpOne('eq', a, s, n.x.t))); }
    case 'cmp': {
      const vs = valuesOf(n.x, pkt);
      const rv = n.v.field ? (pkt.f[n.v.field] || []) : null;
      const one = (op, a) => rv ? rv.some(b => (n.x.t === 'ip' ? cmpOne(op, a, { ip: ipNum(b), mask: 0xffffffff }, 'ip') : cmpOne(op, a, typeof b === 'number' ? { n: b } : { s: String(b) }, n.x.t))) : cmpOne(op, a, n.v, n.x.t);
      if (n.op === 'ne') return vs.length > 0 && !vs.some(a => one('eq', a));
      if (n.op === 'all_eq') return vs.length > 0 && vs.every(a => one('eq', a));
      return vs.some(a => one(n.op, a));
    }
  }
  return false;
}

/* Sugerencias: distancia de edición para «¿Querías decir…?» */
function editDist(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
const F_ALIASES = { 'ip.address': 'ip.addr', 'tcp.dport': 'tcp.dstport', 'tcp.sport': 'tcp.srcport', 'http.method': 'http.request.method', 'http.uri': 'http.request.uri', 'http.code': 'http.response.code', 'tls.sni': 'tls.handshake.extensions_server_name', 'ssl': 'tls', 'smb': 'smb2', 'bootp': 'dhcp', 'dns.name': 'dns.qry.name', 'tcp.syn': 'tcp.flags.syn', 'tcp.flags.rst': 'tcp.flags.reset', 'tcp.flags.psh': 'tcp.flags.push' };
function suggestField(w) {
  const lw = w.toLowerCase(); if (F_ALIASES[lw]) return F_ALIASES[lw]; if (FIELDS[lw]) return lw;
  let best = null, bd = 4;
  for (const n of Object.keys(FIELDS)) { const d = editDist(lw, n); if (d < bd) { bd = d; best = n; } }
  return bd <= Math.max(1, Math.floor(lw.length / 4)) ? best : null;
}

/* Autocompletado: qué proponer según la palabra bajo el cursor */
function filterComplete(text, caret = text.length) {
  const before = text.slice(0, caret), m = before.match(/[A-Za-z0-9_.\-]*$/), word = m ? m[0] : '', start = caret - word.length;
  const prev = before.slice(0, start).trimEnd();
  const afterField = /([A-Za-z0-9_.\-]+)$/.exec(prev);
  if (afterField && FIELDS[afterField[1]] && !/(==|!=|>=|<=|[<>~]|\b(eq|ne|gt|lt|ge|le|contains|matches|in))$/.test(prev)) {
    const t = FIELDS[afterField[1]].t;
    const ops = t === 'p' ? ['&&', '||'] : t === 's' ? ['==', '!=', 'contains', 'matches', '&&', '||'] : ['==', '!=', '>', '<', '>=', '<=', 'in', '&&', '||'];
    return { start, end: caret, items: ops.filter(o => o.startsWith(word)).map(o => ({ v: o, d: OP_DESC[o] || '', kind: 'op' })) };
  }
  if (!word) return { start, end: caret, items: [] };
  const lw = word.toLowerCase(), names = Object.keys(FIELDS);
  let items = names.filter(n => n.startsWith(lw));
  if (lw.includes('.')) items = items.filter(n => n.split('.').length <= lw.split('.').length + 1);
  else items = items.filter(n => !n.includes('.'));
  if (!items.length) items = names.filter(n => n.includes(lw)).slice(0, 8);
  items.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return { start, end: caret, items: items.slice(0, 12).map(n => ({ v: n, d: FIELDS[n].d, kind: FIELDS[n].t === 'p' ? 'proto' : 'field', more: names.some(x => x.startsWith(n + '.')) })) };
}
const OP_DESC = { '==': 'igual a', '!=': 'distinto de', '>': 'mayor que', '<': 'menor que', '>=': 'mayor o igual', '<=': 'menor o igual', 'contains': 'contiene el texto', 'matches': 'cumple la expresión regular (sin distinguir mayúsculas)', 'in': 'está en el conjunto {…}', '&&': 'y además', '||': 'o bien' };

function applyFilter(pkts, f) { const r = typeof f === 'string' ? parseFilter(f) : f; return r.ok ? pkts.filter(r.test) : null; }
