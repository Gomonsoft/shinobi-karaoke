# 09 — Descarga e instalación (fuera de la app)

- Paso del pipeline: 0 (distribución)
- ADRs: [0001](../adr/0001-plataforma-y-stack.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md) (ubicación de los datos), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md)
- Tarea que lo publica: [0025](../tareas/0025-empaquetado-e-instaladores.md). Sustituye al detalle de la Parte A de [01-primer-arranque.md](01-primer-arranque.md); criterios 13 y 17 de esa spec.
- Decisiones que respeta: sin firma ([0001](../preguntas/0001-firma-de-codigo-instaladores.md)); macOS 14 o posterior solo con chip Apple ([0015](../preguntas/0015-macos-intel-sin-pytorch-y-macos-minimo.md), [0017](../preguntas/0017-textos-de-requisitos-macos-14-y-mac-intel.md)); Mac Intel no compatible ([0016](../preguntas/0016-mac-intel-fuera-del-mvp.md)); sin web propia, README e `INSTALAR.md` ([0017](../preguntas/0017-textos-de-requisitos-macos-14-y-mac-intel.md), Seguimiento); modelo Rápido solo con consentimiento ([0019](../preguntas/0019-calidad-por-defecto-y-rapido-con-consentimiento.md)).
- Preguntas respondidas por el arquitecto e incorporadas: [0040](../preguntas/0040-nombres-de-instaladores-y-enlaces-de-descarga.md), [0041](../preguntas/0041-gatekeeper-con-firma-ad-hoc.md), [0042](../preguntas/0042-appimage-fuse-y-sandbox-en-linux.md), [0043](../preguntas/0043-instalador-de-windows-y-datos-al-desinstalar.md) (ADR 0012). Lo que no se ha podido ejecutar sigue en la prueba manual (§5).
- Preguntas abiertas para el usuario: [0035](../preguntas/0035-repositorio-publico-y-primera-publicacion.md) (repositorio y primera versión), [0044](../preguntas/0044-control-inteligente-de-aplicaciones-en-windows.md) (Control inteligente de aplicaciones) y [0045](../preguntas/0045-appimage-sin-sandbox-en-ubuntu.md) (AppImage sin sandbox). [0036](../preguntas/0036-numero-de-version-y-politica-de-versiones.md) y [0037](../preguntas/0037-autoactualizacion-de-la-app.md) no cambian ningún texto de hoy.

## Objetivo

Que una persona no técnica sepa qué archivo descargar, si su equipo es compatible y cómo superar el aviso del sistema, sin engañarla sobre lo que significa ese aviso. Tarea principal: pasar de "quiero Shinobi Karaoke" a "la app abre su pantalla de bienvenida" (B1 de la spec 01).

## Superficies y estados

No hay web propia. Hay tres textos, todos en Markdown de GitHub. **Markdown no ejecuta código: no se detecta el SO del visitante** (cambia la Parte A original, que pedía mostrar primero su botón) y las "descargas" son enlaces en negrita.

| Superficie | Archivo | Contenido |
|------------|---------|-----------|
| Sección "Descargar" | `README.md`, justo antes de "Requisitos del equipo" | §1 |
| Guía "Instalar Shinobi Karaoke" | `INSTALAR.md`, en la raíz | §2 |
| Notas de cada *Release* | GitHub | §3 |

| Estado | Cuándo | Qué se muestra |
|--------|--------|----------------|
| **E0 — Sin versión** | No hay ninguna *Release* publicada (**es el estado de la Fase 7**) | §1.1 en el README; aviso E0 al principio de `INSTALAR.md`. **Ningún enlace de descarga** |
| **E1 — Con versión** | Existe al menos una *Release* pública con los cuatro instaladores | §1.2 en el README, sin aviso E0 |
| **Guía provisional** | Queda algún ⟦P⟧ o ⟦R⟧ de este documento sin resolver | Aviso "guía provisional" al principio de `INSTALAR.md` |
| Vacío / cargando | No aplican: son textos estáticos | — |
| Error | No aplica a la página; los fallos del usuario se cubren en "¿Sigue sin abrirse?" | — |

### Convenciones de este documento

Los bloques de `markdown` son el **texto final**. Se copian tal cual, salvo:

- **`{ENLACE_…}`**: valores por sustituir al pasar a E1 (ver la tabla de §4).
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

### §1.2 Estado E1 (con una versión publicada)

Orden fijo: Windows, Mac, Linux. Los requisitos y "¿Qué Mac tengo?" van en texto normal, nunca dentro de `<details>`.

