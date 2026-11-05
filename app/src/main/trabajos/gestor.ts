import { randomUUID } from 'node:crypto'
import type {
  ColaTrabajo,
  DispositivoSeparacion,
  EventoProgresoIpc,
  ModeloId,
  MotivoReintento,
  PasoTrabajo,
  ProgresoTrabajo,
  TrabajoIpc
} from '../../shared'
import type { CambioCancion } from '../biblioteca'
import { registroNulo, type RegistroApp } from '../registro'
import { esperarCancelable } from './cancelable'
import { EstimadorProgreso, UmbralProgreso, type RitmoEsperado } from './progreso'
import type { OpcionesEjecucion } from './worker'

const MODULO = 'trabajos'
const COLAS: readonly ColaTrabajo[] = ['pesada', 'ligera']
/** Mínimo entre dos eventos de progreso del mismo trabajo (≤ 4 por segundo). */
export const INTERVALO_PROGRESO_MS = 250
/** Cada cuánto avanza el progreso interpolado de la separación (0064). */
export const INTERVALO_INTERPOLACION_MS = 1000

/** Subconjunto de `ServicioBiblioteca` que usa el gestor (se simula en los tests). */
export interface BibliotecaTrabajos {
  actualizar(id: string, cambio: CambioCancion): Promise<unknown>
}

export type EjecutarWorker = (
  comando: string,
  args: Record<string, unknown>,
  opciones: OpcionesEjecucion
) => Promise<Record<string, unknown>>

/** Puerto del cerrojo de yt-dlp (0050): la descarga no arranca mientras hay una actualización. */
export interface PuertoMantenimiento {
  enMantenimiento(): boolean
  /** Avisa una sola vez cuando termina el mantenimiento. */
  alTerminarMantenimiento(cb: () => void): void
}

export interface OpcionesGestor {
  /** Si se da, los trabajos `descargar-youtube` esperan `en_cola` (motivo `mantenimiento`). */
  mantenimiento?: PuertoMantenimiento
  /**
   * Actualiza yt-dlp tras un `YOUTUBE_BLOQUEADO` (0050). Con ella, la descarga se relanza una
   * vez; si la actualización falla, el trabajo termina con el error original.
   */
  actualizarYtDlp?: () => Promise<unknown>
  biblioteca: BibliotecaTrabajos
  /** Cliente del worker (0013). */
  ejecutar: EjecutarWorker
  registro?: RegistroApp
  /** Reloj en ms (pruebas). */
  ahora?: () => number
  /** Fecha ISO para `pasos.<paso>.actualizado` (pruebas). */
  fechaIso?: () => string
}

/** Error tal y como lo ve la política de reintento. */
export interface ErrorReintento {
  codigo: string
  mensaje: string
  reintentable: boolean
}

/** Plan de un reintento automático: argumentos nuevos, espera previa y motivo (fase `reintentando`). */
export interface PlanReintento {
  args: Record<string, unknown>
  esperaMs: number
  /**
   * `null` = relanzar sin anunciarlo ni contarlo como intento (modelo corrupto, 0066): el progreso
   * lo da `antes` (fase `descargando_modelo`).
   */
  motivo: MotivoReintento | null
  /** Dispositivo del nuevo intento, si cambia (p. ej. de CUDA a CPU; 0066). */
  dispositivo?: DispositivoSeparacion
  /** Trabajo previo al relanzamiento, cancelable, con progreso (p. ej. volver a descargar el modelo). */
  antes?: (contexto: ContextoEmpezar) => Promise<void>
}

/** Lo que recibe un gancho que trabaja antes de lanzar el worker: cancelación y progreso. */
export interface ContextoEmpezar {
  señal: AbortSignal
  /** Emite una fase propia del main (`descargando_modelo`) con su valor 0–1 y detalle. */
  alProgreso: (fase: string, valor: number | null, detalle?: Record<string, unknown>) => void
}

/**
 * Decide si un trabajo fallido se relanza (0063). `intento` es el que acaba de fallar (1, 2…);
 * `null` = error definitivo. El gestor no limita los intentos: los limita la política.
 */
export type PoliticaReintento = (
  error: ErrorReintento,
  intento: number,
  args: Record<string, unknown>
) => PlanReintento | null

