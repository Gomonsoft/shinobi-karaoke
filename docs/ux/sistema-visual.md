# Sistema visual — Shinobi Karaoke

> Responsable: diseñador UX. Fuente de verdad de los *tokens* visuales de la interfaz (no del estilo del karaoke, que define cada canción).
> Restricciones: [arquitectura.md § Restricciones e implicaciones para UX](../arquitectura.md), [ADR 0006](../adr/0006-persistencia-y-modelo-de-datos.md) (formato del estilo), [pregunta 0004](../preguntas/0004-fuentes-tipograficas-incluidas-y-del-sistema.md) (fuentes).

## 1. Identidad "Shinobi"
- **Sobria y oscura**: fondos casi negros con un leve tinte índigo (la noche del *shinobi*), sin texturas ni ilustraciones recargadas.
- **Un acento rojo** ("rojo hanko", el del sello japonés) reservado a la acción principal de cada pantalla. Nunca hay dos botones primarios rojos visibles a la vez (con un diálogo modal abierto, el primario de la vista queda tras el `velo` y no cuenta: el del diálogo es el único activo).
- **Oro** solo para el **foco del teclado** y el resaltado de la parte cantada en el estilo predeterminado: lo que "se ilumina".
- **La letra es la protagonista**: en editor y reproductor la interfaz se retira (paneles en grises, controles que se ocultan).
- Logotipo provisional: wordmark "Shinobi Karaoke" en la fuente de interfaz, peso 700, con la "i" final de *Shinobi* sustituida por un pequeño shuriken/rombo rojo (detalle gráfico opcional; sin dependencia funcional).

### 1.1 Icono de la app
Traslada a un archivo el rombo rojo `◆` que ya acompaña al nombre en las specs, con los tokens de §2. No crea una marca nueva y es tan provisional como el logotipo: se sustituye si el usuario decide otra marca ([0039](../preguntas/0039-icono-de-la-app-y-texto-del-menu-apple.md)). Es de creación propia, con la licencia del proyecto.

| Elemento | Especificación (lienzo de 1024 × 1024 px) |
|----------|-------------------------------------------|
| Lienzo | PNG RGBA, fondo transparente. Margen de 100 px en cada lado |
| Placa | Cuadrado redondeado de 824 × 824 px, de (100, 100) a (924, 924), radio exterior 186 px, relleno `fondo-0` `#0E0F14` |
| Borde de la placa | 8 px hacia dentro, `borde` `#2E3244`, para que se distinga en barras y muelles oscuros; decorativo |
| Rombo | Vértices (512, 212), (812, 512), (512, 812), (212, 512), relleno `acento` `#C8303B`, esquinas vivas. Contraste con la placa ≈ 3,6:1 (≥ 3:1 para objetos gráficos) |
| Sin | Texto, degradados, sombras, brillos ni ilustración |
| Tamaños pequeños | Una sola imagen, sin variantes: por eso no lleva texto ni detalles finos. A 16 px, la placa mide unos 13 px y el rombo unos 9 px; el borde puede desaparecer sin que importe |

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="104" y="104" width="816" height="816" rx="182" fill="#0E0F14" stroke="#2E3244" stroke-width="8"/>
  <path d="M512 212 L812 512 L512 812 L212 512 Z" fill="#C8303B"/>
