# Prueba técnica del ADR 0019 — exportación de video

Prueba de concepto desechable (no es código de producción, no se empaqueta ni se importa desde `app/` o `worker/`). Resultados y conclusiones en el [ADR 0019](../../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md), sección «Prueba técnica».

| Archivo | Qué hace |
|---|---|
| `codificar.py` | Codifica fotogramas BGRA (sintéticos o por stdin) y una mezcla de audio con PyAV en MKV (AV1/SVT-AV1) o WebM (VP9/libvpx) con Opus, y verifica el archivo leyéndolo (fotogramas, duración de video y audio). |
| `matriz.py` | Recorre resoluciones × FPS × codificador con fotogramas sintéticos. |
| `electron/main.js` + `pagina.html` | Ventana offscreen de Electron gobernada por índice de fotograma (texto con sombra, barrido con `clip-path`, entrada de línea con Web Animations pausada y fijada por `n`, fondo degradado fijo o en movimiento, marca de agua), captura con `capturePage()` o con el evento `paint`, y tubería con contrapresión hacia `codificar.py`. |

## Cómo ejecutarlo

```sh
# Codificación sola (desde worker/, con su venv)
cd worker
uv run python ../docs/poc/0019-exportacion/codificar.py --perfil av1 --ancho 1920 --alto 1080 --fps 30 --segundos 10 --salida /tmp/x.mkv
uv run python ../docs/poc/0019-exportacion/matriz.py --segundos 20 --fps 30 60 --salida /tmp/matriz.jsonl

# De extremo a extremo (desde la raíz del repo; usa worker/.venv/bin/python o SHINOBI_POC_PYTHON)
app/node_modules/.bin/electron docs/poc/0019-exportacion/electron/main.js \
  --ancho 1920 --alto 1080 --fps 30 --segundos 10 --perfil av1 --en-vuelo 2 --salida /tmp/x.mkv
# --modo paint     captura con el evento `paint` tras invalidate()
# --sin-codificar  mide solo render + captura
# --movil          fondo en movimiento (peor caso de la fase 5)
```

Perfiles de `codificar.py`: `av1` (SVT-AV1 preset 10, CRF 35), `av1-p8`, `av1-p12`, `vp9` (realtime, cpu-used 8, CRF 33), `vp9-good` (good, cpu-used 5).

Medido el 2026-11-20 en un MacBook Air M1 de 8 GB (sin ventilador: con carga sostenida baja la frecuencia, así que las cifras varían ± 30 % entre ejecuciones largas).
