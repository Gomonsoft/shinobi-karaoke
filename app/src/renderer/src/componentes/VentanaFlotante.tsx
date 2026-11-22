import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref
} from 'react'
import { createPortal } from 'react-dom'
import { GripVertical, MoveDiagonal2 } from 'lucide-react'
import { Icono } from './Icono'
import { Tooltip } from './Tooltip'
import {
  acotarGeometria,
  acotarPosicion,
  acotarTamano,
  esReducida,
  igualesGeometria,
  moverConTeclado,
  posicionInicial,
  redimensionarConTeclado,
  tamanosDiseno,
  type Area,
  type Geometria
} from './geometriaVentana'
import estilos from './ventanaFlotante.module.css'

export type { Area, Geometria } from './geometriaVentana'

/** Atributo del contenedor: los atajos del editor ignoran los eventos que nacen dentro (ADR 0021 §9). */
export const ATRIBUTO_VENTANA_FLOTANTE = 'data-ventana-flotante'

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
/** Tras una ráfaga de teclas se guarda la preferencia una sola vez. */
const RETARDO_RAFAGA_MS = 400

/** Lo que el contenedor (0279) puede pedirle a la ventana. */
export interface VentanaFlotanteApi {
  /** Devuelve el foco al último elemento interno que lo tuvo (o al primero enfocable). */
  enfocarUltimo(): void
  /** Nodo raíz (`role="dialog"`). */
  elemento(): HTMLElement | null
}

export interface VentanaFlotanteProps {
  /** Contenido del título (`h2`, nombre accesible del diálogo). */
  titulo: ReactNode
  /** Ranura de botones de la barra de título (Anterior, Siguiente, cerrar). No arrastra. */
  botones?: ReactNode
  /** Área que la contiene, en coordenadas de ventana del navegador (p. ej. `getBoundingClientRect()` del editor bajo la cabecera). */
  limites: Area
  /** Elemento junto al que se coloca al principio (la lista de líneas): a su derecha + 12 px. */
  referencia?: Area | null
  /** Preferencia guardada, con `x` e `y` relativas a la esquina superior izquierda de `limites`. */
  preferencia?: Geometria | null
  /** Tamaño inicial recomendado en `rem` (por defecto, el de diseño). Se recorta al área si no cabe. */
  tamanoRecomendadoRem?: { ancho: number; alto: number }
  /** Al soltar un arrastre, tras una ráfaga de teclado o con el doble clic de la barra. */
  alCambiarPreferencia?(g: Geometria): void
  /** F6 con el foco dentro: el contenedor lleva el foco al editor. */
  alSalirDelFoco?(): void
  etiquetaMover?: string
  tooltipMover?: string
  etiquetaTamano?: string
  tooltipTamano?: string
  children?: ReactNode
  ref?: Ref<VentanaFlotanteApi>
}

interface Arrastre {
  id: number
  x: number
  y: number
  inicio: Geometria
  tipo: 'mover' | 'tamano'
  movido: boolean
}

const remActual = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
const iguales = (a: Geometria | null | undefined, b: Geometria | null | undefined) =>
  a == null || b == null ? a == b : igualesGeometria(a, b)

/**
 * Subventana no modal tipo Adobe: se mueve, cambia de tamaño, nunca sale del área y no atrapa
 * el foco fuera de sí (Tab cicla dentro; F6 pasa el foco al editor y de vuelta). No conoce su contenido.
 */
