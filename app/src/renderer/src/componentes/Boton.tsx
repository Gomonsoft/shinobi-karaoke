import { useId, useState, type ComponentPropsWithRef } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Icono } from './Icono'
import { Tooltip } from './Tooltip'
import estilos from './componentes.module.css'

export type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'destructivo'

export interface BotonProps extends ComponentPropsWithRef<'button'> {
  variante?: VarianteBoton
  /** `normal` 36 px, `grande` 44 px. */
  tamano?: 'normal' | 'grande'
  /** Spinner + `textoCargando`; mantiene el ancho y no admite clics. */
  cargando?: boolean
  /** Texto mientras carga, p. ej. "Guardando…". */
  textoCargando?: string
  /**
   * Motivo por el que la acción no está disponible. El botón usa `aria-disabled`, sigue
   * enfocable y muestra el motivo al enfocarlo o pulsarlo (§6 "Acciones no disponibles").
   */
  noDisponible?: string
}

export function Boton({
  variante = 'secundario',
  tamano = 'normal',
  cargando = false,
  textoCargando,
  noDisponible,
  className,
  children,
  onClick,
  onBlur,
  onMouseLeave,
  type = 'button',
  ...resto
}: BotonProps) {
  const idMotivo = useId()
  const [pulsado, setPulsado] = useState(false)
  const inactivo = Boolean(noDisponible) || cargando

  const clases = [
    estilos.boton,
    estilos[variante],
    tamano === 'grande' && estilos.grande,
    cargando && estilos.cargando,
    className
  ]
    .filter(Boolean)
    .join(' ')

  const boton = (
    <button
      {...resto}
      type={type}
      className={clases}
      aria-disabled={inactivo || undefined}
      aria-busy={cargando || undefined}
      aria-describedby={
        [noDisponible ? idMotivo : undefined, resto['aria-describedby']]
          .filter(Boolean)
          .join(' ') || undefined
      }
      onClick={(e) => {
        if (inactivo) {
          e.preventDefault()
          if (noDisponible) setPulsado(true)
          return
        }
        onClick?.(e)
      }}
      onBlur={(e) => {
        setPulsado(false)
        onBlur?.(e)
      }}
      onMouseLeave={(e) => {
        setPulsado(false)
        onMouseLeave?.(e)
      }}
    >
      {cargando ? (
        <>
          <span className={estilos.contenidoOculto}>{children}</span>
          <span className={estilos.contenidoCargando}>
            <Icono icono={LoaderCircle} tamano={16} className={estilos.girando} />
            {textoCargando ?? children}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  )

  if (!noDisponible) return boton
  return (
    <>
      <Tooltip contenido={noDisponible} forzar={pulsado}>
        {boton}
      </Tooltip>
      <span id={idMotivo} className={estilos.soloLector}>
        {noDisponible}
      </span>
    </>
  )
}
