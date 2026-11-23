import {
  contarLineas,
  type Cancion,
  type Config,
  type EstadoPicos,
  type PasoPreparacion,
  type Preparacion
} from '../../shared'
import { aplicaPreparar } from '../../shared/derivados'
import { ESPERA_LEGADA } from '../../shared/espera'
import { evaluarEncajeConPicos } from '../../shared/encaje'
import type { CambioPreparacionIpc } from '../../shared/ipc'
import { detectarVoz, proponerAjusteSilencios } from '../../shared/silencios'
import type { ResultadoBusquedaLetra } from '../../shared/letrasBusqueda'
import type { EventoCancion, CambioCancion } from '../biblioteca/operaciones'
import type { BusquedaGuardada } from '../letras/busqueda'
import type { ResultadoComprobacionGuardada } from '../letras/comprobacion'
import { ErrorLrclib } from '../letras/lrclib'
import type { NivelBase } from '../picos/formato'
import { elegirLetra, NO_ELIGE_GUARDADO, type CandidatoEvaluado } from './eleccion'

const MODULO = 'preparacion'

/** Reintentos de una búsqueda sin red o con el servicio caído (spec 04, F5-P5: una vez a los 60 s). */
export const REINTENTOS_BUSQUEDA_MS: readonly number[] = [60_000]
/** Cada cuánto se mira si los picos o el desbloqueo de la edición están listos. */
export const SONDEO_MS = 500
/** Tope de espera a que se generen los picos de la voz (4 min de audio tardan segundos). */
export const ESPERA_PICOS_MAXIMA_MS = 5 * 60_000

/** Motivos por los que `preparar` omite una canción (ADR 0025 §7). */
export type MotivoOmitida =
  'YA_LISTA' | 'EN_CURSO' | 'SIN_FUENTE' | 'EDICION_BLOQUEADA' | 'NADA_QUE_HACER'

export interface PlanPreparacion {
  id: string
  aplica: boolean
  /** Pasos que haría, con los nombres de `PASOS_PREPARACION` salvo la espera de la separación. */
  pasos: PasoPreparacion[]
  motivo?: MotivoOmitida
}

export interface PuertoBibliotecaPreparacion {
  obtener(id: string): Cancion | null
  listar(): { id: string; preparacion?: { estado: string } | null }[]
  actualizar(id: string, cambio: CambioCancion): Promise<unknown>
  suscribir(cb: (evento: EventoCancion) => void): () => void
}

export interface DependenciasPreparacion {
  biblioteca: PuertoBibliotecaPreparacion
  busqueda: {
    buscarParaPreparacion(
      cancionId: string,
      opciones?: { explicita?: boolean }
    ): Promise<{ resultado: ResultadoBusquedaLetra | null; busqueda: BusquedaGuardada }>
    cancelarAutomaticas(cancionId?: string): void
  }
  letras: {
    guardar(
      peticion: {
        cancionId: string
        origen: 'lrclib'
        lrclib_id: number
        lineas: ResultadoBusquedaLetra['candidatos'][number]['lineas']
        desfase_ms?: number
      },
      opciones: {
        porPreparacion: true
        datosLrclib: { titulo: string; artista: string; album: string | null }
      }
    ): Promise<unknown>
    aplicarFinesPreparacion(cancionId: string, fines: ReadonlyMap<string, number>): Promise<number>
  }
  picos: {
    solicitar(cancionId: string): Promise<EstadoPicos>
    nivelBase(cancionId: string): Promise<NivelBase | null>
  }
  /** `comprobarLetraGuardada` de la tarea 0367, ya con sus dependencias (no se duplica). */
  comprobar(cancionId: string): Promise<ResultadoComprobacionGuardada | null>
  /** `contarDudosasGuardadas` (tarea 0334): `null` sin letra. */
  contarDudosas(cancion: Cancion): Promise<{ dudosas: number; importantes: number } | null>
  config: { obtener(): Pick<Config, 'preparacion'> }
  /**
   * Separación de la canción (pregunta 0223 §4): `hayTrabajo` dice si el gestor tiene un trabajo `separar`
   * en cola o en curso; `encolar` la pide por el camino de siempre (`alCompletarFuente`).
   */
  separacion?: { hayTrabajo(cancionId: string): boolean; encolar(cancionId: string): Promise<void> }
  /** Pausa de toda la cola (usuario o parada automática): no se empieza ninguna búsqueda mientras dure. */
  retenida?(): boolean
  /** Hay una sesión en vivo (ADR 0017 §9): no se escribe en la canción hasta que acabe. */
  edicionBloqueada(): boolean
  emitir?(cambio: CambioPreparacionIpc): void
  ahora?(): Date
  /** Espera abortable; sustituible por un reloj falso. */
  esperar?(ms: number, señal: AbortSignal): Promise<void>
  reintentosBusquedaMs?: readonly number[]
  sondeoMs?: number
  registrar?(nivel: 'info' | 'aviso' | 'error', mensaje: string): void
}

