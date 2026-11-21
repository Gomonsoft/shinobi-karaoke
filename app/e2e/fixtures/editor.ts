import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sembrar } from '../../src/main/biblioteca/semilla'
import { crearTemporal } from '../temporales'
import { leerCancion, tarjeta } from './separacion'

/** Ayudantes del editor compartidos por `editor.spec.ts` y `editor-layout.spec.ts`. */

/** Id de la semilla de la canción `n`. */
export const idSemilla = (n: number): string =>
  `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`

export async function lanzar(datos: string, dpr?: number): Promise<ElectronApplication> {
  return electron.launch({
    args: dpr ? [`--force-device-scale-factor=${dpr}`, '.'] : ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      SHINOBI_SILENCIAR_AUDIO: '1',
      SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1',
      SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1'
    }
  })
}

/** Siembra, lanza, ejecuta la prueba y cierra siempre. */
export async function conEditor(
  nombre: string,
  prueba: (v: Page, datos: string, app: ElectronApplication) => Promise<void>,
  preparar?: (datos: string) => void,
  dpr?: number
): Promise<void> {
  const datos = crearTemporal(nombre)
  await sembrar(datos)
  preparar?.(datos)
  const app = await lanzar(datos, dpr)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
    await prueba(v, datos, app)
  } finally {
    await app.close().catch(() => undefined)
  }
}

/** Biblioteca → «Continuar» de la canción → editor con el audio cargado. */
export async function abrirEditor(v: Page, titulo: string): Promise<void> {
  // Filtrar sube las tarjetas al principio: un menú abierto en una tarjeta que hay que desplazar se cierra.
  await v.getByRole('searchbox', { name: /^Buscar título/ }).fill(titulo)
  const t = tarjeta(v, titulo)
  await expect(t).toBeVisible()
  const continuar = t.getByRole('button', { name: /^Continuar/ })
  if (await continuar.count()) {
    await continuar.click()
  } else {
    // Lista o separándose: la acción está en el menú de la tarjeta («Editar» / «Continuar»).
    await t.getByRole('button', { name: `Más acciones de «${titulo}»` }).click()
    await v.getByRole('menuitem', { name: /^(Editar|Continuar)$/ }).dispatchEvent('click')
  }
  await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
  await expect(v.getByRole('button', { name: /^Sincronizar al ritmo/ })).toBeEnabled({
    timeout: 20_000
  })
}

/** Reescribe la letra de una canción sembrada con `n` líneas (sin tiempos) antes de lanzar la app. */
export function alargarLetra(datos: string, id: string, n: number): void {
  const cancion = leerCancion(datos, id)
  cancion.letra.lineas = Array.from({ length: n }, (_, i) => ({
    id: `largo-${i}`,
    tipo: 'linea',
    texto: `Línea de prueba número ${i + 1} con un texto algo largo para ocupar dos renglones`,
    inicio_ms: null,
    fin_ms: null,
    palabras: null
  }))
  writeFileSync(join(datos, 'biblioteca', id, 'cancion.json'), JSON.stringify(cancion))
}