```markdown
## Descargar

**Requisitos:** Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · entre 4 y 10 GB libres según tu equipo (más unos 100 MB por canción) · conexión a internet la primera vez

Los Mac con procesador Intel no son compatibles por ahora. Tampoco los equipos con procesador ARM que usan Windows o Linux.

### Windows

**[Descargar para Windows]({ENLACE_WINDOWS})**

Para Windows 10 u 11 de 64 bits.

### Mac

**[Descargar para Mac con chip Apple]({ENLACE_MAC})**

Para Mac con chip Apple (M1 o posterior) y macOS 14 Sonoma o posterior. Los Mac con procesador Intel no son compatibles por ahora.

**¿Qué Mac tengo?** Abre el menú Apple (la manzana de la esquina de la pantalla) → **Acerca de este Mac** (o **Acerca de esta Mac**). Si pone **Chip** (Apple M1, M2…), es compatible. Si pone **Procesador** (Intel…), todavía no.

### Linux

Para Linux de 64 bits (x64). Probado en Ubuntu 24.04. ⟦P16⟧ Elige uno de los dos:

- **[Descargar .deb]({ENLACE_DEB})**: si usas Ubuntu, Debian o Linux Mint. Se instala como cualquier otro programa y te pedirá tu contraseña.
- **[Descargar AppImage]({ENLACE_APPIMAGE})**: para otras distribuciones, o si no puedes instalar programas. No se instala: es un solo archivo que se abre directamente. ⟦R0045⟧

### Después de descargar

Tu sistema puede avisarte la primera vez, porque la app no está firmada. Es normal: la [guía de instalación](INSTALAR.md) te explica paso a paso cómo continuar y qué se descarga al abrirla por primera vez.

Descarga Shinobi Karaoke solo desde esta página. [Ver todas las versiones](https://github.com/Gomonsoft/shinobi-karaoke/releases)
```

### §1.3 Ajuste en la tabla "Requisitos del equipo" del README

Hoy dice "Solo en el primer arranque (descarga ~1–2 GB)", lo que contradice a B1 en equipos con NVIDIA. Debe decir: "Solo en el primer arranque (descarga entre 1 y 6 GB según tu equipo) y para YouTube/letras". El resto de la tabla no cambia.

## §2. Guía `INSTALAR.md`

### Avisos de estado (solo mientras apliquen; van antes de la introducción)

```markdown
<!-- E0: se quita al publicar la primera versión -->
> **Todavía no hay ninguna versión publicada**, así que aún no hay nada que descargar. Esta guía explica cómo será la instalación.

<!-- PROVISIONAL: se quita cuando no quede ningún marcador por resolver -->
> **Guía provisional.** Todavía no la hemos comprobado con los instaladores definitivos: algún paso o el nombre de algún botón puede ser distinto en tu equipo.
```

### Texto de la guía

```markdown
# Instalar Shinobi Karaoke

Elige tu sistema: [Windows](#windows) · [Mac](#mac-con-chip-apple) · [Linux](#linux)

También aquí: [Por qué aparece un aviso](#por-qué-mi-equipo-me-avisa) · [Después de instalar](#después-de-instalar) · [¿Sigue sin abrirse?](#sigue-sin-abrirse) · [Desinstalar](#desinstalar)

**Requisitos:** Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · entre 4 y 10 GB libres según tu equipo (más unos 100 MB por canción) · conexión a internet la primera vez

Los Mac con procesador Intel no son compatibles por ahora. Tampoco los equipos con procesador ARM que usan Windows o Linux.

## ¿Por qué mi equipo me avisa?

Shinobi Karaoke es gratuito y de código abierto. Windows y macOS reconocen a los desarrolladores mediante una firma digital que normalmente se paga, y todavía no la tenemos. Por eso tu sistema te mostrará un aviso la primera vez. Es normal. Te explicamos cómo continuar.

El aviso significa que tu sistema **no puede comprobar quién ha creado el programa**; no significa que haya encontrado un virus. Aun así, continúa solo si lo has descargado desde la [página oficial del proyecto](https://github.com/Gomonsoft/shinobi-karaoke/releases). Si lo has recibido por otro camino, no lo abras.

Si tu sistema dice que ha **detectado software malicioso**, o mueve la app a la papelera él mismo, no sigas adelante y [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues).

Linux no pide esta firma. Si en el futuro firmamos los instaladores de algún sistema, quitaremos de aquí sus pasos.

## Windows

1. Abre el archivo que has descargado (`Shinobi-Karaoke-Windows-x64.exe`). Si tu navegador avisa de que el archivo no se descarga con frecuencia, elige conservarlo. ⟦P4⟧
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

- **El AppImage no abre, o sale un error que menciona «FUSE» o «sandbox»:** prueba el archivo `.deb` si tu sistema lo admite y, si no, [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues). ⟦P16⟧
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

**Cifras de "Después de instalar":** salen de `app/resources/runtime-manifest.json` y de la spec 01 (`pa.req.descarga.generica`, `pa.req.tiempo`). Si el manifiesto cambia, se actualizan aquí y en la guía. No se publica el tamaño del instalador hasta medirlo (tarea 0025).

## §3. Notas de cada *Release*

Al principio de las notas, antes de la lista de cambios:

```markdown
**¿Qué archivo descargo?** Windows: `Shinobi-Karaoke-Windows-x64.exe` · Mac con chip Apple y macOS 14 o posterior: `Shinobi-Karaoke-Mac-chip-Apple.dmg` · Linux: `shinobi-karaoke-linux-x64.deb` (Ubuntu, Debian, Linux Mint) o `Shinobi-Karaoke-Linux-x64.AppImage` (otras distribuciones). ⟦R0045⟧