export type OrigenPreparacion = Preparacion['origen']

/** Inicio y fin de cada corrida (lo usan la tanda y el diario de pendientes, tarea 0309). */
export type EventoCorrida =
  | { tipo: 'inicio'; id: string; origen: OrigenPreparacion }
  | { tipo: 'fin'; id: string; preparacion: Preparacion | null }

type ResultadoBusquedaPreparacion = Awaited<
  ReturnType<DependenciasPreparacion['busqueda']['buscarParaPreparacion']>
>

type MotivoParada = 'cancelar' | 'usuario' | 'cierre' | 'eliminar' | 'interruptor'

/** Se lanza dentro de una corrida cuando se detiene; se captura en `ejecutar`. */
class Detenida extends Error {
  constructor(readonly motivo: MotivoParada) {
    super(`Preparación detenida: ${motivo}`)
  }
}

interface Corrida {
  id: string
  origen: OrigenPreparacion
  /** La canción no tenía registro de preparación al empezar: si se detiene sin hacer nada, se retira. */
  sinRegistroPrevio: boolean
  ctl: AbortController
  /** Tiempos y texto de la letra en el último momento conocido (para ver si la toca el usuario). */
  firma: string | null
  /** La corrida está escribiendo la letra: lo que cambie no es del usuario. */
  escribiendo: boolean
  fin: Promise<void>
}

/** Tiempos y texto de las líneas (sin `offset_ms`: una corrección del desfase no es una edición). */
const firmaDeLetra = (c: Cancion | null): string | null =>
  c?.letra
    ? JSON.stringify(c.letra.lineas.map((l) => [l.id, l.inicio_ms, l.fin_ms, l.texto]))
    : null

const esperaReal = (ms: number, señal: AbortSignal): Promise<void> =>
  new Promise((resolver) => {
    if (señal.aborted) return resolver()
    const t = setTimeout(fin, ms)
    function fin(): void {
      clearTimeout(t)
      señal.removeEventListener('abort', fin)
      resolver()
    }
    señal.addEventListener('abort', fin, { once: true })
  })

/**
 * Preparación desatendida (ADR 0025 §2): lleva una canción sola hasta «Lista para revisar». Una corrida
 * por canción, con pasos idempotentes que miran el estado real cada vez (nunca sustituye una letra, no
 * toca tiempos editados). Solo este servicio escribe `cancion.preparacion`, siempre a través de
 * `ServicioBiblioteca`; la letra y los fines los escribe `ServicioLetras`. Nunca marca una canción Lista.
 *
 * La tanda, la pausa, las paradas y reanudar al abrir son de la tarea 0309: se apoyan en `iniciar`,
 * `cancelar`, `enCurso` y en el evento `emitir`.
 */
export class ServicioPreparacion {
  private readonly corridas = new Map<string, Corrida>()
  /** Candidatos de la búsqueda en curso (con texto): solo en memoria, nunca a disco (ADR 0025 §1). */
  private readonly resultados = new Map<string, ResultadoBusquedaLetra>()
  private readonly oyentesCorrida = new Set<(e: EventoCorrida) => void>()
  private readonly firmasDudosas = new Map<string, string>()
  private readonly recuentos = new Map<string, Promise<void>>()
  private readonly baja: () => void
  private readonly ahora: () => Date
  private readonly esperar: (ms: number, señal: AbortSignal) => Promise<void>
  private readonly sondeoMs: number
  private readonly reintentosMs: readonly number[]

  constructor(private readonly deps: DependenciasPreparacion) {
    this.ahora = deps.ahora ?? (() => new Date())
    this.esperar = deps.esperar ?? esperaReal
    this.sondeoMs = deps.sondeoMs ?? SONDEO_MS
    this.reintentosMs = deps.reintentosBusquedaMs ?? REINTENTOS_BUSQUEDA_MS
    this.baja = deps.biblioteca.suscribir((e) => this.alCambiarCancion(e))
  }

