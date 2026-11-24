import { useCallback, useEffect, useRef, useState, type ActionDispatch } from 'react'
import type { Espera } from '@shared/espera'
import type { ApiShinobi, EstadoPicos } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import { contador } from '@shared/letras/tiempos'
import { detectarVoz, type PropuestaSilencios } from '@shared/silencios'
import { proponerAjusteSilenciosSinSolapes } from '@shared/solapes'
import { mostrarToast } from '../../../componentes/gestorToasts'
import type { AccionEditor } from '../estado'
import { leerPicosBase } from '../picosBase'
import { S, esMac } from './textos'

export const RETARDO_BUSCANDO_MS = 300
export const DURACION_RESALTE_MS = 2000

export type Motivo =
  | { tipo: 'lineas'; pendientes: number }
  | { tipo: 'separacion' }
  | { tipo: 'preparando' }
  | { tipo: 'error' }
  | { tipo: 'noDisponible' }
  | { tipo: 'tema' }

export interface EntradaMotivos {
  letra: Letra
  separacionDisponible: boolean
  /** Estado de los picos si el editor los está leyendo (pestaña Sincronía); `null` si no se sabe. */
  picos: EstadoPicos['estado'] | null
  borradorTema: boolean
}

/** Qué falta para poder ajustar los silencios, en el orden en que se muestra (spec AS2). */
export function motivosSilencios(e: EntradaMotivos): Motivo[] {
  const motivos: Motivo[] = []
  const { sincronizadas, total } = contador(e.letra)
  if (total > sincronizadas) motivos.push({ tipo: 'lineas', pendientes: total - sincronizadas })
  if (!e.separacionDisponible) motivos.push({ tipo: 'separacion' })
  else if (e.picos === 'generando') motivos.push({ tipo: 'preparando' })
  else if (e.picos === 'error') motivos.push({ tipo: 'error' })
  else if (e.picos === 'no_disponible') motivos.push({ tipo: 'noDisponible' })
  if (e.borradorTema) motivos.push({ tipo: 'tema' })
  return motivos
}

export type ResultadoAjuste =
  | { ok: true; propuesta: PropuestaSilencios }
  | { ok: false; motivo: 'preparando' | 'error' | 'noDisponible' }

interface EntradaCalculo {
  api: Pick<ApiShinobi, 'picos'>
  cancionId: string
  letra: Letra
  duracionMs: number
  espera: Espera
}

/** Lee los picos base (con su memo), detecta la voz y propone el ajuste, sin aplicar nada. */
export async function calcularAjuste(e: EntradaCalculo): Promise<ResultadoAjuste> {
  const picos = await leerPicosBase(e.api, e.cancionId, e.duracionMs)
  if (picos.estado !== 'lista') {
    const motivo =
      picos.estado === 'generando'
        ? 'preparando'
        : picos.estado === 'error'
          ? 'error'
          : 'noDisponible'
    return { ok: false, motivo }
  }
  const voz = detectarVoz({ pasoMs: picos.pasoMs, pares: picos.pares })
  return {
    ok: true,
    // Las líneas que suenan a la vez que otras no se tocan (la voz separada mezcla a los dos cantantes).
    propuesta: proponerAjusteSilenciosSinSolapes(e.letra, voz, {
      duracionMs: e.duracionMs,
      espera: e.espera
    })
  }
}

/** Los recuentos que ve la persona en el diálogo (AS8: si cambian, no se aplica). */
export function mismosRecuentos(a: PropuestaSilencios, b: PropuestaSilencios): boolean {
  return (
    a.lineasCambiadas === b.lineasCambiadas &&
    a.finesFijadosCambiados === b.finesFijadosCambiados &&
    a.huecosLargos === b.huecosLargos &&
    (a.espera === null) === (b.espera === null)
  )
}

export interface PropuestaAbierta {
  propuesta: PropuestaSilencios
  /** Letra sobre la que se calculó (para mostrar los fines anteriores). */
  letraAntes: Letra
  espera: Espera
  obsoleto: boolean
}

