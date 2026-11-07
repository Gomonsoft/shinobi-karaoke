import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode
} from 'react'
import type { Letra } from '@shared/letra'
import { formatearTiempo, limitesInicio } from '@shared/letras/tiempos'
import { Boton } from '../../componentes/Boton'
import {
  ajustarVistaLineaTiempo,
  centrarLineaTiempo,
  crearVistaLineaTiempo,
  desplazarLineaTiempo,
  pixelATiempo,
  proyectarLineaTiempo,
  recortarIntervalo,
  tiempoAPixel,
  zoomALinea,
  zoomLineaTiempo,
  type VistaLineaTiempo
} from './lineaTiempo'
import { E } from './textos'
import estilos from './pistaSincronia.module.css'

type Borde = 'inicio' | 'fin'
interface Props {
  letra: Letra
  seleccion: string | null
  duracionMs: number
  inactiva: boolean
  sonando: boolean
  posicionMs: number
  obtenerTiempoAudio(): number
  buscar(ms: number): void
  seleccionar(id: string): void
  iniciarMarcador(borde: Borde): boolean
  moverMarcador(ms: number): void
  terminarMarcador(confirmar: boolean): void
  ajustarMarcador(borde: Borde, delta: number): void
  bordeArrastrado: Borde | undefined
  limite: string | null
  onda?: (vista: VistaLineaTiempo) => ReactNode
  ondaGeneral?: ReactNode
}

type Arrastre = {
  control: HTMLElement
  id: number
  origenX: number
  inicioMs: number
}

function iniciarCaptura(e: PointerEvent<HTMLElement>, ms: number): Arrastre {
  e.currentTarget.focus({ preventScroll: true })
  e.currentTarget.setPointerCapture?.(e.pointerId)
  return { control: e.currentTarget, id: e.pointerId, origenX: e.clientX, inicioMs: ms }
}

interface PropsTirador {
  borde: Borde
  ms: number
  limites: VistaLineaTiempo
  vista: VistaLineaTiempo
  automatico: boolean
  activo: boolean
  ocupado: boolean
  iniciar: Props['iniciarMarcador']
  mover: Props['moverMarcador']
  terminar: Props['terminarMarcador']
  ajustar: Props['ajustarMarcador']
}

function Tirador({
  borde,
  ms,
  limites,
  vista,
  automatico,
  activo,
  ocupado,
  iniciar,
  mover,
  terminar,
  ajustar
}: PropsTirador) {
  const arrastre = useRef<Arrastre | null>(null)
  useEffect(() => {
    const captura = arrastre.current
    if (activo || !captura) return
    arrastre.current = null
    if (captura.control.hasPointerCapture?.(captura.id)) {
      captura.control.releasePointerCapture(captura.id)
    }
  }, [activo])

  function alMover(e: PointerEvent<HTMLElement>) {
    const captura = arrastre.current
    const ancho = e.currentTarget.parentElement?.getBoundingClientRect().width
    if (!captura || e.pointerId !== captura.id || !ancho || !activo) return
    mover(
      captura.inicioMs + ((e.clientX - captura.origenX) / ancho) * (vista.finMs - vista.inicioMs)
    )
  }

  function cerrar(e: PointerEvent<HTMLElement>, confirmar: boolean) {
    if (arrastre.current?.id !== e.pointerId) return
    if (confirmar) alMover(e)
    arrastre.current = null
    terminar(confirmar)
  }

  return (
    <div
      className={estilos.tirador}
      data-borde={borde}
      data-auto={automatico || undefined}
      style={{ left: `${Math.max(0, Math.min(100, tiempoAPixel(vista, 100, ms)))}%` }}
      role="slider"
      tabIndex={0}
      aria-label={
        borde === 'inicio' ? E.timeline.inicio : automatico ? E.timeline.finAuto : E.timeline.fin
      }
      aria-valuemin={limites.inicioMs}
      aria-valuemax={limites.finMs}
      aria-valuenow={Math.max(limites.inicioMs, Math.min(ms, limites.finMs))}
      aria-valuetext={formatearTiempo(ms)}
      data-foco-editor="segmentado"
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || ocupado) return
        const sentido = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
        if (!sentido) return
        e.preventDefault()
        ajustar(borde, sentido * (e.shiftKey ? 100 : 10))
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || ocupado || !iniciar(borde)) return
        e.preventDefault()
        arrastre.current = iniciarCaptura(e, ms)
      }}
      onPointerMove={alMover}
      onPointerUp={(e) => cerrar(e, true)}
      onPointerCancel={(e) => cerrar(e, false)}
      onLostPointerCapture={(e) => cerrar(e, false)}
    />
  )
}

