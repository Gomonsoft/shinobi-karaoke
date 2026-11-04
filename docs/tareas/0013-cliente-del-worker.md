# 0013 — Cliente del worker: lanzar, leer JSON Lines y cancelar
- Estado: Pendiente
- Paso del pipeline: 0 (base de los pasos 1 y 2)
- Depende de: 0003, 0006
- ADRs: 0001, 0004
- Spec UX: —

## Objetivo
Un módulo de main (`src/main/trabajos/worker.ts`) que ejecute un comando del worker como proceso hijo y traduzca su salida en eventos tipados, con cancelación fiable en los tres SO.

## Criterios de aceptación
- [ ] Resolución del intérprete: en desarrollo, `uv run --project <repo>/worker python -m shinobi_worker`; en producción, `<datos>/runtime/venv/{bin/python | Scripts/python.exe} -m shinobi_worker` con el código del worker empaquetado (la ruta exacta se fija con el gestor de runtime en la Fase 2; aquí basta una función configurable y probada).
- [ ] `ejecutar(comando, args, { alProgreso, alLog, señal })` devuelve una promesa con el `resultado` o rechaza con `{ codigo, mensaje, reintentable }`. Los argumentos se pasan como un único JSON en `--args` (nunca concatenados en un shell; `shell: false`).
- [ ] Parser de JSON Lines robusto: líneas partidas entre *chunks*, varias líneas en un *chunk*, UTF-8 multibyte partido, líneas no JSON (se registran como log y se ignoran), mensajes que no cumplen el esquema de 0006.
- [ ] stderr del worker se escribe en `registros/worker-<fecha>.log` (rotado) y las últimas 50 líneas se adjuntan a los errores para "Copiar detalles".
- [ ] Salida con código ≠ 0 sin mensaje `error` → `ERROR_INTERNO`. Proceso que no se puede lanzar (intérprete inexistente) → error `RUNTIME_NO_DISPONIBLE` (añadir al catálogo de 0006).
- [ ] **Cancelación** con `AbortSignal`: macOS/Linux, proceso lanzado como líder de grupo (`detached: true`) y `SIGTERM` al grupo, `SIGKILL` a los 3 s; Windows, `taskkill /PID <pid> /T /F`. La promesa rechaza con `CANCELADO`. No quedan procesos huérfanos (test con `demo`).
- [ ] Tests de integración con el comando `demo` de 0003: progreso recibido, resultado, error simulado, cancelación a mitad (y limpieza del archivo parcial por parte del llamador).

## Notas de implementación
(las rellena el programador al terminar)
