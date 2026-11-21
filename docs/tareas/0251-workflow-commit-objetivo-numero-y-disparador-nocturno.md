# 0251 — Workflow: commit objetivo, número de compilación, canal y disparador nocturno
- Estado: Hecha (implementación; el ensayo en GitHub lo hace la sesión principal)
- Paso del pipeline: 0 (distribución)
- Depende de: 0248 (`compilacion.mjs` y las variables de build)
- ADRs: [0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md), «Revisión para 0.2.0 — fase 10», §1 y §2; [0013](../adr/0013-workflow-de-empaquetado-y-prueba-de-la-app-empaquetada.md), «Revisión para 0.2.0 — fase 10»
- Spec UX: —
- Versión: 0.2.0-alpha.2 · Fase 10, puntos 2 y 3

## Objetivo
Preparar `.github/workflows/empaquetado.yml` para construir un commit que no tiene por qué ser `GITHUB_SHA` (la cabeza de `develop` en la nocturna), calcular N una sola vez, pasarlo al build y decidir si hay compilación de desarrollo. Los trabajos nuevos de publicación son 0252 y 0253.

## Contrato
1. `on:` añade `schedule: - cron: '23 4 * * *'`. **Sin** `inputs` en `workflow_dispatch` (ADR §«Comprobaciones»).
2. **`comprobar-version`** (sigue el primero y sigue con `contents: read`):
   1. Sin `checkout`, resuelve `sha`: en `schedule`, `gh api repos/$GITHUB_REPOSITORY/branches/develop --jq .commit.sha` (`GH_TOKEN: github.token`); en lo demás, `GITHUB_SHA`.
   2. Estado del canal, solo en `schedule` y en `workflow_dispatch` contra `refs/heads/develop`. Variables del paso: `REPO_COMPILACIONES: ${{ vars.COMPILACIONES_REPO }}` y `HAY_TOKEN: ${{ secrets.COMPILACIONES_TOKEN != '' }}`. **El valor del secreto no entra en este trabajo.** Configurado = repositorio no vacío, `HAY_TOKEN == 'true'` y `gh api repos/$REPO_COMPILACIONES` → 200. Ya compilado = `gh api repos/$REPO_COMPILACIONES/releases/tags/build-$SHA` → 200; un 404 es «no existe»; cualquier otro código hace fallar el paso.
   3. Calcula `desarrollo` (`publicar` | `ensayo` | `omitir`), `construir` y `canal_app` según la tabla del ADR §1, y escribe el motivo en `GITHUB_STEP_SUMMARY` cuando no se construye.
   4. Si `construir`: `checkout` de `ref: sha` con `fetch-depth: 0`, los pasos de versión de siempre y `node app/scripts/compilacion.mjs contar --salida-github`.
   5. Salidas nuevas: `sha`, `numero`, `compilacion` (`<versión>-<N>`), `canal_app`, `desarrollo` y `construir`.
3. **`construir`** y **`probar-instalador`**: `if: needs.comprobar-version.outputs.construir == 'true'` y `checkout` con `ref: <sha>`. Los nombres de artefacto usan `sha` en lugar de `GITHUB_SHA`: en `construir` el paso de Node que hoy lee `process.env.GITHUB_SHA` y en `probar-instalador` el paso «Identificar artefacto». En `construir`, el paso `npm run build` recibe `SHINOBI_COMPILACION_CANAL`, `SHINOBI_COMPILACION_NUMERO` y `SHINOBI_COMPILACION_COMMIT` de las salidas, y el resumen de cada SO añade el número de compilación.
4. **`preparar-publicacion`**: `if:` añade `github.event_name != 'schedule'`, `checkout` de `sha` y patrón de artefactos con `sha`.
5. `workflow-empaquetado.test.ts` cubre los disparadores, que el secreto solo aparece como `secrets.COMPILACIONES_TOKEN != ''` en `comprobar-version`, `fetch-depth: 0` ahí, `ref:` de `sha` en todos los `checkout`, ningún `GITHUB_SHA` en los nombres de artefacto y las condiciones de `construir`. Si `actionlint` está disponible, ejecutarlo.

