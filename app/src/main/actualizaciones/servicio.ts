import type { Config } from '../../shared'
import type { EstadoActualizacionesIpc, ResultadoComprobacionIpc } from '../../shared/ipc'
import { compararVersiones } from '../../shared/version'
import type { ConfigParcial } from '../configuracion'
import type { RegistroApp } from '../registro'
import {
  consultarReleases,
  construirEnlaces,
  elegirNueva,
  ENTORNO_GITHUB_URL,
  ErrorConsulta,
  urlBaseGithub,
  type Enlaces,
  type FetchConsulta
} from './consulta'

const MODULO = 'actualizaciones'
export const RETRASO_ARRANQUE_MS = 10_000
export const INTERVALO_MS = 60 * 60 * 1000
export const VENTANA_MS = 24 * 60 * 60 * 1000
export const ENTORNO_VERSION = 'SHINOBI_ACTUALIZACIONES_VERSION'
export const ENTORNO_CANAL = 'SHINOBI_ACTUALIZACIONES_CANAL'

type Canal = EstadoActualizacionesIpc['canal']
const CANALES: readonly Canal[] = ['publicada', 'desarrollo', 'local']

/** Lo que el servicio usa del servicio de configuración. */
export interface ConfigActualizaciones {
  obtener(): Config
  actualizar(parcial: ConfigParcial): Promise<Config>
  suscribir(cb: (config: Config) => void): () => void
}

/** Estado enviado al renderer: el contrato de 0339 más los enlaces que construye main. */
export type EstadoActualizaciones = EstadoActualizacionesIpc

export interface OpcionesServicioActualizaciones {
  config: ConfigActualizaciones
  fetch: FetchConsulta
  registro: RegistroApp
  /** `app.getVersion()`. */
  version: string
  /** Canal de la compilación (`COMPILACION.canal`). */
  canal: Canal
  empaquetada: boolean
  /** Solo se leen las variables `SHINOBI_*` de este servicio. */
  env?: Record<string, string | undefined>
  plataforma?: string
  /** `process.env.APPIMAGE` definido. */
  appimage?: boolean
  /** `powerMonitor`: se evalúa tras `resume`. */
  reposo?: { on(evento: 'resume', cb: () => void): unknown }
  ahora?: () => number
  tiempoPeticionMs?: number
}

export class ServicioActualizaciones {
  readonly version: string
  readonly canal: Canal
  private readonly urlBase: string
  private readonly ahora: () => number
  private readonly oyentes = new Set<(e: EstadoActualizaciones) => void>()
  private manual: Promise<ResultadoComprobacionIpc> | null = null
  private automatica = false
  /** Último intento automático (con o sin respuesta): tras un fallo no se reintenta hasta 24 h después. */
  private ultimoIntentoAuto = -Infinity
  private ultimoEmitido = ''
  private temporizadores: NodeJS.Timeout[] = []
  private iniciado = false
  private baja: (() => void) | null = null

  constructor(private readonly o: OpcionesServicioActualizaciones) {
    this.ahora = o.ahora ?? Date.now
    const simulable = !o.empaquetada
    const versionEnv = simulable ? o.env?.[ENTORNO_VERSION] : undefined
    const canalEnv = simulable ? (o.env?.[ENTORNO_CANAL] as Canal | undefined) : undefined
    this.version =
      versionEnv && /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(versionEnv) ? versionEnv : o.version
    this.canal = canalEnv && CANALES.includes(canalEnv) ? canalEnv : o.canal
    const valorUrl = o.env?.[ENTORNO_GITHUB_URL]
    this.urlBase = urlBaseGithub(valorUrl, o.empaquetada)
    this.baja = o.config.suscribir((c) => this.alCambiarConfig(c))
    this.ultimoEmitido = JSON.stringify(this.estado())
  }

  private get consulta(): boolean {
    return this.canal === 'publicada'
  }

  /** Vigente: la `disponible` guardada solo cuenta si supera a la instalada y hay canal que consulte. */
  estado(): EstadoActualizaciones {
    const a = this.o.config.obtener().actualizaciones
    const guardada = a.disponible
    const vigente =
      this.consulta && guardada && this.mayorQueInstalada(guardada.version) ? guardada : null
    return {
      canal: this.canal,
      avisar: a.avisar,
      disponible: vigente,
      vista: a.vista,
      ultimaComprobacion: a.ultima_comprobacion,
      comprobando: this.manual !== null,
      enlaces: vigente ? this.enlaces(vigente.version, vigente.recursos) : null
    }
  }

  private mayorQueInstalada(version: string): boolean {
    try {
      return compararVersiones(version, this.version) > 0
    } catch {
      return false
    }
  }

  private enlaces(version: string, recursos: readonly string[]): Enlaces {
    return construirEnlaces(
      version,
      recursos,
      this.o.plataforma ?? process.platform,
      this.o.appimage ?? Boolean(process.env.APPIMAGE)
    )
  }

