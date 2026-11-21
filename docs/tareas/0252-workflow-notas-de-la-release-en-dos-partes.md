# 0252 — Workflow: notas de la *Release* en dos partes
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0251 (mismo archivo y salidas `sha` y `compilacion`)
- ADRs: [0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md), «Revisión para 0.2.0 — fase 10», §3
- Spec UX: [09 §3](../ux/09-descarga-e-instalacion.md#3-notas-de-cada-release) (parte 1, plantilla de notas a mano, parte 2 «Qué cambió», «Todos los cambios» y «Compilación»; cabecera con «tu navegador y tu sistema pueden avisarte»), §4 (valores) y criterios de la fase 10
- Versión: 0.2.0-alpha.2 · Fase 10, punto 4

## Objetivo
Las notas de cada versión llevan arriba lo escrito a mano y, debajo y siempre, «Qué cambió» generado por GitHub con los encabezados en español, «Todos los cambios» con el enlace de comparación y «Compilación» con el commit y la ejecución de CI.

## Contrato
- **`.github/publicacion/cabecera.md`**: el texto nuevo de §3 («tu navegador y tu sistema pueden avisarte»).
- **Textos de la parte 2**: un archivo nuevo en `.github/publicacion/` (por ejemplo `que-cambio.json`) con los textos exactos de §3: el separador y el encabezado, `## New Contributors` → `### Personas que colaboran por primera vez`, las líneas que se quitan (`## What's Changed` y `**Full Changelog**…`), la plantilla de «Todos los cambios», la de «Compilación», la frase «sin PR» y la de la primera versión publicada.
- **`app/scripts/preparar-publicacion.mjs`**:
  - Compone la parte 1 en `notas.md` como hoy.
  - Escribe `pie.md` («Compilación», con `{NUMERO}`, `{HASH}`, `{SHA_COMPLETO}` y `{RUN_URL}` resueltos: `$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID`) y copia al artefacto el archivo de textos.
  - Argumentos nuevos: `--compilacion`, `--sha` y `--ejecucion`.
  - Con `--ensayo` ausente (etiqueta), **falla** si no existen las notas a mano o si alguna línea empieza por `> Borrador`. En el ensayo solo lo avisa en el resumen.
  - Falla si queda algún `{…}` en lo que compone.
  - `datos.json` deja de llevar `generar_notas`.
  - El resumen del ensayo muestra la parte 1 y el pie, con la nota «“Qué cambió” se genera al publicar».
- **Trabajo `publicar`** (sin `checkout` ni `npm`, como ya está):
  1. `anterior` = la *Release* publicada más reciente que no sea la actual: `gh release list --exclude-drafts --json tagName,publishedAt`.
  2. Si existe: `gh api -X POST repos/$GH_REPO/releases/generate-notes -f tag_name="$ETIQUETA" -f previous_tag_name="$anterior" --jq .body`. Aplica con `jq` las sustituciones **literales** del archivo de textos y añade «Todos los cambios» (`compare/$anterior...$ETIQUETA`). Si la lista queda vacía, usa la frase «sin PR».
  3. Si no existe, usa la frase de la primera versión publicada en lugar de la lista y de «Todos los cambios».
  4. Une `notas.md`, la parte 2 y `pie.md`, falla si queda `{` + mayúsculas + `}` sin sustituir y crea la *Release* con `--notes-file` del resultado, **sin** `--generate-notes`.
  5. El resto del trabajo (borrador → recursos → publicar o `PUBLICACION_BORRADOR`) no cambia.
- `workflow-empaquetado.test.ts`: `publicar` no usa `--generate-notes`, sigue sin `checkout` y llama a `generate-notes` con `previous_tag_name`.

## Criterios de aceptación
- [ ] Tests de `preparar-publicacion`: el pie con valores falsos, el fallo con `> Borrador` o sin notas en modo etiqueta, el aviso en el ensayo y el fallo con un marcador sin resolver.
- [ ] La composición de `publicar` sale de un *script* de shell/`jq` corto que se puede probar en local con un `body` de ejemplo de GitHub. Las tres variantes (con anterior, sin PR y primera publicación) están documentadas en las notas de la tarea con su salida.
- [ ] Ensayo (0255): el resumen muestra la parte 1 y «Compilación» con el enlace a la ejecución.

## Pruebas de feedback
- Unitarias: `app/scripts/preparar-publicacion.test.ts` y `workflow-empaquetado.test.ts`.
- E2E: ninguna.
- Críticos: no.
- Manual (guía de la versión): con la *Release* `v0.2.0-alpha.2` publicada, sus notas tienen las dos partes, la frase de la primera publicación y el enlace a la ejecución.

## Notas de implementación
