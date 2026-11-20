import type { CodigoError } from '../../shared/errores'
import {
  MAXIMO_PENDIENTES,
  MOTIVOS_NO_DISPONIBLE,
  POSICION_MS_MAX,
  POSICION_MS_MIN,
  type EntradaIpc,
  type FaseSesion,
  type IncidenciaFueraDeSesion,
  type IncidenciaSesion,
  type InformeSecundariaIpc,
  type MotivoFallo,
  type MotivoNoDisponible,
  type PantallaIpc
} from '../../shared/sesion'
import * as Cola from './cola'
import { ErrorCola, type DatosEntrada, type DondeCola, type EstadoCola } from './cola'

/**
 * Máquina de la sesión en vivo (ADR 0017 §5, §7 y §8): `reducir(estado, evento, ahoraMs)` devuelve el
 * estado nuevo y los efectos que debe ejecutar `ServicioSesion` (0181). Es pura: no usa Electron,
 * disco ni temporizadores. `ahoraMs` es un reloj monotónico (el `performance.now()` de main).
 *
 * Convenciones:
 * - Si un evento no cambia nada, el estado devuelto es **la misma referencia** y no hay efectos.
 * - La revisión sube con cada cambio observable (no con la posición ni con las operaciones nulas) y
 *   en ese caso se añade el efecto `difundir`.
 * - Un fallo de operación (`COLA_LLENA`, `CONFIRMACION_OBSOLETA`…) devuelve el estado intacto y `error`.
 */

// --- Tipos -------------------------------------------------------------------------------------

/** Dependencias inyectadas: el generador de ids y la lectura de `config.reproductor.transicion_s`. */
export interface Entorno {
  nuevoId: () => string
  /** Segundos de la cuenta; se lee al empezar cada cuenta. */
  transicionS: () => number
}

type RolOrigen = 'principal' | 'secundaria'

interface Transicion {
  transicionId: string
  candidataId: string
  /** Duración fijada al empezar; un reinicio por cambio de candidata la conserva. */
  duracionMs: number
  venceMs: number
  /** Con el cierre pendiente, lo que quedaba al pedirlo (no corre). */
  restanteCongeladoMs: number | null
}

interface Reproduccion {
  posicionMs: number
  /** Instante (reloj de main) del último informe de posición. */
  instanteMs: number
  duracionMs: number
}

interface ErrorActiva {
  entradaId: string
  motivo: MotivoFallo
  codigo: string
}

export type InicioApertura =
  | { tipo: 'cancion'; cancionId: string; titulo: string; artista: string }
  | { tipo: 'cola' }
  | { tipo: 'reanudar' }

export interface Sesion {
  sesionId: string
  fase: FaseSesion
  pantalla: PantallaIpc | null
  pantallaCompleta: boolean
  cierrePendiente: { origen: RolOrigen } | null
  /** Opción elegida al confirmar el cierre (o `eliminar` si no había pendientes). */
  cierre: { cola: 'eliminar' | 'conservar' } | null
  transicion: Transicion | null
  error: ErrorActiva | null
  incidencia: IncidenciaSesion | null
  /** Cómo empezar cuando el documento esté listo; solo en `abriendo`. */
  apertura: InicioApertura | null
  /** Posición a la que reanudar la activa mientras se revalida. */
  reanudacion: { posicionMs: number; pausada: boolean } | null
  reproduccion: Reproduccion
}

export interface EstadoMaquina {
  readonly entorno: Entorno
  revision: number
  cola: EstadoCola
  sesion: Sesion | null
  /** Incidencia fuera de sesión (se muestra al volver a abrir). */
  incidencia: IncidenciaFueraDeSesion | null
}

export function crearEstado(entorno: Entorno): EstadoMaquina {
  return { entorno, revision: 0, cola: Cola.colaVacia(), sesion: null, incidencia: null }
}

/** Comandos a la secundaria (§7). El servicio añade `sesionId` y `revision`, y completa `cargar` con el DTO. */
export type ComandoMaquina =
  | {
      tipo: 'cargar'
      entradaId: string
      cancionId: string
      desdeMs: number
      pausada: boolean
      anuncio: 'inicio' | 'reanudacion'
    }
  | { tipo: 'pausar'; entradaId: string; causa: string }
  | { tipo: 'reanudar'; entradaId: string }
  | { tipo: 'reiniciar'; entradaId: string }
  | {
      tipo: 'transicion'
      transicion: {
        candidata: { titulo: string; artista: string }
        restanteMs: number
        duracionMs: number
      } | null
    }
  | { tipo: 'fin_de_cola' }
  | { tipo: 'error'; motivo: MotivoFallo }

