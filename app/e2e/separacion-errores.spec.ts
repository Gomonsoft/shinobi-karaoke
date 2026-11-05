import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import {
  canciones,
  carpeta,
  cerrar,
  escribirEscenario,
  filaSeparar,
  idDe,
  importar,
  lanzar,
  leerCancion,
  leerConfig,
  llamadasRuntime,
  preparar,
  registrosWorker,
  tarjeta,
  volverABiblioteca,
  type Entorno
} from './fixtures/separacion'

/**
 * Errores de la separación, reintentos, oferta del modelo Rápido, Re-separar y "Volver a Calidad"
 * (0076): mismos dobles que 0075 (separador falso + runtime falso, sin red ni modelos reales).
 */

const CORTO = { segundos: 4, pasos: 8 }
const LARGO = { segundos: 15, pasos: 30 }
const MEMORIA = { codigo: 'MEMORIA_INSUFICIENTE', reintentable: true }
/** Falla siempre por memoria (todos los intentos). */
const MEMORIA_SIEMPRE = { ...CORTO, fallos: [{ cuando: {}, ...MEMORIA }] }

const T_MEMORIA = 'Tu equipo no tiene memoria suficiente para el modelo Calidad.'
const T_MEMORIA_RAPIDO = 'Tu equipo se quedó sin memoria.'
const T_MODELO = 'No hemos podido descargar el modelo de separación.'
const OFERTA = 'Si sigue fallando, hay otra opción: el modelo Rápido, más ligero.'

const estadoPaso = (datos: string, titulo: string): string =>
  leerCancion(datos, idDe(datos, titulo)).pasos.separacion.estado

async function esperarPaso(datos: string, titulo: string, estado: string, timeout = 40_000) {
  await expect
    .poll(
      () => {
        try {
          return estadoPaso(datos, titulo)
        } catch {
          return null
        }
      },
      { timeout }
    )
    .toBe(estado)
}

/** Registra en la página los textos pasajeros que cumplan `patron` (los reintentos duran un instante). */
async function observar(v: Page, patron: string): Promise<void> {
  // Como cadena: el tsconfig de `e2e` no incluye los tipos del DOM.
  await v.evaluate(`(() => {
    window.__vistos = []
    const re = new RegExp(${JSON.stringify(patron)})
    new MutationObserver(() => {
      for (const linea of document.body.innerText.split('\\n')) {
        const t = linea.trim()
        if (re.test(t) && !window.__vistos.includes(t)) window.__vistos.push(t)
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  })()`)
}
const vistos = (v: Page): Promise<string[]> => v.evaluate<string[]>('window.__vistos')

const ofertaRapido = (v: Page) => v.getByRole('button', { name: 'Usar el modelo Rápido…' })
const reintentar = (v: Page) => v.getByRole('button', { name: 'Reintentar', exact: true })

/** Ningún `separar` con el modelo Rápido sin consentimiento (ni en el registro, ni en la descarga). */
function sinRapido(e: Entorno): void {
  expect(registrosWorker(e.datos)).not.toMatch(/rapido/i)
  expect(llamadasRuntime(e).filter((l) => l.t === 'descarga' && l.modelo === 'rapido')).toEqual([])
  expect(leerConfig(e.datos).separacion.rapido_aceptado).toBeNull()
  for (const id of canciones(e.datos)) {
    expect(leerCancion(e.datos, id).pistas?.modelo?.nombre ?? '').not.toMatch(/Inst_HQ_4/)
  }
}

