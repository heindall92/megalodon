# Cambios

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.

## [1.2.0] - 2026-11-25

### Añadido
- **Información experta** (botón Experto, atajo `E`) con los mensajes y severidades de Wireshark, comprobados en `packet-tcp.c`: SYN y SYN+ACK son Chat, FIN es Chat, RST es Warning, retransmisión sospechada es Note y las líneas HTTP son Chat.
- **Exportar objetos HTTP**: tabla con paquete, host, tipo, tamaño y nombre seguro; vista previa como texto y descarga.
- **Credenciales** (HTTP Basic, FTP y NTLMSSP) con salto al campo exacto del árbol.
- **Buscar paquete** (`Ctrl F`) por filtro, cadena o hex, e **Ir al paquete** (`Ctrl G`).
- **Formato de tiempo** en la barra de estado: desde el inicio, desde el anterior capturado, desde el anterior mostrado y hora UTC.
- **Seguir flujo UDP** (el atajo `F` elige TCP o UDP según el paquete) y pestaña **Endpoints** en Estadísticas.
- Cinco retos nuevos que obligan a usar las herramientas (módulos 6 y 8) y una lección sobre información experta y objetos HTTP.
- Pruebas: motor de análisis, respuestas derivadas recalculadas desde los paquetes, recorrido e2e del curso completo y axe en los diálogos nuevos.

### Corregido
- Un diálogo abierto menos de 150 ms después de cerrar otro se cerraba solo (temporizador de cierre pendiente).
- La celebración de la insignia aparecía sobre el módulo siguiente si cambiabas de módulo justo al terminar.
- El laboratorio libre se salía de la pantalla en móvil por el nombre largo de la captura.

## [1.1.0] - 2026-11-25

### Añadido
- Megalodón 3D en tiempo real (WebGL2 puro) en el hero de inicio, sobre el póster original, que queda de respaldo sin WebGL2.
- Boca modelada según la anatomía documentada: arcos en herradura con encía, protrusión del palatocuadrado, 26 + 24 dientes aserrados con fila de reemplazo, y mordisco con la secuencia de Tricas (1985). Fuentes en `docs/megalodon-3d.md`.
- Vista «Plano técnico» con escaneo y cotas anatómicas, y botón de pausa accesible. Con «reducir movimiento», fotograma fijo y animación solo bajo demanda.
- Pruebas del motor (`node --test`): capturas deterministas, ida y vuelta pcap/pcapng, los 53 retos con solución comprobable, los 57 «Pruébalo», sintaxis de filtros de Wireshark 4.x y checksums.
- Pruebas e2e en Chromium y axe-core (WCAG 2.2 AA) en 6 vistas, 2 anchos y 2 temas.
- CI, publicación en GitHub Pages, `run_tests.sh`, `--check` de compilación, capturas reales y documentación.

### Cambiado
- El icono de pausa de Lucide se añade al juego de iconos.

## [1.0.0] - 2026-11-25

### Añadido
- Laboratorio tal como se entregó, separado en `src/` con una compilación que lo reproduce byte a byte.
