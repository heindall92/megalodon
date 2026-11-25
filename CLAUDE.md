# Instrucciones para asistentes de código

## Autoría
- El autor de todo el trabajo es **Yoandy Ramírez Delgado** (`yoandyramirezdelgado@gmail.com`). Antes del primer commit en cualquier clon: `git config user.name "Yoandy Ramírez Delgado"` y `git config user.email "yoandyramirezdelgado@gmail.com"`; comprueba con `git log -1 --format='%an <%ae>'`.
- Nada de líneas `Co-Authored-By` ni de atribuciones a herramientas en commits, PR, código o documentación.

## Flujo de trabajo
- **Una PR por versión.** Rama `version/X.Y.Z` desde `main`, con `./run_tests.sh` en verde (compilación al día, motor, e2e y axe con 0 infracciones). La fusiona Yoandy.
- `dist/index.html` y `megalodon.html` se versionan: ejecuta `npm run build` antes de cada commit (la CI lo comprueba con `--check`).
- Commits en español, en imperativo y explicando el porqué. Cifras del README reales.

## Código
- Todo el JS comparte un único ámbito (se concatena en `scripts/build.mjs`): nombres globales únicos. El megalodón vive dentro de `SHARK` para no chocar.
- Motor en `src/engine/` sin DOM. Cada reto nuevo necesita solución comprobable en `tests/engine.test.mjs`.
- Solo iconos Lucide; sin CDN, fuentes externas ni analítica; CSP por hashes.
- Datos del usuario o de la captura: siempre escapados (`esc()`), nunca `innerHTML` sin escapar.

## Diseño
- Para cualquier trabajo de interfaz usa siempre las skills de `.claude/skills/`. Para auditar y pulir: `impeccable` y `ui-ux-pro-max`. Para el movimiento y la sensación: `emil-design-eng`, `apple-design`, `gestures`, `animation-performance`, `improve-animations`, `review-animations` y `find-animation-opportunities`. Para someter la interfaz al peor caso: `break-ui`. Para prototipar: `prototype` (solo con `/prototype`).
- La vista previa de `ui-ux-pro-max` carga Google Fonts: no copies eso a la aplicación.
- Lo adaptado de terceros (Pin UI, MIT) se cita en el comentario del fichero, en «Acerca de» y en el README.

## Siguiente paso
- Lee `ROADMAP.md` antes de proponer trabajo nuevo.
