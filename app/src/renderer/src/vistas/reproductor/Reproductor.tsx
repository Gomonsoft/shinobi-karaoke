import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'
import type { Modalidad } from '@shared/cancion'
import type { Letra } from '@shared/letra'
import type { Estilo } from '@shared/estilo'
import type { ApiReproductor } from '@shared/ipc'
import { fondoCssEn, variablesEstilo } from '../../karaoke/estiloCss'
import { useMovimientoReducido } from '../../karaoke/useMovimientoReducido'
import { PantallaLetra } from '../../karaoke/PantallaLetra'
import {
  MotorReproductor,
  type ErrorPista,
  type EstadoMotorReproductor,
  type ModoAudio,
  type OpcionesMotorReproductor
} from '../../karaoke/motorReproductor'
import type { useVolumenCompartido } from '../../karaoke/useVolumenCompartido'
import { retenerToasts } from '../../componentes/gestorToasts'
import estilosComponentes from '../../componentes/componentes.module.css'
import { accionDeTeclaReproductor, type AccionReproductor } from './atajos'
import {
  alternarVoz,
  CuentaFinal,
  formatearReloj,
  pasoVolumen,
  pasoVoz,
  posicionInicial,
  textoIncompleta,
  textoIndicador,
  VisibilidadControles
} from './modelo'
import { Controles } from './Controles'
import { IndicadorBreve } from './IndicadorBreve'
import { DialogoAtajosReproductor } from './DialogoAtajosReproductor'
import { PantallaError } from './PantallaError'
import { PantallaFinal } from './PantallaFinal'
import { R } from './textos'
import estilos from './reproductor.module.css'

export interface CancionReproductor {
  id: string
  titulo: string
  artista: string
  duracionMs: number
  gananciaDb: number
  letra: Letra
  estilo: Estilo
  /** Modalidad al empezar (R13: no cambia durante la reproducción). Por defecto `karaoke`. */
  modalidad?: Modalidad
  lineasSinSincronizar: number
}

/** Lo que el anfitrión de la secundaria puede pedirle al reproductor de la sesión. */
export interface ControlSesion {
  pausar(): void
  reanudar(): void
  reiniciar(): void
}

/** Informe del motor; `AppSecundaria` le añade `sesionId` y `entradaId` (ADR 0017 §7). */
export type InformeMotor =
  | { tipo: 'lista' }
  | { tipo: 'reproduciendo' | 'pausada' | 'fin' | 'posicion'; posicionMs: number }
  | {
      tipo: 'error'
      error: {
        motivo: 'no_encontrada' | 'lectura' | 'decodificacion'
        pista: 'instrumental' | 'voz'
      }
    }

/** Propiedades propias de `origen: 'sesion'` (ventana secundaria, ADR 0017 §10). */
export interface PropsSesionReproductor {
  /** `cargar` con `pausada`: carga y espera en el segundo indicado. */
  pausada: boolean
  anuncio: 'inicio' | 'reanudacion'
  /** `false`: no se antepone el silencio previo (p. ej. al reanudar). */
  silencioPrevio: boolean
  hayPendientes: boolean
  /** La ventana de la secundaria (allí no existe `window.shinobi`). */
  ventana: ApiReproductor['ventana']
  /** El anfitrión lo usa para `pausar`, `reanudar` y `reiniciar`. */
  control: RefObject<ControlSesion | null>
  informar(informe: InformeMotor): void
  alSiguiente(): void
  alCerrar(): void
}

export interface PropsReproductor {
  cancion: CancionReproductor
  origen: 'biblioteca' | 'editor' | 'sesion'
  modo: ModoAudio
  desdeMs: number
  volumen: ReturnType<typeof useVolumenCompartido>
  alSalir(r: { posicionMs: number }): void
  alFallarPista?(e: { pista: 'principal' | 'voz'; tipo: ErrorPista }): void
  crearMotor?: (o: OpcionesMotorReproductor) => MotorReproductor
  /** Obligatorio con `origen: 'sesion'`. */
  sesion?: PropsSesionReproductor
}

function ignorarError(peticion: Promise<unknown>): void {
  void peticion.catch(() => undefined)
}

