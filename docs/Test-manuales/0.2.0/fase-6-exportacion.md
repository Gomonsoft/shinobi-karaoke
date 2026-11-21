# Guía manual · Fase 6 · Exportación a video

> **Estado: pendiente de ajustar al cerrar la fase.** Escrita contra la [spec 10](../../ux/10-exportacion.md) y el [ADR 0019](../../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) mientras las tareas [0237](../../tareas/0237-servicio-de-exportacion-e-ipc.md) (servicio e IPC), [0238](../../tareas/0238-dialogo-de-exportacion-formulario.md) (formulario), [0239](../../tareas/0239-progreso-resultado-y-estado-de-exportaciones.md) (progreso y resultado), [0240](../../tareas/0240-puntos-de-entrada-de-la-exportacion.md) (puntos de entrada) y [0241](../../tareas/0241-pruebas-de-integracion-capturas-e-informe-de-la-fase-6.md) (integración e informe) siguen en curso. Al cerrarlas, el agente `qa` revisa los textos, los pasos y las cifras contra lo implementado y quita este aviso.

- Versión: 0.2.0 · Fase: 6
- Specs: [Exportación](../../ux/10-exportacion.md) (V1–V30, verificación manual M1–M9) · [Biblioteca · Fase 6](../../ux/02-biblioteca.md#fase-6-de-020--exportación) (X1–X7) · [Editor · Fase 6](../../ux/06-editor.md#fase-6-de-020--exportación) (EX1–EX7) · ADR: [0019](../../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) · Tareas: [0231](../../tareas/0231-worker-comando-exportar.md)–[0236](../../tareas/0236-destinos-temporal-y-diario-de-exportacion.md) (hechas) y [0237](../../tareas/0237-servicio-de-exportacion-e-ipc.md)–[0241](../../tareas/0241-pruebas-de-integracion-capturas-e-informe-de-la-fase-6.md) (en curso)
- Duración estimada: unas 6–8 h repartidas en dos o tres sesiones, porque la mayor parte es **esperar a que se exporte** (ver la tabla de «Tiempos»). Casos 1–7 (formulario, calidad, progreso y reproductores): unas 2 h. Casos 8–15: el resto, y los de tiempos, sustitución y «Mostrar en la carpeta» se repiten en cada sistema.
- Requisitos:
  - **La app empaquetada** de la rama de la fase (`npm run empaquetar` en `app/`, o el artefacto del CI), con el motor de separación instalado. Una exportación en la app de desarrollo vale para los casos de formulario, pero **no** para los tiempos.
  - **Sistemas**: **Windows**, **Linux** (idealmente X11 y Wayland) y **macOS**. Los tiempos (caso 8), la sustitución con el archivo abierto (caso 12) y «Mostrar en la carpeta» (caso 14) se repiten **en cada uno**. Si falta alguno, anótalo.
  - **Un equipo modesto** (portátil de unos 5 años o más) para los casos 9, 10 y 11, y **un equipo de 8 GB de memoria o menos** para el caso 10. Si el equipo tiene más, la prueba de 8 GB se hace con otro equipo o queda sin verificar.
  - **Dos pantallas reales** conectadas por cable para el caso 11 (ver la [guía de la fase 4](fase-4-ventana-secundaria-y-cola.md)).
  - **Reproductores**: VLC, OBS (como «Fuente multimedia»), Firefox, Chrome, Safari (solo con WebM, en macOS), el reproductor de serie de cada sistema (Windows: Reproductor multimedia **con y sin** la «Extensión de video AV1» de Microsoft Store; macOS: QuickTime; Linux: el de tu escritorio) y, si puedes, **un televisor con USB**.
  - **Canciones** (todas con la separación completada):
    - **A. «Corta»**: una canción **Lista** de 1–2 min (con la semilla de la app de desarrollo vale «Reproductor: lista», de 30 s, para el formulario; para la calidad hace falta una real).
    - **B. «Larga»**: una canción **real** de **6 min o más**, sincronizada **a mano** a pie de letra, con degradado en movimiento (para M2 y 4K).
    - **C. «Letra lista»**: una canción marcada como Letra lista.
    - **D. «Borrador»**: un borrador con algunas líneas sincronizadas.
    - **E. «Incompleta»**: una Lista con una línea sin inicio.
    - Con fondo claro y oscuro: prepara dos temas, uno de fondo `#FFFFFF` y otro de fondo `#101010`, para ver la marca de agua.
  - Un cronómetro, un analizador de medios si te sirve (por ejemplo, la información de archivo de VLC: Herramientas › Información de medios y códec) y espacio libre en disco de **20 GB** (los videos de 4K/60 son grandes).

No hace falta conocer el código. Cada fila tiene un paso, lo que debería pasar y una casilla. Si algo no coincide, márcalo como fallo y apúntalo en «Incidencias» con lo que viste.

## Vocabulario

- **Perfil**: combinación de proporción (16:9 o 4:3), resolución y FPS. **Formato**: **MKV (AV1 + Opus)** o **WebM (VP9 + Opus)**.
- **Temporal**: archivo oculto que se escribe en la carpeta de destino mientras se exporta. Solo al terminar bien pasa a ser el archivo final.
- **Sesión**: el reproductor abierto en la otra pantalla (fase 4).
- **Marca de agua**: la píldora «Shinobi Karaoke» abajo a la derecha del video.
- **Perfil no soportado**: opción marcada «— no disponible en este equipo». Es permanente en ese equipo.

## Preparación

1. Anota en «Ejecuciones» el equipo (modelo, CPU, memoria, disco), el sistema, y las pantallas.
2. Crea una carpeta vacía de pruebas para guardar los videos (por ejemplo, `Videos/Pruebas shinobi`).
3. Comprueba que el motor de audio está instalado (Ajustes › Motor de audio).
4. Cierra otros programas pesados antes de medir tiempos.

## Casos

### 1. Puntos de entrada y diálogo (formulario)

Criterios: V1–V4, V10, X1, EX1, EX2, EX7. La primera apertura de cada arranque comprueba qué puede exportar el equipo (1–2 s).

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 1.1 | En la Biblioteca, abre el menú ⋯ de la tarjeta de una canción **Lista** (A) | Hay un ítem **«Exportar video…»** (icono de película) entre «Editar datos» y «Aplicar tema…» | ☐ |
| 1.2 | Mira el ⋯ de un **borrador** (D) y de una **Letra lista** (C) y de una **incompleta** (E) | El borrador **no** tiene «Exportar video…»; la Letra lista y la incompleta sí | ☐ |
| 1.3 | Pulsa «Exportar video…» de A (la primera vez que abres la app) | Puede aparecer un instante «Comprobando qué puede exportar tu equipo…» (con «Exportar» inactivo); después, el diálogo «Exportar video» con «{título}» · {artista} · {duración} | ☐ |
| 1.4 | Mira el formulario | Estas opciones: **Audio** («Solo instrumental» · «Instrumental y voz»), **Proporción** («16:9 · Panorámica» · «4:3 · Clásica»), **Resolución**, **Fotogramas por segundo** (24 · 30 · 60), **Formato** («MKV (AV1 + Opus)» · «WebM (VP9 + Opus)»), **Guardar como** con [Cambiar…], una estimación «Ocupará unos … · tardará unos …», y a la derecha la **Muestra** con la marca de agua | ☐ |
| 1.5 | Comprueba los valores por defecto la primera vez | «Solo instrumental», «16:9 · Panorámica», «1920 × 1080 · Full HD», **30**, **MKV (AV1 + Opus)**. Bajo el formato: «Recomendado. Ocupa menos y es el formato de OBS. Si tu reproductor no lo abre, usa VLC.» El foco inicial está en «Audio» | ☐ |
| 1.6 | Abre la lista de «Resolución» con 16:9 | Exactamente: «1280 × 720 · HD», «1920 × 1080 · Full HD», «2560 × 1440 · QHD», «3840 × 2160 · 4K UHD» | ☐ |
| 1.7 | Cambia a «4:3 · Clásica» y abre la lista | «640 × 480 · SD», «1024 × 768 · XGA», «1600 × 1200 · UXGA», «2880 × 2160 · 4:3 máxima». Con 1920 × 1080 elegido, pasa a **1024 × 768** y la muestra cambia a 4:3 | ☐ |
| 1.8 | Elige **WebM (VP9 + Opus)** | La pista pasa a «Se abre en más sitios: navegadores (también Safari), Windows y Android. Ocupa algo más.», el nombre del archivo termina en **.webm**, la muestra y la estimación se actualizan | ☐ |
| 1.9 | Pulsa el botón ⓘ junto a «Formato» (con Intro o Espacio) | Aparece «Qué formato elegir» con la explicación de MKV y WebM (incluye lo de QuickTime y los televisores). Esc lo cierra y el foco vuelve al ⓘ | ☐ |
| 1.10 | Mira la «Muestra» | Una línea con el barrido a medias y la siguiente debajo; en la esquina inferior derecha, la píldora «Shinobi Karaoke». Debajo: «1920 × 1080 · 30 FPS · MKV» y «El video lleva la marca «Shinobi Karaoke» en esta esquina.» | ☐ |
| 1.11 | Pulsa «Cancelar» (o Esc) | Se cierra sin exportar y el foco vuelve al ⋯ de la tarjeta | ☐ |
| 1.12 | Abre el editor de A. En el ⋯ de la cabecera busca «Exportar video…» y pulsa Ctrl/Cmd + E con el foco en la lista de líneas | El ítem existe (con «Ctrl/Cmd + E»). El atajo abre el diálogo; si el audio sonaba, se **pausa** (el cabezal no se mueve) | ☐ |
| 1.13 | Cierra el diálogo | El foco vuelve al botón ⋯ o al elemento que lo tenía; el historial de deshacer, la selección, la pista y la velocidad **siguen igual** | ☐ |
| 1.14 | En una canción sin separar (o con separación en curso) abre el ⋯ del editor y pasa el ratón por «Exportar video…» | Inactivo, con el tooltip «Podrás exportar cuando termine la separación.» Ctrl/Cmd + E no hace nada. Sin ninguna línea con inicio: «Sincroniza al menos una línea para exportar.» | ☐ |
| 1.15 | Con el foco en un campo de texto o en el modo «Sincronizar al ritmo», pulsa Ctrl/Cmd + E | No hace nada | ☐ |
| 1.16 | Abre «Atajos de teclado» (F1) en el editor | Aparece «Ctrl/Cmd + E — Exportar video» | ☐ |
| 1.17 | Abre el diálogo y cambia formato (WebM), audio, resolución y FPS; pulsa «Exportar» (cuenta con la prueba corta: 24 FPS y 640 × 480), cancela, y vuelve a abrir el diálogo | Las opciones **se recuerdan** (formato, audio, proporción, resolución, FPS y carpeta), no el nombre | ☐ |
| 1.18 | Pulsa «Cambiar…» en «Guardar como» | Se abre el diálogo «Guardar» del sistema con la carpeta y el nombre «{título} — {artista} (karaoke).mkv». Cancelarlo no cambia nada. Si escribes otra extensión, se pone la del formato | ☐ |
| 1.19 | Con un destino elegido con «Cambiar…», cambia el formato | Vuelve al nombre propuesto con la otra extensión y aparece unos 4 s «Al cambiar el formato se ha vuelto a proponer el nombre: …» | ☐ |
| 1.20 | Prueba una canción cuyo título tenga caracteres como `/ : * ? " < > |` | El nombre propuesto los sustituye por «-» | ☐ |

### 2. Notas del formulario

Criterios: V8, V9. El orden de las notas es: existe, espacio, sesión, costoso, Letra lista, incompleta, borrador.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 2.1 | Abre el diálogo de **C** («Letra lista») | Nota `ⓘ`: «Letra lista: en el video la letra cambiará línea a línea, sin barrido, igual que en el reproductor.» La muestra no tiene barrido (línea en el color de la letra) | ☐ |
| 2.2 | Abre el diálogo de **E** (incompleta) | Aviso: «Falta 1 línea por sincronizar: no se verá en el video.» (con n: «Faltan {n} líneas…») | ☐ |
| 2.3 | Abre el diálogo desde el editor de **D** (borrador) | Nota: «Esta canción aún es un borrador. El video se hará con lo que tiene ahora, con barrido.» Aunque sea de Letra lista, el borrador se exporta con barrido | ☐ |
| 2.4 | Abre el diálogo con un borrador de tema sin guardar en el editor (modo D3) | Nota adicional: «Estás editando un tema sin guardar. El video usará el aspecto guardado; guarda el tema antes si quieres que salga en el video.» | ☐ |
| 2.5 | Elige 3840 × 2160 a 60 FPS | Aparece la nota `ⓘ` «Con estas opciones el video tardará bastante y ocupará mucho. Para una prueba rápida, elige una resolución menor.» Exportar sigue activo | ☐ |
| 2.6 | Exporta A a una carpeta y vuelve a abrir el diálogo con el mismo destino (después de que termine) | Aparece «Ya hay un archivo con este nombre. Se sustituirá solo cuando el video nuevo esté terminado; si cancelas o falla, se conserva.» y el botón dice **«Exportar y sustituir»** | ☐ |
| 2.7 | Elige una unidad con **poco espacio libre** (un USB pequeño) y una resolución grande | Aviso: «Puede que no haya espacio: el video ocuparía unos {tamaño} y quedan {libre} libres en ese disco.» Sigue sin bloquear | ☐ |
| 2.8 | Con la última carpeta usada **eliminada o desconectada**, abre el diálogo | Nota: «La carpeta que usaste la última vez ya no está disponible. Se guardará en {carpeta}.» | ☐ |
| 2.9 | Abre el diálogo de una canción cuya voz no esté disponible (borra `voz.flac` de una copia) | «Instrumental y voz» está inactivo, con «La voz de esta canción no está disponible.» y queda «Solo instrumental» | ☐ |

### 3. Calidad visual del video (M1)

Criterios: V16, V17, V19, M1. Exporta **B** (o A) con degradado y mira con VLC a pantalla completa. Haz una tabla (en «Ejecuciones») de lo que veas.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 3.1 | Exporta A en **MKV 1280 × 720 · 30 FPS**, **MKV 1920 × 1080 · 30**, **MKV 2560 × 1440 · 30** y **MKV 3840 × 2160 · 30** y ábrelos en VLC | En cada uno: letra **nítida**, sin bloques de compresión molestos en el barrido, sin **bandas** visibles en el degradado | ☐ |
| 3.2 | Repite con **WebM** en las mismas cuatro resoluciones | Mismo resultado visual (el formato no cambia la imagen). Anota diferencias de nitidez | ☐ |
| 3.3 | En 4:3, exporta **1024 × 768** y **2880 × 2160** en los dos formatos | Mismo resultado: letra nítida y marca visible | ☐ |
| 3.4 | Mira la **marca de agua** sobre el tema de fondo **claro** (`#FFFFFF`) | «Shinobi Karaoke» en una píldora oscura semitransparente abajo a la derecha, **legible** y discreta | ☐ |
| 3.5 | Mira la marca sobre el fondo **oscuro** | Igual de legible; no destaca demasiado | ☐ |
| 3.6 | Comprueba la posición en 16:9 y 4:3 | Siempre abajo a la derecha con el mismo margen (3 % del alto); **nunca toca la letra** | ☐ |
| 3.7 | Comprueba que la marca está en **todos** los fotogramas (avanza por todo el video) | No parpadea ni se mueve | ☐ |
| 3.8 | Compara el video con el reproductor de la app a pantalla completa en el mismo instante (con captura, por ejemplo en 0:30) | Mismo fondo, línea actual, siguiente, barrido y tamaño de letra. Sin controles, cursor, franjas ni avisos en el video | ☐ |
| 3.9 | Exporta una canción con **degradado en movimiento** con **reducir movimiento** activado en el sistema | El video **sí** se mueve (el movimiento reducido del equipo no se aplica al video) | ☐ |
| 3.10 | Mira el comienzo del video | Empieza en 0:00 con la pantalla de título y los puntos, **sin silencio previo** | ☐ |
| 3.11 | Exporta **C** (Letra lista) y **D** (borrador) | C: la línea activa se ve entera en un solo color, **sin barrido**; D: con barrido | ☐ |
| 3.12 | Exporta una canción con la **barra y la cuenta** activadas en los huecos (fase 5) | La barra, la cuenta y los puntos salen en los huecos, igual que en el reproductor | ☐ |
| 3.13 | Mira las **propiedades del archivo** (VLC › Información de medios) del MKV y del WebM | MKV: video **AV1** y audio **Opus**; WebM: **VP9** y **Opus**. Estéreo, 48 kHz, FPS constantes de los que elegiste, y la resolución elegida | ☐ |
| 3.14 | Compara la duración del video con la de la canción | Igual (± un fotograma) | ☐ |
| 3.15 | Exporta con «Instrumental y voz» y con «Solo instrumental» | La primera lleva la voz original al nivel de la canción; la segunda solo el instrumental. Sin saturación ni recortes | ☐ |

### 4. Sincronía percibida (M2)

Criterio: M2. Exporta **B** (≥ 6 min, sincronizada a mano) en **1080p30 MKV** con «Instrumental y voz».

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 4.1 | Reproduce el video en VLC y canta (o escucha) la canción con la voz | El barrido **coincide con la voz** como en el reproductor de la app | ☐ |
| 4.2 | Salta al **minuto 1**, **3** y **6** y mira si el barrido sigue acompasado con la voz | **Sin deriva**: en el minuto 6 el desfase es el mismo que en el 1 (no crece) | ☐ |
| 4.3 | Compara la última línea del video con la del reproductor de la app | Aparecen en el mismo segundo (± un fotograma) | ☐ |
| 4.4 | Anota cualquier desfase | Anota: ______ ms al principio / ______ ms al final | ☐ |

### 5. Progreso, segundo plano, cola y cancelación

Criterios: V11–V13, X2–X5, V27, V28. Con A en 1080p30 (o la que tarde al menos 1–2 min).

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 5.1 | Pulsa «Exportar» | El botón dice «Exportando…» con spinner (unos segundos como mucho) y el diálogo pasa a «Exportando video» con «{título} · {artista}», «1920 × 1080 · 30 FPS · Solo instrumental · MKV», y los subpasos «Preparar la canción», «Crear el video» y «Terminar el archivo» | ☐ |
| 5.2 | Mira «Crear el video» | Muestra «Creando el video… {n} %», una barra que **no retrocede**, «{mm:ss} de {mm:ss}» y el tiempo restante (los primeros 15 s «Calculando tiempo…», luego «quedan unos {n} minutos») | ☐ |
| 5.3 | Lee el texto de ayuda | «Puedes cerrar este cuadro y seguir usando Shinobi Karaoke: la exportación continúa. Lo que cambies a partir de ahora no entrará en este video.» El foco está en «Seguir en segundo plano» | ☐ |
| 5.4 | Pulsa «Seguir en segundo plano» (o Esc) | Se cierra el diálogo **sin cancelar**. La exportación continúa | ☐ |
| 5.5 | Mira la **tarjeta** de la canción en la Biblioteca | Una línea «⟳ Exportando video {n} % · quedan unos {n} min» con barra. Se actualiza al menos cada 2 s, **sin mover el foco ni reordenar la tarjeta** | ☐ |
| 5.6 | Abre el **panel de actividad** | La fila «{título} — Exportando video {n} %» con [Ir] y [✕]. El indicador de actividad la cuenta como en curso | ☐ |
| 5.7 | Pulsa [Ir] (o «Ver exportación» en el ⋯ de la tarjeta) | Se abre el diálogo en su estado actual | ☐ |
| 5.8 | Mientras se exporta, edita la letra, el estilo o el tema de esa canción (cambia un color o un tiempo), guarda | Se permite; al terminar, **el video no tiene esos cambios** (coincide con el estado guardado al pulsar «Exportar») | ☐ |
| 5.9 | Mientras se exporta, pulsa «Exportar video…» en otra canción | Se abre el diálogo y, al exportar, aparece «En cola: empezará cuando termine la exportación de «{otra}».» (tarjeta: «🕒 En cola para exportar»; panel con 🕒) | ☐ |
| 5.10 | Pulsa «Quitar de la cola» | La retira sin confirmar y aparece ««{título}» ya no está en la cola de exportación.» | ☐ |
| 5.11 | Vuelve a ponerla en cola y deja que la primera termine | La segunda **empieza sola** | ☐ |
| 5.12 | Añade una canción **nueva** (importa un archivo) mientras se exporta | La **separación avanza a la vez** sin esperar a que termine la exportación | ☐ |
| 5.13 | Abre el diálogo de una exportación en curso y pulsa «Cancelar exportación» | Pide confirmación: «¿Cancelar la exportación? Se borrará lo que lleva hecho.» con el foco en «Seguir exportando» (y, si había un archivo con ese nombre: «El archivo que ya había con ese nombre no se toca.») | ☐ |
| 5.14 | Pulsa «Seguir exportando» | Vuelve al progreso. Repite y esta vez confirma «Cancelar exportación» | ☐ |
| 5.15 | Mira el diálogo | Muestra «Cancelando y borrando el archivo temporal…», con los botones inactivos. Al terminar se cierra, aparece «Exportación cancelada.» y el foco vuelve al origen | ☐ |
| 5.16 | Mira la carpeta de destino (con mostrar archivos ocultos) | **No** queda ningún temporal ni archivo nuevo | ☐ |
| 5.17 | Cancela también desde la [✕] del panel y desde el ⋯ de la tarjeta («Cancelar exportación…») | Mismo comportamiento y confirmación; en cola, **sin** confirmación | ☐ |
| 5.18 | Pon una canción a exportar y **elimínala** desde la Biblioteca | El diálogo de eliminar añade «Se cancelará la exportación de video en curso.»; al confirmar no queda temporal en disco | ☐ |
| 5.19 | Navega por todo el diálogo solo con el teclado (Tab, flechas, Intro, Esc) | Se puede usar en todos sus estados; el foco no se pierde ni queda en el fondo de la página | ☐ |
| 5.20 | Con un lector de pantalla, deja que una exportación corra | Solo anuncia hitos («Exportando «{título}».», cada subpaso, 25/50/75 %, éxito) y los errores; **no** cada porcentaje | ☐ |

### 6. Resultado, éxito y fallo

Criterios: V15, V20–V22. Tras exportar A con éxito.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 6.1 | Deja que termine con el diálogo **abierto** | Pasa a «Video exportado» con el nombre del archivo, «1920 × 1080 · 30 FPS · MKV · {duración} · {tamaño}», «Tardó {n} min {n} s.» y «En {carpeta}». El foco está en «Mostrar en la carpeta» | ☐ |
| 6.2 | Repite con el diálogo **cerrado** («Seguir en segundo plano») | Aparece el aviso ««{título}»: video exportado.» con [Mostrar en la carpeta] que **no se cierra solo**. Con la ventana de la app en segundo plano, llega una notificación del sistema | ☐ |
| 6.3 | Provoca un fallo: elige como destino una **carpeta de solo lectura** (o una sin permisos) | Sale «No se puede guardar en esa carpeta.» junto a «Guardar como» o, si ocurre al exportar, en el diálogo de fallo | ☐ |
| 6.4 | (Opcional) Provoca «No queda espacio en el disco.» exportando a un disco o USB casi lleno | Fallo con «No queda espacio en el disco. Libera espacio o guarda el video en otra carpeta.» y «Se detuvo en {mm:ss} de {mm:ss}.» El temporal se borra | ☐ |
| 6.5 | En un fallo, pulsa «Copiar detalles» | Aviso «Detalles copiados.» y el portapapeles contiene el código del error | ☐ |
| 6.6 | En un fallo, pulsa «Cambiar opciones» y «Reintentar» | «Cambiar opciones» vuelve al formulario con las opciones anteriores; «Reintentar» exporta otra vez con una instantánea nueva | ☐ |
| 6.7 | Con el diálogo cerrado, provoca un fallo | Aparece ««{título}»: no se pudo exportar el video.» persistente, con [Ver] | ☐ |
| 6.8 | Intenta exportar dos canciones al **mismo archivo** | Sale «Ya se está exportando un video a ese archivo.» junto a «Guardar como» | ☐ |

### 7. Reproductores externos (M3)

Criterio: M3. Con **un MKV (AV1 + Opus)** y **un WebM (VP9 + Opus)** de A en 1080p30. Rellena la tabla de «Compatibilidad» al final y contrasta con lo que dice la ayuda del formato.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 7.1 | Abre el MKV y el WebM en **VLC** | Se ven y se oyen. Sin errores | ☐ |
| 7.2 | En **OBS**, añade cada uno como «Fuente multimedia» | Se ven y se oyen | ☐ |
| 7.3 | Abre cada uno en **Firefox** (arrastrando el archivo a una pestaña) y en **Chrome** | Se ven y se oyen (anota si el MKV no se abre en alguno) | ☐ |
| 7.4 | En macOS, ábrelos en **Safari** | El WebM se abre; anota el MKV | ☐ |
| 7.5 | En **Windows**: el Reproductor multimedia **sin** la «Extensión de video AV1» | El WebM se abre; el MKV (AV1) **no** (según lo que dice la ayuda) | ☐ |
| 7.6 | En Windows, instala la «Extensión de video AV1» de Microsoft Store y repite | El MKV ya se abre | ☐ |
| 7.7 | En **macOS**, ábrelos en **QuickTime** | **Ninguno** se abre (según la ayuda: usa VLC o IINA). Anota | ☐ |
| 7.8 | En **Linux**, ábrelos con el reproductor de tu escritorio (por ejemplo, Totem, Celluloid o Dragon) | Anota cuáles se abren | ☐ |
| 7.9 | Copia los dos a un **USB** y ábrelos en un televisor | Anota si se abren. Puede que ninguno (lo dice la ayuda) | ☐ |
| 7.10 | Exporta un video **4K a 60 FPS** en MKV y reprodúcelo en un equipo de antes de 2020 | Anota si se ve a tirones (la ayuda lo advierte) | ☐ |

### 8. Tiempos de 1080p30 y 4K/60 en Windows y Linux

Criterio: ADR 0019 §3 y M4 (guía de la fase). Para cada sistema, exporta **la misma canción** (B de 6 min o A de 1–2 min) con **MKV** y **WebM**. Cronometra desde «Exportar» hasta «Video exportado».

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 8.1 | **Windows**: exporta 1920 × 1080 · 30 FPS · MKV y anota el tiempo, el tamaño y la estimación del diálogo | Tiempo del orden de la duración de la canción. Anota: ______ | ☐ |
| 8.2 | Windows: 1080p30 en WebM | Anota tiempo y tamaño | ☐ |
| 8.3 | Windows: 3840 × 2160 · 60 FPS · MKV | Mucho más lento (según el ADR, de 5 a 20 veces la duración en un M1). Anota tiempo, tamaño y si completó | ☐ |
| 8.4 | Windows: 3840 × 2160 · 60 FPS · WebM | Anota | ☐ |
| 8.5 | **Linux**: los mismos cuatro (8.1–8.4) | Anota. Indica X11 o Wayland | ☐ |
| 8.6 | **macOS**: 1080p30 en los dos formatos y 4K/60 en MKV (si hay equipo) | Informativo. Anota | ☐ |
| 8.7 | Compara el tiempo real con la **estimación** del diálogo en cada caso | La estimación está dentro de **± 50 %** | ☐ |
| 8.8 | Repite una **segunda exportación** del mismo perfil | La estimación **mejora** (se corrige con lo que tardó antes en este equipo). Anota si la primera se quedó corta | ☐ |
| 8.9 | Mira que los videos de 4K/60 estén completos (duración correcta, sin cortarse) | Completos | ☐ |
| 8.10 | **Linux con GPU real** (no una máquina virtual sin aceleración): exporta a 3840 × 2160 y a 2880 × 2160 | La exportación **completa** y el video mide exactamente esa resolución. En el CI (Linux sin GPU) la captura sale de 3839 × 2159 y la prueba automática se omite: aquí se confirma si es un límite del entorno o de Linux. Si falla con «perfil no soportado», anótalo como incidencia grave | ☐ |

### 9. Equipo modesto: perfil modesto y 4K/60, y la app sigue usable

Criterio: M4. En el **equipo modesto**.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 9.1 | Exporta A en **1280 × 720 · 30 · MKV** y mide tiempo, tamaño y la memoria máxima de la app (Administrador de tareas / Monitor de Actividad / Monitor del sistema, sumando todos los procesos de Shinobi Karaoke, **incluido** el del motor de audio) | Termina. Anota: tiempo ______ · tamaño ______ · memoria ______ | ☐ |
| 9.2 | Exporta **3840 × 2160 · 60 · MKV** (si el equipo lo permite) y repite las medidas | Termina o falla con un error claro (p. ej. «Tu equipo se quedó sin memoria.»). Anota tiempo, tamaño y memoria | ☐ |
| 9.3 | Mientras exporta, usa la app: navega por la Biblioteca, abre el editor, escribe en el buscador | La app sigue **usable** (se mueve sin congelarse unos segundos) | ☐ |
| 9.4 | Mientras exporta, reproduce una canción en el reproductor local | Anota si hay tirones de audio o de imagen (la exportación no se pausa sola) | ☐ |
| 9.5 | Anota si el equipo se calienta o si el ventilador sube | Informativo | ☐ |

### 10. Equipo de 8 GB y resoluciones de 2160 líneas

Criterios: V5 y ADR 0019 §5. En un equipo con **8 GB de memoria o menos**. Si el equipo tiene más, queda sin verificar.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 10.1 | Abre el diálogo con 16:9 y despliega «Resolución» | La de **3840 × 2160 · 4K UHD** aparece con el sufijo «— no disponible en este equipo», sin candado | ☐ |
| 10.2 | Pasa el ratón por ella (o enfócala con las flechas) | Tooltip: «3840 × 2160 a {fps} FPS en MKV no está disponible en este equipo: hace falta un equipo con al menos 8 GB de memoria.» No se puede seleccionar (Intro no hace nada) | ☐ |
| 10.3 | Cambia a 4:3 | **2880 × 2160 · 4:3 máxima** igual de no disponible | ☐ |
| 10.4 | Con un equipo de más de 8 GB, comprueba que **sí** están disponibles | Se pueden elegir | ☐ |
| 10.5 | Elige 1440p y exporta con la memoria casi llena (otros programas abiertos) | Si se agota la memoria, sale «Tu equipo se quedó sin memoria. Cierra otros programas o elige una resolución menor.» con [Cambiar opciones] y [Reintentar], y el temporal se borra | ☐ |
| 10.6 | Recorre FPS (24, 30, 60) y formatos con alguna opción no soportada | Las no soportadas se ven con el sufijo, son enfocables y no seleccionables; si el FPS elegido deja de estar soportado, cambia al soportado más alto y aparece «Tu equipo no admite {n} FPS con estas opciones. Se ha elegido {n}.» | ☐ |

### 11. Exportar durante una sesión en dos pantallas (M5)

Criterios: V23, X6, ADR 0019 §9. **Dos pantallas reales** con la secundaria a 1920 × 1080 o más. Se hace con un **perfil modesto** (1280 × 720 · 30) y con **4K/60**, en el **equipo modesto** y, si puedes, en uno potente.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 11.1 | Abre la sesión en la segunda pantalla con 3 canciones en cola y ponla a sonar | La sesión funciona (ver la [guía de la fase 4](fase-4-ventana-secundaria-y-cola.md)) | ☐ |
| 11.2 | Con la sesión abierta, abre «Exportar video…» desde el ⋯ de una tarjeta | Está **disponible, sin candado**. El diálogo muestra la nota «El reproductor está abierto en otra pantalla. Exportar a la vez usa más recursos del equipo: si notas cortes en la canción, cancela la exportación.» y «Exportar» sigue activo | ☐ |
| 11.3 | Exporta con el perfil **modesto** (1280 × 720 · 30). **Escucha la secundaria 5 min** | **Sin cortes de audio ni tirones perceptibles** en la letra de la secundaria. Anota el número de cortes | ☐ |
| 11.4 | Mira CPU, GPU (si el sistema la muestra) y memoria con las dos cosas en marcha | Anota las cifras | ☐ |
| 11.5 | Repite con **4K/60** (o el perfil más pesado que soporte el equipo) durante 10 min | Sin cortes en la sesión. Si los hay, anota el momento y el sistema: el ADR 0019 §9 prevé añadir un bloqueo para ese perfil | ☐ |
| 11.6 | Con la exportación en curso, **abre la sesión** (al revés): «Abrir en otra pantalla…» | El diálogo de pantallas **no cambia**, la sesión se abre normal y la exportación **sigue** | ☐ |
| 11.7 | Con la sesión abierta y sonando, mira los cambios de canción (la cuenta entre canciones) con la exportación corriendo | La cuenta y la siguiente canción funcionan bien | ☐ |
| 11.8 | Con la sesión abierta y una exportación en curso, cierra el reproductor y mira la exportación | Sigue sin interrupción | ☐ |
| 11.9 | Comprueba que en ningún momento aparece un candado ni un texto de «bloqueo» por la sesión | No aparece. «No disponible en este equipo» solo para perfiles | ☐ |
| 11.10 | Con la sesión abierta y el diálogo de exportación abierto, cierra o abre la sesión | La nota de la sesión aparece o desaparece sin cerrar el diálogo | ☐ |

### 12. Sustituir un archivo existente (M6)

Criterios: V8, V13, V20 (DESTINO_NO_DISPONIBLE). Repite en cada sistema. Haz una copia del archivo original para comparar (o anota su tamaño y fecha).

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 12.1 | Exporta A a la carpeta de pruebas. Abre el archivo en VLC y ciérralo | Existe un archivo `….mkv` | ☐ |
| 12.2 | Vuelve a exportar A al mismo destino. El diálogo muestra el aviso de que existe y el botón «Exportar y sustituir». Pulsa y **cancela a mitad** (con la confirmación) | La exportación se cancela. El archivo **original sigue reproduciéndose** y conserva su tamaño y su fecha | ☐ |
| 12.3 | Repite y **déjalo terminar** | El archivo se ha **sustituido** (cambian tamaño y fecha; el contenido es el nuevo) y no queda ningún temporal | ☐ |
| 12.4 | Provoca un **fallo** a mitad (por ejemplo, quita el USB si es el destino) | Sale el fallo con «El archivo que ya había con ese nombre no se ha tocado.» | ☐ |
| 12.5 | **En Windows**: abre el archivo existente en un reproductor (VLC o el Reproductor multimedia) y **sin cerrarlo** exporta A al mismo nombre, hasta que termine | Al terminar sale el error «No se puede guardar en esa carpeta. Puede que no tengas permiso, que el disco se haya desconectado o que el archivo esté abierto en otro programa…» El **original sigue intacto** (no se pierde ni se corrompe) | ☐ |
| 12.6 | En Windows, cierra el reproductor y pulsa «Reintentar» | Ahora sí sustituye | ☐ |
| 12.7 | **En macOS y Linux**, repite 12.5 | Anota si el archivo abierto impide la sustitución (en esos sistemas suele dejar sustituir) | ☐ |

### 13. Cerrar la app y fallos de la app (M7)

Criterios: V25, V26. Haz una exportación larga (4K o B).

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 13.1 | Con una exportación en curso (y otra en cola), cierra la ventana (Ctrl+Q, Alt+F4 o ⌘Q) | Aparece el diálogo de cierre con «exportar «{título}»» en la lista y el texto «Los videos a medio exportar no se guardarán; los archivos que ya existían no se tocan.» El foco está en «Seguir trabajando» | ☐ |
| 13.2 | Pulsa «Seguir trabajando» | No cambia nada, la exportación sigue | ☐ |
| 13.3 | Vuelve a cerrar y confirma «Cerrar de todos modos» | La app cierra. En la carpeta de destino **no queda ningún temporal** y un archivo previo con ese nombre queda intacto | ☐ |
| 13.4 | Abre la app | **No** aparece ningún aviso | ☐ |
| 13.5 | Inicia otra exportación y **mata el proceso** de la app (Administrador de tareas › Finalizar tarea; macOS: Forzar salida; Linux: `kill -9`) | La app se cierra de golpe | ☐ |
| 13.6 | Mira la carpeta de destino y abre la app | Al abrirla, los restos se borran, y aparece **una sola vez** «La exportación de «{título}» no terminó porque Shinobi Karaoke se cerró.» con [Exportar video…] (abre el formulario con las opciones recordadas). Si no se pudo borrar el temporal, «No se pudo borrar un archivo temporal. Puedes borrarlo a mano.» con [Mostrar en la carpeta] | ☐ |
| 13.7 | Reinicia la app otra vez | El aviso **no** vuelve a salir | ☐ |
| 13.8 | **macOS**: con una exportación en curso, cierra la ventana principal con el botón rojo | La app sigue abierta y la exportación continúa. Al reabrir la ventana desde el Dock, el panel de actividad la muestra. ⌘Q sí muestra el diálogo de cierre | ☐ |
| 13.9 | Con una exportación en curso, usa «Reparar el motor de audio» (si se puede provocar) | La exportación se cancela con limpieza | ☐ |

### 14. Mostrar en la carpeta en los tres sistemas (M8)

Criterios: V15, M8. Repite en cada sistema.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 14.1 | **Windows**: en «Video exportado» pulsa «Mostrar en la carpeta» | Se abre el Explorador en la carpeta con el archivo **seleccionado** | ☐ |
| 14.2 | **macOS**: lo mismo | Se abre el Finder con el archivo **seleccionado** | ☐ |
| 14.3 | **Linux**: lo mismo. Anota el gestor de archivos (Nautilus, Dolphin, Thunar…) | Se abre la carpeta; anota si el archivo queda seleccionado (puede que no) y que **no** se muestra ningún aviso por ello | ☐ |
| 14.4 | Desde el aviso «video exportado» (diálogo cerrado), pulsa [Mostrar en la carpeta] | Igual que arriba | ☐ |
| 14.5 | Borra el video de la carpeta y vuelve a pulsar [Mostrar en la carpeta] | Aparece «El video ya no está en esa carpeta.» | ☐ |

### 15. Suspensión del equipo (M9)

Criterio: M9. Antes, deja el equipo configurado para apagar la pantalla a los 2 min y suspender a los 5 min (anota los valores para restaurarlos).

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 15.1 | Inicia una exportación larga (4K, o B en un perfil lento) y **no toques** el equipo durante el doble del tiempo de suspensión | La **pantalla puede apagarse**, pero el equipo **no se suspende** hasta que termina | ☐ |
| 15.2 | Al terminar, no toques el equipo otros 6 min | Ahora el equipo **sí** se suspende | ☐ |
| 15.3 | Mira la carpeta de destino tras 15.1 | El video está completo | ☐ |
| 15.4 | Restaura los tiempos de apagado y suspensión | — | ☐ |

### 16. Sin perfiles y motor de audio

Criterio: V20 y el estado F. Solo si puedes dañar el motor en una copia del perfil.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 16.1 | Con el motor de audio **no instalado** o dañado (en una copia), abre «Exportar video…» | Aparece «Este equipo no puede crear videos.» con la causa («Hay que reparar el motor de audio.») y [Reparar el motor de audio], [Copiar detalles] y [Cerrar] | ☐ |
| 16.2 | Pulsa [Reparar el motor de audio] | Se abre el flujo de reparación de la fase 3 | ☐ |

## Compatibilidad (M3)

Rellena una fila por sistema y reproductor: Sí / No / A tirones.

| Sistema | Reproductor | MKV (AV1 + Opus) | WebM (VP9 + Opus) | Coincide con la ayuda del formato |
|---|---|---|---|---|
| | | | | |

## Tiempos y medidas (M4, M5, ADR 0019)

| Equipo y SO | Perfil y formato | Tiempo | Estimación del diálogo | Tamaño | Memoria máxima | Cortes de audio en la sesión | CPU / GPU |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Ejecuciones

| Fecha | Persona | Equipo y SO | Pantallas / audio | Resultado | Notas |
|---|---|---|---|---|---|
| | | | | ✅ / ⚠️ / ❌ | |

## Incidencias

| Caso | Qué pasó | Gravedad | Tarea o pregunta creada |
|---|---|---|---|
