# Bugs del editor tras la Fase 2 (línea de tiempo) — 0.2.0-alfa

Entorno: Windows, monitor 3440×1440, ventana de la app a media pantalla (~1720×1440 px físicos).
Escala de Windows: [ __ % ] ← dato pendiente (Configuración › Pantalla › Escala).
Rama: `develop` @ dd851f8 (incluye 0147–0153).

---

## Bug 1 · La línea de tiempo ensancha la ventana sin límite (scroll horizontal infinito)

**Prioridad:** Alta (regresión de la Fase 2; el editor se vuelve inusable con el tiempo).

### Qué pasa
Al abrir el editor aparece una barra de desplazamiento **horizontal** abajo de la ventana. El contenido se hace más ancho sin parar: el pulgar de la barra se encoge cada vez más. El ancho del editor debe quedarse fijo al de la ventana.

### Pasos
1. Abrir una canción con voz separada en el editor (pestaña Sincronía).
2. Esperar unos segundos, reproducir o redimensionar la ventana.
3. Observar la barra horizontal en la parte inferior de la ventana.

### Esperado
- Nunca hay scroll horizontal en la ventana: `document.documentElement.scrollWidth <= window.innerWidth` en todo momento.
- La línea de tiempo, la forma de onda y el minimapa ocupan el 100% del ancho disponible y se adaptan al redimensionar (crecer **y** encoger).

### Causa probable (confirmar)
`app/src/renderer/src/vistas/editor/PistaOndaVoz.tsx`, `LienzoPicosVoz` (≈ líneas 115–185):
- Mide el propio `<canvas>` con `getBoundingClientRect()` y le asigna `width = ancho_css × devicePixelRatio` como atributo.
- Observa ese mismo canvas con `ResizeObserver` (`device-pixel-content-box`).
- Si algún ancestro dimensiona por contenido, el ancho intrínseco del canvas (ya multiplicado por el DPR) empuja el layout. Eso dispara otra medición: un bucle de realimentación. Con escala de Windows >100% (DPR 1.25 o 1.5) crece en cada vuelta; en macOS o a 100% puede no notarse, por eso no lo vieron las pruebas.

### Arreglo sugerido
- Medir un **contenedor** del canvas, no el canvas. El contenedor lleva `min-width: 0; overflow: hidden; contain: inline-size`.
- El canvas en CSS: `width: 100%; max-width: 100%`. El atributo `width` solo afecta la resolución, nunca el layout.
- Usar `entry.contentBoxSize` / `devicePixelContentBoxSize` del observer en vez de volver a medir con `getBoundingClientRect`.
- Revisar que ningún ancestro de `.timeline` (`pistaSincronia.module.css`) ni `.transporte` (`editor.module.css`) se dimensione por contenido (flex/grid sin `min-width: 0`).

### Pruebas
- E2E (Playwright/Electron) con `deviceScaleFactor` 1, 1.25 y 1.5: abrir el editor, esperar 3 s, reproducir 2 s, redimensionar → afirmar `scrollWidth <= innerWidth` y que el ancho del canvas en CSS no cambia sin redimensionar.
- Test unitario: `medir` no cambia el estado si el contenedor no cambió de tamaño.

---

## Bug 2 · El editor no cabe en una ventana de tamaño normal

**Prioridad:** Alta (afecta a todo el uso del editor).
**Roles:** `disenador-ux` (actualizar `docs/ux/06-editor.md`) → `arquitecto` (tareas) → `programador`.

### Qué pasa
Con la ventana a media pantalla (~1720 px de ancho) el editor queda desordenado:
- La página entera hace scroll vertical. Sumando lista de líneas, vista previa, panel, transporte y línea de tiempo, el contenido es más alto que la ventana. Hay que desplazarse para ver todo y el panel derecho queda cortado arriba (no se ven su título ni el campo Inicio).
- La lista de letra ocupa casi toda la altura. Su `max-height: calc(100vh - 23rem)` (y la del `.panel`) se calculó antes de existir la línea de tiempo, así que ya no reserva su espacio.
- La vista previa queda arriba y pequeña, con un gran hueco vacío debajo.
- El panel derecho de 320 px se queda angosto: los controles de "Desplazamiento de toda la letra" se parten en dos renglones y su título aparece duplicado (encabezado + etiqueta).

### Esperado
A partir de ~1280×720 (y sin duda a 1720×1440) el editor **cabe completo en la ventana sin scroll de página**:
- Distribución tipo editor profesional, a 100% del alto (`100vh`):
  ┌──────────────── cabecera ────────────────┐
  │ Lista │     Vista previa      │  Panel    │  ← cada columna con scroll interno propio
  ├───────┴───────────────────────┴──────────┤
  │ Transporte                                │
  │ Línea de tiempo                           │  ← dock inferior
  └───────────────────────────────────────────┘
- Solo hacen scroll **dentro** de su zona la lista de líneas y el panel; la página nunca.
- La vista previa usa el espacio sobrante manteniendo 16:9, centrada, sin huecos muertos.

### Mejora pedida: paneles redimensionables y minimizables
- Divisores arrastrables entre lista ↔ previa ↔ panel, y entre la zona superior ↔ dock inferior (línea de tiempo).
- Cada panel tiene un **tamaño mínimo** y puede **minimizarse** (no ocultarse) a una barra compacta con controles rápidos. Por ejemplo:
  - Lista minimizada: línea actual, ↑/↓ y "Fijar inicio (I)".
  - Panel minimizado: Inicio/Fin, "Fijar fin (O)" y la casilla "Bloquear enunciado".
  - Línea de tiempo minimizada: solo minimapa + cabezal.
- Objetivo: que el usuario pueda dar el máximo espacio a la línea de tiempo o a la previa si lo desea.
- Recordar tamaños y paneles minimizados entre sesiones (preferencia global, no por canción).
- Doble clic en un divisor restablece el tamaño por defecto. Los divisores se pueden manejar con el teclado (accesibilidad).

### Criterios de aceptación
- A 1280×720, 1720×1440 y 1920×1080 (escala 100% y 125%) no hay scroll de página, ni vertical ni horizontal.
- Todo control del panel y del transporte es visible o está a un scroll **dentro** de su panel.
- Redimensionar y minimizar funciona con mouse y teclado, y persiste al reabrir.
- E2E de layout a esos tamaños y capturas en `docs/ux/revision-<fase>/`.

### Observación aparte (confirmar si es intencional)
En la captura el cabezal está en 03:20 pero la línea de tiempo muestra 00:00–00:24, y el minimapa marca el inicio de la canción. ¿La vista debería **seguir al cabezal** al reproducir (como en los DAW), en lugar de depender del botón "Centrar en el cabezal"?