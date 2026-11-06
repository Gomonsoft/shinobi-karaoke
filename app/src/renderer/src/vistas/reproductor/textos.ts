import { formatearDesplazamiento } from '@shared/letras/tiempos'

export const R = {
  salir: 'Salir',
  pausa: '❚❚ En pausa',
  cargando: 'Cargando…',
  otravez: 'Otra vez',
  volver: {
    biblioteca: 'Volver a la biblioteca',
    editor: 'Volver al editor'
  },
  cierre: (n: number): string => `Se cerrará en ${n} s…`,
  original: 'Vista previa con la canción original: aún no hay pista instrumental.',
  voz: 'Voz',
  vozNoDisponible: 'La voz guía no está disponible en esta canción.',
  incompleta: (n: number): string =>
    n === 1
      ? '⚠ Falta 1 línea por sincronizar: no se verá.'
      : `⚠ Faltan ${n} líneas por sincronizar: no se verán.`,
  offset: (ms: number): string => `Desplazamiento: ${formatearDesplazamiento(ms)}`,
  ind: {
    reproducir: '▶',
    pausa: '❚❚',
    saltar: { [-5000]: '−5 s', 5000: '+5 s', [-10000]: '−10 s', 10000: '+10 s' },
    volumen: (n: number): string => `Volumen ${n} %`,
    silenciado: 'Silenciado',
    principio: 'Al principio',
    voz: (n: number): string => `Voz ${n} %`,
    vozSilenciada: 'Voz silenciada'
  },
  error: {
    titulo: 'No se puede reproducir esta canción.',
    pistas:
      'Falta su pista instrumental. Puedes volver a separarla desde la biblioteca: menú ⋯ › Re-separar pistas.',
    mezcla: 'Falta el audio de la canción.',
    audio: 'No se ha podido leer su audio. Si vuelve a pasar, copia los detalles para pedir ayuda.'
  },
  copiar: 'Copiar detalles',
  tooltip: {
    salir: 'Salir (Esc)',
    reproducir: 'Reproducir (Espacio)',
    pausa: 'Pausa (Espacio)',
    principio: 'Al principio (Inicio)',
    retroceder: 'Retroceder 5 s (←)',
    avanzar: 'Avanzar 5 s (→)',
    silenciarVoz: 'Silenciar la voz guía (V)',
    activarVoz: 'Activar la voz guía (V)',
    nivelVoz: 'Voz guía (Mayús + ↑ ↓)',
    silenciar: 'Silenciar (M)',
    activarSonido: 'Activar sonido (M)',
    volumen: 'Volumen (↑ ↓)',
    atajos: 'Atajos de teclado (F1)',
    completa: 'Pantalla completa (F)',
    ventana: 'Ver en una ventana (F)'
  },
  atajos: { titulo: 'Atajos de teclado' },
  aria: {
    vozguia: 'Volumen de la voz guía',
    volumen: 'Volumen general',
    region: (titulo: string): string => `Reproductor de «${titulo}»`,
    inicio: (titulo: string, artista: string): string =>
      `Reproduciendo «${titulo}», de ${artista}.`,
    fin: 'Fin de la canción.'
  }
}
