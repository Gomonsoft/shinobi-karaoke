# 01 — Primer arranque (e instalación)

- Paso del pipeline: 0
- ADRs: [0001](../adr/0001-plataforma-y-stack.md), [0004](../adr/0004-separacion-voz-instrumental.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md)
- Restricciones: [arquitectura.md §6 Primer arranque y "Restricciones e implicaciones para UX" §1, §8](../arquitectura.md)
- Preguntas relacionadas: [0001](../preguntas/0001-firma-de-codigo-instaladores.md) (decidida por el usuario: sin firma en el MVP), [0003](../preguntas/0003-elegir-calidad-o-rapidez-separacion.md), [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) (respondidas)
- Cifras de tamaño, espacio y tiempo: se leen del **manifiesto de runtime** (`{n}` en los textos); los valores de los ejemplos son provisionales hasta el spike ([tarea 0005](../tareas/0005-spike-separacion-y-runtime.md)).

## Objetivo
Que una persona no técnica pase de "he descargado el instalador" a "tengo la biblioteca abierta" sin asustarse ni quedarse atascada, sabiendo en cada momento **qué se descarga, cuánto falta y qué hacer si falla**.

Usuario/tarea principal: abrir Shinobi Karaoke por primera vez y dejarlo listo para usar.

---

## Parte A — Fuera de la app: guía de instalación (instaladores sin firmar)

El MVP se publica con **instaladores sin firmar** (decisión del usuario en la [pregunta 0001](../preguntas/0001-firma-de-codigo-instaladores.md)). La app no puede ayudar antes de abrirse, así que la guía vive en la **página de descarga / README** del proyecto (la redacta el programador a partir de este texto; las capturas se hacen cuando exista el instalador).

### Estructura de la página "Instalar Shinobi Karaoke"
1. Botones de descarga por SO, detectando el SO del visitante y mostrando su botón primero.
2. Requisitos en una línea: "Windows 10/11, macOS 12 o posterior, o Linux de 64 bits · 8 GB de RAM · entre 3 y 8 GB libres según tu equipo (más unos 100 MB por canción) · conexión a internet la primera vez".
3. Bloque "¿Por qué mi ordenador me avisa?":
   > Shinobi Karaoke es gratuito y lo hacen voluntarios. Todavía no pagamos el certificado que usan Windows y macOS para reconocer a los desarrolladores, así que tu sistema te mostrará un aviso la primera vez. Es normal. Te explicamos cómo continuar.
4. Pasos por SO, cada uno con captura y el texto **exacto** del botón del sistema resaltado:

**Windows (SmartScreen)**
1. Abre el instalador descargado.
2. Si aparece "Windows protegió su PC", pulsa **Más información**.
3. Pulsa **Ejecutar de todas formas**.
4. Sigue el instalador.

**macOS (Gatekeeper)**
1. Abre el archivo `.dmg` y arrastra Shinobi Karaoke a **Aplicaciones**.
2. Abre la app. Si macOS dice que no se puede abrir, pulsa **Aceptar** (o **Listo**).
3. Ve a **Ajustes del Sistema → Privacidad y seguridad**, baja hasta el mensaje sobre Shinobi Karaoke y pulsa **Abrir igualmente**. Confirma con tu contraseña.
4. (Alternativa en macOS 12–14: clic derecho sobre la app → **Abrir** → **Abrir**.)
   Solo hace falta la primera vez.

**Linux**
- AppImage: dale permiso de ejecución (clic derecho → Propiedades → Permitir ejecutar como programa) y ábrela. `.deb`: ábrelo con tu instalador de software.

5. Enlace "¿Sigue sin abrirse?" → sección de problemas frecuentes (enlace a issues del repositorio).
6. Si en una versión posterior al MVP se firman los instaladores de algún SO, se elimina la sección de ese SO.

---

## Parte B — Dentro de la app

### Pantallas
B1 Bienvenida → B2 Instalando (3 fases) → B3 Todo listo → Biblioteca. B4 (error) y B5 (reanudar) son variantes de B2.

### Wireframes

