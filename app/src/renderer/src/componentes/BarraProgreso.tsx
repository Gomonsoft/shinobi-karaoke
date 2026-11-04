import estilos from './componentes.module.css'

interface BarraProgresoProps {
  /** Nombre accesible, p. ej. "Separación de voces". */
  etiqueta: string
  /** 0–100. Se ignora si `indeterminada`. */
  valor?: number
  indeterminada?: boolean
  /** Relleno en `error` (pausada o fallida). */
  error?: boolean
  /** 12 px de alto (vista de progreso) en lugar de 6 px. */
  grande?: boolean
  /** Texto para lectores, p. ej. "42 %, quedan unos 3 minutos". Por defecto "42 %". */
  textoValor?: string
}

export function BarraProgreso({
  etiqueta,
  valor = 0,
  indeterminada = false,
  error = false,
  grande = false,
  textoValor
}: BarraProgresoProps) {
  const pct = Math.min(100, Math.max(0, Math.round(valor)))
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminada ? undefined : pct}
      aria-valuetext={indeterminada ? (textoValor ?? 'En curso') : (textoValor ?? `${pct} %`)}
      className={`${estilos.pista} ${grande ? estilos.pistaGrande : ''}`}
    >
      <div
        className={[
          estilos.relleno,
          error && estilos.rellenoError,
          indeterminada && estilos.rellenoIndeterminado
        ]
          .filter(Boolean)
          .join(' ')}
        style={indeterminada ? undefined : { width: `${pct}%` }}
      />
    </div>
  )
}
