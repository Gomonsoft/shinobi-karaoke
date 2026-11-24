import { useEffect, useEffectEvent, useState } from 'react'
import type { PuntoEnvolvente } from '@shared/coros'
import { MotorAudio, type EstadoMotor, type OpcionesMotor } from './motorAudio'
import { mezclarCorosEnWorker } from './mezclaCorosCliente'

/**
 * Solo para las capturas de revisión (`coros-preparando`): si el E2E fija `window.__SHINOBI_MEZCLA_LENTA_MS`
 * antes de abrir el editor, la mezcla de los coros espera ese tiempo antes de calcularse. Sin esa variable
 * (que solo pone Playwright) el comportamiento es el de siempre.
 */
function mezclaDePrueba(): OpcionesMotor['mezclarCoros'] {
  const ms = (window as unknown as { __SHINOBI_MEZCLA_LENTA_MS?: unknown })
    .__SHINOBI_MEZCLA_LENTA_MS
  if (typeof ms !== 'number' || !(ms > 0)) return undefined
  return async (instrumental, voz, sampleRate, puntos, signal) => {
    await new Promise<void>((resolver) => {
      const t = setTimeout(resolver, ms)
      signal.addEventListener('abort', () => (clearTimeout(t), resolver()), { once: true })
    })
    return mezclarCorosEnWorker(instrumental, voz, sampleRate, puntos, signal)
  }
}

export function useMotorAudio(
  opciones: OpcionesMotor & {
    /** Voz en los coros de la canción (`envolvente(tramosCoro(letra), nivel)`); `[]` o ausente = sin coros. */
    coros?: readonly PuntoEnvolvente[]
  }
): {
  motor: MotorAudio | null
  estado: EstadoMotor | null
} {
  const { cancionId, gananciaDb, crearContexto, fetch, ahoraPerf, maxBuffers, volumen } = opciones
  const [actual, fijarActual] = useState<{ motor: MotorAudio; estado: EstadoMotor } | null>(null)
  const volumenInicial = useEffectEvent(() => volumen)

  useEffect(() => {
    const motor = new MotorAudio({
      cancionId,
      gananciaDb,
      crearContexto,
      fetch,
      ahoraPerf,
      maxBuffers,
      volumen: volumenInicial(),
      mezclarCoros: mezclaDePrueba()
    })
    const desuscribir = motor.suscribir((estado) => fijarActual({ motor, estado }))
    // Publica después del montaje y evita exponer un motor descartado por StrictMode.
    let montado = true
    queueMicrotask(() => {
      if (montado) fijarActual({ motor, estado: motor.estado() })
    })
    return () => {
      montado = false
      desuscribir()
      motor.destruir()
    }
  }, [cancionId, gananciaDb, crearContexto, fetch, ahoraPerf, maxBuffers])

  const motor = actual?.motor ?? null
  // La clave evita reiniciar la espera de 300 ms cuando el llamante entrega un arreglo nuevo igual.
  const clave = JSON.stringify(opciones.coros ?? [])
  useEffect(() => motor?.fijarCoros(JSON.parse(clave) as PuntoEnvolvente[]), [motor, clave])
  useEffect(() => motor?.fijarVolumen(volumen), [motor, volumen])

  return actual ?? { motor: null, estado: null }
}