test.describe('errores de separación y modelo Rápido', () => {
  test.describe.configure({ timeout: 60_000 })

  test('memoria: reintento con bloques pequeños con éxito, sin banner de error', async () => {
    const env = preparar('err-mem-ok', {
      ...CORTO,
      fallos: [{ cuando: { bloques: 'normal' }, ...MEMORIA }]
    })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await observar(v, 'Reintentando')
      await importar(v, 'Tema memoria')
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 40_000 })
      expect(await vistos(v)).toContain('Reintentando por partes más pequeñas…')
      await expect(v.getByText(T_MEMORIA)).toHaveCount(0)
      await expect(v.getByRole('alert')).toHaveCount(0)
      expect(leerCancion(env.datos, idDe(env.datos, 'Tema memoria')).pistas.voz).toBe(
        'pistas/voz.flac'
      )
      sinRapido(env)
    } finally {
      await cerrar(app)
    }
  })

  test('memoria: la tarjeta de la Biblioteca dice "Reintentando la separación…"', async () => {
    const env = preparar('err-mem-tarjeta', { segundos: 6, pasos: 12 })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await observar(v, 'Reintentando la separación')
      await importar(v, 'Primera')
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })
      await volverABiblioteca(v)
      // La segunda espera en cola y lee el escenario con fallo cuando le toca.
      await importar(v, 'Segunda')
      await expect(filaSeparar(v)).toContainText('En cola', { timeout: 30_000 })
      escribirEscenario(env, { ...CORTO, fallos: [{ cuando: { bloques: 'normal' }, ...MEMORIA }] })
      await volverABiblioteca(v)
      await esperarPaso(env.datos, 'Segunda', 'completado', 50_000)
      expect(await vistos(v)).toContain('Reintentando la separación…')
      await expect(tarjeta(v, 'Segunda')).not.toContainText('Error')
      sinRapido(env)
    } finally {
      await cerrar(app)
    }
  })

  test('muerte del proceso (SIGKILL): se trata como memoria y se reintenta', async () => {
    test.skip(process.platform === 'win32', 'SIGKILL solo existe en POSIX')
    const env = preparar('err-sigkill', { segundos: 6, pasos: 12, morir_con_sigkill: true })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await observar(v, 'Reintentando')
      await importar(v, 'Tema muerto')
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })
      // El intento 1 ya cargó el escenario y morirá a la mitad; el 2 lo lee ya sin la muerte.
      escribirEscenario(env, CORTO)
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 40_000 })
      expect(await vistos(v)).toContain('Reintentando por partes más pequeñas…')
      await expect(v.getByRole('alert')).toHaveCount(0)
      sinRapido(env)
    } finally {
      await cerrar(app)
    }
  })

  test('memoria definitiva: oferta, Cancelar no cambia nada, aceptar descarga Rápido y separa', async () => {
    const env = preparar('err-mem-oferta', MEMORIA_SIEMPRE)
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema sin memoria')
      await expect(v.getByText(T_MEMORIA)).toBeVisible({ timeout: 40_000 })
      await expect(v.getByText(OFERTA)).toBeVisible()
      await expect(reintentar(v)).toBeFocused()
      await expect(ofertaRapido(v)).toBeVisible()

      // Cancelar el diálogo: nada guardado ni descargado.
      await ofertaRapido(v).click()
      const dialogo = v.getByRole('dialog', { name: '¿Usar el modelo Rápido?' })
      await expect(dialogo).toBeVisible()
      await dialogo.getByRole('button', { name: 'Cancelar' }).click()
      await expect(dialogo).toHaveCount(0)
      sinRapido(env)
      expect(leerConfig(env.datos).separacion.modo).toBe('calidad')

      // Aceptar: descarga de Rápido y separación con Rápido.
      escribirEscenario(env, CORTO)
      await observar(v, 'Descargando el modelo Rápido')
      await ofertaRapido(v).click()
      await v.getByRole('button', { name: 'Usar el modelo Rápido', exact: true }).click()
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 40_000 })
      expect((await vistos(v)).some((t) => t.startsWith('Descargando el modelo Rápido'))).toBe(true)
      const modo = v.getByText('Modelo Rápido', { exact: false }).first()
      await expect(modo).toBeVisible()
      await v.getByRole('button', { name: 'Información sobre el modelo' }).click()
      await expect(v.getByText(/Estás usando el modelo Rápido, que aceptaste usar/)).toBeVisible()
      const cfg = leerConfig(env.datos)
      expect(cfg.separacion.rapido_aceptado).not.toBeNull()
      expect(cfg.separacion.modo).toBe('rapido')
      const pistas = leerCancion(env.datos, idDe(env.datos, 'Tema sin memoria')).pistas
      expect(pistas.modelo.nombre).toMatch(/Inst_HQ_4/)
      expect(llamadasRuntime(env).filter((l) => l.modelo === 'rapido')).toHaveLength(1)
    } finally {
      await cerrar(app)
    }
  })

  test('con Rápido ya en uso y memoria definitiva: texto propio y sin oferta', async () => {
    const env = preparar('err-mem-rapido', MEMORIA_SIEMPRE, { rapido: true })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema rapido')
      await expect(v.getByText(T_MEMORIA_RAPIDO)).toBeVisible({ timeout: 40_000 })
      await expect(reintentar(v)).toBeVisible()
      await expect(v.getByText(OFERTA)).toHaveCount(0)
      await expect(ofertaRapido(v)).toHaveCount(0)
    } finally {
      await cerrar(app)
    }
  })

  test('falla la descarga de Rápido: error sin oferta y Reintentar descarga sin diálogo', async () => {
    const env = preparar('err-desc-rapido', MEMORIA_SIEMPRE, {
      runtime: { fallo: { fase: 'modelo', modelo: 'rapido', codigo: 'SIN_CONEXION', veces: 1 } }
    })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema descarga')
      await expect(v.getByText(T_MEMORIA)).toBeVisible({ timeout: 40_000 })
      await ofertaRapido(v).click()
      await v.getByRole('button', { name: 'Usar el modelo Rápido', exact: true }).click()
      // Error de la descarga, sin oferta; el consentimiento consta pero el modo no cambia.
      await expect(v.getByText('Sin conexión a internet.')).toBeVisible({ timeout: 30_000 })
      await expect(ofertaRapido(v)).toHaveCount(0)
      await expect(v.getByText(OFERTA)).toHaveCount(0)
      expect(leerConfig(env.datos).separacion.rapido_aceptado).not.toBeNull()
      expect(leerConfig(env.datos).separacion.modo).toBe('calidad')

      // Reintentar: vuelve a descargar Rápido sin diálogo y separa con él.
      escribirEscenario(env, CORTO)
      await reintentar(v).click()
      await expect(v.getByRole('dialog')).toHaveCount(0)
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 40_000 })
      expect(leerConfig(env.datos).separacion.modo).toBe('rapido')
      expect(llamadasRuntime(env).filter((l) => l.modelo === 'rapido')).toHaveLength(2)
      expect(leerCancion(env.datos, idDe(env.datos, 'Tema descarga')).pistas.modelo.nombre).toMatch(
        /Inst_HQ_4/
      )
    } finally {
      await cerrar(app)
    }
  })

  test('modelo que falta: se descarga dentro del trabajo (subpaso y tarjeta) y se separa', async () => {
    const env = preparar('err-modelo-falta', CORTO, {
      sinCalidad: true,
      runtime: {
        fases: {
          motor: { ms: 0 },
          componentes: { ms: 0 },
          diagnostico: { ms: 0 },
          modelo: { ms: 3000 }
        }
      }
    })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await observar(v, 'Descargando el modelo')
      await importar(v, 'Tema sin modelo')
      await expect(filaSeparar(v)).toContainText(/Descargando el modelo Calidad… \d+ %/, {
        timeout: 30_000
      })
      await volverABiblioteca(v)
      await expect(tarjeta(v, 'Tema sin modelo')).toContainText(/Descargando el modelo \d+ %/, {
        timeout: 20_000
      })
      await esperarPaso(env.datos, 'Tema sin modelo', 'completado', 50_000)
      expect(llamadasRuntime(env).filter((l) => l.modelo === 'calidad')).toHaveLength(1)
      sinRapido(env)
    } finally {
      await cerrar(app)
    }
  })

  test('modelo que falta y SIN_CONEXION: error con Reintentar y sin oferta', async () => {
    const env = preparar('err-modelo-red', CORTO, {
      sinCalidad: true,
      runtime: {
        fallo: { fase: 'modelo', modelo: 'calidad', codigo: 'SIN_CONEXION', veces: 'siempre' }
      }
    })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema sin red')
      await expect(v.getByText(T_MODELO)).toBeVisible({ timeout: 40_000 })
      await expect(reintentar(v)).toBeVisible()
      await expect(ofertaRapido(v)).toHaveCount(0)
      await expect(v.getByText(OFERTA)).toHaveCount(0)
      sinRapido(env)
    } finally {
      await cerrar(app)
    }
  })

  test('modelo que falta y VERIFICACION_FALLIDA: el error sí ofrece Rápido', async () => {
    const env = preparar('err-modelo-verif', CORTO, {
      sinCalidad: true,
      runtime: {
        fallo: {
          fase: 'modelo',
          modelo: 'calidad',
          codigo: 'VERIFICACION_FALLIDA',
          veces: 'siempre'
        }
      }
    })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema corrupto')
      await expect(v.getByText(T_MODELO)).toBeVisible({ timeout: 40_000 })
      await expect(v.getByText(OFERTA)).toBeVisible()
      await expect(ofertaRapido(v)).toBeVisible()
      sinRapido(env)
    } finally {
      await cerrar(app)
    }
  })
})

