import type { Estilo } from '@shared/estilo'
import type { SeleccionApariencia } from '@shared/ipc'
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
import { tiempoAudioALetra } from './lineaTiempo'

/** Selección de apariencia de la canción (ADR 0016): estilo propio, tema asignado o herencia. */
export type SeleccionEditor =
  { modo: 'propio' } | { modo: 'tema'; temaId: string } | { modo: 'heredar' }

/**
 * Apariencia de la canción: la selección y el estilo propio. Con `propio` el estilo es la autoridad;
 * con `tema` o `heredar` es la instantánea de respaldo guardada en la canción.
 */
export interface AparienciaEditor {
  seleccion: SeleccionEditor
  estilo: Estilo
}

/** Borrador de un tema en memoria (D3): nunca se escribe hasta confirmar el impacto. */
export interface BorradorTema {
  temaId: string
  nombre: string
  /** Revisión del tema al entrar; la usa `temas.ejecutar({ tipo: 'editar' })`. */
  revision: number
  /** Estilo guardado del tema al entrar (para saber si hay cambios). */
  base: Estilo
  estilo: Estilo
}

export interface Instantanea {
  letra: Letra
  apariencia: AparienciaEditor
  borrador: BorradorTema | null
}

type InstantaneaInicial = Omit<Instantanea, 'borrador'> & { borrador?: BorradorTema | null }

/** Prefijo de la clave de los pasos del borrador; se retiran al salir de D3. */
export const CLAVE_BORRADOR = 'borrador:'

export const aparienciaPropia = (estilo: Estilo): AparienciaEditor => ({
  seleccion: { modo: 'propio' },
  estilo
})

export function aSeleccionIpc(apariencia: AparienciaEditor): SeleccionApariencia {
  const { seleccion, estilo } = apariencia
  if (seleccion.modo === 'propio') return { modo: 'propio', estilo }
  return seleccion.modo === 'tema'
    ? { modo: 'tema', temaId: seleccion.temaId }
    : { modo: 'heredar' }
}

const mismoJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
export const borradorModificado = (b: BorradorTema | null): boolean =>
  b !== null && !mismoJson(b.estilo, b.base)
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

export interface GestoMarcador {
  id: string
  borde: 'inicio' | 'fin'
  letraBase: Letra
  version: number
  sesionSync: number
  tiempoOriginalMs: number
  duracionMs: number
  resultado: ResultadoTiempos | null
}

export type AccionEditor =
  | { tipo: 'cargar'; instantanea: InstantaneaInicial; seleccion: string | null }
  | { tipo: 'seleccionar'; id: string | null }
  | { tipo: 'mover_seleccion'; sentido: -1 | 1 }
  | { tipo: 'ajustar_inicio'; deltaMs: number; ahora: number }
  | { tipo: 'ajustar_fin'; deltaMs: number; duracionMs: number; ahora: number }
  | { tipo: 'fijar_inicio'; ms: number; ahora: number }
  | { tipo: 'fijar_fin'; ms: number; duracionMs: number; ahora: number }
  | { tipo: 'confirmar_marcador'; gesto: GestoMarcador; ahora: number }
  | { tipo: 'fin_automatico'; ahora: number }
  | { tipo: 'borrar_tiempos'; ahora: number }
  | { tipo: 'desplazar'; deltaMs: number; ahora: number; grupo?: string }
  | { tipo: 'fijar_desplazamiento'; ms: number; ahora: number }
  | { tipo: 'estilo'; estilo: Estilo; clave: string; ahora: number; agruparGesto?: boolean }
  | {
      tipo: 'estilo_borrador'
      estilo: Estilo
      clave: string
      ahora: number
      agruparGesto?: boolean
    }
  /** Elegir tema, heredar, personalizar o volver a «Temas definidos»: un paso de deshacer. */
  | { tipo: 'apariencia'; apariencia: AparienciaEditor; clave: string; ahora: number }
  /** Entrar en D3 (no es un paso del historial). */
  | { tipo: 'entrar_borrador'; borrador: BorradorTema }
  /** Salir de D3 (guardar, descartar o guardar como nuevo): retira los pasos del borrador. */
  | { tipo: 'salir_borrador' }
  /**
   * Un tema deja de existir (T20): se retiran los pasos que lo asignarían. Con `estilo`, la canción
   * estaba afectada y pasa a estilo propio (lo ha escrito main; no entra en el historial ni se guarda).
   */
  | { tipo: 'tema_eliminado'; temaId: string; estilo: Estilo | null }
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

