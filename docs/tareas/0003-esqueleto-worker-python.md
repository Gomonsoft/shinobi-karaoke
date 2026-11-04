# 0003 — Esqueleto del worker Python: CLI, protocolo JSON Lines y comando de demostración
- Estado: Pendiente
- Paso del pipeline: 0
- Depende de: 0001
- ADRs: 0001, 0007
- Spec UX: —

## Objetivo
El paquete `shinobi_worker` ejecutable como `python -m shinobi_worker <comando> --args '<json>'` que habla el protocolo JSON Lines de `arquitectura.md` §6, con un comando de demostración que permita probar la comunicación con Electron antes de existir los comandos reales.

## Criterios de aceptación
- [ ] `worker/pyproject.toml` gestionado con uv (Python 3.12, `requires-python = ">=3.12,<3.13"`), `uv.lock` versionado; sin dependencias de producción todavía; dependencias de desarrollo: pytest, ruff.
- [ ] `uv run pytest` y `uv run ruff check` / `ruff format --check` pasan.
- [ ] `shinobi_worker/protocolo.py`: funciones para emitir `progreso` (`fase`, `valor` 0–1 o `null`, `detalle` opcional), `log`, `resultado` y `error` (`codigo`, `mensaje`, `reintentable`), una línea JSON UTF-8 por mensaje con *flush* inmediato. Todo lo que no sea protocolo va a stderr (incluidos `print` accidentales de librerías: stdout se redirige a stderr y el protocolo escribe en el descriptor original).
- [ ] `__main__.py`: despacha comandos; `--args` es JSON validado; comando desconocido o JSON inválido → mensaje `error` con código `ARGUMENTOS_NO_VALIDOS` y código de salida ≠ 0. Excepción no controlada → `error` con código `ERROR_INTERNO` y traza en stderr.
- [ ] Comando `version`: emite `resultado` con versión del paquete y de Python.
- [ ] Comando `demo`: args `{ "segundos": n, "fallar_en": 0..1 | null, "indeterminado_s": n }`; emite primero una fase indeterminada (`cargando`) durante `indeterminado_s`, luego `progreso` de la fase `procesando` ~10 veces/s hasta `segundos`, y termina con `resultado` o con `error` (`DEMO_FALLO`, `reintentable: true`) al llegar a `fallar_en`. Escribe un archivo parcial en una ruta recibida en args para probar la limpieza tras cancelar.
- [ ] Tests de pytest: formato de cada tipo de mensaje, argumentos inválidos, `demo` completo con `segundos` pequeños.
- [ ] Al recibir SIGTERM (o terminar por `taskkill` en Windows) el proceso termina sin dejar procesos hijos (no los crea en esta tarea, pero se documenta la convención).

## Notas de implementación
(las rellena el programador al terminar)