const menu = async (v: Page, titulo: string) => {
  await tarjeta(v, titulo)
    .getByRole('button', { name: `Más acciones de «${titulo}»` })
    .click()
  return v.getByRole('menu')
}

test.describe('Biblioteca: Re-separar y cancelar trabajo', () => {
  test.describe.configure({ timeout: 60_000 })

  test('Re-separar pistas: dañada por falta de pistas, se separa y queda bien', async () => {
    const env = preparar('err-resep', CORTO)
    const app = await lanzar(env)
    const v = await app.firstWindow()
    await importar(v, 'Tema dañado')
    await expect(filaSeparar(v)).toContainText('completado', { timeout: 40_000 })
    await volverABiblioteca(v)
    // Una canción sana no ofrece Re-separar.
    await menu(v, 'Tema dañado')
    await expect(v.getByRole('menuitem', { name: 'Re-separar pistas' })).toHaveCount(0)
    await v.keyboard.press('Escape')
    await cerrar(app)

    // El escaneo de la biblioteca ocurre al arrancar: borrar una pista y volver a abrir.
    const id = idDe(env.datos, 'Tema dañado')
    rmSync(join(carpeta(env.datos, id), 'pistas', 'voz.flac'))
    const app2 = await lanzar(env)
    try {
      const v2 = await app2.firstWindow()
      await expect(tarjeta(v2, 'Tema dañado')).toContainText('Dañada')
      await expect(tarjeta(v2, 'Tema dañado')).toContainText('Faltan las pistas separadas')
      await menu(v2, 'Tema dañado')
      await v2.getByRole('menuitem', { name: 'Re-separar pistas' }).click()
      // El paso seguía `completado` en el disco: se espera a que reaparezca la pista.
      await expect
        .poll(() => existsSync(join(carpeta(env.datos, id), 'pistas', 'voz.flac')), {
          timeout: 40_000
        })
        .toBe(true)
      await esperarPaso(env.datos, 'Tema dañado', 'completado')
      await expect(tarjeta(v2, 'Tema dañado')).not.toContainText('Dañada', { timeout: 15_000 })
    } finally {
      await cerrar(app2)
    }
    // Reabierta, la canción ya no está dañada.
    const app3 = await lanzar(env)
    try {
      const v3 = await app3.firstWindow()
      await expect(tarjeta(v3, 'Tema dañado')).toBeVisible()
      await expect(tarjeta(v3, 'Tema dañado')).not.toContainText('Dañada')
    } finally {
      await cerrar(app3)
    }
  })

  test('con una canción separada con Rápido el menú no ofrece Re-separar', async () => {
    const env = preparar('err-resep-rapido', CORTO, { rapido: true })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema rapido')
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 40_000 })
      expect(leerCancion(env.datos, idDe(env.datos, 'Tema rapido')).pistas.modelo.nombre).toMatch(
        /Inst_HQ_4/
      )
      await volverABiblioteca(v)
      const m = await menu(v, 'Tema rapido')
      await expect(m.getByRole('menuitem', { name: 'Mostrar en la carpeta' })).toBeVisible()
      await expect(m.getByRole('menuitem', { name: 'Re-separar pistas' })).toHaveCount(0)
    } finally {
      await cerrar(app)
    }
  })

  test('Cancelar trabajo desde el menú ⋯ con la separación en curso', async () => {
    const env = preparar('err-cancelar-menu', LARGO)
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await importar(v, 'Tema a cancelar')
      await expect(filaSeparar(v)).toContainText(/Separando… \d+ %/, { timeout: 30_000 })
      await volverABiblioteca(v)
      const m = await menu(v, 'Tema a cancelar')
      await m.getByRole('menuitem', { name: 'Cancelar trabajo' }).click()
      const dialogo = v.getByRole('dialog')
      await expect(dialogo.getByRole('button', { name: 'Seguir separando' })).toBeVisible()
      await dialogo.getByRole('button', { name: 'Cancelar separación' }).click()
      await esperarPaso(env.datos, 'Tema a cancelar', 'pendiente')
      await expect(dialogo).toHaveCount(0)
    } finally {
      await cerrar(app)
    }
  })
})

