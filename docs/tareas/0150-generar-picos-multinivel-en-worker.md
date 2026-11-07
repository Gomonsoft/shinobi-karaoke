# 0150 — Generar picos multinivel en el worker

- Estado: Pendiente
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

Pendientes.
