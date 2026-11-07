# 0015 — Línea de tiempo del editor y caché multinivel de picos de voz

- Estado: Aceptado
- Fecha: 2026-11-07
- Paso del pipeline: 4
- Versión: 0.2.0-alfa, fase 2

## Contexto

Las regiones de letra se ajustan sobre el audio con precisión y se pueden escuchar en bucle. La forma de onda es una referencia visual regenerable. Las canciones y letras del MVP mantienen sus datos y reglas de fin. El motor de reproducción del editor, el proceso principal como único escritor y el aislamiento de Electron se rigen por 0010, 0006 y 0008.

## Alternativas consideradas

| Opción | Beneficio | Coste |
|---|---|---|
| Picos desde AudioBuffer en renderer | Prototipo breve | Otra decodificación y buffer completo de voz, incluso al escuchar la mezcla. Recalcula al reabrir. |
| Biblioteca externa de onda o transporte | Controles y render disponibles | Dependencia nueva y riesgo de duplicar reloj, gestos y caché. |
| Streaming PyAV, pirámide binaria y Canvas | Reutiliza dependencias y acota transferencia y pintado | Requiere contrato y validación de caché entre main, worker y renderer. |
| Bucle por temporizador o búsqueda desde cada frame | Fácil de conectar a React | Puede generar deriva y huecos. Depende del ritmo visual. |
| Bucle nativo del nodo Web Audio | Reloj común y transición a nivel de audio | Cambiar límites exige conservar fase y verificar su efecto en Chromium. |

## Decisión

### Coordenadas, gestos y reloj

- La regla, el viewport y el cabezal usan tiempo de audio. Los límites persistidos usan tiempo de letra. Proyectar como `t_audio = t_letra + offset_ms` e invertir al editar. El recorte visual a [0, duración] oculta un tirador si el límite real queda fuera. Los campos siguen disponibles. No convertir un recorte en cambio persistido.
- Conservar el transporte global. La línea de tiempo vive en Sincronía. Buscar en la regla mueve el audio. Seleccionar región, hacer zoom y desplazar la vista conservan la posición. Una región sin tiempo no inventa marcas y una pausa temporizada es referencia y límite. Solo la región seleccionada ofrece tiradores.
- El gesto conserva selección, instante original y revisión de la letra. Durante el arrastre calcula una vista temporal válida mediante las mismas operaciones de tiempos de los campos. `pointerup` acepta un solo paso de historial y guardado si cambió el valor. Escape, cancelación de puntero, pérdida de captura y cambio externo invalidan el gesto. El fin automático se vuelve fijo solo tras confirmar un cambio válido. Los avisos de vecinas reutilizan el resultado de dominio y se anuncian una vez por gesto.
- «Bloquear enunciado» se traduce en el intervalo audible de la selección. Se desactiva si la intersección con la pista queda vacía. `MotorAudio` usa `AudioBufferSourceNode.loopStart/loopEnd` y el reloj de salida del ADR 0010. La posición conserva la fase inicial hasta el primer límite superior y luego se envuelve dentro de [inicio, fin). Al mover los bordes durante el bucle, mantener el cabezal si sigue dentro. Si queda fuera, reanclar al inicio. Si el gesto provisional deja la intersección vacía, pausar manteniendo el bucle armado. Al recuperar un intervalo audible o cancelar, restaurar el estado de reproducción anterior a ese tramo. Confirmar el intervalo inaudible desarma el bucle, restaura posición previa en pausa y muestra el motivo. Considerar que el cambio del nodo entra en vigor en un quantum de render y la salida audible puede ir por detrás. Verificar fase, velocidades y ausencia de deriva en Chromium. No aplicar el fin programado de escucha puntual al nodo en bucle.
- Espacio pausa/reanuda dentro del bucle. Esc primero cancela el gesto, luego desactiva bucle según foco y capas. Desactivar o cambiar selección finaliza el bucle y restaura posición previa en pausa. Terminar el bucle antes de entrar en sincronización al ritmo o Probar a pantalla completa y continuar con el flujo de cada modo. Una búsqueda deliberada fuera del bucle lo desactiva y se dirige al destino solicitado. «Escuchar al ajustar» queda inactivo dentro del bucle y se ejecuta una sola vez al confirmar el gesto fuera de él si la reproducción está en pausa.
- Zoom Ctrl/Cmd + rueda anclado al puntero, con recorte en extremos. Añadir acercar, alejar, zoom a la línea, ver canción completa y centrar en el cabezal, además de desplazamiento horizontal por gesto, Mayús + rueda y minimapa. La ventana visible abarca como mínimo un segundo o toda la pista si dura menos. Los campos conservan el ajuste de 10 ms. La ventana visible determina detalle y coste de pintado. No recentrar automáticamente durante un gesto.

