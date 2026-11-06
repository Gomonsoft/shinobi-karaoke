import { readFileSync, unlinkSync } from 'node:fs'
import { _electron as electron, expect, test } from '@playwright/test'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { R } from '../src/renderer/src/vistas/reproductor/textos'
import { crearTemporal } from './temporales'
import { tarjeta } from './fixtures/separacion'

const lista = 'Reproductor: lista'
const incompleta = 'Reproductor: lista incompleta'
const idSemilla = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`

async function iniciar(nombre: string) {
  const datos = crearTemporal(nombre)
  await sembrar(datos)
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      SHINOBI_SILENCIAR_AUDIO: '1',
      SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1',
      SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1'
    }
  })
  const ventana = await app.firstWindow()
  await expect(ventana.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
  return { app, datos, ventana }
}

test.describe('reproductor sin red', () => {
  test.describe.configure({ timeout: 60_000 })

  test('Biblioteca: controles, atajos, búsqueda y foco al salir', async () => {
    const { app, ventana } = await iniciar('reproductor-biblioteca')
    try {
      const buscador = ventana.getByRole('searchbox', { name: 'Buscar título o artista' })
      await buscador.fill('Reproductor: lista')
      const cancion = tarjeta(ventana, lista)
      await cancion.getByRole('button', { name: /^Reproducir/ }).click()

      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(capa).toBeVisible()
      await expect(capa).toHaveAttribute('data-pantalla-completa', 'true')
      await expect(capa.getByText('Primera luz sobre el tejado')).toBeVisible({ timeout: 10_000 })

      await ventana.keyboard.press('Space')
      await expect(capa.getByText(R.pausa, { exact: true }).first()).toBeVisible()
      await ventana.keyboard.press('ArrowRight')
      await expect(capa.getByText('+5 s')).toBeVisible()
      await ventana.keyboard.press('F')
      await expect(capa).toHaveAttribute('data-pantalla-completa', 'false')
      await ventana.keyboard.press('F1')
      await expect(ventana.getByRole('dialog', { name: E.atajos })).toBeVisible()
      await ventana.keyboard.press('Escape')
      await expect(ventana.getByRole('dialog', { name: E.atajos })).toHaveCount(0)
      await ventana.keyboard.press('Escape')
      await expect(capa).toHaveCount(0)
      await expect(buscador).toHaveValue(lista)
      await expect(cancion).toBeFocused()
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: aviso de letra incompleta', async () => {
    const { app, ventana } = await iniciar('reproductor-incompleta')
    try {
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(incompleta)
      await tarjeta(ventana, incompleta)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${incompleta}»` })
      await expect(capa.getByText(R.incompleta(1), { exact: true }).first()).toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: la pantalla final se detiene con actividad y permite volver', async () => {
    const { app, ventana } = await iniciar('reproductor-final')
    try {
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      await tarjeta(ventana, lista)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(capa).toBeVisible()
      await expect(capa.getByText('Primera luz sobre el tejado')).toBeVisible({ timeout: 10_000 })
      await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill('29000')
      await expect(capa.getByRole('button', { name: R.otravez })).toBeVisible({ timeout: 10_000 })
      await expect(capa.getByRole('button', { name: R.volver.biblioteca })).toBeFocused()
      await ventana.keyboard.press('Escape')
      await expect(capa).toHaveCount(0)
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: pista instrumental ausente muestra el error y actualiza la tarjeta', async () => {
    const { app, datos, ventana } = await iniciar('reproductor-pista-ausente')
    try {
      unlinkSync(join(datos, 'biblioteca', idSemilla(20), 'pistas', 'instrumental.flac'))
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      const cancion = tarjeta(ventana, lista)
      await cancion.getByRole('button', { name: /^Reproducir/ }).click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(capa.getByText(R.error.titulo)).toBeVisible()
      await expect(capa.getByText(R.error.pistas)).toBeVisible()
      await capa.getByRole('button', { name: R.volver.biblioteca }).click()
      await expect(capa).toHaveCount(0)
      await expect(cancion).toContainText('Dañada')
      await expect(cancion).toContainText('Faltan las pistas separadas')
    } finally {
      await app.close()
    }
  })

  test('editor: prueba original, desplazamiento, salida y deshacer', async () => {
    const { app, datos, ventana } = await iniciar('reproductor-editor')
    try {
      await ventana
        .getByRole('searchbox', { name: 'Buscar título o artista' })
        .fill('Editor: separación interrumpida')
      const cancion = tarjeta(ventana, 'Editor: separación interrumpida')
      const continuar = cancion.getByRole('button', { name: /^Continuar/ })
      if (await continuar.count()) {
        await continuar.click()
      } else {
        await cancion
          .getByRole('button', { name: `Más acciones de «Editor: separación interrumpida»` })
          .click()
        await ventana.getByRole('menuitem', { name: 'Continuar' }).click()
      }
      await expect(ventana.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
      const probar = ventana.getByRole('button', { name: E.botonProbar })
      await expect(probar).toBeEnabled({ timeout: 20_000 })
      await probar.click()
      const capa = ventana.getByRole('dialog', { name: /Reproductor de/ })
      await expect(capa.getByText(R.original)).toBeVisible()
      await expect(capa.getByRole('slider', { name: R.aria.vozguia })).toHaveCount(0)
      await ventana.keyboard.press('.')
      await ventana.keyboard.press('.')
      await expect(capa.getByText(R.offset(200))).toBeVisible()
      await ventana.keyboard.press('Escape')
      await expect(ventana.getByRole('heading', { level: 1, name: 'Editor' })).toBeVisible()
      await expect(probar).toBeFocused()
      await expect
        .poll(() => {
          const ruta = join(datos, 'biblioteca', idSemilla(18), 'cancion.json')
          return JSON.parse(readFileSync(ruta, 'utf8')).letra.offset_ms as number
        })
        .toBe(200)
      await ventana.keyboard.press('ControlOrMeta+z')
      await expect
        .poll(() => {
          const ruta = join(datos, 'biblioteca', idSemilla(18), 'cancion.json')
          return JSON.parse(readFileSync(ruta, 'utf8')).letra.offset_ms as number
        })
        .toBe(0)
    } finally {
      await app.close()
    }
  })
})
