/** Textos del diálogo de consentimiento del modelo Rápido (docs/ux/01, claves `rapido.*`, literales). */

export type MotivoRapido = 'preparar' | 'memoria' | 'descarga'

export const RAPIDO = {
  ofertaBoton: 'Usar el modelo Rápido…',
  oferta:
    'Si no puedes esperar, hay otra opción: el modelo Rápido, más ligero. Antes de usarlo, lee el aviso.',
  ofertaEspacio: (n: string) =>
    `Si no puedes liberar espacio, hay otra opción: el modelo Rápido, que ocupa mucho menos (${n}). Antes de usarlo, lee el aviso.`,
  titulo: '¿Usar el modelo Rápido?',
  motivo: {
    preparar: 'No hemos podido preparar el modelo Calidad.',
    memoria: 'Tu equipo no tiene memoria suficiente para el modelo Calidad.',
    descarga: 'No hemos podido descargar de nuevo el modelo Calidad.'
  } satisfies Record<MotivoRapido, string>,
  cuerpo:
    'El modelo Rápido es más ligero y necesita menos memoria, pero puede dejar algo más de voz de fondo en el karaoke.',
  avisoTitulo: 'Antes de aceptar',
  licencia: 'Sus autores (la comunidad UVR) no han declarado bajo qué licencia se puede usar.',
  origen: (tamano: string | null) =>
    tamano === null
      ? 'Shinobi Karaoke no lo distribuye: se descargó desde su origen.'
      : `Shinobi Karaoke no lo distribuye: se descarga desde su origen (${tamano}).`,
  responsabilidad: 'Si lo usas, es bajo tu responsabilidad.',
  creditos: 'Ver créditos y licencias de terceros',
  alcance:
    'Se usará en todas las separaciones a partir de ahora. Podrás volver al modelo Calidad desde Ajustes.',
  cancelar: 'Cancelar',
  aceptar: 'Usar el modelo Rápido',
  anuncioDescargando: 'Descargando el modelo Rápido.'
} as const
