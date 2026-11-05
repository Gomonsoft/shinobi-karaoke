import { useEffect, useState } from 'react'
import type { EventoProgresoIpc, ProgresoTrabajo } from '@shared/ipc'

/** `prog.reintento.red` y `bib.paso.reintento.red`: "Reintentando en {n} s…". */
export const textoReintentoRed = (n: number): string => `Reintentando en ${n} s…`

/**
 * Segundos de espera (`detalle.espera_s`) de una fase `reintentando` de red, o `null` si el
 * trabajo no está esperando un reintento de red.
 */
export function esperaDeReintentoRed(
  p: Pick<ProgresoTrabajo, 'fase' | 'detalle'> | null | undefined
): number | null {
  const d = p?.fase === 'reintentando' ? p.detalle : undefined
  return d && 'motivo' in d && d.motivo === 'red' && typeof d.espera_s === 'number'
    ? d.espera_s
    : null
}

/**
 * Cuenta atrás de un reintento de red (ux/04 criterio 19): se actualiza cada segundo en la
 * interfaz a partir de la espera total que anuncia el main. Devuelve los segundos que faltan
 * (nunca menos de 1) o `null` si no hay espera en curso. `clave` distingue trabajos.
 */
export function useCuentaAtras(
  progreso: EventoProgresoIpc | ProgresoTrabajo | null | undefined,
  clave: string | undefined
): number | null {
  const espera = esperaDeReintentoRed(progreso)
  const intento = progreso?.intento ?? 0
  const marca = espera === null ? null : `${clave ?? ''}|${intento}|${espera}`
  const [reloj, setReloj] = useState<{ marca: string; inicio: number; ahora: number } | null>(null)

  useEffect(() => {
    if (marca === null) return
    const inicio = Date.now()
    const id = setInterval(() => setReloj({ marca, inicio, ahora: Date.now() }), 1000)
    return () => clearInterval(id)
  }, [marca])

  if (espera === null) return null
  if (reloj?.marca !== marca) return espera
  return Math.max(1, Math.ceil(espera - (reloj.ahora - reloj.inicio) / 1000))
}
