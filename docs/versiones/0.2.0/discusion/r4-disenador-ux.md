# Ronda 4 — Lectura UX de las respuestas de producto

## 0047 · Temas

Propongo que Estilo muestre dos modos, «Tema personalizado» y «Temas definidos», con procedencia visible en el segundo. Elegir un tema definido mantiene el vínculo en cascada. Personalizar parte del estilo visible y modifica solo la canción. Al editar el tema desde el catálogo, «Guardar cambios en {tema}» abre una confirmación con el número efectivo de canciones afectadas. «Guardar como tema nuevo…» abre un diálogo con «Nombre del tema» y conserva el original. Sesiones de reproducción y exportación iniciadas conservan su instantánea.

Para selección múltiple, propongo una acción «Seleccionar canciones» en Biblioteca. Cada tarjeta ofrece una casilla con nombre accesible y la barra de selección muestra «{n} seleccionadas». La selección permanece explícita al filtrar, con aviso de cuántas quedan fuera de vista. «Aplicar tema…» abre un diálogo con el tema elegido y la lista de canciones; advierte cuando sustituye una personalización o asignación. El foco vuelve a la barra al terminar y un estado anuncia el resultado. La respuesta autoriza esta acción. Falta acordar con arquitectura cómo protegerla ante cambios de revisión y fallos parciales y si la selección se limita a canciones editables. El borrado de un tema asignado sigue sin respuesta explícita. El plan puede avanzar con la edición y la asignación, dejando la política de borrado abierta.

## 0048 · Evento y letra lista

La edición se bloquea durante la sesión de la ventana secundaria. Al intentar editar, mostrar «No se puede editar mientras el reproductor está abierto en otra ventana» con «Entendido» y devolver el foco a la acción inicial. Biblioteca y cola siguen operables. Si ya hay un editor abierto al iniciar el evento, resolver primero los cambios pendientes y bloquear sus controles sin perder selección ni historial cuando sea viable. Consulto a arquitectura qué transiciones cuentan como sesión ocupada. Propongo mantener el bloqueo durante pausa y cuenta entre canciones, y liberarlo al cerrar o al terminar la sesión de forma explícita. El selector de dispositivo queda registrado como mejora de prioridad baja.

«Lyrics» o «Letra lista» es una propuesta adicional de producto. El objetivo aparente es mostrar letra sincronizada sin barrido progresivo cuando se confía en sus marcas de inicio, distinguiéndola de un karaoke afinado manualmente. Propongo separar esa señal del tema visual para que un cambio de tema en cascada no reactive el barrido por accidente, o definir un modo de render inequívoco dentro del estilo si producto quiere que el tema lo controle. Hay que confirmar nombre visible, criterios de entrada, si reproduce y entra en cola, qué voz ofrece, y si sustituye o complementa «Lista». No dar por aprobado que toda letra importada está bien sincronizada. Tampoco asumir que «no contraste» se refiere al contraste de accesibilidad: mantendría el texto legible y preguntaría si significa desactivar el resaltado.

## 0049 · Cola

Fin natural con pendiente válida inicia transición automática. Mostrar contador animado al centro, 4 s por defecto, y una tarjeta «A continuación» abajo a la derecha con título y artista. Con movimiento reducido se mantiene el cambio numérico sin animación. Anunciar la próxima canción una vez al iniciar la transición, sin anunciar cada segundo. La principal debe indicar la transición y permitir detenerla si se va a modificar la sesión. La cola vive en memoria mientras la app esté abierta.

Si falla la activa o la siguiente deja de estar disponible, detener transición y mostrar el motivo con «Pasar a la siguiente canción». Si no quedan pendientes, mostrar el final habitual. Coordinar con arquitectura la reserva de la entrada anunciada frente a reordenamientos, dónde se muestra la alerta en una configuración de dos pantallas y qué ocurre si se cierra la secundaria. Propongo control en la principal y mensaje breve en la salida de público. La respuesta sobre errores autoriza avanzar por acción explícita, pero el cierre de ventana no se respondió expresamente.

## 0050 · Exportación

Diálogo con relación de aspecto 4:3 o 16:9, resolución y FPS 24, 30 o 60 como máximo. Presentar ancho × alto para cada perfil. La prueba técnica define cuáles combinaciones de uso común llegan al catálogo hasta 4K; 4K en 4:3 requiere acordar qué dimensión se toma como límite. Mantener formato libre compatible con la licencia, voz opcional y marca de agua en la muestra. OBS orienta los formatos a evaluar y las mediciones y auditoría determinan qué se ofrece.

