import { useEffect, useState } from 'react'
import { R } from '../textos'
import { fraccionDeCuenta, numeroDeCuenta, RelojCuenta, type TransicionVista } from './cuenta'
import { useMovimientoReducido } from './useMovimientoReducido'
import estilos from './sesion.module.css'

const RADIO = 45
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

interface Props {
  transicion: TransicionVista
  /** Confirmación de cierre abierta: la cuenta se queda quieta. */
  cierrePendiente: boolean
  ahora?: () => number
}

/** Número, disco y anillo de la cuenta (S1). Decorativo: el anuncio `aria-live` lo dice. */
export function CuentaTransicion({ transicion, cierrePendiente, ahora }: Props) {
  const reducido = useMovimientoReducido()
  const [reloj] = useState(() => new RelojCuenta(ahora))
  const [, repintar] = useState(0)
  reloj.actualizar(transicion, cierrePendiente)
  const quieta = reloj.congelada()

  useEffect(() => {
    if (quieta) return
    const intervalo = setInterval(() => repintar((n) => n + 1), reducido ? 250 : 50)
    return () => clearInterval(intervalo)
  }, [quieta, reducido])

  const restante = reloj.restanteMs()
  const numero = numeroDeCuenta(restante)
  const fraccion = fraccionDeCuenta(restante, transicion.duracionMs)
  return (
    <div className={estilos.cuenta} aria-hidden="true" data-testid="cuenta-transicion">
      <div className={estilos.disco}>
        {!reducido && (
          <svg className={estilos.anillo} viewBox="0 0 100 100" data-testid="anillo-cuenta">
            <circle className={estilos.anilloPista} cx="50" cy="50" r={RADIO} />
            <circle
              className={estilos.anilloRelleno}
              cx="50"
              cy="50"
              r={RADIO}
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - fraccion)}
            />
          </svg>
        )}
        <span key={numero} className={estilos.numero} data-testid="numero-cuenta">
          {numero}
        </span>
      </div>
      <span className={estilos.etiquetaCuenta}>{R.cola.cuenta}</span>
    </div>
  )
}
