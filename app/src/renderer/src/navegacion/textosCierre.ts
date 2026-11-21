import { SES } from '../sesion/textos'

/** Textos del diálogo de cierre con trabajos pendientes (docs/ux/04 §3: `cierre.*`). */

export const TEXTO_CIERRE = {
  titulo: '¿Cerrar Shinobi Karaoke?',
  seguir: 'Seguir trabajando',
  cerrar: 'Cerrar de todos modos'
} as const

/** Máximo de títulos que se nombran en el diálogo; el resto se resume en "y {k} más". */
export const MAX_TITULOS_CIERRE = 3

/** «A», «B» y «C» · «A», «B», «C» y 2 más. */
export function listaBreve(titulos: readonly string[]): string {
  const citados = titulos.slice(0, MAX_TITULOS_CIERRE).map((t) => `«${t}»`)
  const resto = titulos.length - citados.length
  if (resto > 0) return `${citados.join(', ')} y ${resto} más`
  if (citados.length <= 1) return citados.join('')
  return `${citados.slice(0, -1).join(', ')} y ${citados[citados.length - 1]}`
}

/** `cierre.cuerpo`; sin títulos conocidos se omite el paréntesis. */
export function cuerpoCierre(
  n: number,
  titulos: readonly string[],
  motivo?: { sesion: boolean; cola: boolean; variante: 'salir' | 'cerrarVentanaMac' }
): string {
  const hay = n === 1 ? 'Hay 1 trabajo' : `Hay ${n} trabajos`
  const lista = titulos.length > 0 ? ` (${listaBreve(titulos)})` : ''
  const base = `${hay} sin terminar${lista}. Si cierras ahora, se cancelarán y tendrás que repetirlos. Tu letra y tu estilo están guardados.`
  if (!motivo || !(motivo.sesion || motivo.cola)) return base
  // `ses.salir.extra`; en macOS la cola se conserva, así que solo se avisa del reproductor.
  return `${base} ${motivo.variante === 'salir' ? SES.salir.extra : SES.salir.extraMac}`
}

/** `ses.salir` con sus variantes: sesión, sin sesión con cola y macOS al cerrar la ventana. */
export function textosSalirConSesion(motivo: {
  sesion: boolean
  variante: 'salir' | 'cerrarVentanaMac'
}): { titulo: string; cuerpo: string; cancelar: string; confirmar: string } {
  const t = SES.salir
  if (motivo.variante === 'cerrarVentanaMac')
    return { titulo: t.tituloMac, cuerpo: t.cuerpoMac, cancelar: t.cancelar, confirmar: t.cerrar }
  return {
    titulo: t.titulo,
    cuerpo: motivo.sesion ? t.cuerpo : t.cuerpoSinSesion,
    cancelar: t.cancelar,
    confirmar: t.salir
  }
}
