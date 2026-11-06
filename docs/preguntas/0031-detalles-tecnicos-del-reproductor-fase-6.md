# 0031 — Detalles técnicos del reproductor (Fase 6)
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida
- Bloquea: no. `ux/07-reproductor.md` (revisión 2026-11-06) lleva una opción provisional en cada punto; basta con confirmarla o corregirla en el desglose de la Fase 6.

## Contexto
Al poner al día `ux/07-reproductor.md` para la Fase 6 han salido puntos que dependen de decisiones técnicas. Aquí solo van esos; el resto de la spec es de presentación y comportamiento.

## Preguntas
1. **Pantalla completa y Esc** (criterios 3–5). La spec pide: Esc sale del reproductor con **una** pulsación; F/⛶ alternan pantalla completa y ventana sin salir; al salir, la ventana vuelve al estado que tenía antes (ventana, maximizada o pantalla completa); el icono refleja cambios hechos con el menú, F11 o el botón verde de macOS. Con la Fullscreen API de HTML, Chromium consume Esc para salir de la pantalla completa y no se distingue de otras salidas. **Provisional**: pantalla completa de la ventana (`BrowserWindow.setFullScreen`) con un canal IPC (`ventana.pantallaCompleta(boolean)` + evento de cambio y estado inicial), de modo que Esc llega al renderer como una tecla más. ¿De acuerdo?
2. **Motor de audio con dos pistas a la vez** (ADR 0010; decisión del usuario en 0030: voz guía). El reproductor necesita que `instrumental` y `voz` suenen **simultáneas y sincronizadas** (mismo `start()`, pausa, búsqueda y fin), cada una con su `GainNode` (voz × `voz_guia`) antes de la ganancia general. Hoy `MotorAudio` reproduce una sola pista. **Provisional**: ampliar `MotorAudio` con un modo de mezcla de dos pistas (o un motor del reproductor sobre el mismo reloj), un `MotorAudio` propio del reproductor que se destruye al salir, también desde el editor (el del editor solo se pausa; memoria: hasta 4 buffers ≈ 340 MB con 4 min, ≈ 840 MB con 10 min). ¿Preferís reutilizar el del editor o limitar la memoria de otra forma? La spec exige que al volver el editor tenga la misma pista y velocidad.
3. **Silencio previo y `●●●` antes de la primera línea** (§"Inicio y silencio previo", criterios 6–7). Si la primera línea entra antes de 6 s, el tiempo avanza desde `−(6 s − t1)` sin audio y el audio arranca en 0. **Provisional**: el reproductor lleva ese tramo con `performance.now()` y después llama a `reproducir({ desdeMs: 0 })` (o programa `start()` en el futuro, si preferís que el motor lo haga), pasando a `PantallaLetra` tiempos negativos. Además, `render.ts` debe mostrar `●●●` antes de la primera línea aunque el hueco desde 0 sea < 4 s (hoy usa `silencio = inicio − 0`), lo que también cambia la vista previa del editor. ¿Alguna objeción?
4. **Pista que falta** (criterios 22–23). Si el reproductor no puede cargar el instrumental (404 de `shinobi-media://`), la canción debe pasar a "Dañada" en la Biblioteca sin reiniciar la app. Hoy `detectarDanada` solo se ejecuta al escanear o al escribir. **Provisional**: un canal `biblioteca.comprobarPistas(id)` que reindexa esa canción y emite `cancion:cambiada`. Un error de decodificación con el archivo presente no la marca Dañada. ¿Cómo distinguimos los dos casos desde `MotorAudio` (hoy `error: 'carga' | 'decodificacion'`)? ¿Qué lleva [Copiar detalles]?
5. **Pantalla encendida** (criterio 26). Mientras suena, la pantalla no debe apagarse ni saltar el salvapantallas (una canción con pausas largas en una TV). **Provisional**: `powerSaveBlocker.start('prevent-display-sleep')` desde el main mientras el reproductor está sonando, y `stop` en pausa y al salir, con un canal IPC. ¿De acuerdo?
6. **Configuración de la voz guía** (criterios 19–19d). Campos nuevos en `config.reproductor`: `voz_guia` (0–1, por defecto 0,3) y `voz_guia_silenciada` (por defecto `true`), con lectura tolerante si faltan (configs ya guardadas) y escritura con `config.actualizar` como el volumen. Si falta `voz.flac`, la spec sigue cantando con el instrumental y usa el mismo `comprobarPistas` del punto 4. ¿De acuerdo con los nombres y valores por defecto?

## Opción provisional tomada (si no bloquea)
La indicada en cada punto, tal como está en `ux/07-reproductor.md`.

## Respuesta
(arquitecto, 2026-11-06; detalle y alternativas en el [ADR 0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md))

