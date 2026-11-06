import { VOLUMEN_VOZ_PREDETERMINADO, type Config } from '@shared/config'
import type { Letra } from '@shared/letra'
import { tiempoHablado } from '../../karaoke/tiempoHablado'
import type { AccionReproductor, OrigenReproductor } from './atajos'
import { R } from './textos'

export function silencioPrevioMs(letra: Letra | null): number {
  if (!letra) return 0
  const primera = letra.lineas.find((linea) => linea.tipo === 'linea' && linea.inicio_ms !== null)
  if (primera?.inicio_ms == null) return 0
  return Math.max(0, 6000 - (primera.inicio_ms + letra.offset_ms))
}

export function posicionInicial(
  _origen: OrigenReproductor,
  desdeMs: number,
  letra: Letra | null
): number {
  // Ambos orígenes aplican el silencio si la posición inicial ya resuelta es cero.
  const silencio = desdeMs === 0 ? silencioPrevioMs(letra) : 0
  return desdeMs - silencio
}

export interface ContextoIndicador {
  sonando: boolean
  volumen: number
  silenciado: boolean
  volumenVoz: number
  vozSilenciada: boolean
  offsetMs: number
}

/** El contexto refleja los valores después de aplicar la acción. */
export function textoIndicador(accion: AccionReproductor, ctx: ContextoIndicador): string | null {
  switch (accion.tipo) {
    case 'alternar':
      return ctx.sonando ? R.ind.reproducir : R.ind.pausa
    case 'saltar':
      return R.ind.saltar[accion.deltaMs]
    case 'volumen':
    case 'silenciar':
      return ctx.silenciado ? R.ind.silenciado : R.ind.volumen(Math.round(ctx.volumen * 100))
    case 'voz':
    case 'nivel_voz':
      return ctx.vozSilenciada ? R.ind.vozSilenciada : R.ind.voz(Math.round(ctx.volumenVoz * 100))
    case 'principio':
      return R.ind.principio
    case 'desplazar':
      return R.offset(ctx.offsetMs)
    default:
      return null
  }
}

export function formatearReloj(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const horas = Math.floor(total / 3600)
  const minutos = Math.floor(total / 60) % 60
  const segundos = total % 60
  const mmss = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
  return horas ? `${horas}:${mmss}` : mmss
}

export function tiempoEnPalabras(ms: number, total: number): string {
  return `${tiempoHablado(ms)} de ${tiempoHablado(total)}`
}

type Voz = Pick<Config['reproductor'], 'voz_guia' | 'voz_guia_silenciada'>

function sumarNivel(actual: number, delta: number): number {
  return Math.round(Math.max(0, Math.min(actual + delta, 1)) * 100) / 100
}

export function pasoVolumen(actual: number, delta: number) {
  return { volumen: sumarNivel(actual, delta), silenciado: false }
}

export function alternarVoz({ voz_guia, voz_guia_silenciada }: Voz): Voz {
  return {
    voz_guia: voz_guia_silenciada && voz_guia === 0 ? VOLUMEN_VOZ_PREDETERMINADO : voz_guia,
    voz_guia_silenciada: !voz_guia_silenciada
  }
}

export function pasoVoz(estado: Voz, delta: number): Voz {
  return { voz_guia: sumarNivel(estado.voz_guia, delta), voz_guia_silenciada: false }
}

export const textoIncompleta = R.incompleta

type IdTemporizador = ReturnType<typeof setTimeout>
interface Temporizador {
  setTimeout: (cb: () => void, ms: number) => IdTemporizador
  clearTimeout: (id: IdTemporizador) => void
}

const relojReal: Temporizador = {
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (id) => clearTimeout(id)
}

export class VisibilidadControles {
  private readonly retenciones = new Set<string>()
  private readonly oyentes = new Set<(visible: boolean) => void>()
  private readonly ocultarTrasMs: number
  private readonly temporizador: Temporizador
  private tarea: IdTemporizador | undefined
  private mostrada = true

  constructor({
    ocultarTrasMs = 3000,
    temporizador = relojReal
  }: {
    ocultarTrasMs?: number
    temporizador?: Temporizador
  } = {}) {
    this.ocultarTrasMs = ocultarTrasMs
    this.temporizador = temporizador
    this.actividad()
  }

  visible(): boolean {
    return this.mostrada
  }

  suscribir(cb: (visible: boolean) => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  actividad(): void {
    this.cancelarOcultacion()
    if (this.retenciones.size === 0) {
      this.tarea = this.temporizador.setTimeout(() => {
        this.tarea = undefined
        this.mostrar(false)
      }, this.ocultarTrasMs)
    }
    this.mostrar(true)
  }

  fijarRetenida(motivo: string, activa: boolean): void {
    if (activa === this.retenciones.has(motivo)) return
    if (activa) this.retenciones.add(motivo)
    else this.retenciones.delete(motivo)
    this.actividad()
  }

  destruir(): void {
    this.cancelarOcultacion()
    this.oyentes.clear()
    this.retenciones.clear()
  }

  private cancelarOcultacion(): void {
    if (this.tarea === undefined) return
    this.temporizador.clearTimeout(this.tarea)
    this.tarea = undefined
  }

  private mostrar(visible: boolean): void {
    if (visible === this.mostrada) return
    this.mostrada = visible
    for (const oyente of this.oyentes) oyente(visible)
  }
}

export class CuentaFinal {
  private readonly oyentes = new Set<(n: number | null) => void>()
  private readonly finales = new Set<() => void>()
  private readonly segundos: number
  private readonly temporizador: Temporizador
  private tarea: IdTemporizador | undefined
  private restante: number | null = null

  constructor({
    segundos = 10,
    temporizador = relojReal
  }: {
    segundos?: number
    temporizador?: Temporizador
  } = {}) {
    this.segundos = segundos
    this.temporizador = temporizador
  }

  suscribir(cb: (n: number | null) => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  alTerminar(cb: () => void): () => void {
    this.finales.add(cb)
    return () => this.finales.delete(cb)
  }

  iniciar(): void {
    this.cancelarTemporizador()
    this.fijarRestante(this.segundos)
  }

  detener(): void {
    if (this.restante === null) return
    this.cancelarTemporizador()
    this.fijarRestante(null)
  }

  destruir(): void {
    this.oyentes.clear()
    this.finales.clear()
    this.detener()
  }

  private cancelarTemporizador(): void {
    if (this.tarea === undefined) return
    this.temporizador.clearTimeout(this.tarea)
    this.tarea = undefined
  }

  private fijarRestante(n: number | null): void {
    this.restante = n
    if (n !== null && n > 0) {
      this.tarea = this.temporizador.setTimeout(() => {
        this.tarea = undefined
        this.fijarRestante(n - 1)
      }, 1000)
    }
    for (const oyente of this.oyentes) oyente(n)
    if (n === 0 && this.restante === n) {
      for (const cb of this.finales) cb()
    }
  }
}
