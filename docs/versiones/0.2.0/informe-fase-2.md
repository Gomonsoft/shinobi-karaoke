# Informe de fase 2 · Línea de tiempo

Las tareas 0146–0153 del [backlog](backlog.md) cubren la edición de regiones con marcadores, el bucle nativo, el zoom y el minimapa. La forma de onda se genera bajo demanda desde la pista de voz mediante una caché multinivel [SKPV](../../adr/0015-linea-de-tiempo-y-picos-de-voz.md).

## Verificación

- Los casos nuevos de Electron cubren vista provisional y cancelación por Escape, deshacer en un paso, teclado, persistencia con y sin desplazamiento, fase y límites del bucle, zoom anclado, navegación del minimapa, redimensión y regeneración al reemplazar la voz con el editor abierto. La prueba de foco del diálogo del editor espera el efecto que mueve el foco.
- El caso de audio usa pulsos generados y Chromium. Compara el cabezal con el reloj de salida de Web Audio en el mismo fotograma, con tolerancia de 20 ms. Verifica dos vueltas, cambio de límite, 0,5×, pausa, cancelación del gesto inaudible y restauración de la posición al confirmar ese gesto.
- En Windows, Playwright registró 92 casos correctos y 4 omitidos en la primera corrida. Los otros 3 casos pasaron con `--last-failed` tras actualizar las claves del preload y la ruta de Python en las fixtures de Primer arranque. Quedaron verificados los 95 casos ejecutables en ese entorno.
- La compilación, lint, TypeScript y formato de la app pasaron. El worker registró 332 pruebas correctas, 1 omitida y 7 excluidas por los marcadores de red y carga. Ruff y su verificación de formato pasaron.
- La corrida global de Vitest en Windows tuvo 1905 pruebas correctas, 13 omitidas y 8 fallos al crear enlaces simbólicos (`EPERM`) en dos archivos. Es la misma limitación local observada durante la fase 1. La verificación final en CI se registra en el PR de la fase.

## Perfil con una hora de voz

Windows 11, compilación 26200, Ryzen 5 7600, 12 hilos y 31,1 GiB de RAM. Audio sintético FLAC PCM16 mono, 48 kHz, tono de 440 Hz. El editor se midió con una ventana de 1280 px y una pista de una hora. Los tiempos hasta dibujar incluyen la apertura del editor y la carga del audio.

| Medición | Resultado |
|---|---|
| Generación en frío, worker por separado | 5,49 s |
| Apertura en frío y reapertura con caché | 3,59 s y 1,97 s |
| Caché en disco | 2.880.040 bytes |
| Lectura en ventana de 48 min | 1126 pares de 1167 permitidos por el ancho, paso 2560 ms |
| Reproducción estable, muestra de 1,2 s | 290 cuadros, intervalo máximo 5,9 ms y 0 repintados de onda |
| Zoom durante reproducción, muestra de 1,2 s | 289 cuadros, intervalo máximo 5,1 ms, 2 repintados y 901 bloques como máximo en un repintado |
| Muestra de CPU y memoria de trabajo | Renderer 1,18 % y 817.456 KiB. Proceso principal 0,10 % y 159.804 KiB. GPU 0,62 % y 114.040 KiB. |

La muestra confirma que el cabezal se actualiza por separado y que las lecturas y los repintados respetan el presupuesto del viewport. El renderer decodifica la pista de reproducción completa según el [ADR 0010](../../adr/0010-editor-motor-de-audio-reloj-y-guardado.md), lo que condiciona la memoria en temas largos.

### Reproducción del perfil

Ejecutar desde la raíz del repositorio en PowerShell con el entorno del worker preparado.

```powershell
$env:SHINOBI_PERFIL_PICOS = Join-Path $PWD 'app/node_modules/shinobi-perfil-voz.flac'
@'
import os
import numpy as np
import soundfile as sf

frecuencia = 48000
segundo = 0.2 * np.sin(2 * np.pi * 440 * np.arange(frecuencia) / frecuencia)
with sf.SoundFile(os.environ["SHINOBI_PERFIL_PICOS"], "w", frecuencia, 1, subtype="PCM_16") as voz:
    for _ in range(3600):
        voz.write(segundo)
'@ | uv run --project worker --locked python -
Set-Location app
npm run build
npx playwright test e2e/editor.spec.ts --workers=1 --grep 'perfil opt-in'
```

El perfil se omite en la suite normal. Usa audio generado y los mismos canales IPC que el editor.
