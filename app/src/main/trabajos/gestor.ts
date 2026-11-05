import { randomUUID } from 'node:crypto'
import type {
  ColaTrabajo,
  EventoProgresoIpc,
  PasoTrabajo,
  ProgresoTrabajo,
  TrabajoIpc
} from '../../shared'
import type { CambioCancion } from '../biblioteca'
import { registroNulo, type RegistroApp } from '../registro'
import { esperarCancelable } from './cancelable'
import { EstimadorProgreso, UmbralProgreso } from './progreso'
import type { OpcionesEjecucion } from './worker'

const MODULO = 'trabajos'
const COLAS: readonly ColaTrabajo[] = ['pesada', 'ligera']
/** Mínimo entre dos eventos de progreso del mismo trabajo (≤ 4 por segundo). */
export const INTERVALO_PROGRESO_MS = 250

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

export interface PeticionTrabajo {
  cancionId: string
  paso: PasoTrabajo
  cola: ColaTrabajo
  comando: string
  args: Record<string, unknown>
  /**
   * Aplica el resultado del worker: devuelve el cambio de canción (pistas, fuente…)
   * que se escribe junto con el paso `completado`. Si lanza, el paso queda en `error`.
   */
  alResultado?: (
    datos: Record<string, unknown>
  ) => CambioCancion | void | Promise<CambioCancion | void>
  /** Limpieza del parcial tras cancelar o fallar, cuando el proceso ya ha terminado. */
  alDescartar?: () => void | Promise<void>
}

export type ResultadoTrabajo = NonNullable<TrabajoIpc['resultado']>

interface Trabajo extends PeticionTrabajo {
  id: string
  estado: TrabajoIpc['estado']
  resultado: ResultadoTrabajo | null
  error: { codigo: string; mensaje: string } | null
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
  ultimoEnvioMs: number
  temporizador: ReturnType<typeof setTimeout> | null
  /** Se resuelve cuando el trabajo ha terminado del todo (paso escrito incluido). */
  fin: Promise<void>
  terminar: () => void
}

function aError(e: unknown): { codigo: string; mensaje: string } {
  const codigo = (e as { codigo?: unknown } | null)?.codigo
  const mensaje = (e as { mensaje?: unknown; message?: unknown } | null) ?? {}
  return {
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
      estimador: new EstimadorProgreso(),
      umbral: new UmbralProgreso(),
      escrituras: Promise.resolve(),
      motivo: null,
      reintentado: false,
      ultimoEnvioMs: Number.NEGATIVE_INFINITY,
      temporizador: null,
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
      progreso: t.progreso ? { ...t.progreso } : null
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
    error: { codigo: string; mensaje: string } | null,
    extra: CambioCancion = {}
  ): CambioCancion {
    return {
      ...extra,
      pasos: {
        ...extra.pasos,
        [t.paso]: {
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
    let error: { codigo: string; mensaje: string } | null = null
    try {
      await this.escribirPaso(t, this.pasoCambio(t, 'en_curso', null))
      const lanzar = (): Promise<Record<string, unknown>> =>
        this.ejecutarWorker(t.comando, t.args, {
          señal: t.control.signal,
          alProgreso: (m) => this.alProgreso(t, m.fase, m.valor, m.detalle),
          alLog: (m) => {
            if (m.nivel === 'warning' || m.nivel === 'error') {
              this.registro.escribir(m.nivel === 'error' ? 'error' : 'aviso', MODULO, m.mensaje)
            }
          }
        })
      let datos: Record<string, unknown>
      try {
        datos = await lanzar()
      } catch (e) {
        if (!this.debeReintentar(t, e)) throw e
        // YouTube bloqueó la descarga: se actualiza yt-dlp y se repite una vez sin soltar el puesto.
        t.reintentado = true
        this.alProgreso(t, 'actualizando', null)
        await esperarCancelable(this.actualizarYtDlp!(), t.control.signal, e)
        datos = await lanzar()
      }
      if (t.control.signal.aborted) throw { codigo: 'CANCELADO', mensaje: 'Trabajo cancelado' }
      const extra = (await t.alResultado?.(datos)) ?? {}
      await this.limpiarProgreso(t)
      await this.escribirPaso(t, this.pasoCambio(t, 'completado', null, extra))
    } catch (e) {
      const err = aError(e)
      if (err.codigo === 'CANCELADO' || t.control.signal.aborted) {
        resultado = t.motivoCancelacion === 'cierre' ? 'interrumpido' : 'cancelado'
      } else {
        resultado = 'error'
        error = err
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
    t.progreso = t.estimador.registrar(fase, valor, this.ahora())
    const bytes = detalle?.bytes
    const total = detalle?.total
    if (typeof bytes === 'number' && bytes >= 0) {
      t.progreso.detalle = {
        bytes,
        total: typeof total === 'number' && total >= 0 ? total : null
      }
    }
    if (t.progreso.valor !== null && t.umbral.aceptar(t.progreso.valor)) {
      const v = t.progreso.valor
      void this.escribirPaso(t, {
        pasos: { [t.paso]: { progreso: Math.round(v * 1000) / 1000 } }
      }).catch((e: unknown) =>
        this.registro.escribir('aviso', MODULO, `no se pudo guardar el progreso: ${String(e)}`)
      )
    }
    this.enviarProgreso(t)
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