Los Mac con procesador Intel no son compatibles por ahora.

La app no está firmada: tu sistema te avisará la primera vez. **[Lee la guía de instalación](https://github.com/Gomonsoft/shinobi-karaoke/blob/main/INSTALAR.md)** antes de abrirla.

Si quieres comprobar la descarga, las sumas de verificación están en `SHA256SUMS.txt`.
```

## §4. Enlaces y valores

| Valor | Contenido | Estado |
|-------|-----------|--------|
| Archivo de Windows | `Shinobi-Karaoke-Windows-x64.exe` | Definitivo (0040) |
| Archivo de Mac | `Shinobi-Karaoke-Mac-chip-Apple.dmg` | Definitivo (0040) |
| AppImage | `Shinobi-Karaoke-Linux-x64.AppImage` | Definitivo (0040); su publicación depende de ⟦R0045⟧ |
| `.deb` | `shinobi-karaoke-linux-x64.deb`; paquete `shinobi-karaoke` | Definitivo (0040) |
| `{ENLACE_WINDOWS}`, `{ENLACE_MAC}`, `{ENLACE_DEB}`, `{ENLACE_APPIMAGE}` | `https://github.com/Gomonsoft/shinobi-karaoke/releases/latest/download/` + el nombre del archivo, sin versión (0040) | ⟦R0035⟧ Solo existen en E1 |
| Página de versiones e incidencias | `https://github.com/Gomonsoft/shinobi-karaoke/releases` y `/issues` | ⟦R0035⟧ El repositorio es privado y responde 404 sin sesión (arquitecto, 2026-11-06). **Hay que comprobar los enlaces sin sesión antes de publicar** |
| Actualizar macOS | `https://support.apple.com/es-es/108382` | Comprobada el 2026-11-06 |
| Control inteligente de aplicaciones | `https://support.microsoft.com/es-es/windows/control-de-aplicaciones-inteligente-preguntas-frecuentes-285ea03d-fa88-4d56-882e-6698afdb7003` | Comprobada el 2026-11-06 |

Estos enlaces no pasan por la app: no afectan a `ENLACES_PERMITIDOS`.

## §5. Textos del sistema y prueba manual

Las páginas de Apple confirman que **los nombres cambian según el idioma** (España frente a México), y dentro de una misma página difieren el texto y la captura. Por eso la guía da las dos variantes. Hay que probar con el instalador real, en español de España **y** de México o Latinoamérica, y dejar solo lo que aparezca de verdad.

### Sin confirmar (prueba manual antes de la primera versión pública)

| Id | Texto | Qué se sabe | Probar en |
|----|-------|-------------|-----------|
| P1 | "Windows protegió su PC" | Solo en foros de Microsoft y terceros; ninguna documentación oficial lo recoge. En español de México podría decir "tu PC" | Windows 10 y 11 |
| P2 | "Más información" | Ídem | Windows 10 y 11 |
| P3 | "Ejecutar de todas formas" | Ídem; un tercero escribe "Ejecutar de todos modos" | Windows 10 y 11 |
| P4 | Aviso del navegador al descargar y su botón | No investigado por navegador; el texto no nombra ningún botón | Edge y Chrome |
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
| P15 | Alerta "está dañada" con la firma *ad hoc* | No debería aparecer si el sello es válido, pero nada de macOS se ha ejecutado (0041). **Si aparece sin salida, se detiene la publicación en macOS y se eleva al usuario**; la guía no incluye Terminal | macOS 14, 15 y actual (0139) |
| P16 | AppImage y `.deb` en Ubuntu 24.04 con la restricción de AppArmor; "Probado en Ubuntu 24.04"; errores de FUSE | Sale del código de las plantillas y de WSL2 sin AppArmor (0042). Sin ejecutar con la restricción. Si no se llega a probar, se quita "Probado en Ubuntu 24.04" | Ubuntu 24.04 (0137 y 0139) |

Cada resultado se anota en las notas de la tarea 0139 (SO, versión, idioma y texto literal), y después se quitan las variantes que no aparezcan.

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

## §6. Textos que dependen de una respuesta

| Marcador | Texto afectado | Si la respuesta cambia lo provisional |
|----------|----------------|---------------------------------------|
| ⟦R0035⟧ | Enlaces de descarga, de versiones y de incidencias; paso de E0 a E1 | Mientras el repositorio sea privado y no haya versión, se mantiene E0. Las incidencias de la guía tampoco funcionan para el público hasta entonces |
| ⟦R0044⟧ | Entrada del Control inteligente de aplicaciones | Según la decisión del usuario |
| ⟦R0045⟧ | Publicación y recomendación del AppImage. **No hay ningún texto sobre el sandbox del AppImage**: se redacta, si procede, con la respuesta del usuario y el resultado de la tarea 0137 | Con la opción B podría retirarse el AppImage en algunas distribuciones; con A o C, el diseñador añade el límite o el aviso |

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
2. Con una *Release*, el README muestra §1.2 sin el aviso E0, con exactamente cuatro enlaces de descarga, y cada uno descarga su archivo en una sesión sin autenticar.
3. El enlace de macOS dice exactamente "Descargar para Mac con chip Apple". Justo debajo, y fuera de elementos plegables, están el requisito completo y "¿Qué Mac tengo?".
4. La línea de requisitos y "Los Mac con procesador Intel no son compatibles por ahora." aparecen en el README y en `INSTALAR.md`, con el mismo texto en ambos.
5. Linux ofrece el `.deb` para Ubuntu, Debian y Linux Mint, y el AppImage para el resto (salvo que 0045 decida otra cosa); la guía no incluye comandos de `libfuse2` ni `--no-sandbox`. Ni el README ni la guía usan scripts o insignias que intenten detectar el SO o el procesador.
6. `INSTALAR.md` contiene, con estos encabezados: "¿Por qué mi equipo me avisa?", Windows, Mac con chip Apple, Linux, "Después de instalar", "¿Sigue sin abrirse?" y "Desinstalar". Todos los enlaces internos funcionan en la vista de GitHub.
7. Los pasos de Mac distinguen macOS 14 de macOS 15 o posterior: la alternativa de clic derecho se indica "solo en macOS 14 Sonoma", y "¿Sigue sin abrirse?" incluye las dos entradas del criterio 17 de la spec 01. La entrada "no es compatible con este Mac" separa los dos casos: **Chip** (actualizar macOS, enlace de Apple) y **Procesador** Intel (no compatible). No atribuye a Intel el rechazo de un Mac con chip Apple.
8. Ningún archivo público contiene marcadores ⟦…⟧, comentarios de estado ni `{…}` sin sustituir.
9. El aviso "guía provisional" solo se quita cuando P1–P16 están comprobados y anotados (P9 puede quedar "sin probar" si no hay equipo), y 0044 y 0045 respondidas e incorporadas. E1 exige además la respuesta a 0035.
10. Antes de la primera versión pública existen C-WIN, C-MAC y C-LIN, sin datos personales y con su texto alternativo; ya no queda ninguna línea "Captura pendiente" en los SO con captura.
11. Ningún texto presenta el modelo Rápido como opción previa, ni recomienda desactivar SmartScreen, Gatekeeper o el sandbox, salvo que lo decida el usuario en 0044 o 0045.
12. "Después de instalar" coincide con la Parte B de la spec 01 (nombres de botones, tiempo) y con el manifiesto vigente (rango de descarga, espacio).
13. Todas las URL externas responden sin autenticar y llevan a la página indicada en una comprobación hecha el día de la publicación; la fecha se anota en la tarea 0142.
14. La tabla "Requisitos del equipo" del README ya no dice "~1–2 GB" (§1.3).
