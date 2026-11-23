import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, Plus } from 'lucide-react'
import type { Estilo } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import { cantantesDe, MAX_CANTANTES, type Parte } from '@shared/reparto'
import { Icono } from '../../componentes/Icono'
import { calcularPosicionMenu, type PosicionMenu } from '../../componentes/MenuContextual'
import { ChipParte } from './ChipParte'
import { parteComun, P, ranuraDe } from './partes'
import estilos from './editor.module.css'

/** Dónde se ancla el menú: un elemento (chip, fila, botón «Canta») o un punto (clic secundario). */
export type AnclaMenu = HTMLElement | { x: number; y: number }

interface Props {
  letra: Letra
  estilo: Pick<Estilo, 'letra'>
  /** Líneas sobre las que actúa (las seleccionadas): decide qué parte lleva la marca ✓. */
  ids: readonly string[]
  ancla: AnclaMenu
  elegir(parte: Parte): void
  anadir(): void
  /** «Nombres de los cantantes…» (solo con 2 o más cantantes). */
  nombres(): void
  /** Cierra sin cambios; `devolverFoco` lo pide Esc (Tab y un clic fuera dejan el foco donde va). */
  cerrar(devolverFoco: boolean): void
}

interface Entrada {
  id: string
  parte?: Parte
  etiqueta: string
  atajo?: string
  accion: () => void
  separadorAntes?: boolean
}

/** Entradas del menú según el número de cantantes (spec 06 · «Menú ¿Quién canta?»). */
function entradas(letra: Letra, props: Pick<Props, 'elegir' | 'anadir' | 'nombres'>): Entrada[] {
  const cantantes = cantantesDe(letra)
  const n = cantantes.length
  const parte = (p: Parte, etiqueta: string, atajo: string, separadorAntes = false): Entrada => ({
    id: p,
    parte: p,
    etiqueta,
    atajo,
    separadorAntes,
    accion: () => props.elegir(p)
  })
  const lista: Entrada[] = cantantes.map((c) =>
    parte(c.id, P.cantante(ranuraDe(c.id)!, c.nombre), String(ranuraDe(c.id)))
  )
  if (n >= 3) lista.push(parte('todos', P.todos, 'T'))
  lista.push(parte('coro', P.coro, 'C'))
  // En un dúo «Todos» se puede elegir, pero no se destaca: al final, tras un separador.
  if (n === 2) lista.push(parte('todos', P.todosDueto, 'T', true))
  const acciones: Entrada[] = []
  if (n < MAX_CANTANTES) {
    acciones.push({ id: 'anadir', etiqueta: P.anadir, atajo: 'A', accion: props.anadir })
  }
  if (n >= 2) acciones.push({ id: 'nombres', etiqueta: P.nombres, accion: props.nombres })
  if (acciones[0]) acciones[0].separadorAntes = true
  return [...lista, ...acciones]
}

/**
 * Menú «¿Quién canta?» (spec 06 · 0.2.3): lo abren el chip, el menú contextual de la fila, la tecla C y
 * la fila «Canta» del panel. Dentro, 1–4, T, C y A eligen; ↑/↓ e Intro, como cualquier menú.
 */
export function MenuQuienCanta({
  letra,
  estilo,
  ids,
  ancla,
  elegir,
  anadir,
  nombres,
  cerrar
}: Props) {
  const caja = useRef<HTMLDivElement>(null)
  const [posicion, setPosicion] = useState<PosicionMenu | null>(null)
  const lista = entradas(letra, { elegir, anadir, nombres })
  const comun = parteComun(letra, ids)

  const botones = () =>
    Array.from(caja.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])

  useLayoutEffect(() => {
    if (!caja.current) return
    const m = caja.current.getBoundingClientRect()
    const r =
      ancla instanceof HTMLElement
        ? ancla.getBoundingClientRect()
        : { top: ancla.y, bottom: ancla.y, left: ancla.x }
    setPosicion(
      calcularPosicionMenu(
        { top: r.top, bottom: r.bottom, right: r.left + m.width },
        { width: m.width, height: caja.current.scrollHeight || m.height },
        { width: window.innerWidth, height: window.innerHeight },
        8,
        4
      )
    )
  }, [ancla])

  // El foco entra cuando el menú ya está colocado: en la parte marcada o en la primera.
  const colocado = posicion !== null
  useEffect(() => {
    if (!colocado) return
    const todos = botones()
    const marcado = todos.find((b) => b.getAttribute('aria-checked') === 'true')
    ;(marcado ?? todos[0])?.focus()
  }, [colocado])

  useEffect(() => {
    const fuera = (e: Event) => {
      if (!(e.target instanceof Element) || caja.current?.contains(e.target)) return
      // Pulsar de nuevo el chip o el botón «Canta» que lo abrió alterna: lo cierra su propio clic.
      const disparador = e.target.closest('[data-boton-canta], [data-chip-parte]')
      if (disparador && ancla instanceof HTMLElement && ancla.contains(disparador)) return
      cerrar(false)
    }
    const siempre = () => cerrar(false)
    document.addEventListener('mousedown', fuera)
    window.addEventListener('resize', siempre)
    window.addEventListener('blur', siempre)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('resize', siempre)
      window.removeEventListener('blur', siempre)
    }
  }, [cerrar, ancla])

  function alTeclear(e: KeyboardEvent) {
    const todos = botones()
    const i = todos.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar(true)
      return
    }
    if (e.key === 'Tab') {
      cerrar(false)
      return
    }
    let destino = -1
    if (e.key === 'ArrowDown') destino = (i + 1) % todos.length
    else if (e.key === 'ArrowUp') destino = (i - 1 + todos.length) % todos.length
    else if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = todos.length - 1
    if (destino >= 0) {
      e.preventDefault()
      todos[destino]?.focus()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
    const tecla = e.key.toLowerCase()
    const entrada = lista.find((x) => x.atajo?.toLowerCase() === tecla)
    if (!entrada) return
    e.preventDefault()
    entrada.accion()
  }

  return createPortal(
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      ref={caja}
      role="menu"
      aria-label={P.menu}
      className={estilos.menuPartes}
      style={
        posicion
          ? { top: posicion.top, left: posicion.left, maxHeight: posicion.maxHeight }
          : { visibility: 'hidden' }
      }
      onKeyDown={alTeclear}
    >
      <div className={estilos.menuPartesTitulo} aria-hidden="true">
        {P.menu}
      </div>
      {lista.map((x) => (
        <div key={x.id} role="none" style={{ display: 'contents' }}>
          {x.separadorAntes && <div role="separator" className={estilos.menuPartesSeparador} />}
          <button
            type="button"
            role={x.parte ? 'menuitemradio' : 'menuitem'}
            aria-checked={x.parte ? comun === x.parte : undefined}
            aria-keyshortcuts={x.atajo}
            tabIndex={-1}
            className={estilos.menuPartesItem}
            onClick={x.accion}
          >
            {x.parte ? (
              <ChipParte letra={letra} estilo={estilo} parte={x.parte} decorativo />
            ) : x.id === 'anadir' ? (
              <Icono icono={Plus} tamano={16} />
            ) : (
              <span aria-hidden="true" />
            )}
            <span className={estilos.menuPartesNombre}>{x.etiqueta}</span>
            <span className={estilos.menuPartesAtajo} aria-hidden="true">
              {x.atajo ?? ''}
            </span>
            {x.parte && comun === x.parte ? (
              <Icono icono={Check} tamano={16} />
            ) : (
              <span aria-hidden="true" />
            )}
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
