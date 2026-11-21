import { EventEmitter } from 'node:events'
import { z } from 'zod'
import type { PantallaSistema, Rectangulo, ScreenLike } from './pantallas'

const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive()
})

const pantallaSimuladaSchema = z.object({
  id: z.number().int(),
  label: z.string().default(''),
  bounds: rectSchema,
  workArea: rectSchema.optional(),
  scaleFactor: z.number().positive().default(1)
})

/** Puerto de pruebas en `globalThis.__shinobiPruebas.pantallas` (solo sin empaquetar). */
export interface PuertoPantallas {
  quitar(id: number): void
  añadir(pantalla: z.input<typeof pantallaSimuladaSchema>): void
}

function normalizar(p: z.output<typeof pantallaSimuladaSchema>): PantallaSistema {
  return { ...p, workArea: p.workArea ?? p.bounds }
}

function contiene(r: Rectangulo, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
}

/** `screen` simulado; la primera pantalla es la primaria. */
export class ScreenSimulado extends EventEmitter implements ScreenLike {
  private pantallas: PantallaSistema[]

  constructor(pantallas: z.input<typeof pantallaSimuladaSchema>[]) {
    super()
    this.pantallas = pantallas.map((p) => normalizar(pantallaSimuladaSchema.parse(p)))
    if (this.pantallas.length === 0) throw new Error('Se necesita al menos una pantalla')
  }

  getAllDisplays(): PantallaSistema[] {
    return [...this.pantallas]
  }

  getPrimaryDisplay(): PantallaSistema {
    return this.pantallas[0]!
  }

  getDisplayMatching(rect: Rectangulo): PantallaSistema {
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    return this.pantallas.find((p) => contiene(p.bounds, cx, cy)) ?? this.getPrimaryDisplay()
  }

  quitar(id: number): void {
    const pantalla = this.pantallas.find((p) => p.id === id)
    if (!pantalla || this.pantallas.length === 1) return
    this.pantallas = this.pantallas.filter((p) => p.id !== id)
    this.emit('display-removed', {}, pantalla)
  }

  añadir(entrada: z.input<typeof pantallaSimuladaSchema>): void {
    const pantalla = normalizar(pantallaSimuladaSchema.parse(entrada))
    if (this.pantallas.some((p) => p.id === pantalla.id)) return
    this.pantallas = [...this.pantallas, pantalla]
    this.emit('display-added', {}, pantalla)
  }
}

/**
 * Pantallas simuladas desde `SHINOBI_PANTALLAS_SIMULADAS` (JSON). Solo sin empaquetar; devuelve
 * `null` si no aplica o el JSON no es válido. Publica el puerto de pruebas en `globalThis`.
 */
export function pantallasSimuladas(opciones: {
  env: Record<string, string | undefined>
  empaquetada: boolean
}): ScreenSimulado | null {
  const texto = opciones.env.SHINOBI_PANTALLAS_SIMULADAS
  if (opciones.empaquetada || !texto) return null
  try {
    const screen = new ScreenSimulado(JSON.parse(texto) as never)
    const puerto: PuertoPantallas = {
      quitar: (id) => screen.quitar(id),
      añadir: (p) => screen.añadir(p)
    }
    const g = globalThis as { __shinobiPruebas?: { pantallas?: PuertoPantallas } }
    g.__shinobiPruebas = { ...g.__shinobiPruebas, pantallas: puerto }
    return screen
  } catch {
    return null
  }
}

/** `SHINOBI_PANTALLA_COMPLETA_SIMULADA=1` (solo sin empaquetar); vale para la principal y la secundaria. */
export function pantallaCompletaSimulada(opciones: {
  env: Record<string, string | undefined>
  empaquetada: boolean
}): boolean {
  return !opciones.empaquetada && opciones.env.SHINOBI_PANTALLA_COMPLETA_SIMULADA === '1'
}
