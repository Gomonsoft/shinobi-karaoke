# 0094 — Interfaz: reloj de pulsaciones y motor de audio (Web Audio) compartido por editor y reproductor
- Estado: Hecha
- Paso del pipeline: 4 (y 6, que lo reutiliza)
- Depende de: — (**puede empezar ya**)
- ADRs: 0010 (§1, toda la sección), 0005 (precisión ≤ 20 ms, velocidad con `playbackRate`), 0008 (`shinobi-media://`, CSP `connect-src shinobi-media:`)
- Spec UX: docs/ux/06-editor.md ("Transporte y audio", criterios 4 y 5), arquitectura.md §7
- Archivos: crea `app/src/renderer/src/karaoke/reloj.ts`, `reloj.test.ts`, `motorAudio.ts`, `motorAudio.test.ts`, `useMotorAudio.ts` y `pistas.ts`. En main, `app/src/main/index.ts` (**archivo compartido**, solo 3–5 líneas: silenciar la ventana en E2E).
- Pregunta: `preguntas/0025` §5, §6 y §8 (respondida): sin *spike* de `preservesPitch`, pistas bajo demanda con LRU de 2 y volumen compartido con el reproductor.
- Paralelizable con: 0090–0093, 0095–0102.

## Contexto para quien implementa
- El audio de una canción se sirve por el protocolo propio `shinobi-media://<id>/<ruta>` y solo admite 3 rutas de audio: `fuente/mezcla.flac` (pista "Original"), `pistas/voz.flac` y `pistas/instrumental.flac`. Son FLAC de 16 bits, 44,1 kHz, estéreo. La CSP del renderer ya permite `fetch` a `shinobi-media:` y el main responde con CORS exacto. La vista de Progreso (0069, `vistas/progreso/Escucha.tsx`) usa `<audio>` y no sirve aquí: hace falta un reloj exacto.
- `cancion.fuente.ganancia_db` es la ganancia de normalización de sonoridad, que se aplica al reproducir (las tres pistas salen de la misma mezcla).
- jsdom no tiene Web Audio: el motor recibe una **fábrica de `AudioContext` inyectable** y `fetch` inyectable, y los tests usan dobles.

## Objetivo
Reproducir cualquiera de las tres pistas con velocidad 0,5×/0,75×/1×, volumen, búsqueda y cambio de pista sin perder la posición, y convertir el `timeStamp` de un evento de teclado en el tiempo de canción que se oía en ese instante, con un error ≤ 20 ms (salida por cable o altavoces).

## Criterios de aceptación
- [x] **`reloj.ts`** (puro, sin DOM):
  ```ts
  export interface Anclaje { ctxInicio: number /* s */; posInicioMs: number; velocidad: number }
  export interface MarcaSalida { contextTime: number /* s */; performanceTime: number /* ms */ }
  export interface Ahora { ctx: number /* s, currentTime */; perf: number /* ms, performance.now() */ }
  /** Tiempo del AudioContext que sonaba por la salida en el instante `perfMs` (escala de performance.now). */
  export function ctxOidoEn(perfMs: number, marca: MarcaSalida | null, ahora: Ahora, latenciaSalidaS: number): number
  export function msCancionEn(ctxS: number, anclaje: Anclaje): number
  export function reanclar(anclaje: Anclaje, ctxAhora: number, velocidadNueva: number): Anclaje
  ```
  - Con `marca` y `marca.performanceTime > 0`: `marca.contextTime + (perfMs − marca.performanceTime) / 1000`, **sin restar latencia**.
  - Si no: `ahora.ctx − (ahora.perf − perfMs) / 1000 − latenciaSalidaS`.
  - `msCancionEn = posInicioMs + (ctxS − ctxInicio) × 1000 × velocidad`.
- [x] **Test de precisión** (`reloj.test.ts`; criterio 5 de `ux/06`). Simula un `AudioContext` ideal:
  - latencia de salida de 40 ms, `getOutputTimestamp` coherente y un evento de teclado en un instante conocido;
  - recorre 0,5×, 0,75× y 1×, cada una con `marca` y sin `marca` (en ese caso, con la latencia), y con reanclajes previos (cambio de velocidad y *seek*);
  - en todos los casos, |msCancion calculado − ms reales del audio en ese instante| ≤ 20 ms;
  - incluye un caso con `getOutputTimestamp` devolviendo `{ contextTime: 0, performanceTime: 0 }` (navegador sin marca), que debe usar el camino de respaldo.
- [x] **`pistas.ts`**:
  - `type Pista = 'original' | 'voz' | 'instrumental'`;
  - `urlPista(cancionId, pista)` → `shinobi-media://<id>/fuente/mezcla.flac` o `…/pistas/voz.flac` / `…/pistas/instrumental.flac`;
  - `gananciaLineal(gananciaDb, volumen)` = `10 ** (gananciaDb / 20) × volumen`.
