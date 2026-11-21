import { useCallback, useEffect, useRef, useState } from 'react'
import {
  impactoIpcSchema,
  type ErrorIpc,
  type ImpactoIpc,
  type OperacionTema as OperacionIpc,
  type ProgresoTemaIpc,
  type ResultadoOperacionIpc
} from '@shared/ipc'
import type { CodigoError } from '@shared/index'

export interface FilaFallo {
  id: string
  titulo: string
  artista: string
  estado: 'error' | 'pendiente'
  codigo?: CodigoError
}

/** Fallo a mitad derivado solo del resultado (ADR 0016 §7, revisión 3). */
export interface FalloAMitad {
  fallida: { id: string; titulo: string; artista: string; codigo: CodigoError }
  filas: FilaFallo[]
  f: number
}

/** `null` si el resultado no tiene ninguna canción `error`. */
export function derivarFallo(resultado: ResultadoOperacionIpc): FalloAMitad | null {
  const filas: FilaFallo[] = resultado.canciones
    .filter((c) => c.estado === 'error' || c.estado === 'pendiente')
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      artista: c.artista,
      estado: c.estado as 'error' | 'pendiente',
      ...(c.codigo ? { codigo: c.codigo } : {})
    }))
  const error = filas.find((f) => f.estado === 'error')
  if (!error) return null
  return {
    fallida: {
      id: error.id,
      titulo: error.titulo,
      artista: error.artista,
      codigo: error.codigo ?? 'ERROR_INTERNO'
    },
    filas,
    f: filas.length
  }
}

/** Operaciones que se detienen en el primer fallo y devuelven `pendiente`. */
function seDetieneEnFallo(op: OperacionIpc): boolean {
  return op.tipo === 'borrar' || (op.tipo === 'predeterminado' && op.temaId === null)
}

export type FaseOperacion =
  'inactiva' | 'previsualizando' | 'confirmando' | 'ejecutando' | 'hecha' | 'fallo' | 'error'

export interface OperacionTemaEstado {
  fase: FaseOperacion
  op: OperacionIpc | null
  impacto: ImpactoIpc | null
  /** El impacto se sustituyó por un `CONFIRMACION_OBSOLETA`: hay que confirmar otra vez. */
  obsoleto: boolean
  progreso: { hechas: number; total: number } | null
  resultado: ResultadoOperacionIpc | null
  fallo: FalloAMitad | null
  error: ErrorIpc | null
}

const INICIAL: OperacionTemaEstado = {
  fase: 'inactiva',
  op: null,
  impacto: null,
  obsoleto: false,
  progreso: null,
  resultado: null,
  fallo: null,
  error: null
}

function comoErrorIpc(e: unknown): ErrorIpc {
  if (e && typeof e === 'object' && 'codigo' in e) return e as ErrorIpc
  return { codigo: 'ERROR_INTERNO', mensaje: e instanceof Error ? e.message : String(e) }
}

export interface OperacionTemaApi extends OperacionTemaEstado {
  previsualizar(op: OperacionIpc): Promise<void>
  /** Ejecuta la operación previsualizada. Devuelve el resultado o `null` (obsoleta, fallo o error). */
  ejecutar(): Promise<ResultadoOperacionIpc | null>
  /** `reanudarBorrado` (sin ficha): progreso filtrado por `ficha === null` y el `temaId` indicado. */
  reanudarBorrado(temaId: string): Promise<ResultadoOperacionIpc | null>
  reiniciar(): void
}

/**
 * Flujo previsualizar → confirmar → ejecutar, con `CONFIRMACION_OBSOLETA`, errores y progreso
 * (`temas:progreso`). Las respuestas de previsualizaciones antiguas se descartan.
 */
