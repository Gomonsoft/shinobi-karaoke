# 0039 — E2E del primer arranque con runtime falso (sin red)
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0035, 0037
- ADRs: 0007, 0009 §8
- Spec UX: docs/ux/01-primer-arranque.md (criterios de aceptación)

## Objetivo
Probar de punta a punta, con la app compilada y sin Internet, los recorridos del primer arranque usando el escenario falso del ADR 0009 §8.

## Criterios de aceptación
- [x] `SHINOBI_RUNTIME_FALSO=<escenario.json>` (ignorado si `app.isPackaged`, igual que `SHINOBI_PAPELERA_PRUEBAS`) sustituye `EjecutorUv`, `Diagnosticador`, `DescargadorModelos`, `EspacioLibre` y `DetectorGpu` por dobles que siguen el escenario: plataforma/perfil previsto, espacio libre, bytes y duración por fase, fallo con un código en una fase (una vez o siempre), rebaja de perfil, artefactos que crea en disco (venv y marcador simulados, archivo de modelo). Esquema del escenario validado con Zod y documentado en `app/e2e/README` o en el propio archivo de dobles.
- [x] Escenarios E2E (Playwright `_electron`, directorio de datos temporal de 0023), cada uno < 15 s:
  1. CPU, todo bien: B1 con cifras del manifiesto → B2 con 3 fases y mensaje Rápido → B3 → "Empezar" → Biblioteca vacía; `config.json` queda `completa`.
  2. Sin espacio: B1 muestra `pa.req.espacio.insuficiente`; "Comprobar de nuevo" con más espacio habilita "Preparar".
  3. `SIN_CONEXION` en componentes → B4 con su texto → "Reintentar" → termina sin repetir motor (el doble cuenta llamadas).
  4. Pausar y salir durante el modelo → la app se cierra → al relanzar, B5 "Continuamos donde lo dejamos" → termina.
  5. Rebaja `cuda` → `cpu` por memoria: aparece `pa.modo.rebajado.memoria`, el total baja y el porcentaje no retrocede.
  6. Runtime dañado (`completa` en config, sin modelo) → B5 "Hay que reparar el motor de audio" → "Reparar".
  7. `config.json` borrado con runtime y modelo presentes → no se muestra B1: la app llega a la Biblioteca sin "descargar" (el doble no recibe llamadas de descarga).
  8. Durante el primer arranque, Ctrl/Cmd+, y Ctrl/Cmd+N no navegan.
- [x] Los E2E existentes que escriben `instalacion.estado = 'completa'` siguen pasando (no necesitan el escenario).
- [x] Se ejecutan en el job de E2E actual de la CI (Linux) y localmente en macOS; sin descargas ni red.

## Notas de implementación
- **Qué se hizo**:
  - `app/src/main/runtime/falso/`: `escenario.ts` (esquema Zod estricto y documentado, `cargarEscenarioFalso`, que devuelve `null` si `app.isPackaged`, y `manifiestoParaEscenario` para modelos "diminutos"), `dobles.ts` (`crearDoblesRuntime`: `EjecutorUv`, `Diagnosticador`, `DescargadorModelos`, `EspacioLibre`, `DetectorGpu` y entorno de plataforma) y `falso.test.ts` (10 casos). `composicion.ts` recibe `falso` y sustituye los cinco puertos; `index.ts` lo carga de `SHINOBI_RUNTIME_FALSO` y, con el escenario activo, deja la actualización de yt-dlp en no-op.
  - Los dobles crean en disco lo que crearía el real: intérprete del venv (el marcador lo escribe el gestor real), archivos dispersos que crecen a ritmo constante en `runtime/python` y `runtime/cache-uv` (el gestor mide esos directorios), y el archivo del modelo (disperso con el tamaño del manifiesto, o de 2 KiB con SHA-256 válido con `modelos: "diminutos"`, necesario para la verificación completa de 0035). Cada llamada se anota en `llamadas.jsonl` junto al escenario.
  - `e2e/primer-arranque.spec.ts`: los 8 escenarios de la tarea (cada uno entre 0,7 y 4,3 s en macOS). Arrancan con `SHINOBI_LANZADOR=produccion` (si no, `comprobarAlArrancar` no corre, ver 0037) más `SHINOBI_RUNTIME_FALSO`. El espacio libre del escenario 2 se cambia en caliente con `espacioLibre: { desdeArchivo }`. En el 5 se miden los eventos de `runtime.alProgreso` (total y porcentaje).
- **Encargo adicional (deuda de 0037)**: canal IPC `app.salir` (`app:salir`; `canales.ts`, contrato en `ipc.ts`, preload `window.shinobi.app.salir()`, handler validado por remitente como el resto, y `salir: () => app.quit()` en `index.ts`). "Salir" de B4, B6 y B6b y el cierre tras "Pausar y salir" lo usan en vez de `window.close()`, de modo que en macOS la app también sale del Dock. Si hay una instalación en curso, `app.quit()` pasa por `before-quit` y la solicitud de cierre existente. Pruebas: `handlers.test.ts` (llega a `salir`, rechaza argumentos y remitentes ajenos), `PrimerArranque.test.tsx` (clic en Salir de B6, B6b y B4 y en "Pausar y salir" llama a `app.salir`, no a `window.close`) y el E2E 4 (`app.waitForEvent('close')` tras "Pausar y salir": la app entera termina).
- **Cómo probarlo**: `cd app && npm run build && npx playwright test e2e/primer-arranque.spec.ts` y `npx vitest run src/main/runtime/falso src/main/ipc src/renderer/src/vistas/primer-arranque`.
- **Decisiones**: el esquema de `SHINOBI_MANIFIESTO` (ADR 0009 §8) no se ha necesitado: `modelos: "diminutos"` cubre la verificación completa. Con "Comprobar de nuevo" el botón único de B1 cambia a "Preparar" (no hay un botón deshabilitado), y el E2E 2 lo comprueba así.
- **Deuda**: los E2E con `linux-x64` simulado asumen que el intérprete del venv es `venv/bin/python`; en Windows habría que usar `Scripts/python.exe` (el doble sí lo respeta, el helper del E2E que crea el venv de los escenarios 6 y 7 no). No hay prueba de la rebaja en Windows/macOS.
