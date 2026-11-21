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
  /** Fase 4 (spec 07): ventana secundaria y cola. */
  cola: {
    ventana: 'Shinobi Karaoke · Reproductor',
    cerrar: 'Cerrar reproductor',
    tooltipCerrar: 'Cerrar reproductor (Ctrl/Cmd + W)',
    siguiente: 'Siguiente',
    tooltipSiguiente: 'Siguiente canción (Mayús + N)',
    siguienteNo: 'No hay canciones a continuación.',
    reiniciar: 'Reiniciar canción',
    tooltipReiniciar: 'Reiniciar canción (Inicio)',
    cuenta: 'Siguiente canción',
    aContinuacion: 'A continuación',
    empezarYa: 'Empezar ya',
    detener: 'Detener cuenta',
    iniciar: (titulo: string): string => `Iniciar «${titulo}»`,
    espera: 'Enseguida empieza la siguiente canción',
    fin: 'Fin de la cola',
    otraVez: 'Otra vez',
    fallo: 'Esta canción no se puede reproducir ahora.',
    falloFin: 'No hay más canciones en la cola.',
    pasar: 'Pasar a la siguiente canción',
    reanudada: (mmss: string): string => `Reanudada en ${mmss}`,
    aria: {
      cuenta: (titulo: string, artista: string, n: number): string =>
        `A continuación: «${titulo}», de ${artista}. Empieza en ${n} ${n === 1 ? 'segundo' : 'segundos'}.`,
      cambio: (titulo: string, artista: string, n: number): string =>
        `Cambió la siguiente canción: «${titulo}», de ${artista}. Empieza en ${n} ${n === 1 ? 'segundo' : 'segundos'}.`,
      espera: (titulo?: string): string =>
        titulo ? `En espera. A continuación: «${titulo}».` : 'En espera.',
      fin: 'Fin de la cola.',
      reanudada: (mmss: string): string => `Reproducción reanudada en ${mmss}.`
    },
    atajos: {
      siguiente: 'Siguiente canción (sin canciones a continuación no hace nada)',
      cerrar: 'Cerrar el reproductor',
      esc: 'Cerrar el diálogo o pasar de pantalla completa a ventana (nunca cierra)',
      alternar: 'Reproducir / pausa. En la cuenta: Empezar ya. En espera: Iniciar'
    }
  },
  aria: {
    vozguia: 'Volumen de la voz guía',
    volumen: 'Volumen general',
    region: (titulo: string): string => `Reproductor de «${titulo}»`,
    inicio: (titulo: string, artista: string): string =>
      `Reproduciendo «${titulo}», de ${artista}.`,
    reanudacion: 'Reproducción reanudada.',
    fin: 'Fin de la canción.'
  }
}
