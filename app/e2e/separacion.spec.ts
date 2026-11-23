import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'
import {
  avisosRegistrados,
  canciones,
  carpeta,
  cerrar,
  escribirEscenario,
  filaPreparar,
  filaSeparar,
  idDe,
  importar,
  lanzar,
  leerCancion,
  leerConfig,
  preparar,
  procesosWorker,
  tarjeta,
  volverABiblioteca
} from './fixtures/separacion'

/**
 * Separación con el separador falso (0075, ADR 0009 §8): app compilada, worker real de desarrollo,
 * runtime falso con el modelo Calidad ya verificado y `SHINOBI_SEPARADOR_FALSO` (sin PyTorch, sin
 * modelos reales y sin red). Los avisos del sistema van a un registro (`SHINOBI_AVISOS_PRUEBAS`).
 */

const LARGO = { segundos: 15, pasos: 30 }
const CORTO = { segundos: 4, pasos: 8 }
const botonActividad = (v: Page) => v.locator('button[data-actividad]')
const estadoActividad = (v: Page) => v.locator('div[data-actividad]')
const estadoPaso = (datos: string, titulo: string, paso: 'fuente' | 'separacion'): string =>
  leerCancion(datos, idDe(datos, titulo)).pasos[paso].estado

/** Espera a que el paso de la canción llegue a ese estado en `cancion.json`. */
async function esperarPaso(
  datos: string,
  titulo: string,
  estado: string,
  timeout = 60_000
): Promise<void> {
  await expect
    .poll(
      () => {
        try {
          return estadoPaso(datos, titulo, 'separacion')
        } catch {
          return null
        }
      },
      { timeout }
    )
    .toBe(estado)
}

/** Sin búsqueda automática de letra: estas pruebas son de la separación y no deben salir a la red. */
function sinBusquedaAutomatica(datos: string): void {
  const config = leerConfig(datos)
  writeFileSync(
    join(datos, 'config.json'),
    JSON.stringify({ ...config, preparacion: { automatica: false } })
  )
}

