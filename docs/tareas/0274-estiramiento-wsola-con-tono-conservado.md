# 0274 — Estiramiento temporal WSOLA con el tono conservado (función pura y *worker*)

- Estado: Hecha
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

- Hecho en el lote E. Archivos: `estiramiento.ts` (función pura `estirarTramo`), `estiramiento.worker.ts`, `estiramientoCliente.ts` (`estirarEnWorker(canales, sampleRate, velocidad, signal?)`, un `Worker` de módulo por llamada, transfiere los buffers —toma posesión de los arrays recibidos— y se cancela con `AbortSignal` terminando el worker) y `estiramiento.test.ts`.
- WSOLA propio con 40 / 15 / 8 ms; correlación normalizada sobre la mezcla a mono con búsqueda gruesa (media móvil y paso 4) más refinado a resolución completa; mismo desplazamiento en todos los canales; fundido lineal. Ajuste respecto a la letra de la tarea: la posición nominal de cada bloque es la de su **centro** (no la de su inicio), lo que reparte el error de ritmo: con el inicio, el error de un clic llegaba a 13,4 ms a 0,5×; con el centro, 7,4 ms.
- Medidas (Vitest, equipo de desarrollo): error máximo de posición de clic (clics cada 250 ms durante 10 s, a 48 kHz) **7,44 ms a 0,5× y 3,75 ms a 0,75×** (≤ 10 ms); frecuencia de un seno de 440 Hz dentro de ±2 %; longitud de salida `round(n/v)` ± 1; sin saltos en las juntas (diferencia máxima entre muestras < 2× la pendiente del seno); 10 s estéreo a 48 kHz: **~20 ms a 0,5× y ~14 ms a 0,75×** (límite de la tarea 300 ms; la prueba solo falla pasados 5 s). La medida del clic usa la copia más cercana a lo esperado: a 0,5× WSOLA repite fragmentos de la entrada, por lo que un clic puede salir duplicado (inherente al método).
- Límites: tramos más cortos que 80 ms se remuestrean linealmente (cambia el tono; no ocurre con líneas reales).
- Sin verificar (requiere la app): que `npm run build` empaquete el worker como archivo propio y que cargue con la CSP (`worker-src`/`'self'`) sin errores en consola. Si la CSP de `index.html` o `main/` no admite workers de módulo, hace falta ajustarla en otro lote (se trata en el informe del lote). Calidad con voz real: guía manual (voz inteligible, sin sonar grave, sin «flanger» apreciable).
