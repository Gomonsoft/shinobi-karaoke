# 0016 — Catálogo de temas, resolución de la apariencia e identidad de artista y álbum

- Estado: Aceptado
- Fecha: 2026-11-09
- Paso del pipeline: 4 y 5 (editor, biblioteca y reproductor)
- Versión: 0.2.0-alfa, fase 3 (features 5 · Temas guardables y 6 · Agrupación por artista y álbum)
- Revisión: 2026-11-09, tras la respuesta del usuario a [0052](../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md) (A1, B1, C1) y la de UX a [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md). Cambia §1 (asignaciones con nombre visible, aviso de catálogo apartado), §2 (base `predeterminado_anterior`, `tema_nombre`), §3 (procedencia nueva y `neutra`), §6 (B1), §7 (desglose, usos, lote por canción, progreso), §8, §9 (portada, usos, referencias que faltan, preferencia «Agrupar por») y §11 (canales).
- Revisión 2: 2026-11-09, tras la respuesta de UX a [0055](../preguntas/0055-textos-de-predeterminado-anterior-y-ajustes-de-la-fase-3.md). Añade `alHeredar` (§3, §9), da forma al progreso de `reanudarBorrado` (§7, §11) y añade el estado `pendiente` al resultado de las operaciones que se detienen en el primer fallo (§7).
- Revisión 3: 2026-11-09, tras la respuesta de UX a [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md). El resultado por canción lleva `titulo` y `artista` (§7), porque la lista tras un fallo a mitad nombra cada canción y `reanudarBorrado` no tiene impacto con el que cruzarla. Se aclara que `despues` y `alHeredar` pueden tener procedencia `respaldo` y que entonces la interfaz no nombra ningún tema (§3, §7).

## Contexto

