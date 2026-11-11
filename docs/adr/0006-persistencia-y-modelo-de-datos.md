# 0006 — Persistencia y modelo de datos: una carpeta por canción con `cancion.json`

- Estado: Aceptado
- Fecha: 2026-11-03
- Paso del pipeline: 5 (afecta a todos)

## Contexto
Cada canción atraviesa el pipeline (fuente → separación → letra → edición) y puede guardarse como **borrador** en cualquier punto y retomarse después; al final se marca como **lista** y aparece como reproducible en la biblioteca. Hay que decidir:
- Dónde se guardan audio, pistas, letra, estilo y estado.
- El esquema de la canción, con estado por paso y estado global.
- El formato del estilo (fondo sólido/degradado, color de letra, color de resaltado, fuente).

Restricciones: local, sin servidor, un solo usuario, bibliotecas de decenas o cientos de canciones, archivos de audio de decenas de MB por canción, procesos largos que pueden interrumpirse (ADR 0004).

## Alternativas consideradas
| Opción | Licencia | Pros | Contras |
|--------|----------|------|---------|
| A. **Carpeta por canción + `cancion.json`** (índice en memoria al arrancar) | — | Sin dependencias nativas; cada canción es autocontenida (copiar carpeta = copia de seguridad); fácil de depurar; escritura atómica sencilla. | Escanear la biblioteca al arrancar (despreciable para cientos de canciones); sin consultas complejas (no se necesitan). |
| B. SQLite (better-sqlite3 / `node:sqlite`) + archivos de audio en carpetas | Public domain / MIT | Consultas y transacciones. | `better-sqlite3` es módulo nativo a recompilar para Electron; `node:sqlite` aún madurando; metadatos separados de los archivos (riesgo de desincronización); innecesario para el MVP. |
| C. Un único `biblioteca.json` | — | Trivial. | Toda la biblioteca en un archivo: corrupción o conflicto de escritura afecta a todo. |
| D. IndexedDB/localStorage en el renderer | — | Sin código en main. | Inaccesible desde el worker y difícil de respaldar; no apto para archivos grandes. |

## Decisión
**Opción A.** Solo el **proceso principal** de Electron lee y escribe `cancion.json` (un único escritor). El worker Python recibe rutas y devuelve resultados por JSON Lines; nunca modifica el proyecto.

### Ubicación
Directorio base de datos de la app (local, no itinerante):
| SO | Ruta |
|----|------|
| Windows | `%LOCALAPPDATA%\ShinobiKaraoke\` |
| macOS | `~/Library/Application Support/Shinobi Karaoke/` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/shinobi-karaoke/` |

```
<base>/
├── config.json              # preferencias y estado de instalación
├── runtime/                 # entorno Python gestionado por uv (ADR 0001)
├── modelos/                 # pesos de separación (ADR 0004)
├── registros/               # logs rotados de la app y del worker
├── electron/                # perfil de Chromium (`userData`: cachés, Local Storage); no contiene datos del usuario (revisión 2026-11-04, tarea 0021)
└── biblioteca/
    ├── .importando/         # carpetas de preparación (oculta; se ignora al escanear y se vacía al arrancar)
    │   └── <id-uuid>/
    └── <id-uuid>/
        ├── cancion.json
        ├── cancion.json.bak # versión anterior (recuperación)
        ├── fuente/
        │   ├── mezcla.flac      # mezcla normalizada (FLAC 16 bits, 44,1 kHz, estéreo): entrada de la separación y pista "Original" del editor; permanente
        │   └── miniatura.jpg    # opcional (YouTube)
        └── pistas/
            ├── voz.flac
            └── instrumental.flac
```
- Escritura **atómica**: escribir `cancion.json.tmp` → `fsync` → copiar el actual a `.bak` → renombrar. Si al arrancar `cancion.json` no es válido, se intenta `.bak`; si tampoco, la canción se muestra como "dañada".
- Guardado automático (con *debounce* de ~1 s) de cada cambio del editor: "Guardar borrador" es explícito para el usuario pero los datos nunca dependen de pulsarlo.
- Borrar una canción = mover su carpeta a la papelera del sistema (`shell.trashItem`).
- **Creación de una canción** (respuesta a `preguntas/0005` §3): la importación de un archivo local se hace en `biblioteca/.importando/<id>/`; al confirmar el usuario, el proceso principal escribe `cancion.json` dentro y **renombra** la carpeta a `biblioteca/<id>/` (atómico en el mismo disco). Si el usuario abandona, se borra. Al arrancar se vacía `.importando/`. Las canciones de YouTube se crean directamente en `biblioteca/<id>/` al confirmar (antes solo se consulta la información, sin archivos). El escaneo ignora las entradas que empiezan por punto.
- El archivo original importado o descargado **no se conserva**: se borra tras generar `mezcla.flac` (respuesta a `preguntas/0005` §12).
- Ocupación típica: ≈ 70–100 MB por canción de 4 min (mezcla + voz + instrumental en FLAC).