</svg>
```

Criterios: `app/build/icon.png` mide 1024 × 1024 con canal alfa; (0, 0) es transparente, (512, 512) es `#C8303B` y (150, 512) es `#0E0F14`; reducido a 16, 32, 48 y 256 px, el rombo se distingue sobre fondo claro y oscuro.

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
- **Ventana**: tamaño mínimo del **área de contenido** **1024 × 576 px CSS** (desde la subfase 2.1 de 0.2.0; antes 1024 × 640). Es el viewport de una ventana de 1280 × 720 a escala 125 %. Electron lo aplica al contenido, sin contar el marco (`useContentSize`, [ADR 0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles)). Diseño de referencia 1280 × 800. Punto de corte único de ancho: **1280 px** (ver specs de Biblioteca y Editor); el editor añade el modo compacto de altura (< 800 px, ver [Editor, subfase 2.1](06-editor.md#subfase-21--layout-adaptable-y-paneles)). Las vistas que no son el editor conservan el desplazamiento vertical de página cuando no caben.
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
| **Botón fantasma** | Sin fondo, texto `texto-2` → `texto-1` en hover. Para "Volver", "Borrar búsqueda", "Ver todas" y "Cancelar" fuera de diálogos. En los **diálogos**, "Cancelar" usa el **secundario** (revisión Fase 1). | ídem |
| **Botón destructivo** | Fondo `error-tenue`, texto y borde `error`. Solo en diálogos de confirmación. | ídem |
| **Botón icono** | 36 × 36 px (44 en reproductor), `r-m`, fondo transparente → `fondo-3` en hover. | ídem + "activo" (icono `acento-texto`) |
| **Control de volumen** | Botón icono (silenciar) + deslizador horizontal (pista 4 px, tirador 16 px, `role="slider"`, flechas ±10 %) + porcentaje opcional `t-tiempo` de ancho fijo. Silenciado: icono tachado (`volume-x` / `mic-off`) y deslizador y cifra en `texto-2`, conservando el valor. En el reproductor hay dos: **volumen general** (120 px, sin cifra) y **voz guía** (etiqueta "Voz" + 96 px + cifra), separados 24 px (spec 07). Sobre las franjas del reproductor: pista `rgba(255,255,255,0.35)`, relleno y tirador `#FFFFFF`. | normal / foco / silenciado / no disponible (`aria-disabled`, tooltip del motivo) |
| **Campo de texto** | Alto 36 px, fondo `fondo-2`, borde 1 px `borde-control`, `r-s`, etiqueta visible encima (`t-pequeno`, `texto-2`), ayuda debajo (`texto-3`). | foco (borde `foco` 2 px) / error (borde `error` + mensaje con icono debajo, `aria-describedby`) / solo lectura |
| **Área de texto** | Igual que campo; para pegar letra. Fuente de interfaz 15 px, interlínea 24 px. | ídem |
| **Selector de color** | Muestra de color 32 × 32 px + valor `#RRGGBB` editable + selector nativo al hacer clic + fila de **8 muestras sugeridas** de la paleta de karaoke (§8). | foco / valor no válido ("Usa el formato #RRGGBB") |
| **Selector de fuente** | Lista desplegable en la que cada opción se muestra **en su propia fuente** con el texto "¿Cantamos? Ñandú" (comprueba acentos, ñ y ¿). | foco / abierta / seleccionada |
| **Control segmentado** | 2–4 opciones excluyentes (p. ej. *Sólido / Degradado*, *Original / Voz / Instrumental*, *0,5× / 0,75× / 1×*). Seleccionada: fondo `fondo-3`, texto `texto-1` 600, borde 1 px `texto-2`; no seleccionada: transparente, texto `texto-2`; grupo con `role="radiogroup"`. | ídem + opción no disponible con *tooltip* del motivo |
| **Insignia de estado** | Píldora `t-pequeno` 600, icono 14 px + texto, fondo tenue + color de estado (§2.3). | Lista · Borrador · En curso · En cola · Interrumpido · Error · Dañada |
| **Barra de progreso** | Alto 6 px (12 px en vista de progreso), pista `fondo-3`, relleno `info`. Indeterminada: segmento que se desplaza (con movimiento reducido: relleno al 100 % con opacidad pulsante lenta). `role="progressbar"` con `aria-valuenow` (omitido si indeterminada) y `aria-valuetext` ("42 %, quedan unos 3 minutos"). | determinada / indeterminada / pausada-error (relleno `error`) |
| **Lista de pasos (stepper)** | Horizontal en la cabecera del espacio de canción: círculo 24 px + etiqueta. El círculo refleja siempre el **estado** del paso: completado = check `exito`; en curso en segundo plano = spinner `info`; error/interrumpido = icono de estado; pendiente = círculo contorno `borde-control`; **● (círculo `acento` relleno) solo si el paso actual no tiene otro estado** (pendiente). El **paso actual** se distingue además, con cualquier indicador, por la etiqueta `texto-1` 600 con subrayado de 2 px `acento-texto` y `aria-current="step"` (respuesta a [0024](../preguntas/0024-stepper-letra-actual-y-volver-a-letra-desde-el-editor.md)). Cada paso es un botón si es navegable. | ver §7 de 00-mapa-de-vistas |
| **Tarjeta de canción** | Ver spec 02. 240 px de ancho mínimo, portada 16:9, `fondo-1`, `r-m`. | normal / hover / foco / en curso / error / dañada |
| **Diálogo modal** | Ancho 480 px (máx. 90 vw), `fondo-1`, `r-l`, título `t-subtitulo`, acciones abajo a la derecha (primaria a la derecha). Atrapa el foco; Esc = acción de cancelar; devuelve el foco al disparador. | — |
| **Aviso en línea (banner)** | Franja con icono, texto y acción opcional; fondo tenue del estado y borde izquierdo 3 px del color de estado. `role="status"` (info/éxito) o `role="alert"` (error). | info / aviso / error / éxito |
| **Notificación flotante (toast)** | Abajo a la derecha, 360 px, `fondo-3`, desaparece a los 6 s (no si tiene acción o el ratón está encima). Máx. 3 apiladas. `aria-live="polite"`. | ídem |
| **Menú contextual (⋯)** | `fondo-3`, ítems de 32 px, navegable con flechas, Esc cierra. Ítems destructivos en `error`, al final y precedidos de un separador de 1 px `borde`. Se pinta por encima de todo (nunca lo recorta su contenedor) y se abre hacia arriba si no cabe debajo. Al abrirse se oculta el tooltip de su disparador. | — |
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
Estilo incluido de Shinobi Karaoke (`ESTILO_PREDETERMINADO`). En 0.1.0 se copiaba en cada canción nueva (`config.json → estilo_predeterminado`). Desde 0.2.0, fase 3, si el usuario no lo había cambiado, siembra el tema «Shinobi» del catálogo y es el aspecto de las canciones con procedencia «Estilo incluido» ([ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §1 y §3); `config.estilo_predeterminado` queda como campo heredado:
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
| Línea actual — tamaño | `max(32px, 7.5vh)` (≈ 81 px en 1080p, ≈ 54 px en 720p, 162 px con 2160 px CSS de alto). Sin tope en píxeles desde la Fase 6: el tope anterior de 140 px encogía la letra en televisores 4K con escalado 100 % (spec 07 §"Legibilidad a distancia") |
| Línea siguiente — tamaño | 70 % de la actual, mismo color de letra (sin transparencia, para no perder contraste) |
| Peso | El único peso incluido de la familia (ver 0004) |
| Interlínea | 1,2 |
| Ancho máximo de línea | 88 % del ancho; si no cabe, se parte en **máximo 2 renglones** equilibrados; si aun así no cabe, se reduce el tamaño hasta un mínimo del 75 % |
| Alineación | Centrada |
| Posición | Línea actual con su centro al 45 % del alto; siguiente debajo con separación de 0,6 × tamaño actual |
| Sombra | `0 0.04em 0.12em rgba(0,0,0,0.55)` (mejora legibilidad sobre degradados; no se usa contorno) |
| Resaltado | Barrido progresivo de izquierda a derecha con `color_resaltado` (por palabra si la letra trae tiempos por palabra; el editor del MVP no los crea, [0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md)) |
| Transición entre líneas | La siguiente sube a la posición actual en 200 ms (instantánea con movimiento reducido) |
| Indicador de entrada | Antes de la **primera línea** (siempre, sea cual sea el hueco desde 0) y antes de toda línea cuyo hueco desde el fin efectivo de la anterior es ≥ 4 s: 3 puntos `●●●` en `color_resaltado` sobre la siguiente línea, que se apagan uno por segundo en los 3 s previos |
| Pantalla de título | Antes de la primera línea: título (tamaño actual) y artista (50 %) centrados, en `letra.color`, hasta 4 s antes de la primera línea. En el reproductor, si la primera línea entra antes de 6 s, un silencio previo garantiza ≥ 2 s de título (spec 07 §"Inicio y silencio previo") |
| Aviso sobre el fondo del estilo | Para mensajes del reproductor que aparecen sobre el fondo de la canción (p. ej. `rep.incompleta`, indicador breve, etiquetas de pista; spec 07): píldora con fondo `rgba(0,0,0,0.6)`, texto `#FFFFFF` de `max(t-cuerpo, 2.2vh)` (indicador breve: `max(20px, 3vh)`), icono en `aviso`, radio completo, padding 0,5 × 1 em. Nunca en la franja central 25 %–75 % mientras se canta |
| Fin del barrido | En el fin efectivo de la línea (`finEfectivo`, ADR 0005); las pausas no se dibujan |

## 0.2.0 — Línea de tiempo de sincronía

| Elemento | Tratamiento visual |
|---|---|
| Regla | Marcas en `borde-control` y etiquetas en `texto-2` con `t-tiempo`. Reducir la densidad de etiquetas cuando no quepan. |
| Onda de voz | Silueta en `texto-3` sobre `fondo-2`, detrás del cabezal y en una pista separada de las etiquetas de las regiones. |
| Región | `fondo-3` y borde `borde-control`. Selección con borde `acento-texto` y tiradores visibles. El borde discontinuo distingue el fin automático. Un borde recortado usa un indicador de continuidad. |
| Tirador | Trazo visible y objetivo de puntero de al menos 24 × 24 px. Escalonar objetivos superpuestos y conservar el anillo de foco estándar. |
| Cabezal | Línea con remate triangular en la regla, visible por encima de las pistas y distinguible por forma de ambos tiradores. |
| Vista general | Marco de ventana visible con borde y relleno, acompañado de etiqueta accesible con tiempos visibles. Mantener el marco legible aun cuando ocupa un tramo mínimo. |

Mantener contraste perceptible de estados, límites y foco, también cuando la pista no dispone de onda. Ver [Editor, segunda fase](06-editor.md#segunda-fase-de-020--línea-de-tiempo-de-sincronía).

## 0.2.0 — Divisores y rieles del editor (subfase 2.1)

| Componente | Tratamiento visual |
|---|---|
| Divisor | Franja de agarre de 12 px con línea centrada de 1 px `borde` y agarre `⋮`/`⋯` de 16 px en `texto-3` (objetivo 24 × 24). *Hover*: línea 2 px `borde-control`. Arrastre: 2 px `acento-texto`. Foco: línea 2 px `foco` + anillo de §7. Cursor `col-resize` / `row-resize`. |
| Riel (panel minimizado) | `fondo-1`, borde `borde` hacia el contenido, botones icono de 32 × 32, valores en `t-tiempo`, etiquetas en `t-pequeno` `texto-2`. Lista 72 px, panel 120 px; la línea de tiempo minimizada es una fila de 44 px (40 en compacto). |

El editor usa márgenes laterales de 16 px y el dock pegado al borde inferior, como excepción a §4.

## 0.2.0 — Temas y biblioteca agrupada (fase 3)

| Componente | Tratamiento visual |
|---|---|
| **Muestra de tema** | Rectángulo 16:9 con radio `r-s` y borde 1 px `borde`: fondo del tema (sólido o degradado) con «Aa» centrado en la fuente y el color de letra del tema y la sombra de §10. Tamaños: 48 × 27 px (selectores, resumen del editor), 64 × 36 px (lista de Ajustes). Decorativa (`aria-hidden`): el nombre del tema siempre va en texto al lado. |
| **Selector de tema** | Como el selector de fuente de §6: lista desplegable cuyas opciones son muestra + nombre (`t-cuerpo`) + etiqueta «Predeterminado» (`t-pequeno`, `texto-2`, con borde `borde-control`, sin píldora: no es un estado). Opción no disponible: nombre en `texto-2` con « (no disponible)». |
| **Línea de procedencia** | `t-pequeno` `texto-2` bajo el selector; los usos en `texto-3`. Sin color de estado: es información, no un aviso. |
| **Grupo de modo** | Radios verticales de 20 px con borde `borde-control`; seleccionado relleno `acento-texto`; etiqueta `t-cuerpo-fuerte`, descripción `t-pequeno` `texto-2`. |
| **Pie fijo del panel (editar tema)** | `fondo-1` con borde superior 1 px `borde`, relleno 8 px, dos filas de botones secundarios de 36 px. Sin sombra. |
| **Línea de tema en la tarjeta** | Icono `palette` 14 px + texto `t-pequeno` `texto-3`, una línea con «…». Tema no disponible: icono `alert-triangle` en `aviso`, texto en `texto-3`. |
| **Encabezado de grupo** | `h2` en `t-subtitulo` dentro de un botón plegable (chevron 20 px, `texto-2`, gira 90° en 120 ms; sin giro animado con movimiento reducido). Recuento en `t-pequeno` `texto-2`. Tema del grupo en `t-pequeno` `texto-2` y [Tema…] como botón fantasma. Separación: 32 px antes de cada grupo, 12 px entre encabezado y rejilla. Sin fondo propio ni línea pegajosa. |
| **Casilla de selección en tarjeta** | 24 × 24 px sobre la portada, arriba a la izquierda a 8 px de los bordes, sobre una píldora `rgba(0,0,0,0.6)` para que se vea sobre cualquier portada. Marcada: fondo `acento`, check blanco (5,33:1). Tarjeta seleccionada: borde 2 px `acento-texto` (además de la casilla, el color no es la única señal). No disponible: casilla con borde `texto-desactivado` y tooltip. |
| **Barra de selección** | `fondo-2`, `r-m`, alto 48 px, `position: sticky` bajo la barra de herramientas; contador en `t-cuerpo-fuerte`, «fuera de la vista» en `texto-2`; «Aplicar tema…» secundario (el único primario de la vista sigue siendo «Añadir canción»). |
| **Lista de canciones en diálogos** | Caja `fondo-2` con borde `borde`, `r-s`, filas de 40 px (título `t-cuerpo`, nota `t-pequeno` `texto-2`), scroll propio (máx. 280 px). Resultados: ✓ `exito`, ✕ `error`, – `texto-3`, siempre con texto. |
| **Diálogo ancho** | Variante del diálogo modal de 560 px (máx. 90 vw) para «Aplicar tema». |

Contraste (fase 3): todos los textos nuevos usan `texto-1/2/3` sobre `fondo-1/2` (≥ 4,7:1, §2.2) y los iconos de estado sus colores de §2.3. Las muestras pintan la letra del tema tal cual: el aviso de contraste de §9 se sigue mostrando en el editor para el tema efectivo. Ver [Editor](06-editor.md#fase-3-de-020--temas-y-biblioteca), [Biblioteca](02-biblioteca.md#fase-3-de-020--temas-y-biblioteca) y [Ajustes](08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca). El mínimo de ventana de §4 (1024 × 576) coincide con el mínimo de diseño del editor. Medidas, mínimos y teclado en [Editor, subfase 2.1](06-editor.md#subfase-21--layout-adaptable-y-paneles).

## 0.2.0 — Ventana secundaria y cola (fase 4)

| Componente | Tratamiento visual |
|---|---|
| **Panel de la cola** | `fondo-1`, borde izquierdo 1 px `borde`, 360 px (≥ 1280) / 320 px (< 1280), relleno 16 px, scroll propio. `h2` en `t-subtitulo`; `h3` de bloque en `t-pequeno` 600 `texto-2` en mayúsculas («EN REPRODUCCIÓN», «A CONTINUACIÓN»). |
| **Bloque de la activa** | `fondo-2`, `r-m`, relleno 12 px. Título `t-cuerpo-fuerte`, artista `t-pequeno` `texto-2`, barra de progreso de §6 (6 px, `info`, sin tirador: no es un control), tiempos `t-tiempo`. Botones secundarios de 36 px con icono. En fallo lo sustituye el banner `error` de §6. |
| **Fila de pendiente** | 48 px, `t-cuerpo` (título) + `texto-2` (— artista, duración en `t-tiempo`), número de posición en `t-tiempo` `texto-3` de ancho fijo, asa ⠿ 16 px `texto-3` (objetivo 24 × 24, cursor `grab`). *Hover* y fila activa del *roving tabindex*: `fondo-2`. Etiqueta «Siguiente» como la de «Predeterminado» (borde `borde-control`, `t-pequeno`, sin píldora). No disponible: segunda línea con icono ⚠ `aviso` y texto `texto-2`. |
| **Arrastre** | Fila arrastrada al 40 % de opacidad en su sitio; fantasma bajo el puntero con `fondo-3` y la sombra de menús; indicador de destino: línea de 2 px `acento-texto` con un punto de 6 px a la izquierda. Sin animación de reordenación con movimiento reducido. |
| **Indicador de sesión** | Como el indicador de actividad (§6): botón de la barra superior con icono `monitor-play` 16 px + texto `t-pequeno`. Normal en `info`; «Requiere atención» en `aviso` con icono `alert-triangle`; sin sesión (solo cola) en `texto-2`. |
| **Punto de pantalla** | 8 px `exito` + texto: «● Pantalla 2 · …». |
| **Contador de transición** (secundaria) | Disco `rgba(0,0,0,0.6)` de 1,6 × el alto del número; número `#FFFFFF` 700 de `máx(64 px, 18vh)` con la sombra de §10, centro al 45 % del alto; anillo de `0.6vh` (pista `rgba(255,255,255,0.35)`, relleno `#FFFFFF`) que se vacía en sentido horario; etiqueta debajo en `máx(t-cuerpo, 2.2vh)`. Entrada de cada número: escala 0,9 → 1 + fundido, 200 ms `ease-out`. Movimiento reducido: sin anillo ni escala. |
| **Tarjeta «A continuación»** (secundaria) | Abajo a la derecha (4vw / 6vh), máx. 40vw, `rgba(0,0,0,0.6)`, `r-l`, relleno 1 × 1,25 em, todo `#FFFFFF`: etiqueta `máx(t-pequeno, 1.8vh)` 600 en mayúsculas, título `máx(20px, 3.2vh)` 600 (una línea, «…»), artista `máx(t-cuerpo, 2.2vh)`. Cambio de candidata: fundido 200 ms (inmediato con movimiento reducido). |
| **Pantalla en espera sin candidata** | `fondo-0`; «◆ Shinobi Karaoke» en `texto-3` a `máx(32px, 6vh)` y texto en `texto-2` a `máx(t-cuerpo, 2.2vh)`, centrados al 45 % del alto. |
| **Candado de acción bloqueada** | Icono `lock` 14 px en `texto-3` junto al texto del elemento `aria-disabled` (menú, botón o tooltip del paso). |

Contraste (fase 4): los textos del panel usan `texto-1/2/3` sobre `fondo-1/2` (≥ 5,4:1, §2.2); todo lo que la secundaria pinta sobre el fondo de una canción va en `#FFFFFF` sobre `rgba(0,0,0,0.6)` (≥ 5,7:1 con cualquier fondo, como los controles del reproductor), de modo que la cuenta y la tarjeta se leen aunque el tema de la candidata tenga avisos de contraste. Ninguno de estos elementos aparece en la franja central 25 %–75 % **mientras se canta**; la cuenta usa el centro porque entre canciones no hay letra. Ver [Biblioteca](02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola), [Reproductor](07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) y [Editor](06-editor.md#fase-4-de-020--ventana-secundaria-y-cola).
