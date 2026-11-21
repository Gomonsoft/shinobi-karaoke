/** Reloj local de la cuenta entre canciones (ADR 0017 §10): la fecha límite es de main, aquí solo se dibuja. */

export interface TransicionVista {
  transicionId: string
  restanteMs: number
  duracionMs: number
  congelada: boolean
}

/**
 * Convierte el `restanteMs` que envía main en un valor que baja con `performance.now()` local.
 *
 * - Una cuenta nueva (otro `transicionId`) o un `restanteMs` nuevo de main rebasan el reloj.
 * - Una cuenta congelada (por main o por `cierrePendiente`) se queda quieta, y al descongelarse sigue
 *   desde el mismo valor mientras main no envíe otro distinto.
 * - `actualizar` es idempotente con las mismas entradas, así que puede llamarse al renderizar.
 */
export class RelojCuenta {
  private id: string | null = null
  private ultimoMain = 0
  private ultimaCongeladaMain = false
  private valorMs = 0
  private desdeMs = 0
  private quieta = false

  constructor(private readonly ahora: () => number = () => performance.now()) {}

  actualizar(t: TransicionVista | null, cierrePendiente: boolean): void {
    if (!t) {
      this.id = null
      return
    }
    const congelar = t.congelada || cierrePendiente
    if (t.transicionId !== this.id) {
      this.id = t.transicionId
      this.rebasar(t, congelar)
      return
    }
    if (t.restanteMs !== this.ultimoMain || t.congelada !== this.ultimaCongeladaMain) {
      this.rebasar(t, congelar)
      return
    }
    if (congelar && !this.quieta) {
      this.valorMs = this.restanteMs()
      this.quieta = true
    } else if (!congelar && this.quieta) {
      this.desdeMs = this.ahora()
      this.quieta = false
    }
  }

  private rebasar(t: TransicionVista, congelar: boolean): void {
    this.ultimoMain = t.restanteMs
    this.ultimaCongeladaMain = t.congelada
    this.valorMs = t.restanteMs
    this.desdeMs = this.ahora()
    this.quieta = congelar
  }

  restanteMs(): number {
    if (this.quieta) return this.valorMs
    return Math.max(0, this.valorMs - (this.ahora() - this.desdeMs))
  }

  congelada(): boolean {
    return this.quieta
  }
}

/** Número entero que se pinta: empieza en la duración y baja uno por segundo; nunca muestra 0. */
export function numeroDeCuenta(restanteMs: number): number {
  return Math.max(1, Math.ceil(restanteMs / 1000))
}

/** Fracción del anillo que queda (1 = lleno, 0 = vacío). */
export function fraccionDeCuenta(restanteMs: number, duracionMs: number): number {
  if (duracionMs <= 0) return 0
  return Math.min(1, Math.max(0, restanteMs / duracionMs))
}
