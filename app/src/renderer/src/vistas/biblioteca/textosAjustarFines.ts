/** Textos de «Ajustar los fines…» sobre una letra sin marca (docs/ux/02 · 0.2.2 · Feature 5, `bib.prep.fines.*`). */
export const BIB_FINES = {
  menu: 'Ajustar los fines…',
  titulo: (titulo: string): string => `¿Ajustar los fines de «${titulo}»?`,
  intro: 'Esta letra viene de una versión anterior de Shinobi Karaoke y puede tener cambios tuyos.',
  soloPondremos: (n: number): string =>
    n === 1
      ? 'Solo pondremos fin a la línea que no lo tiene, donde la voz se para claramente.'
      : `Solo pondremos fin a las ${n} líneas que no lo tienen, donde la voz se para claramente.`,
  noMoveremos: 'No moveremos ningún inicio, ni los fines que ya tienes, ni la letra entera.',
  podrasQuitar: 'Podrás quitar esos fines desde el editor («Quitar esos fines»).',
  cancelar: 'Cancelar',
  confirmar: 'Ajustar los fines',
  toast: (titulo: string): string => `Ajustando los fines de «${titulo}»…`,
  toastFin: (titulo: string, k: number, n: number): string =>
    k === 0
      ? `No encontramos pausas claras en «${titulo}»: no hemos cambiado nada.`
      : `Pusimos fin a ${k} de ${n} líneas de «${titulo}». Las demás no tenían una pausa clara.`,
  verLaLetra: 'Ver la letra'
} as const
