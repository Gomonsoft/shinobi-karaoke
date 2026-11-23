import { useCallback, useEffect, useMemo, useRef, useState, type ActionDispatch } from 'react'
import { contarRevisadas, detectarDudosas, type LineaDudosa } from '@shared/dudosas'
import type { Espera } from '@shared/espera'
import type { ApiShinobi, EstadoPicos } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import { numeroDeLinea } from '@shared/letras/tiempos'
import { detectarVoz, proponerAjusteSilencios, type VozDetectada } from '@shared/silencios'
import type { AccionEditor } from '../estado'
import { leerPicosBase } from '../picosBase'
import { R, motivoPrincipal } from './textos'

/** Espera entre el anuncio de la línea y el audio, para no pisarlo (spec 06 · F11, accesibilidad). */
export const RETARDO_AUDIO_MS = 300
export const DURACION_SIN_SILENCIO_MS = 2000
export const DURACION_RESALTE_DOCK_MS = 2000

export type VistaTarjeta = 'linea' | 'corregida' | 'fuera' | 'fin' | 'nada'

interface Opciones {
  cancionId: string
  letra: Letra
  duracionMs: number
  espera: Espera
  /** `version` del historial del editor (la comprueba `ajustar_silencios`). */
  version: number
  seleccion: string | null
  separacionDisponible: boolean
  picos: EstadoPicos
  /** Valor inicial de «Escuchar cada línea al llegar» (preferencias del editor). */
  autoescucha: boolean
  despachar: ActionDispatch<[AccionEditor]>
  anunciar(texto: string): void
  /** Selecciona la línea y lleva el panel a Sincronía, sin mover el foco. */
  irALinea(id: string): void
  /** Suena su tramo (de 0,5 s antes a 0,5 s después). */
  escucharTramo(id: string): void
  /** «Sincronizar al ritmo» o «Error de audio»: el recorrido no está disponible. */
  bloqueado: boolean
  api?: Pick<ApiShinobi, 'picos' | 'config'>
}

/** Pendiente siguiente o anterior a `desde` en el orden de la letra (con vuelta). */
export function vecinaPendiente(
  letra: Pick<Letra, 'lineas'>,
  pendientes: readonly string[],
  desde: string | null,
  sentido: -1 | 1
): { id: string; vuelta: boolean } | null {
  if (pendientes.length === 0) return null
  const orden = new Map(letra.lineas.map((l, i) => [l.id, i]))
  const lista = pendientes
    .filter((id) => orden.has(id))
    .sort((a, b) => orden.get(a)! - orden.get(b)!)
  if (lista.length === 0) return null
  const punto = desde === null ? -1 : (orden.get(desde) ?? -1)
  if (sentido === 1) {
    const sig = lista.find((id) => orden.get(id)! > punto)
    return sig ? { id: sig, vuelta: false } : { id: lista[0]!, vuelta: desde !== null }
  }
  const previas = lista.filter((id) => orden.get(id)! < punto)
  const ant = previas.at(-1)
  return ant ? { id: ant, vuelta: false } : { id: lista.at(-1)!, vuelta: desde !== null }
}

/**
 * Revisión guiada de líneas dudosas (spec 06 · Feature 11): calcula en vivo qué líneas señalar con
 * `detectarDudosas`, lleva el recorrido y ejecuta «Está bien» y «Fin al final de la voz».
 */
