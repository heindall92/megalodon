# Megalodon · Laboratorio de Wireshark

Aprende a leer la red como un pentester sin instalar nada: capturas sintéticas de un ataque real en miniatura, filtros de visualización que se validan mientras escribes y retos guiados desde el saludo TCP hasta la inyección SQL, Kerberos y la caza en el SOC.

**Demo:** https://heindall92.github.io/megalodon/ · o descarga [`megalodon.html`](megalodon.html) y ábrelo en el navegador. Funciona sin conexión, sin cuenta y sin servidor.

![Inicio con el megalodón 3D](docs/capturas/inicio-oscuro.webp)

## Qué trae

| | |
|---|---|
| **8 módulos** | Saludo TCP, HTTP, cookies y credenciales, DNS, TLS, ataques web, Directorio Activo (Kerberos, SMB2, NTLM) y caza en el SOC (ARP spoofing, beacon de C2, exfiltración por DNS) |
| **31 lecciones · 53 retos** | Escribir filtros, seleccionar paquetes, responder y tests. Cada reto tiene pistas y se comprueba contra la captura al instante |
| **8 capturas, 578 paquetes** | Construidas byte a byte (Ethernet, ARP, IPv4, ICMP, UDP, TCP, DNS, DHCP, HTTP, TLS, SMB2, NTLMSSP, Kerberos v5) con semilla fija: siempre idénticas |
| **Espacio tipo Wireshark** | Lista virtualizada, árbol de detalle con rangos de bytes, volcado hexadecimal, reglas de color, Seguir flujo TCP, estadísticas y diagrama de escalera |
| **Filtros de visualización** | 136 campos con la semántica de Wireshark 4.x (`==` sobre cualquier valor, `in {80, 443}`, rangos, `contains`, `matches`, funciones), errores en español con posición y «¿Querías decir…?» |
| **Exportar** | Cada captura en `.pcapng` para repetir el reto en tu Wireshark de verdad; también lee `.pcap` y `.pcapng` |
| **Chuleta y glosario** | 41 términos y los filtros de uso diario, con búsqueda global `Ctrl K` |

## El megalodón 3D

El hero de inicio es un megalodón en tiempo real hecho con **WebGL2 puro**, sin librerías ni modelos externos: toda la malla (≈ 60 000 vértices) se genera con código.

| Boca abierta | Protrusión de la mandíbula superior |
|---|---|
| ![Boca abierta en herradura](docs/capturas/mordisco.webp) | ![Palatocuadrado protruido](docs/capturas/protrusion.webp) |

- **Boca documentada:** dos arcos en herradura con banda de encía, 13 dientes superiores anchos y 12 inferiores estrechos por lado, el intermedio superior más pequeño, inclinación distal creciente y una fila de reemplazo tumbada detrás.
- **Mordisco real a cámara lenta:** elevación del hocico y descenso de la mandíbula, protrusión del palatocuadrado al cerrar, sacudida lateral y bajada del hocico, con los tiempos de Tricas (1985). El ojo rota hacia atrás mientras muerde.
- **Piel y agua:** contrasombreado irregular, dentículos, branquias, ampollas de Lorenzini y cicatrices; cáusticas, absorción del agua por canal, rayos de luz con la sombra del tiburón, nieve marina y bloom.
- **Plano técnico:** un escaneo de la cabeza a la cola convierte el modelo en plano con cotas anatómicas que siguen al animal mientras nada.

![Vista de plano técnico](docs/capturas/plano-tecnico.webp)

Fuentes y decisiones de modelado en [docs/megalodon-3d.md](docs/megalodon-3d.md). Sin WebGL2 se muestra el póster original; con «reducir movimiento» se ve un fotograma fijo con la boca abierta y un botón para animarlo.

| Claro | Móvil | Módulo 1 |
|---|---|---|
| ![Tema claro](docs/capturas/inicio-claro.webp) | ![Móvil](docs/capturas/movil.webp) | ![Módulo 1](docs/capturas/modulo-1.webp) |

## Privacidad y seguridad

- Un único HTML autocontenido. Sin CDN, sin fuentes externas, sin analítica, sin peticiones de red.
- CSP estricta por hashes: `default-src 'none'`, `script-src` y `style-src` con los `sha256` del código incrustado, `connect-src 'none'`. La compilación falla si el HTML carga algo externo y las e2e bloquean cualquier petición que no sea `file:`, `data:` o `blob:`.
- El progreso se guarda solo en tu navegador (`localStorage`, clave `megalodon.v1`).
- Las capturas son sintéticas: direcciones de laboratorio y dominios de prueba. Ver [SECURITY.md](SECURITY.md).

## Desarrollo

```bash
npm install          # Playwright y axe-core, solo para las pruebas
npm run build        # src/ → dist/index.html y megalodon.html
./run_tests.sh       # compilación al día, motor y e2e con axe
```

| Carpeta | Contenido |
|---|---|
| `src/engine/` | Motor sin DOM: constructores de paquetes, escenarios, disector, filtros y estadísticas |
| `src/content/` | Módulos, lecciones, retos, chuleta y glosario |
| `src/app/` | Interfaz: estado, espacio de trabajo, diálogos, diagrama de escalera, megalodón 3D, vistas y armazón |
| `scripts/build.mjs` | Concatena en un ámbito compartido, incrusta CSS y JS y calcula la CSP |

## Pruebas

- **Motor (8 pruebas, `node --test`):** las 8 capturas se generan y disecan; son deterministas; exportar a pcap/pcapng y releer conserva cada byte; **los 53 retos tienen solución comprobable** contra su captura; los 57 botones «Pruébalo» compilan y muestran paquetes; sintaxis de filtros de Wireshark 4.x y errores; estadísticas y Follow TCP Stream; checksum RFC 1071.
- **E2E (12 pruebas, Chromium real):** CSP; montaje del megalodón; pausa accesible y plano técnico; desmontaje al cambiar de vista; movimiento reducido; respaldo sin WebGL2; reto resuelto que suma XP; búsqueda `Ctrl K`; y **axe-core con 0 infracciones WCAG 2.2 AA** en 6 vistas, a 1280 y 390 px, en oscuro y claro.

## Avisos

Megalodon es un proyecto independiente, sin relación con la Wireshark Foundation ni con INE/eLearnSecurity (eWPT). Wireshark es una marca de la Wireshark Foundation. El contenido es de redacción propia y se apoya en la [documentación pública de Wireshark](https://www.wireshark.org/docs/). Iconos de [Lucide](https://lucide.dev) (ISC).

## Licencia y autor

MIT · Yoandy Ramírez Delgado · Huelva, España
