import type { Cancion, Config, TrabajoIpc } from '../../shared'
import type { TandaPreparacionIpc } from '../../shared/ipc'
import type { ConfigParcial } from '../configuracion'
import type { DiarioPendientes, TipoPendiente } from '../trabajos/diario'
import type { TrabajoRetenible } from '../trabajos/gestor'
import type { EventoCorrida, OrigenPreparacion } from './servicio'

const MODULO = 'preparacion'

/** Tres fallos seguidos con el mismo código paran toda la cola (ADR 0025 §5). */
export const FALLOS_SEGUIDOS = 3
/** Cada cuánto se mira si volvió la conexión tras un `SIN_CONEXION` en una descarga. */
export const COMPROBACION_CONEXION_MS = 60_000
/** Los primeros segundos de una tanda no hay estimación fiable (`prog.eta.calculando`). */
export const ESPERA_ESTIMACION_MS = 15_000

const PARADA_TOTAL = new Set(['SIN_ESPACIO', 'RUNTIME_NO_DISPONIBLE'])
const PARADA_DESCARGAS = new Set(['YOUTUBE_BLOQUEADO', 'SIN_CONEXION'])
/** Errores que repetir no arregla: «Reintentar las fallidas» los deja en «Con error». */
const NO_REINTENTABLES = new Set([
  'VIDEO_NO_DISPONIBLE',
  'URL_NO_VALIDA',
  'URL_NO_SOPORTADA',
  'FORMATO_NO_SOPORTADO',
  'ARCHIVO_NO_ENCONTRADO',
  'AUDIO_DEMASIADO_CORTO',
  'RUNTIME_NO_DISPONIBLE'
])

type ResultadoCancion = NonNullable<TandaPreparacionIpc['canciones'][number]['resultado']>
type DescargasParadas = NonNullable<TandaPreparacionIpc['descargasParadas']>

interface Miembro {
  resultado: ResultadoCancion | null
  motivo?: string
  dudosas?: number
}

interface Tanda {
  miembros: Map<string, Miembro>
  inicio: number
  terminada: boolean
}

/** Recuento por resultado de una tanda terminada (aviso `act.cola.fin`). */
export interface ResumenTanda {
  total: number
  listas: number
  esperanLetra: number
  conError: number
}

export interface DependenciasCola {
  gestor: {
    suscribir(cb: (t: TrabajoIpc) => void): () => void
    listar(): TrabajoIpc[]
    fijarFreno(freno: ((t: TrabajoRetenible) => boolean) | null): void
    reanudarCola(): void
  }
  preparacion: {
    suscribirCorridas(cb: (e: EventoCorrida) => void): () => void
    iniciar(cancionId: string, origen: OrigenPreparacion): boolean
    ids(): string[]
  }
  biblioteca: { obtener(id: string): Cancion | null }
  config: {
    obtener(): Pick<Config, 'preparacion'>
    actualizar(parcial: ConfigParcial): Promise<unknown>
  }
  diario: Pick<DiarioPendientes, 'alta' | 'enCurso' | 'baja' | 'tomarHeredadas' | 'restaurar'>
  /** Minutos que faltan para esa canción (duración × factor medido); `null` si no se sabe. */
  estimarMin(cancionId: string): number | null
  /** Vuelve a encolar la descarga (`fuente.reintentar`) o la separación de una canción. */
  reintentarDescarga(cancionId: string): Promise<void>
  separar(cancionId: string): Promise<void>
  emitirTanda(tanda: TandaPreparacionIpc | null): void
  emitirReanudada(evento: { total: number }): void
  /** Aviso único al vaciarse una tanda de 2 o más canciones. */
  avisarTanda?(resumen: ResumenTanda): void
  ahora?(): number
  /** Ejecuta `fn` pasados `ms`; devuelve la función que lo cancela. Sustituible por un reloj falso. */
  programar?(fn: () => void, ms: number): () => void
  registrar?(nivel: 'info' | 'aviso' | 'error', mensaje: string): void
}

