import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import { abrirEditor, lanzar } from './fixtures/editor'
import { crearTemporal } from './temporales'

/**
 * Esfuerzo del editor con reparto (0.2.3, I-1 · B2): audio sonando, arrastres entre carriles (incluida la franja
 * «cantante nuevo»), deshacer y rehacer, cambios de «Varias voces» y dobles clics, en una secuencia
 * pseudoaleatoria con semilla fija. Tras cada paso, el árbol de React sigue montado; al final, ni errores de
 * página ni líneas `[ERROR] [renderer]` en `app.log`. Reproduce la pantalla en negro de I-1: con la canción
 * sonando, cambiar el número de zonas dejaba a `PantallaLetra` leyendo un fotograma que no existía.
 */
const TITULO = 'Reparto: dúo con coros'

/** Generador determinista (mulberry32): la misma semilla, la misma secuencia. */
function azar(semilla: number): () => number {
  let a = semilla
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const regiones = (v: Page) => v.locator('#zona-linea-tiempo [data-foco-editor="region"]')
const carril = (v: Page, id: string) => v.locator(`#zona-linea-tiempo [data-carril="${id}"]`)

async function arrastrar(v: Page, indice: number, destino: string): Promise<void> {
  const region = regiones(v).nth(indice)
  const b = await region.boundingBox()
  if (!b) return
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await v.mouse.move(x, y)
  await v.mouse.down()
  await v.mouse.move(x, y + 12, { steps: 2 })
  const objetivo = carril(v, destino)
  if (await objetivo.count()) {
    const d = await objetivo.first().boundingBox()
    if (d) await v.mouse.move(x, d.y + d.height / 2, { steps: 5 })
  }
  await v.mouse.up()
}

test('secuencia aleatoria con la canción sonando: el editor no se desmonta ni registra errores', async () => {
  test.setTimeout(120_000)
  const datos = crearTemporal('editor-esfuerzo')
  await sembrar(datos, { reparto: true })
  const app = await lanzar(datos)
  const errores: string[] = []
  try {
    const v = await app.firstWindow()
    v.on('pageerror', (e) => errores.push(String(e)))
    await abrirEditor(v, TITULO)
    await v.getByRole('button', { name: 'Reproducir', exact: true }).click()
    const pasos: string[] = []
    const rnd = azar(2311)
    const vivo = async (paso: string) => {
      pasos.push(paso)
      const hijos = await v.evaluate(() => document.getElementById('root')!.childElementCount)
      expect(hijos, `#root vacío tras: ${pasos.slice(-6).join(' → ')}`).toBeGreaterThan(0)
      await expect(
        v.getByRole('heading', { name: 'Esta pantalla ha tenido un problema' }),
        `pantalla de error tras: ${pasos.slice(-6).join(' → ')}`
      ).toHaveCount(0)
    }
    const lanes = ['c1', 'c2', 'todos', 'coro', 'nuevo']
    for (let i = 0; i < 40; i++) {
      const eleccion = rnd()
      if (eleccion < 0.35) {
        const n = await regiones(v).count()
        const destino = lanes[Math.floor(rnd() * lanes.length)]!
        await arrastrar(v, Math.floor(rnd() * Math.min(n, 4)), destino)
        await vivo(`arrastrar a ${destino}`)
      } else if (eleccion < 0.5) {
        await v.keyboard.press('Control+z')
        await vivo('deshacer')
      } else if (eleccion < 0.6) {
        await v.keyboard.press('Control+Shift+z')
        await vivo('rehacer')
      } else if (eleccion < 0.8) {
        await v.getByRole('radio', { name: 'Estilo' }).click()
        const nombre = rnd() < 0.5 ? 'Todas en un bloque' : 'Cada una en su zona'
        await v
          .getByRole('radio', { name: nombre })
          .click({ timeout: 3000 })
          .catch(() => undefined)
        await vivo(`zonas: ${nombre}`)
        await v.getByRole('radio', { name: 'Sincronía' }).click()
      } else if (eleccion < 0.9) {
        await regiones(v)
          .nth(Math.floor(rnd() * 3))
          .dblclick()
        await vivo('doble clic en una línea')
      } else {
        const boton = v.getByRole('button', { name: /^(Reproducir|Pausar)$/ }).first()
        await boton.click().catch(() => undefined)
        await vivo('reproducir/pausar')
      }
    }
    expect(errores).toEqual([])
    const log = readFileSync(join(datos, 'registros', 'app.log'), 'utf8')
    expect(log).not.toMatch(/\[ERROR\] \[renderer\]/)
  } finally {
    await app.close().catch(() => undefined)
  }
})
