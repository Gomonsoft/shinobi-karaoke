# 0192 — Workflow: disparador por etiqueta y trabajo `comprobar-version`
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0191
- ADRs: 0020 (§1, §2), 0013
- Spec UX: no aplica
- ¿Red?: no para las pruebas de feedback; el ensayo en GitHub es la tarea 0195

## Objetivo
Que `.github/workflows/empaquetado.yml` se dispare también con etiquetas `v*` y que, antes de construir, compruebe que la etiqueta coincide con la versión de app y worker. `construir` y `probar-instalador` no cambian.

## Criterios de aceptación
- [ ] `name: Empaquetado y publicación`. Disparadores: `workflow_dispatch` (sin entradas) y `push: tags: ['v*']`. Sigue sin `push` de ramas ni `pull_request`.
- [ ] `permissions: contents: read` en la raíz y `concurrency: { group: empaquetado-${{ github.ref }}, cancel-in-progress: false }`.
- [ ] Trabajo `comprobar-version` en `ubuntu-24.04`, `timeout-minutes: 10`, con `checkout` (`fetch-depth: 0`, para poder mirar `main`) y `setup-node` por los SHA del ADR 0013. Sin `npm ci`: `version.mjs` no tiene dependencias.
  - Siempre: `node app/scripts/version.mjs comprobar --salida-github`.
  - Con etiqueta (`github.ref_type == 'tag'`): además `--etiqueta "$GITHUB_REF_NAME"` y `git merge-base --is-ancestor "$GITHUB_SHA" origin/main`; si el commit no está en `main`, falla con un mensaje que lo diga.
  - Con `workflow_dispatch`: si ya existe la etiqueta `v<versión>` en el remoto, lo anota en `GITHUB_STEP_SUMMARY` como aviso (no falla).
  - Salidas del trabajo: `version`, `etiqueta`, `previa`, `version_pep440`.
- [ ] `construir` pasa a tener `needs: comprobar-version`. Ningún otro cambio en `construir` ni en `probar-instalador`.
- [ ] El valor de `GITHUB_REF_NAME` y cualquier dato del evento llegan a los `run` por `env`, nunca interpolados con `${{ }}` dentro del script.
- [ ] `app/scripts/workflow-empaquetado.test.ts` actualizado: los disparadores son exactamente `workflow_dispatch` y `push.tags: ['v*']`; ningún trabajo salvo `publicar` (tarea 0194) tiene permisos distintos de `contents: read`; `construir` necesita `comprobar-version`; siguen las aserciones de acciones fijadas por SHA, matrices y artefactos.

## Pruebas de feedback
- Unitarias: `npx vitest run scripts/workflow-empaquetado.test.ts`. Si `actionlint` (MIT) está disponible en el equipo, `actionlint .github/workflows/empaquetado.yml` sin errores; si no, se anota.
- E2E: ninguna.
- Críticos: no.
- Manual: ninguno (el ensayo en GitHub es la 0195).

## Notas de implementación
(las rellena el programador al terminar)
