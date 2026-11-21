# Informe de la Fase 3 — Separación de pistas

Fecha: 2026-11-05. Rama: `fase-3-separacion` (sale de `main` en `b8805ab`).

## Cómo revisarlo
```bash
git checkout fase-3-separacion
cd app && npm install && npm run semilla && npm run dev
export SHINOBI_UV=$(which uv)     # o uv en el PATH: sin él los E2E de importación fallan
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && npx playwright test
cd ../worker && uv sync && uv run pytest
```
Para probar la separación sin descargar modelos: `SHINOBI_SEPARADOR_FALSO=<escenario.json>` (ver `app/README.md`).

## Verificación final (11:33, sesión principal)
| Comprobación | Resultado |
|---|---|
| lint / typecheck / format:check | OK |
| Vitest | **1318 pasan**, 7 omitidos |
| Playwright | **61 pasan**, 1 omitido (YouTube con red) |
| Worker ruff / pytest | OK / **312 pasan** |

## Qué se hizo
- **Decisiones previas (0055, 0056)**: Calidad por defecto en todos los equipos, sin modo Automático; 4 GB mínimos; manifiesto con `bytes_disco`/`bytes_cache` medidos y `bytes_descarga` = suma real de ruedas (0058).
- **Worker**: comando `separar` con separador falso (0060) y adaptador audio-separator sin ffmpeg, CPU forzada en Apple Silicon y bloques pequeños (0061).
- **Main**: contratos (0059), reintentos automáticos y `PROCESO_TERMINADO` (0063), progreso interpolado y ETA (0064), servicio de separación con encolado automático tras importar y factor medido (0065), reintentos por memoria / CUDA→CPU, descarga del modelo que falta y oferta de Rápido (0066), estimación previa (0067).
- **Rápido con consentimiento (0057)**: solo tras fallo de Calidad; nunca se descarga sin `rapido_aceptado`.
- **Interfaz**: progreso de separación (0068), terminado con escucha de pistas (0069), Reintentar / Cancelar trabajo / Re-separar en la Biblioteca (0070), panel de actividad (0071), toasts y notificaciones/Dock (0072), diálogo de cierre con trabajos (0073), Ajustes informativos con "Volver a Calidad" (0074).
- **E2E**: flujo completo con separador falso (0075) y errores, Rápido, Re-separar y Volver a Calidad (0076). CI: separación sin ffmpeg en los 3 SO (0062).
- Mantenimiento: tests deterministas (`ytdlp.test.ts`), E2E ajustados al diálogo de cierre y a Reintentar desde la Biblioteca; worker con imports perezosos.

## Pendiente (requiere GitHub)
- **0058 y 0062 — En curso**: lanzar `runtime-real.yml` sobre esta rama (hay que subirla). Medirá bytes de red, pico de disco con Calidad en CPU y el **primer factor real de separación en Windows/Linux x86**; copiar los resultados a las notas de ambas tareas.
- El README dice 4 GB de espacio mínimo; el diseñador sugirió matizar "entre 4 y 10 GB" según equipo (revisar).

## Riesgos / a vigilar
- Las suites E2E nuevas tardan algo más de lo previsto (≈65 s y ≈1,6 min); si la CI de Linux se queja, acortar escenarios.
- Notificaciones y `taskkill` sin probar en Windows/Linux reales.
- `load_model` de audio-separator podría descargar ficheros auxiliares pequeños: confirmar en `runtime-real`.
