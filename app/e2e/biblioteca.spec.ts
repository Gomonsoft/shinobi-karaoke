import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

// Escrita sin ejecutar (0310). Parchea dos borradores de la semilla para tener los estados de la
// preparación sin tocar `main/biblioteca/semilla.ts`: el 5 queda en «Elige la letra» y el 6 con todas
// sus líneas con inicio y la letra elegida por la app («Lista para revisar»).
test('la preparación se ve: insignia, línea de paso, bandeja y «Probar»', async () => {
  const datos = crearTemporal('bib-prep')
  await sembrar(datos)
  const ruta = (n: number) =>
    join(
      datos,
      'biblioteca',
      `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      'cancion.json'
    )
  const ahora = new Date().toISOString()
  const c5 = JSON.parse(readFileSync(ruta(5), 'utf8'))
  c5.preparacion = {
    estado: 'elige_letra',
    paso: null,
    origen: 'automatica',
    actualizado: ahora,
    busqueda: { resultado: 'elige', candidatas: 3, motivo: null, ids: [] },
    dudosas: 0,
    revisada: false
  }
  writeFileSync(ruta(5), JSON.stringify(c5, null, 2))
  const c6 = JSON.parse(readFileSync(ruta(6), 'utf8'))
  // Los inicios deben ir en orden creciente: la línea sin inicio va tras la última con inicio.
  let t = Math.max(...c6.letra.lineas.map((l: { inicio_ms: number | null }) => l.inicio_ms ?? 0))
  for (const l of c6.letra.lineas)
    if (l.tipo === 'linea' && l.inicio_ms === null) l.inicio_ms = t += 2000
  c6.preparacion = {
    estado: 'lista_para_revisar',
    paso: null,
    origen: 'automatica',
    actualizado: ahora,
    eleccion: { por: 'app', fecha: ahora, lrclib_id: null },
    dudosas: 0,
    revisada: false
  }
  writeFileSync(ruta(6), JSON.stringify(c6, null, 2))

  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    const tarjeta = (titulo: string) => v.getByRole('article', { name: new RegExp(`^${titulo},`) })
    await expect(tarjeta('Borrador sin letra')).toHaveAccessibleName(
      /Borrador\. Elige la letra · 3 candidatas\./
    )
    const revisar = tarjeta('Borrador con letra a medias')
    await expect(revisar).toHaveAccessibleName(
      /Lista para revisar\. Letra elegida automáticamente\./
    )
    // La semilla ya trae otra «Lista para revisar» (la 15, LRCLIB sincronizada): con la 6, son dos.
    const bandeja = v.getByRole('group', { name: 'Pendientes de ti:' })
    const filtro = bandeja.getByRole('button', { name: '2 listas para revisar' })
    await expect(filtro).toBeVisible()
    await filtro.click()
    await expect(v.getByRole('article')).toHaveCount(2)
    await filtro.click()

    // «Probar» abre el reproductor sin cambiar el estado; al salir, el toast ofrece marcarla.
    await revisar.getByRole('button', { name: /^Probar/ }).click()
    const reproductor = v.getByRole('dialog', { name: /^Reproductor de/ })
    await expect(reproductor).toBeVisible()
    // Esta prueba no simula la pantalla completa: con la CPU ocupada (pasadas completas, varias ventanas a
    // la vez) la primera Esc llega mientras la ventana entra en pantalla completa o antes de que el
    // reproductor atienda el teclado y no cierra nada (fallo de 2026-11-23, 1 de 2 pasadas). Se repite.
    await expect(async () => {
      await v.keyboard.press('Escape')
      await expect(reproductor).toHaveCount(0, { timeout: 2_000 })
    }).toPass({ timeout: 20_000, intervals: [0] })
    await expect(v.getByText('¿Qué tal «Borrador con letra a medias»?')).toBeVisible()
    expect(JSON.parse(readFileSync(ruta(6), 'utf8')).estado).toBe('borrador')
  } finally {
    await app.close()
  }
})

// D1 (pregunta 0241): una «Lista para revisar» sin registro de preparación (la 15 de la semilla, hecha a
// mano) muestra su línea ⚑ o «Sin líneas dudosas», calculada por main en memoria sin escribir nada.
test('una «Lista para revisar» sin registro muestra su recuento y main no escribe en su cancion.json', async () => {
  const datos = crearTemporal('bib-revision-sin-registro')
  await sembrar(datos)
  const ruta = join(
    datos,
    'biblioteca',
    `5eed0000-0000-4000-8000-${String(15).padStart(12, '0')}`,
    'cancion.json'
  )
  const antes = readFileSync(ruta, 'utf8')
  expect(JSON.parse(antes).preparacion).toBeUndefined()
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    const tarjeta = v.getByRole('article', { name: /^Letra de LRCLIB sincronizada,/ })
    await expect(tarjeta).toHaveAccessibleName(/Lista para revisar/)
    await expect(tarjeta.locator('[data-linea-revision]')).toHaveText(
      /(\d+ líneas? por revisar|Sin líneas dudosas)/
    )
    expect(readFileSync(ruta, 'utf8')).toBe(antes)
  } finally {
    await app.close()
  }
})
