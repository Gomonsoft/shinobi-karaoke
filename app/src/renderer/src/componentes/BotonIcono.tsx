import type { ComponentPropsWithRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icono } from './Icono'
import { Tooltip } from './Tooltip'
import estilos from './componentes.module.css'

export interface BotonIconoProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'> {
  icono: LucideIcon
  /** Obligatoria: es el nombre accesible y el texto del tooltip. */
  etiqueta: string
  /** Estado "activo" (icono `acento-texto`); se expone como `aria-pressed`. */
  activo?: boolean
  /** 36 px normal, 44 px en el reproductor. */
  tamano?: 'normal' | 'grande'
  /** Motivo de indisponibilidad (`aria-disabled`, sigue enfocable). */
  noDisponible?: string
  /** Oculta el tooltip (p. ej. mientras el menú que abre este botón está desplegado). */
  ocultarTooltip?: boolean
}

export function BotonIcono({
  icono,
  etiqueta,
  activo,
  tamano = 'normal',
  noDisponible,
  ocultarTooltip,
  className,
  onClick,
  type = 'button',
  ...resto
}: BotonIconoProps) {
  const clases = [estilos.botonIcono, tamano === 'grande' && estilos.grande, className]
    .filter(Boolean)
    .join(' ')
  return (
    <Tooltip
      contenido={noDisponible ? `${etiqueta}: ${noDisponible}` : etiqueta}
      suprimir={ocultarTooltip}
    >
      <button
        {...resto}
        type={type}
        className={clases}
        aria-label={noDisponible ? `${etiqueta}. ${noDisponible}` : etiqueta}
        aria-pressed={activo}
        aria-disabled={noDisponible ? true : undefined}
        onClick={(e) => {
          if (noDisponible) {
            e.preventDefault()
            return
          }
          onClick?.(e)
        }}
      >
        <Icono icono={icono} />
      </button>
    </Tooltip>
  )
}
