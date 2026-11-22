import { useCallback, useEffect, useRef, useState, type ActionDispatch } from 'react'
import { corregirDesfase, quitarCorreccion, type ResultadoEncaje } from '@shared/encaje'
import type { ApiShinobi, EstadoPicos } from '@shared/ipc'
import { contarLineas, type Letra } from '@shared/letra'
import { mostrarToast } from '../../../componentes/gestorToasts'
import {
  detalleNoCoincide,
  type DetalleNoCoincide,
  type TramoEncaje
} from '../../letra/comprobacion'
import type { AccionEditor } from '../estado'
import {
  calcularEncajeEditor,
  lineasConPalabrasManuales,
  mismaPropuesta,
  motivosComprobar,
  type MotivoComprobar
} from './calcular'
import { S } from '../silencios/textos'
import { K } from './textos'

export const RETARDO_CALCULANDO_MS = 300
export const DURACION_RESALTE_MS = 2000

export type DialogoComprobar =
  | {
      tipo: 'desfase'
      encaje: ResultadoEncaje
      lineas: number
      palabras: number
      obsoleto: boolean
    }
  | { tipo: 'noEncaja'; detalle: DetalleNoCoincide }
  | { tipo: 'dudosa' }

interface Opciones {
  cancionId: string
  letra: Letra
  duracionMs: number
  separacionDisponible: boolean
  /** Estado de los picos si el editor los está leyendo; `null` si no se sabe. */
  picos: EstadoPicos['estado'] | null
  /** Solo en borradores: calcula una vez por visita el veredicto del banner. */
  calcularAlEntrar: boolean
  despachar: ActionDispatch<[AccionEditor]>
  anunciar(texto: string): void
  /** [Ir] de un tramo: lleva el cabezal y selecciona la línea. */
  irATramo(tramo: TramoEncaje): void
  api?: Pick<ApiShinobi, 'picos'>
}

export type VeredictoEntrada =
  { tipo: 'desfasada'; desfaseMs: number } | { tipo: 'noCoincide' } | null