### Esquema `cancion.json` (versión 1)
Tiempos en **milisegundos enteros**; colores en `#RRGGBB` (sRGB); fechas ISO-8601 UTC.

```jsonc
{
  "esquema": 1,
  "id": "6f1c…-uuid",
  "creada": "2026-11-03T10:00:00Z",
  "modificada": "2026-11-03T10:20:00Z",
  "estado": "borrador",                 // "borrador" | "lista"

  "metadatos": {
    "titulo": "…", "artista": "…", "album": null,
    "duracion_ms": 215000
  },

  "fuente": {
    "tipo": "archivo",                  // "archivo" | "youtube"
    "nombre_original": "cancion.mp3",   // archivo: nombre del fichero importado (solo informativo; el archivo no se conserva)
    "url": null, "youtube_id": null,    // youtube
    "mezcla": "fuente/mezcla.flac",
    "miniatura": null,
    "ganancia_db": -2.5                 // normalización de sonoridad (ADR 0003)
  },

  "pistas": {
    "voz": "pistas/voz.flac",
    "instrumental": "pistas/instrumental.flac",
    "modelo": { "perfil": "calidad", "nombre": "mel_band_roformer_kim", "version": "…" }
  },

  "letra": {
    "origen": "lrclib",                 // "lrclib" | "manual" | "archivo"
    "lrclib_id": 12345,
    "offset_ms": 0,                     // desplazamiento global
    "lineas": [
      {
        "id": "l1",
        "tipo": "linea",                       // "linea" | "pausa"
        "texto": "Primera línea de la canción",
        "inicio_ms": 17120,                    // null = sin sincronizar
        "fin_ms": null,                        // null = fin automático (ADR 0005); número = fin fijado
        "palabras": [                          // null si no hay sincronía por palabra
          { "texto": "Primera", "inicio_ms": 17120, "fin_ms": 17600 }
        ]
      },
      {
        "id": "p1",
        "tipo": "pausa",                       // renglón vacío: separador de estrofa / instrumental
        "texto": "", "inicio_ms": null,        // inicio opcional (p. ej. marca vacía de un LRC)
        "fin_ms": null, "palabras": null
      }
    ]
  },

  "estilo": { /* ver abajo */ },

  "pasos": {
    "fuente":     { "estado": "completado", "actualizado": "…", "error": null },
    "separacion": { "estado": "en_curso",   "actualizado": "…", "error": null, "progreso": 0.42 },
    "letra":      { "estado": "pendiente",  "actualizado": null, "error": null },
    "edicion":    { "estado": "pendiente",  "actualizado": null, "error": null }
  }
}
```

### Estados
- **Por paso** (`pasos.*.estado`): `pendiente` | `en_curso` | `completado` | `error` | `interrumpido`.
  - `en_curso` solo existe para pasos con trabajo en segundo plano (`fuente` si es YouTube, `separacion`).
  - Al arrancar la app, cualquier `en_curso` sin proceso vivo pasa a `interrumpido` (reintentable).
  - Cancelar **por el usuario** devuelve el paso a `pendiente`. **Cerrar la app** con trabajos activos los cancela y deja el paso en `interrumpido` (mismo estado que al recuperar tras un cierre inesperado; `ux/04` §3 "Reabrir tras cierre"; revisión 2026-11-04).
  - `error` guarda `{ "codigo": "SIN_CONEXION", "mensaje": "…" }` con códigos estables para que la UX muestre textos propios.
