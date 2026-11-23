import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react'
import { Flag, Maximize, PanelRightClose, Pause, Play, X } from 'lucide-react'
import type { Cancion } from '@shared/cancion'
import type { Config } from '@shared/config'
import { conSubrayadoDelEquipo } from '@shared/estilo'
import type { ResumenCancionIpc } from '@shared/ipc'
import { preferenciasPanelesPredeterminadas } from '@shared/paneles'
import { MARGEN_ESCUCHA_LINEA_MS, tramoEscuchaLinea } from '@shared/escucha'
import { finEfectivo, tienePalabrasManuales, type Letra } from '@shared/letra'
import { aplicarEdicionPrecisa, type BorradorLinea } from '@shared/letras/palabras'
import {
  contador,
  indiceLineaActual,
  lineaVecina,
  numeroDeLinea,
  primeraSinInicio,
  tiempoGuardado,
  tiempoMostrado
} from '@shared/letras/tiempos'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { Divisor } from '../../componentes/Divisor'
import { Icono } from '../../componentes/Icono'
import { Tooltip } from '../../componentes/Tooltip'
import { mostrarToast } from '../../componentes/gestorToasts'
import { PantallaLetra } from '../../karaoke/PantallaLetra'
import { evaluarContraste } from '../../karaoke/contraste'
import type { Velocidad } from '../../karaoke/motorAudio'
import type { Pista } from '../../karaoke/pistas'
import { useMotorAudio } from '../../karaoke/useMotorAudio'
import { useVolumenCompartido } from '../../karaoke/useVolumenCompartido'
import { useNavegacion } from '../../navegacion/estado'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import { CabeceraCancion } from '../cancion/CabeceraCancion'
import { Reproductor, type PropsReproductor } from '../reproductor/Reproductor'
import { BannerSincronizar } from './BannerSincronizar'
import { bloquePreparacion } from './preparacion/modelo'
import { EP } from './preparacion/textos'
import { BotonLayout, type NombreBotonLayout } from './BotonLayout'
import {
  avisarBorradorAlSalir,
  avisarError,
  BotonLista,
  DialogoVolverABorradorEditor
} from './BotonLista'
import { BotonCambiarModalidad, BotonLetraLista } from './BotonLetraLista'
import { DialogoLetraLista, guardarOmitirAviso } from './DialogoLetraLista'
import { LL } from './textosLetraLista'
import { useExportarDesdeEditor } from './useExportarDesdeEditor'
import { DialogoAtajos } from './DialogoAtajos'
import { ListaLineas } from './ListaLineas'
import { seleccionDeDisco } from './aparienciaVista'
import { PanelEstilo } from './PanelEstilo'
import { PanelFunciones, type EstadoCancion } from './PanelFunciones'
import { EditorPreciso, type EditorPrecisoApi, type CambiosPreciso } from './preciso/EditorPreciso'
import type { Area, Geometria } from '../../componentes/VentanaFlotante'
import { PanelSincronia, limiteDeCampo, mostrarAyudaBluetooth, textoLimite } from './PanelSincronia'
import { PistaSincronia } from './PistaSincronia'
import { useControlEspera, useEjemploEspera, esperaVisible } from './estilo/useEspera'
import { crearEjemploPantalla } from './estilo/ejemploPantalla'
import { pantallaVisible, reemplazosDeDisco } from './estilo/pantallaEfectiva'
import { useControlPantalla } from './estilo/usePantalla'
import { T_PANTALLA } from './estilo/textosPantalla'
import { useMovimientoReducido } from '../../karaoke/useMovimientoReducido'
import { BotonAjustarSilencios } from './silencios/BotonAjustarSilencios'
import { DialogosComprobar } from './comprobar/Dialogos'
import { K as KC } from './comprobar/textos'
import { useComprobarLetra } from './comprobar/useComprobarLetra'
import { DialogoAjustarSilencios } from './silencios/DialogoAjustarSilencios'
import { motivosSilencios, useAjustarSilencios } from './silencios/useAjustarSilencios'
import { LienzoPicosVoz, PistaOndaVoz, usePicosVoz } from './PistaOndaVoz'
import { contarImportantes } from '@shared/dudosas'
import { MarcaPanel, TarjetaRevision } from './revision/TarjetaRevision'
import { R as RV, motivoPrincipal } from './revision/textos'
import { useRevision } from './revision/useRevision'
import { recortarIntervalo, crearVistaLineaTiempo, type IntervaloTiempo } from './lineaTiempo'
import { RielLista } from './RielLista'
import { RielPanel } from './RielPanel'
import { Transporte, type SeparacionEditor } from './Transporte'
import { EscuchaComprobacion } from './escuchaComprobacion'
import {
  aSeleccionIpc,
  estadoInicial,
  gestoMarcadorVigente,
  iniciarGestoMarcador,
  moverGestoMarcador,
  type GestoMarcador,
  puedeDeshacer,
  puedeRehacer,
  reducirEditor,
  type AccionEditor
} from './estado'
import { E } from './textos'
import { useAtajosEditor } from './useAtajosEditor'
import {
  aplicarArrastre,
  aplicarTecla,
  preferenciaTrasAccion,
  type DivisorEditor
} from './distribucion'
import { aplicarTamanoVivo, useDistribucion } from './useDistribucion'
import { useGuardadoEditor, type SecuenciaResumen } from './useGuardadoEditor'
import { useTemaEditor } from './useTemaEditor'
import { usePreferenciasPaneles } from './usePreferenciasPaneles'
import { useSincronizarAlRitmo } from './useSincronizarAlRitmo'
import estilos from './editor.module.css'

type Carga = { cancion: Cancion; config: Config; resumen: ResumenCancionIpc }
type Pestana = 'sincronia' | 'estilo' | 'funciones'
const VACIA: Letra = { origen: 'manual', lrclib_id: null, offset_ms: 0, lineas: [] }

function seleccionarInicial(letra: Letra): string | null {
  return primeraSinInicio(letra) ?? lineaVecina(letra, null, 1)
}

/** Línea anterior o siguiente con inicio (el editor preciso solo salta a líneas sincronizadas). */
function vecinaConInicio(letra: Letra, id: string, sentido: -1 | 1): string | null {
  const i = letra.lineas.findIndex((l) => l.id === id)
  for (let j = i + sentido; j >= 0 && j < letra.lineas.length; j += sentido) {
    const el = letra.lineas[j]!
    if (el.tipo === 'linea' && el.inicio_ms !== null) return el.id
  }
  return null
}

export function desdeLinea(letra: Letra, id: string): number {
  const indice = letra.lineas.findIndex((l) => l.id === id)
  const inicio = letra.lineas[indice]?.inicio_ms
  if (inicio != null) return Math.max(0, tiempoMostrado(inicio, letra.offset_ms) - 2000)
  for (let i = indice - 1; i >= 0; i--) {
    const previo = letra.lineas[i]?.inicio_ms
    if (previo != null) return tiempoMostrado(previo, letra.offset_ms)
  }
  return 0
}

export function Editor({ id }: { id: string }) {
  const { ir, vista } = useNavegacion()
  const [carga, setCarga] = useState<Carga | 'error' | null>(null)
  const sesion = useRef<string | null>(null)
  const generacion = useRef(0)
  const [resumenVivo, setResumenVivo] = useState<ResumenCancionIpc | null>(null)
  // La respuesta del pedido más reciente manda: guardarApariencia, cancion:cambiada y listar().
  const secuencia = useRef({ pedida: 0, aplicada: 0 })
  const resumenes = useMemo<SecuenciaResumen>(
    () => ({
      nuevo: () => ++secuencia.current.pedida,
      aplicar: (token, resumen) => {
        if (token < secuencia.current.aplicada) return
        secuencia.current.aplicada = token
        setResumenVivo(resumen)
      }
    }),
    []
  )
  const refrescarResumen = useCallback(async () => {
    const token = resumenes.nuevo()
    const lista = await window.shinobi.biblioteca.listar()
    const actual = lista.find((c) => c.id === id)
    if (actual) resumenes.aplicar(token, actual)
  }, [id, resumenes])

  const leerVisita = useCallback(async (): Promise<Cancion | null> => {
    const vigente = generacion.current
    const visita = await window.shinobi.letras.abrirEdicion(id)
    if (vigente !== generacion.current) {
      if (visita) void window.shinobi.letras.cerrarEdicion(visita.sesionId).catch(() => undefined)
      return null
    }
    sesion.current = visita?.sesionId ?? null
    return visita?.cancion ?? null
  }, [id])

  useEffect(() => {
    const api = window.shinobi
    const vigente = ++generacion.current
    const baja = api.alCambiarCancion((evento) => {
      if (evento.id === id) {
        if (evento.eliminada) setCarga('error')
        else resumenes.aplicar(resumenes.nuevo(), evento.resumen)
      }
    })
    const bajaTemas = api.alCambiarTemas(() => {
      const token = resumenes.nuevo()
      void api.biblioteca.listar().then(
        (lista) => {
          const actual = lista.find((c) => c.id === id)
          if (vigente === generacion.current && actual) resumenes.aplicar(token, actual)
        },
        () => undefined
      )
    })
    void Promise.all([leerVisita(), api.biblioteca.listar(), api.config.obtener()]).then(
      ([cancion, lista, config]) => {
        if (vigente !== generacion.current) return
        const resumen = lista.find((c) => c.id === id)
        setCarga(cancion && resumen ? { cancion, resumen, config } : 'error')
      },
      () => {
        if (vigente === generacion.current) setCarga('error')
      }
    )
    return () => {
      generacion.current = vigente + 1
      baja()
      bajaTemas()
      const token = sesion.current
      sesion.current = null
      if (token) void api.letras.cerrarEdicion(token).catch(() => undefined)
    }
  }, [id, leerVisita, resumenes])

  const obtenerSesion = useCallback(() => sesion.current, [])
  const biblioteca = () => ir({ tipo: 'biblioteca' })
  const irALetra = () => ir({ tipo: 'cancion', id, paso: 'letra' })
  if (!carga) return <p>{E.cargando}</p>
  if (carga === 'error')
    return (
      <AvisoEnLinea tipo="error" accion={<Boton onClick={biblioteca}>{E.verBiblioteca}</Boton>}>
        {E.errorAudio}
      </AvisoEnLinea>
    )
  if (contador(carga.cancion.letra ?? VACIA).total === 0)
    return (
      <AvisoEnLinea tipo="info" accion={<Boton onClick={irALetra}>{E.buscarLetra}</Boton>}>
        {E.sinLetra}
      </AvisoEnLinea>
    )
  return (
    <EditorActivo
      carga={carga}
      resumen={resumenVivo ?? carga.resumen}
      leerVisita={leerVisita}
      obtenerSesion={obtenerSesion}
      resumenes={resumenes}
      refrescarResumen={refrescarResumen}
      pestanaInicial={
        vista.tipo === 'cancion' && vista.pestana === 'estilo' ? 'estilo' : 'sincronia'
      }
      revisarAlEntrar={vista.tipo === 'cancion' && vista.revisar === true}
    />
  )
}

