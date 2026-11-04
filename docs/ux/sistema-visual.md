# Sistema visual — Shinobi Karaoke

> Responsable: diseñador UX. Fuente de verdad de los *tokens* visuales de la interfaz (no del estilo del karaoke, que define cada canción).
> Restricciones: [arquitectura.md § Restricciones e implicaciones para UX](../arquitectura.md), [ADR 0006](../adr/0006-persistencia-y-modelo-de-datos.md) (formato del estilo), [pregunta 0004](../preguntas/0004-fuentes-tipograficas-incluidas-y-del-sistema.md) (fuentes).

## 1. Identidad "Shinobi"
- **Sobria y oscura**: fondos casi negros con un leve tinte índigo (la noche del *shinobi*), sin texturas ni ilustraciones recargadas.
- **Un acento rojo** ("rojo hanko", el del sello japonés) reservado a la acción principal de cada pantalla. Nunca hay dos botones primarios rojos visibles a la vez.
- **Oro** solo para el **foco del teclado** y el resaltado de la parte cantada en el estilo predeterminado: lo que "se ilumina".
- **La letra es la protagonista**: en editor y reproductor la interfaz se retira (paneles en grises, controles que se ocultan).
- Logotipo provisional: wordmark "Shinobi Karaoke" en la fuente de interfaz, peso 700, con la "i" final de *Shinobi* sustituida por un pequeño shuriken/rombo rojo (detalle gráfico opcional; sin dependencia funcional).

## 2. Paleta (tema oscuro, único en el MVP)

Todos los pares texto/fondo indicados se han calculado con la fórmula de luminancia relativa de WCAG 2.x.

### 2.1 Superficies
| Token | Valor | Uso |
|-------|-------|-----|
| `fondo-0` | `#0E0F14` | Fondo de la ventana, reproductor sin estilo, primer arranque |
| `fondo-1` | `#161821` | Paneles, barra superior, tarjetas |
| `fondo-2` | `#1F2230` | Tarjeta en *hover*, campos de texto, filas seleccionadas |
| `fondo-3` | `#292D3E` | Botón secundario, menús emergentes, *tooltips* |
| `borde` | `#2E3244` | Separadores decorativos (no informativos) |
| `borde-control` | `#717896` | Borde de campos, casillas, interruptores (≥ 3:1 sobre `fondo-0…3`: 4,40 / 4,07 / 3,63 / 3,14) |
| `velo` | `rgba(0,0,0,0.6)` | Fondo detrás de diálogos modales |

### 2.2 Texto
| Token | Valor | Contraste sobre fondo-0 / 1 / 2 / 3 | Uso |
|-------|-------|-------------------------------------|-----|
| `texto-1` | `#F2F3F7` | 17,3 / 16,0 / 14,2 / 12,3 | Texto principal |
| `texto-2` | `#A9AEC2` | 8,7 / 8,0 / 7,2 / 6,2 | Texto secundario, etiquetas |
| `texto-3` | `#9197AC` | 6,6 / 6,1 / 5,4 / 4,7 | Ayudas, marcadores de posición (*placeholder*), metadatos menores |
| `texto-desactivado` | `#9197AC` al 60 % | — (exento WCAG) | Controles desactivados (siempre acompañados de explicación, ver §6) |

### 2.3 Acento y estados
| Token | Valor | Contraste | Uso |
|-------|-------|-----------|-----|
| `acento` | `#C8303B` | Blanco sobre él 5,33:1; él sobre `fondo-1` 3,32:1 | Fondo del botón primario |
| `acento-hover` | `#D13440` | Blanco 4,91:1 | *Hover* del primario |
| `acento-pulsado` | `#B82A35` | Blanco 6,14:1 | Pulsado |
| `acento-texto` | `#FF6B72` | 6,4:1 sobre `fondo-1` | Enlaces/acciones de texto con acento, icono activo |
| `foco` | `#FFCC4D` | 11,8:1 sobre `fondo-1` | Anillo de foco de teclado |
| `exito` | `#4ADE9A` (sobre `#12291F`: 8,96:1) | 10,3:1 sobre `fondo-1` | Estado **Lista**, paso completado |
| `aviso` | `#F5B94F` (sobre `#2E2410`: 8,67:1) | 10,1:1 sobre `fondo-1` | Estado **Borrador**, **Interrumpido**, avisos de contraste |
| `error` | `#FF7A7A` (sobre `#331618`: 6,56:1) | 7,0:1 sobre `fondo-1` | Errores, canción **Dañada**, acción destructiva |
| `info` | `#7CB8FF` (sobre `#122238`: 7,74:1) | 8,6:1 sobre `fondo-1` | Trabajo **en curso** / **en cola**, progreso |