export function estadoInicial(actual: InstantaneaInicial, seleccion: string | null): EstadoEditor {
  return {
    actual: { ...actual, borrador: actual.borrador ?? null },
    seleccion,
    pasado: [],
    futuro: [],
    sync: { activo: false, sesion: 0, siguiente: null },
    aviso: null,
    version: 0,
    cambiosEnVisita: false
  }
}

// En D3 solo se recorren los pasos hechos dentro del borrador: nunca se sale de D3 ni se toca el catálogo.
export const puedeDeshacer = (e: EstadoEditor): boolean => {
  const ultima = e.pasado.at(-1)
  return ultima !== undefined && (e.actual.borrador === null || ultima.antes.borrador !== null)
}
export const puedeRehacer = (e: EstadoEditor): boolean => {
  const ultima = e.futuro.at(-1)
  return ultima !== undefined && (e.actual.borrador === null || ultima.borrador !== null)
}

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

function cambiarTiempos(
  e: EstadoEditor,
  r: ResultadoTiempos,
  clave: string,
  ahora: number,
  agruparGesto?: boolean
) {
  const siguiente = conAviso(e, r, e.seleccion)
  return r.cambiado
    ? guardarPaso(siguiente, { ...e.actual, letra: r.letra }, clave, ahora, { agruparGesto })
    : siguiente
}

function esLinea(letra: Letra, id: string | null): id is string {
  return id !== null && letra.lineas.some((l) => l.id === id && l.tipo === 'linea')
}

export function iniciarGestoMarcador(
  e: EstadoEditor,
  borde: GestoMarcador['borde'],
  duracionMs: number
): GestoMarcador | null {
  const letraBase = e.actual.letra
  const linea = letraBase.lineas.find((l) => l.id === e.seleccion && l.tipo === 'linea')
  if (e.sync.activo || !linea || linea.inicio_ms === null) return null
  const tiempoOriginalMs =
    borde === 'inicio' ? linea.inicio_ms : finEfectivo(letraBase, linea.id, duracionMs)
  if (tiempoOriginalMs === null) return null
  return {
    id: linea.id,
    borde,
    letraBase,
    version: e.version,
    sesionSync: e.sync.sesion,
    tiempoOriginalMs,
    duracionMs,
    resultado: null
  }
}

export function gestoMarcadorVigente(e: EstadoEditor, gesto: GestoMarcador): boolean {
  return (
    !e.sync.activo &&
    e.sync.sesion === gesto.sesionSync &&
    e.seleccion === gesto.id &&
    e.version === gesto.version &&
    e.actual.letra === gesto.letraBase
  )
}

export function moverGestoMarcador(gesto: GestoMarcador, msAudio: number): GestoMarcador {
  if (!Number.isFinite(msAudio)) return gesto
  const { letraBase, tiempoOriginalMs, borde, id, duracionMs } = gesto
  const delta = Math.round(tiempoAudioALetra(msAudio, letraBase.offset_ms)) - tiempoOriginalMs
  if (delta === 0) return { ...gesto, resultado: null }

  const resultado =
    borde === 'inicio'
      ? ajustarInicio(letraBase, id, delta)
      : ajustarFin(letraBase, id, delta, duracionMs)
  if (
    borde === 'fin' &&
    resultado.limite &&
    resultado.letra.lineas.find((l) => l.id === id)?.fin_ms === tiempoOriginalMs
  ) {
    // Si el fin automático ya estaba en el límite, el borde no se movió.
    return { ...gesto, resultado: { ...resultado, letra: letraBase, cambiado: false } }
  }
  return { ...gesto, resultado }
}

export function ultimaMarcaDeSesion(e: EstadoEditor): { id: string; ms: number } | null {
  const ultima = e.pasado.at(-1)
  if (!e.sync.activo || !ultima?.marcaId || ultima.sesionSync !== e.sync.sesion) return null
  const ms = e.actual.letra.lineas.find((l) => l.id === ultima.marcaId)?.inicio_ms
  return ms == null ? null : { id: ultima.marcaId, ms }
}

function deshacer(e: EstadoEditor): EstadoEditor {
  const entrada = e.pasado.at(-1)
  if (!entrada || !puedeDeshacer(e)) return e
  const { antes, ...origen } = entrada
  return {
    ...aplicar(e, antes),
    pasado: e.pasado.slice(0, -1),
    futuro: [...e.futuro, { ...e.actual, origen }]
  }
}

function rehacer(e: EstadoEditor): EstadoEditor {
  const entrada = e.futuro.at(-1)
  if (!entrada || !puedeRehacer(e)) return e
  const { origen, ...actual } = entrada
  return {
    ...aplicar(e, actual),
    pasado: [...e.pasado, { antes: e.actual, ...origen }],
    futuro: e.futuro.slice(0, -1)
  }
}

