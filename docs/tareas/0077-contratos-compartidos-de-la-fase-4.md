# 0077 — Contratos compartidos de la Fase 4: API `letras.*`, candidatos, `ARCHIVO_SIN_LETRA` y regla de `pasos.letra`
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0006, 0011 (Hechas)
- ADRs: 0005 (Revisión 2026-11-05), 0006 (Revisión 2026-11-05), 0008, 0009 §8
- Spec UX: docs/ux/05-letra.md
- Cuándo: primera tarea de la Fase 4, en paralelo con 0078. Desbloquea a la vez el main (0081–0083) y la interfaz (0084, con la API falsa), igual que 0029 y 0059 en las fases anteriores.

## Objetivo
Fijar en `app/src/shared/` los contratos que usa toda la Fase 4, para que el main y la interfaz avancen en paralelo.

## Criterios de aceptación
- [ ] **Canales** en `shared/canales.ts` y **contrato Zod** en `shared/ipc.ts`; preload y tipos de `window.shinobi`. Los handlers responden `ERROR_INTERNO` hasta que existan 0082 y 0083.
  - **`letras.buscar({ cancionId, titulo, artista, usarCache?: boolean })`** → `{ candidatos: CandidatoLetra[], instrumental: boolean }`:
    - Errores: `LETRA_NO_ENCONTRADA`, `INSTRUMENTAL`, `SIN_CONEXION`, `SERVICIO_NO_DISPONIBLE`, `CANCELADO` y `ARGUMENTOS_NO_VALIDOS`.
    - `titulo` no puede estar vacío; `artista` puede estarlo.
    - Con `usarCache`, si el main tiene candidatos de esa canción con los mismos título y artista de hace menos de 10 min, los devuelve sin red (0082).
    - Una búsqueda nueva cancela la anterior de la misma ventana, que se rechaza con `CANCELADO`.
  - **`letras.guardar({ cancionId, origen: 'lrclib' | 'manual' | 'archivo', lrclib_id: number | null, lineas: ElementoLetra[] })`** → `ResumenCancion`:
    - Sustituye la letra entera.
    - `lrclib_id` solo puede ser no nulo con `origen: 'lrclib'`.
    - Sin ningún elemento `linea`, o con más de 5000 elementos, → `ARGUMENTOS_NO_VALIDOS`.
  - **`letras.editarTexto({ cancionId, texto })`** → `ResumenCancion`:
    - Aplica el diff de 0079 sobre la letra guardada.
    - Texto de hasta 512 KB.
    - Sin letra previa → `ARGUMENTOS_NO_VALIDOS`.
  - **`letras.leerArchivo()`** → `{ cancelado: true } | { cancelado: false, nombre: string, lineas: ElementoLetra[], sincronia: Sincronia }`:
    - Abre el diálogo nativo `.lrc`/`.txt`, pero **no guarda**: guardar es `letras.guardar` con `origen: 'archivo'`, después de confirmar la sustitución (`ux/05`).
    - Error `ARCHIVO_SIN_LETRA`.
- [ ] **Tipos**:
  - `Sincronia = 'palabra' | 'linea' | 'texto'`;
  - `CandidatoLetra = { lrclib_id, titulo, artista, album: string | null, duracion_ms, sincronia, diferencia_ms, lineas: ElementoLetra[] }`, donde `diferencia_ms` es la duración del candidato menos la de la canción, con signo;
  - función pura `sincroniaDe(lineas)`: hay palabras → `palabra`; algún inicio → `linea`; ninguno → `texto`.
- [ ] **Comparación de duración** (`ux/05`) en una función pura `compararDuracion(diferencia_ms)` → `{ tipo: 'igual' } | { tipo: 'diferente', segundos, sentido: 'mas_larga' | 'mas_corta' } | { tipo: 'muy_distinta' }`:
  - `s = round(|dif| / 1000)`;
  - `s ≤ 2` → igual;
  - `3 ≤ s ≤ 10` → diferente;
  - `s > 10` → muy distinta.