  // --- Consultas ---------------------------------------------------------------------------------

  enCurso(cancionId: string): boolean {
    return this.corridas.has(cancionId)
  }

  /**
   * ¿La canción forma parte de una tanda de varias? Hasta que exista la tanda (tarea 0309): hay otra
   * preparación en marcha. Con ello `comprobarLetraGuardada` no emite el toast por canción (spec 04, F5-P8).
   */
  enTandaDeVarias(cancionId: string): boolean {
    return this.corridas.has(cancionId) && this.corridas.size >= 2
  }

  /** Qué haría `preparar` con cada canción, sin ejecutar nada (`preparacion.previsualizar`). */
  previsualizar(ids: readonly string[]): PlanPreparacion[] {
    return ids.map((id) => this.plan(id))
  }

  private plan(id: string): PlanPreparacion {
    const omitida = (motivo: MotivoOmitida): PlanPreparacion => ({
      id,
      aplica: false,
      pasos: [],
      motivo
    })
    const cancion = this.deps.biblioteca.obtener(id)
    if (!cancion) return omitida('NADA_QUE_HACER')
    if (this.corridas.has(id)) return omitida('EN_CURSO')
    const regla = aplicaPreparar(cancion)
    if (regla.motivo === 'YA_LISTA' && cancion.estado === 'lista') return omitida('YA_LISTA')
    if (regla.motivo === 'SIN_FUENTE') return omitida('SIN_FUENTE')
    if (this.deps.edicionBloqueada()) return omitida('EDICION_BLOQUEADA')
    if (!regla.aplica) return omitida(regla.motivo ?? 'NADA_QUE_HACER')
    return { id, aplica: true, pasos: regla.pasos }
  }

  // --- Entradas ----------------------------------------------------------------------------------

  /**
   * Una canción acaba de completar su fuente (archivo importado o descarga de YouTube): con el interruptor
   * «Buscar la letra automáticamente» activo y sin registro previo, empieza sola. Apagado, no hace nada
   * (ni se pide nada a LRCLIB: privacidad, ADR 0005 revisado).
   */
  alFuenteLista(cancionId: string): void {
    if (!this.deps.config.obtener().preparacion.automatica) return
    const cancion = this.deps.biblioteca.obtener(cancionId)
    if (!cancion || cancion.estado !== 'borrador' || cancion.preparacion) return
    this.iniciar(cancionId, 'automatica')
  }

  /**
   * `preparacion.preparar`: lanza la preparación desde el primer paso pendiente de cada canción. Cuenta
   * como acción del usuario aunque el interruptor esté apagado. Nunca sustituye una letra existente.
   */
  preparar(ids: readonly string[]): {
    aceptadas: string[]
    omitidas: { id: string; motivo: MotivoOmitida }[]
  } {
    const aceptadas: string[] = []
    const omitidas: { id: string; motivo: MotivoOmitida }[] = []
    for (const id of new Set(ids)) {
      const plan = this.plan(id)
      if (plan.aplica && this.iniciar(id, 'manual')) aceptadas.push(id)
      else omitidas.push({ id, motivo: plan.motivo ?? 'EN_CURSO' })
    }
    return { aceptadas, omitidas }
  }

  /** Arranca la corrida de una canción. `false` si ya hay una. */
  iniciar(cancionId: string, origen: OrigenPreparacion): boolean {
    if (this.corridas.has(cancionId)) return false
    const previa = this.deps.biblioteca.obtener(cancionId)
    const c: Corrida = {
      id: cancionId,
      origen,
      sinRegistroPrevio: !previa?.preparacion,
      ctl: new AbortController(),
      firma: firmaDeLetra(previa),
      escribiendo: false,
      fin: Promise.resolve()
    }
    this.corridas.set(cancionId, c)
    this.avisarCorrida({ tipo: 'inicio', id: cancionId, origen })
    c.fin = this.ejecutar(c).finally(() => {
      this.corridas.delete(cancionId)
      this.resultados.delete(cancionId)
      this.avisarCorrida({
        tipo: 'fin',
        id: cancionId,
        preparacion: this.deps.biblioteca.obtener(cancionId)?.preparacion ?? null
      })
    })
    return true
  }

  /** Inicio y fin de cada corrida. Devuelve la función para darse de baja. */
  suscribirCorridas(cb: (e: EventoCorrida) => void): () => void {
    this.oyentesCorrida.add(cb)
    return () => this.oyentesCorrida.delete(cb)
  }

