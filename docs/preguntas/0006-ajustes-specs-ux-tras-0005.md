# 0006 — Ajustes de las specs UX derivados de la respuesta a 0005
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no (afecta a textos y criterios de aceptación de 01, 02, 03, 04, 05, 06 y 07; ninguna tarea de la Fase 1 depende de ello salvo el punto 4, cuya opción provisional basta para la tarjeta de la biblioteca)

## Contexto
La respuesta a [0005](0005-viabilidad-detalles-ux-fase-0.md) acepta la mayoría de las opciones provisionales, pero algunos datos y decisiones técnicas cambian textos o criterios de las specs. El arquitecto no edita `docs/ux/`; se describen aquí los cambios necesarios. Decisiones de referencia: ADR 0003, 0004, 0005, 0006 (revisados el 2026-11-03) y `docs/arquitectura.md`.

## Pregunta
¿Puedes actualizar las specs con estos cambios (o proponer alternativa)?

1. **Espacio requerido** (`ux/01`, Parte A y B1; `pa.req.espacio`): el perfil se detecta **antes** de instalar (sin Python), así que B1 puede mostrar el requisito de ese perfil: **solo CPU ≈ 3 GB, Apple Silicon ≈ 4 GB, NVIDIA ≈ 8 GB**; si la detección falla, **8 GB** (no 6). La guía de instalación debe decir "entre 3 y 8 GB libres" en vez de "entre 2 y 6 GB". Cifras provisionales hasta el spike (tarea 0005); se leerán de un manifiesto, la spec puede usar `{n}`.
2. **Modo previsto antes de instalar** (`ux/01`, opcional): como el perfil provisional se conoce en B1, el tamaño de descarga de B1 puede ser el del equipo ("Descarga: unos 0,7 GB") en lugar del rango genérico, y el mensaje de modo podría mostrarse antes. La confirmación con PyTorch al final de "Instalando componentes" solo puede **rebajar** Calidad → Rápido (p. ej. NVIDIA con < 4 GB de VRAM); si ocurre, hace falta un texto para ese cambio (p. ej. "Tu tarjeta gráfica no tiene memoria suficiente para el modo Calidad: usaremos el modo Rápido").
3. **Disco por canción** (`ux/03`, `add.error.SIN_ESPACIO`): ahora se conserva una mezcla en FLAC además de las dos pistas: **≈ 70–100 MB por canción de 4 min** (antes "entre 30 y 80 MB"). Sugerencia: "Cada canción ocupa unos 100 MB".
4. **Canción Lista con líneas sin sincronizar** (`ux/02`, `ux/07`): se acepta que siga `lista`. Falta definir:
   - en `ux/02`, la presentación de una tarjeta **Lista incompleta** (la tabla "Línea de paso" solo cubre borradores). Provisional para la tarea de biblioteca: insignia "✓ Lista" + línea `aviso` "Faltan {n} líneas por sincronizar" y botón principal "▶ Reproducir" sin cambios;
   - en `ux/07`, cómo se indica en el reproductor. Dato técnico: el reproductor **omite** las líneas sin inicio (no puede situarlas en el tiempo).
5. **Precisión del toque** (`ux/06`, criterio 5): el error ≤ 20 ms es alcanzable para salida de audio **por cable o altavoces del equipo**; con Bluetooth la latencia real (150–300 ms) a menudo no se conoce y el desfase se corrige con el desplazamiento global. Propuesta: "≤ 20 ms con salida por cable o altavoces del equipo (verificado con test automático y pista de clics)". Quizá convenga una ayuda en el editor: "¿Usas auriculares Bluetooth? Si toda la letra queda atrasada, usa el desplazamiento de toda la letra."
6. **Velocidad lenta** (`ux/06`): en el MVP 0,5× y 0,75× **bajan el tono** (no hay *time-stretch*). ¿Se añade alguna nota (p. ej. tooltip "A menor velocidad, el tono también baja")?
7. **Notificación en macOS** (`ux/04` §3): sin firma, las notificaciones nativas de macOS no funcionan; la alternativa técnica es **rebote del icono del Dock + insignia numérica** (y parpadeo en la barra de tareas en Windows/Linux). Basta con mencionarlo en la fila correspondiente.
8. **Pausas** (`ux/05`, `ux/06`): varios renglones vacíos seguidos se guardan como **una** pausa y se descartan los del principio y del final. Una pausa puede tener tiempo (si viene de un LRC con marca vacía) y en ese caso fija el fin de la línea anterior; no se puede sincronizar desde el editor en el MVP. Confirmar que la fila "♪ pausa" no necesita mostrar tiempo (o mostrarlo en `texto-3` si lo tiene).
9. **Edición de texto** (`ux/05` C): solo los cambios de espacios (al principio/final o espacios dobles) conservan la sincronía; cualquier otro cambio en una línea (mayúsculas, puntuación) la deja sin sincronizar. El aviso `let.edicion.aviso` ya lo cubre; confirmar.
10. **Tamaños de modelos** (`ux/08`): Rápido ≈ 65 MB, Calidad ≈ 0,9 GB (del manifiesto). El ejemplo "Requiere descargar 60 MB" puede quedar con `{n}`.

