# 0163 — Modelo puro de temas, apariencia e identidad en `shared/`

- Estado: Hecha
- Paso del pipeline: 4 y 5
- Depende de: subfase 2.1 integrada en `develop`
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §1–§4, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-3)
- Specs: [Editor · Fase 3, «Conceptos y procedencia»](../ux/06-editor.md#conceptos-y-procedencia), [Biblioteca · Fase 3, «Grupos»](../ux/02-biblioteca.md#grupos), [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §3–§4
- Plan: [Fase 3](../versiones/0.2.0/plan-2.md#fase-3--temas-y-biblioteca)

## Objetivo

Crear las funciones puras y los esquemas de dominio que usan main y renderer: claves de identidad, nombre visible de grupo, catálogo de temas, apariencia de la canción, resolución única y regla `neutra`. Sin E/S, sin Electron y sin dependencias nuevas. **Es la única tarea que modifica `shared/cancion.ts`, `shared/temas.ts`, `shared/identidad.ts` y los códigos de `shared/errores.ts` en esta fase.** No toca `shared/ipc.ts` ni `shared/canales.ts` (son de 0164).

## Contrato

**`app/src/shared/identidad.ts`** (nuevo):
- `claveTexto(t: string | null | undefined): string | null` = NFC(`toLowerCase`(NFC(colapsar(recortar(t))))), `""` → `null`. `colapsar` cambia cada secuencia `\s+` (incluye NBSP y U+3000) por un espacio.
- `claveArtista(m)`, `claveAlbum(m) → { artista, album } | null` (null si falta cualquiera de las dos claves).
- `claveAlbumTexto({ artista, album })`: serialización estable para mapas (por ejemplo `JSON.stringify([artista, album])`).
- `nombreVisibleGrupo(canciones: { texto: string, modificada: string }[]): string`: la grafía (recortada, NFC, espacios colapsados) de la canción modificada más recientemente; empate por orden de entrada.
- `normalizarNombreTema(t)`: NFC, recortado, espacios colapsados; `claveNombreTema = claveTexto`.

**`app/src/shared/temas.ts`** (nuevo):
- `estiloTemaSchema` = `estiloSchema`; `temaSchema` `{ id: uuid, nombre (1–60 tras normalizar), creado, modificado, revision ≥ 1, estilo }`.
- `catalogoSchema` según ADR 0016 §1, con asignaciones `{ artista, nombre_artista, tema_id }` y `{ artista, album, nombre_artista, nombre_album, tema_id }`, `predeterminado`, `borrado_pendiente`, `apartado: iso | null`, `claves: 1`, `esquema: 1`. `superRefine` con todas las reglas del §1 (ids únicos, referencias presentes, una asignación por clave, claves normalizadas, `clave(nombre_*) === clave`, nombres de tema únicos por clave, `borrado_pendiente.tema_id` presente).
- `migrarCatalogo(json) → { tipo: "ok", catalogo } | { tipo: "mas_nuevo" } | { tipo: "invalido", error }`, con `MIGRACIONES_CATALOGO = {}` y el patrón de `migrarCancion` (`shared/migraciones.ts`).
- `catalogoInicial({ estilo, ahora, id }) `: un tema «Shinobi» si `estilo` es igual campo a campo a `estiloPredeterminado()`, si no «Mi estilo», marcado como predeterminado.
- `aparienciaSchema` (ADR 0016 §2): `modo`, `tema_id` (UUID, solo y obligatorio con `modo: "tema"`), `base` opcional `{ tipo: "aleatorio" | "predeterminado_anterior", tema_id } | { tipo: "incluido" }`, `tema_nombre` opcional.
- `type Procedencia = "propio" | "cancion" | "album" | "artista" | "aleatorio" | "predeterminado_anterior" | "predeterminado" | "incluido" | "respaldo"`.
- `crearIndiceCatalogo(catalogo)`: mapas `id → tema`, `claveArtista → tema_id`, `claveAlbumTexto → tema_id`, construidos una vez (O(1) por consulta).
- `resolverApariencia(cancion, indice) → { estilo, procedencia, temaId, temaNombre }` con el orden exacto del §3 (incluido el paso 3.3 con `predeterminado_anterior`). `indice` puede ser `null` (catálogo en solo lectura o ausente): entonces `tema`/`heredar` dan `respaldo` salvo `base: incluido` y la rama 3.5.
- `esAparienciaNeutra(resolucion, cancion, estiloHeredado: Estilo | null): boolean` (§3, `neutra`).
- `estilosIguales(a, b)`: comparación campo a campo canónica (orden de claves irrelevante), reutilizable para «Shinobi»/«Mi estilo» y `neutra`.

**`app/src/shared/cancion.ts`**: `cancionSchema` gana `apariencia: aparienciaSchema.optional()`. `esquema` sigue en 1. `migrarCancion` no cambia. Una canción sin `apariencia` se trata como `{ modo: "propio" }` en `resolverApariencia`; no se añade el campo al leer.

**`app/src/shared/errores.ts`**: códigos `CONFIRMACION_OBSOLETA`, `TEMA_NO_ENCONTRADO`, `TEMA_NOMBRE_DUPLICADO`, `TEMAS_SOLO_LECTURA`, `BORRADO_PENDIENTE` y su clase de error si el archivo sigue ese patrón.

## Archivos

- `app/src/shared/identidad.ts`, `app/src/shared/identidad.test.ts` (nuevos).
- `app/src/shared/temas.ts`, `app/src/shared/temas.test.ts` (nuevos).
- `app/src/shared/cancion.ts`, `app/src/shared/cancion.test.ts`, `app/src/shared/migraciones.test.ts` (si compara la forma completa).
- `app/src/shared/errores.ts`, `app/src/shared/index.ts` (exportaciones).
- `app/src/shared/__fixtures__/index.ts`: ayudantes `temaDePrueba`, `catalogoDePrueba`, `aparienciaDePrueba`.

## Criterios de aceptación

- [x] Claves: «Queen», «QUEEN » y «queen» dan la misma clave; «Jarabe  de Palo» (doble espacio y NBSP) y «jarabe de palo» también; «Canción» (NFC) y «Canción» (NFD) dan la misma clave; «Canción» y «Cancion» dan claves distintas; «İstanbul» produce una clave NFC estable; `"   "` → `null`. Álbum sin artista → `claveAlbum` `null`.
- [x] `nombreVisibleGrupo` devuelve la grafía de la canción con `modificada` más reciente y es determinista con empates.
- [x] `catalogoSchema` rechaza: id repetido, `predeterminado` o asignación a un tema inexistente, dos asignaciones con la misma clave, clave no normalizada, `nombre_artista` cuya clave no coincide, dos temas «Noche Ninja» y «noche  ninja»; acepta «Canción» y «Cancion».
- [x] `migrarCatalogo` con `esquema: 2` devuelve `mas_nuevo`; con JSON inválido, `invalido`.
- [x] `catalogoInicial` llama al tema «Shinobi» con el estilo de fábrica y «Mi estilo» con cualquier otro; el tema queda como `predeterminado`.
- [x] `resolverApariencia` cubre, con una prueba por fila: `propio`, `tema` presente y ausente (`respaldo`), `heredar` con álbum, con artista, con álbum de otro artista homónimo (no aplica), con base `aleatorio` presente y ausente, con base `predeterminado_anterior` presente y ausente, con base `incluido`, sin base con y sin predeterminado, y con `indice` `null`. `temaNombre` es el nombre del tema resuelto o `null` con `incluido`/`propio`; con `respaldo` es `apariencia.tema_nombre ?? null`.
- [x] La base fijada precede al predeterminado (paso 3.3 antes que 3.4) y la asignación de álbum o artista precede a la base.
- [x] `esAparienciaNeutra` es `true` con `predeterminado`, `predeterminado_anterior`, `aleatorio`, `incluido`, y con `propio` igual a fábrica o al heredado; `false` con `cancion`, `album`, `artista`, `respaldo` y con `propio` distinto.
- [x] Un `cancion.json` de 0.1.0 (sin `apariencia`) valida igual que antes y `resolverApariencia` devuelve su `estilo` exacto con procedencia `propio`. Un `apariencia` con `modo: "tema"` sin `tema_id`, o `tema_id` con `modo: "heredar"`, no valida.
- [x] Vitest y `tsc` en verde; sin dependencias nuevas.

## Notas de implementación

**Qué se hizo.** Modelo puro en `shared/` sin E/S ni dependencias nuevas.
- `identidad.ts`: `claveTexto`, `claveArtista`, `claveAlbum`, `claveAlbumTexto`, `nombreVisibleGrupo`, `normalizarNombreTema`, `claveNombreTema`, `VERSION_CLAVES`, tipos `ClaveAlbum` y `MetadatosIdentidad`.
- `temas.ts`: `temaSchema`, `nombreTemaSchema`, `catalogoSchema` (con todas las reglas del ADR §1), `migrarCatalogo` (+ `MIGRACIONES_CATALOGO`), `catalogoInicial`, `aparienciaSchema`, `baseAparienciaSchema`, `crearIndiceCatalogo`, `resolverApariencia`, `esAparienciaNeutra`, `estilosIguales`; tipos `Tema`, `Catalogo`, `Apariencia`, `BaseApariencia`, `Procedencia`, `IndiceCatalogo`, `CancionResoluble`, `ResolucionApariencia`, `ResultadoMigrarCatalogo`, `BorradoPendiente`, `AsignacionArtista`, `AsignacionAlbum`.
- `cancion.ts`: `apariencia: aparienciaSchema.optional()`; `esquema` sigue en 1; no se añade el campo al leer.
- `errores.ts`: cinco códigos nuevos, añadidos también a `CODIGOS_SOLO_MAIN` (el test de paridad con `errores.py` los excluye así del worker; se actualizó la aserción de `separacion.test.ts`). No hay clase de error en el archivo.
- Fixtures: `idDePrueba`, `temaDePrueba`, `catalogoDePrueba`, `aparienciaDePrueba`.

**Decisiones.**
- `temas.ts` no importa `cancion.ts` (que sí lo importa a él) para evitar un ciclo de módulos con TDZ; por eso `migrarCatalogo` devuelve `invalido.error` como `string` (no `ErrorDatosInvalidos`) y `resolverApariencia` acepta la forma estructural `CancionResoluble`.
- `tema_id: null` con `modo` distinto de `tema` se tolera (ejemplo del ADR), equivale a ausente.
- `indice === null` y `heredar` sin `base`: `respaldo` (sin catálogo no se conoce el predeterminado); la rama 3.5 (`incluido`) solo se alcanza con índice presente y sin predeterminado. Con `base: incluido` da `incluido` aun sin índice.
- `migrarCatalogo` también da `mas_nuevo` si `claves` > 1.
- El estilo devuelto por `resolverApariencia` es la referencia del tema/canción/`ESTILO_PREDETERMINADO` (sin clonar): no mutar.
- Los nombres de las asignaciones (`nombre_artista`, `nombre_album`) se normalizan al parsear; el catálogo se valida ya normalizado.

**Cómo probarlo.** `cd app && npx vitest run src/shared/identidad.test.ts src/shared/temas.test.ts src/shared/cancion.test.ts`.

**Deuda técnica.** Ninguna propia. `Editor.paneles.test.tsx` ("Intro en el divisor") falla de forma intermitente en la suite completa bajo carga y pasa aislado (ajeno a esta tarea).
