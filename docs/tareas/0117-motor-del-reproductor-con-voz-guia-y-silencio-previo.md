# 0117 — `MotorReproductor`: instrumental + voz guía sincronizados, silencio previo, final y errores; `MotorAudio.liberarAudio()`
- Estado: Hecha
- Paso del pipeline: 6
- Depende de: — (empieza ya; usa `karaoke/reloj.ts` y `karaoke/pistas.ts` de la Fase 5)
- ADRs: 0011 (§3), 0010 (§1: reloj, anclaje, `getOutputTimestamp`)
- Spec UX: docs/ux/07-reproductor.md (§"Datos que usa", §"Inicio y silencio previo", voz guía, estados de error; criterios 1, 6, 7, 9, 12, 15, 16, 22, 23)
- Preguntas: 0030 (usuario: voz guía), 0031 §2–§4 (respondida)
- Archivos:
  - crea `app/src/renderer/src/karaoke/motorReproductor.ts` y `motorReproductor.test.ts`;
  - `app/src/renderer/src/karaoke/motorAudio.ts` y su test: solo el método nuevo `liberarAudio()`.
- Paralelizable con: todas. Antes de 0119 y 0122.

## Contexto para quien implementa
- `MotorAudio` (Fase 5) es el motor del **editor**: una pista sonando cada vez, LRU de 2 buffers, velocidad. **No se cambia su comportamiento**: el reproductor tiene motor propio (ADR 0011 §3).
- Reutiliza:
  - `reloj.ts`: `ctxOidoEn` y `msCancionEn`, con anclaje `{ ctxInicio, posInicioMs, velocidad }`;
  - `pistas.ts`: `urlPista(cancionId, pista)` y `gananciaLineal(db, volumen)`;
  - el patrón de `MotorAudio`: `AudioContext` inyectable, `fetch` inyectable, `ahoraPerf`, suscripción y `destruir()`.
- Las pistas se leen con `fetch('shinobi-media://<id>/<ruta>')`. Si el archivo no existe, el protocolo responde **404** (`main/medios.ts`).
- En Web Audio, dos `AudioBufferSourceNode` con el mismo `start(when, …)` del mismo contexto suenan sincronizados a la muestra.

## Objetivo
Un motor que haga sonar el instrumental y la voz guía a la vez, con ganancias separadas y sincronía exacta. Admite un silencio previo (posiciones negativas), avisa del final y clasifica los errores.

## Criterios de aceptación
- [x] **API**:
  ```ts
  export type ModoAudio = 'karaoke' | 'original'
  export type ErrorPista = 'no_encontrada' | 'lectura' | 'decodificacion'
  export interface OpcionesMotorReproductor {
    cancionId: string; modo: ModoAudio; gananciaDb: number
    volumen: number; silenciado: boolean; volumenVoz: number; vozSilenciada: boolean
    crearContexto?: () => AudioContext; fetch?: typeof fetch; ahoraPerf?: () => number
  }
  export interface EstadoMotorReproductor {
    listo: boolean                 // pista principal decodificada
    cargando: boolean
    sonando: boolean               // también durante el silencio previo
    finalizado: boolean
    duracionMs: number | null      // del buffer principal
    vozDisponible: boolean         // modo karaoke y voz decodificada sin error
    errorPrincipal: { tipo: ErrorPista; detalle: string; ruta: string } | null
    errorVoz: { tipo: ErrorPista; detalle: string; ruta: string } | null
  }
  export class MotorReproductor {
    constructor(o: OpcionesMotorReproductor)
    cargar(): Promise<void>        // decodifica la principal y, en karaoke, la voz en paralelo; resuelve cuando las dos acaban (o la voz falla)
    reproducir(o?: { desdeMs?: number }): Promise<void>   // desdeMs < 0 = silencio previo
    pausar(): void
    buscar(ms: number): void       // acota a [0, duración]; cancela el silencio previo
    posicionMs(): number           // puede ser negativa durante el silencio previo
    fijarVolumen(v: number, silenciado: boolean): void
    fijarVoz(v: number, silenciada: boolean): void
    estado(): EstadoMotorReproductor
    suscribir(cb: (e: EstadoMotorReproductor) => void): () => void
    destruir(): void
  }
  ```
