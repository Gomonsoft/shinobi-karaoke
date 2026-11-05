import { access, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  ENV_INTENTO,
  ENV_SEPARADOR_FALSO,
  estimarSegundosSeparacion,
  ARRANQUE_MAX_S,
  ARRANQUE_MIN_S,
  resultadoSepararSchema,
  type Cancion,
  type CodigoError,
  type Config,
  type DispositivoSeparacion,
  type EstimacionCancion,
  type Manifiesto,
  type ModeloId,
  type TrabajoIpc
} from '../../shared'
import type { CambioCancion, ResumenCancion } from '../biblioteca'
import { modoSeparacionVigente, type ConfigParcial } from '../configuracion'
import { limpiarModelos } from '../runtime/modelos'
import type { ContextoEmpezar, InicioTrabajo, PeticionTrabajo, PlanReintento } from '../trabajos'
import { estimarCancion } from './estimar'

/** Error del servicio de separación con código estable (la IPC lo traduce tal cual). */
export class ErrorSeparacion extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string
  ) {
    super(mensaje)
    this.name = 'ErrorSeparacion'
  }
}

/** Peso de la media móvil del factor medido: mitad el anterior, mitad el nuevo (0065). */
export const ALFA_FACTOR = 0.5

/** Subconjunto de `ServicioBiblioteca` que usa el servicio. */
export interface BibliotecaSeparacion {
  obtener(id: string): Cancion | null
  obtenerResumen(id: string): ResumenCancion | null
  /** Para la oferta de Rápido sin canción concreta (0066). */
  listar?(): ResumenCancion[]
}

/** Modelos en disco (0066): la comprobación de ADR 0009 §4 y la descarga de 0033/0034. */
export interface PuertoModelos {
  /** ¿Está verificado (`verificados.json`, tamaño y `mtime`)? */
  verificado(id: ModeloId): Promise<boolean>
  /** Descarga y verifica (reanudable). Rechaza con `{ codigo }` (`SIN_CONEXION`, `VERIFICACION_FALLIDA`…). */
  descargar(
    id: ModeloId,
    señal: AbortSignal,
    alProgreso: (p: { bytes: number; total: number }) => void
  ): Promise<void>
  /** Borra el checkpoint y su entrada de `verificados.json` (corrupto). */
  borrar(id: ModeloId): Promise<void>
}

/** Subconjunto de `GestorTrabajos` que usa el servicio. */
export interface GestorSeparacion {
  encolar(peticion: PeticionTrabajo): unknown
  listar(): TrabajoIpc[]
  suscribir(cb: (trabajo: TrabajoIpc) => void): () => void
}

export interface DependenciasServicioSeparacion {
  biblioteca: BibliotecaSeparacion
  gestor: GestorSeparacion
  config: { obtener(): Config; actualizar(parcial: ConfigParcial): Promise<unknown> }
  /** El manifiesto del runtime (nombre del archivo de cada modelo y factores de referencia). */
  manifiesto: () => Manifiesto | null
  /** Directorio de datos: `biblioteca/<id>/` y `modelos/` cuelgan de él. */
  dirDatos: string
  /** Estimación previa en minutos (la misma que `runtime.estimarSeparacion`, 0067). */
  estimarSeparacion(duracionMs: number): EstimacionCancion
  registrar?(nivel: 'aviso' | 'error', mensaje: string): void
  /**
   * Modelos en disco. Sin él no se comprueba ni se descarga nada (solo pruebas): un modelo que
   * falta es entonces un `MODELO_NO_DISPONIBLE` del worker.
   */
  modelos?: PuertoModelos
  /** Pasa `SHINOBI_INTENTO` al worker en cada intento (solo con el separador falso, sin empaquetar). */
  intentoEnEntorno?: boolean
  /** Se llama cuando puede haber cambiado la oferta de Rápido (el runtime refresca su estado). */
  alCambiarOferta?(): void
}

const MEMORIA = new Set(['MEMORIA_INSUFICIENTE', 'PROCESO_TERMINADO'])

const existe = (ruta: string): Promise<boolean> =>
  access(ruta).then(
    () => true,
    () => false
  )

const argumentosNoValidos = (mensaje: string): ErrorSeparacion =>
  new ErrorSeparacion('ARGUMENTOS_NO_VALIDOS', mensaje)