/** Contexto con el que se aplica el resultado: intento que lo logró y argumentos finales. */
export interface ContextoResultado {
  intento: number
  args: Record<string, unknown>
}

/** Lo que decide un trabajo cuando empieza de verdad (no al encolarlo): argumentos, ritmo y modo. */
export interface InicioTrabajo {
  args: Record<string, unknown>
  ritmoEsperado?: RitmoEsperado
  /** Modelo y dispositivo realmente usados (`TrabajoIpc.modo` / `dispositivo`). */
  modo?: ModeloId
  dispositivo?: DispositivoSeparacion
}

export interface PeticionTrabajo {
  cancionId: string
  paso: PasoTrabajo
  cola: ColaTrabajo
  comando: string
  args: Record<string, unknown>
  /**
   * Se llama cuando el trabajo sale de la cola y empieza (0065): sustituye `args` (y el ritmo
   * esperado) por los calculados con el estado de ese momento, p. ej. el modo de separación
   * vigente al empezar. Si lanza, el trabajo termina en `error`.
   */
  alEmpezar?: (
    trabajo: { id: string; cancionId: string },
    contexto: ContextoEmpezar
  ) => InicioTrabajo | Promise<InicioTrabajo>
  /**
   * Variables de entorno extra del worker en cada intento (0066: `SHINOBI_INTENTO` del separador
   * falso, que cambia en cada reintento).
   */
  entornoIntento?: (intento: number) => Record<string, string>
  /** Traduce el error definitivo antes de escribirlo en el paso (0066: `PROCESO_TERMINADO` → memoria). */
  traducirError?: (error: { codigo: string; mensaje: string }) => {
    codigo: string
    mensaje: string
  }
  /** Duración esperada de la fase `separando` (0064): activa la interpolación y la ETA con factor. */
  ritmoEsperado?: RitmoEsperado
  /**
   * Aplica el resultado del worker: devuelve el cambio de canción (pistas, fuente…)
   * que se escribe junto con el paso `completado`. Si lanza, el paso queda en `error`.
   */
  alResultado?: (
    datos: Record<string, unknown>,
    contexto: ContextoResultado
  ) => CambioCancion | void | Promise<CambioCancion | void>
  /** Limpieza del parcial tras cancelar o fallar, cuando el proceso ya ha terminado. */
  alDescartar?: () => void | Promise<void>
  /**
   * Reintentos automáticos (0063). Si devuelve un plan, el trabajo sigue vivo con el mismo `id`,
   * sin pasar a `error`: se anuncia como fase `reintentando` y, pasada la espera, se relanza.
   */
  politicaReintento?: PoliticaReintento
}

export type ResultadoTrabajo = NonNullable<TrabajoIpc['resultado']>

interface Trabajo extends PeticionTrabajo {
  id: string
  estado: TrabajoIpc['estado']
  resultado: ResultadoTrabajo | null
  error: { codigo: string; mensaje: string; modelo?: ModeloId } | null
  progreso: ProgresoTrabajo | null
  control: AbortController
  /** Por qué se cancela: usuario -> `pendiente`; cierre de la app -> `interrumpido`. */
  motivoCancelacion: 'usuario' | 'cierre' | null
  estimador: EstimadorProgreso
  umbral: UmbralProgreso
  /** Cadena de escrituras en `cancion.json` de este trabajo (en orden). */
  escrituras: Promise<unknown>
  /** `mantenimiento` mientras espera en la cola a que termine una actualización de yt-dlp. */
  motivo: 'mantenimiento' | null
  reintentado: boolean
  /** Intento en curso (1, 2…). */
  intento: number
  modo: ModeloId | null
  dispositivo: DispositivoSeparacion | null
  ultimoEnvioMs: number
  temporizador: ReturnType<typeof setTimeout> | null
  /** Avanza el progreso interpolado cada segundo (solo con `ritmoEsperado`). */
  interpolador: ReturnType<typeof setInterval> | null
  /** Se resuelve cuando el trabajo ha terminado del todo (paso escrito incluido). */
  fin: Promise<void>
  terminar: () => void
}

