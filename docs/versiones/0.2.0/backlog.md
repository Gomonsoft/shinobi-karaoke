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
| [0153 · Verificación](../../tareas/0153-verificar-linea-de-tiempo-bucle-y-picos.md) | Hecha | 0145, 0149, 0152 | E2E y perfil con una hora de audio |

0146, 0148 y 0150 pueden comenzar en paralelo después de integrar la fase 1. 0147 se apoya en 0146. 0149 es el punto de integración de gestos, reloj y editor. 0151 es la única tarea que modifica contratos IPC compartidos. 0152 puede preparar Canvas y pruebas con un doble una vez acordado ese contrato, y lo integra tras 0149 y 0151. 0153 verifica el conjunto.

## Subfase 2.1 · Estabilización del editor

| Entrega | Estado | Depende de |
|---|---|---|
| [0154 · Ancho estable de forma de onda y minimapa](../../tareas/0154-ancho-estable-de-forma-de-onda-y-minimapa.md) | Hecha | Fase 2 |
| [Spec de layout adaptable y paneles accesibles](../../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles) | Hecha | Fase 2 |
| [0155 · Preferencia de paneles en config y ventana mínima](../../tareas/0155-preferencia-de-paneles-en-config-y-ventana-minima.md) | Hecha | Spec de subfase |
| [0156 · Modelo puro de distribución](../../tareas/0156-modelo-puro-de-distribucion-del-editor.md) | Hecha | 0155 |
| [0157 · Layout a alto completo](../../tareas/0157-layout-del-editor-a-alto-completo.md) | Hecha | 0154, 0156 |
| [0158 · Transporte en dos filas y panel angosto](../../tareas/0158-transporte-en-dos-filas-y-panel-angosto.md) | Hecha | Spec de subfase |
| [0159 · Divisores y restablecer](../../tareas/0159-divisores-accesibles-y-restablecer-distribucion.md) | Hecha | 0157 |
| [0160 · Modos minimizados](../../tareas/0160-modos-minimizados-con-controles-rapidos.md) | Hecha | 0159 |
| [0161 · Persistencia de la distribución](../../tareas/0161-persistir-la-distribucion-de-paneles.md) | Hecha | 0155, 0160 |
| [0162 · Regresión Electron, capturas e informe](../../tareas/0162-regresion-electron-capturas-e-informe-de-la-subfase-2-1.md) | Hecha | 0154, 0155, 0157–0161 |

El [reporte](reporte-editor-fase-2.md) contiene pasos y criterios. Decisiones de la subfase: revisiones de los ADR [0010](../../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles) (layout y ventana mínima de contenido 1024 × 576) y [0006](../../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--preferencias-de-paneles-del-editor) (`config.editor.paneles`).

0154, 0155 y 0158 pueden avanzar en paralelo porque no comparten archivos. 0154 trabaja en `PistaSincronia`, `PistaOndaVoz`, sus CSS y `editor.spec.ts`. 0155 trabaja en `shared/`, `main/` y `e2e/ventana.spec.ts`. 0158 trabaja en `Transporte`, `PanelSincronia`, `CampoTiempo` y los bloques de transporte y desplazamiento de `editor.module.css`. 0156 solo crea archivos nuevos y puede empezar en cuanto 0155 publique `shared/paneles.ts`. 0157 es el punto de integración: necesita 0154, porque toca el CSS de la pista, y 0156. Crea `e2e/editor-layout.spec.ts` y los ayudantes `e2e/fixtures/editor.ts`. 0159 y 0160 son secuenciales porque ambas reescriben `Editor.tsx`. 0161 puede preparar su hook tras 0155 y lo conecta después de 0160. 0155 es la única tarea que modifica contratos compartidos (`shared/config.ts`, `shared/ipc.ts`, `shared/paneles.ts`). Los E2E de layout no dependen de que haya picos. [Informe de la subfase](informe-fase-2.1.md).

La subfase usa las tareas 0154–0162. La fase 3 empieza tras integrar el PR de esta subfase en `develop`.

## Fases siguientes

| Fase | Alcance | Desglose |
|---|---|---|
| 3 | Temas y agrupación de biblioteca | Tras cerrar 2.1, con [0047](../../preguntas/0047-temas-asignados-edicion-y-borrado.md) |
| 4 | Ventana secundaria y cola | Al iniciar la fase, con [0048](../../preguntas/0048-escucha-editor-durante-evento.md) y [0049](../../preguntas/0049-politica-cola-de-reproduccion.md) |
| 5 | Degradados, comodines y Letra lista | Al iniciar la fase |
| 6 | Exportación | Al iniciar la fase, con prueba técnica de [0050](../../preguntas/0050-perfiles-y-concurrencia-exportacion.md) |

La [publicación pendiente del MVP](../../tareas/0142-primera-version-publica.md) sigue en la hoja de ruta.