Si el trabajo puede aislarse del transporte, el rendimiento medido informa requisitos y alcance por perfil. Si existe incompatibilidad técnica entre sesiones, deshabilitar la acción durante el evento con un mensaje específico y recuperarla al terminar. Pregunto a arquitectura qué métricas de no interferencia se medirán y cómo distinguiremos un perfil no disponible de un bloqueo de concurrencia.

## Acuerdos con arquitectura

- **Temas.** Confirmar el guardado sobre un tema existente con alcance efectivo. «Guardar como tema nuevo…» pide nombre, conserva todos los usos previos y deja aplicar el tema nuevo como acción explícita. La aplicación múltiple requiere lista confirmada, revisión vigente y resultado que identifique conflictos o fallos parciales.
- **Evento.** El bloqueo de edición abarca pausa y transición entre canciones. Antes de empezar con un editor abierto, resolver el autoguardado. El eventual selector de dispositivo queda como mejora de prioridad baja. «Letra lista» requiere una definición propia antes de incorporarse.
- **Cola.** Si un cambio de orden altera la entrada anunciada durante la cuenta, actualizar la tarjeta y reiniciar los 4 s configurados para la nueva entrada. Mantener la cuenta si la identidad no cambia. Anunciar el cambio de siguiente una vez. Las entradas no disponibles suspenden el avance y requieren acción explícita.
- **Exportación.** Evaluar MKV con AV1/Opus y WebM con VP9/Opus. Probar perfiles 16:9 de 720p, 1080p y 2160p, y perfiles 4:3 de 640×480, 1024×768, 1600×1200 y 2880×2160. Son candidatos para las pruebas con 24, 30 y 60 FPS, sujetos a verificación de compatibilidad, licencia y coste. La capacidad de exportar durante un evento depende del aislamiento técnico y las mediciones por perfil.

## Pendientes de producto

- Qué aspecto conservan las canciones que usan un tema eliminado.
- Si «Letra lista» desactiva el barrido, cuál es su elegibilidad y qué efecto tiene en reproducción y cola. También queda por elegir su nombre visible.
- Qué conserva la cola si se cierra la ventana secundaria a mitad de canción o durante la transición.
- Cómo aplicar el límite de 4K al formato 4:3 si los perfiles evaluados dejan una decisión entre dimensiones.

### Precisiones de verificación

El lote incluye borradores editables y canciones Lista. Revalidar las mismas condiciones que exige guardar estilo desde una sola canción. En exportación, distinguir el perfil incompatible con el equipo o códec, que se informa al seleccionarlo, del bloqueo por concurrencia técnica, que se explica durante la sesión. La prueba compara el evento solo frente a evento con exportación, midiendo cortes de audio, continuidad del reloj, respuesta de controles, fotogramas de la secundaria, CPU, GPU, RAM y disco, con un perfil modesto y otro 4K60.

## Adenda · Respuestas adicionales

- **0047, borrar un tema.** La decisión conserva la apariencia de cada canción afectada como copia local «Tema personalizado» y la desvincula antes de eliminar el tema del catálogo. La confirmación cuenta los usos efectivos, sin incluir canciones con un estilo propio u otro tema de mayor precedencia. Texto propuesto «{n} canciones conservarán este estilo como tema personalizado y dejarán de estar vinculadas a {tema}». Si falla la conversión, mantener el tema disponible y mostrar el fallo para recuperar la operación. Si el tema era predeterminado, aclarar por separado qué estilo recibirán las canciones nuevas.
- **0049, cerrar el reproductor.** Si hay cola, mostrar «Hay canciones en cola» con «Cerrar y eliminar cola», «Cerrar y conservar cola» y «Cancelar». Al conservar, la principal mantiene los pendientes en memoria y selecciona la última canción reproducida. Suspender la transición mientras se confirma para que la canción seleccionada no cambie bajo el diálogo. Con «Cancelar», volver a la sesión. La selección indica contexto y no define reanudación al mismo segundo.
- **0050, techo de 4:3.** Queda decidido 2880 × 2160 como máximo para 4:3. La verificación de perfiles, códecs y exportación simultánea sigue en la prueba técnica. Mostrar la resolución exacta en el selector.
- **0048, «Letra lista».** Sigue abierta la definición de contraste frente a barrido, requisitos de elegibilidad, relación con «Lista» y comportamiento en cola. Mantenerla como propuesta separada del bloqueo del editor durante eventos.