### Generación y formato de picos

- Comando `generar-picos` del worker con PyAV, sobre ruta local de `voz.flac` autorizada por main. Decodificar por frames sin retener PCM completo y tomar el mínimo y máximo de todos los canales por bloque. Cada bloque base cubre 10 ms desde el origen de muestras. Usar límites enteros a partir de frecuencia y conservar el último bloque parcial. Cuantizar con saturación a enteros de 16 bits. El nivel siguiente combina pares conservando extremos. Con dos valores de 16 bits por bloque, la pirámide ocupa aproximadamente 48 KB por minuto más cabecera y redondeos.
- Formato binario v1 little endian. Cabecera fija de 24 bytes con magia ASCII `SKPV`, versión uint16, reservado uint16 en cero, frecuencia de muestras uint32, muestras decodificadas por canal uint64 y número de bloques base uint32. Cada nivel contiene pares int16 (mínimo, máximo), del más fino al más grueso. Los tamaños y offsets se derivan del contador de bloques, con `ceil(n/2)` hasta uno. El paso de un nivel es `10 × 2^nivel` ms. Validar tamaño exacto, campos y rango antes de leer. El worker deja un temporal en la carpeta indicada y devuelve solo metadatos de resultado por JSON Lines.
- Los archivos son derivados bajo `pistas/`, al lado de la voz, sin referencia en `cancion.json`. Main deriva el nombre de caché de versión y huella del archivo (identidad y metadatos de alta resolución, más invalidación explícita tras publicar nuevas pistas). Verifica la huella al solicitar, antes de publicar y después de operaciones que puedan competir. Publica por renombrado dentro de la carpeta y limpia temporales o generaciones viejas. Cancelar si se elimina la canción o se invalida su voz. Si falla generación, la canción conserva estado y medios.
- Generar bajo demanda al abrir Sincronía con voz disponible y deduplicar por canción y huella. Una generación activa como máximo. Reutilizar lanzador, protocolo, cancelación y apagado del worker. No introducir un paso de canción ni depender de instalar modelos. El renderer puede mostrar no disponible y reintentar. La edición, regla y minimapa siguen operables sin caché.
- El IPC expone estado/solicitud y lectura por id, rango temporal y presupuesto de hasta 4096 bloques. Main valida argumentos con Zod, confina rutas e inspecciona solo la porción de caché solicitada. Elegir el nivel más detallado que cumpla el presupuesto. La respuesta identifica generación, primer bloque, paso y datos binarios acotados. Ignorar resultados obsoletos en el renderer. No exponer rutas absolutas ni añadir una URL pública para estos archivos. La onda y el minimapa pintan en Canvas por cambios de viewport, datos o tamaño. El cabezal se actualiza por separado.

## Consecuencias

- Sin cambios en el esquema de canción y sin nuevas dependencias. La biblioteca previa puede regenerar la onda. La generación consume CPU local y puede demorarse en temas largos. La app sigue disponible durante la espera.
- Pruebas con audio generado, incluida una hora de voz. Registrar equipo, tiempos, tamaño de caché, memoria y CPU, límites de transferencia y navegación durante reproducción. E2E verifica trazado real, resize, teclado y puntero sin red ni modelos. Probar el bucle con un fragmento generado de extremos distinguibles.
- Revisar layout y controles en 1024 × 640, foco visible y alternativa a rueda. Los cambios de picos no se anuncian por fotograma.

## Fuentes

- [Audacity · Zoom Tool](https://manual.audacityteam.org/man/zoom_tool.html) y [Zoom to Selection](https://manual.audacityteam.org/man/view_menu_zoom.html).
- [REAPER · manual §§2.8–2.9 y 22](https://dlx.reaper.fm/userguide/html/).
- [Premiere · navegación de secuencias](https://helpx.adobe.com/uk/premiere/desktop/edit-projects/change-clip-sequence/navigate-sequences-in-the-timeline.html).
- [W3C · Web Audio API, bucles](https://www.w3.org/TR/webaudio-1.0/#looping).
- [Discusión técnica de la alfa](../versiones/0.2.0/discusion/r1-arquitecto.md).
