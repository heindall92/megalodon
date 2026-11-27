# Hoja de ruta

## 1.1.0 · Megalodón 3D y base de pruebas ✅
- [x] Fuentes en `src/` y compilación reproducible con CSP por hashes
- [x] Megalodón 3D en el hero con boca documentada, pausa, movimiento reducido y respaldo sin WebGL2
- [x] Pruebas del motor, e2e y axe con 0 infracciones; CI y GitHub Pages

## 1.2.0 · Herramientas de analista ✅
- [x] Información experta, Exportar objetos HTTP, Credenciales, Buscar (`Ctrl F`), Ir al paquete (`Ctrl G`), formato de tiempo, Seguir flujo UDP y Endpoints
- [x] Retos que obligan a usarlas, con respuestas recalculadas desde los paquetes en las pruebas
- [x] Recorrido e2e del curso completo y axe en los diálogos nuevos

## 1.3.0 · Armazón nuevo e interfaz en inglés ✅
- [x] Barra lateral plegable (carril que se despliega al pasar el ratón), barra de pestañas en móvil y hoja «Más»
- [x] Interruptores ES|EN y claro|oscuro al estilo de BlueJr y RiskManager-Jr
- [x] Toda la interfaz en inglés, con prueba de paridad de claves y traducción de cada error del filtro
- [x] e2e del lateral, idioma, tema y móvil, y axe en el lateral plegado, el inglés y la hoja «Más»

## 1.3.1 · Portada con la ilustración ✅
- [x] Se retira el megalodón 3D y vuelve la ilustración, en AVIF y WebP de mejor calidad
- [x] El tiburón queda a la derecha del título con la barra lateral, comprobado en e2e

## 1.3.2 · Logo y espaciado ✅
- [x] Logo del megalodón en la barra lateral, el móvil y el favicon
- [x] Ritmo vertical de la portada (32 / 80 / 48 px) y captura principal del README en claro

## 1.4.0 · Perfil, «Acerca de», tema con gota y buscador ✅
- [x] Perfil configurable (nombre, tipo de perfil, rol propio y color) con actividad e insignias, y tarjeta de cuenta en el lateral
- [x] «Acerca de» con el autor y el ecosistema de laboratorios y herramientas, como en Rosetta
- [x] Interruptor de tema y buscador adaptados de Pin UI (MIT), sin React; portada sin barra como en Blue-Jr
- [x] Hoja «Más» que se cierra arrastrando; skills de diseño en `.claude/skills/`
- [x] e2e y axe del perfil (con su peor caso), «Acerca de», buscador y efectos

## 1.4.1 · Prueba estable ✅
- [x] La e2e de los efectos de tema espera al cambio que aplica la View Transition

## 1.4.x · Contenido en inglés
- [ ] Lecciones, enunciados, pistas, glosario y descripciones de campos en inglés (revisados a mano, no traducción automática). El módulo 9 ya lo está y sirve de patrón (`h_en`, `p_en`, `q_en`, `hints_en`, `ok_en`, `opts_en`)

## 1.5.0 · Módulo 9: VoIP ✅
- [x] Disectores de SIP, SDP, RTP, RTCP y eventos DTMF, con el RTP asociado a la llamada por el SDP
- [x] Campos `sip.*`, `sdp.*`, `rtp.*`, `rtcp.*` y `rtpevent.*` con la semántica de Wireshark 4.x
- [x] Captura determinista con REGISTER y Digest, llamada, RTP con pérdida y jitter, DTMF, BYE y un escáner SIP
- [x] Telefonía: llamadas VoIP, flujo SIP y flujos RTP con reproducción (Web Audio API) y WAV
- [x] Diez retos en español e inglés con solución comprobada, y referencia de tshark 4.6.8 en las pruebas

## 1.6.0 · Más capturas
- [ ] Módulo de SMB y movimiento lateral (PsExec visto en el tráfico)
- [ ] Módulo de DHCP spoofing
- [ ] Referencia de tshark (`scripts/tshark-ref.mjs`) también para los módulos 1 a 8
- [ ] Cada reto nuevo con su solución comprobada en `tests/engine.test.mjs`

## Después
- Importar tu propia captura en el laboratorio libre con límites de tamaño y número de paquetes probados
