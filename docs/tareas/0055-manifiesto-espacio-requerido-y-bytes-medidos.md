# 0055 — Manifiesto: `espacio_requerido` de 4 GB en CPU, `bytes_disco` medidos y `bytes_cache` para el progreso
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0030, 0034, 0040 (Hechas)
- ADRs: 0009 (Revisiones 2026-11-05)
- Spec UX: docs/ux/01-primer-arranque.md (B1 y `pa.error.SIN_ESPACIO` leen `espacio_requerido`; sin cambios de texto)
- Cuándo: **antes de la Fase 3** (pequeña e independiente; se puede hacer en paralelo con 0056)

## Objetivo
Llevar al manifiesto lo decidido en `preguntas/0018` (puntos 1 y 3) y corregir el progreso de "Instalando componentes", que compara la caché de uv descomprimida con `bytes_descarga` y por eso se queda en el 99 % durante casi toda la fase.

## Criterios de aceptación
- [ ] `app/resources/runtime-manifest.json`:
  - `espacio_requerido` = `4000000000` en `win32-x64.cpu` y `linux-x64.cpu`; `darwin-arm64.mps` sigue en 4 GB y los perfiles `cuda` en 10 GB.
  - `bytes_disco` (solo el venv): `win32-x64.cpu` = `1165000000`, `linux-x64.cpu` = `1619000000`, `darwin-arm64.mps` = `1205000000`.
  - `medido` **no cambia**: sigue en `false` en Windows y Linux CPU hasta 0058, que mide `bytes_descarga`.
  - `version` no sube (no cambian requisitos ni modelos).
- [ ] Nuevo campo opcional `bytes_cache` (`bytes.nullable().optional()`) en `requisitosPerfilSchema` (`app/src/shared/manifiesto.ts`), documentado en el propio esquema.
  - Valores (run 41967889708): `darwin-arm64.mps` = `1204000000`, `win32-x64.cpu` = `1163000000`, `linux-x64.cpu` = `1625000000`.
  - Los perfiles `cuda` quedan en `null`.
- [ ] `gestor.ts` (`recalcularTotales` / `conMedicion` de la fase `componentes`): el progreso interno de la fase usa `bytes_cache ?? bytes_descarga` como denominador. Lo que se publica a la interfaz como bytes de la fase se convierte proporcionalmente a `bytes_descarga`, que es la cifra que ve el usuario.
  - Test: con `bytes_cache` = 4 × `bytes_descarga`, una caché al 50 % publica ≈ 50 % de la fase, no el 99 %.
- [ ] `espacioRequeridoMaximo` y los textos de B1 y `SIN_ESPACIO` siguen leyendo del manifiesto: comprobar con un test que en `linux-x64` + `cpu` piden 4 GB.
- [ ] `manifiestoReal.test.ts` actualizado (valores nuevos y `bytes_cache` válido).
- [ ] Los escenarios del runtime falso (`main/runtime/falso/`) y los E2E de 0039 siguen pasando; se ajustan las cifras esperadas de espacio si alguna estaba fijada a 3 GB.
- [ ] README "Requisitos del equipo" ya dice 4 GB: solo se comprueba que no contradice al manifiesto.

## Notas de implementación
- Manifiesto (`app/resources/runtime-manifest.json`): `espacio_requerido` 4 GB en `win32-x64.cpu` y `linux-x64.cpu`; `bytes_disco` y `bytes_cache` con los valores de la tarea (`cuda`: `bytes_cache: null`); `medido` y `version` sin cambios. Los `bytes_disco` de darwin pasan de 1280000000 a 1205000000.
- `app/src/shared/manifiesto.ts`: campo opcional `bytes_cache` documentado en `requisitosPerfilSchema`.
- `app/src/main/runtime/gestor.ts`: `conMedicion` acepta un `denominador` opcional; en `componentes` es `bytes_cache ?? bytes_descarga` y los bytes medidos se convierten proporcionalmente a `bytes_descarga` (tope 99 % como antes).
- Tests: `gestor.test.ts` (bytes_cache = 4 x descarga, caché al 50 % publica ~50 %), `manifiestoReal.test.ts` (valores nuevos, linux-x64 + cpu pide 4 GB), `deteccion.test.ts` (4 GB).
- Los 3 GB que quedan en `App.test.tsx`/`PrimerArranque.test.tsx` son fixtures de IPC independientes del manifiesto; el README ya decía 4 GB.
- Verificación: lint, typecheck, format:check y Playwright (36 OK) pasan. En vitest solo fallan pruebas ligadas a la 0056 (Calidad por defecto en CPU), no a esta tarea.
- Deuda: `medido` de Windows/Linux CPU sigue en `false` hasta 0058.