export function VentanaFlotante({
  titulo,
  botones,
  limites,
  referencia = null,
  preferencia = null,
  tamanoRecomendadoRem,
  alCambiarPreferencia,
  alSalirDelFoco,
  etiquetaMover = 'Mover la ventana',
  tooltipMover = 'Mover la ventana (flechas)',
  etiquetaTamano = 'Cambiar el tamaño de la ventana',
  tooltipTamano = 'Cambiar el tamaño de la ventana (flechas)',
  children,
  ref
}: VentanaFlotanteProps) {
  const idTitulo = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const ultimoFoco = useRef<HTMLElement | null>(null)
  const arrastre = useRef<Arrastre | null>(null)
  const rafaga = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [rem] = useState(remActual)
  // Lo que el usuario eligió (relativo al área); `null` = posición y tamaño iniciales.
  const [deseada, setDeseada] = useState<Geometria | null>(preferencia)
  const [preferenciaVista, setPreferenciaVista] = useState(preferencia)
  const [arrastrando, setArrastrando] = useState(false)
  if (!iguales(preferencia, preferenciaVista)) {
    setPreferenciaVista(preferencia)
    setDeseada(preferencia)
  }

  const diseno = tamanosDiseno(rem)
  const minimo = diseno.minimo
  const inicial = tamanoRecomendadoRem
    ? { ancho: tamanoRecomendadoRem.ancho * rem, alto: tamanoRecomendadoRem.alto * rem }
    : diseno.inicial
  const tamanoInicial = acotarTamano(inicial, limites, minimo)
  const geoInicial: Geometria = {
    ...posicionInicial(limites, referencia, tamanoInicial),
    ...tamanoInicial
  }
  const geo = acotarGeometria(deseada ?? geoInicial, limites, minimo)
  const reducida = esReducida(limites, minimo)

  const ultimaEmitida = useRef(geo)
  const geoActual = useRef(geo)
  const emitir = useRef(alCambiarPreferencia)
  useEffect(() => {
    emitir.current = alCambiarPreferencia
    geoActual.current = geo
  })
  useEffect(
    () => () => {
      clearTimeout(rafaga.current)
    },
    []
  )

  const confirmar = (g: Geometria) => {
    if (igualesGeometria(g, ultimaEmitida.current)) return
    ultimaEmitida.current = g
    emitir.current?.(g)
  }
  const confirmarTrasRafaga = () => {
    clearTimeout(rafaga.current)
    rafaga.current = setTimeout(() => confirmar(geoActual.current), RETARDO_RAFAGA_MS)
  }

  useImperativeHandle(ref, () => ({
    enfocarUltimo() {
      const nodo = raiz.current
      if (!nodo) return
      const destino =
        ultimoFoco.current?.isConnected && nodo.contains(ultimoFoco.current)
          ? ultimoFoco.current
          : (nodo.querySelector<HTMLElement>(ENFOCABLES) ?? nodo)
      destino.focus()
    },
    elemento: () => raiz.current
  }))

  // F6 / Mayús + F6: de dentro al editor (lo hace el contenedor) y de fuera de vuelta adentro.
  useEffect(() => {
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'F6' || e.defaultPrevented) return
      if (document.querySelector('[aria-modal="true"]')) return
      const nodo = raiz.current
      if (!nodo) return
      e.preventDefault()
      if (nodo.contains(document.activeElement)) alSalirDelFoco?.()
      else {
        const destino =
          ultimoFoco.current?.isConnected && nodo.contains(ultimoFoco.current)
            ? ultimoFoco.current
            : (nodo.querySelector<HTMLElement>(ENFOCABLES) ?? nodo)
        destino.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [alSalirDelFoco])

  // Esc cancela el arrastre en curso (y no llega al editor).
  useEffect(() => {
    if (!arrastrando) return
    const alEscapar = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      const a = arrastre.current
      arrastre.current = null
      setArrastrando(false)
      if (a) setDeseada(a.inicio)
    }
    window.addEventListener('keydown', alEscapar, true)
    return () => window.removeEventListener('keydown', alEscapar, true)
  }, [arrastrando])

  function iniciar(tipo: Arrastre['tipo'], e: PointerEvent<HTMLElement>) {
    if (e.button !== 0 || reducida) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    arrastre.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      inicio: geo,
      tipo,
      movido: false
    }
    setArrastrando(true)
  }
  function alBajarBarra(e: PointerEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('[data-sin-arrastre]')) return
    iniciar('mover', e)
  }
  function alMover(e: PointerEvent<HTMLElement>) {
    const a = arrastre.current
    if (!a || e.pointerId !== a.id) return
    a.movido = true
    const dx = e.clientX - a.x
    const dy = e.clientY - a.y
    if (a.tipo === 'mover') {
      setDeseada({
        ...a.inicio,
        ...acotarPosicion({ x: a.inicio.x + dx, y: a.inicio.y + dy }, a.inicio, limites)
      })
    } else {
      const t = acotarTamano(
        { ancho: a.inicio.ancho + dx, alto: a.inicio.alto + dy },
        limites,
        minimo
      )
      setDeseada(acotarGeometria({ ...a.inicio, ...t }, limites, minimo))
    }
  }
  function alSoltar(e: PointerEvent<HTMLElement>) {
    const a = arrastre.current
    if (!a || e.pointerId !== a.id) return
    arrastre.current = null
    setArrastrando(false)
    if (a.movido) confirmar(geoActual.current)
  }

  function alTeclearAsa(tipo: 'mover' | 'tamano', e: KeyboardEvent<HTMLElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey || reducida) return
    let nuevo: Geometria | null = null
    if (tipo === 'mover') {
      const p = moverConTeclado(geo, e.key, e.shiftKey, geoInicial, limites)
      if (p) nuevo = { ...geo, ...p }
    } else {
      const t = redimensionarConTeclado(geo, e.key, e.shiftKey, tamanoInicial, limites, minimo)
      if (t) nuevo = acotarGeometria({ ...geo, ...t }, limites, minimo)
    }
    if (!nuevo) return
    e.preventDefault()
    e.stopPropagation()
    setDeseada(nuevo)
    geoActual.current = nuevo
    confirmarTrasRafaga()
  }

  function alRestablecer(e: MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('[data-sin-arrastre]') || reducida) return
    setDeseada(null)
    geoActual.current = geoInicial
    confirmar(geoInicial)
  }

  // Tab cicla dentro de la ventana, como un diálogo (sin atrapar el foco al hacer clic fuera).
  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || e.defaultPrevented) return
    const nodo = raiz.current!
    const lista = Array.from(nodo.querySelectorAll<HTMLElement>(ENFOCABLES))
    if (lista.length === 0) {
      e.preventDefault()
      return
    }
    const primero = lista[0]!
    const ultimo = lista[lista.length - 1]!
    const activo = document.activeElement
    if (e.shiftKey && (activo === primero || activo === nodo)) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && activo === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  return createPortal(
    // `dialog` no modal: el contenedor gestiona el teclado de Tab y recuerda el último foco interno.
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
    <div
      ref={raiz}
      role="dialog"
      aria-modal="false"
      aria-labelledby={idTitulo}
      tabIndex={-1}
      className={estilos.ventana}
      {...{ [ATRIBUTO_VENTANA_FLOTANTE]: '' }}
      data-reducida={reducida || undefined}
      style={{
        left: limites.left + geo.x,
        top: limites.top + geo.y,
        width: geo.ancho,
        height: geo.alto
      }}
      onKeyDown={alTeclear}
      onFocus={(e) => {
        if (e.target !== raiz.current) ultimoFoco.current = e.target as HTMLElement
      }}
    >
      {/* La barra es solo una superficie de arrastre: el teclado usa el asa «Mover la ventana». */}
      <div
        className={estilos.barra}
        data-barra-titulo=""
        style={reducida ? { cursor: 'default' } : undefined}
        onPointerDown={alBajarBarra}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onDoubleClick={alRestablecer}
      >
        <Tooltip contenido={tooltipMover}>
          <button
            type="button"
            className={estilos.asaMover}
            aria-label={etiquetaMover}
            onKeyDown={(e) => alTeclearAsa('mover', e)}
          >
            <Icono icono={GripVertical} tamano={16} />
          </button>
        </Tooltip>
        <h2 id={idTitulo} className={estilos.titulo}>
          {titulo}
        </h2>
        <div className={estilos.botones} data-sin-arrastre="">
          {botones}
        </div>
      </div>
      <div className={estilos.cuerpo}>{children}</div>
      {!reducida && (
        <span className={estilos.esquina}>
          <Tooltip contenido={tooltipTamano}>
            <button
              type="button"
              className={estilos.asaTamano}
              aria-label={etiquetaTamano}
              onPointerDown={(e) => iniciar('tamano', e)}
              onPointerMove={alMover}
              onPointerUp={alSoltar}
              onPointerCancel={alSoltar}
              onKeyDown={(e) => alTeclearAsa('tamano', e)}
            >
              <Icono icono={MoveDiagonal2} tamano={16} />
            </button>
          </Tooltip>
        </span>
      )}
    </div>,
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions */
    document.body
  )
}