  private avisarCorrida(e: EventoCorrida): void {
    for (const cb of this.oyentesCorrida) {
      try {
        cb(e)
      } catch (err) {
        this.deps.registrar?.('error', `${MODULO}: oyente de corridas falló: ${String(err)}`)
      }
    }
  }

  /** Canciones con una corrida en marcha. */
  ids(): string[] {
    return [...this.corridas.keys()]
  }

  /** `preparacion.cancelar`: detiene la de una canción (deja `detenida` o retira el registro si no hizo nada). */
  async cancelar(cancionId: string): Promise<void> {
    await this.detener(cancionId, 'cancelar')
  }

  /** La canción se va a eliminar: se detiene sin escribir nada más en ella. */
  async alEliminar(cancionId: string): Promise<void> {
    await this.detener(cancionId, 'eliminar')
    this.firmasDudosas.delete(cancionId)
  }

  /**
   * Cerrar la app (o la ventana en macOS): lo que esté en curso pasa a `detenida` con su paso y
   * `error.codigo = "CIERRE"`. Debe ir **antes** de cancelar los trabajos, para que la separación
   * interrumpida no se tome por una cancelación del usuario.
   */
  async detenerPorCierre(): Promise<void> {
    await Promise.all([...this.corridas.keys()].map((id) => this.detener(id, 'cierre')))
  }

  /** Salida definitiva de la app: se deja de escuchar la biblioteca y se detiene todo. */
  async cerrar(): Promise<void> {
    this.baja()
    await this.detenerPorCierre()
  }

  /**
   * Arranque: un registro `en_curso` sin corrida es de una sesión que no pudo cerrarse bien (caída):
   * pasa a `detenida` por cierre para que no se quede «Preparando» para siempre (la reanudación es de 0309).
   */
  async normalizarAlArrancar(): Promise<void> {
    for (const r of this.deps.biblioteca.listar()) {
      if (r.preparacion?.estado !== 'en_curso' || this.corridas.has(r.id)) continue
      const p = this.deps.biblioteca.obtener(r.id)?.preparacion
      if (!p) continue
      await this.escribirRegistro(r.id, {
        ...p,
        estado: 'detenida',
        error: { codigo: 'CIERRE', mensaje: '' },
        actualizado: this.ahora().toISOString()
      }).catch(() => undefined)
    }
  }

  private async detener(cancionId: string, motivo: MotivoParada): Promise<void> {
    const c = this.corridas.get(cancionId)
    if (!c) return
    c.ctl.abort(new Detenida(motivo))
    this.deps.busqueda.cancelarAutomaticas(cancionId)
    await c.fin
  }

  // --- La corrida --------------------------------------------------------------------------------

  private async ejecutar(c: Corrida): Promise<void> {
    try {
      await this.cadena(c)
    } catch (e) {
      await this.alAcabarMal(c, e)
    }
  }

  private async cadena(c: Corrida): Promise<void> {
    const { id } = c
    await this.fijar(c, { estado: 'en_curso', error: null })
    if (!(await this.pasoBuscar(c))) return
    const nivel = await this.pasoEsperar(c)
    if (nivel === 'fin') return
    if (!(await this.pasoComprobar(c, nivel))) return
    await this.pasoFines(c, nivel)
    const cancion = this.deps.biblioteca.obtener(id)
    if (!cancion) throw new Detenida('eliminar')
    const { dudosas, importantes } = (await this.deps.contarDudosas(cancion)) ?? {
      dudosas: 0,
      importantes: 0
    }
    this.vivo(c)
    await this.fijar(c, {
      estado: 'lista_para_revisar',
      paso: null,
      dudosas,
      dudosas_importantes: importantes
    })
    this.deps.registrar?.('info', `${MODULO} ${id}: lista para revisar (dudosas=${dudosas})`)
  }

