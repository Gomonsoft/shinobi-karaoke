import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useSyncExternalStore,
  useRef,
  useState,
  type KeyboardEvent as TeclaReact,
  type PointerEvent,
  type ReactNode,
  type Ref
} from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  ajustarPalabra,
  cargarBorrador,
  finAlSoltar,
  limitesEditorDe,
  marcarAlVuelo,
  moverLimiteLinea,
  moverPalabra,
  quitarPalabras,
  reaplicarTexto,
  repartirDeNuevo,
  validarBorrador,
  type BorradorLinea,
  type LimiteLinea,
  type LimitePalabra
} from '@shared/letras'
import type { Letra } from '@shared/letra'
import { MARGEN_ESCUCHA_PALABRA_MS } from '@shared/escucha'
import { MAX_CARACTERES_LINEA } from '@shared/letrasBusqueda'
import { formatearTiempo, tiempoGuardado, tiempoMostrado } from '@shared/letras/tiempos'
import type { Geometria } from '../../../componentes/geometriaVentana'
import type { MotorAudio, Velocidad } from '../../../karaoke/motorAudio'
import { Boton } from '../../../componentes/Boton'
import { BotonIcono } from '../../../componentes/BotonIcono'
import { CampoTexto } from '../../../componentes/Campos'
import { ControlSegmentado } from '../../../componentes/ControlSegmentado'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import {
  VentanaFlotante,
  type Area,
  type VentanaFlotanteApi
} from '../../../componentes/VentanaFlotante'
import { CampoTiempo } from '../CampoTiempo'
import { contextoDe, resolverTecla } from './atajosPreciso'
import { EjePrecisa } from './EjePrecisa'
import {
  estadoInicial,
  hayCambios,
  primeraSinMarcar,
  reducirPreciso,
  type MarcaPasada
} from './estadoPreciso'
import { OndaLinea } from './OndaLinea'
import { ReglaPrecisa } from './ReglaPrecisa'
import { T } from './textosPreciso'
import { TiraPalabras } from './TiraPalabras'
import { TiradorPreciso } from './TiradorPreciso'
import { casiCoinciden, vistaPrecisa } from './vistaPrecisa'
import css from './editorPreciso.module.css'

/** Lo que la ventana usa del motor de audio del editor (el mismo que el transporte). */
export type PuertoMotorPreciso = Pick<
  MotorAudio,
  | 'estado'
  | 'suscribir'
  | 'posicionMs'
  | 'reproducir'
  | 'pausar'
  | 'buscar'
  | 'fijarBucle'
  | 'fijarTramoConTono'
  | 'fijarVelocidad'
  | 'tiempoDeEvento'
>

/** Pulsación que se considera «mantenida» y fija también el fin de la palabra. */
export const PULSACION_LARGA_MS = 300
const AVISO_MS = 2000
const RETROCESO_MS = 1000

/** Cambios pendientes del borrador, para que el contenedor los escriba en la canción. */
export interface CambiosPreciso {
  borrador: BorradorLinea
  /** Texto nuevo de la línea, o `null` si no cambió. */
  textoNuevo: string | null
}

/**
 * Tamaño con el que se abre la primera vez: caben todos los controles sin desplazamiento interior.
 * En pantallas pequeñas (1280 × 720) la ventana lo recorta al espacio del editor.
 */
const TAMANO_RECOMENDADO_REM = { ancho: 60, alto: 40 }

export interface EditorPrecisoApi extends VentanaFlotanteApi {
  /** Cambios pendientes (campo de texto incluido) o `null` si el borrador no difiere de lo cargado. */
  obtenerCambios(): CambiosPreciso | null
  /** Lleva el foco a la tira de palabras. */
  enfocarTira(): void
}