## Criterios de aceptación
- [ ] Tests de estructura en verde. La lógica de decisión (evento, rama, configurado, existe → `desarrollo`/`construir`) es una función pura en un script (por ejemplo, `compilacion.mjs decidir`) con tests de la tabla completa, y el YAML solo la llama.
- [ ] Ensayo en GitHub (con todo subido a `alpha-2`, lo lanza la sesión principal): `gh workflow run empaquetado.yml --ref alpha-2` construye. El resumen muestra el número de compilación, y el artefacto se nombra con el `sha` de `alpha-2`. Con el canal sin configurar, `desarrollo` = `ensayo`.
- [ ] Ningún trabajo con permiso de escritura hace `checkout`.

## Pruebas de feedback
- Unitarias: `app/scripts/workflow-empaquetado.test.ts` y el test de la función de decisión.
- E2E: ninguna.
- Críticos: no.
- Manual: el ensayo de arriba lo hace la sesión principal (no se puede en local). El `schedule` real solo se comprueba cuando el archivo esté en `main` (guía de la versión).

## Notas de implementación

**Hecho.**
- `compilacion.mjs` gana `decidir` (función pura con la tabla del ADR §1), `consultarCanal` (con `gh(ruta)` inyectable: 200 / 404 / otro código), `resolverDecision` y la orden `decidir --salida-github`, que lee `GITHUB_EVENT_NAME`, `GITHUB_REF`, `SHA`, `REPO_COMPILACIONES` y `HAY_TOKEN`, escribe `desarrollo`, `construir`, `canal_app` y `configurado`, y deja el motivo en `GITHUB_STEP_SUMMARY` cuando no se construye. `contar` no cambia.
- `empaquetado.yml`: `schedule` (`23 4 * * *`), sin `inputs`. `comprobar-version` resuelve `sha` sin checkout (`gh api …/branches/develop` en `schedule`), hace `checkout` de `ref: sha` con `fetch-depth: 0`, decide, y solo si `construir` ejecuta los pasos de versión y `contar`. Salidas nuevas: `sha`, `numero`, `compilacion`, `canal_app`, `desarrollo`, `construir` y `configurado` (añadida: la necesita `preparar-desarrollo` para saber si leer la última compilación del canal). `construir`, `probar-instalador` y `preparar-publicacion` llevan `if` con `construir`, hacen `checkout` de `sha` y nombran los artefactos con `COMMIT_CONSTRUIDO` (salida `sha`), nunca con `GITHUB_SHA`. `npm run build` recibe `SHINOBI_COMPILACION_CANAL/NUMERO/COMMIT`; el resumen de cada SO lleva el número de compilación.
- Archivos: `.github/workflows/empaquetado.yml`, `app/scripts/compilacion.mjs` (+ `.d.mts`, `.test.ts`), `app/scripts/workflow-empaquetado.test.ts`.

**Desviación del contrato (consciente).** El contrato pide `checkout` solo «si `construir`». Pero la decisión es un script del repositorio y hay que tener el código para ejecutarlo, así que `comprobar-version` hace **siempre** un `checkout` de solo lectura de `sha` (sin secretos: el trabajo solo ve `HAY_TOKEN` = `true/false`). Los pasos de versión (`version.mjs comprobar`, ancestro en `main`, `contar`) sí quedan condicionados a `construir`, de modo que una nocturna sin canal o sin cambios no ejecuta nada que pueda fallar.

**Cómo probarlo.** `cd app && npx vitest run scripts/compilacion.test.ts scripts/workflow-empaquetado.test.ts` (tabla completa de `decidir`, `consultarCanal` con `gh` simulado y estructura del YAML). Verificado además: parseo YAML de todo el archivo y `bash -n` de los `run:` de shell.

**Sin verificar en local (ensayo con `workflow_dispatch`, sesión principal).**
1. `gh workflow run empaquetado.yml --ref alpha-2`: el resumen de cada SO muestra «Compilación `<versión>-<N>`»; el artefacto se llama `shinobi-karaoke-<versión>-<sha7 de alpha-2>-<so>`; `comprobar-version` expone `desarrollo = ensayo`.
2. Que `gh api repos/<repo>` sobre un repositorio inexistente imprima `(HTTP 404)` (la rama «no configurado» depende de ese formato de error).
3. `--ref develop` sin canal: verde con `desarrollo = ensayo`.
4. El `schedule` real solo cuando el archivo esté en `main`.
5. `actionlint` no estaba instalado y no se ejecutó un binario descargado: expresiones y `needs` revisados a mano.
