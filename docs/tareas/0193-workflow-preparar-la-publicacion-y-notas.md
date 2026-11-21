# 0193 — Workflow: preparar la publicación (sumas, notas y ensayo)
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0192
- ADRs: 0020 (§1, §4, §5), 0013
- Spec UX: docs/ux/09-descarga-e-instalacion.md (§3 Notas de cada *Release*, §4 nombres); textos pendientes de `preguntas/0141`
- ¿Red?: no para las pruebas de feedback

## Objetivo
El trabajo `preparar-publicacion` reúne lo que irá en la *Release* (4 instaladores, `SHA256SUMS.txt` y `notas.md`) sin publicar nada. Con `workflow_dispatch` es el ensayo completo de la publicación.

## Criterios de aceptación
- [ ] Trabajo `preparar-publicacion` en `ubuntu-24.04`, `timeout-minutes: 15`, `needs: [comprobar-version, construir, probar-instalador]`, `permissions: contents: read`. Se ejecuta en los dos disparadores.
- [ ] La entrada informativa de `probar-instalador` (`ubuntu-26.04`) no impide que se ejecute; cualquier otra entrada fallida sí. Se comprueba en el ensayo (0195) qué devuelve `needs.probar-instalador.result` con la entrada informativa fallida; si no basta, se lee el resultado de cada trabajo con `gh api repos/{repo}/actions/runs/{run_id}/jobs` (sigue siendo `contents: read`; añadir `actions: read` solo a este trabajo si la API lo exige) y se anota.
- [ ] Descarga con `download-artifact` (SHA del ADR 0013), `pattern: shinobi-karaoke-<versión>-<sha corto>-*` y `merge-multiple: true`.
- [ ] Falla si no están exactamente los 4 instaladores de `preguntas/0040` (`Shinobi-Karaoke-Windows-x64.exe`, `Shinobi-Karaoke-Mac-chip-Apple.dmg`, `Shinobi-Karaoke-Linux-x64.AppImage`, `shinobi-karaoke-linux-x64.deb`) o si algún `SHA256SUMS-<so>.txt` no pasa `sha256sum -c`.
- [ ] Genera `SHA256SUMS.txt`: formato `sha256sum` (`<hash>  <nombre>`), una línea por instalador, ordenado por nombre.
- [ ] Plantillas nuevas: `.github/publicacion/cabecera.md` (texto de `ux/09` §3) y `.github/publicacion/aviso-previa.md`. **Mientras `preguntas/0141` siga abierta**, la cabecera usa el texto de §3 con la línea de Linux según la opción provisional A de `preguntas/0045` (sin el marcador ⟦R0045⟧) y el aviso de previa usa el texto provisional de 0141. Al responderse, se sustituyen.
- [ ] Compone `notas.md` = cabecera + (si `previa`) aviso + notas de la versión. Las notas son `docs/versiones/<X.Y.Z>/notas/<versión>.md` si existe; si no, `datos.json` marca `generar_notas: true` y el resumen avisa de que se usarán las notas generadas por GitHub. Falla si el resultado contiene `⟦` o `{ENLACE_`.
- [ ] La lógica de componer y comprobar vive en `app/scripts/preparar-publicacion.mjs` (Node, sin dependencias nuevas), no en un *heredoc* del YAML, para poder probarla con Vitest. El trabajo hace `checkout` y `setup-node` y la ejecuta sin `npm ci`.
- [ ] Sube el artefacto `publicacion-<versión>` (instaladores, `SHA256SUMS.txt`, `notas.md`, `datos.json` con `version`, `etiqueta`, `previa`, `generar_notas`), `retention-days: 14`, `if-no-files-found: error`.
- [ ] `GITHUB_STEP_SUMMARY`: tipo (previa o estable), etiqueta prevista, tabla de recursos con tamaño en MB y SHA-256, y el texto completo de `notas.md`. Con `workflow_dispatch`, una línea final: "Ensayo: no se ha publicado nada."
- [ ] `workflow-empaquetado.test.ts`: `preparar-publicacion` existe, depende de los tres trabajos, solo tiene permisos de lectura y sube `publicacion-…`.

## Pruebas de feedback
- Unitarias (`app/scripts/preparar-publicacion.test.ts`): con una carpeta temporal y 4 archivos pequeños y sus `SHA256SUMS-<so>.txt`, genera el `SHA256SUMS.txt` esperado; falla con un instalador de más, uno de menos o una suma alterada; compone las notas con y sin aviso de previa y con y sin archivo de notas; falla con un marcador ⟦…⟧. Y `npx vitest run scripts/workflow-empaquetado.test.ts`.
- E2E: ninguna.
- Críticos: no.
- Manual: ninguno (el ensayo en GitHub es la 0195).

## Notas de implementación
(las rellena el programador al terminar)