**B1 — Bienvenida** (ventana 1280 × 800, sin barra superior, fondo `fondo-0`, columna central de 560 px)
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                          ◆ Shinobi Karaoke                               │
│                                                                          │
│                Hola. Vamos a preparar tu estudio de karaoke.             │
│                                                                          │
│   Antes de empezar, Shinobi Karaoke necesita descargar su motor de audio │
│   (lo que separa la voz de la música). Solo se hace una vez.             │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │ ⬇  Descarga:  unos 0,7 GB para tu equipo                         │   │
│   │ ⏱  Tiempo:    de 5 a 25 minutos, según tu conexión               │   │
│   │ 💾 Espacio:   necesitas al menos 3 GB libres  (tienes 120 GB ✓)  │   │
│   │ 🌐 Conexión:  necesaria solo durante esta preparación            │   │
│   └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Puedes seguir usando el ordenador mientras tanto. Si se corta,         │
│   continuará donde lo dejó.                                              │
│                                                                          │
│                      [ Preparar Shinobi Karaoke ]  (primario, grande)    │
│                                                                          │
│                 Shinobi Karaoke es software libre (GPL-3.0) · Licencias  │
└──────────────────────────────────────────────────────────────────────────┘
```
(Los iconos son de Lucide, no emojis; aquí se representan con símbolos. Ejemplo de un equipo solo CPU; las cifras dependen del **perfil previsto**, detectado sin instalar nada antes de mostrar B1: ver "Perfil previsto" en la tabla de componentes.)

**B2 — Instalando**
```
┌──────────────────────────────────────────────────────────────────────────┐
│                          ◆ Shinobi Karaoke                               │
│                                                                          │
│                     Preparando Shinobi Karaoke                           │
│                                                                          │
│   ✓  Preparando el motor de audio                                        │
│   ⟳  Instalando componentes                     312 MB de 780 MB         │
│      ████████████████░░░░░░░░░░░░░░░░░░  40 %                            │
│   ○  Descargando el modelo de separación                                 │
│                                                                          │
│   ─────────────────────────────────────────────────────────────────      │
│   Total  ███████████░░░░░░░░░░░░░░░░░░░░░  35 % · quedan unos 6 minutos  │
│                                                                          │
│   ⓘ Tu equipo tiene una tarjeta gráfica NVIDIA: separaremos las pistas   │
│     en modo Calidad.                        (visible desde el inicio)    │
│                                                                          │
│                    [ Pausar y salir ]  (secundario)                      │
│   ▸ Ver detalles                                                         │
└──────────────────────────────────────────────────────────────────────────┘
```
"▸ Ver detalles" despliega un área de solo lectura (fuente monoespaciada, 8 líneas, desplazable) con el registro técnico, y un botón "Copiar detalles".

**B3 — Todo listo**
```
┌──────────────────────────────────────────────────────────────────────────┐
│                               ✓                                          │
│                         Todo listo                                       │
│                                                                          │
│   Shinobi Karaoke ya puede separar la voz de tus canciones.              │
│   Modo de separación: Calidad (tarjeta gráfica NVIDIA).                  │
│   Una canción de 4 minutos tardará entre 1 y 2 minutos.                  │
│                                                                          │
│                        [ Empezar ]  (primario, grande)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

**B4 — Error** (sustituye la zona de progreso; las fases completadas siguen con ✓)
```
│   ✓  Preparando el motor de audio                                        │
│   ✕  Instalando componentes                                              │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │ ✕ Sin conexión a internet                                        │   │
│   │   Comprueba tu conexión y vuelve a intentarlo. No perderás lo    │   │
│   │   que ya se ha descargado.                                       │   │
│   └──────────────────────────────────────────────────────────────────┘   │
│                 [ Reintentar ] (primario)   [ Salir ] (fantasma)         │
│   ▸ Ver detalles                                                         │
```

**B5 — Reanudar** (al abrir la app con instalación incompleta): B1 con título "Continuamos donde lo dejamos", texto "Faltan unos 450 MB por descargar." y botón "Continuar la preparación".