- **Global** (`estado`): `borrador` | `lista`.
  - Para pasar a `lista` deben cumplirse: `fuente` y `separacion` completados (existen ambas pistas), y la letra tiene al menos un elemento `tipo: "linea"` y **todos** los elementos `tipo: "linea"` tienen `inicio_ms` (las pausas no cuentan). `edicion` pasa a `completado` en ese momento.
  - Una canción `lista` **nunca vuelve sola a borrador**: volver a borrador es una acción explícita del usuario. Si una edición deja líneas sin inicio, sigue `lista` y la app deriva (no guarda) el indicador **`incompleta`**; el reproductor omite las líneas sin inicio y la UX muestra el aviso (respuesta a `preguntas/0005` §8). Si faltan las pistas, la canción se presenta como "dañada".
- **Invariantes de la letra** (validados al leer y al escribir): `inicio_ms` **estrictamente** crecientes entre los elementos que lo tienen (dos inicios iguales son inválidos); si `fin_ms` no es `null`, `inicio_ms < fin_ms ≤ inicio_ms` del siguiente elemento con inicio; una `pausa` tiene `texto: ""` y `palabras: null`; no hay dos pausas seguidas ni pausas al principio o al final; `palabras` solo puede ser no nulo si la línea tiene `inicio_ms`, con inicios de palabra crecientes, `inicio < fin` en cada una, la primera ≥ inicio de la línea y el fin de la última ≤ inicio del siguiente elemento con inicio (los conversores de la Fase 4 recortan o descartan las palabras que no lo cumplan). Además (revisión 2026-11-04): los `id` de los elementos son únicos en la letra; `fin_ms` no nulo exige `inicio_ms`; una lista de palabras vacía es inválida (sin palabras = `null`); el fin de una palabra no se compara con el inicio de la siguiente (solapes tolerados: el resaltado usa los inicios).
- **Edición de tiempos con palabras** (`ux/06` criterio 7d): mover el inicio de una línea desplaza sus palabras el mismo delta; borrar sus tiempos borra también los de sus palabras (`palabras: null`). Si tras mover las palabras no caben, se descartan. Funciones puras `moverInicioLinea` y `borrarTiemposLinea` en `app/src/shared/` (tarea 0006). `moverInicioLinea` lanza `RangeError` si el nuevo inicio no queda estrictamente entre los inicios vecinos (o si el id no es una línea): es un error de programación, el editor limita el valor antes de llamar; devuelve `{ letra, palabrasDescartadas, finesAutomaticos }` y también anula el fin fijado y descarta las palabras de la línea anterior si dejan de caber.
- **Paso actual (derivado, no se guarda)**: el primer paso no `completado` en orden fuente → separación → letra → edición. Corresponde a las etiquetas orientativas de `01-pipeline.md`: `borrador:fuente`, `borrador:separando` (separación `en_curso`), `borrador:letra`, `borrador:edicion`, `lista`. Nota: letra y edición pueden avanzar mientras la separación está `en_curso` (ADR 0004/0005).

### Formato del estilo
```jsonc
"estilo": {
  "version": 1,
  "fondo": {
    "tipo": "degradado",                // "solido" | "degradado"
    "color": "#1B1033",                 // solo si "solido"
    "angulo_grados": 135,               // solo si "degradado" (lineal)
    "paradas": [                        // 2 a 4 paradas, posicion 0..1
      { "color": "#1B1033", "posicion": 0 },
      { "color": "#5A1E6E", "posicion": 1 }
    ]
  },
  "letra": {
    "fuente": { "familia": "Atkinson Hyperlegible Next", "origen": "incluida" },  // "incluida" (MVP) | "sistema" (reservado)
    "color": "#FFFFFF",
    "color_resaltado": "#FFD400"
  }
}
```
- Se traduce directamente a CSS (`background: linear-gradient(...)`, `color`, resaltado con `background-clip: text` o capas superpuestas).
- Solo degradado **lineal** en el MVP (el radial es trivial de añadir si la UX lo pide).
- Tamaño de letra, sombra/contorno y posición no forman parte del estilo editable del MVP (fuera del alcance de `00-vision-y-alcance.md`); el reproductor usa valores fijos definidos por la UX. Si la UX los necesita, se añaden como campos opcionales en `estilo.version` 2.
- **Fuentes** (respuesta a `preguntas/0004`): en el MVP **solo** `origen: "incluida"`: 8 familias SIL OFL 1.1 empaquetadas en WOFF2, un peso por familia — Atkinson Hyperlegible Next 700 (predeterminada), Nunito 800, Montserrat 700, Oswald 600, Lora 700, Playfair Display 800, Bangers 400, Noto Sans 700. El valor `familia` es el nombre de la familia tal cual. `origen: "sistema"` queda **reservado** en el esquema (post-MVP: Local Font Access API) y el validador lo rechaza en el MVP; una `familia` incluida desconocida cae a la predeterminada.
- Un `estilo_predeterminado` en `config.json` se copia en cada canción nueva.

