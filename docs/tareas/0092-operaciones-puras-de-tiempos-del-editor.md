# 0092 — Dominio: operaciones puras de tiempos del editor (`shared/letras/tiempos.ts`)
- Estado: Hecha
- Paso del pipeline: 4
- Depende de: — (usa `shared/letra.ts`, ya hecho). **Puede empezar ya.**
- ADRs: 0010 (§1 "Tiempo de letra", §2 rango del desplazamiento, §3), 0006 (invariantes, `moverInicioLinea`, `borrarTiemposLinea`), 0005 (`finEfectivo`)
- Spec UX: docs/ux/06-editor.md ("Datos que usa", "Reglas de una marca en t", "Fin automático", "Ajuste fino", "Desplazamiento de toda la letra"; criterios 5, 6, 13–15, 20–26)
- Pregunta: `preguntas/0025` §2 y §3 (respondida)
- Archivos: crea `app/src/shared/letras/tiempos.ts` y `app/src/shared/letras/tiempos.test.ts`; añade `export * from './tiempos'` en `app/src/shared/letras/index.ts`. Si `OFFSET_MAXIMO_MS` y `GuardarTiempos` (0090) aún no existen, usa una constante local `30_000` y un tipo local equivalente con `TODO(0090)`, y al terminar 0090 los sustituye. **No toca archivos compartidos de IPC.**
- Paralelizable con: 0090, 0091, 0094–0102.

## Contexto para quien implementa
Ya existen en `app/src/shared/letra.ts` (léelo entero):
- `Letra = { origen, lrclib_id, offset_ms, lineas: ElementoLetra[] }`, con `ElementoLetra = { id, tipo: 'linea'|'pausa', texto, inicio_ms: number|null, fin_ms: number|null, palabras: Palabra[]|null }`;
- `moverInicioLinea(letra, id, nuevoInicioMs)`:
  - lanza `RangeError` si el id no existe, no es una línea, o si el nuevo inicio no es un entero ≥ 0 **estrictamente** entre los inicios del elemento anterior y del siguiente con inicio (las pausas con tiempo cuentan);
  - admite una línea sin inicio;
  - desplaza las palabras el mismo delta y las descarta si no caben;
  - anula los fines fijados que dejan de ser válidos;
  - devuelve `{ letra, palabrasDescartadas, finesAutomaticos }`;
- `borrarTiemposLinea(letra, id)`: pone a `null` inicio, fin y palabras;
- `finEfectivo(letra, id, duracionMs)`: fin automático o fijado, o `null` si no hay inicio;
- `validarInvariantesLetra(lineas)`: debe quedar vacío tras cualquier operación de esta tarea.

**Tiempo guardado y tiempo mostrado** (`ux/06` "Datos que usa"):
- tiempo mostrado = `inicio_ms + offset_ms`, con mínimo 0;
- marcar o fijar en la posición `t` del audio guarda `t − offset_ms`, con mínimo 0;
- un desplazamiento de +250 ms hace que la letra salga 250 ms más tarde.

Las funciones de esta tarea trabajan con **tiempo guardado** (de letra) salvo las de conversión y formato.

## Objetivo
Toda la lógica de edición de tiempos del editor en funciones puras, sin DOM ni audio, que respeten los invariantes del ADR 0006. La usan el *reducer* (0093) y la vista (0105–0107).

