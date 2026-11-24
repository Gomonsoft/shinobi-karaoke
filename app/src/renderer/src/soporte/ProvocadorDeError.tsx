import { useEffect, useState } from 'react'

/** Evento de la ventana que fuerza un error de dibujo (solo pruebas E2E). */
export const EVENTO_ROMPER_PARA_PRUEBAS = 'shinobi:e2e-romper'

/**
 * Gancho de prueba del límite de errores: con `info.pruebas` (sin empaquetar y en E2E), el evento `shinobi:e2e-romper` hace que este componente
 * lance al dibujarse, como lo haría un fallo real de la vista. En la app empaquetada nunca se engancha.
 */
export function ProvocadorDeError(): null {
  const [romper, setRomper] = useState(false)
  useEffect(() => {
    let activo = true
    let quitar = (): void => undefined
    Promise.resolve()
      .then(() => window.shinobi.sistema.info())
      .then(
        (info) => {
          if (!activo || !info.pruebas) return
          const alRomper = (): void => setRomper(true)
          window.addEventListener(EVENTO_ROMPER_PARA_PRUEBAS, alRomper)
          quitar = () => window.removeEventListener(EVENTO_ROMPER_PARA_PRUEBAS, alRomper)
        },
        () => undefined
      )
    return () => {
      activo = false
      quitar()
    }
  }, [])
  if (romper) throw new Error('Error de dibujo forzado por la prueba')
  return null
}
