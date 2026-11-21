# 08 — Ajustes y Acerca de

- Paso del pipeline: — (transversal)
- ADRs: [0002](../adr/0002-licencia-del-proyecto.md), [0003](../adr/0003-fuente-de-audio.md), [0004](../adr/0004-separacion-voz-instrumental.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md)
- Restricciones: [arquitectura.md "Restricciones e implicaciones para UX" §7](../arquitectura.md)
- Preguntas respondidas: [0003](../preguntas/0003-elegir-calidad-o-rapidez-separacion.md) (sustituida en parte), [0019](../preguntas/0019-calidad-por-defecto-y-rapido-con-consentimiento.md) (sin elección de modo: sección informativa y "Volver a Calidad"), [0047](../preguntas/0047-temas-asignados-edicion-y-borrado.md) (tema predeterminado y borrado de temas)
- 0.2.0, fase 3 (2026-11-09): sección «Temas» con el tema predeterminado y la gestión del catálogo; «Volver» regresa a la vista de origen. Ver [Fase 3 · Temas y biblioteca](#fase-3-de-020--temas-y-biblioteca). Respondidas: [0052](../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md) (A1, B1, C1) y [0055](../preguntas/0055-textos-de-predeterminado-anterior-y-ajustes-de-la-fase-3.md) (textos de «Tema predeterminado anterior», aviso de referencias que faltan).
- 0.2.0, fase 4 (2026-11-11): sección «Reproductor» con la duración de la cuenta entre canciones de la cola ([0049](../preguntas/0049-politica-cola-de-reproduccion.md): configurable, 4 s por defecto). Ver [Fase 4 de 0.2.0 — ventana secundaria y cola](#fase-4-de-020--ventana-secundaria-y-cola).

## Objetivo
Una vista mínima para: (1) ver **con qué modelo se separa la voz** y, solo si se usa el modelo Rápido, **volver al modelo Calidad** (decisión del usuario, 0019: no se puede elegir modo; Rápido solo se ofrece tras un fallo de Calidad, specs 01 y 04); (2) consultar **Acerca de / Licencias** (obligatorio: GPL-3.0 y créditos de terceros) y releer el aviso de YouTube. Nada más en el MVP.

## Wireframe
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Biblioteca │ Ajustes                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│  Separación de voz                                                       │
│  Tu equipo: tarjeta gráfica NVIDIA (8 GB)                                │
│  Modelo en uso: Calidad                                                  │
│  Deja poca voz de fondo. Una canción de 4 minutos tarda entre 1 y 2      │
│  minutos en tu equipo.                                                   │
│ ──────────────────────────────────────────────────────────────────────── │
│  Acerca de Shinobi Karaoke                                               │
│  Versión 0.1.0 · Software libre con licencia GPL-3.0 o posterior.        │
│  [Ver licencia]  [Créditos y licencias de terceros]  [Web del proyecto]  │
│  [Aviso sobre YouTube]  [Abrir carpeta de datos]  [Copiar información    │
│   para soporte]                                                          │
│  Letras: LRCLIB (lrclib.net). Separación: audio-separator y MelBand      │
│  RoFormer (Kimberley Jensen); modelo Rápido: comunidad UVR.              │
└──────────────────────────────────────────────────────────────────────────┘
```

**Variante con el modelo Rápido** (el usuario lo aceptó tras un fallo de Calidad; `separacion.modo = 'rapido'` con consentimiento y modelo verificado)
```
│  Separación de voz                                                       │
│  Tu equipo: sin tarjeta gráfica compatible (se usa el procesador)        │
│  Modelo en uso: Rápido                                                   │
│  Más ligero; puede dejar algo de voz de fondo. Una canción de 4 minutos  │
│  tarda entre 3 y 7 minutos en tu equipo.                                 │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ ⚠ Lo usas bajo tu responsabilidad desde el 5 nov 2026: sus       │    │
│  │   autores no han declarado licencia. Créditos y licencias        │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Modelo Calidad: deja menos voz de fondo. En tu equipo, una canción de   │
│  4 minutos tardaría entre 6 y 15 minutos. Hay que descargar 913 MB.      │
│  [ Volver a Calidad… ] (secundario)                                      │
│  El cambio se aplica a las próximas separaciones. Las canciones ya       │
│  separadas no cambian.                                                   │
```

**Volviendo a Calidad** (sustituye al botón; el modelo Rápido sigue en uso mientras tanto)
```
│  Descargando el modelo Calidad… 34 % · 310 MB de 913 MB    [ Cancelar ]  │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░                                     │
│  Mientras tanto se sigue usando el modelo Rápido.                        │
```

**Error al volver a Calidad**
```
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ ✕ Sin conexión a internet. Comprueba tu conexión y vuelve a      │    │
│  │   intentarlo. Sigues usando el modelo Rápido.                    │    │
│  │   [ Reintentar ]                                                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
```

**Diálogo "¿Volver al modelo Calidad?"** (siempre, también si Calidad ya está descargado: desde Ajustes no se puede volver a Rápido)
```
┌────────────────────────────────────────────────────────────┐
│ ¿Volver al modelo Calidad?                                 │
│                                                            │
│ Deja menos voz de fondo, pero en tu equipo cada canción de │
│ 4 minutos tardará entre 6 y 15 minutos en separarse.       │
│ Hay que descargar 913 MB.        (solo si no está)         │
│                                                            │
│ Desde Ajustes no podrás volver al modelo Rápido: solo se   │
│ ofrece si el modelo Calidad falla.                         │
│                                                            │
│   [ Cancelar ] (secundario)  [ Volver a Calidad ] (primario,│
│                                                foco inicial)│
└────────────────────────────────────────────────────────────┘
```

(Tamaños de modelo y tiempos: se leen del manifiesto de runtime — Rápido 59 MB, Calidad 913 MB — y la estimación de tiempo es el factor medido en este equipo tras la primera separación con ese modelo o, si no hay, el de referencia del manifiesto (o la estimación del ADR 0004 si es `null`), × 4 min. En los textos van como `{n}`, `{a}`, `{b}`; las cifras de los ejemplos son ilustrativas.)

## Componentes e interacciones
| Elemento | Comportamiento |
|----------|----------------|
| Sección "Separación de voz" | **Solo informativa**: no hay grupo de radio ni forma de elegir modelo (ni Automático, ni Calidad, ni Rápido). Muestra el equipo (`aj.sep.equipo`), el **modelo efectivo** (el que usará la próxima separación: si el modo guardado es Rápido pero falta su modelo o el consentimiento, Calidad) y su estimación de tiempo para 4 minutos (`aj.sep.tiempo`, o `aj.sep.tiempo.aprox` si el factor no está medido). Con Calidad no hay acciones. |
| Equipo (`aj.sep.equipo`) | NVIDIA usable: "tarjeta gráfica NVIDIA ({n} GB)"; Apple Silicon: "Mac con chip Apple"; sin GPU: "sin tarjeta gráfica compatible (se usa el procesador)"; NVIDIA rebajada por el diagnóstico: "tarjeta gráfica NVIDIA (no se puede usar: se usa el procesador)". |
| Aviso de Rápido | Solo con Rápido en uso: banner `aviso` en línea con `aj.sep.rapido.aviso` (fecha de `rapido_aceptado`, formato largo local) y enlace "Créditos y licencias" (abre el mismo diálogo de créditos). |
| "Volver a Calidad…" | Solo con Rápido en uso. Bajo la descripción de Calidad (`aj.sep.calidad.info`, con `aj.sep.descarga` si Calidad no está descargado y verificado). Abre el diálogo `aj.sep.dialogo` (Esc = Cancelar; foco inicial en "Volver a Calidad"). Al confirmar → `runtime.volverACalidad()`: si hay que descargar, el botón se sustituye por la barra en línea (`aj.sep.descargando` + [Cancelar] + `aj.sep.mientras`); el modelo en uso **solo cambia** cuando Calidad está descargado y verificado. Éxito: la sección pasa a la variante Calidad, toast `aj.sep.toast.calidad` y anuncio a lectores de pantalla. Cancelar la descarga: vuelve el botón, sin mensaje (lo descargado se conserva y la próxima vez continúa). Error: banner `error` en línea con el texto del código (`SIN_CONEXION`, `SIN_ESPACIO`, servidor, verificación: mismos textos que B4 de la spec 01) + `aj.sep.error.sigue` y [Reintentar] (repite sin diálogo). |
| Salir de Ajustes durante la descarga | La descarga continúa en segundo plano; al volver a Ajustes se ve su progreso. Al cerrar la app se interrumpe sin diálogo (se conserva lo descargado). Detalle técnico en [0021](../preguntas/0021-detalles-tecnicos-de-la-oferta-de-rapido-y-volver-a-calidad.md) §2. |
| Separaciones en curso o en cola | La separación en curso no cambia; cada separación de la cola usa el modelo vigente **al empezar** ([0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §10). La vista de progreso muestra el modelo realmente usado. |
| Ver licencia | Diálogo con el texto de la GPL-3.0 (desplazable). |
| Créditos y licencias de terceros | Diálogo con `THIRD_PARTY_NOTICES.md` renderizado (UVR y autores de modelos, fuentes OFL, FFmpeg, yt-dlp, Electron…). |
| Aviso sobre YouTube | Diálogo de solo lectura con el texto del aviso legal (spec 03) y la fecha de aceptación. |
| Abrir carpeta de datos | Abre el directorio de datos en el explorador del sistema. |
| Copiar información para soporte | Copia versión, SO con su versión (p. ej. `macOS 14.5`) y arquitectura real, perfil de hardware, **modelo de separación en uso** (`calidad` o `rapido (aceptado el AAAA-MM-DD)`) y dispositivo (`cuda`/`cpu`), versión de yt-dlp y fecha de su última comprobación (útil ante `YOUTUBE_BLOQUEADO`, ya que se actualiza solo). Los datos que aún no existen (p. ej. abierto desde B1, B6 o B0 de la spec 01, sin motor instalado) se copian como `sin instalar`, nunca se omite la línea ni falla. Toast "Información copiada". |
| Diálogo Acerca de desde el primer arranque (B1, B5, B6 de la spec 01) | Mismo bloque "Acerca de", sin la sección "Separación de voz". "Abrir carpeta de datos" se muestra solo si la carpeta existe. "Aviso sobre YouTube" muestra "No aceptado todavía" si procede. |
| Teclado | Ctrl/Cmd+, abre esta vista; Esc vuelve. |

## Estados
| Estado | Presentación |
|--------|--------------|
| Normal | Wireframe. |
| Normal con Rápido | Variante con el modelo Rápido. |
| Volviendo a Calidad | Barra en línea en lugar del botón, con Cancelar; Rápido sigue en uso. |
| Error al volver a Calidad | Banner `error` en línea con el texto del primer arranque + `aj.sep.error.sigue` y [Reintentar]; el modelo no cambia. |
| Sin motor instalado (diálogo Acerca de del primer arranque) | Sin sección "Separación de voz". |

## Microcopy
| Clave | Texto |
|-------|-------|
| `aj.titulo` | Ajustes |
| `aj.sep.titulo` | Separación de voz |
| `aj.sep.equipo` | Tu equipo: {descripción} |
| `aj.sep.modelo` | Modelo en uso: Calidad · Modelo en uso: Rápido |
| `aj.sep.desc.calidad` | Deja poca voz de fondo. |
| `aj.sep.desc.rapido` | Más ligero; puede dejar algo de voz de fondo. |
| `aj.sep.tiempo` | Una canción de 4 minutos tarda entre {a} y {b} minutos en tu equipo. |
| `aj.sep.tiempo.aprox` | Una canción de 4 minutos tarda entre {a} y {b} minutos en tu equipo, aproximadamente. |
| `aj.sep.rapido.aviso` | Lo usas bajo tu responsabilidad desde el {fecha}: sus autores no han declarado licencia. — Créditos y licencias |
| `aj.sep.calidad.info` | Modelo Calidad: deja menos voz de fondo. En tu equipo, una canción de 4 minutos tardaría entre {a} y {b} minutos. |
| `aj.sep.descarga` | Hay que descargar {n}. ({n} con unidad, del manifiesto: "913 MB") |
| `aj.sep.boton.calidad` | Volver a Calidad… |
| `aj.sep.nota` | El cambio se aplica a las próximas separaciones. Las canciones ya separadas no cambian. |
| `aj.sep.dialogo.titulo` | ¿Volver al modelo Calidad? |
| `aj.sep.dialogo` | Deja menos voz de fondo, pero en tu equipo cada canción de 4 minutos tardará entre {a} y {b} minutos en separarse. [Hay que descargar {n}.] Desde Ajustes no podrás volver al modelo Rápido: solo se ofrece si el modelo Calidad falla. — [Cancelar] [Volver a Calidad] |
| `aj.sep.descargando` | Descargando el modelo Calidad… {p} % · {x} MB de {y} MB |
| `aj.sep.mientras` | Mientras tanto se sigue usando el modelo Rápido. |
| `aj.sep.error.sigue` | Sigues usando el modelo Rápido. |
| `aj.sep.toast.calidad` | Ya usas el modelo Calidad. |
| `aj.acerca.titulo` | Acerca de Shinobi Karaoke |
| `aj.acerca.version` | Versión {v} · Software libre con licencia GPL-3.0 o posterior. |
| `aj.acerca.botones` | Ver licencia · Créditos y licencias de terceros · Web del proyecto · Aviso sobre YouTube · Abrir carpeta de datos · Copiar información para soporte |
| `aj.acerca.creditos` | Letras: LRCLIB (lrclib.net). Separación: audio-separator y MelBand RoFormer (Kimberley Jensen); modelo Rápido: comunidad UVR. |

## Criterios de aceptación
1. La vista se abre con ⚙ o Ctrl/Cmd+, y la sección "Separación de voz" muestra el equipo, el modelo efectivo y su tiempo estimado para 4 minutos; **no** hay grupo de radio ni ningún control para elegir modelo (tampoco Automático). Un `automatico` guardado se muestra como Calidad.
2. Con Calidad en uso la sección no tiene acciones ni menciona el modelo Rápido.
3. Con Rápido en uso se muestran el aviso `aj.sep.rapido.aviso` con la fecha del consentimiento y el enlace a créditos, la descripción de Calidad (con el tamaño de descarga si falta) y "Volver a Calidad…".
4. "Volver a Calidad…" siempre pide confirmación con `aj.sep.dialogo` (con la frase de descarga solo si Calidad falta). Al confirmar, si falta, se descarga con barra en línea y cancelación; el modelo en uso solo cambia cuando Calidad está verificado. Al terminar: variante Calidad + toast `aj.sep.toast.calidad`. Al cancelar: vuelve el botón y sigue Rápido. Con error: texto del código + `aj.sep.error.sigue` + [Reintentar]; sigue Rápido.
5. El cambio de modelo no altera canciones ya separadas ni la separación en curso.
6. "Ver licencia" y "Créditos y licencias de terceros" muestran los textos completos sin conexión.
7. "Aviso sobre YouTube" muestra el texto del aviso y la fecha de aceptación (o "No aceptado todavía").
8. La vista es operable con teclado y Esc vuelve a la Biblioteca.
9. "Copiar información para soporte" incluye el modelo en uso (con la fecha del consentimiento si es Rápido), el dispositivo, la versión de yt-dlp y la fecha de su última comprobación; sin motor instalado copia `sin instalar` en los campos que falten y funciona igual desde el diálogo Acerca de del primer arranque ([0013](../preguntas/0013-huecos-ux-de-la-fase-2.md)).

## Fase 3 de 0.2.0 · Temas y biblioteca

Origen: [plan, fase 3, feature 5](../versiones/0.2.0/plan-2.md#5-temas-guardables--l) y [0047](../preguntas/0047-temas-asignados-edicion-y-borrado.md) («El tema predeterminado se tiene que habilitar en ajustes; si se borra, asignar un tema aleatorio a cada nueva canción»). Conceptos, diálogos de nombre, impacto y eliminación: [Editor · Fase 3](06-editor.md#fase-3-de-020--temas-y-biblioteca). Esta sección **amplía** el objetivo de la vista: además de separación y Acerca de, Ajustes es **el lugar donde se administra el catálogo de temas**. Se edita el **aspecto** de un tema solo desde el editor, porque necesita una canción para la vista previa; aquí se gestiona todo lo demás.

**Sustituye**: «Esc vuelve a la Biblioteca» (fila «Teclado» y criterio 8): ahora «Volver» y Esc regresan a la **vista de origen** (Biblioteca o el editor de la canción desde la que se abrió, por ⚙, Ctrl/Cmd + , o «Administrar temas…»). El botón dice `aj.volver.biblioteca` o `aj.volver.editor`.

### Dónde vive el catálogo
- **Ajustes › Temas** (sección nueva, entre «Separación de voz» y «Acerca de»): tema predeterminado y lista de temas con sus acciones. Es el único lugar con la **lista completa**.
- **Editor › Estilo**: elegir, editar el aspecto, guardar como nuevo, renombrar, duplicar y eliminar **el tema efectivo** de esa canción, y «Administrar temas…», que trae aquí.
- **Biblioteca**: asignar a artista y álbum, y aplicar a varias canciones.
No hay un diálogo aparte de gestión: así no se duplica la lista ni sus estados.

### Wireframe
```
│  Temas                                                                   │  h2
│                                                                          │
│  Tema predeterminado                                                     │  h3
│  Lo usan las canciones que no tienen tema propio, ni de su álbum ni de   │
│  su artista.                                                             │
│  [▣ Noche ninja                                           ▾ ]            │  selector
│  Ahora lo usan 9 canciones.                                              │
│                                                                          │
│  Tus temas (4)                                                           │  h3
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ [▣] Neón            14 canciones · artista Queen, 1 álbum     [⋯]  │  │
│  │ [▣] Noche ninja     Predeterminado · 9 canciones              [⋯]  │  │
│  │ [▣] Papel           Sin usar                                  [⋯]  │  │
│  │ [▣] Sol             3 canciones                               [⋯]  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  Para cambiar el aspecto de un tema, abre una canción que lo use:        │
│  Editor › Estilo › Editar tema.                                          │
│ ──────────────────────────────────────────────────────────────────────── │
│  Separación de voz …  /  Acerca de …                                     │
```
Orden de secciones: Separación de voz · **Temas** · Acerca de.

**Sin predeterminado** (elegido así o tras borrarlo):
```
│  [ Ninguno · un tema al azar para cada canción nueva        ▾ ]          │
│  Cada canción nueva recibe al crearse un tema al azar de tus temas, si   │
│  su álbum o su artista no tienen tema. La elección se mantiene al        │
│  reabrirla.                                                              │
```
**Catálogo vacío**:
```
│  Tema predeterminado                                                     │
│  Las canciones nuevas usan el estilo incluido de Shinobi Karaoke hasta   │
│  que crees un tema.                                                      │  (sin selector)
│  Tus temas (0)                                                           │
│  Aún no tienes temas. Crea uno desde el editor de una canción: Estilo ›  │
│  Tema personalizado › Guardar como tema nuevo…                           │
```

### Componentes e interacciones
| Elemento | Comportamiento |
|---|---|
| **Selector «Tema predeterminado»** | Opciones: los temas por orden alfabético (con su muestra) y, al final, `aj.temas.ninguno`. Debajo, `aj.temas.predet.usos` (con `predeterminadoUsos` de `CatalogoIpc`) o `aj.temas.predet.azar`. Elegir otra opción: si alguna canción sigue hoy al predeterminado (`predeterminadoUsos` > 0), pide confirmación con `aj.temas.dialogo.predet` o `aj.temas.dialogo.ninguno` (con el recuento de `temas.previsualizar`, que es la autoridad) (mismo componente de impacto que el editor: recuento, desglose, «Ver las canciones», foco inicial en «Cancelar», `tema.obsoleto`). Sin canciones afectadas, se aplica directamente. Toast `aj.temas.toast.predet`. El foco se queda en el selector. |
| Qué cambia al cambiar el predeterminado | Decisión del usuario en [0052](../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md) ([ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §6). Las canciones contadas son las que siguen al predeterminado (`predeterminadoUsos`; las que heredan sin base y sin tema de álbum ni artista). **(A1) De un tema a otro**: pasan al nuevo (vínculo vivo), con `aj.temas.dialogo.predet`. **De «Ninguno…» a un tema**: las que hoy usan el estilo incluido sin base pasan al tema, con la variante «sin anterior» del mismo diálogo. **(B1) De un tema a «Ninguno…»**: **no cambian de aspecto**; conservan el tema que usaban, siguen vinculadas a él (editarlo las cambia; borrarlo las congela como a cualquier otra) y su procedencia pasa a «Tema predeterminado anterior» (`tema.origen.anterior`). Confirmación `aj.temas.dialogo.ninguno`. **(C1) Elegir un predeterminado nuevo** no cambia las canciones con un tema al azar, con predeterminado anterior o con el estilo incluido fijado al crearse. Nunca cambian las personalizadas ni las que tienen tema de canción, álbum o artista. |
| **Quitar el predeterminado: progreso y fallos** | Al confirmar `aj.temas.dialogo.ninguno`, main guarda una a una las canciones afectadas y después el catálogo. El botón pasa a «Quitando…» (cargando) y, con más de 5 canciones, se muestra `aj.temas.ninguno.progreso` con `hechas`/`total` del evento `temas:progreso` (región `role="status"`, anunciada al empezar y al terminar). No se puede cancelar a medias. **Éxito**: se cierra, el selector queda en «Ninguno…», toast `aj.temas.toast.predet` (variante ninguno) y foco en el selector. **Fallo de una canción**: main se detiene sin escribir el catálogo; ninguna canción ha cambiado de aspecto y el tema sigue siendo el predeterminado. El diálogo muestra `aj.temas.ninguno.parcial` con la lista de lo que falta: la canción que falló (✕, «No se pudo guardar.» y [Copiar detalles] con su código) y, detrás, las que no se llegaron a intentar (–, «Pendiente», en `texto-3`, sin [Copiar detalles]), más la nota `tema.parcial.notaPendientes` si hay pendientes. Es el mismo componente que el fallo a mitad de eliminar ([06 · «Lista de canciones tras un fallo a mitad»](06-editor.md#diálogos), [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)), con foco en [Reintentar]. Siguen [Reintentar] (nueva previsualización: solo cuenta las que faltan, porque las ya guardadas ya conservan el tema) y [Cerrar] (foco al selector, que sigue en el tema). Las ya guardadas muestran desde ese momento «Tema predeterminado anterior» con el mismo aspecto; no hay nada que deshacer. |
| **Lista «Tus temas»** | `role="list"`; cada fila: muestra 64 × 36 (16:9), nombre (`t-cuerpo-fuerte`), etiqueta «Predeterminado» si lo es, usos efectivos (`aj.temas.usos` con `usos.total` de `CatalogoIpc`) y grupos asignados (`aj.temas.grupos` con `grupos` de `CatalogoIpc`, nombres visibles que da main), y ⋯. Usos y grupos se refrescan con cada `temas:cambiado` (main lo agrupa en 250 ms); el renderer no los recalcula. Orden alfabético. Navegación: Tab entra en la lista una vez (*roving tabindex* con ↑/↓ entre filas, Inicio/Fin); Tab siguiente va al ⋯ de la fila activa; tecla Menú o Mayús + F10 en la fila abre su ⋯. |
| **⋯ de un tema** | «Usar como predeterminado» (oculto si ya lo es; mismo flujo que el selector) · «Renombrar…» · «Duplicar…» · separador · «Eliminar…» (destructivo). Los diálogos son los del editor (`tema.dialogo.renombrar`, `tema.dialogo.duplicar`, `tema.dialogo.eliminar`). |
| Nota de edición | `aj.temas.editarNota`, en `texto-3`. No es un enlace (no hay una canción concreta a la que ir). |
| Tras duplicar | La fila nueva aparece en su posición alfabética, recibe el foco y se anuncia `tema.toast.creado`. |
| Tras renombrar | La fila se recoloca en orden alfabético y conserva el foco. |
| **Tras eliminar** | La fila desaparece; el foco pasa a la fila siguiente, si no a la anterior, si no al encabezado «Tus temas» (`tabindex="-1"`). Si era el predeterminado, el selector pasa a «Ninguno…» y se anuncia `aj.temas.anuncio.predetBorrado` además del toast `tema.toast.eliminado`. |
| Se crea una canción nueva | Recibe, en este orden: tema de su álbum o artista si existe; si no, el predeterminado (vínculo vivo); si no hay predeterminado, un tema al azar del catálogo (fijado en la canción, estable al reabrir); si el catálogo está vacío, el estilo incluido. Ver precedencia en el [editor](06-editor.md#conceptos-y-procedencia). |

### Migración desde 0.1.0
- Las canciones existentes quedan como «Tema personalizado» (editor, T1).
- En el primer arranque de 0.2.0, main crea el catálogo con **un tema** a partir de `config.estilo_predeterminado` y lo marca como predeterminado ([ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §1). Nombre visible ([0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §1): **«Shinobi»** si es el estilo de fábrica y **«Mi estilo»** si el usuario lo había cambiado con «Usar este estilo en canciones nuevas». Una canción creada justo después de actualizar se ve igual que una creada justo antes. El catálogo solo queda vacío si el usuario borra todos los temas.

### Estados y errores
| Estado | Presentación |
|---|---|
| Normal | Wireframe. |
| Sin predeterminado | Selector en «Ninguno…» con `aj.temas.predet.azar`. |
| Catálogo vacío | Sin selector; `aj.temas.vacio.predet` y `aj.temas.vacio.lista`. |
| Cargando | La sección muestra 3 filas esqueleto (< 1 s esperado), como la Biblioteca. |
| **Catálogo apartado por ilegible** | Main aparta el archivo (`temas.json.danado`) y empieza un catálogo nuevo (ADR 0016 §1). Mientras `CatalogoIpc.apartado` no sea `null`, la sección muestra arriba el aviso `aviso` `aj.temas.apartado` con [Abrir carpeta de datos] y ✕ (nombre `aj.temas.apartado.cerrar`). El aviso sigue saliendo en cada visita y tras reiniciar hasta que el usuario pulsa ✕, que llama a `temas.descartarAvisoApartado()`; solo vuelve con otro incidente. Al pulsar ✕ el aviso se oculta en el momento y el foco pasa al encabezado `h2` «Temas» (`tabindex="-1"`). Si la llamada falla, sigue oculto en esta sesión y volverá al reiniciar, sin toast. Las canciones que apuntaban a temas perdidos se ven con su respaldo. |
| **Catálogo en solo lectura** (`TEMAS_SOLO_LECTURA`, esquema más nuevo) | Aviso `aviso` `aj.temas.soloLectura`. Lista visible si main la entrega, sin ⋯; selector inactivo con el mismo motivo. Ninguna acción escribe. |
| **Escritura interrumpida** (renombrar, duplicar, predeterminado) | El diálogo o el selector conservan el valor anterior; toast `tema.toast.error` con [Reintentar] y [Copiar detalles]. |
| **Borrado pendiente** (`borradoPendiente` en el catálogo: fallo a mitad o app cerrada durante un borrado) | Es el **único sitio** donde se retoma fuera del diálogo original ([0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §5). La fila del tema muestra el aviso en línea `aj.temas.pendiente` con [Terminar de eliminar] (`temas.reanudarBorrado`, abre el progreso del diálogo de eliminar) y [Cancelar el borrado] (`temas.cancelarBorrado`, toast `tema.toast.borradoCancelado`). El tema no se ofrece en selectores mientras tanto; su ⋯ solo tiene esas dos acciones. No se reanuda solo al arrancar ni hay aviso al abrir la app; el editor y la Biblioteca remiten aquí (`tema.borradoPendiente`, `bib.grupo.temaBorrando`). Otra operación sobre ese tema responde `BORRADO_PENDIENTE` y se muestra el mismo texto. |
| **Referencias que faltan tras restaurar copias** | Si `CatalogoIpc.referenciasFaltantes` > 0 (canciones que apuntan a un tema, directo o como base, que no está en el catálogo; los grupos no pueden faltar), aviso `aviso` bajo «Tus temas»: `aj.temas.faltan` con ese recuento. Es informativo: cada canción se resuelve desde el editor (D4) o con «Aplicar tema…» en la Biblioteca. Si el tema vuelve a aparecer (p. ej. se restaura el catálogo), el recuento baja a 0 y el aviso desaparece con el siguiente `temas:cambiado`. En solo lectura main da 0 y solo se ve `aj.temas.soloLectura`. |
| **Confirmación obsoleta** | En cualquier diálogo de impacto de esta sección: `tema.obsoleto` y recálculo (ver editor). |
| Nombre repetido al renombrar o duplicar | `tema.nombre.repetido` en el campo. |

### Accesibilidad
- `h2` «Temas», `h3` «Tema predeterminado» y «Tus temas ({n})». El selector se describe con su explicación y la línea de usos (`aria-describedby`).
- Cada fila de la lista tiene nombre `aj.temas.aria.fila`. Las muestras son decorativas.
- El foco tras acciones destructivas sigue la tabla; nunca queda en `body`. Los cambios de predeterminado y los borrados se anuncian una vez (`aria-live="polite"`).

### Microcopy (fase 3, Ajustes)
| Clave | Texto |
|---|---|
| `aj.volver.biblioteca` / `aj.volver.editor` | ‹ Biblioteca · ‹ Volver al editor |
| `aj.temas.titulo` | Temas |
| `aj.temas.predet.titulo` | Tema predeterminado |
| `aj.temas.predet.ayuda` | Lo usan las canciones que no tienen tema propio, ni de su álbum ni de su artista. |
| `aj.temas.predet.usos` | Ahora lo usan {n} canciones. · 1 canción · (0) Ahora no lo usa ninguna canción; lo usarán las nuevas. |
| `aj.temas.ninguno` | Ninguno · un tema al azar para cada canción nueva |
| `aj.temas.predet.azar` | Cada canción nueva recibe al crearse un tema al azar de tus temas, si su álbum o su artista no tienen tema. La elección se mantiene al reabrirla. |
| `aj.temas.dialogo.predet` | Título: ¿Usar «{nuevo}» como tema predeterminado? · Cuerpo: Cambiará el aspecto de {n} canciones que usan el predeterminado «{anterior}». · (n = 1) Cambiará el aspecto de 1 canción que usa el predeterminado «{anterior}». · (sin anterior) Cambiará el aspecto de {n} canciones que ahora usan el estilo incluido de Shinobi Karaoke. · Nota: No cambian las canciones con tema personalizado, las que tienen tema propio, de álbum o de artista, ni las que recibieron un tema al azar o conservan un predeterminado anterior. — [▸ Ver las canciones] [Cancelar] [Usar «{nuevo}»] |
| `aj.temas.dialogo.ninguno` | Título: ¿Quitar el tema predeterminado? · Cuerpo: Las {n} canciones que usan «{anterior}» lo conservarán y seguirán recibiendo sus cambios. Su aspecto no cambia. · (n = 1) La canción que usa «{anterior}» lo conservará y seguirá recibiendo sus cambios. Su aspecto no cambia. · Nota: Las canciones nuevas recibirán un tema al azar. — [▸ Ver las canciones] [Cancelar] [Quitar predeterminado] |
| `aj.temas.ninguno.quitando` | Quitando… |
| `aj.temas.ninguno.progreso` | Guardando {i} de {n} canciones… |
| `aj.temas.ninguno.parcial` | No se pudo quitar el predeterminado: falló al guardar «{título}» y se detuvo. Faltan {f} canciones por guardar. «{anterior}» sigue siendo el predeterminado y ninguna canción ha cambiado de aspecto. · (f = 1) No se pudo quitar el predeterminado: falló al guardar «{título}». Falta esa canción por guardar. «{anterior}» sigue siendo el predeterminado y ninguna canción ha cambiado de aspecto. — [Reintentar] [Cerrar]. Filas y nota: `tema.parcial.fila.error`, `tema.parcial.fila.pendiente`, `tema.parcial.notaPendientes` (spec 06). `{f}` = filas `error` + `pendiente`. |
| `aj.temas.toast.predet` | Tema predeterminado: «{tema}». · (ninguno) Sin tema predeterminado: las canciones nuevas recibirán un tema al azar. |
| `aj.temas.origen.anterior` | Tema predeterminado anterior. Es la misma cadena que `tema.origen.anterior` (spec 06); en `textos.ts` hay una sola. |
| `aj.temas.lista.titulo` | Tus temas ({n}) |
| `aj.temas.usos` | {n} canciones · 1 canción · Sin usar |
| `aj.temas.grupos` | artista {artista} · {x} artistas · 1 álbum · {y} álbumes |
| `aj.temas.etiqueta.predet` | Predeterminado |
| `aj.temas.menu` | Usar como predeterminado · Renombrar… · Duplicar… · Eliminar… |
| `aj.temas.editarNota` | Para cambiar el aspecto de un tema, abre una canción que lo use: Editor › Estilo › Editar tema. |
| `aj.temas.vacio.predet` | Las canciones nuevas usan el estilo incluido de Shinobi Karaoke hasta que crees un tema. |
| `aj.temas.vacio.lista` | Aún no tienes temas. Crea uno desde el editor de una canción: Estilo › Tema personalizado › Guardar como tema nuevo… |
| `aj.temas.apartado` | No se pudieron leer tus temas y se empezó una lista nueva. El archivo dañado se guardó como «temas.json.danado» en la carpeta de datos. Las canciones que los usaban se ven con el aspecto guardado en cada una. — [Abrir carpeta de datos] |
| `aj.temas.soloLectura` | Tus temas se guardaron con una versión más nueva de Shinobi Karaoke. Aquí no se pueden usar ni cambiar; las canciones se ven con el aspecto guardado en cada una. Actualiza la app para usarlos. |
| `aj.temas.apartado.cerrar` | Cerrar aviso |
| `aj.temas.pendiente` | La eliminación de este tema quedó a medias: faltan {k} de {n} canciones por guardar su aspecto. — [Terminar de eliminar] [Cancelar el borrado] |
| `aj.temas.faltan` | {n} canciones usan temas que no están en tu lista (por ejemplo, al restaurar una copia). Se ven con el aspecto guardado en cada una. · (n = 1) 1 canción usa un tema que no está en tu lista (por ejemplo, al restaurar una copia). Se ve con el aspecto guardado en ella. |
| `aj.temas.anuncio.predetBorrado` | Ya no hay tema predeterminado. Las canciones nuevas recibirán un tema al azar. |
| `aj.temas.aria.fila` | {tema}[, predeterminado], {usos}[, {grupos}] |

### Criterios de aceptación de la fase 3 (Ajustes)
- A1. Ajustes muestra la sección «Temas» entre «Separación de voz» y «Acerca de», con el selector de predeterminado y la lista de temas con muestra, nombre, etiqueta de predeterminado, usos efectivos y grupos.
- A2. Elegir un predeterminado se guarda y persiste al reabrir Ajustes y al reiniciar; si hay canciones que heredan el predeterminado, antes se confirma con recuento y desglose (foco en «Cancelar»); sin ellas, se aplica sin diálogo.
- A3. Con predeterminado «Noche ninja», una canción nueva sin tema de álbum ni artista abre con procedencia «Tema predeterminado» y «Noche ninja»; con tema de artista, usa el del artista.
- A4. Al eliminar el tema predeterminado, el diálogo incluye la frase de canciones nuevas; tras confirmar, las canciones que lo usaban quedan como «Tema personalizado» con el mismo aspecto, el selector pasa a «Ninguno…», se anuncia `aj.temas.anuncio.predetBorrado` y el foco va a la fila siguiente.
- A5. Sin predeterminado y con 3 temas, cada canción nueva recibe uno de esos 3 (procedencia «Elegido al azar al crear la canción»), el mismo al cerrar y reabrir la app; con tema de álbum o artista, recibe ese. Con el catálogo vacío, recibe el estilo incluido (procedencia «Estilo incluido de Shinobi Karaoke»).
- A6. Renombrar y duplicar desde ⋯ usan los diálogos del editor, validan nombre vacío y repetido, y dejan el foco en la fila correspondiente.
- A7. Con un `temas.json` ilegible (y sin `.bak` válido), la app arranca, la sección muestra `aj.temas.apartado` y una lista nueva; con un catálogo de esquema más nuevo, `aj.temas.soloLectura`, sin acciones que escriban. El resto de Ajustes funciona.
- A7b. En una biblioteca de 0.1.0 sin cambiar el estilo predeterminado, tras actualizar hay un tema «Shinobi» marcado como predeterminado; si se había usado «Usar este estilo en canciones nuevas», se llama «Mi estilo». Una canción nueva se ve igual que antes de actualizar.
- A8. Con una canción cuya referencia no existe en el catálogo, aparece `aj.temas.faltan` en singular («1 canción usa un tema…»); con dos, en plural; al restaurar el tema, desaparece. El texto nunca menciona grupos.
- A7c. Tras apartar un catálogo ilegible, `aj.temas.apartado` sigue visible al salir y volver a Ajustes y tras reiniciar la app; al pulsar ✕ desaparece, el foco va al encabezado «Temas» y no vuelve a salir al reiniciar.
- A9. Una escritura interrumpida al eliminar (o cerrar la app a mitad) deja el tema en la lista con `aj.temas.pendiente`, sin reanudarse solo al arrancar; [Terminar de eliminar] lo completa y [Cancelar el borrado] lo deja disponible con las canciones ya convertidas como «Tema personalizado» sin cambio visible.
- A10. Abierta desde el editor (⚙, Ctrl/Cmd + , o «Administrar temas…»), «‹ Volver al editor» y Esc regresan al editor de esa canción con su pestaña Estilo; abierta desde la Biblioteca, vuelven a la Biblioteca (criterio 8 revisado).
- A11. Toda la sección es operable con teclado (lista con ↑/↓, menú con tecla Menú o Mayús + F10) y el foco nunca queda en `body` tras eliminar.
- A12. Capturas en `docs/ux/revision-fase-3/` (ver [README](revision-fase-3/README.md)), nombre `ajustes-{ancho}x{alto}-{escala}-{estado}.png` a 1280 × 800 al 100 %: `temas`, `temas-sin-predeterminado`, `temas-vacio`, `temas-apartado`, `temas-solo-lectura`, `temas-borrado-pendiente`, `dialogo-predeterminado`, `dialogo-quitar-predeterminado`, `dialogo-eliminar-predeterminado`, `temas-faltan`.
- A13. (B1) Con «Noche ninja» como predeterminado y 3 canciones que lo siguen (una de YouTube), elegir «Ninguno…» muestra `aj.temas.dialogo.ninguno` con 3 canciones y foco en «Cancelar»; al confirmar, ninguna cambia de aspecto ni de portada, su procedencia pasa a «Tema predeterminado anterior» (editor) y «predeterminado anterior» (tarjeta), y una canción nueva recibe un tema al azar. Editar después «Noche ninja» cambia esas 3 canciones.
- A14. (A1 y C1) Con «Noche ninja» como predeterminado, elegir «Neón» cambia las canciones que lo seguían; las que tienen un tema al azar, «Tema predeterminado anterior» o el estilo incluido fijado no cambian y no se cuentan en el diálogo. Desde «Ninguno…», elegir un tema muestra la variante «sin anterior» si hay canciones con estilo incluido sin base, y se aplica sin diálogo si no hay ninguna.
- A15. Con un fallo simulado en la segunda de cuatro canciones al quitar el predeterminado, el diálogo muestra `aj.temas.ninguno.parcial` con «Faltan 3 canciones» y el título de la segunda; la lista tiene 3 filas (la segunda con ✕ y [Copiar detalles]; la tercera y la cuarta con «Pendiente» en `texto-3` y sin [Copiar detalles]), la nota `tema.parcial.notaPendientes` y el foco en [Reintentar]; el selector sigue en «Noche ninja», ninguna canción cambia de aspecto y la primera ya muestra «Tema predeterminado anterior»; [Reintentar] confirma solo las 3 que faltan y termina con el selector en «Ninguno…». Con más de 5 canciones se ve `aj.temas.ninguno.progreso` avanzando.

## Fase 4 de 0.2.0 — ventana secundaria y cola

Origen: [plan, fase 4, feature 11](../versiones/0.2.0/plan-2.md#11-cola--m) y [0049](../preguntas/0049-politica-cola-de-reproduccion.md) («contador en el centro y animado con tiempo configurable, por defecto 4 segundos»). Cómo se ve la cuenta: [07 · Fase 4, «Cuenta entre canciones»](07-reproductor.md#cuenta-entre-canciones-s1). Esta sección **amplía** la vista con una sección nueva; lo demás no cambia.

Orden de secciones: Separación de voz · Temas · **Reproductor** · Acerca de.

### Wireframe
```
│  Reproductor                                                             │  h2
│                                                                          │
│  Cuenta entre canciones                                                  │  etiqueta
│  [ 4 s (predeterminado)  ▾ ]                                             │  selector (2 · 3 · 4 · 5 · 8 · 10 · 15 s)
│  Cuando termina una canción y hay otra en la cola, la pantalla del       │
│  reproductor cuenta estos segundos antes de empezarla.                   │  ayuda (t-pequeno, texto-3)
```

### Componentes e interacciones
| Elemento | Comportamiento |
|---|---|
| **Cuenta entre canciones** | Selector (no campo numérico: menos errores y valores que se distinguen) con 2 s · 3 s · 4 s (predeterminado) · 5 s · 8 s · 10 s · 15 s. Se guarda al elegir en `config.reproductor.transicion_s` con `config.actualizar` ([ADR 0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §12) y persiste entre reinicios. Un valor válido del esquema (1–30) que no está en la lista (archivo editado a mano) se añade como opción extra «{n} s» y se respeta; un valor no válido se muestra y usa como 4 s. Sin acciones de confirmación ni toast de éxito: el valor elegido queda visible. |
| Efecto durante una sesión | Se aplica a la **siguiente** cuenta que empiece. Una cuenta en marcha no cambia (tampoco si se reinicia por cambio de candidata: usa la duración con que empezó). |
| Fallo al guardar | El selector vuelve al valor anterior y aparece el toast `aj.rep.toast.error` con [Copiar detalles]. |
| Teclado | Selector nativo accesible; foco y Esc como el resto de la vista. |

No hay otros ajustes del reproductor en Ajustes: la pantalla y la pantalla completa se recuerdan desde el diálogo de apertura (spec 02), y el volumen y la voz guía desde el propio reproductor (spec 07). El selector de dispositivo de audio queda como mejora futura de prioridad baja ([0048](../preguntas/0048-escucha-editor-durante-evento.md)).

### Estados
| Estado | Presentación |
|---|---|
| Normal | Wireframe con el valor guardado. |
| Sin valor guardado | 4 s (predeterminado). |
| Error al guardar | Valor anterior + toast. |

### Microcopy (fase 4, Ajustes)
| Clave | Texto |
|---|---|
| `aj.rep.titulo` | Reproductor |
| `aj.rep.cuenta` | Cuenta entre canciones |
| `aj.rep.cuenta.opcion` | {n} s · (4) 4 s (predeterminado) |
| `aj.rep.cuenta.ayuda` | Cuando termina una canción y hay otra en la cola, la pantalla del reproductor cuenta estos segundos antes de empezarla. |
| `aj.rep.toast.error` | No se pudo guardar el ajuste. — [Copiar detalles] |

### Criterios de aceptación de la fase 4 (Ajustes)
- AR1. Ajustes muestra la sección «Reproductor» entre «Temas» y «Acerca de» con el selector «Cuenta entre canciones» en 4 s por defecto; la etiqueta y la ayuda están asociadas al selector (`aria-describedby`).
- AR2. Elegir 10 s persiste al salir, al volver y al reiniciar; la siguiente cuenta de la secundaria dura 10 s. Cambiarlo durante una cuenta no altera la que está en marcha.
- AR3. Con un fallo de escritura simulado, el selector vuelve al valor anterior y aparece `aj.rep.toast.error`.
- AR4. Captura `docs/ux/revision-fase-4/ajustes-1280x800-100-reproductor.png`.
