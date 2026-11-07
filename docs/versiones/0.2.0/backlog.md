# Backlog de Shinobi Karaoke 0.2.0-alfa

Ver el [plan por fases](plan-2.md), la [hoja de ruta](../../roadmap.md) y el [flujo de Git](../../workflow.md).

## Fase 1 · Fin y barrido

| Tarea | Estado | Depende de | Entrega |
|---|---|---|---|
| [0143 · Fin de línea independiente](../../tareas/0143-fin-de-linea-independiente.md) | Hecha | 0091, 0092 | Estado de fin, edición existente y huecos comprobados |
| [0144 · Barrido por renglón visual](../../tareas/0144-barrido-por-renglon-visual.md) | Hecha | 0112 | Geometría real y reparto de progreso |
| [0145 · Verificar fin y barrido en Electron](../../tareas/0145-verificar-fin-y-barrido-en-electron.md) | Pendiente | 0143, 0144, 0123 | Regresiones E2E sin red |

0143 y 0144 pueden avanzar en paralelo. La primera trabaja controles de sincronía y modelo de fotograma. La segunda trabaja geometría y pintura de `PantallaLetra`. 0145 integra escenarios en Electron.

## Fases siguientes

| Fase | Alcance | Desglose |
|---|---|---|
| 2 | Marcadores, bucle, zoom y picos de voz | Al iniciar la fase |
| 3 | Temas y agrupación de biblioteca | Al iniciar la fase, con [0047](../../preguntas/0047-temas-asignados-edicion-y-borrado.md) |
| 4 | Ventana secundaria y cola | Al iniciar la fase, con [0048](../../preguntas/0048-escucha-editor-durante-evento.md) y [0049](../../preguntas/0049-politica-cola-de-reproduccion.md) |
| 5 | Degradados, comodines y Letra lista | Al iniciar la fase |
| 6 | Exportación | Al iniciar la fase, con prueba técnica de [0050](../../preguntas/0050-perfiles-y-concurrencia-exportacion.md) |

La [publicación pendiente del MVP](../../tareas/0142-primera-version-publica.md) sigue en la hoja de ruta.