## Opción provisional tomada (si no bloquea)
Las tareas usan los valores técnicos de esta pregunta; los textos visibles se tomarán de las specs cuando se actualicen. Para el punto 4, la opción provisional descrita.

## Respuesta
**Respondida por disenador-ux (2026-11-04).** Se aceptan los diez puntos; todos están llevados a las specs. Además se quitan de `docs/ux/` las marcas de "provisional/pendiente" de 0001 (sin firma) y 0002 (solo por línea); la sección de palabras de `ux/06` pasa a "Fuera del MVP — ampliación futura". Las cifras que dependen del spike siguen como `{n}` leídos del manifiesto.

1. **Espacio requerido** — `ux/01`: nueva fila "Perfil previsto (antes de B1)"; B1 muestra el espacio del perfil (CPU 3 GB · Apple Silicon 4 GB · NVIDIA 8 GB; 8 GB si falla la detección); claves nuevas `pa.req.espacio.insuficiente` y `pa.boton.comprobar`. Guía de instalación: "entre 3 y 8 GB libres según tu equipo (más unos 100 MB por canción)". Criterio 2 actualizado.
2. **Modo previsto** — Lo adopto. B1 muestra la descarga del perfil (`pa.req.descarga` = "unos {n} GB para tu equipo"; `pa.req.descarga.generica` si falla la detección). El mensaje de modo se ve en B2 **desde el inicio** (no en B1, para no cargar la bienvenida). Si la confirmación con PyTorch rebaja el modo: `pa.modo.rebajado.memoria` (VRAM < 4 GB) o `pa.modo.rebajado.generico` (otra causa), resaltado 4 s y anunciado; el total de la fase del modelo se recalcula. "Instalando componentes" no pasa de 99 % y ninguna barra retrocede (el progreso de `uv` es aproximado). Criterios 3, 5 y 5b.
3. **Disco por canción** — `add.error.SIN_ESPACIO`: "Cada canción ocupa unos 100 MB." `ux/03` define ya la carpeta `.importando/` y aclara que el archivo del usuario no se toca y que solo se guarda `mezcla.flac` y el nombre original. Criterio 11 ampliado.
4. **Lista incompleta** — **Decisión definitiva** (`ux/02` §"Lista incompleta", `ux/06`, `ux/07`, `sistema-visual` §10):
   - **Biblioteca**: la opción provisional de la tarea 0019 **vale** y se adopta con tres precisiones: (a) la línea lleva **icono ⚠** además del color `aviso` (no solo color); (b) singular con n = 1: "Falta 1 línea por sincronizar" (clave `bib.lista.incompleta`; la misma regla de singular para la línea de borrador `bib.paso.sincronia`); (c) la tarjeta sigue en el filtro *Listas*, sin botón extra (se arregla desde ⋯ → Editar). Insignia "✓ Lista" y "▶ Reproducir" sin cambios. Criterio 2b.
   - **Reproductor**: omite las líneas sin inicio; píldora `rep.incompleta` ("⚠ Faltan {n} líneas por sincronizar: no se verán.") solo en la pantalla de título y en la franja superior con controles visibles; nada sobre la zona de la letra durante el canto; se anuncia una vez; no se muestra en la vista previa del editor. Criterio 13.
   - **Editor**: insignia de cabecera "✓ Lista · ⚠ Faltan {n} líneas" y, al pulsar "Hecho", popover `edi.hecho.incompleta` con [Sincronizar ahora] / [Salir igualmente]. Criterio 15b.