- [x] **Grafo**: principal → `maestra` → `destination`; voz → `gananciaVoz` → `maestra`.
  - `maestra = silenciado ? 0 : gananciaLineal(gananciaDb, volumen)`;
  - `gananciaVoz = vozSilenciada ? 0 : volumenVoz`.
  Cambiar cualquiera de ellas no reinicia las fuentes.
- [x] **Pistas**: en `karaoke`, principal = `instrumental` y voz = `voz`; en `original`, principal = `original` (`fuente/mezcla.flac`) y no hay voz.
- [x] **Sincronía**:
  - `reproducir`, `buscar` (sonando) y la reanudación crean las fuentes y llaman a `start(w, offset)` con el **mismo** `w` para principal y voz;
  - en modo `karaoke`, `listo` solo pasa a `true` cuando la voz también está decodificada o ha fallado (spec 07 §"Voz guía" → "Carga"). Nunca se incorpora la voz en caliente;
  - test con un `AudioContext` falso que registra las llamadas: mismo `when` y *offsets* coherentes con el anclaje.
- [x] **Silencio previo**:
  - `reproducir({ desdeMs: −n })` ancla en `ctxInicio = currentTime` con `posInicioMs = −n` y programa las fuentes en `ctxInicio + n/1000` con *offset* 0;
  - `posicionMs()` sigue la fórmula del reloj (negativa hasta 0);
  - `pausar()` durante el silencio guarda la posición negativa y detiene las fuentes programadas. `reproducir()` sin argumentos reanuda desde ahí (vuelve a programar);
  - `buscar(ms ≥ 0)` lo cancela y suena desde `ms` si estaba sonando.
- [x] **Final**: cuando la fuente principal termina de forma natural (no por `stop()` propio), `sonando = false`, `finalizado = true` y `posicionMs() = duración`. `reproducir` y `buscar` ponen `finalizado = false`. `reproducir()` con la posición en el final empieza desde 0, sin silencio previo (el reproductor decide si lo pide).
- [x] **Errores**:
  - respuesta 404 → `no_encontrada`;
  - otra respuesta no `ok` o error de `fetch` → `lectura`;
  - `decodeAudioData` rechaza → `decodificacion`.
  `detalle` lleva `HTTP <estado>` o el mensaje del error, sin rutas absolutas; `ruta` es la relativa (`pistas/instrumental.flac`). Un error de la voz **no** impide sonar: `vozDisponible = false` y `errorVoz` relleno.
- [x] **Precisión**: tests con marcas simuladas como los de 0094. `posicionMs()` está a ≤ 20 ms de la posición real en el anclaje inicial, tras buscar, tras pausar y reanudar y al pasar de negativo a positivo, con `getOutputTimestamp` y sin él.
- [x] `destruir()`: para las fuentes, cierra el contexto y aborta las cargas en curso. Es idempotente.
- [x] **`MotorAudio.liberarAudio()`** (editor): pausa, aborta la carga en curso y vacía los buffers. Conserva `pista`, `velocidad` y la posición (`posicionEnPausa`). El siguiente `usarPista`/`reproducir` vuelve a cargar. Test: tras liberar, `usarPista(pistaActual)` vuelve a hacer `fetch`, y `posicionMs()` conserva el valor anterior. Ningún test del editor cambia.

## Verificación
```bash
cd app && npm run lint && npm run typecheck && npm run format:check && npm test
```

## Notas de implementación
- `karaoke/motorReproductor.ts` carga el instrumental y la voz en paralelo y los programa sobre el mismo reloj. El modo original carga solo la mezcla. La posición audible admite tiempo negativo durante el silencio previo.
- El fin natural lo determina la pista principal. Los fallos de voz permiten seguir cantando con el instrumental. Los detalles copiados usan rutas relativas y omiten el mensaje original cuando contiene una ruta absoluta.
- `MotorAudio.liberarAudio()` descarta los buffers y aborta las cargas. Mantiene la pista, la velocidad, la posición y la duración conocida para poder buscar antes de recargar.
- ESLint dirigido y 21 pruebas Vitest de los dos motores en verde. Pendiente la verificación completa de la app.
