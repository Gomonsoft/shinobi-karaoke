# Backlog de Shinobi Karaoke 0.2.0-alfa

Ver el [plan por fases](plan-2.md), la [hoja de ruta](../../roadmap.md) y el [flujo de Git](../../workflow.md).

## Fase 1 · Fin y barrido

| Tarea | Estado | Depende de | Entrega |
|---|---|---|---|
| [0143 · Fin de línea independiente](../../tareas/0143-fin-de-linea-independiente.md) | Hecha | 0091, 0092 | Estado de fin, edición existente y huecos comprobados |
| [0144 · Barrido por renglón visual](../../tareas/0144-barrido-por-renglon-visual.md) | Hecha | 0112 | Geometría real y reparto de progreso |
| [0145 · Verificar fin y barrido en Electron](../../tareas/0145-verificar-fin-y-barrido-en-electron.md) | Hecha | 0143, 0144, 0123 | Regresiones E2E sin red |

0143 y 0144 pueden avanzar en paralelo. La primera trabaja controles de sincronía y modelo de fotograma. La segunda trabaja geometría y pintura de `PantallaLetra`. 0145 integra escenarios en Electron.

## Fase 2 · Línea de tiempo

| Tarea | Estado | Depende de | Entrega |
|---|---|---|---|
| [0146 · Coordenadas y viewport](../../tareas/0146-coordenadas-y-viewport-de-la-linea-de-tiempo.md) | Hecha | Fase 1 | Regiones, límites y transformación de ventana |
| [0147 · Gesto de marcadores](../../tareas/0147-gesto-de-marcadores-y-confirmacion.md) | Hecha | 0146, 0143 | Previsualización y confirmación reversible |
| [0148 · Bucle nativo](../../tareas/0148-bucle-nativo-en-el-motor-de-audio.md) | Hecha | Fase 1 | Motor Web Audio y reloj de bucle |
| [0149 · Integración en Sincronía](../../tareas/0149-integrar-linea-de-tiempo-en-sincronia.md) | Hecha | 0146, 0147, 0148 | Regla, regiones, bucle, zoom y minimapa |
| [0150 · Picos en worker](../../tareas/0150-generar-picos-multinivel-en-worker.md) | Hecha | Fase 1 | PyAV en streaming y pirámide binaria |
| [0151 · Caché e IPC](../../tareas/0151-cache-de-picos-y-contrato-ipc.md) | Hecha | 0150 | Generación, invalidación y lectura validada |
| [0152 · Forma de onda](../../tareas/0152-dibujar-forma-de-onda-y-minimapa.md) | Hecha | 0149, 0151 | Canvas por viewport y estados sin picos |
| [0153 · Verificación](../../tareas/0153-verificar-linea-de-tiempo-bucle-y-picos.md) | Pendiente | 0145, 0149, 0152 | E2E y perfil con una hora de audio |

0146, 0148 y 0150 pueden comenzar en paralelo después de integrar la fase 1. 0147 se apoya en 0146. 0149 es el punto de integración de gestos, reloj y editor. 0151 es la única tarea que modifica contratos IPC compartidos. 0152 puede preparar Canvas y pruebas con un doble una vez acordado ese contrato, y lo integra tras 0149 y 0151. 0153 verifica el conjunto.

## Fases siguientes

| Fase | Alcance | Desglose |
|---|---|---|
| 3 | Temas y agrupación de biblioteca | Al iniciar la fase, con [0047](../../preguntas/0047-temas-asignados-edicion-y-borrado.md) |
| 4 | Ventana secundaria y cola | Al iniciar la fase, con [0048](../../preguntas/0048-escucha-editor-durante-evento.md) y [0049](../../preguntas/0049-politica-cola-de-reproduccion.md) |
| 5 | Degradados, comodines y Letra lista | Al iniciar la fase |
| 6 | Exportación | Al iniciar la fase, con prueba técnica de [0050](../../preguntas/0050-perfiles-y-concurrencia-exportacion.md) |

La [publicación pendiente del MVP](../../tareas/0142-primera-version-publica.md) sigue en la hoja de ruta.