### Componentes e interacciones
| Elemento | Comportamiento |
|----------|----------------|
| Perfil previsto (antes de B1) | El proceso principal detecta, sin Python, SO/arquitectura y GPU NVIDIA (`nvidia-smi`) → perfil previsto: **NVIDIA**, **Apple Silicon** o **solo CPU**. Con él se leen del manifiesto la descarga y el espacio requerido de ese perfil (valores provisionales: CPU ≈ 0,5–0,8 GB de descarga y 3 GB de espacio; Apple Silicon ≈ 1,3–1,7 GB y 4 GB; NVIDIA ≈ 3–4 GB y 8 GB). La descarga se muestra redondeada a una cifra: `pa.req.descarga` ("unos {n} GB"). Si la detección falla: `pa.req.descarga.generica` y 8 GB de espacio. La detección tarda milisegundos: B1 no tiene estado de carga propio. |
| Comprobación de espacio (B1) | Al mostrar B1 (y al pulsar "Comprobar de nuevo") se consulta el espacio libre del disco del directorio de datos (o de su carpeta existente más cercana). Requisito mostrado: el del perfil previsto. Si no alcanza: fila en `error` con `pa.req.espacio.insuficiente` ("Necesitas 8 GB libres y tienes 3,1 GB") y el botón primario cambia a "Comprobar de nuevo". |
| "Preparar Shinobi Karaoke" | Inicia la secuencia del gestor de runtime. Foco inicial de B1. |
| Lista de fases | 3 fases visibles (las 5 técnicas de arquitectura §6 se agrupan: 1–2 → "Preparando el motor de audio", 3 → "Instalando componentes", 4 → se integra al final de "Instalando componentes" como subestado "Comprobando tu equipo…", 5 → "Descargando el modelo de separación"). Cada fase: pendiente ○ / en curso ⟳ / completada ✓ / error ✕. |
| Progreso por fase | "X MB de Y MB" con Y tomado del manifiesto desde el inicio. Python y el modelo tienen progreso exacto; en "Instalando componentes" X es una aproximación (crece a saltos): la barra **nunca retrocede** y nunca muestra 100 % hasta que la fase termina (máximo 99 %). "Calculando tamaño…" (indeterminado) solo si faltara el dato del manifiesto. |
| Progreso total y ETA | Barra total ponderada por bytes. ETA: no se muestra los primeros 10 s ("Calculando tiempo…"); después se redondea: "< 1 minuto", "unos N minutos" (N entero), "más de 30 minutos". |
| Mensaje de modo (0003) | Informativo, no interactivo. Con perfil previsto, aparece en B2 **desde el inicio** (`pa.modo.*`). Al final de "Instalando componentes" ("Comprobando tu equipo…") el diagnóstico con PyTorch lo confirma; si **rebaja** Calidad → Rápido, el mensaje se sustituye por `pa.modo.rebajado.memoria` o `pa.modo.rebajado.generico` (resaltado `aviso` durante 4 s y anunciado a lectores de pantalla), y el total de "Descargando el modelo de separación" y de la barra total se recalcula (más pequeño). Nunca sube de Rápido a Calidad. Si no hubo perfil previsto, el mensaje aparece al terminar el diagnóstico. |
| "Pausar y salir" | Diálogo: "¿Pausar la preparación? Se guardará lo descargado y continuará la próxima vez que abras Shinobi Karaoke." [Seguir preparando] [Pausar y salir]. Cierra la app. |
| Cerrar la ventana (X) | Mismo diálogo que "Pausar y salir". |
| "Reintentar" | Relanza desde la fase fallida (las fases son idempotentes). |
| "Ver detalles" / "Copiar detalles" | Copia al portapapeles versión de la app, SO, fase, código de error y últimas 50 líneas del registro. Toast "Detalles copiados". |
| "Empezar" | Abre la Biblioteca (estado vacío). Foco inicial de B3. |
| Licencias (B1) | Abre Ajustes → Acerca de (en un diálogo, ya que aún no hay barra superior). |
| Teclado | Tab recorre los botones; Intro activa; Esc en B2 = "Pausar y salir". |
| Lectores de pantalla | Anunciar el cambio de fase ("Instalando componentes") y cada 25 % del total, no cada evento. |