/**
 * Cola de preparación como conjunto (ADR 0025 §5, tarea 0309): la tanda en memoria, la pausa (del usuario,
 * persistida, o automática), las paradas por causa, «Reintentar las fallidas» y reanudar al abrir con el
 * diario de pendientes. Mira lo que pasa en el gestor de trabajos y en las corridas de la preparación; no
 * decide nada dentro de una canción.
 */
export class ColaPreparacion {
  private tanda: Tanda | null = null
  private motivoPausa: string | null = null
  private descargasParadas: DescargasParadas | null = null
  private racha: { codigo: string; n: number } | null = null
  /** Se está cerrando (la app o la ventana en macOS): lo que se cancele ahora no es un resultado. */
  private cierre = false
  private cancelarConexion: (() => void) | null = null
  /** Descargas paradas por `SIN_CONEXION`, en orden; la primera es la sonda (nunca se usa un tercero). */
  private sinConexion: string[] = []
  /** Canción cuya descarga se está reintentando como sonda; el freno la deja pasar. */
  private sondeando: string | null = null
  private bajas: (() => void)[] = []
  private readonly ahora: () => number
  private readonly programar: (fn: () => void, ms: number) => () => void

  constructor(private readonly deps: DependenciasCola) {
    this.ahora = deps.ahora ?? Date.now
    this.programar =
      deps.programar ??
      ((fn, ms) => {
        const t = setTimeout(fn, ms)
        return () => clearTimeout(t)
      })
  }

  /** Empieza a mirar el gestor y las corridas, y pone el freno de la cola (pausa y paradas). */
  arrancar(): void {
    this.deps.gestor.fijarFreno((t) => this.retiene(t))
    this.bajas.push(
      this.deps.gestor.suscribir((t) => this.alTrabajo(t)),
      this.deps.preparacion.suscribirCorridas((e) => this.alCorrida(e))
    )
  }

  cerrar(): void {
    for (const baja of this.bajas.splice(0)) baja()
    this.cancelarConexion?.()
    this.cancelarConexion = null
    this.deps.gestor.fijarFreno(null)
  }

  /**
   * El cierre va a parar las corridas y cancelar los trabajos: la tanda se olvida y las cancelaciones
   * que vengan no cuentan (ni dan aviso). La siguiente actividad real vuelve a empezar una tanda.
   */
  alCierre(): void {
    this.cierre = true
    this.tanda = null
    this.emitir()
  }

  // --- Consultas ---------------------------------------------------------------------------------

  /** Pausa de toda la cola: la del usuario (persistida) o una parada automática. */
  pausada(): boolean {
    return this.deps.config.obtener().preparacion.pausada || this.motivoPausa !== null
  }

  /** ¿Forma la canción parte de una tanda de 2 o más canciones aún abierta? Sin id: ¿hay una tanda así? */
  enTandaDeVarias(cancionId?: string): boolean {
    const t = this.tanda
    if (!t || t.terminada || t.miembros.size < 2) return false
    return cancionId === undefined || t.miembros.has(cancionId)
  }

  /** `preparacion.tanda`: `null` sin tanda; una tanda terminada se conserva hasta que empiece otra. */
  estado(): TandaPreparacionIpc | null {
    const t = this.tanda
    if (!t) return null
    const miembros = [...t.miembros]
    return {
      total: miembros.length,
      terminadas: miembros.filter(([, m]) => m.resultado !== null).length,
      pausada: this.pausada(),
      motivoPausa: this.motivoPausa,
      estimacionMin: this.estimacion(t),
      descargasParadas: this.descargasParadas,
      canciones: miembros.map(([id, m]) => ({
        id,
        resultado: m.resultado,
        ...(m.motivo ? { motivo: m.motivo } : {}),
        ...(m.dudosas !== undefined ? { dudosas: m.dudosas } : {})
      }))
    }
  }

  private estimacion(t: Tanda): number | null {
    if (t.terminada) return 0
    if (this.ahora() - t.inicio < ESPERA_ESTIMACION_MS) return null
    let min = 0
    for (const [id, m] of t.miembros) if (m.resultado === null) min += this.deps.estimarMin(id) ?? 0
    return Math.ceil(min)
  }

  // --- Acciones (canales) ------------------------------------------------------------------------

