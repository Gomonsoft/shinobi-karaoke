import { useEffect, useEffectEvent, useState } from 'react'
import type { PuntoEnvolvente } from '@shared/coros'
import { MotorAudio, type EstadoMotor, type OpcionesMotor } from './motorAudio'

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
      volumen: volumenInicial()
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
