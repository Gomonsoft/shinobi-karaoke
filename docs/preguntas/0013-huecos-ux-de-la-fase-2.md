# 0013 — Huecos de las specs 01, 03 y 04 detectados al desglosar la Fase 2
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no (cada punto tiene una opción provisional; afectan a las tareas 0037, 0045, 0050 y 0051)

## Contexto
Al desglosar la Fase 2 (tareas 0028–0053, ADR 0009) aparecen situaciones que las specs no cubren o en las que se contradicen. Ninguna cambia la arquitectura; son textos y presentación. El programador usará la opción provisional de cada punto hasta tu respuesta.

## Pregunta

### §1 Actualización de yt-dlp: ¿automática u ofrecida?
- `ux/01` (estado "Actualización silenciosa de yt-dlp") dice: "Solo si falla dos veces seguidas una descarga de YouTube **se ofrece** (spec 03)". Pero `ux/03` no ofrece nada, y `ux/03` (`add.error.YOUTUBE_BLOQUEADO`: "Ya hemos probado a actualizar el descargador") y `ux/04` (`prog.reintento.ytdlp`: "Actualizando el descargador y reintentando…") asumen que es **automática**. Arquitectura (§6) también la hace automática: tras un `YOUTUBE_BLOQUEADO`, actualizar y reintentar una vez.
- Además, la consulta de información ("Buscar vídeo", 2–5 s) también puede fallar con `YOUTUBE_BLOQUEADO`. Con la actualización automática, la búsqueda tarda ~10–30 s más. La spec 03 no tiene texto para ese estado.

¿Confirmas que es automática (y se corrige `ux/01`)? ¿Qué texto se muestra en la vista 03 mientras se actualiza durante "Buscando…"?

**Provisional**: automática, sin ofrecer nada. En la vista 03, el botón sigue en "Buscando…" y debajo del campo aparece `prog.reintento.ytdlp` ("Actualizando el descargador y reintentando…") con "Cancelar" disponible.

### §2 Plataforma no soportada
`arquitectura.md` "Restricciones" §8 limita el MVP a Windows 10/11 x64, macOS 12+ (arm64 y x64) y Linux x64. En otras (Linux arm64, Windows arm64) no hay requisitos en el manifiesto y no se puede instalar. La spec 01 no tiene pantalla ni texto para esto.

**Provisional**: B1 con la caja de requisitos sustituida por un banner `error` "**Tu equipo no es compatible todavía.** Shinobi Karaoke funciona en Windows y Linux de 64 bits (x64) y en macOS. Copia los detalles y abre una incidencia si quieres que lo soportemos." con "Copiar detalles" y "Salir" (sin "Preparar").

### §3 Comprobación de una instalación existente al arrancar
Si `config.json` se recreó (p. ej. estaba dañado) pero el motor y el modelo siguen en disco, la app los verifica antes de dar la instalación por buena (diagnóstico + SHA-256 del modelo: unos **3–5 s**; ADR 0009 §6) en lugar de volver a descargarlos. B1 "no tiene estado de carga propio" porque la detección normal tarda milisegundos, pero esta sí se nota.

¿Qué se muestra durante esos segundos y, si la verificación pasa, se va directo a la Biblioteca o se muestra B3 "Todo listo"?

**Provisional**: pantalla con la misma composición que B1 (logotipo y columna central), título "Comprobando tu instalación…", barra indeterminada y sin botones; si pasa, directamente a la Biblioteca; si falla, B5 ("Continuamos donde lo dejamos" o "Hay que reparar el motor de audio", según lo que falte).

### §4 Cancelar la descarga de YouTube y canción de YouTube en cola
`ux/04` define el diálogo de cancelar **la separación**, pero la vista también ofrece "Cancelar descarga" (`prog.boton.cancelar`) sin texto de diálogo. Tras cancelar, el paso `fuente` queda `pendiente` (ADR 0006): la canción existe en la biblioteca **sin audio**. Faltan:
1. Texto del diálogo de confirmación de cancelar la descarga.
2. Qué muestran la vista 04, la vista 03 (al volver por el stepper o "Continuar") y la tarjeta de la Biblioteca para una canción de YouTube con la fuente `pendiente` (ni error ni interrumpida). ¿O debería cancelar la descarga **eliminar** el borrador, ya que se acaba de crear?
3. Texto "en cola" para una **descarga** que espera a otra descarga (la cola `ligera` es de una en una); `prog.cola` habla de separar.