- [ ] **Errores**: `ARCHIVO_SIN_LETRA` en `shared/errores.ts`, en `CODIGOS_SOLO_MAIN` (el worker no interviene). La interfaz lo muestra con `let.error.archivo`.
- [ ] **Regla de `pasos.letra`** (ADR 0006, Revisión 2026-11-05) como función pura en `shared/derivados.ts`: `estadoPasoLetra(letra)` → `completado` si `contarLineas ≥ 1`; si no, `pendiente`.
- [ ] **Doble de LRCLIB**:
  - `SHINOBI_LRCLIB_URL` documentada en `shared/` (constante con el nombre) y en `app/README.md`.
  - Sin empaquetar sustituye a la URL base `https://lrclib.net` y admite `http://127.0.0.1:<puerto>` y `http://lrclib.invalid` (para probar `SIN_CONEXION`).
  - Empaquetada se ignora, y el main la borra de `process.env` como hace con `SHINOBI_YTDLP_FALSO`.
- [ ] **API falsa del renderer** (como `vistas/biblioteca/fixturesApi.ts`) con `letras.*` configurable: candidatos de ejemplo de los tres tipos de sincronía, los cuatro errores y un retardo. La usan 0084–0086 hasta que existan 0082 y 0083.
- [ ] **Fixtures** en `shared/__fixtures__/letras/` con letras **inventadas**, nunca reales (ADR 0005, Revisión 2026-11-05):
  - un LRC por línea;
  - un LRC con varias marcas por renglón y `[offset:]`;
  - un LRC mejorado;
  - un Lyricsfile con palabras y otro sin ellas;
  - un texto plano con estrofas;
  - registros JSON de LRCLIB (`get` y `search`, también instrumental).
  Las comparten 0078–0083 y los E2E (0088).
- [ ] Tests Zod de cada canal, con argumentos válidos y no válidos, y tests de `sincroniaDe`, `compararDuracion` (bordes 2,4 s / 2,5 s / 10,4 s / 10,5 s) y `estadoPasoLetra`.

## Notas de implementación
- **Contratos**: `app/src/shared/letrasBusqueda.ts` (esquemas Zod de `buscar`, `guardar`, `editarTexto`, `leerArchivo`; `Sincronia`, `CandidatoLetra`, `sincroniaDe`, `compararDuracion`, `ENTORNO_LRCLIB_URL`, `URL_BASE_LRCLIB`, `urlBaseLrclib(valor, empaquetada)`). Canales `letras.*` en `canales.ts`, `CONTRATO`/`ApiShinobi.letras` en `ipc.ts`, preload y handlers (`LetrasIpc` opcional en `DependenciasIpc`; sin servicio responden `ERROR_INTERNO`).
- `leerArchivo` devuelve además `ignoradas: number` (renglones de LRC ignorados; respuesta del arquitecto a `preguntas/0023`).
- `ARCHIVO_SIN_LETRA` en `CODIGOS_ERROR` y `CODIGOS_SOLO_MAIN`; se actualizó el test `separacion.test.ts > PROCESO_TERMINADO...` para que espere ambos códigos.
- `estadoPasoLetra` en `shared/derivados.ts`.
- `SHINOBI_LRCLIB_URL`: documentada en `app/README.md`; `main/index.ts` la borra de `process.env` empaquetada. La URL efectiva la calcula `urlBaseLrclib` (solo `http://127.0.0.1:<puerto>` y `http://lrclib.invalid`); el cliente (0081) debe usarla.
- API falsa: `app/src/renderer/src/vistas/letra/fixturesApi.ts` (`apiLetrasFalsa`, candidatos de los tres tipos, errores, retardo, llamadas registradas).
- Fixtures inventados: `app/src/shared/__fixtures__/letras/` (+ `index.ts` con `leerFixtureLetra`, `leerFixtureLetraJson`, solo para Node).
- Tests: `shared/letrasBusqueda.test.ts` y uno nuevo en `main/ipc/handlers.test.ts`.
- Deuda: la comprobación de "sin línea" y 5000 elementos se hace en el esquema; la validación completa de invariantes la hace el main (0083).
