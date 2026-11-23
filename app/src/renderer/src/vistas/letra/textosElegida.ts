/** Textos de la letra elegida, vista C (docs/ux/05, claves `let.actual.*`, `let.edicion.*`). */

export const TEXTO_ELEGIDA = {
  etiquetaArea: 'Texto de la letra',
  origen: { lrclib: 'de LRCLIB', manual: 'pegada', archivo: 'de un archivo' },
  sync: {
    palabra: 'sincronizada por palabra',
    linea: 'sincronizada por línea',
    ninguna: 'sin sincronizar',
    parte: 'sincronizada en parte'
  },
  actual: (origen: string, sync: string, n: number): string =>
    `Letra actual · ${origen} · ${sync} · ${n === 1 ? '1 línea' : `${n} líneas`}`,
  /** `let.actual.reparto`: «{n} cantantes · {k} líneas de coro»; cada parte solo si existe. */
  reparto: (cantantes: number, coros: number): string =>
    [
      cantantes >= 2 ? `${cantantes} cantantes` : '',
      coros > 0 ? (coros === 1 ? '1 línea de coro' : `${coros} líneas de coro`) : ''
    ]
      .filter(Boolean)
      .join(' · '),
  vacia: 'Sin letra todavía. Escribe o pega aquí la letra, o busca otra.',
  demasiadoLarga: 'El texto es demasiado largo para ser una letra. Este cambio no se ha guardado.',
  errorListaSinLineas:
    'Una canción lista necesita al menos una línea de letra. Este cambio no se ha guardado.',
  esperandoAudio: 'Esperando la canción para continuar…',
  editorEsperando: 'Espera a que termine la descarga para continuar.',
  editorAudioNoListo: 'El audio todavía no está listo para continuar.',
  aviso:
    'Si cambias el texto de una línea, esa línea tendrá que volver a sincronizarse. Las demás conservan su tiempo.',
  marcas:
    'Aquí las marcas como «[01:23.45]» se guardan como texto. Para conservar los tiempos, importa el archivo o pega la letra desde «Buscar otra letra».',
  cerrarAviso: 'Cerrar el aviso',
  otra: 'Buscar otra letra',
  importar: 'Importar archivo',
  editor: 'Ir al editor',
  editorInactivo: 'Primero elige una letra'
} as const