### `config.json`
```jsonc
{
  "esquema": 1,
  "instalacion": {
    "estado": "completa",               // "pendiente" | "en_curso" | "completa" | "dañada"
    "fases": { "motor": "completada", "componentes": "completada", "modelo": "completada" },
    "perfil_hardware": "cpu",           // "cpu" | "cuda" | "mps"
    "hardware": { "gpu": null, "vram_mb": null }
  },
  "separacion": {
    "modo": "automatico",               // "automatico" | "calidad" | "rapido" (Ajustes, respuesta a 0003)
    "modelos_descargados": ["rapido"],
    "factores_medidos": { "rapido": 1.2 } // min de proceso por min de audio (media móvil); refina las estimaciones
  },
  "reproductor": { "volumen": 0.8, "silenciado": false },
  "aviso_youtube_aceptado": "2026-11-03T10:00:00Z",
  "ultima_comprobacion_ytdlp": "2026-11-01T09:00:00Z",
  "estilo_predeterminado": { /* estilo, ver docs/ux/sistema-visual.md §8 */ }
}
```
- **Desde la revisión 2026-11-05**: `modo` es `calidad` (por defecto) o `rapido`; `automatico` se lee como `calidad`; nuevo campo `rapido_aceptado` (fecha ISO o `null`). Texto anterior: modo efectivo de separación = `modo` si no es `automatico`; si no, el del perfil (`cuda`/`mps` → `calidad`, `cpu` → `rapido`; **sin perfil detectado → `rapido`**, revisión 2026-11-04). Se resuelve **al empezar** cada separación (respuesta a `preguntas/0005` §10).
- Campos nuevos con valor por defecto se añaden sin subir `esquema` (lectura tolerante); solo un cambio incompatible sube la versión.
- Si `config.json` y su `.bak` son ilegibles, el archivo se aparta como `config.json.danado` (se registra como error) y se parte de los valores por defecto (revisión 2026-11-04, tarea 0008). Consecuencia: `instalacion.estado` vuelve a `pendiente`, así que el gestor de runtime (Fase 2) debe **detectar y reutilizar** un runtime y modelos ya presentes y válidos en lugar de reinstalar.

### Versionado
Campo `esquema` en cada archivo; al leer una versión anterior, el proceso principal migra en memoria y reescribe (con `.bak`). Los tipos TypeScript del esquema viven en `app/src/shared/` y se validan al leer (p. ej. con un validador de esquemas MIT).

## Consecuencias
- Positivas: sin dependencias nativas; canciones autocontenidas y fáciles de respaldar; un único escritor evita corrupción; estados explícitos que permiten retomar cualquier borrador.
- Negativas / riesgos: rutas relativas a la carpeta de la canción obligan a disciplina en el código; sin búsqueda indexada (irrelevante en el MVP); el directorio de datos no es elegido por el usuario (posible problema si el disco del sistema es pequeño — cambiarlo sería una mejora post-MVP).
- Impacto en UX:
  - La biblioteca puede mostrar por canción: estado global, paso actual derivado, progreso en curso, error e interrumpido.
  - Autoguardado: no hay "cambios sin guardar" que perder.
  - Canciones dañadas o con pistas borradas deben tener un estado visible.
  - Borrar canción envía a la papelera (recuperable).

