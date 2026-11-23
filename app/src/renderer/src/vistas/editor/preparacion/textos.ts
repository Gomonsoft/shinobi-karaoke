/** Textos del editor para la preparación automática (docs/ux/06 · Feature 5 y banner de la Feature 11). */
export const EP = {
  titulo: 'Preparación automática',
  intro: (fecha: string): string => `Shinobi Karaoke preparó esta canción el ${fecha}:`,
  letraApp: 'Letra de LRCLIB, coincidencia exacta.',
  letraUsuario: 'Letra de LRCLIB, elegida por ti.',
  verOtras: 'Ver otras candidatas',
  fines: (n: number): string =>
    n === 1 ? 'Fin de 1 línea ajustado con la voz.' : `Fin de ${n} líneas ajustado con la voz.`,
  quitarFines: 'Quitar esos fines',
  toastFines: (n: number): string =>
    n === 1 ? '1 línea vuelve al fin automático.' : `${n} líneas vuelven al fin automático.`,
  banner: {
    preparada:
      'Shinobi Karaoke preparó esta canción sola. Escúchala, corrige lo que no coincida y márcala como lista.',
    revision: (p: number): string =>
      p === 1
        ? 'Shinobi Karaoke preparó esta canción y señaló 1 línea para que la escuches.'
        : `Shinobi Karaoke preparó esta canción y señaló ${p} líneas para que las escuches.`,
    nada: 'Shinobi Karaoke preparó esta canción y no ve nada raro. Pruébala y márcala como lista.',
    empezar: 'Empezar la revisión',
    verQueHicimos: 'Ver qué hicimos',
    probar: 'Probar a pantalla completa',
    cerrar: 'Cerrar aviso'
  }
} as const