  /** Buscar la letra. `false` si la corrida termina aquí (sin letra, instrumental, error). */
  private async pasoBuscar(c: Corrida): Promise<boolean> {
    const { id } = c
    // Ya tiene letra (la eligió el usuario antes o durante): no se busca, solo se comprueba.
    if (contarLineas(this.deps.biblioteca.obtener(id)?.letra) > 0) return true
    for (let intento = 0; ; intento++) {
      await this.fijar(c, { paso: 'buscando_letra', error: null })
      const r = await this.buscar(c)
      this.vivo(c)
      if (r.resultado) this.resultados.set(id, r.resultado)
      await this.fijar(c, { busqueda: r.busqueda })
      const { resultado, motivo } = r.busqueda
      if (resultado === 'elige') return true
      if (resultado === 'sin_letra' || resultado === 'instrumental') {
        await this.fijar(c, { estado: 'sin_letra', paso: null })
        return false
      }
      // `pendiente`: sin red o servicio caído.
      const espera = this.reintentosMs[intento]
      if (espera === undefined) {
        await this.fijar(c, {
          estado: 'error',
          paso: null,
          error: { codigo: motivo ?? 'SIN_CONEXION', mensaje: '' }
        })
        return false
      }
      await this.esperar(espera, c.ctl.signal)
      this.vivo(c)
    }
  }

  private async buscar(c: Corrida): Promise<ResultadoBusquedaPreparacion> {
    // En pausa no sale ninguna petición; cancelada justo antes de pedirla, tampoco.
    while (this.deps.retenida?.()) {
      await this.esperar(this.sondeoMs, c.ctl.signal)
      this.vivo(c)
    }
    this.vivo(c)
    try {
      return await this.deps.busqueda.buscarParaPreparacion(c.id, {
        explicita: c.origen === 'manual'
      })
    } catch (e) {
      this.vivo(c)
      // El interruptor se apagó con la petición aún en la cola: no salió nada.
      if (e instanceof ErrorLrclib && e.codigo === 'CANCELADO') throw new Detenida('interruptor')
      throw e
    }
  }

  /**
   * Espera la separación y los picos. `'fin'` si la corrida termina (separación en error con candidatas:
   * `elige_letra` sin encaje); `null` si no hay picos (sin encaje y sin fines).
   */
  private async pasoEsperar(c: Corrida): Promise<NivelBase | null | 'fin'> {
    const { id } = c
    await this.fijar(c, { paso: 'esperando_separacion' })
    // Fuente lista y separación pendiente que nadie lanzó (p. ej. «Preparar» sobre un borrador): se encola.
    const actual = this.deps.biblioteca.obtener(id)
    if (
      actual?.pasos.fuente.estado === 'completado' &&
      actual.pasos.separacion.estado === 'pendiente' &&
      this.deps.separacion &&
      !this.deps.separacion.hayTrabajo(id)
    ) {
      await this.deps.separacion.encolar(id)
      this.vivo(c)
    }
    // «Lanzada»: la separación ya tiene su trabajo (en cola o en curso). Si deja de tenerlo sin haber
    // terminado, alguien la canceló, aunque la corrida no llegara a verla `en_curso` (pregunta 0240).
    const lanzada = this.deps.separacion?.hayTrabajo(id) ?? false
    let vistaEnCurso = false
    const separacion = await this.esperarCancion(c, (cancion) => {
      const e = cancion.pasos.separacion.estado
      if (e === 'completado') return 'ok'
      if (e === 'error') return 'error'
      if (e === 'en_curso') vistaEnCurso = true
      // Cancelada desde la tarjeta (vuelve a `pendiente`) o interrumpida: la cadena se detiene.
      if (e === 'interrumpido') return 'parada'
      if (
        e === 'pendiente' &&
        (vistaEnCurso || (lanzada && !this.deps.separacion?.hayTrabajo(id)))
      ) {
        return 'parada'
      }
      return undefined
    })
    if (separacion === 'parada') throw new Detenida('cancelar')
    if (separacion === 'error') {
      // Sin voz no hay encaje: con candidatas, el usuario elige; con letra, se queda como está.
      if (contarLineas(this.deps.biblioteca.obtener(id)?.letra) === 0) {
        const busqueda = this.deps.biblioteca.obtener(id)?.preparacion?.busqueda
        await this.fijar(c, {
          estado: 'elige_letra',
          paso: null,
          ...(busqueda ? { busqueda: { ...busqueda, no_elige: 'sinComprobar' as const } } : {})
        })
        return 'fin'
      }
      return null
    }
    return this.esperarPicos(c)
  }

