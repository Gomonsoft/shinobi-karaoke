import { randomUUID } from 'node:crypto'
import type { OperacionTema } from '../../shared'
import type { ImpactoCalculado } from './impacto'

/** Máximo de fichas vivas; la 17.ª expulsa a la más antigua (ADR 0016 §7). */
export const MAX_FICHAS = 16
/** Caducidad de una ficha. */
export const CADUCIDAD_FICHA_MS = 10 * 60 * 1000

export interface FichaGuardada {
  op: OperacionTema
  impacto: ImpactoCalculado
  creada: number
}

function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonico)
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((k) => [k, canonico((valor as Record<string, unknown>)[k])])
    )
  }
  return valor
}

/** Forma canónica de una operación (claves ordenadas) para compararla con la previsualizada. */
export const operacionCanonica = (op: OperacionTema): string => JSON.stringify(canonico(op))

/** Fichas de confirmación en memoria: de un solo uso, caducan y hay un máximo. */
export class Fichas {
  private readonly mapa = new Map<string, FichaGuardada>()

  constructor(
    private readonly reloj: () => number = Date.now,
    private readonly nuevoId: () => string = randomUUID
  ) {}

  crear(op: OperacionTema, impacto: ImpactoCalculado): string {
    const id = this.nuevoId()
    this.mapa.set(id, { op: structuredClone(op), impacto, creada: this.reloj() })
    while (this.mapa.size > MAX_FICHAS) {
      const mas = this.mapa.keys().next()
      if (mas.done) break
      this.mapa.delete(mas.value)
    }
    return id
  }

  /** Consume la ficha (un solo uso). `null` si es desconocida, usada o caducada. */
  tomar(id: string): FichaGuardada | null {
    const f = this.mapa.get(id)
    if (!f) return null
    this.mapa.delete(id)
    return this.reloj() - f.creada >= CADUCIDAD_FICHA_MS ? null : f
  }

  get tamano(): number {
    return this.mapa.size
  }
}
