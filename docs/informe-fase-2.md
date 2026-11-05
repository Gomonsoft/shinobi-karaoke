# Informe de la Fase 2 — Fuente

Fecha: 2026-11-04. Rama: `fase-2-fuente` (sale de `main` en `5b81a62`). **Todo el trabajo está sin commitear**, pendiente de tu revisión.

## Cómo revisarlo
```bash
git checkout fase-2-fuente
brew install uv                        # necesario para el worker y los E2E de importación
cd app && npm install
npm run semilla && npm run dev         # biblioteca de ejemplo (12 canciones)
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && npx playwright test
cd ../worker && uv sync && uv run pytest
```
Sin `uv` en el PATH (o `SHINOBI_UV`), los E2E de importar archivo/YouTube fallan por no poder lanzar el worker: no es un fallo del código.

## Verificación final (21:38, sesión principal)
| Comprobación | Resultado |
|---|---|
| lint / typecheck / format:check (app) | OK |
| Vitest (app) | **1012 pasan**, 6 omitidos |
| Playwright (app compilada) | **36 pasan**, 1 omitido (prueba con red) |
| Worker: ruff check / format | OK |
| Worker: pytest | **253 pasan**, 5 deseleccionados (`red`/`pesado`) |

## Tareas
- **Hechas (26)**: 0028–0039, 0041–0054 — runtime y primer arranque (B0–B6b), importar archivo local, importar desde YouTube, actualización automática de yt-dlp, información para soporte, semilla con miniaturas, E2E sin red de todo lo anterior.
- **0040 — En curso**: workflow manual `runtime-real.yml` y revisión de licencias PyAV/FFmpeg hechos; falta **lanzarlo a mano en GitHub** y copiar las cifras medidas.
- **0024 — parcial**: falta la primera ejecución real de la CI en GitHub.
- **0025 — Pendiente** (empaquetado, Fase 7).
- Mantenimiento: el worker importa ahora los módulos pesados de forma perezosa (arreglo del test del lanzador de 0035).

## Decisiones tomadas en la fase
| Tema | Decisión |
|---|---|
| ADR 0009 (nuevo) | Requisitos fijados con hashes por plataforma/perfil, `runtime/instalado.json`, modelos descargados por la app con reanudación, dobles `SHINOBI_*_FALSO` solo sin empaquetar |
| Pregunta 0012 (tú) | Modelo Rápido provisional; pedir aclaración de licencia a UVR (**pendiente que abras el issue**, texto en la propia pregunta) |
| Pregunta 0016 (tú) | **Mac Intel fuera del MVP**; solo DMG arm64 |
| Pregunta 0015 | Apple Silicon requiere **macOS 14** (pantalla B6b «Necesitas actualizar macOS») |
| Pregunta 0014 | Cerrojo lectura/escritura para yt-dlp; «Usar otro enlace» sustituye la fuente de la misma canción |
| PyAV/FFmpeg | Declara LGPL-3 pero enlaza x264/x265 (GPL): compatible con GPL-3.0; ninguna rueda con componentes no libres |

## Pendiente / a revisar
1. **Lanzar `runtime-real.yml`** en GitHub (instalación real en 3 SO) y hacer push para la primera CI.
2. **Issue a UVR** sobre la licencia del modelo Rápido.
3. En Apple Silicon/NVIDIA el instalador descarga el modelo **Calidad (913 MB)** aunque el modo elegido sea Rápido: decidir si es lo deseado (para el arquitecto).
4. Nunca probado: instalación real del runtime, actualización real de yt-dlp contra PyPI, Windows y Linux.
5. Sin revisión visual en ventana real de las vistas nuevas (Primer arranque, Añadir canción, Progreso).
6. `npm audit` y avisos menores anotados en las Notas de cada tarea.
