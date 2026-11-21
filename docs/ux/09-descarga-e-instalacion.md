# 09 — Descarga e instalación (fuera de la app)

- Paso del pipeline: 0 (distribución)
- ADRs: [0001](../adr/0001-plataforma-y-stack.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md) (ubicación de los datos), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md)
- Fase 7: [0138](../tareas/0138-readme-e-instalar-sin-version-publicada.md) prepara E0, [0137](../tareas/0137-workflow-probar-los-instaladores.md) cubre las comprobaciones automatizadas y [0139](../tareas/0139-prueba-manual-de-instalacion-y-capturas.md) cubre la prueba manual. La primera publicación (0142) queda pendiente. Esta spec sustituye al detalle de la Parte A de [01-primer-arranque.md](01-primer-arranque.md) y desarrolla sus criterios 13 y 17.
- Decisiones que respeta: sin firma ([0001](../preguntas/0001-firma-de-codigo-instaladores.md)); macOS 14 o posterior solo con chip Apple ([0015](../preguntas/0015-macos-intel-sin-pytorch-y-macos-minimo.md), [0017](../preguntas/0017-textos-de-requisitos-macos-14-y-mac-intel.md)); Mac Intel no compatible ([0016](../preguntas/0016-mac-intel-fuera-del-mvp.md)); sin web propia, README e `INSTALAR.md` ([0017](../preguntas/0017-textos-de-requisitos-macos-14-y-mac-intel.md), Seguimiento); modelo Rápido solo con consentimiento ([0019](../preguntas/0019-calidad-por-defecto-y-rapido-con-consentimiento.md)).
- Preguntas respondidas por el arquitecto e incorporadas: [0040](../preguntas/0040-nombres-de-instaladores-y-enlaces-de-descarga.md), [0041](../preguntas/0041-gatekeeper-con-firma-ad-hoc.md), [0042](../preguntas/0042-appimage-fuse-y-sandbox-en-linux.md), [0043](../preguntas/0043-instalador-de-windows-y-datos-al-desinstalar.md) (ADR 0012). Lo que no se ha podido ejecutar sigue en la prueba manual (§5).
- Publicación por *Release* ([ADR 0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md)): respondida [0141](../preguntas/0141-readme-y-notas-con-solo-versiones-preliminares.md). Añade el estado **E½ — Solo versiones preliminares** (§1.1b, aviso de §2), el aviso de versión preliminar de las notas (§3) y el límite del AppImage para la opción provisional A de 0045 (§2, Linux). Que las alfas sean públicas lo decide el usuario en [0140](../preguntas/0140-publicar-las-alfas-como-pre-release-publica.md).
- **Fase 10 de 0.2.0, «Detalles de release»** (2026-11-21; [plan](../versiones/0.2.0/plan-2.md#fase-10--detalles-de-release), [propuesta 017](../propuestas/017-estructura-de-releases.md); referentes: RPCS3 y DroidDeck). Cambia: **E½ enlaza a la etiqueta concreta** con descarga directa por sistema (decisión del usuario, que sustituye la opción A de 0141: §1.1b); **botones de descarga** e instalación en pasos numerados en el README (§1.2, §1.4); **notas en dos partes** con «Qué cambió», comparación y ejecución de CI (§3); **canal de compilaciones de desarrollo** en `shinobi-karaoke-builds` (§3b) y su mención en el README (§1.5); **aviso de Chrome** al descargar (§2, P18). El número de compilación en la app está en [08 · Fase 10](08-ajustes-y-acerca.md#fase-10-de-020--número-de-compilación). Pregunta abierta para el arquitecto: [0142](../preguntas/0142-numero-de-compilacion-canal-de-desarrollo-y-notas.md) (provisional tomado). Fuera de alcance: firma de código y autoactualización.
- Preguntas abiertas para el usuario: [0035](../preguntas/0035-repositorio-publico-y-primera-publicacion.md) (repositorio y primera versión), [0044](../preguntas/0044-control-inteligente-de-aplicaciones-en-windows.md) (Control inteligente de aplicaciones) y [0045](../preguntas/0045-appimage-sin-sandbox-en-ubuntu.md) (AppImage sin sandbox). [0036](../preguntas/0036-numero-de-version-y-politica-de-versiones.md) y [0037](../preguntas/0037-autoactualizacion-de-la-app.md) no cambian ningún texto de hoy.

## Objetivo

Que una persona no técnica sepa qué archivo descargar, si su equipo es compatible y cómo superar el aviso del sistema, sin engañarla sobre lo que significa ese aviso. Tarea principal: pasar de "quiero Shinobi Karaoke" a "la app abre su pantalla de bienvenida" (B1 de la spec 01).

## Superficies y estados

No hay web propia. Todos los textos son Markdown de GitHub. **Markdown no ejecuta código: no se detecta el SO del visitante** (cambia la Parte A original, que pedía mostrar primero su botón). Las "descargas" son **botones**: imágenes SVG fijas del repositorio, enlazadas al instalador, con el texto del enlace como texto alternativo (§1.4, fase 10). En E0 no hay botones.

| Superficie | Archivo | Contenido |
|------------|---------|-----------|
| Sección "Descargar" | `README.md`, justo antes de "Requisitos del equipo" | §1 |
| Botones de descarga | `docs/imagenes/descarga/*.svg` | §1.4 |
| Mención del canal de desarrollo | `README.md`, sección "Desarrollo" | §1.5 |
| Guía "Instalar Shinobi Karaoke" | `INSTALAR.md`, en la raíz | §2 |
| Notas de cada *Release* | GitHub, repositorio principal | §3 |
| README y *Releases* del canal de desarrollo | Repositorio `shinobi-karaoke-builds` | §3b |

| Estado | Cuándo | Qué se muestra |
|--------|--------|----------------|
| **E0 — Sin versión** | No hay ninguna *Release* publicada (**es el estado de la Fase 7**) | §1.1 en el README; aviso E0 al principio de `INSTALAR.md`. **Ningún enlace de descarga** |
| **E½ — Solo versiones preliminares** | Hay al menos una *Release* **pública** marcada como *pre-release* (`vX.Y.Z-alpha.N`, `-beta.N`, `-rc.N`) y **ninguna estable**. Una *Release* en borrador no cuenta: mientras solo exista en borrador (0140, opción B) se sigue en E0 | §1.1b en el README: la última versión preliminar, con **un botón de descarga directa por instalador que apunta a su etiqueta concreta** (`/releases/download/v<versión>/<archivo>`), pasos numerados y enlace a sus novedades; aviso E½ al principio de `INSTALAR.md`. Notas con el aviso de §3. **Cambia en cada alfa**: la versión de los enlaces se actualiza con la de la publicación (fase 10; quién lo hace: 0142, provisional `version:subir`) |
| **E1 — Con versión** | Existe al menos una *Release* **estable** (sin sufijo) pública con los instaladores aprobados para publicar | §1.2 en el README, sin avisos E0 ni E½ y con los botones de los instaladores publicados (`/releases/latest/download/…`, sin versión). Las preliminares posteriores (p. ej. `v0.3.0-alpha.1`) no cambian el README: `/releases/latest` sigue llevando a la última estable, y las preliminares se ven en "Ver todas las versiones" |
| **Guía provisional** | Queda algún ⟦P⟧ o ⟦R⟧ de este documento sin resolver | Aviso "guía provisional" al principio de `INSTALAR.md` |
| Vacío / cargando | No aplican: son textos estáticos | — |
| Error | No aplica a la página; los fallos del usuario se cubren en "¿Sigue sin abrirse?" | — |

### Convenciones de este documento

Los bloques de `markdown` son el **texto final**. Se copian tal cual, salvo:

- **`{ENLACE_…}`**: valores por sustituir al pasar a E1 (ver la tabla de §4).
- **`{VERSION}`** (solo §1.1b): la versión preliminar publicada más reciente, sin «v» (`0.2.0-alpha.2`). Aparece en el texto, en los 4 enlaces y en el de novedades, y se actualiza en cada alfa (§4).
- **`{…}` de §3 y §3b** (`{NUMERO}`, `{HASH}`, `{RUN_URL}`…): los rellena el workflow al publicar; tabla en §4.
- **⟦P1⟧…**: texto sin confirmar; se comprueba en la prueba manual (§5). **⟦R0035⟧, ⟦R0044⟧, ⟦R0045⟧**: dependen de la respuesta del usuario a esa pregunta (§6).
- **Los marcadores ⟦…⟧ no se copian** a los archivos públicos. Mientras sigan sin resolver, se publica el texto tal como está aquí, junto con el aviso "guía provisional". Todos los textos marcados son seguros como provisionales: ninguno recomienda desactivar una protección.
- Las líneas con `<!-- E0 -->` o `<!-- PROVISIONAL -->` explican a qué estado pertenece el bloque y tampoco se copian.

## §1. Sección "Descargar" del README

### §1.1 Estado E0 (texto para la Fase 7)

```markdown
## Descargar

**Todavía no hay ninguna versión publicada.** Shinobi Karaoke sigue en desarrollo y aún no tiene instaladores. Cuando publiquemos la primera versión, los enlaces de descarga aparecerán aquí.

**Qué necesitarás:** Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · entre 4 y 10 GB libres según tu equipo (más unos 100 MB por canción) · conexión a internet la primera vez

Los Mac con procesador Intel no son compatibles por ahora. Tampoco los equipos con procesador ARM que usan Windows o Linux.

Si quieres saber cómo será la instalación, lee la [guía de instalación](INSTALAR.md).
```

### §1.1b Estado E½ (solo versiones preliminares)

**Revisado en la fase 10** (decisión del usuario, 2026-11-21): mientras solo haya alfas, la descarga es **directa** y apunta a la **etiqueta concreta**. Sustituye a la opción A de 0141 (un solo enlace a `/releases`, sin versión), que obligaba a buscar el archivo entre los *Assets* de GitHub, en inglés. GitHub no considera "latest" a una *pre-release*, así que `/releases/latest/download/…` daría 404 (ADR 0020 §2); por eso los enlaces llevan la versión.

Riesgo que se asume y cómo se cubre: un enlace olvidado llevaría a una alfa vieja sin que nadie lo note. Por eso la versión aparece **escrita** en el texto (el visitante ve qué descarga), los 5 enlaces se actualizan **a la vez y de forma automática** con la versión de la publicación, y una comprobación falla si no coinciden (0142, provisional: `version:subir` y `version:comprobar`). El commit etiquetado enlaza así a su propia etiqueta.

```markdown
## Descargar

**Última versión: {VERSION}, versión preliminar.** Es una versión de prueba: ya se puede instalar, pero puede tener errores y algunas cosas cambiarán antes de la primera versión estable. [Novedades de {VERSION}](https://github.com/Gomonsoft/shinobi-karaoke/releases/tag/v{VERSION})

**Requisitos:** Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · entre 4 y 10 GB libres según tu equipo (más unos 100 MB por canción) · conexión a internet la primera vez

Los Mac con procesador Intel no son compatibles por ahora. Tampoco los equipos con procesador ARM que usan Windows o Linux.

### Windows

[![Descargar para Windows](docs/imagenes/descarga/descargar-windows.svg)](https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v{VERSION}/Shinobi-Karaoke-Windows-x64.exe)

Para Windows 10 u 11 de 64 bits.

### Mac

[![Descargar para Mac con chip Apple](docs/imagenes/descarga/descargar-mac.svg)](https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v{VERSION}/Shinobi-Karaoke-Mac-chip-Apple.dmg)

Para Mac con chip Apple (M1 o posterior) y macOS 14 Sonoma o posterior. Los Mac con procesador Intel no son compatibles por ahora.

**¿Qué Mac tengo?** Abre el menú Apple (la manzana de la esquina de la pantalla) → **Acerca de este Mac** (o **Acerca de esta Mac**). Si pone **Chip** (Apple M1, M2…), es compatible. Si pone **Procesador** (Intel…), todavía no.

### Linux

Para Linux de 64 bits (x64). Elige uno de los dos:

[![Descargar .deb para Ubuntu, Debian y Linux Mint](docs/imagenes/descarga/descargar-deb.svg)](https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v{VERSION}/shinobi-karaoke-linux-x64.deb)

[![Descargar AppImage para otras distribuciones de Linux](docs/imagenes/descarga/descargar-appimage.svg)](https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v{VERSION}/Shinobi-Karaoke-Linux-x64.AppImage)

El `.deb` se instala como cualquier otro programa y te pedirá tu contraseña. El AppImage no se instala: es un solo archivo que se abre directamente. ⟦R0045⟧

### Cómo instalarla

1. Pulsa el botón de tu sistema.
2. Si tu navegador avisa de que el archivo es **poco común** o **sospechoso**, elige conservarlo: pasa porque la app es nueva y no está firmada. Si dice que es **peligroso** o que tiene un **virus**, no lo abras y [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues). ⟦P4⟧ ⟦P18⟧
3. Abre el archivo descargado. En Windows y Mac, la primera vez tu sistema te avisará: sigue los pasos de la guía para [Windows](INSTALAR.md#windows), [Mac](INSTALAR.md#mac-con-chip-apple) o [Linux](INSTALAR.md#linux).
4. Al abrir Shinobi Karaoke por primera vez, pulsa **Preparar Shinobi Karaoke**. Descarga el motor de audio una sola vez (entre 1 y 6 GB, según tu equipo).

Si ya tienes canciones, haz una copia antes de instalar otra versión: en la app, entra en **Ajustes → Abrir carpeta de datos** y copia la carpeta **biblioteca** a otro sitio.

> **Descarga Shinobi Karaoke solo desde aquí o desde su [página de versiones](https://github.com/Gomonsoft/shinobi-karaoke/releases).** Es gratis: si te lo cobran o te lo envían por otro camino, no lo abras.
```

- Orden fijo Windows, Mac, Linux. La línea y el botón del AppImage respetan 0045 (si deja de publicarse, se quitan).
- Ya no se citan **Assets** ni **Source code**: el visitante no pasa por la página de la *Release* para descargar. Siguen en la cabecera de las notas (§3).
- La versión de `{VERSION}` es siempre la de la *Release* preliminar **pública** más reciente. Paso de E0 a E½: con la primera *Release* preliminar pública (`v0.2.0-alpha.2`, plan fase 10), comprobado sin sesión que los 4 enlaces descargan (con 0140 = B, cuando el usuario la publique a mano). Paso de E½ a E1: con la primera versión estable (tarea 0142).
- No hay enlace a las compilaciones de desarrollo en esta sección (§1.5).

### §1.2 Estado E1 (con una versión publicada)

Orden fijo: Windows, Mac, Linux. Los requisitos y "¿Qué Mac tengo?" van en texto normal, nunca dentro de `<details>`. **Revisado en la fase 10**: botones de §1.4 en lugar de enlaces en negrita, y "Después de descargar" pasa a los pasos numerados de §1.1b. Los enlaces no llevan versión (0040), así que **no se toca en cada versión** y tampoco escribe el número: diría una versión vieja en cuanto saliera la siguiente.

```markdown
## Descargar

**Requisitos:** Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · entre 4 y 10 GB libres según tu equipo (más unos 100 MB por canción) · conexión a internet la primera vez

Los Mac con procesador Intel no son compatibles por ahora. Tampoco los equipos con procesador ARM que usan Windows o Linux.

### Windows

[![Descargar para Windows](docs/imagenes/descarga/descargar-windows.svg)]({ENLACE_WINDOWS})

Para Windows 10 u 11 de 64 bits.

### Mac

[![Descargar para Mac con chip Apple](docs/imagenes/descarga/descargar-mac.svg)]({ENLACE_MAC})

Para Mac con chip Apple (M1 o posterior) y macOS 14 Sonoma o posterior. Los Mac con procesador Intel no son compatibles por ahora.

**¿Qué Mac tengo?** Abre el menú Apple (la manzana de la esquina de la pantalla) → **Acerca de este Mac** (o **Acerca de esta Mac**). Si pone **Chip** (Apple M1, M2…), es compatible. Si pone **Procesador** (Intel…), todavía no.

### Linux

Para Linux de 64 bits (x64). Probado en Ubuntu 24.04. ⟦P16⟧ Elige uno de los dos:

[![Descargar .deb para Ubuntu, Debian y Linux Mint](docs/imagenes/descarga/descargar-deb.svg)]({ENLACE_DEB})

[![Descargar AppImage para otras distribuciones de Linux](docs/imagenes/descarga/descargar-appimage.svg)]({ENLACE_APPIMAGE})

El `.deb` se instala como cualquier otro programa y te pedirá tu contraseña. El AppImage no se instala: es un solo archivo que se abre directamente; úsalo en otras distribuciones o si no puedes instalar programas. ⟦R0045⟧

### Cómo instalarla

(Los cuatro pasos de §1.1b, idénticos.)

> **Descarga Shinobi Karaoke solo desde aquí o desde su [página de versiones](https://github.com/Gomonsoft/shinobi-karaoke/releases).** Es gratis: si te lo cobran o te lo envían por otro camino, no lo abras.

[Novedades de la última versión](https://github.com/Gomonsoft/shinobi-karaoke/releases/latest) · [Ver todas las versiones](https://github.com/Gomonsoft/shinobi-karaoke/releases)
```

En E1 la frase de copia de seguridad de §1.1b se mantiene entre los pasos y el aviso: también una versión estable puede cambiar el formato de los datos.

### §1.3 Ajuste en la tabla "Requisitos del equipo" del README

Hoy dice "Solo en el primer arranque (descarga ~1–2 GB)", lo que contradice a B1 en equipos con NVIDIA. Debe decir: "Solo en el primer arranque (descarga entre 1 y 6 GB según tu equipo) y para YouTube/letras". El resto de la tabla no cambia.

### §1.4 Botones de descarga (fase 10)

Como la insignia de descarga directa de DroidDeck, pero **sin servicio externo**: cuatro SVG fijos del repositorio, sin scripts, sin versión y sin detección del SO (criterio 5). Si la imagen no carga, GitHub muestra el texto alternativo, que es el mismo texto del enlace.

| Archivo | Texto principal | Segunda línea | Texto alternativo (exacto) |
|---|---|---|---|
| `docs/imagenes/descarga/descargar-windows.svg` | Descargar para Windows | Windows 10 u 11 · 64 bits | Descargar para Windows |
| `docs/imagenes/descarga/descargar-mac.svg` | Descargar para Mac | Con chip Apple · macOS 14 o posterior | Descargar para Mac con chip Apple |
| `docs/imagenes/descarga/descargar-deb.svg` | Descargar .deb | Ubuntu, Debian, Linux Mint | Descargar .deb para Ubuntu, Debian y Linux Mint |
| `docs/imagenes/descarga/descargar-appimage.svg` | Descargar AppImage | Otras distribuciones de Linux | Descargar AppImage para otras distribuciones de Linux |

Diseño (igual en los cuatro, sistema visual):
- Lienzo `viewBox="0 0 360 64"`, `width="360" height="64"`. Rectángulo redondeado con radio 8, relleno `acento` `#C8303B`, sin borde. Contraste con el fondo claro de GitHub (`#FFFFFF`) 5,3:1 y con el oscuro (`#0D1117`) ≈ 3,5:1: el botón se distingue en los dos temas (≥ 3:1).
- Icono de descarga (flecha hacia abajo sobre una línea) a 20 px del borde izquierdo, 24 × 24, trazo `#FFFFFF` de 2,5 px. Decorativo.
- Texto en `#FFFFFF` (5,33:1 sobre `#C8303B`), alineado a la izquierda a 56 px: principal a 19 px, `font-weight="600"`, línea base en y = 28; segunda línea a 14 px, peso normal, línea base en y = 48. `font-family="Segoe UI, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif"`: GitHub sirve los SVG como imagen y no carga fuentes web, así que se usa la del sistema del visitante. El texto más largo («Con chip Apple · macOS 14 o posterior») debe caber con al menos 16 px de margen derecho con Arial y con DejaVu Sans; si no, se acorta el lienzo de texto, nunca el tamaño de letra por debajo de 14 px.
- Dentro del SVG: `role="img"` y `<title>` con el texto alternativo de la tabla. Sin enlaces, sin `<script>`, sin `<foreignObject>` ni recursos externos.
- Sin estado *hover* ni foco propios: GitHub dibuja el foco del enlace alrededor de la imagen.

### §1.5 Canal de desarrollo en el README (fase 10)

Quien solo quiere la app no debe encontrarse con las compilaciones de desarrollo al descargar. Por eso **no aparecen en "Descargar"** (ni en E½ ni en E1), sino al principio de la sección **"Desarrollo"** del README, que ya es la de quien colabora:

```markdown
### Compilaciones de desarrollo

Cada noche en que hay cambios en la rama `develop` se publica una compilación de prueba en [shinobi-karaoke-builds](https://github.com/Gomonsoft/shinobi-karaoke-builds/releases). **No son versiones publicadas**: sirven para probar arreglos antes de que salgan y pueden fallar. Si solo quieres usar Shinobi Karaoke, descárgalo desde [Descargar](#descargar).
```

## §2. Guía `INSTALAR.md`

### Avisos de estado (solo mientras apliquen; van antes de la introducción)

```markdown
<!-- E0: se quita al publicar la primera versión -->
> **Todavía no hay ninguna versión publicada**, así que aún no hay nada que descargar. Esta guía explica cómo será la instalación.

<!-- E½: sustituye al aviso E0 con la primera versión preliminar pública; se quita con la primera versión estable -->
> **Por ahora solo hay versiones preliminares.** Las encontrarás en la [página de versiones](https://github.com/Gomonsoft/shinobi-karaoke/releases), con la etiqueta **Pre-release**. Son versiones de prueba y pueden tener errores. Si ya tienes canciones, haz una copia antes de instalar otra versión: en la app, entra en **Ajustes → Abrir carpeta de datos** y copia la carpeta **biblioteca** a otro sitio. ⟦P17⟧

<!-- PROVISIONAL: se quita cuando no quede ningún marcador por resolver -->
> **Guía provisional.** Todavía no la hemos comprobado con los instaladores definitivos: algún paso o el nombre de algún botón puede ser distinto en tu equipo.
```

### Texto de la guía

```markdown
# Instalar Shinobi Karaoke

Elige tu sistema: [Windows](#windows) · [Mac](#mac-con-chip-apple) · [Linux](#linux)

También aquí: [Por qué aparece un aviso](#por-qué-mi-equipo-me-avisa) · [Si el navegador bloquea la descarga](#si-el-navegador-bloquea-la-descarga) · [Después de instalar](#después-de-instalar) · [¿Sigue sin abrirse?](#sigue-sin-abrirse) · [Desinstalar](#desinstalar)

**Requisitos:** Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · entre 4 y 10 GB libres según tu equipo (más unos 100 MB por canción) · conexión a internet la primera vez

Los Mac con procesador Intel no son compatibles por ahora. Tampoco los equipos con procesador ARM que usan Windows o Linux.

## ¿Por qué mi equipo me avisa?

Shinobi Karaoke es gratuito y de código abierto. Windows y macOS reconocen a los desarrolladores mediante una firma digital que normalmente se paga, y todavía no la tenemos. Por eso tu sistema te mostrará un aviso la primera vez. Es normal. Te explicamos cómo continuar.

El aviso significa que tu sistema **no puede comprobar quién ha creado el programa**; no significa que haya encontrado un virus. Aun así, continúa solo si lo has descargado desde la [página oficial del proyecto](https://github.com/Gomonsoft/shinobi-karaoke/releases). Si lo has recibido por otro camino, no lo abras.

Si tu sistema dice que ha **detectado software malicioso**, o mueve la app a la papelera él mismo, no sigas adelante y [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues).

Linux no pide esta firma. Si en el futuro firmamos los instaladores de algún sistema, quitaremos de aquí sus pasos.

## Si el navegador bloquea la descarga

Antes incluso de abrir el archivo, el navegador puede detener la descarga porque pocas personas han descargado todavía este instalador y no está firmado. **Mira qué palabra usa:**

- **«Poco común», «no se descarga con frecuencia» o «sospechoso»:** el navegador no conoce el archivo, nada más. Si lo has descargado desde la [página oficial del proyecto](https://github.com/Gomonsoft/shinobi-karaoke/releases), puedes conservarlo.
- **«Peligroso», «virus» o «malware»:** el navegador ha encontrado algo malo en el archivo. **No lo conserves** y [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues).

**En Chrome:** abre el panel de descargas (el icono de la flecha hacia abajo, arriba a la derecha; o pulsa Ctrl + J, en Mac Cmd + Mayús + J). Junto al archivo bloqueado, pulsa el botón para descargarlo igualmente, por ejemplo **Descargar archivo sospechoso** o **Conservar**. Si Chrome te pide confirmarlo, vuelve a pulsarlo. ⟦P18⟧

**En Edge:** en el panel de descargas, sitúa el puntero sobre el archivo y pulsa **…** → **Conservar**. Si aparece **Mostrar más**, púlsalo y elige **Conservar de todos modos**. ⟦P4⟧

Conservar el archivo no lo abre ni lo instala: después sigue los pasos de tu sistema.

## Windows

1. Abre el archivo que has descargado (`Shinobi-Karaoke-Windows-x64.exe`). Si tu navegador no te deja descargarlo, mira [Si el navegador bloquea la descarga](#si-el-navegador-bloquea-la-descarga). ⟦P4⟧ ⟦P18⟧
2. Si aparece la ventana **Windows protegió su PC**, pulsa **Más información**. ⟦P1⟧ ⟦P2⟧
3. Pulsa **Ejecutar de todas formas**. ⟦P3⟧
4. El instalador no pregunta nada: se instala solo, sin permisos de administrador, y abre Shinobi Karaoke al terminar. Después la encontrarás en el menú Inicio y en el escritorio. ⟦P13⟧

*Captura pendiente: la añadiremos antes de la primera versión pública. Estos pasos se pueden seguir sin ella.*

¿No aparece **Ejecutar de todas formas**? Mira [¿Sigue sin abrirse?](#sigue-sin-abrirse).

## Mac con chip Apple

Para Mac con chip Apple (M1 o posterior) y macOS 14 Sonoma o posterior. Los Mac con procesador Intel no son compatibles por ahora.

**¿Qué Mac tengo?** Abre el menú Apple (la manzana de la esquina de la pantalla) → **Acerca de este Mac** (o **Acerca de esta Mac**). Si pone **Chip** (Apple M1, M2…), es compatible. Si pone **Procesador** (Intel…), todavía no.

Si tu Mac tiene chip Apple y una versión anterior a macOS 14, [actualízala gratis](https://support.apple.com/es-es/108382) antes de empezar.

Según el idioma de tu Mac, algunos nombres cambian. Aquí aparecen los dos: el de España y, entre paréntesis, el de Latinoamérica.

1. Abre el archivo `.dmg` que has descargado (`Shinobi-Karaoke-Mac-chip-Apple.dmg`) y arrastra **Shinobi Karaoke** a **Aplicaciones**.
2. Abre **Shinobi Karaoke** desde **Aplicaciones**. Si macOS dice que no puede abrirla o comprobarla, pulsa **Aceptar** (o **Listo**). No pulses **Mover a la Papelera**. ⟦P5⟧
3. Ve al menú Apple → **Ajustes del Sistema** (o **Configuración del Sistema**) → **Privacidad y seguridad**. Baja hasta la sección **Seguridad**, busca el mensaje sobre Shinobi Karaoke y pulsa **Abrir igualmente** (o **Abrir de todos modos**). Este botón solo aparece durante una hora, más o menos, después de intentar abrir la app: si no lo ves, repite el paso 2. ⟦P6⟧
4. macOS te preguntará otra vez. Pulsa **Abrir igualmente** (o **Abrir de todos modos**), o **Abrir** si es lo que te ofrece. Si te lo pide, escribe tu contraseña de inicio de sesión y pulsa **Aceptar** (o **OK**). ⟦P6⟧ ⟦P7⟧

**Alternativa solo en macOS 14 Sonoma:** en el Finder, clic derecho (o Control + clic) sobre la app → **Abrir** → **Abrir**. En macOS 15 o posterior no existe; usa el paso 3. ⟦P8⟧

Solo hace falta la primera vez.

*Captura pendiente: la añadiremos antes de la primera versión pública. Estos pasos se pueden seguir sin ella.*

## Linux

No hace falta saltar ningún aviso. Si usas Ubuntu, Debian o Linux Mint, elige el archivo `.deb`; en otras distribuciones, el AppImage. ⟦R0045⟧

En Ubuntu 24.04 o posterior, el AppImage puede abrirse con una capa de protección menos que el `.deb` (el aislamiento de seguridad del sistema). Por eso, en Ubuntu, Debian y Linux Mint te recomendamos el `.deb`. ⟦R0045⟧ ⟦P16⟧

### Archivo .deb

1. Haz doble clic en `shinobi-karaoke-linux-x64.deb` y pulsa el botón de instalar. Te pedirá tu contraseña. ⟦P11⟧
2. Abre **Shinobi Karaoke** desde el menú de aplicaciones.

Si el doble clic no lo instala, abre una terminal en la carpeta del archivo y escribe:

    sudo apt install ./shinobi-karaoke-linux-x64.deb

### AppImage

1. Guarda `Shinobi-Karaoke-Linux-x64.AppImage` en una carpeta donde vaya a quedarse: no se instala, ese archivo es la app.
2. Dale permiso para ejecutarse: clic derecho sobre el archivo → **Propiedades** → activa la opción para ejecutarlo como programa. El nombre depende de tu escritorio, por ejemplo **Permitir ejecutar el archivo como un programa** o **Ejecutable como programa**. ⟦P10⟧
3. Haz doble clic en el archivo.

Si prefieres la terminal, en la carpeta del archivo:

    chmod +x Shinobi-Karaoke-Linux-x64.AppImage
    ./Shinobi-Karaoke-Linux-x64.AppImage

*Captura pendiente: la añadiremos antes de la primera versión pública. Estos pasos se pueden seguir sin ella.*

## Después de instalar

La primera vez que abras Shinobi Karaoke, verás **Hola. Vamos a preparar tu estudio de karaoke.** La app necesita descargar su motor de audio (lo que separa la voz de la música). Solo se hace una vez, y antes de empezar te dice las cifras exactas para tu equipo:

- **Conexión:** necesaria durante esta preparación. Después, solo para añadir canciones de YouTube y buscar letras.
- **Descarga:** entre 1 y 6 GB según tu equipo.
- **Espacio:** al menos 4 GB libres, o 10 GB si tienes una tarjeta gráfica NVIDIA. Cada canción ocupa unos 100 MB más.
- **Tiempo:** de 5 a 25 minutos, según tu conexión.

Pulsa **Preparar Shinobi Karaoke**. Puedes seguir usando el equipo mientras tanto. Si se corta la conexión o pulsas **Pausar y salir**, continuará donde lo dejó la próxima vez que abras la app. Si algo falla, la app te explica qué ha pasado y qué puedes hacer; nunca descarga un modelo distinto sin preguntarte antes.

Cuando veas **Todo listo**, pulsa **Empezar** y ya podrás añadir tu primera canción. Esa pantalla también te dice cuánto tardará una canción en tu equipo.

## ¿Sigue sin abrirse?

### En Windows

- **No aparece «Ejecutar de todas formas» y Windows dice que lo ha bloqueado el Control inteligente de aplicaciones:** esta protección de Windows 11 bloquea los programas sin firma y no permite hacer una excepción para uno solo. Mientras no firmemos el instalador, Shinobi Karaoke no se puede instalar con ella activada. Puedes leer qué es y cómo funciona en la [página de Microsoft](https://support.microsoft.com/es-es/windows/control-de-aplicaciones-inteligente-preguntas-frecuentes-285ea03d-fa88-4d56-882e-6698afdb7003). ⟦R0044⟧ ⟦P12⟧
- **No aparece «Ejecutar de todas formas» en un equipo del trabajo o de la escuela:** es posible que la organización no permita instalar programas. Pregunta a quien administre ese equipo.
- **La app dice «Tu equipo no es compatible todavía»:** tu equipo tiene un procesador ARM, y por ahora solo funciona en los de 64 bits (x64).

### En macOS

- **macOS dice que la app no es compatible con este Mac (o no se abre en absoluto):** abre el menú Apple → **Acerca de este Mac** (o **Acerca de esta Mac**). ⟦P9⟧
  - Si pone **Chip**: tu versión de macOS es demasiado antigua. Actualízala gratis, como explica Apple en [Actualizar macOS en el Mac](https://support.apple.com/es-es/108382), y vuelve a abrir la app.
  - Si pone **Procesador** (Intel…): tu Mac no es compatible; Shinobi Karaoke solo funciona, por ahora, en Mac con chip Apple. Puedes pedir que lo soportemos en las [incidencias del proyecto](https://github.com/Gomonsoft/shinobi-karaoke/issues).
- **La app se abre pero dice «Necesitas actualizar macOS»:** tu Mac tiene chip Apple pero una versión de macOS anterior a la 14. Actualízalo gratis y vuelve a abrir la app. Apple lo explica en [Actualizar macOS en el Mac](https://support.apple.com/es-es/108382).
- **No encuentro «Abrir igualmente»:** el botón solo aparece durante una hora, más o menos, después de intentar abrir la app. Vuelve a abrirla desde **Aplicaciones**, pulsa **Aceptar** (o **Listo**) y entra de nuevo en **Privacidad y seguridad**. ⟦P6⟧
- **macOS dice que la app está dañada:** vuelve a descargarla desde la página oficial, por si la descarga falló. Si se repite, [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues). ⟦P15⟧

### En Linux

- **El AppImage no abre:** prueba el archivo `.deb` si tu sistema lo admite y, si no, [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues). ⟦P16⟧
- **La app dice «Tu equipo no es compatible todavía»:** tu equipo tiene un procesador ARM, y por ahora solo funciona en los de 64 bits (x64).

### Si nada de esto te ayuda

Abre una [incidencia](https://github.com/Gomonsoft/shinobi-karaoke/issues) y cuéntanos qué sistema usas, qué archivo descargaste y qué mensaje ves. Si la app llega a abrirse, pulsa **Copiar detalles** y pégalos en la incidencia.

## Desinstalar

**Desinstalar la app no borra tus canciones.** Si vuelves a instalarla, seguirán ahí. El motor de audio también se queda en tu equipo y se reutiliza, salvo que la versión que instales lo cambie: en ese caso, la app volverá a descargar la parte que haga falta. ⟦P13⟧

- **Windows:** Inicio → Todas las aplicaciones → clic derecho en **Shinobi Karaoke** → **Desinstalar**. También desde el Panel de control → Programas → Programas y características. ⟦P13⟧
- **Mac:** cierra la app y arrastra **Shinobi Karaoke** de **Aplicaciones** a la **Papelera**.
- **Linux, archivo .deb:** en una terminal, `sudo apt remove shinobi-karaoke`.
- **Linux, AppImage:** borra el archivo.

### Borrar también tus datos

La carpeta de datos contiene **tus canciones** y el motor de audio, que ocupa varios GB. **Si la borras, perderás tus karaokes y no se pueden recuperar**; hazlo solo si ya no los quieres.

Para encontrarla, antes de desinstalar, abre la app y entra en **Ajustes → Abrir carpeta de datos**. Si ya la has desinstalado, está aquí:

- **Windows:** `%LOCALAPPDATA%\ShinobiKaraoke\` (pégalo en la barra de direcciones del Explorador de archivos)
- **Mac:** `~/Library/Application Support/Shinobi Karaoke/` (en el Finder, menú **Ir** → **Ir a la carpeta…**) ⟦P14⟧
- **Linux:** `~/.local/share/shinobi-karaoke/` (es una carpeta oculta; en el gestor de archivos, Ctrl+H las muestra)
```

**Por qué no se menciona el modelo Rápido por su nombre:** la guía no debe presentarlo como opción previa (criterio 5 de la spec 01). La frase "nunca descarga un modelo distinto sin preguntarte antes" basta para no ocultar que existe esa posibilidad.

**Cifras de "Después de instalar":** salen de `app/resources/runtime-manifest.json` y de la spec 01 (`pa.req.descarga.generica`, `pa.req.tiempo`). Si el manifiesto cambia, se actualizan aquí y en la guía. El tamaño que se publique debe corresponder al instalador definitivo.

**Compatibilidad y pruebas de la guía**

- **Mac (0041).** El paquete lleva firma *ad hoc*, sin Developer ID. Probar con un DMG descargado en el navegador en un Mac real, incluido macOS 14. La guía indica arrastrar la app a Aplicaciones. En macOS 13, un Mac con chip Apple puede llegar al aviso de actualización B6b. En macOS 12 o anterior lo rechaza el sistema.
- **Linux (0042).** El motor requiere glibc 2.28 o posterior. El AppImage usa FUSE del sistema para montarse, con un runtime que prescinde de `libfuse2` y `libfuse2t64`. El mensaje «El AppImage no abre» cubre también los errores de FUSE. En Ubuntu 24.04 se debe comprobar el arranque del `.deb` con el perfil de AppArmor y el del AppImage con la restricción activa. El AppImage puede arrancar sin el sandbox del sistema automáticamente. La publicación y el texto para ese caso siguen sujetos a 0045.
- **Windows (0043).** NSIS instala por usuario y abre la app al terminar. 0137 y P13 verifican el instalador real. Las pruebas de desinstalación cubren Windows y `.deb`. Al reinstalar, se conservan las canciones y se reutiliza el motor si el manifiesto es el mismo. Si cambian sus requisitos o modelos, B5 prepara y descarga solo la parte necesaria.

## §3. Notas de cada *Release*

**Revisado en la fase 10** (como DroidDeck: resumen, novedades, correcciones, enlace a todos los cambios y la ejecución de CI). Las notas tienen **dos partes**, separadas por una regla horizontal:

| Parte | Bloque | Fuente | Cuándo |
|---|---|---|---|
| 1. Para quien instala | Aviso de versión preliminar | `.github/publicacion/aviso-previa.md` | Solo si la versión lleva sufijo |
| | Cabecera | `.github/publicacion/cabecera.md` | Siempre |
| | Notas escritas a mano | `docs/versiones/<X.Y.Z>/notas/<versión>.md` (plantilla abajo) | Si existen (si no, el ensayo lo avisa en su resumen, ADR 0020 §4) |
| 2. Para quien sigue el proyecto | «Qué cambió» | Generado por GitHub, con los encabezados en español | **Siempre** |
| | Todos los cambios | Enlace de comparación con la *Release* publicada anterior | Siempre (en la primera, frase fija) |
| | Compilación | Número de compilación, commit y ejecución de CI que construyó y probó los instaladores | Siempre |

El aviso va primero porque es lo que más cambia la decisión de instalar; GitHub muestra la etiqueta *Pre-release* en inglés y no todo el mundo la entiende. La parte 2 va debajo porque es técnica (lista de PR) y no ayuda a decidir qué descargar. Sustituye a «notas a mano **o** las generadas por GitHub»: ahora las generadas van siempre y nunca sustituyen a las escritas.

### Aviso de versión preliminar (`.github/publicacion/aviso-previa.md`)

```markdown
> **Versión preliminar.** Es una versión de prueba: puede tener errores y algunas cosas cambiarán antes de la versión estable.
>
> Si ya tienes canciones en Shinobi Karaoke, haz una copia antes de instalarla: en la app, entra en **Ajustes → Abrir carpeta de datos** y copia la carpeta **biblioteca** a otro sitio.
```

- No se nombra la alfa concreta ("alpha.2"): el título de la *Release* ya lleva la versión y el texto sirve igual para `alpha`, `beta` y `rc`.
- Se pide copiar solo `biblioteca` (canciones autocontenidas, ADR 0006), no toda la carpeta de datos, que incluye varios GB del motor de audio.

### Cabecera (`.github/publicacion/cabecera.md`)

Texto final, sin marcadores. La línea de Linux corresponde a la opción provisional A de 0045 (se publican los dos archivos y se recomienda el `.deb` en Ubuntu, Debian y Linux Mint). Si 0045 se resuelve con B y el AppImage no se publica, la línea queda: "Linux: `shinobi-karaoke-linux-x64.deb` (Ubuntu, Debian, Linux Mint y derivadas)."

```markdown
**¿Qué archivo descargo?** Windows: `Shinobi-Karaoke-Windows-x64.exe` · Mac con chip Apple y macOS 14 o posterior: `Shinobi-Karaoke-Mac-chip-Apple.dmg` · Linux: `shinobi-karaoke-linux-x64.deb` (Ubuntu, Debian, Linux Mint) o `Shinobi-Karaoke-Linux-x64.AppImage` (otras distribuciones).

Los Mac con procesador Intel no son compatibles por ahora. Los archivos **Source code** son el código fuente, no la app.

La app no está firmada: tu navegador y tu sistema pueden avisarte la primera vez. **[Lee la guía de instalación](https://github.com/Gomonsoft/shinobi-karaoke/blob/main/INSTALAR.md)** antes de abrirla.

Si quieres comprobar la descarga, las sumas de verificación están en `SHA256SUMS.txt`.
```

Fase 10: «tu sistema te avisará» pasa a «tu navegador y tu sistema pueden avisarte» (aviso de Chrome, P18). Es el único cambio de la cabecera.

### Notas escritas a mano (plantilla de `docs/versiones/<X.Y.Z>/notas/<versión>.md`)

Las escribe la sesión principal y las revisa el usuario antes de etiquetar. Estructura fija, para que todas las *Releases* se lean igual:

```markdown
{Resumen en una o dos frases: qué trae esta versión para quien la usa.}

## Novedades

- **{Nombre de la función}.** {Qué puedes hacer ahora, en segunda persona.}

## Correcciones

- {Qué fallaba y ya no.}

## Sin probar en esta versión

- {Lo que no se ha comprobado en un equipo real.}
```

- Encabezados exactamente «Novedades», «Correcciones» y «Sin probar en esta versión», de nivel 2 y en ese orden; se omite el que quede vacío, salvo «Sin probar en esta versión» en una previa (tarea 0195), que es obligatorio.
- **No** repiten la versión en los encabezados (el título de la *Release* ya la lleva): `notas/0.2.0-alpha.1.md` usa «Novedades de 0.2.0-alpha.1» y no sigue esta plantilla porque no se publicó.
- Sin nombres de PR, ramas, tareas ni rutas: eso está en la parte 2.
- La línea `> Borrador: …` que lleva el archivo mientras se revisa **no se publica**: la composición falla si sigue (propuesto en 0142).

### Parte 2: «Qué cambió» y compilación

La compone el workflow debajo de la parte 1. Texto final, con los valores de la tabla de §4:

```markdown
---

## Qué cambió

{LISTA_GENERADA}

**Todos los cambios:** [{ETIQUETA_ANTERIOR}…{ETIQUETA}](https://github.com/Gomonsoft/shinobi-karaoke/compare/{ETIQUETA_ANTERIOR}...{ETIQUETA})

**Compilación:** `{NUMERO}`, del commit [`{HASH}`](https://github.com/Gomonsoft/shinobi-karaoke/commit/{SHA_COMPLETO}). Los instaladores se construyeron y se probaron en [esta ejecución de «Empaquetado y publicación»]({RUN_URL}).
```

- `{LISTA_GENERADA}`: la lista de PR de GitHub (una línea por PR con su autor; GitHub la escribe en inglés y se deja así). Sus encabezados se traducen: `## What's Changed` desaparece (lo sustituye «Qué cambió»), `## New Contributors` → `### Personas que colaboran por primera vez`, y la línea `**Full Changelog**: …` se quita (la sustituye «Todos los cambios»). Si no hay ningún PR en el intervalo: `No hay solicitudes de cambio (PR) en este intervalo: mira todos los cambios en la comparación.` Si traducir no es viable, se acepta el bloque de GitHub tal cual debajo de «Qué cambió» (0142).
- `{ETIQUETA_ANTERIOR}`: la *Release* **publicada** anterior, preliminar o estable (nunca un borrador). En la **primera** *Release* publicada, la línea «Todos los cambios» y la lista se sustituyen por: `Es la primera versión publicada de Shinobi Karaoke: no hay una anterior con la que comparar.`
- `{NUMERO}` es el número de compilación de [08 · Fase 10](08-ajustes-y-acerca.md#fase-10-de-020--número-de-compilación): el mismo que verá quien instale esta versión en **Ajustes → Acerca de**. Así un reporte con «Versión: 0.2.0-alpha.2-1234 (publicada, …)» lleva a esta *Release*.
- La composición falla si queda algún `{…}` sin sustituir (como ya hace con ⟦ y `{ENLACE_`).

Ejemplo (alpha.3, con alpha.2 publicada):
```markdown
---

## Qué cambió

* Corrige el barrido en líneas largas by @Gomonsoft in https://github.com/Gomonsoft/shinobi-karaoke/pull/58

**Todos los cambios:** [v0.2.0-alpha.2…v0.2.0-alpha.3](https://github.com/Gomonsoft/shinobi-karaoke/compare/v0.2.0-alpha.2...v0.2.0-alpha.3)

**Compilación:** `0.2.0-alpha.3-1301`, del commit [`5b8e2d0`](https://github.com/Gomonsoft/shinobi-karaoke/commit/5b8e2d0…). Los instaladores se construyeron y se probaron en [esta ejecución de «Empaquetado y publicación»](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/…).
```

## §3b. Canal de compilaciones de desarrollo (fase 10)

Como los repositorios de binarios de RPCS3: un repositorio aparte, **`Gomonsoft/shinobi-karaoke-builds`**, con **una *Release* por compilación** nocturna de `develop` (solo las noches en que hubo cambios). Así las *Releases* del repositorio principal son solo versiones y su «Latest» sigue significando «última versión». No se copia el modelo de RPCS3 de no tener versiones estables: este canal es para probar, no la forma normal de descargar.

### Qué ve quien llega

| Elemento | Valor | Ejemplo |
|---|---|---|
| Título | Exactamente `{NUMERO}`, sin prefijo | `0.2.0-alpha.3-1260` |
| Etiqueta | `build-{SHA_COMPLETO}` (los 40 caracteres, respuesta a la 0142) | `build-9e07c55d1f0a4b6c8e2a3f5d7b9c1e0a2b4c6d8e` |
| Marca | **No** *pre-release*; **sí** *latest* en ese repositorio, para que `…/shinobi-karaoke-builds/releases/latest` abra siempre la más reciente (provisional 0142). El aviso lo da el cuerpo | — |
| Archivos | 4 instaladores **con versión en el nombre** y `SHA256SUMS.txt` | ver abajo |
| Cuerpo | Texto fijo de abajo | — |

**Nombres de archivo del canal** (provisional 0142). Llevan la palabra `desarrollo` y el número para que, en la carpeta de descargas, no se confundan con los de una versión, que **conservan su nombre sin versión** (0040):

| Instalador | Versión publicada (sin cambios) | Canal de desarrollo |
|---|---|---|
| Windows | `Shinobi-Karaoke-Windows-x64.exe` | `Shinobi-Karaoke-desarrollo-{NUMERO}-Windows-x64.exe` |
| Mac | `Shinobi-Karaoke-Mac-chip-Apple.dmg` | `Shinobi-Karaoke-desarrollo-{NUMERO}-Mac-chip-Apple.dmg` |
| AppImage | `Shinobi-Karaoke-Linux-x64.AppImage` | `Shinobi-Karaoke-desarrollo-{NUMERO}-Linux-x64.AppImage` |
| `.deb` | `shinobi-karaoke-linux-x64.deb` | `shinobi-karaoke-desarrollo-{NUMERO}-linux-x64.deb` |

Ejemplo: `Shinobi-Karaoke-desarrollo-0.2.0-alpha.3-1260-Windows-x64.exe`. El AppImage sigue la decisión de 0045 igual que en las versiones.

### Cuerpo de cada compilación (texto fijo)

```markdown
**Compilación de desarrollo `{NUMERO}` de Shinobi Karaoke**, hecha automáticamente el {FECHA} a partir del commit [`{HASH}`](https://github.com/Gomonsoft/shinobi-karaoke/commit/{SHA_COMPLETO}) de la rama `develop`.

> **Esto no es una versión publicada.** Sirve para probar los últimos cambios antes de que salgan en una versión. Nadie la ha probado a mano: puede fallar, no abrirse o estropear lo que hagas con ella.
>
> **Si solo quieres usar Shinobi Karaoke, descárgalo desde [su página](https://github.com/Gomonsoft/shinobi-karaoke#descargar).**
>
> Se instala en lugar de la versión que tengas y usa tu misma biblioteca de canciones. Antes de instalarla, haz una copia: en la app, entra en **Ajustes → Abrir carpeta de datos** y copia la carpeta **biblioteca** a otro sitio. Si después vuelves a la versión publicada, puede que no abra lo que guardaste con esta compilación.

### Archivos

- **Windows 10 u 11 de 64 bits:** `{ARCHIVO_WINDOWS}` · {TAMANO_WINDOWS}
  SHA-256: `{SHA256_WINDOWS}`
- **Mac con chip Apple y macOS 14 o posterior:** `{ARCHIVO_MAC}` · {TAMANO_MAC}
  SHA-256: `{SHA256_MAC}`
- **Linux (Ubuntu, Debian, Linux Mint):** `{ARCHIVO_DEB}` · {TAMANO_DEB}
  SHA-256: `{SHA256_DEB}`
- **Linux (otras distribuciones):** `{ARCHIVO_APPIMAGE}` · {TAMANO_APPIMAGE}
  SHA-256: `{SHA256_APPIMAGE}`

La app no está firmada: tu navegador y tu sistema pueden avisarte. Sigue la [guía de instalación](https://github.com/Gomonsoft/shinobi-karaoke/blob/main/INSTALAR.md); los pasos son los mismos, aunque aquí los archivos llevan además el número de compilación.

### De dónde sale

- **Cambios desde la compilación anterior:** [{HASH_ANTERIOR}…{HASH}](https://github.com/Gomonsoft/shinobi-karaoke/compare/{HASH_ANTERIOR}...{HASH})
- **Construida y probada en:** [esta ejecución del CI]({RUN_URL})
- **Código fuente:** el del commit [`{HASH}`](https://github.com/Gomonsoft/shinobi-karaoke/tree/{SHA_COMPLETO}). Los archivos «Source code» de esta página son los de este repositorio de compilaciones, no los de la app.

¿Has encontrado un fallo? [Cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues) e indica el número de compilación (`{NUMERO}`). Lo encontrarás también en la app, en **Ajustes → Acerca de**, y al final de los detalles de error que copies.
```

- `{FECHA}`: fecha larga en español y en UTC, «22 de noviembre de 2026».
- `{TAMANO_…}`: megabytes decimales (1 MB = 1 000 000 bytes) con una cifra decimal y coma: «152,3 MB».
- Sin compilación anterior (la primera del repositorio): la línea «Cambios desde…» dice `Es la primera compilación de este canal.`
- Si una compilación no incluye algún instalador (p. ej., macOS fuera de la nocturna por tiempo de CI), su línea se quita y se añade al final de «Archivos»: `Esta compilación no incluye instalador para {sistema}.` Nunca se deja una línea con un archivo que no existe.

### README del repositorio `shinobi-karaoke-builds`

```markdown
# Compilaciones de desarrollo de Shinobi Karaoke

> **Si solo quieres usar Shinobi Karaoke, este no es el sitio.** Descarga la última versión desde el [repositorio principal](https://github.com/Gomonsoft/shinobi-karaoke#descargar).

Aquí se publica automáticamente una compilación de la rama `develop` cada noche en que hubo cambios. Sirven para probar arreglos y novedades antes de que salgan en una versión. Nadie las prueba a mano: pueden fallar o no abrirse.

- **[La compilación más reciente](https://github.com/Gomonsoft/shinobi-karaoke-builds/releases/latest)** · [Todas las compilaciones](https://github.com/Gomonsoft/shinobi-karaoke-builds/releases)
- Cada compilación se llama por su número, por ejemplo `0.2.0-alpha.3-1260`: la versión en la que se está trabajando y el número de compilación. El mismo número aparece en la app, en **Ajustes → Acerca de**.
- Se instalan en lugar de la versión que tengas y usan tu misma biblioteca de canciones. Haz una copia antes: **Ajustes → Abrir carpeta de datos** y copia la carpeta **biblioteca**.
- Los fallos se cuentan en las [incidencias del proyecto](https://github.com/Gomonsoft/shinobi-karaoke/issues), con el número de compilación.
- El código fuente de cada compilación es el del commit que enlaza su página, en el [repositorio principal](https://github.com/Gomonsoft/shinobi-karaoke).
```

- «La versión en la que se está trabajando» supone que `develop` sube a la siguiente previa justo después de publicar (0142, punto 2). Si el arquitecto decide otra cosa, la frase pasa a «la última versión de la que parte».

## §4. Enlaces y valores

| Valor | Contenido | Estado |
|-------|-----------|--------|
| Archivo de Windows | `Shinobi-Karaoke-Windows-x64.exe` | Definitivo (0040) |
| Archivo de Mac | `Shinobi-Karaoke-Mac-chip-Apple.dmg` | Definitivo (0040) |
| AppImage | `Shinobi-Karaoke-Linux-x64.AppImage` | Definitivo (0040); su publicación depende de ⟦R0045⟧ |
| `.deb` | `shinobi-karaoke-linux-x64.deb`; paquete `shinobi-karaoke` | Definitivo (0040) |
| `{ENLACE_WINDOWS}`, `{ENLACE_MAC}`, `{ENLACE_DEB}`, `{ENLACE_APPIMAGE}` | `https://github.com/Gomonsoft/shinobi-karaoke/releases/latest/download/` + el nombre del archivo, sin versión (0040) | ⟦R0035⟧ Solo en E1. `latest` excluye las *pre-releases* (ADR 0020 §2): en E½ darían 404 y no se usan |
| Enlaces de E½ (fase 10) | `https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v{VERSION}/` + el nombre del archivo; novedades: `…/releases/tag/v{VERSION}` | `{VERSION}` = última *pre-release* pública. Se actualizan los 5 a la vez en cada alfa; quién y cómo: 0142 (provisional `version:subir` / `version:comprobar`) |
| Botones | `docs/imagenes/descarga/descargar-{windows,mac,deb,appimage}.svg` | §1.4. Los mismos en E½ y E1 |
| Notas, parte 2 (§3) | `{LISTA_GENERADA}`, `{ETIQUETA}`, `{ETIQUETA_ANTERIOR}`, `{NUMERO}`, `{HASH}` (7 caracteres), `{SHA_COMPLETO}`, `{RUN_URL}` (`https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/<id>`) | Los rellena el workflow. Origen de N y del hash: 0142 |
| Repositorio de compilaciones | `https://github.com/Gomonsoft/shinobi-karaoke-builds` (`/releases`, `/releases/latest`) | Por crear (plan, fase 10). Debe ser **público**: comprobar los enlaces sin sesión antes de citarlo en el README (§1.5) |
| Archivos del canal de desarrollo (§3b) | `Shinobi-Karaoke-desarrollo-{NUMERO}-Windows-x64.exe` y los otros tres de la tabla de §3b, más `SHA256SUMS.txt` | Provisional 0142 |
| Cuerpo del canal (§3b) | `{FECHA}`, `{ARCHIVO_…}`, `{TAMANO_…}`, `{SHA256_…}`, `{HASH_ANTERIOR}` y los de la parte 2 | Los rellena el workflow; falla si queda alguno sin sustituir |
| Página de versiones e incidencias | `https://github.com/Gomonsoft/shinobi-karaoke/releases` y `/issues` | ⟦R0035⟧ El repositorio es privado y responde 404 sin sesión (arquitecto, 2026-11-06). **Hay que comprobar los enlaces sin sesión antes de publicar** |
| Actualizar macOS | `https://support.apple.com/es-es/108382` | Comprobada el 2026-11-06 |
| Control inteligente de aplicaciones | `https://support.microsoft.com/es-es/windows/control-de-aplicaciones-inteligente-preguntas-frecuentes-285ea03d-fa88-4d56-882e-6698afdb7003` | Comprobada el 2026-11-06 |

Estos enlaces no pasan por la app: no afectan a `ENLACES_PERMITIDOS`.

0040 fija los nombres de los archivos sin versión, y la fase 10 lo mantiene para las versiones: solo los del canal de desarrollo la llevan (§3b). La versión figura en la *Release*, en Acerca de (con el número de compilación, 08 · Fase 10) y en el artefacto del workflow (`shinobi-karaoke-<versión>-<sha corto>-<so>`). En Fase 7 el workflow genera `SHA256SUMS-<so>.txt` por plataforma. En E1 la *Release* incluye el `SHA256SUMS.txt` unificado que citan las notas de §3.

## §5. Textos del sistema y prueba manual

Las páginas de Apple confirman que **los nombres cambian según el idioma** (España frente a México), y dentro de una misma página difieren el texto y la captura. Por eso la guía da las dos variantes. Hay que probar con el instalador real, en español de España **y** de México o Latinoamérica, y dejar solo lo que aparezca de verdad.

### Sin confirmar (prueba manual antes de la primera versión pública)

| Id | Texto | Qué se sabe | Probar en |
|----|-------|-------------|-----------|
| P1 | "Windows protegió su PC" | Solo en foros de Microsoft y terceros; ninguna documentación oficial lo recoge. En español de México podría decir "tu PC" | Windows 10 y 11 |
| P2 | "Más información" | Ídem | Windows 10 y 11 |
| P3 | "Ejecutar de todas formas" | Ídem; un tercero escribe "Ejecutar de todos modos" | Windows 10 y 11 |
| P4 | Aviso de **Edge** al descargar y su camino: «… → Conservar», «Mostrar más», «Conservar de todos modos» | Sin fuente oficial consultada; texto según el comportamiento conocido de SmartScreen en las descargas de Edge | Edge en Windows 10 y 11, con el `.exe` de una *Release* |
| P18 | Aviso de **Chrome** al descargar un instalador sin firmar (fase 10): palabra exacta («poco común», «sospechoso», «no se descarga con frecuencia»), botón para conservarlo («Descargar archivo sospechoso», «Conservar») y si pide confirmación; atajo del panel de descargas en Mac | La ayuda de Google (es) cita «El archivo es sospechoso: Archivo poco común o desconocido» y el botón «Descargar archivo sospechoso» para archivos protegidos con contraseña; no da el texto de un `.exe` ni de un `.dmg` sin firmar. El usuario vio a Chrome bloquear el zip de artefactos de alpha.1 (2026-11-21) | Chrome en Windows 11 (`.exe`) y macOS (`.dmg`), en español, con la primera *Release* publicada; anotar texto literal y capturas opcionales |
| P19 | Los botones SVG de §1.4 en el README: se ven, el texto cabe y el texto alternativo se lee si la imagen no carga | Sin probar | GitHub en tema claro y oscuro, escritorio y móvil; Windows (Segoe UI), macOS y Linux (DejaVu Sans) |
| P5 | "Aceptar" / "Listo" y "Mover a la Papelera" | Texto alternativo de las capturas de Apple: España "Aceptar", México "Listo". Falta verlo con la firma *ad hoc* y un DMG descargado con navegador (0041, tarea 0139) | macOS 14, 15 y actual |
| P6 | "Ajustes del Sistema" / "Configuración del Sistema"; "Abrir igualmente" / "Abrir de todos modos" / "Abrir"; orden de los pasos 3 y 4 | Apple no es uniforme: en España, el texto dice "Abrir igualmente" y la captura "Abrir de Todos Modos"; la guía de macOS cita "Abrir" y después el otro botón | macOS 15 y actual; en macOS 14, el botón |
| P7 | "Aceptar" / "OK" tras la contraseña | Guía de macOS 15: España "Aceptar", México "OK" | macOS 15 y actual |
| P8 | Clic derecho → Abrir → Abrir en macOS 14 con la app real | Apple lo documenta para macOS 14 con Control + clic; falta probarlo con la firma *ad hoc* | macOS 14 |
| P9 | Mensaje real en un Mac Intel y en un Mac con chip Apple y macOS 12 o anterior (`LSMinimumSystemVersion` es 13.0: el sistema no abre la app; 0041) | No hay fuente oficial; el texto de la guía lo parafrasea | Esos equipos, si hay alguno disponible; si no, se anota "sin probar" |
| P10 | Nombre de la opción de ejecutar en Propiedades | Sin fuente oficial; cambia según el escritorio | Ubuntu LTS (GNOME), Linux Mint |
| P11 | Doble clic en un `.deb` | Sin página oficial; la información de la comunidad se contradice en Ubuntu 24.04. Lo oficial es `apt install ./archivo.deb` | Ubuntu LTS, Debian, Linux Mint |
| P12 | Mensaje real del Control inteligente de aplicaciones | Microsoft confirma el bloqueo, no el texto de la ventana | Windows 11 con la función activada |
| P13 | Instalador de un clic (sin preguntas ni administrador, accesos directos, abre la app al terminar), desinstalar y reinstalar en Windows | Sale de la configuración de electron-builder (0043); el instalador no se ha ejecutado. Rutas de desinstalación de Microsoft. Tareas 0137 y 0139 | Windows 10 y 11 |
| P14 | "Ir" → "Ir a la carpeta…" | Sin comprobar en una fuente oficial | macOS |
| P15 | Alerta "está dañada" con la firma *ad hoc* | Si aparece, comprobar el sello en el Mac de destino. **Si el sello es válido y la alerta no ofrece salida, se detiene la publicación en macOS y se eleva al usuario** (0041) | macOS 14, 15 y actual (0139) |
| P16 | AppImage y `.deb` en Ubuntu 24.04 con la restricción de AppArmor; "Probado en Ubuntu 24.04"; errores de FUSE; si el AppImage arranca sin sandbox (frase del límite en la guía) | Sale del código de las plantillas y de WSL2 sin AppArmor (0042). Sin ejecutar con la restricción. Si no se llega a probar, se quita "Probado en Ubuntu 24.04". Si la 0137 demuestra que el AppImage conserva el sandbox, se quita la frase del límite | Ubuntu 24.04 (0137 y 0139) |
| P17 | Rótulos de GitHub en la página de versiones: **Assets**, **Source code**, **Pre-release**; la versión más reciente aparece la primera y con sus archivos visibles | GitHub muestra su interfaz en inglés aunque el navegador esté en español. Solo se puede comprobar con la primera *Release* preliminar publicada, sin sesión | Navegador sin sesión, en escritorio y móvil (al pasar a E½) |

La prueba manual de 0139 abarca P1–P16 según esta spec; P17–P19 se comprueban con la primera *Release* publicada (`v0.2.0-alpha.2`, guía manual de la fase 10). Cada resultado se anota en las notas de la tarea 0139 (SO, versión, idioma y texto literal), y después se quitan las variantes que no aparezcan.

### Confirmados en fuentes oficiales (2026-11-06)

"Acerca de este Mac" (España), "Acerca de esta Mac" (México), "Chip", "Procesador"; ruta de actualización de macOS; Control + clic solo en la guía de macOS 14; validez de "Abrir igualmente" de aproximadamente una hora; desinstalar en Mac; Control inteligente de aplicaciones sin excepción por app; `apt install ./archivo.deb`.

Se han consultado con una herramienta que resume las páginas, no con el texto íntegro: no sustituyen a la prueba manual.

### Fuentes

| Fuente | Página | Consulta |
|--------|--------|----------|
| Apple | [Abrir apps de forma segura en el Mac](https://support.apple.com/es-es/102445) y [versión de México](https://support.apple.com/es-mx/102445) (fechadas el 2026-06-01) | 2026-11-06 |
| Apple | Abrir una app de un desarrollador desconocido: [macOS 15 España](https://support.apple.com/es-es/guide/mac-help/mh40616/15.0/mac/15.0), [macOS 15 México](https://support.apple.com/es-mx/guide/mac-help/mh40616/15.0/mac/15.0), [macOS 14](https://support.apple.com/es-es/guide/mac-help/mh40616/14.0/mac/14.0), [actual (macOS 27)](https://support.apple.com/es-es/guide/mac-help/mh40616/mac) | 2026-11-06 |
| Apple | Actualizar macOS: [España](https://support.apple.com/es-es/108382), [México](https://support.apple.com/es-mx/108382). Mac con chip de Apple: [España](https://support.apple.com/es-es/116943), [México](https://support.apple.com/es-mx/116943). [Desinstalar apps](https://support.apple.com/es-es/102610) | 2026-11-06 |
| Microsoft | Control Inteligente de Aplicaciones: [España](https://support.microsoft.com/es-es/windows/control-de-aplicaciones-inteligente-preguntas-frecuentes-285ea03d-fa88-4d56-882e-6698afdb7003), [México](https://support.microsoft.com/es-mx/windows/preguntas-m%C3%A1s-frecuentes-sobre-control-inteligente-de-aplicaciones-285ea03d-fa88-4d56-882e-6698afdb7003). [Desinstalar aplicaciones](https://support.microsoft.com/es-es/windows/desinstalar-o-quitar-aplicaciones-y-programas-en-windows-4b55f974-2cc6-2d2b-d092-5905080eaf98). [SmartScreen](https://learn.microsoft.com/es-es/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/) (no recoge los textos de la ventana) | 2026-11-06 |
| Microsoft Q&A (foro, **no oficial**) | [Hilo sobre SmartScreen](https://learn.microsoft.com/es-mx/answers/questions/3816825/mcreator-creador-de-mods-para-minecraft-vs-bloquea) | 2026-11-06 |
| Ubuntu | [Gestión de software](https://ubuntu.com/server/docs/tutorial/managing-software/) | 2026-11-06 |
| GitHub | [Enlazar a versiones](https://docs.github.com/es/repositories/releasing-projects-on-github/linking-to-releases) | 2026-11-06 |
| Google | [Google Chrome bloquea algunas descargas](https://support.google.com/chrome/answer/6261569?hl=es) (P18) | 2026-11-21 |

## §6. Textos que dependen de una respuesta

| Marcador | Texto afectado | Si la respuesta cambia lo provisional |
|----------|----------------|---------------------------------------|
| ⟦R0035⟧ | Enlaces de descarga, de versiones y de incidencias; paso de E0 a E1 | Mientras el repositorio sea privado y no haya versión, se mantiene E0. Las incidencias de la guía tampoco funcionan para el público hasta entonces |
| ⟦R0044⟧ | Entrada del Control inteligente de aplicaciones | Según la decisión del usuario |
| ⟦R0045⟧ | Publicación y recomendación del AppImage, y la frase del límite en la sección Linux de la guía (redactada para la opción provisional A, 0141) | Con A se queda como está. Con B, si el AppImage no se publica, se quitan su línea en §1.1b, §1.2 y §3 (texto alternativo en §3) y la frase del límite; si se publica porque conserva el sandbox, solo se quita la frase. Con C, el diseñador añade el texto del aviso en la app |

[0036](../preguntas/0036-numero-de-version-y-politica-de-versiones.md) (número de versión) no afecta a ningún texto, porque los archivos no llevan versión en el nombre. Si [0037](../preguntas/0037-autoactualizacion-de-la-app.md) (autoactualización) se decide distinto de lo provisional, habrá que añadir cómo se actualiza; hoy la guía no lo trata.

## §7. Capturas

Las capturas se hacen **con el instalador real**, en la prueba manual. No se usan imágenes de otras apps, de páginas de Apple o Microsoft ni montajes.

### Obligatorias (criterio 13 de la spec 01: una por SO)

| Id | SO y entorno | Qué muestra | Archivo | Texto alternativo |
|----|--------------|-------------|---------|-------------------|
| C-WIN | Windows 11, en español | SmartScreen tras pulsar "Más información", con "Ejecutar de todas formas" visible | `docs/imagenes/instalar/windows-smartscreen.png` | Ventana de aviso de Windows con el botón Ejecutar de todas formas resaltado |
| C-MAC | macOS 15 o posterior, en español | Privacidad y seguridad, sección Seguridad, con el mensaje sobre Shinobi Karaoke y el botón | `docs/imagenes/instalar/macos-privacidad-y-seguridad.png` | Ajustes del Sistema, Privacidad y seguridad, con el botón para abrir Shinobi Karaoke resaltado |
| C-LIN | Ubuntu LTS (GNOME), en español | Propiedades del AppImage con el permiso de ejecución activado | `docs/imagenes/instalar/linux-appimage-permisos.png` | Propiedades del archivo con la opción de ejecutar como programa activada |

### Opcionales (no bloquean)

`windows-smartscreen-inicio.png` (primer aviso, con "Más información"), `macos-aviso.png` (alerta de Gatekeeper), `macos-dmg.png` (arrastrar a Aplicaciones), `macos-14-abrir.png` (menú de clic derecho).

### Reglas

- Solo la ventana relevante, con el botón del paso rodeado por un rectángulo de 3 px que contraste con el fondo, sin texto añadido. Ancho máximo: 800 px.
- Sin nombre de usuario, contraseña, correo ni archivos personales a la vista.
- La imagen va justo después de la lista de pasos de su SO, con el texto alternativo de la tabla. Los pasos escritos siguen siendo completos sin ella.
- **Mientras no existan:** en su lugar va la línea en cursiva de la guía ("Captura pendiente: …"). Nada de imágenes rotas ni de enlaces a archivos que no existen. Al añadir la imagen, se quita esa línea.

## Accesibilidad

- Cada SO tiene su encabezado y sus pasos son listas numeradas reales, para poder saltar a ellos y oírlos con un lector de pantalla.
- Los enlaces dicen a dónde llevan: nunca "aquí" a secas ni una URL desnuda. El nombre del botón del sistema va en negrita, y no depende de una captura ni del color.
- No se usa el símbolo de la manzana: es un carácter que solo se ve en dispositivos de Apple. Se escribe "menú Apple (la manzana de la esquina de la pantalla)".

## Criterios de aceptación

1. Sin ninguna *Release* publicada, el README muestra §1.1: dice que aún no hay versión, incluye los requisitos y **no contiene ningún enlace de descarga**, ni `releases/latest`. `INSTALAR.md` lleva el aviso E0.
2. Con una *Release* **estable** pública, el README muestra §1.2 sin los avisos E0 ni E½. Cada enlace descarga su archivo en una sesión sin autenticar y usa el nombre exacto de §4. Antes de pasar a E1, se ajustan §1.2 y §3 si la decisión de publicación cambia los cuatro archivos previstos.
3. El enlace de macOS dice exactamente "Descargar para Mac con chip Apple" (desde la fase 10, es el texto alternativo de su botón). Justo debajo, y fuera de elementos plegables, están el requisito completo y "¿Qué Mac tengo?".
4. La línea de requisitos y "Los Mac con procesador Intel no son compatibles por ahora." aparecen en el README y en `INSTALAR.md`, con el mismo texto en ambos.
5. Linux ofrece el `.deb` para Ubuntu, Debian y Linux Mint, y el AppImage para el resto (salvo que 0045 decida otra cosa); la guía no incluye comandos de `libfuse2` ni `--no-sandbox`. Ni el README ni la guía usan scripts o insignias que intenten detectar el SO o el procesador.
6. `INSTALAR.md` contiene, con estos encabezados: "¿Por qué mi equipo me avisa?", "Si el navegador bloquea la descarga" (fase 10), Windows, Mac con chip Apple, Linux, "Después de instalar", "¿Sigue sin abrirse?" y "Desinstalar". Todos los enlaces internos funcionan en la vista de GitHub.
7. Los pasos de Mac distinguen macOS 14 de macOS 15 o posterior: la alternativa de clic derecho se indica "solo en macOS 14 Sonoma", y "¿Sigue sin abrirse?" incluye las dos entradas del criterio 17 de la spec 01. La entrada "no es compatible con este Mac" separa los dos casos: **Chip** (actualizar macOS, enlace de Apple) y **Procesador** Intel (no compatible). No atribuye a Intel el rechazo de un Mac con chip Apple.
8. Ningún archivo público contiene marcadores ⟦…⟧, comentarios de estado ni `{…}` sin sustituir.
9. El aviso "guía provisional" solo se quita cuando P1–P18 están comprobados y anotados (P9 puede quedar "sin probar" si no hay equipo), y 0044 y 0045 respondidas e incorporadas. E1 exige además la respuesta a 0035.
10. Antes de la primera versión pública existen C-WIN, C-MAC y C-LIN, sin datos personales y con su texto alternativo; ya no queda ninguna línea "Captura pendiente" en los SO con captura.
11. Ningún texto presenta el modelo Rápido como opción previa, ni recomienda desactivar SmartScreen, Gatekeeper o el sandbox, salvo que lo decida el usuario en 0044 o 0045.
12. "Después de instalar" coincide con la Parte B de la spec 01 (nombres de botones, tiempo) y con el manifiesto vigente (rango de descarga, espacio).
13. Todas las URL externas responden sin autenticar y llevan a la página indicada en una comprobación hecha el día de la publicación; la fecha se anota en la tarea 0142.
14. La tabla "Requisitos del equipo" del README ya no dice "~1–2 GB" (§1.3).
15. P13 comprueba en Windows que el instalador arranca sin pedir permisos de administrador, crea accesos en Inicio y en el escritorio y abre la app al terminar. En Windows y con el `.deb`, se comprueba que tras desinstalar y reinstalar siguen las canciones, se reutiliza el motor con el mismo manifiesto y B5 descarga solo lo necesario si cambia el motor.
16. La guía remite al `.deb` o a incidencias si el AppImage no abre. «Probado en Ubuntu 24.04» solo aparece en §1.2 si P16 registra la prueba. La guía indica arrastrar la app a Aplicaciones y P15 registra la comprobación del sello si aparece «está dañada».
17. **E½** (revisado en la fase 10). Con al menos una *pre-release* pública y ninguna estable, el README muestra §1.1b: «Última versión: {VERSION}, versión preliminar», un botón por instalador cuyo enlace es `…/releases/download/v{VERSION}/<archivo>` con el nombre exacto de §4, el enlace de novedades a `…/releases/tag/v{VERSION}`, los 4 pasos numerados y el aviso de descargar solo desde aquí o desde `/releases`. No contiene `releases/latest`. `{VERSION}` es la misma en el texto y en los 5 enlaces, y es la de la *pre-release* pública más reciente; los 4 enlaces descargan su archivo en una sesión sin autenticar. La comprobación acordada en 0142 falla si algún enlace lleva otra versión.
18. **E½ en la guía.** `INSTALAR.md` lleva el aviso E½ en lugar del aviso E0; se quita con la primera versión estable. Una *Release* que siga en borrador no hace pasar a E½.
19. **Notas.** Las notas de una versión con sufijo empiezan por el aviso de §3, exactamente con ese texto, seguido de la cabecera. Las de una versión estable empiezan por la cabecera y no contienen "Versión preliminar". La línea de Linux de la cabecera coincide con §3 y no lleva marcadores.
20. **Límite del AppImage.** Con la opción A de 0045, la sección Linux de `INSTALAR.md` contiene la frase del límite y recomienda el `.deb` en Ubuntu, Debian y Linux Mint, sin dar ningún paso para desactivar el sandbox ni mencionar `--no-sandbox`.

### Criterios de la fase 10 («Detalles de release»)

21. **Botones.** Existen los 4 SVG de §1.4 con el texto, los colores y las medidas indicados, `role="img"` y `<title>`, sin scripts ni recursos externos. En el README (E½ y E1), cada uno es la imagen de un enlace y su texto alternativo es exactamente el de la tabla. Con las imágenes bloqueadas, el README sigue diciendo qué descarga cada enlace.
22. **Pasos y aviso.** En E½ y E1, la sección «Descargar» tiene «Cómo instalarla» con 4 pasos en lista numerada real, la frase de copia de la biblioteca y el aviso «Descarga Shinobi Karaoke solo desde aquí o desde su página de versiones», con enlace a `/releases`. El paso 2 distingue «poco común / sospechoso» (conservar) de «peligroso / virus» (no abrir y avisar) y el paso 3 enlaza a las tres secciones de `INSTALAR.md`.
23. **Navegador.** `INSTALAR.md` tiene «Si el navegador bloquea la descarga» con los dos casos, Chrome y Edge, y el índice del principio la enlaza; el paso 1 de Windows remite a ella. Ningún texto recomienda desactivar la protección de descargas del navegador.
24. **Notas, parte 1.** Las notas de `v0.2.0-alpha.2` son: aviso de versión preliminar → cabecera (con «tu navegador y tu sistema pueden avisarte») → notas a mano con la plantilla de §3 (resumen, «Novedades», «Correcciones» si hay, «Sin probar en esta versión»), sin versión en los encabezados ni la línea `> Borrador:`.
25. **Notas, parte 2.** Debajo de una regla horizontal van siempre «Qué cambió», «Todos los cambios» y «Compilación». En `v0.2.0-alpha.2` (primera publicada) aparece la frase de primera versión en lugar de la lista y la comparación; en la siguiente, la comparación va de la anterior publicada a esta y la lista no contiene `What's Changed` ni `Full Changelog`. «Compilación» muestra el mismo número que Acerca de en esa versión, enlaza al commit de la etiqueta y a la ejecución que subió los instaladores. Las notas generadas nunca sustituyen a las escritas.
26. **Canal de desarrollo.** Tras una fusión en `develop`, como mucho al día siguiente existe en `shinobi-karaoke-builds` una *Release* titulada exactamente `{NUMERO}`, con etiqueta `build-{SHA_COMPLETO}`, los instaladores con los nombres de §3b, `SHA256SUMS.txt` y el cuerpo fijo de §3b sin ningún `{…}`. Su tamaño y su SHA-256 coinciden con los archivos adjuntos y con `SHA256SUMS.txt`. Una noche sin cambios no crea *Release*.
27. **Nombres.** Los instaladores de una *Release* del repositorio principal siguen llamándose como en §4 (sin versión); solo los del canal de desarrollo llevan `desarrollo-{NUMERO}`.
28. **Canal en el README.** La sección «Descargar» no enlaza a `shinobi-karaoke-builds`; la sección «Desarrollo» lo hace con el texto de §1.5. El README de `shinobi-karaoke-builds` empieza por el aviso de que no es el sitio para quien solo quiere usar la app, con enlace a `…/shinobi-karaoke#descargar`.
29. **Trazabilidad.** Instalada una compilación del canal, su número en Ajustes → Acerca de coincide con el título de su *Release*, y el commit de Acerca de con el de la etiqueta `build-{SHA_COMPLETO}` (08 · Fase 10, AC7).
30. **Prueba con la primera Release.** P17–P19 quedan anotados (texto literal de Chrome y Edge, botones en tema claro y oscuro) en la guía manual de la fase 10, y los textos de §1.1b, §2 y §3 se ajustan a lo observado.
