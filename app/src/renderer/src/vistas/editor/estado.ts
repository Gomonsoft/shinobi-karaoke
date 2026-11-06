import type { Estilo } from '@shared/estilo'
import { finEfectivo, type Letra } from '@shared/letra'
import {
  ajustarFin,
  ajustarInicio,
  borrarTiempos,
  desplazar,
  fijarDesplazamiento,
  fijarFin,
  fijarInicio,
  lineaVecina,
  marcarInicioLinea,
  primeraSinInicio,
  usarFinAutomatico,
  type Limite,
  type ResultadoTiempos
} from '@shared/letras/tiempos'

export interface Instantanea {
  letra: Letra
  estilo: Estilo
}
export interface EntradaHistorial {
  antes: Instantanea
  clave: string
  en: number
  sesionSync: number | null
  marcaId?: string
}

export type Aviso =
  | { tipo: 'limite'; limite: Limite; id: string | null }
  | {
      tipo: 'consecuencias'
      palabrasDescartadas: string[]
      finesAutomaticos: string[]
      limite?: Limite
      id?: string | null
    }

type EntradaFutura = Instantanea & { origen: Omit<EntradaHistorial, 'antes'> }

export interface EstadoEditor {
  actual: Instantanea
  pasado: EntradaHistorial[]
  futuro: EntradaFutura[]
  seleccion: string | null
  sync: { activo: boolean; sesion: number; siguiente: string | null }
  aviso: (Aviso & { n: number }) | null
  version: number
  cambiosEnVisita: boolean
}

export type AccionEditor =
  | { tipo: 'cargar'; instantanea: Instantanea; seleccion: string | null }
  | { tipo: 'seleccionar'; id: string | null }
  | { tipo: 'mover_seleccion'; sentido: -1 | 1 }
  | { tipo: 'ajustar_inicio'; deltaMs: number; ahora: number }
  | { tipo: 'ajustar_fin'; deltaMs: number; duracionMs: number; ahora: number }
  | { tipo: 'fijar_inicio'; ms: number; ahora: number }
  | { tipo: 'fijar_fin'; ms: number; duracionMs: number; ahora: number }
  | { tipo: 'fin_automatico'; ahora: number }
  | { tipo: 'borrar_tiempos'; ahora: number }
  | { tipo: 'desplazar'; deltaMs: number; ahora: number }
  | { tipo: 'fijar_desplazamiento'; ms: number; ahora: number }
  | { tipo: 'estilo'; estilo: Estilo; clave: string; ahora: number; agruparGesto?: boolean }
  | { tipo: 'entrar_sync'; desdeId: string | null }
  | { tipo: 'salir_sync' }
  | { tipo: 'sync_siguiente'; id: string }
  | { tipo: 'marcar'; ms: number; ahora: number }
  | { tipo: 'fin_al_soltar'; id: string; ms: number; duracionMs: number }
  | { tipo: 'deshacer_marca' }
  | { tipo: 'deshacer' }
  | { tipo: 'rehacer' }

const MAX_HISTORIAL = 200
const VENTANA_GRUPO_MS = 1000

export function estadoInicial(actual: Instantanea, seleccion: string | null): EstadoEditor {
  return {
    actual,
    seleccion,
    pasado: [],
    futuro: [],
    sync: { activo: false, sesion: 0, siguiente: null },
    aviso: null,
    version: 0,
    cambiosEnVisita: false
  }
}

export const puedeDeshacer = (e: EstadoEditor): boolean => e.pasado.length > 0
export const puedeRehacer = (e: EstadoEditor): boolean => e.futuro.length > 0

function aplicar(e: EstadoEditor, actual: Instantanea): EstadoEditor {
  return { ...e, actual, version: e.version + 1, cambiosEnVisita: true }
}

