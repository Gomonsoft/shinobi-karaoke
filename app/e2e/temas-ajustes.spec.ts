import type { ApiShinobi } from '../src/shared/ipc'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { AJ_TEMAS, TEMA } from '../src/renderer/src/temas/textos'
import { AJT } from '../src/renderer/src/vistas/ajustes/textos'
import { abrirEditor } from './fixtures/editor'
import { leerCancion } from './fixtures/separacion'
import {
  botonesDentroDelDialogo,
  catalogoDeSemilla,
  clonarCancion,
  conTemas,
  envenenarEscritura,
  idTemas,
  leerCatalogo,
  modificarCancion,
  rutaCancion,
  rutaCatalogo,
  reabrir,
  repararEscritura,
  TEMA_NEON,
  TEMA_NOCHE_NINJA,
  TEMA_SOL
} from './fixtures/temas'

/**
 * Sección «Temas» de Ajustes (tarea 0175; criterios A1–A15) en Electron real, sin red, con la semilla
 * de temas de 0168.
 */

const irATemas = async (v: Page): Promise<Locator> => {
  await v.getByRole('button', { name: 'Ajustes', exact: true }).click()
  const seccion = v.getByRole('group', { name: AJT.titulo })
  await expect(seccion).toBeVisible()
  return seccion
}
const selectorPredet = (seccion: Locator, tema: string) =>
  seccion.getByRole('button', { name: `${AJT.selector}: ${tema}` })
const nombres = (datos: string): string[] =>
  leerCatalogo(datos).temas.map((t: { nombre: string }) => t.nombre)

/** Estilo resuelto de cada canción tal como lo recibe la Biblioteca (portada y vista previa). */
const estilos = (v: Page): Promise<Record<string, unknown>> =>
  v.evaluate(async () => {
    const lista = await (window as unknown as { shinobi: ApiShinobi }).shinobi.biblioteca.listar()
    return Object.fromEntries(lista.map((c) => [c.id, c.estilo]))
  })

/** Deja solo cuatro canciones que usan el predeterminado: 33, 37, 40 y 41 (orden por título). */
const cuatroConPredeterminado = (datos: string): void =>
  modificarCancion(datos, idTemas(34), (c) => {
    delete c.apariencia
  })

