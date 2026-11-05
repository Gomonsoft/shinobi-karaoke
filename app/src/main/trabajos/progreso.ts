/** Segundos de fase determinada que hay que observar antes de mostrar una ETA (ux/04). */
export const SEGUNDOS_MINIMOS_ETA = 15
/** Peso de cada muestra nueva en el suavizado del valor mostrado. */
const ALFA = 0.4

export interface ProgresoSuavizado {
  fase: string
  /** 0–1 suavizado y nunca decreciente dentro de una fase; null si la fase es indeterminada. */
  valor: number | null
  /** Segundos restantes, o null (fase indeterminada, primeros 15 s de la fase o sin avance). */
  etaSegundos: number | null
}

/**
 * Suaviza el progreso del worker y calcula la ETA con la velocidad observada en
 * la fase determinada actual. Al cambiar de fase se empieza de cero. Función de
 * estado pura: el reloj (ms) lo pasa el llamador.
 */
export class EstimadorProgreso {
  private fase: string | null = null
  private suave = 0
  /** Muestra con la que empezó la parte determinada de la fase actual. */
  private origen: { ms: number; valor: number } | null = null

  /** `segundosMinimos`: segundos observados antes de mostrar ETA (15 en tareas; 10 en el primer arranque). */
  constructor(private readonly segundosMinimos = SEGUNDOS_MINIMOS_ETA) {}

  registrar(fase: string, valor: number | null, ahoraMs: number): ProgresoSuavizado {
    if (fase !== this.fase) {
      this.fase = fase
      this.suave = 0
      this.origen = null
    }
    if (valor === null) {
      this.origen = null
      return { fase, valor: null, etaSegundos: null }
    }
    this.origen ??= { ms: ahoraMs, valor }
    this.suave =
      valor >= 1 ? 1 : Math.max(this.suave, Math.min(1, this.suave + ALFA * (valor - this.suave)))
    return { fase, valor: this.suave, etaSegundos: this.eta(valor, ahoraMs, this.origen) }
  }

  private eta(
    valor: number,
    ahoraMs: number,
    origen: { ms: number; valor: number }
  ): number | null {
    if (valor >= 1) return 0
    const transcurridoS = (ahoraMs - origen.ms) / 1000
    const avance = valor - origen.valor
    if (transcurridoS < this.segundosMinimos || avance <= 0) return null
    return Math.round(((1 - valor) / (avance / transcurridoS)) * 10) / 10
  }
}

/** Decide cuándo persistir el progreso: cada avance de al menos `paso` desde el último guardado. */
export class UmbralProgreso {
  private ultimo = 0
  constructor(private readonly paso = 0.05) {}

  /** true si `valor` supera en `paso` o más el último valor aceptado (o es 1). */
  aceptar(valor: number): boolean {
    if (valor >= 1 ? this.ultimo < 1 : valor - this.ultimo >= this.paso - 1e-9) {
      this.ultimo = valor
      return true
    }
    return false
  }
}
