# 0194 — Workflow: publicar en GitHub Releases
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: 0193
- ADRs: 0020 (§1, §4, §5)
- Spec UX: docs/ux/09-descarga-e-instalacion.md (§3)
- ¿Red?: no para las pruebas de feedback. **No se crea ninguna etiqueta `v*` ni ninguna *Release* en esta tarea**: la primera publicación real la hace el usuario (`docs/workflow.md`, `preguntas/0140`).

## Objetivo
El trabajo `publicar`, el único con permiso de escritura, crea la *Release* de la etiqueta con lo que dejó `preparar-publicacion`, sin ejecutar código del repositorio.

## Criterios de aceptación
- [x] Trabajo `publicar` en `ubuntu-24.04`, `timeout-minutes: 15`, `needs: [comprobar-version, preparar-publicacion]`, `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')`, `permissions: contents: write` (y nada más).
- [x] **Sin `checkout`, sin `setup-node` y sin `npm ci`.** Solo `download-artifact` (SHA del ADR 0013) de `publicacion-<versión>` y pasos `run` con `gh`. `env`: `GH_TOKEN: ${{ github.token }}`, `GH_REPO: ${{ github.repository }}`, `ETIQUETA`, `VERSION`, `PREVIA` desde las salidas de `comprobar-version`, y `BORRADOR: ${{ vars.PUBLICACION_BORRADOR }}`. Ninguna expresión `${{ }}` dentro del texto de los `run`.
- [x] Si `gh release view "$ETIQUETA"` encuentra una *Release*, falla sin tocarla.
- [x] `gh release create "$ETIQUETA" --verify-tag --draft --title "Shinobi Karaoke $VERSION" --notes-file notas.md`, más `--prerelease --latest=false` si `PREVIA` es `true` o `--latest` si no, más `--generate-notes` si `datos.json` lo pide; y los 5 recursos (4 instaladores y `SHA256SUMS.txt`) en la misma orden.
- [x] Comprueba con `gh release view "$ETIQUETA" --json assets` que están los 5 recursos con el tamaño local.
- [x] Si `BORRADOR` no es `true`, publica con `gh release edit "$ETIQUETA" --draft=false`. Si es `true`, la deja en borrador y lo dice en el resumen.
- [x] `GITHUB_STEP_SUMMARY`: enlace a la *Release*, estado (publicada o borrador), tipo (previa o estable).
- [x] `workflow-empaquetado.test.ts`: `publicar` es el único trabajo con `contents: write`; su `if` exige evento `push` y `refs/tags/v`; no contiene ningún paso `actions/checkout` ni `setup-node`; la única acción que usa es `download-artifact` por SHA; ninguna acción de terceros en todo el archivo.

## Pruebas de feedback
- Unitarias: `npx vitest run scripts/workflow-empaquetado.test.ts`; `actionlint` si está disponible (si no, se anota).
- E2E: ninguna.
- Críticos: no.
- Manual: la publicación real se verifica con la primera etiqueta `v0.2.0-alpha.N` (caso que añade `qa` a la guía de la versión, ver tarea 0195).

## Notas de implementación
- Trabajo `publicar` en `.github/workflows/empaquetado.yml`: `contents: write`, `if` de etiqueta, sin `checkout`/`setup-node`/`npm`; solo `download-artifact` por SHA y pasos `gh` con todos los datos por `env`. Falla si ya existe la Release; crea en borrador (`--verify-tag`, `--prerelease --latest=false` o `--latest`, `--generate-notes` si `datos.json` lo pide, usa `jq` de los runners), comprueba los 5 recursos y tamaños con `diff`, publica salvo `PUBLICACION_BORRADOR == true`, y escribe el resumen.
- Tests en `workflow-empaquetado.test.ts`. No se ha ejecutado nada contra GitHub ni se ha creado ninguna etiqueta o Release; `actionlint` no disponible.
- Pendiente de verificar en la primera publicación real: el `gh release view` trata cualquier error como «existe» solo si devuelve 0 (otro fallo de red deja pasar a `create`, que fallaría si existiera la etiqueta con Release).
