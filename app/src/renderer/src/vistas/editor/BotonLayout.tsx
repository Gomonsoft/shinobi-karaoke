import { useId, type ComponentPropsWithRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icono } from '../../componentes/Icono'
import { Tooltip } from '../../componentes/Tooltip'
import estilos from './editor.module.css'

export type NombreBotonLayout =
  | 'lista-minimizar'
  | 'lista-expandir'
  | 'panel-minimizar'
  | 'panel-expandir'
  | 'timeline-minimizar'
  | 'timeline-expandir'

interface Props extends Omit<ComponentPropsWithRef<'button'>, 'aria-label' | 'children'> {
  icono: LucideIcon
  etiqueta: string
  nombre: NombreBotonLayout
  /** Valor de `aria-expanded`: el estado actual de lo que controla. */
  expandido: boolean
  /** Id de la zona que minimiza o expande. */
  controla: string
  /** Motivo por el que no se puede usar (`aria-disabled`, sigue enfocable). */
  noDisponible?: string
  /** Punto `aviso` (contraste) sobre el botón. */
  aviso?: boolean
  /** Punto `info` (edición de un tema sin guardar). */
  info?: boolean
}

/** Botón icono de 32 × 32 que minimiza o expande una zona del editor (spec 2.1, «Cómo se minimiza»). */
export function BotonLayout({
  icono,
  etiqueta,
  nombre,
  expandido,
  controla,
  noDisponible,
  aviso,
  info,
  onClick,
  className,
  ...resto
}: Props) {
  const idMotivo = useId()
  return (
    <>
      <Tooltip contenido={noDisponible ?? etiqueta}>
        <button
          {...resto}
          type="button"
          className={[estilos.botonLayout, className].filter(Boolean).join(' ')}
          aria-label={etiqueta}
          aria-expanded={expandido}
          aria-controls={controla}
          aria-disabled={noDisponible ? true : undefined}
          aria-describedby={noDisponible ? idMotivo : undefined}
          data-boton-layout={nombre}
          onClick={(e) => {
            if (noDisponible) {
              e.preventDefault()
              return
            }
            onClick?.(e)
          }}
        >
          <Icono icono={icono} />
          {aviso && <span className={estilos.puntoAvisoLayout} aria-hidden="true" data-aviso />}
          {info && <span className={estilos.puntoInfoLayout} aria-hidden="true" data-info />}
        </button>
      </Tooltip>
      {noDisponible && (
        <span id={idMotivo} className={estilos.soloLector}>
          {noDisponible}
        </span>
      )}
    </>
  )
}
