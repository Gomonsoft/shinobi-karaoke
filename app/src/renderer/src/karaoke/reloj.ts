export interface Anclaje {
  ctxInicio: number
  posInicioMs: number
  velocidad: number
}

export interface IntervaloBucle {
  inicioMs: number
  finMs: number
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

/** Conserva el recorrido inicial y envuelve al alcanzar el extremo superior. */
export function msBucleEn(ctxS: number, anclaje: Anclaje, bucle: IntervaloBucle): number {
  const ms = msCancionEn(ctxS, anclaje)
  if (ms < bucle.finMs) return ms
  return bucle.inicioMs + ((ms - bucle.finMs) % (bucle.finMs - bucle.inicioMs))
}

export function reanclar(anclaje: Anclaje, ctxAhora: number, velocidadNueva: number): Anclaje {
  return {
    ctxInicio: ctxAhora,
    posInicioMs: msCancionEn(ctxAhora, anclaje),
    velocidad: velocidadNueva
  }
}
