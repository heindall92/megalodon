# Seguridad

## Cómo informar
Escribe a Yoandy Ramírez Delgado por GitHub (issue privado de seguridad o mensaje directo). No publiques la vulnerabilidad hasta que haya solución.

## Alcance
- `megalodon.html` y `dist/index.html`: CSP estricta por hashes, sin peticiones de red, progreso solo en `localStorage`.
- Lector de capturas `.pcap`/`.pcapng` (`readCapture`): trata el fichero como entrada hostil.

## Lo que la herramienta no hace
- No captura tráfico real ni toca la red: las capturas son sintéticas.
- No envía datos a ningún sitio ni usa analítica.
