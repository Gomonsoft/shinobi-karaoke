> **Todavía no hay ninguna versión publicada**, así que aún no hay nada que descargar. Esta guía explica cómo será la instalación.

> **Guía provisional.** Todavía no la hemos comprobado con los instaladores definitivos: algún paso o el nombre de algún botón puede ser distinto en tu equipo.

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

1. Abre el archivo que has descargado (`Shinobi-Karaoke-Windows-x64.exe`). Si tu navegador avisa de que el archivo no se descarga con frecuencia, elige conservarlo.
2. Si aparece la ventana **Windows protegió su PC**, pulsa **Más información**.
3. Pulsa **Ejecutar de todas formas**.
4. El instalador no pregunta nada: se instala solo, sin permisos de administrador, y abre Shinobi Karaoke al terminar. Después la encontrarás en el menú Inicio y en el escritorio.

*Captura pendiente: la añadiremos antes de la primera versión pública. Estos pasos se pueden seguir sin ella.*

¿No aparece **Ejecutar de todas formas**? Mira [¿Sigue sin abrirse?](#sigue-sin-abrirse).

## Mac con chip Apple

Para Mac con chip Apple (M1 o posterior) y macOS 14 Sonoma o posterior. Los Mac con procesador Intel no son compatibles por ahora.

**¿Qué Mac tengo?** Abre el menú Apple (la manzana de la esquina de la pantalla) → **Acerca de este Mac** (o **Acerca de esta Mac**). Si pone **Chip** (Apple M1, M2…), es compatible. Si pone **Procesador** (Intel…), todavía no.

Si tu Mac tiene chip Apple y una versión anterior a macOS 14, [actualízala gratis](https://support.apple.com/es-es/108382) antes de empezar.

Según el idioma de tu Mac, algunos nombres cambian. Aquí aparecen los dos: el de España y, entre paréntesis, el de Latinoamérica.

1. Abre el archivo `.dmg` que has descargado (`Shinobi-Karaoke-Mac-chip-Apple.dmg`) y arrastra **Shinobi Karaoke** a **Aplicaciones**.
2. Abre **Shinobi Karaoke** desde **Aplicaciones**. Si macOS dice que no puede abrirla o comprobarla, pulsa **Aceptar** (o **Listo**). No pulses **Mover a la Papelera**.
3. Ve al menú Apple → **Ajustes del Sistema** (o **Configuración del Sistema**) → **Privacidad y seguridad**. Baja hasta la sección **Seguridad**, busca el mensaje sobre Shinobi Karaoke y pulsa **Abrir igualmente** (o **Abrir de todos modos**). Este botón solo aparece durante una hora, más o menos, después de intentar abrir la app: si no lo ves, repite el paso 2.
4. macOS te preguntará otra vez. Pulsa **Abrir igualmente** (o **Abrir de todos modos**), o **Abrir** si es lo que te ofrece. Si te lo pide, escribe tu contraseña de inicio de sesión y pulsa **Aceptar** (o **OK**).

**Alternativa solo en macOS 14 Sonoma:** en el Finder, clic derecho (o Control + clic) sobre la app → **Abrir** → **Abrir**. En macOS 15 o posterior no existe; usa el paso 3.

Solo hace falta la primera vez.

*Captura pendiente: la añadiremos antes de la primera versión pública. Estos pasos se pueden seguir sin ella.*

## Linux

No hace falta saltar ningún aviso. Si usas Ubuntu, Debian o Linux Mint, elige el archivo `.deb`; en otras distribuciones, el AppImage.

### Archivo .deb

1. Haz doble clic en `shinobi-karaoke-linux-x64.deb` y pulsa el botón de instalar. Te pedirá tu contraseña.
2. Abre **Shinobi Karaoke** desde el menú de aplicaciones.

Si el doble clic no lo instala, abre una terminal en la carpeta del archivo y escribe:

    sudo apt install ./shinobi-karaoke-linux-x64.deb

### AppImage

1. Guarda `Shinobi-Karaoke-Linux-x64.AppImage` en una carpeta donde vaya a quedarse: no se instala, ese archivo es la app.
2. Dale permiso para ejecutarse: clic derecho sobre el archivo → **Propiedades** → activa la opción para ejecutarlo como programa. El nombre depende de tu escritorio, por ejemplo **Permitir ejecutar el archivo como un programa** o **Ejecutable como programa**.
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

- **No aparece «Ejecutar de todas formas» y Windows dice que lo ha bloqueado el Control inteligente de aplicaciones:** esta protección de Windows 11 bloquea los programas sin firma y no permite hacer una excepción para uno solo. Mientras no firmemos el instalador, Shinobi Karaoke no se puede instalar con ella activada. Puedes leer qué es y cómo funciona en la [página de Microsoft](https://support.microsoft.com/es-es/windows/control-de-aplicaciones-inteligente-preguntas-frecuentes-285ea03d-fa88-4d56-882e-6698afdb7003).
- **No aparece «Ejecutar de todas formas» en un equipo del trabajo o de la escuela:** es posible que la organización no permita instalar programas. Pregunta a quien administre ese equipo.
- **La app dice «Tu equipo no es compatible todavía»:** tu equipo tiene un procesador ARM, y por ahora solo funciona en los de 64 bits (x64).

### En macOS

- **macOS dice que la app no es compatible con este Mac (o no se abre en absoluto):** abre el menú Apple → **Acerca de este Mac** (o **Acerca de esta Mac**).
  - Si pone **Chip**: tu versión de macOS es demasiado antigua. Actualízala gratis, como explica Apple en [Actualizar macOS en el Mac](https://support.apple.com/es-es/108382), y vuelve a abrir la app.
  - Si pone **Procesador** (Intel…): tu Mac no es compatible; Shinobi Karaoke solo funciona, por ahora, en Mac con chip Apple. Puedes pedir que lo soportemos en las [incidencias del proyecto](https://github.com/Gomonsoft/shinobi-karaoke/issues).
- **La app se abre pero dice «Necesitas actualizar macOS»:** tu Mac tiene chip Apple pero una versión de macOS anterior a la 14. Actualízalo gratis y vuelve a abrir la app. Apple lo explica en [Actualizar macOS en el Mac](https://support.apple.com/es-es/108382).
- **No encuentro «Abrir igualmente»:** el botón solo aparece durante una hora, más o menos, después de intentar abrir la app. Vuelve a abrirla desde **Aplicaciones**, pulsa **Aceptar** (o **Listo**) y entra de nuevo en **Privacidad y seguridad**.
- **macOS dice que la app está dañada:** vuelve a descargarla desde la página oficial, por si la descarga falló. Si se repite, [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues).

### En Linux

- **El AppImage no abre:** prueba el archivo `.deb` si tu sistema lo admite y, si no, [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues).
- **La app dice «Tu equipo no es compatible todavía»:** tu equipo tiene un procesador ARM, y por ahora solo funciona en los de 64 bits (x64).

### Si nada de esto te ayuda

Abre una [incidencia](https://github.com/Gomonsoft/shinobi-karaoke/issues) y cuéntanos qué sistema usas, qué archivo descargaste y qué mensaje ves. Si la app llega a abrirse, pulsa **Copiar detalles** y pégalos en la incidencia.

## Desinstalar

**Desinstalar la app no borra tus canciones.** Si vuelves a instalarla, seguirán ahí. El motor de audio también se queda en tu equipo y se reutiliza, salvo que la versión que instales lo cambie: en ese caso, la app volverá a descargar la parte que haga falta.

- **Windows:** Inicio → Todas las aplicaciones → clic derecho en **Shinobi Karaoke** → **Desinstalar**. También desde el Panel de control → Programas → Programas y características.
- **Mac:** cierra la app y arrastra **Shinobi Karaoke** de **Aplicaciones** a la **Papelera**.
- **Linux, archivo .deb:** en una terminal, `sudo apt remove shinobi-karaoke`.
- **Linux, AppImage:** borra el archivo.

### Borrar también tus datos

La carpeta de datos contiene **tus canciones** y el motor de audio, que ocupa varios GB. **Si la borras, perderás tus karaokes y no se pueden recuperar**; hazlo solo si ya no los quieres.

Para encontrarla, antes de desinstalar, abre la app y entra en **Ajustes → Abrir carpeta de datos**. Si ya la has desinstalado, está aquí:

- **Windows:** `%LOCALAPPDATA%\ShinobiKaraoke\` (pégalo en la barra de direcciones del Explorador de archivos)
- **Mac:** `~/Library/Application Support/Shinobi Karaoke/` (en el Finder, menú **Ir** → **Ir a la carpeta…**)
- **Linux:** `~/.local/share/shinobi-karaoke/` (es una carpeta oculta; en el gestor de archivos, Ctrl+H las muestra)
