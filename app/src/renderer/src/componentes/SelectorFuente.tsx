import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { FUENTES_REGISTRO } from '@shared/fuentes'
import { calcularPosicionMenu, type PosicionMenu } from './MenuContextual'
import estilos from './componentes.module.css'

interface Props {
  valor: string
  alCambiar(familia: string): void
  etiqueta?: string
}

export function SelectorFuente({ valor, alCambiar, etiqueta = 'Fuente' }: Props) {
  const id = useId()
  const ancla = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const [posicion, setPosicion] = useState<PosicionMenu | null>(null)
  const elegida = Math.max(
    0,
    FUENTES_REGISTRO.findIndex((fuente) => fuente.familia === valor)
  )

  function abrir(): void {
    setActivo(elegida)
    setAbierto(true)
  }

  function cerrar(foco: boolean): void {
    setAbierto(false)
    setPosicion(null)
    if (foco) ancla.current?.focus()
  }

  function elegir(indice: number): void {
    alCambiar(FUENTES_REGISTRO[indice]!.familia)
    cerrar(true)
  }

  useLayoutEffect(() => {
    if (!abierto) return
    const ventana = { width: window.innerWidth, height: window.innerHeight }
    setPosicion(
      calcularPosicionMenu(
        ancla.current!.getBoundingClientRect(),
        lista.current!.getBoundingClientRect(),
        ventana,
        8,
        4
      )
    )
  }, [abierto])

  const colocado = posicion !== null
  useEffect(() => {
    if (!colocado || !abierto) return
    lista.current?.focus()
    const origen = ancla.current!.getBoundingClientRect()
    function fuera(e: Event) {
      if (
        e.target instanceof Node &&
        (lista.current?.contains(e.target) || ancla.current?.contains(e.target))
      )
        return
      // Un scroll ajeno que no mueve el botón (p. ej. un contenedor que se reajusta) no
      // desplaza el menú: solo se cierra si el ancla se ha movido de verdad.
      if (e.type === 'scroll') {
        const ahora = ancla.current?.getBoundingClientRect()
        if (ahora && ahora.top === origen.top && ahora.left === origen.left) return
      }
      cerrar(false)
    }
    document.addEventListener('pointerdown', fuera)
    window.addEventListener('resize', fuera)
    window.addEventListener('scroll', fuera, true)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      window.removeEventListener('resize', fuera)
      window.removeEventListener('scroll', fuera, true)
    }
  }, [abierto, colocado])

  useEffect(() => {
    if (colocado && abierto)
      document.getElementById(`${id}-${activo}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [activo, abierto, colocado, id])

  function navegar(e: KeyboardEvent): void {
    const total = FUENTES_REGISTRO.length
    let siguiente: number
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
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
        siguiente = -1
        const letra = e.key.toLocaleLowerCase('es')
        for (let i = 1; i <= total; i++) {
          const j = (activo + i) % total
          if (FUENTES_REGISTRO[j]!.familia.toLocaleLowerCase('es').startsWith(letra)) {
            siguiente = j
            break
          }
        }
        if (siguiente === -1) return
      }
    }
    e.preventDefault()
    setActivo(siguiente)
  }

  return (
    <div className={estilos.campo}>
      <label htmlFor={`${id}-boton`} className={estilos.etiqueta}>
        {etiqueta}
      </label>
      <button
        ref={ancla}
        id={`${id}-boton`}
        type="button"
        className={`${estilos.entrada} ${estilos.botonFuente}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        aria-label={`${etiqueta}: ${FUENTES_REGISTRO[elegida]!.familia}`}
        onClick={() => (abierto ? cerrar(false) : abrir())}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          abrir()
        }}
      >
        {FUENTES_REGISTRO[elegida]!.familia}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {abierto &&
        createPortal(
          <div
            ref={lista}
            id={id}
            role="listbox"
            tabIndex={-1}
            aria-label={etiqueta}
            aria-activedescendant={`${id}-${activo}`}
            className={estilos.menu}
            style={posicion ?? { visibility: 'hidden' }}
            onKeyDown={navegar}
          >
            {FUENTES_REGISTRO.map(({ familia, peso }, i) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                id={`${id}-${i}`}
                key={familia}
                aria-selected={elegida === i}
                data-activa={activo === i || undefined}
                className={`${estilos.item} ${estilos.opcionFuente}`}
                style={{ fontFamily: familia, fontWeight: peso }}
                onClick={() => elegir(i)}
              >
                <span>{familia}</span>
                <span>¿Cantamos? Ñandú</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
