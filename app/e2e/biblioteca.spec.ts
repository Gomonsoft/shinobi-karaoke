import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { configPredeterminada } from '../src/shared/config'
import { crearTemporal } from './temporales'

async function lanzar(datos: string): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos }
  })
}

test('con la semilla se ven las canciones esperadas con su insignia y su línea', async () => {
  const datos = crearTemporal('bib')
  await sembrar(datos)
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('article')).toHaveCount(20)
    const tarjeta = (titulo: string) => v.getByRole('article', { name: new RegExp(`^${titulo},`) })

    await expect(tarjeta('Canción lista')).toHaveAccessibleName(/Lista\.(?: Tema: .+\.)?$/)
    await expect(tarjeta('Lista con palabras')).toHaveAccessibleName(/Lista\.(?: Tema: .+\.)?$/)
    // Lista incompleta: sigue siendo Lista, con aviso (icono + texto) y "Reproducir".
    const incompleta = tarjeta('Lista incompleta')
    await expect(incompleta).toHaveAccessibleName(
      /Lista\. Falta 1 línea por sincronizar\.(?: Tema: .+\.)?$/
    )
    await expect(incompleta.getByText('Falta 1 línea por sincronizar')).toBeVisible()
    await expect(incompleta.locator('svg').nth(1)).toBeVisible()
    await expect(incompleta.getByRole('button', { name: /^Reproducir/ })).toBeVisible()

    await expect(tarjeta('Borrador sin letra')).toHaveAccessibleName(
      /Borrador\. Falta la letra\.(?: Tema: .+\.)?$/
    )
    await expect(tarjeta('Borrador con letra a medias')).toHaveAccessibleName(
      /Borrador\. Falta 1 línea por sincronizar\.(?: Tema: .+\.)?$/
    )
    await expect(tarjeta('Separación con error')).toHaveAccessibleName(
      /Error\. Tu equipo se quedó sin memoria\.(?: Tema: .+\.)?$/
    )
    await expect(tarjeta('Separación interrumpida')).toHaveAccessibleName(
      /Borrador\. Interrumpido\.(?: Tema: .+\.)?$/
    )
    await expect(tarjeta('Sin pistas')).toHaveAccessibleName(
      /Dañada\. Faltan las pistas separadas\.(?: Tema: .+\.)?$/
    )
    await expect(
      v.getByRole('article', {
        name: /^Canción sin nombre, Dañada\. No se puede abrir esta canción\.$/
      })
    ).toHaveCount(1)

    // El botón de la barra existe cuando hay canciones.
    await expect(
      v.getByRole('banner').getByRole('button', { name: 'Añadir canción' })
    ).toBeVisible()

    // La capa deja montada la Biblioteca y devuelve el foco a la misma tarjeta.
    await tarjeta('Canción lista')
      .getByRole('button', { name: 'Canción lista', exact: true })
      .click()
    const reproductor = v.getByRole('dialog', { name: 'Reproductor de «Canción lista»' })
    await expect(reproductor).toBeVisible()
    await v.keyboard.press('Escape')
    await expect(reproductor).toHaveCount(0)
    await expect(tarjeta('Canción lista')).toBeFocused()
  } finally {
    await app.close()
  }
})

test('con la biblioteca vacía se ve el estado vacío con un único botón primario', async () => {
  const datos = crearTemporal('bib-vacia')
  const config = configPredeterminada()
  config.instalacion.estado = 'completa'
  mkdirSync(datos, { recursive: true })
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { name: 'Tu biblioteca está vacía' })).toBeVisible()
    await expect(v.getByRole('button', { name: 'Añadir canción' })).toHaveCount(1)
    await expect(v.getByRole('article')).toHaveCount(0)
  } finally {
    await app.close()
  }
})
