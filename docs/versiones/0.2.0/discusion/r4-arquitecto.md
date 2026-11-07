# Ronda 4 · Arquitectura tras las respuestas de producto

Análisis de [0047](../../../preguntas/0047-temas-asignados-edicion-y-borrado.md), [0048](../../../preguntas/0048-escucha-editor-durante-evento.md), [0049](../../../preguntas/0049-politica-cola-de-reproduccion.md) y [0050](../../../preguntas/0050-perfiles-y-concurrencia-exportacion.md).

## 0047 · Estilo propio, temas definidos y selección múltiple

La respuesta confirma referencias vivas para los temas definidos. La opción de estilo personalizado conserva un valor completo propio. Guardar sobre un tema requiere confirmación del impacto efectivo. Guardar como pide nombre y crea otra entidad. El catálogo y la resolución en main se mantienen.

Aplicar desde la biblioteca a varias canciones equivale a asignar la misma referencia en el nivel canción, sin alterar las asignaciones de artista/álbum. Proponer selección por ids y confirmación con lista. Main revalida tema, canciones, revisiones y permisos antes de escribir. Serializar con los cambios de cada canción y registrar resultados por id. Si una escritura falla a mitad, las ya confirmadas permanecen y se informa qué entradas requieren reintento. Prometer una transacción entre archivos exigiría un diario recuperable y garantías adicionales del ADR 0006.

**Para UX.** Aclarar si guardar como tema nuevo vincula la canción de origen solo tras una acción explícita. Proponer cómo comunicar exclusiones, cambios de selección y errores parciales sin repetir cambios ya aplicados. Sigue abierta la política de borrado de un tema asignado.

## 0048 · Evento bloquea edición y propuesta «Lyrics»

Se bloquea el editor mientras la sesión de la ventana emergente esté activa. El límite se administra por sesión en main, y el renderer muestra un diálogo al intentar abrir o editar. Si la sesión se inicia con el editor ya abierto, resolver guardado pendiente antes de entregar el control de audio y bloquear modificaciones posteriores. Evitar perder cambios o duplicar audio. El selector de dispositivos se difiere como idea de baja prioridad.

