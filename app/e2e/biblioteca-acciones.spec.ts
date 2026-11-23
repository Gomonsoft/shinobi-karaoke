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
    await expect(v.getByRole('article')).toHaveCount(20)
    await expect(v.getByRole('radio', { name: 'Todas 20' })).toBeVisible()
    // 6 listas (tres incompletas), 12 borradores y 2 dañadas fuera de ambos.
    await v.getByRole('radio', { name: /^Listas \d+$/ }).click()
    await expect(v.getByRole('radio', { name: 'Listas 6' })).toBeChecked()
    await expect(v.getByRole('article')).toHaveCount(6)
    await expect(v.getByRole('article', { name: /^Lista incompleta,/ })).toHaveCount(1)

    await v.getByRole('radio', { name: /^Todas/ }).click()
    await v.getByRole('searchbox').fill('CANCION')
    await expect(v.getByRole('article')).toHaveCount(1)
    await v.getByRole('searchbox').fill('zzz')
    await expect(v.getByText('No hay canciones que coincidan con «zzz».')).toBeVisible()
    await v.getByRole('button', { name: 'Borrar búsqueda' }).click()
    await expect(v.getByRole('article')).toHaveCount(20)
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
    await expect(v.getByRole('article')).toHaveCount(20)

    // Volver a borrador (diálogo de confirmación).
    const lista = tarjeta('Canción lista')
    const idLista = (await lista.getAttribute('data-tarjeta'))!
    await lista.getByRole('button', { name: 'Más acciones de «Canción lista»' }).click()
    await v.getByRole('menuitem', { name: 'Volver a borrador' }).click()
    await expect(v.getByRole('dialog', { name: '¿Volver a borrador?' })).toBeVisible()
    await v.getByRole('button', { name: 'Volver a borrador' }).click()
    // Una lista a la que no le falta nada, vuelta a borrador, es «Lista para revisar» (ADR 0025 §1).
    await expect(tarjeta('Canción lista')).toHaveAccessibleName(/Lista para revisar\./)
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
    await expect(v.getByRole('article')).toHaveCount(19)
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
    await expect(v.getByRole('article')).toHaveCount(20)
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

test('«Eliminar…» de varias (0318): previsualiza, exige la versión y mueve cada carpeta a la papelera', async () => {
  const datos = crearDatos('eliminar-varias')
  await sembrar(datos)
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('article')).toHaveCount(20)
    // Tres borradores de la semilla por su título (la interfaz de la barra de selección es de 0320).
    const titulos = ['Borrador sin letra', 'Borrador con letra a medias', 'Borrador recién creado']
    const ids: string[] = []
    for (const t of titulos) {
      const tarjeta = v.getByRole('article', { name: new RegExp(`^${t},`) })
      if (await tarjeta.count()) ids.push((await tarjeta.first().getAttribute('data-tarjeta'))!)
    }
    expect(ids.length).toBeGreaterThanOrEqual(2)
    const prev = await v.evaluate(
      (lista) =>
        (
          globalThis as unknown as {
            shinobi: {
              biblioteca: { eliminarVarias: { previsualizar(ids: string[]): Promise<unknown> } }
            }
          }
        ).shinobi.biblioteca.eliminarVarias.previsualizar(lista),
      ids
    )
    const { version, canciones } = prev as {
      version: string
      canciones: { id: string; aplica: boolean }[]
    }
    expect(canciones.map((c) => c.id)).toEqual(ids)
    expect(canciones.every((c) => c.aplica)).toBe(true)

    // Una versión que no es la de la confirmación no borra nada.
    const obsoleta = await v.evaluate(async (lista) => {
      const api = (
        globalThis as unknown as {
          shinobi: {
            biblioteca: {
              eliminarVarias: { ejecutar(ids: string[], version: string): Promise<unknown> }
            }
          }
        }
      ).shinobi.biblioteca
      return api.eliminarVarias.ejecutar(lista, 'version-vieja').then(
        () => null,
        (e: { codigo: string }) => e.codigo
      )
    }, ids)
    expect(obsoleta).toBe('CONFIRMACION_OBSOLETA')
    for (const id of ids) expect(existsSync(join(datos, 'biblioteca', id))).toBe(true)

    const resultado = (await v.evaluate(
      ([lista, ver]) =>
        (
          globalThis as unknown as {
            shinobi: {
              biblioteca: {
                eliminarVarias: { ejecutar(ids: string[], version: string): Promise<unknown> }
              }
            }
          }
        ).shinobi.biblioteca.eliminarVarias.ejecutar(lista as string[], ver as string),
      [ids, version]
    )) as { resultados: { id: string; resultado: string }[] }
    expect(resultado.resultados.map((r) => r.resultado)).toEqual(ids.map(() => 'hecho'))
    await expect(v.getByRole('article')).toHaveCount(20 - ids.length)
    const papelera = readdirSync(join(datos, 'papelera'))
    for (const id of ids) {
      expect(existsSync(join(datos, 'biblioteca', id))).toBe(false)
      expect(papelera.some((n) => n.startsWith(`${id}-`))).toBe(true)
    }
  } finally {
    await app.close()
  }
})

test('barra de selección (0320): Supr abre «Eliminar…» con 3 canciones y cada carpeta va a la papelera', async () => {
  const datos = crearDatos('eliminar-barra')
  await sembrar(datos)
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('article')).toHaveCount(20)
    const titulos = ['Borrador sin letra', 'Borrador con letra a medias', 'Borrador recién creado']
    const ids: string[] = []
    for (const t of titulos) {
      ids.push(
        (await v
          .getByRole('article', { name: new RegExp(`^${t},`) })
          .first()
          .getAttribute('data-tarjeta'))!
      )
    }
    await v.getByRole('button', { name: 'Seleccionar', exact: true }).click()
    for (const t of titulos)
      await v.getByRole('checkbox', { name: `Seleccionar «${t}»` }).dispatchEvent('click')
    await expect(v.getByText('3 seleccionadas')).toBeVisible()
    // Supr con el foco en la rejilla abre la confirmación, con el foco en «Cancelar».
    await v.getByRole('article', { name: /^Borrador recién creado,/ }).focus()
    await v.keyboard.press('Delete')
    const d = v.getByRole('dialog', { name: '¿Eliminar 3 canciones?' })
    await expect(d.getByRole('button', { name: 'Cancelar' })).toBeFocused()
    await expect(d.getByText(/Se moverán a la papelera de tu sistema/)).toBeVisible()
    await d.getByRole('button', { name: 'Eliminar 3 canciones' }).click()
    await expect(v.getByText('3 canciones se movieron a la papelera.')).toBeVisible()
    await expect(v.getByRole('article')).toHaveCount(17)
    const papelera = readdirSync(join(datos, 'papelera'))
    for (const id of ids) {
      expect(existsSync(join(datos, 'biblioteca', id))).toBe(false)
      expect(papelera.some((n) => n.startsWith(`${id}-`))).toBe(true)
    }
    await expect(v.getByRole('button', { name: 'Seleccionar', exact: true })).toBeFocused()
  } finally {
    await app.close()
  }
})
