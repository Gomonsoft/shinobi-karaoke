import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { Icono } from './Icono'
import estilos from './componentes.module.css'

interface ComunesCampo {
  /** Etiqueta visible (siempre encima del campo). */
  etiqueta: string
  ayuda?: ReactNode
  /** Mensaje de error; marca el campo como inválido y se asocia con `aria-describedby`. */
  error?: string
  /** La etiqueta sigue siendo el nombre accesible, pero no se pinta (otro título la encabeza). */
  etiquetaOculta?: boolean
}

function Envoltorio({
  id,
  etiqueta,
  etiquetaOculta,
  ayuda,
  error,
  children
}: ComunesCampo & { id: string; children: ReactNode }) {
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={etiquetaOculta ? estilos.soloLector : estilos.etiqueta}>
        {etiqueta}
      </label>
      {children}
      {ayuda && (
        <span id={`${id}-ayuda`} className={estilos.ayuda}>
          {ayuda}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={estilos.mensajeError}>
          <Icono icono={CircleAlert} tamano={16} />
          {error}
        </span>
      )}
    </div>
  )
}

function describedBy(id: string, ayuda: unknown, error?: string, extra?: string) {
  return (
    [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null, extra].filter(Boolean).join(' ') ||
    undefined
  )
}

export type CampoTextoProps = ComponentPropsWithRef<'input'> & ComunesCampo

export function CampoTexto({
  etiqueta,
  etiquetaOculta,
  ayuda,
  error,
  id,
  className,
  ...resto
}: CampoTextoProps) {
  const auto = useId()
  const idCampo = id ?? auto
  return (
    <Envoltorio
      id={idCampo}
      etiqueta={etiqueta}
      etiquetaOculta={etiquetaOculta}
      ayuda={ayuda}
      error={error}
    >
      <input
        {...resto}
        id={idCampo}
        className={`${estilos.entrada} ${className ?? ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(idCampo, ayuda, error, resto['aria-describedby'])}
      />
    </Envoltorio>
  )
}

export type AreaTextoProps = ComponentPropsWithRef<'textarea'> & ComunesCampo

export function AreaTexto({ etiqueta, ayuda, error, id, className, ...resto }: AreaTextoProps) {
  const auto = useId()
  const idCampo = id ?? auto
  return (
    <Envoltorio id={idCampo} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <textarea
        {...resto}
        id={idCampo}
        className={`${estilos.entrada} ${estilos.area} ${className ?? ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(idCampo, ayuda, error)}
      />
    </Envoltorio>
  )
}
