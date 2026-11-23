import type { LineaDudosa, MotivoDudosa } from '@shared/dudosas'

/** Microcopy de «Revisión guiada» en el editor (spec 06 · Feature 11, claves `edi.revision.*`). */
const seg = (ms: number): string => (ms / 1000).toFixed(1).replace('.', ',')

export const R = {
  funciones: {
    titulo: 'Revisar la sincronía',
    ayuda:
      'Te lleva solo por las líneas que conviene escuchar: las que pueden tener el fin mal puesto o una duración rara.',
    boton: (n: number | null): string => (n === null || n === 0 ? 'Revisar…' : `Revisar (${n})…`)
  },
  resumen: (p: number, b: number): string =>
    `${p === 1 ? '1 línea por revisar' : `${p} líneas por revisar`} · ${b} dadas por buenas`,
  nada: 'No vemos nada raro en esta canción.',
  sinVoz: 'Cuando la voz esté separada podremos señalar más líneas.',
  reiniciar: 'Volver a señalarlas',
  region: 'Revisión guiada',
  titulo: (p: number, t: number): string => `Revisión · quedan ${p} de ${t}`,
  salir: 'Salir de la revisión (Esc)',
  motivo: (m: MotivoDudosa, d?: number, finAutomatico = false): string => {
    const s = seg(d ?? 0)
    switch (m) {
      case 'sinInicio':
        return 'Aún no tiene inicio.'
      case 'sinVoz':
        return 'Casi no se oye voz mientras dura esta línea.'
      case 'reconocimiento':
        return 'La sincronía automática no la reconoció bien.'
      case 'vozTarde':
        return `La voz empieza ${s} s después del inicio.`
      case 'finCorta':
        return `El fin corta la voz: sigue ${s} s más.`
      case 'finTarde':
        return finAutomatico
          ? `El fin es automático y llega ${s} s después de la voz.`
          : `El fin llega ${s} s después de la voz.`
      case 'muyCorta':
        return `Dura muy poco para su texto (${s} s).`
      case 'muyLarga':
        return `Dura mucho para su texto (${s} s).`
    }
  },
  tambien: (motivo: string): string => `También: ${minuscula(motivo)}`,
  escuchar: 'Escuchar otra vez',
  escucharNombre: 'Escuchar la línea otra vez (Mayús + L)',
  finVoz: 'Fin al final de la voz',
  fijarInicio: 'Fijar inicio aquí (I)',
  sinSilencio: 'No encontramos un silencio después de esta línea.',
  bien: (n: number): string => `Está bien (${n})`,
  bienCorregida: (n: number): string => `Siguiente (${n})`,
  bienPanel: 'Está bien',
  noSinInicio: 'Fija primero su inicio.',
  anterior: 'Anterior',
  siguiente: 'Siguiente',
  anteriorAtajo: 'Anterior (Ctrl + ↑ / ⌘↑)',
  siguienteAtajo: 'Siguiente (Ctrl + ↓ / ⌘↓)',
  siguienteDudosa: 'Línea dudosa siguiente (Ctrl + ↓ / ⌘↓)',
  vuelta: 'Has llegado al final: sigue por la primera pendiente.',
  autoescucha: 'Escuchar cada línea al llegar',
  corregida: '✓ Ya no vemos nada raro en esta línea.',
  fuera: 'Esta línea no está señalada.',
  volver: 'Volver a la revisión',
  fin: (t: number): string =>
    t === 1
      ? 'Has revisado la línea señalada. Pruébala entera antes de darla por terminada.'
      : `Has revisado las ${t} líneas señaladas. Pruébala entera antes de darla por terminada.`,
  finTitulo: 'Revisión terminada',
  finMarcar: 'Si todo cuadra, usa «Marcar como lista».',
  finHecho: 'Si todo cuadra, pulsa «Hecho».',
  nadaFin: 'No vemos nada raro. Puedes probarla a pantalla completa.',
  faltaInicio: (k: number): string =>
    k === 1
      ? 'Queda 1 línea sin inicio: fíjalo para poder marcar la canción como lista.'
      : `Quedan ${k} líneas sin inicio: fíjalo para poder marcar la canción como lista.`,
  probar: 'Probar a pantalla completa (F)',
  pendientes: (p: number): string =>
    p === 1 ? 'Queda 1 línea por revisar.' : `Quedan ${p} líneas por revisar.`,
  revisarAhora: 'Revisar ahora',
  marcarIgualmente: 'Marcar igualmente',
  tooltip: (motivo: string): string => `Por revisar: ${minuscula(motivo)}`,
  ariaLinea: (motivo: string): string => `, por revisar: ${minuscula(motivo)}`,
  anuncio: (n: number, texto: string, motivo: string, p: number): string =>
    `Línea ${n}: «${texto}». ${motivo} Quedan ${p}.`,
  pestana: 'Sincronía, hay una revisión en curso',
  marcaPanel: 'Línea por revisar'
}

export function minuscula(texto: string): string {
  const t = texto.replace(/\.$/, '')
  return t.charAt(0).toLowerCase() + t.slice(1)
}

/** Texto del motivo principal de una línea dudosa, con sus cifras. */
export function motivoPrincipal(d: LineaDudosa): string {
  const m = d.motivos[0]!
  return R.motivo(m, d.detalles[m], d.finAutomatico)
}