test.describe('separación con el separador falso', () => {
  test.describe.configure({ timeout: 60_000 })

  test('flujo feliz: fases, pistas reproducibles y factor medido', async () => {
    const env = preparar('sep-feliz', CORTO)
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      const errores: string[] = []
      v.on('console', (m: ConsoleMessage) => m.type() === 'error' && errores.push(m.text()))
      v.on('pageerror', (e) => errores.push(e.message))

      await importar(v, 'Tema separado')
      await expect(filaPreparar(v)).toContainText('completado', { timeout: 30_000 })
      // Fase `cargando`, luego %, luego ✓ con la duración real.
      await expect(filaSeparar(v)).toContainText('Preparando la separación…', { timeout: 30_000 })
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 30_000 })
      await expect(filaSeparar(v)).toContainText(/\d+ s/)

      // Las dos pistas se cargan y suenan desde `shinobi-media://` sin errores.
      const escucha = v.getByRole('group', { name: 'Escucha el resultado:' })
      await expect(escucha).toBeVisible()
      for (const pista of ['Voz', 'Instrumental']) {
        await escucha.getByRole('button', { name: `Reproducir ${pista}` }).click()
        await expect(escucha.getByRole('button', { name: `Pausar ${pista}` })).toBeVisible()
        await escucha.getByRole('button', { name: `Pausar ${pista}` }).click()
      }
      await expect(escucha.getByRole('alert')).toHaveCount(0)
      expect(errores).toEqual([])

      const [id, ...resto] = canciones(env.datos)
      expect(resto).toEqual([])
      const json = leerCancion(env.datos, id!)
      expect(json.pasos.separacion.estado).toBe('completado')
      expect(json.pistas.voz).toBe('pistas/voz.flac')
      expect(json.pistas.instrumental).toBe('pistas/instrumental.flac')
      // El separador real no se usó: el escenario falso es obligatorio.
      expect(json.pistas.modelo.version).toBe('falso')
      for (const n of ['voz.flac', 'instrumental.flac']) {
        const ruta = join(carpeta(env.datos, id!), 'pistas', n)
        expect(readFileSync(ruta).subarray(0, 4).toString()).toBe('fLaC')
      }
      expect(existsSync(join(carpeta(env.datos, id!), 'pistas.tmp'))).toBe(false)
      expect(leerConfig(env.datos).separacion.factores_medidos.calidad).toBeGreaterThan(0)
    } finally {
      await cerrar(app)
    }
  })

  test('navegar sin interrumpir: progreso en la tarjeta y toast al terminar', async () => {
    const env = preparar('sep-navegar', { segundos: 6, pasos: 12 })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema en segundo plano')
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })
      await volverABiblioteca(v)
      const t = tarjeta(v, 'Tema en segundo plano')
      await expect(t).toContainText(/Separando \d+ %/)
      // Sigue vivo: la tarjeta avanza y al terminar aparece el aviso.
      await esperarPaso(env.datos, 'Tema en segundo plano', 'completado')
      await expect(
        v.getByText('«Tema en segundo plano»: voz e instrumental separadas.')
      ).toBeVisible({ timeout: 15_000 })
      await expect(t).not.toContainText(/Separando/)
    } finally {
      await cerrar(app)
    }
  })

  test('cola: la segunda espera a la primera y empieza cuando termina', async () => {
    const env = preparar('sep-cola', { segundos: 6, pasos: 12 })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Primera')
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })
      await volverABiblioteca(v)
      await importar(v, 'Segunda')
      await expect(filaSeparar(v)).toContainText(
        'En cola: 2.ª de 2. Empezará cuando terminen las anteriores.',
        {
          timeout: 30_000
        }
      )
      await expect(v.getByText(/Tardará/)).toBeVisible()
      expect(estadoPaso(env.datos, 'Primera', 'separacion')).toBe('en_curso')
      // Cuando termina la primera, la segunda empieza sola y acaba.
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 40_000 })
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 40_000 })
      expect(estadoPaso(env.datos, 'Primera', 'separacion')).toBe('completado')
      expect(estadoPaso(env.datos, 'Segunda', 'separacion')).toBe('completado')
    } finally {
      await cerrar(app)
    }
  })

  test('cancelar en curso: pendiente, sin restos, y "Separar ahora" vuelve a separar', async () => {
    const env = preparar('sep-cancelar', LARGO)
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema cancelado')
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })
      await v.getByRole('button', { name: 'Cancelar separación' }).click()
      const dialogo = v.getByRole('dialog')
      await expect(dialogo.getByRole('button', { name: 'Seguir separando' })).toBeFocused()
      await dialogo.getByRole('button', { name: 'Cancelar separación' }).click()

      await expect(v.getByText('La separación está pendiente.')).toBeVisible({ timeout: 30_000 })
      await expect(v.getByRole('button', { name: 'Separar ahora' })).toBeVisible()
      const id = idDe(env.datos, 'Tema cancelado')
      expect(estadoPaso(env.datos, 'Tema cancelado', 'separacion')).toBe('pendiente')
      expect(existsSync(join(carpeta(env.datos, id), 'pistas.tmp'))).toBe(false)

      escribirEscenario(env, CORTO)
      await v.getByRole('button', { name: 'Separar ahora' }).click()
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 40_000 })
      expect(leerCancion(env.datos, id).pistas.voz).toBe('pistas/voz.flac')
    } finally {
      await cerrar(app)
    }
  })

  test('cancelar en cola: se retira sin diálogo', async () => {
    const env = preparar('sep-cancelar-cola', LARGO)
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Primera')
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })
      await volverABiblioteca(v)
      await importar(v, 'Segunda')
      await expect(filaSeparar(v)).toContainText('En cola', { timeout: 30_000 })
      await v.getByRole('button', { name: 'Cancelar separación' }).click()
      await expect(v.getByText('La separación está pendiente.')).toBeVisible({ timeout: 30_000 })
      await expect(v.getByRole('dialog')).toHaveCount(0)
      expect(estadoPaso(env.datos, 'Segunda', 'separacion')).toBe('pendiente')
      expect(estadoPaso(env.datos, 'Primera', 'separacion')).toBe('en_curso')
    } finally {
      await cerrar(app)
    }
  })

  test('panel de actividad: filas, Ir, cancelar y Terminado', async () => {
    // La primera debe seguir separando mientras se importa la segunda (con la CPU ocupada importar tarda): 6 s se
    // quedaba corto y la segunda ya iba «en curso» en vez de «En cola». Se espera por el estado, con más margen.
    const env = preparar('sep-panel', { segundos: 16, pasos: 32 })
    // Solo separación: con la búsqueda automática, la letra (sumidero 503) deja a las canciones en la cola 60 s.
    sinBusquedaAutomatica(env.datos)
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Primera')
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })
      await volverABiblioteca(v)
      await importar(v, 'Segunda')
      await expect(filaSeparar(v)).toContainText('En cola', { timeout: 30_000 })
      await volverABiblioteca(v)

      const boton = botonActividad(v)
      await expect(boton).toHaveText('Preparando 1 de 2')
      await boton.click()
      const panel = v.getByRole('region', { name: 'Actividad' })
      await expect(panel.getByRole('listitem')).toHaveCount(2)
      await expect(panel.getByRole('listitem').first()).toContainText('Primera')
      // Cola de la feature 7: «En cola» es un grupo plegado por defecto (spec 04, panel con cola).
      const grupo = panel.getByRole('button', { name: 'En cola (1)' })
      await expect(grupo).toHaveAttribute('aria-expanded', 'false')
      await grupo.click()
      const segunda = panel.getByRole('listitem').filter({ hasText: 'Segunda' }).last()

      // [Ir] navega a la vista de progreso de la canción.
      await segunda.getByRole('button', { name: 'Ir' }).click()
      await expect(filaSeparar(v)).toContainText(
        'En cola: 2.ª de 2. Empezará cuando terminen las anteriores.'
      )

      // [✕] sobre la que está en cola la retira sin diálogo.
      await boton.click()
      if ((await panel.getByRole('button', { name: 'Cancelar «Segunda»' }).count()) === 0)
        await panel.getByRole('button', { name: 'En cola (1)' }).click()
      await panel.getByRole('button', { name: 'Cancelar «Segunda»' }).click()
      await expect(v.getByRole('dialog')).toHaveCount(0)
      // La cancelada cuenta como terminada en la tanda (spec 04, progreso global): la que sigue es la 2.ª.
      await expect(boton).toHaveText('Preparando 2 de 2')

      // Al terminar todo: "Terminado" y el botón desaparece.
      await expect(estadoActividad(v)).toHaveText('Terminado', { timeout: 40_000 })
      await expect(botonActividad(v)).toHaveCount(0)
      expect(estadoPaso(env.datos, 'Primera', 'separacion')).toBe('completado')
      expect(estadoPaso(env.datos, 'Segunda', 'separacion')).toBe('pendiente')
    } finally {
      await cerrar(app)
    }
  })

  test('cierre con trabajos: diálogo y, tras dos cierres seguidos, Interrumpido y Reintentar sin salir de la Biblioteca', async () => {
    test.setTimeout(120_000)
    const env = preparar('sep-cierre', LARGO)
    sinBusquedaAutomatica(env.datos)
    const app = await lanzar(env)
    const v = await app.firstWindow()
    await importar(v, 'Tema interrumpido')
    await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })

    // Foco en "Seguir trabajando": con él la app no se cierra.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
    const dialogo = v.getByRole('dialog')
    await expect(dialogo.getByRole('button', { name: 'Seguir trabajando' })).toBeFocused()
    await dialogo.getByRole('button', { name: 'Seguir trabajando' }).click()
    await expect(dialogo).toHaveCount(0)
    await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/)
    // "Cerrar de todos modos" cancela los trabajos y cierra.
    const cierre = app.close()
    await dialogo.getByRole('button', { name: 'Cerrar de todos modos' }).click()
    await cierre

    expect(procesosWorker(env.datos)).toEqual([])
    const id = idDe(env.datos, 'Tema interrumpido')
    expect(estadoPaso(env.datos, 'Tema interrumpido', 'separacion')).toBe('interrumpido')
    expect(existsSync(join(carpeta(env.datos, id), 'pistas.tmp'))).toBe(false)

    // Primer cierre: al reabrir se retoma sola (0309). Se vuelve a cerrar a mitad: dos arranques seguidos.
    const retomada = await lanzar(env)
    const vr = await retomada.firstWindow()
    await expect
      .poll(() => estadoPaso(env.datos, 'Tema interrumpido', 'separacion'), { timeout: 30_000 })
      .toBe('en_curso')
    // Se cierra en cuanto arranca, sin esperar a ver el progreso: la solicitud de cierre no se pierde
    // aunque el diálogo aún no esté montado (0236).
    const cierre2 = retomada.close()
    await vr
      .getByRole('dialog')
      .getByRole('button', { name: 'Cerrar de todos modos' })
      .click({ timeout: 10_000 })
    await cierre2
    expect(estadoPaso(env.datos, 'Tema interrumpido', 'separacion')).toBe('interrumpido')

    // Tercer arranque: ya no se retoma; queda «Interrumpido» con [Reintentar].
    escribirEscenario(env, CORTO)
    const app2 = await lanzar(env)
    try {
      const v2 = await app2.firstWindow()
      const t = tarjeta(v2, 'Tema interrumpido')
      await expect(t).toContainText('Interrumpido')
      await v2.getByRole('button', { name: 'Reintentar «Tema interrumpido»' }).click()
      await expect(v2.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await expect(t).not.toContainText('Interrumpido')
      await esperarPaso(env.datos, 'Tema interrumpido', 'completado')
      expect(leerCancion(env.datos, id).pistas.voz).toBe('pistas/voz.flac')
    } finally {
      await cerrar(app2)
    }
    expect(procesosWorker(env.datos)).toEqual([])
  })

  test('cerrar con una separación en curso y otra en cola y reabrir las retoma solas, en orden', async () => {
    const env = preparar('sep-reanuda', LARGO)
    sinBusquedaAutomatica(env.datos)
    const app = await lanzar(env)
    const v = await app.firstWindow()
    await importar(v, 'Tema primero')
    await volverABiblioteca(v)
    await importar(v, 'Tema segundo')
    await volverABiblioteca(v)
    await esperarPaso(env.datos, 'Tema primero', 'en_curso')
    const cierre = app.close()
    await v
      .getByRole('dialog')
      .getByRole('button', { name: 'Cerrar de todos modos' })
      .click({ timeout: 5000 })
      .catch(() => undefined)
    await cierre
    // El diario deja lo pendiente para el siguiente arranque.
    const diario = JSON.parse(
      readFileSync(join(env.datos, 'trabajos', 'pendientes.json'), 'utf8')
    ) as { tipo: string }[]
    expect(diario.filter((e) => e.tipo === 'separacion')).toHaveLength(2)

    escribirEscenario(env, CORTO)
    const app2 = await lanzar(env)
    try {
      await app2.firstWindow()
      await esperarPaso(env.datos, 'Tema primero', 'completado', 90_000)
      await esperarPaso(env.datos, 'Tema segundo', 'completado', 90_000)
    } finally {
      await cerrar(app2)
    }
    expect(procesosWorker(env.datos)).toEqual([])
  })

  test('aviso con la ventana sin foco: notificación o rebote con insignia', async () => {
    const env = preparar('sep-aviso', CORTO)
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema avisado')
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.blur())
      await esperarPaso(env.datos, 'Tema avisado', 'completado')
      if (process.platform === 'darwin') {
        await expect
          .poll(() => avisosRegistrados(env).map((a) => a.tipo))
          .toEqual(expect.arrayContaining(['rebote', 'insignia']))
      } else {
        await expect
          .poll(() => avisosRegistrados(env).find((a) => a.tipo === 'notificacion')?.cuerpo)
          .toBe('«Tema avisado»: voz e instrumental separadas.')
      }
    } finally {
      await cerrar(app)
    }
  })
})
