# 0150 — Generar picos multinivel en el worker

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: Fase 1 integrada en develop
- ADRs: [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor](../ux/06-editor.md), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Fase 2](../versiones/0.2.0/plan-2.md#fase-2--línea-de-tiempo)

## Objetivo

Construir una pirámide compacta de la pista vocal por streaming, reutilizando PyAV.

## Archivos y contrato

Añadir `worker/shinobi_worker/picos.py`, registrar `generar-picos` en `comandos.py` y cubrir CLI. El comando recibe rutas de entrada/salida temporal autorizadas por main y devuelve metadatos pequeños por JSON Lines. Producir el formato v1 de [ADR 0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md) con el bloque de 10 ms y agregación por parejas. Definir un único redondeo de límites de muestras y compartir fixtures binarias con 0151. Usar streaming PCM y memoria acotada para los picos. El worker no publica archivos finales ni modifica canción.

## Criterios de aceptación

- [ ] Con audio generado, cubre mono, estéreo, extremo de cada canal, silencio, longitud impar y último bloque parcial.
- [ ] La pirámide preserva extremos de parejas, el formato coincide byte por byte con fixture estable y el peso se aproxima a 48 KB/min.
- [ ] Un archivo inválido, sin muestras o con error devuelve fallo tipado y no se publica. La cancelación no deja un resultado final.
- [ ] El comando y las pruebas funcionan sin red ni modelos.

## Verificación

Desde `worker/`, `uv run pytest`, `uv run ruff check .` y `uv run ruff format --check .`.

## Notas de implementación

- `worker/shinobi_worker/picos.py` decodifica FLAC con PyAV y toma los extremos de todos los canales en PCM de 16 bits. Un bloque base empieza en `floor(i × frecuencia_hz / 100)`. El último bloque conserva las muestras que queden.
- El nivel base se escribe por tramas y los niveles superiores se agregan por lotes de hasta 4096 pares leídos del mismo temporal. El archivo se crea en modo exclusivo y su cabecera se completa después de escribir todos los niveles. Una interrupción controlada elimina el temporal. Main se encarga de limpiar tras una terminación forzada y de publicar el resultado.
- `generar-picos --args '{"entrada":"voz.flac","salida":"picos.tmp"}'` emite solo metadatos de resultado: `frecuencia_hz`, `muestras` por canal y `bloques_base`. La fixture compartida con 0151 es `worker/tests/fixtures/picos-v1.bin`.
- Verificado en Windows con Python 3.12: 332 pruebas pasaron, 1 omitida y 7 excluidas. `ruff check .` y `ruff format --check .` pasaron.
