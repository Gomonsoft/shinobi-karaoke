# 0128 — Worker sin *bytecode* en producción
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: —
- ADRs: 0012 §4, §5; 0009 §5
- ¿Red?: no.

## Objetivo
Que Python no escriba `__pycache__` dentro de `resources/worker`. En macOS rompería el sello de la firma *ad hoc*; en Windows ensuciaría la instalación.

## Archivos
- `app/src/main/trabajos/worker.ts` (`resolverLanzador`, modo `produccion`) y su test;
- `app/src/main/runtime/gestor.ts` (`diagnosticadorReal`) y su test.

## Contratos
- Ambos lanzadores añaden `PYTHONDONTWRITEBYTECODE: '1'` a su entorno.
- Modo `desarrollo` sin cambios: sigue con `uv run`.
- No se añade ninguna variable `SHINOBI_*`.

## Criterios de aceptación
- [ ] Test: `resolverLanzador({ modo: 'produccion', … }).env.PYTHONDONTWRITEBYTECODE === '1'`, en Windows y POSIX.
- [ ] Test: el lanzador de `diagnosticadorReal` lleva la misma variable.
- [ ] Revisar con `grep` cualquier otro proceso que ejecute el intérprete del venv con `PYTHONPATH` a `resources/worker` y anotar el resultado.
- [ ] El modo desarrollo no cambia.

## Verificación
```bash
cd app
npx vitest run worker lanzador gestor
npm run lint && npm run typecheck
```

## Notas de implementación
El lanzador del worker en producción incorpora `PYTHONDONTWRITEBYTECODE=1`; el lanzador de desarrollo sigue usando `uv run` y no define esa variable. El diagnosticador real añade la misma variable junto a `PYTHONPATH`. Las pruebas cubren Windows, POSIX, desarrollo y la configuración del diagnóstico. La búsqueda de procesos que usen el intérprete del venv con `PYTHONPATH` encontró solo esos dos puntos de ejecución (`resolverLanzador` y `diagnosticadorReal`).

Archivos: `app/src/main/trabajos/worker.ts`, `worker.test.ts`, `app/src/main/lanzadorApp.test.ts`, `app/src/main/runtime/gestor.ts` y `gestor.diagnosticador.test.ts`.

Verificación: lint, typecheck, format:check, `npm test` (129 archivos aprobados, 1 omitido; 1804 pruebas aprobadas, 12 omitidas) y `npm run build` pasan. Playwright: 90 aprobadas, 2 omitidas y 1 fallo en la prueba existente de pantalla completa real (`e2e/reproductor.spec.ts:225`), que no observó `isFullScreen() === true` en 5 segundos; la prueba pasó durante la verificación anterior de 0127. Se repitió aislada y volvió a fallar, por lo que queda pendiente resolver/verificar esa limitación del entorno antes de cerrar esta tarea con la batería completa en verde.

Revalidación en macOS 26.5.1: lint y tipos pasan. Las suites del worker, lanzador y gestor pasan (97 pruebas, una omitida) con acceso al árbol de procesos. El E2E aislado de pantalla completa real pasa con acceso a la sesión gráfica (4,6 s). Los resultados de la batería general se registran aparte.
