import type { ImpactoIpc } from '@shared/ipc'
import { BIB_GRUPO, procedenciaCorta, procedenciaLarga } from './textos'

type Afectada = ImpactoIpc['afectadas'][number]

export interface ContextoGrupo {
  nivel: 'artista' | 'album'
  artista: string
  album?: string
}

export interface TextoImpactoGrupo {
  principal: string
  /** `bib.grupo.impacto.noDisponible` (sin el ⚠), solo si algunas van a `respaldo` y otras no. */
  noDisponible: string | null
}

const minuscula = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1)

/**
 * Texto principal al **quitar** el tema de un grupo, desde el `despues` de cada afectada
 * (spec 02, B5b). Nunca nombra un tema con destino `respaldo`.
 */
export function textoQuitarGrupo(
  afectadas: readonly Afectada[],
  ctx: ContextoGrupo
): TextoImpactoGrupo {
  const n = afectadas.length
  const sinRespaldo = afectadas.filter((a) => a.despues.procedencia !== 'respaldo')
  const r = n - sinRespaldo.length
  if (r === n) return { principal: BIB_GRUPO.impactoTodasNoDisponibles(n), noDisponible: null }
  const noDisponible = r > 0 ? BIB_GRUPO.noDisponible(r) : null
  const primero = sinRespaldo[0]!
  const comun = sinRespaldo.every(
    (a) =>
      a.despues.procedencia === primero.despues.procedencia &&
      a.despues.temaId === primero.despues.temaId
  )
  const m = sinRespaldo.length
  if (!comun) return { principal: BIB_GRUPO.impactoDistintos(m, ctx.nivel), noDisponible }
  if (primero.despues.procedencia === 'incluido') {
    return { principal: BIB_GRUPO.impactoQuitarIncluido(m), noDisponible }
  }
  const procedencia = minuscula(
    procedenciaLarga(primero.despues.procedencia, { album: ctx.album, artista: ctx.artista })
  )
  return {
    principal: BIB_GRUPO.impactoQuitar(m, primero.despues.temaNombre ?? '', procedencia),
    noDisponible
  }
}

/** Fila de la lista revelable al quitar: cada una lleva su destino. */
export function textoFilaQuitar(a: Afectada): { texto: string; aviso: boolean } {
  if (a.despues.procedencia === 'respaldo') {
    return { texto: BIB_GRUPO.filaNoDisponible(a.titulo, a.artista), aviso: true }
  }
  if (a.despues.procedencia === 'incluido') {
    return { texto: BIB_GRUPO.filaIncluido(a.titulo, a.artista), aviso: false }
  }
  return {
    texto: BIB_GRUPO.filaDestino(
      a.titulo,
      a.artista,
      a.despues.temaNombre ?? '',
      procedenciaCorta(a.despues.procedencia)
    ),
    aviso: false
  }
}
