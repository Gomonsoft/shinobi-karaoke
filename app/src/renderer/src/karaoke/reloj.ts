export interface Anclaje {
  ctxInicio: number
  posInicioMs: number
  velocidad: number
}

export interface MarcaSalida {
  contextTime: number
  performanceTime: number
}

export interface Ahora {
  ctx: number
  perf: number
}

/** Instante del contexto que se oía al ocurrir el evento, en segundos. */
export function ctxOidoEn(
  perfMs: number,
  marca: MarcaSalida | null,
  ahora: Ahora,
  latenciaSalidaS: number
): number {
  if (marca && marca.performanceTime > 0) {
    return marca.contextTime + (perfMs - marca.performanceTime) / 1000
  }
  return ahora.ctx - (ahora.perf - perfMs) / 1000 - latenciaSalidaS
}

export function msCancionEn(ctxS: number, anclaje: Anclaje): number {
  return anclaje.posInicioMs + (ctxS - anclaje.ctxInicio) * 1000 * anclaje.velocidad
}

export function reanclar(anclaje: Anclaje, ctxAhora: number, velocidadNueva: number): Anclaje {
  return {
    ctxInicio: ctxAhora,
    posInicioMs: msCancionEn(ctxAhora, anclaje),
    velocidad: velocidadNueva
  }
}
