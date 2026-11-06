import { useId, useRef, type KeyboardEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { Icono } from './Icono'
import { Tooltip } from './Tooltip'
import estilos from './componentes.module.css'

export interface OpcionSegmentada<T extends string> {
  valor: T
  etiqueta: string
  /** Motivo por el que no se puede elegir. Sigue siendo enfocable con flechas y muestra el motivo. */
  noDisponible?: string
  cargando?: boolean
  /** Punto de aviso con una descripción accesible. */
  aviso?: string
}

interface ControlSegmentadoProps<T extends string> {
  /** Nombre accesible del grupo, p. ej. "Tipo de fondo". */
  etiqueta: string
  opciones: OpcionSegmentada<T>[]
  valor: T
  onCambio: (valor: T) => void
}

/**
 * `radiogroup` con tabulación itinerante: Tab entra en la opción elegida; ← ↑ / → ↓ mueven
 * (y eligen) entre opciones disponibles; Inicio/Fin saltan a los extremos. Las opciones no
 * disponibles reciben el foco pero no se eligen.
 */
export function ControlSegmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio
}: ControlSegmentadoProps<T>) {
  const grupo = useRef<HTMLDivElement>(null)
  const idBase = useId()

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const teclas: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1
    }
    const botones = Array.from(grupo.current!.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    const actual = botones.indexOf(document.activeElement as HTMLButtonElement)
    let destino = -1
    if (e.key in teclas) destino = (actual + (teclas[e.key] ?? 0) + botones.length) % botones.length
    else if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = botones.length - 1
    if (destino < 0) return
    e.preventDefault()
    botones[destino]?.focus()
    const opcion = opciones[destino]
    if (opcion && !opcion.noDisponible) onCambio(opcion.valor)
  }

  // Si la opción elegida no existe, la primera disponible es la parada de tabulación.
  const hayElegida = opciones.some((o) => o.valor === valor)
  const parada = hayElegida ? valor : opciones.find((o) => !o.noDisponible)?.valor

  return (
    // El teclado se gestiona aquí por delegación; los radios son botones enfocables.
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      ref={grupo}
      role="radiogroup"
      aria-label={etiqueta}
      className={estilos.segmentado}
      onKeyDown={alTeclear}
    >
      {opciones.map((o, i) => {
        const idMotivo = `${idBase}-${i}`
        const idAviso = `${idMotivo}-aviso`
        const descripcion = [o.noDisponible ? idMotivo : '', o.aviso ? idAviso : '']
          .filter(Boolean)
          .join(' ')
        const boton = (
          <button
            type="button"
            role="radio"
            className={estilos.opcion}
            aria-checked={o.valor === valor}
            aria-busy={o.cargando || undefined}
            aria-disabled={o.noDisponible ? true : undefined}
            aria-describedby={descripcion || undefined}
            tabIndex={o.valor === parada ? 0 : -1}
            onClick={() => {
              if (!o.noDisponible) onCambio(o.valor)
            }}
          >
            {o.cargando && (
              <span className={estilos.cargandoOpcion}>
                <Icono icono={RefreshCw} tamano={14} />
              </span>
            )}
            {o.etiqueta}
            {o.aviso && <span className={estilos.puntoAviso} aria-hidden="true" data-aviso />}
          </button>
        )
        return (
          <span key={o.valor}>
            {o.noDisponible ? (
              <>
                <Tooltip contenido={o.noDisponible}>{boton}</Tooltip>
                <span id={idMotivo} className={estilos.soloLector}>
                  {o.noDisponible}
                </span>
              </>
            ) : (
              boton
            )}
            {o.aviso && (
              <span id={idAviso} className={estilos.soloLector}>
                {o.aviso}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
