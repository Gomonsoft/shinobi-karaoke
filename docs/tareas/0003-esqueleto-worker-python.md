# 0003 — Esqueleto del worker Python: CLI, protocolo JSON Lines y comando de demostración
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0001
- ADRs: 0001, 0007
- Spec UX: —

## Objetivo
El paquete `shinobi_worker` ejecutable como `python -m shinobi_worker <comando> --args '<json>'` que habla el protocolo JSON Lines de `arquitectura.md` §6, con un comando de demostración que permita probar la comunicación con Electron antes de existir los comandos reales.

## Criterios de aceptación
- [x] `worker/pyproject.toml` gestionado con uv (Python 3.12, `requires-python = ">=3.12,<3.13"`), `uv.lock` versionado; sin dependencias de producción todavía; dependencias de desarrollo: pytest, ruff.
- [x] `uv run pytest` y `uv run ruff check` / `ruff format --check` pasan.
- [x] `shinobi_worker/protocolo.py`: funciones para emitir `progreso` (`fase`, `valor` 0–1 o `null`, `detalle` opcional), `log`, `resultado` y `error` (`codigo`, `mensaje`, `reintentable`), una línea JSON UTF-8 por mensaje con *flush* inmediato. Todo lo que no sea protocolo va a stderr (incluidos `print` accidentales de librerías: stdout se redirige a stderr y el protocolo escribe en el descriptor original).
- [x] `__main__.py`: despacha comandos; `--args` es JSON validado; comando desconocido o JSON inválido → mensaje `error` con código `ARGUMENTOS_NO_VALIDOS` y código de salida ≠ 0. Excepción no controlada → `error` con código `ERROR_INTERNO` y traza en stderr.
- [x] Comando `version`: emite `resultado` con versión del paquete y de Python.
- [x] Comando `demo`: args `{ "segundos": n, "fallar_en": 0..1 | null, "indeterminado_s": n }`; emite primero una fase indeterminada (`cargando`) durante `indeterminado_s`, luego `progreso` de la fase `procesando` ~10 veces/s hasta `segundos`, y termina con `resultado` o con `error` (`DEMO_FALLO`, `reintentable: true`) al llegar a `fallar_en`. Escribe un archivo parcial en una ruta recibida en args para probar la limpieza tras cancelar.
- [x] Tests de pytest: formato de cada tipo de mensaje, argumentos inválidos, `demo` completo con `segundos` pequeños.
- [x] Al recibir SIGTERM (o terminar por `taskkill` en Windows) el proceso termina sin dejar procesos hijos (no los crea en esta tarea, pero se documenta la convención).

## Notas de implementación
- Qué se hizo: paquete `shinobi_worker` (stdlib), `pyproject.toml` con uv/hatchling (Python 3.12, sin deps de producción; grupo dev: pytest, ruff), `uv.lock`, `.python-version`.
- Archivos clave: `worker/shinobi_worker/{protocolo,__main__,comandos,errores}.py`, `worker/tests/`.
- `protocolo.iniciar()` duplica el fd 1 original para el protocolo y redirige fd 1 y `sys.stdout` a stderr (cubre también escrituras desde extensiones C).
- Códigos de salida: 0 ok; 1 error de ejecución (`DEMO_FALLO`, `ERROR_INTERNO`); 2 `ARGUMENTOS_NO_VALIDOS`.
- `demo`: args `segundos` (def. 5), `fallar_en` (null|0..1), `indeterminado_s` (def. 0), `ruta_parcial` (opcional). Crea el archivo parcial al empezar; lo borra al terminar (éxito o `DEMO_FALLO`). Si el proceso muere por SIGTERM el archivo se queda (verificado: salida 143) para que el gestor pruebe su limpieza.
- Convención de procesos: el worker no crea hijos; los comandos futuros que los creen deben terminarlos con SIGTERM (documentado en `__main__.py` y `worker/README.md`).
- Probar: `cd worker && uv sync && uv run pytest && uv run ruff check && uv run ruff format --check` (14 tests pasan).
- Deuda técnica: `uv` no estaba instalado; se usó uv 0.13.7 instalado vía pip en un venv temporal (el `uv.lock` es de esa versión). No se probó `taskkill` en Windows (solo SIGTERM en macOS). Los pasos del demo son 10/s por `time.sleep` (sin corrección de deriva).
