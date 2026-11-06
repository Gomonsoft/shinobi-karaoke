import { useEffect, useEffectEvent, useRef, useState, type Dispatch } from 'react'
import type { Letra } from '@shared/letra'
import {
  limitesInicio,
  primeraSinInicio,
  tiempoGuardado,
  tiempoMostrado
} from '@shared/letras/tiempos'
import type { MotorAudio } from '../../karaoke/motorAudio'
import { ultimaMarcaDeSesion, type AccionEditor, type EstadoEditor } from './estado'

type Puerto = Pick<
  MotorAudio,
  'estado' | 'pausar' | 'reproducir' | 'buscar' | 'tiempoDeEvento' | 'posicionMs' | 'suscribir'
>
type Cuenta = 3 | 2 | 1 | null
type Origen = 'teclado' | 'puntero'
type Pulsacion = { id: string; ts: number; origen: Origen }

function comienzo(letra: Letra, id: string): number {
  const { min, vecinoAnterior } = limitesInicio(letra, id)
  return vecinoAnterior ? Math.max(0, tiempoMostrado(min - 1, letra.offset_ms) - 2000) : 0
}

interface Opciones {
  motor: Puerto | null
  edicion: EstadoEditor
  despachar: Dispatch<AccionEditor>
  duracionMs: number
  alSalir(): void
}

export function useSincronizarAlRitmo({
  motor,
  edicion,
  despachar,
  duracionMs,
  alSalir
}: Opciones) {
  const [cuentaAtras, setCuenta] = useState<Cuenta>(null)
  const [pronto, setPronto] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const cuenta = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const aviso = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pulsacion = useRef<Pulsacion | null>(null)
  const terminando = useRef(false)
  const { letra } = edicion.actual
  const activa = edicion.sync.activo

  function limpiarCuenta(): void {
    clearInterval(cuenta.current)
    cuenta.current = undefined
    setCuenta(null)
  }

  function limpiar(): void {
    limpiarCuenta()
    clearTimeout(aviso.current)
    setPronto(false)
    pulsacion.current = null
  }

  function terminar(): void {
    if (!activa || terminando.current) return
    terminando.current = true
    limpiar()
    motor?.pausar()
    despachar({ tipo: 'salir_sync' })
    setAnuncio('Terminó la sincronización al ritmo.')
    alSalir()
  }

  function entrar(): void {
    if (activa || !motor || motor.estado().duracionMs === null) return
    const id =
      edicion.seleccion ??
      primeraSinInicio(letra) ??
      letra.lineas.find((l) => l.tipo === 'linea')?.id
    if (!id) return
    terminando.current = false
    limpiar()
    motor.pausar()
    despachar({ tipo: 'entrar_sync', desdeId: id })
    const desdeMs = comienzo(letra, id)
    motor.buscar(desdeMs)
    setAnuncio('')
    setCuenta(3)
    let restante = 3
    cuenta.current = setInterval(() => {
      restante--
      if (restante === 0) {
        limpiarCuenta()
        void motor.reproducir({ desdeMs })
      } else setCuenta(restante as 2 | 1)
    }, 1000)
  }

  function alternar(): void {
    if (!motor || cuenta.current !== undefined) return
    pulsacion.current = null
    if (motor.estado().sonando) motor.pausar()
    else void motor.reproducir()
  }

  function seleccionar(id: string): void {
    if (!activa) return
    limpiar()
    despachar({ tipo: 'sync_siguiente', id })
    void motor?.reproducir({ desdeMs: comienzo(letra, id) })
  }

  function marcar(ts: number, origen: Origen): void {
    const id = edicion.sync.siguiente
    if (!activa || !motor || id === null || cuenta.current !== undefined) return
    const t = motor.tiempoDeEvento(ts)
    if (t === null) return
    const ms = tiempoGuardado(t, letra.offset_ms)
    const { min } = limitesInicio(letra, id)
    if (ms < min) {
      setPronto(true)
      clearTimeout(aviso.current)
      aviso.current = setTimeout(() => setPronto(false), 2000)
      despachar({ tipo: 'marcar', ms, ahora: ts })
      return
    }
    if (letra.lineas.find((l) => l.id === id)?.inicio_ms !== ms) {
      pulsacion.current = { id, ts, origen }
    }
    setPronto(false)
    despachar({ tipo: 'marcar', ms, ahora: ts })
  }

  function soltar(ts: number, origen: Origen): void {
    const inicial = pulsacion.current
    if (!inicial || inicial.origen !== origen) return
    pulsacion.current = null
    if (!activa || !motor || ts - inicial.ts < 300) return
    const t = motor.tiempoDeEvento(ts)
    if (t === null) return
    despachar({
      tipo: 'fin_al_soltar',
      id: inicial.id,
      ms: tiempoGuardado(t, letra.offset_ms),
      duracionMs
    })
  }

  function deshacer(): void {
    const ultima = ultimaMarcaDeSesion(edicion)
    if (!activa || !ultima || !motor) return
    pulsacion.current = null
    despachar({ tipo: 'deshacer_marca' })
    setAnuncio('Se deshizo la última marca.')
    void motor.reproducir({
      desdeMs: Math.max(0, tiempoMostrado(ultima.ms, letra.offset_ms) - 3000)
    })
  }

  const alFinal = useEffectEvent(() => terminar())
  const alPerderFoco = useEffectEvent(() => {
    limpiarCuenta()
    pulsacion.current = null
    motor?.pausar()
  })

  useEffect(() => {
    if (!activa || !motor) return
    const quitar = motor.suscribir((estado) => {
      if (!estado.sonando && estado.duracionMs !== null && motor.posicionMs() >= estado.duracionMs)
        alFinal()
    })
    const perder = () => alPerderFoco()
    window.addEventListener('blur', perder)
    return () => {
      quitar()
      window.removeEventListener('blur', perder)
    }
  }, [activa, motor])

  useEffect(
    () => () => {
      clearInterval(cuenta.current)
      clearTimeout(aviso.current)
    },
    []
  )

  return {
    cuentaAtras,
    pronto,
    anuncio,
    entrar,
    terminar,
    alternar,
    marcar,
    soltar,
    deshacer,
    seleccionar,
    cancelarAlRecargar: limpiar,
    hayMarca: ultimaMarcaDeSesion(edicion) !== null
  }
}
