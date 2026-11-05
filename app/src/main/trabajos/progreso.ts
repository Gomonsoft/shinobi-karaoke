/** Segundos de fase determinada que hay que observar antes de mostrar una ETA (ux/04). */
export const SEGUNDOS_MINIMOS_ETA = 15
/** Peso de cada muestra nueva en el suavizado del valor mostrado. */
const ALFA = 0.4

/** Margen bajo el siguiente límite de paso que la interpolación nunca cruza (0064). */
const MARGEN_PASO = 0.005
/** Pasos reales a partir de los cuales la ETA usa solo la velocidad observada. */
const PASOS_SOLO_OBSERVADA = 5
/** Segundos de `guardando` que se suman a la ETA de la separación. */
const SEGUNDOS_GUARDANDO = 1
/** Fase de la separación en la que se interpola (el resto no se interpola). */
export const FASE_SEPARANDO = 'separando'

/** Ritmo esperado de la fase `separando`: minutos de audio × factor × 60 (0064). */
export interface RitmoEsperado {
  segundosFase: number
}

/** Pasos reales de `tqdm` conocidos (detalle `{ paso, total }` del worker). */
export interface PasosReales {
  paso: number
  total: number
}

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
  /** Último evento real de `separando` con pasos conocidos (solo con `ritmoEsperado`). */
  private ultimo: {
    ms: number
    valor: number
    total: number
    eta: number | null
  } | null = null
  /** Valor publicado en la fase (real o interpolado); nunca decrece. */
  private publicado = 0

  /**
   * `segundosMinimos`: segundos observados antes de mostrar ETA (15 en tareas; 10 en el primer arranque).
   * `ritmoEsperado`: con él, `separando` se interpola entre eventos y la ETA combina estimación y observado.
   */
  constructor(
    private readonly segundosMinimos = SEGUNDOS_MINIMOS_ETA,
    private readonly ritmoEsperado?: RitmoEsperado
  ) {}

  /** Valor real suavizado (nunca interpolado) de la fase actual; es el que se persiste. */
  get valorReal(): number {
    return this.suave
  }

  /** true si la fase actual se interpola con el temporizador (hay ritmo y pasos conocidos). */
  get interpolando(): boolean {
    return this.ultimo !== null
  }

  registrar(
    fase: string,
    valor: number | null,
    ahoraMs: number,
    pasos?: PasosReales
  ): ProgresoSuavizado {
    if (fase !== this.fase) {
      this.fase = fase
      this.suave = 0
      this.publicado = 0
      this.origen = null
      this.ultimo = null
    }
    if (valor === null) {
      this.origen = null
      this.ultimo = null
      return { fase, valor: null, etaSegundos: null }
    }
    this.origen ??= { ms: ahoraMs, valor }
    const ritmo = this.ritmoEsperado
    if (ritmo && fase === FASE_SEPARANDO && ritmo.segundosFase > 0 && pasos && pasos.total > 0) {
      // Con interpolación el valor real se usa sin suavizar: el publicado ya es continuo.
      this.suave = valor >= 1 ? 1 : Math.max(this.suave, Math.min(1, valor))
      this.publicado = Math.max(this.publicado, this.suave)
      const eta = this.etaSeparando(valor, ahoraMs, this.origen, pasos, ritmo.segundosFase)
      this.ultimo = { ms: ahoraMs, valor: this.suave, total: pasos.total, eta }
      return { fase, valor: this.publicado, etaSegundos: eta }
    }
    this.suave =
      valor >= 1 ? 1 : Math.max(this.suave, Math.min(1, this.suave + ALFA * (valor - this.suave)))
    return { fase, valor: this.suave, etaSegundos: this.eta(valor, ahoraMs, this.origen) }
  }

  /**
   * Valor y ETA interpolados en `ahoraMs` (el temporizador de 1 s del gestor), o null si la
   * fase no se interpola. Avanza linealmente desde el último evento real, sin cruzar el
   * siguiente límite de paso menos un margen y sin retroceder.
   */
  interpolar(ahoraMs: number): ProgresoSuavizado | null {
    const u = this.ultimo
    const ritmo = this.ritmoEsperado
    if (!u || !ritmo || this.fase === null) return null
    const transcurridoS = Math.max(0, (ahoraMs - u.ms) / 1000)
    const limite = (Math.floor(u.valor * u.total + 1e-9) + 1) / u.total - MARGEN_PASO
    const interpolado = Math.min(u.valor + transcurridoS / ritmo.segundosFase, limite)
    this.publicado = Math.max(this.publicado, interpolado)
    const eta = u.eta === null ? null : Math.max(0, Math.round((u.eta - transcurridoS) * 10) / 10)
    return { fase: this.fase, valor: this.publicado, etaSegundos: eta }
  }

  /** ETA de `separando`: media ponderada entre la estimación por factor y lo observado. */
  private etaSeparando(
    valor: number,
    ahoraMs: number,
    origen: { ms: number; valor: number },
    pasos: PasosReales,
    segundosFase: number
  ): number | null {
    if (valor >= 1) return 0
    const transcurridoS = (ahoraMs - origen.ms) / 1000
    if (transcurridoS < this.segundosMinimos) return null
    const estimada = segundosFase * (1 - valor)
    const avance = valor - origen.valor
    let restante = estimada
    if (avance > 0) {
      const observada = (1 - valor) / (avance / transcurridoS)
      const peso = Math.min(1, pasos.paso / PASOS_SOLO_OBSERVADA)
      restante = peso * observada + (1 - peso) * estimada
    }
    return Math.round((restante + SEGUNDOS_GUARDANDO) * 10) / 10
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