«Marcar como letra lista» introduce una ruta de estado que exige definición. [El modelo](../../../../app/src/shared/cancion.ts#L83) hoy solo tiene borrador/lista. Considerar una marca de preparación separada de la preparación de audio, o un modo de reproducción dedicado si «Lyrics» llega a habilitar reproducción o cola sin pasar por «Lista». Un estilo con resaltado oculto explícitamente conserva colores legibles. Hacer iguales los colores para ocultarlo degradaría las reglas vigentes de contraste.

**Para UX.** Precisar alcance del bloqueo (incluye pausa, espera entre canciones y final hasta cerrar sesión) y si la Biblioteca conserva acciones ajenas al editor. Consultar qué significa «Lyrics», qué material reproduce, si admite cola/exportación, qué define una letra suficientemente sincronizada y si «no contraste» quiere decir ocultar el barrido, usar dos colores cercanos u otra presentación.

## 0049 · Transición en cola y avisos

Cola en memoria hasta salir de la app. Al final natural con una siguiente válida, mostrar contador central animado y vista previa inferior derecha. Duración configurable de 4 s por defecto. La cuenta debe pertenecer al estado autoritativo de sesión y usar una fecha límite monotónica. El renderer pinta la cuenta local y main autoriza el avance con id de sesión y entrada. Cancelar la fecha límite al interrumpir la sesión. Si falta una pista o canción, congelar avance, mostrar motivo y ofrecer pasar a la siguiente por acción explícita. La [cuenta final actual](../../../../app/src/renderer/src/vistas/reproductor/Reproductor.tsx#L122) termina saliendo. Con cola activa debe consumir la transición nueva una sola vez.

**Para UX.** Revisar comportamiento al reordenar durante cuenta, al agotar pendientes y con movimiento reducido. Propongo que la vista y la entrada candidata reflejen el nuevo orden y que main reinicie la cuenta si cambia la candidata, para evitar iniciar una canción distinta de la anunciada. Preguntar si cerrar la secundaria conserva pendientes en la principal, y qué hacer con la entrada interrumpida.

## 0050 · Exportación libre y perfiles

Evaluar primero Matroska con AV1/Opus, combinación reconocida por OBS, y WebM con VP9/Opus como alternativa libre y legible como fuente en OBS. Distinguir contenedor, códecs y licencia de los builds reales de PyAV/FFmpeg. OBS recomienda MKV para grabación y documenta ambas extensiones como fuentes. Confirmar en Windows, macOS y Linux presencia de los codificadores, licencia, tiempo, memoria, tamaño, peso adicional y reproducción del resultado en OBS. [Formatos de grabación OBS](https://obsproject.com/kb/audio-video-formats-guide) · [Fuentes multimedia de OBS](https://obsproject.com/kb/media-sources) · [The WebM Project](https://www.webmproject.org/about/) · [FFmpeg · licencia](https://ffmpeg.org/legal.html).

Proponer presets 16:9 de 1280×720, 1920×1080 y 3840×2160, y 4:3 de 640×480, 1024×768 y 1600×1200. Medir un perfil adicional 4:3 de 2880×2160 como candidato para compartir el techo de 2160 líneas. Los FPS solicitados son 24, 30 y 60. A 3840×2160/60 un traslado RGBA alcanza ~1,99 GB/s, así que validar contrapresión y evitar secuencias completas en memoria. Paralelizar render y codificación con aislamiento, límites de recursos y cancelación. Permitir exportación durante evento si la arquitectura lo permite y la verificación demuestra que se conserva la reproducción. Si hay una limitación técnica de coexistencia, bloquear el inicio con motivo.

**Para UX.** Proponer nombres y agrupación de perfiles, cómo se informa una combinación costosa o incompatible y cómo se distingue relación de aspecto del códec. La prueba técnica define la matriz final de perfiles soportados, con 4K y 60 FPS como techos.

## Acuerdos tras el cruce con UX

- **Temas.** «Guardar como tema nuevo…» pide el nombre y conserva el original y sus vínculos. Aplicar al origen es una acción explícita. En Biblioteca se seleccionan canciones editables, incluidas Listas y borradores, y se confirma la lista, avisando qué estilos propios o asignaciones se reemplazan. Las seleccionadas fuera de la vista siguen identificadas. Tras revalidar, mostrar resultados por canción y permitir reintentar fallos. Los reemplazos confirmados se guardan antes de comunicar éxito.
- **Evento.** El bloqueo de edición cubre pausa, transición y espera dentro de la sesión, se libera al cerrar o terminar la sesión y conserva Biblioteca y cola operables. Resolver el autoguardado si hay un editor abierto. Selector de dispositivo como mejora futura. Tratar «Lyrics» por separado hasta precisar cómo se reproduce y qué habilita.
- **Cola.** Main vuelve a calcular la candidata si se reordena durante la cuenta. Solo reinicia y se anuncia el cambio cuando cambia el id de entrada siguiente. Con movimiento reducido se mantiene el número sin animación. El motivo de fallo y la decisión de saltar están disponibles en la principal, con mensaje breve para el público. Si no hay pendientes, se muestra el final habitual. La opción de detener la transición desde la principal queda para concretar en su spec.
- **Exportación.** Mostrar relación de aspecto y dimensiones, con la matriz de perfiles disponible según las pruebas. Medir cortes de audio, continuidad de reloj, latencia de controles y fotogramas de la secundaria frente a un evento sin exportar, junto a CPU, GPU, memoria y disco. Probar un perfil modesto y 4K/60 como candidato. Distinguir un perfil no soportado del bloqueo temporal por incompatibilidad entre sesiones.

## Decisiones aún abiertas

1. Borrado de tema asignado. Volver a heredar o conservar apariencia como copia local.
2. «Lyrics». Significado exacto de «no contraste», nombre visible, requisitos para marcar letra lista y si se reproduce, se encola y se exporta. Aclarar si es otro estado, una marca independiente o un modo.
3. Cierre de la secundaria con cola. Si se conservan los pendientes y si se reinicia, se reanuda o se quita la canción interrumpida. La cola se borra al salir de la app, según lo respondido.
4. Interpretación de 4K en 4:3 si se requiere el nivel máximo también en esa proporción. Probar 2880×2160 como candidato por altura UHD. El formato, los perfiles disponibles y la coexistencia se concretan con la prueba técnica.

[Cruce de UX](r4-disenador-ux.md).

## Adenda · Respuestas ampliadas

### 0047 · Borrar conserva el estilo

El usuario confirma que, tras avisar cuántas canciones resultarán afectadas, las que usan el tema pasan a un estilo propio con la apariencia que tenían y se elimina el tema. El diálogo identifica las copias como «Tema personalizado». «Estático» describe una copia desvinculada de futuras ediciones del catálogo. La copia conserva todos los valores resueltos, incluidos movimiento e indicadores si ya existen como parte del estilo. Contar canciones que resuelven efectivamente al tema, incluidas las que lo heredan de álbum, artista o predeterminado. Los overrides quedan fuera. Capturar el valor efectivo y el conjunto de ids en la misma revisión, mostrar el impacto antes de confirmar y comprobarlo de nuevo en main.

Serializar contra escrituras de canción y catálogo. Persistir las copias antes de retirar tema y asignaciones. Como hay varios archivos, definir en el ADR una operación recuperable que pueda reintentarse tras interrupción sin perder la referencia de las canciones pendientes. Al fallar una escritura, conservar el tema, informar el fallo y dejar el estado verificable. Las sesiones activas conservan su instantánea. Las canciones creadas después resuelven las asignaciones que queden vigentes. Si el tema eliminado era el predeterminado, la confirmación distingue ese cambio de las copias materializadas. El ADR debe fijar el fallback para nuevas canciones.

### 0049 · Cerrar la ventana con cola

Al cerrar a mitad de canción o durante la transición con cola, pedir «Cerrar y eliminar cola» o «Cerrar y conservar cola», con opción de cancelar. Una sola confirmación para el cierre desde controles de ventana o de la vista. Main detiene el avance mientras está pendiente, valida la revisión al confirmar y cancela cualquier fecha límite al cerrar. Cancelar la confirmación conserva la sesión. Conservar mantiene orden, ids de pendientes y selección del último elemento que llegó a reproducirse. Durante la transición, la canción anunciada todavía es pendiente y el último reproducido es la que terminó. Mantener la selección separada de la entrada activa y del tiempo de reproducción. El cierre por caída o desconexión no confirma una eliminación.

### 0050 · Límite de resolución 4:3

El máximo en 4:3 será 2880×2160 y en 16:9, 3840×2160, ambos con 24, 30 y hasta 60 FPS. Son techos de diseño. La fase de exportación valida códec libre, perfiles de uso común y capacidad real en cada sistema. Esta respuesta cierra la interpretación del techo de 4:3, sin anticipar el resultado de las pruebas de codificación.

### Dudas residuales

- «Lyrics» sigue pendiente de definición de producto. La información adicional no aclara qué significa «no contraste», qué requisitos hacen que una letra esté lista ni si ese modo entra en reproducción, cola y exportación.
- Conservar la cola selecciona el último reproducido. Si se desea que una canción interrumpida se reanude en su posición o vuelva a empezar al reabrir, falta definir esa conducta. La selección por sí sola no autoriza reproducción automática.
- La elección de build, códec, perfiles disponibles y coexistencia con un evento sigue siendo validación técnica. El límite de 4:3 ya está respondido.

## Cierre de la ronda con UX

- **Temas.** Se elige el predeterminado en Ajustes. Si se elimina, las canciones que lo usaban conservan sus copias y las nuevas reciben una asignación aleatoria. El MVP actual copia el valor fijo o configurado, por lo que la asignación aleatoria es un comportamiento nuevo. Elegir una vez al crear, conservar la elección, respetar artista y álbum como precedencias y usar el estilo incluido con catálogo vacío. [Cableado actual](../../../../app/src/main/index.ts#L276) · [Creación actual](../../../../app/src/main/biblioteca/servicio.ts#L486).
- **Letra lista.** La respuesta confirma que «contraste» se refiere al barrido de resaltado. La canción mantiene el estado operativo Lista y guarda una modalidad diferenciada, para reutilizar elegibilidad de Biblioteca, reproducción, cola y exportación. La letra necesita todos los inicios y fines válidos, incluidos los efectivos de API. El editor mantiene el barrido, mientras la modalidad lo omite en la salida. Un aviso de primera activación explica el efecto y la confirmación persiste «No volver a mostrar este aviso» si se marca. Fase 5 reúne esta modalidad con los cambios de render compartido, después de la cola y antes de exportación.
- **Reanudación.** Conservar la cola retiene en memoria el último elemento reproducido y su posición si se interrumpió. Al reabrir se puede reanudar al mismo segundo o reiniciar la canción. Si la canción terminó antes del cierre, se conserva como contexto y se ofrece iniciar la siguiente.
- **Exportación.** El alcance de producto está respondido. La fase 6 verifica códec y contenedor libres, perfiles hasta 2880×2160 y 3840×2160 según proporción y coexistencia con un evento. La prueba técnica decide qué combinaciones se ofrecen.

[Cierre de UX](r4-disenador-ux.md) · [Plan actualizado](../plan-2.md).
