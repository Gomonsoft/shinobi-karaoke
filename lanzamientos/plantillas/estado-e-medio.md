# Plantillas del estado E½ (solo versiones preliminares)

Textos finales de la [spec 09](../../docs/ux/09-descarga-e-instalacion.md) §1.1b y §2, listos para pasar el README y `INSTALAR.md` de E0 a E½ cuando exista la primera _pre-release_ **pública** (pregunta [0140](../../docs/preguntas/0140-publicar-las-alfas-como-pre-release-publica.md); tarea 0254). `app/scripts/guia-instalacion.test.ts` comprueba esta plantilla sustituyendo `{VERSION}` por la versión de `app/package.json`.

## Cómo se aplica

1. Comprobar sin sesión que la _Release_ aparece en `/releases` y que los 4 enlaces descargan su archivo.
2. En `README.md`, sustituir la sección `## Descargar` entera (hasta `## Requisitos del equipo`) por el bloque «README» de abajo, con `{VERSION}` = la versión de la _Release_ (sin «v»). Quitar de `INSTALAR.md` el aviso E0 (primera línea) y poner en su lugar el bloque «INSTALAR.md».
3. A partir de ahí, `npm run version:subir -- <nueva>` reescribe en `README.md` y `INSTALAR.md` los enlaces `…/releases/(download|tag)/v<versión>`, `**Última versión: <versión>, versión preliminar**` y `[Novedades de <versión>]`; `npm run version:comprobar` falla nombrando el archivo si alguno no coincide. Con el README en E0 no hay nada que reescribir ni comprobar.
4. Con la primera versión estable (E1, spec 09 §1.2) estos bloques se retiran.

## README

```markdown
## Descargar

**Última versión: {VERSION}, versión preliminar.** Es una versión de prueba: ya se puede instalar, pero puede tener errores y algunas cosas cambiarán antes de la primera versión estable. [Novedades de {VERSION}](https://github.com/Gomonsoft/shinobi-karaoke/releases/tag/v{VERSION})

**Requisitos:** Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · entre 4 y 10 GB libres según tu equipo (más unos 100 MB por canción) · conexión a internet la primera vez

Los Mac con procesador Intel no son compatibles por ahora. Tampoco los equipos con procesador ARM que usan Windows o Linux.

### Windows

[![Descargar para Windows](lanzamientos/descarga/descargar-windows.svg)](https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v{VERSION}/Shinobi-Karaoke-Windows-x64.exe)

Para Windows 10 u 11 de 64 bits.

### Mac

[![Descargar para Mac con chip Apple](lanzamientos/descarga/descargar-mac.svg)](https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v{VERSION}/Shinobi-Karaoke-Mac-chip-Apple.dmg)

Para Mac con chip Apple (M1 o posterior) y macOS 14 Sonoma o posterior. Los Mac con procesador Intel no son compatibles por ahora.

**¿Qué Mac tengo?** Abre el menú Apple (la manzana de la esquina de la pantalla) → **Acerca de este Mac** (o **Acerca de esta Mac**). Si pone **Chip** (Apple M1, M2…), es compatible. Si pone **Procesador** (Intel…), todavía no.

### Linux

Para Linux de 64 bits (x64). Elige uno de los dos:

[![Descargar .deb para Ubuntu, Debian y Linux Mint](lanzamientos/descarga/descargar-deb.svg)](https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v{VERSION}/shinobi-karaoke-linux-x64.deb)

[![Descargar AppImage para otras distribuciones de Linux](lanzamientos/descarga/descargar-appimage.svg)](https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v{VERSION}/Shinobi-Karaoke-Linux-x64.AppImage)

El `.deb` se instala como cualquier otro programa y te pedirá tu contraseña. El AppImage no se instala: es un solo archivo que se abre directamente.

### Cómo instalarla

1. Pulsa el botón de tu sistema.
2. Si tu navegador avisa de que el archivo es **poco común** o **sospechoso**, elige conservarlo: pasa porque la app es nueva y no está firmada. Si dice que es **peligroso** o que tiene un **virus**, no lo abras y [cuéntanoslo](https://github.com/Gomonsoft/shinobi-karaoke/issues).
3. Abre el archivo descargado. En Windows y Mac, la primera vez tu sistema te avisará: sigue los pasos de la guía para [Windows](INSTALAR.md#windows), [Mac](INSTALAR.md#mac-con-chip-apple) o [Linux](INSTALAR.md#linux).
4. Al abrir Shinobi Karaoke por primera vez, pulsa **Preparar Shinobi Karaoke**. Descarga el motor de audio una sola vez (entre 1 y 6 GB, según tu equipo).

Si ya tienes canciones, haz una copia antes de instalar otra versión: en la app, entra en **Ajustes → Abrir carpeta de datos** y copia la carpeta **biblioteca** a otro sitio.

> **Descarga Shinobi Karaoke solo desde aquí o desde su [página de versiones](https://github.com/Gomonsoft/shinobi-karaoke/releases).** Es gratis: si te lo cobran o te lo envían por otro camino, no lo abras.
```

## INSTALAR.md

```markdown
> **Por ahora solo hay versiones preliminares.** Las encontrarás en la [página de versiones](https://github.com/Gomonsoft/shinobi-karaoke/releases), con la etiqueta **Pre-release**. Son versiones de prueba y pueden tener errores. Si ya tienes canciones, haz una copia antes de instalar otra versión: en la app, entra en **Ajustes → Abrir carpeta de datos** y copia la carpeta **biblioteca** a otro sitio.
```

## Pendiente (§1.5)

La mención de `shinobi-karaoke-builds` al principio de «Desarrollo» solo se añade cuando ese repositorio exista y responda sin sesión (spec 09 §1.5 y [0143](../../docs/preguntas/0143-canal-de-desarrollo-configuracion-y-carpeta-de-datos.md)).
