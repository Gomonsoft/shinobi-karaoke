# Informe de la Fase 5 — Editor

Fecha: 2026-11-06. Rama: `fase-5-editor` (sale de `main` en `ae32d8d`). Implementada entre **Codex** (0090–0106 y avances de 0107–0109) y agentes de **Claude Code** (cierre de 0107–0110 y correcciones).

## Cómo revisarlo
```bash
git checkout fase-5-editor
cd app && npm install && npm run semilla && npm run dev     # 18 canciones; abrir una con letra → Editor
export SHINOBI_UV="$(which uv)"
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && npx playwright test
cd ../worker && uv run pytest
```

## Verificación final (2026-11-06)
| Comprobación | Resultado |
|---|---|
| lint / typecheck / format:check | OK |
| Vitest | **1683 pasan**, 12 omitidos |
| Playwright | **79 pasan**, 2 omitidos (pruebas con red) |
| Worker pytest | **312 pasan** |

## Qué se hizo (tareas 0090–0110, todas Hechas)
- **Base** (0090–0099): contratos del editor y error `LETRA_DESACTUALIZADA`; `guardarTiempos` en `ServicioLetras`; operaciones puras de tiempos; estado con deshacer/rehacer; reloj y motor de audio Web Audio (ADR 0010); audio de prueba largo, pista de clics y semilla de 18 canciones; modelo de render y `PantallaLetra` (reutilizable por el reproductor); contraste y color (`variarLuminosidad30`); controles de color, fuente, ángulo y deslizador.
- **Deuda saldada** (0100–0102): popover, diálogo `inert`, tooltip en los bordes, búsqueda por letra en menús; ✓ del paso actual en el stepper (pregunta 0024); texto de letra demasiado larga.
- **Editor** (0103–0109): cabecera con indicador de guardado; autoguardado agrupado, vaciado al salir y al cerrar la ventana; vista con lista, transporte y vista previa; ajuste fino y desplazamiento global (`,`/`.`); **sincronizar al ritmo** (Intro / mantener); panel Estilo con vista previa y aviso de contraste; marcar como lista, volver a borrador, resalte de 2 s y toast "Borrador guardado." en la Biblioteca.
- **E2E** (0110): 10 pruebas del editor sin red.

## Fallos reales encontrados por los E2E (corregidos)
- La tecla **S** no entraba en sincronizar y el **autoguardado no guardaba** en la app compilada ("Illegal invocation" al llamar `setTimeout`/`clearTimeout` como métodos). Los tests unitarios no lo veían porque inyectaban temporizadores falsos.
- El **selector de fuente se cerraba solo** con un scroll interno del panel de Estilo.

## Pendiente
- **0111 — prueba manual de precisión** con la pista de clics en los 3 SO (la hace una persona; ver la tarea).
- **Pregunta 0029** (para arquitecto, no bloquea): una canción de la semilla en "separando" aparece en el editor como separación interrumpida al reconciliarse al arrancar.
- Movido a la **Fase 6**: "Probar a pantalla completa", tecla F y [▶ Reproducir] en el toast de "lista".
- Linux sin dispositivo de audio no se ha comprobado en local: lo comprobará la CI (ADR 0010 prevé un sink nulo de PulseAudio si hiciera falta).
