import type { Cancion, NombrePaso } from './cancion'
import { NOMBRES_PASO } from './cancion'
import { contarLineas, finEfectivo, numerosLineasSinInicio, type Letra } from './letra'

/** Paso actual derivado (no se guarda): el primero no completado; `lista` si la canción está lista. */
export type PasoActual = NombrePaso | 'lista'

export function pasoActual(cancion: Cancion): PasoActual {
  if (cancion.estado === 'lista') return 'lista'
  for (const paso of NOMBRES_PASO) {
    if (cancion.pasos[paso].estado !== 'completado') return paso
  }
  return 'edicion'
}

/**
 * Regla de `pasos.letra` (ADR 0006, Revisión 2026-11-05): `completado` con al menos una línea; si no,
 * `pendiente`. Nunca `en_curso` ni `error` (la búsqueda no es un trabajo).
 */
export function estadoPasoLetra(
  letra: Pick<Letra, 'lineas'> | null | undefined
): 'completado' | 'pendiente' {
  return contarLineas(letra) >= 1 ? 'completado' : 'pendiente'
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

export type CodigoMotivo =
  'FUENTE_INCOMPLETA' | 'SIN_PISTAS' | 'SIN_LETRA' | 'LINEAS_SIN_INICIO' | 'FIN_NO_VALIDO'

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

/** Números (base 1, solo líneas) de las líneas con inicio cuyo fin efectivo no es válido. */
function lineasConFinNoValido(cancion: Cancion): number[] {
  const elementos = cancion.letra?.lineas ?? []
  const numeros: number[] = []
  let numero = 0
  elementos.forEach((el, i) => {
    if (el.tipo === 'linea') numero++
    if (el.tipo !== 'linea' || el.inicio_ms === null) return
    const fin = finEfectivo(cancion.letra!, el.id, cancion.metadatos.duracion_ms)
    const siguiente = elementos.slice(i + 1).find((e) => e.inicio_ms !== null)
    const tope = siguiente?.inicio_ms ?? Infinity
    if (fin === null || fin <= el.inicio_ms || fin > tope) numeros.push(numero)
  })
  return numeros
}

/** Motivos de Lista más `FIN_NO_VALIDO` (ADR 0018 §5): requisitos de la modalidad «Letra lista». */
export function motivosParaNoEstarLetraLista(cancion: Cancion): MotivoNoLista[] {
  const motivos = motivosParaNoEstarLista(cancion)
  const invalidas = lineasConFinNoValido(cancion)
  if (invalidas.length > 0) {
    motivos.push({
      codigo: 'FIN_NO_VALIDO',
      mensaje: `El final de ${listaNumeros(invalidas)} no es válido.`,
      lineas: invalidas
    })
  }
  return motivos
}

export function puedeMarcarseLetraLista(cancion: Cancion): boolean {
  return motivosParaNoEstarLetraLista(cancion).length === 0
}

/** Lista con líneas sin inicio (el reproductor las omite y la UX avisa). Derivado, no se guarda. */
export function estaIncompleta(cancion: Cancion): boolean {
  return cancion.estado === 'lista' && numerosLineasSinInicio(cancion.letra).length > 0
}

export type VistaContinuar = 'anadir' | 'progreso' | 'letra' | 'editor'

export interface OpcionesVista {
  /** El usuario ya vio el progreso de la separación en curso (ux/00 §3): con separación en curso y sin letra, abre Letra. */
  progresoVisto?: boolean
  /** Hay un trabajo de fuente vivo (p. ej. una descarga en cola): la fuente `pendiente` no abre Añadir. */
  fuenteEnCola?: boolean
}

/** Vista que abre "Continuar" (ux/00-mapa-de-vistas.md §3). Para canciones listas, "Editar" abre el editor. */
export function vistaAlContinuar(cancion: Cancion, opciones: OpcionesVista = {}): VistaContinuar {
  if (cancion.estado === 'lista') return 'editor'
  const { fuente, separacion } = cancion.pasos
  if (fuente.estado === 'en_curso') return 'progreso'
  if (fuente.estado === 'pendiente' && opciones.fuenteEnCola) return 'progreso'
  if (fuente.estado !== 'completado') return 'anadir'
  if (contarLineas(cancion.letra) > 0) return 'editor'
  if (separacion.estado === 'completado') return 'letra'
  if (separacion.estado === 'en_curso' && opciones.progresoVisto) return 'letra'
  return 'progreso'
}

/**
 * Estado de preparación que ve el usuario (ADR 0025 §1). Se deriva, no se guarda: «Lista para revisar» es
 * un borrador al que no le falta nada salvo el visto bueno (da igual quién lo hizo); los demás salen del
 * registro `preparacion` y solo valen mientras falte la letra.
 */
export type EstadoPreparacionDerivado =
  | 'lista_para_revisar'
  | 'preparando'
  | 'elige_letra'
  | 'sin_letra'
  | 'instrumental'
  | 'letra_pendiente'
  | 'detenida'
  | 'error'

export function estadoPreparacion(cancion: Cancion): EstadoPreparacionDerivado | null {
  if (cancion.estado !== 'borrador') return null
  if (puedeMarcarseLista(cancion)) return 'lista_para_revisar'
  const p = cancion.preparacion
  if (!p) return null
  if (p.estado === 'en_curso') return 'preparando'
  if (p.estado === 'detenida') return 'detenida'
  // Búsqueda sin respuesta por red o servicio: «Letra pendiente», no un error de la canción.
  if (p.busqueda?.resultado === 'pendiente' && contarLineas(cancion.letra) === 0) {
    return 'letra_pendiente'
  }
  if (p.estado === 'error') return 'error'
  // Los resultados de la búsqueda solo importan mientras no haya letra.
  if (contarLineas(cancion.letra) > 0) return null
  if (p.estado === 'elige_letra') return 'elige_letra'
  if (p.estado === 'sin_letra')
    return p.busqueda?.motivo === 'INSTRUMENTAL' ? 'instrumental' : 'sin_letra'
  return null
}

/** Lo mínimo de un resumen para contar la bandeja de pendientes (spec 02 · Feature 5). */
export interface ResumenParaBandeja {
  estado: 'borrador' | 'lista'
  danada: boolean
  estadoPreparacion?: EstadoPreparacionDerivado | null
  pasos: Record<NombrePaso, { estado: string }> | null
}

export interface RecuentosBandeja {
  listasParaRevisar: number
  esperanLetra: number
  conError: number
}

/**
 * Casillas de «Pendientes de ti»: listas para revisar; borradores que esperan letra (elige, no se
 * encontró, instrumental, pendiente de red o sin búsqueda) y borradores con un paso en error o
 * interrumpido. «Con error» tiene prioridad sobre «Esperan letra».
 */
export function recuentosBandeja(resumenes: ResumenParaBandeja[]): RecuentosBandeja {
  const r: RecuentosBandeja = { listasParaRevisar: 0, esperanLetra: 0, conError: 0 }
  for (const c of resumenes) {
    if (c.estado !== 'borrador' || c.danada || !c.pasos) continue
    const e = c.estadoPreparacion
    if (e === 'lista_para_revisar') {
      r.listasParaRevisar++
      continue
    }
    const fallo = Object.values(c.pasos).some(
      (p) => p.estado === 'error' || p.estado === 'interrumpido'
    )
    if (fallo) {
      r.conError++
      continue
    }
    if (
      e === 'elige_letra' ||
      e === 'sin_letra' ||
      e === 'instrumental' ||
      e === 'letra_pendiente'
    ) {
      r.esperanLetra++
    } else if (
      e !== 'preparando' &&
      c.pasos.fuente.estado === 'completado' &&
      c.pasos.letra.estado !== 'completado'
    ) {
      // «Falta la letra»: sin letra y sin búsqueda (interruptor apagado o canción de antes de 0.2.2).
      r.esperanLetra++
    }
  }
  return r
}