/**
 * Servicio de separación del proceso principal (0065, arquitectura.md §6): encola `separar` en la
 * cola pesada, recoge las pistas y mide el factor. Con 0066 añade los reintentos por memoria, la
 * descarga del modelo que falta dentro del mismo trabajo y la oferta del modelo Rápido (nunca se
 * pasa a Rápido sin consentimiento). */
export class ServicioSeparacion {
  private readonly baja: () => void
  /** Canciones con una petición en vuelo, para que dos `separar` seguidos no encolen dos veces. */
  private readonly reservadas = new Set<string>()

  constructor(private readonly deps: DependenciasServicioSeparacion) {
    // YouTube: al completar la fuente se encadena la separación (el paso ya está escrito).
    this.baja = deps.gestor.suscribir((t) => {
      if (t.estado === 'terminado' && t.paso === 'separacion') this.deps.alCambiarOferta?.()
      if (
        t.estado === 'terminado' &&
        t.paso === 'fuente' &&
        t.comando === 'descargar-youtube' &&
        t.resultado === 'completado'
      ) {
        void this.alCompletarFuente(t.cancionId)
      }
    })
  }

  cerrar(): void {
    this.baja()
  }

  /** `separacion.estimar(cancionId)` (0067). */
  estimar(cancionId: string): EstimacionCancion {
    return estimarCancion({
      obtener: (id) => this.deps.biblioteca.obtener(id),
      estimarSeparacion: (d) => this.deps.estimarSeparacion(d)
    })(cancionId)
  }

  /**
   * Encadena la separación al completarse la fuente (archivo local tras materializar; YouTube tras
   * la descarga). Nunca lanza: si no se puede, la canción queda `pendiente` ("Separar ahora").
   */
  async alCompletarFuente(cancionId: string): Promise<void> {
    try {
      await this.separar(cancionId)
    } catch (e) {
      this.deps.registrar?.('aviso', `no se encoló la separación de ${cancionId}: ${String(e)}`)
    }
  }

  /**
   * ¿Se ofrece el modelo Rápido (0066, preguntas/0021 §1)? Con `cancionId`, solo esa canción; sin
   * él, cualquiera. Se cumple si el paso `separacion` está en `error` con `MEMORIA_INSUFICIENTE`, o
   * con `MODELO_NO_DISPONIBLE` cuya causa no es `SIN_CONEXION`; el trabajo usaba Calidad
   * (`error.modelo`, escrito por el gestor) y no hay Rápido pendiente. Se deriva de `cancion.json`.
   */
  ofertaRapidoVigente(cancionId?: string): boolean {
    const config = this.deps.config.obtener()
    const c = config.separacion
    // Con Rápido ya en uso, o aceptado y sin terminar de descargar, no hay oferta que hacer.
    if (modoSeparacionVigente(config) !== 'calidad') return false
    if (c.rapido_aceptado !== null && !c.modelos_descargados.includes('rapido')) return false
    const resumenes =
      cancionId !== undefined
        ? [this.deps.biblioteca.obtenerResumen(cancionId)]
        : (this.deps.biblioteca.listar?.() ?? [])
    return resumenes.some((r) => {
      const paso = r?.pasos?.separacion
      const e = paso?.error
      if (!paso || paso.estado !== 'error' || !e || e.modelo !== 'calidad') return false
      if (e.codigo === 'MEMORIA_INSUFICIENTE') return true
      return e.codigo === 'MODELO_NO_DISPONIBLE' && e.mensaje.trim() !== 'SIN_CONEXION'
    })
  }

  /** `separacion.separar(cancionId)`: valida y encola en la cola pesada. */
  async separar(cancionId: string): Promise<void> {
    if (this.reservadas.has(cancionId)) {
      throw argumentosNoValidos('La canción ya tiene una separación en marcha.')
    }
    this.reservadas.add(cancionId)
    try {
      const cancion = this.deps.biblioteca.obtener(cancionId)
      if (!cancion) throw argumentosNoValidos('La canción no existe o su archivo está dañado.')
      if (cancion.pasos.fuente.estado !== 'completado') {
        throw argumentosNoValidos('La fuente de la canción no está lista.')
      }
      if (!(await existe(join(this.carpeta(cancionId), 'fuente', 'mezcla.flac')))) {
        throw argumentosNoValidos('Falta la mezcla de la canción.')
      }
      this.comprobarPaso(cancionId, cancion)
      if (this.hayTrabajoPesado(cancionId)) {
        throw argumentosNoValidos('La canción ya tiene una separación en marcha.')
      }
      if (this.deps.config.obtener().instalacion.estado !== 'completa') {
        throw new ErrorSeparacion('RUNTIME_NO_DISPONIBLE', 'El motor de audio no está instalado.')
      }
      this.deps.gestor.encolar(this.peticion(cancionId))
    } finally {
      this.reservadas.delete(cancionId)
    }
  }

