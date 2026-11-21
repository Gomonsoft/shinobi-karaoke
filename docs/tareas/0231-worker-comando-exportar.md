# 0231 — Worker: comando `exportar`

- Estado: Hecha
- Paso del pipeline: 6
- Depende de: — (puede empezar en paralelo con 0230; los códigos de error deben coincidir con los de 0230)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §4 y §5, [0009](../adr/0009-gestor-de-runtime-y-dobles-de-prueba.md#revisión-para-020--fase-6)
- Spec UX: — (sin interfaz)

## Objetivo
Comando `python -m shinobi_worker exportar --args '<json>'` que lee fotogramas BGRA por stdin, mezcla el audio y escribe un MKV (AV1 + Opus) o WebM (VP9 + Opus) en la ruta temporal, con progreso JSON Lines. Base: `docs/poc/0019-exportacion/codificar.py` (solo como referencia; no se importa).

## Contrato
- `worker/shinobi_worker/exportar.py`, registrado en `comandos.py`.
- Argumentos: `temporal`, `formato`, `ancho`, `alto`, `fps`, `total_fotogramas`, `duracion_ms`, `audio: { instrumental, voz | null, ganancia_db }`, `parametros: { preset | cpu_used, crf }` (los envía main desde `PARAMETROS_CODIFICACION`), `hilos`.
- Fases: `preparando` (decodificar ambas pistas a 48 kHz estéreo float, mezclar con `ganancia_db`, voz al 100 %, normalizar por pico si > 0,999), `codificando` (`detalle: { fotograma, total }`, ≤ 4/s), `finalizando`.
- Video: stdin leído con `readinto` en el plano de un `VideoFrame` BGRA reutilizable (sin `from_ndarray`), `reformat` a `yuv420p` BT.709 rango limitado con `threads=0`, metadatos de color, GOP de 5 s, `libsvtav1` o `libvpx-vp9` (`deadline=realtime`, `row-mt=1`, `b=0`). Audio: `libopus` 48 kHz estéreo 192 kbit/s intercalado por tiempo.
- Fin: cerrar contenedor, `fsync`, reabrir y verificar flujos, fotogramas y duración (± 1 fotograma); `resultado { bytes, fotogramas, duracion_ms }`.
- Errores (ADR 0019 §4) con `detalle.fotograma`: `SIN_ESPACIO`, `DESTINO_NO_DISPONIBLE`, `MEMORIA_INSUFICIENTE`, `SIN_CODIFICADOR`, `RUNTIME_NO_DISPONIBLE`, `CANCION_NO_DISPONIBLE`, `ENTRADA_INCOMPLETA` (stdin cerrado antes de tiempo), `ERROR_INTERNO`. En cualquier error el temporal se borra.
- Sin estado propio ni escritura fuera de `temporal`.

## Criterios de aceptación
- [ ] 2 s a 320 × 240 y 24 FPS en los dos formatos: el archivo tiene 48 fotogramas, el FPS, el códec y el contenedor pedidos, audio Opus estéreo a 48 kHz y duración 2 s ± 1 fotograma.
- [ ] Con «Instrumental y voz» la mezcla suma las dos pistas; si el pico supera 0,999 se escala sin recortar (prueba sobre la función de mezcla).
- [ ] Cortar stdin a la mitad da `ENTRADA_INCOMPLETA` y no deja el temporal.
- [ ] Un formato cuyo codificador falta (doble) da `SIN_CODIFICADOR`.

## Pruebas de feedback
- Unitarias (pytest, `worker/tests/test_exportar.py`): las cuatro de arriba con fotogramas y audio sintéticos (sin archivos de terceros). Se ejecutan en la CI en los 3 SO: **es la verificación de codificadores en Windows y Linux**.
- E2E: ninguna.
- Críticos: no.
- Manual: nada (los tiempos reales van a la guía de la fase).

## Notas de implementación

Comando `exportar` implementado en `worker/shinobi_worker/exportar.py` (registrado en `comandos.py`) siguiendo el contrato y `docs/poc/0019-exportacion/codificar.py`. La función `exportar(args, entrada=None)` admite un flujo inyectado para las pruebas; sin él lee `sys.stdin.buffer.raw`. Si `line_size` del plano BGRA no coincide con `ancho × 4`, lee a un búfer y copia por filas (sin NumPy). El audio se trunca o rellena con silencio a `duracion_ms` y se intercala en bloques de 100 ms. La verificación final cuenta paquetes de video y compara la duración con ± 1 fotograma; si falla da `VERIFICACION_FALLIDA` (código ya existente).

Cambios de soporte (fuera de `exportar.py`):
- `ErrorWorker` y `protocolo.error` admiten `detalle` opcional (`{ fotograma }`); `__main__` lo reenvía. El esquema TS `mensajeErrorSchema` aún no declara `detalle` (zod lo descarta sin fallar): lo recoge 0230/0233.
- `errores.py` añade `DESTINO_NO_DISPONIBLE`, `SIN_CODIFICADOR`, `ENTRADA_INCOMPLETA` y `CANCION_NO_DISPONIBLE`. **El test de Vitest `protocolo.test.ts` («coincide con CODIGOS_ERROR…») fallará hasta que 0230 añada los tres primeros a `CODIGOS_ERROR` de `shared/errores.ts` y saque `CANCION_NO_DISPONIBLE` de `CODIGOS_SOLO_MAIN`** (ahora también lo emite el worker).

Archivos: `worker/shinobi_worker/{exportar,comandos,errores,protocolo,__main__}.py`, `worker/tests/test_exportar.py`.

Cómo probarlo: `cd worker && uv run pytest tests/test_exportar.py` (6 pruebas, < 1 s: ambos formatos a 320 × 240 y 24 FPS con 48 fotogramas, mezcla y normalización, stdin cortado, codificador ausente con doble, pista ausente). Worker completo: 338 pruebas OK; ruff OK.

Deuda: no se mide tiempo ni memoria reales (guía manual de la fase). `hilos` solo se aplica si es > 0. La comprobación de `MEMORIA_INSUFICIENTE` por proceso muerto es de main (0237).
