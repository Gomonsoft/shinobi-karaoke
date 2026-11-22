/** Textos de `ux/08` · Feature 3 (aviso de versión nueva) y `ux/01` · Feature 3 (primer arranque). */
export const AJACT = {
  titulo: 'Actualizaciones',
  alDia: 'Tienes la última versión.',
  nunca: 'Aún no se ha comprobado si hay una versión nueva.',
  nueva: (version: string) => `Hay una versión nueva: ${version}`,
  preliminar: ' (versión preliminar)',
  nuevaAyuda: (instalada: string) =>
    `Tienes la ${instalada}. La app no se actualiza sola: descarga la nueva e instálala encima. Tus canciones no se tocan.`,
  novedades: 'Ver novedades',
  descargar: 'Descargar',
  descargando: (version: string) =>
    `Se ha abierto tu navegador para descargar la versión ${version}. Cuando termine, cierra Shinobi Karaoke y abre el archivo descargado.`,
  descargandoPagina: (version: string) =>
    `Se ha abierto tu navegador en la página de la versión ${version}. Descarga el archivo de tu sistema, cierra Shinobi Karaoke e instálalo.`,
  copiaPreliminar: ' Es una versión preliminar: haz antes una copia de seguridad.',
  guia: 'Guía de instalación',
  buscar: 'Buscar actualizaciones',
  buscando: 'Buscando…',
  comprobado: (cuando: string) =>
    `Comprobado ${cuando === 'ayer' || cuando.startsWith('hoy') ? cuando : `el ${cuando}`}.`,
  ultima: (cuando: string) => `Última comprobación: ${cuando}.`,
  ultimaNinguna: 'Aún no se ha podido comprobar.',
  error: 'No se pudo comprobar ahora. Revisa tu conexión a internet e inténtalo más tarde.',
  avisar: 'Avisarme cuando haya una versión nueva',
  privacidad:
    'Como mucho una vez al día, Shinobi Karaoke pregunta a GitHub, donde se publican las versiones, cuál es la última. No envía datos tuyos ni de tus canciones: solo el nombre y la versión de la app y los datos técnicos de cualquier petición web. GitHub ve tu dirección IP y el idioma de tu equipo, como cualquier web que visitas.',
  desactivado:
    'El aviso está desactivado: Shinobi Karaoke no busca versiones nuevas por su cuenta. Puedes buscarlas a mano.',
  desarrollo:
    'Las compilaciones de desarrollo no buscan versiones nuevas. Las versiones publicadas están en la web del proyecto.',
  local: 'Las compilaciones locales no buscan versiones nuevas.',
  banner: (version: string) => `Hay una versión nueva: ${version}.`,
  ver: 'Ver',
  tooltip: 'Ajustes · hay una versión nueva',
  externo: (texto: string) => `${texto} (se abre en el navegador)`,
  anuncioNueva: (version: string) => `Hay una versión nueva: ${version}.`,
  anuncioAlDia: 'Tienes la última versión.'
} as const

/** Sección «Actualizar a una versión nueva» de `INSTALAR.md` (spec 09 · Feature 3). */
export const ENLACE_GUIA_ACTUALIZAR =
  'https://github.com/Gomonsoft/shinobi-karaoke/blob/main/INSTALAR.md#actualizar-a-una-versión-nueva'

/** `pa.actualizaciones` (`ux/01` · Feature 3). */
export const PA_ACTUALIZACIONES =
  'Shinobi Karaoke comprueba como mucho una vez al día si hay una versión nueva. Puedes desactivarlo en «Licencias» o, después, en Ajustes → Acerca de.'
