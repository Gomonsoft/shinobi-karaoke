import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { crearTemporal } from './temporales'
import { writeFileSync } from 'node:fs'

/**
 * Prueba OPCIONAL con red real (0053): descarga un vídeo de licencia libre con yt-dlp de verdad.
 * Solo se ejecuta a mano con `SHINOBI_TESTS_RED=1` (y `uv`); nunca en push/PR.
 * Vídeo: «Big Buck Bunny» (Blender Foundation, CC BY 3.0), el mismo de la tarea 0047.
 */
const URL_LIBRE = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'

test.skip(process.env.SHINOBI_TESTS_RED !== '1', 'Requiere red: SHINOBI_TESTS_RED=1')

test('aviso, vista previa y descarga real de un vídeo CC BY', async () => {
  test.setTimeout(300_000)
  const datos = crearTemporal('yt-red')
  writeFileSync(
    join(datos, 'config.json'),
    JSON.stringify({
      esquema: 1,
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'cpu'
      },
      separacion: { modelos_descargados: ['calidad'] }
    })
  )
  const env = { ...process.env, SHINOBI_DATOS: datos } as Record<string, string>
  delete env.SHINOBI_YTDLP_FALSO
  const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env })
  try {
    const v = await app.firstWindow()
    await v.getByRole('button', { name: 'Añadir canción' }).first().click()
    await v.getByRole('radio', { name: 'Enlace de YouTube' }).click()
    await v.getByRole('button', { name: 'Entendido' }).click()
    await v.getByLabel('Enlace del vídeo').fill(URL_LIBRE)
    await v.getByRole('button', { name: 'Buscar vídeo' }).click()
    await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
      timeout: 90_000
    })
    await v.getByRole('button', { name: 'Descargar y continuar' }).click()
    const filas = v.getByRole('list', { name: 'Subpasos' }).getByRole('listitem')
    await expect(filas.nth(1)).toContainText('completado', { timeout: 240_000 })
    const [id] = readdirSync(join(datos, 'biblioteca')).filter((x) => x !== '.importando')
    const mezcla = join(datos, 'biblioteca', id!, 'fuente', 'mezcla.flac')
    expect(existsSync(mezcla)).toBe(true)
    expect(readFileSync(mezcla).subarray(0, 4).toString()).toBe('fLaC')
  } finally {
    await app.close()
  }
})