## Revisiones
- 2026-11-03 (tras `preguntas/0004` y `0005`): `fuente/mezcla.flac` permanente en lugar de `original.*` + `trabajo.wav`; carpeta de preparación `.importando/`; campo `tipo` (`linea`/`pausa`) y semántica de `fin_ms: null`; indicador derivado `incompleta`; solo fuentes incluidas en el MVP; `config.json` con `separacion` y `reproductor`.
- 2026-11-04 (tras `preguntas/0006`): invariantes de `palabras` y regla de edición de tiempos con palabras (se mueven y se borran con su línea). No cambia el esquema (sigue en versión 1).
- 2026-11-04 (revisión de cierre de la Fase 1; decisiones de las tareas 0006, 0008, 0009 y 0014 aceptadas): inicios estrictamente crecientes, ids únicos, lista de palabras vacía inválida; contrato de `moverInicioLinea` (`RangeError`); `config.json.danado` y valores por defecto; modo automático sin perfil → `rapido`; cierre de la app con trabajos → `interrumpido` (cancelación del usuario → `pendiente`); el paso `en_curso` → `interrumpido` al arrancar actualiza `actualizado` pero no `modificada` (no reordena la biblioteca); perfil de Chromium en `<base>/electron/` (tarea 0021). `vistaAlContinuar(cancion, { progresoVisto })`: "ya vista" es estado de sesión del renderer y no se persiste. Esquema sin cambios (versión 1).
- 2026-11-04 (respuesta a [`preguntas/0014`](../preguntas/0014-interrupcion-de-la-actualizacion-de-yt-dlp-y-plataformas-emuladas.md) §3): **sustitución de la fuente**.
  - Condiciones: una canción con `pasos.fuente` en `pendiente`, `error` o `interrumpido`, sin trabajo vivo y sin `fuente/mezcla.flac`.
  - Qué cambia: la `fuente` completa (otro vídeo de YouTube, o un archivo local materializado en su carpeta).
  - Qué se conserva: id, carpeta, estilo, metadatos editables y `letra.json`.
  - Orden de escritura: primero la miniatura nueva (`.tmp` + `rename`), o se borra la anterior; después `cancion.json` en una sola escritura atómica.
  - Una fuente `completado` no se sustituye.
  - Riesgo anotado para la Fase 4: la letra conservada puede no cuadrar si la duración nueva difiere más de 2 s.
  - Esquema sin cambios (versión 1).
- 2026-11-05 (`preguntas/0018`, ADR 0004 Revisiones): `config.separacion.modo` admite `calidad` | `rapido` (por defecto `calidad`). Un `automatico` guardado se lee como `calidad` y se reescribe así en el siguiente guardado (lectura tolerante, sin subir `esquema`). Nuevo `separacion.rapido_aceptado: string | null` (fecha ISO del consentimiento para el modelo Rápido; por defecto `null`). Un `rapido` en `modelos_descargados` sin consentimiento no se usa. Sustituye la regla "modo automático sin perfil → `rapido`".
- 2026-11-05 (desglose de la Fase 4):
  - **La letra vive en el campo `letra` de `cancion.json`**, como en el esquema. No existe un archivo `letra.json`; donde la revisión 2026-11-04, `preguntas/0014` y las tareas 0042 y 0049 dicen "`letra.json`", se refieren a ese campo.
  - **Regla de `pasos.letra`**:
    - Está `completado` si la letra tiene al menos un elemento `tipo: "linea"`; si no, `pendiente`. Nunca está `en_curso` ni en `error`, porque la búsqueda no es un trabajo.
    - Se recalcula, y se actualiza `actualizado`, en cada guardado de la letra.
  - **Escritor único**: guardar una letra, sustituirla o editar su texto pasa siempre por el proceso principal (`letras.*`, tarea 0077). Antes de escribir se normaliza (ADR 0005), se generan ids nuevos (salvo al editar, donde las líneas emparejadas conservan el suyo) y se valida con `letraSchema`.
  - Una canción `lista` no puede quedarse sin líneas al editar el texto: el main lo rechaza (provisional, `preguntas/0022` §2).
  - Esquema sin cambios (versión 1).

- 2026-11-05 (desglose de la Fase 5, [ADR 0010](0010-editor-motor-de-audio-reloj-y-guardado.md)):
  - Los tiempos y `offset_ms` los escribe `ServicioLetras.guardarTiempos`, que sigue siendo el único escritor de `letra`. Solo cambian tiempos; textos, ids y orden no.
  - El estilo lo escribe `ServicioBiblioteca.guardarEstilo`.
  - "Marcar como lista" se expone por IPC (`biblioteca.marcarLista`).
  - El *debounce* del editor (1 s, como mucho 2 s) está en el renderer y el main escribe al momento.
  - `offset_ms` en ±30 000 ms, validado al guardar (no en la lectura).
  - `estiloSchema` exige paradas del degradado con posición no decreciente.
  - Nuevo código `LETRA_DESACTUALIZADA`, que solo genera el main.
  - Esquema sin cambios (versión 1).

