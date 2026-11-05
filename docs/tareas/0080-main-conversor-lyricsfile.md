# 0080 — Main: conversor Lyricsfile (YAML de LRCLIB) con la dependencia `yaml`
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0078
- ADRs: 0005 (Revisión 2026-11-05: formato Lyricsfile y fuente de cada registro), 0002 (licencias compatibles)
- Spec UX: — (sin interfaz)
- Cuándo: en paralelo con 0079 y 0081.

## Objetivo
Leer el campo `lyricsfile` de LRCLIB, con sincronía por palabra, y pasarlo a `ElementoLetra[]` en `app/src/main/letras/lyricsfile.ts`. El YAML **no entra en el bundle del renderer**.

## Criterios de aceptación
- [x] **Dependencia `yaml`** (eemeli/yaml, ISC) en `dependencies`, con la versión fijada en el lockfile.
  - Se añade a `THIRD_PARTY_NOTICES.md`.
  - El diálogo de licencias (0038) la muestra sin más cambios, porque lee ese archivo (`main/textoLegal.ts`).
  - Un test o regla de lint comprueba que nada bajo `src/renderer` ni `src/shared` importa `yaml`.
- [x] **Lectura segura**:
  - `parse` con el esquema `core`, `maxAliasCount` bajo (p. ej. 50) y `prettyErrors`;
  - entrada de más de 2 MB → error;
  - estructura validada con Zod: `version`, `metadata` (`offset_ms?`, `instrumental?`) y `lines[]` (`text`, `start_ms`, `end_ms?`, `words[]?` con `text`, `start_ms` y `end_ms?`);
  - YAML no válido o estructura no reconocida → `null`, y el llamante pasa a `syncedLyrics`.
- [x] **Conversión** (ADR 0005, Revisión 2026-11-05):
  - `metadata.offset_ms` se aplica a todos los tiempos (`t − offset`, con mínimo 0).
  - `text: ''` → pausa con tiempo.
  - `end_ms` de línea → `fin_ms` solo si `inicio < end_ms < inicio del siguiente elemento con tiempo`, o si es la última línea. En cualquier otro caso, `null`.
  - Palabras: texto tal cual, incluido el espacio final. Sin `end_ms`, el fin es el inicio de la siguiente palabra; la última termina en el fin de la línea o en `min(siguiente inicio, inicio + 1000)`.
  - `lines: []`, o `instrumental: true` → `[]`. El llamante usa `plainLyrics`, o considera el registro instrumental.
  - El resultado pasa por `normalizarLetra` (0078).
- [x] Tests con las fixtures de 0077 (Lyricsfile inventado con y sin palabras):
  - el ejemplo de la especificación de LRCGET reescrito con texto inventado;
  - `end_ms` derivados (iguales al siguiente inicio) → `fin_ms: null`;
  - un hueco real → fin fijado;
  - offset;
  - YAML con alias en bomba → error controlado y no se cuelga;
  - YAML roto → `null`.

## Notas de implementación
- `app/src/main/letras/lyricsfile.ts`: `convertirLyricsfile(texto, generarId?)` devuelve `ElementoLetra[]` normalizado con `normalizarLetra`; `null` si el YAML no es válido, supera el límite de alias (`maxAliasCount` 50, aplicado en `toJS`) o la estructura (Zod) no se reconoce; `[]` si `lines: []` o `instrumental: true`. Una entrada de más de 2 MB lanza `ErrorLyricsfileDemasiadoGrande` (el llamante, 0082, debe capturarla y pasar a `syncedLyrics`). Usa `parseDocument` con esquema `core` y `prettyErrors`.
- Aislamiento: `yaml` 2.9.1 (ISC) en `dependencies` y en `THIRD_PARTY_NOTICES.md`. El test `lyricsfile.test.ts` comprueba que nada bajo `src/renderer` ni `src/shared` lo importa.
- Probar: `cd app && npx vitest run src/main/letras`.
- Deuda: `prettier` global marca archivos ajenos (`src/shared/letras/editar.test.ts`, `coverage/`); el test de rendimiento de `editar.test.ts` (0079) falla de forma intermitente bajo carga.
