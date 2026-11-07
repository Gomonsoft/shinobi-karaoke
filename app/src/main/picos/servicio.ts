import { createHash, randomUUID } from 'node:crypto'
import { lstat, readdir, realpath, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { EstadoPicos, LecturaPicos, PeticionPicos } from '../../shared/ipc'
import type { ejecutar } from '../trabajos/worker'
import { conPicos, leerVentana } from './formato'

const VOZ = 'pistas/voz.flac'
const ID_SEGURO = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
const ARCHIVO_PICOS = /^\.picos-voz-v\d+-[a-f0-9]{64}(?:\.[a-f0-9-]{36}\.tmp|\.bin)$/

interface Voz {
  ruta: string
  generacion: string
  cache: string
}

interface Trabajo {
  id: string
  control: AbortController
  fin: Promise<void>
}

interface DependenciasPicos {
  dirBiblioteca: string
  tieneVoz(id: string): boolean
  ejecutar: typeof ejecutar
}

/** La forma de onda es derivada. Su estado no se guarda en la canción. */
export class ServicioPicos {
  private activo: Trabajo | null = null
  private readonly cambios = new Map<string, number>()
  private readonly fallos = new Map<string, string>()
  private cerrado = false

  constructor(private readonly deps: DependenciasPicos) {}

  private bloqueado(id: string): boolean {
    return this.cerrado || this.cambios.has(id)
  }

  private async voz(id: string): Promise<Voz | null> {
    if (this.bloqueado(id) || !ID_SEGURO.test(id) || !this.deps.tieneVoz(id)) return null
    try {
      const biblioteca = await realpath(this.deps.dirBiblioteca)
      const ruta = join(biblioteca, id, VOZ)
      if ((await realpath(ruta)) !== ruta) return null
      const datos = await lstat(ruta, { bigint: true })
      if (!datos.isFile() || this.bloqueado(id)) return null
      const identidad = [datos.dev, datos.ino, datos.size, datos.mtimeNs, datos.ctimeNs]
      const generacion = createHash('sha256').update(['v1', ...identidad].join(':')).digest('hex')
      return { ruta, generacion, cache: join(dirname(ruta), `.picos-voz-v1-${generacion}.bin`) }
    } catch {
      return null
    }
  }

  async solicitar(id: string, reintentar = false): Promise<EstadoPicos> {
    const voz = await this.voz(id)
    if (!voz) return { estado: 'no_disponible' }
    const valida = await conPicos(voz.cache, async () => true)
    if (this.bloqueado(id)) return { estado: 'no_disponible' }
    const actual = await this.voz(id)
    if (!actual) return { estado: 'no_disponible' }
    if (actual.generacion !== voz.generacion) return { estado: 'generando' }
    if (valida) return { estado: 'lista', generacion: voz.generacion }
    if (reintentar || this.fallos.get(id) !== voz.generacion) this.fallos.delete(id)
    if (this.fallos.has(id)) return { estado: 'error' }
    // Una solicitud que espera turno se vuelve a intentar al sondear. Main no acumula colas.
    if (!this.activo) this.generar(id, voz)
    return { estado: 'generando' }
  }

  async leer(peticion: PeticionPicos): Promise<LecturaPicos | null> {
    const id = peticion.cancionId
    const voz = await this.voz(id)
    if (!voz) return null
    const ventana = await conPicos(voz.cache, (archivo, formato) =>
      leerVentana(archivo, formato, peticion)
    )
    if (!ventana || (await this.voz(id))?.generacion !== voz.generacion) return null
    return { ...ventana, generacion: voz.generacion }
  }

  private generar(id: string, voz: Voz): void {
    const control = new AbortController()
    const fin = this.publicar(id, voz, control.signal).finally(() => {
      this.activo = null
    })
    this.activo = { id, control, fin }
  }

  private async publicar(id: string, voz: Voz, señal: AbortSignal): Promise<void> {
    const temporal = voz.cache.replace(/\.bin$/, `.${randomUUID()}.tmp`)
    try {
      await this.deps.ejecutar(
        'generar-picos', { entrada: voz.ruta, salida: temporal }, { señal }
      )
      if (!await conPicos(temporal, async () => true)) throw new Error('Caché de picos inválida.')
      if (señal.aborted || (await this.voz(id))?.generacion !== voz.generacion) return
      await rename(temporal, voz.cache)
      if (señal.aborted || (await this.voz(id))?.generacion !== voz.generacion) {
        await rm(voz.cache, { force: true })
        return
      }
      await this.limpiar(dirname(voz.ruta), voz.cache)
    } catch {
      if (!señal.aborted && (await this.voz(id))?.generacion === voz.generacion) {
        this.fallos.set(id, voz.generacion)
      }
    } finally {
      await rm(temporal, { force: true }).catch(() => undefined)
    }
  }

  private async limpiar(carpeta: string, conservar?: string): Promise<void> {
    // Solo se borran nombres del formato derivado, nunca pistas de audio.
    if ((await realpath(carpeta).catch(() => null)) !== carpeta) return
    const archivos = await readdir(carpeta).catch(() => [])
    await Promise.all(
      archivos.filter((nombre) => ARCHIVO_PICOS.test(nombre)).map(async (nombre) => {
        const ruta = join(carpeta, nombre)
        if (ruta !== conservar) await rm(ruta, { force: true }).catch(() => undefined)
      })
    )
  }

  /** Suspende generación y lecturas mientras se sustituye la voz o se borra la canción. */
  async duranteCambio<T>(id: string, cambiar: () => Promise<T>): Promise<T> {
    const previa = await this.voz(id)
    this.cambios.set(id, (this.cambios.get(id) ?? 0) + 1)
    try {
      const activo = this.activo
      if (activo?.id === id) {
        activo.control.abort()
        await activo.fin
      }
      this.fallos.delete(id)
      if (previa) await this.limpiar(dirname(previa.ruta))
      return await cambiar()
    } finally {
      const restantes = (this.cambios.get(id) ?? 1) - 1
      if (restantes) this.cambios.set(id, restantes)
      else this.cambios.delete(id)
    }
  }

  async cerrar(): Promise<void> {
    this.cerrado = true
    const activo = this.activo
    activo?.control.abort()
    await activo?.fin
  }
}