**Provisional**:
1. "¿Cancelar la descarga? La canción se quedará en tu biblioteca sin audio. Podrás descargarla de nuevo cuando quieras." [Seguir descargando] [Cancelar descarga].
2. Se conserva el borrador. Vista 04 y vista 03: banner `aviso` "**La descarga se canceló.**" [Reintentar]. Tarjeta: línea de paso "Descarga cancelada" con la acción "Continuar".
3. "En cola: empezará cuando termine «{otra}»."

### §5 Vista previa de YouTube sin miniatura
Si el vídeo no tiene miniatura o su conversión a JPEG falla (no es un error del paso, ADR 0003), el hueco de 160 × 90 del wireframe C queda vacío.

**Provisional**: rectángulo 160 × 90 con fondo `fondo-2`, radio del sistema visual e icono Lucide `Music` centrado en `texto-3`; sin texto.

### §6 Cifras de espacio requerido (solo para alinear ejemplos)
`ux/01` usa como ejemplo NVIDIA ≈ 8 GB y "8 GB si la detección falla"; el manifiesto (tarea 0030, ADR 0009 §2) usa **NVIDIA 10 GB** y, sin detección, el mayor (10 GB), como ya decía `arquitectura.md` §6. Los textos leen la cifra del manifiesto, así que no hay que cambiar el comportamiento; solo actualizar los ejemplos de la spec si te parece.

## Opción provisional tomada (si no bloquea)
La indicada en cada punto.

## Respuesta
Respondida por disenador-ux (2026-11-04). Specs actualizadas: `ux/00`, `ux/01`, `ux/02`, `ux/03`, `ux/04` y `ux/08` (wireframes, estados, microcopy y criterios nuevos). Lo que depende de viabilidad técnica queda en [0014](0014-interrupcion-de-la-actualizacion-de-yt-dlp-y-plataformas-emuladas.md) (para el arquitecto, no bloquea).

### §1 yt-dlp: automática, confirmado
- **Automática, nunca se ofrece ni se pregunta.** Corregido `ux/01` (estado "Actualización de yt-dlp", criterio 16). `add.error.YOUTUBE_BLOQUEADO` y `prog.reintento.ytdlp` se mantienen (este último con "de YouTube": "Actualizando el descargador de YouTube y reintentando…").
- Vista 03 durante "Buscando…" (`ux/03` wireframe C1, criterio 15): el botón sigue siendo **"Cancelar"** (Esc activo) y el campo en solo lectura; la ayuda bajo el campo se sustituye por la nueva clave **`add.reintento.ytdlp`**: "Actualizando el descargador de YouTube y volviendo a buscar… Puede tardar hasta medio minuto." (⟳ `info`, `role="status"`). Cancelar vuelve al campo editable sin error. Mismo texto si la búsqueda espera a una actualización semanal en marcha.
- Nuevo en `ux/02` y `ux/04`: línea de tarjeta y fila del panel de actividad "⟳ Actualizando el descargador…" (`bib.paso.actualizando`), barra indeterminada.
- **Provisional**: casi vale; cambia el texto (no `prog.reintento.ytdlp`, sino `add.reintento.ytdlp`, que dice "volviendo a buscar" y el tiempo). Nota: ADR 0003 dice "ofrece/realiza"; conviene dejarlo en "realiza".

### §2 Plataforma no soportada
Nueva pantalla **B6** en `ux/01` (wireframe, claves `pa.nocompat.*`, criterio 15): composición de B1, título "Tu equipo no es compatible todavía", banner `error` con la lista de plataformas y "Tu equipo: {so} · {procesador}", botones **"Pedir soporte para mi equipo"** (abre las incidencias del proyecto), **"Copiar detalles"** y **"Salir"** (primario, foco). Sin "Preparar". Enlace Licencias.
- **Provisional**: el de esta pregunta valía casi entero (falta "Pedir soporte" y la línea del equipo). **El de la tarea 0037 no vale**: usa B4 con `pa.error.generico`; debe ser B6.

### §3 Comprobación de una instalación existente
Nueva pantalla **B0** en `ux/01` (wireframe, claves `pa.comprobando.*`, criterio 14): composición de B1, "Comprobando tu instalación…" + "Solo tardará unos segundos.", barra indeterminada, sin botones. Detalles: solo fondo y logotipo los primeros 300 ms (no parpadea); a los 15 s, `pa.comprobando.lento`; cerrar la ventana cierra sin diálogo. Si pasa → **directamente a la Biblioteca** (sin B3 ni toast). Si falta solo el modelo → B5 "Continuamos donde lo dejamos"; si el entorno no vale o la verificación falla de forma inesperada → B5 "Hay que reparar el motor de audio".
- **Provisional**: vale; añadir el subtítulo, el retardo de 300 ms, el texto de los 15 s y el reparto de B5.