1. **Pantalla completa y Esc: de acuerdo**, con la pantalla completa de la **ventana** (`BrowserWindow.setFullScreen`) desde el main.
   - Canales `ventana.modoReproductor(activo)` (al entrar recuerda el estado: normal, maximizada o pantalla completa; al salir lo restaura), `ventana.fijarPantallaCompleta(activa)` (F/⛶), `ventana.estaEnPantallaCompleta()` y el evento `ventana:pantallaCompleta`. El evento también llega con los cambios del menú, F11 o el botón verde.
   - El menú "Ver" gana el elemento "Pantalla completa" (`role: 'togglefullscreen'`). En el modo reproductor, el main desactiva los elementos de zoom del menú.
   - Se retira el permiso `fullscreen` (ADR 0008, Revisiones).
   - Tareas 0112, 0113 y 0119.
2. **Motor de audio: ni se reutiliza el del editor ni se usa otro `MotorAudio`.** Tras la decisión del usuario en [0030](0030-voz-original-en-el-reproductor.md) (voz guía con volumen propio sobre el instrumental), el reproductor tiene su propio **`MotorReproductor`**:
   - instrumental y voz suenan a la vez, arrancadas en el mismo instante del `AudioContext`, cada una con su ganancia;
   - en la vista previa sin instrumental, solo la original.
   El editor no se toca salvo `MotorAudio.liberarAudio()`: al abrir "Probar" libera sus buffers, para que en memoria nunca haya más de 2. Al volver, el editor busca la posición del reproductor y conserva su pista y su velocidad, que nunca cambiaron. Tareas 0117 y 0122.
3. **Silencio previo: de acuerdo, pero lo hace el motor y no `performance.now()`.** `MotorReproductor.reproducir({ desdeMs: −n })` ancla en el reloj del `AudioContext` y programa `start()` n ms más tarde.
   - `posicionMs()` devuelve tiempos negativos durante el silencio, con la misma precisión que el resto de la canción, y la pausa y la reanudación salen sin código aparte. Buscar a ≥ 0 lo cancela.
   - `render.ts` trata la primera línea como precedida por un hueco infinito (`●●●` siempre) y acepta tiempos negativos. También cambia la vista previa del editor, como pide la spec.
   - Tareas 0116 (render) y 0117 (motor).
4. **Pista que falta: de acuerdo con `biblioteca.comprobarPistas(id)`**: recalcula `detectarDanada`, actualiza el índice y emite `evento:cancion`.
   - **Cómo se distinguen los casos**: el motor del reproductor clasifica el error por pista en `no_encontrada` (respuesta 404 de `shinobi-media://`), `lectura` (otra respuesta incorrecta o fallo de red) y `decodificacion` (`decodeAudioData` rechaza). Solo `no_encontrada` lleva a `comprobarPistas` y a `rep.error.pistas` (o `rep.error.mezcla` en el modo original). `lectura` y `decodificacion` llevan a `rep.error.audio` y no cambian el estado.
   - **[Copiar detalles]** copia dos líneas:
     ```
     Shinobi Karaoke {versión} · {so}
     Reproductor: {pista} ({ruta relativa, p. ej. pistas/instrumental.flac}) · {no_encontrada|lectura|decodificacion} · {detalle}
     ```
     `{detalle}` es el estado HTTP o el mensaje del error de decodificación, sin rutas absolutas ni datos del usuario. `{versión}` y `{so}` salen de `sistema.info()`.
   - Si falla solo la voz, el instrumental sigue sonando sin el control de voz (y con `no_encontrada` se comprueba igualmente).
   - Tareas 0114, 0120 y 0121.
5. **Pantalla encendida: de acuerdo.** `ventana.evitarReposo(true)` al empezar a sonar (también durante el silencio previo) y `false` en pausa, en la pantalla final, en el error y al salir. Usa `powerSaveBlocker.start('prevent-display-sleep')`. El main lo libera también si la ventana se cierra o el renderer recarga. Tareas 0113 y 0119.
6. **Voz guía** (añadido tras la decisión del usuario en [0030](0030-voz-original-en-el-reproductor.md); `ux/07` remite aquí para el contrato):
   - **Configuración**: `config.reproductor.voz_guia` (número 0–1, por defecto 0,3) y `voz_guia_silenciada` (booleano, por defecto `true`). Se leen de forma tolerante, sin cambiar la versión del esquema: un `config.json` anterior los toma por defecto. El renderer los escribe con `config.actualizar({ reproductor })`, como el volumen general (como mucho cada 500 ms, `useVolumenCompartido`).
   - **Audio**: `MotorReproductor` (ADR 0011 §3). Instrumental y voz con el mismo `start(when, offset)`; ganancia de la voz → ganancia general. El audio empieza cuando las dos pistas están decodificadas o la voz ha fallado.
   - **Fallo de la voz**: `errorVoz`; el control queda `aria-disabled` (`rep.voz.nodisponible`); con `no_encontrada`, `comprobarPistas`.
   - Tareas 0112, 0117, 0118 y 0119.
