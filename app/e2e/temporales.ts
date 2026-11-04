import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from '@playwright/test'

const temporales: string[] = []

/** Crea un directorio temporal que se borra al terminar cada prueba (0023). */
export function crearTemporal(nombre: string): string {
  const d = mkdtempSync(join(tmpdir(), `shinobi-e2e-${nombre}-`))
  temporales.push(d)
  return d
}

test.afterEach(() => {
  for (const d of temporales.splice(0)) rmSync(d, { recursive: true, force: true })
})
