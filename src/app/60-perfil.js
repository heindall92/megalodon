/* Megalodon · Perfil (configurable, solo en este navegador) y «Acerca de» (autor, ecosistema, licencias y avisos). */
const BRAND_PATHS = { github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12', hackthebox: 'm22.5106 6.4566.0008-.0123a.888.888 0 0 0-.2717-.6384c-.0084-.0084-.018-.0155-.0267-.0235-.0186-.0166-.0371-.0333-.0572-.0484-.0193-.0147-.04-.0276-.0607-.0406-.0096-.006-.0182-.0131-.0281-.0188L12.4576.1266a.891.891 0 0 0-.9223.0043L1.933 5.6744c-.0107.0062-.0203.014-.0307.0205-.0073.0047-.015.008-.0223.0128-.007.0047-.013.0106-.02.0155a.8769.8769 0 0 0-.147.1333l-.0026.003a.8872.8872 0 0 0-.2218.5847l.0009.014c-.0002.0088-.0015.0176-.0015.0264v11.0708c0 .3277.1802.6288.469.7836l9.5986 5.5417c.0076.0044.0158.0075.0236.0117a.8754.8754 0 0 0 .166.0687c.0134.004.0266.0083.0401.0117a.8793.8793 0 0 0 .072.0142c.0117.0019.0232.0045.0349.006a.835.835 0 0 0 .2157 0c.0117-.0015.0232-.0041.0348-.006a.9.9 0 0 0 .072-.0142c.0135-.0034.0267-.0077.04-.0117a.895.895 0 0 0 .0646-.0217.9134.9134 0 0 0 .1015-.047c.0078-.0042.016-.0072.0236-.0117l9.5986-5.5417a.8888.8888 0 0 0 .469-.7836V6.4779c0-.0071-.0012-.0142-.0014-.0213zM5.2543 6.0822l6.5367-3.774a.4182.4182 0 0 1 .4182 0l6.5366 3.774a.4182.4182 0 0 1 0 .7243l-6.5367 3.774a.4182.4182 0 0 1-.4182 0l-6.5366-3.774a.4182.4182 0 0 1 0-.7243zm5.6134 14.3449a.4172.4172 0 0 1-.626.3613L3.718 17.0218a.4173.4173 0 0 1-.2086-.3613V9.1279a.4172.4172 0 0 1 .6258-.3613l6.524 3.7666a.4172.4172 0 0 1 .2086.3614v7.5325zm9.623-3.7666a.4173.4173 0 0 1-.2086.3613l-6.5239 3.7666a.4172.4172 0 0 1-.6259-.3613v-7.5325c0-.149.0796-.2868.2087-.3614l6.5239-3.7666a.4172.4172 0 0 1 .6258.3613v7.5326z' };
const brandIc = (n, c = '') => (BRAND_PATHS[n] ? `<svg class="i brand ${c}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${BRAND_PATHS[n]}"/></svg>`
  : n === 'linkedin' ? `<svg class="i ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>` : ic(n, c));

/* ---------- Perfil ---------- */
const KIND_TXT = { student: ['Estudiante', 'Student'], pro: ['Profesional', 'Professional'], teacher: ['Docente', 'Teacher'], self: ['Autodidacta', 'Self-taught'], switch: ['Cambio de carrera', 'Career switcher'] };
const ROLE_TXT = { pentester: ['Pentester', 'Pentester'], soc: ['Analista SOC', 'SOC analyst'], sysadmin: ['Administración de sistemas', 'Systems administration'], network: ['Redes', 'Networking'], dev: ['Desarrollo', 'Development'], auditor: ['Auditoría', 'Auditing'], grc: ['GRC y cumplimiento', 'GRC and compliance'], student: ['Estudiante de ciberseguridad', 'Cybersecurity student'], other: ['Otro', 'Other'] };
const COLOR_TXT = { azul: ['Azul', 'Blue'], turquesa: ['Turquesa', 'Teal'], verde: ['Verde', 'Green'], ambar: ['Ámbar', 'Amber'], coral: ['Coral', 'Coral'], violeta: ['Violeta', 'Violet'] };
const tx = pair => (pair ? pair[LANG === 'en' ? 1 : 0] : '');
const initials = name => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => Array.from(w)[0].toUpperCase()).join('');
const roleLabel = p => (p.role === 'other' ? p.roleOther || tx(ROLE_TXT.other) : tx(ROLE_TXT[p.role]));
const profileLine = p => [roleLabel(p), tx(KIND_TXT[p.kind])].filter(Boolean).join(' · ');
const avatar = (p, cls = '') => `<span class="av av-${p.color} ${cls}" aria-hidden="true">${initials(p.name) ? esc(initials(p.name)) : ic('user')}</span>`;