export function useOperacionTema(): OperacionTemaApi {
  const [estado, setEstado] = useState<OperacionTemaEstado>(INICIAL)
  const token = useRef(0)
  const actual = useRef<OperacionTemaEstado>(INICIAL)
  const filtro = useRef<{ ficha: string | null; temaId: string | null } | null>(null)
  const enCurso = useRef(false)

  const poner = useCallback((cambios: Partial<OperacionTemaEstado>) => {
    actual.current = { ...actual.current, ...cambios }
    setEstado(actual.current)
  }, [])

  useEffect(() => {
    const desuscribir = window.shinobi.temas.alProgreso((p: ProgresoTemaIpc) => {
      const f = filtro.current
      if (!f) return
      const mio =
        f.ficha === null
          ? p.ficha === null && p.operacion === 'borrar' && p.temaId === f.temaId
          : p.ficha === f.ficha
      if (mio) poner({ progreso: { hechas: p.hechas, total: p.total } })
    })
    return () => {
      desuscribir()
      // eslint-disable-next-line react-hooks/exhaustive-deps
      token.current++
    }
  }, [poner])

  const previsualizar = useCallback(
    async (op: OperacionIpc) => {
      const mio = ++token.current
      filtro.current = null
      poner({ ...INICIAL, fase: 'previsualizando', op })
      try {
        const impacto = await window.shinobi.temas.previsualizar(op)
        if (mio === token.current) poner({ fase: 'confirmando', impacto })
      } catch (e) {
        if (mio === token.current) poner({ fase: 'error', error: comoErrorIpc(e) })
      }
    },
    [poner]
  )

  const terminar = useCallback(
    (op: OperacionIpc, resultado: ResultadoOperacionIpc) => {
      const fallo = seDetieneEnFallo(op) ? derivarFallo(resultado) : null
      poner({ fase: fallo ? 'fallo' : 'hecha', resultado, fallo })
      return resultado
    },
    [poner]
  )

  const ejecutar = useCallback(async () => {
    const { op, impacto } = actual.current
    if (!op || !impacto || enCurso.current) return null
    enCurso.current = true
    const mio = token.current
    filtro.current = { ficha: impacto.ficha, temaId: null }
    poner({ fase: 'ejecutando', progreso: null, error: null, obsoleto: false })
    try {
      const resultado = await window.shinobi.temas.ejecutar(op, impacto.ficha)
      return mio === token.current ? terminar(op, resultado) : null
    } catch (e) {
      if (mio !== token.current) return null
      const err = comoErrorIpc(e)
      if (err.codigo === 'CONFIRMACION_OBSOLETA') {
        let nuevo: ImpactoIpc | null = null
        try {
          const r = impactoIpcSchema.safeParse(JSON.parse(err.detalles ?? 'null'))
          if (r.success) nuevo = r.data
        } catch {
          nuevo = null
        }
        if (nuevo) {
          poner({ fase: 'confirmando', impacto: nuevo, obsoleto: true, progreso: null })
          return null
        }
      }
      poner({ fase: 'error', error: err })
      return null
    } finally {
      enCurso.current = false
    }
  }, [poner, terminar])

  const reanudarBorrado = useCallback(
    async (temaId: string) => {
      if (enCurso.current) return null
      enCurso.current = true
      const mio = ++token.current
      const op: OperacionIpc = { tipo: 'borrar', temaId }
      filtro.current = { ficha: null, temaId }
      poner({ ...INICIAL, fase: 'ejecutando', op })
      try {
        const resultado = await window.shinobi.temas.reanudarBorrado()
        return mio === token.current ? terminar(op, resultado) : null
      } catch (e) {
        if (mio === token.current) poner({ fase: 'error', error: comoErrorIpc(e) })
        return null
      } finally {
        enCurso.current = false
      }
    },
    [poner, terminar]
  )

  const reiniciar = useCallback(() => {
    token.current++
    filtro.current = null
    poner(INICIAL)
  }, [poner])

  return { ...estado, previsualizar, ejecutar, reanudarBorrado, reiniciar }
}
