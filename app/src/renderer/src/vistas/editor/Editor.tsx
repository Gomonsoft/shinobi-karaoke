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
import { Maximize, X } from 'lucide-react'
import type { Cancion } from '@shared/cancion'
import type { Config } from '@shared/config'
import type { ResumenCancionIpc } from '@shared/ipc'
import { finEfectivo, type Letra } from '@shared/letra'
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
import { avisarBorradorAlSalir, BotonLista, DialogoVolverABorradorEditor } from './BotonLista'
import { DialogoAtajos } from './DialogoAtajos'
import { ListaLineas } from './ListaLineas'
import { PanelEstilo } from './PanelEstilo'
import { PanelSincronia, mostrarAyudaBluetooth, textoLimite } from './PanelSincronia'
import { PistaSincronia } from './PistaSincronia'
import { recortarIntervalo, crearVistaLineaTiempo, type IntervaloTiempo } from './lineaTiempo'
import { Transporte, type SeparacionEditor } from './Transporte'
import { EscuchaComprobacion } from './escuchaComprobacion'
import {
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
import { useGuardadoEditor } from './useGuardadoEditor'
import { useSincronizarAlRitmo } from './useSincronizarAlRitmo'
import estilos from './editor.module.css'

type Carga = { cancion: Cancion; config: Config; resumen: ResumenCancionIpc }
type Pestana = 'sincronia' | 'estilo'
const VACIA: Letra = { origen: 'manual', lrclib_id: null, offset_ms: 0, lineas: [] }

function seleccionarInicial(letra: Letra): string | null {
  return primeraSinInicio(letra) ?? lineaVecina(letra, null, 1)
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
  const { ir } = useNavegacion()
  const [carga, setCarga] = useState<Carga | 'error' | null>(null)
  const sesion = useRef<string | null>(null)
  const generacion = useRef(0)
  const [resumenVivo, setResumenVivo] = useState<ResumenCancionIpc | null>(null)

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
        else setResumenVivo(evento.resumen)
      }
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
      const token = sesion.current
      sesion.current = null
      if (token) void api.letras.cerrarEdicion(token).catch(() => undefined)
    }
  }, [id, leerVisita])

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
    />
  )
}

interface PropsActiva {
  carga: Carga
  resumen: ResumenCancionIpc
  leerVisita(): Promise<Cancion | null>
  obtenerSesion(): string | null
}

type EscuchaEditor = { pista: Pista; velocidad: Velocidad }
type Prueba = EscuchaEditor & {
  desdeMs: number
  modo: PropsReproductor['modo']
  grupo: string
}