function aError(e: unknown): { codigo: string; mensaje: string; modelo?: ModeloId } {
  const codigo = (e as { codigo?: unknown } | null)?.codigo
  const mensaje = (e as { mensaje?: unknown; message?: unknown } | null) ?? {}
  const modelo = (e as { modelo?: unknown } | null)?.modelo
  return {
    ...(modelo === 'calidad' || modelo === 'rapido' ? { modelo } : {}),
    codigo: typeof codigo === 'string' && codigo ? codigo : 'ERROR_INTERNO',
    mensaje:
      typeof mensaje.mensaje === 'string'
        ? mensaje.mensaje
        : typeof mensaje.message === 'string'
          ? mensaje.message
          : 'Algo salió mal.'
  }
}

/**
 * Orquesta los trabajos del worker (arquitectura.md §6): dos colas FIFO
 * independientes (`pesada` y `ligera`, concurrencia 1 cada una). Refleja el
 * estado en el paso de la canción exclusivamente a través del servicio de
 * biblioteca y avisa de los cambios con `suscribir` / `suscribirProgreso`.
 */
export class GestorTrabajos {
  private readonly biblioteca: BibliotecaTrabajos
  private readonly ejecutarWorker: EjecutarWorker
  private readonly registro: RegistroApp
  private readonly ahora: () => number
  private readonly fechaIso: () => string
  private readonly esperando: Record<ColaTrabajo, Trabajo[]> = { pesada: [], ligera: [] }
  private readonly activo: Record<ColaTrabajo, Trabajo | null> = { pesada: null, ligera: null }
  private readonly porId = new Map<string, Trabajo>()
  private readonly oyentes = new Set<(t: TrabajoIpc) => void>()
  private readonly oyentesProgreso = new Set<(p: EventoProgresoIpc) => void>()
  private cerrando = false
  private readonly mantenimiento: PuertoMantenimiento | undefined
  private readonly actualizarYtDlp: (() => Promise<unknown>) | undefined
  private readonly vigilando = new Set<ColaTrabajo>()

  constructor(opciones: OpcionesGestor) {
    this.mantenimiento = opciones.mantenimiento
    this.actualizarYtDlp = opciones.actualizarYtDlp
    this.biblioteca = opciones.biblioteca
    this.ejecutarWorker = opciones.ejecutar
    this.registro = opciones.registro ?? registroNulo
    this.ahora = opciones.ahora ?? (() => Date.now())
    this.fechaIso = opciones.fechaIso ?? (() => new Date().toISOString())
  }

  /** Encola un trabajo y lo lanza en cuanto su cola lo permita. */
  encolar(peticion: PeticionTrabajo): TrabajoIpc {
    if (this.cerrando) throw new Error('El gestor de trabajos se está cerrando.')
    if (!COLAS.includes(peticion.cola)) throw new Error(`Cola desconocida: ${peticion.cola}`)
    let terminar: () => void = () => undefined
    const fin = new Promise<void>((r) => (terminar = r))
    const t: Trabajo = {
      ...peticion,
      id: randomUUID(),
      estado: 'en_cola',
      resultado: null,
      error: null,
      progreso: null,
      control: new AbortController(),
      motivoCancelacion: null,
      estimador: new EstimadorProgreso(undefined, peticion.ritmoEsperado),
      umbral: new UmbralProgreso(),
      escrituras: Promise.resolve(),
      motivo: null,
      reintentado: false,
      intento: 1,
      modo: null,
      dispositivo: null,
      ultimoEnvioMs: Number.NEGATIVE_INFINITY,
      temporizador: null,
      interpolador: null,
      fin,
      terminar
    }
    this.porId.set(t.id, t)
    this.esperando[t.cola].push(t)
    this.emitirCambio(t)
    this.bombear(t.cola)
    return this.instantanea(t)
  }

  /** Trabajos en curso y en cola, en curso primero y luego por cola y posición. */
  listar(): TrabajoIpc[] {
    return COLAS.flatMap((cola) => [
      ...(this.activo[cola] ? [this.activo[cola]] : []),
      ...this.esperando[cola]
    ]).map((t) => this.instantanea(t))
  }

  hayPendientes(): boolean {
    return this.porId.size > 0
  }

  /** Estado de un trabajo vivo (en cola o en curso), o undefined. */
  obtener(id: string): TrabajoIpc | undefined {
    const t = this.porId.get(id)
    return t ? this.instantanea(t) : undefined
  }