export type Efecto =
  | { tipo: 'comando'; comando: ComandoMaquina }
  | { tipo: 'programar'; transicionId: string; ms: number }
  | { tipo: 'cancelar'; transicionId: string }
  | { tipo: 'revalidar'; entradaId: string; cancionId: string }
  | { tipo: 'difundir' }
  | { tipo: 'bloquearEdicion' }
  | { tipo: 'liberarEdicion' }
  | { tipo: 'cerrarVentana' }
  | { tipo: 'guardarPreferenciaPantalla'; pantalla: PantallaIpc; pantallaCompleta: boolean }

export type CausaCierre = 'confirmada' | 'forzada' | 'caida' | 'salida'

export type Evento =
  // Apertura: `abrir` (aceptada la petición) → `aceptadaApertura` (ventana creada en la pantalla)
  // → `documentoListo` (el documento de la secundaria cargó y pidió `sesion.inicial`).
  | { tipo: 'abrir'; sesionId: string; inicio: InicioApertura }
  | {
      tipo: 'aceptadaApertura'
      sesionId: string
      pantalla: PantallaIpc | null
      pantallaCompleta: boolean
    }
  | { tipo: 'documentoListo'; sesionId: string }
  | { tipo: 'informe'; informe: InformeSecundariaIpc }
  /** Resultado de `revalidar`. `primeraLineaMs` decide si una reanudación empieza desde el principio. */
  | {
      tipo: 'revalidada'
      entradaId: string
      resultado: 'ok' | MotivoNoDisponible
      duracionMs?: number
      primeraLineaMs?: number
    }
  | { tipo: 'vencida'; transicionId: string }
  // Cola
  | ({ tipo: 'agregar'; donde: DondeCola } & DatosEntrada)
  | { tipo: 'mover'; entradaId: string; antesDe: string | null }
  | { tipo: 'quitar'; entradaId: string }
  | { tipo: 'vaciar'; contexto: boolean }
  // Biblioteca
  | { tipo: 'disponibilidad'; cancionId: string; motivo: MotivoNoDisponible | 'ok' }
  | { tipo: 'cancionEliminada'; cancionId: string }
  | { tipo: 'titulos'; cancionId: string; titulo: string; artista: string }
  // Control de la sesión
  | { tipo: 'siguiente'; desdeEntradaId: string }
  | { tipo: 'empezar'; candidataId: string }
  | { tipo: 'detenerTransicion'; transicionId: string }
  | { tipo: 'repetir'; entradaId: string }
  | { tipo: 'transporte'; accion: 'pausar' | 'reanudar' | 'reiniciar'; entradaId: string }
  // Cierre
  | { tipo: 'solicitarCierre'; origen: RolOrigen }
  | { tipo: 'confirmarCierre'; cola: 'eliminar' | 'conservar'; revision: number }
  | { tipo: 'cancelarCierre' }
  | { tipo: 'cerrada'; causa: CausaCierre }
  // Pantallas y respuesta de la secundaria
  | {
      tipo: 'pantalla'
      cambio:
        | {
            tipo: 'perdida'
            etiqueta: string
            estabaEnPantallaCompleta: boolean
            /** Dónde se recolocó la ventana (null si no se sabe). */
            pantalla: PantallaIpc | null
          }
        | { tipo: 'reconectada'; etiqueta: string; pantallaId: number }
        /** Movida a petición del operador: limpia la incidencia de pantalla. */
        | { tipo: 'movida'; pantalla: PantallaIpc | null; pantallaCompleta: boolean }
    }
  | { tipo: 'responde'; responde: boolean }

export interface Resultado {
  estado: EstadoMaquina
  efectos: Efecto[]
  /** Operación rechazada: el estado no cambia. */
  error?: CodigoError
  /** `informe`: si se aplicó (false: tardío, duplicado o de otra sesión). */
  aplicado?: boolean
  /** `agregar`: id de la entrada creada. */
  entradaId?: string
  /** `quitar`: la entrada que seguía a la quitada. */
  antesDe?: string | null
}

// --- Auxiliares ---------------------------------------------------------------------------------

type Salida = Omit<Resultado, 'efectos'> & { observable?: boolean }
type Efectos = Efecto[]

const salida = (estado: EstadoMaquina, extra: Omit<Salida, 'estado'> = {}): Salida => ({
  estado,
  ...extra
})
const rechazo = (estado: EstadoMaquina, error: CodigoError): Salida => ({ estado, error })

const conSesion = (e: EstadoMaquina, parche: Partial<Sesion>): EstadoMaquina =>
  e.sesion ? { ...e, sesion: { ...e.sesion, ...parche } } : e
const conCola = (e: EstadoMaquina, cola: EstadoCola): EstadoMaquina =>
  cola === e.cola ? e : { ...e, cola }

const acotar = (valor: number, min: number, max: number): number =>
  Math.round(Math.min(max, Math.max(min, valor)))

const FASES_EN_CURSO: readonly FaseSesion[] = ['cargando', 'reproduciendo', 'pausada']

const esNoDisponible = (m: string): m is MotivoNoDisponible =>
  (MOTIVOS_NO_DISPONIBLE as readonly string[]).includes(m)