function guardarPaso(
  e: EstadoEditor,
  actual: Instantanea,
  clave: string,
  ahora: number,
  opciones: { marcaId?: string; agruparGesto?: boolean } = {}
): EstadoEditor {
  const { marcaId, agruparGesto } = opciones
  const ultima = e.pasado.at(-1)
  const agrupar =
    !marcaId &&
    ultima &&
    !ultima.marcaId &&
    e.futuro.length === 0 &&
    ultima.clave === clave &&
    (agruparGesto || ahora - ultima.en < VENTANA_GRUPO_MS)
  const entrada: EntradaHistorial = agrupar
    ? { ...ultima, en: ahora }
    : { antes: e.actual, clave, en: ahora, sesionSync: marcaId ? e.sync.sesion : null, marcaId }
  const pasado = agrupar
    ? [...e.pasado.slice(0, -1), entrada]
    : [...e.pasado, entrada].slice(-MAX_HISTORIAL)
  return { ...aplicar(e, actual), pasado, futuro: [] }
}

function conAviso(e: EstadoEditor, r: ResultadoTiempos, id: string | null): EstadoEditor {
  const n = (e.aviso?.n ?? 0) + 1
  if (r.palabrasDescartadas.length || r.finesAutomaticos.length) {
    return {
      ...e,
      aviso: {
        tipo: 'consecuencias',
        palabrasDescartadas: r.palabrasDescartadas,
        finesAutomaticos: r.finesAutomaticos,
        limite: r.limite ?? undefined,
        id,
        n
      }
    }
  }
  return r.limite ? { ...e, aviso: { tipo: 'limite', limite: r.limite, id, n } } : e
}

function cambiarTiempos(e: EstadoEditor, r: ResultadoTiempos, clave: string, ahora: number) {
  const siguiente = conAviso(e, r, e.seleccion)
  return r.cambiado
    ? guardarPaso(siguiente, { ...e.actual, letra: r.letra }, clave, ahora)
    : siguiente
}

function esLinea(letra: Letra, id: string | null): id is string {
  return id !== null && letra.lineas.some((l) => l.id === id && l.tipo === 'linea')
}

export function ultimaMarcaDeSesion(e: EstadoEditor): { id: string; ms: number } | null {
  const ultima = e.pasado.at(-1)
  if (!e.sync.activo || !ultima?.marcaId || ultima.sesionSync !== e.sync.sesion) return null
  const ms = e.actual.letra.lineas.find((l) => l.id === ultima.marcaId)?.inicio_ms
  return ms == null ? null : { id: ultima.marcaId, ms }
}

function deshacer(e: EstadoEditor): EstadoEditor {
  const entrada = e.pasado.at(-1)
  if (!entrada) return e
  const { antes, ...origen } = entrada
  return {
    ...aplicar(e, antes),
    pasado: e.pasado.slice(0, -1),
    futuro: [...e.futuro, { ...e.actual, origen }]
  }
}

function rehacer(e: EstadoEditor): EstadoEditor {
  const entrada = e.futuro.at(-1)
  if (!entrada) return e
  const { origen, ...actual } = entrada
  return {
    ...aplicar(e, actual),
    pasado: [...e.pasado, { antes: e.actual, ...origen }],
    futuro: e.futuro.slice(0, -1)
  }
}

