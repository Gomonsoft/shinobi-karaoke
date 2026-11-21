# 0274 — Estiramiento temporal WSOLA con el tono conservado (función pura y *worker*)

- Estado: Pendiente
- Paso del pipeline: 4 (editor, motor de audio)
- Fase: 9 de 0.2.1 · Lote E (motor de audio), primera del lote
- Depende de: —
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §9 «Velocidad» y §Alternativas 3; [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-021--fases-8-y-9); [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md) (CSP: sin WASM)
- Spec UX: [06 · Fase 9, «Contenido»](../ux/06-editor.md#contenido), fila «Velocidad» (la nota `edi.preciso.tono` solo si el tono no se conserva); criterio **P9** (parte de motor) y **P7** (precisión)
- Tamaño: M

## Objetivo

Preparar un tramo de audio estirado (más lento) sin cambiar el tono, como función pura probable en Vitest, y un *worker* que la ejecute fuera del hilo de la interfaz.

## Archivos (solo estos)

- `app/src/renderer/src/karaoke/estiramiento.ts` (nuevo) y `estiramiento.test.ts` (nuevo)
- `app/src/renderer/src/karaoke/estiramiento.worker.ts` (nuevo) y un cliente mínimo `estirarEnWorker(...)` en el mismo módulo o en `estiramientoCliente.ts`

## Contrato

- `estirarTramo(canales: Float32Array[], sampleRate: number, velocidad: 0.5 | 0.75): Float32Array[]` — WSOLA: secuencia 40 ms, ventana de búsqueda 15 ms, solapamiento 8 ms (parámetros de SoundTouch para voz), correlación sobre la mezcla a mono, mismo desplazamiento aplicado a todos los canales, *crossfade* lineal en el solapamiento. Salida de longitud `round(n / velocidad)` ± 1 muestra. Sin dependencias nuevas.
- `estirarEnWorker` usa `new Worker(new URL('./estiramiento.worker.ts', import.meta.url), { type: 'module' })` con transferencia de los `ArrayBuffer`; devuelve una promesa cancelable (`AbortSignal`).

## Criterios de aceptación

- [ ] **Precisión** (la condición de la decisión): con una pista sintética de clics cada 250 ms durante 10 s, estirada a 0,5× y 0,75×, la posición de cada clic en la salida dividida por `1/velocidad` difiere ≤ 10 ms de la original (prueba Vitest).
- [ ] **Tono**: un seno de 440 Hz estirado mantiene su frecuencia dominante a ± 2 % (cruces por cero o autocorrelación).
- [ ] Duración: un tramo de 10 s estéreo a 48 kHz se procesa en < 300 ms en el equipo de desarrollo (medido en la prueba e informado en las notas; no falla en el CI por tiempo).
- [ ] El *build* (`npm run build`) empaqueta el *worker* como archivo propio servido desde `'self'`, sin tocar la CSP. Comprobarlo cargando la vista del editor en `npm run dev` o en una E2E existente sin errores de CSP en la consola.
- [ ] Si la precisión no llega, la tarea se cierra **sin** integrar (0275 usa entonces `playbackRate` y la nota de la spec) y lo anota: es el respaldo de la decisión.

## Pruebas de feedback

- Unitarias: `estiramiento.test.ts` (precisión, tono, longitud, silencio, un solo canal y estéreo).
- E2E: ninguna.
- Críticos: no (no toca el flujo principal).
- Manual: guía de la fase 9 — escuchar una línea de voz a 0,5× y 0,75× en la ventana: la voz se entiende y no suena grave.

## Notas de implementación