  /**
   * Arranque: borra cualquier `biblioteca/*\/pistas.tmp/` que haya quedado y los `*.partial` de
   * audio-separator. No encola nada: los pasos `pendiente`/`interrumpido` esperan al usuario.
   */
  async limpiarAlArrancar(): Promise<void> {
    const dir = join(this.deps.dirDatos, 'biblioteca')
    let ids: string[] = []
    try {
      ids = (await readdir(dir, { withFileTypes: true }))
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
    } catch {
      /* sin biblioteca todavía */
    }
    await Promise.all(
      ids.map((id) => rm(join(dir, id, 'pistas.tmp'), { recursive: true, force: true }))
    )
    await limpiarModelos(this.dirModelos())
  }

  // ---- Interno ----

  private carpeta(id: string): string {
    return join(this.deps.dirDatos, 'biblioteca', id)
  }

  private dirModelos(): string {
    return join(this.deps.dirDatos, 'modelos')
  }

  private hayTrabajoPesado(cancionId: string): boolean {
    return this.deps.gestor.listar().some((t) => t.cancionId === cancionId && t.cola === 'pesada')
  }

  /** `pendiente`, `error` o `interrumpido`; o `completado` con las pistas perdidas (Re-separar). */
  private comprobarPaso(cancionId: string, cancion: Cancion): void {
    const estado = cancion.pasos.separacion.estado
    if (estado === 'pendiente' || estado === 'error' || estado === 'interrumpido') return
    if (
      estado === 'completado' &&
      this.deps.biblioteca.obtenerResumen(cancionId)?.motivo === 'pistas'
    )
      return
    throw argumentosNoValidos('La separación de esta canción no se puede lanzar ahora.')
  }

  private perfil(c: Config): 'cpu' | 'cuda' | 'mps' | null {
    return c.instalacion.perfil_hardware ?? c.instalacion.perfil_previsto
  }

  /**
   * Ritmo esperado de la fase `separando` (0064): la estimación previa de 0067 menos el coste fijo
   * de arrancar el worker, que no forma parte de la fase.
   */
  private ritmoEsperado(
    duracionMs: number,
    c: Config,
    modo: ModeloId
  ): InicioTrabajo['ritmoEsperado'] {
    const manifiesto = this.deps.manifiesto()
    const perfil = this.perfil(c)
    if (!manifiesto || perfil === null || duracionMs <= 0) return undefined
    const e = estimarSegundosSeparacion(
      duracionMs,
      perfil,
      modo,
      c.separacion.factores_medidos,
      manifiesto
    )
    if (e === null) return undefined
    const medio = (e.min + e.max) / 2 - (ARRANQUE_MIN_S + ARRANQUE_MAX_S) / 2
    return { segundosFase: Math.max(1, medio) }
  }

