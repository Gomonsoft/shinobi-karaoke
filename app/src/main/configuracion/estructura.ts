import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Subdirectorios del directorio de datos (ADR 0006). */
export const SUBDIRECTORIOS_DATOS = [
  join('biblioteca', '.importando'),
  'modelos',
  'registros',
  'runtime'
] as const

/** Crea (si faltan) el directorio de datos y su estructura. Idempotente. */
export async function asegurarEstructuraDatos(datos: string): Promise<void> {
  await mkdir(datos, { recursive: true })
  for (const sub of SUBDIRECTORIOS_DATOS) {
    await mkdir(join(datos, sub), { recursive: true })
  }
}