  private async esperarPicos(c: Corrida): Promise<NivelBase | null> {
    const limite = this.ahora().getTime() + ESPERA_PICOS_MAXIMA_MS
    for (let sinDisponible = 0; ;) {
      const e = await this.deps.picos.solicitar(c.id)
      this.vivo(c)
      if (e.estado === 'lista') return this.deps.picos.nivelBase(c.id)
      if (e.estado === 'error') return null
      if (e.estado === 'no_disponible' && ++sinDisponible > 5) return null
      if (this.ahora().getTime() > limite) return null
      await this.esperar(this.sondeoMs, c.ctl.signal)
      this.vivo(c)
    }
  }

  /** Comprobar la letra con la voz y elegir. `false` si la corrida termina (`elige_letra`). */
  private async pasoComprobar(c: Corrida, nivel: NivelBase | null): Promise<boolean> {
    const { id } = c
    await this.fijar(c, { paso: 'comprobando' })
    if (contarLineas(this.deps.biblioteca.obtener(id)?.letra) === 0) {
      const resultado = this.resultados.get(id)
      const evaluados: CandidatoEvaluado[] = (resultado?.candidatos ?? []).map((candidato) => ({
        candidato,
        encaje:
          nivel && candidato.sincronia !== 'texto' ? this.encajeDe(candidato.lineas, nivel) : null
      }))
      const decision = elegirLetra(evaluados)
      if (decision.tipo === 'no_elige') {
        this.deps.registrar?.('info', `${MODULO} ${id}: elige la letra (${decision.motivo})`)
        const busqueda = this.deps.biblioteca.obtener(id)?.preparacion?.busqueda
        await this.fijar(c, {
          estado: 'elige_letra',
          paso: null,
          ...(busqueda
            ? { busqueda: { ...busqueda, no_elige: NO_ELIGE_GUARDADO[decision.motivo] } }
            : {})
        })
        return false
      }
      // Nunca se sustituye una letra: si el usuario guardó una mientras tanto, solo se comprueba.
      if (contarLineas(this.deps.biblioteca.obtener(id)?.letra) === 0) {
        const { candidato, desfaseMs } = decision
        await this.escribirLetra(c, async () => {
          await this.deps.letras.guardar(
            {
              cancionId: id,
              origen: 'lrclib',
              lrclib_id: candidato.lrclib_id,
              lineas: candidato.lineas,
              ...(desfaseMs === null ? {} : { desfase_ms: desfaseMs })
            },
            {
              porPreparacion: true,
              datosLrclib: {
                titulo: candidato.titulo,
                artista: candidato.artista,
                album: candidato.album
              }
            }
          )
        })
        const previa = this.deps.biblioteca.obtener(id)?.preparacion?.busqueda
        await this.fijar(c, {
          ...(previa ? { busqueda: { ...previa, resultado: 'elegida' as const } } : {}),
          eleccion: {
            por: 'app',
            fecha: this.ahora().toISOString(),
            lrclib_id: candidato.lrclib_id
          },
          ...(desfaseMs === null ? {} : { desfase_ms: desfaseMs })
        })
        return true
      }
    }
    // Letra ya guardada: la misma comprobación diferida de la tarea 0367 (corrige solo si está intacta).
    await this.escribirLetra(c, async () => {
      const r = await this.deps.comprobar(id)
      if (r?.corregido == null) return
      const desfase = this.deps.biblioteca.obtener(id)?.letra?.desfase_corregido_ms
      if (desfase !== undefined) await this.fijar(c, { desfase_ms: desfase })
    })
    return true
  }

  private encajeDe(
    lineas: ResultadoBusquedaLetra['candidatos'][number]['lineas'],
    nivel: NivelBase
  ): CandidatoEvaluado['encaje'] {
    const r = evaluarEncajeConPicos(
      { lineas, offset_ms: 0 },
      { pasoMs: nivel.pasoMs, pares: nivel.pares },
      { duracionMs: nivel.duracionMs }
    )
    return { veredicto: r.veredicto, desfaseMs: Math.round(r.desfaseMs) }
  }

