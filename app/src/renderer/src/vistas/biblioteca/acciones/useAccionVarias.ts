import { useCallback, useEffect, useRef, useState } from 'react'
import {
  previsualizacionVariasSchema,
  type PrevisualizacionVariasIpc,
  type ResultadoVariasIpc
} from '@shared/ipc'

export type FaseAccion = 'calculando' | 'confirmando' | 'ejecutando' | 'hecha' | 'error'

interface Operaciones {
  previsualizar(ids: string[]): Promise<PrevisualizacionVariasIpc>
  ejecutar(ids: string[], version: string): Promise<ResultadoVariasIpc>
}

const codigoDe = (e: unknown): string =>
  e && typeof e === 'object' && 'codigo' in e && typeof e.codigo === 'string' ? e.codigo : ''

/** La vista previa nueva que main adjunta a `CONFIRMACION_OBSOLETA` (JSON en `detalles`). */
function previaDeObsoleta(e: unknown): PrevisualizacionVariasIpc | null {
  const detalles = e && typeof e === 'object' && 'detalles' in e ? e.detalles : null
  if (typeof detalles !== 'string') return null
  try {
    const r = previsualizacionVariasSchema.safeParse(JSON.parse(detalles))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

/** Lo que se sabe de una petición concreta (`clave`): vale solo mientras la clave siga siendo la actual. */
interface Resuelto<T> {
  clave: string
  valor: T
}

/**
 * Patrón de «Aplicar tema» para las acciones por lotes de main (ADR 0026 §4): `previsualizar` al abrir y al
 * cambiar los argumentos, `ejecutar` con la `version` vista y, con `CONFIRMACION_OBSOLETA`, la lista se
 * repinta con la vista previa nueva y hay que confirmar otra vez. `clave` agrupa los argumentos que cambian la
 * vista previa (p. ej. el artista tecleado); todo lo que se guarda lleva su clave y caduca con ella.
 */
export function useAccionVarias(ops: Operaciones, ids: readonly string[], clave: string) {
  const claveActual = `${ids.join('|')}#${clave}`
  const [intento, setIntento] = useState(0)
  const [previa, setPrevia] = useState<Resuelto<PrevisualizacionVariasIpc> | null>(null)
  const [fallo, setFallo] = useState<Resuelto<string> | null>(null)
  const [resultado, setResultado] = useState<Resuelto<ResultadoVariasIpc> | null>(null)
  const [obsoleta, setObsoleta] = useState<string | null>(null)
  const [ejecutando, setEjecutando] = useState(false)
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)
  const opsRef = useRef(ops)
  useEffect(() => {
    opsRef.current = ops
  })

  useEffect(() => {
    let activo = true
    opsRef.current.previsualizar([...ids]).then(
      (p) => activo && setPrevia({ clave: claveActual, valor: p }),
      (e: unknown) =>
        activo && setFallo({ clave: claveActual, valor: codigoDe(e) || 'ERROR_INTERNO' })
    )
    return () => {
      activo = false
    }
    // `ids` entra por `claveActual`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveActual, intento])

  const vigente = <T>(r: Resuelto<T> | null): T | null =>
    r?.clave === claveActual ? r.valor : null
  const previaVigente = vigente(previa)
  const resultadoVigente = vigente(resultado)
  const falloVigente = vigente(fallo)

  const ejecutar = useCallback(async (): Promise<ResultadoVariasIpc | null> => {
    if (!previaVigente) return null
    setEjecutando(true)
    setObsoleta(null)
    setProgreso({ hechas: 0, total: previaVigente.canciones.filter((c) => c.aplica).length })
    const baja = window.shinobi.biblioteca.alProgresoLote((p) => setProgreso(p))
    try {
      const r = await opsRef.current.ejecutar([...ids], previaVigente.version)
      setResultado({ clave: claveActual, valor: r })
      return r
    } catch (e) {
      if (codigoDe(e) === 'CONFIRMACION_OBSOLETA') {
        const nueva = previaDeObsoleta(e)
        if (nueva) setPrevia({ clave: claveActual, valor: nueva })
        else setIntento((n) => n + 1)
        setObsoleta(claveActual)
      } else {
        setFallo({ clave: claveActual, valor: codigoDe(e) || 'ERROR_INTERNO' })
      }
      return null
    } finally {
      baja()
      setEjecutando(false)
    }
  }, [previaVigente, ids, claveActual])

  const fase: FaseAccion = ejecutando
    ? 'ejecutando'
    : resultadoVigente
      ? 'hecha'
      : falloVigente
        ? 'error'
        : previaVigente
          ? 'confirmando'
          : 'calculando'

  return {
    fase,
    previa: previaVigente,
    obsoleta: obsoleta === claveActual,
    progreso,
    resultado: resultadoVigente,
    error: falloVigente,
    ejecutar,
    reintentar: () => {
      setFallo(null)
      setIntento((n) => n + 1)
    }
  }
}
