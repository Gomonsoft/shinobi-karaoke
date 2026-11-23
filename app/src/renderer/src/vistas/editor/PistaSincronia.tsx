import {
  Fragment,
  useEffect,
  useId,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode
} from 'react'
import { AudioWaveform, ChevronDown, ChevronUp, FoldVertical, Users } from 'lucide-react'
import type { Estilo } from '@shared/estilo'
import { siguienteQueChoca, tienePalabrasManuales, type Letra } from '@shared/letra'
import { cantantesDe, colorDeParte, inicial, parteDe, type Parte } from '@shared/reparto'
import { formatearTiempo, limitesInicio } from '@shared/letras/tiempos'
import { Boton } from '../../componentes/Boton'
import { MenuContextual } from '../../componentes/MenuContextual'
import { Tooltip } from '../../componentes/Tooltip'
import { useSoloIcono } from './useSoloIcono'
import { BotonLayout } from './BotonLayout'
import { ChipParte } from './ChipParte'
import { ALTO_SUBFILA, etiquetaParte, P, subfilasJuntas } from './partes'
import { VistaGeneral, iniciarCaptura, type Arrastre } from './VistaGeneral'
import {
  ajustarVistaLineaTiempo,
  centrarLineaTiempo,
  crearVistaLineaTiempo,
  desplazarLineaTiempo,
  proyectarLineaTiempo,
  recortarIntervalo,
  tiempoAPixel,
  zoomALinea,
  zoomLineaTiempo,
  type VistaLineaTiempo
} from './lineaTiempo'
import { E } from './textos'
import { R } from './revision/textos'
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
  /** Doble clic en el cuerpo de una región; `false` si la línea queda fuera del audio. */
  escucharLinea?(id: string): boolean
  /** Línea abierta en el editor preciso: sin tiradores y con el tooltip `edi.preciso.ocupado`. */
  ocupadaId?: string | null
  iniciarMarcador(borde: Borde): boolean
  moverMarcador(ms: number): void
  terminarMarcador(confirmar: boolean): void
  ajustarMarcador(borde: Borde, delta: number): void
  bordeArrastrado: Borde | undefined
  limite: string | null
  onda?: (vista: VistaLineaTiempo) => ReactNode
  ondaGeneral?: ReactNode
  /** Fila de 44/40 px con el minimapa informativo (preferencia, falta de espacio o modo sincronizar). */
  minimizada?: boolean
  /** Motivo por el que «Expandir» no está disponible (`aria-disabled`); no se guarda como preferencia. */
  expandirNoDisponible?: string
  alternarMinimizada?(): void
  /** «Ajustar los silencios» (fila de controles, a la derecha antes de «Minimizar»). */
  botonSilencios?: ReactNode
  /** Líneas recién ajustadas: se resaltan 2 s (spec AS, «Cómo se ve después»). */
  resaltadas?: ReadonlySet<string>
  /** Líneas movidas por «Corregir el desfase»: borde `info` 2 s (spec 06 · Feature 4, «Aplicar»). */
  resaltadasDesfase?: ReadonlySet<string>
  /** Líneas pendientes de revisar (feature 11): id → motivo principal. Llevan una banderita. */
  dudosas?: ReadonlyMap<string, string>
  /** Con carriles, el mensaje de la onda (preparando, sin separar, no disponible) sale de ellos. */
  mensajeOnda?: { texto: string; reintentar?: () => void }
  /** Cada cambio pide acercar la línea seleccionada si su región es pequeña o no cabe. */
  zoomRevision?: number
  /**
   * Reparto (0.2.3, solo en canciones con reparto): carriles según `carriles(letra)`, alto efectivo de
   * cada uno, si se ven juntos (preferencia o por falta de espacio) y colores de las partes.
   */
  reparto?: {
    carriles: Parte[]
    altoCarril: number
    juntos: boolean
    juntosPorEspacio: boolean
    alternarJuntos(): void
    estilo: Pick<Estilo, 'letra'>
    /** Sin él (modo al ritmo, sesión bloqueada) no hay arrastre entre carriles. */
    asignar?(destino: Parte | 'nuevo', ids: string[]): void
    /** Cantantes de la canción (con menos de 4 hay franja «+ Nuevo cantante» al arrastrar). */
    cantantes: number
    /** Pasar estas líneas a esa parte las solaparía con otra de la misma parte (carril prohibido). */
    solapaAl?(ids: string[], parte: Parte): boolean
    /** Franjas de destino que aparecen (o dejan de aparecer) durante un arrastre: el editor las cuenta en el alto. */
    alArrastrar?(franjas: number): void
  }
  /** Líneas seleccionadas (varias se mueven juntas al arrastrar). */
  seleccionadas?: readonly string[]
  /** La pista deja aquí la función que cancela el arrastre en curso (Esc, ADR 0029 §5); `true` si cancelaba algo. */
  cancelarArrastreRef?: MutableRefObject<(() => boolean) | null>
}

