# Cambios

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.

## [1.3.1] - 2026-11-25

### Cambiado
- **La portada vuelve a la ilustración** del megalodón como plano técnico azul, ahora en mejor calidad: AVIF y WebP de 1983 × 793 px, de unos 70 KB cada uno, codificados desde el original (PSNR de 40 y 38 dB).
- **Encuadre con la barra lateral:** el tiburón queda a la derecha del título a 1280, 1440 y 1920 px, también con la barra plegada.

### Eliminado
- **El megalodón 3D en WebGL2** (`src/app/48-shark.js`), con su vista «Plano técnico», el botón de pausa y sus notas (`docs/megalodon-3d.md`). No convencía visualmente. La página pesa unos 100 KB menos (de 655 a 550 KB) y ya no necesita WebGL.

### Pruebas
- Sustituyen a las del 3D:
  - la ilustración carga con su tamaño y su texto alternativo, y no queda ningún lienzo;
  - el tiburón no queda bajo el título en cuatro encuadres;
  - con «reducir movimiento», la ilustración queda quieta.

## [1.3.0] - 2026-11-25

### Añadido
- **Armazón nuevo** al estilo de BlueJr y RiskManager-Jr: barra lateral a la izquierda con los ocho módulos y su progreso (punto de estado y retos x/y), nivel y XP abajo, e indicador que se desliza hasta la sección activa.
- **Barra lateral plegable**: botón en la barra superior o tecla `[`. Plegada queda un carril de iconos que se despliega por encima al pasar el ratón o al llegar con el teclado. El estado se recuerda.
- **Móvil**: la barra lateral desaparece y aparece una barra de pestañas abajo (Inicio, Módulos, Laboratorio, Chuleta y Más). «Más» abre una hoja con Glosario, Ajustes, Ayuda y Atajos.
- **Interruptores** en la barra superior: idioma ES|EN segmentado y tema claro|oscuro (`role="switch"`, el pomo se estira al pulsar). Muelles sin rebote (`cubic-bezier(0.32, 0.72, 0, 1)`) y todo desactivado con «reducir movimiento».
- **Interfaz completa en inglés**: vistas, retos (mensajes de corrección), diálogos de Wireshark, **árbol de detalle con las etiquetas que muestra Wireshark** (`Frame 1: 77 bytes on wire`, `Sequence Number`, `Request Method`…), exportar, buscar, ayuda, atajos, ajustes, búsqueda `Ctrl K`, niveles, títulos, subtítulos e insignias de los ocho módulos, diagrama de escalera y etiquetas del megalodón 3D. Los errores del motor de filtros se traducen en la interfaz sin tocar el motor.
- Pruebas: `tests/i18n.test.mjs` (paridad de claves ES/EN, módulos con versión inglesa, traducción de cada error del filtro y de cada etiqueta del árbol en los 578 paquetes) y cinco e2e nuevas (lateral plegable, idioma, tema, móvil con la hoja «Más» y axe del lateral plegado, el inglés y la hoja).

### Cambiado
- La barra superior pasa a ser una píldora flotante con buscador. El menú hamburguesa desaparece: en móvil lo sustituye la barra de pestañas.

### Sin traducir
- Las lecciones, los enunciados y las pistas de los retos, el glosario y las descripciones de los campos siguen en español. La interfaz lo avisa en inglés.

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