/** Posición actual de la activa: la última informada, extrapolada si está sonando. */
export function posicionActual(s: Sesion, ahoraMs: number): number {
  const r = s.reproduccion
  const extra = s.fase === 'reproduciendo' ? ahoraMs - r.instanteMs : 0
  const tope = r.duracionMs > 0 ? r.duracionMs : POSICION_MS_MAX
  return acotar(r.posicionMs + extra, POSICION_MS_MIN, tope)
}

/** Lo que queda de la cuenta; congelado mientras el cierre está pendiente. */
export function restanteTransicion(t: Transicion, ahoraMs: number): number {
  return t.restanteCongeladoMs ?? Math.max(0, Math.round(t.venceMs - ahoraMs))
}

const reproduccionInicial = (posicionMs: number, ahoraMs: number): Reproduccion => ({
  posicionMs,
  instanteMs: ahoraMs,
  duracionMs: 0
})

// --- Transiciones de fase ---------------------------------------------------------------------

function cancelarTemporizador(e: EstadoMaquina, ef: Efectos): void {
  const t = e.sesion?.transicion
  if (t && t.restanteCongeladoMs === null) {
    ef.push({ tipo: 'cancelar', transicionId: t.transicionId })
  }
}

function aFinDeCola(e: EstadoMaquina, ef: Efectos): EstadoMaquina {
  cancelarTemporizador(e, ef)
  ef.push({ tipo: 'comando', comando: { tipo: 'fin_de_cola' } })
  return conSesion(e, { fase: 'fin_de_cola', transicion: null, error: null })
}

function aError(e: EstadoMaquina, error: ErrorActiva, ef: Efectos): EstadoMaquina {
  cancelarTemporizador(e, ef)
  ef.push({ tipo: 'comando', comando: { tipo: 'error', motivo: error.motivo } })
  return conSesion(e, { fase: 'error', transicion: null, error })
}

const errorDeCandidata = (c: EntradaIpc): ErrorActiva => ({
  entradaId: c.entradaId,
  motivo: c.disponibilidad === 'ok' ? 'otro' : c.disponibilidad,
  codigo: 'CANCION_NO_DISPONIBLE'
})

/**
 * Empieza la cuenta hacia la candidata (fin natural, `siguiente`, añadir con la cola agotada y reinicio
 * por cambio de candidata). La comprobación es por índice, sin disco (§7). `duracionMs` solo se pasa en
 * un reinicio, para conservar la duración original aunque `transicion_s` haya cambiado.
 */
function iniciarCuenta(
  e: EstadoMaquina,
  ahoraMs: number,
  ef: Efectos,
  duracionMs?: number
): EstadoMaquina {
  const candidata = Cola.candidata(e.cola)
  if (!candidata) return aFinDeCola(e, ef)
  if (candidata.disponibilidad !== 'ok') return aError(e, errorDeCandidata(candidata), ef)
  cancelarTemporizador(e, ef)
  const duracion = duracionMs ?? Math.round(e.entorno.transicionS() * 1000)
  const congelada = e.sesion?.cierrePendiente != null
  const transicion: Transicion = {
    transicionId: e.entorno.nuevoId(),
    candidataId: candidata.entradaId,
    duracionMs: duracion,
    venceMs: ahoraMs + duracion,
    restanteCongeladoMs: congelada ? duracion : null
  }
  if (!congelada)
    ef.push({ tipo: 'programar', transicionId: transicion.transicionId, ms: duracion })
  ef.push({
    tipo: 'comando',
    comando: {
      tipo: 'transicion',
      transicion: {
        candidata: { titulo: candidata.titulo, artista: candidata.artista },
        restanteMs: duracion,
        duracionMs: duracion
      }
    }
  })
  return conSesion(e, { fase: 'transicion', transicion, error: null })
}

/** La entrada pasa a activa y se revalida (§7); `cargar` sale al llegar `revalidada`. */
function consumir(
  e: EstadoMaquina,
  ahoraMs: number,
  ef: Efectos,
  entrada: EntradaIpc,
  reanudacion: Sesion['reanudacion'] = null
): EstadoMaquina {
  cancelarTemporizador(e, ef)
  ef.push({ tipo: 'revalidar', entradaId: entrada.entradaId, cancionId: entrada.cancionId })
  const cola: EstadoCola = {
    ...e.cola,
    activa: entrada,
    pendientes: e.cola.pendientes.filter((p) => p.entradaId !== entrada.entradaId)
  }
  return conSesion(
    { ...e, cola },
    {
      fase: 'cargando',
      transicion: null,
      error: null,
      reanudacion,
      reproduccion: reproduccionInicial(0, ahoraMs)
    }
  )
}