  /** Ajustar los fines: «Ajustar los silencios» en su variante prudente (ADR 0025 §2, 0153 §11). */
  private async pasoFines(c: Corrida, nivel: NivelBase | null): Promise<void> {
    const { id } = c
    const cancion = this.deps.biblioteca.obtener(id)
    const letra = cancion?.letra
    // Solo con la letra intacta: un tiempo tocado por el usuario no se toca. Sin picos no hay fines.
    if (!cancion || !letra || !nivel || letra.intacta !== true || cancion.estado !== 'borrador') {
      return
    }
    await this.fijar(c, { paso: 'ajustando_fines' })
    const propuesta = proponerAjusteSilencios(
      letra,
      detectarVoz({ pasoMs: nivel.pasoMs, pares: nivel.pares }),
      {
        duracionMs: nivel.duracionMs,
        espera: ESPERA_LEGADA,
        soloFinesAutomaticos: true,
        activarComodin: false,
        origenFin: 'preparacion'
      }
    )
    const fines = new Map(propuesta.cambios.map((x) => [x.id, x.finDespues]))
    let puestos = 0
    await this.escribirLetra(c, async () => {
      puestos = await this.deps.letras.aplicarFinesPreparacion(id, fines)
    })
    await this.fijar(c, { fines: { metodo: 'silencios', lineas: puestos } })
  }

  // --- Escritura y espera ------------------------------------------------------------------------

  /** Escribe la letra respetando `EDICION_BLOQUEADA` y sin tomar el cambio por una edición del usuario. */
  private async escribirLetra(c: Corrida, escribir: () => Promise<void>): Promise<void> {
    while (this.deps.edicionBloqueada()) {
      await this.esperar(this.sondeoMs, c.ctl.signal)
      this.vivo(c)
    }
    this.vivo(c)
    c.escribiendo = true
    try {
      await escribir()
    } finally {
      c.escribiendo = false
      c.firma = firmaDeLetra(this.deps.biblioteca.obtener(c.id))
    }
  }

  /** Lanza `Detenida` si la corrida se detuvo o la canción ya no existe. */
  private vivo(c: Corrida): void {
    const razon: unknown = c.ctl.signal.reason
    if (c.ctl.signal.aborted) throw razon instanceof Detenida ? razon : new Detenida('cancelar')
    if (!this.deps.biblioteca.obtener(c.id)) throw new Detenida('eliminar')
  }

  /** Espera a que `decidir` devuelva algo con la canción; se reevalúa en cada escritura de la biblioteca. */
  private esperarCancion<T>(c: Corrida, decidir: (cancion: Cancion) => T | undefined): Promise<T> {
    return new Promise<T>((resolver, rechazar) => {
      let baja = (): void => undefined
      const acabar = (): void => {
        baja()
        c.ctl.signal.removeEventListener('abort', alAbortar)
      }
      const alAbortar = (): void => {
        acabar()
        const razon: unknown = c.ctl.signal.reason
        rechazar(razon instanceof Detenida ? razon : new Detenida('cancelar'))
      }
      const revisar = (): void => {
        const cancion = this.deps.biblioteca.obtener(c.id)
        if (!cancion) {
          acabar()
          return rechazar(new Detenida('eliminar'))
        }
        const v = decidir(cancion)
        if (v === undefined) return
        acabar()
        resolver(v)
      }
      c.ctl.signal.addEventListener('abort', alAbortar, { once: true })
      baja = this.deps.biblioteca.suscribir((e) => {
        if (e.id === c.id) revisar()
      })
      if (c.ctl.signal.aborted) return alAbortar()
      revisar()
    })
  }

  /** Cambia el registro de la canción (sin tocar lo que no se indica) y lo anuncia. */
  private async fijar(c: Corrida, parche: Partial<Preparacion>): Promise<void> {
    this.vivo(c)
    const cancion = this.deps.biblioteca.obtener(c.id)!
    const base: Preparacion = cancion.preparacion ?? {
      estado: 'en_curso',
      paso: null,
      origen: c.origen,
      actualizado: this.ahora().toISOString(),
      dudosas: 0,
      revisada: false
    }
    const siguiente: Preparacion = {
      ...base,
      origen: c.origen,
      ...parche,
      actualizado: this.ahora().toISOString()
    }
    await this.escribirRegistro(c.id, siguiente)
  }

  private async escribirRegistro(id: string, preparacion: Preparacion | null): Promise<void> {
    await this.deps.biblioteca.actualizar(id, { preparacion })
    if (preparacion) this.deps.emitir?.({ id, preparacion })
  }