### Estados
| Estado | Presentación |
|--------|--------------|
| Vacío | No aplica (B1 es el estado inicial). |
| Cargando / procesando | B2. Fase con progreso indeterminado cuando el tamaño no se conoce. |
| Error | B4, con textos por código (tabla de microcopy). Las fases completadas no se repiten. |
| Éxito | B3. |
| Interrumpido / reanudación | B5 al reabrir; también si se pierde la conexión y se recupera, B4 → Reintentar. |
| Actualización silenciosa de yt-dlp (arranques posteriores) | Invisible. Solo si falla dos veces seguidas una descarga de YouTube se ofrece (spec 03). |
| Instalación dañada en un arranque posterior (falta el venv o el modelo) | Se vuelve a B5 con título "Hay que reparar el motor de audio" y botón "Reparar". |

### Microcopy
| Clave | Texto |
|-------|-------|
| `pa.bienvenida.titulo` | Hola. Vamos a preparar tu estudio de karaoke. |
| `pa.bienvenida.cuerpo` | Antes de empezar, Shinobi Karaoke necesita descargar su motor de audio (lo que separa la voz de la música). Solo se hace una vez. |
| `pa.req.descarga` | Descarga: unos {n} GB para tu equipo |
| `pa.req.descarga.generica` | Descarga: entre 0,5 y 4 GB según tu equipo |
| `pa.req.tiempo` | Tiempo: de 5 a 25 minutos, según tu conexión |
| `pa.req.espacio` | Espacio: necesitas al menos {n} GB libres (tienes {m} GB) |
| `pa.req.espacio.insuficiente` | Necesitas {n} GB libres y tienes {m} GB. Libera espacio y pulsa "Comprobar de nuevo". |
| `pa.boton.comprobar` | Comprobar de nuevo |
| `pa.req.conexion` | Conexión: necesaria solo durante esta preparación |
| `pa.bienvenida.nota` | Puedes seguir usando el ordenador mientras tanto. Si se corta, continuará donde lo dejó. |
| `pa.boton.preparar` | Preparar Shinobi Karaoke |
| `pa.instalando.titulo` | Preparando Shinobi Karaoke |
| `pa.fase.motor` | Preparando el motor de audio |
| `pa.fase.componentes` | Instalando componentes |
| `pa.fase.diagnostico` | Comprobando tu equipo… |
| `pa.fase.modelo` | Descargando el modelo de separación |
| `pa.modo.calidad.nvidia` | Tu equipo tiene una tarjeta gráfica NVIDIA: separaremos las pistas en modo Calidad. |
| `pa.modo.calidad.apple` | Tu Mac tiene un chip Apple: separaremos las pistas en modo Calidad. |
| `pa.modo.rapido` | Tu equipo no tiene una tarjeta gráfica compatible: separaremos las pistas en modo Rápido. Funciona bien, aunque puede quedar algo de voz de fondo. |
| `pa.modo.rebajado.memoria` | Tu tarjeta gráfica no tiene memoria suficiente para el modo Calidad: separaremos las pistas en modo Rápido. Funciona bien, aunque puede quedar algo de voz de fondo. |
| `pa.modo.rebajado.generico` | No hemos podido usar tu tarjeta gráfica: separaremos las pistas en modo Rápido. Funciona bien, aunque puede quedar algo de voz de fondo. |
| `pa.boton.pausar` | Pausar y salir |
| `pa.listo.titulo` | Todo listo |
| `pa.listo.cuerpo` | Shinobi Karaoke ya puede separar la voz de tus canciones. |
| `pa.listo.tiempo` | Una canción de 4 minutos tardará entre {a} y {b} minutos. |
| `pa.boton.empezar` | Empezar |
| `pa.reanudar.titulo` | Continuamos donde lo dejamos |
| `pa.boton.continuar` | Continuar la preparación |
| `pa.reparar.titulo` | Hay que reparar el motor de audio |
| `pa.reparar.cuerpo` | Falta una parte de lo que se descargó la primera vez. Vamos a descargarla de nuevo. |
| `pa.error.SIN_CONEXION` | **Sin conexión a internet.** Comprueba tu conexión y vuelve a intentarlo. No perderás lo que ya se ha descargado. |
| `pa.error.SIN_ESPACIO` | **No queda espacio en el disco.** Necesitas {n} GB libres. Libera espacio (por ejemplo, vaciando la papelera) y vuelve a intentarlo. |
| `pa.error.servidor` | **Uno de los servidores de descarga no responde.** Suele ser temporal. Vuelve a intentarlo en unos minutos. |
| `pa.error.verificacion` | **El archivo descargado no es correcto.** Lo descargaremos de nuevo. |
| `pa.error.generico` | **Algo salió mal durante la preparación.** Vuelve a intentarlo. Si se repite, copia los detalles y abre una incidencia en la web del proyecto. |
| `pa.boton.reintentar` | Reintentar |
| `pa.boton.salir` | Salir |
| `pa.detalles` | Ver detalles · Copiar detalles |
| `pa.dialogo.pausar` | ¿Pausar la preparación? Se guardará lo descargado y continuará la próxima vez que abras Shinobi Karaoke. — [Seguir preparando] [Pausar y salir] |
| `pa.eta` | quedan unos {n} minutos · menos de 1 minuto · Calculando tiempo… |

