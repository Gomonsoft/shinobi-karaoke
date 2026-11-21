# Guía manual · Fase 4 · Ventana secundaria y cola

- Versión: 0.2.0 · Fase: 4
- Specs: [Biblioteca · Fase 4](../../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (S1–S18) · [Reproductor · Fase 4](../../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) (P1–P16) · [Editor · Fase 4](../../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola) (E1–E8) · [Ajustes · Fase 4](../../ux/08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola) (AR1–AR4) · ADR: [0017 §13](../../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md#13-estrategia-de-pruebas) · Tarea: [0190](../../tareas/0190-verificacion-e2e-capturas-e-informe-de-la-fase-4.md)
- Duración estimada: 60–75 min por equipo (de ellos, 30 min de sesión larga y 10–15 min de reposo, en los que solo hay que mirar)
- Requisitos:
  - **La app empaquetada** de la rama de la fase (`npm run empaquetar` en `app/`, o el artefacto del CI), con el motor de separación instalado.
  - **Dos pantallas reales**: la del equipo (o un monitor) y un segundo monitor, televisor o proyector conectado **por cable** (HDMI, DisplayPort o USB-C). Si se puede, que la segunda tenga **altavoces** (para el caso del audio por HDMI) y **otra escala** que la principal (por ejemplo, portátil al 200 % y monitor externo al 100 %).
  - Sistemas: Windows, macOS y Linux. En Linux, una sesión **X11** y otra **Wayland** (en la pantalla de inicio de sesión se elige «GNOME» o «GNOME sobre Xorg», o el equivalente de tu escritorio).
  - **Canciones**: al menos **4 canciones Lista**, mejor cortas (1–2 min), y para el caso 9 **10 canciones Lista** más **un archivo de audio largo (5 min o más) sin importar**. Para prepararlas sigue la guía del [flujo principal](../flujo-principal.md). Con la app de desarrollo vale la semilla (`npm run semilla` y `npm run dev` en `app/`): «Reproductor: lista» dura 30 s y se puede añadir varias veces a la cola.
  - Un cronómetro (el del móvil vale).

No hace falta conocer el código. Cada fila tiene un paso, lo que debería pasar y una casilla. Si algo no coincide, márcalo como fallo y apúntalo en «Incidencias» con lo que viste.

## Vocabulario

- **Principal**: la ventana normal de Shinobi Karaoke, donde está la Biblioteca. Es el puesto del operador.
- **Secundaria** o **reproductor**: la ventana que muestra la letra al público en la otra pantalla. Solo muestra; se maneja desde la principal.
- **Sesión**: el tiempo en que la secundaria está abierta.
- **Cola**: la lista de canciones que sonarán. Se ve en el panel «Cola de reproducción» de la Biblioteca (botón «Cola» arriba a la derecha).
- **Cuenta**: la cuenta atrás grande (4, 3, 2, 1) que aparece en la secundaria entre una canción y la siguiente.

## Preparación

1. Conecta la segunda pantalla por cable y comprueba en los ajustes del sistema que está en modo **extendido** (no duplicado).
2. Abre Shinobi Karaoke en la pantalla del equipo (la principal).
3. En **Ajustes › Reproductor**, deja «Cuenta entre canciones» en **4 s (predeterminado)**.
4. Anota en «Ejecuciones» el equipo, el sistema, las pantallas (modelo, resolución, escala) y por dónde sale el audio.

## Casos

### 1. Abrir el reproductor en la segunda pantalla

Criterios: S1, S3, P1, P2, P15. Repetir en Windows, macOS, Linux X11 y Linux Wayland (en Wayland, ve al caso 3).

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 1.1 | En la Biblioteca, pulsa «Abrir en otra pantalla…» (arriba, junto al título «Biblioteca») | Se abre el diálogo «Abrir el reproductor en otra pantalla». Aparecen las dos pantallas con número, nombre (si el sistema lo da) y resolución; la del equipo dice «Principal · Aquí está esta ventana». Está preseleccionada la segunda y «Pantalla completa» está marcada | ☐ |
| 1.2 | Comprueba que las resoluciones del diálogo son las reales de cada pantalla | Coinciden con las de los ajustes del sistema | ☐ |
| 1.3 | Pulsa «Abrir reproductor» | La secundaria aparece **en la segunda pantalla**, a pantalla completa, sin barra de título ni menú. La principal no se mueve y **sigue teniendo el foco**: si escribes en el buscador de la Biblioteca, el texto aparece ahí | ☐ |
| 1.4 | Añade una canción con «A la cola» en su tarjeta y empiézala con «Iniciar» en el panel de la cola | En la secundaria sale la pantalla de título y empieza a sonar. La letra se pinta a tiempo con la música | ☐ |
| 1.5 | Escucha atentamente | Solo suena **un** audio: no hay eco ni doble música. El sonido sale por la salida de audio predeterminada del sistema | ☐ |
| 1.6 | Desde el panel de la cola de la principal, pulsa Pausa, espera 3 s y Reanudar; después «Reiniciar canción» | La secundaria responde enseguida a cada orden (anota si notas retraso: se usará como medida de latencia en el informe) | ☐ |
| 1.7 | Mira la barra de progreso del panel durante 10 s | Avanza al menos una vez por segundo y va a la par que la secundaria | ☐ |
| 1.8 | Haz clic en la secundaria y pulsa F dos veces | Pasa a ventana y vuelve a pantalla completa **sin cortes** en el audio | ☐ |
| 1.9 | Con la secundaria enfocada, pulsa Esc | Pasa a ventana. **No** se cierra la sesión | ☐ |
| 1.10 | Mientras suena, provoca un toast en la principal (por ejemplo, añade otra canción a la cola) | El toast aparece en la principal y **nunca** en la secundaria | ☐ |
| 1.11 | Cierra el reproductor desde el panel («Cerrar reproductor») y confirma | La secundaria desaparece y la principal sigue en la Biblioteca | ☐ |
| 1.12 | Cierra y vuelve a abrir la app; pulsa «Abrir en otra pantalla…» | El diálogo recuerda la pantalla y la casilla «Pantalla completa» de la última vez | ☐ |
| 1.13 | Abre otra vez en la segunda pantalla **sin** «Pantalla completa» | La secundaria se abre como ventana dentro de la segunda pantalla, centrada | ☐ |

### 2. macOS: Spaces y transición de pantalla completa

Criterio: P1 (solo macOS).

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 2.1 | Abre el reproductor en la segunda pantalla con «Pantalla completa» | La secundaria entra en su propio Space a pantalla completa en la segunda pantalla, con la animación del sistema; la principal se queda en su escritorio | ☐ |
| 2.2 | Con la canción sonando, cambia de Space en la pantalla principal (Ctrl + ← / →) y vuelve | La secundaria sigue en su pantalla, a pantalla completa y sonando sin cortes | ☐ |
| 2.3 | Pulsa F en la secundaria para salir y entrar de nuevo en pantalla completa | La transición termina en la segunda pantalla (no salta a la principal) y el audio no se corta | ☐ |
| 2.4 | Elige en el diálogo la pantalla de la principal con «Pantalla completa» | El diálogo muestra la nota «Cubrirá esta ventana…»; al abrir, la secundaria cubre la principal; Cmd + Tab permite volver a la principal | ☐ |

### 3. Linux con Wayland

Criterio: S15b (variante Wayland), ADR 0017 §3. Inicia sesión en Wayland.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 3.1 | Pulsa «Abrir en otra pantalla…» | En lugar de la lista de pantallas aparece: «En este escritorio el sistema decide dónde se abre el reproductor. Arrástralo a la pantalla del público y pulsa F para verlo a pantalla completa.» No hay casilla «Pantalla completa» | ☐ |
| 3.2 | Pulsa «Abrir reproductor» | La secundaria se abre como ventana donde el sistema decida | ☐ |
| 3.3 | Arrastra la ventana a la segunda pantalla y pulsa F en ella | Queda a pantalla completa en la segunda pantalla | ☐ |
| 3.4 | Mira el panel de la cola | La pantalla aparece como «En otra ventana» | ☐ |
| 3.5 | Repite los pasos 1.4–1.11 | Mismo resultado que en X11 | ☐ |

### 4. Sensación visual de la cuenta entre canciones

Criterios: P3, P4, S7, AR2. Usa canciones cortas.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 4.1 | Con la sesión abierta, pon en la cola tres canciones y deja que la primera **termine sola** (o salta cerca del final) | En la secundaria aparece la cuenta: el fondo de la **siguiente** canción, un número grande blanco que baja **4, 3, 2, 1** a ritmo de un segundo, un anillo que se vacía de forma continua y, abajo a la derecha, la tarjeta «A continuación» con título y artista | ☐ |
| 4.2 | Mírala desde donde estaría el público (a unos metros) | El número se lee bien sobre el fondo; la animación es suave, sin saltos ni parpadeos; la tarjeta no tapa nada importante | ☐ |
| 4.3 | Compara la cuenta del panel de la principal con la de la secundaria | Muestran el mismo número (como mucho, un segundo de diferencia) | ☐ |
| 4.4 | Al llegar a 1 | La siguiente canción empieza con su pantalla de título, sin silencio raro ni corte brusco | ☐ |
| 4.5 | Cronometra una cuenta completa | Dura 4 s (± 0,5 s). Anota la diferencia: es la «desviación de la cuenta» del informe | ☐ |
| 4.6 | En **Ajustes › Reproductor** elige **10 s** y vuelve a la Biblioteca; deja terminar otra canción y cronometra | La cuenta dura 10 s | ☐ |
| 4.7 | Activa **reducir movimiento** en el sistema (Windows: Configuración › Accesibilidad › Efectos visuales › Efectos de animación desactivados; macOS: Accesibilidad › Pantalla › Reducir movimiento; GNOME: Accesibilidad › Reducir animación) y provoca otra cuenta | No hay anillo ni efecto de escala: el número cambia de golpe cada segundo y la tarjeta cambia sin fundido | ☐ |
| 4.8 | Desactiva reducir movimiento y vuelve a dejar **4 s** en Ajustes | — | ☐ |

### 5. Desconectar y reconectar el cable

Criterios: S15, P13, ADR 0017 §3.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 5.1 | Con una canción sonando a pantalla completa en la segunda pantalla y dos pendientes en la cola, **desconecta el cable** de la segunda pantalla | La secundaria pasa a **ventana** en la pantalla principal, sin robar el foco. **El audio no se corta** y la cola no cambia | ☐ |
| 5.2 | Mira la principal | Aparece el aviso «Se desconectó «…». El reproductor sigue sonando en una ventana en «…».» con [Mover a…] | ☐ |
| 5.3 | **Vuelve a conectar el cable** | La secundaria **no** se mueve sola. En la principal aparece ««…» vuelve a estar conectada.» con [Llevar el reproductor allí] | ☐ |
| 5.4 | Pulsa «Llevar el reproductor allí» | La secundaria vuelve a la segunda pantalla y a pantalla completa; el audio sigue sin cortes | ☐ |
| 5.5 | Repite 5.1 durante una **cuenta** entre canciones | La cuenta sigue y la siguiente canción empieza bien | ☐ |
| 5.6 | Con el cable desconectado, usa [Mover a…] para elegir otra pantalla (si tienes una tercera) | La secundaria se mueve allí | ☐ |

### 6. Audio por HDMI

Criterio: P2 y riesgo «HDMI» del ADR 0017. Necesita una segunda pantalla con altavoces y la salida de audio del sistema puesta en ella.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 6.1 | En el sistema, elige como salida de audio la de la segunda pantalla (HDMI/DisplayPort) y abre la sesión allí | El sonido sale por los altavoces de la segunda pantalla | ☐ |
| 6.2 | Con la canción sonando, **desconecta el cable** | Anota qué pasa con el sonido: si pasa solo a los altavoces del equipo (la salida predeterminada nueva) o se queda mudo. La cola y la letra siguen avanzando | ☐ |
| 6.3 | Si quedó mudo, pausa y reanuda desde el panel | Anota si vuelve el sonido. Si no vuelve hasta la siguiente canción o nunca, apúntalo como incidencia | ☐ |
| 6.4 | Reconecta el cable y vuelve a elegir la salida HDMI en el sistema | Anota si el sonido vuelve a salir por la pantalla sin cerrar el reproductor | ☐ |

### 7. Pantallas con escalas distintas

Criterio: P1 y ADR 0017 §2 (colocación con resoluciones distintas). Por ejemplo, portátil al 200 % y monitor externo al 100 %.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 7.1 | Abre la sesión en la pantalla de **distinta escala**, sin «Pantalla completa» | La ventana aparece **entera** dentro de esa pantalla, centrada y de un tamaño razonable (unos cuatro quintos de la pantalla), no partida entre las dos | ☐ |
| 7.2 | Pulsa F | Ocupa toda la pantalla; la letra se ve nítida (no borrosa) y del tamaño adecuado | ☐ |
| 7.3 | Arrastra la principal de una pantalla a otra mientras suena | La principal se reescala sin errores y la secundaria no cambia | ☐ |
| 7.4 | Cambia la resolución de la segunda pantalla en los ajustes del sistema con la secundaria **en ventana** | La ventana se recoloca dentro de la pantalla | ☐ |

### 8. Reposo durante un evento largo

Criterio: P14, ADR 0017 §4. Antes, pon en el sistema el apagado de pantalla en el mínimo (1–2 min) y apunta el valor original para restaurarlo.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 8.1 | Abre la sesión, empieza una canción y **páusala** desde el panel. No toques el teclado ni el ratón durante el doble del tiempo de apagado | **Ninguna** pantalla se apaga ni el equipo entra en reposo | ☐ |
| 8.2 | Repite con la secundaria en espera («Detener cuenta») y en «Fin de la cola» | Tampoco se apaga | ☐ |
| 8.3 | Cierra el reproductor y espera de nuevo sin tocar nada | La pantalla se apaga según el ajuste del sistema | ☐ |
| 8.4 | Restaura el tiempo de apagado original | — | ☐ |

### 9. Sesión larga con separación en segundo plano

Criterio: riesgo «CPU durante la separación» del ADR 0017 y medidas del informe. Necesita 10 canciones Lista y un audio largo sin importar.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 9.1 | Abre la sesión a pantalla completa en la segunda pantalla y añade las 10 canciones a la cola | La primera empieza; el panel muestra 9 pendientes | ☐ |
| 9.2 | Mientras suena, en la principal pulsa «Añadir canción» e importa el audio largo, para que se separe en segundo plano | La separación avanza en la tarjeta o el panel de actividad | ☐ |
| 9.3 | Deja correr la sesión **30 minutos** escuchando. Cuenta cada corte, chasquido o tirón de audio, y cada salto o parón de la letra | Ningún corte (anota el número y en qué momento: durante la separación o después) | ☐ |
| 9.4 | Durante la sesión, reordena, quita y añade canciones desde la principal | La canción que suena nunca se interrumpe | ☐ |
| 9.5 | Al minuto 15, mira la memoria de la app (Windows: Administrador de tareas; macOS: Monitor de Actividad; Linux: Monitor del sistema), sumando los procesos de Shinobi Karaoke | Anota la cifra: es la «memoria con las dos ventanas» del informe | ☐ |
| 9.6 | Al acabar, cierra el reproductor con «Cerrar y eliminar cola» | La sesión termina sin errores | ☐ |

### 10. Salir de la app con el reproductor abierto (macOS)

Criterio de la spec: S13 · Decisión 0059 §4.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 10.1 | Con el reproductor abierto en la otra pantalla y canciones en cola, cierra la ventana principal con el botón rojo | Aparece «¿Cerrar la ventana?»; al confirmar se cierra el reproductor y la cola se conserva | ☐ |
| 10.2 | Vuelve a abrir la ventana desde el Dock | La cola sigue ahí | ☐ |
| 10.3 | Abre otra vez el reproductor y pulsa Cmd + Q | Aparece «¿Salir…?» con el foco en «Cancelar» | ☐ |
| 10.4 | Pulsa «Cancelar» | No se cierra nada y la canción sigue sonando | ☐ |
| 10.5 | Repite Cmd + Q y confirma | Se cierran las dos ventanas; al abrir la app no hay sesión ni cola | ☐ |

### 11. Regresiones corregidas a comprobar

Correcciones posteriores a la primera versión de esta guía. Repite cada una tras cualquier cambio en el editor, el reproductor o el empaquetado.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 11.1 | Abre una canción en el editor con la ventana **a pantalla completa** (maximizada) y mira el borde inferior y la derecha. Intenta desplazar la página con la rueda del ratón o el trackpad | **No hay scroll de página**: no se desplaza ni 1 px (antes se colaba por el aviso oculto del cierre de sesión). Repite en 1280 × 720 y 1920 × 1080 | ☐ |
| 11.2 | Con una sesión abierta, cierra el reproductor («Cerrar reproductor») y, **antes de que termine**, haz clic en el buscador de la Biblioteca (o pulsa Tab hasta otro control) para estar en otra cosa | El foco se queda donde lo pusiste: **no salta** al botón «Abrir en otra pantalla…» | ☐ |
| 11.3 | Repite con «Cerrar y eliminar cola» (eliminar la cola) estando en otra cosa | Igual: el foco **no salta** al botón. Si no hiciste nada, el foco sí puede volver a «Abrir en otra pantalla…» (comportamiento normal) | ☐ |
| 11.4 | **Solo en Windows**, con la app **empaquetada** (instalada con el instalador, no `npm run dev`): ábrela | La app **arranca** y muestra la **Biblioteca** (el preload carga). No queda una ventana en blanco ni un error; si fallara, la Biblioteca aparecería vacía o sin botones | ☐ |

### 12. Criterios sin prueba automática (informe de la fase 4)

Criterios de la spec: S17, E5, S12 y S16. El informe los marca «sin evidencia» o parciales.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 12.1 | Con la ventana a 1024 × 576 y el panel «Cola de reproducción» abierto, mira la Biblioteca | Las tarjetas quedan en 2 columnas y no aparece scroll horizontal (S17) | ☐ |
| 12.2 | Abre una canción en el Editor, cambia un tiempo y un color del estilo, y sin guardar vuelve a la Biblioteca y abre el reproductor en la otra pantalla | Los cambios del editor quedan guardados antes de que empiece la canción: al cerrar el reproductor y reabrir el editor siguen ahí (E5) | ☐ |
| 12.3 | Con canciones en cola, cierra el reproductor eligiendo «Cerrar y conservar cola» | El foco queda en «Abrir en otra pantalla…» del panel (S12) | ☐ |
| 12.4 | Con el panel de la cola enfocado, pulsa letras sueltas (p. ej. `s`, `n`) y recorre el panel con Tab | Ninguna letra suelta ejecuta acciones; el foco nunca desaparece (S16) | ☐ |
| 12.5 | Arrastra con el ratón una canción pendiente a otra posición, también hasta los bordes de una lista larga | La canción se mueve a donde la sueltas y la lista se desplaza sola en los bordes; la canción que suena no se interrumpe (S5) | ☐ |

## Ejecuciones

| Fecha | Persona | Equipo y SO | Pantallas / audio | Resultado | Notas |
|---|---|---|---|---|---|
| | | | | ✅ / ⚠️ / ❌ | |

Medidas para el informe de la fase (`docs/versiones/0.2.0/informe-fase-4.md`):

| Equipo y SO | Latencia percibida principal → secundaria (1.6) | Desviación de la cuenta (4.5) | Memoria con dos ventanas (9.5) | Cortes en 30 min (9.3) |
|---|---|---|---|---|
| | | | | |

## Incidencias

| Caso | Qué pasó | Gravedad | Tarea o pregunta creada |
|---|---|---|---|