/** Quita los pasos del borrador y deja el resto sin rastro de él (el borrador ya no existe). */
function sinBorrador(e: EstadoEditor): EstadoEditor {
  const normal = (i: Instantanea): Instantanea => ({ ...i, borrador: null })
  return {
    ...e,
    actual: normal(e.actual),
    pasado: e.pasado
      .filter((p) => !p.clave.startsWith(CLAVE_BORRADOR))
      .map((p) => ({ ...p, antes: normal(p.antes) })),
    futuro: e.futuro
      .filter((f) => !f.origen.clave.startsWith(CLAVE_BORRADOR))
      .map((f) => ({ ...normal(f), origen: f.origen })),
    version: e.version + 1
  }
}

const asignaTema = (i: Instantanea, temaId: string): boolean =>
  i.apariencia.seleccion.modo === 'tema' && i.apariencia.seleccion.temaId === temaId

export function reducirEditor(e: EstadoEditor, a: AccionEditor): EstadoEditor {
  const { letra, apariencia, borrador } = e.actual
  const estilo = apariencia.estilo
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
    case 'confirmar_marcador':
      return a.gesto.resultado && gestoMarcadorVigente(e, a.gesto)
        ? cambiarTiempos(
            e,
            a.gesto.resultado,
            unica(`marcador:${a.gesto.borde}:${a.gesto.id}`),
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
      return cambiarTiempos(
        e,
        desplazar(letra, a.deltaMs),
        a.grupo === undefined ? 'desplazamiento' : `desplazamiento:prueba:${a.grupo}`,
        a.ahora,
        a.grupo !== undefined
      )
    case 'fijar_desplazamiento':
      return cambiarTiempos(e, fijarDesplazamiento(letra, a.ms), 'desplazamiento', a.ahora)
    case 'estilo':
      return e.sync.activo ||
        borrador !== null ||
        apariencia.seleccion.modo !== 'propio' ||
        mismoJson(estilo, a.estilo)
        ? e
        : guardarPaso(
            e,
            { ...e.actual, apariencia: { ...apariencia, estilo: a.estilo } },
            `estilo:${a.clave}`,
            a.ahora,
            { agruparGesto: a.agruparGesto }
          )
    case 'estilo_borrador':
      return e.sync.activo || borrador === null || mismoJson(borrador.estilo, a.estilo)
        ? e
        : guardarPaso(
            e,
            { ...e.actual, borrador: { ...borrador, estilo: a.estilo } },
            `${CLAVE_BORRADOR}${a.clave}`,
            a.ahora,
            { agruparGesto: a.agruparGesto }
          )
    case 'apariencia':
      return e.sync.activo || borrador !== null || mismoJson(apariencia, a.apariencia)
        ? e
        : guardarPaso(
            e,
            { ...e.actual, apariencia: a.apariencia },
            `apariencia:${a.clave}:${e.version}`,
            a.ahora
          )
    case 'entrar_borrador':
      return borrador !== null || e.sync.activo
        ? e
        : { ...e, actual: { ...e.actual, borrador: a.borrador }, version: e.version + 1 }
    case 'salir_borrador':
      return borrador === null ? e : sinBorrador(e)
    case 'tema_eliminado': {
      // Los pasos de selección que lo asignarían se retiran; en los demás, la asignación se
      // sustituye por el estilo propio, para que deshacer o rehacer nunca vuelva a vincularlo.
      const propia = (i: Instantanea): Instantanea =>
        asignaTema(i, a.temaId)
          ? { ...i, apariencia: aparienciaPropia(a.estilo ?? i.apariencia.estilo) }
          : i
      const esSeleccion = (clave: string) => clave.startsWith('apariencia:')
      const retirado: EstadoEditor = {
        ...e,
        pasado: e.pasado
          .filter((p) => !(asignaTema(p.antes, a.temaId) && esSeleccion(p.clave)))
          .map((p) => ({ ...p, antes: propia(p.antes) })),
        futuro: e.futuro
          .filter((f) => !(asignaTema(f, a.temaId) && esSeleccion(f.origen.clave)))
          .map((f) => ({ ...propia(f), origen: f.origen }))
      }
      return a.estilo === null
        ? retirado
        : { ...retirado, actual: { ...e.actual, apariencia: aparienciaPropia(a.estilo) } }
    }
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
      const marcada = usarFinAutomatico(r.letra, marcaId).letra
      const nueva = guardarPaso(
        base,
        { ...e.actual, letra: marcada },
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
