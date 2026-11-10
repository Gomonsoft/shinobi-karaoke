import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { calcularPosicionMenu, type PosicionMenu } from '../componentes/MenuContextual'
import comunes from '../componentes/componentes.module.css'
import { MuestraTema } from './MuestraTema'
import type { TemaCatalogo } from './useCatalogoTemas'
import estilos from './temas.module.css'

interface Props {
  /** Temas ofrecibles, ya ordenados (`useCatalogoTemas().ofrecibles`). */
  temas: TemaCatalogo[]
  /** Id del tema elegido; `null` = la opción inicial (o el marcador). */
  valor: string | null
  predeterminadoId?: string | null
  /** `null` = se eligió la opción inicial. */
  alElegir(temaId: string | null): void
  etiqueta: string
  /** «Sin tema de álbum…» / «Ninguno · un tema al azar…». */
  opcionInicial?: { texto: string; posicion?: 'primero' | 'ultimo' }
  /** Marcador no seleccionable: «Estilo incluido» o ««X» (no disponible)». */
  marcador?: string
  deshabilitado?: boolean
  descripcionId?: string
  /** Marca el botón para el foco inicial de un diálogo (`[data-foco-inicial]`). */
  focoInicial?: boolean
}

interface Opcion {
  clave: string
  id: string | null
  texto: string
  tema?: TemaCatalogo
  seleccionable: boolean
}

const sinTildes = (t: string): string =>
  t.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