  /**
   * Cancela un trabajo. En cola: se retira sin lanzar nada. En curso: se mata el
   * proceso y la promesa se resuelve cuando ya ha terminado y el paso está escrito.
   * Devuelve false si el trabajo no existe (o ya terminó).
   */
  async cancelar(id: string, motivo: 'usuario' | 'cierre' = 'usuario'): Promise<boolean> {
    const t = this.porId.get(id)
    if (!t) return false
    t.motivoCancelacion ??= motivo
    if (t.estado === 'en_cola') {
      this.esperando[t.cola] = this.esperando[t.cola].filter((x) => x !== t)
      this.finalizar(t, 'cancelado')
      this.emitirPosiciones(t.cola)
      await t.fin
      return true
    }
    t.control.abort()
    await t.fin
    return true
  }

  /** Cancela todos los trabajos de una canción (p. ej. antes de eliminarla). */
  async cancelarDeCancion(cancionId: string): Promise<void> {
    const ids = [...this.porId.values()].filter((t) => t.cancionId === cancionId).map((t) => t.id)
    await Promise.all(ids.map((id) => this.cancelar(id)))
  }

  /**
   * Cierre de la app: cancela todo y espera a que no quede ningún proceso hijo.
   * Los pasos que estaban en curso quedan `interrumpido` (ux/04 §3).
   */
  async cancelarTodos(): Promise<void> {
    this.cerrando = true
    await Promise.all([...this.porId.keys()].map((id) => this.cancelar(id, 'cierre')))
  }

