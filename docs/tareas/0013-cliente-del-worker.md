# 0013 — Cliente del worker: lanzar, leer JSON Lines y cancelar
- Estado: Hecha
- Paso del pipeline: 0 (base de los pasos 1 y 2)
- Depende de: 0003, 0006
- ADRs: 0001, 0004
- Spec UX: —

## Objetivo
Un módulo de main (`src/main/trabajos/worker.ts`) que ejecute un comando del worker como proceso hijo y traduzca su salida en eventos tipados, con cancelación fiable en los tres SO.

## Criterios de aceptación
- [x] Resolución del intérprete: en desarrollo, `uv run --project <repo>/worker python -m shinobi_worker`; en producción, `<datos>/runtime/venv/{bin/python | Scripts/python.exe} -m shinobi_worker` con el código del worker empaquetado (la ruta exacta se fija con el gestor de runtime en la Fase 2; aquí basta una función configurable y probada).
- [x] `ejecutar(comando, args, { alProgreso, alLog, señal })` devuelve una promesa con el `resultado` o rechaza con `{ codigo, mensaje, reintentable }`. Los argumentos se pasan como un único JSON en `--args` (nunca concatenados en un shell; `shell: false`).
- [x] Parser de JSON Lines robusto: líneas partidas entre *chunks*, varias líneas en un *chunk*, UTF-8 multibyte partido, líneas no JSON (se registran como log y se ignoran), mensajes que no cumplen el esquema de 0006.
- [x] stderr del worker se escribe en `registros/worker-<fecha>.log` (rotado) y las últimas 50 líneas se adjuntan a los errores para "Copiar detalles".
- [x] Salida con código ≠ 0 sin mensaje `error` → `ERROR_INTERNO`. Proceso que no se puede lanzar (intérprete inexistente) → error `RUNTIME_NO_DISPONIBLE` (añadir al catálogo de 0006).
- [x] **Cancelación** con `AbortSignal`: macOS/Linux, proceso lanzado como líder de grupo (`detached: true`) y `SIGTERM` al grupo, `SIGKILL` a los 3 s; Windows, `taskkill /PID <pid> /T /F`. La promesa rechaza con `CANCELADO`. No quedan procesos huérfanos (test con `demo`).
- [x] Tests de integración con el comando `demo` de 0003: progreso recibido, resultado, error simulado, cancelación a mitad (y limpieza del archivo parcial por parte del llamador).

## Notas de implementación
- Qué se hizo: cliente del worker en `app/src/main/trabajos/`. `worker.ts` (`resolverLanzador`, `crearClienteWorker({lanzador, dirRegistros, esperaKillMs})` -> `{ ejecutar }`, y `configurarWorker`/`ejecutar` globales para el resto de la app), `lineas.ts` (`LectorLineas`: StringDecoder UTF-8, `\r\n`, líneas partidas/juntas), `registro.ts` (`RegistroWorker` en `registros/worker-<fecha>.log`, un archivo por día, últimos 7, y si pasa de 5 MB pasa a `.1.log`; `ColaLineas` con las últimas 50 líneas).
- `ejecutar(comando, args, { alProgreso, alLog, señal })`: `shell: false`, `--args` como un único JSON, `stdin` ignorado. Rechaza con `{ codigo, mensaje, reintentable, detalles? }` (`detalles` = últimas 50 líneas de stderr y de stdout no válido). Líneas no JSON o fuera de esquema se envían a `alLog` como `warning` y al registro. Código ≠ 0 o salida sin `resultado` y sin `error` -> `ERROR_INTERNO`; fallo al lanzar -> `RUNTIME_NO_DISPONIBLE`.
- Cancelación: la promesa rechaza con `CANCELADO` cuando el proceso ya ha terminado (así el llamador puede borrar el parcial sin carreras). POSIX: `detached: true`, `SIGTERM` al grupo y `SIGKILL` a los 3 s; Windows: `taskkill /PID /T /F`. Con prioridad sobre un `error` del worker.
- Catálogo de 0006: añadidos `RUNTIME_NO_DISPONIBLE` y `CANCELADO` en `app/src/shared/errores.ts`.
- Localizar uv en desarrollo: opción `uv`, `SHINOBI_UV` o PATH (ver `app/README.md`). Aquí `uv` no estaba instalado: se instaló uv 0.13.7 con pip en un venv temporal fuera del repo y se usó `SHINOBI_UV=<venv>/bin/uv`.
- Probar (desde `app/`): `SHINOBI_UV=/ruta/a/uv npx vitest run --project node src/main/trabajos` (22 tests: unitarios, worker falso en Node con chunks/multibyte/errores/cancelación con nieto que ignora SIGTERM, e integración con `demo`: progreso, resultado, `DEMO_FALLO`, `ARGUMENTOS_NO_VALIDOS`, cancelación a mitad sin huérfanos). `npx eslint src/main/trabajos`, `npx tsc --noEmit -p tsconfig.node.json`.
- Deuda técnica: `taskkill` en Windows y la ruta de producción (`resolverLanzador` modo `produccion`) solo tienen test unitario del comando, no se ejecutaron en Windows. La ruta real del venv y del código empaquetado se fijará con el gestor de runtime (Fase 2). Aún no se invoca `configurarWorker` desde `index.ts` (lo hará la cola de trabajos).
