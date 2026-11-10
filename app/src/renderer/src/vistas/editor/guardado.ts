import type { ErrorIpc, SeleccionApariencia } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import type { GuardarTiempos } from '@shared/letrasBusqueda'
import { aPeticionTiempos } from '@shared/letras/tiempos'

export type EstadoGuardado =
  { estado: 'guardado' | 'guardando' } | { estado: 'error'; error: ErrorIpc }

interface Opciones {
  cancionId: string
  api: {
    guardarTiempos(peticion: GuardarTiempos): Promise<unknown>
    guardarApariencia(id: string, seleccion: SeleccionApariencia): Promise<unknown>
  }
  debounceMs?: number
  maxEsperaMs?: number
  reintentoMs?: number
  temporizador?: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout }
  alEstado(e: EstadoGuardado): void
  alDesactualizada(): void | Promise<void>
}

type Lote = { letra?: Letra; apariencia?: SeleccionApariencia }
type Temporizador = ReturnType<typeof setTimeout>

function errorIpc(e: unknown): ErrorIpc {
  const error = e as Partial<ErrorIpc> | null
  return { codigo: error?.codigo ?? 'ERROR_INTERNO', mensaje: error?.mensaje ?? 'Algo salió mal.' }
}

export class GuardadoEditor {
  private pendiente: Lote = {}
  private enVuelo: Promise<boolean> | null = null
  private minimo: Temporizador | undefined
  private maximo: Temporizador | undefined
  private reintento: Temporizador | undefined
  private destruido = false
  private actual: EstadoGuardado['estado'] = 'guardado'
  private readonly reloj: NonNullable<Opciones['temporizador']>

  constructor(private readonly opciones: Opciones) {
    // Envueltos: `window.setTimeout` llamado como método de otro objeto lanza "Illegal invocation".
    this.reloj = opciones.temporizador ?? {
      setTimeout: ((f: () => void, ms?: number) => setTimeout(f, ms)) as typeof setTimeout,
      clearTimeout: ((t?: Temporizador) => clearTimeout(t)) as typeof clearTimeout
    }
  }

  cambiarLetra(letra: Letra): void {
    if (this.destruido) return
    this.pendiente.letra = letra
    this.programar()
  }

  /** La última selección de apariencia manda (elegir tema, heredar o estilo propio). */
  cambiarApariencia(seleccion: SeleccionApariencia): void {
    if (this.destruido) return
    this.pendiente.apariencia = seleccion
    this.programar()
  }

  hayPendiente(): boolean {
    return this.enVuelo !== null || this.hayLote()
  }

  private hayLote(): boolean {
    return !!(this.pendiente.letra || this.pendiente.apariencia)
  }

  private programar(): void {
    if (this.enVuelo || this.reintento !== undefined) return
    const enviar = () => void this.enviar()
    this.reloj.clearTimeout(this.minimo)
    this.minimo = this.reloj.setTimeout(enviar, this.opciones.debounceMs ?? 1000)
    this.maximo ??= this.reloj.setTimeout(enviar, this.opciones.maxEsperaMs ?? 2000)
    this.publicar({ estado: 'guardando' })
  }

  private limpiar(): void {
    this.reloj.clearTimeout(this.minimo)
    this.reloj.clearTimeout(this.maximo)
    this.reloj.clearTimeout(this.reintento)
    this.minimo = this.maximo = this.reintento = undefined
  }

  private publicar(estado: EstadoGuardado): void {
    if (this.actual === estado.estado && estado.estado !== 'error') return
    this.actual = estado.estado
    this.opciones.alEstado(estado)
  }

  private enviar(): Promise<boolean> {
    if (this.enVuelo) return this.enVuelo
    if (this.destruido || !this.hayLote()) return Promise.resolve(!this.destruido)
    this.limpiar()
    const lote = this.pendiente
    this.pendiente = {}
    this.enVuelo = Promise.resolve().then(() => this.escribir(lote))
    this.publicar({ estado: 'guardando' })
    return this.enVuelo
  }

  private async escribir(lote: Lote): Promise<boolean> {
    if (this.destruido) return false
    const { cancionId, api } = this.opciones
    const { letra, apariencia: seleccion } = lote
    const [tiempos, apariencia] = await Promise.allSettled([
      letra
        ? Promise.resolve().then(() => api.guardarTiempos(aPeticionTiempos(cancionId, letra)))
        : undefined,
      seleccion
        ? Promise.resolve().then(() => api.guardarApariencia(cancionId, seleccion))
        : undefined
    ])
    if (this.destruido) return false
    let fallo: ErrorIpc | null = null
    if (tiempos.status === 'rejected') {
      const error = errorIpc(tiempos.reason)
      if (error.codigo === 'LETRA_DESACTUALIZADA') {
        this.pendiente.letra = undefined
        await this.opciones.alDesactualizada()
      } else {
        this.pendiente.letra ??= letra
        fallo = error
      }
    }
    if (this.destruido) return false
    if (apariencia.status === 'rejected') {
      this.pendiente.apariencia ??= seleccion
      fallo ??= errorIpc(apariencia.reason)
    }

    this.enVuelo = null
    if (fallo) {
      this.reintento = this.reloj.setTimeout(
        () => void this.enviar(),
        this.opciones.reintentoMs ?? 5000
      )
      this.publicar({ estado: 'error', error: fallo })
      return false
    }
    if (this.hayLote()) void this.enviar()
    else this.publicar({ estado: 'guardado' })
    return true
  }

  async vaciar(): Promise<boolean> {
    while (this.hayPendiente()) {
      if (!(await this.enviar())) return false
    }
    return !this.destruido
  }

  destruir(): void {
    this.destruido = true
    this.limpiar()
    this.pendiente = {}
    this.enVuelo = null
  }
}
