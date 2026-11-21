# 0149 — Integrar línea de tiempo en Sincronía

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0146](0146-coordenadas-y-viewport-de-la-linea-de-tiempo.md), [0147](0147-gesto-de-marcadores-y-confirmacion.md), [0148](0148-bucle-nativo-en-el-motor-de-audio.md)
- ADRs: [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor](../ux/06-editor.md), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Fase 2](../versiones/0.2.0/plan-2.md#fase-2--línea-de-tiempo)

## Objetivo

Integrar regiones, marcadores, zoom, minimapa y bucle sin perder los puntos de entrada del editor.

## Archivos y contrato

Añadir el componente de timeline bajo el transporte de Sincronía. Cablear `Editor.tsx`, `PanelSincronia.tsx`, `useAtajosEditor.ts` y textos/capas existentes según la spec. Regla para buscar, pista para seleccionar y tiradores para editar con captura. Integrar la sesión de gesto y la actualización de límites en el motor. El cabezal usa el reloj existente y su repintado queda separado del viewport. Reservar superficie de onda y minimapa para 0152. Mantener transiciones de «Probar», escucha puntual, sincronización al ritmo y guardado del editor.

## Criterios de aceptación

- [x] Conservar los campos y atajos acordados. Retirar los botones de pasos únicamente al ofrecer tiradores operables por teclado con nombre, tiempo, flechas ±10 ms y Mayús ±100 ms.
- [x] «Bloquear enunciado» empieza en la línea seleccionada, adapta límites durante el gesto y pausa con Espacio. Desactivar o cambiar selección restaura la posición anterior en pausa. Buscar fuera desactiva y busca el destino solicitado.
- [x] Escape cancela primero el gesto, después desarma el bucle según la precedencia de campos y capas. Cambio de selección, sincronización al ritmo o Probar a pantalla completa termina el bucle.
- [x] «Escuchar al ajustar» actúa una vez por confirmación fuera del bucle. Un intervalo inaudible muestra el motivo de indisponibilidad. Si aparece provisionalmente durante un gesto, el audio se pausa sin desarmar. Recuperar un intervalo audible o cancelar recupera el estado anterior. Confirmar desarma y restaura la posición previa en pausa.
- [x] Zoom, paneo y minimapa mantienen selección, cabezal y audio. Hay controles sin rueda, foco visible y layout operativo a 1024×640 con zoom de interfaz de 150 %.

## Verificación

Desde `app/`, `npm test -- src/renderer/src/vistas/editor src/renderer/src/karaoke`, `npm run lint` y `npm run typecheck`.

## Notas de implementación

- `PistaSincronia.tsx` añade la regla local, selección de regiones, tiradores con captura y teclado, zoom y vista general. El cabezal sigue la posición audible del motor en una capa independiente. Las ranuras `onda` y `ondaGeneral` se cablean en 0152.
- `Editor.tsx` conecta la previsualización temporal, el guardado en una sola acción y los límites del bucle. Conserva los campos y atajos de Inicio y Fin. Escape cancela el arrastre antes del bucle y buscar fuera conserva el destino.
- `Editor.test.tsx` verifica selección sin búsqueda, teclado, zoom y paneo sin mover el cabezal, Escape y destino de búsqueda, además de cancelar y confirmar un fin provisional fuera de pista.
- Pasaron lint, TypeScript y 169 pruebas dirigidas de editor y karaoke. La verificación de layout y el reloj con audio real en Chromium se cubren en 0153.