  /** Pausa del usuario: deja terminar lo que está en curso y no lanza más. Se conserva al cerrar. */
  async pausar(): Promise<void> {
    await this.deps.config.actualizar({ preparacion: { pausada: true } })
    this.emitir()
  }

  /** Reanuda en el mismo orden; también levanta las paradas automáticas (la causa se vuelve a comprobar). */
  async reanudar(): Promise<void> {
    await this.deps.config.actualizar({ preparacion: { pausada: false } })
    this.motivoPausa = null
    this.racha = null
    this.liberarDescargas(false)
    this.deps.gestor.reanudarCola()
    this.emitir()
  }

  /**
   * Relanza lo que falló con un error reintentable; vuelve al final de la cola. Si la tanda ya había
   * terminado, empieza una nueva con ellas (spec 04).
   */
  async reintentarFallidas(): Promise<void> {
    const t = this.tanda
    if (!t) return
    const ids = [...t.miembros]
      .filter(([, m]) => m.resultado === 'error' && !NO_REINTENTABLES.has(m.motivo ?? ''))
      .map(([id]) => id)
    if (ids.length === 0) return
    if (t.terminada) this.tanda = null
    else for (const id of ids) t.miembros.delete(id)
    this.racha = null
    this.motivoPausa = null
    this.liberarDescargas(false)
    for (const id of ids) {
      this.anadir(id)
      await this.relanzar(id, 'manual')
    }
    this.deps.gestor.reanudarCola()
    this.emitir()
  }

  /**
   * Reanudar al abrir (ADR 0025 §5): vuelve a encolar lo del diario en su orden. Lo que estaba en curso
   * suma una interrupción; con dos seguidas se queda interrumpido y no se retoma. Con la pausa activa
   * se reanuda en pausa. Devuelve cuántas entradas retomó. Main lo llama tras la comprobación del runtime.
   */
  async reanudarAlAbrir(): Promise<number> {
    const retomar = this.deps.diario
      .tomarHeredadas()
      .filter((e) => this.deps.biblioteca.obtener(e.cancionId))
      .map((e) => ({ ...e, interrupciones: e.interrupciones + (e.enCurso ? 1 : 0) }))
      .filter((e) => e.interrupciones < 2)
    for (const e of retomar) this.deps.diario.restaurar(e)
    for (const e of retomar) {
      this.anadir(e.cancionId)
      await this.relanzar(e.cancionId, undefined, e.tipo)
    }
    if (retomar.length > 0) {
      this.deps.registrar?.('info', `${MODULO}: se retoman ${retomar.length} pendientes al abrir`)
      this.deps.emitirReanudada({ total: new Set(retomar.map((e) => e.cancionId)).size })
    }
    return retomar.length
  }

  /** Vuelve a lanzar lo que le falta a una canción (o lo de un tipo concreto del diario). */
  private async relanzar(
    id: string,
    origen: OrigenPreparacion = 'automatica',
    tipo?: TipoPendiente
  ): Promise<void> {
    const cancion = this.deps.biblioteca.obtener(id)
    if (!cancion) return
    try {
      const { fuente, separacion } = cancion.pasos
      if (tipo === 'fuente' || (!tipo && fuente.estado !== 'completado')) {
        if (fuente.estado !== 'completado') await this.deps.reintentarDescarga(id)
      } else if (tipo === 'separacion' || (!tipo && separacion.estado !== 'completado')) {
        if (separacion.estado !== 'completado') await this.deps.separar(id)
      } else {
        this.deps.preparacion.iniciar(id, cancion.preparacion?.origen ?? origen)
      }
    } catch (e) {
      this.deps.registrar?.('aviso', `${MODULO}: no se pudo relanzar ${id}: ${String(e)}`)
      this.cerrarCancion(id, 'error', 'NO_SE_PUDO_RELANZAR')
    }
  }

  // --- Lo que pasa en el gestor y en las corridas ------------------------------------------------

  private retiene(t: TrabajoRetenible): boolean {
    if (this.pausada()) return true
    if (this.sondeando !== null && t.cancionId === this.sondeando) return false
    return this.descargasParadas !== null && t.comando === 'descargar-youtube'
  }

