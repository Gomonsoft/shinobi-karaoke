# 0096 — Karaoke (puro): modelo de render de la letra (línea actual, siguiente, barrido, título, indicador de entrada)
- Estado: Pendiente
- Paso del pipeline: 4 y 6 (lo reutiliza el reproductor)
- Depende de: — (usa `finEfectivo` de `shared/letra.ts`). **Puede empezar ya.**
- ADRs: 0010 (§4), 0005 (resaltado por palabra o barrido, `finEfectivo`)
- Spec UX: docs/ux/sistema-visual.md §10 (valores fijos de render); docs/ux/06-editor.md ("Vista previa", criterio 33); docs/ux/07-reproductor.md (criterio 3)
- Archivos: crea `app/src/renderer/src/karaoke/render.ts` y `render.test.ts`. **No toca archivos compartidos.**
- Paralelizable con: todas las de la fase hasta 0098, que lo usa.

## Contexto para quien implementa
- Letra: `app/src/shared/letra.ts`.
  - Un elemento `tipo: 'pausa'` no se dibuja nunca.
  - Las líneas sin `inicio_ms` se omiten al reproducir.
  - El fin de una línea es `finEfectivo(letra, id, duracionMs)`.
  - Con `palabras`, se resalta palabra a palabra; si no, hay un barrido lineal entre inicio y fin.
- Tiempo: la letra se dibuja con `tLetra = tAudio − offset_ms`. Este modelo recibe `tLetra`; la conversión es del llamador.
- sistema-visual §10:
  - línea actual y siguiente;
  - **pantalla de título** (título y artista) antes de la primera línea, hasta 4 s antes de ella;
  - **indicador de entrada** `●●●`: si faltan ≥ 4 s para la próxima línea tras una pausa (o al inicio), tres puntos que se apagan uno por segundo en los 3 s previos;
  - transición de 200 ms (la hace el componente, 0098).

## Objetivo
Una función pura que, para un instante, diga qué dibujar. Así la vista previa del editor y el reproductor dibujan lo mismo.

## Criterios de aceptación
- [ ] API:
  ```ts
  export interface LineaRender { id: string; texto: string
    progreso: number                                  // 0..1 de barrido (sin palabras)
    palabras: { texto: string; progreso: number }[] | null } // progreso 0..1 por palabra (con palabras)
  export interface FotogramaLetra {
    titulo: { titulo: string; artista: string } | null // pantalla de título
    actual: LineaRender | null
    siguiente: LineaRender | null                      // progreso 0
    puntos: 0 | 1 | 2 | 3                              // indicador de entrada (0 = oculto)
    claveTransicion: string                            // cambia al cambiar de línea actual (para animar)
  }
  export function fotogramaEn(letra: Letra, tLetraMs: number, ctx: { duracionMs: number; titulo: string; artista: string }): FotogramaLetra
  /** Vista previa en pausa (ux/06): la línea `id` con progreso 0,5 (o la mitad de sus palabras) y la siguiente línea con texto. */
  export function fotogramaEstatico(letra: Letra, id: string | null): FotogramaLetra
  ```
- [ ] Reglas de `fotogramaEn`:
  - solo cuentan las líneas con inicio;
  - `actual` = última línea con `inicio ≤ t` mientras `t < finEfectivo`; entre el fin de una línea y el inicio de la siguiente, `actual` es `null` (la siguiente se ve en su sitio);
  - `siguiente` = la próxima línea con inicio tras `actual`, o tras `t` si no hay actual;
  - progreso por línea `clamp((t − inicio)/(fin − inicio), 0, 1)`; por palabra, el mismo cálculo con los tiempos de la palabra (las palabras ya cantadas, 1);
  - `titulo` no nulo si `t < primerInicio − 4000`;
  - `puntos`: si no hay actual, la próxima línea empieza en `p` y el silencio desde el fin anterior (o desde 0) es ≥ 4000 ms, entonces `puntos = ceil((p − t)/1000)` cuando `p − t ≤ 3000`, y 0 si no;
  - letra sin líneas con inicio → solo `titulo`.
- [ ] `fotogramaEstatico`: con `id` null, la primera línea; las líneas sin inicio también se muestran (el editor las enseña en pausa); `puntos: 0`, `titulo: null`.
- [ ] Rendimiento: `fotogramaEn` es O(log n) o O(n) con n ≤ 5000; un test de 5000 líneas × 1000 llamadas termina en < 200 ms en CI. Se permite memorizar un índice ordenado por letra (`WeakMap<Letra, …>`).
- [ ] Tests: barrido a mitad, por palabra, entre líneas, pausa con tiempo (que corta el fin automático), título, puntos 3·2·1·0, última línea (+5 s acotado a la duración) y líneas sin inicio omitidas.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/karaoke/render.test.ts
```

## Notas de implementación
(las rellena el programador al terminar)
