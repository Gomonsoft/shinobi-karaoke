/** Microcopy de progreso, resultado, avisos y actividad de la exportación (docs/ux/10, 0239 y 0240). */

export const EXP_PROGRESO = {
  titulo: 'Exportando video',
  subpasoPreparar: 'Preparar la canción',
  subpasoCrear: 'Crear el video',
  subpasoTerminar: 'Terminar el archivo',
  fasePreparando: 'Preparando la canción…',
  faseCreando: (n: number): string => `Creando el video… ${n} %`,
  fasePosicion: (actual: string, total: string): string => `${actual} de ${total}`,
  faseTerminando: 'Terminando el archivo…',
  etaCalculando: 'Calculando tiempo…',
  ayudaSegundoPlano:
    'Puedes cerrar este cuadro y seguir usando Shinobi Karaoke: la exportación continúa. Lo que cambies a partir de ahora no entrará en este video.',
  segundoPlano: 'Seguir en segundo plano',
  cancelarExportacion: 'Cancelar exportación',
  quitarDeLaCola: 'Quitar de la cola',
  seguirExportando: 'Seguir exportando',
  colaTras: (otra: string): string =>
    `En cola: empezará cuando termine la exportación de «${otra}».`,
  colaSinOtra: 'En cola: empezará enseguida.',
  colaPosicion: (p: number): string => `${p}.ª en la cola.`,
  cancelarPregunta: '¿Cancelar la exportación?',
  cancelarCuerpo: 'Se borrará lo que lleva hecho.',
  cancelarConservado: 'El archivo que ya había con ese nombre no se toca.',
  cancelando: 'Cancelando y borrando el archivo temporal…',
  okTitulo: 'Video exportado',
  okTardo: (duracion: string): string => `Tardó ${duracion}.`,
  okEn: (carpeta: string): string => `En ${carpeta}`,
  mostrar: 'Mostrar en la carpeta',
  errorTitulo: 'No se pudo exportar el video',
  errorPosicion: (actual: string, total: string): string => `Se detuvo en ${actual} de ${total}.`,
  errorPosicionPreparando: 'Se detuvo mientras preparaba la canción.',
  errorConservado: 'El archivo que ya había con ese nombre no se ha tocado.',
  reintentar: 'Reintentar',
  cambiarOpciones: 'Cambiar opciones',
  noSeCancelo: 'No se pudo cancelar la exportación.',
  noSeReintento: 'No se pudo volver a exportar el video.'
} as const

export const EXP_TOAST = {
  ok: (titulo: string): string => `«${titulo}»: video exportado.`,
  error: (titulo: string): string => `«${titulo}»: no se pudo exportar el video.`,
  ver: 'Ver',
  cancelada: 'Exportación cancelada.',
  quitada: (titulo: string): string => `«${titulo}» ya no está en la cola de exportación.`,
  noExiste: 'El video ya no está en esa carpeta.',
  interrumpida: (titulo: string): string =>
    `La exportación de «${titulo}» no terminó porque Shinobi Karaoke se cerró.`,
  exportar: 'Exportar video…',
  limpieza: 'No se pudo borrar un archivo temporal. Puedes borrarlo a mano.'
} as const

export const EXP_ANUNCIO = {
  inicio: (titulo: string): string => `Exportando «${titulo}».`,
  fase: {
    preparando: EXP_PROGRESO.fasePreparando,
    codificando: 'Creando el video…',
    finalizando: EXP_PROGRESO.faseTerminando
  },
  porcentaje: (n: number): string => `Creando el video: ${n} %.`,
  ok: 'Video exportado.',
  cancelada: 'Exportación cancelada.'
} as const

/** `act.exp` y `bib.exp.*`: panel de actividad y tarjeta de la Biblioteca (0240). */
export const EXP_ACTIVIDAD = {
  enCurso: (n: number): string => `Exportando video ${n} %`,
  enCola: 'En cola para exportar',
  preparando: 'Preparando el video…',
  terminando: 'Terminando el video…',
  lineaTarjeta: (n: number, eta: string | null): string =>
    `Exportando video ${n} %${eta ? ` · ${eta}` : ''}`,
  lineaTarjetaIndeterminada: 'Exportando video…'
} as const

/** `exp.eliminar.extra`: se añade al texto de «Eliminar…». */
export const EXP_ELIMINAR_EXTRA = 'Se cancelará la exportación de video en curso.'

/** `exp.cierre.*`: diálogo de cierre con trabajos (spec 04 §3). */
export const EXP_CIERRE = {
  item: (titulo: string): string => `exportar «${titulo}»`,
  extra: 'Los videos a medio exportar no se guardarán; los archivos que ya existían no se tocan.'
} as const

/** Menú ⋯ (`bib.menu.exportar`, `edi.menu.exportar`) y motivos de «no disponible». */
export const EXP_MENU = {
  exportar: 'Exportar video…',
  exportarEditor: 'Exportar video… (Ctrl/Cmd + E)',
  ver: 'Ver exportación',
  cancelar: 'Cancelar exportación…',
  sinPistas: 'Podrás exportar cuando termine la separación.',
  sinLineas: 'Sincroniza al menos una línea para exportar.',
  /** Modo «Sincronizar al ritmo» o «Error de audio» (texto provisional: la spec no lo define). */
  noDisponible: 'No se puede exportar ahora mismo.',
  atajo: 'Exportar video'
} as const

/** `edi.exp.guardado`. */
export const EXP_GUARDADO = {
  titulo: 'No se pudieron guardar los últimos cambios',
  cuerpo:
    'Si exportas ahora, el video no los incluirá. Shinobi Karaoke seguirá intentando guardarlos.',
  quedarme: 'Quedarme en el editor',
  igualmente: 'Exportar igualmente'
} as const

/** Duración real del trabajo («7 min 12 s»). */
export function formatearDuracionTrabajo(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s} s`
  return s === 0 ? `${m} min` : `${m} min ${s} s`
}