5. **Precisión del toque** — Criterio 5 de `ux/06` reescrito: ≤ 20 ms de error del sistema con salida por cable o altavoces del equipo, verificado con test automático y pista de clics; repeticiones de teclado ignoradas; con Bluetooth no se exige. Se añade la ayuda `edi.ayuda.bluetooth` (nota `info` al salir por primera vez del modo de sincronizar, cerrable).
6. **Velocidad lenta** — Sí, solo tooltip `edi.velocidad.tooltip`: "A menor velocidad, el tono también baja. Los tiempos que marques valen igual a cualquier velocidad." Criterio 7c.
7. **Notificación en macOS** — `ux/04` §3: Windows/Linux notificación + parpadeo de la barra de tareas; macOS rebote del Dock + insignia numérica; siempre toast al volver, que limpia insignia y parpadeo. Cubre también los fallos. Criterio 10b.
8. **Pausas** — Confirmado: la fila "♪ pausa" no muestra tiempo; si lo trae de un LRC, se muestra en `texto-3`, solo lectura. No se puede seleccionar ni sincronizar (↑/↓ la salta). Normalización (una pausa, sin pausas al principio ni al final) en `ux/05`. Fin automático de `ux/06` reescrito con el orden exacto de `finEfectivo`; se distingue fin automático (`texto-2`, "(automático)") de fijado, con el nuevo botón "Usar fin automático" (`edi.fin.usarauto`, pone `fin_ms: null`).
9. **Edición de texto** — Confirmado: `let.edicion.aviso` lo cubre sin cambios; `ux/05` (fila "Edición en C" y criterio 11) detalla que solo los cambios de espacios conservan la sincronía.
10. **Tamaños de modelos** — `ux/08`: ejemplo con 65 MB, nota de que los tamaños y tiempos vienen del manifiesto y microcopy con `{n}`/`{a}`–`{b}`. Se incluye también lo aceptado en 0005 §10: cada separación de la cola usa el modo vigente al empezar, con el modo anterior como alternativa si falta el modelo.

**Decisión UX nueva que necesita una regla compartida** (`ux/06`, criterio 7d): al mover el inicio de una línea que trae tiempos por palabra, sus palabras se desplazan lo mismo; "Borrar tiempos de esta línea" borra también los de sus palabras. Así no se rompen los invariantes y el fin efectivo (regla 2) sigue cuadrando.

**Tareas que el arquitecto debería ajustar** (no las he editado):
- **0019** (Vista Biblioteca): cambiar el criterio "Lista incompleta (provisional de la pregunta 0006 §4)" por la referencia a `ux/02` §"Lista incompleta" con la clave `bib.lista.incompleta`: icono ⚠ + color `aviso`, singular con n = 1, la tarjeta sigue en el filtro Listas. Aplicar el mismo singular a la línea de borrador "Faltan {n} líneas por sincronizar" (`bib.paso.sincronia`).
- **0020** (filtros): solo comprobar que el filtro *Listas* incluye las listas incompletas (ya debería, porque el estado es `lista`).
- **0006** (reglas compartidas): valorar si se añade una función pura para desplazar las palabras con su línea y borrarlas junto con sus tiempos (o dejarlo para la tarea del editor de la Fase 5). No cambia el esquema.
- Ninguna otra tarea de la Fase 1 se ve afectada; el resto (Fases 2–6) lo recogerá el desglose futuro a partir de las specs.

## Nota del arquitecto (2026-11-04)
Tareas ajustadas según esta respuesta:
- **0019**: el criterio provisional de "lista incompleta" se sustituye por `ux/02` §"Lista incompleta" (`bib.lista.incompleta`, icono ⚠ + `aviso`, singular con n = 1); el mismo singular se aplica a `bib.paso.sincronia`.
- **0020**: el filtro *Listas* y su recuento incluyen las listas incompletas (se filtra por `estado: "lista"`).
- **0006**: la regla de palabras (criterio 7d de `ux/06`) va en esta tarea como funciones puras compartidas `moverInicioLinea` y `borrarTiemposLinea`, más los invariantes de `palabras`, para que el editor (Fase 5) y la validación usen una sola regla. Decisión técnica: si al mover una línea sus palabras dejan de caber en su intervalo, se descartan (la línea pasa a barrido progresivo; se puede deshacer). ADR 0005, ADR 0006 y `arquitectura.md` revisados; el esquema no cambia.