## Fuentes
- Electron `app.getPath` y `shell.trashItem`: https://www.electronjs.org/docs/latest/api/app , https://www.electronjs.org/docs/latest/api/shell
- XDG Base Directory: https://specifications.freedesktop.org/basedir-spec/latest/
- Local Font Access API: https://developer.mozilla.org/en-US/docs/Web/API/Local_Font_Access_API
- CSS `linear-gradient` y `background-clip: text`: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient , https://developer.mozilla.org/en-US/docs/Web/CSS/background-clip
- SIL Open Font License: https://openfontlicense.org/

## Revisión para 0.2.0 · Picos de voz

La carpeta de canción admite una caché regenerable junto a la pista vocal. Main la invalida al cambiar la pista y publica solo un resultado completo. El worker escribe un temporal autorizado. La caché no se incluye en el esquema de `cancion.json`, no cambia el estado del pipeline y puede omitirse de copias de seguridad. Ver [ADR 0015](0015-linea-de-tiempo-y-picos-de-voz.md).

## Revisión para 0.2.0 · Preferencias de paneles del editor

Subfase 2.1, tarea 0155. Fecha: 2026-11-08. La distribución del editor es una preferencia **global** de la instalación, igual que `reproductor.volumen`. Vive en `config.json` y no en `cancion.json`. Es un campo nuevo con valores por defecto, así que `esquema` sigue en 1.

```jsonc
"editor": {
  "paneles": {
    "lista":        { "ancho": 300, "minimizado": false },  // entero, 256–480 px
    "panel":        { "ancho": 360, "minimizado": false },  // entero, 300–480 px
    "linea_tiempo": { "alto": null, "minimizado": false }   // null = por defecto (216, o 204 en compacto); entero, 176–960 px
  }
}
```

- **Unidades.** Píxeles CSS a zoom 100 % (1 rem = 16), redondeados a entero. Se guarda el tamaño **preferido** y nunca el efectivo. El alto es el de la sección de la línea de tiempo, sin el transporte.
- **Límites absolutos.** Las constantes van en `app/src/shared/paneles.ts`, fuente única para el esquema y para el modelo de distribución. El mínimo de `alto` es el compacto (176). En modo normal el modelo aplica `max(188, alto)`. El máximo absoluto de `alto` (960) solo sirve para validar: el efectivo siempre deja 136 px a la zona superior.
- **Lectura tolerante por campo.** Cada campo de `editor.paneles` lleva su propio respaldo (`.catch` de Zod con el valor por defecto). Un valor ausente, de otro tipo o fuera de rango se sustituye por el de ese campo sin aviso y **no** aparta `config.json` como `.danado`. La regla general de la revisión 2026-11-04 haría perder la instalación por una preferencia cosmética, y aquí no se aplica. El siguiente guardado reescribe el valor corregido.
- **Escritura.** Se usa el canal existente `config.actualizar`. `configParcialRendererSchema` admite `editor.paneles` como objeto estricto y parcial, con los mismos rangos y enteros. Un valor fuera de rango se rechaza en el IPC (`ErrorDatosInvalidos`) y no se corrige. Se mantienen la validación de remitente y Zod del [ADR 0008](0008-seguridad-de-electron-y-protocolos-propios.md) sin canales nuevos.
- **Frecuencia.** El renderer agrupa las escrituras (al soltar un arrastre, tras 500 ms sin teclas y al minimizar, expandir o restablecer). Main escribe al momento por la cola de `ServicioConfig`.
- **Propiedad del contrato.** Solo la tarea 0155 modifica `shared/config.ts`, `shared/ipc.ts` y `shared/paneles.ts` en esta subfase.

## Revisión para 0.2.0 · fase 3

Temas y agrupación de la biblioteca. Fecha: 2026-11-09. Detalle, alternativas y fuentes en el [ADR 0016](0016-catalogo-de-temas-e-identidad-de-artista-y-album.md).

