import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { CODIGOS_ERROR, type Manifiesto, type ModeloManifiesto } from '../../../shared'

/**
 * Escenario del runtime falso (tarea 0039, ADR 0009 §8). `SHINOBI_RUNTIME_FALSO=<escenario.json>`
 * sustituye uv, el diagnóstico, la descarga de modelos, el espacio libre y la detección de GPU por
 * dobles que siguen este escenario. Solo se honra sin empaquetar (`cargarEscenarioFalso`).
 *
 * Ejemplo mínimo (todos los campos son opcionales):
 *
 *   {
 *     "plataforma": "linux-x64",
 *     "gpu": { "nombre": "NVIDIA GeForce RTX 3060", "vramMb": 12288 },
 *     "espacioLibre": 50000000000,
 *     "fases": { "motor": { "ms": 800 }, "componentes": { "ms": 800 }, "modelo": { "ms": 800 } },
 *     "fallo": { "fase": "componentes", "codigo": "SIN_CONEXION", "veces": 1 },
 *     "diagnostico": { "perfil": "cpu", "motivoRebaja": "memoria" },
 *     "modelos": "diminutos"
 *   }
 *
 * - `plataforma`: la que "detecta" la app (`darwin-arm64`, `win32-x64`, `linux-x64`).
 * - `gpu`: la que devuelve el detector (`null` = ninguna).
 * - `espacioLibre`: bytes libres, o `{ "desdeArchivo": "ruta" }` con un archivo que contiene el número
 *   (relativo a la carpeta del escenario) para cambiarlo mientras la app corre.
 * - `fases.<fase>.ms`: duración simulada; los bytes de motor, componentes y modelo son los del
 *   manifiesto, escritos como archivos dispersos (sin ocupar disco) a ritmo constante.
 * - `fallo`: la fase (`motor`, `componentes`, `diagnostico`, `modelo`) falla con `codigo`, `veces`
 *   veces (número) o `"siempre"`.
 * - `diagnostico`: perfil que devuelve el diagnóstico (por defecto el previsto) y motivo de rebaja.
 * - `modelos`: `reales` (tamaños y SHA-256 del manifiesto, archivos dispersos) o `diminutos`
 *   (2 KiB con contenido determinista y SHA-256 válido: permiten la verificación completa).
 * - `llamadas`: archivo JSONL donde los dobles anotan cada llamada (por defecto `llamadas.jsonl` junto
 *   al escenario).
 */

const fase = z.strictObject({ ms: z.number().int().min(0).max(120_000).default(800) })

export const escenarioRuntimeFalsoSchema = z.strictObject({
  plataforma: z.enum(['darwin-arm64', 'win32-x64', 'linux-x64']).default('linux-x64'),
  gpu: z
    .strictObject({ nombre: z.string().min(1), vramMb: z.number().int().positive() })
    .nullable()
    .default(null),
  espacioLibre: z
    .union([z.number().nonnegative(), z.strictObject({ desdeArchivo: z.string().min(1) })])
    .default(500e9),
  fases: z
    .strictObject({
      motor: fase.default({ ms: 800 }),
      componentes: fase.default({ ms: 800 }),
      diagnostico: fase.default({ ms: 200 }),
      modelo: fase.default({ ms: 800 })
    })
    .default({
      motor: { ms: 800 },
      componentes: { ms: 800 },
      diagnostico: { ms: 200 },
      modelo: { ms: 800 }
    }),
  fallo: z
    .strictObject({
      fase: z.enum(['motor', 'componentes', 'diagnostico', 'modelo']),
      codigo: z.enum(CODIGOS_ERROR),
      veces: z.union([z.number().int().positive(), z.literal('siempre')]).default(1)
    })
    .nullable()
    .default(null),
  diagnostico: z
    .strictObject({
      perfil: z.enum(['cpu', 'cuda', 'mps']).optional(),
      motivoRebaja: z.enum(['memoria', 'generico']).nullable().default(null)
    })
    .default({ motivoRebaja: null }),
  modelos: z.enum(['reales', 'diminutos']).default('reales'),
  llamadas: z.string().min(1).optional()
})

export type EscenarioRuntimeFalso = z.infer<typeof escenarioRuntimeFalsoSchema>

export const VARIABLE_RUNTIME_FALSO = 'SHINOBI_RUNTIME_FALSO'

/** Valida un escenario ya parseado de JSON. */
export function parsearEscenario(json: unknown): EscenarioRuntimeFalso {
  return escenarioRuntimeFalsoSchema.parse(json)
}

/**
 * Lee el escenario de `SHINOBI_RUNTIME_FALSO`. Devuelve `null` si no está definida o si la app está
 * empaquetada (se ignora igual que `SHINOBI_PAPELERA_PRUEBAS`). Un escenario no válido lanza.
 */
export function cargarEscenarioFalso(opciones: {
  env: Record<string, string | undefined>
  empaquetada: boolean
}): { escenario: EscenarioRuntimeFalso; ruta: string } | null {
  const ruta = opciones.env[VARIABLE_RUNTIME_FALSO]
  if (opciones.empaquetada || !ruta) return null
  const escenario = parsearEscenario(JSON.parse(readFileSync(ruta, 'utf8')))
  return { escenario, ruta }
}

export const BYTES_MODELO_DIMINUTO = 2048

/** Contenido determinista de un archivo de modelo "diminuto" (según el nombre del archivo). */
export function contenidoDiminuto(archivo: string): Buffer {
  const semilla = createHash('sha256').update(archivo).digest()
  return Buffer.alloc(BYTES_MODELO_DIMINUTO, semilla)
}

const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

/** Con `modelos: "diminutos"`, los modelos del manifiesto pasan a 2 KiB con SHA-256 coherente. */
export function manifiestoParaEscenario(
  manifiesto: Manifiesto,
  escenario: Pick<EscenarioRuntimeFalso, 'modelos'>
): Manifiesto {
  if (escenario.modelos === 'reales') return manifiesto
  const modelos: ModeloManifiesto[] = manifiesto.modelos.map((m) => {
    const c = contenidoDiminuto(m.archivo)
    return { ...m, bytes: c.length, sha256: sha(c), extra: [] }
  })
  return { ...manifiesto, modelos }
}