export function PistaSincronia({
  letra,
  seleccion,
  duracionMs,
  inactiva,
  sonando,
  posicionMs,
  obtenerTiempoAudio,
  buscar,
  seleccionar,
  iniciarMarcador,
  moverMarcador,
  terminarMarcador,
  ajustarMarcador,
  bordeArrastrado,
  limite,
  onda,
  ondaGeneral
}: Props) {
  const [vistaGuardada, setVista] = useState<VistaLineaTiempo | null>(null)
  const vista = vistaGuardada
    ? ajustarVistaLineaTiempo(vistaGuardada, duracionMs)
    : crearVistaLineaTiempo(duracionMs)
  const { inicioMs, finMs } = vista
  const extension = finMs - inicioMs
  const modelo = useMemo(() => proyectarLineaTiempo(letra, duracionMs), [letra, duracionMs])
  const activa = modelo.regiones.find((r) => r.id === seleccion)
  const limites = useMemo(() => {
    if (!activa) return null
    const { min, max } = limitesInicio(letra, activa.id)
    const acotar = (ms: number) => Math.max(0, Math.min(duracionMs, ms))
    return {
      inicio: {
        inicioMs: acotar(min + letra.offset_ms),
        finMs: acotar(max === null ? duracionMs : max + letra.offset_ms)
      },
      fin: {
        inicioMs: acotar(activa.real.inicioMs + 1),
        finMs: acotar(max === null ? duracionMs + letra.offset_ms : max + 1 + letra.offset_ms)
      }
    }
  }, [activa, letra, duracionMs])
  const eje = useRef<HTMLDivElement>(null)
  const cabezal = useRef<HTMLDivElement>(null)
  const minimapa = useRef<HTMLDivElement>(null)
  const mapaArrastre = useRef<Arrastre | null>(null)

  const alGirar = useEffectEvent((e: WheelEvent) => {
    if (inactiva || bordeArrastrado || !eje.current || extension <= 0) return
    const { left, width } = eje.current.getBoundingClientRect()
    if (!width) return
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.25 : 0.8
      setVista(zoomLineaTiempo(vista, duracionMs, factor, (e.clientX - left) / width))
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const delta = e.deltaX || e.deltaY
      const pixeles = delta * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? width : 1)
      const siguiente = desplazarLineaTiempo(vista, duracionMs, (pixeles / width) * extension)
      if (siguiente.inicioMs !== inicioMs) {
        e.preventDefault()
        setVista(siguiente)
      }
    }
  })
  useEffect(() => {
    const nodo = eje.current
    if (!nodo) return
    const rueda = (e: WheelEvent) => alGirar(e)
    nodo.addEventListener('wheel', rueda, { passive: false })
    return () => nodo.removeEventListener('wheel', rueda)
  }, [])

  useEffect(() => {
    const nodo = cabezal.current
    if (!nodo) return
    let frame = 0
    function pintar() {
      const actual = obtenerTiempoAudio()
      const visible = actual >= inicioMs && actual <= finMs && finMs > inicioMs
      nodo!.style.visibility = visible ? 'visible' : 'hidden'
      nodo!.style.left = `${tiempoAPixel({ inicioMs, finMs }, 100, actual)}%`
      if (sonando) frame = requestAnimationFrame(pintar)
    }
    pintar()
    return () => cancelAnimationFrame(frame)
  }, [inicioMs, finMs, obtenerTiempoAudio, posicionMs, sonando])

  function teclaFlecha(e: KeyboardEvent<HTMLElement>, aplicar: (sentido: number) => void) {
    if (e.ctrlKey || e.metaKey || e.altKey || inactiva) return
    const sentido = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (sentido === 0) return
    e.preventDefault()
    aplicar(sentido)
  }

  const reglaPosicion = Math.max(inicioMs, Math.min(posicionMs, finMs))
  const escalaGeneral = crearVistaLineaTiempo(duracionMs)
  const zoomDisponible = !inactiva && !bordeArrastrado && extension > 0

  return (
    <section className={estilos.timeline} aria-label={E.timeline.titulo}>
      <div className={estilos.controles}>
        <h2>{E.timeline.titulo}</h2>
        <Boton
          aria-label={E.timeline.menos}
          disabled={!zoomDisponible}
          onClick={() => setVista(zoomLineaTiempo(vista, duracionMs, 0.8, 0.5))}
        >
          −
        </Boton>
        <Boton
          aria-label={E.timeline.mas}
          disabled={!zoomDisponible}
          onClick={() => setVista(zoomLineaTiempo(vista, duracionMs, 1.25, 0.5))}
        >
          +
        </Boton>
        <Boton
          disabled={!zoomDisponible || !activa?.audible}
          onClick={() => activa?.audible && setVista(zoomALinea(activa.audible, duracionMs))}
        >
          {E.timeline.linea}
        </Boton>
        <Boton disabled={!zoomDisponible} onClick={() => setVista(null)}>
          {E.timeline.todo}
        </Boton>
        <Boton
          disabled={!zoomDisponible}
          onClick={() => setVista(centrarLineaTiempo(vista, duracionMs, obtenerTiempoAudio()))}
        >
          {E.timeline.cabezal}
        </Boton>
        {!activa && <span>{E.timeline.zoomSinInicio}</span>}
      </div>
      <div className={estilos.eje} ref={eje}>
        <div className={estilos.regla}>
          <div className={estilos.marcas} aria-hidden="true">
            {[0, 0.25, 0.5, 0.75, 1].map((fraccion) => (
              <span key={fraccion}>{formatearTiempo(inicioMs + extension * fraccion)}</span>
            ))}
          </div>
          <input
            type="range"
            aria-label={E.timeline.regla}
            aria-valuetext={formatearTiempo(reglaPosicion)}
            disabled={!zoomDisponible}
            min={inicioMs}
            max={finMs}
            step="any"
            value={reglaPosicion}
            data-foco-editor="segmentado"
            onChange={(e) => buscar(e.currentTarget.valueAsNumber)}
            onKeyDown={(e) =>
              teclaFlecha(e, (sentido) =>
                buscar(Math.max(inicioMs, Math.min(finMs, reglaPosicion + sentido * 5000)))
              )
            }
          />
        </div>
        {onda?.(vista)}
        <div className={estilos.pista}>
          {modelo.pausas
            .filter((p) => p.tiempoMs >= inicioMs && p.tiempoMs <= finMs)
            .map((p) => (
              <span
                key={p.id}
                aria-hidden="true"
                className={estilos.pausa}
                style={{ left: `${tiempoAPixel(vista, 100, p.tiempoMs)}%` }}
              />
            ))}
          {modelo.regiones.map((r) => {
            const visible = recortarIntervalo(r.real, vista)
            if (!visible) return null
            const esActiva = r.id === seleccion
            return (
              <button
                type="button"
                key={r.id}
                className={estilos.region}
                aria-pressed={esActiva}
                data-inicio-recortado={visible.inicioRecortado || undefined}
                data-fin-recortado={visible.finRecortado || undefined}
                disabled={inactiva}
                title={r.texto}
                style={{
                  left: `${tiempoAPixel(vista, 100, visible.inicioMs)}%`,
                  width: `${tiempoAPixel(vista, 100, visible.finMs) - tiempoAPixel(vista, 100, visible.inicioMs)}%`
                }}
                onClick={() => seleccionar(r.id)}
              >
                {r.texto}
              </button>
            )
          })}
          {activa &&
            limites &&
            !inactiva &&
            (['inicio', 'fin'] as const).map((borde) => {
              const ms = borde === 'inicio' ? activa.real.inicioMs : activa.real.finMs
              if (bordeArrastrado !== borde && (ms < inicioMs || ms > finMs)) return null
              const automatico = borde === 'fin' && activa.finAutomatico
              return (
                <Tirador
                  key={borde}
                  borde={borde}
                  ms={ms}
                  limites={limites[borde]}
                  vista={vista}
                  automatico={automatico}
                  activo={bordeArrastrado === borde}
                  ocupado={bordeArrastrado !== undefined}
                  iniciar={iniciarMarcador}
                  mover={moverMarcador}
                  terminar={terminarMarcador}
                  ajustar={ajustarMarcador}
                />
              )
            })}
        </div>
        <div aria-hidden="true" ref={cabezal} className={estilos.cabezal} />
      </div>
      <div className={estilos.vistaGeneral} ref={minimapa}>
        {ondaGeneral}
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
          style={{
            left: `${tiempoAPixel(escalaGeneral, 100, inicioMs)}%`,
            width: `${tiempoAPixel(escalaGeneral, 100, extension)}%`
          }}
          onKeyDown={(e) =>
            teclaFlecha(e, (sentido) =>
              setVista(desplazarLineaTiempo(vista, duracionMs, sentido * extension * 0.1))
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
            setVista(
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
      <div className={estilos.limite} aria-live="polite">
        {limite}
      </div>
    </section>
  )
}