## Criterios de aceptación
- [x] API exportada (nombres y firmas exactos):
  ```ts
  export type Limite =
    | { tipo: 'inicio_anterior' | 'inicio_siguiente'; vecino: 'linea' | 'pausa' }
    | { tipo: 'fin_antes_del_inicio' | 'fin_siguiente' }
    | { tipo: 'desplazamiento' }
    | { tipo: 'demasiado_pronto' }                                // marca ≤ anterior (edi.sync.pronto)
  export interface ResultadoTiempos {
    letra: Letra; cambiado: boolean; limite: Limite | null
    palabrasDescartadas: string[]; finesAutomaticos: string[]      // de moverInicioLinea (toasts edi.toast.palabras / finauto)
  }
  export const tiempoMostrado = (inicioMs: number, offsetMs: number): number      // máx(0, inicio + offset)
  export const tiempoGuardado = (msAudio: number, offsetMs: number): number       // máx(0, round(ms − offset))
  export function limitesInicio(letra: Letra, id: string): { min: number; max: number | null; vecinoAnterior: 'linea'|'pausa'|null; vecinoSiguiente: 'linea'|'pausa'|null }
  export function ajustarInicio(letra: Letra, id: string, deltaMs: number): ResultadoTiempos
  export function fijarInicio(letra: Letra, id: string, msGuardado: number): ResultadoTiempos
  export function ajustarFin(letra: Letra, id: string, deltaMs: number, duracionMs: number): ResultadoTiempos
  export function fijarFin(letra: Letra, id: string, msGuardado: number, duracionMs: number): ResultadoTiempos
  export function usarFinAutomatico(letra: Letra, id: string): ResultadoTiempos
  export function borrarTiempos(letra: Letra, id: string): ResultadoTiempos
  export function marcarInicioLinea(letra: Letra, id: string, msGuardado: number): ResultadoTiempos & { borrados: string[] }
  export function fijarDesplazamiento(letra: Letra, offsetMs: number): ResultadoTiempos      // acota a ±OFFSET_MAXIMO_MS
  export function desplazar(letra: Letra, deltaMs: number): ResultadoTiempos
  export function indiceLineaActual(letra: Letra, tAudioMs: number): number
  export function lineaVecina(letra: Letra, id: string | null, sentido: -1 | 1): string | null
  export function primeraSinInicio(letra: Letra): string | null
  export function contador(letra: Letra): { sincronizadas: number; total: number }
  export function numeroDeLinea(letra: Letra, id: string): number   // 1..total, solo líneas
  export function aPeticionTiempos(cancionId: string, letra: Letra): GuardarTiempos
  export function formatearTiempo(ms: number | null): string        // mm:ss.cc
  export function interpretarTiempo(texto: string): number | null   // "mm:ss.cc" | "m:ss" | "mm:ss.c" → ms; otro → null
  export function formatearDesplazamiento(ms: number): string       // "+0,25 s"
  export function interpretarDesplazamiento(texto: string): number | null // "+0,25", "-1,5", "0.3" (punto o coma), en s → ms
  ```