export function Reproductor({
  cancion,
  origen,
  modo,
  desdeMs,
  volumen,
  alSalir,
  alFallarPista,
  crearMotor,
  sesion
}: PropsReproductor) {
  const raiz = useRef<HTMLDivElement>(null)
  const motor = useRef<MotorReproductor | null>(null)
  const visibilidad = useRef<VisibilidadControles | null>(null)
  const cuentaFinal = useRef<CuentaFinal | null>(null)
  const finInformado = useRef(false)
  const saliendo = useRef(false)
  const inicioPendiente = useRef<number | null>(null)
  const autoplayCancelado = useRef(false)
  const volverAlInicio = useRef(false)
  const indicadorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [estado, setEstado] = useState<EstadoMotorReproductor | null>(null)
  const [controlesVisibles, setControlesVisibles] = useState(true)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [cargaLarga, setCargaLarga] = useState(false)
  const [posicionBarra, setPosicionBarra] = useState(0)
  const [indicador, setIndicador] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  // La modalidad se toma al empezar: un cambio en el editor se ve en la siguiente reproducción.
  const [barrido] = useState(cancion.modalidad !== 'letra_lista')
  const movimientoReducido = useMovimientoReducido()
  const [atajosAbiertos, setAtajosAbiertos] = useState(false)
  const [restante, setRestante] = useState<number | null>(null)
  const [controlesFinal, setControlesFinal] = useState(false)
  const esSesion = origen === 'sesion' && sesion !== undefined
  const listo = estado?.listo ?? false
  const sonando = estado?.sonando ?? false
  const finalizado = estado?.finalizado ?? false
  const errorPrincipal = estado?.errorPrincipal ?? null
  const vozDisponible = modo === 'karaoke' && (estado?.vozDisponible ?? false)
  const aviso =
    origen === 'biblioteca' && cancion.lineasSinSincronizar > 0
      ? textoIncompleta(cancion.lineasSinSincronizar)
      : null
  const avisoSinIcono = aviso?.replace(/^⚠ /, '') ?? null
  const mostrarControles = controlesVisibles && (esSesion || !finalizado || controlesFinal)
  const duracionMs = estado?.duracionMs ?? cancion.duracionMs
  const tiempoAudio = useCallback(() => motor.current?.posicionMs() ?? 0, [])
  const opcionesIniciales = useEffectEvent(() => ({
    cancionId: cancion.id,
    modo,
    gananciaDb: cancion.gananciaDb,
    volumen: volumen.volumen,
    silenciado: volumen.silenciado,
    volumenVoz: volumen.volumenVoz,
    vozSilenciada: volumen.vozSilenciada
  }))
  const inicioInicial = useEffectEvent(() =>
    sesion && !sesion.silencioPrevio ? desdeMs : posicionInicial(origen, desdeMs, cancion.letra)
  )
  const informar = useEffectEvent((informe: InformeMotor) => sesion?.informar(informe))
  const posicionAhora = useEffectEvent(() => Math.round(motor.current?.posicionMs() ?? 0))
  const fabricar = useEffectEvent(
    (o: OpcionesMotorReproductor) => crearMotor?.(o) ?? new MotorReproductor(o)
  )
  const alFinalizarCuenta = useEffectEvent(() => salir())
  /** Informes a main y anuncios de la secundaria (sin pantalla final ni cuenta de cierre). */
  const procesarEstadoSesion = useEffectEvent(
    (actual: EstadoMotorReproductor, previo: EstadoMotorReproductor, yaEmpezo: boolean) => {
      const s = sesion!
      if (actual.errorPrincipal && !previo.errorPrincipal) {
        informar({
          tipo: 'error',
          error: { motivo: actual.errorPrincipal.tipo, pista: 'instrumental' }
        })
      }
      if (actual.listo && !previo.listo) {
        informar({ tipo: 'lista' })
        if (s.anuncio === 'reanudacion') {
          const mmss = formatearReloj(Math.max(0, posicionAhora()))
          setIndicador(R.cola.reanudada(mmss))
          clearTimeout(indicadorTimer.current)
          indicadorTimer.current = setTimeout(() => setIndicador(null), 2000)
          setAnuncio(R.cola.aria.reanudada(mmss))
        }
      }
      if (actual.finalizado && !previo.finalizado) {
        // Un solo `fin` aunque el motor repita estados con `finalizado: true`.
        if (!finInformado.current) {
          finInformado.current = true
          informar({ tipo: 'fin', posicionMs: Math.round(actual.duracionMs ?? 0) })
        }
      } else if (actual.sonando && !previo.sonando) {
        informar({ tipo: 'reproduciendo', posicionMs: posicionAhora() })
        if (s.anuncio === 'inicio' && !yaEmpezo) {
          setAnuncio(R.aria.inicio(cancion.titulo, cancion.artista))
        } else if (yaEmpezo) {
          setAnuncio(R.aria.reanudacion)
        }
      } else if (previo.sonando && !actual.sonando && !actual.errorPrincipal) {
        informar({ tipo: 'pausada', posicionMs: posicionAhora() })
        setAnuncio(R.pausa)
      }
      if (!actual.finalizado && previo.finalizado) finInformado.current = false
    }
  )
  const procesarEstado = useEffectEvent(
    (actual: EstadoMotorReproductor, previo: EstadoMotorReproductor, yaEmpezo: boolean) => {
      if (actual.errorPrincipal && !previo.errorPrincipal) {
        alFallarPista?.({ pista: 'principal', tipo: actual.errorPrincipal.tipo })
      }
      if (actual.errorVoz && !previo.errorVoz) {
        alFallarPista?.({ pista: 'voz', tipo: actual.errorVoz.tipo })
      }
      if (sesion) {
        procesarEstadoSesion(actual, previo, yaEmpezo)
        return
      }
      if (actual.finalizado && !previo.finalizado) {
        cuentaFinal.current?.iniciar()
        setAnuncio(`${R.aria.fin} ${R.cierre(10)}`)
      } else if (actual.sonando && !previo.sonando) {
        setAnuncio(
          yaEmpezo
            ? R.aria.reanudacion
            : [R.aria.inicio(cancion.titulo, cancion.artista), aviso].filter(Boolean).join(' ')
        )
      } else if (previo.sonando && !actual.sonando && !actual.errorPrincipal) {
        setAnuncio(R.pausa)
      }
      if (!actual.finalizado && previo.finalizado) cuentaFinal.current?.detener()
    }
  )

  useEffect(() => {
    const superficie = raiz.current!
    // En la secundaria el reproductor es todo el documento: sin `inert` ni toasts que retener.
    const inertes = esSesion
      ? []
      : [...document.body.children].filter(
          (nodo) => nodo !== superficie && !nodo.hasAttribute('inert')
        )
    for (const nodo of inertes) nodo.setAttribute('inert', '')
    superficie.focus({ preventScroll: true })
    if (!esSesion) retenerToasts(true)
    const local = sesion ? null : window.shinobi.ventana
    const ventana = sesion?.ventana ?? window.shinobi.ventana
    let montado = true
    let huboEvento = false
    const bajaPantalla = ventana.alCambiarPantallaCompleta((activa) => {
      huboEvento = true
      setPantallaCompleta(activa)
    })
    if (local) ignorarError(local.modoReproductor(true))
    ignorarError(
      ventana.estaEnPantallaCompleta().then((activa) => {
        if (montado && !huboEvento) setPantallaCompleta(activa)
      })
    )
    const control = new VisibilidadControles()
    visibilidad.current = control
    const bajaControles = control.suscribir((visible) => {
      if (!visible && superficie.contains(document.activeElement)) {
        superficie.focus({ preventScroll: true })
      }
      setControlesVisibles(visible)
    })
    const reproductor = fabricar(opcionesIniciales())
    motor.current = reproductor
    const cuenta = new CuentaFinal()
    cuentaFinal.current = esSesion ? null : cuenta
    const bajaCuenta = cuenta.suscribir(setRestante)
    const bajaFin = cuenta.alTerminar(() => alFinalizarCuenta())
    let previo = { ...reproductor.estado() }
    let yaEmpezo = previo.sonando
    const bajaMotor = reproductor.suscribir((actual) => {
      setEstado(actual)
      procesarEstado(actual, previo, yaEmpezo)
      previo = { ...actual }
      yaEmpezo ||= actual.sonando
    })
    const inicio = inicioInicial()
    inicioPendiente.current = inicio
    autoplayCancelado.current = sesion?.pausada ?? false
    const carga = setTimeout(() => setCargaLarga(true), 1000)
    ignorarError(
      reproductor.cargar().then(() => {
        clearTimeout(carga)
        if (montado && reproductor.estado().listo && !autoplayCancelado.current) {
          inicioPendiente.current = null
          return reproductor.reproducir({ desdeMs: inicio })
        }
        // Cargada en pausa (reanudación): queda en el segundo indicado.
        if (montado && sesion && reproductor.estado().listo && inicio > 0)
          reproductor.buscar(inicio)
      })
    )
    return () => {
      montado = false
      clearTimeout(carga)
      clearTimeout(indicadorTimer.current)
      bajaControles()
      control.destruir()
      bajaCuenta()
      bajaFin()
      cuenta.destruir()
      cuentaFinal.current = null
      bajaMotor()
      reproductor.destruir()
      motor.current = null
      visibilidad.current = null
      bajaPantalla()
      if (local) {
        ignorarError(local.evitarReposo(false))
        ignorarError(local.modoReproductor(false))
      }
      for (const nodo of inertes) nodo.removeAttribute('inert')
      if (!esSesion) retenerToasts(false)
    }
    // Se monta una vez por entrada: en la sesión, `AppSecundaria` remonta con `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Con la sesión, el reposo lo retiene main durante toda su vida (ADR 0017 §4).
    if (!esSesion) ignorarError(window.shinobi.ventana.evitarReposo(sonando))
  }, [esSesion, sonando, finalizado, errorPrincipal])

  // Posición a main: como mucho 2 por segundo mientras suena.
  useEffect(() => {
    if (!esSesion || !sonando) return
    const intervalo = setInterval(
      () => informar({ tipo: 'posicion', posicionMs: posicionAhora() }),
      500
    )
    return () => clearInterval(intervalo)
  }, [esSesion, sonando])

  // Volumen y voz que cambian fuera de este componente (`sesion:preferencias`).
  useEffect(() => {
    if (!esSesion) return
    motor.current?.fijarVolumen(volumen.volumen, volumen.silenciado)
    motor.current?.fijarVoz(volumen.volumenVoz, volumen.vozSilenciada)
  }, [esSesion, volumen.volumen, volumen.silenciado, volumen.volumenVoz, volumen.vozSilenciada])

  useEffect(() => {
    visibilidad.current?.fijarRetenida('pausa', listo && !sonando)
    const actualizar = () => setPosicionBarra(Math.max(0, tiempoAudio()))
    const intervalo = setInterval(actualizar, 200)
    return () => clearInterval(intervalo)
  }, [listo, sonando, tiempoAudio])

  function salir(): void {
    if (saliendo.current) return
    saliendo.current = true
    alSalir({ posicionMs: Math.max(0, tiempoAudio()) })
  }

  function mostrar(texto: typeof indicador, duracion = 600): void {
    if (!texto) return
    clearTimeout(indicadorTimer.current)
    setIndicador(texto)
    indicadorTimer.current = setTimeout(() => setIndicador(null), duracion)
  }

  function buscar(ms: number): void {
    if (finalizado && ms >= duracionMs) return
    inicioPendiente.current = null
    volverAlInicio.current = false
    motor.current?.buscar(ms)
    if (finalizado) {
      setControlesFinal(false)
      raiz.current?.focus({ preventScroll: true })
      if (motor.current) ignorarError(motor.current.reproducir())
    }
    setPosicionBarra(Math.max(0, tiempoAudio()))
    sesion?.informar({ tipo: 'posicion', posicionMs: Math.round(tiempoAudio()) })
  }

  function repetir(): void {
    const actual = motor.current
    if (!actual) return
    setControlesFinal(false)
    volverAlInicio.current = false
    raiz.current?.focus({ preventScroll: true })
    actual.buscar(0)
    setPosicionBarra(0)
    ignorarError(actual.reproducir({ desdeMs: posicionInicial(origen, 0, cancion.letra) }))
  }

  function cambiarNivel(cambio: Parameters<typeof volumen.cambiar>[0]): void {
    volumen.cambiar(cambio)
    motor.current?.fijarVolumen(
      cambio.volumen ?? volumen.volumen,
      cambio.silenciado ?? volumen.silenciado
    )
    motor.current?.fijarVoz(
      cambio.voz_guia ?? volumen.volumenVoz,
      cambio.voz_guia_silenciada ?? volumen.vozSilenciada
    )
    if (cambio.voz_guia !== undefined || cambio.voz_guia_silenciada !== undefined) {
      const silenciada = cambio.voz_guia_silenciada ?? volumen.vozSilenciada
      setAnuncio(
        silenciada
          ? R.ind.vozSilenciada
          : R.ind.voz(Math.round((cambio.voz_guia ?? volumen.volumenVoz) * 100))
      )
    } else {
      const silenciado = cambio.silenciado ?? volumen.silenciado
      setAnuncio(
        silenciado
          ? R.ind.silenciado
          : R.ind.volumen(Math.round((cambio.volumen ?? volumen.volumen) * 100))
      )
    }
  }

  function actividad(mostrarFranjas: boolean): void {
    if (finalizado) {
      cuentaFinal.current?.detener()
      if (mostrarFranjas) setControlesFinal(true)
    }
    if (mostrarFranjas) visibilidad.current?.actividad()
  }

  function actuar(accion: AccionReproductor): void {
    const actual = motor.current
    if (!actual) return
    if (errorPrincipal && accion.tipo !== 'salir' && accion.tipo !== 'cerrar') return
    const configVoz = { voz_guia: volumen.volumenVoz, voz_guia_silenciada: volumen.vozSilenciada }
    let cambio: Parameters<typeof volumen.cambiar>[0] = {}
    switch (accion.tipo) {
      case 'salir':
        salir()
        return
      case 'cerrar':
        sesion?.alCerrar()
        return
      case 'esc':
        // Nunca cierra la sesión: solo sale de la pantalla completa.
        if (pantallaCompleta) ignorarError(sesion!.ventana.fijarPantallaCompleta(false))
        return
      case 'siguiente':
        if (sesion?.hayPendientes) sesion.alSiguiente()
        else mostrar(R.cola.siguienteNo, 1500)
        return
      case 'pantalla_completa':
        ignorarError(
          (sesion?.ventana ?? window.shinobi.ventana).fijarPantallaCompleta(!pantallaCompleta)
        )
        break
      case 'alternar':
        if (!listo) return
        if (finalizado) {
          repetir()
          return
        }
        if (sonando) actual.pausar()
        else {
          const desde = volverAlInicio.current
            ? posicionInicial(origen, 0, cancion.letra)
            : (inicioPendiente.current ?? undefined)
          inicioPendiente.current = null
          volverAlInicio.current = false
          ignorarError(actual.reproducir({ desdeMs: desde }))
        }
        break
      case 'saltar':
        if (!listo) return
        buscar(Math.max(0, tiempoAudio()) + accion.deltaMs)
        break
      case 'principio':
        if (!listo) return
        if (finalizado) {
          repetir()
          return
        }
        buscar(0)
        volverAlInicio.current = !sonando
        if (sonando)
          ignorarError(actual.reproducir({ desdeMs: posicionInicial(origen, 0, cancion.letra) }))
        break
      case 'volumen':
        cambio = pasoVolumen(volumen.volumen, accion.delta)
        break
      case 'silenciar':
        cambio = { silenciado: !volumen.silenciado }
        break
      case 'voz':
        if (!vozDisponible) return
        cambio = alternarVoz(configVoz)
        break
      case 'nivel_voz':
        if (!vozDisponible) return
        cambio = pasoVoz(configVoz, accion.delta)
        break
      case 'atajos':
        // En un evento la canción sigue sonando bajo el diálogo.
        if (!esSesion) {
          autoplayCancelado.current = true
          actual.pausar()
        }
        visibilidad.current?.fijarRetenida('atajos', true)
        setAtajosAbiertos(true)
        return
    }
    if (Object.keys(cambio).length > 0) cambiarNivel(cambio)
    mostrar(
      textoIndicador(accion, {
        sonando: accion.tipo === 'alternar' ? !sonando : sonando,
        volumen: cambio.volumen ?? volumen.volumen,
        silenciado: cambio.silenciado ?? volumen.silenciado,
        volumenVoz: cambio.voz_guia ?? volumen.volumenVoz,
        vozSilenciada: cambio.voz_guia_silenciada ?? volumen.vozSilenciada
      })
    )
  }

  const actuarDesdeSesion = useEffectEvent((accion: AccionReproductor) => actuar(accion))
  useEffect(() => {
    if (!sesion) return
    const referencia = sesion.control
    referencia.current = {
      pausar: () => {
        const m = motor.current
        if (!m) return
        autoplayCancelado.current = true
        if (m.estado().sonando) m.pausar()
      },
      reanudar: () => {
        const m = motor.current
        if (!m) return
        autoplayCancelado.current = false
        const e = m.estado()
        if (e.listo && !e.sonando && !e.finalizado) actuarDesdeSesion({ tipo: 'alternar' })
      },
      reiniciar: () => actuarDesdeSesion({ tipo: 'principio' })
    }
  }, [sesion])
  useEffect(() => {
    const referencia = sesion?.control
    return () => {
      if (referencia) referencia.current = null
    }
  }, [sesion?.control])

  const alTeclear = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || raiz.current?.hasAttribute('inert')) return
    actividad(e.key === 'Tab')
    if (atajosAbiertos || (e.key === 'Escape' && raiz.current?.querySelector('[role="tooltip"]')))
      return
    if (e.key === 'Tab') {
      if (!finalizado && !errorPrincipal && !controlesVisibles) {
        e.preventDefault()
        requestAnimationFrame(() => raiz.current?.querySelector('button')?.focus())
      }
      return
    }
    const accion = accionDeTeclaReproductor(e, {
      origen,
      vozDisponible,
      focoEnBoton: e.target instanceof HTMLElement && !!e.target.closest('button')
    })
    if (!accion) return
    e.preventDefault()
    actuar(accion)
  })

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => alTeclear(e)
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [])

  const titulo = { titulo: cancion.titulo, artista: cancion.artista }
  return createPortal(
    <div
      ref={raiz}
      role={esSesion ? 'region' : 'dialog'}
      aria-modal={esSesion ? undefined : 'true'}
      aria-label={R.aria.region(cancion.titulo)}
      tabIndex={-1}
      data-pantalla-completa={String(pantallaCompleta)}
      className={`${estilos.raiz} ${mostrarControles || (finalizado && !esSesion) || errorPrincipal ? '' : estilos.sinCursor}`}
      style={
        {
          ...variablesEstilo(cancion.estilo),
          // La pantalla final se queda en la fase del último instante (movimiento reducido: fase 0).
          ...(finalizado && !esSesion
            ? {
                '--k-fondo': fondoCssEn(cancion.estilo.fondo, Math.max(0, tiempoAudio()), {
                  estatico: movimientoReducido
                })
              }
            : {})
        } as CSSProperties
      }
      onPointerMove={() => actividad(true)}
      onPointerDown={() => actividad(true)}
    >
      {errorPrincipal && !esSesion ? (
        <PantallaError
          error={errorPrincipal}
          modo={modo}
          origen={origen as 'biblioteca' | 'editor'}
          alSalir={salir}
        />
      ) : finalizado && !esSesion ? (
        <PantallaFinal
          {...titulo}
          origen={origen as 'biblioteca' | 'editor'}
          restante={restante}
          alRepetir={repetir}
          alSalir={salir}
        />
      ) : (
        <PantallaLetra
          {...titulo}
          className={estilos.letra}
          estilo={cancion.estilo}
          letra={listo ? cancion.letra : { ...cancion.letra, lineas: [] }}
          duracionMs={duracionMs}
          obtenerTiempoAudio={listo ? tiempoAudio : undefined}
          barrido={barrido}
          alAnunciarEspera={(segundos) => setAnuncio(R.espera.aria(segundos))}
          reproduciendo
          avisoTitulo={esSesion ? undefined : (avisoSinIcono ?? undefined)}
          cargando={!listo && cargaLarga}
          textoCargando={R.cargando}
        />
      )}
      {modo === 'original' && !errorPrincipal && (
        <span className={`${estilos.pildora} ${estilos.original}`}>{R.original}</span>
      )}
      {!errorPrincipal && (
        <Controles
          {...titulo}
          aviso={esSesion ? null : avisoSinIcono}
          listo={listo}
          sonando={sonando}
          pantallaCompleta={pantallaCompleta}
          visible={mostrarControles}
          posicionMs={posicionBarra}
          duracionMs={duracionMs}
          vozDisponible={vozDisponible}
          modo={modo}
          volumen={volumen}
          actuar={actuar}
          buscar={buscar}
          cambiarNivel={cambiarNivel}
          retener={(motivo, activa) => visibilidad.current?.fijarRetenida(motivo, activa)}
          sesion={sesion && { hayPendientes: sesion.hayPendientes }}
        />
      )}
      {!errorPrincipal && <IndicadorBreve texto={indicador} />}
      <div className={estilosComponentes.soloLector} aria-live="polite" aria-atomic="true">
        {anuncio}
      </div>
      <DialogoAtajosReproductor
        abierto={atajosAbiertos}
        vozDisponible={vozDisponible}
        sesion={esSesion}
        alCerrar={() => {
          setAtajosAbiertos(false)
          visibilidad.current?.fijarRetenida('atajos', false)
        }}
      />
    </div>,
    document.body
  )
}