  private async alAcabarMal(c: Corrida, e: unknown): Promise<void> {
    const { id } = c
    if (!(e instanceof Detenida)) {
      // Un fallo inesperado deja la canción en `error` con su código; nunca rompe la cola.
      const codigo = e instanceof ErrorLrclib ? e.codigo : 'ERROR_INTERNO'
      this.deps.registrar?.('error', `${MODULO} ${id}: ${codigo}: ${String(e)}`)
      await this.escribirParada(
        c,
        (p) => ({
          ...p,
          estado: 'error',
          paso: null,
          error: { codigo, mensaje: e instanceof Error ? e.message.slice(0, 300) : '' }
        }),
        true
      )
      return
    }
    if (e.motivo === 'eliminar') return
    this.deps.registrar?.('info', `${MODULO} ${id}: detenida (${e.motivo})`)
    await this.escribirParada(c, (p) => ({
      ...p,
      estado: 'detenida',
      error: e.motivo === 'cierre' ? { codigo: 'CIERRE', mensaje: '' } : null
    }))
  }

  /**
   * Deja el registro tras detenerse o fallar. Si la corrida no había hecho nada (no había registro antes
   * y no guardó ni búsqueda ni elección), retira el campo: es como si nunca hubiera empezado.
   */
  private async escribirParada(
    c: Corrida,
    cambiar: (p: Preparacion) => Preparacion,
    siempreRegistro = false
  ): Promise<void> {
    const p = this.deps.biblioteca.obtener(c.id)?.preparacion
    if (!p) return
    const sinHacerNada = c.sinRegistroPrevio && !p.busqueda && !p.eleccion && !p.fines
    try {
      if (sinHacerNada && !siempreRegistro) await this.escribirRegistro(c.id, null)
      else
        await this.escribirRegistro(c.id, {
          ...cambiar(p),
          actualizado: this.ahora().toISOString()
        })
    } catch {
      // La canción pudo desaparecer entre medias: no hay nada que escribir.
    }
  }

  // --- Cambios en la biblioteca ------------------------------------------------------------------

  private alCambiarCancion(e: EventoCancion): void {
    if (e.eliminada) {
      this.firmasDudosas.delete(e.id)
      void this.detener(e.id, 'eliminar')
      return
    }
    const cancion = this.deps.biblioteca.obtener(e.id)
    if (!cancion) return
    const c = this.corridas.get(e.id)
    if (c) {
      this.vigilarUsuario(c, cancion)
      return
    }
    if (cancion.preparacion) this.recontarSiCambia(cancion)
  }

  /**
   * Edición del usuario durante la corrida (ADR 0025 §2): si cambia tiempos o texto de una letra que ya
   * existía y no los escribe la corrida, se detiene. Que aparezca una letra (la eligió el usuario) no la
   * detiene: sigue sin sustituirla y solo la comprueba (spec 04, F5-P7).
   */
  private vigilarUsuario(c: Corrida, cancion: Cancion): void {
    if (c.escribiendo) return
    const firma = firmaDeLetra(cancion)
    if (c.firma !== null && firma !== c.firma) {
      c.ctl.abort(new Detenida('usuario'))
      return
    }
    c.firma = firma
  }

  /** Recuento de dudosas tras cada escritura de la letra de una canción con registro (ADR 0024 §3). */
  private recontarSiCambia(cancion: Cancion): void {
    const firma = JSON.stringify([cancion.letra, cancion.metadatos.duracion_ms])
    if (this.firmasDudosas.get(cancion.id) === firma) return
    this.firmasDudosas.set(cancion.id, firma)
    const previo = this.recuentos.get(cancion.id) ?? Promise.resolve()
    const tarea = previo.then(() => this.recontar(cancion.id)).catch(() => undefined)
    this.recuentos.set(cancion.id, tarea)
    void tarea.finally(() => {
      if (this.recuentos.get(cancion.id) === tarea) this.recuentos.delete(cancion.id)
    })
  }

  private async recontar(id: string): Promise<void> {
    const cancion = this.deps.biblioteca.obtener(id)
    if (!cancion?.preparacion || this.corridas.has(id)) return
    const n = (await this.deps.contarDudosas(cancion)) ?? { dudosas: 0, importantes: 0 }
    const actual = this.deps.biblioteca.obtener(id)?.preparacion
    if (!actual || this.corridas.has(id)) return
    if (actual.dudosas === n.dudosas && actual.dudosas_importantes === n.importantes) return
    await this.escribirRegistro(id, {
      ...actual,
      dudosas: n.dudosas,
      dudosas_importantes: n.importantes
    })
  }

  /** Espera a que acaben las corridas y los recuentos en vuelo (pruebas y cierre). */
  async enReposo(): Promise<void> {
    await Promise.all([
      ...[...this.corridas.values()].map((c) => c.fin),
      ...this.recuentos.values()
    ])
  }
}
