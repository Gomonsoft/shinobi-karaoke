# 0152 — Dibujar forma de onda y minimapa

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: [0149](0149-integrar-linea-de-tiempo-en-sincronia.md), [0151](0151-cache-de-picos-y-contrato-ipc.md)
- ADRs: [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor](../ux/06-editor.md), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Fase 2](../versiones/0.2.0/plan-2.md#fase-2--línea-de-tiempo)

## Objetivo

Pintar los picos vocales adecuados al zoom y mantener operable la línea de tiempo sin datos.

## Archivos y contrato

Añadir vista Canvas bajo la regla de Sincronía e integrar el contrato IPC de 0151. Solicitar porción visible y vista general con presupuesto proporcional a su ancho y acotado a 4096 bloques. Consolidar solicitudes de paneo/zoom y descartar respuestas de viewport o generación obsoletos. Dibujar min y máx con la misma transformación temporal que las regiones, ajustando dimensiones al dispositivo. Actualizar por datos, viewport, escala o tamaño. Pintar cabezal por separado. Usar el estado de separación existente para disponibilidad y actualizar al publicar nueva voz.

## Criterios de aceptación

- [ ] Se muestra «Forma de onda de la voz», con carga, indisponibilidad y reintento según la spec.
- [ ] La regla, regiones y minimapa siguen funcionando sin picos. El minimapa añade onda general cuando se dispone de ella.
- [ ] Cambiar zoom/ventana adapta nivel, redibujar no lee ni decodifica la pista entera y el cabezal no vuelve a dibujar la onda por fotograma.
- [ ] Re-separar invalida datos anteriores. Navegar, cambiar viewport rápidamente o cerrar editor ignora respuestas tardías.
- [ ] El doble IPC reproduce estados y los tests prueban selección de ventana, resultados obsoletos y fallback.

## Verificación

Desde `app/`, `npm test -- src/renderer/src/vistas/editor`, `npm run lint` y `npm run typecheck`.

## Notas de implementación

Pendientes.
