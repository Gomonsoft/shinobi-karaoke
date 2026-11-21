import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Resolucion } from '@shared/exportacion'
import estilosComponentes from '../../componentes/componentes.module.css'
import { EXP, nombreResolucion } from './textos'
import estilos from './exportacion.module.css'

export interface OpcionResolucion extends Resolucion {
  /** Motivo (tooltip) si no está soportada a ningún FPS con el formato elegido. */
  noSoportada?: string
}

interface Props {
  opciones: OpcionResolucion[]
  valor: { ancho: number; alto: number }
  alElegir(r: Resolucion): void
}

/**
 * Lista desplegable de resoluciones (`role="listbox"`). Las no soportadas son enfocables con las
 * flechas y no se pueden elegir; su motivo se lee con `aria-describedby`. Va en línea (no en un
 * portal) porque el diálogo vuelve inerte todo lo que cuelga de `body`.
 */
export function SelectorResolucion({ opciones, valor, alElegir }: Props) {
  const id = useId()
  const ancla = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const elegida = Math.max(
    0,
    opciones.findIndex((o) => o.ancho === valor.ancho && o.alto === valor.alto)
  )
  const [activo, setActivo] = useState(elegida)

  useEffect(() => {
    if (abierto) lista.current?.focus()
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (
        e.target instanceof Node &&
        (lista.current?.contains(e.target) || ancla.current?.contains(e.target))
      )
        return
      setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  const abrir = () => {
    setActivo(elegida)
    setAbierto(true)
  }
  const cerrar = (foco: boolean) => {
    setAbierto(false)
    if (foco) ancla.current?.focus()
  }
  const elegir = (i: number) => {
    const o = opciones[i]
    if (!o || o.noSoportada) return
    alElegir({ proporcion: o.proporcion, ancho: o.ancho, alto: o.alto })
    cerrar(true)
  }

  const navegar = (e: KeyboardEvent) => {
    const total = opciones.length
    let siguiente = activo
    switch (e.key) {
      case 'ArrowDown':
        siguiente = (activo + 1) % total
        break
      case 'ArrowUp':
        siguiente = (activo - 1 + total) % total
        break
      case 'Home':
        siguiente = 0
        break
      case 'End':
        siguiente = total - 1
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        elegir(activo)
        return
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        cerrar(true)
        return
      case 'Tab':
        cerrar(true)
        return
      default: {
        // Búsqueda por tecleo de cifras: «1» salta a la primera resolución que empieza por 1.
        if (!/^[0-9]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return
        const j = opciones.findIndex((o, k) => k !== activo && String(o.ancho).startsWith(e.key))
        if (j < 0) return
        siguiente = j
      }
    }
    e.preventDefault()
    setActivo(siguiente)
  }

  const actual = opciones[elegida]
  const nombre = actual ? nombreResolucion(actual.ancho, actual.alto) : ''
  return (
    <div className={estilosComponentes.campo}>
      <label htmlFor={`${id}-boton`} className={estilosComponentes.etiqueta}>
        {EXP.resolucion}
      </label>
      <div className={estilos.selectorEnvoltorio}>
        <button
          ref={ancla}
          id={`${id}-boton`}
          type="button"
          className={`${estilosComponentes.entrada} ${estilosComponentes.botonFuente}`}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-controls={abierto ? id : undefined}
          aria-label={`${EXP.resolucion}: ${nombre}`}
          onClick={() => (abierto ? cerrar(false) : abrir())}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
            e.preventDefault()
            abrir()
          }}
        >
          {nombre}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {abierto && (
          <div
            ref={lista}
            id={id}
            role="listbox"
            tabIndex={-1}
            aria-label={EXP.resolucion}
            aria-activedescendant={`${id}-${activo}`}
            className={`${estilosComponentes.menu} ${estilos.listaResolucion}`}
            onKeyDown={navegar}
          >
            {opciones.map((o, i) => {
              const texto = nombreResolucion(o.ancho, o.alto)
              return (
                <button
                  type="button"
                  role="option"
                  tabIndex={-1}
                  id={`${id}-${i}`}
                  key={`${o.ancho}x${o.alto}`}
                  aria-selected={elegida === i}
                  aria-disabled={o.noSoportada ? true : undefined}
                  aria-describedby={o.noSoportada ? `${id}-${i}-motivo` : undefined}
                  title={o.noSoportada}
                  data-activa={activo === i || undefined}
                  className={estilosComponentes.item}
                  onClick={() => elegir(i)}
                >
                  {texto}
                  {o.noSoportada && EXP.perfilNoDisponible}
                  {o.noSoportada && (
                    <span id={`${id}-${i}-motivo`} className={estilosComponentes.soloLector}>
                      {o.noSoportada}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