export interface EditorPrecisoProps {
  // --- Datos de la línea ---
  letra: Letra
  lineaId: string
  duracionMs: number
  cancionId: string
  /** Hay voz separada (sin ella la zona de onda avisa). */
  separada: boolean
  /** «Línea {n} de {total}» del título. */
  numeroLinea: number
  totalLineas: number
  /** Chip de la parte de la línea en la barra de título (0.2.3, solo lectura; solo con reparto). */
  chipParte?: ReactNode
  hayAnterior: boolean
  haySiguiente: boolean
  // --- Motor de audio (el mismo del transporte) ---
  motor: PuertoMotorPreciso
  // --- Margen del bucle (controlado; se guarda con la preferencia de la ventana) ---
  margenMs: number
  alCambiarMargen(ms: 0 | 500 | 1000): void
  // --- Ventana flotante (se pasan tal cual a `VentanaFlotante`) ---
  limites: Area
  referencia?: Area | null
  preferencia?: Geometria | null
  alCambiarPreferencia?(g: Geometria): void
  alSalirDelFoco?(): void
  // --- Salidas ---
  /** Hay cambios que escribir (un solo paso del historial del editor). Después se llama a `alCerrar` o `alCambiarLinea`. */
  alAplicar(cambios: CambiosPreciso): void
  /** Cerrar la ventana (tras aplicar, o directamente al cancelar o descartar). */
  alCerrar(): void
  /** Anterior / Siguiente / ↑ ↓ (si hay cambios, `alAplicar` se llama antes). */
  alCambiarLinea(sentido: -1 | 1): void
  /** Teclas 1 / 2 / 3 con el foco en la ventana: Original / Voz / Instrumental. */
  alElegirPista?(indice: 1 | 2 | 3): void
  /** Línea sin inicio: [Fijar inicio aquí (I)] fija el inicio en el cabezal. */
  alFijarInicioAqui?(): void
  /** Borrador vivo para la vista previa (`null` al cerrar o sin borrador). */
  alCambiarBorrador?(borrador: BorradorLinea | null): void
  /** Región `aria-live` del editor. */
  anunciar?(texto: string): void
  ref?: Ref<EditorPrecisoApi>
}

const VACIO: BorradorLinea = { texto: '', inicio_ms: 0, fin_ms: 1, palabras: [], quitar: false }

type Carga =
  | { ok: true; borrador: BorradorLinea; invalidas: boolean; manual: boolean }
  | { ok: false; motivo: 'sinInicio' | 'corta' }

function cargar(letra: Letra, id: string, duracionMs: number): Carga {
  const el = letra.lineas.find((e) => e.id === id)
  if (!el || el.tipo !== 'linea' || el.inicio_ms === null) return { ok: false, motivo: 'sinInicio' }
  const { borrador, invalidas } = cargarBorrador(letra, id, duracionMs)
  if (validarBorrador(borrador).length > 0) return { ok: false, motivo: 'corta' }
  return {
    ok: true,
    borrador,
    invalidas,
    manual: el.origen_palabras === 'manual' && el.palabras !== null
  }
}

function textoLimitePalabra(l: LimitePalabra, k: number, m: number): string {
  if (l === 'anterior') return k === 0 ? T.limite.anteriorPrimera : T.limite.anterior
  if (l === 'siguiente') return k === m - 1 ? T.limite.siguienteUltima : T.limite.siguiente
  return T.limite.minimo
}
const textoLimiteLinea = (l: LimiteLinea) => (l === 'linea' ? T.limite.linea : T.limite.editor)

const VELOCIDADES = [
  { valor: '0.5', etiqueta: '0,5×' },
  { valor: '0.75', etiqueta: '0,75×' },
  { valor: '1', etiqueta: '1×' }
]
const MARGENES = [
  { valor: '0', etiqueta: '0 s' },
  { valor: '500', etiqueta: '0,5 s' },
  { valor: '1000', etiqueta: '1 s' }
]

/**
 * Ventana flotante del editor preciso de línea (spec 06, fase 9). Autónoma: guarda su propio
 * borrador con historial y habla con el motor; el contenedor solo le da la línea y escribe lo que
 * devuelve por `alAplicar`.
 */
