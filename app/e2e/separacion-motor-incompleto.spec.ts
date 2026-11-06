import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import {
  importar,
  lanzar,
  leerConfig,
  preparar,
  tarjeta,
  volverABiblioteca
} from './fixtures/separacion'

const TITULO = 'Tema del motor incompleto'
const ERROR_MOTOR = 'Hay que reparar el motor de audio'
const escenario = {
  segundos: 0,
  pasos: 1,
  fallos: [{ cuando: {}, codigo: 'RUNTIME_NO_DISPONIBLE', reintentable: false }]
}

async function comprobarB5(v: Page): Promise<void> {
  await expect(v.getByRole('heading', { name: ERROR_MOTOR })).toBeVisible()
  await expect(
    v.getByText(
      'Falta una parte de lo que se descargó la primera vez. Vamos a descargarla de nuevo.'
    )
  ).toBeVisible()
  await expect(v.getByRole('button', { name: 'Reparar', exact: true })).toBeVisible()
}

test('motor incompleto: Ver, B5 a mitad de sesión y al reiniciar, y aviso tras reparar', async () => {
  test.setTimeout(60_000)
  const env = preparar('motor-incompleto', escenario)
  const primera = await lanzar(env)
  try {
    const v = await primera.firstWindow()
    await importar(v, TITULO)
    const reparar = v.getByRole('button', { name: 'Reparar el motor de audio' })
    await expect(reparar).toBeFocused({ timeout: 30_000 })
    await expect(
      v.getByRole('alert').getByRole('button', { name: 'Copiar detalles' })
    ).toBeVisible()
    await expect(v.getByRole('button', { name: 'Reintentar', exact: true })).toHaveCount(0)
    expect(leerConfig(env.datos).instalacion.estado).toBe('dañada')

    await volverABiblioteca(v)
    const tema = tarjeta(v, TITULO)
    await expect(tema).toContainText(ERROR_MOTOR)
    await expect(tema.getByRole('button', { name: /^Reintentar/ })).toHaveCount(0)
    await tema.getByRole('button', { name: `Ver «${TITULO}»` }).click()
    await reparar.click()
    await comprobarB5(v)
    await v.keyboard.press('Escape')
    await comprobarB5(v)
  } finally {
    await primera.close()
  }

  const reiniciada = await lanzar(env)
  try {
    await comprobarB5(await reiniciada.firstWindow())
  } finally {
    await reiniciada.close()
  }

  const config = leerConfig(env.datos)
  config.instalacion.estado = 'completa'
  config.instalacion.fases.componentes = 'completada'
  config.instalacion.reinstalar_componentes = false
  writeFileSync(join(env.datos, 'config.json'), JSON.stringify(config))

  const reparada = await lanzar(env)
  try {
    const v = await reparada.firstWindow()
    await tarjeta(v, TITULO)
      .getByRole('button', { name: `Ver «${TITULO}»` })
      .click()
    await expect(v.getByText('El motor de audio ya está reparado.')).toBeVisible()
    await expect(v.getByRole('button', { name: 'Reintentar', exact: true })).toBeFocused()
  } finally {
    await reparada.close()
  }
})

test('terminar la reparación desde B5 vuelve a la Biblioteca de la misma sesión', async () => {
  const env = preparar('reparar-motor-en-sesion', escenario)
  const app = await lanzar(env)
  try {
    const v = await app.firstWindow()
    await importar(v, TITULO)
    await v.getByRole('button', { name: 'Reparar el motor de audio' }).click()
    await comprobarB5(v)
    await v.getByRole('button', { name: 'Reparar', exact: true }).click()
    await v.getByRole('button', { name: 'Empezar', exact: true }).click()
    await expect(tarjeta(v, TITULO)).toBeVisible()
    expect(leerConfig(env.datos).instalacion).toMatchObject({
      estado: 'completa',
      reinstalar_componentes: false
    })
  } finally {
    await app.close()
  }
})