test.describe('Ajustes › Temas: predeterminado', () => {
  test.describe.configure({ timeout: 90_000 })

  test('cambiar el predeterminado con el impacto exacto; no toca las canciones que lo conservan (A1, C1)', async () => {
    await conTemas('aj-predet', async (v, datos) => {
      const seccion = await irATemas(v)
      await expect(selectorPredet(seccion, 'Noche ninja')).toBeVisible()
      await selectorPredet(seccion, 'Noche ninja').click()
      await v.getByRole('option', { name: /^Sol/ }).click()
      const d = v.getByRole('dialog', { name: AJ_TEMAS.predet.titulo('Sol') })
      // Usan «Noche ninja»: Dancing Queen, Doble uno, Doble dos, YouTube y «Sin artista ni álbum».
      await expect(d.getByText(AJ_TEMAS.predet.cuerpo(5, 'Noche ninja'))).toBeVisible()
      await expect(d.getByText(AJ_TEMAS.predet.nota)).toBeVisible()
      const antes38 = readFileSync(rutaCancion(datos, idTemas(38)), 'utf8')
      const antes39 = readFileSync(rutaCancion(datos, idTemas(39)), 'utf8')
      await d.getByRole('button', { name: AJ_TEMAS.predet.boton('Sol') }).click()
      await expect(d).toHaveCount(0)
      await expect(
        v.getByTestId('toast').getByText(AJT.toastPredet('Sol'), { exact: true })
      ).toBeVisible()
      await expect(selectorPredet(seccion, 'Sol')).toBeFocused()
      expect(leerCatalogo(datos).predeterminado).toBe(TEMA_SOL)
      // Las de «predeterminado anterior» y «asignadas» no se reescriben.
      expect(readFileSync(rutaCancion(datos, idTemas(38)), 'utf8')).toBe(antes38)
      expect(readFileSync(rutaCancion(datos, idTemas(39)), 'utf8')).toBe(antes39)
    })
  })

  test('quitar el predeterminado no cambia ningún aspecto y mantiene el vínculo vivo (B1, A13)', async () => {
    await conTemas('aj-quitar', async (v, datos) => {
      const antes = await estilos(v)
      const seccion = await irATemas(v)
      await selectorPredet(seccion, 'Noche ninja').click()
      await v.getByRole('option', { name: AJ_TEMAS.ninguno }).click()
      const d = v.getByRole('dialog', { name: AJ_TEMAS.quitar.titulo })
      await expect(d.getByText(AJ_TEMAS.quitar.cuerpo(5, 'Noche ninja'))).toBeVisible()
      await expect(d.getByText(AJ_TEMAS.quitar.nota)).toBeVisible()
      await d.getByRole('button', { name: AJ_TEMAS.quitar.boton }).click()
      await expect(d).toHaveCount(0)
      await expect(v.getByTestId('toast').getByText(AJT.toastPredet(null))).toBeVisible()
      await expect(
        seccion.getByRole('button', { name: `${AJT.selector}: ${AJ_TEMAS.ninguno}` })
      ).toBeVisible()
      expect(leerCatalogo(datos).predeterminado).toBeNull()
      // Ningún aspecto cambió (misma portada y misma vista previa).
      expect(await estilos(v)).toEqual(antes)
      // Las canciones conservan «Noche ninja» como predeterminado anterior, con el vínculo vivo.
      expect(leerCancion(datos, idTemas(33)).apariencia.base).toMatchObject({
        tipo: 'predeterminado_anterior',
        tema_id: TEMA_NOCHE_NINJA
      })
      await v
        .getByRole('button', { name: /Biblioteca/ })
        .first()
        .click()
      await expect(v.getByRole('article', { name: /^Dancing Queen,/ })).toHaveAccessibleName(
        /Noche ninja · predeterminado anterior/
      )

      // En el editor: procedencia «Tema predeterminado anterior»; editar ese tema cambia las demás.
      await abrirEditor(v, 'Dancing Queen')
      await v.getByRole('radio', { name: 'Estilo' }).click()
      await expect(v.getByText(AJ_TEMAS.origenAnterior, { exact: true })).toBeVisible()
      await v.getByRole('button', { name: 'Editar tema' }).click()
      await v.getByRole('textbox', { name: 'Color de la letra', exact: true }).fill('#00FF00')
      await v.getByRole('button', { name: 'Guardar en el tema…' }).click()
      await v
        .getByRole('dialog')
        .getByRole('button', { name: TEMA.guardar.guardarEn('Noche ninja') })
        .click()
      await expect(
        v.getByTestId('toast').getByText(TEMA.toastGuardado('Noche ninja'))
      ).toBeVisible()
      await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
      const despues = (await estilos(v)) as Record<string, { letra: { color: string } }>
      expect(despues[idTemas(40)]!.letra.color.toUpperCase()).toBe('#00FF00')
    })
  })

  test('fallo a mitad al quitar el predeterminado: lista, nota, foco y ningún cambio de aspecto (A15)', async () => {
    await conTemas(
      'aj-quitar-parcial',
      async (v, datos) => {
        const antes = await estilos(v)
        const seccion = await irATemas(v)
        await selectorPredet(seccion, 'Noche ninja').click()
        await v.getByRole('option', { name: AJ_TEMAS.ninguno }).click()
        const d = v.getByRole('dialog', { name: AJ_TEMAS.quitar.titulo })
        await d.getByRole('button', { name: AJ_TEMAS.quitar.boton }).click()
        // Orden por título: Dancing Queen, Doble dos (falla), Doble uno, Temas: YouTube.
        await expect(d.getByRole('alert')).toHaveText(
          AJ_TEMAS.quitar.parcial('Doble dos', 3, 'Noche ninja')
        )
        await expect(d.getByRole('listitem')).toHaveCount(3)
        await expect(d.getByRole('listitem', { name: /, no se pudo guardar$/ })).toHaveCount(1)
        await expect(d.getByRole('listitem', { name: /, pendiente$/ })).toHaveCount(2)
        await expect(d.getByRole('button', { name: TEMA.copiarDetalles })).toHaveCount(1)
        await expect(d.getByText(TEMA.parcial.notaPendientes)).toBeVisible()
        await expect(d.getByRole('button', { name: TEMA.reintentar })).toBeFocused()
        expect(await botonesDentroDelDialogo(d)).toBeGreaterThanOrEqual(3)
        expect(leerCatalogo(datos).predeterminado).toBe(TEMA_NOCHE_NINJA)
        expect(await estilos(v)).toEqual(antes)

        // Reintentar con el disco reparado guarda las tres que faltan.
        await repararEscritura(rutaCancion(datos, idTemas(41)))
        await d.getByRole('button', { name: TEMA.reintentar }).click()
        // Reintentar vuelve a previsualizar: solo faltan 3, y se confirma otra vez.
        await expect(d.getByText(AJ_TEMAS.quitar.cuerpo(3, 'Noche ninja'))).toBeVisible()
        await d.getByRole('button', { name: AJ_TEMAS.quitar.boton }).click()
        await expect(d).toHaveCount(0)
        expect(leerCatalogo(datos).predeterminado).toBeNull()
        expect(await estilos(v)).toEqual(antes)
      },
      {
        preparar: (datos) => {
          cuatroConPredeterminado(datos)
          envenenarEscritura(rutaCancion(datos, idTemas(41)))
        }
      }
    )
  })

  test('volver a heredar una canción con base «predeterminado anterior» dice a qué tema vuelve (T2b)', async () => {
    await conTemas('aj-t2b', async (v, datos) => {
      await abrirEditor(v, 'Neón con base anterior')
      await v.getByRole('radio', { name: 'Estilo' }).click()
      await expect(v.getByText('Usará «Sol», el tema predeterminado anterior.')).toBeVisible()
      await v.getByRole('button', { name: 'Volver a heredar' }).click()
      await expect(v.getByRole('button', { name: 'Tema: Sol' })).toBeVisible()
      await expect(v.getByText(AJ_TEMAS.origenAnterior, { exact: true })).toBeVisible()
      await expect.poll(() => leerCancion(datos, idTemas(39)).apariencia.modo).toBe('heredar')
    })
  })

  test('eliminar el tema predeterminado desde la lista (A4)', async () => {
    await conTemas('aj-borrar-predet', async (v, datos) => {
      const seccion = await irATemas(v)
      const fila = seccion.getByRole('listitem', { name: /^Noche ninja, predeterminado/ })
      await fila.getByRole('button', { name: AJT.menu.etiqueta('Noche ninja') }).click()
      await v.getByRole('menuitem', { name: AJT.menu.eliminar }).click()
      const d = v.getByRole('dialog', { name: TEMA.eliminar.titulo('Noche ninja') })
      await expect(d.getByText(TEMA.eliminar.predeterminado)).toBeVisible()
      await d.getByRole('button', { name: TEMA.eliminar.boton }).click()
      await expect(d).toHaveCount(0)
      await expect(seccion.getByText(AJT.anuncioPredetBorrado)).toBeAttached()
      expect(nombres(datos)).not.toContain('Noche ninja')
      expect(leerCatalogo(datos).predeterminado).toBeNull()
    })
  })
})

