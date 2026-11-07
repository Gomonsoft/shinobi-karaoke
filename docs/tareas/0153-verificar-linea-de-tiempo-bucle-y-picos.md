# 0153 — Verificar línea de tiempo, bucle y picos

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: [0145](0145-verificar-fin-y-barrido-en-electron.md), [0149](0149-integrar-linea-de-tiempo-en-sincronia.md), [0152](0152-dibujar-forma-de-onda-y-minimapa.md)
- ADRs: [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor](../ux/06-editor.md), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Fase 2](../versiones/0.2.0/plan-2.md#fase-2--línea-de-tiempo)

## Objetivo

Verificar el flujo de punta a punta y documentar los límites en audio largo.

## Archivos y contrato

Ampliar `app/e2e/editor.spec.ts` o añadir spec dedicada con fixtures generadas. Usar worker sin modelos y audio local para posiciones deterministas. Registrar resultados en el informe de fase. Medir un archivo de voz de una hora, generación en frío y reapertura, tamaño de caché, CPU, memoria y frecuencia de repintado o frames perdidos durante zoom y reproducción. Documentar equipo, sistema, escala y comandos para repetir. Separar la prueba manual de carga del CI normal.

## Criterios de aceptación

- [ ] E2E: arrastrar con ratón, cancelar, deshacer, teclado y comprobar guardado con y sin offset. Mantener los E2E de fase 1.
- [ ] E2E: bucle real con audio generado, dos vueltas, cambio de extremo, ajuste de velocidad, pausa y salida. Verificar fase con reloj audible y referencia ADR 0010. Probar tanto confirmar como cancelar tras dejar inaudible el intervalo provisional.
- [ ] E2E: zoom anclado, minimapa y resize sin buscar; estados sin onda, generación y reemplazo de voz con editor abierto.
- [ ] Prueba larga: datos solicitados y dibujados acotados al viewport, cabezal no fuerza repintar onda y la escucha permanece utilizable. Registrar las cifras observadas y cualquier límite del equipo.
- [ ] CI normal y verificación de fase sin red, modelos ni contenido real.

## Verificación

Desde `app/`, ejecutar `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm test`, `npm run build` y, con `SHINOBI_UV` apuntando a uv, `npx playwright test --workers=1`. Desde `worker/`, `uv run pytest`, `uv run ruff check .` y `uv run ruff format --check .`.

## Notas de implementación

Pendientes.
