# 0194 — Workflow: publicar en GitHub Releases

- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0193
- ADRs: 0020 (§1, §4, §5)
- Spec UX: docs/ux/09-descarga-e-instalacion.md (§3)
- ¿Red?: no para las pruebas de feedback. **No se crea ninguna etiqueta `v*` ni ninguna _Release_ en esta tarea**: la primera publicación real la hace el usuario (`docs/workflow.md`, `preguntas/0140`).

## Objetivo

El trabajo `publicar`, el único con permiso de escritura, crea la _Release_ de la etiqueta con lo que dejó `preparar-publicacion`, sin ejecutar código del repositorio.

## Criterios de aceptación

- [ ] Trabajo `publicar` en `ubuntu-24.04`, `timeout-minutes: 15`, `needs: [comprobar-version, preparar-publicacion]`, `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')`, `permissions: contents: write` (y nada más).
- [ ] **Sin `checkout`, sin `setup-node` y sin `npm ci`.** Solo `download-artifact` (SHA del ADR 0013) de `publicacion-<versión>` y pasos `run` con `gh`. `env`: `GH_TOKEN: ${{ github.token }}`, `GH_REPO: ${{ github.repository }}`, `ETIQUETA`, `VERSION`, `PREVIA` desde las salidas de `comprobar-version`, y `BORRADOR: ${{ vars.PUBLICACION_BORRADOR }}`. Ninguna expresión `${{ }}` dentro del texto de los `run`.
- [ ] Si `gh release view "$ETIQUETA"` encuentra una _Release_, falla sin tocarla.
- [ ] `gh release create "$ETIQUETA" --verify-tag --draft --title "Shinobi Karaoke $VERSION" --notes-file notas.md`, más `--prerelease --latest=false` si `PREVIA` es `true` o `--latest` si no, más `--generate-notes` si `datos.json` lo pide; y los 5 recursos (4 instaladores y `SHA256SUMS.txt`) en la misma orden.
- [ ] Comprueba con `gh release view "$ETIQUETA" --json assets` que están los 5 recursos con el tamaño local.
- [ ] Si `BORRADOR` no es `true`, publica con `gh release edit "$ETIQUETA" --draft=false`. Si es `true`, la deja en borrador y lo dice en el resumen.
- [ ] `GITHUB_STEP_SUMMARY`: enlace a la _Release_, estado (publicada o borrador), tipo (previa o estable).
- [ ] `workflow-empaquetado.test.ts`: `publicar` es el único trabajo con `contents: write`; su `if` exige evento `push` y `refs/tags/v`; no contiene ningún paso `actions/checkout` ni `setup-node`; la única acción que usa es `download-artifact` por SHA; ninguna acción de terceros en todo el archivo.

## Pruebas de feedback

- Unitarias: `npx vitest run scripts/workflow-empaquetado.test.ts`; `actionlint` si está disponible (si no, se anota).
- E2E: ninguna.
- Críticos: no.
- Manual: la publicación real se verifica con la primera etiqueta `v0.2.0-alpha.N` (caso que añade `qa` a la guía de la versión, ver tarea 0195).

## Notas de implementación

(las rellena el programador al terminar)