export function reducirEditor(e: EstadoEditor, a: AccionEditor): EstadoEditor {
  const { letra, estilo } = e.actual
  const id = e.seleccion
  const unica = (clave: string) => `${clave}:${e.version}`
  switch (a.tipo) {
    case 'cargar':
      return estadoInicial(a.instantanea, a.seleccion)
    case 'seleccionar':
      return a.id === null || esLinea(letra, a.id) ? { ...e, seleccion: a.id } : e
    case 'mover_seleccion': {
      if (e.sync.activo) return e
      const seleccion = lineaVecina(letra, id, a.sentido)
      return seleccion === null ? e : { ...e, seleccion }
    }
    case 'ajustar_inicio':
      return !e.sync.activo && esLinea(letra, id)
        ? cambiarTiempos(e, ajustarInicio(letra, id, a.deltaMs), `inicio:${id}`, a.ahora)
        : e
    case 'ajustar_fin':
      return !e.sync.activo && esLinea(letra, id)
        ? cambiarTiempos(e, ajustarFin(letra, id, a.deltaMs, a.duracionMs), `fin:${id}`, a.ahora)
        : e
    case 'fijar_inicio':
      return !e.sync.activo && esLinea(letra, id)
        ? cambiarTiempos(e, fijarInicio(letra, id, a.ms), unica(`fijar-inicio:${id}`), a.ahora)
        : e
    case 'fijar_fin':
      return !e.sync.activo && esLinea(letra, id)
        ? cambiarTiempos(
            e,
            fijarFin(letra, id, a.ms, a.duracionMs),
            unica(`fijar-fin:${id}`),
            a.ahora
          )
        : e
    case 'fin_automatico':
      return !e.sync.activo && esLinea(letra, id)
        ? cambiarTiempos(e, usarFinAutomatico(letra, id), unica(`finauto:${id}`), a.ahora)
        : e
    case 'borrar_tiempos':
      return !e.sync.activo && esLinea(letra, id)
        ? cambiarTiempos(e, borrarTiempos(letra, id), unica(`borrar:${id}`), a.ahora)
        : e
    case 'desplazar':
      return cambiarTiempos(e, desplazar(letra, a.deltaMs), 'desplazamiento', a.ahora)
    case 'fijar_desplazamiento':
      return cambiarTiempos(e, fijarDesplazamiento(letra, a.ms), 'desplazamiento', a.ahora)
    case 'estilo':
      return e.sync.activo || JSON.stringify(estilo) === JSON.stringify(a.estilo)
        ? e
        : guardarPaso(e, { letra, estilo: a.estilo }, `estilo:${a.clave}`, a.ahora, {
            agruparGesto: a.agruparGesto
          })
    case 'entrar_sync': {
      const inicio = a.desdeId ?? id
      const siguiente = esLinea(letra, inicio)
        ? inicio
        : (primeraSinInicio(letra) ?? lineaVecina(letra, null, 1))
      return {
        ...e,
        seleccion: siguiente,
        sync: { activo: true, sesion: e.sync.sesion + 1, siguiente }
      }
    }
    case 'salir_sync':
      return { ...e, seleccion: e.sync.siguiente ?? id, sync: { ...e.sync, activo: false } }
    case 'sync_siguiente':
      return e.sync.activo && esLinea(letra, a.id)
        ? { ...e, seleccion: a.id, sync: { ...e.sync, siguiente: a.id } }
        : e
    case 'marcar': {
      const marcaId = e.sync.siguiente
      if (!e.sync.activo || marcaId === null) return e
      const r = marcarInicioLinea(letra, marcaId, a.ms)
      const base = conAviso(e, r, marcaId)
      if (!r.cambiado) return base
      const nueva = guardarPaso(
        base,
        { ...e.actual, letra: r.letra },
        `marca:${marcaId}`,
        a.ahora,
        { marcaId }
      )
      const siguiente = lineaVecina(letra, marcaId, 1)
      return { ...nueva, seleccion: siguiente ?? marcaId, sync: { ...e.sync, siguiente } }
    }
    case 'fin_al_soltar': {
      if (ultimaMarcaDeSesion(e)?.id !== a.id) return e
      let r = fijarFin(letra, a.id, a.ms, a.duracionMs)
      if (r.limite?.tipo === 'fin_siguiente') {
        const base = finEfectivo(letra, a.id, a.duracionMs)
        if (base !== null) r = ajustarFin(letra, a.id, a.ms - base, a.duracionMs)
      }
      return r.cambiado ? aplicar(e, { ...e.actual, letra: r.letra }) : e
    }
    case 'deshacer_marca': {
      const marca = ultimaMarcaDeSesion(e)
      return marca
        ? { ...deshacer(e), seleccion: marca.id, sync: { ...e.sync, siguiente: marca.id } }
        : e
    }
    case 'deshacer':
      return deshacer(e)
    case 'rehacer':
      return rehacer(e)
  }
}