/**
 * Adapta la sesión a un cambio de la cola (§7 «Durante la transición»): misma candidata, la cuenta
 * sigue; otra, se reinicia con la duración original; ninguna, fin de cola; no disponible, error.
 * Con la cola agotada, añadir arranca la cuenta (0059-3B); en `espera` no.
 */
function reajustar(e: EstadoMaquina, ahoraMs: number, ef: Efectos): EstadoMaquina {
  const s = e.sesion
  if (!s) return e
  const candidata = Cola.candidata(e.cola)
  if (s.fase === 'transicion' && s.transicion) {
    if (!candidata) return aFinDeCola(e, ef)
    if (candidata.disponibilidad !== 'ok') return aError(e, errorDeCandidata(candidata), ef)
    if (candidata.entradaId === s.transicion.candidataId) return e
    return iniciarCuenta(e, ahoraMs, ef, s.transicion.duracionMs)
  }
  if (s.fase === 'fin_de_cola' && candidata && !s.cierrePendiente) {
    return iniciarCuenta(e, ahoraMs, ef)
  }
  if (s.fase === 'error' && s.error) {
    const id = s.error.entradaId
    if (id === e.cola.activa?.entradaId || id === candidata?.entradaId) return e
    // La fallida ya no está (se quitó o se eliminó): espera, sin avanzar sola.
    return conSesion(e, { fase: 'espera', error: null })
  }
  return e
}

// --- Cierre -----------------------------------------------------------------------------------

/** Lo que queda de la cola al conservar: la activa que sonaba pasa a contexto reanudable (§8). */
function conservarCola(cola: EstadoCola, s: Sesion, ahoraMs: number): EstadoCola {
  const activa = cola.activa
  if (!activa) return cola
  const sinActiva = { ...cola, activa: null }
  if (s.fase === 'reproduciendo' || s.fase === 'pausada') {
    return {
      ...sinActiva,
      contexto: {
        entrada: activa,
        posicionMs: posicionActual(s, ahoraMs),
        pausada: s.fase === 'pausada',
        terminada: false
      }
    }
  }
  if (s.fase === 'cargando' && s.reanudacion) {
    return {
      ...sinActiva,
      contexto: { entrada: activa, ...s.reanudacion, terminada: false }
    }
  }
  // Sin sonar todavía (cargando) o fallida: vuelve al frente de las pendientes.
  const motivo = s.error?.motivo
  const devuelta: EntradaIpc =
    s.fase === 'error' && motivo && esNoDisponible(motivo)
      ? { ...activa, disponibilidad: motivo }
      : activa
  return { ...sinActiva, pendientes: [devuelta, ...cola.pendientes] }
}

function finalizarSesion(
  e: EstadoMaquina,
  causa: CausaCierre,
  ahoraMs: number,
  ef: Efectos
): EstadoMaquina {
  const s = e.sesion
  if (!s) return e
  cancelarTemporizador(e, ef)
  const eliminar = causa === 'confirmada' && s.cierre?.cola === 'eliminar'
  const cola = eliminar ? Cola.colaVacia() : conservarCola(e.cola, s, ahoraMs)
  ef.push({ tipo: 'liberarEdicion' })
  return {
    ...e,
    cola,
    sesion: null,
    incidencia: causa === 'caida' ? { tipo: 'secundaria_caida' } : null
  }
}

// --- Eventos ----------------------------------------------------------------------------------

function abrir(e: EstadoMaquina, ev: Extract<Evento, { tipo: 'abrir' }>, ef: Efectos): Salida {
  if (e.sesion) return rechazo(e, 'SESION_EN_CURSO')
  if (ev.inicio.tipo === 'cancion' && e.cola.pendientes.length >= MAXIMO_PENDIENTES) {
    return rechazo(e, 'COLA_LLENA')
  }
  ef.push({ tipo: 'bloquearEdicion' })
  const sesion: Sesion = {
    sesionId: ev.sesionId,
    fase: 'abriendo',
    pantalla: null,
    pantallaCompleta: false,
    cierrePendiente: null,
    cierre: null,
    transicion: null,
    error: null,
    incidencia: null,
    apertura: ev.inicio,
    reanudacion: null,
    reproduccion: reproduccionInicial(0, 0)
  }
  return salida({ ...e, sesion, incidencia: null })
}

function aceptadaApertura(
  e: EstadoMaquina,
  ev: Extract<Evento, { tipo: 'aceptadaApertura' }>,
  ef: Efectos
): Salida {
  if (e.sesion?.sesionId !== ev.sesionId) return salida(e)
  if (ev.pantalla) {
    ef.push({
      tipo: 'guardarPreferenciaPantalla',
      pantalla: ev.pantalla,
      pantallaCompleta: ev.pantallaCompleta
    })
  }
  return salida(conSesion(e, { pantalla: ev.pantalla, pantallaCompleta: ev.pantallaCompleta }))
}

