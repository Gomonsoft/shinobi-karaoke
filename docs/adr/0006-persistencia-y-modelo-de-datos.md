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
  - Cancelar devuelve el paso a `pendiente`.
  - `error` guarda `{ "codigo": "SIN_CONEXION", "mensaje": "…" }` con códigos estables para que la UX muestre textos propios.
- **Global** (`estado`): `borrador` | `lista`.
  - Para pasar a `lista` deben cumplirse: `fuente` y `separacion` completados (existen ambas pistas), y la letra tiene al menos un elemento `tipo: "linea"` y **todos** los elementos `tipo: "linea"` tienen `inicio_ms` (las pausas no cuentan). `edicion` pasa a `completado` en ese momento.
  - Una canción `lista` **nunca vuelve sola a borrador**: volver a borrador es una acción explícita del usuario. Si una edición deja líneas sin inicio, sigue `lista` y la app deriva (no guarda) el indicador **`incompleta`**; el reproductor omite las líneas sin inicio y la UX muestra el aviso (respuesta a `preguntas/0005` §8). Si faltan las pistas, la canción se presenta como "dañada".
- **Invariantes de la letra** (validados al leer y al escribir): `inicio_ms` crecientes entre los elementos que lo tienen; si `fin_ms` no es `null`, `inicio_ms < fin_ms ≤ inicio_ms` del siguiente elemento con inicio; una `pausa` tiene `texto: ""` y `palabras: null`; no hay dos pausas seguidas ni pausas al principio o al final; `palabras` solo puede ser no nulo si la línea tiene `inicio_ms`, con inicios de palabra crecientes, `inicio < fin` en cada una, la primera ≥ inicio de la línea y el fin de la última ≤ inicio del siguiente elemento con inicio (los conversores de la Fase 4 recortan o descartan las palabras que no lo cumplan).
- **Edición de tiempos con palabras** (`ux/06` criterio 7d): mover el inicio de una línea desplaza sus palabras el mismo delta; borrar sus tiempos borra también los de sus palabras (`palabras: null`). Si tras mover las palabras no caben, se descartan. Funciones puras `moverInicioLinea` y `borrarTiemposLinea` en `app/src/shared/` (tarea 0006).
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
- Modo efectivo de separación = `modo` si no es `automatico`; si no, el del perfil (`cuda`/`mps` → `calidad`, `cpu` → `rapido`). Se resuelve **al empezar** cada separación (respuesta a `preguntas/0005` §10).
- Campos nuevos con valor por defecto se añaden sin subir `esquema` (lectura tolerante); solo un cambio incompatible sube la versión.

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

## Fuentes
- Electron `app.getPath` y `shell.trashItem`: https://www.electronjs.org/docs/latest/api/app , https://www.electronjs.org/docs/latest/api/shell
- XDG Base Directory: https://specifications.freedesktop.org/basedir-spec/latest/
- Local Font Access API: https://developer.mozilla.org/en-US/docs/Web/API/Local_Font_Access_API
- CSS `linear-gradient` y `background-clip: text`: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient , https://developer.mozilla.org/en-US/docs/Web/CSS/background-clip
- SIL Open Font License: https://openfontlicense.org/
