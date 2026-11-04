import type { z } from 'zod'
import { cancionSchema, resumirErroresZod, VERSION_ESQUEMA_CANCION, type Cancion } from './cancion'
import { configSchema, VERSION_ESQUEMA_CONFIG, type Config } from './config'

/** El archivo es de una versión de esquema que esta app no entiende (p. ej. más nueva). */
export class ErrorEsquemaNoSoportado extends Error {
  constructor(
    readonly version: unknown,
    readonly maxima: number
  ) {
    super(
      typeof version === 'number' && version > maxima
        ? `El archivo usa el formato ${version}, más nuevo que el que entiende esta versión de la app (${maxima}). Actualiza Shinobi Karaoke.`
        : `El archivo tiene una versión de formato no válida (${String(version)}).`
    )
    this.name = 'ErrorEsquemaNoSoportado'
  }
}

/** El contenido no cumple el esquema. */
export class ErrorDatosInvalidos extends Error {
  constructor(
    readonly detalle: string,
    readonly causa?: unknown
  ) {
    super(`Los datos no son válidos:\n${detalle}`)
    this.name = 'ErrorDatosInvalidos'
  }
}

/** Migración de la versión N a la N+1 (clave = N). Vacía: la versión 1 es la única. */
type Migracion = (json: Record<string, unknown>) => Record<string, unknown>
const MIGRACIONES_CANCION: Record<number, Migracion> = {}
const MIGRACIONES_CONFIG: Record<number, Migracion> = {}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function llevarAVersionActual(
  json: unknown,
  actual: number,
  migraciones: Record<number, Migracion>,
  versionPorDefecto: number | null
): Record<string, unknown> {
  if (!esObjeto(json)) throw new ErrorDatosInvalidos('Se esperaba un objeto JSON')
  const declarada = json.esquema ?? versionPorDefecto
  if (
    typeof declarada !== 'number' ||
    !Number.isInteger(declarada) ||
    declarada < 1 ||
    declarada > actual
  ) {
    throw new ErrorEsquemaNoSoportado(declarada, actual)
  }
  let datos: Record<string, unknown> = { ...json, esquema: declarada }
  for (let v = declarada; v < actual; v++) {
    const migrar = migraciones[v]
    if (!migrar) throw new ErrorEsquemaNoSoportado(v, actual)
    datos = { ...migrar(datos), esquema: v + 1 }
  }
  return datos
}

function validar<T extends z.ZodType>(schema: T, datos: unknown): z.output<T> {
  const r = schema.safeParse(datos)
  if (!r.success) throw new ErrorDatosInvalidos(resumirErroresZod(r.error), r.error)
  return r.data
}

/**
 * Lee un cancion.json de cualquier versión soportada y lo devuelve en la
 * versión actual, validado. Lanza ErrorEsquemaNoSoportado o ErrorDatosInvalidos.
 */
export function migrarCancion(json: unknown): Cancion {
  const datos = llevarAVersionActual(json, VERSION_ESQUEMA_CANCION, MIGRACIONES_CANCION, null)
  return validar(cancionSchema, datos)
}

/**
 * Lee un config.json (tolerante: campos ausentes → valores por defecto; sin
 * `esquema` se asume la versión 1). Lanza como migrarCancion.
 */
export function migrarConfig(json: unknown): Config {
  const datos = llevarAVersionActual(json, VERSION_ESQUEMA_CONFIG, MIGRACIONES_CONFIG, 1)
  return validar(configSchema, datos)
}
