import { useCallback, useEffect, useRef, useState } from 'react'
import type { PreferenciasPaneles } from '@shared/config'
import { LIMITES_PANELES } from '@shared/paneles'

/** Espera tras la última tecla de un divisor antes de escribir la preferencia (spec 2.1, «Persistencia»). */
export const ESPERA_TECLADO_MS = 500

/**
 * `teclado`: se guarda 500 ms después de la última tecla. `inmediato`: al confirmar un arrastre, al
 * minimizar o expandir por acción del usuario y al restablecer. Lo que no pasa por aquí (arrastre en
 * vivo, minimización por falta de espacio, modo sincronizar, disposición bajo mínimo) nunca se guarda.
 */
export type MotivoGuardado = 'teclado' | 'inmediato'

const acotar = (v: number, min: number, max: number): number =>
  Math.min(Math.max(Math.round(v), min), max)

/** Enteros dentro de los límites absolutos: lo que acepta el esquema IPC (0155). */
export function normalizarPreferencias(p: PreferenciasPaneles): PreferenciasPaneles {
  const l = LIMITES_PANELES
  return {
    lista: {
      ancho: acotar(p.lista.ancho, l.lista.min, l.lista.max),
      minimizado: p.lista.minimizado
    },
    panel: {
      ancho: acotar(p.panel.ancho, l.panel.min, l.panel.max),
      minimizado: p.panel.minimizado
    },
    linea_tiempo: {
      alto:
        p.linea_tiempo.alto === null
          ? null
          : acotar(p.linea_tiempo.alto, l.linea_tiempo.min, l.linea_tiempo.max),
      minimizado: p.linea_tiempo.minimizado
    }
  }
}

const iguales = (a: PreferenciasPaneles, b: PreferenciasPaneles): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * Preferencias de paneles del editor, globales a todas las canciones (`config.editor.paneles`).
 * El estado en memoria manda: un rechazo del IPC solo se registra en la consola de desarrollo, porque
 * es una preferencia cosmética. Ni el historial de deshacer ni el guardado de la canción intervienen.
 */
export function usePreferenciasPaneles(inicial: PreferenciasPaneles): {
  preferencias: PreferenciasPaneles
  actualizar(siguiente: PreferenciasPaneles, motivo: MotivoGuardado): void
} {
  const [preferencias, setPreferencias] = useState(inicial)
  const pendiente = useRef<PreferenciasPaneles | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const enVuelo = useRef(0)

  const enviar = useCallback((siguiente: PreferenciasPaneles) => {
    enVuelo.current++
    const terminar = () => {
      enVuelo.current--
    }
    try {
      window.shinobi.config
        .actualizar({ editor: { paneles: normalizarPreferencias(siguiente) } })
        .then(terminar, (e: unknown) => {
          terminar()
          if (import.meta.env.DEV) console.warn('No se pudo guardar la distribución de paneles', e)
        })
    } catch (e) {
      terminar()
      if (import.meta.env.DEV) console.warn('No se pudo guardar la distribución de paneles', e)
    }
  }, [])

  const volcar = useCallback(() => {
    clearTimeout(temporizador.current)
    temporizador.current = undefined
    const siguiente = pendiente.current
    pendiente.current = null
    if (siguiente) enviar(siguiente)
  }, [enviar])

  const actualizar = useCallback(
    (siguiente: PreferenciasPaneles, motivo: MotivoGuardado) => {
      setPreferencias(siguiente)
      if (motivo === 'teclado') {
        pendiente.current = siguiente
        clearTimeout(temporizador.current)
        temporizador.current = setTimeout(volcar, ESPERA_TECLADO_MS)
        return
      }
      // Una escritura inmediata sustituye a la ráfaga pendiente.
      clearTimeout(temporizador.current)
      temporizador.current = undefined
      pendiente.current = null
      enviar(siguiente)
    },
    [enviar, volcar]
  )

  // Copia en memoria: otros cambios de la configuración solo se adoptan si no hay nada nuestro sin enviar.
  useEffect(() => {
    return window.shinobi.alCambiarConfig((config) => {
      if (enVuelo.current > 0 || pendiente.current) return
      const recibida = config.editor.paneles
      setPreferencias((actual) => (iguales(actual, recibida) ? actual : recibida))
    })
  }, [])

  // Al salir del editor con una ráfaga de teclado pendiente se envía sin esperar la respuesta.
  useEffect(() => volcar, [volcar])

  return { preferencias, actualizar }
}
