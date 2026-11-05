# 08 — Ajustes y Acerca de

- Paso del pipeline: — (transversal)
- ADRs: [0002](../adr/0002-licencia-del-proyecto.md), [0003](../adr/0003-fuente-de-audio.md), [0004](../adr/0004-separacion-voz-instrumental.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md)
- Restricciones: [arquitectura.md "Restricciones e implicaciones para UX" §7](../arquitectura.md)
- Pregunta respondida: [0003](../preguntas/0003-elegir-calidad-o-rapidez-separacion.md)

## Objetivo
Una vista mínima para: (1) ver y, si se quiere, cambiar el **modo de separación** (respuesta a 0003); (2) consultar **Acerca de / Licencias** (obligatorio: GPL-3.0 y créditos de terceros) y releer el aviso de YouTube. Nada más en el MVP.

## Wireframe
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Biblioteca │ Ajustes                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│  Separación de voz                                                       │
│  Tu equipo: tarjeta gráfica NVIDIA (8 GB)                                │
│                                                                          │
│  ◉ Automático (recomendado) — ahora: Calidad                             │
│    Elegimos el mejor modo para tu equipo.                                │
│  ○ Calidad                                                               │
│    Menos voz de fondo. Unos 1–2 min por canción en tu equipo.            │
│  ○ Rápido                                                                │
│    Algo de voz de fondo. Unos 3–7 min por canción.                       │
│    Requiere descargar 65 MB.                    (si no está descargado)  │
│                                                                          │
│  El cambio se aplica a las próximas separaciones. Las canciones ya       │
│  separadas no cambian.                                                   │
│ ──────────────────────────────────────────────────────────────────────── │
│  Acerca de Shinobi Karaoke                                               │
│  Versión 0.1.0 · Software libre con licencia GPL-3.0 o posterior.        │
│  [Ver licencia]  [Créditos y licencias de terceros]  [Web del proyecto]  │
│  [Aviso sobre YouTube]  [Abrir carpeta de datos]  [Copiar información    │
│   para soporte]                                                          │
│  Letras: LRCLIB (lrclib.net). Separación: audio-separator y modelos de   │
│  la comunidad UVR.                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Variante solo CPU** (sin GPU compatible): la opción Calidad muestra en `aviso`:
> Calidad — Menos voz de fondo, pero **muy lento en tu equipo: unos 15–40 min por canción**. Requiere descargar unos 900 MB.

(Tamaños de modelo y tiempos: se leen del manifiesto de runtime — Rápido ≈ 65 MB, Calidad ≈ 0,9 GB, provisionales hasta el spike — y en los textos van como `{n}`; las cifras de los ejemplos son ilustrativas.)

Al elegirla, diálogo: "¿Usar el modo Calidad? En tu equipo cada canción tardará entre 15 y 40 minutos en separarse y hay que descargar unos 900 MB. Puedes volver a Automático cuando quieras." [Cancelar] [Descargar y usar Calidad].

