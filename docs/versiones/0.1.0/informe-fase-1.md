# Informe de la sesión nocturna — Fases 0 y 1

Fecha: 2026-11-04 (madrugada). Rama de trabajo: `fase-1-esqueleto` (sale de `fase-0-fundamentos`).

> **Estado de git**: la Fase 0 está en el commit `73e19fd` (rama `fase-0-fundamentos`). **Todo el trabajo de la Fase 1 está sin commitear** en `fase-1-esqueleto`, a la espera de tu revisión. Nada está fusionado en `main`.

## Cómo revisarlo
```bash
git checkout fase-1-esqueleto
brew install uv           # uv no estaba instalado; los agentes usaron uno temporal
cd app && npm install
npm run semilla           # 10 canciones de ejemplo en app/.datos-dev
npm run dev               # la app; #/muestrario para ver el sistema visual
npm run lint && npm run typecheck && npm test
npm run build && npx playwright test
cd ../worker && uv sync && uv run pytest
```
Capturas reales de la interfaz: `docs/ux/revision-fase-1/` (ver su README).

## Resultado
| Bloque | Estado |
|---|---|
| Fase 0 (ADRs 0001–0007, arquitectura, specs UX, preguntas 0001–0006) | Cerrada y commiteada |
| Fase 1 — tareas 0001–0004, 0006–0020 | **Hechas** |
| 0005 — spike de separación (tiempos y tamaños reales) | Ver sección "Pendiente al cierre" |
| Revisión técnica de cierre (arquitecto) | Hecha → ADR 0008, tareas 0021–0027 |
| Revisión visual con capturas (diseñador UX) | Hecha → 1 bloqueante, corregido en 0026 |
| 0023 — E2E sin tocar la papelera real | Hecha |
| 0026 — menú ⋯ recortado (bloqueante) | Hecha |
| 0021 — endurecimiento de Electron (navegación, permisos, instancia única, remitente IPC, cierre con plazo) | Hecha |
| 0027 — ajustes de biblioteca tras revisión visual | Hecha |
| 0022, 0024 | Ver "Pendiente al cierre" |
| 0025 — empaquetado e instaladores | Pendiente (siguiente sesión) |

Última verificación completa (02:25, tras 0021 + 0027, ejecutada por la sesión principal): lint, typecheck y format:check OK; **vitest 536 pasan / 7 omitidos**; **Playwright 12/12**; worker: 14 tests pytest + ruff OK.

## Qué existe ya en la app
- Electron + React + TypeScript con sandbox, contextIsolation y CSP; worker Python con protocolo JSON Lines y comando `demo`.
- Persistencia atómica de `cancion.json`/`config.json` con `.bak` y recuperación; servicio de configuración; biblioteca (escaneo, canciones dañadas, interrumpidas, crear/importar/actualizar/eliminar).
- IPC tipado y validado con Zod; protocolo `shinobi-media://` con lista blanca y soporte de Range.
- Cliente del worker y gestor de trabajos (colas, ETA, cancelación sin procesos huérfanos).
- Sistema visual, componentes base accesibles, 8 fuentes OFL incluidas, ventana con navegación, atajos y menú nativo.
- Vista Biblioteca completa: tarjetas Lista / Lista incompleta / Borrador / Dañada, filtros, búsqueda, menú ⋯, diálogos, arrastrar archivo, indicador de actividad y progreso en vivo.
- CI en GitHub Actions para Windows/macOS/Linux (**aún no se ha ejecutado en GitHub**).

## Decisiones que conviene que revises
1. **Commits**: decide si quieres un commit por tarea o uno por fase antes de fusionar a `main`.
2. **Enlaces externos permitidos**: `lrclib.net` y `github.com/Gomonsoft/shinobi-karaoke`. Si habrá web del proyecto, hay que añadirla (`app/src/shared/ipc.ts`).
3. **CORS del protocolo de medios**: aceptado solo de forma provisional; ADR 0008 lo sustituye (tarea 0022).
4. Decisiones de programadores no cubiertas por ADRs: revisadas y aceptadas por el arquitecto (ver notas de revisión en ADR 0005/0006 y la tarea correspondiente).

## Límites y riesgos encontrados
- **Mac dormido**: dos ejecuciones del diseñador UX se cortaron por suspensión; se usó `caffeinate` hasta las 03:00. Lo que no terminase antes queda indicado abajo.
- **Sin probar en Windows/Linux**: cancelación con `taskkill`, modo producción del lanzador del worker, E2E en Linux (paso de AppArmor en CI). La primera ejecución real de la CI será la prueba.
- **`npm run dev` sin verificar de forma interactiva** por los agentes (sí la app compilada vía Playwright).
- **Papelera**: la ejecución de E2E de la tarea 0020 (antes de la 0023) pudo dejar carpetas de prueba `shinobi-e2e-*` en tu Papelera.
- **Disco**: `spikes/` ocupa varios GB (entorno Python, PyTorch y modelos del spike 0005). Está ignorado por git; se puede borrar con `rm -rf spikes/separacion/<carpetas ignoradas>` según indique la tarea 0005.
- `npm audit` reporta avisos moderados en dependencias de desarrollo.

## Pendiente al cierre (03:00)
- **Verificación final** (sesión principal): lint, typecheck, format:check OK; **vitest 547 / 7 omitidos**; **Playwright 13/13**.
- **Hechas también**: 0005 (spike, medido solo en MacBook Air M1 8 GB), 0022 (renderer en `shinobi-app://`, CORS por origen exacto), 0024 (CI con uv; falta la primera ejecución real en GitHub). Preguntas 0009–0011 respondidas por el arquitecto; ADRs 0001–0004 y 0008 actualizados con datos medidos.
- **Spike 0005 — resumen**: Rápido en CPU ≈ 0,7–0,8 min/min de audio; Calidad en CPU ≈ 1,1–1,3; MPS/CoreML *más lentos* en M1 → se fuerza CPU. Disco macOS ≈ 1,3 GB (Rápido) / 2,2 GB (Calidad). ffmpeg se evita con parche (`use_soundfile`).
- **Tu decisión pendiente**: `docs/preguntas/0012-licencia-no-declarada-del-modelo-rapido.md` (A aceptar riesgo / B solo Calidad / C provisional + pedir aclaración a UVR, recomendada). Después revisar `THIRD_PARTY_NOTICES.md`.
- **Tarea pendiente**: 0025 (empaquetado e instaladores). Mediciones en NVIDIA/Windows/Linux sin hacer.
- **Limpieza manual opcional**: `rm -rf spikes/separacion/.venv spikes/separacion/salida` (~4,2 GB, ignorado por git) y `rm -rf ~/.cache/uv` (33 MB que uv creó fuera del repo; el borrado fue denegado a los agentes y no se tocó).
- **Sesión cortada por límite de uso** al llegar a las 03:00.
