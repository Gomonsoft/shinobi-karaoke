# 0148 — Bucle nativo en el motor de audio

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: Fase 1 integrada en develop
- ADRs: [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor](../ux/06-editor.md), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Fase 2](../versiones/0.2.0/plan-2.md#fase-2--línea-de-tiempo)

## Objetivo

Escuchar un intervalo válido de forma repetida con el mismo reloj audible del editor.

## Archivos y contrato

Trabajar en `app/src/renderer/src/karaoke/motorAudio.ts`, `reloj.ts` y pruebas. Aceptar límites en tiempo de audio y acotarlos al buffer activo. Usar bucle de fuente nativo y posición por fase derivada de `getOutputTimestamp()`, conservando el recorrido inicial hasta la primera vuelta. Un nuevo intervalo conserva el cabezal si está dentro y reancla al inicio si quedó fuera. Tener en cuenta el quantum y la diferencia entre tiempo de render y tiempo de salida. Mantener la escucha puntual con `hastaMs` independiente. Exponer un contrato que permita a 0149 activar, actualizar y limpiar el bucle sin gestionar nodos desde React.

## Criterios de aceptación

- [ ] Pruebas de primera vuelta, límites exactos, varias vueltas y velocidades 0,5×, 0,75× y 1×.
- [ ] Cambiar límites, pista y velocidad, pausar, buscar y reanudar preserva la fase o reancla según el intervalo.
- [ ] No hay bucle con intervalo vacío o sin audio disponible. Un callback obsoleto o un await de reproducción anterior no reactiva la fuente.
- [ ] Liberar o destruir el motor cancela reproducción y bucle. La escucha puntual, audio sin bucle y el reloj anterior conservan sus contratos.
- [ ] El núcleo no depende de timers del renderer. 0153 verifica el comportamiento en Chromium con audio generado.

## Verificación

Desde `app/`, `npm test -- src/renderer/src/karaoke/motorAudio.test.ts src/renderer/src/karaoke/reloj.test.ts` y `npm run typecheck`.

## Notas de implementación

Pendientes.