Fondos tenues de insignia: `exito-tenue #12291F`, `aviso-tenue #2E2410`, `error-tenue #331618`, `info-tenue #122238`.

**Regla**: el color nunca es el único portador de significado. Toda insignia de estado lleva **icono + texto** ("✓ Lista", "✎ Borrador", "⟳ Separando 42 %", "⚠ Interrumpido", "✕ Error").

## 3. Tipografía de la interfaz
- **Familia**: **Atkinson Hyperlegible Next** (SIL OFL), incluida en la app (pesos 400, 600, 700). Diseñada para máxima distinción de caracteres (l/I/1, O/0), coherente con la preocupación por la legibilidad. Es también la fuente predeterminada de la letra (ver [respuesta a 0004](../preguntas/0004-fuentes-tipograficas-incluidas-y-del-sistema.md)).
- **Cifras de tiempo** (mm:ss.cc, duraciones, ETA): `font-variant-numeric: tabular-nums`; si la familia no tuviera cifras tabulares, usar la pila monoespaciada del sistema (`ui-monospace, "SF Mono", Consolas, "DejaVu Sans Mono", monospace`). No se empaqueta otra fuente para esto.
- Respaldo: `"Atkinson Hyperlegible Next", system-ui, sans-serif`.

| Token | Tamaño / interlínea | Peso | Uso |
|-------|---------------------|------|-----|
| `t-display` | 32 / 40 px | 700 | Títulos de primer arranque y estados vacíos |
| `t-titulo` | 24 / 32 px | 700 | Título de vista |
| `t-subtitulo` | 18 / 26 px | 600 | Encabezados de sección, título de tarjeta |
| `t-cuerpo` | 15 / 22 px | 400 | Texto general, campos |
| `t-cuerpo-fuerte` | 15 / 22 px | 600 | Botones, etiquetas importantes |
| `t-pequeno` | 13 / 18 px | 400 | Metadatos, ayudas, insignias |
| `t-tiempo` | 13 / 18 px | 400, tabular | Marcas de tiempo |

Tamaño mínimo de texto en la interfaz: **13 px**. Respetar el zoom de Electron (Ctrl/Cmd + / − / 0): todos los tamaños en `rem` (1 rem = 16 px por defecto; las cifras de arriba son a zoom 100 %).

## 4. Espaciado, rejilla y forma
- **Escala base 4 px**: `e-1` 4, `e-2` 8, `e-3` 12, `e-4` 16, `e-5` 24, `e-6` 32, `e-7` 48, `e-8` 64.
- Márgenes de vista: 32 px (≥ 1280 px de ancho) / 24 px (< 1280).
- **Radios**: `r-s` 6 px (campos, insignias), `r-m` 10 px (botones, tarjetas), `r-l` 16 px (diálogos, paneles flotantes). Píldora (999 px) solo en insignias de estado.
- **Elevación**: sin sombras grandes; los niveles se distinguen por `fondo-1…3`. Diálogos y menús: `0 8px 24px rgba(0,0,0,0.45)`.
- **Ventana**: tamaño mínimo **1024 × 640 px**; diseño de referencia 1280 × 800. Punto de corte único: **1280 px** (ver specs de Biblioteca y Editor).
- **Objetivos táctiles/clic**: mínimo 32 × 32 px (36 px de alto en botones normales, 44 px en botones grandes y en los del reproductor).
- **Movimiento**: transiciones de 120–200 ms (`ease-out`). Con `prefers-reduced-motion: reduce`, se eliminan transiciones de desplazamiento y escalado (el barrido de la letra **no** se elimina: es contenido, no decoración).