Hoy cada canción guarda un `estilo` completo ([ADR 0006](0006-persistencia-y-modelo-de-datos.md#formato-del-estilo)). `ServicioBiblioteca.construir` copia `config.estilo_predeterminado` al crear la canción ([servicio.ts](../../app/src/main/biblioteca/servicio.ts), cableado en [index.ts](../../app/src/main/index.ts)), el editor lo reescribe con `biblioteca.guardarEstilo` ([ADR 0010](0010-editor-motor-de-audio-reloj-y-guardado.md)) y el reproductor lo lee de `biblioteca.obtener`. La Biblioteca filtra por título y artista en el renderer ([filtrado.ts](../../app/src/renderer/src/vistas/biblioteca/filtrado.ts)), y `album` existe en `metadatos`, pero no llega al resumen.

La fase 3 del [plan](../versiones/0.2.0/plan-2.md#fase-3--temas-y-biblioteca) pide:

- un catálogo local versionado con ids estables;
- resolución única en main con el orden canción → álbum → artista → predeterminado;
- «Temas definidos» con vínculo vivo y «Tema personalizado» como copia propia;
- guardar, aplicar, volver a heredar, renombrar, duplicar, guardar como nuevo y borrar;
- al borrar, congelar antes los estilos efectivos ([0047](../preguntas/0047-temas-asignados-edicion-y-borrado.md));
- aplicar un tema en lote desde la Biblioteca tras confirmar;
- elegir el predeterminado en Ajustes. Sin predeterminado, cada canción nueva recibe un tema aleatorio estable, o el estilo incluido si el catálogo está vacío;
- agrupar por artista y álbum con identidad estricta (NFC, espacios y mayúsculas, sin quitar diacríticos), con el álbum dentro del artista y con búsqueda flexible separada de la identidad.

Restricciones:

- un solo escritor por archivo (main);
- escritura atómica con `.bak`;
- bibliotecas de cientos de canciones;
- una biblioteca de esquema 1 conserva tiempos y estilos hasta que el usuario pide un cambio («0.2.0 lista»);
- sin dependencias nuevas;
- la fase 5 añadirá degradados y comodines de espera dentro del tema.

Discusión previa: [R1](../versiones/0.2.0/discusion/r1-arquitecto.md#5--temas-guardables-y-herencia--l), [R2](../versiones/0.2.0/discusion/r2-arquitecto.md), [R4](../versiones/0.2.0/discusion/r4-arquitecto.md) y su [cruce con UX](../versiones/0.2.0/discusion/r4-disenador-ux.md).

## Alternativas consideradas

### 1. Dónde viven los temas y las asignaciones

| Opción | Pros | Contras |
|---|---|---|
| A. **Archivo de catálogo `biblioteca/temas.json`** con temas, asignaciones de artista y álbum, y predeterminado | Una sola escritura atómica por mutación del catálogo. Borrar un tema retira sus asignaciones en el mismo paso. Viaja con la carpeta `biblioteca/` al copiarla. Reutiliza `escribirJsonAtomico`/`leerJson`. | El escaneo debe seguir ignorando archivos, como hoy, porque solo indexa carpetas. |
| B. Temas en `config.json` | Sin archivo nuevo. | Mezcla contenido del usuario con preferencias. Un `config.json` ilegible se aparta como `.danado` y se perdería el catálogo. |
| C. Una carpeta por tema (`temas/<id>/tema.json`) | Simétrico con las canciones. | Borrar un tema y retirar sus asignaciones y el predeterminado ocupa varios archivos. No hay contenido binario que lo justifique. |
| D. SQLite | Transacciones. | Módulo nativo y otra fuente de verdad. El ADR 0006 ya lo descartó. |

### 2. Cómo referencia una canción su apariencia

| Opción | Pros | Contras |
|---|---|---|
| A. **Campo opcional `apariencia` (selección y respaldo aleatorio) junto al `estilo` existente**, que pasa a ser estilo propio o instantánea de respaldo | Sin subir `esquema`: un archivo de 0.1.0 se lee como estilo propio, idéntico. Si 0.1.0 abre un archivo de 0.2.0, ignora el campo y pinta la instantánea. Una carpeta copiada a otra instalación conserva una apariencia legible. | `estilo` cambia de significado según el modo. La instantánea puede quedar atrasada porque no se reescriben las canciones al editar un tema. |
| B. Sustituir `estilo` por `tema_id` o por un estilo propio (esquema 2) | Modelo puro, sin duplicados. | Migración con reescritura o lectura doble. La versión 0.1.0 ya no puede abrir las canciones. Una carpeta recuperada sin catálogo pierde su apariencia. |
| C. Copiar el estilo al aplicar, sin referencias | Sin efectos globales. | No hay vínculo vivo ni herencia, en contra de 0047. |
| D. Referencia por nombre de tema | Legible. | Renombrar rompe vínculos (R1). |
| E. Parches parciales por nivel | Flexible. | Resultado difícil de prever y de congelar (R1). |

### 3. Identidad de artista y álbum

| Opción | Pros | Contras |
|---|---|---|
| A. **Clave derivada del texto con NFC, espacios colapsados y minúsculas Unicode, conservando diacríticos. El álbum se identifica con el par (artista, álbum).** | Determinista, sin datos nuevos ni administración. Separa «Canción» de «Cancion» y une «QUEEN» con «Queen». | Los homónimos reales del mismo artista se fusionan. «feat.» crea otro artista. |
| B. Ids editoriales explícitos (MusicBrainz o propios) | Distingue homónimos. | Exige administrar entidades y red o datos que el origen no trae (R1). |
| C. Comparar con `Intl.Collator` (`sensitivity: 'accent'`) | Igualdad con conciencia de idioma. | No produce una clave estable para mapas ni para persistir. Depende de los datos ICU de cada plataforma. |
| D. Álbum global por nombre | Simple. | Mezcla discos homónimos de artistas distintos (plan, feature 6). |

### 4. Concurrencia de confirmaciones

| Opción | Pros | Contras |
|---|---|---|
| A. **Ficha de impacto en memoria, que main recalcula al ejecutar y compara con lo confirmado** | No rechaza por cambios ajenos (progreso de separación, letra). Detecta exactamente lo que el usuario no vio. | Main guarda fichas en memoria con caducidad. |
| B. Revisión global estricta | Simple. | Cualquier escritura de otra canción invalida la confirmación. |
| C. Sin comprobación | Simple. | Confirma un alcance que ya no es real, un riesgo señalado en el plan. |

### 5. Quitar el predeterminado sin cambiar el aspecto (B1 de [0052](../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md))

| Opción | Pros | Contras |
|---|---|---|
| A. **Fijar en cada canción afectada `base: predeterminado_anterior` con el tema anterior, en la misma operación confirmada, antes de escribir el catálogo** | Vínculo vivo conservado (editar el tema las cambia). Procedencia propia y legible. Un fallo a mitad no cambia ningún aspecto, sin diario. Reutiliza la rama de `base` de la resolución. | Escribe N canciones. La procedencia de las ya escritas cambia antes de terminar si falla. |
| B. Guardar en el catálogo un «predeterminado anterior» global que siguen las canciones sin base | Una sola escritura. | Hay que distinguir las canciones de antes y de después del cambio (fecha de creación u otra marca), y encadenar varios «anteriores» si se quita y se pone varias veces. |
| C. Convertirlas en «Tema personalizado» | Simple, como el borrado. | Rompe el vínculo, en contra de B1 («siguen vinculadas»). |
| D. Asignarles el tema a nivel canción (`modo: "tema"`) | Sin campo nuevo. | La procedencia diría «Asignado a esta canción», que es falso, y «Volver a heredar» lo perdería. |
| E. Fijar también la base de las que hoy heredan de su álbum o artista | Su respaldo seguiría siendo el tema anterior si luego se quita el del grupo. | Escribe canciones sin cambio visible que el diálogo no puede explicar. |

## Decisión

Opciones **1A, 2A, 3A, 4A y 5A**. Un servicio nuevo `ServicioTemas` (`main/temas/`) es el único escritor de `temas.json`. Solo `ServicioBiblioteca` escribe `cancion.json`, y lo hace a petición de `ServicioTemas`. La resolución y las claves son funciones puras de `shared/`. Main es la única autoridad que las ejecuta para el renderer.

### 1. Catálogo `biblioteca/temas.json`

Ubicación: `<base>/biblioteca/temas.json`, con `temas.json.bak` y `temas.json.tmp` como hermanos. `escanear` solo indexa carpetas, así que no cambia. Copiar `biblioteca/` respalda canciones y temas juntos.

```jsonc
{
  "esquema": 1,
  "claves": 1,                       // versión del algoritmo de claves de identidad (§4)
  "predeterminado": "9b2e…-uuid",    // id de tema o null = «Estilo aleatorio» (§6)
  "temas": [
    {
      "id": "9b2e…-uuid",            // UUID v4, estable: nunca cambia al renombrar ni editar
      "nombre": "Noche morada",      // NFC, espacios colapsados, 1–60 caracteres
      "creado": "2026-11-09T10:00:00Z",
      "modificado": "2026-11-09T10:00:00Z",
      "revision": 3,                 // entero ≥ 1; +1 en cada edición de estilo o nombre
      "estilo": { /* estiloSchema completo (ADR 0006; en fase 5, la versión ampliada) */ }
    }
  ],
  "asignaciones": {
    "artistas": [ { "artista": "queen", "nombre_artista": "Queen", "tema_id": "…" } ],
    "albumes":  [ { "artista": "queen", "album": "a night at the opera",
                    "nombre_artista": "Queen", "nombre_album": "A Night at the Opera", "tema_id": "…" } ]
  },
  "borrado_pendiente": null,         // diario de borrado (§8), o { "tema_id", "iniciado", "canciones": [ids] }
  "apartado": null                   // fecha ISO en que se apartó un catálogo ilegible, o null (aviso único en Ajustes)
}
```

- **Nombre visible de las asignaciones** (`nombre_artista`, `nombre_album`): la grafía con la que se asignó, recortada y normalizada a NFC, con `clave(nombre) === clave guardada`. Solo se usa cuando el grupo no tiene canciones (por ejemplo, en «Tus temas» de Ajustes tras vaciar el álbum). Si el grupo tiene canciones, manda la regla de [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §4: la grafía de la canción del grupo modificada más recientemente, con la función pura `nombreVisibleGrupo` de `shared/identidad.ts`, que usan main y renderer.
- **`apartado`**: lo escribe main al crear el catálogo nuevo tras apartar uno ilegible (§1, «Lectura y migración»). `temas.catalogo()` lo expone y `temas.descartarAvisoApartado()` lo vuelve a `null`. Así el aviso `aj.temas.apartado` sale una sola vez, sobrevive al reinicio hasta que el usuario lo cierra y vuelve solo con otro incidente.

- **Validación** (`shared/temas.ts`, Zod):
  - ids únicos;
  - `tema_id` de cada asignación y `predeterminado` presentes en `temas`;
  - como mucho una asignación por clave de artista y otra por par de álbum;
  - claves no vacías y ya normalizadas, es decir, `clave(x) === x`;
  - nombres únicos por la clave del §4. Main rechaza un duplicado con `TEMA_NOMBRE_DUPLICADO`.

  Una referencia colgante en el archivo, por edición manual, invalida el archivo. `leerJson` prueba entonces con `.bak`.
- **Escritura**: atómica (tmp → fsync → `.bak` → renombrar) con la cola por archivo existente (`main/persistencia/`), sin *debounce*. Se escribe una vez por mutación, y la promesa se resuelve con el archivo escrito.
- **Lectura y migración**: `migrarCatalogo` sigue el patrón de `migrarCancion`, con `MIGRACIONES_CATALOGO` vacío en la versión 1.
  - **Esquema más nuevo** que el soportado: el catálogo queda en **solo lectura**. Los temas no se ofrecen, las canciones con referencia pintan su instantánea (§3) y main nunca sobrescribe el archivo. Se registra el aviso. Así una versión antigua no destruye un catálogo nuevo.
  - **Ilegible**, también desde `.bak`: se aparta como `temas.json.danado` (sustituye a uno anterior, como `config.json.danado`), se registra el error y se parte de un catálogo nuevo sembrado como en el punto siguiente, con `apartado` = fecha actual. Las canciones con referencias pintan su respaldo hasta que el usuario elija.
- **Creación inicial** (primer arranque de 0.2.0, sin `temas.json` ni `.bak`): se crea un catálogo con **un tema** a partir de `config.estilo_predeterminado`, que es el estilo incluido si el usuario no lo cambió, y se marca como `predeterminado`. Así las canciones nuevas reciben lo mismo que en 0.1.0. El nombre visible lo fija UX ([0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §1): **«Shinobi»** si `config.estilo_predeterminado` es igual campo a campo a `ESTILO_PREDETERMINADO` y **«Mi estilo»** si no. A partir de ahí `config.estilo_predeterminado` es un **campo heredado**: se sigue leyendo con tolerancia y no se borra, pero no es autoridad de nada. Se retira de `configParcialRendererSchema` cuando el editor deje de usarlo (§10).

### 2. Apariencia en `cancion.json`, sin subir el esquema

```jsonc
"apariencia": {                      // opcional; ausente ≡ { "modo": "propio" }
  "modo": "heredar",                 // "propio" | "tema" | "heredar"
  "tema_id": null,                   // obligatorio y solo con modo "tema"
  "base": { "tipo": "aleatorio", "tema_id": "c41d…-uuid" },
                                     // opcional; ausente = seguir al predeterminado global.
                                     // { "tipo": "aleatorio", "tema_id" }
                                     // | { "tipo": "predeterminado_anterior", "tema_id" }  (§6, B1 de 0052)
                                     // | { "tipo": "incluido" }
  "tema_nombre": "Noche ninja"       // opcional; nombre del tema resuelto al tomar la instantánea
},
"estilo": { /* siempre presente y completo */ }
```

- **`modo: "propio"`** (en la interfaz, «Tema personalizado»): `estilo` es la autoridad y se pinta tal cual. Solo lo cambia el usuario, igual que en 0.1.0.
- **`modo: "tema"` o `"heredar"`** («Temas definidos»): `estilo` es la **instantánea de respaldo**, la última apariencia resuelta que main conoció. Main la refresca **de oportunidad** en cada escritura de esa canción, sea cual sea el motivo, y al asignar. No hay escrituras extra: editar un tema no reescribe sus canciones.
- **`tema_nombre`**: nombre del tema resuelto, refrescado junto con la instantánea (ausente si resolvió al estilo incluido). Solo sirve para el estado «Tema no disponible» (spec 06, D4 y T22): «Esta canción usaba «{tema}»…» y el nombre propuesto en «Guardar como tema nuevo…». Si falta, la interfaz usa `tema.noDisponible.sinNombre`. No es una referencia: nunca se resuelve por nombre.
- **Compatibilidad**: `cancion.esquema` sigue en 1. El ADR 0006 admite campos nuevos con valor por defecto sin subir la versión. 0.1.0 lee el archivo (Zod `object` descarta claves desconocidas), pinta la instantánea y, si lo reescribe, elimina `apariencia`. Al volver a 0.2.0 la canción queda como estilo propio con esa apariencia, sin pérdida.
- **Bibliotecas de esquema 1**: sin `apariencia`, cada canción se lee como `propio` con su `estilo` intacto. No se reescribe nada al abrir. La herencia solo se activa por una acción explícita del usuario.
- **Validación**: `aparienciaSchema` (opcional en `cancionSchema`).
  - `tema_id` es un UUID solo si `modo === "tema"`. `base` está ausente o es `{ tipo: "aleatorio" | "predeterminado_anterior", tema_id: uuid }` o `{ tipo: "incluido" }`. `tema_nombre`, si está, cumple las reglas de nombre del §1.
  - Que la referencia exista **no** se valida al leer: puede faltar en una carpeta recuperada (§3).
  - Al **escribir** desde una operación de usuario, main exige que el tema exista y no esté en borrado (`TEMA_NO_ENCONTRADO`).

### 3. Resolución única

Función pura `resolverApariencia(cancion, catalogo) → { estilo, procedencia, temaId, temaNombre }` en `shared/temas.ts`. Main la ejecuta para todo lo que llega al renderer. El renderer no calcula procedencias.

1. `propio` → `estilo` · procedencia **`propio`**.
2. `tema` → tema `tema_id` · **`cancion`**. Si no existe en el catálogo, se usa la instantánea `estilo` · **`respaldo`** (referencia no disponible: carpeta recuperada, catálogo apartado o en solo lectura).
3. `heredar`:
   1. si hay clave de artista y de álbum, y el par tiene asignación → **`album`**;
   2. si hay clave de artista con asignación → **`artista`**;
   3. si `base` es `aleatorio` o `predeterminado_anterior`: si su tema existe → **`aleatorio`** o **`predeterminado_anterior`**, y si no → instantánea · **`respaldo`**. Si `base` es `incluido` → `ESTILO_PREDETERMINADO` · **`incluido`**. Una base fijada sustituye al predeterminado global *para esa canción* (§6);
   4. sin `base`, si hay `predeterminado` → **`predeterminado`**;
   5. si no → `ESTILO_PREDETERMINADO` · **`incluido`**.
   Una asignación de álbum o de artista cuyo tema no exista no puede darse, porque el catálogo es válido por construcción, así que no hace falta otra rama.

- Procedencias: `propio`, `cancion`, `album`, `artista`, `aleatorio`, `predeterminado_anterior`, `predeterminado`, `incluido` y `respaldo`. UX traduce `predeterminado_anterior` como «Tema predeterminado anterior» (`aj.temas.origen.anterior`).
- **`neutra`** (función pura `esAparienciaNeutra(resolucion, cancion, estiloHeredado)` en `shared/temas.ts`, ejecutada en main): `true` cuando nadie eligió un aspecto para esa canción, su álbum ni su artista. Es `true` con `predeterminado`, `predeterminado_anterior`, `aleatorio` e `incluido`, y con `propio` cuyo `estilo` es igual campo a campo a `ESTILO_PREDETERMINADO` o al `config.estilo_predeterminado` heredado (canciones migradas de 0.1.0). Es `false` con `cancion`, `album`, `artista` y `respaldo`. La portada de la Biblioteca la usa tal cual (§9). Es la regla de la [spec 02, «Tarjeta: tema y portada»](../ux/02-biblioteca.md#tarjeta-tema-y-portada) y de [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §3; sustituye a la propuesta provisional de este ADR, que también contaba los temas de álbum y artista. `predeterminado_anterior` cuenta como neutra porque la canción no recibió ninguna elección propia: solo conserva el predeterminado que seguía.
- **`alHeredar`** (destino de «Volver a heredar», `tema.heredar.destino` de la spec 06): `{ procedencia, temaId, temaNombre }` que daría la canción si heredara. Main lo calcula con la misma `resolverApariencia` sobre una copia de la canción con `apariencia = { modo: "heredar", base }`: sin `tema_id` y **conservando la `base`**, igual que hace «Volver a heredar» (§6). Se calcula para cualquier modo, aunque la interfaz solo lo muestra con procedencia `cancion`. Su procedencia nunca es `propio` ni `cancion`. Es `respaldo` solo si la base apunta a un tema que no existe; en ese caso `temaId` y `temaNombre` son los de la base (para diagnóstico) y la interfaz no los muestra: dice que el tema de origen no está y que se verá con el último aspecto guardado (spec 06, `tema.heredar.destino.respaldo`; [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)). Viaja en el resumen y en `resuelta` (§9). Cuesta una resolución más en O(1) por canción.
  - **Alternativa descartada**: calcularlo en el renderer con `resolverApariencia` de `shared/`. El renderer tendría que conocer la `base` y las asignaciones por clave. Además habría dos ejecutores de la resolución que podrían discrepar, por ejemplo con un catálogo en solo lectura o un tema en borrado. Eso contradice «main es la única autoridad». Exponerlo en el resumen además lo refresca con los mismos eventos que la procedencia, sin lógica nueva en el renderer.
- Los temas en borrado (§8) siguen resolviéndose hasta que se retiran. Es lo que permite que las copias congeladas coincidan con lo que se veía.
- **Fase 5**: la resolución devuelve siempre un estilo **completo**. Si la fase 5 añade reemplazos por canción (preferencias de espera reemplazables), entrarán como `apariencia.reemplazos`, con lista blanca de campos, y se fusionarán **después** del paso 2 o 3. Con `propio` no aplican porque ya están en `estilo`. La congelación (§8) guarda el resultado fusionado.

### 4. Claves de identidad y búsqueda flexible

`shared/identidad.ts`, compartido por main y renderer:

```
claveTexto(t)  = NFC( minusculas( NFC( colapsar( recortar(t) ) ) ) )   // "" → null
claveArtista(m) = claveTexto(m.artista)
claveAlbum(m)   = claveArtista(m) && claveTexto(m.album) ? { artista, album } : null
```

- `colapsar`: toda secuencia de espacios Unicode (`\s`, incluidos NBSP y U+3000) pasa a un espacio. `minusculas` es `String.prototype.toLowerCase()`, independiente de la configuración regional, para que la clave sea la misma en cualquier equipo. Se renormaliza a NFC porque bajar a minúsculas puede generar secuencias no compuestas (`İ` → `i̇`). Los diacríticos se conservan: «Canción» y «Cancion» son artistas o álbumes distintos.
- El **álbum pertenece al artista**: su identidad es el par. Un álbum sin artista se agrupa visualmente en «Sin artista», pero no admite asignación. «Sin artista» y «Sin álbum» son contenedores de vista y no entidades (R2). No existe asignación colectiva para metadatos ausentes.
- Limitaciones aceptadas: los homónimos reales del mismo artista se fusionan, y «Queen feat. X» es otro artista. `claves: 1` en el catálogo permite cambiar el algoritmo con una migración que recalcule las claves guardadas.
- **Búsqueda flexible** (renderer, `filtrado.ts`): sigue usando `normalizarBusqueda`, que quita marcas y pasa a minúsculas, y amplía los campos a título, artista y álbum. Nunca se usa como identidad.
- **Índice en memoria**: el resumen de cada canción incluye `album` y sus claves (§9). El renderer agrupa con esas claves sobre la lista que ya tiene en memoria. Main resuelve cada canción en O(1) con mapas `clave → tema_id` construidos al cargar el catálogo. Los impactos (§7) recorren el índice de canciones, que tiene cientos de entradas, sin estructuras adicionales. No hay SQLite ni metadatos duplicados.

### 5. Cola de apariencia y concurrencia

`ServicioTemas` serializa en **una cola única** todas las mutaciones que pueden cambiar una resolución:

- mutaciones del catálogo;
- cambios de apariencia de una canción (editor y lote);
- edición de metadatos (`biblioteca.actualizarMetadatos`, porque mueve la canción de grupo);
- **creación de canciones** (importación local y YouTube), porque fijan su base (§6).

Los cálculos de impacto y la marca de borrado se hacen dentro de la cola, en el mismo turno síncrono que la lectura del índice. Las escrituras de `cancion.json` siguen pasando por `ServicioBiblioteca.actualizar`, que conserva su cola por archivo. Los cambios ajenos a la apariencia, como letra, tiempos, pasos y separación, no esperan a esta cola.

### 6. Predeterminado y tema aleatorio al crear

- **Ajustes** elige `predeterminado`: un tema del catálogo o `null`, que es «Estilo aleatorio» ([R4 UX](../versiones/0.2.0/discusion/r4-disenador-ux.md)). Cambiarlo es una operación con impacto (§7). No convierte estilos propios ni toca canciones con tema propio, de álbum, de artista o con una `base` fijada. Decisión del usuario en [0052](../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md):
  - **A1 · de un tema X a otro Y**: las canciones que hoy resuelven con procedencia `predeterminado` pasan a Y. Es una sola escritura del catálogo, tras confirmar el recuento.
  - **B1 · de X a `null`**: las canciones que hoy resuelven con procedencia `predeterminado` **conservan X y siguen vinculadas a él**. La misma operación confirmada fija en cada una `base: { tipo: "predeterminado_anterior", tema_id: X }` y después escribe `predeterminado: null`. Si luego se edita X, cambian con él. Si se borra X, se congelan como cualquier canción que lo usa (§8).
    - **Orden y fallos**: primero las canciones, una a una, por `ServicioBiblioteca.actualizar` (que refresca su instantánea); al final, una escritura del catálogo. Mientras X siga siendo el predeterminado, una canción con esa base resuelve a X igual que antes (el paso 3.3 de §3 precede al 3.4), así que un fallo a mitad no cambia el aspecto de nadie. Solo cambia la procedencia de las ya escritas, que pasan a «Tema predeterminado anterior». Si falla una escritura de canción, la operación se detiene **sin** escribir el catálogo y devuelve el resultado por canción. Reintentar (nueva previsualización) solo cuenta las que faltan, porque las ya escritas tienen base y ya no resuelven como `predeterminado`. No hace falta diario.
    - Solo se fija la base a las que resuelven **ahora** como `predeterminado`. Las que heredan de su álbum o artista no se tocan (no cambia su aspecto y escribirlas no aportaría nada visible). Si después se les quita el tema del grupo, siguen al predeterminado vigente o, si no hay, al estilo incluido; el diálogo del grupo lo muestra antes de confirmar.
  - **C1 · de `null` (o de X) a un tema nuevo**: no cambia las canciones con `base` fijada (`aleatorio`, `predeterminado_anterior` o `incluido`). Solo afecta a las que no tienen base.
  - «Volver a heredar» y «Temas definidos» conservan la `base`, sea cual sea su tipo. Para cambiar de golpe esas canciones está «Aplicar tema…» en la Biblioteca.
- **Al crear una canción**, dentro de la cola:
  - si hay predeterminado → `{ modo: "heredar" }`;
  - si no, y el catálogo tiene temas que no están en borrado → `{ modo: "heredar", base: { tipo: "aleatorio", tema_id: <uno al azar> } }`, con `crypto.randomInt` y probabilidad uniforme;
  - si el catálogo está vacío → `{ modo: "heredar", base: { tipo: "incluido" } }`.

  En los tres casos `estilo` = la resolución en ese momento, con la precedencia de álbum y artista.
- **Estabilidad**: la elección se guarda en `base`, así que la canción conserva la misma apariencia al reabrir. El artista y el álbum tienen precedencia (§3). Un predeterminado elegido más tarde **no** sustituye a una base ya fijada (C1 de 0052).

### 7. Operaciones con impacto: previsualizar y ejecutar

Las operaciones que cambian la apariencia de canciones que el usuario no tiene delante se hacen en dos pasos:

1. `temas.previsualizar(op)` devuelve un **impacto** (`ImpactoIpc`):
   - `ficha`: opaca (UUID);
   - `afectadas`: por canción `{ id, titulo, artista, antes, despues, efecto }`, donde `antes` y `despues` son `{ procedencia, temaId, temaNombre }` y `efecto` es `cambia` (cambia el aspecto), `fija_base` (B1: conserva el aspecto) o `sin_cambios` (solo en `aplicar`, «Ya tiene asignado»). Ordenadas por título con la comparación del idioma. Al quitar el tema de un grupo, `despues.procedencia` puede ser `respaldo` (base que apunta a un tema inexistente, igual que `alHeredar`), con `efecto: cambia`; la interfaz no nombra ningún tema en ese caso (spec 02, B5b);
   - `desglose`: recuento de las afectadas por procedencia **actual** `{ cancion, album, artista, predeterminado, aleatorio, predeterminadoAnterior, propio, respaldo, incluido }`. Es lo que pintan las líneas del diálogo de impacto (las de álbum y artista se suman en una sola línea en la interfaz);
   - `excluidas`: recuento por motivo `{ propio, cancion, album }` (personalizadas, con tema asignado y, en `asignarGrupo` de artista, con tema de álbum) más `danadas` y `noExisten` en `aplicar`;
   - `totalGrupo`: en `asignarGrupo`, número de canciones del grupo (el «de sus {m}» de la spec 02);
   - `esPredeterminado`, `asignacionesRetiradas` (`{ artistas: [nombre], albumes: [{ artista, album }] }`) y `revisionTema`;
   - `sesionEnCurso`: siempre `false` en la fase 3 (una sola ventana, el reproductor resuelve al abrir). La fase 4 lo rellena para `tema.dialogo.guardar.sesion`.
2. `temas.ejecutar(op, ficha)`.

Main guarda en memoria `{ op canónica, impacto }` por ficha, con un máximo de 16 fichas y una caducidad de 10 minutos. Al ejecutar, dentro de la cola:

- exige que `op` sea idéntica a la previsualizada;
- recalcula el impacto;
- si difiere en canciones, efectos, revisión del tema o estado de predeterminado, responde **`CONFIRMACION_OBSOLETA`** con el impacto nuevo y su ficha, y no escribe nada. El renderer vuelve a presentar la confirmación. Una ficha caducada, desconocida o ya usada da el mismo error con un impacto recién calculado.
- **Excepción de `aplicar`** (lote, [spec 02](../ux/02-biblioteca.md#selección-múltiple-y-aplicar-tema), B10): las canciones las elige el usuario una a una, así que un cambio en una no invalida las demás. Main compara **por canción** el `antes` confirmado con el actual: si difiere, esa canción queda `omitida` con motivo `cambio` («Cambió mientras confirmabas»); si ya no existe o su `cancion.json` está dañado, `omitida` con `no_existe` o `danada`. Las demás se aplican. `CONFIRMACION_OBSOLETA` solo se da si la ficha no vale. Si el tema elegido ya no existe o está en borrado, no se aplica a ninguna (`TEMA_NO_ENCONTRADO` o `BORRADO_PENDIENTE`).

Las fichas son de un solo uso.

**Progreso**: `aplicar`, `borrar` (y `reanudarBorrado`) y `predeterminado` a `null` escriben varias canciones. Main emite el evento `temas:progreso { ficha, operacion, temaId, hechas, total }` tras cada canción, como mucho cada 100 ms y siempre al terminar:

- `ficha`: la de la operación confirmada, o `null` en `reanudarBorrado`, que no tiene ficha porque no se previsualiza;
- `operacion`: `"aplicar" | "borrar" | "predeterminado"`;
- `temaId`: el tema borrado, el aplicado o el predeterminado que se quita, o `null` en `aplicar` con `{ modo: "heredar" }`.

El renderer filtra por `ficha`. Con `reanudarBorrado` filtra por `ficha === null`, `operacion === "borrar"` y el `temaId` del borrado pendiente. Como la cola es única, no puede haber dos operaciones de varias canciones a la vez. `total` es el número de canciones que la operación va a escribir: en `borrar` incluye las que solo pierden su base (§8), así que puede superar al recuento del impacto. Lo usan «Aplicando… {i} de {n}», «Guardando el aspecto de {i} de {n} canciones…» y «Guardando {i} de {n} canciones…». No se puede cancelar a medias.

**Resultado** (`ResultadoOperacionIpc`): `{ catalogoEscrito: boolean, canciones: [{ id, titulo, artista, estado: "aplicada" | "sin_cambios" | "omitida" | "error" | "pendiente", motivo?: "cambio" | "no_existe" | "danada", codigo? }] }`.

- `titulo` y `artista` (revisión 3) son los del resumen de la canción en el momento de la operación, con la misma forma que en `ImpactoIpc.afectadas` (cadenas; vacías si no hay dato). Main ya los tiene porque calcula el conjunto a partir de los resúmenes, también al reanudar un borrado. Así la lista tras un fallo a mitad (spec 06) nombra cada canción sin cruzar el resultado con el impacto, que no existe en `reanudarBorrado` y que en `borrar` no incluye las canciones que solo pierden la base. Si una canción `omitida` con `no_existe` ya no tiene resumen, main usa el `titulo`/`artista` del impacto confirmado. El renderer muestra «Sin artista» con `artista` vacío y `bib.danada.sintitulo` con `titulo` vacío.
- `codigo` es un código de error de `shared/errores.ts` sin rutas («Copiar detalles» lo usa). Es obligatorio en `error`.
- Las operaciones de una sola escritura del catálogo devuelven la lista vacía.
- **Operaciones que se detienen en el primer fallo** (`predeterminado` a `null`, `borrar` y `reanudarBorrado`): `canciones` lista **todas** las que la operación iba a escribir, en orden. Las escritas van como `aplicada`, la que falló como `error` con `codigo` y las que no se llegaron a intentar como `pendiente`. Hay **exactamente una** `error` y va antes de todas las `pendiente`. Con eso el renderer pinta la «Lista de canciones tras un fallo a mitad» (spec 06, [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)) sin cruzar listas: nombra la canción `error` en el texto principal, usa «Faltan {f}» con f = `error` + `pendiente` y lista solo esas filas en el orden del resultado. No usa «{k} de {n}», porque al reintentar o reanudar main recalcula el conjunto y `n` ya no es el del primer intento.
- `aplicar` sigue con las demás tras un error, así que nunca devuelve `pendiente`.

Operaciones (`op`, unión discriminada):

| `tipo` | Efecto | Cuenta como afectadas |
|---|---|---|
| `editar` `{ temaId, revisionTema, estilo }` | Sustituye el estilo del tema (una escritura del catálogo). No reescribe canciones. | Las canciones que resuelven a ese tema por cualquier nivel. Los estilos propios y los niveles superiores quedan fuera. |
| `borrar` `{ temaId }` | §8 | Ídem, más el aviso de predeterminado y las asignaciones que se retiran |
| `aplicar` `{ cancionIds[1..2000], seleccion: { modo: "tema", temaId } \| { modo: "heredar" } }` | Escribe la selección de cada canción (nivel canción). No toca asignaciones de artista ni de álbum. | Todas las indicadas, con efecto «sustituye estilo propio», «sustituye otro tema» o «sin cambios». Excluidas: inexistentes y dañadas por JSON. |
| `asignarGrupo` `{ nivel: "artista" \| "album", artista, album?, temaId \| null }` | Escribe o quita la asignación (una escritura del catálogo). `artista` y `album` llegan como texto visible y main deriva la clave. | Las canciones del grupo que heredan y cambiarían de resultado |
| `predeterminado` `{ temaId \| null }` | Con un tema: cambia `predeterminado` (una escritura del catálogo, A1). Con `null`: fija `base: predeterminado_anterior` en cada afectada y después escribe el catálogo (§6, B1) | Las que heredan **sin base** y sin tema de álbum ni de artista: hoy procedencia `predeterminado` o, si no había predeterminado, `incluido` por el paso 3.5. Efecto `cambia` hacia un tema y `fija_base` hacia `null`. Las de `base` fijada no cuentan (C1) |

- **`editar`**: `revisionTema` protege contra dos ediciones cruzadas. Una revisión distinta da `CONFIRMACION_OBSOLETA`. Las sesiones de reproducción ya iniciadas, y las exportaciones de la fase 6, conservan su instantánea porque resuelven al empezar (§9).
- **`aplicar`** (lote): main procesa las canciones en orden y escribe cada una con su resultado. No hay transacción entre archivos. Las escritas permanecen aunque falle una posterior. El resultado lista por id `aplicada`, `sin_cambios`, `omitida` (con motivo) o `error` (con código), y el renderer ofrece reintentar solo las fallidas (R4). Una sola canción desde el editor no pasa por aquí (§10).
- **Operaciones sin impacto**, de un solo paso:
  - `temas.crear({ nombre, estilo })`, para «Guardar como tema nuevo…» y «Guardar como tema…»: crea el tema y **no** lo aplica. Aplicarlo a la canción de origen es un segundo paso explícito;
  - `temas.renombrar({ temaId, revisionTema, nombre })`;
  - `temas.duplicar({ temaId, nombre })`: id nuevo, mismo estilo y sin asignaciones.

### 8. Borrar: congelar primero y retirar después, de forma recuperable

1. **Confirmación**: previsualizar y ejecutar (§7). El impacto cuenta las canciones que resuelven efectivamente al tema, incluidas las que lo heredan de álbum, artista, aleatorio, predeterminado anterior o predeterminado. Los estilos propios y los niveles superiores quedan fuera.
2. **Diario**: dentro de la cola, main escribe el catálogo con `borrado_pendiente = { tema_id, iniciado, canciones: [ids del impacto] }`. El tema sigue presente y deja de ofrecerse: no se asigna, no entra en el sorteo aleatorio y no se elige como predeterminado. Si esta escritura falla, no ha cambiado nada y se informa del error.
3. **Congelación**, canción a canción, de forma idempotente:
   - cada canción que **en ese momento** resuelve al tema pasa a `{ modo: "propio" }`, con `estilo` = su apariencia resuelta completa («Tema personalizado»);
   - a las canciones cuya `base` es `aleatorio` o `predeterminado_anterior` con ese tema y que heredan de un nivel superior se les quita `base`. Después siguen al predeterminado. No cambia su aspecto, así que no cuentan en el impacto, pero sí se escriben en este paso (y cuentan en el progreso).

   El conjunto se **recalcula** al reanudar. No se fía solo de la lista del diario, porque una canción pudo cambiar o crearse en el álbum mientras tanto. La lista sirve para el informe.
4. **Retirada**: una sola escritura del catálogo que quita el tema, sus asignaciones de artista y álbum, `predeterminado` si apuntaba a él (pasa a `null`, «Estilo aleatorio») y `borrado_pendiente`.
5. **Fallo a mitad**: si falla una escritura del paso 3, la operación se detiene. El tema sigue en el catálogo, en estado «borrado pendiente», y el resultado informa de cuántas canciones se convirtieron y cuáles fallaron.
   - `temas.reanudarBorrado()` repite desde el paso 3.
   - `temas.cancelarBorrado()` quita el diario. Las canciones ya convertidas siguen como «Tema personalizado», con la misma apariencia y sin pérdida.
   - Al arrancar, si hay `borrado_pendiente`, main **no** reanuda solo. Lo expone en `temas.catalogo()` para que la interfaz lo muestre (UX, [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §5). Mientras tanto la resolución sigue funcionando porque el tema sigue presente.
6. Un cierre de la app entre los pasos 3 y 4 deja un estado verificable: el diario, las copias ya escritas y el tema todavía presente. Ninguna canción se queda sin apariencia en ningún momento.

### 9. Lo que recibe el renderer

- **`ResumenCancion`** (`biblioteca.listar` y eventos) añade:
  - `album: string | null`;
  - `claves: { artista: string | null, album: string | null }`;
  - `apariencia: { modo, procedencia, temaId: string | null, temaNombre: string | null, neutra: boolean, alHeredar: { procedencia, temaId: string | null, temaNombre: string | null } }` (`alHeredar`, §3).

  `estilo` pasa a ser el estilo **resuelto**. **Portada**: miniatura con velo si `miniatura` no es `null` (canción de YouTube) y `apariencia.neutra`; si no, el estilo resuelto (§3, `neutra`). El renderer deja de leer `config.estilo_predeterminado` para decidirlo.
- **`biblioteca.obtener(id)`** devuelve la canción con `apariencia` y `estilo` tal como están en disco, más `resuelta: { estilo, procedencia, temaId, temaNombre, alHeredar }`. El editor usa los dos.
- **Datos vivos del editor**: la procedencia, el tema efectivo, `alHeredar` y el estilo resuelto pueden cambiar mientras el editor está abierto. Pasa al asignar un tema al álbum o al artista, al cambiar el predeterminado o al editar los metadatos. El editor los toma del **resumen vivo** de su canción, igual que hoy toma el estado de la canción:
  - al abrir, del resumen de `biblioteca.listar()`;
  - en la respuesta de `guardarApariencia` y en cada `cancion:cambiada` de su id;
  - tras cada `temas:cambiado`, de una nueva llamada a `biblioteca.listar()`.

  `resuelta` solo sirve para la carga inicial. No hace falta un canal nuevo. El reproductor y la vista previa pintan `resuelta.estilo`, que es la **instantánea de la sesión**, tomada al abrir. La fase 4 resuelve al consumir cada entrada de la cola y la fase 6 al iniciar la exportación.
- **Evento `temas:cambiado`** con el catálogo tras cada mutación. El renderer vuelve a pedir `biblioteca.listar()` para refrescar los estilos resueltos, porque es una sola llamada. Los cambios de apariencia de una canción emiten el `cancion:cambiada` habitual.
- **Usos y desglose en el catálogo** (`CatalogoIpc`). Main los calcula en cada `temas.catalogo()` y en cada `temas:cambiado`, recorriendo el índice (O(n) con cientos de canciones):
  - por tema, `usos: { total, cancion, album, artista, predeterminado, aleatorio, predeterminadoAnterior }`, con las canciones cuya resolución da ese tema (`tema.usos`, `aj.temas.usos`, `aj.temas.predet.usos`). Las dañadas por JSON no cuentan;
  - por tema, `grupos: { artistas: [nombre visible], albumes: [{ artista, album }] }` (`aj.temas.grupos`);
  - `predeterminadoUsos`: canciones que hoy siguen al predeterminado (las que contaría la operación `predeterminado`).
  
  Como los usos cambian también con escrituras de canciones, main vuelve a emitir `temas:cambiado`, **agrupado en 250 ms**, cuando cambia el índice por apariencia, metadatos, creación, papelera o restauración. Las escrituras de letra, tiempos o separación no lo emiten.
- **Referencias que faltan** (`aj.temas.faltan`): es calculable y main lo da en `CatalogoIpc.referenciasFaltantes` = número de canciones (no dañadas por JSON) cuya resolución es `respaldo` porque su `tema_id` o el de su `base` no está en el catálogo. Los grupos no pueden faltar: una asignación siempre apunta a un tema existente porque el catálogo es válido por construcción (§1). Si el catálogo está en solo lectura vale `0`, porque ese caso ya lo explica `aj.temas.soloLectura`. Desaparece sola cuando vuelve el tema.
- **Catálogo apartado**: `CatalogoIpc.apartado: string | null` (fecha) y `temas.descartarAvisoApartado()` (§1).
- **Preferencia «Agrupar por»** de la Biblioteca: `config.biblioteca.agrupar: "ninguno" | "artista" | "album"`, con lectura tolerante (`.catch("ninguno")`), igual que `config.editor.paneles` ([ADR 0006, revisión de la subfase 2.1](0006-persistencia-y-modelo-de-datos.md#revisión-para-020--preferencias-de-paneles-del-editor)). Se escribe con el canal existente `config.actualizar` (`configParcialRendererSchema` admite `biblioteca.agrupar` con el enum estricto). El plegado de grupos es de sesión y no se persiste.

### 10. Editor

- **`biblioteca.guardarApariencia(id, seleccion)`** sustituye a `guardarEstilo`. `seleccion` puede ser:
  - `{ modo: "propio", estilo }`: «Personalizar», que escribe solo el estilo local;
  - `{ modo: "tema", temaId }`: aplicar un tema a la canción;
  - `{ modo: "heredar" }`: volver a heredar.

  Pasa por la cola de apariencia y conserva `base`. Mantiene el *debounce* del renderer y la escritura inmediata en main del ADR 0010. El historial del editor guarda la selección en lugar del estilo suelto. Deshacer la vuelve a enviar.
- **«Editar tema»** trabaja sobre un borrador del tema en memoria del renderer. No entra en el autoguardado de la canción. Sus pasos sí entran en el historial de la visita, como pide la spec 06, y deshacer nunca escribe en el catálogo. Avisar al cerrar la ventana con un borrador es viable sin cambios en main. Mientras el borrador tenga cambios, el renderer declara `app.guardadoPendiente(true)`. Main ya intercepta el cierre y espera a `app.confirmarCierre()` sin plazo propio, porque el tope de 2 s es del vaciado en el renderer. El renderer muestra su diálogo y confirma después. Un cierre forzado o un fallo pierden el borrador, que nunca se persiste. Solo persiste con `editar` (confirmando el impacto) o con `temas.crear` (guardar como nuevo).
- «Usar este estilo en canciones nuevas» y «Restablecer estilo predeterminado» dejan de usar `config.estilo_predeterminado`. Los sustituyen las acciones de la spec (por ejemplo, guardar como tema y elegirlo en Ajustes, o volver a heredar).

### 11. Contratos IPC nuevos

Todos siguen el [ADR 0008](0008-seguridad-de-electron-y-protocolos-propios.md):

- argumentos en tupla validados con Zod en main;
- remitente comprobado (ventana de la app, *frame* principal y origen del renderer);
- respuestas `{ ok, valor | error }`;
- sin rutas en las respuestas.

Los nombres de canal van en `shared/canales.ts` y los esquemas en `shared/ipc.ts`.

| Canal | Argumentos | Respuesta |
|---|---|---|
| `temas.catalogo` | — | `CatalogoIpc`: temas (id, nombre, revisión, estilo, `usos`, `grupos`, `enBorrado`), predeterminado, `predeterminadoUsos`, asignaciones con nombres visibles, `borradoPendiente` (tema, total, restantes), `soloLectura`, `apartado` y `referenciasFaltantes` (§9) |
| `temas.descartarAvisoApartado` | — | `void` (escribe `apartado: null`) |
| `temas.previsualizar` | `op` | `ImpactoIpc` |
| `temas.ejecutar` | `op`, `ficha: uuid` | `ResultadoOperacionIpc` (por canción y catálogo) |
| `temas.crear` | `{ nombre, estilo }` | `TemaIpc` |
| `temas.renombrar` | `{ temaId, revisionTema, nombre }` | `TemaIpc` |
| `temas.duplicar` | `{ temaId, nombre }` | `TemaIpc` |
| `temas.reanudarBorrado` / `temas.cancelarBorrado` | — | `ResultadoOperacionIpc` / `void` |
| `biblioteca.guardarApariencia` | `idCancion`, `seleccion` | `ResumenCancionIpc` |
| evento `temas:cambiado` | — | `CatalogoIpc` |
| evento `temas:progreso` | — | `{ ficha: uuid \| null, operacion, temaId: uuid \| null, hechas, total }` (§7) |

- **Límites Zod**:
  - `temaId`: `z.uuid()`;
  - `nombre`: texto transformado (NFC, recortado y con espacios colapsados) de 1 a 60 caracteres;
  - `estilo`: `estiloSchema`;
  - `cancionIds`: de 1 a 2000 elementos únicos con `idCancionSchema`;
  - `artista`/`album`: de 1 a 200 caracteres con clave no vacía.
- **Códigos nuevos**, solo de main: `CONFIRMACION_OBSOLETA` (con el impacto nuevo en `detalles` serializado), `TEMA_NO_ENCONTRADO`, `TEMA_NOMBRE_DUPLICADO`, `TEMAS_SOLO_LECTURA` (catálogo de un esquema más nuevo) y `BORRADO_PENDIENTE` (no se admite otra operación sobre ese tema mientras dure).
- **Fase 4**: cuando existan roles de ventana, `temas.*` y `guardarApariencia` se admiten solo desde la ventana principal. La secundaria no escribe apariencias.

### 12. Consumo en la fase 5

- El tema guarda un `estilo` completo validado con el mismo `estiloSchema` que la canción. Cuando la fase 5 amplíe el estilo con degradados lineal, radial y cónico, movimiento y comodines de espera, la migración del estilo (v1 → lineal estático y comodines heredados) vivirá en `shared/estilo.ts` y se aplicará igual a canciones, instantáneas y temas. Si el cambio es incompatible para 0.1.0, el ADR de estilo ampliado decidirá si sube `esquema` del catálogo y de la canción.
- Los reemplazos por canción de las preferencias de espera usarán `apariencia.reemplazos` (§3) sobre el tema resuelto, no copias del tema.
- La comprobación del peor contraste se hace sobre el estilo resuelto, igual en el editor y en el reproductor.

## Consecuencias

- **Positivas**:
  - Un catálogo pequeño y autocontenido, junto a las canciones, con un solo escritor.
  - Las bibliotecas de 0.1.0 se abren sin reescribirse y conservan su apariencia.
  - Una carpeta copiada a otra instalación se ve igual.
  - Las confirmaciones no quedan obsoletas en silencio.
  - Borrar un tema nunca deja canciones sin apariencia y se puede reanudar.
  - Sin dependencias nuevas: Zod, `node:crypto` y la persistencia existente.
- **Negativas / riesgos**:
  - `estilo` tiene doble significado según `modo`. Hay que documentarlo en el tipo y probarlo.
  - La instantánea de respaldo puede estar atrasada si el tema se editó después de la última escritura de la canción. Solo se ve cuando falta la referencia, y se presenta como «respaldo».
  - Una operación en lote no es atómica entre archivos y se informa por canción.
  - La cola de apariencia serializa la creación de canciones con las operaciones de temas. Un borrado con cientos de canciones retrasa unos segundos una importación que llegue en ese momento.
  - Los homónimos del mismo artista se fusionan.
  - Si la versión 0.1.0 reescribe una canción, pierde la referencia y la deja con estilo propio.
- **Legales**: ninguno. Los temas son datos del usuario.
- **Impacto en UX** (specs [02](../ux/02-biblioteca.md), [06](../ux/06-editor.md), [08](../ux/08-ajustes-y-acerca.md), [sistema visual](../ux/sistema-visual.md) y [mapa](../ux/00-mapa-de-vistas.md)):
  - procedencias `propio`, `cancion`, `album`, `artista`, `aleatorio`, `predeterminado_anterior`, `predeterminado`, `incluido` y `respaldo`. Los textos de `predeterminado_anterior` en el editor y en la tarjeta están fijados en [0055](../preguntas/0055-textos-de-predeterminado-anterior-y-ajustes-de-la-fase-3.md) (respondida). El destino `respaldo` (de `alHeredar` y de `despues`) y las canciones `pendiente` se presentan como dice [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md) (respondida): sin nombre de tema y con la lista común tras un fallo a mitad;
  - confirmación obsoleta, borrado pendiente, catálogo en solo lectura y resultados por canción en lote.
  - Detalles abiertos en [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md).
- **Pruebas**:
  - Vitest: resolución en todos los niveles y procedencias, claves (NFC/NFD, NBSP, `İ`, «Canción»/«Cancion», mayúsculas), `neutra`, usos y referencias que faltan, impactos, fichas obsoletas, lote con omisión por canción, quitar el predeterminado (B1) con fallo a mitad, diario de borrado con fallos inyectados en cada paso y reanudación, y sorteo con `randomInt` inyectable.
  - E2E: biblioteca de esquema 1 abierta sin reescritura (tiempos y estilos intactos byte a byte), edición y reapertura, quitar el predeterminado sin cambio visible, borrado del predeterminado y canción nueva aleatoria, lote con fallo parcial, catálogo apartado y en solo lectura, y carpeta recuperada sin catálogo.

## Fuentes

- Unicode Standard Annex #15, *Unicode Normalization Forms* (NFC): https://unicode.org/reports/tr15/
- Unicode Standard §5.18, *Case Mappings* (minúsculas y plegado, y por qué renormalizar): https://www.unicode.org/versions/latest/core-spec/chapter-5/
- MDN `String.prototype.normalize` y `toLowerCase` (independiente de la configuración regional, frente a `toLocaleLowerCase`): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize , https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLowerCase
- MDN `Intl.Collator` (`sensitivity`): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator/Collator
- Node.js `crypto.randomInt`: https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback
- Zod 4, objetos y claves desconocidas (`z.object` las descarta): https://zod.dev/api#objects
- Decisión de producto: [0047](../preguntas/0047-temas-asignados-edicion-y-borrado.md). Discusión: [R1](../versiones/0.2.0/discusion/r1-arquitecto.md), [R2](../versiones/0.2.0/discusion/r2-arquitecto.md), [R4](../versiones/0.2.0/discusion/r4-arquitecto.md).