  private alTrabajo(t: TrabajoIpc): void {
    if (t.estado !== 'terminado') {
      this.cierre = false
      this.anadir(t.cancionId)
      return
    }
    if (this.cierre) return
    const id = t.cancionId
    const hayCorrida = this.deps.preparacion.ids().includes(id)
    if (t.resultado === 'error') {
      const codigo = t.error?.codigo ?? 'ERROR_INTERNO'
      const esSonda = this.sondeando === id && t.comando === 'descargar-youtube'
      if (esSonda) this.sondeando = null
      this.registrarFallo(codigo, t.comando === 'descargar-youtube', id)
      // La sonda falló por otro motivo (y no es una parada): la conexión vuelve y se liberan las demás.
      if (esSonda && codigo !== 'SIN_CONEXION' && this.descargasParadas === 'SIN_CONEXION') {
        this.sinConexion = this.sinConexion.filter((x) => x !== id)
        this.liberarDescargas(true)
      }
      // Con una corrida en marcha, el resultado de la canción lo da la corrida.
      if (!hayCorrida) this.cerrarCancion(id, 'error', codigo)
    } else if (t.resultado === 'cancelado') {
      this.finSonda(id, t.comando)
      if (!hayCorrida) this.cerrarCancion(id, 'cancelada')
    } else if (t.resultado === 'completado') {
      this.racha = null
      this.finSonda(id, t.comando)
      // La fuente seguida de separación y letra no termina aquí; sin preparación, la separación es el final.
      if (
        t.paso === 'separacion' &&
        !hayCorrida &&
        this.tanda?.miembros.get(id)?.resultado === null
      ) {
        this.cerrarCancion(id, 'sin_letra', 'SIN_BUSCAR')
      }
    }
    this.comprobarFin()
  }

  private alCorrida(e: EventoCorrida): void {
    if (e.tipo === 'inicio') {
      this.cierre = false
      this.deps.diario.alta(e.id, 'preparacion')
      this.deps.diario.enCurso(e.id, 'preparacion')
      this.anadir(e.id)
      return
    }
    const p = e.preparacion
    const porCierre = p?.estado === 'detenida' && p.error?.codigo === 'CIERRE'
    this.deps.diario.baja(e.id, 'preparacion', porCierre)
    if (porCierre || this.cierre) return
    if (!p || p.estado === 'detenida') this.cerrarCancion(e.id, 'cancelada')
    else if (p.estado === 'lista_para_revisar') {
      this.racha = null
      this.cerrarCancion(e.id, 'lista_para_revisar', undefined, p.dudosas)
    } else if (p.estado === 'elige_letra') {
      this.racha = null
      this.cerrarCancion(e.id, 'elige_letra')
    } else if (p.estado === 'sin_letra') {
      this.racha = null
      this.cerrarCancion(e.id, 'sin_letra', p.busqueda?.motivo ?? undefined)
    } else if (p.estado === 'error') {
      if (p.busqueda?.resultado === 'pendiente') {
        this.cerrarCancion(e.id, 'letra_pendiente', p.error?.codigo)
      } else {
        const codigo = p.error?.codigo ?? 'ERROR_INTERNO'
        this.registrarFallo(codigo, false)
        this.cerrarCancion(e.id, 'error', codigo)
      }
    }
    this.comprobarFin()
  }

  /** Paradas automáticas y racha de fallos (ADR 0025 §5). */
  private registrarFallo(codigo: string, esDescarga: boolean, id = ''): void {
    if (esDescarga && PARADA_DESCARGAS.has(codigo)) {
      this.descargasParadas = codigo as DescargasParadas
      if (codigo === 'SIN_CONEXION') {
        if (id && !this.sinConexion.includes(id)) this.sinConexion.push(id)
        this.vigilarConexion()
      }
      this.deps.registrar?.('aviso', `${MODULO}: descargas paradas (${codigo})`)
    }
    this.racha = this.racha?.codigo === codigo ? { codigo, n: this.racha.n + 1 } : { codigo, n: 1 }
    if (PARADA_TOTAL.has(codigo) || this.racha.n >= FALLOS_SEGUIDOS) {
      this.motivoPausa = codigo
      this.deps.registrar?.('aviso', `${MODULO}: cola parada (${codigo})`)
    }
    this.emitir()
  }