  suscribir(cb: (trabajo: TrabajoIpc) => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  suscribirProgreso(cb: (progreso: EventoProgresoIpc) => void): () => void {
    this.oyentesProgreso.add(cb)
    return () => this.oyentesProgreso.delete(cb)
  }

  // ---- Interno ----

  private instantanea(t: Trabajo): TrabajoIpc {
    const indice = t.estado === 'en_cola' ? this.esperando[t.cola].indexOf(t) : -1
    return {
      id: t.id,
      cancionId: t.cancionId,
      paso: t.paso,
      cola: t.cola,
      comando: t.comando,
      estado: t.estado,
      posicion: indice >= 0 ? indice + 1 : null,
      motivo: t.estado === 'en_cola' ? t.motivo : null,
      resultado: t.resultado,
      error: t.error,
      progreso: t.progreso ? { ...t.progreso } : null,
      intento: this.intentoVisible(t),
      ...(t.modo ? { modo: t.modo } : {}),
      ...(t.dispositivo ? { dispositivo: t.dispositivo } : {})
    }
  }

  private emitirCambio(t: Trabajo): void {
    const carga = this.instantanea(t)
    for (const cb of this.oyentes) {
      try {
        cb(carga)
      } catch (e) {
        this.registro.escribir('error', MODULO, `oyente de trabajos falló: ${String(e)}`)
      }
    }
  }

  /** Avisa a los trabajos de la cola de su nueva posición. */
  private emitirPosiciones(cola: ColaTrabajo): void {
    for (const t of this.esperando[cola]) this.emitirCambio(t)
  }

  private bombear(cola: ColaTrabajo): void {
    if (this.activo[cola]) return
    const siguiente = this.esperando[cola][0]
    if (!siguiente) return
    if (
      this.mantenimiento?.enMantenimiento() &&
      (siguiente.comando === 'descargar-youtube' || siguiente.comando === 'info-youtube')
    ) {
      // Sigue `en_cola` hasta que acabe la actualización de yt-dlp.
      if (siguiente.motivo !== 'mantenimiento') {
        siguiente.motivo = 'mantenimiento'
        this.emitirCambio(siguiente)
      }
      if (!this.vigilando.has(cola)) {
        this.vigilando.add(cola)
        this.mantenimiento.alTerminarMantenimiento(() => {
          this.vigilando.delete(cola)
          this.bombear(cola)
        })
      }
      return
    }
    this.esperando[cola].shift()
    siguiente.motivo = null
    this.activo[cola] = siguiente
    siguiente.estado = 'en_curso'
    this.emitirCambio(siguiente)
    this.emitirPosiciones(cola)
    void this.correr(siguiente)
  }

  private escribirPaso(t: Trabajo, cambio: CambioCancion): Promise<void> {
    const op = t.escrituras.then(async () => {
      await this.biblioteca.actualizar(t.cancionId, cambio)
    })
    t.escrituras = op.catch(() => undefined)
    return op
  }

  private pasoCambio(
    t: Trabajo,
    estado: 'pendiente' | 'en_curso' | 'completado' | 'error' | 'interrumpido',
    error: { codigo: string; mensaje: string; modelo?: ModeloId } | null,
    extra: CambioCancion = {}
  ): CambioCancion {
    // En la separación el error recuerda con qué modelo se intentó (0066: oferta del modelo Rápido).
    const modelo =
      error && t.paso === 'separacion' ? (error.modelo ?? t.modo ?? undefined) : undefined
    if (error && t.paso === 'separacion') error = { ...error, ...(modelo ? { modelo } : {}) }
    return {
      ...extra,
      pasos: {
        ...extra.pasos,
        [t.paso]: {
          // `segundos` (0069) viaja con el paso completado; al reempezar se borra.
          ...(t.paso === 'separacion'
            ? { segundos: extra.pasos?.separacion?.segundos ?? null }
            : {}),
          estado,
          actualizado: this.fechaIso(),
          error,
          progreso: estado === 'en_curso' ? 0 : null
        }
      }
    }
  }

  private async correr(t: Trabajo): Promise<void> {
    let resultado: ResultadoTrabajo = 'completado'
    let error: { codigo: string; mensaje: string; modelo?: ModeloId } | null = null
    try {
      await this.escribirPaso(t, this.pasoCambio(t, 'en_curso', null))
      if (t.alEmpezar) {
        const inicio = await t.alEmpezar(
          { id: t.id, cancionId: t.cancionId },
          this.contextoEmpezar(t)
        )
        if (t.control.signal.aborted) throw { codigo: 'CANCELADO', mensaje: 'Trabajo cancelado' }
        t.args = inicio.args
        t.modo = inicio.modo ?? null
        t.dispositivo = inicio.dispositivo ?? null
        if (inicio.ritmoEsperado) {
          t.ritmoEsperado = inicio.ritmoEsperado
          t.estimador = new EstimadorProgreso(undefined, t.ritmoEsperado)
        }
        this.emitirCambio(t)
      }
      const lanzar = (): Promise<Record<string, unknown>> =>
        this.ejecutarWorker(t.comando, t.args, {
          señal: t.control.signal,
          ...(t.entornoIntento ? { env: t.entornoIntento(t.intento) } : {}),
          alProgreso: (m) => this.alProgreso(t, m.fase, m.valor, m.detalle),
          alLog: (m) => {
            if (m.nivel === 'warning' || m.nivel === 'error') {
              this.registro.escribir(m.nivel === 'error' ? 'error' : 'aviso', MODULO, m.mensaje)
            }
          }
        })
      let datos: Record<string, unknown>
      for (;;) {
        try {
          datos = await lanzar()
          break
        } catch (e) {
          if (t.control.signal.aborted) throw e
          if (this.debeReintentar(t, e)) {
            // YouTube bloqueó la descarga: se actualiza yt-dlp y se repite una vez sin soltar el puesto.
            t.reintentado = true
            this.alProgreso(t, 'actualizando', null)
            await esperarCancelable(this.actualizarYtDlp!(), t.control.signal, e)
            continue
          }
          const plan = this.planReintento(t, e)
          if (!plan) throw e
          await this.esperarReintento(t, plan)
        }
      }
      if (t.control.signal.aborted) throw { codigo: 'CANCELADO', mensaje: 'Trabajo cancelado' }
      const extra = (await t.alResultado?.(datos, { intento: t.intento, args: t.args })) ?? {}
      await this.limpiarProgreso(t)
      await this.escribirPaso(t, this.pasoCambio(t, 'completado', null, extra))
    } catch (e) {
      const err = aError(e)
      if (err.codigo === 'CANCELADO' || t.control.signal.aborted) {
        resultado = t.motivoCancelacion === 'cierre' ? 'interrumpido' : 'cancelado'
      } else {
        resultado = 'error'
        error = t.traducirError ? { ...err, ...t.traducirError(err) } : err
        this.registro.escribir('error', MODULO, `${t.comando} (${t.cancionId}): ${err.codigo}`)
      }
      await this.limpiarProgreso(t)
      await this.descartar(t)
      const paso =
        resultado === 'cancelado'
          ? 'pendiente'
          : resultado === 'interrumpido'
            ? 'interrumpido'
            : 'error'
      await this.escribirPaso(t, this.pasoCambio(t, paso, error)).catch((e2: unknown) =>
        this.registro.escribir('error', MODULO, `no se pudo escribir el paso: ${String(e2)}`)
      )
    }
    this.activo[t.cola] = null
    this.finalizar(t, resultado, error)
    this.bombear(t.cola)
  }

  private contextoEmpezar(t: Trabajo): ContextoEmpezar {
    return {
      señal: t.control.signal,
      alProgreso: (fase, valor, detalle) => this.alProgreso(t, fase, valor, detalle)
    }
  }

  private planReintento(t: Trabajo, e: unknown): PlanReintento | null {
    if (!t.politicaReintento) return null
    const bruto = e as { reintentable?: unknown } | null
    try {
      return t.politicaReintento(
        { ...aError(e), reintentable: bruto?.reintentable === true },
        t.intento,
        t.args
      )
    } catch (e2) {
      this.registro.escribir('error', MODULO, `politicaReintento falló: ${String(e2)}`)
      return null
    }
  }

  /**
   * Fase `reintentando`: descarta los parciales, anuncia la espera (la cuenta atrás la pinta la
   * interfaz) y espera sin proceso vivo. Cancelar o cerrar la app durante la espera rechaza con
   * `CANCELADO`. Al volver, `t.args` y `t.intento` ya son los del nuevo intento.
   */
  private async esperarReintento(t: Trabajo, plan: PlanReintento): Promise<void> {
    if (plan.motivo === null) {
      // Relanzamiento silencioso (modelo corrupto): no cuenta como intento ni se anuncia.
      this.registro.escribir(
        'aviso',
        MODULO,
        `${t.comando} (${t.cancionId}): relanzado tras reparar el modelo`
      )
      await this.descartar(t)
      if (t.control.signal.aborted) throw { codigo: 'CANCELADO', mensaje: 'Trabajo cancelado' }
      t.args = plan.args
      await plan.antes?.(this.contextoEmpezar(t))
      if (t.control.signal.aborted) throw { codigo: 'CANCELADO', mensaje: 'Trabajo cancelado' }
      return
    }
    this.registro.escribir(
      'aviso',
      MODULO,
      `${t.comando} (${t.cancionId}): reintento ${t.intento + 1} en ${plan.esperaMs} ms (${plan.motivo})`
    )
    await this.descartar(t)
    if (t.control.signal.aborted) throw { codigo: 'CANCELADO', mensaje: 'Trabajo cancelado' }
    t.intento += 1
    t.args = plan.args
    if (plan.dispositivo) t.dispositivo = plan.dispositivo
    if (t.temporizador) {
      clearTimeout(t.temporizador)
      t.temporizador = null
    }
    this.detenerInterpolador(t)
    t.estimador = new EstimadorProgreso(undefined, t.ritmoEsperado)
    t.umbral = new UmbralProgreso()
    t.progreso = {
      fase: 'reintentando',
      valor: null,
      etaSegundos: null,
      detalle: { motivo: plan.motivo, espera_s: Math.ceil(plan.esperaMs / 1000) }
    }
    const intento = this.intentoVisible(t)
    if (intento !== null) t.progreso.intento = intento
    this.emitirCambio(t)
    this.difundirProgreso(t)
    await new Promise<void>((ok) => {
      const fin = (): void => {
        clearTimeout(espera)
        t.control.signal.removeEventListener('abort', fin)
        ok()
      }
      const espera = setTimeout(fin, plan.esperaMs)
      t.control.signal.addEventListener('abort', fin, { once: true })
    })
    if (t.control.signal.aborted) throw { codigo: 'CANCELADO', mensaje: 'Trabajo cancelado' }
    await plan.antes?.(this.contextoEmpezar(t))
    if (t.control.signal.aborted) throw { codigo: 'CANCELADO', mensaje: 'Trabajo cancelado' }
  }

  /** `intento` que se comunica a la interfaz: solo con política de reintento y en el rango 1–3. */
  private intentoVisible(t: Trabajo): number | null {
    return t.politicaReintento && t.intento <= 3 ? t.intento : null
  }

  private debeReintentar(t: Trabajo, e: unknown): boolean {
    return (
      this.actualizarYtDlp !== undefined &&
      t.comando === 'descargar-youtube' &&
      !t.reintentado &&
      !t.control.signal.aborted &&
      aError(e).codigo === 'YOUTUBE_BLOQUEADO'
    )
  }

  private async descartar(t: Trabajo): Promise<void> {
    try {
      await t.alDescartar?.()
    } catch (e) {
      this.registro.escribir('error', MODULO, `alDescartar falló: ${String(e)}`)
    }
  }

  private async limpiarProgreso(t: Trabajo): Promise<void> {
    this.detenerInterpolador(t)
    if (t.temporizador) {
      // El último valor pendiente no se pierde.
      clearTimeout(t.temporizador)
      t.temporizador = null
      this.difundirProgreso(t)
    }
    await t.escrituras
  }

  private finalizar(t: Trabajo, resultado: ResultadoTrabajo, error: Trabajo['error'] = null): void {
    t.estado = 'terminado'
    t.resultado = resultado
    t.error = error
    this.porId.delete(t.id)
    this.emitirCambio(t)
    t.terminar()
  }

  private alProgreso(
    t: Trabajo,
    fase: string,
    valor: number | null,
    detalle?: Record<string, unknown>
  ): void {
    if (t.estado !== 'en_curso') return
    const paso = detalle?.paso
    const totalPasos = detalle?.total
    const pasos =
      typeof paso === 'number' && typeof totalPasos === 'number'
        ? { paso, total: totalPasos }
        : undefined
    t.progreso = t.estimador.registrar(fase, valor, this.ahora(), pasos)
    const bytes = detalle?.bytes
    const total = detalle?.total
    const intento = this.intentoVisible(t)
    if (intento !== null) t.progreso.intento = intento
    if (typeof bytes === 'number' && bytes >= 0) {
      t.progreso.detalle = {
        bytes,
        total: typeof total === 'number' && total >= 0 ? total : null
      }
    } else if (pasos) {
      t.progreso.detalle = pasos
    }
    // Se persiste el valor real, nunca el interpolado.
    if (t.progreso.valor !== null && t.umbral.aceptar(t.estimador.valorReal)) {
      const v = t.estimador.valorReal
      void this.escribirPaso(t, {
        pasos: { [t.paso]: { progreso: Math.round(v * 1000) / 1000 } }
      }).catch((e: unknown) =>
        this.registro.escribir('aviso', MODULO, `no se pudo guardar el progreso: ${String(e)}`)
      )
    }
    this.enviarProgreso(t)
    if (t.estimador.interpolando) this.iniciarInterpolador(t)
    else this.detenerInterpolador(t)
  }

  private iniciarInterpolador(t: Trabajo): void {
    if (t.interpolador) return
    t.interpolador = setInterval(() => {
      const p = t.estado === 'en_curso' ? t.estimador.interpolar(this.ahora()) : null
      if (!p) return this.detenerInterpolador(t)
      t.progreso = { ...t.progreso, ...p }
      this.enviarProgreso(t)
    }, INTERVALO_INTERPOLACION_MS)
  }

  private detenerInterpolador(t: Trabajo): void {
    if (!t.interpolador) return
    clearInterval(t.interpolador)
    t.interpolador = null
  }

  /** Limita a un evento cada `INTERVALO_PROGRESO_MS`; el último valor nunca se pierde. */
  private enviarProgreso(t: Trabajo): void {
    if (t.temporizador) return
    const espera = INTERVALO_PROGRESO_MS - (this.ahora() - t.ultimoEnvioMs)
    if (espera <= 0) {
      this.difundirProgreso(t)
      return
    }
    t.temporizador = setTimeout(() => {
      t.temporizador = null
      if (t.estado === 'en_curso') this.difundirProgreso(t)
    }, espera)
  }

  private difundirProgreso(t: Trabajo): void {
    if (!t.progreso) return
    t.ultimoEnvioMs = this.ahora()
    const carga: EventoProgresoIpc = {
      id: t.id,
      cancionId: t.cancionId,
      paso: t.paso,
      ...t.progreso
    }
    for (const cb of this.oyentesProgreso) {
      try {
        cb(carga)
      } catch (e) {
        this.registro.escribir('error', MODULO, `oyente de progreso falló: ${String(e)}`)
      }
    }
  }
}
