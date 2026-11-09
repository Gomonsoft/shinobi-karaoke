import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode
} from 'react'
import { formatearTiempo } from '@shared/letras/tiempos'
import {
  crearVistaLineaTiempo,
  desplazarLineaTiempo,
  pixelATiempo,
  tiempoAPixel,
  type ModeloLineaTiempo,
  type VistaLineaTiempo
} from './lineaTiempo'
import { E } from './textos'
import estilos from './pistaSincronia.module.css'

export type Arrastre = {
  control: HTMLElement
  id: number
  origenX: number
  inicioMs: number
}

export function iniciarCaptura(e: PointerEvent<HTMLElement>, ms: number): Arrastre {
  e.currentTarget.focus({ preventScroll: true })
  e.currentTarget.setPointerCapture?.(e.pointerId)
  return { control: e.currentTarget, id: e.pointerId, origenX: e.clientX, inicioMs: ms }
}

interface Props {
  /** Intervalo visible de la línea de tiempo. */
  vista: VistaLineaTiempo
  duracionMs: number
  modelo: ModeloLineaTiempo
  /** Forma de onda de toda la canción (si hay picos). */
  ondaGeneral?: ReactNode
  /**
   * Variante de la fila minimizada: solo informa y busca. Un clic busca a ese instante; el
   * rectángulo del intervalo visible no se arrastra y todo es `aria-hidden` (la barra de tiempo del
   * transporte es su equivalente accesible).
   */
  informativa?: boolean
  inactiva: boolean
  bordeArrastrado?: 'inicio' | 'fin'
  cambiarVista(vista: VistaLineaTiempo): void
  buscar(ms: number): void
  obtenerTiempoAudio(): number
  sonando: boolean
  posicionMs: number
}

/** Minimapa de la canción completa: mini regiones, intervalo visible y (si es informativa) cabezal. */
export function VistaGeneral({
  vista,
  duracionMs,
  modelo,
  ondaGeneral,
  informativa = false,
  inactiva,
  bordeArrastrado,
  cambiarVista,
  buscar,
  obtenerTiempoAudio,
  sonando,
  posicionMs
}: Props) {
  const { inicioMs, finMs } = vista
  const extension = finMs - inicioMs
  const escalaGeneral = crearVistaLineaTiempo(duracionMs)
  const minimapa = useRef<HTMLDivElement>(null)
  const cabezal = useRef<HTMLDivElement>(null)
  const mapaArrastre = useRef<Arrastre | null>(null)

  useEffect(() => {
    const nodo = cabezal.current
    if (!nodo || duracionMs <= 0) return
    let frame = 0
    function pintar() {
      const actual = Math.min(Math.max(obtenerTiempoAudio(), 0), duracionMs)
      nodo!.style.left = `${tiempoAPixel(crearVistaLineaTiempo(duracionMs), 100, actual)}%`
      if (sonando) frame = requestAnimationFrame(pintar)
    }
    pintar()
    return () => cancelAnimationFrame(frame)
  }, [informativa, duracionMs, obtenerTiempoAudio, posicionMs, sonando])

  function teclaFlecha(e: KeyboardEvent<HTMLElement>, aplicar: (sentido: number) => void) {
    if (e.ctrlKey || e.metaKey || e.altKey || inactiva) return
    const sentido = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (sentido === 0) return
    e.preventDefault()
    aplicar(sentido)
  }

  function buscarEnMapa(e: MouseEvent<HTMLElement>) {
    const caja = minimapa.current?.getBoundingClientRect()
    if (!caja?.width) return
    buscar(
      Math.min(
        Math.max(pixelATiempo(escalaGeneral, caja.width, e.clientX - caja.left), 0),
        duracionMs
      )
    )
  }

  const regiones = (
    <div className={estilos.miniRegiones} aria-hidden="true">
      {modelo.regiones.map(
        ({ id, audible }) =>
          audible && (
            <span
              key={id}
              style={{
                left: `${tiempoAPixel(escalaGeneral, 100, audible.inicioMs)}%`,
                width: `${tiempoAPixel(escalaGeneral, 100, audible.finMs - audible.inicioMs)}%`
              }}
            />
          )
      )}
    </div>
  )
  const estiloVentana = {
    left: `${tiempoAPixel(escalaGeneral, 100, inicioMs)}%`,
    width: `${tiempoAPixel(escalaGeneral, 100, extension)}%`
  }

  if (informativa) {
    return (
      // Solo informa y busca con el ratón; el equivalente accesible es la barra del transporte.
      <div
        className={`${estilos.vistaGeneral} ${estilos.informativa}`}
        ref={minimapa}
        aria-hidden="true"
        data-vista-general="informativa"
        onClick={buscarEnMapa}
      >
        {ondaGeneral}
        {regiones}
        <div className={`${estilos.ventana} ${estilos.ventanaInformativa}`} style={estiloVentana} />
        <div ref={cabezal} className={estilos.cabezalGeneral} data-cabezal-general />
      </div>
    )
  }

  return (
    <div className={estilos.vistaGeneral} ref={minimapa}>
      {ondaGeneral}
      {regiones}
      <div
        className={estilos.ventana}
        role="slider"
        tabIndex={inactiva ? -1 : 0}
        data-foco-editor="segmentado"
        aria-disabled={inactiva || undefined}
        aria-label={E.timeline.general}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, duracionMs - extension)}
        aria-valuenow={inicioMs}
        aria-valuetext={E.timeline.intervalo(formatearTiempo(inicioMs), formatearTiempo(finMs))}
        style={estiloVentana}
        onKeyDown={(e) =>
          teclaFlecha(e, (sentido) =>
            cambiarVista(desplazarLineaTiempo(vista, duracionMs, sentido * extension * 0.1))
          )
        }
        onPointerDown={(e) => {
          if (inactiva || bordeArrastrado || e.button !== 0) return
          e.preventDefault()
          mapaArrastre.current = iniciarCaptura(e, inicioMs)
        }}
        onPointerMove={(e) => {
          const captura = mapaArrastre.current
          const ancho = minimapa.current?.getBoundingClientRect().width
          if (!captura || captura.id !== e.pointerId || !ancho || inactiva) return
          const origen = { inicioMs: captura.inicioMs, finMs: captura.inicioMs + extension }
          cambiarVista(
            desplazarLineaTiempo(
              origen,
              duracionMs,
              pixelATiempo(escalaGeneral, ancho, e.clientX - captura.origenX)
            )
          )
        }}
        onPointerUp={() => {
          mapaArrastre.current = null
        }}
        onPointerCancel={() => {
          mapaArrastre.current = null
        }}
        onLostPointerCapture={() => {
          mapaArrastre.current = null
        }}
      />
    </div>
  )
}
