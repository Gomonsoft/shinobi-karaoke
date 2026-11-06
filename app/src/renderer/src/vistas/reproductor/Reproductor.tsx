import { useCallback, useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { Letra } from '@shared/letra'
import type { Estilo } from '@shared/estilo'
import { OFFSET_MAXIMO_MS } from '@shared/letrasBusqueda'
import { variablesEstilo } from '../../karaoke/estiloCss'
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
import { E } from '../editor/textos'
import { accionDeTeclaReproductor, type AccionReproductor } from './atajos'
import {
  alternarVoz,
  CuentaFinal,
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
  lineasSinSincronizar: number
}

export interface PropsReproductor {
  cancion: CancionReproductor
  origen: 'biblioteca' | 'editor'
  modo: ModoAudio
  desdeMs: number
  volumen: ReturnType<typeof useVolumenCompartido>
  alSalir(r: { posicionMs: number }): void
  alDesplazar?(deltaMs: 100 | -100): void
  alFallarPista?(e: { pista: 'principal' | 'voz'; tipo: ErrorPista }): void
  crearMotor?: (o: OpcionesMotorReproductor) => MotorReproductor
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
  alDesplazar,
  alFallarPista,
  crearMotor
}: PropsReproductor) {
  const raiz = useRef<HTMLDivElement>(null)
  const motor = useRef<MotorReproductor | null>(null)
  const visibilidad = useRef<VisibilidadControles | null>(null)
  const cuentaFinal = useRef<CuentaFinal | null>(null)
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
  const [indicador, setIndicador] = useState<string | { fueraDeRango: boolean } | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [atajosAbiertos, setAtajosAbiertos] = useState(false)
  const [restante, setRestante] = useState<number | null>(null)
  const [controlesFinal, setControlesFinal] = useState(false)
  const listo = estado?.listo ?? false
  const sonando = estado?.sonando ?? false
  const finalizado = estado?.finalizado ?? false
  const errorPrincipal = estado?.errorPrincipal ?? null
  const vozDisponible = modo === 'karaoke' && (estado?.vozDisponible ?? false)
  const puedeDesplazar = origen === 'editor' && alDesplazar !== undefined
  const aviso =
    origen === 'biblioteca' && cancion.lineasSinSincronizar > 0
      ? textoIncompleta(cancion.lineasSinSincronizar)
      : null
  const avisoSinIcono = aviso?.replace(/^⚠ /, '') ?? null
  const mostrarControles = controlesVisibles && (!finalizado || controlesFinal)
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
  const inicioInicial = useEffectEvent(() => posicionInicial(origen, desdeMs, cancion.letra))
  const fabricar = useEffectEvent(
    (o: OpcionesMotorReproductor) => crearMotor?.(o) ?? new MotorReproductor(o)
  )
  const alFinalizarCuenta = useEffectEvent(() => salir())
  const procesarEstado = useEffectEvent(
    (actual: EstadoMotorReproductor, previo: EstadoMotorReproductor, yaEmpezo: boolean) => {
      if (actual.errorPrincipal && !previo.errorPrincipal) {
        alFallarPista?.({ pista: 'principal', tipo: actual.errorPrincipal.tipo })
      }
      if (actual.errorVoz && !previo.errorVoz) {
        alFallarPista?.({ pista: 'voz', tipo: actual.errorVoz.tipo })
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
    const inertes = [...document.body.children].filter(
      (nodo) => nodo !== superficie && !nodo.hasAttribute('inert')
    )
    for (const nodo of inertes) nodo.setAttribute('inert', '')
    superficie.focus({ preventScroll: true })
    retenerToasts(true)
    const ventana = window.shinobi.ventana
    let montado = true
    let huboEvento = false
    const bajaPantalla = ventana.alCambiarPantallaCompleta((activa) => {
      huboEvento = true
      setPantallaCompleta(activa)
    })
    ignorarError(ventana.modoReproductor(true))
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
    cuentaFinal.current = cuenta
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
    const carga = setTimeout(() => setCargaLarga(true), 1000)
    ignorarError(
      reproductor.cargar().then(() => {
        clearTimeout(carga)
        if (montado && reproductor.estado().listo && !autoplayCancelado.current) {
          inicioPendiente.current = null
          return reproductor.reproducir({ desdeMs: inicio })
        }
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
      ignorarError(ventana.evitarReposo(false))
      ignorarError(ventana.modoReproductor(false))
      for (const nodo of inertes) nodo.removeAttribute('inert')
      retenerToasts(false)
    }
  }, [])

  useEffect(() => {
    ignorarError(window.shinobi.ventana.evitarReposo(sonando))
  }, [sonando, finalizado, errorPrincipal])

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
    if (errorPrincipal && accion.tipo !== 'salir') return
    const configVoz = { voz_guia: volumen.volumenVoz, voz_guia_silenciada: volumen.vozSilenciada }
    let cambio: Parameters<typeof volumen.cambiar>[0] = {}
    switch (accion.tipo) {
      case 'salir':
        salir()
        return
      case 'pantalla_completa':
        ignorarError(window.shinobi.ventana.fijarPantallaCompleta(!pantallaCompleta))
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
        autoplayCancelado.current = true
        actual.pausar()
        visibilidad.current?.fijarRetenida('atajos', true)
        setAtajosAbiertos(true)
        return
      case 'desplazar': {
        if (!puedeDesplazar) return
        const offset = cancion.letra.offset_ms
        const fueraDeRango =
          accion.deltaMs < 0 ? offset <= -OFFSET_MAXIMO_MS : offset >= OFFSET_MAXIMO_MS
        if (!fueraDeRango) alDesplazar?.(accion.deltaMs)
        mostrar({ fueraDeRango }, 1000)
        return
      }
    }
    if (Object.keys(cambio).length > 0) cambiarNivel(cambio)
    mostrar(
      textoIndicador(accion, {
        sonando: accion.tipo === 'alternar' ? !sonando : sonando,
        volumen: cambio.volumen ?? volumen.volumen,
        silenciado: cambio.silenciado ?? volumen.silenciado,
        volumenVoz: cambio.voz_guia ?? volumen.volumenVoz,
        vozSilenciada: cambio.voz_guia_silenciada ?? volumen.vozSilenciada,
        offsetMs: cancion.letra.offset_ms
      })
    )
  }

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
  const textoVisible =
    typeof indicador === 'object' && indicador !== null
      ? [R.offset(cancion.letra.offset_ms), indicador.fueraDeRango && E.offsetRango]
          .filter(Boolean)
          .join(' ')
      : indicador
  return createPortal(
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label={R.aria.region(cancion.titulo)}
      tabIndex={-1}
      data-pantalla-completa={String(pantallaCompleta)}
      className={`${estilos.raiz} ${mostrarControles || finalizado || errorPrincipal ? '' : estilos.sinCursor}`}
      style={variablesEstilo(cancion.estilo) as CSSProperties}
      onPointerMove={() => actividad(true)}
      onPointerDown={() => actividad(true)}
    >
      {errorPrincipal ? (
        <PantallaError error={errorPrincipal} modo={modo} origen={origen} alSalir={salir} />
      ) : finalizado ? (
        <PantallaFinal
          {...titulo}
          origen={origen}
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
          reproduciendo
          avisoTitulo={avisoSinIcono ?? undefined}
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
          aviso={avisoSinIcono}
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
        />
      )}
      {!errorPrincipal && <IndicadorBreve texto={textoVisible} />}
      <div className={estilosComponentes.soloLector} aria-live="polite" aria-atomic="true">
        {anuncio}
      </div>
      <DialogoAtajosReproductor
        abierto={atajosAbiertos}
        vozDisponible={vozDisponible}
        puedeDesplazar={puedeDesplazar}
        alCerrar={() => {
          setAtajosAbiertos(false)
          visibilidad.current?.fijarRetenida('atajos', false)
        }}
      />
    </div>,
    document.body
  )
}