## Cierre · Respuesta ampliada

### Letra lista

- En el Editor, junto a «Marcar como lista», ofrecer «Marcar como letra lista». La nueva acción requiere todos los inicios y fines completos y válidos, incluidos los tiempos efectivos que se obtienen de una API. Una letra importada con marcas suficientes puede quedar lista sin ajuste manual. Si falta alguna marca requerida, deshabilitar con un motivo accesible y ofrecer «Ir a la primera línea sin tiempo». Conservar las comprobaciones de disponibilidad de medios aplicables a la reproducción.
- En la primera activación, mostrar el diálogo «¿Marcar como letra lista?» con «La letra aparecerá sincronizada por línea. Durante la reproducción y en el video, el texto se mostrará sin barrido ni cambio de color de progreso. Puedes seguir revisando el barrido en el editor». Acciones «Cancelar» y «Marcar como letra lista». La casilla «No volver a mostrar este aviso» guarda una preferencia persistente al confirmar. Sin marcarla, el aviso puede volver a mostrarse. Cancelar deja intactas la canción y la preferencia.
- En Biblioteca, mostrar la insignia «Letra lista». La canción entra en los flujos de reproducción, cola y exportación. El tema visual sigue aplicando fuente, fondo y color de letra. En el editor se conserva el barrido como herramienta para verificar tiempos. En reproducción y exportación cambia la línea activa según el reloj y mantiene un color uniforme durante su intervalo. La legibilidad sigue sujeta a las reglas de contraste del estilo.
- Verificar que una letra de API con tiempos completos efectivos habilita la acción, una letra incompleta explica qué falta y el estado persiste al reabrir. En la misma canción, comprobar barrido en editor y texto uniforme en reproducción y exportación. Verificar que aceptar la casilla suprime el aviso incluso al reiniciar y que cancelarlo conserva el comportamiento anterior.

### Tema predeterminado

- En Ajustes, añadir «Tema predeterminado» con selector de temas definidos y opción «Estilo aleatorio». Mostrar qué estilo reciben las canciones sin asignación de mayor precedencia. Cambiar la selección no convierte estilos propios ni toca los usos fijados a otro tema.
- Al borrar el tema seleccionado como predeterminado, sumar a la confirmación «Las canciones nuevas usarán un estilo aleatorio hasta que elijas otro tema predeterminado». Las canciones ya afectadas quedan desvinculadas como «Tema personalizado» con la apariencia anterior.
- Verificar que la selección persiste al reabrir Ajustes y que borrar el tema predeterminado preserva los usos efectivos, actualiza el selector y restaura la selección aleatoria para una canción nueva.

### Reanudación de cola

- «Cerrar y conservar cola» guarda en memoria la entrada y el segundo de reproducción al confirmar. Al reabrir la sesión, retomar automáticamente el mismo segundo, anunciar «Reproducción reanudada en {mm:ss}» y dejar visible «Reiniciar canción». Reiniciar vuelve al principio de esa entrada y conserva el orden de pendientes. La posición pertenece a la entrada, de modo que dos apariciones de la misma canción se distinguen.
- Si ya terminó la canción y estaba activa la cuenta para la siguiente, mantener la última canción reproducida como contexto y permitir iniciar la siguiente pendiente. Al revalidar medios, aplicar el aviso y «Pasar a la siguiente canción» si la entrada guardada dejó de estar disponible. Cerrar la aplicación descarta la sesión en memoria.
- Verificar cierre a mitad de canción y reanudación automática al reabrir y reinicio desde el principio, además de cierre en transición. Probar que la posición y los pendientes corresponden a la entrada correcta cuando se repite una canción.

La modalidad «Letra lista» conserva la categoría Lista para disponibilidad y filtros, con una insignia que explica el modo de render. En cuanto al predeterminado, la asignación aleatoria es el comportamiento solicitado para nuevas canciones al borrar el tema seleccionado. El código actual usa configuración o un estilo fijo. La elección se hace al crear la canción y conserva su resultado al reabrir. Con catálogo vacío se usa el estilo incluido.