  private peticion(cancionId: string): PeticionTrabajo {
    const carpeta = this.carpeta(cancionId)
    const tmp = join(carpeta, 'pistas.tmp')
    let modoInicial: ModeloId | null = null
    let dispositivoInicial: DispositivoSeparacion | null = null
    let modeloReparado = false
    return {
      cancionId,
      paso: 'separacion',
      cola: 'pesada',
      comando: 'separar',
      args: {},
      // Los args se calculan al empezar (modo vigente en ese momento, ux/08), no al encolar.
      alEmpezar: async (_trabajo, contexto) => {
        const c = this.deps.config.obtener()
        const cancion = this.deps.biblioteca.obtener(cancionId)
        const manifiesto = this.deps.manifiesto()
        if (!cancion) throw argumentosNoValidos('La canción ya no existe.')
        let modo = modoSeparacionVigente(c)
        // Rápido sin su modelo en disco: se usa Calidad (ADR 0004, Revisiones punto 3).
        if (modo === 'rapido' && this.deps.modelos && !(await this.deps.modelos.verificado(modo))) {
          modo = 'calidad'
        }
        const modelo = manifiesto?.modelos.find((m) => m.id === modo)
        if (!modelo) throw new ErrorSeparacion('ERROR_INTERNO', `Modelo desconocido: ${modo}`)
        const dispositivo: DispositivoSeparacion = this.perfil(c) === 'cuda' ? 'cuda' : 'cpu'
        modoInicial = modo
        dispositivoInicial = dispositivo
        await this.asegurarModelo(modo, contexto)
        await rm(tmp, { recursive: true, force: true })
        await mkdir(tmp, { recursive: true })
        const ritmoEsperado = this.ritmoEsperado(cancion.metadatos.duracion_ms, c, modo)
        return {
          args: {
            entrada: join(carpeta, 'fuente', 'mezcla.flac'),
            salida_dir: tmp,
            modelo: { id: modo, archivo: modelo.archivo, dir: this.dirModelos() },
            dispositivo,
            bloques: 'normal'
          },
          modo,
          dispositivo,
          ...(ritmoEsperado ? { ritmoEsperado } : {})
        }
      },
      politicaReintento: (error, _intento, args) => {
        // `alDescartar` borra `pistas.tmp`: cada intento la vuelve a crear vacía.
        const recrear = async (): Promise<void> => {
          await rm(tmp, { recursive: true, force: true })
          await mkdir(tmp, { recursive: true })
        }
        const plan = this.planMemoria(error.codigo, args)
        if (plan) return { ...plan, antes: recrear }
        if (error.codigo === 'MODELO_NO_DISPONIBLE' && !modeloReparado) {
          // Checkpoint corrupto: se borra y se descarga una vez; no cuenta como intento.
          modeloReparado = true
          return {
            args,
            esperaMs: 0,
            motivo: null,
            antes: async (contexto) => {
              await this.repararModelo((args.modelo as { id: ModeloId }).id, contexto)
              await recrear()
            }
          }
        }
        return null
      },
      entornoIntento: (intento): Record<string, string> =>
        this.deps.intentoEnEntorno ? { [ENV_INTENTO]: String(intento) } : {},
      // `PROCESO_TERMINADO` se comporta exactamente como la memoria, también en el error final.
      traducirError: (e) =>
        e.codigo === 'PROCESO_TERMINADO' ? { ...e, codigo: 'MEMORIA_INSUFICIENTE' } : e,
      alResultado: async (bruto) => {
        const r = resultadoSepararSchema.safeParse(bruto)
        if (!r.success)
          throw new ErrorSeparacion('ERROR_INTERNO', 'Resultado de separar no válido.')
        const pistasDir = join(carpeta, 'pistas')
        await mkdir(pistasDir, { recursive: true })
        await rename(join(tmp, r.data.voz), join(pistasDir, r.data.voz))
        await rename(join(tmp, r.data.instrumental), join(pistasDir, r.data.instrumental))
        await rm(tmp, { recursive: true, force: true })
        await this.guardarFactor(cancionId, r.data, modoInicial, dispositivoInicial)
        const cambio: CambioCancion = {
          pasos: { separacion: { segundos: r.data.segundos_total } },
          pistas: {
            voz: `pistas/${r.data.voz}`,
            instrumental: `pistas/${r.data.instrumental}`,
            modelo: {
              perfil: r.data.modelo.id,
              nombre: r.data.modelo.archivo,
              version: r.data.modelo.version_audio_separator
            }
          }
        }
        return cambio
      },
      alDescartar: async () => {
        // Las pistas anteriores (Re-separar) no se tocan.
        await rm(tmp, { recursive: true, force: true })
        await limpiarModelos(this.dirModelos())
      }
    }
  }