## 5. Iconografía
- Juego de iconos de trazo de licencia libre compatible con GPL-3.0 (p. ej. **Lucide**, ISC), 20 px en la interfaz, 28 px en el reproductor, trazo 1,75–2 px, color `currentColor`.
- Iconos mínimos: añadir, reproducir, pausa, detener, carpeta, enlace, buscar, lápiz (borrador), check (lista), alerta, x, reintentar, más-opciones (⋯), engranaje, info, papelera, pantalla completa, salir de pantalla completa, volumen, silencio, deshacer, metrónomo/toque (sincronía), paleta (estilo), letra (texto).
- Todo botón que sea solo icono tiene `aria-label` y *tooltip* con su nombre y atajo.

## 6. Componentes base

| Componente | Especificación | Estados |
|------------|----------------|---------|
| **Botón primario** | Fondo `acento`, texto blanco `t-cuerpo-fuerte`, alto 36 px (grande 44), padding 0 16 px, `r-m`. Uno por vista. | normal / hover `acento-hover` / pulsado `acento-pulsado` / foco (anillo) / cargando (spinner + texto "…ando", ancho fijo) / no disponible (ver abajo) |
| **Botón secundario** | Fondo `fondo-3`, texto `texto-1`, borde 1 px `borde-control`. | ídem, hover `#33384C` |
| **Botón fantasma** | Sin fondo, texto `texto-2` → `texto-1` en hover. Para "Cancelar", "Volver". | ídem |
| **Botón destructivo** | Fondo `error-tenue`, texto y borde `error`. Solo en diálogos de confirmación. | ídem |
| **Botón icono** | 36 × 36 px (44 en reproductor), `r-m`, fondo transparente → `fondo-3` en hover. | ídem + "activo" (icono `acento-texto`) |
| **Campo de texto** | Alto 36 px, fondo `fondo-2`, borde 1 px `borde-control`, `r-s`, etiqueta visible encima (`t-pequeno`, `texto-2`), ayuda debajo (`texto-3`). | foco (borde `foco` 2 px) / error (borde `error` + mensaje con icono debajo, `aria-describedby`) / solo lectura |
| **Área de texto** | Igual que campo; para pegar letra. Fuente de interfaz 15 px, interlínea 24 px. | ídem |
| **Selector de color** | Muestra de color 32 × 32 px + valor `#RRGGBB` editable + selector nativo al hacer clic + fila de **8 muestras sugeridas** de la paleta de karaoke (§8). | foco / valor no válido ("Usa el formato #RRGGBB") |
| **Selector de fuente** | Lista desplegable en la que cada opción se muestra **en su propia fuente** con el texto "¿Cantamos? Ñandú" (comprueba acentos, ñ y ¿). | foco / abierta / seleccionada |
| **Control segmentado** | 2–4 opciones excluyentes (p. ej. *Sólido / Degradado*, *Original / Voz / Instrumental*, *0,5× / 0,75× / 1×*). Seleccionada: fondo `fondo-3`, texto `texto-1` 600, borde 1 px `texto-2`; no seleccionada: transparente, texto `texto-2`; grupo con `role="radiogroup"`. | ídem + opción no disponible con *tooltip* del motivo |
| **Insignia de estado** | Píldora `t-pequeno` 600, icono 14 px + texto, fondo tenue + color de estado (§2.3). | Lista · Borrador · En curso · En cola · Interrumpido · Error · Dañada |
| **Barra de progreso** | Alto 6 px (12 px en vista de progreso), pista `fondo-3`, relleno `info`. Indeterminada: segmento que se desplaza (con movimiento reducido: relleno al 100 % con opacidad pulsante lenta). `role="progressbar"` con `aria-valuenow` (omitido si indeterminada) y `aria-valuetext` ("42 %, quedan unos 3 minutos"). | determinada / indeterminada / pausada-error (relleno `error`) |
| **Lista de pasos (stepper)** | Horizontal en la cabecera del espacio de canción: círculo 24 px + etiqueta. Completado: check `exito`. Actual: círculo `acento`, etiqueta `texto-1` 600. En curso en segundo plano: spinner `info`. Error/interrumpido: icono de estado. Pendiente: círculo contorno `borde-control`. Cada paso es un botón si es navegable. | ver §7 de 00-mapa-de-vistas |
| **Tarjeta de canción** | Ver spec 02. 240 px de ancho mínimo, portada 16:9, `fondo-1`, `r-m`. | normal / hover / foco / en curso / error / dañada |
| **Diálogo modal** | Ancho 480 px (máx. 90 vw), `fondo-1`, `r-l`, título `t-subtitulo`, acciones abajo a la derecha (primaria a la derecha). Atrapa el foco; Esc = acción de cancelar; devuelve el foco al disparador. | — |
| **Aviso en línea (banner)** | Franja con icono, texto y acción opcional; fondo tenue del estado y borde izquierdo 3 px del color de estado. `role="status"` (info/éxito) o `role="alert"` (error). | info / aviso / error / éxito |
| **Notificación flotante (toast)** | Abajo a la derecha, 360 px, `fondo-3`, desaparece a los 6 s (no si tiene acción o el ratón está encima). Máx. 3 apiladas. `aria-live="polite"`. | ídem |
| **Menú contextual (⋯)** | `fondo-3`, ítems de 32 px, navegable con flechas, Esc cierra. Ítems destructivos en `error`. | — |
| **Tooltip** | `fondo-3`, `t-pequeno`, aparece a los 500 ms de hover o inmediatamente con foco de teclado. | — |
| **Indicador de actividad** | En la barra superior: botón con spinner `info` + "1 en curso" / "2 en curso · 1 en cola". Abre un panel con la lista de trabajos (ver 04). Oculto si no hay trabajos. | — |

