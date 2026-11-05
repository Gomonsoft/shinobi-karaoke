# 08 — Ajustes y Acerca de

- Paso del pipeline: — (transversal)
- ADRs: [0002](../adr/0002-licencia-del-proyecto.md), [0003](../adr/0003-fuente-de-audio.md), [0004](../adr/0004-separacion-voz-instrumental.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md)
- Restricciones: [arquitectura.md "Restricciones e implicaciones para UX" §7](../arquitectura.md)
- Preguntas respondidas: [0003](../preguntas/0003-elegir-calidad-o-rapidez-separacion.md) (sustituida en parte), [0019](../preguntas/0019-calidad-por-defecto-y-rapido-con-consentimiento.md) (sin elección de modo: sección informativa y "Volver a Calidad")

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