const UMBRAL_ARRASTRE_PX = 8
type FilaCarril = { id: Parte | 'nuevo'; virtual: boolean }
interface EstadoArrastre {
  ids: string[]
  dy: number
  destino: number | null
}

interface PropsTirador {
  borde: Borde
  ms: number
  limites: VistaLineaTiempo
  vista: VistaLineaTiempo
  automatico: boolean
  /** Línea con palabras hechas a mano: el tooltip avisa de que moverlo las quita (P19). */
  conPalabras: boolean
  /** Con carriles, el tirador va en el carril de su región (24 × 24 escalonados). */
  carril?: { top: number; alto: number }
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
  conPalabras,
  carril,
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
      style={{
        left: `${Math.max(0, Math.min(100, tiempoAPixel(vista, 100, ms)))}%`,
        ...(carril
          ? {
              top: borde === 'inicio' ? carril.top : carril.top + carril.alto - 24,
              bottom: 'auto',
              height: 24
            }
          : {})
      }}
      role="slider"
      tabIndex={0}
      title={
        conPalabras
          ? `${borde === 'inicio' ? E.timeline.inicio : automatico ? E.timeline.finAuto : E.timeline.fin}. ${E.preciso.avisoTirador}`
          : undefined
      }
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

/** Nombre en la etiqueta del carril: con el nombre predeterminado, solo «Cantante» (el número va en el chip). */
function nombreCarril(letra: Letra, parte: Parte): string {
  const c = cantantesDe(letra).find((x) => x.id === parte)
  return c && c.nombre === null ? 'Cantante' : etiquetaParte(letra, parte)
}

/** Mensaje de la onda con carriles: icono sobre la columna de etiquetas, con tooltip (y «Reintentar»). */
function MensajeOnda({ mensaje }: { mensaje: { texto: string; reintentar?: () => void } }) {
  const id = useId()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const texto = mensaje.reintentar ? `${mensaje.texto} ${P.reintentarOnda}` : mensaje.texto
  return (
    <>
      <Tooltip contenido={texto}>
        <button
          type="button"
          className={estilos.mensajeOnda}
          aria-describedby={id}
          aria-label="Forma de onda de la voz"
          data-mensaje-onda=""
          onClick={() => mensaje.reintentar?.()}
          onContextMenu={(e) => {
            if (!mensaje.reintentar) return
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY })
          }}
        >
          <AudioWaveform size={16} aria-hidden="true" />
        </button>
      </Tooltip>
      <span id={id} className={estilos.soloLector} role="status">
        {mensaje.texto}
      </span>
      {menu && mensaje.reintentar && (
        <MenuContextual
          etiqueta="Forma de onda de la voz"
          punto={menu}
          alCerrar={() => setMenu(null)}
          items={[{ id: 'reintentar', etiqueta: 'Reintentar', alSeleccionar: mensaje.reintentar }]}
        />
      )}
    </>
  )
}

