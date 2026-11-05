import { useEffect, useState } from 'react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { textoLarga } from './textos'

/**
 * `add.aviso.larga` con la cifra de `runtime.estimarSeparacion` (0067). Si no hay estimación
 * (o falla la consulta) se omite el paréntesis.
 */
export function AvisoLarga({
  duracion,
  duracionMs
}: {
  duracion: string
  duracionMs: number
}): React.JSX.Element {
  const [minutos, setMinutos] = useState<number | null>(null)
  useEffect(() => {
    let activo = true
    const api = (window.shinobi as { runtime?: { estimarSeparacion?: unknown } }).runtime
    if (typeof api?.estimarSeparacion !== 'function') return
    window.shinobi.runtime.estimarSeparacion(duracionMs).then(
      (e) => {
        if (activo) setMinutos(e === null ? null : Math.max(1, Math.ceil((e.min + e.max) / 2)))
      },
      () => undefined
    )
    return () => {
      activo = false
    }
  }, [duracionMs])
  return <AvisoEnLinea tipo="aviso">{textoLarga(duracion, minutos)}</AvisoEnLinea>
}