export function useRevision(opciones: Opciones) {
  const { despachar, anunciar, letra, duracionMs, seleccion } = opciones
  const [activo, setActivo] = useState(false)
  const [vistos, setVistos] = useState<ReadonlySet<string>>(new Set())
  const [ancla, setAncla] = useState<string | null>(null)
  const [autoescucha, setAutoescucha] = useState(opciones.autoescucha)
  const [mensajeSinSilencio, setMensajeSinSilencio] = useState(false)
  const [resaltarDock, setResaltarDock] = useState(false)
  const [foco, setFoco] = useState(0)
  const ultimo = useRef(opciones)
  const temporizadores = useRef<{
    audio?: ReturnType<typeof setTimeout>
    silencio?: ReturnType<typeof setTimeout>
    dock?: ReturnType<typeof setTimeout>
  }>({})
  const repetir = useRef<string | null>(null)
  useEffect(() => {
    ultimo.current = opciones
  })
  useEffect(
    () => () => {
      for (const t of Object.values(temporizadores.current)) clearTimeout(t)
    },
    []
  )

  // La voz detectada, por generación de la caché de picos; se conserva mientras la pestaña no la lee.
  const [voz, setVoz] = useState<{ generacion: string; voz: VozDetectada } | null>(null)
  const generacion = opciones.picos.estado === 'lista' ? opciones.picos.generacion : null
  useEffect(() => {
    if (generacion === null || !opciones.separacionDisponible) return
    let vigente = true
    const api = ultimo.current.api ?? window.shinobi
    void leerPicosBase(api, opciones.cancionId, duracionMs).then(
      (r) => {
        if (!vigente || r.estado !== 'lista') return
        setVoz({ generacion: r.generacion, voz: detectarVoz({ pasoMs: r.pasoMs, pares: r.pares }) })
      },
      () => undefined
    )
    return () => {
      vigente = false
    }
  }, [generacion, opciones.cancionId, opciones.separacionDisponible, duracionMs])
  const vozVigente = opciones.separacionDisponible ? (voz?.voz ?? null) : null
  const calculando = opciones.separacionDisponible && vozVigente === null && generacion !== null

  const pendientes = useMemo(
    () => detectarDudosas(letra, vozVigente, { duracionMs }),
    [letra, vozVigente, duracionMs]
  )
  const porId = useMemo(() => new Map(pendientes.map((d) => [d.id, d])), [pendientes])
  const buenas = useMemo(() => contarRevisadas(letra, duracionMs), [letra, duracionMs])

  // Ajustes de estado derivados durante el render (patrón de React): el total del recorrido y la ancla.
  if (activo && pendientes.some((d) => !vistos.has(d.id))) {
    setVistos(new Set([...vistos, ...pendientes.map((d) => d.id)]))
  }
  const dudosaActual = seleccion === null ? undefined : porId.get(seleccion)
  if (activo && dudosaActual && ancla !== seleccion) setAncla(seleccion)

  const vista: VistaTarjeta = !activo
    ? 'nada'
    : pendientes.length === 0
      ? vistos.size === 0
        ? 'nada'
        : 'fin'
      : dudosaActual
        ? 'linea'
        : seleccion !== null && seleccion === ancla
          ? 'corregida'
          : 'fuera'

  const cancelarAudio = useCallback(() => {
    clearTimeout(temporizadores.current.audio)
  }, [])

  /** Lleva el recorrido a una línea: se selecciona, se anuncia y, con la casilla, suena su tramo. */
  const llegarA = useCallback(
    (id: string, { sonar }: { sonar: boolean }) => {
      const o = ultimo.current
      cancelarAudio()
      o.irALinea(id)
      if (sonar) {
        temporizadores.current.audio = setTimeout(
          () => ultimo.current.escucharTramo(id),
          RETARDO_AUDIO_MS
        )
      }
    },
    [cancelarAudio]
  )

  const idsPendientes = useMemo(() => pendientes.map((d) => d.id), [pendientes])

  function anunciarLinea(id: string, quedan: number): void {
    const o = ultimo.current
    const el = o.letra.lineas.find((l) => l.id === id)
    const d = porId.get(id)
    if (!el || !d) return
    anunciar(R.anuncio(numeroDeLinea(o.letra, id), el.texto, motivoPrincipal(d), quedan))
  }

  /** Va a la pendiente siguiente o anterior sin marcar nada. */
  function ir(sentido: -1 | 1, { sonar }: { sonar: boolean }): void {
    const v = vecinaPendiente(letra, idsPendientes, seleccion, sentido)
    if (!v) return
    llegarA(v.id, { sonar })
    if (v.vuelta) anunciar(R.vuelta)
    else anunciarLinea(v.id, idsPendientes.length)
  }

  function empezar(): void {
    if (activo || ultimo.current.bloqueado) return
    setActivo(true)
    setVistos(new Set(idsPendientes))
    setAncla(null)
    setFoco((n) => n + 1)
    const primera = vecinaPendiente(letra, idsPendientes, null, 1)
    if (primera) {
      llegarA(primera.id, { sonar: autoescucha })
      anunciarLinea(primera.id, idsPendientes.length)
    }
  }

  function terminar(): void {
    if (!activo) return
    cancelarAudio()
    setActivo(false)
    setVistos(new Set())
    setAncla(null)
  }

  function alternar(): void {
    if (activo) terminar()
    else empezar()
  }

  /** «Está bien» (o «Siguiente» si la línea ya está corregida). */
  function estaBien(): void {
    if (!activo || seleccion === null) return
    if (vista === 'corregida') return ir(1, { sonar: autoescucha })
    const d = porId.get(seleccion)
    if (!d || d.motivos.includes('sinInicio')) return
    despachar({ tipo: 'marcar_revisada', id: seleccion, duracionMs, ahora: performance.now() })
    const resto = idsPendientes.filter((id) => id !== seleccion)
    const sig = vecinaPendiente(letra, resto, seleccion, 1)
    if (sig) {
      llegarA(sig.id, { sonar: autoescucha })
      if (sig.vuelta) anunciar(R.vuelta)
      else anunciarLinea(sig.id, resto.length)
    } else {
      anunciar(R.fin(vistos.size))
      clearTimeout(temporizadores.current.dock)
      setResaltarDock(true)
      temporizadores.current.dock = setTimeout(
        () => setResaltarDock(false),
        DURACION_RESALTE_DOCK_MS
      )
    }
  }

  /** «Está bien» fuera del recorrido (panel Sincronía): marca la línea seleccionada sin cambiar de línea. */
  function marcarSeleccionada(): void {
    const d = seleccion === null ? undefined : porId.get(seleccion)
    if (!d || d.motivos.includes('sinInicio')) return
    despachar({ tipo: 'marcar_revisada', id: d.id, duracionMs, ahora: performance.now() })
  }

  /** Estando fuera de la revisión, la tarjeta ofrece volver a la siguiente pendiente. */
  function volver(): void {
    ir(1, { sonar: autoescucha })
  }

  /** «Fin al final de la voz»: la regla de «Ajustar los silencios» para una sola línea. */
  function finAlFinalDeLaVoz(): void {
    const o = ultimo.current
    if (seleccion === null || vozVigente === null) return
    const propuesta = proponerAjusteSilencios(o.letra, vozVigente, {
      duracionMs: o.duracionMs,
      espera: o.espera,
      soloIds: [seleccion]
    })
    if (propuesta.lineasCambiadas === 0) {
      clearTimeout(temporizadores.current.silencio)
      setMensajeSinSilencio(true)
      temporizadores.current.silencio = setTimeout(
        () => setMensajeSinSilencio(false),
        DURACION_SIN_SILENCIO_MS
      )
      anunciar(R.sinSilencio)
      return
    }
    despachar({
      tipo: 'ajustar_silencios',
      propuesta,
      versionCalculo: o.version,
      ahora: performance.now()
    })
    // La línea vuelve a sonar cuando el editor ya tiene el fin nuevo.
    repetir.current = seleccion
  }
  useEffect(() => {
    const id = repetir.current
    if (id === null) return
    repetir.current = null
    ultimo.current.escucharTramo(id)
  }, [letra])

  function fijarAutoescucha(valor: boolean): void {
    setAutoescucha(valor)
    const api = ultimo.current.api ?? window.shinobi
    void api.config.actualizar({ editor: { revision_autoescucha: valor } }).catch(() => undefined)
  }

  function reiniciar(): void {
    despachar({ tipo: 'reiniciar_revisadas', ahora: performance.now() })
  }

  return {
    pendientes,
    porId,
    buenas,
    voz: vozVigente,
    calculando,
    activo,
    vista,
    /** `t` del título: pendientes al empezar más las que han aparecido después. */
    total: Math.max(vistos.size, pendientes.length),
    quedan: pendientes.length,
    ancla,
    sinInicioPendientes: pendientes.filter((d) => d.motivos.includes('sinInicio')).length,
    autoescucha,
    fijarAutoescucha,
    mensajeSinSilencio,
    resaltarDock,
    foco,
    empezar,
    terminar,
    alternar,
    estaBien,
    marcarSeleccionada,
    volver,
    siguiente: () => ir(1, { sonar: activo && autoescucha }),
    anterior: () => ir(-1, { sonar: activo && autoescucha }),
    finAlFinalDeLaVoz,
    reiniciar
  }
}

export type Revision = ReturnType<typeof useRevision>
export type { LineaDudosa }