/** Mata el proceso (sin `before-quit`) y espera a que termine, para que el siguiente arranque no choque. */
async function matar(app: ElectronApplication): Promise<void> {
  const proceso = app.process()
  const salida = new Promise<void>((r) => proceso.once('exit', () => r()))
  // En Windows `kill` solo mata el proceso principal: los hijos de Chromium retienen la caché.
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    proceso.kill('SIGKILL')
  }
  await salida
}

const ID_ZETA = [idTemas(60), idTemas(61)] as const
const neonConCinco = (datos: string): void => {
  const asignada = { modo: 'tema', tema_id: TEMA_NEON, tema_nombre: 'Neón' }
  clonarCancion(datos, idTemas(33), ID_ZETA[0], {
    titulo: 'Zeta uno',
    artista: 'Zeta',
    apariencia: asignada
  })
  clonarCancion(datos, idTemas(33), ID_ZETA[1], {
    titulo: 'Zeta dos',
    artista: 'Zeta',
    apariencia: asignada
  })
}

test.describe('Ajustes › Temas: borrado pendiente, avisos y solo lectura', () => {
  test.describe.configure({ timeout: 120_000 })

  test('borrado a medias tras matar el proceso: terminar de eliminar, con un fallo nuevo y con éxito (A9)', async () => {
    await conTemas(
      'aj-pendiente',
      async (v, datos, app) => {
        // Eliminar «Neón» desde el editor de «Zeta uno»; falla la 3.ª de 5.
        await abrirEditor(v, 'Zeta uno')
        await v.getByRole('radio', { name: 'Estilo' }).click()
        const mas = v.getByRole('button', { name: 'Más acciones del tema' })
        await mas.scrollIntoViewIfNeeded()
        await v.waitForTimeout(400)
        await mas.click()
        await v.getByRole('menuitem', { name: 'Eliminar tema…' }).click()
        const d = v.getByRole('dialog', { name: TEMA.eliminar.titulo('Neón') })
        await d.getByRole('button', { name: TEMA.eliminar.boton }).click()
        await expect(d.getByRole('button', { name: TEMA.reintentar })).toBeVisible()
        // Se mata el proceso a mitad: el catálogo queda con el borrado pendiente.
        await matar(app)
        await expect.poll(() => leerCatalogo(datos).borrado_pendiente).not.toBeNull()

        const { app: app2, v: v2 } = await reabrir(datos)
        try {
          const seccion = await irATemas(v2)
          await expect(seccion.getByText(AJT.pendiente(3, 5))).toBeVisible()
          // Terminar con el disco aún roto: lista de ese intento, con el foco en [Reintentar].
          await seccion.getByRole('button', { name: AJT.terminar }).click()
          const d2 = v2.getByRole('dialog', { name: TEMA.eliminar.titulo('Neón') })
          await expect(d2.getByRole('alert')).toContainText('We Will Rock You')
          await expect(d2.getByRole('button', { name: TEMA.reintentar })).toBeFocused()
          await repararEscritura(rutaCancion(datos, idTemas(32)))
          await d2.getByRole('button', { name: TEMA.reintentar }).click()
          await expect(d2).toHaveCount(0)
          expect(nombres(datos)).not.toContain('Neón')
          expect(leerCatalogo(datos).borrado_pendiente).toBeNull()
        } finally {
          await app2.close().catch(() => undefined)
        }
      },
      {
        preparar: (datos) => {
          neonConCinco(datos)
          envenenarEscritura(rutaCancion(datos, idTemas(32)))
        }
      }
    )
  })

  test('cancelar el borrado pendiente deja el tema disponible (A9)', async () => {
    await conTemas(
      'aj-pendiente-cancelar',
      async (v, datos, app) => {
        await abrirEditor(v, 'Zeta uno')
        await v.getByRole('radio', { name: 'Estilo' }).click()
        const mas = v.getByRole('button', { name: 'Más acciones del tema' })
        await mas.scrollIntoViewIfNeeded()
        await v.waitForTimeout(400)
        await mas.click()
        await v.getByRole('menuitem', { name: 'Eliminar tema…' }).click()
        await v
          .getByRole('dialog', { name: TEMA.eliminar.titulo('Neón') })
          .getByRole('button', { name: TEMA.eliminar.boton })
          .click()
        await expect(v.getByRole('button', { name: TEMA.reintentar })).toBeVisible()
        await matar(app)
        await expect.poll(() => leerCatalogo(datos).borrado_pendiente).not.toBeNull()
        const { app: app2, v: v2 } = await reabrir(datos)
        try {
          const seccion = await irATemas(v2)
          await seccion.getByRole('button', { name: TEMA.eliminar.cancelarBorrado }).click()
          await expect(seccion.getByRole('button', { name: AJT.terminar })).toHaveCount(0)
          expect(nombres(datos)).toContain('Neón')
          expect(leerCatalogo(datos).borrado_pendiente).toBeNull()
        } finally {
          await app2.close().catch(() => undefined)
        }
      },
      {
        preparar: (datos) => {
          neonConCinco(datos)
          envenenarEscritura(rutaCancion(datos, idTemas(32)))
        }
      }
    )
  })

  test('temas.json ilegible: aviso que sigue tras reiniciar y no vuelve tras cerrarlo (A7, A7c)', async () => {
    await conTemas(
      'aj-apartado',
      async (v, datos, app) => {
        let seccion = await irATemas(v)
        await expect(seccion.getByText(AJT.apartado)).toBeVisible()
        await expect(seccion.getByRole('button', { name: AJT.apartadoCarpeta })).toBeVisible()
        expect(readFileSync(`${rutaCatalogo(datos)}.danado`, 'utf8')).toBe('{ esto no es json')
        await app.close()

        // Sin cerrar el aviso, vuelve tras reiniciar.
        const r2 = await reabrir(datos)
        seccion = await irATemas(r2.v)
        await expect(seccion.getByText(AJT.apartado)).toBeVisible()
        await seccion.getByRole('button', { name: AJT.apartadoCerrar }).click()
        await expect(seccion.getByText(AJT.apartado)).toHaveCount(0)
        await r2.app.close()

        // Cerrado con ✕, no vuelve.
        const r3 = await reabrir(datos)
        try {
          seccion = await irATemas(r3.v)
          await expect(seccion.getByText(AJT.apartado)).toHaveCount(0)
        } finally {
          await r3.app.close().catch(() => undefined)
        }
      },
      {
        temas: false,
        preparar: (datos) => writeFileSync(rutaCatalogo(datos), '{ esto no es json')
      }
    )
  })

  test('catálogo de esquema posterior: solo lectura y el archivo queda intacto byte a byte (A7)', async () => {
    let bytes = Buffer.alloc(0)
    await conTemas(
      'aj-solo-lectura',
      async (v, datos) => {
        const seccion = await irATemas(v)
        await expect(seccion.getByText(AJT.soloLectura)).toBeVisible()
        // Sin catálogo legible no hay selector ni menús ⋯ que ofrecer.
        await expect(seccion.getByRole('button', { name: /^Más acciones de/ })).toHaveCount(0)
        // Abrir el editor de una canción con tema tampoco escribe el catálogo.
        await v
          .getByRole('button', { name: /Biblioteca/ })
          .first()
          .click()
        await abrirEditor(v, 'Bohemian Rhapsody')
        await v.getByRole('radio', { name: 'Estilo' }).click()
        await expect(v.getByText(TEMA.soloLectura).last()).toBeVisible()
        expect(readFileSync(rutaCatalogo(datos))).toEqual(bytes)
      },
      {
        preparar: (datos) => {
          bytes = Buffer.from(
            JSON.stringify({ ...catalogoDeSemilla(), esquema: 99 }, null, 2) + '\n'
          )
          writeFileSync(rutaCatalogo(datos), bytes)
        }
      }
    )
  })

  test('canciones que usan temas que no están en la lista: aviso con recuento (A8)', async () => {
    await conTemas(
      'aj-faltan',
      async (v) => {
        const seccion = await irATemas(v)
        await expect(seccion.getByText(AJT.faltan(2))).toBeVisible()
      },
      {
        preparar: (datos) =>
          modificarCancion(datos, idTemas(34), (c) => {
            c.apariencia = {
              modo: 'tema',
              tema_id: '7e3a0000-0000-4000-8000-000000000098',
              tema_nombre: 'Otro tema'
            }
          })
      }
    )
  })

  test('sin temas: lista vacía y predeterminado vacío (A3)', async () => {
    await conTemas(
      'aj-vacio',
      async (v) => {
        const seccion = await irATemas(v)
        await expect(seccion.getByText(AJT.vacioLista)).toBeVisible()
        await expect(seccion.getByText(AJT.vacioPredet)).toBeVisible()
      },
      {
        temas: false,
        preparar: (datos) =>
          writeFileSync(
            rutaCatalogo(datos),
            JSON.stringify({
              ...catalogoDeSemilla(),
              temas: [],
              predeterminado: null,
              asignaciones: { artistas: [], albumes: [] }
            })
          )
      }
    )
  })

  test('Esc y «‹ Volver al editor» llevan a la pestaña Estilo del editor (A10)', async () => {
    await conTemas('aj-volver', async (v) => {
      await abrirEditor(v, 'Bohemian Rhapsody')
      await v.getByRole('radio', { name: 'Estilo' }).click()
      await v.getByRole('button', { name: 'Ajustes', exact: true }).click()
      await expect(v.getByRole('button', { name: '‹ Volver al editor' })).toBeVisible()
      await v.getByRole('button', { name: '‹ Volver al editor' }).click()
      await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
      await expect(v.getByRole('radio', { name: 'Estilo' })).toBeChecked()
      // «Administrar temas…» va a la sección Temas y Esc vuelve al editor.
      const mas = v.getByRole('button', { name: 'Más acciones del tema' })
      await mas.scrollIntoViewIfNeeded()
      await v.waitForTimeout(400)
      await mas.click()
      await v.getByRole('menuitem', { name: 'Administrar temas…' }).click()
      await expect(v.getByRole('heading', { level: 2, name: AJT.titulo })).toBeFocused()
      await v.keyboard.press('Escape')
      await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
      await expect(v.getByRole('radio', { name: 'Estilo' })).toBeChecked()
    })
  })
})