/** Primera carga de la sesión según el inicio pedido (§5 «Apertura» y §8 «Reabrir»). */
function documentoListo(
  e: EstadoMaquina,
  ev: Extract<Evento, { tipo: 'documentoListo' }>,
  ahoraMs: number,
  ef: Efectos
): Salida {
  const s = e.sesion
  if (!s || s.sesionId !== ev.sesionId || s.fase !== 'abriendo') return salida(e)
  const apertura = s.apertura
  const base = conSesion(e, { apertura: null })
  const contexto = e.cola.contexto
  if (apertura?.tipo === 'cancion') {
    // La última reproducida se descarta, también si estaba interrumpida.
    try {
      const { cola, entrada } = Cola.agregar({ ...e.cola, contexto: null }, apertura, 'siguiente', {
        nuevoId: e.entorno.nuevoId,
        revision: e.revision
      })
      return salida(consumir({ ...base, cola }, ahoraMs, ef, entrada))
    } catch (err) {
      if (!(err instanceof ErrorCola)) throw err
      return salida(conSesion(base, { fase: 'espera' }))
    }
  }
  if (apertura?.tipo === 'reanudar' && contexto && !contexto.terminada) {
    const sinContexto = { ...base, cola: { ...base.cola, contexto: null } }
    return salida(
      consumir(sinContexto, ahoraMs, ef, contexto.entrada, {
        posicionMs: contexto.posicionMs ?? 0,
        pausada: contexto.pausada
      })
    )
  }
  const primera = Cola.candidata(e.cola)
  if (primera && !contexto?.terminada) {
    return salida(consumir(base, ahoraMs, ef, primera))
  }
  return salida(conSesion(base, { fase: 'espera' }))
}

function revalidada(
  e: EstadoMaquina,
  ev: Extract<Evento, { tipo: 'revalidada' }>,
  ahoraMs: number,
  ef: Efectos
): Salida {
  const s = e.sesion
  const activa = e.cola.activa
  if (!s || s.fase !== 'cargando' || activa?.entradaId !== ev.entradaId) return salida(e)
  if (ev.resultado !== 'ok') {
    return salida(
      aError(
        e,
        { entradaId: ev.entradaId, motivo: ev.resultado, codigo: 'CANCION_NO_DISPONIBLE' },
        ef
      )
    )
  }
  const re = s.reanudacion
  // Una posición anterior a la primera línea (título o silencio previo) empieza desde el principio.
  const reanudar = re !== null && re.posicionMs >= (ev.primeraLineaMs ?? 0)
  const desdeMs = reanudar ? re.posicionMs : 0
  ef.push({
    tipo: 'comando',
    comando: {
      tipo: 'cargar',
      entradaId: activa.entradaId,
      cancionId: activa.cancionId,
      desdeMs,
      pausada: reanudar ? re.pausada : false,
      anuncio: reanudar ? 'reanudacion' : 'inicio'
    }
  })
  return salida(
    conSesion(e, {
      reanudacion: null,
      reproduccion: {
        posicionMs: desdeMs,
        instanteMs: ahoraMs,
        duracionMs: Math.max(0, Math.round(ev.duracionMs ?? 0))
      }
    })
  )
}

/** Fin natural: la activa queda como terminada y empieza la cuenta (salvo con el cierre pendiente). */
function finNatural(e: EstadoMaquina, ahoraMs: number, ef: Efectos): EstadoMaquina {
  const activa = e.cola.activa as EntradaIpc
  const cola: EstadoCola = {
    ...e.cola,
    activa: null,
    contexto: { entrada: activa, posicionMs: null, pausada: false, terminada: true }
  }
  const e1 = conSesion({ ...e, cola }, { reproduccion: reproduccionInicial(0, ahoraMs) })
  if (e1.sesion?.cierrePendiente) {
    // Con el diálogo abierto no empieza cuenta: queda en espera (o fin de cola si no hay más).
    return Cola.candidata(cola) ? conSesion(e1, { fase: 'espera' }) : aFinDeCola(e1, ef)
  }
  return iniciarCuenta(e1, ahoraMs, ef)
}