interface PropsActiva {
  carga: Carga
  resumen: ResumenCancionIpc
  leerVisita(): Promise<Cancion | null>
  obtenerSesion(): string | null
  resumenes: SecuenciaResumen
  refrescarResumen(): Promise<void>
  /** Al volver de Ajustes se reabre en la pestaña Estilo (0175, A10). */
  pestanaInicial: Pestana
  /** «Revisar» de la Biblioteca, el progreso o un toast: empieza el recorrido al entrar (feature 11). */
  revisarAlEntrar?: boolean
}

type EscuchaEditor = { pista: Pista; velocidad: Velocidad }
type Prueba = EscuchaEditor & {
  desdeMs: number
  modo: PropsReproductor['modo']
}

function EditorActivo({
  carga,
  resumen,
  leerVisita,
  obtenerSesion,
  resumenes,
  refrescarResumen,
  pestanaInicial,
  revisarAlEntrar = false
}: PropsActiva) {
  const { cancion, config } = carga
  const { id, metadatos } = cancion
  const { ir } = useNavegacion()
  const { trabajos, progreso } = useTrabajosVivos()
  const letraInicial = cancion.letra ?? VACIA
  const [edicion, despachar] = useReducer(reducirEditor, null, () =>
    estadoInicial(
      {
        letra: letraInicial,
        apariencia: {
          seleccion: seleccionDeDisco(cancion.apariencia),
          estilo: cancion.estilo,
          reemplazos: reemplazosDeDisco(cancion.apariencia)
        }
      },
      seleccionarInicial(letraInicial)
    )
  )
  const { letra, apariencia } = edicion.actual
  const cuentas = contador(letra)
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial)
  const [anuncioLayout, setAnuncioLayout] = useState('')
  const temporizadorAnuncio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(temporizadorAnuncio.current), [])
  /** Anuncio en la región `aria-live` del editor: una vez por cambio; se vacía para poder repetirse. */
  function anunciar(texto: string) {
    setAnuncioLayout(texto)
    clearTimeout(temporizadorAnuncio.current)
    temporizadorAnuncio.current = setTimeout(() => setAnuncioLayout(''), 4000)
  }
  const tema = useTemaEditor({ resumen, edicion, despachar, anunciar, refrescarResumen })
  const estilo = tema.estiloVisible
  // Estado de esta visita al editor: no se guarda ni entra en el historial (G7).
  const [fondoDetenido, setFondoDetenido] = useState(false)
  const movimientoReducido = useMovimientoReducido()
  const hayMovimiento = estilo.fondo.tipo === 'degradado' && Boolean(estilo.fondo.movimiento)
  const contraste = useMemo(() => evaluarContraste(estilo), [estilo])
  const [dialogoAtajos, setDialogoAtajos] = useState(false)
  // Editor preciso de línea (fase 9): línea abierta, su borrador vivo y quién lo abrió.
  const [precisoId, setPrecisoId] = useState<string | null>(null)
  const [borradorPreciso, setBorradorPreciso] = useState<BorradorLinea | null>(null)
  const [areasPreciso, setAreasPreciso] = useState<{ limites: Area; referencia: Area | null }>({
    limites: { left: 0, top: 0, width: 0, height: 0 },
    referencia: null
  })
  const refPreciso = useRef<EditorPrecisoApi>(null)
  const aplicarPrecisoRef = useRef<() => boolean>(() => false)
  const abridorPreciso = useRef<HTMLElement | null>(null)
  const ocupada = precisoId !== null && precisoId === edicion.seleccion
  function avisarOcupada(): boolean {
    if (!ocupada) return false
    mostrarToast({ tipo: 'info', mensaje: E.preciso.ocupado })
    return true
  }
  // «Hecho» y «Marcar como …» comparten el aviso de líneas sin inicio: una vez por visita (8.6).
  const incompletaVista = useRef(false)
  const primeraPulsacionIncompleta = useCallback(() => {
    const antes = incompletaVista.current
    incompletaVista.current = true
    return !antes
  }, [])
  const tituloEstado = useRef<HTMLHeadingElement>(null)
  // Preparación automática (spec 06 · Feature 5): «Ver qué hicimos» lleva el foco a su título.
  const tituloPrep = useRef<HTMLHeadingElement>(null)
  const enfocarTituloPrep = useRef(false)
  const [cerradoPrep, setCerradoPrep] = useState(false)
  const enfocarTituloEstado = useRef(false)
  const enfocarFunciones = useRef(false)
  const [dialogoBorrador, setDialogoBorrador] = useState(false)
  // Fase 5 · 0214: aviso de «Letra lista» y cambio de modalidad desde el menú ⋯.
  const [omitirAvisoLL, setOmitirAvisoLL] = useState(config.editor.omitir_aviso_letra_lista)
  const [dialogoCambioLL, setDialogoCambioLL] = useState(false)
  const esLetraLista = resumen.estado === 'lista' && resumen.modalidad === 'letra_lista'
  const estadoCancion: EstadoCancion =
    resumen.estado === 'borrador' ? 'borrador' : esLetraLista ? 'letra_lista' : 'lista'
  // En Letra lista, «resaltado» y «diferencia» solo afectan al editor: no encienden el punto (LL7).
  const avisosPestana = contraste.avisos.filter(
    (a) => !(esLetraLista && !tema.editando && a !== 'letra')
  )
  const [prueba, setPrueba] = useState<Prueba | null>(null)
  const abrirPendiente = useRef<AbortController | null>(null)
  const vuelta = useRef<(EscuchaEditor & { posicionMs: number }) | null>(null)
  const refProbar = useRef<HTMLButtonElement>(null)
  const [revisionSeleccion, setRevisionSeleccion] = useState(0)
  const [focoLinea, setFocoLinea] = useState(() =>
    contador(letraInicial).sincronizadas > 0 ? 1 : 0
  )
  const refSync = useRef<HTMLButtonElement>(null)
  const refRaiz = useRef<HTMLDivElement>(null)
  const refCabecera = useRef<HTMLElement>(null)
  const refDock = useRef<HTMLDivElement>(null)
  const refTransporte = useRef<HTMLDivElement>(null)
  const refExtraSync = useRef<HTMLDivElement>(null)
  const focoInicialSync = useRef(contador(letraInicial).sincronizadas === 0)
  const { preferencias, actualizar: actualizarPaneles } = usePreferenciasPaneles(
    config.editor.paneles
  )
  const distribucion = useDistribucion({
    raiz: refRaiz,
    cabecera: refCabecera,
    dock: refDock,
    transporte: refTransporte,
    extraSync: refExtraSync,
    pestana,
    sincronizando: edicion.sync.activo,
    preferencias
  })
  const listaMinimizada = distribucion.lista.minimizado
  const panelMinimizado = distribucion.panel.minimizado
  const lineaTiempoMinimizada = distribucion.lineaTiempo.minimizado
  const focoPendiente = useRef<NombreBotonLayout | null>(null)
  const focoEnLineaTiempo = useRef(false)
  const [cerradoYaSync, setCerradoYaSync] = useState(false)
  const [posicion, setPosicion] = useState(0)
  const [gestoVisible, setGestoVisible] = useState<GestoMarcador | null>(null)
  const gestoActual = useRef<GestoMarcador | null>(null)
  const [bucleArmado, setBucleArmado] = useState(false)
  const bucle = useRef<{ previa: number; sonaba: boolean | null } | null>(null)
  const cancelarEntradaBucle = useRef<(() => void) | null>(null)
  const volumen = useVolumenCompartido(config.reproductor)
  const { motor, estado: audio } = useMotorAudio({
    cancionId: id,
    gananciaDb: cancion.fuente.ganancia_db ?? 0,
    volumen: volumen.silenciado ? 0 : volumen.volumen
  })
  const enPrueba = useEffectEvent(() => prueba !== null)
  useEffect(() => () => abrirPendiente.current?.abort(), [])

  const trabajo = trabajos.find((t) => t.cancionId === id && t.paso === 'separacion')
  const paso = resumen.pasos?.separacion
  const avance = trabajo ? (progreso[trabajo.id] ?? trabajo.progreso) : null
  const eta = avance?.etaSegundos
  const separacion: SeparacionEditor = {
    disponible: paso?.estado === 'completado' && !resumen.danada,
    enCola: trabajo?.estado === 'en_cola',
    porcentaje:
      paso?.estado === 'en_curso' || trabajo?.estado === 'en_curso'
        ? Math.round(100 * (avance?.valor ?? paso?.progreso ?? 0))
        : null,
    minutos: eta == null ? undefined : Math.max(1, Math.round(eta / 60))
  }

  const picos = usePicosVoz(
    id,
    pestana !== 'estilo' && cuentas.total > 0 && prueba === null && separacion.disponible
  )

  const pistaInicial = useRef<Pista>(
    carga.resumen.pasos?.separacion.estado === 'completado' && !carga.resumen.danada
      ? 'voz'
      : 'original'
  )
  useEffect(() => {
    if (motor && !enPrueba() && !vuelta.current) void motor.usarPista(pistaInicial.current)
  }, [motor])

  useEffect(() => {
    if (prueba || !motor || !vuelta.current) return
    const { pista, velocidad, posicionMs } = vuelta.current
    vuelta.current = null
    refProbar.current?.focus({ preventScroll: true })
    const cargando = motor.usarPista(pista)
    // El editor suele conservar la duración y puede buscar mientras se vuelve a cargar el audio.
    const listoParaBuscar = motor.estado().duracionMs === null ? cargando : Promise.resolve()
    let cancelada = false
    void listoParaBuscar.then(() => {
      if (cancelada) return
      motor.fijarVelocidad(velocidad)
      motor.buscar(posicionMs)
      setPosicion(motor.posicionMs())
    })
    return () => {
      cancelada = true
    }
  }, [motor, prueba])

  useEffect(() => {
    if (focoInicialSync.current && audio?.duracionMs != null) {
      focoInicialSync.current = false
      refSync.current?.focus()
    }
  }, [audio?.duracionMs])

  const [escucharAjustes, setEscucharAjustes] = useState(true)
  const [ayudaBluetooth, setAyudaBluetooth] = useState(false)
  const escucha = useMemo(() => (motor ? new EscuchaComprobacion(motor) : null), [motor])
  useEffect(() => () => escucha?.cancelar(), [escucha])

  useEffect(() => {
    const aviso = edicion.aviso
    if (aviso?.tipo !== 'consecuencias') return
    const accion = { etiqueta: 'Deshacer', alAccionar: () => despachar({ tipo: 'deshacer' }) }
    // Durante «Sincronizar al ritmo» no hay toasts de palabras: al salir sale uno solo (spec 8.2).
    const perdidas = aviso.palabrasDescartadas.filter((id) =>
      letra.lineas.some((el) => el.id === id && el.tipo === 'linea')
    )
    if (perdidas.length > 0 && !edicion.sync.activo) {
      mostrarToast({
        tipo: 'aviso',
        mensaje: E.toastPalabras(perdidas.map((id) => numeroDeLinea(letra, id))),
        accion
      })
    }
    for (const id of aviso.finesAutomaticos) {
      if (letra.lineas.some((el) => el.id === id && el.tipo === 'linea')) {
        mostrarToast({ tipo: 'info', mensaje: E.toastFinAuto(numeroDeLinea(letra, id)), accion })
      }
    }
    // Un aviso solo se anuncia una vez, aunque el usuario siga editando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicion.aviso])

  // Al salir del modo al ritmo: un único toast si alguna línea perdió sus palabras hechas a mano.
  const letraAlEntrarRitmo = useRef<Letra | null>(null)
  useEffect(() => {
    const antes = letraAlEntrarRitmo.current
    if (edicion.sync.activo) {
      letraAlEntrarRitmo.current ??= letra
      return
    }
    letraAlEntrarRitmo.current = null
    if (!antes) return
    const perdidas = antes.lineas.filter(
      (el) =>
        el.tipo === 'linea' &&
        tienePalabrasManuales(el) &&
        letra.lineas.some((l) => l.id === el.id && l.tipo === 'linea' && !tienePalabrasManuales(l))
    )
    if (perdidas.length > 0) {
      mostrarToast({
        tipo: 'info',
        mensaje: E.toastPalabrasRitmo(perdidas.map((el) => numeroDeLinea(letra, el.id)))
      })
    }
    // Solo reacciona a entrar o salir del modo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicion.sync.activo])

  const sonando = audio?.sonando ?? false
  const duracionMs = audio?.duracionMs ?? metadatos.duracion_ms
  const obtenerTiempoAudio = useCallback(() => motor?.posicionMs() ?? 0, [motor])
  const sync = useSincronizarAlRitmo({
    motor,
    edicion,
    despachar,
    duracionMs,
    alSalir: () => {
      if (mostrarAyudaBluetooth()) setAyudaBluetooth(true)
      setFocoLinea((n) => n + 1)
    }
  })
  // Espera que ve el público (reemplazo de la canción, tema o estilo propio).
  const esperaDelPublico = esperaVisible(tema.control.vista, apariencia, estilo)
  // «Ajustar los silencios» (0215): el botón de la línea de tiempo y el ítem del menú ⋯ comparten estado.
  const silencios = useAjustarSilencios({
    cancionId: id,
    letra,
    duracionMs,
    espera: esperaDelPublico,
    version: edicion.version,
    despachar,
    anunciar
  })
  const motivosAjuste = motivosSilencios({
    letra,
    separacionDisponible: separacion.disponible,
    picos:
      pestana !== 'estilo' && cuentas.total > 0 && prueba === null && separacion.disponible
        ? picos.estado.estado
        : null,
    borradorTema: tema.editando
  })
  // «Comprobar la letra con la voz» (feature 4): sobre la letra en memoria y los picos de voz.
  const comprobar = useComprobarLetra({
    cancionId: id,
    letra,
    duracionMs,
    separacionDisponible: separacion.disponible,
    picos:
      pestana !== 'estilo' && cuentas.total > 0 && prueba === null && separacion.disponible
        ? picos.estado.estado
        : null,
    calcularAlEntrar: resumen.estado === 'borrador' && !edicion.sync.activo,
    despachar,
    anunciar,
    irATramo: (tramo) => {
      cerrarAplicandoPreciso()
      const linea =
        tramo.lineaId ??
        letra.lineas.find(
          (l) =>
            l.tipo === 'linea' &&
            l.inicio_ms !== null &&
            tiempoMostrado(l.inicio_ms, letra.offset_ms) >= tramo.desdeMs &&
            tiempoMostrado(l.inicio_ms, letra.offset_ms) < tramo.hastaMs
        )?.id
      if (linea) seleccionar(linea)
      buscar(tramo.desdeMs)
      setRevisionSeleccion((n) => n + 1)
    }
  })
  // Revisión guiada (feature 11): líneas dudosas en vivo, marcas y recorrido.
  const [zoomRevision, setZoomRevision] = useState(0)
  const revision = useRevision({
    cancionId: id,
    letra,
    duracionMs,
    espera: esperaDelPublico,
    version: edicion.version,
    seleccion: edicion.seleccion,
    separacionDisponible: separacion.disponible,
    picos: picos.estado,
    autoescucha: config.editor.revision_autoescucha,
    despachar,
    anunciar,
    irALinea: (linea) => {
      seleccionar(linea)
      setPestana('sincronia')
      setZoomRevision((n) => n + 1)
    },
    escucharTramo: (linea) => escucharTramoLinea(linea),
    bloqueado: edicion.sync.activo || Boolean(audio?.error)
  })
  // Entrar con la revisión pedida: se espera a leer la voz (o a saber que no la habrá) para que el
  // primer recorrido ya traiga todos los motivos; con 0 pendientes la tarjeta lo dice (F11-B2).
  const revisionPedida = useRef(revisarAlEntrar)
  const hayVozOSinElla =
    revision.voz !== null || !separacion.disponible || picos.estado.estado === 'error'
  useEffect(() => {
    if (!revisionPedida.current || !hayVozOSinElla) return
    revisionPedida.current = false
    revision.empezar()
    if (resumen.preparacion && !resumen.preparacion.revisada) cerrarBannerPreparacion()
    // Solo reacciona a que la voz esté lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayVozOSinElla])
  // Motivo principal de cada línea pendiente (tooltip, nombre accesible y banderita).
  const marcasRevision = useMemo(
    () => new Map(revision.pendientes.map((d) => [d.id, motivoPrincipal(d)])),
    [revision.pendientes]
  )
  // «Marcar como lista» con pendientes: la primera pulsación de la visita pregunta (F11-E12).
  const avisoRevisionVisto = useRef(false)
  const primeraPulsacionRevision = useCallback(() => {
    const antes = avisoRevisionVisto.current
    avisoRevisionVisto.current = true
    return !antes
  }, [])
  const avisoPendientes = {
    pendientes: contarImportantes(revision.pendientes),
    primeraPulsacion: primeraPulsacionRevision,
    revisarAhora: revision.empezar
  }
  // Indicadores de espera (0212): la vista previa y la prueba ven la espera efectiva de la canción.
  // Letra en pantalla (0291) y subrayado de este equipo (0293): lo ve también la prueba a pantalla completa.
  const pantallaDelPublico = pantallaVisible(tema.control.vista, apariencia, estilo)
  const subrayadoDelEquipo = config.reproductor.subrayar_cantado
  const estiloPrevia = useMemo(
    () =>
      conSubrayadoDelEquipo(
        { ...estilo, espera: esperaDelPublico, pantalla: pantallaDelPublico },
        subrayadoDelEquipo
      ),
    [estilo, esperaDelPublico, pantallaDelPublico, subrayadoDelEquipo]
  )
  const ejemploEspera = useEjemploEspera({
    letra,
    seleccion: edicion.seleccion,
    espera: esperaDelPublico,
    sonando,
    pausar: () => alternar(),
    anunciar
  })
  // «Ver un ejemplo» de Letra en pantalla: solo hay un ejemplo a la vez (el de espera se detiene).
  const ejemploPantalla = useEjemploEspera({
    letra,
    seleccion: edicion.seleccion,
    espera: esperaDelPublico,
    sonando,
    pausar: () => alternar(),
    anunciar,
    crear: crearEjemploPantalla,
    anuncios: { inicio: T_PANTALLA.anuncio.ejemploInicio, fin: T_PANTALLA.anuncio.ejemploFin }
  })
  const controlEspera = useControlEspera({
    vista: tema.control.vista,
    resumen,
    apariencia,
    estilo,
    despachar,
    anunciar,
    ejemploActivo: ejemploEspera.ejemplo !== null,
    alternarEjemplo: () => {
      if (ejemploPantalla.ejemplo) ejemploPantalla.alternar()
      ejemploEspera.alternar()
    }
  })
  const controlPantalla = useControlPantalla({
    vista: tema.control.vista,
    resumen,
    apariencia,
    estilo,
    despachar,
    anunciar,
    ejemploActivo: ejemploPantalla.ejemplo !== null,
    alternarEjemplo: () => {
      if (ejemploEspera.ejemplo) ejemploEspera.alternar()
      ejemploPantalla.alternar()
    },
    sonando,
    movimientoReducido
  })
  // Con un ejemplo en marcha, la vista previa enseña el suyo (el de pantalla, sin indicadores).
  const ejemploVista = ejemploEspera.ejemplo ? ejemploEspera : ejemploPantalla
  const estiloVista = ejemploPantalla.ejemplo
    ? { ...estiloPrevia, espera: ejemploPantalla.ejemplo.espera }
    : estiloPrevia
  function irAPrimeraSinInicio() {
    const primera = primeraSinInicio(letra)
    if (primera) seleccionar(primera, true)
  }
  function intervaloDeSeleccion(letraVisible: Letra): IntervaloTiempo | null {
    const inicio = letraVisible.lineas.find((l) => l.id === edicion.seleccion)?.inicio_ms
    const fin = edicion.seleccion ? finEfectivo(letraVisible, edicion.seleccion, duracionMs) : null
    if (inicio == null || fin == null) return null
    return recortarIntervalo(
      { inicioMs: inicio + letraVisible.offset_ms, finMs: fin + letraVisible.offset_ms },
      crearVistaLineaTiempo(duracionMs)
    )
  }

  function desarmarBucle(restaurar = true) {
    const sesion = bucle.current
    if (!sesion || !motor) return
    cancelarEntradaBucle.current?.()
    bucle.current = null
    setBucleArmado(false)
    if (restaurar) motor.pausar()
    motor.fijarBucle(null)
    if (restaurar) motor.buscar(sesion.previa)
    setPosicion(motor.posicionMs())
  }

  function aplicarLimitesBucle(letraVisible: Letra, provisional: boolean) {
    const sesion = bucle.current
    if (!sesion || !motor) return
    const intervalo = intervaloDeSeleccion(letraVisible)
    if (!intervalo) {
      if (!provisional) {
        desarmarBucle()
        return
      }
      if (sesion.sonaba === null) {
        sesion.sonaba = motor.estado().sonando
        motor.pausar()
        setPosicion(motor.posicionMs())
      }
      return
    }
    if (!motor.fijarBucle(intervalo)) return
    setPosicion(motor.posicionMs())
    if (sesion.sonaba !== null) {
      if (sesion.sonaba) void motor.reproducir()
      sesion.sonaba = null
    }
  }

  function alternarBucle() {
    if (avisarOcupada()) return
    if (bucle.current) {
      desarmarBucle()
      cancelarMarcador()
      return
    }
    const intervalo = intervaloDeSeleccion(letra)
    if (!motor || !intervalo) return
    cancelarMarcador()
    escucha?.cancelar()
    const previa = motor.posicionMs()
    motor.pausar()
    if (!motor.fijarBucle(intervalo)) return
    bucle.current = { previa, sonaba: null }
    setBucleArmado(true)
    motor.buscar(intervalo.inicioMs)
    setPosicion(intervalo.inicioMs)
    void motor.reproducir()
  }

  function cancelarMarcador() {
    if (!gestoActual.current) return false
    gestoActual.current = null
    setGestoVisible(null)
    aplicarLimitesBucle(letra, false)
    return true
  }

  const actualizarTrasEdicion = useEffectEvent(() => {
    if (gestoActual.current && !gestoMarcadorVigente(edicion, gestoActual.current)) {
      cancelarMarcador()
    }
    aplicarLimitesBucle(gestoActual.current?.resultado?.letra ?? letra, !!gestoActual.current)
  })
  useLayoutEffect(() => actualizarTrasEdicion(), [edicion, duracionMs])

  function entrarSync() {
    if (abrirPendiente.current) return
    cerrarAplicandoPreciso()
    desarmarBucle()
    cancelarMarcador()
    escucha?.cancelar()
    revision.terminar()
    setPestana('sincronia')
    sync.entrar()
  }

  useEffect(() => {
    if (!motor) return
    const actualizar = () => setPosicion(Math.floor(motor.posicionMs() / 100) * 100)
    const final = setTimeout(actualizar, 0)
    if (!sonando) return () => clearTimeout(final)
    const intervalo = setInterval(actualizar, 80)
    return () => {
      clearTimeout(final)
      clearInterval(intervalo)
    }
  }, [motor, sonando])

  const {
    estado: guardado,
    cambiarLetra,
    cambiarApariencia,
    vaciar,
    confirmarSinGuardar,
    sincronizarTextos,
    dialogoSalida
  } = useGuardadoEditor({
    cancionId: id,
    titulo: metadatos.titulo,
    obtenerSesion,
    borradorPendiente: tema.borradorModificado,
    guardaBorrador: async () => {
      // Salir de cualquier modo aplica lo pendiente del editor preciso antes de vaciar el guardado.
      if (aplicarPrecisoRef.current()) await new Promise((r) => setTimeout(r, 0))
      return tema.pedirSalida()
    },
    resumenes,
    letraInicial,
    alDesactualizada: async () => {
      desarmarBucle()
      cancelarMarcador()
      motor?.pausar()
      const actual = await leerVisita()
      const nueva = actual?.letra ?? VACIA
      sincronizarTextos(nueva)
      setPrecisoId(null)
      setBorradorPreciso(null)
      const seleccion = nueva.lineas.some((l) => l.id === edicion.seleccion && l.tipo === 'linea')
        ? edicion.seleccion
        : seleccionarInicial(nueva)
      despachar({
        tipo: 'cargar',
        instantanea: { letra: nueva, apariencia, borrador: edicion.actual.borrador },
        seleccion
      })
      mostrarToast({ tipo: 'aviso', mensaje: E.recargada, persistente: true })
    },
    alSalirGuardado: (destino) =>
      avisarBorradorAlSalir(destino, resumen.estado, edicion.cambiosEnVisita)
  })
  const previa = useRef({ actual: edicion.actual, version: edicion.version })
  useEffect(() => {
    const ultima = previa.current
    previa.current = { actual: edicion.actual, version: edicion.version }
    // Solo los pasos del historial se guardan; entrar en D3 o retirar un tema no escriben nada.
    if (edicion.version === 0 || edicion.version === ultima.version) return
    if (ultima.actual.letra !== letra) cambiarLetra(letra)
    if (ultima.actual.apariencia !== apariencia) cambiarApariencia(aSeleccionIpc(apariencia))
  }, [edicion.actual, edicion.version, letra, apariencia, cambiarLetra, cambiarApariencia])

  const probarInactivo = edicion.sync.activo || Boolean(audio?.error)
  const exportarVideo = useExportarDesdeEditor({
    cancionId: id,
    hayPistas: separacion.disponible,
    lineasConInicio: cuentas.sincronizadas,
    inactivo: probarInactivo,
    temaBorrador: tema.borradorModificado,
    pausar: () => motor?.pausar(),
    vaciar
  })
  const exportarActual = useRef(exportarVideo.exportar)
  useLayoutEffect(() => {
    exportarActual.current = exportarVideo.exportar
  })
  /** Ctrl/Cmd + E: aplica la ventana antes, para que el guardado y el video la incluyan. */
  function exportarAplicando() {
    if (aplicarPendientePreciso()) setTimeout(() => exportarActual.current(), 0)
    else exportarVideo.exportar()
  }
  const prepararPruebaActual = useRef<() => Prueba | null>(() => null)
  useLayoutEffect(() => {
    // El vaciado puede esperar una escritura o el diálogo. Usa el editor del último render.
    prepararPruebaActual.current = () => {
      if (probarInactivo || !cuentas.sincronizadas) return null
      const audioEditor = motor?.estado()
      const inicio = letra.lineas.find((l) => l.id === edicion.seleccion)?.inicio_ms
      const desdeMs = Math.max(
        0,
        inicio == null ? obtenerTiempoAudio() : inicio + letra.offset_ms - 3000
      )
      desarmarBucle()
      cancelarMarcador()
      escucha?.cancelar()
      motor?.liberarAudio()
      return {
        pista:
          (audioEditor?.duracionMs == null ? audioEditor?.cargandoPista : audioEditor.pista) ??
          pistaInicial.current,
        velocidad: audioEditor?.velocidad ?? 1,
        desdeMs,
        modo: separacion.disponible ? 'karaoke' : 'original'
      }
    }
  })

  async function cambiarModalidad(modalidad: 'karaoke' | 'letra_lista', omitir = false) {
    try {
      if (omitir) {
        await guardarOmitirAviso()
        setOmitirAvisoLL(true)
      }
      if (!(await vaciar())) return
      await window.shinobi.biblioteca.marcarLista(id, { modalidad })
      await refrescarResumen()
      const mensaje = modalidad === 'letra_lista' ? LL.toastCambio : LL.toastKaraoke
      mostrarToast({ tipo: 'exito', mensaje })
      anunciar(mensaje)
    } catch (error) {
      avisarError(LL.errorCambiar, error)
    } finally {
      setDialogoCambioLL(false)
    }
  }

  /** Cambiar a Letra lista (con aviso la primera vez) o a Lista desde la pestaña Funciones. */
  function cambiarModalidadDesdeFunciones(destino: 'karaoke' | 'letra_lista') {
    if (destino === 'letra_lista' && !omitirAvisoLL) setDialogoCambioLL(true)
    else void cambiarModalidad(destino)
  }

  /** Botón Funciones del riel: expande el panel en esa pestaña con el foco en su primer botón. */
  function expandirEnFunciones() {
    if (edicion.sync.activo) return
    actualizarPaneles(
      { ...preferencias, panel: { ...preferencias.panel, minimizado: false } },
      'inmediato'
    )
    anunciar(E.layout.anuncio.expandido(E.layout.panel.nombre, false))
    cancelarMarcador()
    setPestana('funciones')
    enfocarFunciones.current = true
  }
  /** «Ver qué hicimos» del banner: abre «Funciones» con el foco en «Preparación automática». */
  function verQueHicimos() {
    if (edicion.sync.activo) return
    actualizarPaneles(
      { ...preferencias, panel: { ...preferencias.panel, minimizado: false } },
      'inmediato'
    )
    cancelarMarcador()
    setPestana('funciones')
    enfocarTituloPrep.current = true
  }
  useLayoutEffect(() => {
    if (!enfocarTituloPrep.current || panelMinimizado || pestana !== 'funciones') return
    enfocarTituloPrep.current = false
    // Sin bloque (ya no queda nada que contar) el foco va al primer botón de la pestaña.
    if (tituloPrep.current) tituloPrep.current.focus({ preventScroll: false })
    else enfocarFunciones.current = true
  })
  useLayoutEffect(() => {
    if (!enfocarFunciones.current || panelMinimizado || pestana !== 'funciones') return
    // El primer botón disponible; si ninguno lo está, el primero (los no disponibles son enfocables).
    const botones = refRaiz.current?.querySelectorAll<HTMLElement>(
      '#zona-panel button[data-funcion]'
    )
    const boton =
      Array.from(botones ?? []).find((b) => b.getAttribute('aria-disabled') !== 'true') ??
      botones?.[0]
    enfocarFunciones.current = false
    boton?.focus({ preventScroll: true })
  })
  useLayoutEffect(() => {
    if (!enfocarTituloEstado.current || resumen.estado !== 'borrador') return
    enfocarTituloEstado.current = false
    tituloEstado.current?.focus({ preventScroll: true })
  })

  // --- Editor preciso de línea (fase 9) -------------------------------------------------------
  const lineaSeleccionada = letra.lineas.find(
    (l) => l.id === edicion.seleccion && l.tipo === 'linea'
  )
  const motivoPreciso = edicion.sync.activo
    ? E.preciso.noRitmo
    : !lineaSeleccionada || lineaSeleccionada.inicio_ms === null
      ? E.preciso.noSinInicio
      : audio?.duracionMs == null || audio.error
        ? E.errorAudio
        : undefined

  function medirAreasPreciso() {
    const r = refRaiz.current?.getBoundingClientRect()
    const l = refRaiz.current?.querySelector('#zona-lista')?.getBoundingClientRect()
    setAreasPreciso({
      limites: r
        ? { left: r.left, top: r.top, width: r.width, height: r.height }
        : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight },
      referencia: l ? { left: l.left, top: l.top, width: l.width, height: l.height } : null
    })
  }
  useEffect(() => {
    if (precisoId === null) return
    window.addEventListener('resize', medirAreasPreciso)
    return () => window.removeEventListener('resize', medirAreasPreciso)
  }, [precisoId])

  /** Aplica lo que haya en la ventana como un paso del historial. `false` si no había cambios. */
  function aplicarPendientePreciso(): boolean {
    const cambios = precisoId ? refPreciso.current?.obtenerCambios() : null
    if (!precisoId || !cambios) return false
    despachar({
      tipo: 'aplicar_preciso',
      id: precisoId,
      borrador: cambios.borrador,
      duracionMs,
      ahora: performance.now()
    })
    return true
  }
  useLayoutEffect(() => {
    aplicarPrecisoRef.current = aplicarPendientePreciso
  })
  function cerrarPreciso() {
    setPrecisoId(null)
    setBorradorPreciso(null)
    const abridor = abridorPreciso.current
    abridorPreciso.current = null
    requestAnimationFrame(() => {
      if (abridor?.isConnected) abridor.focus({ preventScroll: true })
    })
  }
  /** Sincronizar al ritmo, Ajustar los silencios…: aplican y cierran antes de seguir. */
  function cerrarAplicandoPreciso() {
    if (precisoId === null) return
    aplicarPendientePreciso()
    cerrarPreciso()
  }
  function abrirPreciso() {
    if (motivoPreciso) {
      mostrarToast({ tipo: 'info', mensaje: motivoPreciso })
      return
    }
    if (precisoId !== null) {
      refPreciso.current?.enfocarUltimo()
      return
    }
    if (!edicion.seleccion) return
    desarmarBucle(false)
    cancelarMarcador()
    escucha?.cancelar()
    abridorPreciso.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    medirAreasPreciso()
    setPrecisoId(edicion.seleccion)
  }
  /** Otra línea seleccionada (lista, región, ↑/↓): la ventana pasa a ella aplicando lo pendiente. */
  useEffect(() => {
    if (precisoId === null || edicion.seleccion === null || edicion.seleccion === precisoId) return
    aplicarPendientePreciso()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrecisoId(edicion.seleccion)
    // Solo reacciona a un cambio de selección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicion.seleccion])
  useEffect(() => {
    if (edicion.sync.activo && precisoId !== null) cerrarAplicandoPreciso()
    // Solo al entrar en el modo al ritmo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicion.sync.activo])
  const letraConBorrador = useMemo(() => {
    if (!borradorPreciso || !precisoId) return letra
    try {
      return aplicarEdicionPrecisa(letra, precisoId, borradorPreciso, duracionMs)
    } catch {
      return letra
    }
  }, [letra, borradorPreciso, precisoId, duracionMs])
  function deshacerEditor() {
    aplicarPendientePreciso()
    despachar({ tipo: 'deshacer' })
  }
  // F6 / Mayús + F6: del editor a la ventana (la ventana ya devuelve el foco al editor).
  useEffect(() => {
    if (precisoId === null) return
    const f6 = (e: KeyboardEvent) => {
      if (
        e.key !== 'F6' ||
        (e.target instanceof HTMLElement && e.target.closest('[data-ventana-flotante]'))
      )
        return
      e.preventDefault()
      refPreciso.current?.enfocarUltimo()
    }
    window.addEventListener('keydown', f6, true)
    return () => window.removeEventListener('keydown', f6, true)
  }, [precisoId])

  async function abrirPrueba(): Promise<void> {
    if (aplicarPendientePreciso()) await new Promise((r) => setTimeout(r, 0))
    if (probarInactivo || !cuentas.sincronizadas || prueba || abrirPendiente.current) return
    const peticion = new AbortController()
    abrirPendiente.current = peticion
    try {
      if (!(await vaciar()) && (peticion.signal.aborted || !(await confirmarSinGuardar()))) return
      if (peticion.signal.aborted) return
      const preparada = prepararPruebaActual.current()
      if (preparada) setPrueba(preparada)
    } finally {
      abrirPendiente.current = null
    }
  }

  function terminarPrueba({ posicionMs }: { posicionMs: number }): void {
    if (!prueba) return
    vuelta.current = { pista: prueba.pista, velocidad: prueba.velocidad, posicionMs }
    const linea = letra.lineas[indiceLineaActual(letra, posicionMs)]
    if (linea) {
      despachar({ tipo: 'seleccionar', id: linea.id })
      setPestana('sincronia')
      setRevisionSeleccion((n) => n + 1)
    }
    setPrueba(null)
  }

  function buscar(ms: number) {
    if (!motor) return
    escucha?.cancelar()
    if (bucle.current) {
      const intervalo = intervaloDeSeleccion(gestoActual.current?.resultado?.letra ?? letra)
      if (!intervalo || ms < intervalo.inicioMs || ms >= intervalo.finMs) {
        desarmarBucle(false)
        cancelarMarcador()
      }
    }
    motor.buscar(ms)
    setPosicion(motor.posicionMs())
  }
  function alternar() {
    if (edicion.sync.activo) {
      sync.alternar()
      return
    }
    escucha?.cancelar()
    if (bucle.current?.sonaba != null) return
    if (motor?.estado().sonando) motor.pausar()
    else void motor?.reproducir()
  }
  function usarPista(pista: Pista) {
    if (pista === 'original' || separacion.disponible) void motor?.usarPista(pista)
  }
  function escuchar(id: string) {
    desarmarBucle()
    cancelarMarcador()
    escucha?.cancelar()
    if (!edicion.sync.activo) void motor?.reproducir({ desdeMs: desdeLinea(letra, id) })
  }
  /**
   * Mayús + L (spec 06, 8.4): de 0,5 s antes a 0,5 s después de la línea, con pausa al final.
   * El doble clic en una región (`seguir`) empieza igual, 0,5 s antes, pero no se pausa: la canción
   * sigue. Devuelve `false` si la línea queda fuera del audio (no suena).
   */
  function escucharTramoLinea(id: string, seguir = false): boolean {
    if (!motor || edicion.sync.activo) return true
    if (!letra.lineas.some((l) => l.id === id && l.inicio_ms !== null)) {
      mostrarToast({ tipo: 'info', mensaje: E.escucharLineaSinInicio })
      return true
    }
    const tramo = tramoEscuchaLinea(letra, id, duracionMs)
    if (!tramo) return false
    cancelarMarcador()
    escucha?.cancelar()
    cancelarEntradaBucle.current?.()
    const sesionBucle = bucle.current
    if (sesionBucle && id === edicion.seleccion && sesionBucle.sonaba === null) {
      // Misma línea con «Bloquear enunciado»: el bucle sigue. La primera vuelta incluye el margen.
      const intervalo = intervaloDeSeleccion(letra)
      if (!intervalo) return false
      const desdeMs = Math.max(0, intervalo.inicioMs - MARGEN_ESCUCHA_LINEA_MS)
      // El motor conserva el bucle al buscar antes de su inicio: suena el margen y luego envuelve.
      motor.buscar(desdeMs, { conservarBucle: true })
      void motor.reproducir()
      return true
    }
    // Otra línea: el bucle termina sin restaurar la posición y suena el tramo nuevo.
    if (sesionBucle) desarmarBucle(false)
    void motor.reproducir(seguir ? { desdeMs: tramo.desdeMs } : tramo)
    return true
  }
  function seleccionar(id: string, enfocar = false) {
    if (id !== edicion.seleccion) {
      desarmarBucle()
      cancelarMarcador()
    }
    if (edicion.sync.activo) sync.seleccionar(id)
    else despachar({ tipo: 'seleccionar', id })
    if (enfocar) {
      setPestana('sincronia')
      setFocoLinea((n) => n + 1)
    }
  }

  function cambiarTiempo(campo: 'inicio' | 'fin', accion: AccionEditor) {
    if (avisarOcupada()) return
    const actualizado = reducirEditor(edicion, accion)
    despachar(accion)
    if (
      bucle.current ||
      !escucharAjustes ||
      actualizado.version === edicion.version ||
      !edicion.seleccion
    )
      return
    const nueva = actualizado.actual.letra
    const ms =
      campo === 'inicio'
        ? nueva.lineas.find((e) => e.id === edicion.seleccion)?.inicio_ms
        : finEfectivo(nueva, edicion.seleccion, duracionMs)
    if (ms != null) escucha?.escuchar(tiempoMostrado(ms, nueva.offset_ms), campo)
  }
  function ajustar(campo: 'inicio' | 'fin', deltaMs: number) {
    const ahora = performance.now()
    cambiarTiempo(
      campo,
      campo === 'inicio'
        ? { tipo: 'ajustar_inicio', deltaMs, ahora }
        : { tipo: 'ajustar_fin', deltaMs, duracionMs, ahora }
    )
  }
  function fijar(campo: 'inicio' | 'fin', msAudio = obtenerTiempoAudio()) {
    const ms = tiempoGuardado(msAudio, letra.offset_ms)
    const ahora = performance.now()
    cambiarTiempo(
      campo,
      campo === 'inicio'
        ? { tipo: 'fijar_inicio', ms, ahora }
        : { tipo: 'fijar_fin', ms, duracionMs, ahora }
    )
  }
  const borrar = () => {
    if (avisarOcupada()) return
    despachar({ tipo: 'borrar_tiempos', ahora: performance.now() })
  }

  type ZonaPaneles = 'lista' | 'panel' | 'linea_tiempo'
  const ZONAS = {
    lista: { nombre: E.layout.lista.nombre, femenino: true, boton: 'lista' },
    panel: { nombre: E.layout.panel.nombre, femenino: false, boton: 'panel' },
    linea_tiempo: { nombre: E.layout.timeline.nombre, femenino: true, boton: 'timeline' }
  } as const
  const ZONA_DE_DIVISOR = { lista: 'lista', panel: 'panel', dock: 'linea_tiempo' } as const

  /** Minimiza o expande una zona por acción del usuario (se guarda al momento, spec 2.1). */
  function alternarZona(zona: ZonaPaneles, origen: 'boton' | 'divisor') {
    const info = ZONAS[zona]
    const minimiza = !preferencias[zona].minimizado
    actualizarPaneles(
      { ...preferencias, [zona]: { ...preferencias[zona], minimizado: minimiza } },
      'inmediato'
    )
    anunciar(
      minimiza
        ? E.layout.anuncio.minimizado(info.nombre, info.femenino)
        : E.layout.anuncio.expandido(info.nombre, info.femenino)
    )
    // Con el botón el foco pasa al equivalente del otro modo; con Intro o doble clic se queda en el divisor.
    if (origen === 'boton') {
      focoPendiente.current = `${info.boton}-${minimiza ? 'expandir' : 'minimizar'}`
    }
  }

  function restablecerDivisor(divisor: DivisorEditor) {
    const defecto = preferenciasPanelesPredeterminadas()
    const zona = ZONA_DE_DIVISOR[divisor]
    if (preferencias[zona].minimizado) {
      const info = ZONAS[zona]
      anunciar(E.layout.anuncio.expandido(info.nombre, info.femenino))
    }
    actualizarPaneles({ ...preferencias, [zona]: defecto[zona] }, 'inmediato')
  }

  function restablecerDistribucion() {
    actualizarPaneles(preferenciasPanelesPredeterminadas(), 'inmediato')
    anunciar(E.layout.anuncio.restablecida)
  }

  function cambiarTamano(divisor: DivisorEditor, valor: number, origen: 'teclado' | 'arrastre') {
    // En vivo solo cambia la variable CSS: ni estado, ni reducer, ni guardado.
    if (origen === 'arrastre') {
      aplicarTamanoVivo(refRaiz.current, distribucion, divisor, valor)
      return
    }
    actualizarPaneles(preferenciaTrasAccion(preferencias, divisor, valor), 'teclado')
  }

  function propsDivisor(divisor: DivisorEditor) {
    const zona = divisor === 'dock' ? distribucion.lineaTiempo : distribucion[divisor]
    const valor = 'ancho' in zona ? zona.ancho : zona.alto
    const femenino = divisor !== 'panel'
    return {
      nombre: divisor,
      orientacion: divisor === 'dock' ? ('horizontal' as const) : ('vertical' as const),
      controla: { lista: 'zona-lista', panel: 'zona-panel', dock: 'zona-linea-tiempo' }[divisor],
      etiqueta: E.layout.divisor[divisor],
      valor,
      min: zona.min,
      max: zona.max,
      minimizado: zona.minimizado,
      textoValor: zona.minimizado
        ? E.layout.valorMinimizado(femenino)
        : E.layout.valor(Math.round(valor)),
      tooltip: E.layout.divisor.tooltip,
      focoEditor: 'divisor',
      alTecla: (tecla: string, mayus: boolean) => aplicarTecla(distribucion, divisor, tecla, mayus),
      alArrastre: (inicio: number, delta: number) =>
        aplicarArrastre(distribucion, divisor, inicio, delta),
      alCambiar: (v: number, origen: 'teclado' | 'arrastre') => cambiarTamano(divisor, v, origen),
      alConfirmar: (v: number) =>
        actualizarPaneles(preferenciaTrasAccion(preferencias, divisor, v), 'inmediato'),
      alRestablecer: () => restablecerDivisor(divisor),
      alAlternar: () => alternarZona(ZONA_DE_DIVISOR[divisor], 'divisor')
    }
  }

  function moverSeleccion(sentido: -1 | 1, enfocar: boolean) {
    const id = lineaVecina(letra, edicion.seleccion, sentido)
    if (id && id !== edicion.seleccion) {
      desarmarBucle()
      cancelarMarcador()
    }
    despachar({ tipo: 'mover_seleccion', sentido })
    setPestana('sincronia')
    if (enfocar) setFocoLinea((n) => n + 1)
  }

  // Foco tras cambiar de modo: el botón equivalente de la zona; nunca queda en `body`.
  useLayoutEffect(() => {
    const nombre = focoPendiente.current
    if (!nombre) return
    const boton = refRaiz.current?.querySelector<HTMLElement>(`[data-boton-layout="${nombre}"]`)
    if (!boton) return
    focoPendiente.current = null
    boton.focus({ preventScroll: true })
  })

  // Línea de tiempo minimizada por falta de espacio: temporal, nunca toca la preferencia.
  const porEspacio = distribucion.lineaTiempo.minimizadoPorEspacio
  const porEspacioAntes = useRef(false)
  useLayoutEffect(() => {
    const ahora = porEspacio && !porEspacioAntes.current
    porEspacioAntes.current = porEspacio
    if (!ahora || preferencias.linea_tiempo.minimizado) return
    anunciar(E.layout.anuncio.sinEspacio)
    const activo = document.activeElement
    if (focoEnLineaTiempo.current && (!activo || activo === document.body)) {
      refRaiz.current
        ?.querySelector<HTMLElement>('[data-boton-layout="timeline-expandir"]')
        ?.focus({ preventScroll: true })
    }
    // Solo reacciona al cambio de estado por falta de espacio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porEspacio])

  // Foco inicial en la lista: con la lista minimizada va a «Expandir lista de líneas».
  function enfocarLista() {
    if (listaMinimizada) {
      refRaiz.current
        ?.querySelector<HTMLElement>('[data-boton-layout="lista-expandir"]')
        ?.focus({ preventScroll: true })
    } else {
      setFocoLinea((n) => n + 1)
    }
  }
  useLayoutEffect(() => {
    if (focoLinea === 0) return
    const raizEditor = refRaiz.current
    const destino = listaMinimizada
      ? raizEditor?.querySelector<HTMLElement>('[data-boton-layout="lista-expandir"]')
      : (raizEditor?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ??
        raizEditor?.querySelector<HTMLElement>('#lineas-editor'))
    destino?.focus({ preventScroll: true })
    // Solo al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useAtajosEditor(
    edicion.sync.activo,
    (accion, evento) => {
      switch (accion.tipo) {
        case 'reproducir':
          alternar()
          break
        case 'principio':
          buscar(0)
          break
        case 'buscar':
          buscar(obtenerTiempoAudio() + accion.deltaMs)
          break
        case 'pista':
          usarPista(accion.pista)
          break
        case 'mover_seleccion':
          moverSeleccion(accion.sentido, !listaMinimizada)
          break
        case 'deshacer':
          deshacerEditor()
          break
        case 'abrir_preciso':
          abrirPreciso()
          break
        case 'rehacer':
          despachar({ tipo: 'rehacer' })
          break
        case 'ajustar_inicio':
        case 'ajustar_fin':
          ajustar(accion.tipo === 'ajustar_inicio' ? 'inicio' : 'fin', accion.deltaMs)
          break
        case 'fijar_inicio':
        case 'fijar_fin':
          fijar(accion.tipo === 'fijar_inicio' ? 'inicio' : 'fin')
          break
        case 'escuchar_linea':
          if (edicion.seleccion) escuchar(edicion.seleccion)
          break
        case 'escuchar_tramo_linea':
          if (edicion.seleccion) escucharTramoLinea(edicion.seleccion)
          break
        case 'borrar_tiempos':
          borrar()
          break
        case 'atajos':
          setDialogoAtajos(true)
          break
        case 'probar':
          void abrirPrueba()
          break
        case 'exportar':
          exportarAplicando()
          break
        case 'marcar':
          sync.marcar(evento.timeStamp, 'teclado')
          break
        case 'deshacer_marca':
          sync.deshacer()
          break
        case 'revisar':
          cerrarAplicandoPreciso()
          if (revision.activo) terminarRevision()
          else revision.empezar()
          break
        case 'revision_bien':
          if (revision.activo) revision.estaBien()
          break
        case 'dudosa':
          cerrarAplicandoPreciso()
          if (accion.sentido === 1) revision.siguiente()
          else revision.anterior()
          setFocoLinea((n) => n + 1)
          break
        case 'escapar':
          if (cancelarMarcador()) break
          if (bucle.current) {
            desarmarBucle()
            break
          }
          if (revision.activo) {
            terminarRevision()
            break
          }
          if (edicion.sync.activo) sync.terminar()
          else ir({ tipo: 'biblioteca' })
          break
      }
    },
    (evento) => {
      if (evento.key === 'Enter') sync.soltar(evento.timeStamp, 'teclado')
    }
  )

  /** Termina el recorrido y devuelve el foco a la fila seleccionada. */
  function terminarRevision() {
    revision.terminar()
    setFocoLinea((n) => n + 1)
  }
  /** «Quitar esos fines» (spec 06 · Feature 5): un paso del historial con su toast y [Deshacer]. */
  function quitarFinesPreparacion() {
    const n = letra.lineas.filter(
      (l) => l.tipo === 'linea' && l.origen_fin === 'preparacion'
    ).length
    if (n === 0) return
    cerrarAplicandoPreciso()
    despachar({ tipo: 'quitar_fines_preparacion', ahora: performance.now() })
    const mensaje = EP.toastFines(n)
    mostrarToast({
      tipo: 'exito',
      mensaje,
      accion: { etiqueta: 'Deshacer', alAccionar: () => despachar({ tipo: 'deshacer' }) }
    })
    anunciar(mensaje)
  }
  /** [×] del banner de la preparación: la canción cuenta como revisada y no vuelve a salir. */
  function cerrarBannerPreparacion() {
    setCerradoPrep(true)
    void window.shinobi.biblioteca.marcarPreparacionRevisada(id).catch(() => undefined)
  }
  const bloquePrep = bloquePreparacion(cancion.preparacion, letra)
  const irALetra = () => ir({ tipo: 'cancion', id, paso: 'letra' })
  /** «Buscar otra letra» de la comprobación: abre la vista Letra en A (spec 06 · F4). */
  const irABuscarOtra = () => ir({ tipo: 'cancion', id, paso: 'letra', buscarOtra: true })
  const botonProbar = (
    <Boton
      ref={refProbar}
      aria-keyshortcuts="F"
      disabled={probarInactivo}
      noDisponible={cuentas.sincronizadas === 0 ? E.probarSinLineas : undefined}
      onClick={() => void abrirPrueba()}
    >
      <Icono icono={Maximize} />
      {E.botonProbar}
    </Boton>
  )
  const motivoBucle = !letra.lineas.some((l) => l.id === edicion.seleccion && l.inicio_ms !== null)
    ? E.timeline.sinInicio
    : !intervaloDeSeleccion(letra)
      ? E.timeline.fuera
      : undefined
  const siguiente = letra.lineas.find((el) => el.id === edicion.sync.siguiente)
  const todasAlEntrar = contador(letraInicial).sincronizadas === contador(letraInicial).total
  // Con algo que decir, la comprobación sustituye al aviso «ya sincronizada» (spec 06 · F4, «Banner al entrar»).
  const entrada = comprobar.entrada
  const bannerComprobacion =
    resumen.estado !== 'borrador' || edicion.sync.activo || !entrada ? null : entrada.tipo ===
      'desfasada' ? (
      <AvisoEnLinea
        tipo="info"
        accionesAbajo
        accion={
          <>
            <Boton onClick={() => void comprobar.pedir()}>{KC.desfase.boton}</Boton>
            <Boton variante="fantasma" onClick={comprobar.descartarEntrada}>
              {KC.banner.ahoraNo}
            </Boton>
          </>
        }
      >
        {KC.banner.desfase(entrada.desfaseMs)}
      </AvisoEnLinea>
    ) : (
      <AvisoEnLinea
        tipo="aviso"
        accionesAbajo
        accion={
          <>
            <Boton onClick={() => void comprobar.pedir()}>{KC.banner.verPorQue}</Boton>
            <Boton variante="fantasma" onClick={irABuscarOtra}>
              {KC.noCoincide.otra}
            </Boton>
            <BotonIcono
              icono={X}
              etiqueta={KC.banner.cerrar}
              onClick={comprobar.descartarEntrada}
            />
          </>
        }
      >
        {KC.banner.noCoincide}
      </AvisoEnLinea>
    )
  // Preparado por la app y aún sin revisar (feature 5; con la revisión guiada, su variante de la feature 11).
  const sinRevisar =
    resumen.estado === 'borrador' &&
    !!resumen.preparacion &&
    !resumen.preparacion.revisada &&
    !cerradoPrep &&
    !edicion.sync.activo &&
    !revision.activo &&
    letra === letraInicial
  const pendientesRevision = revision.pendientes.length
  const bannerPreparada = sinRevisar ? (
    <AvisoEnLinea
      tipo="info"
      accionesAbajo
      accion={
        <>
          {revision.calculando ? null : pendientesRevision > 0 ? (
            <Boton onClick={() => revision.empezar()}>{EP.banner.empezar}</Boton>
          ) : (
            <Boton onClick={() => void abrirPrueba()}>{EP.banner.probar}</Boton>
          )}
          <Boton variante="fantasma" onClick={verQueHicimos}>
            {EP.banner.verQueHicimos}
          </Boton>
          <BotonIcono icono={X} etiqueta={EP.banner.cerrar} onClick={cerrarBannerPreparacion} />
        </>
      }
    >
      {revision.calculando
        ? EP.banner.preparada
        : pendientesRevision > 0
          ? EP.banner.revision(pendientesRevision)
          : EP.banner.nada}
    </AvisoEnLinea>
  ) : null
  const banner =
    cuentas.sincronizadas === 0 ? (
      <AvisoEnLinea tipo="info">{E.sinSync}</AvisoEnLinea>
    ) : bannerComprobacion ? (
      bannerComprobacion
    ) : bannerPreparada ? (
      bannerPreparada
    ) : todasAlEntrar &&
      resumen.estado === 'borrador' &&
      letra === letraInicial &&
      !cerradoYaSync ? (
      <AvisoEnLinea
        tipo="info"
        accion={
          <BotonIcono icono={X} etiqueta="Cerrar aviso" onClick={() => setCerradoYaSync(true)} />
        }
      >
        {E.yaSync}
      </AvisoEnLinea>
    ) : undefined

  return (
    <div
      ref={refRaiz}
      className={estilos.editor}
      data-pestana={pestana}
      data-compacto={distribucion.compacto}
      data-bajo-minimo={distribucion.bajoMinimo ?? undefined}
      onFocusCapture={(e) => {
        focoEnLineaTiempo.current = !!(e.target as HTMLElement).closest('#zona-linea-tiempo')
      }}
    >
      <a
        className="saltar-al-contenido"
        href="#lineas-editor"
        onClick={(e) => {
          e.preventDefault()
          setPestana('sincronia')
          enfocarLista()
        }}
      >
        Saltar al contenido
      </a>
      <h1 className={estilos.soloLector}>Editor</h1>
      <div className={estilos.soloLector} aria-live="polite" data-region="anuncios-editor">
        <span>{sync.anuncio}</span>
        <span data-anuncio-layout>{anuncioLayout}</span>
      </div>
      <div className={estilos.rejilla}>
        <header role="banner" ref={refCabecera} className={estilos.cabecera}>
          <CabeceraCancion
            variante={distribucion.compacto ? 'editor-compacta' : 'editor'}
            resumen={resumen}
            actual="editor"
            guardado={guardado}
            incompleta={cuentas.total - cuentas.sincronizadas}
            historial={{
              puedeDeshacer: puedeDeshacer(edicion),
              puedeRehacer: puedeRehacer(edicion),
              alDeshacer: deshacerEditor,
              alRehacer: () => despachar({ tipo: 'rehacer' })
            }}
            menu={[
              { id: 'atajos', etiqueta: E.menuAtajos, alSeleccionar: () => setDialogoAtajos(true) },
              {
                id: 'restablecer-distribucion',
                etiqueta: E.layout.restablecer,
                separadorAntes: true,
                alSeleccionar: restablecerDistribucion
              }
            ]}
          />
        </header>
        {cuentas.total === 0 ? (
          <div className={estilos.zonaVacia}>
            <AvisoEnLinea tipo="info" accion={<Boton onClick={irALetra}>{E.buscarLetra}</Boton>}>
              {E.sinLetra}
            </AvisoEnLinea>
          </div>
        ) : (
          <div className={estilos.cuerpo}>
            {listaMinimizada ? (
              <RielLista
                letra={letra}
                seleccion={edicion.seleccion}
                sincronizando={edicion.sync.activo}
                limiteInicio={limiteDeCampo(edicion, 'inicio')}
                anterior={() => moverSeleccion(-1, false)}
                siguiente={() => moverSeleccion(1, false)}
                fijarInicio={() => fijar('inicio')}
                expandir={() => alternarZona('lista', 'boton')}
                abrirPreciso={abrirPreciso}
                motivoPreciso={motivoPreciso}
                ocupada={ocupada}
              />
            ) : (
              <ListaLineas
                letra={letra}
                seleccion={edicion.seleccion}
                actual={sonando ? indiceLineaActual(letra, posicion) : -1}
                foco={focoLinea}
                revisionSeleccion={revisionSeleccion}
                dudosas={marcasRevision}
                siguienteDudosa={revision.siguiente}
                seleccionar={seleccionar}
                escuchar={escuchar}
                corregir={irALetra}
                banner={banner}
                abrirPreciso={abrirPreciso}
                motivoPreciso={motivoPreciso}
                escucharLinea={escucharTramoLinea}
                borrarTiempos={borrar}
                minimizar={
                  distribucion.bajoMinimo === 'ancho'
                    ? undefined
                    : () => alternarZona('lista', 'boton')
                }
              />
            )}
            <Divisor
              {...propsDivisor('lista')}
              className={`${estilos.franja} ${estilos.franjaLista}`}
            />
            <section
              className={estilos.previa}
              aria-label={E.previa}
              aria-describedby="descripcion-previa"
            >
              <h2 className={distribucion.compacto ? estilos.soloLector : undefined}>{E.previa}</h2>
              <p id="descripcion-previa" className={estilos.soloLector}>
                {E.previaAria}
              </p>
              <div className={estilos.lienzo}>
                <div className={estilos.pantalla} data-lienzo="previa">
                  <PantallaLetra
                    letra={
                      ejemploVista.ejemplo?.letra ??
                      gestoVisible?.resultado?.letra ??
                      letraConBorrador
                    }
                    key={ejemploVista.ejemplo ? 'ejemplo' : 'previa'}
                    estilo={estiloVista}
                    vistaPrevia
                    duracionMs={ejemploVista.ejemplo?.duracionMs ?? duracionMs}
                    titulo={metadatos.titulo}
                    artista={metadatos.artista}
                    idEstatico={edicion.seleccion}
                    reproduciendo={ejemploVista.ejemplo !== null || sonando}
                    cuentaAtras={ejemploVista.ejemplo ? null : sync.cuentaAtras}
                    obtenerTiempoAudio={
                      ejemploVista.ejemplo ? ejemploVista.obtenerTiempo : obtenerTiempoAudio
                    }
                    etiqueta={ejemploVista.ejemplo ? ejemploVista.etiqueta : undefined}
                    fondoEstatico={fondoDetenido}
                  />
                </div>
                <div className={estilos.accionPrueba}>
                  {cuentas.sincronizadas > 0 ? (
                    <Tooltip contenido={E.probarTooltip}>{botonProbar}</Tooltip>
                  ) : (
                    botonProbar
                  )}
                  {hayMovimiento && !movimientoReducido && (
                    <BotonIcono
                      icono={fondoDetenido ? Play : Pause}
                      etiqueta={fondoDetenido ? E.fondoG.reanudar : E.fondoG.detener}
                      activo={fondoDetenido}
                      className={estilos.detenerFondo}
                      onClick={() => setFondoDetenido((d) => !d)}
                    />
                  )}
                </div>
              </div>
            </section>
            <Divisor
              {...propsDivisor('panel')}
              className={`${estilos.franja} ${estilos.franjaPanel}`}
            />
            {panelMinimizado ? (
              <RielPanel
                letra={letra}
                seleccion={edicion.seleccion}
                duracionMs={duracionMs}
                sincronizando={edicion.sync.activo}
                bucle={bucleArmado}
                motivoBucle={motivoBucle}
                alternarBucle={audio?.duracionMs != null ? alternarBucle : undefined}
                fijarFin={() => fijar('fin')}
                limiteFin={limiteDeCampo(edicion, 'fin')}
                avisos={avisosPestana.length > 0}
                editandoTema={tema.editando}
                expandir={() => alternarZona('panel', 'boton')}
                abrirFunciones={expandirEnFunciones}
                ocupada={ocupada}
              />
            ) : (
              <>
                <div className={estilos.pestanas}>
                  <div data-foco-editor="segmentado">
                    <ControlSegmentado
                      etiqueta="Panel del editor"
                      valor={pestana}
                      opciones={[
                        {
                          valor: 'sincronia',
                          etiqueta: 'Sincronía',
                          icono: revision.activo && pestana !== 'sincronia' ? Flag : undefined,
                          nombre:
                            revision.activo && pestana !== 'sincronia' ? RV.pestana : undefined
                        },
                        {
                          valor: 'estilo',
                          etiqueta: 'Estilo',
                          aviso: avisosPestana.length > 0 ? 'Hay avisos de contraste' : undefined,
                          info: tema.editando,
                          nombre: tema.editando ? E.tema.pestanaEditando : undefined,
                          noDisponible: edicion.sync.activo ? E.syncTitulo : undefined
                        },
                        {
                          valor: 'funciones',
                          etiqueta: E.funciones.nombre,
                          noDisponible: edicion.sync.activo ? E.syncTitulo : undefined
                        }
                      ]}
                      onCambio={(panel) => {
                        cancelarMarcador()
                        setPestana(panel)
                      }}
                    />
                  </div>
                  {distribucion.bajoMinimo !== 'ancho' && (
                    <BotonLayout
                      icono={PanelRightClose}
                      etiqueta={E.layout.panel.minimizar}
                      nombre="panel-minimizar"
                      expandido
                      controla="zona-panel"
                      onClick={() => alternarZona('panel', 'boton')}
                    />
                  )}
                </div>
                <div id="zona-panel" className={estilos.panel}>
                  {pestana === 'funciones' ? (
                    <section aria-label={E.funciones.nombre}>
                      <PanelFunciones
                        estado={estadoCancion}
                        exportacion={{
                          activa: exportarVideo.activa,
                          motivo: exportarVideo.motivo,
                          exportar: exportarAplicando
                        }}
                        preparacion={{
                          datos: bloquePrep,
                          verOtras: () => {
                            cerrarAplicandoPreciso()
                            irABuscarOtra()
                          },
                          quitarFines: quitarFinesPreparacion,
                          tituloRef: tituloPrep
                        }}
                        revision={{
                          pendientes: revision.calculando ? null : revision.pendientes.length,
                          buenas: revision.buenas,
                          sinVoz: revision.voz === null && !revision.calculando,
                          calculando: revision.calculando,
                          noDisponible: probarInactivo ? E.syncTitulo : undefined,
                          empezar: () => {
                            cerrarAplicandoPreciso()
                            revision.empezar()
                          },
                          reiniciar: revision.reiniciar
                        }}
                        comprobar={{
                          motivos: comprobar.motivos,
                          calculando: comprobar.calculando,
                          pedir: () => {
                            cerrarAplicandoPreciso()
                            void comprobar.pedir()
                          },
                          reintentar: picos.reintentar,
                          desfaseCorregidoMs: letra.desfase_corregido_ms ?? null,
                          quitar: () => {
                            cerrarAplicandoPreciso()
                            comprobar.quitar()
                          }
                        }}
                        silencios={{
                          motivos: motivosAjuste,
                          buscando: silencios.buscando,
                          pedir: () => {
                            cerrarAplicandoPreciso()
                            void silencios.pedir()
                          },
                          reintentar: picos.reintentar,
                          irAPrimera: irAPrimeraSinInicio
                        }}
                        cambiarModalidad={cambiarModalidadDesdeFunciones}
                        volverABorrador={() => setDialogoBorrador(true)}
                        tituloEstado={tituloEstado}
                      />
                    </section>
                  ) : pestana === 'sincronia' ? (
                    <section aria-label="Ajuste de sincronía">
                      {revision.activo && (
                        <TarjetaRevision
                          revision={revision}
                          letra={letra}
                          seleccion={edicion.seleccion}
                          estado={estadoCancion}
                          fijarInicio={() => fijar('inicio')}
                          escuchar={() => {
                            if (edicion.seleccion) escucharTramoLinea(edicion.seleccion)
                          }}
                          probar={() => void abrirPrueba()}
                          probarInactivo={probarInactivo || cuentas.sincronizadas === 0}
                        />
                      )}
                      <PanelSincronia
                        marca={
                          !revision.activo &&
                          lineaSeleccionada &&
                          revision.porId.get(lineaSeleccionada.id) ? (
                            <MarcaPanel
                              revision={revision}
                              d={revision.porId.get(lineaSeleccionada.id)!}
                              fijarInicio={() => fijar('inicio')}
                              conPalabras={tienePalabrasManuales(lineaSeleccionada)}
                            />
                          ) : undefined
                        }
                        edicion={edicion}
                        duracionMs={duracionMs}
                        ayudaBluetooth={ayudaBluetooth}
                        abrirPreciso={abrirPreciso}
                        motivoPreciso={motivoPreciso}
                        ocupada={ocupada}
                        cerrarBluetooth={() => setAyudaBluetooth(false)}
                        escucharAjustes={escucharAjustes}
                        fijarEscucharAjustes={setEscucharAjustes}
                        bucle={bucleArmado}
                        motivoBucle={motivoBucle}
                        alternarBucle={audio?.duracionMs != null ? alternarBucle : undefined}
                        fijar={fijar}
                        finAutomatico={() =>
                          despachar({ tipo: 'fin_automatico', ahora: performance.now() })
                        }
                        escuchar={() => {
                          if (edicion.seleccion) escuchar(edicion.seleccion)
                        }}
                        borrar={borrar}
                        escucharTramo={() => {
                          if (edicion.seleccion) escucharTramoLinea(edicion.seleccion)
                        }}
                      />
                    </section>
                  ) : (
                    <aside aria-label="Estilo">
                      <PanelEstilo
                        estilo={estilo}
                        contraste={contraste}
                        soloEditor={esLetraLista}
                        inactivo={edicion.sync.activo}
                        tema={tema.control}
                        espera={controlEspera}
                        pantalla={controlPantalla}
                        subrayadoDelEquipo={subrayadoDelEquipo}
                        alCambiar={(nuevo, clave, agruparGesto) =>
                          despachar({
                            tipo: tema.editando ? 'estilo_borrador' : 'estilo',
                            estilo: nuevo,
                            clave,
                            ahora: Date.now(),
                            agruparGesto
                          })
                        }
                      />
                    </aside>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        <div className={estilos.dock}>
          {pestana !== 'estilo' && cuentas.total > 0 && (
            <Divisor {...propsDivisor('dock')} className={estilos.franjaDock} />
          )}
          <div ref={refDock} className={estilos.cajaDock}>
            <div ref={refTransporte}>
              {audio?.error && (
                <AvisoEnLinea
                  tipo="error"
                  accion={
                    <Boton onClick={() => ir({ tipo: 'biblioteca' })}>{E.verBiblioteca}</Boton>
                  }
                >
                  {E.errorAudio}
                </AvisoEnLinea>
              )}
              <Transporte
                estado={audio}
                posicionMs={posicion}
                duracionMs={duracionMs}
                letra={letra}
                separacion={separacion}
                volumen={volumen.volumen}
                silenciado={volumen.silenciado}
                usarPista={usarPista}
                reproducir={alternar}
                buscar={buscar}
                fijarVelocidad={(v) => motor?.fijarVelocidad(v)}
                fijarVolumen={(v) =>
                  volumen.cambiar({ volumen: v, silenciado: volumen.silenciado })
                }
                alternarSilencio={() =>
                  volumen.cambiar({ volumen: volumen.volumen, silenciado: !volumen.silenciado })
                }
                entrarSync={entrarSync}
                refSync={refSync}
                acciones={
                  <>
                    {resumen.estado === 'borrador' ? (
                      <BotonLetraLista
                        resumen={resumen}
                        cancion={cancion}
                        letra={letra}
                        separacion={separacion}
                        omitirAviso={omitirAvisoLL}
                        alOmitirAviso={() => setOmitirAvisoLL(true)}
                        vaciar={vaciar}
                        alEnfocarPrimera={irAPrimeraSinInicio}
                        revision={avisoPendientes}
                      />
                    ) : (
                      <BotonCambiarModalidad
                        destino={esLetraLista ? 'karaoke' : 'letra_lista'}
                        resumen={resumen}
                        letra={letra}
                        omitirAviso={omitirAvisoLL}
                        alOmitirAviso={() => setOmitirAvisoLL(true)}
                        vaciar={vaciar}
                        alEnfocarPrimera={irAPrimeraSinInicio}
                        primeraPulsacionIncompleta={primeraPulsacionIncompleta}
                      />
                    )}
                    <BotonLista
                      resumen={resumen}
                      letra={letra}
                      separacion={separacion}
                      vaciar={vaciar}
                      alEnfocarPrimera={irAPrimeraSinInicio}
                      primeraPulsacionIncompleta={primeraPulsacionIncompleta}
                      revision={avisoPendientes}
                      resaltado={revision.resaltarDock}
                    />
                  </>
                }
                sincronizando={edicion.sync.activo}
              />
            </div>
            {pestana !== 'estilo' && cuentas.total > 0 && (
              <div ref={refExtraSync}>
                {edicion.sync.activo && (
                  <BannerSincronizar
                    siguiente={
                      siguiente
                        ? E.syncSiguiente(
                            siguiente.texto,
                            numeroDeLinea(letra, siguiente.id),
                            cuentas.total
                          )
                        : null
                    }
                    sonando={sonando}
                    contando={sync.cuentaAtras !== null}
                    hayMarca={sync.hayMarca}
                    pronto={sync.pronto}
                    marcar={(ts) => sync.marcar(ts, 'puntero')}
                    soltar={(ts) => sync.soltar(ts, 'puntero')}
                    deshacer={sync.deshacer}
                    alternar={sync.alternar}
                    terminar={sync.terminar}
                  />
                )}
                <PistaSincronia
                  botonSilencios={
                    <BotonAjustarSilencios
                      motivos={motivosAjuste}
                      ritmo={edicion.sync.activo}
                      buscando={silencios.buscando}
                      alPulsar={() => {
                        cerrarAplicandoPreciso()
                        void silencios.pedir()
                      }}
                      alReintentar={picos.reintentar}
                      alIrAPrimera={irAPrimeraSinInicio}
                    />
                  }
                  resaltadas={silencios.resaltadas}
                  resaltadasDesfase={comprobar.resaltadas}
                  dudosas={marcasRevision}
                  zoomRevision={zoomRevision}
                  onda={(vista) => (
                    <PistaOndaVoz
                      cancionId={id}
                      vista={vista}
                      separada={separacion.disponible}
                      {...picos}
                    />
                  )}
                  ondaGeneral={
                    picos.estado.estado === 'lista' && (
                      <LienzoPicosVoz
                        cancionId={id}
                        generacion={picos.estado.generacion}
                        inicioMs={0}
                        finMs={duracionMs}
                        general
                      />
                    )
                  }
                  letra={gestoVisible?.resultado?.letra ?? letraConBorrador}
                  seleccion={edicion.seleccion}
                  duracionMs={duracionMs}
                  inactiva={edicion.sync.activo}
                  minimizada={lineaTiempoMinimizada}
                  expandirNoDisponible={
                    edicion.sync.activo
                      ? E.syncTitulo
                      : distribucion.lineaTiempo.minimizadoPorEspacio
                        ? E.layout.timeline.sinEspacio
                        : undefined
                  }
                  alternarMinimizada={() => alternarZona('linea_tiempo', 'boton')}
                  sonando={sonando}
                  posicionMs={posicion}
                  obtenerTiempoAudio={obtenerTiempoAudio}
                  buscar={buscar}
                  seleccionar={seleccionar}
                  escucharLinea={(id) => escucharTramoLinea(id, true)}
                  ocupadaId={precisoId}
                  iniciarMarcador={(borde) => {
                    const gesto = iniciarGestoMarcador(edicion, borde, duracionMs)
                    if (!gesto) return false
                    gestoActual.current = gesto
                    setGestoVisible(gesto)
                    return true
                  }}
                  moverMarcador={(ms) => {
                    const actual = gestoActual.current
                    if (!actual || !gestoMarcadorVigente(edicion, actual)) return
                    const gesto = moverGestoMarcador(actual, ms)
                    gestoActual.current = gesto
                    setGestoVisible(gesto)
                    aplicarLimitesBucle(gesto.resultado?.letra ?? letra, true)
                  }}
                  terminarMarcador={(confirmar) => {
                    const gesto = gestoActual.current
                    if (!gesto) return
                    if (!confirmar || !gestoMarcadorVigente(edicion, gesto)) {
                      cancelarMarcador()
                      return
                    }
                    gestoActual.current = null
                    setGestoVisible(null)
                    cambiarTiempo(gesto.borde, {
                      tipo: 'confirmar_marcador',
                      gesto,
                      ahora: performance.now()
                    })
                    aplicarLimitesBucle(gesto.resultado?.letra ?? letra, false)
                  }}
                  ajustarMarcador={ajustar}
                  bordeArrastrado={gestoVisible?.borde}
                  limite={
                    gestoVisible?.resultado?.limite
                      ? textoLimite(
                          gestoVisible.resultado.limite,
                          letra.lineas
                            .slice(letra.lineas.findIndex((l) => l.id === gestoVisible.id) + 1)
                            .find((l) => l.inicio_ms !== null)?.tipo === 'pausa'
                        )
                      : null
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
      {precisoId !== null && motor && (
        <EditorPreciso
          ref={refPreciso}
          letra={letra}
          lineaId={precisoId}
          duracionMs={duracionMs}
          cancionId={id}
          separada={separacion.disponible}
          numeroLinea={numeroDeLinea(letra, precisoId)}
          totalLineas={cuentas.total}
          hayAnterior={vecinaConInicio(letra, precisoId, -1) !== null}
          haySiguiente={vecinaConInicio(letra, precisoId, 1) !== null}
          motor={motor}
          margenMs={preferencias.preciso?.margen_ms ?? 500}
          alCambiarMargen={(ms) =>
            actualizarPaneles(
              {
                ...preferencias,
                preciso: { geometria: preferencias.preciso?.geometria ?? null, margen_ms: ms }
              },
              'inmediato'
            )
          }
          limites={areasPreciso.limites}
          referencia={areasPreciso.referencia}
          preferencia={preferencias.preciso?.geometria ?? null}
          alCambiarPreferencia={(g: Geometria) =>
            actualizarPaneles(
              {
                ...preferencias,
                preciso: { geometria: g, margen_ms: preferencias.preciso?.margen_ms ?? 500 }
              },
              'inmediato'
            )
          }
          alSalirDelFoco={enfocarLista}
          alAplicar={(c: CambiosPreciso) =>
            despachar({
              tipo: 'aplicar_preciso',
              id: precisoId,
              borrador: c.borrador,
              duracionMs,
              ahora: performance.now()
            })
          }
          alCerrar={cerrarPreciso}
          alCambiarLinea={(sentido) => {
            const otra = vecinaConInicio(letra, precisoId, sentido)
            if (otra) {
              setPrecisoId(otra)
              despachar({ tipo: 'seleccionar', id: otra })
            }
          }}
          alElegirPista={(i) => usarPista((['original', 'voz', 'instrumental'] as const)[i - 1]!)}
          alFijarInicioAqui={() => fijar('inicio')}
          alCambiarBorrador={setBorradorPreciso}
          anunciar={anunciar}
        />
      )}
      <DialogoAtajos abierto={dialogoAtajos} cerrar={() => setDialogoAtajos(false)} />
      {silencios.abierta && (
        <DialogoAjustarSilencios
          abierta={silencios.abierta}
          duracionMs={duracionMs}
          mac={silencios.mac}
          alConfirmar={() => void silencios.confirmar()}
          alCancelar={silencios.cancelar}
        />
      )}
      {comprobar.dialogo && (
        <DialogosComprobar
          dialogo={comprobar.dialogo}
          mac={silencios.mac}
          alConfirmar={() => void comprobar.confirmar()}
          alCancelar={comprobar.cancelar}
          alIr={comprobar.ir}
          alBuscarOtra={() => {
            comprobar.cancelar()
            irABuscarOtra()
          }}
        />
      )}
      {exportarVideo.dialogo}
      {dialogoBorrador && (
        <DialogoVolverABorradorEditor
          resumen={resumen}
          alCerrar={() => setDialogoBorrador(false)}
          alVolver={() => {
            // El botón de volver a borrador desaparece: el foco va al título de su sección.
            enfocarTituloEstado.current = true
          }}
        />
      )}
      {dialogoCambioLL && (
        <DialogoLetraLista
          variante="cambio"
          alCancelar={() => setDialogoCambioLL(false)}
          alConfirmar={(omitir) => cambiarModalidad('letra_lista', omitir)}
        />
      )}
      {dialogoSalida}
      {tema.dialogos}
      {prueba && (
        <Reproductor
          origen="editor"
          modo={prueba.modo}
          desdeMs={prueba.desdeMs}
          cancion={{
            id,
            titulo: metadatos.titulo,
            artista: metadatos.artista,
            duracionMs: metadatos.duracion_ms,
            gananciaDb: cancion.fuente.ganancia_db ?? 0,
            letra,
            estilo: estiloPrevia,
            // LL8: «Probar» muestra lo que verá el público (una Letra lista, sin barrido).
            modalidad: resumen.modalidad,
            lineasSinSincronizar: 0
          }}
          volumen={volumen}
          alSalir={terminarPrueba}
        />
      )}
    </div>
  )
}
