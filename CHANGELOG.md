# Cambios

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.

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
