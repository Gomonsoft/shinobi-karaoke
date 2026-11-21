# Guía manual · Fase 5 · Estilo, espera y Letra lista

- Versión: 0.2.0 · Fase: 5
- Specs: [Editor · Fase 5](../../ux/06-editor.md#fase-5-de-020--estilo-espera-y-letra-lista) (G, IE, LL, AS) · [Reproductor · Fase 5](../../ux/07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista) (R1–R14) · [Biblioteca · Fase 5](../../ux/02-biblioteca.md#fase-5-de-020--estilo-espera-y-letra-lista) (LB1–LB7) · ADR: [0018](../../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) · Tareas: [0211](../../tareas/0211-editor-controles-de-degradado-y-movimiento.md)–[0217](../../tareas/0217-biblioteca-insignia-letra-lista.md) y [0219](../../tareas/0219-integracion-guia-manual-e-informe-de-la-fase-5.md)
- Duración estimada: 2 h 30 min en total (40 min la parte de TV y proyector, 30 min el bloque «Ajustar los silencios», 20 min la comparación con 0.1.0). Se puede repartir en dos sesiones: casos 1–9 (aspecto y espera) y 10–17 (Letra lista, silencios y compatibilidad).
- Requisitos:
  - **La app empaquetada** de la rama de la fase (`npm run empaquetar` en `app/`, o el artefacto del CI), con el motor de separación instalado. Para los casos con sesión en dos pantallas, mira los requisitos de la [guía de la fase 4](fase-4-ventana-secundaria-y-cola.md).
  - **Un equipo modesto** (portátil de unos 5 años o más, sin tarjeta gráfica dedicada) para los casos 4 y 9. Si solo tienes un equipo potente, anótalo en «Ejecuciones»: esos casos quedan sin verificar.
  - **Una TV de 55" y un proyector** (conectados por cable) y poder sentarse a **5 m**. Sin ellos, los casos 5 y 6 quedan sin verificar.
  - Sistemas: macOS, Windows y GNOME (Linux) para el caso 7 (movimiento reducido del sistema).
  - **Canciones** (todas con la separación completada):
    - **A. «Silencios»**: una canción **real** con **silencios largos entre enunciados** (de 3 s o más: intros instrumentales, puentes, solos) con la letra sincronizada **línea a línea** y los fines de algunas líneas **fijados a mano** (así sale el aviso de «fin fijado»). Debe estar **abierta al menos una vez en el editor**, para que existan los picos de voz.
    - **B. «Seguidas»**: una canción **con frases seguidas**, sin silencios apreciables entre líneas (rápida, tipo rap o pop acelerado), sincronizada línea a línea. Sirve también para el caso 11.
    - **C. «Borrador»**: una canción con líneas **sin inicio** (por ejemplo, 3 líneas sin sincronizar).
    - **D. «Larga»**: la que quieras, de 3 min o más, **Lista**, para los casos de movimiento.
    - Con la app de desarrollo vale la semilla (`npm run semilla` y `npm run dev` en `app/`): «Reproductor: lista» dura 30 s y sirve de D corta. Para A y B hacen falta canciones reales.
    - Para el caso 15, las **6 canciones** sincronizadas a mano de la [guía de calibración](fase-5-calibracion-de-silencios.md).
  - **Una copia de la carpeta de la biblioteca** antes de empezar (para el caso 16 con la app 0.1.0, que no debe tocar tus datos de verdad).
  - Un cronómetro (el del móvil vale).

No hace falta conocer el código. Cada fila tiene un paso, lo que debería pasar y una casilla. Si algo no coincide, márcalo como fallo y apúntalo en «Incidencias» con lo que viste.

## Vocabulario

- **Estilo › Fondo**: en el editor, pestaña **Estilo**, sección «Fondo». Con **Degradado** elegido aparecen Forma, Centro o Ángulo, Colores y Movimiento.
- **Cónico**: degradado en abanico alrededor de un punto, como un reloj de colores.
- **Fase**: en qué punto del ciclo de movimiento está el fondo. La fase 0 es la imagen quieta que se ve en pausa en 0:00.
- **Hueco** o **silencio**: el tiempo entre que acaba una línea y empieza la siguiente.
- **Indicadores de espera**: los tres avisos del hueco: **Puntos ●●●**, **Barra** (una barra que se encoge hacia el centro) y **Cuenta 3·2·1**.
- **Silencio mínimo**: el hueco más corto en que salen los indicadores (4,0 s al principio).
- **Letra lista**: una canción terminada que se reproduce **sin barrido**: la línea aparece entera en el color de la letra, sin rellenarse. La **Lista** normal sí tiene barrido.
- **Fin fijado**: el fin de una línea que se puso a mano (contorno continuo en la línea de tiempo); el automático es discontinuo.

## Preparación

1. Haz una copia de la carpeta de la biblioteca.
2. Abre Shinobi Karaoke y comprueba que están las canciones A a D. En **Ajustes › Reproductor**, deja «Cuenta entre canciones» en 4 s.
3. Anota en «Ejecuciones» el equipo, el sistema, las pantallas (modelo, tamaño, resolución) y el proyector o la TV.
4. Para los casos de movimiento, en el editor de D pon un degradado de **2 colores muy distintos** (por ejemplo, `#FFD400` y `#1B1033`) con **Movimiento** marcado. Ver el caso 1.

## Casos

### 1. Controles del degradado y del movimiento (editor)

Criterios: G1, G3, G5, G7, G9, G11. Tarea 0211.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 1.1 | Abre la canción D en el editor, pestaña **Estilo**, sección «Fondo». Elige **Degradado** | Aparece el control «Forma» con **Lineal**, **Radial** y **Cónico**, empezando en **Lineal** con su «Ángulo». Aparecen los colores y la casilla «Movimiento» **desmarcada** | ☐ |
| 1.2 | Elige **Radial** | Aparece «Centro» con una cuadrícula de 3 × 3 posiciones y «Centro» elegido. La vista previa cambia en menos de un instante: el primer color está en el centro | ☐ |
| 1.3 | Enfoca la cuadrícula y pulsa las flechas ← → ↑ ↓ | La selección se mueve en dos dimensiones y **no da la vuelta** en los bordes. La vista previa sigue la elección | ☐ |
| 1.4 | Elige **Cónico** | Aparecen «Ángulo de inicio» y la misma cuadrícula «Centro». Los colores, el ángulo y el centro se conservan | ☐ |
| 1.5 | Pulsa Ctrl+Z (⌘Z en macOS) | Vuelve a la forma anterior en un solo paso | ☐ |
| 1.6 | Marca **Movimiento** | Aparece «Velocidad» con **Lenta · Media · Rápida** en **Media**, y la ayuda «El degradado gira despacio. Se mueve con la canción: en pausa se queda quieto.» (con Radial: «El centro del degradado describe una órbita lenta…»; con Cónico: «El degradado gira alrededor de su centro…») | ☐ |
| 1.7 | Dale a reproducir (espacio) y mira la vista previa. Después pausa | Con la música sonando, el fondo se mueve. **En pausa se queda quieto** | ☐ |
| 1.8 | Debajo de la vista previa, mira la fila de botones | A la derecha de «Probar a pantalla completa» hay un botón con el icono ❚❚ («Detener el movimiento del fondo») | ☐ |
| 1.9 | Reproduce otra vez y pulsa ❚❚ | La vista previa **se queda quieta** y el botón pasa a ▶ («Mover el fondo»). Pulsa «Probar a pantalla completa»: **el fondo sí se mueve** allí. Vuelve con Esc | ☐ |
| 1.10 | Pulsa ▶ del botón y después desmarca «Movimiento» | La vista previa se vuelve a mover; al desmarcar, se queda quieta y desaparece el botón ❚❚ | ☐ |
| 1.11 | Con Movimiento marcado en Media, pulsa «Guardar como tema nuevo…», llámalo «Prueba cónico» y aplícalo a otra canción con «Aplicar tema…» | La otra canción muestra la misma forma, centro, ángulo y movimiento | ☐ |
| 1.12 | En la canción original, vincula un tema que tenga degradado en movimiento (D1) | La fila «Fondo» del resumen dice, por ejemplo, «Degradado radial · centro · en movimiento (media)» y los controles **no** son editables | ☐ |
| 1.13 | Estrecha y ensancha el panel del editor a **300, 360 y 480 px** (o el ancho de ventana equivalente) con el panel Estilo abierto | No hay scroll de página en ningún ancho y ningún texto se corta. La fila de Velocidad no se parte | ☐ |

### 2. Cónico sin costura (G4)

Criterio: G4. Con la canción D y el degradado de 2 colores muy distintos.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 2.1 | Elige **Cónico** con los dos colores `#FFD400` y `#1B1033`, **sin** movimiento | Se ve un abanico sin ningún **corte** brusco en ningún punto (ni al inicio, ni al volver del último color al primero) | ☐ |
| 2.2 | Cambia el «Ángulo de inicio» de 0 a 359 con el dial, mirando el abanico | La unión entre el último color y el primero se ve **suave** con cualquier ángulo | ☐ |
| 2.3 | Añade un tercer y un cuarto color con «+ Añadir color» | Los colores se reparten por igual y siguen sin costura | ☐ |
| 2.4 | Quita colores hasta 2 y cambia a **Lineal** y de nuevo a **Cónico** | Al volver a Lineal el degradado es el de siempre; al volver a Cónico, sin costura | ☐ |
| 2.5 | Pulsa «Probar a pantalla completa» con el cónico | En pantalla completa tampoco hay costura. Esc para volver | ☐ |

### 3. Misma fase en el editor y el reproductor, y buscar en pausa

Criterios: G6, R1, R2. Tarea 0211 («a mano»: buscar en pausa muestra la fase del instante).

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 3.1 | Con la canción D (cónico en movimiento, Media), pausa en el editor en 0:12 aproximadamente y fíjate en el fondo de la vista previa | Anota la posición de los colores (haz una captura de pantalla) | ☐ |
| 3.2 | **Con la música en pausa**, haz clic en la línea de tiempo en 1:00 y después en 0:12 otra vez | El fondo **cambia de fase al buscar**, aunque esté en pausa; al volver a 0:12 es el mismo de la captura | ☐ |
| 3.3 | Cierra el editor y reproduce D desde la Biblioteca con «Reproducir». Pausa en 0:12 (con ← → ajusta) y compara con la captura | La geometría del fondo es la misma que en el editor en ese instante | ☐ |
| 3.4 | En el reproductor, pausa 10 s y mira el fondo | **No se mueve en la pausa** | ☐ |
| 3.5 | Busca con la barra al final y a la mitad, y con ⏮ vuelve al inicio | Cada vez el fondo salta a la fase de ese instante. Tras el silencio previo, en 0:00, está en la fase 0 | ☐ |
| 3.6 | Deja terminar la canción hasta la pantalla final | El fondo se queda en la fase del último instante y no sigue moviéndose | ☐ |
| 3.7 | Con una canción con degradado en movimiento, mira su **portada** en la Biblioteca y la cuenta entre canciones de una sesión (opcional) | Las portadas del fondo se ven **quietas** (fase 0), no se mueven | ☐ |

### 4. Fluidez del fondo en movimiento (G12)

Criterio: G12. **En el equipo modesto**, con la pantalla a 1920 × 1080.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 4.1 | Abre D en el editor con un degradado **Radial** y otro **Cónico** en movimiento **Rápida**, a 1920 × 1080, y reproduce 1 min mirando la vista previa | El movimiento es fluido, sin saltos ni parones. Anota los tirones que veas (o ninguno) | ☐ |
| 4.2 | A la vez, mira el barrido de la línea actual | El barrido sigue la voz sin retrasos ni saltos: el movimiento del fondo no lo estorba | ☐ |
| 4.3 | Pulsa «Probar a pantalla completa» y mira 1 min | Lo mismo en pantalla completa | ☐ |
| 4.4 | Abre el Administrador de tareas / Monitor de Actividad / Monitor del sistema y anota el uso de CPU de la app con el fondo en movimiento y con ❚❚ pulsado | Anota las dos cifras (informativo) | ☐ |

### 5. Sensación de las velocidades (TV a 5 m)

Criterio: verificación manual del editor y del reproductor. Conecta la TV de 55" y reproduce D con la **secundaria** o a pantalla completa en la TV, sentado a **5 m**.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 5.1 | Reproduce con velocidad **Lenta** (60 s por vuelta) 1 min | Se percibe un movimiento lento, agradable; no distrae de la letra y **no marea** | ☐ |
| 5.2 | Repite con **Media** (30 s por vuelta) | Igual: perceptible pero cómodo | ☐ |
| 5.3 | Repite con **Rápida** (15 s por vuelta) | Se nota claramente. Anota si **marea**, si distrae de la letra o si resulta cansado en 3 min de canción | ☐ |
| 5.4 | Repite 5.1–5.3 con un degradado **Radial** y otro **Lineal** | Anota qué forma y qué velocidad te parecen más cómodas. Es una opinión, no un fallo | ☐ |
| 5.5 | Pide a otra persona que mire 2 min la velocidad Rápida | Anota si a esa persona le marea | ☐ |

### 6. Legibilidad de la cuenta y la barra a 5 m (TV 55" y proyector)

Criterio: verificación manual del reproductor. Primero en la TV, luego en el proyector. Usa una canción con huecos de 6 s o más (la canción A, con la cuenta y la barra activadas, ver el caso 8), con un degradado **claro** y otro **oscuro**, quieto y en movimiento.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 6.1 | En el editor de A, marca en «Indicadores de espera» **Puntos**, **Barra** y **Cuenta 3·2·1**. Abre la sesión en la TV y reproduce A con un degradado **oscuro** | Desde 5 m se leen bien el **número** de la cuenta y la **barra** que se encoge. La cuenta y la barra no quedan lavadas ni invisibles | ☐ |
| 6.2 | Cambia a un degradado **claro** (por ejemplo, amarillos y blancos) y vuelve a mirar un hueco | Se siguen leyendo; si no, anota el degradado y el color | ☐ |
| 6.3 | Activa el movimiento del degradado (Media) y repite en un hueco | La cuenta y la barra siguen legibles mientras el fondo se mueve | ☐ |
| 6.4 | Comprueba que la barra sube de 40 % de ancho al empezar el hueco hasta desaparecer justo cuando entra la línea, y que la cuenta muestra «3», «2», «1» en los últimos 3 s | Es así y se entiende «qué va a pasar» sin explicación | ☐ |
| 6.5 | Repite 6.1–6.3 con el **proyector** (en una sala con la luz ambiente de un evento) | Anota si la barra y la cuenta se leen; el proyector suele perder contraste | ☐ |
| 6.6 | En la secundaria, mira que el texto de las líneas no se mueva al aparecer o desaparecer los indicadores | La línea siguiente y la actual **no cambian de sitio ni de tamaño** con 0, 1, 2 o 3 indicadores | ☐ |

### 7. Movimiento reducido del sistema

Criterios: G8, R3, R4, R10. Repetir en macOS, Windows y GNOME.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 7.1 | Activa **reducir movimiento** en el sistema (macOS: Accesibilidad › Pantalla › Reducir movimiento; Windows: Configuración › Accesibilidad › Efectos visuales › Efectos de animación desactivados; GNOME: Accesibilidad › Reducir animación). Reinicia la app | — | ☐ |
| 7.2 | Abre D (cónico en movimiento) en el editor y reproduce | La vista previa **no se mueve**: se ve la fase 0. En el panel, bajo «Movimiento», aparece «Tu sistema pide reducir el movimiento: en este equipo el fondo se verá quieto.» La casilla sigue editable | ☐ |
| 7.3 | Busca el botón de la vista previa de «Detener el movimiento del fondo» | **No aparece** | ☐ |
| 7.4 | En «Probar a pantalla completa» y en el reproductor local de D | El fondo está **quieto** en todo momento | ☐ |
| 7.5 | En un hueco con **Cuenta 3·2·1** y **Puntos** (canción A) | Los números y los puntos cambian **de golpe**, sin fundido ni escala. La **barra sí sigue encogiéndose** de forma continua | ☐ |
| 7.6 | Con una sesión en la secundaria, mira la cuenta entre canciones y la pantalla de espera | El fondo de la siguiente canción se ve quieto, en fase 0 | ☐ |
| 7.7 | En el editor, aplica «Ajustar los silencios» (caso 14) | El resalte de las regiones cambiadas **no hace fundido** | ☐ |
| 7.8 | Desactiva reducir movimiento y reinicia | El fondo se vuelve a mover y reaparece el botón ❚❚ | ☐ |

### 8. Indicadores de espera (sección del editor)

Criterios: IE1–IE7, tarea 0212. Con la canción A.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 8.1 | Abre en el editor una canción **antigua** (de 0.1.0 o de antes de esta fase) y mira Estilo › «Indicadores de espera» | Solo está marcado **Puntos ●●●** y **Antes de la primera línea**, y «Silencio mínimo» vale **4,0 s**. Debajo: «Salen en silencios de 4,0 s o más y antes de la primera línea.» Abrirla no la marca como modificada | ☐ |
| 8.2 | Marca **Barra hasta la próxima línea** y **Cuenta 3·2·1** | Cada casilla se ve al momento en la vista previa y cada una se deshace con Ctrl/Cmd + Z en un paso | ☐ |
| 8.3 | Desmarca las tres casillas | «Antes de la primera línea» queda **inactiva** y el resumen dice «Sin indicadores: los silencios se verán solo con la línea siguiente en espera.» El silencio mínimo sigue editable | ☐ |
| 8.4 | Vuelve a marcar Puntos y Cuenta. En «Silencio mínimo» pulsa [+] tres veces | Sube de 0,5 en 0,5 s: «5,5 s». Con el foco en el campo, ↑ ↓ también; Re Pág / Av Pág cambian 5 s | ☐ |
| 8.5 | Escribe «6,25» y «6.3» en el campo | Se redondea a la décima («6,3 s»). Con «70» se limita a 60,0 y debajo aparece «Entre 1 y 60 segundos.» sin mover la fila; con «0,2» se limita a 1,0 | ☐ |
| 8.6 | Con el umbral en 6,0 s, reproduce un hueco de entre 4 y 5,9 s (o busca uno) | **No** salen los indicadores en ese hueco; sí en uno de 6,0 s o más. La primera entrada (antes de la primera línea) no depende del umbral | ☐ |
| 8.7 | Con el audio en **pausa**, pulsa «▶ Ver un ejemplo» | La vista previa muestra un hueco **simulado de 6 s** con los indicadores elegidos y una píldora «Ejemplo» arriba a la izquierda; el botón pasa a «■ Detener el ejemplo». No suena audio ni se mueve el cabezal | ☐ |
| 8.8 | Durante el ejemplo, pulsa Esc | El ejemplo se detiene y **no** se sale del editor a la Biblioteca. Repite pulsando la barra espaciadora y cambiando la selección de línea: también lo detienen | ☐ |
| 8.9 | Pulsa «Ver un ejemplo» con el audio **sonando** | El audio se pausa primero y empieza el ejemplo | ☐ |
| 8.10 | Vincula a la canción un tema (modo D1). Mira «Indicadores de espera» | Muestra, por ejemplo, «Puntos ●●● · silencios de 4,0 s o más», «Del tema «…»» y los botones «Cambiar solo en esta canción» y «Ver un ejemplo» | ☐ |
| 8.11 | Pulsa «Cambiar solo en esta canción» y marca Barra | Se hacen editables las casillas con el aviso «Propios de esta canción. El resto del aspecto sigue el tema «…».» El foco va a la primera casilla. El **tema** y otras canciones con ese tema **no cambian** | ☐ |
| 8.12 | Pulsa «Usar los del tema» | Vuelve a los del tema sin confirmar, y el foco va a «Cambiar solo en esta canción» | ☐ |
| 8.13 | Con la canción con indicadores propios, elige otro tema | Los indicadores propios **se conservan** | ☐ |
| 8.14 | Edita el tema desde el editor (modo D3), cambia los indicadores y guarda. Comprueba **una canción con indicadores propios y otra sin ellos** que usen ese tema | La que no tiene propios cambia; la de propios sigue con los suyos. En D3, si la canción abierta tiene propios, sale «Esta canción tiene indicadores propios: fuera de esta edición seguirá usándolos.» | ☐ |
| 8.15 | Con el panel Estilo a **300, 360 y 480 px** | La fila «Silencio mínimo» ([−] [ 4,0 s ] [+]) **no se parte** y no hay scroll de página | ☐ |
| 8.16 | Reproduce la canción (puntos, barra y cuenta marcados) con un lector de pantalla (VoiceOver, Narrador o Orca) activado, si lo tienes | Al empezar un hueco de 2 s o más con indicadores, el lector dice una vez «La letra sigue en {n} segundos.» (con 1: «La letra sigue en 1 segundo.»). **No** lee un número cada segundo, ni en la primera entrada, ni al pausar | ☐ |

### 9. Secundaria con dos pantallas en un equipo modesto

Criterio: verificación manual de las tareas 0213 y 0216. **Equipo modesto**, con la secundaria a 1920 × 1080 y la principal abierta.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 9.1 | Abre la sesión en la segunda pantalla (ver la [guía de la fase 4](fase-4-ventana-secundaria-y-cola.md), caso 1) y reproduce D con degradado **cónico en movimiento Media** y los tres indicadores marcados | La secundaria muestra el movimiento **fluido**, sin tirones, durante 3 min | ☐ |
| 9.2 | Sin quitar el movimiento, mueve el ratón en la principal, abre menús y cambia de filtro en la Biblioteca | El audio **no se corta** y el movimiento de la secundaria no se entrecorta | ☐ |
| 9.3 | Mira el barrido de la línea actual en la secundaria mientras el fondo se mueve | El barrido va a tiempo con la voz | ☐ |
| 9.4 | Repite con la velocidad **Rápida** y un degradado **radial** | Igual. Anota los tirones o el uso de CPU si los hay | ☐ |
| 9.5 | Mira la cuenta entre canciones y la pantalla de espera con el degradado en movimiento | El fondo de la siguiente canción se ve **quieto**, en fase 0 | ☐ |

### 10. Marcar como letra lista (aviso y preferencia)

Criterios: LL1–LL4, LB1, LB3, R12. Tareas 0214 y 0217. Usa la canción B (o una **Lista** y un **borrador** completo con todas sus líneas sincronizadas).

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 10.1 | Abre en el editor un **borrador** con todas las líneas sincronizadas. Mira la fila de abajo (el dock) a 1280 × 720 y a 1024 × 576 | Aparecen «Marcar como letra lista» (secundario) y «Marcar como lista» (primario) y la fila **no se parte** en ninguna de las dos resoluciones | ☐ |
| 10.2 | Abre el borrador **C** (con líneas sin inicio) y pulsa «Marcar como letra lista» | El botón está inactivo pero enfocable; el popover dice «Para marcarla como letra lista falta:» con un renglón «Sincronizar 3 líneas» y [Ir a la primera] | ☐ |
| 10.3 | En el borrador completo, pulsa «Marcar como letra lista» | Sale el diálogo «¿Marcar como letra lista?» con el texto «La letra aparecerá sincronizada por línea. Durante la reproducción y en el video, el texto se mostrará sin barrido ni cambio de color de progreso. Puedes seguir revisando el barrido en el editor.», la casilla «No volver a mostrar este aviso» y los botones «Cancelar» y «Marcar como letra lista». El foco inicial está en «Marcar como letra lista». **¿Se entiende a la primera?** Anótalo | ☐ |
| 10.4 | Marca la casilla «No volver a mostrar este aviso» y pulsa «Cancelar» | Nada cambia en la canción. Vuelve a pulsar el botón: el aviso **sigue saliendo** (cancelar no guarda la preferencia) | ☐ |
| 10.5 | Pulsa Esc en el diálogo | Se cierra como Cancelar y el foco vuelve al botón «Marcar como letra lista» | ☐ |
| 10.6 | Confirma **sin** la casilla | Vuelves a la Biblioteca. La tarjeta se enfoca y resalta (borde verde unos 2 s) con la insignia **Letra lista** (con icono de subtítulos). Aparece el aviso ««{título}» tiene la letra lista para cantar.» con [▶ Reproducir] | ☐ |
| 10.7 | Pasa el ratón por la insignia | El tooltip dice «Se reproduce con la letra sincronizada por líneas, sin barrido.» | ☐ |
| 10.8 | Elige el filtro «Listas» | La canción cuenta y aparece en «Listas» | ☐ |
| 10.9 | Pulsa [▶ Reproducir] del aviso (o «Reproducir» de la tarjeta) | El reproductor abre. **La línea actual aparece entera en el color de la letra desde el principio hasta el final de su tiempo, sin rellenarse**. En ningún momento aparece el color de «lo ya cantado» | ☐ |
| 10.10 | Con una línea que tenga tiempo por palabra (si tienes una), míralo | Tampoco hay barrido por palabras | ☐ |
| 10.11 | Cierra el reproductor y abre la canción en el editor | La cabecera dice «✓ Letra lista». La **vista previa del editor sí muestra el barrido** (para revisar la sincronía) | ☐ |
| 10.12 | Con otra canción, repite 10.3 y confirma **con** la casilla «No volver a mostrar este aviso» marcada | Se marca la canción. A partir de ahora el aviso no vuelve a salir en ninguna canción | ☐ |
| 10.13 | Cierra la app del todo y vuelve a abrirla. En otro borrador completo pulsa «Marcar como letra lista» | **No** sale el diálogo: marca y vuelve a la Biblioteca directamente. La preferencia sobrevivió al reinicio | ☐ |
| 10.14 | Reinicia la app y mira la tarjeta de la primera canción | Sigue con la insignia «Letra lista» (la modalidad persiste) | ☐ |
| 10.15 | En la Biblioteca, ⋯ de la Letra lista › «Volver a borrador» | La insignia pasa a «✎ Borrador». Al terminarla otra vez hay que elegir entre «Marcar como lista» y «Marcar como letra lista» | ☐ |
| 10.16 | En una Letra lista, borra el tiempo de una línea en el editor | La insignia dice «Letra lista · ⚠ Falta 1 línea», «Hecho» avisa de lo que falta y en la Biblioteca la tarjeta sigue en «Listas» con su aviso de incompleta | ☐ |

### 11. Una Letra lista se lee bien sin barrido en una canción rápida

Criterio: verificación manual del reproductor (LL, R12). Con la canción B (frases seguidas) marcada como Letra lista.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 11.1 | Reproduce B como Letra lista en pantalla completa (la TV a 5 m si puedes) y cántala o léela entera | La línea actual se distingue de la siguiente por su **tamaño y posición**, y el cambio de línea (200 ms) se sigue bien aunque vayan rápido | ☐ |
| 11.2 | Compara con la misma canción como **Lista** (con barrido): ⋯ en el editor › «Cambiar a «Lista»» | Con barrido es más fácil seguir «por dónde va la voz»; sin barrido hay que leer la línea entera. Anota si en la canción rápida la Letra lista se lee **bien** o queda confusa | ☐ |
| 11.3 | Vuelve a Letra lista y mira el contraste: la letra frente al fondo | La letra se lee bien. El color de «lo ya cantado» no aparece | ☐ |

### 12. Cambiar de modalidad desde el editor y contraste en Letra lista

Criterios: LL5, LL7, LL8. Tarea 0214.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 12.1 | En una **Lista**, abre el menú ⋯ de la cabecera del editor | Aparece «Cambiar a «Letra lista»…» antes de «Volver a borrador…» | ☐ |
| 12.2 | Púlsalo (con el aviso aún no silenciado, en otra instalación o con una copia nueva del perfil) | Sale el mismo aviso, con el botón «Cambiar a «Letra lista»». Al confirmar, **sin salir del editor**, la insignia pasa a «✓ Letra lista» y aparece el aviso «Esta canción se reproducirá sin barrido (letra lista).» | ☐ |
| 12.3 | Abre el menú ⋯ de la Letra lista y pulsa «Cambiar a «Lista»» | Aparece la opción «Cambiar a «Lista»». Sin diálogo, la insignia pasa a «✓ Lista» y el aviso dice «Esta canción se reproducirá con barrido (lista).» | ☐ |
| 12.4 | Pulsa Ctrl/Cmd + Z | **No** deshace el cambio de modalidad (no entra en el historial); se revierte con la opción contraria | ☐ |
| 12.5 | En una Letra lista, pon el color de resaltado `#F2F3F7` y el de la letra `#FFFFFF` (Estilo › Letra) | En el aviso de contraste, la diferencia entre resaltado y letra sale como `ⓘ` con «Solo afecta al editor: esta canción se reproduce sin barrido.» y la pestaña **Estilo** no lleva el punto de aviso | ☐ |
| 12.6 | Pon la letra en `#5A1E6E` sobre el fondo predeterminado | Sale el aviso `⚠` de la letra como siempre | ☐ |
| 12.7 | En una **Letra lista**, pulsa «Probar a pantalla completa» | Se ve **sin barrido** | ☐ |
| 12.8 | En un borrador y en una Lista, pulsa «Probar a pantalla completa» | Se ve **con barrido** | ☐ |
| 12.9 | Si hay una sesión en vivo abierta, intenta cambiar la modalidad de una canción desde el ⋯ | No se cambia y sale el aviso de error genérico (la edición está bloqueada durante la sesión) | ☐ |

### 13. Letra lista en la cola y en la secundaria

Criterios: LB2, R13. Tarea 0216. Con una Letra lista y una Lista en la biblioteca.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 13.1 | Abre la sesión en la segunda pantalla. En la tarjeta de la Letra lista, mira el menú ⋯ | Tiene las mismas acciones que una Lista (Reproducir, Reproducir en otra pantalla…, Reproducir a continuación, Agregar al final, Editar, Editar datos, Aplicar tema…, Volver a borrador, Mostrar en la carpeta, Eliminar…) | ☐ |
| 13.2 | Añádela a la cola con «A la cola» e inícial | En la secundaria suena **sin barrido** | ☐ |
| 13.3 | Las filas de la cola | No llevan ninguna marca de «Letra lista» | ☐ |
| 13.4 | Cambia la modalidad de una canción **a Lista** desde el editor mientras suena en la secundaria (puede que el editor esté bloqueado en sesión: si es así, apúntalo) y deja que la actual termine | La reproducción **en curso no cambia**; la siguiente vez que se reproduzca, usa la modalidad nueva | ☐ |
| 13.5 | Reproduce la Letra lista en el reproductor local y pulsa la pausa, busca, vuelve a reproducir | Siempre sin barrido | ☐ |
| 13.6 | Mira la Biblioteca con una Lista, una Letra lista, una Letra lista incompleta y un borrador | Cada una tiene su insignia distinta (Lista, Letra lista con icono, Letra lista con la línea «Falta…», Borrador). El nombre accesible de la Letra lista dice «Letra lista, sin barrido» | ☐ |

### 14. Ajustar los silencios

Criterios: AS1–AS8. Tarea 0215 y spec 06 · AS. Usa la canción **A** («Silencios»: silencios largos entre enunciados, fines a mano) y la canción **B** («Seguidas»: frases seguidas). **Haz una copia de las dos canciones** antes de probar si no quieres perder tus tiempos (el ajuste se deshace en un paso, pero se autoguarda).

#### 14A. El botón y cuándo no está disponible

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 14.1 | Abre A en el editor, pestaña **Sincronía**, y mira la fila «Línea de tiempo» | A la derecha, justo antes de «Minimizar», hay un botón con icono de forma de onda y el texto **«Ajustar los silencios»** | ☐ |
| 14.2 | Reduce la ventana a menos de 1280 px de ancho | El botón pasa a ser **solo el icono** (36 × 36), con tooltip «Ajustar los silencios», y la fila de la línea de tiempo **no se parte** | ☐ |
| 14.3 | Abre el menú ⋯ de la cabecera | Hay un ítem «Ajustar los silencios…». Comprueba que también está si minimizas la línea de tiempo o cambias a la pestaña **Estilo** | ☐ |
| 14.4 | Abre el borrador **C** (3 líneas sin inicio) y pulsa el botón | Está inactivo pero enfocable; el popover dice «Para ajustar los silencios falta:» con «Sincronizar 3 líneas» y [Ir a la primera], que lleva a la primera línea sin sincronizar | ☐ |
| 14.5 | Abre una canción **recién separada** cuya forma de onda aún se esté preparando (si no es posible, salta a 14.6) | El renglón dice «La forma de onda de la voz (se está preparando…)» y se cierra solo cuando está lista | ☐ |
| 14.6 | Entra en el modo «Sincronizar al ritmo» y pasa el ratón por el botón | Inactivo con el tooltip «No disponible mientras sincronizas al ritmo.» | ☐ |
| 14.7 | Edita un tema desde el editor (modo D3, borrador de tema abierto) y pulsa el botón | Inactivo: «Terminar de editar el tema (guarda o descarta sus cambios)» | ☐ |

#### 14B. Canción A con silencios entre enunciados

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 14.8 | En A, mira los **fines** de algunas líneas que fijaste a mano en la línea de tiempo (contorno continuo) y los de las automáticas (discontinuo). Anota 3 fines que sepas que están mal por ser tardíos (la línea sigue marcada aunque la voz ya calló) | Tienes tus 3 ejemplos con su tiempo | ☐ |
| 14.9 | Reproduce un tramo de A **antes** de ajustar: mira, en la vista previa, cómo se queda la línea durante un silencio largo | La línea sigue en pantalla hasta su fin (tardío) y no hay indicadores salvo los puntos | ☐ |
| 14.10 | Pulsa «Ajustar los silencios». Si tarda, el botón puede decir «Buscando silencios…» | Se abre el diálogo «¿Ajustar los silencios?» con el texto «Shinobi Karaoke buscará en la voz el primer silencio después de cada línea y llevará su fin al último momento con voz. Las líneas sin silencio, las que tienen tiempos por palabra y las pausas no cambian.» | ☐ |
| 14.11 | Lee los recuentos | Hay una línea «Cambiará el fin de {n} de {total} líneas.» (el total es el número de líneas de A). Si hay fines fijados, otra con aviso `⚠`: «{m} de ellas tenían un fin fijado (a mano o con la letra). También se ajustarán.» Si quedan silencios largos: «Quedarán {k} silencios de 4,0 s o más. Se activará la cuenta 3·2·1 en esta canción: saldrá en ellos y en cualquier otro silencio de 4,0 s o más.» Debajo: «Puedes deshacerlo de una vez con Ctrl+Z.» (⌘Z en macOS) | ☐ |
| 14.12 | Pulsa «▸ Ver las líneas» | Se despliega una lista (hasta 8 filas visibles, con scroll propio, en el orden de la letra) como «Línea 4 · «Is this the real life?» 00:15.80 → 00:14.92 · fijado» y «· silencio largo» donde corresponda. El botón pasa a «Ocultar las líneas» | ☐ |
| 14.13 | Comprueba **tus 3 ejemplos de 14.8** en la lista | Aparecen, con un fin **más temprano** (≈ el último momento con voz), y los fijados llevan «fijado» | ☐ |
| 14.14 | Comprueba que **no** aparecen las líneas con tiempo por palabra ni las pausas | No salen | ☐ |
| 14.15 | Pulsa Esc | Se cierra sin cambiar nada y el foco vuelve al botón «Ajustar los silencios». Comprueba que los fines no cambiaron | ☐ |
| 14.16 | Pulsa de nuevo el botón (foco inicial en «Ajustar los silencios») y confirma con «Ajustar los silencios» | Se cierra el diálogo y sale el aviso «Se ajustó el fin de {n} líneas. Se activó la cuenta 3·2·1 en esta canción.» con [Deshacer] (si ya la tenía, sin la segunda frase) | ☐ |
| 14.17 | Mira la línea de tiempo durante los segundos siguientes | Las regiones de las líneas cambiadas se **resaltan 2 s** con borde azul y su fin pasa a **fijado** (contorno continuo) | ☐ |
| 14.18 | Haz clic en una línea cambiada y mira el panel «Fin» | El «Fin» está en el color normal del texto y dispone de «Usar fin automático» | ☐ |
| 14.19 | Abre Estilo › «Indicadores de espera» | **«Cuenta 3·2·1» está marcada**, el resto de casillas y el silencio mínimo no cambiaron. Si la canción seguía un tema, la procedencia dice «Propios de esta canción. El resto del aspecto sigue el tema «…».» | ☐ |
| 14.20 | Reproduce los silencios largos de A en la vista previa | La línea **sale al final de la voz** (no se queda) y en el silencio aparecen las cuentas **3, 2, 1** en los últimos 3 s del hueco | ☐ |
| 14.21 | Reproduce de verdad la canción entera cantando (o escuchando con la voz) | Cada línea acaba cuando acaba la voz; no hay líneas que se corten antes de tiempo ni que cuelguen | ☐ |
| 14.22 | Pulsa Ctrl/Cmd + Z **una sola vez** (repite después el ajuste y prueba con el botón [Deshacer] del aviso) | Todos los fines vuelven a su valor anterior (también los fijados/automáticos de antes) **y la cuenta vuelve a como estaba**, todo en un único paso | ☐ |
| 14.23 | Pulsa Ctrl/Cmd + Mayús + Z | Se rehace el ajuste completo | ☐ |
| 14.24 | Aplica el ajuste y pulsa Deshacer. Cierra el editor, vuelve a abrirlo | El estado final persiste (con o sin el ajuste según lo último que hiciste) | ☐ |
| 14.25 | Abre A, **desde el menú ⋯** con la línea de tiempo **minimizada**, aplica el ajuste | Se aplica. Anota dónde queda el foco al terminar (no hay botón visible; la spec dice que no vuelve a ningún botón) | ☐ |
| 14.26 | Con el audio sonando, pulsa «Ajustar los silencios» | La canción **sigue sonando** mientras se abre el diálogo | ☐ |
| 14.27 | Con el bucle de una línea activo, aplica el ajuste | El bucle adopta el nuevo fin de su línea; la selección, el cabezal y el zoom **no cambian** | ☐ |

#### 14C. Canción B con frases seguidas

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 14.28 | Abre B en el editor y pulsa «Ajustar los silencios» | O bien se abre el diálogo con pocas líneas cambiadas, o aparece un aviso «No hay silencios que ajustar: los fines ya coinciden con la voz.» y **no se abre el diálogo** | ☐ |
| 14.29 | Si salió «No hay silencios que ajustar…», pulsa Ctrl/Cmd + Z | **No** hay ningún paso que deshacer (no se escribió nada) | ☐ |
| 14.30 | Si se abrió el diálogo, mira si hay «Quedarán {k} silencios…» | En B, **no** debe haber silencios largos (frases seguidas): ese renglón no aparece y no se activa la cuenta. Anota si sale | ☐ |
| 14.31 | Si hay líneas cambiadas, mira la lista y reproduce un par de ellas | El fin queda justo tras el último momento con voz; las líneas que **no** tienen silencio detrás **no** cambian | ☐ |
| 14.32 | Aplica o cancela; y repite el ajuste (si aplicaste) | La segunda vez: «No hay silencios que ajustar…» (ya están ajustados) | ☐ |
| 14.33 | Comprueba que ningún fin de B pisa el inicio de la línea siguiente (en la línea de tiempo, las regiones no se solapan) | Ningún solapamiento | ☐ |

#### 14D. Casos con la cuenta ya activa y con un tema

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 14.34 | En A, deshaz el ajuste, marca **a mano** «Cuenta 3·2·1» y pulsa de nuevo «Ajustar los silencios» | El diálogo dice «Quedarán {k} silencios de 4,0 s o más, con la cuenta 3·2·1 que ya tiene esta canción.» (sin «Se activará…»). El aviso final no dice «Se activó la cuenta» | ☐ |
| 14.35 | Deshaz, vincula un tema (D1) y aplica el ajuste. Edita después el tema | La cuenta queda como indicadores **propios de la canción**: el tema y otras canciones con ese tema **no** cambian | ☐ |
| 14.36 | Con el diálogo abierto, haz un cambio de tiempos desde otra ventana o pestaña (si puedes) y confirma | Si cambian los recuentos, no se aplica: sale «Los tiempos cambiaron mientras decidías. Revisa los nuevos recuentos y confirma otra vez.» y el foco queda en el botón (caso difícil de provocar; si no puedes, déjalo en blanco) | ☐ |
| 14.37 | Con un lector de pantalla, recorre el diálogo y la lista | Cada fila se lee como «Línea {n}, {texto}: el fin pasa de {…} a {…}[, tenía fin fijado][, deja un silencio largo]» y el resultado se anuncia una vez | ☐ |

### 15. Calibración de «Ajustar los silencios» (AS9)

Criterio: AS9. Tarea 0210. Sigue la guía ya existente: [Calibración de «Ajustar los silencios»](fase-5-calibracion-de-silencios.md) (caso 1) con las 6 canciones sincronizadas a mano. Aquí solo se anota el resultado.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 15.1 | Ejecuta la guía de calibración y copia la tabla (10 primeras filas y la fila `*`) para el arquitecto | Hecho. **No** subas audio, letras ni la tabla al repositorio | ☐ |
| 15.2 | Anota **cuántos fines propuestos difieren más de 200 ms** de los tuyos | Número: ____ de ____ fines. Combinación recomendada de parámetros: ________ | ☐ |
| 15.3 | En **una de las 6 canciones**, pulsa «Ajustar los silencios» en el editor, mira la lista y aplícalo | Los fines propuestos son razonables según la tabla de 15.2 | ☐ |
| 15.4 | Deshazlo con Ctrl/Cmd + Z | Todo vuelve a como lo dejaste a mano, **sin perder un solo fin fijado** | ☐ |
| 15.5 | Compara los fines del ajuste con tu sincronía en 5 líneas con silencio | Anota cuántas de las 5 quedan a menos de 200 ms de las tuyas | ☐ |

### 16. Abrir con 0.1.0 una canción guardada por 0.2.0

Criterio: compatibilidad con la versión anterior (ADR 0018 §1). Usa la **copia** de la biblioteca de la Preparación y la app **0.1.0** instalada (o su ejecutable). Nunca abras con 0.1.0 tu biblioteca única.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 16.1 | Con 0.2.0, prepara una canción con **degradado cónico en movimiento**, **Barra y Cuenta** marcadas (indicadores de espera) y márcala como **Letra lista**. Cierra la app | — | ☐ |
| 16.2 | Abre **la copia de esa biblioteca** con 0.1.0 | La app abre y muestra la biblioteca. No hay errores | ☐ |
| 16.3 | Mira la canción | Se ve como una **Lista** (sin distinción de Letra lista) | ☐ |
| 16.4 | Ábrela en el editor y en el reproductor | El fondo se ve como un **degradado lineal estático** (no cónico, no se mueve), con el barrido normal y los **puntos ●●●** de siempre (sin barra ni cuenta) | ☐ |
| 16.5 | No guardes nada con 0.1.0. Vuelve a abrir la canción con 0.2.0 | Conserva el cónico, el movimiento, los indicadores y la modalidad **Letra lista** | ☐ |
| 16.6 | (Opcional) guarda un cambio con 0.1.0 y reabre con 0.2.0 | Anota qué se conserva y qué se pierde del estilo ampliado (informativo) | ☐ |

### 17. Aspectos pendientes de la revisión

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 17.1 | Abre una canción antigua y compárala con la captura de 0.1.0 (si la tienes) con degradado lineal | Se ve **idéntica**: mismos colores y ángulo (G2) | ☐ |
| 17.2 | Mira la canción antigua con puntos `●●●` antes de la primera línea y en huecos de 4 s o más | Igual que en 0.1.0, sin barra ni cuenta (R9) | ☐ |
| 17.3 | Con una canción con una **última línea** y la cuenta activada, mira el final de la canción | Tras la última línea **no** hay indicadores | ☐ |
| 17.4 | Con «Antes de la primera línea» **desmarcada**, reproduce desde 0:00 | La primera entrada solo muestra el título y la línea en espera: sin indicadores | ☐ |

### 18. Criterios sin prueba automática (informe de la fase 5)

Criterios de la spec: G7, G9, IE1, IE2, IE6, IE7, LL1, AS1, LB4, LB6 y R14. El [informe de la fase](../../versiones/0.2.0/informe-fase-5.md) los marca «sin evidencia» o parciales. El resto de criterios parciales del informe ya tiene sus pasos en los casos 1–17 (el informe los cita por número) y no se repite aquí.

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 18.1 | Con el tema «Prueba cónico» del paso 1.11 aplicado a dos canciones, elimínalo desde Ajustes › Temas (o desde el editor) y abre las dos canciones (G9) | Cada una conserva su degradado con la **misma forma, centro, ángulo, movimiento y velocidad**, ahora como «Tema personalizado» (copia). Ningún valor vuelve a lineal ni se pierde el movimiento | ☐ |
| 18.2 | Anota la fecha de modificación de `cancion.json` de una canción **antigua** (de 0.1.0). Ábrela en el editor, mira el panel Estilo › «Indicadores de espera» y vuelve a la Biblioteca sin tocar nada. Mira la fecha otra vez (IE1) | La fecha **no cambia**: abrir y mirar no escribe nada | ☐ |
| 18.3 | En una canción con huecos de 6 s o más, prueba estas combinaciones de casillas y mira un hueco en la vista previa: solo Puntos; solo Barra; solo Cuenta; Puntos y Barra; Puntos y Cuenta; Barra y Cuenta; las tres; y ninguna (IE2) | Cada combinación enseña exactamente los indicadores marcados; sin ninguna, el hueco solo muestra la línea siguiente en espera. Con «Antes de la primera línea» desmarcada, la primera entrada no tiene indicadores | ☐ |
| 18.4 | Con un degradado en movimiento, pulsa ❚❚ «Detener el movimiento del fondo». Mira si el indicador de «cambios sin guardar» o el historial cambian (Ctrl/Cmd + Z) y, con un lector de pantalla, cómo se anuncia el botón (G7) | El botón queda **pulsado** (el lector dice «pulsado» o equivalente); **no** aparece ningún cambio sin guardar y Ctrl/Cmd + Z no revierte nada por ello; el archivo no cambia. «Probar a pantalla completa» sigue con movimiento | ☐ |
| 18.5 | Pulsa «Ver un ejemplo» con un lector de pantalla activado y espera a que termine (IE6) | Se anuncia al **empezar** y al **terminar** el ejemplo. No se mueve el cabezal ni se añade un paso al historial (Ctrl/Cmd + Z no cambia nada) | ☐ |
| 18.6 | Abre una canción con la línea de tiempo visible y mira el botón «Ajustar los silencios» a 1024 × 576, 1280 × 720, 1536 × 864 y 1920 × 1080, y al 125 % de escala (AS1, LL1) | Solo icono por debajo de 1280 px y con texto a partir de ahí; la fila de la línea de tiempo **no se parte** en ninguno. En un borrador completo, la fila de abajo con «Marcar como letra lista» y «Marcar como lista» tampoco se parte | ☐ |
| 18.7 | Con la cuenta y la barra marcadas, busca con la barra de tiempo (clic) **dentro** de un hueco largo y pausa (R8) | Al saltar aparecen **al instante** la barra con el ancho de ese momento y el número que toca; en pausa se **congelan**; al buscar fuera del hueco desaparecen | ☐ |
| 18.8 | Con una Letra lista, aplica a la canción otro tema con «Aplicar tema…» y mira la insignia; después «Volver a borrador» (LB4) | La insignia sigue siendo «Letra lista» tras aplicar el tema (la modalidad no cambia); tras volver a borrador, es «✎ Borrador» | ☐ |
| 18.9 | Si no hiciste el 3.7, mira en la Biblioteca la portada de una canción con degradado en movimiento, en dos momentos distintos y con una sesión abierta (LB6) | La portada se ve **quieta, en la fase 0**, siempre igual | ☐ |
| 18.10 | Con un monitor de **al menos 1080 px de alto**, en `app/`: `npm run build && SHINOBI_CAPTURAS_5=1 npx playwright test e2e/fase5-capturas.spec.ts --workers=1` y mira `reproductor-1920x1080-*.png` en `docs/ux/revision-0.2.0-fase-5/` (R14) | Las seis capturas miden **1920 × 1080** (hoy salen recortadas en alto) | ☐ |

## Ejecuciones

| Fecha | Persona | Equipo y SO | Pantallas / audio | Resultado | Notas |
|---|---|---|---|---|---|
| | | | | ✅ / ⚠️ / ❌ | |

Medidas para el informe de la fase (`docs/versiones/0.2.0/informe-fase-5.md`):

| Equipo y SO | Fluidez del fondo (4.1, 9.1) | Velocidad más cómoda / mareo (5.3–5.5) | Cuenta y barra legibles a 5 m (6.1–6.5) | Letra lista en canción rápida (11.2) | Fines que difieren > 200 ms (15.2) |
|---|---|---|---|---|---|
| | | | | | |

## Incidencias

| Caso | Qué pasó | Gravedad | Tarea o pregunta creada |
|---|---|---|---|