test.describe('Ajustes: Volver a Calidad', () => {
  test.describe.configure({ timeout: 60_000 })
  const lento = {
    fases: {
      motor: { ms: 0 },
      componentes: { ms: 0 },
      diagnostico: { ms: 0 },
      modelo: { ms: 6000 }
    }
  }

  const irAAjustes = async (v: Page) => {
    await v.getByRole('button', { name: 'Ajustes' }).click()
    await expect(v.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
  }

  test('descarga lenta con reenganche, toast y la siguiente separación usa Calidad', async () => {
    const env = preparar('err-volver', CORTO, { rapido: true, runtime: lento })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await irAAjustes(v)
      await expect(v.getByText('Modelo en uso: Rápido')).toBeVisible()
      await v.getByRole('button', { name: 'Volver a Calidad…' }).click()
      const dialogo = v.getByRole('dialog', { name: '¿Volver al modelo Calidad?' })
      await dialogo.getByRole('button', { name: 'Volver a Calidad', exact: true }).click()
      await expect(v.getByText(/Descargando el modelo Calidad… \d+ %/)).toBeVisible({
        timeout: 15_000
      })
      await expect(v.getByText('Mientras tanto se sigue usando el modelo Rápido.')).toBeVisible()

      // Reenganche: salir a la Biblioteca y volver; la barra sigue.
      await v.getByRole('button', { name: '‹ Biblioteca' }).click()
      await expect(v.getByRole('button', { name: 'Añadir canción' }).first()).toBeVisible()
      await irAAjustes(v)
      await expect(v.getByText(/Descargando el modelo Calidad… \d+ %/)).toBeVisible()

      await expect(v.getByText('Ya usas el modelo Calidad.')).toBeVisible({ timeout: 30_000 })
      await expect(v.getByText('Modelo en uso: Calidad')).toBeVisible()
      expect(leerConfig(env.datos).separacion.modo).toBe('calidad')

      await v.getByRole('button', { name: '‹ Biblioteca' }).click()
      await importar(v, 'Tema en Calidad')
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 40_000 })
      expect(
        leerCancion(env.datos, idDe(env.datos, 'Tema en Calidad')).pistas.modelo.nombre
      ).not.toMatch(/Inst_HQ_4/)
      await expect(v.getByText('Modelo Calidad', { exact: false }).first()).toBeVisible()
    } finally {
      await cerrar(app)
    }
  })

  test('con la descarga fallando: error y Rápido sigue en uso', async () => {
    const env = preparar('err-volver-fallo', CORTO, {
      rapido: true,
      runtime: {
        fallo: { fase: 'modelo', modelo: 'calidad', codigo: 'SIN_CONEXION', veces: 'siempre' }
      }
    })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await irAAjustes(v)
      await v.getByRole('button', { name: 'Volver a Calidad…' }).click()
      await v
        .getByRole('dialog', { name: '¿Volver al modelo Calidad?' })
        .getByRole('button', { name: 'Volver a Calidad', exact: true })
        .click()
      await expect(v.getByText('Sigues usando el modelo Rápido.')).toBeVisible({ timeout: 20_000 })
      await expect(v.getByRole('button', { name: 'Reintentar' })).toBeVisible()
      await expect(v.getByText('Modelo en uso: Rápido')).toBeVisible()
      expect(leerConfig(env.datos).separacion.modo).toBe('rapido')
    } finally {
      await cerrar(app)
    }
  })
})