- [x] **`motorAudio.ts`**: clase `MotorAudio`:
  ```ts
  export interface OpcionesMotor { cancionId: string; gananciaDb: number; volumen: number
    crearContexto?: () => AudioContext; fetch?: typeof fetch; ahoraPerf?: () => number; maxBuffers?: number /* 2 */ }
  export interface EstadoMotor { pista: Pista; cargandoPista: Pista | null; cargando: boolean; error: 'carga' | 'decodificacion' | null
    sonando: boolean; velocidad: 0.5 | 0.75 | 1; duracionMs: number | null; volumen: number }
  class MotorAudio {
    constructor(o: OpcionesMotor)
    usarPista(p: Pista): Promise<void>            // descarga+decodifica si falta; mientras tanto SIGUE SONANDO la anterior; al estar lista cambia conservando posición y estado
    pistaCargando(): Pista | null                 // la que se está preparando (spinner en su opción, ux/06)
    reproducir(opciones?: { desdeMs?: number; hastaMs?: number }): Promise<void> // hastaMs: para la escucha de comprobación
    pausar(): void
    buscar(ms: number): void                      // acota a [0, duración]
    fijarVelocidad(v: 0.5 | 0.75 | 1): void        // reancla; cambia playbackRate
    fijarVolumen(v: number): void                 // 0..1
    posicionMs(): number                          // tiempo de canción que SE OYE ahora (para la interfaz)
    tiempoDeEvento(timeStampMs: number): number | null // null si no está sonando
    estado(): EstadoMotor
    suscribir(cb: (e: EstadoMotor) => void): () => void
    destruir(): void                              // para la fuente y cierra el contexto
  }
  ```
  - Descarga con `fetch(url)` → `arrayBuffer()` → `ctx.decodeAudioData`. Un error de red da `error: 'carga'` y uno de decodificación `error: 'decodificacion'`; no lanza hacia fuera.
  - `cargando` es `true` solo mientras no hay **ninguna** pista lista; mientras tanto la interfaz muestra "Cargando audio…". Al cambiar de pista, `cargandoPista` indica cuál se prepara y la anterior sigue sonando. Si la carga se anula (otra `usarPista` o `destruir`), no se aplica.
  - Caché LRU de `maxBuffers` (2) `AudioBuffer`.
  - Reproducción con un `AudioBufferSourceNode` nuevo por arranque, conectado a un `GainNode` con `gananciaLineal`. Para buscar o cambiar de pista sonando, se para y se arranca una fuente nueva con el anclaje nuevo.
  - Al llegar al final, `sonando: false` y posición = duración.
  - `ctx.resume()` antes del primer `start`.
  - `hastaMs` programa la parada (`source.stop(when)`), y entonces `sonando` pasa a `false` con la posición en `hastaMs`.
  - `posicionMs()` usa `ctxOidoEn(performance.now(), ctx.getOutputTimestamp?.() ?? null, …)`. En pausa devuelve la posición guardada.
  - `tiempoDeEvento(ts)` usa la misma función con el `timeStamp` del evento.
- [x] **`useMotorAudio(opciones)`**: crea el motor al montar y lo destruye al desmontar. El volumen inicial lo da quien llama: la vista usa `config.reproductor.volumen`/`silenciado`, compartido con el reproductor; expone `{ motor, estado }` (re-render solo en cambios de `EstadoMotor`, nunca por fotograma).
- [x] Tests de `motorAudio.test.ts` con un doble de `AudioContext` (sin dependencias nuevas):
  - cambio de pista con la posición conservada, mientras la anterior sigue sonando durante la carga;
  - LRU (carga la tercera y descarta la menos usada);
  - error de carga y de decodificación;
  - `hastaMs`;
  - velocidad que reancla;
  - `destruir` cancela una carga en curso;
  - volumen y ganancia aplicados al `GainNode`.
- [x] **Silenciar en E2E**: en `main/index.ts`, al crear la ventana, si `!app.isPackaged && process.env.SHINOBI_SILENCIAR_AUDIO === '1'` → `ventana.webContents.setAudioMuted(true)`. Con un comentario que cite 0094 y ADR 0010. Se ignora empaquetada, como el resto de las variables `SHINOBI_*` de pruebas.
- [x] Nada en este módulo importa `window.shinobi`: solo URLs `shinobi-media://`.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/karaoke
```
La prueba real con audio queda para el E2E (0110) y la prueba manual (0111).

## Notas de implementación
- `karaoke/reloj.ts` calcula la posición audible con la marca de salida o con las latencias como respaldo. Las pruebas simulan cambios de anclaje, búsquedas y las tres velocidades.
- `MotorAudio` carga FLAC bajo demanda, conserva hasta dos buffers, mantiene la posición al cambiar de pista y admite reproducción de fragmentos. `useMotorAudio` vincula su ciclo de vida al de la vista.
- La variable `SHINOBI_SILENCIAR_AUDIO` se aplica solo sin empaquetar. La escucha y precisión en hardware quedan para 0110 y 0111.
- Pasaron lint, TypeScript, formato, Vitest (1560 pasadas, 12 omitidas), build y Playwright (69 pasadas, 2 omitidas).