/** Selector de tema: lista desplegable con muestra, nombre y etiqueta «Predeterminado». */
export function SelectorTema({
  temas,
  valor,
  predeterminadoId = null,
  alElegir,
  etiqueta,
  opcionInicial,
  marcador,
  deshabilitado = false,
  descripcionId,
  focoInicial = false
}: Props) {
  const id = useId()
  const ancla = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const busqueda = useRef({ texto: '', t: 0 })
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const [posicion, setPosicion] = useState<PosicionMenu | null>(null)
  // Dentro de un diálogo modal la lista va en el propio diálogo: `Dialogo` pone `inert` al resto de
  // hijos de <body> y, fuera de él, la lista no recibiría clics (hallado en E2E, 0176).
  const [contenedor, setContenedor] = useState<HTMLElement>(document.body)

  const delTema = temas.find((t) => t.id === valor)
  const opciones: Opcion[] = []
  if (marcador && !delTema) {
    opciones.push({ clave: 'marcador', id: null, texto: marcador, seleccionable: false })
  }
  if (opcionInicial && opcionInicial.posicion !== 'ultimo') {
    opciones.push({ clave: 'inicial', id: null, texto: opcionInicial.texto, seleccionable: true })
  }
  for (const tema of temas) {
    opciones.push({ clave: tema.id, id: tema.id, texto: tema.nombre, tema, seleccionable: true })
  }
  if (opcionInicial && opcionInicial.posicion === 'ultimo') {
    opciones.push({ clave: 'inicial', id: null, texto: opcionInicial.texto, seleccionable: true })
  }

  const elegida = delTema
    ? opciones.findIndex((o) => o.id === delTema.id)
    : marcador
      ? opciones.findIndex((o) => o.clave === 'marcador')
      : opcionInicial
        ? opciones.findIndex((o) => o.clave === 'inicial')
        : -1
  const textoBoton = elegida >= 0 ? opciones[elegida]!.texto : ''
  const esPredet = (o: Opcion): boolean => o.tema !== undefined && o.tema.id === predeterminadoId

  function abrir(): void {
    if (deshabilitado) return
    const primero = opciones.findIndex((o) => o.seleccionable)
    setActivo(elegida >= 0 && opciones[elegida]!.seleccionable ? elegida : Math.max(primero, 0))
    setContenedor(ancla.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body)
    setAbierto(true)
  }

  function cerrar(foco: boolean): void {
    setAbierto(false)
    setPosicion(null)
    if (foco) ancla.current?.focus()
  }

  function elegir(indice: number): void {
    const o = opciones[indice]
    if (!o || !o.seleccionable) return
    alElegir(o.id)
    cerrar(true)
  }

  useLayoutEffect(() => {
    if (!abierto) return
    setPosicion(
      calcularPosicionMenu(
        ancla.current!.getBoundingClientRect(),
        lista.current!.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        8,
        4
      )
    )
  }, [abierto])

  const colocado = posicion !== null
  useEffect(() => {
    if (!colocado || !abierto) return
    lista.current?.focus()
    function fuera(e: Event) {
      if (
        e.target instanceof Node &&
        (lista.current?.contains(e.target) || ancla.current?.contains(e.target))
      )
        return
      cerrar(false)
    }
    document.addEventListener('pointerdown', fuera)
    window.addEventListener('resize', fuera)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      window.removeEventListener('resize', fuera)
    }
  }, [abierto, colocado])

  useEffect(() => {
    if (colocado && abierto)
      document.getElementById(`${id}-${activo}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [activo, abierto, colocado, id])

  function navegar(e: KeyboardEvent): void {
    const seleccionables = opciones.map((o, i) => (o.seleccionable ? i : -1)).filter((i) => i >= 0)
    if (seleccionables.length === 0) return
    const pos = Math.max(seleccionables.indexOf(activo), 0)
    let siguiente: number | undefined
    switch (e.key) {
      case 'ArrowDown':
        siguiente = seleccionables[(pos + 1) % seleccionables.length]
        break
      case 'ArrowUp':
        siguiente = seleccionables[(pos - 1 + seleccionables.length) % seleccionables.length]
        break
      case 'Home':
        siguiente = seleccionables[0]
        break
      case 'End':
        siguiente = seleccionables.at(-1)
        break
      case 'Enter':
      case ' ':
        if (e.key === ' ' && busqueda.current.texto !== '') break
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
      default:
        break
    }
    if (siguiente === undefined && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Búsqueda por tecleo: acumula letras mientras se teclea seguido.
      const ahora = e.timeStamp
      const b = busqueda.current
      b.texto = (ahora - b.t > 800 ? '' : b.texto) + sinTildes(e.key)
      b.t = ahora
      siguiente = seleccionables.find((i) => sinTildes(opciones[i]!.texto).startsWith(b.texto))
      if (siguiente === undefined) return
    }
    if (siguiente === undefined) return
    e.preventDefault()
    setActivo(siguiente)
  }

  return (
    <div className={comunes.campo}>
      <button
        ref={ancla}
        id={`${id}-boton`}
        type="button"
        className={`${comunes.entrada} ${estilos.botonSelector}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        aria-label={`${etiqueta}: ${textoBoton}`}
        aria-describedby={descripcionId}
        aria-disabled={deshabilitado || undefined}
        data-foco-inicial={focoInicial || undefined}
        onClick={() => (abierto ? cerrar(false) : abrir())}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          abrir()
        }}
      >
        <span className={estilos.contenidoOpcion}>
          {delTema && <MuestraTema estilo={delTema.estilo} />}
          <span className={estilos.nombreOpcion}>{textoBoton}</span>
          {delTema && delTema.id === predeterminadoId && (
            <span className={estilos.etiquetaPredet}>Predeterminado</span>
          )}
        </span>
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
            className={comunes.menu}
            style={posicion ?? { visibility: 'hidden' }}
            onKeyDown={navegar}
          >
            {opciones.map((o, i) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                id={`${id}-${i}`}
                key={o.clave}
                aria-selected={elegida === i}
                aria-disabled={!o.seleccionable || undefined}
                aria-label={esPredet(o) ? `${o.texto}, predeterminado` : undefined}
                data-activa={activo === i || undefined}
                className={`${comunes.item} ${o.seleccionable ? '' : estilos.opcionNoDisponible}`}
                onClick={() => elegir(i)}
              >
                {o.tema && <MuestraTema estilo={o.tema.estilo} />}
                <span className={estilos.nombreOpcion}>{o.texto}</span>
                {esPredet(o) && <span className={estilos.etiquetaPredet}>Predeterminado</span>}
              </button>
            ))}
          </div>,
          contenedor
        )}
    </div>
  )
}
