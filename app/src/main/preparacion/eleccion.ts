import { claveFlexible } from '../../shared/identidad'
import type { MotivoNoElige as MotivoGuardado } from '../../shared/cancion'
import type { CandidatoLetra, EncajeCandidato } from '../../shared/letrasBusqueda'

/** Diferencia máxima entre la duración del candidato y la del audio (ADR 0025 §3, criterio 2). */
export const DIFERENCIA_DURACION_MAXIMA_MS = 2000

export interface CandidatoEvaluado {
  candidato: CandidatoLetra
  /** Encaje con la voz; `null` sin picos o con un candidato que solo trae texto. */
  encaje: EncajeCandidato | null
}

export type MotivoNoElige =
  'sin_tiempos' | 'duracion' | 'sin_encaje' | 'no_coincide' | 'dudosa' | 'ambigua'

/** Motivo guardado en `busqueda.no_elige` (`let.prep.motivo.*`), respuesta a la pregunta 0235. */
export const NO_ELIGE_GUARDADO: Record<MotivoNoElige, MotivoGuardado> = {
  ambigua: 'varias',
  duracion: 'sinExacta',
  no_coincide: 'noCoincide',
  sin_tiempos: 'soloTexto',
  sin_encaje: 'sinComprobar',
  dudosa: 'duda'
}

export type DecisionEleccion =
  | {
      tipo: 'elige'
      candidato: CandidatoLetra
      /** Corrección que se guarda con la letra; `null` si `coincide` sin más. */
      desfaseMs: number | null
      /**
       * Elegida sin poder comprobarla con la voz (`dudosa` con limitación; ADR 0025, revisión del
       * 2026-11-23): nunca se corrige su desfase. `false` en el camino de siempre.
       */
      sinComprobar: boolean
      /** Limitación del candidato elegido sin comprobar (para el registro de la app). */
      limitacion?: 'vozContinua' | 'sinContraste'
    }
  | { tipo: 'no_elige'; motivo: MotivoNoElige }

/** Texto de la letra normalizado para decidir si dos candidatos son «la misma letra». */
const textoClave = (c: CandidatoLetra): string =>
  claveFlexible(
    c.lineas
      .filter((l) => l.tipo === 'linea')
      .map((l) => l.texto)
      .join(' ')
  ) ?? ''

/**
 * Elección automática de la letra (ADR 0025 §3). Se elige sin preguntar solo si el candidato (1) tiene
 * tiempos por línea, (2) difiere ≤ 2 s en duración del audio y (3) su encaje es `coincide` o `desfasada`.
 * (4) Con varios que cumplan 1–3 gana el primero (el orden de ADR 0005: el de `get` primero) salvo que dos
 * tengan textos distintos tras normalizar: dos letras «buenas» distintas son ambiguas y no se elige.
 * Si ninguno cumple, se eligen los «elegibles sin comprobar» (revisión de ADR 0025, 2026-11-23): con
 * tiempos, en duración y `dudosa` con limitación; todos con el mismo texto o `ambigua`. Un `dudosa` sin
 * limitación no se elige. Función pura y determinista.
 */
export function elegirLetra(evaluados: readonly CandidatoEvaluado[]): DecisionEleccion {
  const conTiempos = evaluados.filter((e) => e.candidato.sincronia !== 'texto')
  if (conTiempos.length === 0) return { tipo: 'no_elige', motivo: 'sin_tiempos' }
  const enDuracion = conTiempos.filter(
    (e) => Math.abs(e.candidato.diferencia_ms) <= DIFERENCIA_DURACION_MAXIMA_MS
  )
  if (enDuracion.length === 0) return { tipo: 'no_elige', motivo: 'duracion' }
  const validos = enDuracion.filter(
    (e) => e.encaje?.veredicto === 'coincide' || e.encaje?.veredicto === 'desfasada'
  )
  const primero = validos[0]
  if (!primero) {
    const sinComprobar = enDuracion.filter(
      (e) => e.encaje?.veredicto === 'dudosa' && e.encaje.limitacion != null
    )
    const elegible = sinComprobar[0]
    if (elegible) {
      const claveSc = textoClave(elegible.candidato)
      if (sinComprobar.some((e) => textoClave(e.candidato) !== claveSc)) {
        return { tipo: 'no_elige', motivo: 'ambigua' }
      }
      return {
        tipo: 'elige',
        candidato: elegible.candidato,
        desfaseMs: null,
        sinComprobar: true,
        ...(elegible.encaje?.limitacion ? { limitacion: elegible.encaje.limitacion } : {})
      }
    }
    const conEncaje = enDuracion.filter((e) => e.encaje)
    return {
      tipo: 'no_elige',
      motivo:
        conEncaje.length === 0
          ? 'sin_encaje'
          : conEncaje.some((e) => e.encaje?.veredicto === 'dudosa')
            ? 'dudosa'
            : 'no_coincide'
    }
  }
  const clave = textoClave(primero.candidato)
  if (validos.some((v) => textoClave(v.candidato) !== clave)) {
    return { tipo: 'no_elige', motivo: 'ambigua' }
  }
  return {
    tipo: 'elige',
    candidato: primero.candidato,
    desfaseMs: primero.encaje?.veredicto === 'desfasada' ? primero.encaje.desfaseMs : null,
    sinComprobar: false
  }
}