  /** La sonda terminó bien (o la cancelaron): la conexión funciona y se liberan las demás. */
  private finSonda(id: string, comando: string): void {
    if (this.sondeando !== id || comando !== 'descargar-youtube') return
    this.sondeando = null
    this.liberarDescargas(true)
    this.emitir()
  }

  /**
   * Cada 60 s reintenta solo la primera descarga parada por `SIN_CONEXION` (ADR 0025 §5, revisión 0243): la
   * comprobación va contra el destino de la propia operación, nunca contra un tercero.
   */
  private vigilarConexion(): void {
    this.cancelarConexion?.()
    this.cancelarConexion = this.programar(() => {
      this.cancelarConexion = null
      void this.sondear()
    }, COMPROBACION_CONEXION_MS)
  }

  private async sondear(): Promise<void> {
    if (this.descargasParadas !== 'SIN_CONEXION') return
    const id = this.sinConexion[0]
    if (!id) return this.liberarDescargas(true)
    this.sondeando = id
    try {
      await this.deps.reintentarDescarga(id)
      this.deps.gestor.reanudarCola()
    } catch {
      // La canción ya no se puede reintentar (se eliminó…): la siguiente hace de sonda.
    }
    if (this.sondeando !== id) return // ya terminó (bien o mal) mientras tanto
    const viva = this.deps.gestor
      .listar()
      .some((t) => t.cancionId === id && t.comando === 'descargar-youtube')
    if (viva) return // su fin llegará por `alTrabajo`
    this.sondeando = null
    this.sinConexion.shift()
    if (this.sinConexion.length === 0) this.liberarDescargas(true)
    else void this.sondear()
  }

  private liberarDescargas(reanudar: boolean): void {
    this.descargasParadas = null
    this.sinConexion = []
    this.sondeando = null
    this.cancelarConexion?.()
    this.cancelarConexion = null
    if (reanudar) this.deps.gestor.reanudarCola()
  }

  // --- La tanda ----------------------------------------------------------------------------------

  private anadir(id: string): void {
    if (!this.tanda || this.tanda.terminada) {
      this.tanda = { miembros: new Map(), inicio: this.ahora(), terminada: false }
    }
    const m = this.tanda.miembros.get(id)
    if (m && m.resultado === null) return
    // Una canción que vuelve a la cola va detrás, con su resultado por decidir.
    this.tanda.miembros.delete(id)
    this.tanda.miembros.set(id, { resultado: null })
    this.emitir()
  }

  private cerrarCancion(
    id: string,
    resultado: ResultadoCancion,
    motivo?: string,
    dudosas?: number
  ): void {
    const m = this.tanda?.miembros.get(id)
    if (!m || this.tanda?.terminada) return
    m.resultado = resultado
    delete m.motivo
    delete m.dudosas
    if (motivo) m.motivo = motivo
    if (dudosas !== undefined) m.dudosas = dudosas
    this.emitir()
  }

  /** Cuando todas las canciones tienen resultado y no queda nada vivo, la tanda termina (un solo aviso). */
  private comprobarFin(): void {
    const t = this.tanda
    if (!t || t.terminada) return
    if ([...t.miembros.values()].some((m) => m.resultado === null)) return
    if (this.deps.preparacion.ids().length > 0 || this.deps.gestor.listar().length > 0) return
    t.terminada = true
    this.emitir()
    if (t.miembros.size >= 2) this.deps.avisarTanda?.(this.resumen(t))
  }

  private resumen(t: Tanda): ResumenTanda {
    const r: ResumenTanda = { total: t.miembros.size, listas: 0, esperanLetra: 0, conError: 0 }
    for (const m of t.miembros.values()) {
      if (m.resultado === 'lista_para_revisar') r.listas++
      else if (m.resultado === 'error') r.conError++
      else if (
        m.resultado === 'elige_letra' ||
        m.resultado === 'sin_letra' ||
        m.resultado === 'letra_pendiente'
      ) {
        r.esperanLetra++
      }
    }
    return r
  }

  private emitir(): void {
    this.deps.emitirTanda(this.estado())
  }
}
