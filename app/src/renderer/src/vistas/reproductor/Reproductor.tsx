import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Letra } from '@shared/letra'
import type { Estilo } from '@shared/estilo'
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
import { accionDeTeclaReproductor, type AccionReproductor } from './atajos'
import {
  alternarVoz,
  pasoVolumen,
  pasoVoz,
  posicionInicial,
  textoIndicador,
  VisibilidadControles
} from './modelo'
import { Controles } from './Controles'
import { IndicadorBreve } from './IndicadorBreve'
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
  crearMotor
}: PropsReproductor) {
  const raiz = useRef<HTMLDivElement>(null)
  const motor = useRef<MotorReproductor | null>(null)
  const visibilidad = useRef<VisibilidadControles | null>(null)
  const saliendo = useRef(false)
  const volverAlInicio = useRef(false)
  const indicadorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [estado, setEstado] = useState<EstadoMotorReproductor | null>(null)
  const [controlesVisibles, setControlesVisibles] = useState(true)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [cargaLarga, setCargaLarga] = useState(false)
  const [posicionBarra, setPosicionBarra] = useState(0)
  const [indicador, setIndicador] = useState<string | null>(null)
  const listo = estado?.listo ?? false
  const sonando = estado?.sonando ?? false
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
    const bajaMotor = reproductor.suscribir(setEstado)
    const inicio = inicioInicial()
    const carga = setTimeout(() => setCargaLarga(true), 1000)
    ignorarError(
      reproductor.cargar().then(() => {
        clearTimeout(carga)
        if (montado && reproductor.estado().listo)
          return reproductor.reproducir({ desdeMs: inicio })
      })
    )
    return () => {
      montado = false
      clearTimeout(carga)
      clearTimeout(indicadorTimer.current)
      bajaControles()
      control.destruir()
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

  function mostrar(texto: string | null): void {
    if (!texto) return
    clearTimeout(indicadorTimer.current)
    setIndicador(texto)
    indicadorTimer.current = setTimeout(() => setIndicador(null), 600)
  }

  function buscar(ms: number): void {
    volverAlInicio.current = false
    motor.current?.buscar(ms)
    setPosicionBarra(Math.max(0, tiempoAudio()))
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
  }

  function actuar(accion: AccionReproductor): void {
    const actual = motor.current
    if (!actual) return
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
        if (sonando) actual.pausar()
        else {
          const desde = volverAlInicio.current
            ? posicionInicial(origen, 0, cancion.letra)
            : undefined
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
        if (!estado?.vozDisponible) return
        cambio = alternarVoz(configVoz)
        break
      case 'nivel_voz':
        if (!estado?.vozDisponible) return
        cambio = pasoVoz(configVoz, accion.delta)
        break
      case 'atajos':
      case 'desplazar':
        return
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
    if (e.key === 'Escape' && document.querySelector('[role="tooltip"]')) return
    if (e.key === 'Tab') {
      visibilidad.current?.actividad()
      if (!controlesVisibles) {
        e.preventDefault()
        requestAnimationFrame(() => raiz.current?.querySelector('button')?.focus())
      }
      return
    }
    const accion = accionDeTeclaReproductor(e, {
      origen,
      vozDisponible: estado?.vozDisponible ?? false,
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
      role="dialog"
      aria-modal="true"
      aria-label={R.aria.region(cancion.titulo)}
      tabIndex={-1}
      data-pantalla-completa={String(pantallaCompleta)}
      className={`${estilos.raiz} ${controlesVisibles ? '' : estilos.sinCursor}`}
      onPointerMove={() => visibilidad.current?.actividad()}
      onClick={() => visibilidad.current?.actividad()}
    >
      <PantallaLetra
        {...titulo}
        className={estilos.letra}
        estilo={cancion.estilo}
        letra={listo ? cancion.letra : { ...cancion.letra, lineas: [] }}
        duracionMs={duracionMs}
        obtenerTiempoAudio={listo ? tiempoAudio : undefined}
        reproduciendo
        cargando={!listo && cargaLarga}
        textoCargando={R.cargando}
      />
      {modo === 'original' && (
        <span className={`${estilos.pildora} ${estilos.original}`}>{R.original}</span>
      )}
      <Controles
        {...titulo}
        aviso={null}
        listo={listo}
        sonando={sonando}
        pantallaCompleta={pantallaCompleta}
        visible={controlesVisibles}
        posicionMs={posicionBarra}
        duracionMs={duracionMs}
        vozDisponible={estado?.vozDisponible ?? false}
        modo={modo}
        volumen={volumen}
        actuar={actuar}
        buscar={buscar}
        cambiarNivel={cambiarNivel}
        retener={(motivo, activa) => visibilidad.current?.fijarRetenida(motivo, activa)}
      />
      <IndicadorBreve texto={indicador} />
    </div>,
    document.body
  )
}