**Acciones no disponibles**: no se usan botones `disabled` mudos para acciones importantes ("Marcar como lista", "Reproducir"). Se renderizan con `aria-disabled="true"`, siguen recibiendo foco y, al pulsarlos o enfocarlos, muestran **qué falta** (popover/tooltip). Los botones secundarios triviales sí pueden ir `disabled`.

## 7. Foco y navegación por teclado
- **Anillo de foco**: `outline: 2px solid #FFCC4D; outline-offset: 2px;` en todos los elementos interactivos, solo con `:focus-visible`. Sobre fondos de canción arbitrarios (vista previa del editor, reproductor) el anillo es doble: 2 px `#FFCC4D` + 2 px exterior `#0E0F14`, visible sobre cualquier fondo.
- Orden de tabulación = orden visual (izquierda→derecha, arriba→abajo). Cada vista tiene un primer elemento enfocable lógico (indicado en su spec).
- Enlace "Saltar al contenido" invisible hasta recibir foco, en Biblioteca y Editor.
- Atajos con **Ctrl** en Windows/Linux y **Cmd** en macOS (en las specs: "Ctrl/Cmd"). Los atajos de una sola tecla (Espacio, Intro, flechas) no se activan si el foco está en un campo de texto.
- Lista de atajos accesible con **F1** o **?** (diálogo "Atajos de teclado") en Editor y Reproductor.
- Lectores de pantalla: las regiones usan *landmarks* (`banner`, `main`, `navigation`, `complementary`); los cambios de progreso se anuncian solo en hitos (inicio, cada 25 %, fin, error) para no saturar.

## 8. Estilo de karaoke predeterminado y muestras sugeridas
Estilo que se copia en cada canción nueva (`config.json → estilo_predeterminado`):
```jsonc
{ "version": 1,
  "fondo": { "tipo": "degradado", "angulo_grados": 135,
             "paradas": [ { "color": "#1B1033", "posicion": 0 }, { "color": "#5A1E6E", "posicion": 1 } ] },
  "letra": { "fuente": { "familia": "Atkinson Hyperlegible Next", "origen": "incluida" },
             "color": "#FFFFFF", "color_resaltado": "#FFD400" } }
```
Contraste: blanco sobre `#1B1033` 17,97:1 y sobre `#5A1E6E` 11,38:1; `#FFD400` 12,55:1 y 7,95:1. Cumple AA (y AAA) en todo el degradado.

