/** Textos de la vista Letra (docs/ux/05, claves `let.*`). */

export const TEXTO = {
  titulo: 'Letra',
  campoTitulo: 'Título',
  campoArtista: 'Artista',
  buscar: 'Buscar',
  buscandoBoton: 'Buscando…',
  buscando: 'Buscando la letra…',
  resultados: (n: number): string => `Resultados (${n})`,
  vistaPrevia: 'Vista previa',
  sync: {
    palabra: 'Sincronizada por palabra',
    linea: 'Sincronizada por línea',
    texto: 'Solo texto'
  },
  durIgual: 'Duración igual que tu audio',
  durDif: (n: number, sentido: 'mas_larga' | 'mas_corta'): string =>
    `${n} s ${sentido === 'mas_larga' ? 'más larga' : 'más corta'} que tu audio`,
  durMuyDif: 'Duración muy distinta: puede ser otra versión',
  atribucion: 'Letra: LRCLIB',
  alternativa: '¿No es ninguna?',
  pegar: 'Pegar la letra',
  importar: 'Importar archivo .lrc o .txt',
  usar: 'Usar esta letra',
  usando: 'Guardando…',
  irAlEditor: 'Ir al editor',
  reintentar: 'Reintentar',
  lineas: (n: number): string => (n === 1 ? '1 línea' : `${n} líneas`),
  letraElegida: (n: number): string => `Letra elegida · ${n === 1 ? '1 línea' : `${n} líneas`}`,
  errorAbrir: 'No se pudo abrir la canción.',
  errorGuardar: 'No se pudo guardar la letra.',
  errorGenerico: 'No se pudo buscar la letra.',
  avisoInstrumentalConCandidatos: {
    titulo: 'La versión más parecida es instrumental',
    cuerpo:
      ', según LRCLIB. Abajo tienes otras versiones con letra: comprueba que coinciden con tu audio.'
  },
  error: {
    LETRA_NO_ENCONTRADA: {
      titulo: 'No encontramos la letra.',
      cuerpo:
        'Revisa el título y el artista (quita cosas como «Remastered» o «Live») y busca de nuevo, o pega la letra tú.'
    },
    INSTRUMENTAL: {
      titulo: 'Esta canción es instrumental',
      cuerpo: ', según LRCLIB. Si tiene letra, pégala o impórtala.'
    },
    SIN_CONEXION: {
      titulo: 'Sin conexión a internet.',
      cuerpo: 'Puedes pegar la letra o importar un archivo, y buscarla más tarde.'
    },
    SERVICIO_NO_DISPONIBLE: {
      titulo: 'El servicio de letras no responde.',
      cuerpo: 'Suele ser temporal. Reintenta en unos minutos o pega la letra tú.'
    }
  }
} as const