function informe(
  e: EstadoMaquina,
  inf: InformeSecundariaIpc,
  ahoraMs: number,
  ef: Efectos
): Salida {
  const s = e.sesion
  if (!s || inf.sesionId !== s.sesionId || e.cola.activa?.entradaId !== inf.entradaId) {
    return salida(e, { aplicado: false })
  }
  const enCurso = FASES_EN_CURSO.includes(s.fase)
  const sonando = s.fase === 'reproduciendo' || s.fase === 'pausada'
  const posicion = 'posicionMs' in inf ? inf.posicionMs : undefined
  switch (inf.tipo) {
    case 'fin':
      return sonando
        ? salida(finNatural(e, ahoraMs, ef), { aplicado: true })
        : salida(e, { aplicado: false })
    case 'lista':
      return salida(e, { aplicado: enCurso })
    case 'reproduciendo':
    case 'pausada': {
      if (!enCurso) return salida(e, { aplicado: false })
      const fase: FaseSesion = inf.tipo
      const pos = posicion ?? posicionActual(s, ahoraMs)
      const nueva = conSesion(e, {
        fase,
        reproduccion: { ...s.reproduccion, posicionMs: pos, instanteMs: ahoraMs }
      })
      return salida(nueva, { aplicado: true, observable: fase !== s.fase })
    }
    case 'posicion': {
      if (!enCurso) return salida(e, { aplicado: false })
      const nueva = conSesion(e, {
        reproduccion: { ...s.reproduccion, posicionMs: inf.posicionMs, instanteMs: ahoraMs }
      })
      return salida(nueva, { aplicado: true, observable: false })
    }
    case 'error': {
      if (!enCurso) return salida(e, { aplicado: false })
      // Si solo falla la voz se sigue con el instrumental (0011).
      if (inf.error.pista === 'voz') return salida(e, { aplicado: true })
      const error: ErrorActiva = {
        entradaId: inf.entradaId,
        motivo: inf.error.motivo,
        codigo: `${inf.error.motivo}:${inf.error.pista}`
      }
      return salida(aError(e, error, ef), { aplicado: true })
    }
  }
}

function vencida(
  e: EstadoMaquina,
  ev: Extract<Evento, { tipo: 'vencida' }>,
  ahoraMs: number,
  ef: Efectos
): Salida {
  const t = e.sesion?.transicion
  if (e.sesion?.fase !== 'transicion' || !t || t.transicionId !== ev.transicionId) return salida(e)
  if (t.restanteCongeladoMs !== null) return salida(e)
  const candidata = Cola.candidata(e.cola)
  const sinCuenta = conSesion(e, { transicion: null })
  if (!candidata) return salida(aFinDeCola(sinCuenta, ef))
  return salida(consumir(sinCuenta, ahoraMs, ef, candidata))
}

function siguiente(
  e: EstadoMaquina,
  ev: Extract<Evento, { tipo: 'siguiente' }>,
  ahoraMs: number,
  ef: Efectos
): Salida {
  const s = e.sesion
  if (!s || s.cierrePendiente) return salida(e)
  const activa = e.cola.activa
  if (activa?.entradaId === ev.desdeEntradaId && FASES_EN_CURSO.includes(s.fase)) {
    if (e.cola.pendientes.length === 0) return salida(e)
    const cola: EstadoCola = {
      ...e.cola,
      activa: null,
      contexto: { entrada: activa, posicionMs: null, pausada: false, terminada: true }
    }
    return salida(iniciarCuenta(conSesion({ ...e, cola }, { reanudacion: null }), ahoraMs, ef))
  }
  if (s.fase === 'error' && s.error?.entradaId === ev.desdeEntradaId) {
    // Descarta la fallida (activa o primera pendiente) y cuenta hacia la siguiente.
    const sobran = activa?.entradaId === ev.desdeEntradaId ? 0 : 1
    if (e.cola.pendientes.length <= sobran) return salida(e)
    const { cola } = Cola.quitar(e.cola, ev.desdeEntradaId)
    return salida(iniciarCuenta(conCola(e, cola), ahoraMs, ef))
  }
  return salida(e)
}

function repetir(
  e: EstadoMaquina,
  ev: Extract<Evento, { tipo: 'repetir' }>,
  ahoraMs: number,
  ef: Efectos
): Salida {
  const s = e.sesion
  const contexto = e.cola.contexto
  if (
    !s ||
    s.cierrePendiente ||
    s.fase !== 'fin_de_cola' ||
    !contexto?.terminada ||
    contexto.entrada.entradaId !== ev.entradaId
  ) {
    return salida(e)
  }
  const nueva: EntradaIpc = { ...contexto.entrada, entradaId: e.entorno.nuevoId() }
  return salida(consumir(e, ahoraMs, ef, nueva))
}

function transporte(
  e: EstadoMaquina,
  ev: Extract<Evento, { tipo: 'transporte' }>,
  ahoraMs: number,
  ef: Efectos
): Salida {
  const s = e.sesion
  if (!s || e.cola.activa?.entradaId !== ev.entradaId) return salida(e)
  if (s.fase !== 'reproduciendo' && s.fase !== 'pausada') return salida(e)
  if (ev.accion === 'pausar') {
    ef.push({
      tipo: 'comando',
      comando: { tipo: 'pausar', entradaId: ev.entradaId, causa: 'principal' }
    })
    return salida(e)
  }
  if (ev.accion === 'reanudar') {
    ef.push({ tipo: 'comando', comando: { tipo: 'reanudar', entradaId: ev.entradaId } })
    return salida(e)
  }
  ef.push({ tipo: 'comando', comando: { tipo: 'reiniciar', entradaId: ev.entradaId } })
  return salida(
    conSesion(e, { reproduccion: { ...s.reproduccion, posicionMs: 0, instanteMs: ahoraMs } }),
    { observable: false }
  )
}

