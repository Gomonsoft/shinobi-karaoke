# 0089 — Prueba opcional con LRCLIB real (`SHINOBI_TESTS_RED=1`)
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0082 (cliente y búsqueda), 0088 (ayudantes E2E)
- ADRs: 0005 (Revisión 2026-11-05)
- Spec UX: docs/ux/05-letra.md (criterios 1–3)
- Cuándo: al final de la fase. Puede ir en paralelo con 0088 si solo se hace la parte de contrato (Vitest).

## Objetivo
Detectar a tiempo cambios en la API real de LRCLIB (campos, formato Lyricsfile, límites) sin que la CI normal dependa de la red ni haga peticiones al servicio.

## Criterios de aceptación
- [x] **Test de contrato** en Vitest, `app/src/main/letras/lrclib.red.test.ts`, omitido salvo con `SHINOBI_TESTS_RED=1`. Con el `fetch` de Node, el `User-Agent` del proyecto y peticiones en serie:
  - `get` del ejemplo de la documentación de LRCLIB ("I Want to Live", Borislav Slavov, 233 s) → registro válido para el esquema Zod de 0081, con `lyricsfile` legible por 0080 y un resultado que cumple `letraSchema`;
  - `search` con `q` del mismo título → ≥ 1 resultado válido;
  - `get` de una canción inventada → `null` (404).
  Como mucho 5 peticiones por ejecución. Las letras recibidas **no se guardan** en el repositorio ni en artefactos.
- [x] **E2E con red** `app/e2e/letras-red.spec.ts`, omitido salvo con `SHINOBI_TESTS_RED=1`: crear la canción con el WAV de prueba y los metadatos del ejemplo (forzando la duración de 233 s en la semilla de E2E) → la búsqueda automática muestra al menos un candidato sincronizado → "Usar esta letra" → `cancion.json` con `origen: lrclib`.
- [x] No se ejecuta en push ni en PR. Se documenta en `app/README.md` junto a la prueba de YouTube (0053) y se añade como paso opcional al workflow manual `runtime-real` (0040), sin que su fallo haga fallar el workflow (`continue-on-error`).

## Notas de implementación
- **Vitest**: `app/src/main/letras/lrclib.red.test.ts` (`describe.runIf(SHINOBI_TESTS_RED === '1')`). Usa el cliente real (`crearClienteLrclib`, `fetch` de Node, URL real, User-Agent del proyecto, 250 ms entre peticiones y en serie). 3 peticiones: `get` del ejemplo (registro válido, `duration` ±2 s, `convertirLyricsfile` si hay `lyricsfile`, `convertirRegistro` → `letraSchema`), `search` con `q` (≥ 1 resultado) y `get` de una canción inventada (`null`). No imprime ni guarda letras.
- **E2E**: `app/e2e/letras-red.spec.ts` (omitido sin la variable). Parte de la semilla («Borrador sin letra»), reescribe su `cancion.json` con los metadatos del ejemplo y `duracion_ms: 233000` (en lugar de crearla por importación; la 0088 aún no tenía infraestructura en `e2e/fixtures/`, así que no reutiliza nada), abre «Continuar», espera la búsqueda automática, «Usar esta letra» y comprueba `origen: lrclib`, `lrclib_id` y alguna línea con tiempo. Sin `SHINOBI_LRCLIB_URL` (red real).
- **CI**: pasos opcionales con `continue-on-error` en `.github/workflows/runtime-real.yml` (Vitest en los tres SO y E2E, con xvfb en Linux). README actualizado.
- **Cómo probarlo**: `SHINOBI_TESTS_RED=1 npx vitest run lrclib.red`; `npm run build && SHINOBI_TESTS_RED=1 npx playwright test letras-red`. Ejecutadas con red: ambas pasan (la E2E dos veces).
- **Deuda**: si la 0088 añade ayudantes comunes para abrir la vista Letra, la E2E podría migrar a ellos.
