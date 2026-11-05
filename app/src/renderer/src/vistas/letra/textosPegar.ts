/** Textos de "Pegar la letra" (B), importar y sustituir (docs/ux/05, claves `let.pegar.*`). */

const renglones = (n: number): string => (n === 1 ? '1 renglón' : `${n} renglones`)

export const TEXTO_PEGAR = {
  titulo: 'Pega la letra',
  etiquetaArea: 'Letra',
  ayuda:
    'Una línea de la canción por renglón. Deja un renglón en blanco entre estrofas si quieres. Borra los renglones que no se cantan, como «[Estribillo]» o «(x2)».',
  contador: (n: number): string =>
    `${n === 1 ? '1 línea' : `${n} líneas`} · se sincronizarán en el editor`,
  lrc: 'Hemos detectado tiempos de sincronía y los conservaremos.',
  ignoradas: (n: number): string => `Ignoraremos ${renglones(n)} sin tiempo.`,
  demasiado: 'El texto es demasiado largo (máximo 512 KB).',
  volver: 'Volver a los resultados'
} as const

export const TEXTO_IMPORTAR = {
  errorArchivo: 'Este archivo no contiene letra que podamos leer.',
  errorLeer: 'No se pudo leer el archivo.',
  ignoradas: (n: number): string => `Hemos ignorado ${renglones(n)} sin tiempo del archivo.`
} as const

export const TEXTO_SUSTITUIR = {
  titulo: '¿Sustituir la letra actual?',
  conSincronia: 'Perderás la sincronía que hayas hecho.',
  sinSincronia: 'Se reemplazará el texto que tienes ahora.',
  cancelar: 'Cancelar',
  sustituir: 'Sustituir'
} as const