**Muestras sugeridas** en los selectores de color del editor (8 por selector):
- Fondo: `#0E0F14` (noche), `#1B1033` (índigo), `#5A1E6E` (ciruela), `#0B3D4A` (petróleo), `#123524` (bosque), `#4A0E16` (granate), `#1E2A5A` (marino), `#F2E8D5` (papel claro).
- Letra / resaltado: `#FFFFFF`, `#F2F3F7`, `#FFD400` (oro), `#FF5C8A` (rosa), `#4ADEDE` (cian), `#7CFF6B` (lima), `#FF9F1C` (naranja), `#111111` (tinta, para fondos claros).

## 9. Reglas de contraste del estilo de karaoke (aviso en el editor)
La letra del karaoke es **texto grande** (≥ 24 px en todos los casos), por lo que el umbral AA es **3:1**. La app **no bloquea** combinaciones, pero avisa (spec 06):

| Comprobación | Cálculo | Umbral | Nivel |
|--------------|---------|--------|-------|
| Letra vs fondo | Ratio WCAG entre `letra.color` y el color del fondo; en degradados, el **peor** ratio entre la letra y cada una de 11 muestras interpoladas (0 %, 10 %, …, 100 %) del degradado en sRGB | < 3:1 | ⚠ "Difícil de leer" |
| | | 3:1 – 4,5:1 | ⓘ "Legible en pantallas grandes; puede costar en proyectores" |
| Resaltado vs fondo | Ídem con `color_resaltado` | < 3:1 | ⚠ |
| Resaltado vs letra | Diferencia de color ΔE (CIE76, en CIELAB) entre `color` y `color_resaltado` | < 25 | ⚠ "El resaltado apenas se distingue de la letra" |

Los cálculos se hacen sin contar la sombra fija de la letra (§10), es decir, del lado conservador.

## 10. Valores fijos de render de la letra (no editables en el MVP)
Compartidos por la vista previa del editor y el reproductor (la vista previa los aplica escalados a su tamaño). Unidades relativas al **alto** del área de render (`vh` del reproductor) para que se vean igual en cualquier pantalla:

| Elemento | Valor |
|----------|-------|
| Línea actual — tamaño | `clamp(32px, 7.5vh, 140px)` (≈ 81 px en 1080p, ≈ 54 px en 720p) |
| Línea siguiente — tamaño | 70 % de la actual, mismo color de letra (sin transparencia, para no perder contraste) |
| Peso | El único peso incluido de la familia (ver 0004) |
| Interlínea | 1,2 |
| Ancho máximo de línea | 88 % del ancho; si no cabe, se parte en **máximo 2 renglones** equilibrados; si aun así no cabe, se reduce el tamaño hasta un mínimo del 75 % |
| Alineación | Centrada |
| Posición | Línea actual con su centro al 45 % del alto; siguiente debajo con separación de 0,6 × tamaño actual |
| Sombra | `0 0.04em 0.12em rgba(0,0,0,0.55)` (mejora legibilidad sobre degradados; no se usa contorno) |
| Resaltado | Barrido progresivo de izquierda a derecha con `color_resaltado` (por palabra si la letra trae tiempos por palabra; el editor del MVP no los crea, [0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md)) |
| Transición entre líneas | La siguiente sube a la posición actual en 200 ms (instantánea con movimiento reducido) |
| Indicador de entrada | Si faltan ≥ 4 s para la próxima línea tras una pausa (o al inicio), se muestran 3 puntos `●●●` en `color_resaltado` sobre la siguiente línea que se apagan uno por segundo en los 3 s previos |
| Pantalla de título | Antes de la primera línea: título (tamaño actual) y artista (50 %) centrados, en `letra.color`, hasta 4 s antes de la primera línea |
| Aviso sobre el fondo del estilo | Para mensajes del reproductor que aparecen sobre el fondo de la canción (p. ej. `rep.incompleta`, spec 07): píldora con fondo `rgba(0,0,0,0.6)`, texto `#FFFFFF` en `t-cuerpo`, icono en `aviso`, radio completo, padding 8 × 16 px. Nunca en la franja central 25 %–75 % mientras se canta |
| Fin del barrido | En el fin efectivo de la línea (`finEfectivo`, ADR 0005); las pausas no se dibujan |
