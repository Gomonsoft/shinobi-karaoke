/** Fase 5 · 0214 (spec 06-editor, LL). Claves `edi.letraLista.*`, `edi.falta.titulo.letra` y `edi.contraste.soloEditor`. */
export const LL = {
  boton: 'Marcar como letra lista',
  faltaTitulo: 'Para marcarla como letra lista falta:',
  dialogoTitulo: '¿Marcar como letra lista?',
  dialogoCuerpo:
    'La letra aparecerá sincronizada por línea. Durante la reproducción y en el video, el texto se mostrará sin barrido ni cambio de color de progreso. Puedes seguir revisando el barrido en el editor.',
  noVolverAMostrar: 'No volver a mostrar este aviso',
  confirmarCambio: 'Cambiar a «Letra lista»',
  estado: 'Letra lista',
  incompleta: (n: number): string => (n === 1 ? 'Falta 1 línea' : `Faltan ${n} líneas`),
  toastCambio: 'Esta canción se reproducirá sin barrido (letra lista).',
  toastKaraoke: 'Esta canción se reproducirá con barrido (lista).',
  errorMarcar: 'No se pudo marcar la canción como letra lista.',
  errorCambiar: 'No se pudo cambiar la modalidad de la canción.',
  contrasteSoloEditor: 'Solo afecta al editor: esta canción se reproduce sin barrido.'
} as const
