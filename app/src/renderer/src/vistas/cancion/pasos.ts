import type { ResumenCancionIpc } from '@shared/ipc'
import type { PasoCancion } from '../../navegacion/estado'
import type { TrabajoVivo } from '../biblioteca/tarjeta'

/** Indicador de un paso del stepper (docs/ux/00 §2): ✓ ⟳ % "En cola" ✕ ⚠ ● ○. */
export type IndicadorPaso =
  'completado' | 'curso' | 'error' | 'interrumpido' | 'actual' | 'pendiente'

export interface DatosPaso {
  paso: PasoCancion
  numero: number
  etiqueta: string
  indicador: IndicadorPaso
  /** Texto junto a la etiqueta: "42 %" o "En cola". */
  detalle: string | null
  /** Texto para lectores de pantalla (estado del paso). */
  descripcion: string
  navegable: boolean
  /** Motivo por el que no es navegable (tooltip); `null` si lo es. */
  motivo: string | null
  actual: boolean
}

export const PASOS: readonly { paso: PasoCancion; etiqueta: string }[] = [
  { paso: 'fuente', etiqueta: 'Fuente' },
  { paso: 'progreso', etiqueta: 'Separación' },
  { paso: 'letra', etiqueta: 'Letra' },
  { paso: 'editor', etiqueta: 'Editor' }
]

/** Motivos definitivos de un paso no navegable (docs/ux/00 §2, claves `paso.motivo.*`). */
export const MOTIVOS = {
  'paso.motivo.sinFuente': 'Primero añade el audio',
  'paso.motivo.descargando': 'Espera a que termine la descarga',
  'paso.motivo.sinLetra': 'Primero elige una letra'
} as const

const DESCRIPCION: Record<IndicadorPaso, string> = {
  completado: 'completado',
  curso: 'en curso',
  error: 'con error',
  interrumpido: 'interrumpido',
  actual: 'paso actual',
  pendiente: 'pendiente'
}

type EstadoPersistido = 'pendiente' | 'en_curso' | 'completado' | 'error' | 'interrumpido'

function indicadorDe(estado: EstadoPersistido): IndicadorPaso {
  switch (estado) {
    case 'completado':
      return 'completado'
    case 'en_curso':
      return 'curso'
    case 'error':
      return 'error'
    case 'interrumpido':
      return 'interrumpido'
    default:
      return 'pendiente'
  }
}

const porcentaje = (v: number): string => `${Math.round(Math.min(1, Math.max(0, v)) * 100)} %`

/** Un paso: indicador de lo persistido, con prioridad para el trabajo vivo (ya refleja el progreso). */
function datosDePaso(
  paso: PasoCancion,
  persistido: EstadoPersistido,
  progresoPersistido: number | null,
  vivo: TrabajoVivo | null,
  actual: boolean
): Pick<DatosPaso, 'indicador' | 'detalle'> {
  let indicador = indicadorDe(persistido)
  let detalle: string | null = null
  if (paso === 'progreso' && persistido === 'en_curso' && progresoPersistido !== null) {
    detalle = porcentaje(progresoPersistido)
  }
  if (vivo) {
    if (vivo.trabajo.estado === 'en_cola') {
      indicador = 'pendiente'
      detalle = 'En cola'
    } else {
      indicador = 'curso'
      const valor = vivo.progreso?.valor ?? vivo.trabajo.progreso?.valor ?? null
      if (paso === 'progreso') detalle = valor === null ? detalle : porcentaje(valor)
    }
  }
  if (indicador === 'pendiente' && actual && detalle === null) indicador = 'actual'
  return { indicador, detalle }
}

/** Pasos del stepper de una canción existente a partir del resumen y de los trabajos vivos. */
export function pasosDeCancion(
  resumen: ResumenCancionIpc,
  actual: PasoCancion,
  vivos: { fuente?: TrabajoVivo | null; separacion?: TrabajoVivo | null } = {}
): DatosPaso[] {
  const pasos = resumen.pasos
  const fuente = pasos?.fuente
  const separacion = pasos?.separacion
  const tieneLetra = pasos?.letra.estado === 'completado'
  const fuenteLista = fuente?.estado === 'completado'
  const fuenteViva = fuenteLista || fuente?.estado === 'en_curso' || !!vivos.fuente
  const lista = resumen.estado === 'lista'
  // Fuente descargándose (o en cola para descargar): Letra y Editor esperan a que termine.
  const descargando = fuente?.estado === 'en_curso' || !!vivos.fuente
  const sinFuente = MOTIVOS[descargando ? 'paso.motivo.descargando' : 'paso.motivo.sinFuente']

  const navegable: Record<PasoCancion, [boolean, string]> = {
    fuente: [!resumen.danada, MOTIVOS['paso.motivo.sinFuente']],
    progreso: [fuenteViva === true, MOTIVOS['paso.motivo.sinFuente']],
    letra: [fuenteLista, sinFuente],
    editor: [tieneLetra, fuenteLista ? MOTIVOS['paso.motivo.sinLetra'] : sinFuente]
  }

  return PASOS.map(({ paso, etiqueta }, i) => {
    const esActual = paso === actual
    let datos: Pick<DatosPaso, 'indicador' | 'detalle'>
    switch (paso) {
      case 'fuente':
        datos = datosDePaso(
          paso,
          fuente?.estado ?? 'pendiente',
          fuente?.progreso ?? null,
          vivos.fuente ?? null,
          esActual
        )
        break
      case 'progreso':
        datos = datosDePaso(
          paso,
          separacion?.estado ?? 'pendiente',
          separacion?.progreso ?? null,
          vivos.separacion ?? null,
          esActual
        )
        break
      case 'letra':
        datos = datosDePaso(paso, tieneLetra ? 'completado' : 'pendiente', null, null, esActual)
        break
      default:
        datos = datosDePaso(paso, lista ? 'completado' : 'pendiente', null, null, esActual)
    }
    const [esNavegable, motivo] = navegable[paso]
    return construir(paso, i + 1, etiqueta, datos, esNavegable, motivo, esActual)
  })
}

/** Pasos del modo "Nueva canción": el 1 es el actual y el resto no es navegable. */
export function pasosDeNueva(): DatosPaso[] {
  return PASOS.map(({ paso, etiqueta }, i) =>
    construir(
      paso,
      i + 1,
      etiqueta,
      { indicador: i === 0 ? 'actual' : 'pendiente', detalle: null },
      i === 0,
      i === 0 ? null : MOTIVOS['paso.motivo.sinFuente'],
      i === 0
    )
  )
}

function construir(
  paso: PasoCancion,
  numero: number,
  etiqueta: string,
  { indicador, detalle }: Pick<DatosPaso, 'indicador' | 'detalle'>,
  navegable: boolean,
  motivo: string | null,
  actual: boolean
): DatosPaso {
  const base = DESCRIPCION[indicador]
  return {
    paso,
    numero,
    etiqueta,
    indicador,
    detalle,
    descripcion: detalle ? `${base}, ${detalle}` : base,
    navegable,
    motivo: navegable ? null : motivo,
    actual
  }
}