function solicitarCierre(
  e: EstadoMaquina,
  ev: Extract<Evento, { tipo: 'solicitarCierre' }>,
  ahoraMs: number,
  ef: Efectos
): Salida {
  const s = e.sesion
  if (!s) return rechazo(e, 'SESION_NO_ACTIVA')
  if (s.cierrePendiente || s.cierre) return salida(e)
  if (e.cola.pendientes.length === 0) {
    // Sin pendientes se cierra sin preguntar: activa y contexto se descartan.
    cancelarTemporizador(e, ef)
    ef.push({ tipo: 'cerrarVentana' })
    return salida(conSesion(e, { cierre: { cola: 'eliminar' } }))
  }
  const t = s.transicion
  const transicion = t ? { ...t, restanteCongeladoMs: restanteTransicion(t, ahoraMs) } : null
  cancelarTemporizador(e, ef)
  return salida(conSesion(e, { cierrePendiente: { origen: ev.origen }, transicion }))
}

function confirmarCierre(
  e: EstadoMaquina,
  ev: Extract<Evento, { tipo: 'confirmarCierre' }>,
  ef: Efectos
): Salida {
  const s = e.sesion
  if (!s || !s.cierrePendiente) return rechazo(e, 'SESION_NO_ACTIVA')
  if (ev.revision !== e.revision) return rechazo(e, 'CONFIRMACION_OBSOLETA')
  ef.push({ tipo: 'cerrarVentana' })
  return salida(conSesion(e, { cierre: { cola: ev.cola } }))
}

function cancelarCierre(e: EstadoMaquina, ahoraMs: number, ef: Efectos): Salida {
  const s = e.sesion
  if (!s?.cierrePendiente || s.cierre) return salida(e)
  const t = s.transicion
  let transicion = t
  if (t && t.restanteCongeladoMs !== null) {
    const restante = t.restanteCongeladoMs
    transicion = { ...t, venceMs: ahoraMs + restante, restanteCongeladoMs: null }
    ef.push({ tipo: 'programar', transicionId: t.transicionId, ms: restante })
  }
  return salida(reajustar(conSesion(e, { cierrePendiente: null, transicion }), ahoraMs, ef))
}

function pantalla(
  e: EstadoMaquina,
  cambio: Extract<Evento, { tipo: 'pantalla' }>['cambio']
): Salida {
  if (!e.sesion) return salida(e)
  switch (cambio.tipo) {
    case 'perdida':
      return salida(
        conSesion(e, {
          pantalla: cambio.pantalla,
          pantallaCompleta: false,
          incidencia: {
            tipo: 'pantalla_perdida',
            etiqueta: cambio.etiqueta,
            estabaEnPantallaCompleta: cambio.estabaEnPantallaCompleta
          }
        })
      )
    case 'reconectada':
      return salida(
        conSesion(e, {
          incidencia: {
            tipo: 'pantalla_reconectada',
            etiqueta: cambio.etiqueta,
            pantallaId: cambio.pantallaId
          }
        })
      )
    case 'movida': {
      const inc = e.sesion.incidencia
      const limpia = inc && inc.tipo !== 'secundaria_no_responde' ? null : inc
      return salida(
        conSesion(e, {
          pantalla: cambio.pantalla,
          pantallaCompleta: cambio.pantallaCompleta,
          incidencia: limpia
        })
      )
    }
  }
}

function responde(e: EstadoMaquina, responde: boolean): Salida {
  const s = e.sesion
  if (!s) return salida(e)
  if (!responde) {
    if (s.incidencia?.tipo === 'secundaria_no_responde') return salida(e)
    return salida(conSesion(e, { incidencia: { tipo: 'secundaria_no_responde' } }))
  }
  if (s.incidencia?.tipo !== 'secundaria_no_responde') return salida(e)
  return salida(conSesion(e, { incidencia: null }))
}

