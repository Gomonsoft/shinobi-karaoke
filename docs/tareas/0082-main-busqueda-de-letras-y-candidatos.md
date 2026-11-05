# 0082 — Main: búsqueda de letras y candidatos (`letras.buscar`)
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0077, 0078, 0080, 0081
- ADRs: 0005 (Decisión §1, Revisión 2026-11-05: estrategia `get` + `search`, fuente de cada registro, instrumental), 0006
- Spec UX: docs/ux/05-letra.md (criterios 1–3, 6–8, 12)
- Cuándo: en paralelo con 0083 y con la interfaz (0084–0086, sobre la API falsa).

## Objetivo
Servicio `app/src/main/letras/busqueda.ts` y handler de `letras.buscar`. Recibe los datos de la canción, consulta LRCLIB con 0081 y devuelve candidatos ordenados y ya convertidos al formato interno, listos para la vista previa.

## Criterios de aceptación
- [ ] **Metadatos**: si `titulo` o `artista` difieren de los guardados, se guardan antes de buscar con la misma operación que `biblioteca.actualizarMetadatos` (`ux/05` criterio 8). `album` y `duracion_ms` se leen de la canción. Si no existe la canción → `ARGUMENTOS_NO_VALIDOS`.
- [ ] **Estrategia** (en serie, con un presupuesto total de 10 s y una `AbortSignal`):
  1. Si hay artista, `get` con título, artista, álbum (si lo hay) y duración.
  2. `search` con `track_name` y `artist_name`; si no da ningún registro útil, `search` con `q = "título artista"` (sin artista, solo el título).
  Se unen sin duplicados por `id`, con el resultado de `get` primero en la entrada al ordenar.
  - Si el presupuesto se agota con candidatos ya obtenidos, se devuelven.
  - Sin candidatos: `SERVICIO_NO_DISPONIBLE`, o `SIN_CONEXION` según el primer error de red.
- [ ] **Conversión de cada registro**:
  1. `hasWordSync` → Lyricsfile (0080); si devuelve `null`, se pasa al paso siguiente.
  2. `syncedLyrics` → `lrcALetra` (0078).
  3. `plainLyrics` → `textoPlanoALetra`.
  4. Si no, el registro se descarta.
  Los registros `instrumental` y los que se quedan sin ninguna línea no son candidatos.
- [ ] **Candidatos** (`CandidatoLetra`, 0077):
  - `sincronia` con `sincroniaDe` (si un `hasWordSync` cae a LRC, cuenta como `linea`);
  - `duracion_ms = round(duration × 1000)`;
  - `diferencia_ms` respecto a `metadatos.duracion_ms`.
- [ ] **Orden** (`ux/05` criterio 3):
  1. sincronía: `palabra` > `linea` > `texto`;
  2. dentro de cada grupo, `|diferencia_ms|` creciente;
  3. a igualdad, el de `get` primero y después el orden de LRCLIB.
  Hasta 20 candidatos.
- [ ] **Instrumental** (ADR 0005, Revisión 2026-11-05; provisional, `preguntas/0022` §5):
  - Sin candidatos, si `get` o algún registro era instrumental → `INSTRUMENTAL`; si no → `LETRA_NO_ENCONTRADA`.
  - Con candidatos, `instrumental: true` si el registro de `get` era instrumental.
- [ ] **Caché en memoria**: los candidatos de la última búsqueda de cada canción, durante 10 min y sin escribirse nunca a disco. No se usa para validar `letras.guardar` (0083), que acepta las líneas que manda el renderer y las normaliza; sirve para que volver a la vista dentro de la misma sesión no repita la consulta si el renderer la pide con `usarCache: true` y los mismos título y artista (0077).
- [ ] **Cancelación**: una búsqueda nueva desde la misma ventana aborta la anterior, que se rechaza con `CANCELADO`. Al cerrar la app se abortan todas.
- [ ] **Registro**: una línea por búsqueda, con el id de la canción, el número de candidatos, la duración en ms y el código de error. Sin títulos.
- [ ] Tests con el cliente de 0081 falso y fixtures de 0077:
  - `get` acierta y `search` aporta más (sin duplicados);
  - `get` 404 y `search` con resultados;
  - sin artista;
  - `search` vacío → `q`;
  - todo vacío → `LETRA_NO_ENCONTRADA`;
  - instrumental con y sin otros candidatos;
  - orden por sincronía y duración;
  - Lyricsfile roto → LRC;
  - presupuesto agotado con y sin candidatos;
  - cancelación;
  - metadatos guardados al buscar.

## Notas de implementación
- **Qué se hizo**: `app/src/main/letras/busqueda.ts` con `BusquedaLetras` (`buscar`, `cerrar`) y `convertirRegistro` (Lyricsfile > LRC > texto plano; un Lyricsfile ilegible o demasiado grande cae a LRC). Estrategia `get` + `search` + `search q` en serie con presupuesto de 10 s (`AbortSignal.any` de la cancelación y del temporizador, más `{ vencimiento }` al cliente). Orden estable por sincronía y `|diferencia_ms|`, máximo 20. Caché en memoria de 10 min por canción (solo con `usarCache` y mismos título y artista). Registro de una línea por búsqueda sin título. Cableado en `main/index.ts` (cliente con `net.fetch`, `app.getVersion()`, `net.isOnline()`, `process.env`, `app.isPackaged`; `cerrar` en `before-quit`) sustituyendo el `buscar` de rechazo de 0083.
- **Decisiones**: sin artista no hay `get` y se busca con `q = título`. "Ningún registro útil" del `search` estructurado = ninguno convertible a candidato (el de `get` no cuenta); entonces se repite con `q`. Los errores de un paso se anotan y se sigue con el siguiente; sin candidatos se lanza el primer error, o `INSTRUMENTAL` si lo había. Los handlers no reciben la ventana: hay una sola búsqueda en curso en toda la app (la app tiene una ventana), una nueva aborta la anterior. Si el presupuesto se agota sin error previo, `SERVICIO_NO_DISPONIBLE`. Metadatos: se guardan con `biblioteca.actualizar` (`titulo`, `artista`, `album` actual) solo si difieren, también ante un acierto de caché.
- **Cómo probarlo**: `npx vitest run src/main/letras/busqueda.test.ts` (cliente falso más un caso con servidor HTTP local y el cliente real).
- **Deuda**: ninguna.
