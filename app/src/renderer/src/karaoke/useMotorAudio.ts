import { useEffect, useEffectEvent, useState } from 'react'
import { MotorAudio, type EstadoMotor, type OpcionesMotor } from './motorAudio'

export function useMotorAudio(opciones: OpcionesMotor): {
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
  useEffect(() => motor?.fijarVolumen(volumen), [motor, volumen])

  return actual ?? { motor: null, estado: null }
}
