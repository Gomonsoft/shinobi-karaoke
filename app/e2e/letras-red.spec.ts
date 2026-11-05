import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { crearTemporal } from './temporales'

/**
 * Prueba OPCIONAL con LRCLIB real (0089): solo con `SHINOBI_TESTS_RED=1`; nunca en push/PR.
 * Parte de la semilla («Borrador sin letra») con los metadatos del ejemplo de la documentación de
 * LRCLIB —«I Want to Live», Borislav Slavov, 233 s— y SIN `SHINOBI_LRCLIB_URL` (red real).
 * Las letras recibidas no se guardan en el repositorio ni se muestran en el informe.
 */
const ID = '5eed0000-0000-4000-8000-000000000005'

test.skip(process.env.SHINOBI_TESTS_RED !== '1', 'Requiere red: SHINOBI_TESTS_RED=1')

test('la búsqueda automática encuentra la letra real y se guarda con origen lrclib', async () => {
  test.setTimeout(90_000)
  const datos = crearTemporal('letras-red')
  await sembrar(datos)
  const ruta = join(datos, 'biblioteca', ID, 'cancion.json')
  const cancion = JSON.parse(readFileSync(ruta, 'utf8'))
  cancion.metadatos = {
    ...cancion.metadatos,
    titulo: 'I Want to Live',
    artista: 'Borislav Slavov',
    duracion_ms: 233_000
  }
  writeFileSync(ruta, JSON.stringify(cancion, null, 2))

  const env = { ...process.env, SHINOBI_DATOS: datos } as Record<string, string>
  delete env.SHINOBI_LRCLIB_URL
  const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env })
  try {
    const v = await app.firstWindow()
    await v
      .getByRole('article', { name: /^I Want to Live,/ })
      .getByRole('button', { name: /^Continuar/ })
      .click()
    // La búsqueda automática se lanza al entrar si no hay letra.
    const usar = v.getByRole('button', { name: 'Usar esta letra' }).first()
    await expect(usar).toBeVisible({ timeout: 30_000 })
    await usar.click()
    await expect
      .poll(() => JSON.parse(readFileSync(ruta, 'utf8')).letra?.origen, { timeout: 15_000 })
      .toBe('lrclib')
    const guardada = JSON.parse(readFileSync(ruta, 'utf8')).letra
    expect(Number.isInteger(guardada.lrclib_id)).toBe(true)
    expect(guardada.lineas.length).toBeGreaterThan(0)
    // Candidato sincronizado: alguna línea con tiempo.
    expect(guardada.lineas.some((l: { inicio_ms: number | null }) => l.inicio_ms !== null)).toBe(
      true
    )
  } finally {
    await app.close()
  }
})