  /**
   * Reintentos por memoria (0066): intento 2 con bloques pequeños, mismo modelo y dispositivo;
   * intento 3, solo si era CUDA, en CPU con bloques pequeños. Sin espera. Se decide por los args
   * del intento que falló, así que el resto de códigos y el último intento dan `null`.
   */
  private planMemoria(codigo: string, args: Record<string, unknown>): PlanReintento | null {
    if (!MEMORIA.has(codigo)) return null
    if (args.bloques === 'normal') {
      return { args: { ...args, bloques: 'pequenos' }, esperaMs: 0, motivo: 'memoria' }
    }
    if (args.bloques === 'pequenos' && args.dispositivo === 'cuda') {
      return {
        args: { ...args, dispositivo: 'cpu', bloques: 'pequenos' },
        esperaMs: 0,
        motivo: 'memoria_cpu',
        dispositivo: 'cpu'
      }
    }
    return null
  }

  /** Modelo que falta o no cuadra con `verificados.json`: se descarga dentro del mismo trabajo. */
  private async asegurarModelo(id: ModeloId, contexto: ContextoEmpezar): Promise<void> {
    const modelos = this.deps.modelos
    if (!modelos || (await modelos.verificado(id))) return
    await this.descargarModelo(modelos, id, contexto)
  }

  /** Checkpoint rechazado por el worker: borra el archivo y su entrada y lo descarga de nuevo. */
  private async repararModelo(id: ModeloId, contexto: ContextoEmpezar): Promise<void> {
    const modelos = this.deps.modelos
    if (!modelos) return
    await modelos.borrar(id)
    await this.descargarModelo(modelos, id, contexto)
  }

  private async descargarModelo(
    modelos: PuertoModelos,
    id: ModeloId,
    contexto: ContextoEmpezar
  ): Promise<void> {
    contexto.alProgreso('descargando_modelo', 0, { bytes: 0, total: null })
    try {
      await modelos.descargar(id, contexto.señal, (p) =>
        contexto.alProgreso('descargando_modelo', p.total > 0 ? p.bytes / p.total : 0, {
          bytes: p.bytes,
          total: p.total
        })
      )
    } catch (e) {
      if (contexto.señal.aborted) throw e
      const codigo = (e as { codigo?: unknown } | null)?.codigo
      this.deps.registrar?.('aviso', `no se pudo descargar el modelo ${id}: ${String(e)}`)
      // El `mensaje` lleva el código de la descarga (SIN_CONEXION, VERIFICACION_FALLIDA…).
      throw Object.assign(
        new ErrorSeparacion(
          'MODELO_NO_DISPONIBLE',
          typeof codigo === 'string' ? codigo : 'ERROR_INTERNO'
        ),
        { modelo: id }
      )
    }
  }

  /** Factor medido = minutos de proceso por minuto de audio, media móvil (α = 0,5). */
  private async guardarFactor(
    cancionId: string,
    r: { modelo: { id: ModeloId }; dispositivo: DispositivoSeparacion; segundos_total: number },
    modoInicial: ModeloId | null,
    dispositivoInicial: DispositivoSeparacion | null
  ): Promise<void> {
    try {
      // Un reintento en otro dispositivo (0066) no representa el ritmo del equipo.
      if (r.dispositivo !== dispositivoInicial || r.modelo.id !== modoInicial) return
      const duracionMs = this.deps.biblioteca.obtener(cancionId)?.metadatos.duracion_ms ?? 0
      if (duracionMs <= 0 || r.segundos_total <= 0) return
      const factor = r.segundos_total / 60 / (duracionMs / 60_000)
      const previo = this.deps.config.obtener().separacion.factores_medidos[r.modelo.id]
      const nuevo = previo ? ALFA_FACTOR * previo + (1 - ALFA_FACTOR) * factor : factor
      await this.deps.config.actualizar({
        separacion: { factores_medidos: { [r.modelo.id]: nuevo } }
      })
    } catch (e) {
      this.deps.registrar?.('aviso', `no se pudo guardar el factor medido: ${String(e)}`)
    }
  }
}

/**
 * Entorno que se pasa al worker para el doble del separador (0059, ADR 0009 §8): solo sin
 * empaquetar (empaquetada no se pasa nada, igual que `SHINOBI_YTDLP_FALSO`).
 */
export function entornoSeparadorFalso(
  env: Record<string, string | undefined>,
  empaquetada: boolean
): Record<string, string> {
  if (empaquetada) return {}
  const salida: Record<string, string> = {}
  for (const clave of [ENV_SEPARADOR_FALSO, ENV_INTENTO]) {
    const valor = env[clave]
    if (valor) salida[clave] = valor
  }
  return salida
}
