import type { Espera } from '@shared/espera'
import type { Pantalla } from '@shared/pantalla'
import type { Estilo } from '@shared/estilo'
import type { SeleccionApariencia } from '@shared/ipc'
import { finEfectivo, tienePalabrasManuales, type Letra } from '@shared/letra'
import {
  ajustarFin,
  ajustarInicio,
  borrarTiempos,
  fijarFin,
  fijarInicio,
  lineaVecina,
  marcarInicioLinea,
  primeraSinInicio,
  usarFinAutomatico,
  type Limite,
  type ResultadoTiempos
} from '@shared/letras/tiempos'
import { aplicarEdicionPrecisa, type BorradorLinea } from '@shared/letras/palabras'
import type { PropuestaSilencios } from '@shared/silencios'
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
  /** Reemplazos de la canción sobre el tema (ADR 0018 §3): solo con `tema` o `heredar`. */
  reemplazos: ReemplazosEditor | null
}

export type ReemplazosEditor = { espera?: Espera; pantalla?: Pantalla }

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
  estilo,
  reemplazos: null
})

export function aSeleccionIpc(apariencia: AparienciaEditor): SeleccionApariencia {
  const { seleccion, estilo, reemplazos } = apariencia
  if (seleccion.modo === 'propio') return { modo: 'propio', estilo }
  // `reemplazo_pantalla` es una clave hermana (ADR 0022 §1): `reemplazos` solo lleva la espera.
  const espera = reemplazos?.espera ? { espera: reemplazos.espera } : null
  const aparte = { reemplazos: espera, reemplazo_pantalla: reemplazos?.pantalla ?? null }
  return seleccion.modo === 'tema'
    ? { modo: 'tema', temaId: seleccion.temaId, ...aparte }
    : { modo: 'heredar', ...aparte }
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
  // `limite` e `id` ausentes: los consumidores del aviso de límite lo leen sin discriminar.
  | { tipo: 'propuesta_obsoleta'; limite?: undefined; id?: undefined }
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
  /** «Aplicar» del editor preciso: texto, límites y palabras de una línea en un solo paso (ADR 0021 §9). */
  | {
      tipo: 'aplicar_preciso'
      id: string
      borrador: BorradorLinea
      duracionMs: number
      ahora: number
    }
  | { tipo: 'borrar_tiempos'; ahora: number }
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
  /** Espera de la canción: `estilo.espera` con `propio`, `reemplazos.espera` con `tema` o `heredar`. */
  | { tipo: 'espera'; espera: Espera | null; clave: string; ahora: number }
  /** Letra en pantalla de la canción: `estilo.pantalla` con `propio`, `reemplazos.pantalla` con `tema` o `heredar`. */
  | { tipo: 'pantalla'; pantalla: Pantalla | null; clave: string; ahora: number }
  /** Aplica la propuesta de ajuste de silencios como un solo paso (ADR 0018 §6.3). */
  | {
      tipo: 'ajustar_silencios'
      propuesta: PropuestaSilencios
      versionCalculo: number
      ahora: number
    }
  /**
   * Corregir el desfase o quitar la corrección (ADR 0024 §1): cambia `offset_ms` y
   * `desfase_corregido_ms` de toda la letra en un solo paso. Retira `revisada` de todas las líneas
   * (ADR 0024, revisión 2026-11-22; pregunta 0172). Ningún tiempo de línea cambia.
   */
  | { tipo: 'cambiar_desfase'; offsetMs: number; desfaseCorregidoMs: number | null; ahora: number }
  /**
   * «Está bien» de la revisión guiada (ADR 0024 §4): anota en la línea lo que había al darla por buena.
   * Un paso del historial. No vale para una línea sin inicio.
   */
  | { tipo: 'marcar_revisada'; id: string; duracionMs: number; ahora: number }
  /** «Volver a señalarlas»: quita todas las marcas «está bien», en un solo paso. */
  | { tipo: 'reiniciar_revisadas'; ahora: number }
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

/** Una edición manual que cambia el fin de una línea le quita su `origen_fin` automático (ADR 0024 §4). */
function sinOrigenFinCambiado(antes: Letra, despues: Letra): Letra {
  const previo = new Map(antes.lineas.map((l) => [l.id, l.fin_ms]))
  if (!despues.lineas.some((l) => l.origen_fin && previo.get(l.id) !== l.fin_ms)) return despues
  return {
    ...despues,
    lineas: despues.lineas.map((l) => {
      if (!l.origen_fin || previo.get(l.id) === l.fin_ms) return l
      const copia = { ...l }
      delete copia.origen_fin
      return copia
    })
  }
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
    ? guardarPaso(
        siguiente,
        { ...e.actual, letra: sinOrigenFinCambiado(e.actual.letra, r.letra) },
        clave,
        ahora,
        { agruparGesto }
      )
    : siguiente
}

/** La apariencia con la espera cambiada donde corresponde al modo; `null` quita el reemplazo. */
function conEspera(ap: AparienciaEditor, espera: Espera | null): AparienciaEditor {
  if (ap.seleccion.modo === 'propio') {
    const estilo = { ...ap.estilo, espera: espera ?? undefined }
    if (!espera) delete estilo.espera
    return { ...ap, estilo }
  }
  return { ...ap, reemplazos: conReemplazo(ap.reemplazos, { espera: espera ?? undefined }) }
}

/** Suma o quita (`undefined`) un reemplazo sin tocar el otro; sin ninguno, `null`. */
function conReemplazo(
  actual: ReemplazosEditor | null,
  cambio: ReemplazosEditor
): ReemplazosEditor | null {
  const unido = { ...actual, ...cambio }
  if (!unido.espera) delete unido.espera
  if (!unido.pantalla) delete unido.pantalla
  return unido.espera || unido.pantalla ? unido : null
}

/** La apariencia con la letra en pantalla cambiada donde corresponde al modo; `null` quita el reemplazo. */
function conPantalla(ap: AparienciaEditor, pantalla: Pantalla | null): AparienciaEditor {
  if (ap.seleccion.modo === 'propio') {
    const estilo = { ...ap.estilo, pantalla: pantalla ?? undefined }
    if (!pantalla) delete estilo.pantalla
    return { ...ap, estilo }
  }
  return { ...ap, reemplazos: conReemplazo(ap.reemplazos, { pantalla: pantalla ?? undefined }) }
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
    case 'aplicar_preciso': {
      if (e.sync.activo || !esLinea(letra, a.id)) return e
      let nueva: Letra
      try {
        nueva = aplicarEdicionPrecisa(letra, a.id, a.borrador, a.duracionMs)
      } catch {
        return e
      }
      return guardarPaso(
        e,
        { ...e.actual, letra: sinOrigenFinCambiado(letra, nueva) },
        unica(`preciso:${a.id}`),
        a.ahora
      )
    }
    case 'borrar_tiempos':
      return !e.sync.activo && esLinea(letra, id)
        ? cambiarTiempos(e, borrarTiempos(letra, id), unica(`borrar:${id}`), a.ahora)
        : e
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
    case 'espera': {
      const nueva = conEspera(apariencia, a.espera)
      return e.sync.activo || borrador !== null || mismoJson(apariencia, nueva)
        ? e
        : guardarPaso(e, { ...e.actual, apariencia: nueva }, `espera:${a.clave}`, a.ahora)
    }
    case 'pantalla': {
      const nueva = conPantalla(apariencia, a.pantalla)
      return e.sync.activo || borrador !== null || mismoJson(apariencia, nueva)
        ? e
        : guardarPaso(e, { ...e.actual, apariencia: nueva }, `pantalla:${a.clave}`, a.ahora)
    }
    case 'ajustar_silencios': {
      if (e.sync.activo || borrador !== null) return e
      if (a.versionCalculo !== e.version) {
        return { ...e, aviso: { tipo: 'propuesta_obsoleta', n: (e.aviso?.n ?? 0) + 1 } }
      }
      const { propuesta } = a
      if (propuesta.lineasCambiadas === 0 && !propuesta.espera) return e
      const nueva = propuesta.espera ? conEspera(apariencia, propuesta.espera) : apariencia
      // Regla 8.2: las líneas que pierden palabras hechas a mano lo avisan con su toast [Deshacer].
      const perdidas = propuesta.cambios
        .filter((c) => letra.lineas.some((l) => l.id === c.id && tienePalabrasManuales(l)))
        .map((c) => c.id)
      const conAvisoPalabras: EstadoEditor = perdidas.length
        ? {
            ...e,
            aviso: {
              tipo: 'consecuencias',
              palabrasDescartadas: perdidas,
              finesAutomaticos: [],
              n: (e.aviso?.n ?? 0) + 1
            }
          }
        : e
      return guardarPaso(
        conAvisoPalabras,
        { ...e.actual, letra: propuesta.letra, apariencia: nueva },
        unica('ajustar_silencios'),
        a.ahora
      )
    }
    case 'cambiar_desfase': {
      if (e.sync.activo) return e
      const mismo =
        a.offsetMs === letra.offset_ms &&
        (a.desfaseCorregidoMs ?? undefined) === letra.desfase_corregido_ms
      if (mismo) return e
      // Una línea dada por buena antes de mover la letra ya no está comprobada en su sitio nuevo.
      const quitarRevisada = a.offsetMs !== letra.offset_ms
      const lineas = letra.lineas.map((l) => {
        if (!quitarRevisada || !l.revisada) return l
        const sinMarca = { ...l }
        delete sinMarca.revisada
        return sinMarca
      })
      const nueva: Letra = { ...letra, offset_ms: a.offsetMs, lineas }
      if (a.desfaseCorregidoMs === null) delete nueva.desfase_corregido_ms
      else nueva.desfase_corregido_ms = a.desfaseCorregidoMs
      return guardarPaso(e, { ...e.actual, letra: nueva }, unica('desfase'), a.ahora)
    }
    case 'marcar_revisada': {
      if (e.sync.activo || !esLinea(letra, a.id)) return e
      const el = letra.lineas.find((l) => l.id === a.id)!
      const fin = finEfectivo(letra, a.id, a.duracionMs)
      if (el.inicio_ms === null || fin === null) return e
      const revisada = { inicio_ms: el.inicio_ms, fin_ms: fin, texto: el.texto }
      if (mismoJson(el.revisada, revisada)) return e
      const lineas = letra.lineas.map((l) => (l.id === a.id ? { ...l, revisada } : l))
      return guardarPaso(
        e,
        { ...e.actual, letra: { ...letra, lineas } },
        unica(`bien:${a.id}`),
        a.ahora
      )
    }
    case 'reiniciar_revisadas': {
      if (e.sync.activo || !letra.lineas.some((l) => l.revisada)) return e
      const lineas = letra.lineas.map((l) => {
        if (!l.revisada) return l
        const sinMarca = { ...l }
        delete sinMarca.revisada
        return sinMarca
      })
      return guardarPaso(
        e,
        { ...e.actual, letra: { ...letra, lineas } },
        unica('reiniciar'),
        a.ahora
      )
    }
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
      const marcada = sinOrigenFinCambiado(letra, usarFinAutomatico(r.letra, marcaId).letra)
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
      return r.cambiado
        ? aplicar(e, { ...e.actual, letra: sinOrigenFinCambiado(letra, r.letra) })
        : e
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