function EditorActivo({ carga, resumen, leerVisita, obtenerSesion }: PropsActiva) {
  const { cancion, config } = carga
  const { id, metadatos } = cancion
  const { ir } = useNavegacion()
  const { trabajos, progreso } = useTrabajosVivos()
  const letraInicial = cancion.letra ?? VACIA
  const [edicion, despachar] = useReducer(reducirEditor, null, () =>
    estadoInicial({ letra: letraInicial, estilo: cancion.estilo }, seleccionarInicial(letraInicial))
  )
  const { letra, estilo } = edicion.actual
  const cuentas = contador(letra)
  const [pestana, setPestana] = useState<Pestana>('sincronia')
  const [estiloPredeterminado, setEstiloPredeterminado] = useState(config.estilo_predeterminado)
  const contraste = useMemo(() => evaluarContraste(estilo), [estilo])
  const [dialogoAtajos, setDialogoAtajos] = useState(false)
  const [dialogoBorrador, setDialogoBorrador] = useState(false)
  const [prueba, setPrueba] = useState<Prueba | null>(null)
  const abrirPendiente = useRef<AbortController | null>(null)
  const vuelta = useRef<(EscuchaEditor & { posicionMs: number }) | null>(null)
  const refProbar = useRef<HTMLButtonElement>(null)
  const [revisionSeleccion, setRevisionSeleccion] = useState(0)
  const [focoLinea, setFocoLinea] = useState(() =>
    contador(letraInicial).sincronizadas > 0 ? 1 : 0
  )
  const refSync = useRef<HTMLButtonElement>(null)
  const focoInicialSync = useRef(contador(letraInicial).sincronizadas === 0)
  const [cerradoYaSync, setCerradoYaSync] = useState(false)
  const [posicion, setPosicion] = useState(0)
  const [gestoVisible, setGestoVisible] = useState<GestoMarcador | null>(null)
  const gestoActual = useRef<GestoMarcador | null>(null)
  const [bucleArmado, setBucleArmado] = useState(false)
  const bucle = useRef<{ previa: number; sonaba: boolean | null } | null>(null)
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
    for (const id of aviso.palabrasDescartadas) {
      if (letra.lineas.some((el) => el.id === id && el.tipo === 'linea')) {
        mostrarToast({ tipo: 'aviso', mensaje: E.toastPalabras(numeroDeLinea(letra, id)), accion })
      }
    }
    for (const id of aviso.finesAutomaticos) {
      if (letra.lineas.some((el) => el.id === id && el.tipo === 'linea')) {
        mostrarToast({ tipo: 'info', mensaje: E.toastFinAuto(numeroDeLinea(letra, id)), accion })
      }
    }
    // Un aviso solo se anuncia una vez, aunque el usuario siga editando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicion.aviso])

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
    desarmarBucle()
    cancelarMarcador()
    escucha?.cancelar()
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
    cambiarEstilo,
    vaciar,
    confirmarSinGuardar,
    dialogoSalida
  } = useGuardadoEditor(
    id,
    metadatos.titulo,
    obtenerSesion,
    async () => {
      desarmarBucle()
      cancelarMarcador()
      motor?.pausar()
      const actual = await leerVisita()
      const nueva = actual?.letra ?? VACIA
      const seleccion = nueva.lineas.some((l) => l.id === edicion.seleccion && l.tipo === 'linea')
        ? edicion.seleccion
        : seleccionarInicial(nueva)
      despachar({ tipo: 'cargar', instantanea: { letra: nueva, estilo }, seleccion })
      mostrarToast({ tipo: 'aviso', mensaje: E.recargada, persistente: true })
    },
    (destino) => avisarBorradorAlSalir(destino, resumen.estado, edicion.cambiosEnVisita)
  )
  const previa = useRef(edicion.actual)
  useEffect(() => {
    const ultima = previa.current
    previa.current = edicion.actual
    if (edicion.version === 0) return
    if (ultima.letra !== letra) cambiarLetra(letra)
    if (ultima.estilo !== estilo) cambiarEstilo(estilo)
  }, [edicion.actual, edicion.version, letra, estilo, cambiarLetra, cambiarEstilo])

  const probarInactivo = edicion.sync.activo || Boolean(audio?.error)
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
        modo: separacion.disponible ? 'karaoke' : 'original',
        grupo: crypto.randomUUID()
      }
    }
  })

  async function abrirPrueba(): Promise<void> {
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
  const desplazar = (deltaMs: number) =>
    despachar({ tipo: 'desplazar', deltaMs, ahora: performance.now() })
  const borrar = () => despachar({ tipo: 'borrar_tiempos', ahora: performance.now() })

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
        case 'mover_seleccion': {
          const id = lineaVecina(letra, edicion.seleccion, accion.sentido)
          if (id && id !== edicion.seleccion) {
            desarmarBucle()
            cancelarMarcador()
          }
          despachar(accion)
          setPestana('sincronia')
          setFocoLinea((n) => n + 1)
          break
        }
        case 'deshacer':
          despachar({ tipo: 'deshacer' })
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
        case 'desplazar':
          desplazar(accion.deltaMs)
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
        case 'entrar_sync':
          entrarSync()
          break
        case 'marcar':
          sync.marcar(evento.timeStamp, 'teclado')
          break
        case 'deshacer_marca':
          sync.deshacer()
          break
        case 'escapar':
          if (cancelarMarcador()) break
          if (bucle.current) {
            desarmarBucle()
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

  const irALetra = () => ir({ tipo: 'cancion', id, paso: 'letra' })
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
  const siguiente = letra.lineas.find((el) => el.id === edicion.sync.siguiente)
  const todasAlEntrar = contador(letraInicial).sincronizadas === contador(letraInicial).total
  const banner =
    cuentas.sincronizadas === 0 ? (
      <AvisoEnLinea tipo="info">{E.sinSync}</AvisoEnLinea>
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
    <div className={estilos.editor} data-pestana={pestana}>
      <a
        className="saltar-al-contenido"
        href="#lineas-editor"
        onClick={(e) => {
          e.preventDefault()
          setPestana('sincronia')
          setFocoLinea((n) => n + 1)
        }}
      >
        Saltar al contenido
      </a>
      <h1 className={estilos.soloLector}>Editor</h1>
      <span className={estilos.soloLector} aria-live="polite">
        {sync.anuncio}
      </span>
      <header role="banner">
        <CabeceraCancion
          resumen={resumen}
          actual="editor"
          guardado={guardado}
          incompleta={cuentas.total - cuentas.sincronizadas}
          historial={{
            puedeDeshacer: puedeDeshacer(edicion),
            puedeRehacer: puedeRehacer(edicion),
            alDeshacer: () => despachar({ tipo: 'deshacer' }),
            alRehacer: () => despachar({ tipo: 'rehacer' })
          }}
          menu={[
            { id: 'atajos', etiqueta: E.menuAtajos, alSeleccionar: () => setDialogoAtajos(true) },
            ...(resumen.estado === 'lista'
              ? [
                  {
                    id: 'borrador',
                    etiqueta: E.menuBorrador,
                    alSeleccionar: () => setDialogoBorrador(true)
                  }
                ]
              : [])
          ]}
        />
      </header>
      {cuentas.total === 0 ? (
        <AvisoEnLinea tipo="info" accion={<Boton onClick={irALetra}>{E.buscarLetra}</Boton>}>
          {E.sinLetra}
        </AvisoEnLinea>
      ) : (
        <div className={estilos.cuerpo}>
          <ListaLineas
            letra={letra}
            seleccion={edicion.seleccion}
            actual={sonando ? indiceLineaActual(letra, posicion) : -1}
            foco={focoLinea}
            revisionSeleccion={revisionSeleccion}
            seleccionar={seleccionar}
            escuchar={escuchar}
            corregir={irALetra}
            banner={banner}
          />
          <section
            className={estilos.previa}
            aria-label={E.previa}
            aria-describedby="descripcion-previa"
          >
            <h2>{E.previa}</h2>
            <p id="descripcion-previa" className={estilos.soloLector}>
              {E.previaAria}
            </p>
            <div className={estilos.pantalla}>
              <PantallaLetra
                letra={gestoVisible?.resultado?.letra ?? letra}
                estilo={estilo}
                duracionMs={duracionMs}
                titulo={metadatos.titulo}
                artista={metadatos.artista}
                idEstatico={edicion.seleccion}
                reproduciendo={sonando}
                cuentaAtras={sync.cuentaAtras}
                obtenerTiempoAudio={obtenerTiempoAudio}
              />
            </div>
            <div className={estilos.accionPrueba}>
              {cuentas.sincronizadas > 0 ? (
                <Tooltip contenido={E.probarTooltip}>{botonProbar}</Tooltip>
              ) : (
                botonProbar
              )}
            </div>
          </section>
          <div className={estilos.pestanas} data-foco-editor="segmentado">
            <ControlSegmentado
              etiqueta="Panel del editor"
              valor={pestana}
              opciones={[
                { valor: 'sincronia', etiqueta: 'Sincronía' },
                {
                  valor: 'estilo',
                  etiqueta: 'Estilo',
                  aviso: contraste.avisos.length > 0 ? 'Hay avisos de contraste' : undefined,
                  noDisponible: edicion.sync.activo ? E.syncTitulo : undefined
                }
              ]}
              onCambio={(panel) => {
                cancelarMarcador()
                setPestana(panel)
              }}
            />
          </div>
          <div className={estilos.panel}>
            {pestana === 'sincronia' ? (
              <section aria-label="Ajuste de sincronía">
                <PanelSincronia
                  edicion={edicion}
                  duracionMs={duracionMs}
                  ayudaBluetooth={ayudaBluetooth}
                  cerrarBluetooth={() => setAyudaBluetooth(false)}
                  escucharAjustes={escucharAjustes}
                  fijarEscucharAjustes={setEscucharAjustes}
                  bucle={bucleArmado}
                  motivoBucle={
                    !letra.lineas.some((l) => l.id === edicion.seleccion && l.inicio_ms !== null)
                      ? E.timeline.sinInicio
                      : !intervaloDeSeleccion(letra)
                        ? E.timeline.fuera
                        : undefined
                  }
                  alternarBucle={audio?.duracionMs != null ? alternarBucle : undefined}
                  fijar={fijar}
                  finAutomatico={() =>
                    despachar({ tipo: 'fin_automatico', ahora: performance.now() })
                  }
                  escuchar={() => {
                    if (edicion.seleccion) escuchar(edicion.seleccion)
                  }}
                  borrar={borrar}
                  desplazar={desplazar}
                  fijarDesplazamiento={(ms) =>
                    despachar({ tipo: 'fijar_desplazamiento', ms, ahora: performance.now() })
                  }
                />
              </section>
            ) : (
              <aside aria-label="Estilo">
                <PanelEstilo
                  estilo={estilo}
                  predeterminado={estiloPredeterminado}
                  contraste={contraste}
                  inactivo={edicion.sync.activo}
                  alCambiar={(nuevo, clave, agruparGesto) =>
                    despachar({
                      tipo: 'estilo',
                      estilo: nuevo,
                      clave,
                      ahora: Date.now(),
                      agruparGesto
                    })
                  }
                  alCambiarPredeterminado={setEstiloPredeterminado}
                />
              </aside>
            )}
          </div>
        </div>
      )}
      {audio?.error && (
        <AvisoEnLinea
          tipo="error"
          accion={<Boton onClick={() => ir({ tipo: 'biblioteca' })}>{E.verBiblioteca}</Boton>}
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
        fijarVolumen={(v) => volumen.cambiar({ volumen: v, silenciado: volumen.silenciado })}
        alternarSilencio={() =>
          volumen.cambiar({ volumen: volumen.volumen, silenciado: !volumen.silenciado })
        }
        entrarSync={entrarSync}
        refSync={refSync}
        acciones={
          <BotonLista
            resumen={resumen}
            letra={letra}
            separacion={separacion}
            vaciar={vaciar}
            alEnfocarPrimera={() => {
              const primera = primeraSinInicio(letra)
              if (primera) seleccionar(primera, true)
            }}
          />
        }
        bannerSync={
          edicion.sync.activo ? (
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
          ) : undefined
        }
      />
      {pestana === 'sincronia' && cuentas.total > 0 && (
        <PistaSincronia
          letra={gestoVisible?.resultado?.letra ?? letra}
          seleccion={edicion.seleccion}
          duracionMs={duracionMs}
          inactiva={edicion.sync.activo}
          sonando={sonando}
          posicionMs={posicion}
          obtenerTiempoAudio={obtenerTiempoAudio}
          buscar={buscar}
          seleccionar={seleccionar}
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
      )}
      <DialogoAtajos abierto={dialogoAtajos} cerrar={() => setDialogoAtajos(false)} />
      {dialogoBorrador && (
        <DialogoVolverABorradorEditor
          resumen={resumen}
          alCerrar={() => setDialogoBorrador(false)}
        />
      )}
      {dialogoSalida}
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
            estilo,
            lineasSinSincronizar: 0
          }}
          volumen={volumen}
          alSalir={terminarPrueba}
          alDesplazar={(deltaMs) =>
            despachar({ tipo: 'desplazar', deltaMs, ahora: performance.now(), grupo: prueba.grupo })
          }
        />
      )}
    </div>
  )
}