  suscribir(cb: (e: EstadoActualizaciones) => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  private emitir(): void {
    const estado = this.estado()
    const huella = JSON.stringify(estado)
    if (huella === this.ultimoEmitido) return
    this.ultimoEmitido = huella
    for (const cb of [...this.oyentes]) cb(estado)
  }

  private alCambiarConfig(config: Config): void {
    this.emitir()
    // Volver a marcar la casilla lanza una comprobación si han pasado 24 h.
    if (config.actualizaciones.avisar) this.evaluar()
  }

  /** La ventana principal ya se muestra: a los 10 s se evalúa, y luego cada hora y tras el reposo. */
  iniciar(): void {
    if (this.iniciado) return
    this.iniciado = true
    if (!this.consulta) return
    void this.retirarObsoleta()
    this.temporizadores.push(
      setTimeout(() => this.evaluar(), RETRASO_ARRANQUE_MS),
      setInterval(() => this.evaluar(), INTERVALO_MS)
    )
    this.o.reposo?.on('resume', () => this.evaluar())
  }

  detener(): void {
    for (const t of this.temporizadores) {
      clearTimeout(t)
      clearInterval(t)
    }
    this.temporizadores = []
    this.baja?.()
    this.baja = null
  }

  /** Tras actualizar, la versión guardada ya no es nueva: se borra para no reaparecer. */
  private async retirarObsoleta(): Promise<void> {
    const { disponible } = this.o.config.obtener().actualizaciones
    if (disponible && !this.mayorQueInstalada(disponible.version)) {
      await this.guardar({ disponible: null }).catch(() => undefined)
    }
  }

  /** Consulta automática si procede: aviso activo, 24 h desde la última con respuesta y desde el último intento. */
  evaluar(): void {
    // Antes de mostrar la ventana (+10 s) no hay consulta automática, aunque cambie la configuración.
    if (!this.iniciado || !this.consulta || this.automatica || this.manual) return
    const { avisar, ultima_comprobacion } = this.o.config.obtener().actualizaciones
    if (!avisar) return
    const ahora = this.ahora()
    const ultima = ultima_comprobacion ? Date.parse(ultima_comprobacion) : -Infinity
    if (ahora - ultima < VENTANA_MS || ahora - this.ultimoIntentoAuto < VENTANA_MS) return
    this.automatica = true
    this.ultimoIntentoAuto = ahora
    void this.consultar().then(
      () => {
        this.automatica = false
      },
      () => {
        this.automatica = false
      }
    )
  }

  /** Manual: siempre consulta (también con el aviso apagado), una a la vez. */
  comprobar(): Promise<ResultadoComprobacionIpc> {
    if (!this.consulta) {
      return Promise.resolve({ resultado: 'error', codigo: 'SERVICIO_NO_DISPONIBLE' })
    }
    if (this.manual) return this.manual
    const p = this.consultar().then(
      (r) => r,
      (e: unknown) => ({
        resultado: 'error' as const,
        codigo: e instanceof ErrorConsulta ? e.codigo : ('SERVICIO_NO_DISPONIBLE' as const)
      })
    )
    this.manual = p.finally(() => {
      this.manual = null
      this.emitir()
    })
    this.emitir()
    return this.manual
  }

  async marcarVista(version: string): Promise<void> {
    await this.guardar({ vista: version })
  }

  private guardar(parcial: NonNullable<ConfigParcial['actualizaciones']>): Promise<unknown> {
    return this.o.config.actualizar({ actualizaciones: parcial })
  }

  /** Una consulta; solo con respuesta válida se guarda. Lanza `ErrorConsulta` (queda en el registro). */
  private async consultar(): Promise<ResultadoComprobacionIpc> {
    let releases
    try {
      releases = await consultarReleases({
        fetch: this.o.fetch,
        urlBase: this.urlBase,
        versionApp: this.o.version,
        ...(this.o.tiempoPeticionMs ? { tiempoMs: this.o.tiempoPeticionMs } : {})
      })
    } catch (e) {
      const codigo = e instanceof ErrorConsulta ? e.codigo : 'SERVICIO_NO_DISPONIBLE'
      this.o.registro.escribir('aviso', MODULO, `${codigo}: ${String(e)}`)
      throw e
    }
    const nueva = elegirNueva(releases, this.version)
    const disponible = nueva
      ? { version: nueva.version, publicada: nueva.publicada, recursos: nueva.recursos }
      : null
    await this.guardar({
      ultima_comprobacion: new Date(this.ahora()).toISOString(),
      disponible
    }).catch((e: unknown) => {
      this.o.registro.escribir('aviso', MODULO, `no se pudo guardar: ${String(e)}`)
    })
    return disponible ? { resultado: 'nueva', disponible } : { resultado: 'al_dia' }
  }
}
