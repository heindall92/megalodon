# Cambios

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.

## [1.4.1] - 2026-11-25

### Corregido
- **Prueba e2e de los efectos de tema intermitente en la CI.** La capa de la gota se crea antes de `startViewTransition` para que entre en la captura, pero el tema se aplica en la actualización de la transición, uno o dos fotogramas después. La prueba leía el tema en ese hueco y a veces fallaba. Ahora espera el cambio (1,5 s como máximo) y comprueba además que el efecto sigue en marcha cuando el tema ya ha cambiado. La aplicación no cambia.

## [1.4.0] - 2026-11-25

### Añadido
- **Perfil configurable** (`#/perfil`), con guardado al instante y solo en el navegador:
  - nombre (hasta 60 caracteres; sus iniciales forman el avatar);
  - tipo de perfil: estudiante, profesional, docente, autodidacta o cambio de carrera;
  - rol: pentester, analista SOC, sistemas, redes, desarrollo, auditoría, GRC, estudiante u otro escrito por ti (hasta 40 caracteres);
  - color del avatar, entre seis.

  La tarjeta muestra XP, nivel, retos e insignias, un mapa de actividad de 15 semanas con la racha y las ocho insignias. «Vaciar perfil» no toca el progreso.
- **Tarjeta de cuenta en la barra lateral**, encima del nivel: avatar, nombre o «Configura tu perfil», y rol y tipo. También aparece en la hoja «Más» del móvil.
- **«Acerca de»** (`#/acerca`), como en Rosetta:
  - autor con LinkedIn, GitHub, portafolio, HackTheBox y correo;
  - laboratorios: Megalodon («Estás aquí»), Blue-Jr, WhiteFox, Atlas GRC y Astrolabio;
  - herramientas GRC y de seguridad: ARGOS, Rosetta, ENS Compliance Studio, KAIROS, CTEM-Nexus, ENS AD Auditor, MCP-Shield y Norvik;
  - privacidad, licencias, avisos de independencia y la versión, que se toma del `package.json` al compilar.
- **Efecto al cambiar de tema**, adaptado del Theme Switch de Pin UI (MIT) y elegible en Ajustes:
  - **Gota:** cae sobre el botón con física real, se aplasta, el botón cede con un muelle, salen dos ondas y el tema nuevo se abre en círculo sobre la página con View Transitions.
  - **Lluvia:** charcos que crecen y se unen hasta cubrir la pantalla, con cobertura garantizada.
  - **Fundido:** el de antes.

  Con movimiento reducido o sin View Transitions, el cambio es directo. Una pulsación a mitad lo interrumpe y aplica al momento el último tema pedido.
- **Buscador nuevo**, adaptado de la Search Card de Pin UI (MIT):
  - la píldora crece hasta ser una tarjeta;
  - **recientes** (los seis últimos, guardados), cada uno con su baldosa de color, papelera en la fila activa y `Supr` para quitarlo;
  - «Borrar todo» y «Restaurar»;
  - una lámina que se desliza bajo la fila activa;
  - **fichas de categoría** (módulos, lecciones, retos, glosario, filtros, campos, páginas y acciones), con un contador que rueda;
  - `Esc` primero borra y luego cierra.
- **Hoja «Más» del móvil** con perfil y «Acerca de». Sale desde abajo y se cierra arrastrándola: sigue al dedo 1:1 y se cierra por distancia (40 %) o por velocidad.
- **Skills de diseño en el repositorio** (`.claude/skills/`): impeccable, ui-ux-pro-max y las de Emil Kowalski (emil-design-eng, apple-design, gestures, animation-performance, improve-animations, review-animations, find-animation-opportunities, break-ui, pick-ui-library y prototype). Su origen queda fijado en `skills-lock.json`.
- Doce iconos de Lucide más: papelera, restaurar, llama, calendario, paleta, brújula, mapa, balanza, monitor, código, sirena y chincheta.

### Cambiado
- **Portada sin barra superior**, como en Blue-Jr: el botón del lateral y el buscador, arriba a la izquierda; idioma, tema, ayuda, atajos y ajustes, arriba a la derecha. Todo flota sobre la ilustración con fondos de cristal oscuro legibles en los dos temas. El resto de páginas conserva la barra.
- El buscador pasa a la izquierda de la barra, junto al botón del lateral, en todas las páginas.
- El interruptor de tema pasa de pomo deslizante a botón cuadrado con luna y sol que giran. Sigue siendo un `role="switch"` con `aria-checked`.

### Corregido
- Pulsar el tema a mitad del efecto dejaba una capa con el mismo `view-transition-name` y el navegador rechazaba la transición. Ahora la capa anterior se retira al momento. Lo detectó la e2e del tema con `Mayús T`.

### Pruebas
- e2e: de 20 a **25**. Nuevas o ampliadas:
  - buscador (recientes, papelera, `Supr`, «Borrar todo» y «Restaurar», categorías y foco);
  - efectos de tema e interrupción;
  - portada sin barra;
  - perfil, con XSS en el nombre y su peor caso;
  - «Acerca de»;
  - cierre de la hoja arrastrando.
- axe-core: 0 infracciones también en perfil, «Acerca de» y el buscador abierto, a 1280 y 390 px, en claro y oscuro.

## [1.3.2] - 2026-11-25

### Cambiado
- **Logo nuevo:** el megalodón de plano técnico con su aro de radar, sobre una baldosa azul marino, en la barra lateral, en la cabecera del móvil y como **icono de la pestaña** (PNG de 64 px; el tiburón se amplía para que se distinga a 16 px). Sustituye al pez de Lucide. El fondo blanco del original se retiró sin dejar halo.
- **Más aire en la portada:** 32 px entre la ilustración y las tarjetas de progreso (antes 8), 80 px antes de cada sección (antes 56) y 48 px en las subsecciones; en el móvil, 24 y 56 px.
- **README:** la captura principal es ahora la portada en modo claro; la oscura pasa a la galería.

### Pruebas
- La e2e de inicio comprueba el logo (imagen incrustada de 128 px a 38 px, sin texto alternativo porque el enlace ya se llama «Megalodon · Inicio»), el favicon PNG y que ya no queda el pez.

## [1.3.1] - 2026-11-25

### Cambiado
- **La portada vuelve a la ilustración** del megalodón como plano técnico azul, ahora en mejor calidad: AVIF y WebP de 1983 × 793 px, de unos 70 KB cada uno, codificados desde el original (PSNR de 40 y 38 dB).
- **Encuadre con la barra lateral:** la ilustración se alinea al 62 % (antes al 78 %) para que el tiburón empiece a la derecha del título y del texto de entrada a 1280, 1440 y 1920 px, también con la barra plegada y con fuentes del sistema anchas como DejaVu Sans.

### Eliminado
- **El megalodón 3D en WebGL2** (`src/app/48-shark.js`), con su vista «Plano técnico», el botón de pausa y sus notas (`docs/megalodon-3d.md`). No convencía visualmente. La página pesa unos 100 KB menos (de 655 a 550 KB) y ya no necesita WebGL.

### Pruebas
- Sustituyen a las del 3D:
  - la ilustración carga con su tamaño y su texto alternativo, y no queda ningún lienzo;
  - el tiburón no queda bajo el texto en seis encuadres, dos de ellos con una fuente ancha (así lo detectó la CI de GitHub, que no tiene Inter);
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