- [x] **Reglas**:
  - `limitesInicio`:
    - `min` = inicio del elemento anterior con inicio + 1 (0 si no hay); `max` = inicio del siguiente con inicio − 1 (`null` si no hay);
    - `vecino*` es el tipo de ese elemento, para que el tooltip diga "línea" o "pausa";
    - lanza `RangeError` si el id no es una línea.
  - `ajustarInicio`:
    - con la línea sin inicio → sin cambio;
    - si no, `nuevo = inicio + delta` acotado a `[min, max]`. Si se acotó, `limite = { tipo: 'inicio_anterior'|'inicio_siguiente', vecino }`;
    - aplica `moverInicioLinea` y copia sus `palabrasDescartadas` y `finesAutomaticos` (criterio 23).
  - `fijarInicio`: fuera de `[min, max]` → **sin cambio** y con `limite` (criterio 21: "no cambian nada y muestran el mismo tooltip"). Dentro → `moverInicioLinea`.
  - `ajustarFin`:
    - con la línea sin inicio → sin cambio;
    - base = `finEfectivo(...)`; `nuevo = base + delta` acotado a `[inicio + 1, tope]`, donde `tope` es el inicio del siguiente elemento con inicio y, si no hay, `duracionMs`;
    - el acotado da `fin_antes_del_inicio` o `fin_siguiente`;
    - el resultado **fija** `fin_ms` (criterio 22).
  - `fijarFin`:
    - `ms ≤ inicio` → sin cambio, con `fin_antes_del_inicio`;
    - `ms > tope` → sin cambio, con `fin_siguiente` (criterio 21: no se acota);
    - si no, `fin_ms = ms`.
  - `usarFinAutomatico` → `fin_ms = null`. `borrarTiempos` = `borrarTiemposLinea`.
  - `marcarInicioLinea(letra, id, ms)`, la regla de `ux/06` "Reglas de una marca en t" y `preguntas/0025` §2:
    1. si hay un elemento anterior con inicio y `ms ≤ su inicio` → sin cambio, con `limite: { tipo: 'demasiado_pronto' }`;
    2. cada elemento **posterior** con `inicio_ms ≤ ms` pierde sus tiempos y su id va a `borrados`:
       - líneas: `borrarTiemposLinea`;
       - pausas: `inicio_ms = null` y `fin_ms = null`. El fin debe quedar `null` porque un fin exige inicio (ADR 0006);
    3. `moverInicioLinea(letra, id, ms)`.
  - `fijarDesplazamiento` y `desplazar` acotan a ±30000 (`limite: { tipo: 'desplazamiento' }` si se acota).
  - `indiceLineaActual(letra, tAudio)`: índice del último elemento `tipo: 'linea'` con `tiempoMostrado(inicio, offset) ≤ tAudio`, o −1.
  - `lineaVecina`: id de la línea anterior o siguiente, **saltando pausas**, o `null` en el extremo. Con `id: null` → la primera línea (sentido 1) o la última (sentido −1).
  - `contador` solo cuenta líneas.
  - `formatearTiempo`: `4200 → "00:04.20"`, `65432 → "01:05.43"`, centésimas truncadas; `null` → `"--:--.--"`.
  - `interpretarTiempo`: acepta `m:ss`, `mm:ss`, `mm:ss.c` y `mm:ss.cc` (segundos < 60); cualquier otra cosa → `null` (`edi.tiempo.formato`).
  - `formatearDesplazamiento`: `+0,25 s`, `−0,10 s` (signo menos U+2212) y `+0,00 s`.
  - `interpretarDesplazamiento`: acepta coma o punto, signo opcional (`+`, `-` o U+2212) y hasta 2 decimales; si no, `null`.
- [x] Ninguna función muta su entrada (test con congelado profundo).
- [x] **Propiedad**: tras cualquier operación, `validarInvariantesLetra(resultado.letra.lineas)` está vacío. Hay un test determinista (semilla fija, 500 operaciones mezcladas sobre una letra de 12 líneas, 2 pausas de las que una tiene inicio, y una línea con palabras) que lo comprueba en cada paso.
- [x] Casos concretos, al menos:
  - límites contra una línea y contra una pausa (`vecino`);
  - fijar fuera de límites no cambia nada;
  - fin automático → ajustar → fijado → `usarFinAutomatico`;
  - `marcarInicioLinea` que pasa por delante de dos líneas y una pausa con tiempo (las tres en `borrados`);
  - "demasiado pronto";
  - palabras desplazadas y descartadas, con `palabrasDescartadas` informado;
  - fin fijado de la línea anterior que pasa a automático (`finesAutomaticos`);
  - desplazamiento acotado a ±30 s;
  - `tiempoGuardado` con mínimo 0;
  - formatos e interpretación (válidos e inválidos).

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/shared/letras
npm run test:cobertura   # shared/** sin bajar la cobertura actual
```

## Notas de implementación
- `shared/letras/tiempos.ts` ofrece operaciones inmutables de ajuste, límites, marcas que limpian tiempos posteriores, desplazamiento, consultas y formato. Reutiliza `finEfectivo`, `moverInicioLinea`, `borrarTiemposLinea` y el contrato de la 0090.
- Vitest cubre los casos concretos y 500 operaciones deterministas sobre letras congeladas. Pasaron lint, TypeScript, formato, Vitest (1550 pasadas, 12 omitidas), cobertura (98,89 % de líneas en `shared`, 100 % en `tiempos.ts`), build y Playwright (69 pasadas, 2 omitidas).