- **Archivo nuevo `biblioteca/temas.json`** (con `.bak`), único escritor `ServicioTemas`. Contiene catálogo versionado (`esquema: 1`), ids UUID estables, asignaciones de artista y álbum por clave de identidad, `predeterminado` y el diario `borrado_pendiente`. El escaneo solo indexa carpetas, así que no lo trata como canción. Si el esquema es más nuevo, queda en solo lectura y no se sobrescribe. Si es ilegible, se aparta como `temas.json.danado`.
- **`cancion.json` sigue en `esquema: 1`.** Se añade el campo opcional `apariencia: { modo: "propio" | "tema" | "heredar", tema_id?, base? }`, donde `base` es `{ tipo: "aleatorio" | "predeterminado_anterior", tema_id }` o `{ tipo: "incluido" }`, y `tema_nombre` opcional (nombre del tema de la instantánea, solo para el estado «Tema no disponible»). Si falta, equivale a `propio`. Con `propio`, `estilo` es la autoridad, como hasta ahora. Con `tema` o `heredar`, `estilo` pasa a ser la **instantánea de respaldo**, que main refresca en cada escritura de la canción. Las bibliotecas de 0.1.0 no se reescriben al abrir y conservan su apariencia. Si 0.1.0 abre un archivo de 0.2.0, pinta la instantánea.
- **Creación de canciones**: `ServicioBiblioteca.construir` ya no copia `config.estilo_predeterminado`. Recibe de `ServicioTemas` la apariencia inicial: `heredar`, con `base` aleatoria (o `incluido` si el catálogo está vacío) cuando no hay predeterminado, y la instantánea resuelta en ese momento. La creación pasa por la cola de apariencia.
- **`config.estilo_predeterminado`** queda como campo heredado. Se lee con tolerancia y siembra el primer tema del catálogo, que se marca como predeterminado. Después no es autoridad. Sale de `configParcialRendererSchema` cuando el editor deje de usarlo.
- **Índice en memoria**: el resumen añade `album`, claves de identidad (`shared/identidad.ts`: NFC, espacios colapsados, `toLowerCase`, diacríticos conservados; el álbum se identifica con el par artista + álbum) y la apariencia resuelta. `estilo` en el resumen es el resuelto.
- **Catálogo**: las asignaciones guardan también la grafía visible (`nombre_artista`, `nombre_album`) y el catálogo un campo `apartado` (fecha o `null`) para avisar una sola vez de un catálogo ilegible apartado.
- **`config.biblioteca.agrupar`** (`"ninguno" | "artista" | "album"`, por defecto `"ninguno"`): preferencia global de la Biblioteca, con lectura tolerante (`.catch`) como `editor.paneles` y escrita con `config.actualizar`.
- La regla general de esta revisión: un campo opcional con equivalencia por defecto no sube `esquema` de la canción. Un cambio que 0.1.0 no pueda leer, sí.

## Revisión para 0.2.0 — fase 4

Ventana secundaria y cola. Fecha: 2026-11-11. El detalle está en el [ADR 0017](0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §2, §8 y §12.

- **La cola y la sesión no se persisten.** Viven en memoria de main mientras la app está abierta ([0049](../preguntas/0049-politica-cola-de-reproduccion.md)). No hay archivo nuevo ni migración. `cancion.json` no cambia.
- **Campos nuevos en `config.reproductor`**. Tienen valores por defecto, así que `esquema` sigue en 1:

```jsonc
"reproductor": {
  // … volumen, silenciado, voz_guia, voz_guia_silenciada (sin cambios)
  "transicion_s": 4,                  // entero 1–30 (la spec 08 ofrece 2, 3, 4, 5, 8, 10, 15): cuenta entre canciones de la cola
  "secundaria": {                     // última pantalla elegida para la ventana secundaria; null si no hay
    "pantalla": { "id": 2779098405, "etiqueta": "DELL U2419H", "ancho": 1920, "alto": 1080 },
    "pantalla_completa": true
  }
}
```

- **Lectura tolerante por campo**, como `editor.paneles`. Un valor ausente, de otro tipo o fuera de rango se sustituye por su valor por defecto (`4` o `null`) sin apartar `config.json`.
- **Escritura**:
  - `transicion_s` se escribe desde Ajustes con `config.actualizar`. `configParcialRendererSchema` admite enteros de 1 a 30 y rechaza los demás en el IPC;
  - `secundaria` lo escribe solo main al abrir una sesión, así que no entra en el esquema parcial del renderer;
  - la secundaria solo puede escribir `volumen`, `silenciado`, `voz_guia` y `voz_guia_silenciada`, con `sesion.guardarPreferencias`.
- `pantalla.id` es el `Display.id` de Electron. Puede cambiar al reconectar el monitor, así que la etiqueta y el tamaño sirven de respaldo para reconocerla. Solo se usa para preseleccionar la pantalla y nunca abre la ventana sin una elección.