export function useComprobarLetra(opciones: Opciones) {
  const { despachar, anunciar } = opciones
  const [calculando, setCalculando] = useState(false)
  const [dialogo, setDialogo] = useState<DialogoComprobar | null>(null)
  const [resaltadas, setResaltadas] = useState<ReadonlySet<string>>(new Set())
  const [foco, setFoco] = useState(0)
  const [entrada, setEntrada] = useState<VeredictoEntrada>(null)
  const ultimo = useRef(opciones)
  const ocupado = useRef(false)
  const temporizadorResalte = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    ultimo.current = opciones
  })
  useEffect(() => () => clearTimeout(temporizadorResalte.current), [])
  // El foco vuelve al botón de «Funciones» tras cerrar un diálogo o aplicar una corrección.
  useEffect(() => {
    if (foco > 0) document.querySelector<HTMLElement>('[data-comprobar-boton]')?.focus()
  }, [foco])

  const motivos: MotivoComprobar[] = motivosComprobar({
    letra: opciones.letra,
    separacionDisponible: opciones.separacionDisponible,
    picos: opciones.picos
  })

  const calcular = useCallback(() => {
    const o = ultimo.current
    return calcularEncajeEditor({
      api: o.api ?? window.shinobi,
      cancionId: o.cancionId,
      letra: o.letra,
      duracionMs: o.duracionMs
    })
  }, [])

  const avisarFalta = (motivo: 'preparando' | 'error' | 'noDisponible'): void => {
    mostrarToast({ tipo: 'aviso', mensaje: S.falta[motivo] })
  }

  // Veredicto del banner de entrada: una sola vez por visita, en segundo plano.
  const entradaCalculada = useRef(false)
  useEffect(() => {
    if (!opciones.calcularAlEntrar || motivos.length > 0 || entradaCalculada.current) return
    entradaCalculada.current = true
    let vigente = true
    void calcular().then(
      (r) => {
        if (!vigente || !r.ok) return
        const v = r.encaje.veredicto
        setEntrada(
          v === 'desfasada'
            ? { tipo: 'desfasada', desfaseMs: r.encaje.desfaseMs }
            : v === 'no_coincide'
              ? { tipo: 'noCoincide' }
              : null
        )
      },
      () => undefined
    )
    return () => {
      vigente = false
      // Si se desmonta antes de terminar, otra visita volverá a calcular.
      entradaCalculada.current = false
    }
  }, [opciones.calcularAlEntrar, motivos.length, calcular])

  const pedir = useCallback(async (): Promise<void> => {
    if (ocupado.current) return
    ocupado.current = true
    const temporizador = setTimeout(() => setCalculando(true), RETARDO_CALCULANDO_MS)
    const { letra } = ultimo.current
    try {
      const r = await calcular()
      if (!r.ok) return avisarFalta(r.motivo)
      const { encaje } = r
      switch (encaje.veredicto) {
        case 'coincide':
          mostrarToast({ tipo: 'exito', mensaje: K.toastCoincide })
          anunciar(K.toastCoincide)
          setFoco((n) => n + 1)
          break
        case 'desfasada':
          setDialogo({
            tipo: 'desfase',
            encaje,
            lineas: contarLineas(letra),
            palabras: lineasConPalabrasManuales(letra),
            obsoleto: false
          })
          break
        case 'no_coincide':
          setDialogo({
            tipo: 'noEncaja',
            detalle: detalleNoCoincide(letra, encaje, ultimo.current.duracionMs)
          })
          break
        default:
          setDialogo({ tipo: 'dudosa' })
      }
    } catch {
      avisarFalta('error')
    } finally {
      clearTimeout(temporizador)
      setCalculando(false)
      ocupado.current = false
    }
  }, [calcular, anunciar])

  const cancelar = useCallback(() => {
    setDialogo(null)
    setFoco((n) => n + 1)
  }, [])

  const confirmar = useCallback(async (): Promise<void> => {
    if (dialogo?.tipo !== 'desfase' || ocupado.current) return
    ocupado.current = true
    try {
      const r = await calcular()
      if (!r.ok) {
        setDialogo(null)
        return avisarFalta(r.motivo)
      }
      const { letra } = ultimo.current
      // Se recalcula con los tiempos vigentes: si ya no es lo mismo, no se aplica sin avisar.
      if (!mismaPropuesta(dialogo.encaje, r.encaje)) {
        if (r.encaje.veredicto === 'desfasada') {
          setDialogo({
            tipo: 'desfase',
            encaje: r.encaje,
            lineas: contarLineas(letra),
            palabras: lineasConPalabrasManuales(letra),
            obsoleto: true
          })
        } else setDialogo(null)
        return
      }
      const c = corregirDesfase(letra, r.encaje.desfaseMs)
      const aplicado = c.offset_ms - letra.offset_ms
      despachar({
        tipo: 'cambiar_desfase',
        offsetMs: c.offset_ms,
        desfaseCorregidoMs: c.desfase_corregido_ms ?? null,
        ahora: performance.now()
      })
      setDialogo(null)
      setEntrada(null)
      setFoco((n) => n + 1)
      const mensaje = K.desfase.toast(aplicado)
      mostrarToast({
        tipo: 'exito',
        mensaje,
        accion: { etiqueta: 'Deshacer', alAccionar: () => despachar({ tipo: 'deshacer' }) }
      })
      anunciar(mensaje)
      clearTimeout(temporizadorResalte.current)
      setResaltadas(new Set(letra.lineas.map((l) => l.id)))
      temporizadorResalte.current = setTimeout(() => setResaltadas(new Set()), DURACION_RESALTE_MS)
    } catch {
      setDialogo(null)
      avisarFalta('error')
    } finally {
      ocupado.current = false
    }
  }, [dialogo, calcular, despachar, anunciar])

  /** «Quitar la corrección»: `offset_ms −= desfase_corregido_ms`, en un paso del historial. */
  const quitar = useCallback((): void => {
    const { letra } = ultimo.current
    if (!letra.desfase_corregido_ms) return
    despachar({
      tipo: 'cambiar_desfase',
      offsetMs: quitarCorreccion(letra).offset_ms,
      desfaseCorregidoMs: null,
      ahora: performance.now()
    })
    setFoco((n) => n + 1)
    mostrarToast({
      tipo: 'exito',
      mensaje: K.desfase.toastQuitada,
      accion: { etiqueta: 'Deshacer', alAccionar: () => despachar({ tipo: 'deshacer' }) }
    })
    anunciar(K.desfase.toastQuitada)
  }, [despachar, anunciar])

  const ir = useCallback((tramo: TramoEncaje): void => {
    setDialogo(null)
    ultimo.current.irATramo(tramo)
  }, [])

  const descartarEntrada = useCallback(() => setEntrada(null), [])

  return {
    motivos,
    calculando,
    dialogo,
    resaltadas,
    entrada,
    descartarEntrada,
    pedir,
    confirmar,
    cancelar,
    quitar,
    ir
  }
}
