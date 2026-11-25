/* Megalodon · utilidades de interfaz: escape, formato ligero, diálogos, avisos y portapapeles. */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/* `código` y **negrita** sobre texto ya escapado */
const md = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
let uid = 0; const nextId = p => `${p}-${++uid}`;
const fmtNum = n => n.toLocaleString(LANG === 'en' ? 'en-GB' : 'es-ES');
const fmtBytes = n => n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1).replace('.', LANG === 'en' ? '.' : ',')} KB`;

function toast(msg, kind = 'info', icon) {
  const box = $('#toasts'), el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${ic(icon || (kind === 'ok' ? 'ok' : kind === 'err' ? 'ko' : 'info'))}<span>${msg}</span>`;
  box.append(el);
  const live = [...box.children].filter(x => !x.classList.contains('out'));
  live.slice(0, Math.max(0, live.length - 3)).forEach(x => { x.classList.remove('in'); x.classList.add('out'); setTimeout(() => x.remove(), 220); });
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 220); }, kind === 'err' ? 5200 : 2600);
}

/* Un único <dialog> reutilizable. openDialog devuelve el elemento del cuerpo; onClose se llama al cerrar. */
let dlgClose = null, dlgReturn = null;
let dlgTimer = 0;                                            // cierre animado pendiente: no debe cerrar un diálogo abierto después
function openDialog({ title, body, wide = false, cls = '', onClose, role, footer }) {
  const d = $('#dlg');
  if (dlgTimer) { clearTimeout(dlgTimer); dlgTimer = 0; }
  if (d.open) closeDialog(true);
  dlgReturn = document.activeElement;
  const tid = nextId('dlg-t');
  d.className = `dlg ${wide ? 'wide' : ''} ${cls}`;
  d.setAttribute('aria-labelledby', tid);
  if (role) d.setAttribute('role', role); else d.removeAttribute('role');
  d.innerHTML = `<div class="dlg-in"><div class="dlg-h"><h2 id="${tid}">${title}</h2><button class="ibtn" data-x aria-label="${t('close')}">${ic('x')}</button></div><div class="dlg-b"></div>${footer ? `<div class="dlg-f">${footer}</div>` : ''}</div>`;
  const b = $('.dlg-b', d);
  if (typeof body === 'string') b.innerHTML = body; else if (body) b.append(body);
  $('[data-x]', d).onclick = () => closeDialog();
  dlgClose = onClose || null;
  d.showModal();
  d.classList.remove('closing');
  return d;
}
function closeDialog(instant) {
  const d = $('#dlg'); if (!d.open) return;
  if (dlgTimer) { clearTimeout(dlgTimer); dlgTimer = 0; }
  const done = () => { dlgTimer = 0; d.close(); d.classList.remove('closing'); const f = dlgClose; dlgClose = null; if (f) f(); if (dlgReturn && dlgReturn.isConnected) dlgReturn.focus(); };
  if (instant || REDUCED.matches) return done();
  d.classList.add('closing'); dlgTimer = setTimeout(done, 150);
}
document.addEventListener('DOMContentLoaded', () => {
  const d = $('#dlg');
  d.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });
  d.addEventListener('click', e => { if (e.target === d) closeDialog(); });
});

function confirmDialog({ title, text, ok, danger = true }) {
  return new Promise(res => {
    let answered = false;
    const d = openDialog({ title, role: 'alertdialog', cls: 'narrow', body: `<p class="lead-sm">${text}</p>`, footer: `<button class="btn ghost" data-no>${t('cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${ok}</button>`, onClose: () => { if (!answered) res(false); } });
    $('[data-no]', d).onclick = () => { answered = true; res(false); closeDialog(); };
    $('[data-yes]', d).onclick = () => { answered = true; res(true); closeDialog(); };
    $('[data-no]', d).focus();
  });
}

async function copyText(txt, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(txt); ok = true; } catch {
    const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.className = 'vh'; document.body.append(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove();
  }
  if (btn) { btn.classList.add('done'); btn.innerHTML = ic(ok ? 'copied' : 'ko'); btn.setAttribute('aria-label', ok ? t('copied') : 'Error'); setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = ic('copy'); btn.setAttribute('aria-label', t('copy')); }, 1400); }
  toast(ok ? `${t('copied')}: <code>${esc(txt)}</code>` : 'No se pudo copiar', ok ? 'ok' : 'err', ok ? 'copied' : 'ko');
}

function download(bytes, name, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
