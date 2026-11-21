# 0275 — `MotorAudio`: tramo con tono conservado para el editor preciso

- Estado: Hecha
- Paso del pipeline: 4 (editor, motor de audio)
- Fase: 9 de 0.2.1 · Lote E (motor de audio)
- Depende de: 0274
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §9; [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md) §1 (reloj) y revisión para 0.2.1; [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md) (bucle nativo)
- Spec UX: [06 · Fase 9, «Contenido»](../ux/06-editor.md#contenido) (filas «Bucle de la línea», «▶ Palabra», «Velocidad»); criterios **P7** (≤ 20 ms a 0,5×, 0,75× y 1×) y **P9**
- Tamaño: M

## Objetivo

Que, con la ventana del editor preciso abierta y una velocidad < 1×, el bucle de la línea y la escucha de una palabra conserven el tono, sin crear otro reloj.

## Archivos (solo estos)

- `app/src/renderer/src/karaoke/motorAudio.ts`, `reloj.ts` (solo si hace falta un ayudante puro) y `motorAudio.test.ts`

## Criterios de aceptación

- [ ] `fijarTramoConTono(intervalo: IntervaloBucle | null)` en tiempo de audio. Con tramo y velocidad < 1×, una reproducción que empieza y termina dentro del tramo (bucle armado dentro de él o `hastaMs` dentro de él) usa el buffer estirado: `playbackRate = 1`, desplazamiento de inicio `(desde − tramo.inicio) / velocidad`, `loopStart`/`loopEnd` o `stop` convertidos igual, y el anclaje con la `velocidad` elegida. Fuera de esas condiciones, `playbackRate` como hoy.
- [ ] La posición (`posicionMs`, `tiempoDeEvento`) sigue la fórmula de siempre: con marcas simuladas a 0,5× y 0,75×, el error es ≤ 20 ms con y sin tramo estirado (P7), y la posición se envuelve en el bucle igual que con `playbackRate`.
- [ ] Caché de un buffer estirado por `(pista, tramo, velocidad)`; se descarta al cambiar cualquiera, con `fijarTramoConTono(null)`, `liberarAudio()` y `destruir()`. Mientras se prepara, suena con `playbackRate` y cambia al estirado en el siguiente paso por el inicio del bucle.
- [ ] Si el estiramiento falla (o 0274 se cerró sin integrar), se queda con `playbackRate`, lo anota en el registro del renderer y `estado()` expone `tonoConservado: boolean` para que la ventana muestre `edi.preciso.tono` solo cuando es `false` con velocidad < 1×.
- [ ] El transporte, «Sincronizar al ritmo» y el doble clic se comportan como hoy (las pruebas existentes del motor pasan sin cambios).

## Pruebas de feedback

- Unitarias: `motorAudio.test.ts` con un `AudioContext` doble: conversión de desplazamientos y límites, reloj con tramo estirado, bucle con fase, caché e invalidación, fallo del estiramiento.
- E2E: ninguna (la cubre 0280).
- Críticos: no (no cambia el comportamiento fuera de la ventana; si `test:cambios` arrastra pruebas del editor, ejecutar los críticos).
- Manual: guía de la fase 9 — a 0,5×, la primera vuelta puede sonar grave y las siguientes no.

## Notas de implementación

- Hecho en el lote E. Archivo: `motorAudio.ts` (+ pruebas en `motorAudio.test.ts`); `reloj.ts` no cambia (la fórmula del reloj es la de siempre).
- API nueva: `fijarTramoConTono(intervalo: IntervaloBucle | null): void` (tiempo de audio); `EstadoMotor.tonoConservado: boolean` (`true` salvo que el estiramiento del tramo y velocidad actuales haya fallado; la ventana muestra `edi.preciso.tono` solo con `tonoConservado === false` y velocidad < 1×); opción de constructor `estirar?` (inyectable en pruebas; por defecto `estirarEnWorker`).
- Comportamiento: caché de un buffer estirado por (buffer de la pista, tramo alineado a muestra, velocidad); se prepara al fijar tramo, velocidad < 1× o pista y se descarta al cambiar cualquiera, con `fijarTramoConTono(null)`, `liberarAudio()` y `destruir()`. Una reproducción (bucle o `hastaMs`) que empieza y termina dentro del tramo usa el buffer estirado con `playbackRate = 1`, desplazamientos, `loopStart`/`loopEnd` y movimiento del bucle convertidos con `(t − inicioTramo) / velocidad`; el anclaje conserva la velocidad elegida. Mientras se prepara suena con `playbackRate`; al estar listo y si suena un bucle dentro del tramo, relevo programado en el siguiente paso por el inicio del bucle (fuente nueva arranca a `ctxCambio` y la vieja se detiene ahí; tramo nuevo de anclaje). Si cambian los límites del bucle con un relevo pendiente o el estirado no cubre los nuevos, se reinicia la fuente en la posición audible (no se puede deshacer un `start` programado). Si el estiramiento falla o devuelve una duración distinta de `round(n/v)` ± 1: `console.warn` (registro del renderer) y `tonoConservado = false`; no se reintenta la misma clave.
- Pruebas: 6 nuevas con un `AudioContext` doble (límites y desplazamientos, reloj con tramo estirado a 0,5× y 0,75×/envoltura del bucle, relevo, mover el bucle, caché e invalidación, fallo); las 12 anteriores pasan sin cambios.
- Deuda: dos fixtures ajenos (`vistas/editor/escuchaComprobacion.test.ts`, `useSincronizarAlRitmo.test.ts`) construyen `EstadoMotor` literal y necesitan `tonoConservado: true` (lo exige el typecheck). Manual: a 0,5× la primera vuelta puede sonar grave y las siguientes no.