## Criterios de aceptación
1. Si `config.instalacion.estado` no es `"completa"`, la app abre B1 (o B5 si había progreso previo) y no permite acceder a ninguna otra vista hasta completar la instalación.
2. B1 muestra la descarga y el espacio requeridos **del perfil previsto** (leídos del manifiesto; si la detección previa falla, el rango genérico de descarga y 8 GB), el tiempo y el espacio libre real del disco del directorio de datos; si el espacio libre es menor que el requerido, se muestra `pa.req.espacio.insuficiente`, el botón principal es "Comprobar de nuevo" y la instalación no empieza.
3. B2 muestra exactamente tres fases con sus estados (○ ⟳ ✓ ✕) y una barra total; la fase en curso muestra "X MB de Y MB" con Y del manifiesto; ninguna barra retrocede y "Instalando componentes" no pasa de 99 % hasta terminar.
4. El tiempo restante no aparece durante los primeros 10 s; después se muestra redondeado según la tabla de microcopy y se actualiza como máximo una vez por segundo.
5. Con perfil previsto, B2 muestra desde el inicio el mensaje de modo correspondiente (Calidad NVIDIA / Calidad Apple / Rápido); el modo final (tras "Comprobando tu equipo…") se repite en B3 con el tiempo estimado para 4 minutos.
5b. Si la confirmación con PyTorch rebaja Calidad → Rápido, el mensaje cambia a `pa.modo.rebajado.memoria` (VRAM < 4 GB) o `pa.modo.rebajado.generico` (otra causa), se anuncia a lectores de pantalla y el tamaño de la fase del modelo y la barra total se recalculan sin retroceder el porcentaje ya mostrado.
6. Cerrar la ventana o pulsar "Pausar y salir" muestra el diálogo de confirmación; al confirmar se cierra la app y, al reabrir, se muestra B5 con lo que falta por descargar.
7. Ante `SIN_CONEXION`, `SIN_ESPACIO`, fallo de servidor o verificación SHA-256 fallida se muestra B4 con el texto de su clave; "Reintentar" continúa desde la fase fallida sin repetir las completadas.
8. "Copiar detalles" copia al portapapeles versión, SO, fase, código y las últimas 50 líneas del registro, y muestra el toast "Detalles copiados".
9. Toda la secuencia se puede completar solo con teclado (Tab + Intro) y el foco inicial está en el botón primario de cada pantalla.
10. Los lectores de pantalla reciben anuncios en cada cambio de fase, cada 25 % del total, en error y al terminar (no en cada evento de progreso).
11. "Empezar" abre la Biblioteca en estado vacío (spec 02).
12. Si en un arranque posterior falta el entorno o el modelo, se muestra la variante "Hay que reparar el motor de audio" en lugar de la Biblioteca.
13. La guía de instalación (Parte A) está publicada en la página de descarga/README con los textos de los botones de sistema indicados y una captura por SO antes de la primera versión pública.