## Componentes e interacciones
| Elemento | Comportamiento |
|----------|----------------|
| Grupo de radio "Separación de voz" | Tres opciones. Las estimaciones de tiempo se muestran desde el primer momento: factor de referencia del manifiesto para el perfil × modo; tras la primera separación correcta en ese modo, se usa el factor medido en tu equipo (sin cambiar el texto, solo las cifras). Cambiar a un modo cuyo modelo no está descargado lanza su descarga con barra de progreso en línea bajo la opción ("Descargando 34 %… [Cancelar]"); hasta que termina, sigue activo el modo anterior. |
| Separaciones en curso o en cola | La separación en curso no cambia; cada separación de la cola usa el modo vigente **al empezar** ([0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §10). Si al empezar el modelo del modo vigente no está descargado (descarga cancelada o fallida), se usa el modo anterior y la vista de progreso muestra el modo realmente usado. |
| Ver licencia | Diálogo con el texto de la GPL-3.0 (desplazable). |
| Créditos y licencias de terceros | Diálogo con `THIRD_PARTY_NOTICES.md` renderizado (UVR y autores de modelos, fuentes OFL, FFmpeg, yt-dlp, Electron…). |
| Aviso sobre YouTube | Diálogo de solo lectura con el texto del aviso legal (spec 03) y la fecha de aceptación. |
| Abrir carpeta de datos | Abre el directorio de datos en el explorador del sistema. |
| Copiar información para soporte | Copia versión, SO con su versión (p. ej. `macOS 14.5`) y arquitectura real, perfil de hardware, modo de separación, versión de yt-dlp y fecha de su última comprobación (útil ante `YOUTUBE_BLOQUEADO`, ya que se actualiza solo). Los datos que aún no existen (p. ej. abierto desde B1, B6 o B0 de la spec 01, sin motor instalado) se copian como `sin instalar`, nunca se omite la línea ni falla. Toast "Información copiada". |
| Diálogo Acerca de desde el primer arranque (B1, B5, B6 de la spec 01) | Mismo bloque "Acerca de", sin la sección "Separación de voz". "Abrir carpeta de datos" se muestra solo si la carpeta existe. "Aviso sobre YouTube" muestra "No aceptado todavía" si procede. |
| Teclado | Ctrl/Cmd+, abre esta vista; Esc vuelve. |

## Estados
| Estado | Presentación |
|--------|--------------|
| Normal | Wireframe. |
| Descargando modelo | Barra en línea bajo la opción, con Cancelar. |
| Error de descarga | Mensaje en línea con el texto `SIN_CONEXION`/`SIN_ESPACIO` del primer arranque y [Reintentar]; el modo no cambia. |

## Microcopy
| Clave | Texto |
|-------|-------|
| `aj.titulo` | Ajustes |
| `aj.sep.titulo` | Separación de voz |
| `aj.sep.equipo` | Tu equipo: {descripción} |
| `aj.sep.auto` | Automático (recomendado) — ahora: {modo} · Elegimos el mejor modo para tu equipo. |
| `aj.sep.calidad` | Calidad · Menos voz de fondo. Unos {a}–{b} min por canción en tu equipo. |
| `aj.sep.calidad.cpu` | Calidad · Menos voz de fondo, pero muy lento en tu equipo: unos {a}–{b} min por canción. Requiere descargar unos {n}. |
| `aj.sep.rapido` | Rápido · Algo de voz de fondo. Unos {a}–{b} min por canción. |
| `aj.sep.descarga` | Requiere descargar {n}. ({n} con unidad, del manifiesto: "65 MB", "0,9 GB") |
| `aj.sep.nota` | El cambio se aplica a las próximas separaciones. Las canciones ya separadas no cambian. |
| `aj.sep.dialogo` | ¿Usar el modo Calidad? En tu equipo cada canción tardará entre {a} y {b} minutos en separarse y hay que descargar unos {n}. Puedes volver a Automático cuando quieras. — [Cancelar] [Descargar y usar Calidad] |
| `aj.acerca.titulo` | Acerca de Shinobi Karaoke |
| `aj.acerca.version` | Versión {v} · Software libre con licencia GPL-3.0 o posterior. |
| `aj.acerca.botones` | Ver licencia · Créditos y licencias de terceros · Web del proyecto · Aviso sobre YouTube · Abrir carpeta de datos · Copiar información para soporte |
| `aj.acerca.creditos` | Letras: LRCLIB (lrclib.net). Separación: audio-separator y modelos de la comunidad UVR. |

## Criterios de aceptación
1. La vista se abre con ⚙ o Ctrl/Cmd+, y muestra el hardware detectado y el modo de separación actual, con "Automático" seleccionado por defecto.
2. Cada opción muestra su estimación de tiempo para el equipo y, si su modelo no está descargado, el tamaño de la descarga.
3. En equipos solo CPU, elegir Calidad exige confirmar el diálogo de coste antes de descargar nada.
4. Cambiar a un modo sin modelo descarga el modelo con progreso y cancelación; el modo solo cambia cuando la descarga termina y se verifica.
5. El cambio de modo no altera canciones ya separadas ni la separación en curso.
6. "Ver licencia" y "Créditos y licencias de terceros" muestran los textos completos sin conexión.
7. "Aviso sobre YouTube" muestra el texto del aviso y la fecha de aceptación (o "No aceptado todavía").
8. La vista es operable con teclado y Esc vuelve a la Biblioteca.
9. "Copiar información para soporte" incluye la versión de yt-dlp y la fecha de su última comprobación; sin motor instalado copia `sin instalar` en los campos que falten y funciona igual desde el diálogo Acerca de del primer arranque ([0013](../preguntas/0013-huecos-ux-de-la-fase-2.md)).