/** Operaciones de cola y de biblioteca: cambian la cola y adaptan la sesión. */
function operacionDeCola(
  e: EstadoMaquina,
  ev: Extract<
    Evento,
    {
      tipo:
        | 'agregar'
        | 'mover'
        | 'quitar'
        | 'vaciar'
        | 'disponibilidad'
        | 'cancionEliminada'
        | 'titulos'
    }
  >,
  ahoraMs: number,
  ef: Efectos
): Salida {
  let cola = e.cola
  const extra: Omit<Salida, 'estado'> = {}
  switch (ev.tipo) {
    case 'agregar': {
      const r = Cola.agregar(cola, ev, ev.donde, {
        nuevoId: e.entorno.nuevoId,
        revision: e.revision
      })
      cola = r.cola
      extra.entradaId = r.entrada.entradaId
      break
    }
    case 'mover':
      cola = Cola.mover(cola, ev)
      break
    case 'quitar': {
      const fallida = e.sesion?.fase === 'error' && e.sesion.error?.entradaId === ev.entradaId
      if (cola.activa?.entradaId === ev.entradaId && !fallida) {
        // La activa que suena no se quita: se usa `siguiente`.
        throw new ErrorCola('ENTRADA_NO_ENCONTRADA', 'La entrada activa no se puede quitar.')
      }
      const r = Cola.quitar(cola, ev.entradaId)
      cola = r.cola
      extra.antesDe = r.antesDe
      break
    }
    case 'vaciar':
      cola = Cola.vaciar(cola, ev)
      break
    case 'disponibilidad':
    case 'cancionEliminada': {
      // Defensa: la canción de la activa no se elimina ni vuelve a borrador (ADR 0017 §5).
      if (
        e.cola.activa?.cancionId === ev.cancionId &&
        (ev.tipo === 'cancionEliminada' || ev.motivo !== 'ok')
      ) {
        return rechazo(e, 'CANCION_EN_REPRODUCCION')
      }
      cola =
        ev.tipo === 'disponibilidad'
          ? Cola.marcarDisponibilidad(cola, ev.cancionId, ev.motivo)
          : Cola.quitarCancion(cola, ev.cancionId)
      break
    }
    case 'titulos':
      cola = Cola.actualizarTitulos(cola, ev.cancionId, ev.titulo, ev.artista)
      break
  }
  if (cola === e.cola) return salida(e, extra)
  return salida(reajustar(conCola(e, cola), ahoraMs, ef), extra)
}

function despachar(e: EstadoMaquina, ev: Evento, ahoraMs: number, ef: Efectos): Salida {
  switch (ev.tipo) {
    case 'abrir':
      return abrir(e, ev, ef)
    case 'aceptadaApertura':
      return aceptadaApertura(e, ev, ef)
    case 'documentoListo':
      return documentoListo(e, ev, ahoraMs, ef)
    case 'informe':
      return informe(e, ev.informe, ahoraMs, ef)
    case 'revalidada':
      return revalidada(e, ev, ahoraMs, ef)
    case 'vencida':
      return vencida(e, ev, ahoraMs, ef)
    case 'agregar':
    case 'mover':
    case 'quitar':
    case 'vaciar':
    case 'disponibilidad':
    case 'cancionEliminada':
    case 'titulos':
      try {
        return operacionDeCola(e, ev, ahoraMs, ef)
      } catch (err) {
        if (err instanceof ErrorCola) return rechazo(e, err.codigo)
        throw err
      }
    case 'siguiente':
      return siguiente(e, ev, ahoraMs, ef)
    case 'empezar': {
      const s = e.sesion
      const candidata = Cola.candidata(e.cola)
      const valida =
        s && !s.cierrePendiente && (s.fase === 'transicion' || s.fase === 'espera') && candidata
      if (!valida || candidata.entradaId !== ev.candidataId) return salida(e)
      return salida(consumir(e, ahoraMs, ef, candidata))
    }
    case 'detenerTransicion': {
      const t = e.sesion?.transicion
      if (!e.sesion || e.sesion.cierrePendiente || !t || t.transicionId !== ev.transicionId) {
        return salida(e)
      }
      cancelarTemporizador(e, ef)
      ef.push({ tipo: 'comando', comando: { tipo: 'transicion', transicion: null } })
      return salida(conSesion(e, { fase: 'espera', transicion: null }))
    }
    case 'repetir':
      return repetir(e, ev, ahoraMs, ef)
    case 'transporte':
      return transporte(e, ev, ahoraMs, ef)
    case 'solicitarCierre':
      return solicitarCierre(e, ev, ahoraMs, ef)
    case 'confirmarCierre':
      return confirmarCierre(e, ev, ef)
    case 'cancelarCierre':
      return cancelarCierre(e, ahoraMs, ef)
    case 'cerrada':
      return e.sesion ? salida(finalizarSesion(e, ev.causa, ahoraMs, ef)) : salida(e)
    case 'pantalla':
      return pantalla(e, ev.cambio)
    case 'responde':
      return responde(e, ev.responde)
  }
}

/**
 * Aplica un evento. Devuelve el estado nuevo y los efectos a ejecutar, en orden. Si el estado cambia
 * de forma observable sube la revisión y añade `difundir` al final.
 */
export function reducir(estado: EstadoMaquina, evento: Evento, ahoraMs: number): Resultado {
  const efectos: Efecto[] = []
  const { estado: nuevo, observable, ...resto } = despachar(estado, evento, ahoraMs, efectos)
  if (resto.error) return { ...resto, estado, efectos: [] }
  if (nuevo === estado || observable === false) return { ...resto, estado: nuevo, efectos }
  efectos.push({ tipo: 'difundir' })
  return { ...resto, estado: { ...nuevo, revision: estado.revision + 1 }, efectos }
}