/** Inicios de las palabras hechas a mano salvo el primero: fronteras de 1 px de la región (P19). */
function fronterasDe(letra: Letra, id: string): number[] {
  const el = letra.lineas.find((l) => l.id === id)
  return el && tienePalabrasManuales(el) ? el.palabras!.slice(1).map((p) => p.inicio_ms) : []
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
  escucharLinea,
  ocupadaId = null,
  iniciarMarcador,
  moverMarcador,
  terminarMarcador,
  ajustarMarcador,
  bordeArrastrado,
  limite,
  onda,
  ondaGeneral,
  minimizada = false,
  expandirNoDisponible,
  alternarMinimizada,
  botonSilencios,
  resaltadas,
  resaltadasDesfase,
  dudosas,
  zoomRevision = 0,
  reparto,
  mensajeOnda,
  seleccionadas,
  cancelarArrastreRef
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
    const i = letra.lineas.findIndex((l) => l.id === activa.id)
    const j = siguienteQueChoca(letra.lineas, i, letra)
    const topeFin = j < 0 ? null : letra.lineas[j]!.inicio_ms
    const acotar = (ms: number) => Math.max(0, Math.min(duracionMs, ms))
    return {
      inicio: {
        inicioMs: acotar(min + letra.offset_ms),
        finMs: acotar(max === null ? duracionMs : max + letra.offset_ms)
      },
      fin: {
        inicioMs: acotar(activa.real.inicioMs + 1),
        // El fin solo respeta a la siguiente línea que choca (voces a la vez, ADR 0029 §7).
        finMs: acotar(
          topeFin === null ? duracionMs + letra.offset_ms : topeFin + 1 + letra.offset_ms
        )
      }
    }
  }, [activa, letra, duracionMs])
  const [fuera, setFuera] = useState<string | null>(null)
  useEffect(() => {
    if (fuera === null) return
    const t = setTimeout(() => setFuera(null), 2000)
    return () => clearTimeout(t)
  }, [fuera])
  const eje = useRef<HTMLDivElement>(null)
  // Revisión guiada: al llegar a una línea, «Zoom a la línea» si su región mide menos de 120 px o no cabe.
  const zoomAtendido = useRef(zoomRevision)
  useEffect(() => {
    if (zoomRevision === zoomAtendido.current) return
    zoomAtendido.current = zoomRevision
    const ancho = eje.current?.getBoundingClientRect().width ?? 0
    const audible = activa?.audible
    if (!audible || !ancho || inactiva) return
    const caja = (audible.finMs - audible.inicioMs) / (vista.finMs - vista.inicioMs)
    const cabe = audible.inicioMs >= vista.inicioMs && audible.finMs <= vista.finMs
    if (caja * ancho < 120 || !cabe) setVista(zoomALinea(audible, duracionMs))
    // Solo reacciona a una petición nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomRevision])
  const cabezal = useRef<HTMLDivElement>(null)

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
  }, [minimizada])

  useEffect(() => {
    const nodo = cabezal.current
    if (!nodo) return
    let frame = 0
    function pintar() {
      const actual = obtenerTiempoAudio()
      const visible = actual >= inicioMs && actual <= finMs && finMs > inicioMs
      // Fuera de la vista no ocupa espacio: un `left` fuera de rango ensancharía la página.
      nodo!.style.display = visible ? '' : 'none'
      if (visible)
        nodo!.style.left = `${Math.min(100, Math.max(0, tiempoAPixel({ inicioMs, finMs }, 100, actual)))}%`
      if (sonando) frame = requestAnimationFrame(pintar)
    }
    pintar()
    return () => cancelAnimationFrame(frame)
  }, [minimizada, inicioMs, finMs, obtenerTiempoAudio, posicionMs, sonando])

  // --- Carriles (0.2.3) ---
  const conCarriles = Boolean(reparto && reparto.carriles.length > 0 && !reparto.juntos)
  const alto = reparto?.altoCarril || 32
  const parteDeLinea = useMemo(
    () => new Map(letra.lineas.map((l) => [l.id, parteDe(l, letra)])),
    [letra]
  )
  const [arrastre, setArrastre] = useState<EstadoArrastre | null>(null)
  const inicioArrastre = useRef<{ x: number; y: number; id: string; pointerId: number } | null>(
    null
  )
  const arrastrando = useRef(false)
  const tragarClic = useRef(false)
  const pista = useRef<HTMLDivElement>(null)
  // Franjas de destino que solo existen durante el arrastre: «+ Nuevo cantante» (bajo el último cantante)
  // y «Todos» en un dúo (en su sitio, antes del Coro).
  const filas = useMemo<FilaCarril[]>(() => {
    if (!reparto || !conCarriles) return []
    const base: FilaCarril[] = reparto.carriles.map((id) => ({ id, virtual: false }))
    if (!arrastre) return base
    const salida = [...base]
    if (reparto.cantantes === 2 && !reparto.carriles.includes('todos')) {
      const i = salida.findIndex((f) => f.id === 'coro')
      salida.splice(i < 0 ? salida.length : i, 0, { id: 'todos', virtual: true })
    }
    if (reparto.cantantes < 4) {
      const ultimo = salida.reduce((n, f, i) => (/^c\d$/.test(f.id) ? i : n), -1)
      salida.splice(ultimo + 1, 0, { id: 'nuevo', virtual: true })
    }
    return salida
  }, [reparto, conCarriles, arrastre])
  // Carriles juntos con voces a la vez: la pista se divide en k sub-filas de 24 px (ninguna región tapa a otra).
  const juntas = Boolean(reparto && reparto.juntos && reparto.carriles.length > 0)
  const ordenDeCarril = (id: string): number =>
    Math.max(0, reparto?.carriles.indexOf(parteDeLinea.get(id) ?? 'c1') ?? 0)
  const { sub: subfilas, k: nSubfilas } = useMemo(
    () =>
      juntas
        ? subfilasJuntas(modelo.regiones, ordenDeCarril)
        : { sub: new Map<string, number>(), k: 1 },
    // `ordenDeCarril` solo depende de `reparto.carriles` y `parteDeLinea`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [juntas, modelo, reparto?.carriles, parteDeLinea]
  )
  const conSubfilas = juntas && nSubfilas > 1
  // La sub-fila de la línea principal siempre a la vista (el scroll vertical es de la pista, nunca de la página).
  useEffect(() => {
    const fila = seleccion ? subfilas.get(seleccion) : undefined
    const caja = pista.current
    if (!conSubfilas || fila === undefined || !caja) return
    const arriba = fila * ALTO_SUBFILA
    if (arriba < caja.scrollTop) caja.scrollTop = arriba
    else if (arriba + ALTO_SUBFILA > caja.scrollTop + caja.clientHeight)
      caja.scrollTop = arriba + ALTO_SUBFILA - caja.clientHeight
  }, [conSubfilas, seleccion, subfilas])
  const carrilDe = (parte: Parte): number =>
    Math.max(
      0,
      filas.findIndex((f) => f.id === parte)
    )
  // Las franjas de destino miden 24 px; los carriles, `alto`. `tops[i]` es el borde superior de la fila i.
  const altoFila = (f: FilaCarril): number => (f.virtual || f.id === 'nuevo' ? 24 : alto)
  const tops = filas.reduce<number[]>((acc, f, i) => [...acc, (acc[i] ?? 0) + altoFila(f)], [0])
  const franjasDeDestino = (): number =>
    reparto && conCarriles
      ? (reparto.cantantes === 2 && !reparto.carriles.includes('todos') ? 1 : 0) +
        (reparto.cantantes < 4 ? 1 : 0)
      : 0

  function cancelarEsteArrastre(): boolean {
    if (!arrastrando.current) return false
    arrastrando.current = false
    inicioArrastre.current = null
    setArrastre(null)
    reparto?.alArrastrar?.(0)
    return true
  }
  useEffect(() => {
    if (!cancelarArrastreRef) return
    cancelarArrastreRef.current = arrastre ? cancelarEsteArrastre : null
    return () => {
      cancelarArrastreRef.current = null
    }
    // `cancelarEsteArrastre` solo usa refs y el setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastre !== null, cancelarArrastreRef])

  function destinoDe(clientY: number): number | null {
    const caja = pista.current?.getBoundingClientRect()
    if (!caja) return null
    const y = clientY - caja.top
    const i = tops.findIndex((t, k) => y >= t && y < (tops[k + 1] ?? t))
    return i >= 0 && i < filas.length ? i : null
  }
  function alPulsarRegion(e: PointerEvent<HTMLElement>, id: string) {
    tragarClic.current = false
    if (!conCarriles || !reparto?.asignar || inactiva || e.button !== 0) return
    inicioArrastre.current = { x: e.clientX, y: e.clientY, id, pointerId: e.pointerId }
  }
  function alMoverRegion(e: PointerEvent<HTMLElement>) {
    const inicio = inicioArrastre.current
    if (!inicio || e.pointerId !== inicio.pointerId) return
    const dy = e.clientY - inicio.y
    if (!arrastrando.current) {
      // El componente horizontal se ignora: el cuerpo nunca mueve tiempos.
      if (Math.abs(dy) < UMBRAL_ARRASTRE_PX) return
      arrastrando.current = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
      reparto?.alArrastrar?.(franjasDeDestino())
    }
    const ids = seleccionadas?.includes(inicio.id) ? [...seleccionadas] : [inicio.id]
    setArrastre({ ids, dy, destino: destinoDe(e.clientY) })
  }
  function alSoltarRegion(e: PointerEvent<HTMLElement>, confirmar: boolean) {
    const inicio = inicioArrastre.current
    if (!inicio || e.pointerId !== inicio.pointerId) return
    const hubo = arrastrando.current
    const destino = confirmar && hubo ? destinoDe(e.clientY) : null
    const ids = arrastre?.ids ?? [inicio.id]
    inicioArrastre.current = null
    arrastrando.current = false
    setArrastre(null)
    if (!hubo) return
    reparto?.alArrastrar?.(0)
    // Lo que sigue a soltar tras arrastrar no es un clic.
    tragarClic.current = true
    const fila = destino === null ? undefined : filas[destino]
    if (fila) reparto?.asignar?.(fila.id, ids)
  }

  function teclaFlecha(e: KeyboardEvent<HTMLElement>, aplicar: (sentido: number) => void) {
    if (e.ctrlKey || e.metaKey || e.altKey || inactiva) return
    const sentido = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (sentido === 0) return
    e.preventDefault()
    aplicar(sentido)
  }

  const soloIcono = useSoloIcono()
  const etiquetaJuntar = reparto?.juntos ? P.separar : P.juntar
  const reglaPosicion = Math.max(inicioMs, Math.min(posicionMs, finMs))
  const zoomDisponible = !inactiva && !bordeArrastrado && extension > 0

  if (minimizada) {
    return (
      <section
        id="zona-linea-tiempo"
        className={`${estilos.timeline} ${estilos.minimizada}`}
        aria-label={E.layout.region(E.layout.timeline.nombre, true)}
      >
        <h2>{E.timeline.titulo}</h2>
        <VistaGeneral
          informativa
          vista={vista}
          duracionMs={duracionMs}
          modelo={modelo}
          ondaGeneral={ondaGeneral}
          inactiva={inactiva}
          cambiarVista={setVista}
          buscar={buscar}
          obtenerTiempoAudio={obtenerTiempoAudio}
          sonando={sonando}
          posicionMs={posicionMs}
        />
        <BotonLayout
          icono={ChevronUp}
          etiqueta={E.layout.timeline.expandir}
          nombre="timeline-expandir"
          expandido={false}
          controla="zona-linea-tiempo"
          noDisponible={expandirNoDisponible}
          onClick={alternarMinimizada}
        />
      </section>
    )
  }

  return (
    <section id="zona-linea-tiempo" className={estilos.timeline} aria-label={E.timeline.titulo}>
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
        {reparto && reparto.carriles.length > 0 && (
          <Tooltip contenido={etiquetaJuntar} suprimir={reparto.juntosPorEspacio}>
            <Boton
              aria-pressed={reparto.juntos}
              aria-label={soloIcono ? etiquetaJuntar : undefined}
              noDisponible={reparto.juntosPorEspacio ? P.juntosSinEspacio : undefined}
              disabled={inactiva}
              onClick={reparto.alternarJuntos}
            >
              <FoldVertical size={16} aria-hidden="true" />
              {!soloIcono && etiquetaJuntar}
            </Boton>
          </Tooltip>
        )}
        {botonSilencios}
        <BotonLayout
          icono={ChevronDown}
          etiqueta={E.layout.timeline.minimizar}
          nombre="timeline-minimizar"
          expandido
          controla="zona-linea-tiempo"
          onClick={alternarMinimizada}
        />
      </div>
      <div className={`${estilos.eje} ${conCarriles ? estilos.conEtiquetas : ''}`} ref={eje}>
        <div className={estilos.regla}>
          {conCarriles && mensajeOnda && <MensajeOnda mensaje={mensajeOnda} />}
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
        <div
          className={`${estilos.pista} ${conCarriles ? estilos.conCarriles : ''} ${conSubfilas ? estilos.conSubfilas : ''}`}
          ref={pista}
          data-carriles={conCarriles ? filas.length : undefined}
          style={
            conCarriles
              ? ({ minHeight: tops[filas.length], '--alto-carril': `${alto}px` } as CSSProperties)
              : conSubfilas
                ? ({ '--alto-subfilas': `${nSubfilas * ALTO_SUBFILA}px` } as CSSProperties)
                : undefined
          }
        >
          {onda?.(vista)}
          {conCarriles &&
            reparto &&
            filas.map((f, i) => {
              const sinLineas =
                !f.virtual &&
                f.id !== 'nuevo' &&
                !modelo.regiones.some((r) => parteDeLinea.get(r.id) === f.id)
              return (
                <div
                  key={f.id}
                  className={estilos.carril}
                  data-virtual={f.virtual || undefined}
                  data-destino={arrastre?.destino === i || undefined}
                  data-prohibido={
                    (arrastre &&
                      f.id !== 'nuevo' &&
                      reparto.solapaAl?.(arrastre.ids, f.id) &&
                      arrastre.destino === i) ||
                    undefined
                  }
                  data-carril={f.id}
                  style={{ top: tops[i], height: altoFila(f) }}
                >
                  {f.id === 'nuevo' ? (
                    <span className={estilos.carrilTexto}>{P.nuevoCarril}</span>
                  ) : (
                    <>
                      <div className={estilos.etiquetaCarril} title={etiquetaParte(letra, f.id)}>
                        <ChipParte letra={letra} estilo={reparto.estilo} parte={f.id} decorativo />
                        <span>{nombreCarril(letra, f.id)}</span>
                      </div>
                      {sinLineas && (
                        <span className={estilos.carrilTexto}>
                          {P.carrilVacio(etiquetaParte(letra, f.id))}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
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
            const parte = parteDeLinea.get(r.id) ?? 'c1'
            const carril = conCarriles ? carrilDe(parte) : 0
            const arrastrada = arrastre?.ids.includes(r.id) ?? false
            const juntasConParte = Boolean(reparto && reparto.juntos && reparto.carriles.length > 0)
            const marca = juntasConParte ? inicial(letra, parte) : null
            const subfila = conSubfilas ? (subfilas.get(r.id) ?? 0) : 0
            const posicion: CSSProperties = conSubfilas
              ? { top: subfila * ALTO_SUBFILA + 2, height: ALTO_SUBFILA - 4 }
              : conCarriles
                ? {
                    top: (tops[carril] ?? 0) + 2,
                    height: altoFila(filas[carril] ?? { id: 'c1', virtual: false }) - 4,
                    transform: arrastrada ? `translateY(${arrastre!.dy}px)` : undefined,
                    zIndex: arrastrada ? 4 : undefined
                  }
                : {}
            return (
              <Fragment key={r.id}>
                <button
                  type="button"
                  className={estilos.region}
                  aria-pressed={esActiva}
                  aria-label={
                    reparto && reparto.carriles.length > 0
                      ? `${r.texto}. ${P.chip(etiquetaParte(letra, parte))}`
                      : undefined
                  }
                  data-foco-editor="region"
                  data-parte={reparto && reparto.carriles.length > 0 ? parte : undefined}
                  data-secundaria={
                    (seleccionadas &&
                      seleccionadas.length > 1 &&
                      seleccionadas.includes(r.id) &&
                      !esActiva) ||
                    undefined
                  }
                  data-arrastrada={arrastrada || undefined}
                  data-inicio-recortado={visible.inicioRecortado || undefined}
                  data-fin-recortado={visible.finRecortado || undefined}
                  data-resaltada={resaltadas?.has(r.id) || undefined}
                  data-resaltada-desfase={resaltadasDesfase?.has(r.id) || undefined}
                  data-dudosa={dudosas?.has(r.id) || undefined}
                  disabled={inactiva}
                  title={
                    r.id === ocupadaId
                      ? E.preciso.ocupado
                      : dudosas?.has(r.id)
                        ? `${E.regionTooltip(r.texto)} · ${R.tooltip(dudosas.get(r.id)!)}`
                        : E.regionTooltip(r.texto)
                  }
                  style={{
                    left: `${tiempoAPixel(vista, 100, visible.inicioMs)}%`,
                    width: `${tiempoAPixel(vista, 100, visible.finMs) - tiempoAPixel(vista, 100, visible.inicioMs)}%`,
                    ...posicion,
                    ...(juntasConParte && reparto
                      ? ({ '--color-parte': colorDeParte(reparto.estilo, parte) } as CSSProperties)
                      : {})
                  }}
                  data-juntas={juntasConParte || undefined}
                  onPointerDown={(e) => alPulsarRegion(e, r.id)}
                  onPointerMove={alMoverRegion}
                  onPointerUp={(e) => alSoltarRegion(e, true)}
                  onPointerCancel={(e) => alSoltarRegion(e, false)}
                  onClick={() => {
                    if (tragarClic.current) {
                      tragarClic.current = false
                      return
                    }
                    seleccionar(r.id)
                  }}
                  onDoubleClick={() => {
                    if (escucharLinea?.(r.id) === false) setFuera(r.id)
                  }}
                >
                  {marca && (
                    <span className={estilos.inicialRegion} aria-hidden="true">
                      {marca.tipo === 'texto' ? marca.texto : <Users size={12} />}
                    </span>
                  )}
                  {r.texto}
                  {fronterasDe(letra, r.id).map((ms) => {
                    const k =
                      (ms + letra.offset_ms - visible.inicioMs) / (visible.finMs - visible.inicioMs)
                    return k > 0 && k < 1 ? (
                      <span
                        key={ms}
                        aria-hidden="true"
                        className={estilos.frontera}
                        style={{ left: `${100 * k}%` }}
                      />
                    ) : null
                  })}
                </button>
                {fuera === r.id && (
                  <span
                    role="tooltip"
                    className={estilos.regionFuera}
                    style={{ left: `${tiempoAPixel(vista, 100, visible.inicioMs)}%` }}
                  >
                    {E.timeline.fuera}
                  </span>
                )}
              </Fragment>
            )
          })}
          {activa &&
            limites &&
            !inactiva &&
            activa.id !== ocupadaId &&
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
                  carril={
                    conCarriles
                      ? { top: tops[carrilDe(parteDeLinea.get(activa.id) ?? 'c1')] ?? 0, alto }
                      : conSubfilas
                        ? { top: (subfilas.get(activa.id) ?? 0) * ALTO_SUBFILA, alto: ALTO_SUBFILA }
                        : undefined
                  }
                  conPalabras={letra.lineas.some(
                    (l) => l.id === activa.id && tienePalabrasManuales(l)
                  )}
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
        <div aria-hidden="true" ref={cabezal} className={estilos.cabezal} data-cabezal />
      </div>
      <VistaGeneral
        vista={vista}
        duracionMs={duracionMs}
        modelo={modelo}
        ondaGeneral={ondaGeneral}
        inactiva={inactiva}
        bordeArrastrado={bordeArrastrado}
        cambiarVista={setVista}
        buscar={buscar}
        obtenerTiempoAudio={obtenerTiempoAudio}
        sonando={sonando}
        posicionMs={posicionMs}
      />
      <div className={estilos.limite} aria-live="polite">
        {limite}
      </div>
    </section>
  )
}