/* Actividad: retos resueltos por día (las fechas salen de cuándo se resolvió cada reto) */
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function activity(weeks = 15) {
  const per = {};
  Object.values(S.get().done).forEach(d => { if (d && d.at) { const k = dayKey(new Date(d.at)); per[k] = (per[k] || 0) + 1; } });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;                    // lunes = 0
  const start = new Date(today); start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const days = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) days.push({ date: new Date(d), n: per[dayKey(d)] || 0 });
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) { if (days[i].n) streak++; else if (i === days.length - 1) continue; else break; }
  const active = days.filter(d => d.n).length, total = days.reduce((s, d) => s + d.n, 0);
  return { days, streak, active, total, weeks };
}
function heatmap(a) {
  const fmt = new Intl.DateTimeFormat(LANG === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' });
  const lvl = n => (n >= 6 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n ? 1 : 0);
  const summary = L(`${a.total} retos en las últimas ${a.weeks} semanas, ${a.active} días con actividad y una racha de ${a.streak} días.`, `${a.total} challenges in the last ${a.weeks} weeks, ${a.active} active days and a ${a.streak}-day streak.`);
  return `<div class="hm" role="img" aria-label="${esc(summary)}">${a.days.map((d, i) => `<span class="hm-c l${lvl(d.n)}" data-i="${i}" title="${esc(`${fmt.format(d.date)}: ${d.n} ${d.n === 1 ? L('reto', 'challenge') : L('retos', 'challenges')}`)}"></span>`).join('')}</div>
    <div class="hm-leg" aria-hidden="true"><span>${L('Menos', 'Less')}</span>${[0, 1, 2, 3, 4].map(n => `<span class="hm-c l${n}"></span>`).join('')}<span>${L('Más', 'More')}</span></div>`;
}

function viewProfile(main) {
  const p = S.get().profile;
  const kinds = PROFILE_KINDS.map(k => `<label class="pchip"><input type="radio" name="pf-kind" value="${k}" ${p.kind === k ? 'checked' : ''}><span>${tx(KIND_TXT[k])}</span></label>`).join('');
  const roles = PROFILE_ROLES.map(r => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${tx(ROLE_TXT[r])}</option>`).join('');
  const colors = PROFILE_COLORS.map(c => `<label class="sw-c"><input type="radio" name="pf-color" value="${c}" ${p.color === c ? 'checked' : ''}><span class="sw-dot av-${c}" aria-hidden="true"></span><span class="vh">${tx(COLOR_TXT[c])}</span></label>`).join('');
  main.innerHTML = `<div class="wrap page pf">
    <div class="sec-h"><p class="eyebrow">${L('Tu perfil', 'Your profile')}</p><h1>${L('Perfil', 'Profile')}</h1><p class="muted">${L('Tu nombre, tu tipo de perfil y tu rol. Se guardan solo en este navegador: nada sale de tu equipo.', 'Your name, profile type and role. They are saved only in this browser: nothing leaves your device.')}</p></div>
    <div class="pf-grid">
      <section class="card pf-id" aria-labelledby="pf-card-t">
        <h2 id="pf-card-t" class="vh">${L('Tarjeta del perfil', 'Profile card')}</h2>
        <div class="pf-hero" data-preview></div>
        <dl class="pf-stats" data-stats></dl>
        <div class="pf-act"><h3>${ic('calendar', 'sm')}${L('Actividad', 'Activity')}</h3><div data-hm></div></div>
        <div class="pf-badges"><h3>${ic('award', 'sm')}${L('Insignias', 'Badges')}</h3><ul data-badges></ul></div>
      </section>
      <section class="card pf-form" aria-labelledby="pf-form-t">
        <h2 id="pf-form-t">${ic('pencil', 'sm')}${L('Edita tus datos', 'Edit your details')}</h2>
        <div class="fld"><label for="pf-name">${L('Nombre', 'Name')}</label><input id="pf-name" class="tinput" type="text" maxlength="${PROFILE_MAX.name}" autocomplete="name" spellcheck="false" value="${esc(p.name)}" placeholder="${L('Cómo quieres que te llame', 'What should we call you')}" aria-describedby="pf-name-h"><p id="pf-name-h" class="sm muted">${L(`Hasta ${PROFILE_MAX.name} caracteres. Las iniciales forman tu avatar.`, `Up to ${PROFILE_MAX.name} characters. Your initials make your avatar.`)}</p></div>
        <fieldset class="fld"><legend>${L('Tipo de perfil', 'Profile type')}</legend><div class="pchips">${kinds}</div></fieldset>
        <div class="fld"><label for="pf-role">${L('Rol', 'Role')}</label><select id="pf-role" class="tinput"><option value="" ${p.role ? '' : 'selected'}>${L('Elige tu rol', 'Choose your role')}</option>${roles}</select></div>
        <div class="fld" data-other ${p.role === 'other' ? '' : 'hidden'}><label for="pf-other">${L('¿Cuál es tu rol?', 'What is your role?')}</label><input id="pf-other" class="tinput" type="text" maxlength="${PROFILE_MAX.roleOther}" spellcheck="false" value="${esc(p.roleOther)}" placeholder="${L('Por ejemplo: Red Team, DFIR, OT…', 'For example: Red Team, DFIR, OT…')}"></div>
        <fieldset class="fld"><legend>${L('Color del avatar', 'Avatar colour')}</legend><div class="swatches">${colors}</div></fieldset>
        <div class="pf-foot"><p class="pf-saved sm" role="status" aria-live="polite" data-saved></p><button type="button" class="btn ghost sm" data-clear>${ic('eraser', 'sm')}${L('Vaciar perfil', 'Clear profile')}</button></div>
      </section>
    </div></div>${siteFooter()}`;
  const paint = () => {
    const q = S.get().profile, lv = S.level(), xp = S.xp(), solved = Object.keys(S.get().done).length, total = MODULES.reduce((s, m) => s + m.tasks.length, 0), nb = Object.keys(S.get().badges).length;
    $('[data-preview]', main).innerHTML = `${avatar(q, 'xl')}<div class="pf-who"><p class="pf-name">${q.name ? esc(q.name) : `<span class="muted">${L('Sin nombre todavía', 'No name yet')}</span>`}</p><p class="pf-line">${esc(profileLine(q)) || `<span class="muted">${L('Elige tu tipo de perfil y tu rol', 'Pick your profile type and role')}</span>`}</p><p class="pf-lv">${ic('trophy', 'sm')}${esc(lvName(lv))}</p></div>`;
    $('[data-stats]', main).innerHTML = `<div><dt>XP</dt><dd class="num">${xp}</dd></div><div><dt>${t('level')}</dt><dd>${lv.i + 1}<small> / ${LEVELS.length}</small></dd></div><div><dt>${L('Retos', 'Challenges')}</dt><dd class="num">${solved}<small> / ${total}</small></dd></div><div><dt>${L('Insignias', 'Badges')}</dt><dd class="num">${nb}<small> / ${MODULES.length}</small></dd></div>`;
    const a = activity();
    $('[data-hm]', main).innerHTML = heatmap(a) + `<p class="sm muted pf-hm-sum">${a.total ? L(`${a.total} retos en ${a.active} días · racha de ${a.streak} ${a.streak === 1 ? 'día' : 'días'}`, `${a.total} challenges over ${a.active} days · ${a.streak}-day streak`) : L('Resuelve tu primer reto y aparecerá aquí.', 'Solve your first challenge and it will show up here.')}</p>`;
    $$('.hm-c[data-i]', main).forEach(c => c.style.setProperty('--d', c.dataset.i));
    $('[data-badges]', main).innerHTML = MODULES.map(m => { const got = S.get().badges[m.id]; return `<li class="${got ? 'got' : ''}"><span class="pf-bic" aria-hidden="true">${ic(got ? 'award' : 'lock', 'sm')}</span><span>${esc(mT(m, 'badge') || mT(m, 'title'))}</span><span class="vh">${got ? L('conseguida', 'earned') : L('pendiente', 'locked')}</span></li>`; }).join('');
  };
  paint();
  let tm = 0;
  const saved = () => { const s = $('[data-saved]', main); s.innerHTML = `${ic('ok', 'sm')}${L('Guardado en este navegador', 'Saved in this browser')}`; s.classList.remove('on'); void s.offsetWidth; s.classList.add('on'); clearTimeout(tm); tm = setTimeout(() => s.classList.remove('on'), 2200); };
  const set = (k, v) => { S.setProfile(k, v); saved(); };
  $('#pf-name', main).addEventListener('input', e => set('name', e.target.value));
  $('#pf-other', main).addEventListener('input', e => set('roleOther', e.target.value));
  $('#pf-role', main).addEventListener('change', e => { set('role', e.target.value); const o = $('[data-other]', main); o.hidden = e.target.value !== 'other'; if (!o.hidden) $('#pf-other', main).focus(); });
  $$('[name="pf-kind"]', main).forEach(r => r.addEventListener('change', () => set('kind', r.value)));
  $$('[name="pf-color"]', main).forEach(r => r.addEventListener('change', () => set('color', r.value)));
  $('[data-clear]', main).onclick = async () => {
    const ok = await confirmDialog({ title: L('¿Vaciar tu perfil?', 'Clear your profile?'), text: L('Se borran tu nombre, tu tipo de perfil, tu rol y tu color. Tu progreso (retos, insignias y XP) se mantiene.', 'This clears your name, profile type, role and colour. Your progress (challenges, badges and XP) stays.'), ok: L('Sí, vaciar', 'Yes, clear') });
    if (ok) { S.clearProfile(); route(); toast(L('Perfil vaciado.', 'Profile cleared.'), 'info', 'user'); }
  };
  const off = S.on(paint);
  return () => { off(); clearTimeout(tm); };
}

/* ---------- Acerca de ---------- */
const AUTHOR = {
  name: 'Yoandy Ramírez Delgado', email: 'yoandyramirezdelgado@gmail.com',
  links: [['linkedin', 'LinkedIn', 'https://www.linkedin.com/in/yoandyrd92/'], ['github', 'GitHub', 'https://github.com/heindall92'], ['globe', ['Portafolio', 'Portfolio'], 'https://yoandyramirez.com'], ['hackthebox', 'HackTheBox', 'https://profile.hackthebox.com/profile/019c5812-b4ca-7315-b12f-14db6d2b42fa']],
};
const GH = 'https://github.com/heindall92/', PAGES = 'https://heindall92.github.io/';
/* [id, nombre, icono, app (o null), repositorio, [descripción ES, EN]] */
const ECO_LABS = [
  ['megalodon', 'Megalodon', 'fish', null, `${GH}megalodon`, ['Laboratorio de Wireshark sin conexión: capturas de un pentest, filtros validados al instante y retos guiados del saludo TCP a los ataques web.', 'Offline Wireshark lab: captures of a pentest, filters validated as you type and guided challenges from the TCP handshake to web attacks.']],
  ['bluejr', 'Blue-Jr', 'siren', `${PAGES}Blue-Jr/`, `${GH}Blue-Jr`, ['Una semana de turnos de nivel 1 en un SOC: 40 alertas que clasificar, investigar y escalar.', 'A week of level-1 SOC shifts: 40 alerts to triage, investigate and escalate.']],
  ['whitefox', 'WhiteFox', 'radar', null, `${GH}WhiteFox`, ['Laboratorio de Nessus Essentials Plus: una red de 9 equipos, manual, recorridos guiados y 32 ejercicios.', 'Nessus Essentials Plus lab: a 9-host network, a manual, guided tours and 32 exercises.']],
  ['atlas', 'Atlas GRC', 'map', `${PAGES}atlas-grc/`, `${GH}atlas-grc`, ['GRC desde cero con ISO/IEC 27001:2022 en una empresa ficticia, Albatrel, con simulacro de examen.', 'GRC from scratch with ISO/IEC 27001:2022 at a fictitious company, Albatrel, with a mock exam.']],
  ['astrolabio', 'Astrolabio', 'compass', `${PAGES}astrolabio/`, `${GH}astrolabio`, ['Prepara entrevistas con el método STAR: cuenta tu historia y gana la entrevista.', 'Interview prep with the STAR method: tell your story and win the interview.']],
];
const ECO_TOOLS = [
  ['argos', 'ARGOS', 'target', `${PAGES}argos-grc/`, `${GH}argos-grc`, ['Laboratorio de práctica GRC: rutas, máquinas con flags y simulacros cronometrados de ENS, ISO/IEC 27001 y continuidad, con rangos y logros.', 'GRC practice lab: ENS, ISO/IEC 27001 and continuity paths, machines with flags and timed mock exams, with ranks and badges.']],
  ['rosetta', 'Rosetta', 'layers', `${PAGES}rosetta_multinorma/`, `${GH}rosetta_multinorma`, ['Mapa multinorma: ENS, ISO/IEC 27001, NIS2, ISO/IEC 42001, DORA, RGPD y más en controles unificados, con perfil regulatorio y equivalencias ENS ↔ ISO.', 'Multi-framework map: ENS, ISO/IEC 27001, NIS2, ISO/IEC 42001, DORA, the GDPR and more in unified controls, with a regulatory profile and ENS ↔ ISO equivalences.']],
  ['ens', 'ENS Compliance Studio', 'shield', `${PAGES}grc_ens_compliance_studio/app/dist/ens-compliance-studio.html`, `${GH}grc_ens_compliance_studio`, ['Categorización del sistema, análisis de riesgos MAGERIT, Declaración de Aplicabilidad y preauditoría del ENS.', 'System categorisation, MAGERIT risk analysis, Statement of Applicability and ENS pre-audit.']],
  ['kairos', 'KAIROS', 'activity', `${PAGES}kairos/`, `${GH}kairos`, ['Continuidad de negocio: BIA, BCP y DRP con la ruta crítica de recuperación de cada función.', 'Business continuity: BIA, BCP and DRP with the critical recovery path of every function.']],
  ['ctem', 'CTEM-Nexus', 'network', `${PAGES}ctem-nexus/`, `${GH}ctem-nexus`, ['Gestión de la exposición: prioriza hallazgos de escáneres y pentest, dibuja las rutas de ataque hacia los activos críticos y envía la evidencia por control.', 'Exposure management: prioritises scanner and pentest findings, draws the attack paths to critical assets and sends evidence per control.']],
  ['adaudit', 'ENS AD Auditor', 'lock', `${PAGES}ens_ad-auditor/`, `${GH}ens_ad-auditor`, ['Audita el Directorio Activo frente a las medidas de control de acceso del ENS (op.acc).', 'Audits Active Directory against the ENS access control measures (op.acc).']],
  ['mcpshield', 'MCP-Shield', 'shield', `${PAGES}mcp-shield/`, `${GH}mcp-shield`, ['Audita las configuraciones MCP de los asistentes de IA: cadena de suministro, secretos, ficheros y tool poisoning.', 'Audits the MCP configurations of AI assistants: supply chain, secrets, files and tool poisoning.']],
  ['norvik', 'Norvik', 'scale', null, `${GH}Norvik_Gobernanza`, ['Gobernanza de escritorio: roles, responsables y políticas que unen al resto de herramientas.', 'Desktop governance: roles, owners and policies that tie the other tools together.']],
];
const EXT = 'target="_blank" rel="noopener noreferrer"';
function ecoCard([id, name, icon, app, repo, desc]) {
  const here = id === 'megalodon';
  return `<li class="eco${here ? ' here' : ''}"${here ? ' aria-current="page"' : ''}><div class="eco-h"><span class="eco-ic" aria-hidden="true">${ic(icon)}</span><h3>${esc(name)}</h3>${here ? `<span class="eco-here">${ic('pin', 'sm')}${L('Estás aquí', 'You are here')}</span>` : ''}</div><p>${esc(tx(desc))}</p><div class="eco-a">${app ? `<a class="btn sm" href="${app}" ${EXT}>${ic('external', 'sm')}${L('Abrir', 'Open')}<span class="vh"> ${esc(name)} ${L('(se abre en otra pestaña)', '(opens in a new tab)')}</span></a>` : ''}<a class="btn ghost sm" href="${repo}" ${EXT}>${brandIc('github', 'sm')}${L('Código', 'Code')}<span class="vh"> ${L('de', 'of')} ${esc(name)} ${L('(se abre en otra pestaña)', '(opens in a new tab)')}</span></a></div></li>`;
}
function viewAbout(main) {
  main.innerHTML = `<div class="wrap page about">
    <div class="sec-h"><p class="eyebrow">${L('Acerca de', 'About')}</p><h1>Megalodon <span class="ver mono">v${APP_VERSION}</span></h1><p class="muted">${L('Laboratorio de Wireshark sin conexión para preparar el eWPT y el trabajo de analista: capturas sintéticas de un pentest, filtros que se validan mientras escribes y retos guiados.', 'Offline Wireshark lab to prepare for the eWPT and analyst work: synthetic captures of a pentest, filters validated as you type and guided challenges.')}</p></div>
    <section class="card author" aria-labelledby="au-t">
      <span class="av av-azul xl" aria-hidden="true">YR</span>
      <div class="au-txt"><p class="eyebrow">${L('Autor', 'Author')}</p><h2 id="au-t">${AUTHOR.name}</h2><p class="muted">${L('Diseño y desarrollo de Megalodon', 'Design and development of Megalodon')} · Junior Pentester · eJPTv2 · AI Governance (ISO 42001) · SysAdmin</p>
        <ul class="au-links">${AUTHOR.links.map(([i, n, h]) => `<li><a class="btn sm" href="${h}" ${EXT}>${brandIc(i, 'sm')}${esc(Array.isArray(n) ? tx(n) : n)}<span class="vh"> ${L('(se abre en otra pestaña)', '(opens in a new tab)')}</span></a></li>`).join('')}<li><a class="btn sm" href="mailto:${AUTHOR.email}">${ic('mail', 'sm')}${L('Correo', 'Email')}</a></li></ul></div>
    </section>
    <section aria-labelledby="eco-l"><div class="sec-h sub"><h2 id="eco-l">${L('Laboratorios', 'Labs')}</h2><p class="muted">${L('Práctica guiada, en el navegador y sin instalar nada.', 'Guided practice, in the browser, with nothing to install.')}</p></div><ul class="eco-grid">${ECO_LABS.map(ecoCard).join('')}</ul></section>
    <section aria-labelledby="eco-t"><div class="sec-h sub"><h2 id="eco-t">${L('Herramientas GRC y de seguridad', 'GRC and security tools')}</h2><p class="muted">${L('El resto del ecosistema: gobierno, riesgo, cumplimiento y exposición.', 'The rest of the ecosystem: governance, risk, compliance and exposure.')}</p></div><ul class="eco-grid">${ECO_TOOLS.map(ecoCard).join('')}</ul></section>
    <div class="about-2">
      <section class="card" aria-labelledby="ab-priv"><h2 id="ab-priv">${ic('lock', 'sm')}${L('Privacidad', 'Privacy')}</h2><p>${L('Sin servidor, sin analítica y sin cookies. Tu progreso, tu perfil y tus ajustes viven solo en el almacenamiento de este navegador; las capturas que abras se procesan en tu equipo y no salen de él.', 'No server, no analytics and no cookies. Your progress, profile and settings live only in this browser’s storage; the captures you open are processed on your device and never leave it.')}</p></section>
      <section class="card" aria-labelledby="ab-lic"><h2 id="ab-lic">${ic('book', 'sm')}${L('Licencias', 'Licences')}</h2><ul class="ab-list"><li>${L('Código de Megalodon: MIT.', 'Megalodon code: MIT.')}</li><li>${L('Iconos', 'Icons')} <a href="https://lucide.dev" ${EXT}>Lucide</a> (ISC).</li><li>${L('Interruptor de tema y buscador adaptados de', 'Theme switch and search adapted from')} <a href="https://github.com/shadcn-labs/Pin-UI" ${EXT}>Pin UI</a> (MIT, © Rachit Thakur).</li><li>${L('Pruebas de accesibilidad con', 'Accessibility tests with')} axe-core (MPL-2.0).</li></ul></section>
      <section class="card" aria-labelledby="ab-dis"><h2 id="ab-dis">${ic('info', 'sm')}${L('Aviso', 'Notice')}</h2><p>${L('Megalodon es un proyecto independiente y educativo. No está afiliado, patrocinado ni respaldado por la Wireshark Foundation ni por INE Security (eLearnSecurity). Wireshark es una marca registrada de la Wireshark Foundation; eWPT y eJPT son marcas de INE. Las capturas son sintéticas, con direcciones y dominios de prueba.', 'Megalodon is an independent, educational project. It is not affiliated with, sponsored or endorsed by the Wireshark Foundation or INE Security (eLearnSecurity). Wireshark is a registered trademark of the Wireshark Foundation; eWPT and eJPT are INE marks. Captures are synthetic, with test addresses and domains.')}</p></section>
    </div></div>${siteFooter()}`;
}
