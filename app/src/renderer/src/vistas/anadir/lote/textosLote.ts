/** Textos de la tabla de revisión del lote (docs/ux/03 · 0.2.2 · Feature 7: claves `add.lote.*`). */

const plural = (n: number, uno: string, varios: string): string => (n === 1 ? uno : varios)

export const LOTE = {
  cabecera: 'Nuevas canciones',
  titulo: (n: number): string =>
    n === 0 ? 'Añadir canciones' : n === 1 ? 'Añadir 1 canción' : `Añadir ${n} canciones`,
  origenLista: (nombre: string, n: number): string => `De la lista «${nombre}» · ${n} videos`,
  origenCarpeta: (nombre: string, n: number): string =>
    `De la carpeta «${nombre}» · ${n} ${plural(n, 'archivo', 'archivos')}`,
  origenArchivos: (n: number): string => `${n} ${plural(n, 'archivo', 'archivos')}`,
  origenEnlaces: (n: number): string => `${n} ${plural(n, 'enlace', 'enlaces')}`,
  comunes: (album: string | null, artista: string | null): string =>
    album && artista
      ? `Hemos puesto «${album}» como álbum y «${artista}» como artista de todas. Cámbialos si no es así.`
      : album
        ? `Hemos puesto «${album}» como álbum de todas. Cámbialo si no es así.`
        : `Hemos puesto «${artista}» como artista de todas. Cámbialo si no es así.`,
  todasArtista: 'Artista para todas…',
  todasAlbum: 'Álbum para todas…',
  aplicar: (n: number): string => `Aplicar a las ${n} marcadas`,
  soloDudosas: (k: number): string => `Solo las que hay que comprobar (${k})`,
  columnas: { titulo: 'Título', artista: 'Artista', album: 'Álbum', duracion: 'Duración' },
  marcarTodas: 'Marcar todas',
  marcar: (titulo: string): string => `Añadir «${titulo}»`,
  campo: (columna: string, titulo: string): string => `${columna} de «${titulo}»`,
  // Líneas de estado de una fila
  dudosoTitulo: 'El título puede llevar texto de más: compruébalo',
  dudosoArtista: 'El artista sale del nombre del canal: compruébalo',
  dudosoNombre: 'El título es el nombre del archivo: compruébalo',
  duplicada: 'Ya está en tu biblioteca',
  duplicadaMarcada: 'Ya está en tu biblioteca: se añadirá otra copia',
  larga: (duracion: string): string => `Dura ${duracion}: tardará más en separarse`,
  noDisponible: 'No disponible: no se puede añadir',
  directo: 'Es un directo: no se puede añadir',
  ilegible: 'No podemos leer este archivo',
  corta: 'Dura menos de 10 segundos',
  fueraLimite: 'Fuera del límite de este lote',
  // Avisos de la tabla
  repetidas: (n: number): string =>
    n === 1 ? '1 estaba repetida y se ha unido.' : `${n} estaban repetidas y se han unido.`,
  ignorados: (n: number): string =>
    n === 1
      ? 'No se ha tenido en cuenta 1 archivo que no es de audio ni de video o que está en la carpeta de datos.'
      : `No se han tenido en cuenta ${n} archivos que no son de audio ni de video o que están en la carpeta de datos de Shinobi Karaoke.`,
  enlacesIgnorados: (n: number): string =>
    n === 1
      ? '1 renglón no es un enlace de YouTube y se ha ignorado.'
      : `${n} renglones no son enlaces de YouTube y se han ignorado.`,
  paqueteIgnorado:
    'Los paquetes de Shinobi Karaoke no se añaden aquí. Impórtalos desde «Importar paquete…».',
  limite:
    'Se pueden añadir hasta 50 canciones de una vez. Hemos marcado las 50 primeras; añade el resto en otra tanda.',
  limiteTope: 'Ya hay 50 marcadas. Desmarca alguna para marcar esta.',
  demasiadasLista: 'Esta lista tiene más de 500 elementos. Mostramos los 500 primeros.',
  demasiadasArchivos:
    'Hay más de 500 archivos de audio. Mostramos los 500 primeros; añade el resto desde otra carpeta.',
  demasiadasCarpeta:
    'Esta carpeta es muy grande: mostramos lo que hemos encontrado hasta ahora. Elige una carpeta más concreta para ver el resto.',
  // Resumen
  resumen: (n: number, tamano: string, minutos: number | null, aproximado: boolean): string => {
    const cabeza = `${n} ${plural(n, 'canción', 'canciones')}`
    const parte = aproximado ? 'al menos' : 'unos'
    const t =
      minutos === null
        ? ''
        : ` · ${parte} ${minutos} ${plural(minutos, 'minuto', 'minutos')} en tu equipo`
    return `${cabeza} · ${parte} ${tamano}${t}`
  },
  despues: 'Cada canción se separará, buscará su letra y quedará lista para revisar.',
  despuesSinLetra:
    'Cada canción se separará. La búsqueda automática de letra está desactivada: quedarán como borradores sin letra.',
  activarEnAjustes: 'Activar en Ajustes',
  legal: 'Recuerda: descarga solo contenido que tengas derecho a descargar.',
  leerAviso: 'Leer el aviso',
  sinEspacioTitulo: (k: number): string =>
    k === 0 ? 'No hay espacio para ninguna.' : 'No hay espacio para todas.',
  sinEspacioCuerpo: (k: number): string =>
    k === 0
      ? 'Libera espacio en el disco o desmarca canciones.'
      : `Caben unas ${k}. Desmarca algunas o libera espacio en el disco.`,
  sinArtista: (k: number): string =>
    k === 1
      ? '1 canción no tiene artista: con él es más fácil encontrar su letra. Puedes ponerlo con «Artista para todas…».'
      : `${k} canciones no tienen artista: con él es más fácil encontrar su letra. Puedes ponerlo con «Artista para todas…».`,
  nada: 'No hay ninguna canción que añadir.',
  boton: (n: number, youtube: boolean): string => {
    const base = youtube ? 'Descargar y añadir' : 'Añadir'
    return n === 1 ? `${base} 1 canción` : `${base} ${n} canciones`
  },
  anadiendo: 'Añadiendo…',
  cancelar: 'Cancelar',
  descartarTitulo: '¿Descartar este lote?',
  descartarCuerpo: 'Perderás los cambios que has hecho en la tabla. No se ha añadido nada todavía.',
  seguir: 'Seguir revisando',
  descartar: 'Descartar',
  errorGenericoTitulo: (k: number): string =>
    `No se pudieron añadir ${k} ${plural(k, 'canción', 'canciones')}.`,
  errorGenericoCuerpo: 'Las demás ya están en tu biblioteca.',
  // Entrada y lectura
  leyendo: 'Leyendo los archivos…',
  leyendoN: (n: number): string => `Leyendo ${n} archivos…`,
  consultandoLista: 'Consultando la lista…',
  consultandoEnlaces: (i: number, n: number): string => `Consultando ${i} de ${n} enlaces…`,
  leidos: (n: number, problemas: number): string =>
    problemas > 0
      ? `Leídos ${n} archivos; ${problemas} no se pueden añadir.`
      : `Leídos ${n} archivos.`,
  carpetaVaciaTitulo: 'En esa carpeta no hay archivos de audio ni de video.',
  carpetaVaciaCuerpo: 'Elige otra carpeta o arrastra los archivos.',
  listaNoDisponibleTitulo: 'No podemos abrir esta lista.',
  listaNoDisponibleCuerpo:
    'Puede ser privada, estar vacía o haberse eliminado. Comprueba el enlace o pega los enlaces de los videos.',
  ofertaLista: 'Este video está en una lista.',
  anadirLista: 'Añadir la lista entera',
  soltarVarios: (n: number): string => `Suelta para añadir ${n} canciones`,
  paquete: '¿Tienes un paquete de Shinobi Karaoke?',
  importarPaquete: 'Importar paquete…',
  elegirCarpeta: 'Elegir carpeta…',
  usarArchivos: 'Usar archivos de tu equipo',
  unoEnLoteTitulo: 'Revisa los datos de la canción'
} as const

/** Tamaño aproximado del lote: «450 MB», «1,1 GB». */
export function formatearTamanoLote(bytes: number): string {
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1).replace('.', ',')} GB`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}
