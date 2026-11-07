import { finEfectivo, type Letra } from '@shared/letra'

export interface IntervaloTiempo {
  inicioMs: number
  finMs: number
}

export type VistaLineaTiempo = IntervaloTiempo

export interface IntervaloRecortado extends IntervaloTiempo {
  inicioRecortado: boolean
  finRecortado: boolean
}

export interface RegionLineaTiempo {
  id: string
  texto: string
  finAutomatico: boolean
  real: IntervaloTiempo
  audible: IntervaloRecortado | null
}

export interface ModeloLineaTiempo {
  regiones: RegionLineaTiempo[]
  pausas: { id: string; tiempoMs: number }[]
}

const VISTA_MINIMA_MS = 1000
const MARGEN_ZOOM_LINEA = 0.1

export function tiempoLetraAAudio(tiempoMs: number, offsetMs: number): number {
  return tiempoMs + offsetMs
}

export function tiempoAudioALetra(tiempoMs: number, offsetMs: number): number {
  return tiempoMs - offsetMs
}

export function recortarIntervalo(
  intervalo: IntervaloTiempo,
  limites: IntervaloTiempo
): IntervaloRecortado | null {
  const inicioMs = Math.max(intervalo.inicioMs, limites.inicioMs)
  const finMs = Math.min(intervalo.finMs, limites.finMs)
  if (inicioMs >= finMs) return null
  return {
    inicioMs,
    finMs,
    inicioRecortado: inicioMs !== intervalo.inicioMs,
    finRecortado: finMs !== intervalo.finMs
  }
}

export function proyectarLineaTiempo(
  letra: Pick<Letra, 'lineas' | 'offset_ms'>,
  duracionMs: number
): ModeloLineaTiempo {
  const regiones: RegionLineaTiempo[] = []
  const pausas: ModeloLineaTiempo['pausas'] = []
  const pista = crearVistaLineaTiempo(duracionMs)
  for (const elemento of letra.lineas) {
    if (elemento.inicio_ms === null) continue
    const inicioMs = tiempoLetraAAudio(elemento.inicio_ms, letra.offset_ms)
    if (elemento.tipo === 'pausa') {
      if (inicioMs >= pista.inicioMs && inicioMs <= pista.finMs) {
        pausas.push({ id: elemento.id, tiempoMs: inicioMs })
      }
      continue
    }
    const fin = finEfectivo(letra, elemento.id, duracionMs)!
    const real = { inicioMs, finMs: tiempoLetraAAudio(fin, letra.offset_ms) }
    regiones.push({
      id: elemento.id,
      texto: elemento.texto,
      finAutomatico: elemento.fin_ms === null,
      real,
      audible: recortarIntervalo(real, pista)
    })
  }
  return { regiones, pausas }
}

export function crearVistaLineaTiempo(duracionMs: number): VistaLineaTiempo {
  return { inicioMs: 0, finMs: duracionMs }
}

function extension(vista: VistaLineaTiempo): number {
  return vista.finMs - vista.inicioMs
}

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(valor, maximo))
}

function extensionValida(duracionMs: number, solicitadaMs: number): number {
  return acotar(solicitadaMs, Math.min(VISTA_MINIMA_MS, duracionMs), duracionMs)
}

export function ajustarVistaLineaTiempo(
  vista: VistaLineaTiempo,
  duracionMs: number
): VistaLineaTiempo {
  const visibleMs = extensionValida(duracionMs, extension(vista))
  const inicioMs = acotar(vista.inicioMs, 0, duracionMs - visibleMs)
  return { inicioMs, finMs: Math.min(inicioMs + visibleMs, duracionMs) }
}

/** Un factor mayor que uno acerca. El ancla recorre la ventana de 0 a 1. */
export function zoomLineaTiempo(
  vista: VistaLineaTiempo,
  duracionMs: number,
  factor: number,
  fraccionAncla: number
): VistaLineaTiempo {
  const fraccion = acotar(fraccionAncla, 0, 1)
  const actualMs = extension(vista)
  const visibleMs = extensionValida(duracionMs, actualMs / factor)
  const inicioMs = vista.inicioMs + fraccion * (actualMs - visibleMs)
  return ajustarVistaLineaTiempo({ inicioMs, finMs: inicioMs + visibleMs }, duracionMs)
}

export function zoomALinea(audible: IntervaloTiempo, duracionMs: number): VistaLineaTiempo {
  const margenMs = extension(audible) * MARGEN_ZOOM_LINEA
  return centrarLineaTiempo(
    { inicioMs: audible.inicioMs - margenMs, finMs: audible.finMs + margenMs },
    duracionMs,
    (audible.inicioMs + audible.finMs) / 2
  )
}

export function centrarLineaTiempo(
  vista: VistaLineaTiempo,
  duracionMs: number,
  tiempoMs: number
): VistaLineaTiempo {
  const mitadMs = extensionValida(duracionMs, extension(vista)) / 2
  return ajustarVistaLineaTiempo(
    { inicioMs: tiempoMs - mitadMs, finMs: tiempoMs + mitadMs },
    duracionMs
  )
}

export function desplazarLineaTiempo(
  vista: VistaLineaTiempo,
  duracionMs: number,
  deltaMs: number
): VistaLineaTiempo {
  return ajustarVistaLineaTiempo(
    { inicioMs: vista.inicioMs + deltaMs, finMs: vista.finMs + deltaMs },
    duracionMs
  )
}

/** No acota el resultado. Los consumidores deciden cómo tratar un punto exterior. */
export function tiempoAPixel(vista: VistaLineaTiempo, anchoPx: number, tiempoMs: number): number {
  const visibleMs = extension(vista)
  return visibleMs === 0 ? 0 : ((tiempoMs - vista.inicioMs) / visibleMs) * anchoPx
}

export function pixelATiempo(vista: VistaLineaTiempo, anchoPx: number, pixel: number): number {
  return vista.inicioMs + (pixel / anchoPx) * extension(vista)
}