### §4 Cancelar la descarga y fuente pendiente
1. Diálogo `prog.dialogo.cancelar.descarga`: "**¿Cancelar la descarga?** «{título}» se quedará en tu biblioteca como borrador, sin audio. Podrás descargarla de nuevo cuando quieras." [Seguir descargando] (foco) [Cancelar descarga] (destructivo). También desde [✕] del panel de actividad y "Cancelar trabajo" de la tarjeta. En cola: sin diálogo.
2. **Se conserva el borrador** (puede tener ya la letra buscada "mientras tanto"; quitarlo es "Eliminar…"). No es un fallo, así que el banner es `info`, no `aviso`, y la acción es **"Descargar ahora"** (no "Reintentar"), igual que "Separar ahora":
   - Vista 04, wireframe "Descarga pendiente": "**Falta descargar el audio.** Cancelaste la descarga antes de que terminara. La canción sigue en tu biblioteca como borrador." [Descargar ahora] + [Volver a la biblioteca]; sin "Mientras tanto…" ni "Cancelar".
   - Vista 03, wireframe E: resumen (miniatura, enlace, duración), banner `info` `add.pendiente.*` con [Descargar ahora] [Usar otro enlace], y formulario de datos editable. Que "Usar otro enlace" sustituya la fuente de la misma canción está en 0014 §3.
   - Tarjeta: "Falta descargar el audio" (`bib.paso.falta.descarga`, `texto-2`, sin icono) + "Continuar" (abre la vista 03, E).
3. Cola: `prog.cola.descarga` "En cola: se descargará cuando termine «{otra}»." y, si espera a la actualización de yt-dlp (sin canción), `prog.cola.descarga.mantenimiento` "En cola: el descargador de YouTube se está actualizando. Empezará enseguida."
- **Provisional**: 1 cambia de texto; 2 cambia (banner `info`, "Falta descargar el audio", "Descargar ahora"; la tarjeta no dice "Descarga cancelada"); 3 cambia ("se descargará cuando termine" + variante de mantenimiento).

### §5 Vista previa sin miniatura
Vale el provisional, con detalle (`ux/03` wireframe C2, criterio 16): 160 × 90, `fondo-2`, radio `r-s`, icono Lucide `Music` de **32 px** en `texto-3`, centrado, `aria-hidden`, sin texto ni aviso. Se usa también si la imagen no carga y en el resumen del paso 1. En la Biblioteca, una canción de YouTube sin miniatura usa la portada del estilo (`ux/02` criterio 17).

### §6 Cifras
Actualizadas en `ux/01`: NVIDIA 10 GB, sin detección "el mayor espacio del manifiesto (hoy 10 GB)", Parte A "entre 3 y 10 GB", ejemplo de `pa.req.espacio.insuficiente` con 10 GB.

### Además
`ux/08`: "Copiar información para soporte" añade la versión de yt-dlp y la fecha de su última comprobación, y copia `sin instalar` en los campos que falten cuando se abre desde el primer arranque (criterio 9). Afecta a la tarea 0038.

### Tareas que deben ajustarse
- **0037**: B6 en lugar de B4 con `pa.error.generico`; B0 con `pa.comprobando.*` (300 ms, 15 s, reparto de B5); cifra de espacio sin detección = la mayor del manifiesto.
- **0045**: texto del diálogo, estado "Descarga pendiente" (`info` + "Descargar ahora"), textos de cola `prog.cola.descarga[.mantenimiento]`, `prog.reintento.ytdlp` con "de YouTube"; tarjeta `bib.paso.falta.descarga` y `bib.paso.actualizando` (aquí o en la tarea que toque la línea de paso).
- **0050**: confirmado automático; el texto en la vista 03 es `add.reintento.ytdlp`; puntos de 0014 §1.
- **0051**: texto C1 `add.reintento.ytdlp`; marcador sin miniatura (cita `0013 §2` y es **§5**) con `Music` 32 px y `r-s`, también si la imagen no carga; wireframe E en el resumen del paso 1 de una fuente pendiente.
- **0038**: información para soporte con yt-dlp y `sin instalar`.