export function EditorPreciso(props: EditorPrecisoProps) {
  const {
    letra,
    lineaId,
    duracionMs,
    cancionId,
    separada,
    numeroLinea,
    totalLineas,
    hayAnterior,
    haySiguiente,
    motor,
    margenMs,
    alCambiarMargen,
    alAplicar,
    alCerrar,
    alCambiarLinea,
    alElegirPista,
    alFijarInicioAqui,
    alCambiarBorrador,
    anunciar,
    ref
  } = props
  const offsetMs = letra.offset_ms
  const carga = useMemo(() => cargar(letra, lineaId, duracionMs), [letra, lineaId, duracionMs])
  const limitesLinea = useMemo(
    () => (carga.ok ? limitesEditorDe(letra, lineaId, duracionMs) : null),
    [carga, letra, lineaId, duracionMs]
  )

  const [estado, despachar] = useReducer(
    reducirPreciso,
    carga.ok ? carga.borrador : VACIO,
    estadoInicial
  )
  const [cargaVista, setCargaVista] = useState(carga)
  if (carga !== cargaVista) {
    setCargaVista(carga)
    const b = carga.ok ? carga.borrador : VACIO
    despachar({ tipo: 'cargar', borrador: b, seleccionada: primeraSinMarcar(b) })
  }
  const estadoRef = useRef(estado)
  useEffect(() => {
    estadoRef.current = estado
  })
  const { actual, seleccionada } = estado
  const m = actual.palabras.length

  // --- Texto de la línea ---
  const [campoTexto, setCampoTexto] = useState<{ base: string; valor: string } | null>(null)
  const [errorTexto, setErrorTexto] = useState(false)
  const textoCampo = campoTexto?.base === actual.texto ? campoTexto.valor : actual.texto
  const campoRef = useRef(textoCampo)
  useEffect(() => {
    campoRef.current = textoCampo
  })

  // --- Avisos temporales (ayuda de «MARCAR», límites, texto repartido) ---
  const [ayuda, setAyuda] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    const pendientes = temporizadores.current
    return () => pendientes.forEach(clearTimeout)
  }, [])
  const temporal = useCallback((poner: (t: string | null) => void, texto: string) => {
    poner(texto)
    temporizadores.current.push(setTimeout(() => poner(null), AVISO_MS))
  }, [])

  // --- Estado del motor ---
  const em = useSyncExternalStore(
    (cb) => motor.suscribir(() => cb()),
    () => motor.estado()
  )

  const aAudio = useCallback((ms: number) => tiempoMostrado(ms, offsetMs), [offsetMs])
  const vista = vistaPrecisa(actual.inicio_ms, actual.fin_ms, margenMs, duracionMs)
  const vistaAudio = useMemo(
    () => ({ inicioMs: aAudio(vista.inicioMs), finMs: aAudio(vista.finMs) }),
    [aAudio, vista.inicioMs, vista.finMs]
  )
  const bucleAudio = useMemo(
    () => ({
      inicioMs: Math.max(0, aAudio(actual.inicio_ms - margenMs)),
      finMs: Math.min(duracionMs, aAudio(actual.fin_ms + margenMs))
    }),
    [aAudio, actual.inicio_ms, actual.fin_ms, margenMs, duracionMs]
  )

  // Tramo con el tono conservado: toda la vista (cubre el bucle y la escucha de palabra).
  useEffect(() => {
    if (!carga.ok) return
    motor.fijarTramoConTono(vistaAudio)
  }, [motor, carga, vistaAudio])
  const [bucleOn, setBucleOn] = useState(false)
  const bucleOnRef = useRef(false)
  useEffect(() => {
    if (bucleOnRef.current) motor.fijarBucle(bucleAudio)
  }, [motor, bucleAudio])
  useEffect(
    () => () => {
      if (bucleOnRef.current) {
        motor.pausar()
        motor.fijarBucle(null)
      }
      motor.fijarTramoConTono(null)
    },
    [motor]
  )
  useEffect(() => {
    const pausar = () => motor.pausar()
    window.addEventListener('blur', pausar)
    return () => window.removeEventListener('blur', pausar)
  }, [motor])

  const bucleSonando = bucleOn && em.sonando
  const intento = useRef(0)

  function alternarBucle() {
    if (bucleSonando) {
      motor.pausar()
      return
    }
    intento.current++
    if (!motor.fijarBucle(bucleAudio)) return
    bucleOnRef.current = true
    setBucleOn(true)
    despachar({ tipo: 'seleccionar', indice: estadoRef.current.seleccionada })
    if (!motor.estado().sonando) void motor.reproducir()
  }

  function escucharPalabra(k: number) {
    const p = estadoRef.current.actual.palabras[k]
    if (!p || em.duracionMs === null) return
    const mia = ++intento.current
    const previa = motor.posicionMs()
    const habiaBucle = bucleOnRef.current && motor.estado().sonando
    motor.pausar()
    const volver = () => {
      baja()
      if (intento.current !== mia) return
      motor.pausar()
      motor.buscar(previa)
      if (bucleOnRef.current) motor.fijarBucle(bucleAudio)
      if (habiaBucle) void motor.reproducir({ desdeMs: previa })
    }
    const baja = motor.suscribir((e) => {
      if (!e.sonando) volver()
    })
    void motor
      .reproducir({
        desdeMs: Math.max(0, aAudio(p.inicio_ms) - MARGEN_ESCUCHA_PALABRA_MS),
        hastaMs: aAudio(p.fin_ms) + MARGEN_ESCUCHA_PALABRA_MS
      })
      .then(
        () => {
          if (intento.current === mia && !motor.estado().sonando) volver()
        },
        () => volver()
      )
  }

  // --- Cabezal, regla y reinicio de la pasada al volver a empezar el bucle ---
  const cabezal = useRef<HTMLSpanElement>(null)
  const [posicionMs, setPosicionMs] = useState(() => motor.posicionMs() - offsetMs)
  const vistaRef = useRef(vista)
  useEffect(() => {
    vistaRef.current = vista
  })
  useEffect(() => {
    let cuadro = 0
    let ultima = motor.posicionMs()
    let ultimoEstado = 0
    const pintar = () => {
      const pos = motor.posicionMs()
      const letraMs = pos - offsetMs
      const v = vistaRef.current
      const nodo = cabezal.current
      if (nodo) {
        const visible = letraMs >= v.inicioMs && letraMs <= v.finMs
        nodo.style.display = visible ? '' : 'none'
        if (visible) nodo.style.left = `${((letraMs - v.inicioMs) / (v.finMs - v.inicioMs)) * 100}%`
      }
      if (em.sonando) {
        if (bucleOnRef.current && pos < ultima - 200) despachar({ tipo: 'reiniciarPasada' })
        ultima = pos
        const ahora = performance.now()
        if (ahora - ultimoEstado > 100) {
          ultimoEstado = ahora
          setPosicionMs(letraMs)
        }
        cuadro = requestAnimationFrame(pintar)
      }
    }
    pintar()
    return () => cancelAnimationFrame(cuadro)
  }, [motor, em.sonando, offsetMs])

  // --- Marcar al vuelo ---
  const pulsada = useRef<{ k: number; ts: number } | null>(null)
  function marcar(ts: number) {
    const e = estadoRef.current
    const t = motor.tiempoDeEvento(ts)
    if (t === null) return
    const ms = Math.round(tiempoGuardado(t, offsetMs))
    const k = e.seleccionada
    const r = marcarAlVuelo(e.actual, k, ms)
    if (r.motivo) {
      const texto = r.motivo === 'pronto' ? T.pronto : T.fuera
      temporal(setAyuda, texto)
      anunciar?.(texto)
      return
    }
    const marca: MarcaPasada = { k, antes: e.actual, ms }
    despachar({ tipo: 'marca', borrador: r.borrador, marca, siguiente: r.siguiente })
    pulsada.current = { k, ts }
  }
  function soltar(ts: number) {
    const p = pulsada.current
    pulsada.current = null
    if (!p || ts - p.ts < PULSACION_LARGA_MS) return
    const t = motor.tiempoDeEvento(ts)
    if (t === null) return
    const e = estadoRef.current
    despachar({
      tipo: 'cambiar',
      borrador: finAlSoltar(e.actual, p.k, Math.round(tiempoGuardado(t, offsetMs))),
      seleccionada: e.seleccionada
    })
  }
  function retroceso() {
    const ultima = estadoRef.current.pasada.at(-1)
    if (!ultima) return
    despachar({ tipo: 'retroceso' })
    if (motor.estado().sonando) {
      motor.buscar(Math.max(bucleAudio.inicioMs, aAudio(ultima.ms) - RETROCESO_MS))
    }
  }

  // --- Operaciones sobre la palabra seleccionada ---
  function aplicarPalabra(
    campo: 'inicio' | 'fin',
    ms: number,
    { exigir }: { exigir?: boolean } = {}
  ) {
    const e = estadoRef.current
    const r = moverPalabra(e.actual, e.seleccionada, campo, ms)
    if (r.limite) {
      temporal(setAviso, textoLimitePalabra(r.limite, e.seleccionada, e.actual.palabras.length))
      if (exigir) return
    }
    despachar({ tipo: 'cambiar', borrador: r.borrador })
  }
  function fijarEnCabezal(campo: 'inicio' | 'fin') {
    aplicarPalabra(campo, Math.round(tiempoGuardado(motor.posicionMs(), offsetMs)), {
      exigir: true
    })
  }
  function ajustar(campo: 'inicio' | 'fin', deltaMs: number) {
    const e = estadoRef.current
    const r = ajustarPalabra(e.actual, e.seleccionada, campo, deltaMs)
    if (r.limite) {
      temporal(setAviso, textoLimitePalabra(r.limite, e.seleccionada, e.actual.palabras.length))
    }
    despachar({ tipo: 'cambiar', borrador: r.borrador })
  }

  // --- Texto ---
  function confirmarTexto(valor: string): BorradorLinea | null {
    const e = estadoRef.current
    const texto = valor.trim()
    if (texto === e.actual.texto) {
      setErrorTexto(false)
      return e.actual
    }
    if (texto === '') {
      setErrorTexto(true)
      return null
    }
    setErrorTexto(false)
    const r = reaplicarTexto(e.actual, texto)
    despachar({ tipo: 'cambiar', borrador: r.borrador })
    if (r.repartidas > 0) {
      const aviso = T.textoRepartidas(r.repartidas)
      temporal(setAviso, aviso)
      anunciar?.(aviso)
    }
    return r.borrador
  }

  // --- Aplicar, cancelar y cerrar ---
  const [confirmando, setConfirmando] = useState(false)
  function cambiosPendientes(): CambiosPreciso | null {
    const e = estadoRef.current
    let borrador = e.actual
    const valor = campoRef.current.trim()
    if (valor !== '' && valor !== borrador.texto) {
      borrador = reaplicarTexto(borrador, valor).borrador
    }
    if (borrador === e.actual && !hayCambios(e)) return null
    if (JSON.stringify(borrador) === JSON.stringify(e.original)) return null
    return {
      borrador,
      textoNuevo: borrador.texto !== e.original.texto ? borrador.texto : null
    }
  }
  function aplicarYCerrar() {
    const cambios = cambiosPendientes()
    if (cambios) {
      anunciar?.(T.anuncioAplicado(numeroLinea, cambios.borrador.quitar))
      alAplicar(cambios)
    }
    alCerrar()
  }
  function cancelar() {
    if (!cambiosPendientes()) {
      alCerrar()
      return
    }
    setConfirmando(true)
  }
  function irALinea(sentido: -1 | 1) {
    if (sentido === -1 ? !hayAnterior : !haySiguiente) return
    const cambios = cambiosPendientes()
    if (cambios) alAplicar(cambios)
    alCambiarLinea(sentido)
  }

  // --- Interfaz imperativa para el contenedor ---
  const ventana = useRef<VentanaFlotanteApi>(null)
  const tira = useRef<HTMLDivElement>(null)
  const enfocarTira = useCallback(() => {
    tira.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }, [])
  useImperativeHandle(ref, () => ({
    enfocarUltimo: () => ventana.current?.enfocarUltimo(),
    elemento: () => ventana.current?.elemento() ?? null,
    obtenerCambios: cambiosPendientes,
    enfocarTira
  }))

  // Foco y anuncio al abrir (y al cambiar de línea).
  useEffect(() => {
    if (!carga.ok) return
    enfocarTira()
    const b = carga.borrador
    anunciar?.(
      T.anuncioAbrir(
        numeroLinea,
        b.texto,
        b.palabras.filter((p) => p.marcada).length,
        b.palabras.length
      )
    )
    // Solo al cargar una línea (no por cada cambio del número o del anunciador).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carga])

  // Con la selección cambiada por Intro, el foco real sigue a la opción seleccionada.
  useEffect(() => {
    const lista = tira.current
    if (lista?.contains(document.activeElement)) {
      lista.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
    }
  }, [seleccionada])

  useEffect(() => {
    alCambiarBorrador?.(carga.ok ? actual : null)
    // `alCambiarBorrador` suele ser inestable: se avisa solo cuando cambia el borrador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, carga.ok])
  useEffect(() => () => alCambiarBorrador?.(null), [alCambiarBorrador])

  // --- Teclado de la ventana ---
  function alTeclearVentana(e: TeclaReact<HTMLElement>) {
    if (e.defaultPrevented) return
    const accion = resolverTecla(e.nativeEvent, contextoDe(e.target as Element))
    if (!accion) return
    e.preventDefault()
    e.stopPropagation()
    switch (accion.tipo) {
      case 'bucle':
        alternarBucle()
        break
      case 'escucharPalabra':
        escucharPalabra(seleccionada)
        break
      case 'retroceso':
        retroceso()
        break
      case 'fijar':
        fijarEnCabezal(accion.campo)
        break
      case 'linea':
        irALinea(accion.sentido)
        break
      case 'pista':
        alElegirPista?.(accion.indice)
        break
      case 'deshacer':
        despachar({ tipo: 'deshacer' })
        break
      case 'rehacer':
        despachar({ tipo: 'rehacer' })
        break
      case 'aplicar':
        aplicarYCerrar()
        break
      case 'cerrar':
        aplicarYCerrar()
        break
      case 'ajustar':
        ajustar(accion.campo, accion.deltaMs)
        break
      case 'ignorar':
        break
    }
  }
  function alTeclearTira(e: TeclaReact<HTMLElement>) {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    if (!e.repeat) marcar(e.timeStamp)
  }
  function alSoltarTecla(e: TeclaReact<HTMLElement>) {
    if (e.key === 'Enter') soltar(e.timeStamp)
  }
  function alBajarMarcar(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    marcar(e.timeStamp)
  }

  // --- Ancho del eje (para escalonar tiradores cercanos) ---
  const ejeRef = useRef<HTMLDivElement>(null)
  const [anchoEje, setAnchoEje] = useState(600)
  useEffect(() => {
    const nodo = ejeRef.current
    if (!nodo || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(([entrada]) => {
      if (entrada) setAnchoEje(Math.max(1, entrada.contentRect.width))
    })
    obs.observe(nodo)
    return () => obs.disconnect()
  }, [carga.ok])

  const marcadas = actual.palabras.filter((p) => p.marcada).length
  const palabra = actual.palabras[seleccionada]
  const previa = actual.palabras[seleccionada - 1]
  const siguiente = actual.palabras[seleccionada + 1]
  const tieneManuales = carga.ok && carga.manual
  const sinPalabrasQuitar = !(tieneManuales || marcadas > 0)
  const botones = (
    <>
      <BotonIcono
        icono={ChevronLeft}
        etiqueta={T.anterior}
        noDisponible={hayAnterior ? undefined : T.extremo}
        onClick={() => irALinea(-1)}
      />
      <BotonIcono
        icono={ChevronRight}
        etiqueta={T.siguiente}
        noDisponible={haySiguiente ? undefined : T.extremo}
        onClick={() => irALinea(1)}
      />
      <BotonIcono icono={X} etiqueta={T.cerrar} onClick={aplicarYCerrar} />
    </>
  )

  return (
    <VentanaFlotante
      ref={ventana}
      titulo={
        props.chipParte ? (
          <>
            {T.titulo(numeroLinea, totalLineas)} {props.chipParte}
          </>
        ) : (
          T.titulo(numeroLinea, totalLineas)
        )
      }
      botones={botones}
      limites={props.limites}
      referencia={props.referencia}
      preferencia={props.preferencia}
      tamanoRecomendadoRem={TAMANO_RECOMENDADO_REM}
      alCambiarPreferencia={props.alCambiarPreferencia}
      alSalirDelFoco={props.alSalirDelFoco}
    >
      {/* Teclado de la ventana por delegación (Espacio, I, O, Ctrl + Z…); sus controles son nativos. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={css.contenido}
        data-cancion={cancionId}
        onKeyDown={alTeclearVentana}
        onKeyUp={alSoltarTecla}
      >
        {!carga.ok ? (
          <div className={css.vacio}>
            <p>{carga.motivo === 'sinInicio' ? T.sinInicio : T.demasiadoCorta}</p>
            {carga.motivo === 'sinInicio' && alFijarInicioAqui && (
              <Boton onClick={alFijarInicioAqui}>{T.fijarInicioAqui}</Boton>
            )}
          </div>
        ) : confirmando ? (
          <div className={css.descartar} role="alertdialog" aria-label={T.descartar}>
            <p>{T.descartar}</p>
            <div className={css.fila}>
              {/* Spec P14: el foco va a «Seguir editando». */}
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <Boton autoFocus onClick={() => setConfirmando(false)}>
                {T.seguirEditando}
              </Boton>
              <Boton
                variante="destructivo"
                onClick={() => {
                  anunciar?.(T.anuncioCancelado(numeroLinea))
                  alCerrar()
                }}
              >
                {T.descartarCambios}
              </Boton>
            </div>
          </div>
        ) : (
          <>
            {carga.invalidas && <AvisoEnLinea tipo="aviso">{T.cargadasInvalidas}</AvisoEnLinea>}
            <CampoTexto
              etiqueta={T.texto}
              value={textoCampo}
              maxLength={MAX_CARACTERES_LINEA}
              spellCheck={false}
              error={errorTexto ? T.textoVacio : undefined}
              onChange={(e) =>
                setCampoTexto({
                  base: actual.texto,
                  valor: e.currentTarget.value.replace(/[\r\n]+/g, ' ')
                })
              }
              onBlur={(e) => confirmarTexto(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  confirmarTexto(e.currentTarget.value)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  setCampoTexto(null)
                  setErrorTexto(false)
                }
              }}
            />

            <div ref={ejeRef} className={css.zonaEje}>
              <ReglaPrecisa
                vista={vista}
                posicionMs={posicionMs}
                alBuscar={(ms) => motor.buscar(aAudio(ms))}
              />
              <EjePrecisa>
                <OndaLinea
                  cancionId={cancionId}
                  separada={separada}
                  vista={vista}
                  inicioLineaMs={actual.inicio_ms}
                  finLineaMs={actual.fin_ms}
                  offsetMs={offsetMs}
                />
                <TiraPalabras
                  ref={tira}
                  palabras={actual.palabras}
                  seleccionada={seleccionada}
                  vista={vista}
                  atenuada={actual.quitar}
                  alSeleccionar={(k) => despachar({ tipo: 'seleccionar', indice: k })}
                  alEscucharPalabra={(k) => {
                    despachar({ tipo: 'seleccionar', indice: k })
                    escucharPalabra(k)
                  }}
                  alTeclear={alTeclearTira}
                >
                  {palabra &&
                    !actual.quitar &&
                    (['inicio', 'fin'] as const).map((campo) => {
                      const ms = campo === 'inicio' ? palabra.inicio_ms : palabra.fin_ms
                      const vecino = campo === 'inicio' ? previa?.fin_ms : siguiente?.inicio_ms
                      return (
                        <TiradorPreciso
                          key={campo}
                          tipo="palabra"
                          borde={campo}
                          ms={ms}
                          vista={vista}
                          etiqueta={campo === 'inicio' ? T.palabra.inicio : T.palabra.fin}
                          min={actual.inicio_ms}
                          max={actual.fin_ms}
                          escalonado={
                            vecino !== undefined && casiCoinciden(vista, anchoEje, ms, vecino)
                          }
                          limitar={(valor) => {
                            const r = moverPalabra(actual, seleccionada, campo, valor)
                            const p = r.borrador.palabras[seleccionada]!
                            return {
                              valor: campo === 'inicio' ? p.inicio_ms : p.fin_ms,
                              limite: r.limite
                            }
                          }}
                          textoLimite={(l) =>
                            textoLimitePalabra(l as LimitePalabra, seleccionada, m)
                          }
                          // Los manejadores leen refs solo al ejecutarse (en eventos).
                          // eslint-disable-next-line react-hooks/refs
                          alConfirmar={(valor) => aplicarPalabra(campo, valor)}
                          // eslint-disable-next-line react-hooks/refs
                          alAjustar={(d) => ajustar(campo, d)}
                        />
                      )
                    })}
                </TiraPalabras>
                {limitesLinea &&
                  (['inicio', 'fin'] as const).map((campo) => (
                    <TiradorPreciso
                      key={campo}
                      tipo="linea"
                      borde={campo}
                      ms={campo === 'inicio' ? actual.inicio_ms : actual.fin_ms}
                      vista={vista}
                      etiqueta={
                        campo === 'inicio'
                          ? T.linea.inicio
                          : letra.lineas.find((l) => l.id === lineaId)?.fin_ms === null
                            ? T.linea.finAuto
                            : T.linea.fin
                      }
                      automatico={
                        campo === 'fin' &&
                        letra.lineas.find((l) => l.id === lineaId)?.fin_ms === null
                      }
                      min={vista.inicioMs}
                      max={vista.finMs}
                      limitar={(valor) => {
                        const r = moverLimiteLinea(actual, campo, valor, limitesLinea)
                        return {
                          valor: campo === 'inicio' ? r.borrador.inicio_ms : r.borrador.fin_ms,
                          limite: r.limite
                        }
                      }}
                      textoLimite={(l) => textoLimiteLinea(l as LimiteLinea)}
                      alConfirmar={(valor) =>
                        despachar({
                          tipo: 'cambiar',
                          borrador: moverLimiteLinea(actual, campo, valor, limitesLinea).borrador
                        })
                      }
                      alAjustar={(d) =>
                        despachar({
                          tipo: 'cambiar',
                          borrador: moverLimiteLinea(
                            actual,
                            campo,
                            (campo === 'inicio' ? actual.inicio_ms : actual.fin_ms) + d,
                            limitesLinea
                          ).borrador
                        })
                      }
                    />
                  ))}
                <span ref={cabezal} className={css.cabezal} aria-hidden="true" />
              </EjePrecisa>
            </div>

            <div className={css.detalle}>
              {palabra && (
                <>
                  <span className={css.palabraTitulo}>
                    {T.palabraTitulo(seleccionada + 1, m, palabra.texto)}
                  </span>
                  <CampoTiempo
                    etiqueta={T.inicio}
                    valor={formatearTiempo(palabra.inicio_ms)}
                    aplicar={(ms) => aplicarPalabra('inicio', ms)}
                  />
                  <CampoTiempo
                    etiqueta={T.fin}
                    valor={formatearTiempo(palabra.fin_ms)}
                    aplicar={(ms) => aplicarPalabra('fin', ms)}
                  />
                  <Boton onClick={() => fijarEnCabezal('inicio')}>{T.fijarInicio}</Boton>
                  <Boton onClick={() => fijarEnCabezal('fin')}>{T.fijarFin}</Boton>
                </>
              )}
            </div>
            <div className={css.recuento} role="status">
              {aviso ?? T.recuento(marcadas, m)}
            </div>

            <div className={css.fila}>
              <Boton aria-pressed={bucleSonando} className={css.bucle} onClick={alternarBucle}>
                {bucleSonando ? '❚❚ ' : '▶ '}
                {T.bucle}
              </Boton>
              <Boton
                aria-label={T.palabraEscucharNombre}
                onClick={() => escucharPalabra(seleccionada)}
              >
                {`▶ ${T.palabraEscuchar}`}
              </Boton>
              <ControlSegmentado
                etiqueta={T.margen}
                valor={String(margenMs)}
                opciones={MARGENES}
                onCambio={(v) => alCambiarMargen(Number(v) as 0 | 500 | 1000)}
              />
              <ControlSegmentado
                etiqueta={T.velocidad}
                valor={String(em.velocidad)}
                opciones={VELOCIDADES}
                onCambio={(v) => motor.fijarVelocidad(Number(v) as Velocidad)}
              />
            </div>
            {!em.tonoConservado && em.velocidad < 1 && (
              <AvisoEnLinea tipo="info">{T.tono}</AvisoEnLinea>
            )}

            <div className={css.fila}>
              <Boton
                tamano="grande"
                className={css.marcar}
                onPointerDown={alBajarMarcar}
                onPointerUp={(e) => soltar(e.timeStamp)}
                onPointerCancel={(e) => soltar(e.timeStamp)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return
                  e.preventDefault()
                  if (!e.repeat) marcar(e.timeStamp)
                }}
                onClick={(e) => e.preventDefault()}
              >
                {T.marcar}
              </Boton>
              <span className={css.ayuda} role="status">
                {ayuda ?? T.vueloAyuda}
              </span>
            </div>
            {actual.quitar && <AvisoEnLinea tipo="info">{T.quitarAviso}</AvisoEnLinea>}

            <div className={css.pie}>
              <Boton
                onClick={() => despachar({ tipo: 'cambiar', borrador: repartirDeNuevo(actual) })}
              >
                {T.repartir}
              </Boton>
              {!sinPalabrasQuitar && (
                <Boton
                  onClick={() => despachar({ tipo: 'cambiar', borrador: quitarPalabras(actual) })}
                >
                  {T.quitar}
                </Boton>
              )}
              <span className={css.espacio} />
              <Boton onClick={cancelar}>{T.cancelar}</Boton>
              <Boton onClick={aplicarYCerrar}>{T.aplicar}</Boton>
            </div>
          </>
        )}
      </div>
    </VentanaFlotante>
  )
}