interface Opciones {
  cancionId: string
  letra: Letra
  duracionMs: number
  espera: Espera
  /** `version` del historial del editor. */
  version: number
  despachar: ActionDispatch<[AccionEditor]>
  anunciar(texto: string): void
  api?: Pick<ApiShinobi, 'picos'>
}

export function useAjustarSilencios(opciones: Opciones) {
  const { despachar, anunciar } = opciones
  const [buscando, setBuscando] = useState(false)
  const [abierta, setAbierta] = useState<PropuestaAbierta | null>(null)
  const [resaltadas, setResaltadas] = useState<ReadonlySet<string>>(new Set())
  const [foco, setFoco] = useState(0)
  const ultimo = useRef(opciones)
  const ocupado = useRef(false)
  const temporizadorResalte = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    ultimo.current = opciones
  })
  useEffect(() => () => clearTimeout(temporizadorResalte.current), [])
  useEffect(() => {
    if (foco > 0) document.querySelector<HTMLElement>('[data-silencios-boton]')?.focus()
  }, [foco])

  const calcular = useCallback(() => {
    const o = ultimo.current
    return calcularAjuste({
      api: o.api ?? window.shinobi,
      cancionId: o.cancionId,
      letra: o.letra,
      duracionMs: o.duracionMs,
      espera: o.espera
    })
  }, [])

  const avisarFalta = (motivo: 'preparando' | 'error' | 'noDisponible') =>
    mostrarToast({ tipo: 'aviso', mensaje: S.falta[motivo] })

  const pedir = useCallback(async () => {
    if (ocupado.current) return
    ocupado.current = true
    const temporizador = setTimeout(() => setBuscando(true), RETARDO_BUSCANDO_MS)
    const { letra, espera } = ultimo.current
    try {
      const r = await calcular()
      if (!r.ok) return avisarFalta(r.motivo)
      if (r.propuesta.lineasCambiadas === 0) {
        mostrarToast({ tipo: 'info', mensaje: S.nada })
        anunciar(S.nada)
        return
      }
      setAbierta({ propuesta: r.propuesta, letraAntes: letra, espera, obsoleto: false })
    } catch {
      avisarFalta('error')
    } finally {
      clearTimeout(temporizador)
      setBuscando(false)
      ocupado.current = false
    }
  }, [calcular, anunciar])

  const confirmar = useCallback(async () => {
    if (!abierta || ocupado.current) return
    ocupado.current = true
    const { letra, version, espera } = ultimo.current
    try {
      const r = await calcular()
      if (!r.ok) {
        setAbierta(null)
        return avisarFalta(r.motivo)
      }
      const { propuesta } = r
      if (propuesta.lineasCambiadas === 0 || !mismosRecuentos(abierta.propuesta, propuesta)) {
        if (propuesta.lineasCambiadas === 0) {
          setAbierta(null)
          mostrarToast({ tipo: 'info', mensaje: S.nada })
          anunciar(S.nada)
        } else setAbierta({ propuesta, letraAntes: letra, espera, obsoleto: true })
        return
      }
      despachar({
        tipo: 'ajustar_silencios',
        propuesta,
        versionCalculo: version,
        ahora: performance.now()
      })
      setAbierta(null)
      setFoco((n) => n + 1)
      const mensaje = S.toast(propuesta.lineasCambiadas, propuesta.espera !== null)
      mostrarToast({
        tipo: 'exito',
        mensaje,
        accion: { etiqueta: S.deshacerToast, alAccionar: () => despachar({ tipo: 'deshacer' }) }
      })
      anunciar(mensaje)
      clearTimeout(temporizadorResalte.current)
      setResaltadas(new Set(propuesta.cambios.map((c) => c.id)))
      temporizadorResalte.current = setTimeout(() => setResaltadas(new Set()), DURACION_RESALTE_MS)
    } catch {
      setAbierta(null)
      avisarFalta('error')
    } finally {
      ocupado.current = false
    }
  }, [abierta, calcular, despachar, anunciar])

  const cancelar = useCallback(() => setAbierta(null), [])

  return { buscando, abierta, resaltadas, pedir, confirmar, cancelar, mac: esMac() }
}
