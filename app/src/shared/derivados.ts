import type { Cancion, NombrePaso } from './cancion'
import { NOMBRES_PASO } from './cancion'
import { contarLineas, numerosLineasSinInicio } from './letra'

/** Paso actual derivado (no se guarda): el primero no completado; `lista` si la canción está lista. */
export type PasoActual = NombrePaso | 'lista'

export function pasoActual(cancion: Cancion): PasoActual {
  if (cancion.estado === 'lista') return 'lista'
  for (const paso of NOMBRES_PASO) {
    if (cancion.pasos[paso].estado !== 'completado') return paso
  }
  return 'edicion'
}

/** Etiqueta orientativa de 01-pipeline.md: borrador:fuente | borrador:separando | borrador:letra | borrador:edicion | lista. */
export function etiquetaPasoActual(cancion: Cancion): string {
  const paso = pasoActual(cancion)
  if (paso === 'lista') return 'lista'
  if (paso === 'separacion') {
    return cancion.pasos.separacion.estado === 'en_curso'
      ? 'borrador:separando'
      : 'borrador:separacion'
  }
  return `borrador:${paso}`
}

export type CodigoMotivo = 'FUENTE_INCOMPLETA' | 'SIN_PISTAS' | 'SIN_LETRA' | 'LINEAS_SIN_INICIO'

export interface MotivoNoLista {
  codigo: CodigoMotivo
  mensaje: string
  /** Para LINEAS_SIN_INICIO: números (base 1, solo líneas) de las líneas sin inicio. */
  lineas?: number[]
}

function listaNumeros(numeros: number[]): string {
  return numeros.length === 1 ? `la línea ${numeros[0]}` : `las líneas ${numeros.join(', ')}`
}

/** Motivos por los que la canción aún no puede marcarse como lista (vacío = puede). */
export function motivosParaNoEstarLista(cancion: Cancion): MotivoNoLista[] {
  const motivos: MotivoNoLista[] = []
  if (cancion.pasos.fuente.estado !== 'completado') {
    motivos.push({ codigo: 'FUENTE_INCOMPLETA', mensaje: 'Falta terminar de preparar el audio.' })
  }
  if (cancion.pasos.separacion.estado !== 'completado' || cancion.pistas === null) {
    motivos.push({ codigo: 'SIN_PISTAS', mensaje: 'Faltan las pistas de voz e instrumental.' })
  }
  if (contarLineas(cancion.letra) === 0) {
    motivos.push({ codigo: 'SIN_LETRA', mensaje: 'La canción no tiene letra.' })
  } else {
    const sinInicio = numerosLineasSinInicio(cancion.letra)
    if (sinInicio.length > 0) {
      motivos.push({
        codigo: 'LINEAS_SIN_INICIO',
        mensaje: `Falta sincronizar ${listaNumeros(sinInicio)}.`,
        lineas: sinInicio
      })
    }
  }
  return motivos
}

export function puedeMarcarseLista(cancion: Cancion): boolean {
  return motivosParaNoEstarLista(cancion).length === 0
}

/** Lista con líneas sin inicio (el reproductor las omite y la UX avisa). Derivado, no se guarda. */
export function estaIncompleta(cancion: Cancion): boolean {
  return cancion.estado === 'lista' && numerosLineasSinInicio(cancion.letra).length > 0
}

export type VistaContinuar = 'anadir' | 'progreso' | 'letra' | 'editor'

export interface OpcionesVista {
  /** El usuario ya vio el progreso de la separación en curso (ux/00 §3): con separación en curso y sin letra, abre Letra. */
  progresoVisto?: boolean
}

/** Vista que abre "Continuar" (ux/00-mapa-de-vistas.md §3). Para canciones listas, "Editar" abre el editor. */
export function vistaAlContinuar(cancion: Cancion, opciones: OpcionesVista = {}): VistaContinuar {
  if (cancion.estado === 'lista') return 'editor'
  const { fuente, separacion } = cancion.pasos
  if (fuente.estado === 'en_curso') return 'progreso'
  if (fuente.estado !== 'completado') return 'anadir'
  if (contarLineas(cancion.letra) > 0) return 'editor'
  if (separacion.estado === 'completado') return 'letra'
  if (separacion.estado === 'en_curso' && opciones.progresoVisto) return 'letra'
  return 'progreso'
}
