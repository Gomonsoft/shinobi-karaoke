import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { crearTemporal } from './temporales'
import { sembrar } from '../src/main/biblioteca/semilla'

const crearDatos = crearTemporal

/** Nunca se usa la papelera real: `papelera` es un directorio o `fallar` (0023). */
async function lanzar(datos: string, papelera?: string): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: papelera ?? join(datos, 'papelera')
    }
  })
}

test('filtros con recuento (la lista incompleta cuenta en Listas) y búsqueda sin tildes', async () => {
  const datos = crearDatos('filtros')
  await sembrar(datos)
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('article')).toHaveCount(10)
    await expect(v.getByRole('radio', { name: 'Todas 10' })).toBeVisible()
    // 3 listas (una incompleta), 5 borradores (con las de error e interrumpida) y 2 dañadas fuera de ambos.
    await v.getByRole('radio', { name: /^Listas \d+$/ }).click()
    await expect(v.getByRole('radio', { name: 'Listas 3' })).toBeChecked()
    await expect(v.getByRole('article')).toHaveCount(3)
    await expect(v.getByRole('article', { name: /^Lista incompleta,/ })).toHaveCount(1)

    await v.getByRole('radio', { name: /^Todas/ }).click()
    await v.getByRole('searchbox').fill('CANCION')
    await expect(v.getByRole('article')).toHaveCount(1)
    await v.getByRole('searchbox').fill('zzz')
    await expect(v.getByText('No hay canciones que coincidan con «zzz».')).toBeVisible()
    await v.getByRole('button', { name: 'Borrar búsqueda' }).click()
    await expect(v.getByRole('article')).toHaveCount(10)
  } finally {
    await app.close()
  }
})

test('volver a borrador y eliminar una canción de la semilla', async () => {
  const datos = crearDatos('acciones')
  await sembrar(datos)
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    const tarjeta = (titulo: string) => v.getByRole('article', { name: new RegExp(`^${titulo},`) })
    await expect(v.getByRole('article')).toHaveCount(10)

    // Volver a borrador (diálogo de confirmación).
    const lista = tarjeta('Canción lista')
    const idLista = (await lista.getAttribute('data-tarjeta'))!
    await lista.getByRole('button', { name: 'Más acciones de «Canción lista»' }).click()
    await v.getByRole('menuitem', { name: 'Volver a borrador' }).click()
    await expect(v.getByRole('dialog', { name: '¿Volver a borrador?' })).toBeVisible()
    await v.getByRole('button', { name: 'Volver a borrador' }).click()
    await expect(tarjeta('Canción lista')).toHaveAccessibleName(/Borrador\./)
    const json = JSON.parse(
      readFileSync(join(datos, 'biblioteca', idLista, 'cancion.json'), 'utf8')
    )
    expect(json.estado).toBe('borrador')

    // Eliminar con Supr: la carpeta desaparece de biblioteca/.
    const aEliminar = tarjeta('Borrador sin letra')
    const id = (await aEliminar.getAttribute('data-tarjeta'))!
    expect(existsSync(join(datos, 'biblioteca', id))).toBe(true)
    await aEliminar.focus()
    await v.keyboard.press('Delete')
    const dialogo = v.getByRole('dialog', { name: '¿Eliminar «Borrador sin letra»?' })
    await expect(dialogo).toBeVisible()
    await dialogo.getByRole('button', { name: 'Eliminar' }).click()
    await expect(v.getByText('«Borrador sin letra» se movió a la papelera.')).toBeVisible()
    await expect(v.getByRole('article')).toHaveCount(9)
    expect(existsSync(join(datos, 'biblioteca', id))).toBe(false)
    expect(readdirSync(join(datos, 'papelera')).some((n) => n.startsWith(`${id}-`))).toBe(true)
  } finally {
    await app.close()
  }
})

test('si la papelera falla: toast de error con "Copiar detalles" y la carpeta sigue', async () => {
  const datos = crearDatos('papelera-falla')
  await sembrar(datos)
  const app = await lanzar(datos, 'fallar')
  try {
    const v = await app.firstWindow()
    const t = v.getByRole('article', { name: /^Borrador sin letra,/ })
    const id = (await t.getAttribute('data-tarjeta'))!
    await t.focus()
    await v.keyboard.press('Delete')
    await v
      .getByRole('dialog', { name: '¿Eliminar «Borrador sin letra»?' })
      .getByRole('button', { name: 'Eliminar' })
      .click()
    await expect(v.getByText('No se pudo mover «Borrador sin letra» a la papelera.')).toBeVisible()
    await expect(v.getByRole('button', { name: 'Copiar detalles' })).toBeVisible()
    await expect(v.getByRole('article')).toHaveCount(10)
    expect(existsSync(join(datos, 'biblioteca', id))).toBe(true)
  } finally {
    await app.close()
  }
})

test('Editar datos guarda título, artista y álbum', async () => {
  const datos = crearDatos('datos')
  await sembrar(datos)
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    const t = v.getByRole('article', { name: /^Canción lista,/ })
    const id = (await t.getAttribute('data-tarjeta'))!
    await t.getByRole('button', { name: 'Más acciones de «Canción lista»' }).click()
    await v.getByRole('menuitem', { name: 'Editar datos' }).click()
    const dialogo = v.getByRole('dialog', { name: 'Editar datos' })
    await dialogo.getByLabel('Título').fill('  Otro título ')
    await dialogo.getByLabel('Álbum').fill('Mi álbum')
    await dialogo.getByRole('button', { name: 'Guardar' }).click()
    await expect(v.getByRole('article', { name: /^Otro título,/ })).toBeVisible()
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(join(datos, 'biblioteca', id, 'cancion.json'), 'utf8')).metadatos
      )
      .toMatchObject({ titulo: 'Otro título', album: 'Mi álbum' })
  } finally {
    await app.close()
  }
})
