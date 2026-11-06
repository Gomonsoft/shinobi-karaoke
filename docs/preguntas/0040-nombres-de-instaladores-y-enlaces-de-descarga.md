# 0040 — Nombres de los instaladores y forma de los enlaces de descarga
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida
- Bloquea: no en la Fase 7 (sin versión publicada, el README no lleva enlaces de descarga); sí para el estado "con versión" de `ux/09`, antes de la primera versión pública

## Contexto
`ux/09` usa `{ARCHIVO_*}`, `{ENLACE_*}` y `{PAQUETE_DEB}`. El usuario ve estos nombres en su carpeta de descargas y en los pasos de la guía. GitHub documenta `/releases/latest/download/<nombre>`, que solo sirve si el nombre del archivo no cambia entre versiones.

## Pregunta
1. ¿Cómo se llaman los cuatro instaladores (Windows, Mac arm64, AppImage x64, `.deb` x64)? Para un usuario no técnico, conviene que incluyan "Shinobi-Karaoke" y que el de Mac permita reconocer que es para chip Apple.
2. ¿Llevan la versión en el nombre? Si la llevan, ¿el README enlaza a la página `/releases/latest` en lugar de a cada archivo, o se actualiza en cada versión? El criterio 17 de `ux/01` y `ux/09` piden un enlace por SO.
3. ¿Cómo se llama el paquete `.deb` para `sudo apt remove {PAQUETE_DEB}`?
4. ¿Se publican sumas SHA-256 junto a los instaladores? La guía no las menciona; si existen, valoro añadir una línea opcional.
5. ¿El repositorio será público antes de la primera versión? El 2026-11-06, `https://github.com/Gomonsoft/shinobi-karaoke` responde 404 sin autenticar. Todos los enlaces públicos dependen de ello. Si es decisión del usuario, indícalo.

## Opción provisional tomada (si no bloquea)
Sin nombres cerrados: `ux/09` mantiene los valores por sustituir. Propuesta sin versión en el nombre, para poder enlazar cada archivo con `/releases/latest/download/`: `Shinobi-Karaoke-Windows-x64.exe`, `Shinobi-Karaoke-Mac-chip-Apple.dmg`, `Shinobi-Karaoke-Linux-x64.AppImage`, `shinobi-karaoke-linux-x64.deb`; paquete `shinobi-karaoke`.

## Respuesta
(arquitecto, 2026-11-06; ADR 0012 §2)

1. **Nombres**: se adopta tu propuesta.
   | Instalador | Archivo |
   |---|---|
   | Windows | `Shinobi-Karaoke-Windows-x64.exe` |
   | Mac arm64 | `Shinobi-Karaoke-Mac-chip-Apple.dmg` |
   | AppImage x64 | `Shinobi-Karaoke-Linux-x64.AppImage` |
   | `.deb` x64 | `shinobi-karaoke-linux-x64.deb` |
2. **Sin versión en el nombre**, para enlazar cada archivo con `/releases/latest/download/<nombre>`, sin tocar el README en cada versión. La versión aparece en la *Release*, en Acerca de y en el nombre del artefacto del workflow (`shinobi-karaoke-<versión>-<sha corto>-<so>`).
3. **Paquete `.deb`**: `shinobi-karaoke`. Se desinstala con `sudo apt remove shinobi-karaoke`.
4. **SHA-256**: sí. El workflow genera `SHA256SUMS-<so>.txt` ya en esta fase (0136), y cada *Release* llevará un `SHA256SUMS.txt` unido (0142). Puedes añadir la línea opcional; no es imprescindible para un usuario no técnico.
5. **Repositorio**: comprobado con `gh repo view Gomonsoft/shinobi-karaoke --json visibility`: `PRIVATE`. Con un repositorio privado, las *Releases* no se pueden descargar sin sesión, y la GPL exige ofrecer el código a quien reciba el binario. Es decisión del usuario: [`0035`](0035-repositorio-publico-y-primera-publicacion.md). Bloquea el estado E1 (tarea 0142), no el E0.

**Impacto en `ux/09`** (a tu cargo):
- §4: `{ARCHIVO_*}` y `{PAQUETE_DEB}` con estos valores.
- `{ENLACE_*}` se mantienen como están y solo existen en E1.
- §4, "Página de versiones e incidencias": la causa del 404 ya está confirmada, y sigue en vigor comprobar los enlaces sin sesión antes de publicar.
