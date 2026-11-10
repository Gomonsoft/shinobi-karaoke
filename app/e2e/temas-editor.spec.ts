import type { ApiShinobi } from '../src/shared/ipc'
import { writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { TEMA, procedenciaLarga } from '../src/renderer/src/temas/textos'
import { abrirEditor } from './fixtures/editor'
import { E } from '../src/renderer/src/vistas/editor/textos'
import {
  catalogoDeSemilla,
  botonesDentroDelDialogo,
  clonarCancion,
  conTemas,
  envenenarEscritura,
  hashesCanciones,
  idTemas,
  leerCatalogo,
  modificarCancion,
  repararEscritura,
  rutaCancion,
  rutaCatalogo,
  TEMA_INEXISTENTE,
  TEMA_NEON,
  TEMA_SOL
} from './fixtures/temas'
import { leerCancion } from './fixtures/separacion'

/**
 * Sección «Tema» del editor y editar tema con borrador (tareas 0170 y 0171, criterios T1–T30) en
 * Electron real, sin red, con la semilla de temas de 0168.
 */

const BOHEMIAN = 'Bohemian Rhapsody' // álbum «A Night at the Opera» de Queen -> Sol (idTemas(30))
const ID_BOHEMIAN = idTemas(30)

const selector = (v: Page, tema: string) => v.getByRole('button', { name: `Tema: ${tema}` })
const enEstilo = async (v: Page) => {
  await v.getByRole('radio', { name: 'Estilo' }).click()
  await expect(v.getByRole('region', { name: 'Tema' })).toBeVisible()
}
/**
 * Abre el menú ⋯ del tema. El panel puede estar desplazado y un menú se cierra al desplazar, así que
 * primero se deja el botón a la vista y se espera a que el desplazamiento suave termine.
 */
async function abrirMenuTema(v: Page): Promise<void> {
  const boton = v.getByRole('button', { name: E.tema.mas })
  await boton.scrollIntoViewIfNeeded()
  await v.waitForTimeout(400)
  await boton.click()
  await expect(v.getByRole('menu', { name: E.tema.mas })).toBeVisible()
}
const apariencia = (datos: string, id: string) => leerCancion(datos, id).apariencia

test.describe('editor: sección Tema', () => {
  test.describe.configure({ timeout: 90_000 })

  test('asignar un tema, volver a heredar y personalizar (T1–T5)', async () => {
    await conTemas('tema-asignar', async (v, datos) => {
      await abrirEditor(v, BOHEMIAN)
      await enEstilo(v)
      await expect(selector(v, 'Sol')).toBeVisible()
      await expect(
        v.getByText(
          procedenciaLarga('album', { album: 'A Night at the Opera', artista: 'Queen' }),
          { exact: true }
        )
      ).toBeVisible()
      await expect(v.getByText(TEMA.usos(2), { exact: true })).toBeVisible()

      // Asignar «Neón» a esta canción.
      await selector(v, 'Sol').click()
      await v.getByRole('option', { name: /^Neón/ }).click()
      await expect(selector(v, 'Neón')).toBeVisible()
      await expect(v.getByText(procedenciaLarga('cancion'), { exact: true })).toBeVisible()
      await expect
        .poll(() => apariencia(datos, ID_BOHEMIAN))
        .toMatchObject({ modo: 'tema', tema_id: TEMA_NEON })

      // Volver a heredar: el destino se anuncia y se guarda.
      await v.getByRole('button', { name: 'Volver a heredar' }).click()
      await expect(selector(v, 'Sol')).toBeVisible()
      await expect.poll(() => apariencia(datos, ID_BOHEMIAN).modo).toBe('heredar')

      // Personalizar: queda un estilo propio y deja de contar para el tema.
      await v.getByRole('button', { name: 'Personalizar' }).click()
      await expect(v.getByRole('radio', { name: /^Tema personalizado/ })).toBeChecked()
      await expect.poll(() => apariencia(datos, ID_BOHEMIAN).modo).toBe('propio')
      expect(leerCatalogo(datos).temas.find((t: { id: string }) => t.id === TEMA_SOL)).toBeTruthy()
    })
  })

  test('editar el tema y guardar con el impacto exacto (T7–T9)', async () => {
    await conTemas('tema-editar', async (v, datos) => {
      const antes = hashesCanciones(datos)
      await abrirEditor(v, BOHEMIAN)
      await enEstilo(v)
      await v.getByRole('button', { name: 'Editar tema' }).click()
      await expect(v.getByRole('heading', { name: 'Editando el tema «Sol»' })).toBeVisible()
      await v.getByRole('textbox', { name: 'Color de la letra', exact: true }).fill('#00FF00')
      await v.getByRole('button', { name: 'Guardar en el tema…' }).click()

      const dialogo = v.getByRole('dialog', { name: TEMA.guardar.titulo('Sol') })
      await expect(dialogo).toBeVisible()
      // Sol lo usan Bohemian Rhapsody (álbum) y «Predeterminado anterior» (base Sol).
      await expect(dialogo.getByText(TEMA.guardar.cuerpo(2, true))).toBeVisible()
      await dialogo.getByRole('button', { name: TEMA.guardar.guardarEn('Sol') }).click()
      await expect(dialogo).toHaveCount(0)

      await expect(v.getByTestId('toast').getByText(TEMA.toastGuardado('Sol'))).toBeVisible()
      const sol = leerCatalogo(datos).temas.find((t: { id: string }) => t.id === TEMA_SOL)
      expect(sol.revision).toBe(2)
      expect(sol.estilo.letra.color.toUpperCase()).toBe('#00FF00')
      // Editar un tema no reescribe las canciones que lo usan (ADR 0016 §3): el archivo sigue igual.
      expect(hashesCanciones(datos)[idTemas(38)]).toBe(antes[idTemas(38)])
      // El resumen se refresca: el panel vuelve a D1 con el mismo tema.
      await expect(selector(v, 'Sol')).toBeVisible()
      await expect(v.getByRole('heading', { name: 'Editando el tema «Sol»' })).toHaveCount(0)
    })
  })

  test('confirmación obsoleta: una canción nueva usa el tema mientras se confirma (T10)', async () => {
    await conTemas('tema-obsoleto', async (v, datos) => {
      const antes = hashesCanciones(datos)
      await abrirEditor(v, BOHEMIAN)
      await enEstilo(v)
      await v.getByRole('button', { name: 'Editar tema' }).click()
      await v.getByRole('textbox', { name: 'Color de la letra', exact: true }).fill('#00FF00')
      await v.getByRole('button', { name: 'Guardar en el tema…' }).click()
      const dialogo = v.getByRole('dialog', { name: TEMA.guardar.titulo('Sol') })
      await expect(dialogo.getByText(TEMA.guardar.cuerpo(2, true))).toBeVisible()

      // Mientras el diálogo está abierto, otra canción pasa a heredar Sol (artista y álbum de Queen).
      await v.evaluate(
        (id) =>
          (window as unknown as { shinobi: ApiShinobi }).shinobi.biblioteca.actualizarMetadatos(
            id,
            {
              titulo: 'Doble uno',
              artista: 'Queen',
              album: 'A Night at the Opera'
            }
          ),
        idTemas(40)
      )
      await dialogo.getByRole('button', { name: TEMA.guardar.guardarEn('Sol') }).click()
      // Aviso de que cambió el recuento; no se guardó nada.
      await expect(dialogo.getByText(TEMA.obsoleto)).toBeVisible()
      await expect(dialogo.getByText(TEMA.guardar.cuerpo(3, true))).toBeVisible()
      expect(
        leerCatalogo(datos).temas.find((t: { id: string }) => t.id === TEMA_SOL).revision
      ).toBe(1)
      await dialogo.getByRole('button', { name: TEMA.guardar.guardarEn('Sol') }).click()
      await expect(dialogo).toHaveCount(0)
      expect(
        leerCatalogo(datos).temas.find((t: { id: string }) => t.id === TEMA_SOL).revision
      ).toBe(2)
      expect(hashesCanciones(datos)[idTemas(30)]).toBe(antes[idTemas(30)])
    })
  })

  test('guardar como tema nuevo y usarlo; renombrar, duplicar y eliminar con congelación (T11, T16–T18)', async () => {
    await conTemas('tema-gestion', async (v, datos) => {
      await abrirEditor(v, BOHEMIAN)
      await enEstilo(v)

      // Guardar como tema nuevo desde la edición del tema.
      await v.getByRole('button', { name: 'Editar tema' }).click()
      await v.getByRole('textbox', { name: 'Color de la letra', exact: true }).fill('#00FF00')
      await v.getByRole('button', { name: 'Guardar como tema nuevo…' }).click()
      const nombre = v.getByRole('dialog', { name: TEMA.nombre.tituloNuevo })
      await nombre.getByRole('textbox', { name: TEMA.nombre.campo }).fill('Verde')
      await nombre.getByRole('button', { name: TEMA.nombre.botonNuevo }).click()
      await expect(nombre).toHaveCount(0)
      await expect(
        v.getByText(E.tema.nuevoCreado('Verde', { tema: 'Sol', personalizada: false }))
      ).toBeVisible()
      const catalogo = leerCatalogo(datos)
      expect(catalogo.temas.map((t: { nombre: string }) => t.nombre)).toContain('Verde')
      // El tema editado no cambió.
      expect(catalogo.temas.find((t: { id: string }) => t.id === TEMA_SOL).revision).toBe(1)
      await v.getByRole('button', { name: E.tema.usarNuevo('Verde') }).click()
      await expect(selector(v, 'Verde')).toBeVisible()
      await expect.poll(() => apariencia(datos, ID_BOHEMIAN).modo).toBe('tema')

      // Renombrar.
      await abrirMenuTema(v)
      await v.getByRole('menuitem', { name: E.tema.renombrar }).click()
      const renombrar = v.getByRole('dialog', { name: TEMA.nombre.tituloRenombrar })
      await renombrar.getByRole('textbox', { name: TEMA.nombre.campo }).fill('Verde lima')
      await renombrar.getByRole('button', { name: TEMA.nombre.botonRenombrar }).click()
      await expect(selector(v, 'Verde lima')).toBeVisible()

      // Duplicar: la copia no la usa nadie y no cambia esta canción.
      await abrirMenuTema(v)
      await v.getByRole('menuitem', { name: E.tema.duplicar }).click()
      const duplicar = v.getByRole('dialog', { name: TEMA.nombre.tituloDuplicar })
      await expect(duplicar.getByRole('textbox', { name: TEMA.nombre.campo })).toHaveValue(
        TEMA.nombre.copia('Verde lima')
      )
      await duplicar.getByRole('button', { name: TEMA.nombre.botonDuplicar }).click()
      await expect(duplicar).toHaveCount(0)
      await expect
        .poll(() => leerCatalogo(datos).temas.map((t: { nombre: string }) => t.nombre))
        .toContain('Verde lima (copia)')
      // El foco se asienta en el aviso «tema creado» (si no, el menú se cerraría al perderlo).
      await expect(
        v.getByRole('button', { name: E.tema.usarNuevo('Verde lima (copia)') })
      ).toBeFocused()
      await expect(selector(v, 'Verde lima')).toBeVisible()

      // Eliminar «Verde lima» (la usa esta canción): conserva el aspecto como personalizada.
      await abrirMenuTema(v)
      await v.getByRole('menuitem', { name: E.tema.eliminar }).click()
      const eliminar = v.getByRole('dialog', { name: TEMA.eliminar.titulo('Verde lima') })
      await expect(eliminar.getByText(TEMA.eliminar.cuerpo(1, 'Verde lima'))).toBeVisible()
      await eliminar.getByRole('button', { name: TEMA.eliminar.boton }).click()
      await expect(eliminar).toHaveCount(0)
      await expect(v.getByRole('radio', { name: /^Tema personalizado/ })).toBeChecked()
      const despues = leerCatalogo(datos)
      expect(despues.temas.map((t: { nombre: string }) => t.nombre)).not.toContain('Verde lima')
      expect(apariencia(datos, ID_BOHEMIAN).modo).toBe('propio')
      expect(leerCancion(datos, ID_BOHEMIAN).estilo.letra.color.toUpperCase()).toBe('#00FF00')
    })
  })
})

const ID_ZETA = [idTemas(60), idTemas(61)] as const

/** Neón con cinco canciones (orden del borrado: título): la 3.ª es «We Will Rock You». */
function neonConCinco(datos: string): void {
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

const abrirEliminar = async (v: Page, tema: string) => {
  await abrirMenuTema(v)
  await v.getByRole('menuitem', { name: E.tema.eliminar }).click()
  return v.getByRole('dialog', { name: TEMA.eliminar.titulo(tema) })
}

test.describe('editor: eliminar un tema con fallo a mitad (T19)', () => {
  test.describe.configure({ timeout: 90_000 })

  test('falla la 3.ª de 5: lista, nota, foco en Reintentar; reparar y reanudar', async () => {
    await conTemas(
      'tema-parcial',
      async (v, datos) => {
        await abrirEditor(v, 'Zeta uno')
        await enEstilo(v)
        await expect(selector(v, 'Neón')).toBeVisible()
        const dialogo = await abrirEliminar(v, 'Neón')
        await expect(dialogo.getByText(TEMA.eliminar.cuerpo(5, 'Neón'))).toBeVisible()
        await dialogo.getByRole('button', { name: TEMA.eliminar.boton }).click()

        await expect(dialogo.getByRole('alert')).toHaveText(
          TEMA.eliminar.parcial('We Will Rock You', 3)
        )
        await expect(dialogo.getByRole('listitem')).toHaveCount(3)
        await expect(dialogo.getByRole('button', { name: TEMA.copiarDetalles })).toHaveCount(1)
        await expect(dialogo.getByRole('listitem', { name: /, pendiente$/ })).toHaveCount(2)
        await expect(dialogo.getByRole('listitem', { name: /, no se pudo guardar$/ })).toHaveCount(
          1
        )
        await expect(dialogo.getByText(TEMA.parcial.notaPendientes)).toBeVisible()
        await expect(dialogo.getByRole('button', { name: TEMA.reintentar })).toBeFocused()
        // Las dos primeras ya conservan su aspecto; el tema no se eliminó.
        expect(leerCatalogo(datos).temas.map((t: { nombre: string }) => t.nombre)).toContain('Neón')
        expect(apariencia(datos, idTemas(39)).modo).toBe('propio')

        await repararEscritura(rutaCancion(datos, idTemas(32)))
        await dialogo.getByRole('button', { name: TEMA.reintentar }).click()
        await expect(dialogo).toHaveCount(0)
        expect(leerCatalogo(datos).temas.map((t: { nombre: string }) => t.nombre)).not.toContain(
          'Neón'
        )
        for (const id of [idTemas(31), idTemas(32), idTemas(39), ...ID_ZETA]) {
          expect(apariencia(datos, id).modo).toBe('propio')
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

  test('falla la última: una fila, sin nota y con el texto de una sola canción', async () => {
    await conTemas(
      'tema-parcial-ultima',
      async (v) => {
        await abrirEditor(v, 'Zeta dos')
        await enEstilo(v)
        const dialogo = await abrirEliminar(v, 'Neón')
        await dialogo.getByRole('button', { name: TEMA.eliminar.boton }).click()
        await expect(dialogo.getByRole('alert')).toHaveText(TEMA.eliminar.parcial('Zeta uno', 1))
        await expect(dialogo.getByRole('listitem')).toHaveCount(1)
        await expect(dialogo.getByText(TEMA.parcial.notaPendientes)).toHaveCount(0)
        await expect(dialogo.getByRole('button', { name: TEMA.reintentar })).toBeFocused()
      },
      {
        preparar: (datos) => {
          neonConCinco(datos)
          envenenarEscritura(rutaCancion(datos, ID_ZETA[0]))
        }
      }
    )
  })
})

test.describe('editor: tema no disponible, salir y cerrar con borrador (T12, T22, T22b, T23)', () => {
  test.describe.configure({ timeout: 90_000 })

  test('carpeta copiada con un tema que no existe: «Tema no disponible» (T22)', async () => {
    await conTemas('tema-no-disponible', async (v, datos) => {
      const antes = hashesCanciones(datos)
      await abrirEditor(v, 'Tema que ya no existe')
      await enEstilo(v)
      await expect(v.getByRole('button', { name: /^Tema: .*no disponible/ })).toBeVisible()
      await expect(v.getByText(E.tema.noDisponibleCuerpo('Tema perdido'))).toBeVisible()
      await expect(v.getByRole('button', { name: E.tema.noDisponiblePersonalizar })).toBeVisible()
      // Verla no reescribe nada.
      expect(hashesCanciones(datos)[idTemas(36)]).toBe(antes[idTemas(36)])
    })
  })

  test('volver a heredar con la base apuntando a un tema que no está: destino «respaldo» (T22b)', async () => {
    await conTemas(
      'tema-respaldo',
      async (v, datos) => {
        await abrirEditor(v, 'Neón con base anterior')
        await enEstilo(v)
        await expect(selector(v, 'Neón')).toBeVisible()
        // Sin nombre de tema: la base no está en el catálogo.
        await expect(v.getByText(E.tema.destinoRespaldo)).toBeVisible()
        await v.getByRole('button', { name: E.tema.heredar }).click()
        // D4 sin diálogo ni toast con deshacer: se anuncia y se guarda como heredar.
        await expect(v.getByRole('dialog')).toHaveCount(0)
        await expect(
          v.getByText(E.tema.anuncioHeredar({ procedencia: 'respaldo', temaNombre: null }), {
            exact: true
          })
        ).toBeAttached()
        await expect(v.getByRole('heading', { name: E.tema.noDisponibleTitulo })).toBeVisible()
        await expect.poll(() => apariencia(datos, idTemas(39)).modo).toBe('heredar')
        // Ctrl/Cmd + Z lo deshace.
        await v.locator('body').press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
        await expect(selector(v, 'Neón')).toBeVisible()
        await expect.poll(() => apariencia(datos, idTemas(39)).modo).toBe('tema')
      },
      {
        preparar: (datos) =>
          modificarCancion(datos, idTemas(39), (c) => {
            c.apariencia.base = {
              tipo: 'aleatorio',
              tema_id: TEMA_INEXISTENTE
            }
          })
      }
    )
  })

  test('salir del editor con un borrador sin guardar pregunta; seguir, descartar y cerrar la app (T12, T23)', async () => {
    await conTemas('tema-borrador-salir', async (v, datos, app) => {
      await abrirEditor(v, BOHEMIAN)
      await enEstilo(v)
      await v.getByRole('button', { name: 'Editar tema' }).click()
      await v.getByRole('textbox', { name: 'Color de la letra', exact: true }).fill('#00FF00')

      // «‹ Biblioteca» pregunta; «Seguir editando» no cambia nada.
      await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
      const salir = v.getByRole('dialog', { name: E.tema.dialogoSalir.titulo('Sol') })
      await expect(salir.getByText(E.tema.dialogoSalir.cuerpo)).toBeVisible()
      await salir.getByRole('button', { name: E.tema.dialogoSalir.seguir }).click()
      await expect(salir).toHaveCount(0)
      await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()

      // Cerrar la ventana también pregunta, antes que cualquier trabajo.
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close())
      await expect(salir).toBeVisible()
      await salir.getByRole('button', { name: E.tema.dialogoSalir.seguir }).click()
      await expect(salir).toHaveCount(0)

      // Descartar y salir: el tema sigue como estaba.
      await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
      await salir.getByRole('button', { name: E.tema.dialogoSalir.descartar }).click()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      expect(
        leerCatalogo(datos).temas.find((t: { id: string }) => t.id === TEMA_SOL).revision
      ).toBe(1)
    })
  })

  test('sin temas la sección explica cómo crear el primero (catálogo vacío)', async () => {
    await conTemas(
      'tema-vacio',
      async (v) => {
        await abrirEditor(v, 'Canción lista')
        await enEstilo(v)
        await expect(v.getByRole('radio', { name: /^Tema personalizado/ })).toBeChecked()
        await v.getByRole('radio', { name: /^Temas definidos/ }).click()
        await expect(v.getByText(E.tema.catalogoVacio)).toBeVisible()
      },
      {
        temas: false,
        preparar: (datos) => {
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
      }
    )
  })
})

test.describe('editor: los botones de los diálogos de tres acciones caben en el diálogo', () => {
  test.describe.configure({ timeout: 90_000 })

  for (const dpr of [1, 1.25]) {
    test(`salir con borrador, guardar con impacto y eliminar con fallo parcial a ${dpr * 100} %`, async () => {
      await conTemas(
        `tema-botones-${dpr}`,
        async (v, datos, app) => {
          await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]!.setContentSize(1280, 720)
          )
          await v.waitForTimeout(400)
          await abrirEditor(v, 'Zeta uno')
          await enEstilo(v)
          await v.getByRole('button', { name: 'Editar tema' }).click()
          await v.getByRole('textbox', { name: 'Color de la letra', exact: true }).fill('#00FF00')

          // «Tienes cambios sin guardar…» (tres botones).
          await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
          const salir = v.getByRole('dialog', { name: E.tema.dialogoSalir.titulo('Neón') })
          await expect(salir).toBeVisible()
          expect(await botonesDentroDelDialogo(salir)).toBe(3)
          await salir.getByRole('button', { name: E.tema.dialogoSalir.seguir }).click()

          // Impacto al guardar (Cancelar, Guardar como tema nuevo…, Guardar en «Neón»).
          await v.getByRole('button', { name: 'Guardar en el tema…' }).click()
          const impacto = v.getByRole('dialog', { name: TEMA.guardar.titulo('Neón') })
          await expect(impacto).toBeVisible()
          expect(await botonesDentroDelDialogo(impacto)).toBeGreaterThanOrEqual(3)
          await impacto.getByRole('button', { name: TEMA.cancelar }).click()
          await v.getByRole('button', { name: E.tema.descartar }).click()
          await v
            .getByRole('dialog')
            .getByRole('button', { name: E.tema.dialogoDescartar.descartar })
            .click()

          // Eliminar con fallo parcial: [Reintentar] [Cancelar el borrado] [Cerrar].
          const eliminar = await abrirEliminar(v, 'Neón')
          await eliminar.getByRole('button', { name: TEMA.eliminar.boton }).click()
          await expect(eliminar.getByRole('button', { name: TEMA.reintentar })).toBeVisible()
          expect(await botonesDentroDelDialogo(eliminar)).toBeGreaterThanOrEqual(4)
          void datos
        },
        {
          dpr,
          preparar: (datos) => {
            neonConCinco(datos)
            envenenarEscritura(rutaCancion(datos, idTemas(32)))
          }
        }
      )
    })
  }
})

/** Matriz de viewports de la subfase 2.1 (ventana física, escala y viewport CSS pedido). */
const VIEWPORTS = [
  { nombre: '1280x720', ancho: 1280, alto: 720, dpr: 1 },
  { nombre: '1024x576', ancho: 1024, alto: 576, dpr: 1.25 },
  { nombre: '1720x1440', ancho: 1720, alto: 1440, dpr: 1 },
  { nombre: '1376x1152', ancho: 1376, alto: 1152, dpr: 1.25 },
  { nombre: '1920x1080', ancho: 1920, alto: 1080, dpr: 1 },
  { nombre: '1536x864', ancho: 1536, alto: 864, dpr: 1.25 }
] as const

/**
 * Las acciones de la sección Tema no se parten ni se cortan: misma fila, dentro del panel y sin texto
 * recortado (`scrollWidth <= clientWidth`).
 */
async function medirAcciones(v: Page, contexto: string, estado: 'd1' | 'd3'): Promise<void> {
  const panel = v.getByRole('complementary', { name: 'Estilo' })
  const nombres =
    estado === 'd1'
      ? [E.tema.personalizar, E.tema.editar, E.tema.mas]
      : [E.tema.guardarEn, E.tema.descartar, E.tema.guardarNuevo]
  const botones = nombres.map((n) => panel.getByRole('button', { name: n, exact: true }))
  for (const b of botones) await b.scrollIntoViewIfNeeded()
  await v.waitForTimeout(300)
  const caja = (await panel.boundingBox())!
  const cajas = []
  for (const [i, b] of botones.entries()) {
    const c = (await b.boundingBox())!
    expect(c, `${contexto}: «${nombres[i]}» tiene caja`).not.toBeNull()
    expect(c.x, `${contexto}: «${nombres[i]}» dentro por la izquierda`).toBeGreaterThanOrEqual(
      caja.x - 1
    )
    expect(c.x + c.width, `${contexto}: «${nombres[i]}» dentro por la derecha`).toBeLessThanOrEqual(
      caja.x + caja.width + 1
    )
    const recortado = await b.evaluate((e) => e.scrollWidth > e.clientWidth + 1)
    expect(
      recortado,
      `${contexto}: «${nombres[i]}» sin texto recortado ${JSON.stringify(await b.evaluate((e) => [e.scrollWidth, e.clientWidth, getComputedStyle(e).paddingLeft]))}`
    ).toBe(false)
    // Un botón de una sola línea no supera ~48 px de alto.
    expect(c.height, `${contexto}: «${nombres[i]}» en una línea`).toBeLessThan(52)
    cajas.push(c)
  }
  if (estado === 'd1') {
    const centros = cajas.map((c) => Math.round(c.y + c.height / 2))
    expect(new Set(centros).size, `${contexto}: [Personalizar] [Editar tema] [⋯] en una fila`).toBe(
      1
    )
  }
}

test.describe('editor: la sección Tema no se parte ni se corta (0170, 0171)', () => {
  test.describe.configure({ timeout: 120_000 })

  for (const vp of VIEWPORTS) {
    test(`D1 y D3 en ${vp.nombre} (escala ${vp.dpr})`, async () => {
      await conTemas(
        `tema-layout-${vp.nombre}`,
        async (v, _datos, app) => {
          await app.evaluate(
            ({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w!, h!),
            [vp.ancho, vp.alto]
          )
          await v.waitForTimeout(500)
          const real = await v.evaluate(() => [
            window.innerWidth,
            window.innerHeight,
            window.devicePixelRatio
          ])
          const concedido =
            real[0]! >= vp.ancho &&
            real[0]! - vp.ancho <= 4 &&
            real[1]! >= vp.alto &&
            real[1]! - vp.alto <= 4 &&
            Math.abs(real[2]! - vp.dpr) < 0.01
          test.info().annotations.push({ type: 'viewport', description: `${real.join(' × ')}` })
          test.skip(!concedido, `la pantalla no concede ${vp.nombre} con dpr ${vp.dpr}`)
          await abrirEditor(v, BOHEMIAN)
          await enEstilo(v)
          await medirAcciones(v, `${vp.nombre} D1`, 'd1')
          await v.getByRole('button', { name: E.tema.editar, exact: true }).click()
          await expect(v.getByRole('heading', { name: 'Editando el tema «Sol»' })).toBeVisible()
          await medirAcciones(v, `${vp.nombre} D3`, 'd3')
        },
        { dpr: vp.dpr }
      )
    })
  }

  test('con el panel a 300, 360 y 480 px a 1280 × 720 (D1 y D3)', async () => {
    await conTemas('tema-layout-paneles', async (v, _datos, app) => {
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.setContentSize(1280, 720)
      )
      await v.waitForTimeout(500)
      await abrirEditor(v, BOHEMIAN)
      await enEstilo(v)
      const divisor = v.getByRole('separator', { name: E.layout.divisor.panel })
      const anchos: number[] = []
      for (const tecla of ['Home', null, 'End'] as const) {
        if (tecla === null) await divisor.dblclick()
        else {
          await divisor.focus()
          await v.keyboard.press(tecla)
        }
        const valor = Number(await divisor.getAttribute('aria-valuenow'))
        anchos.push(valor)
        await v.waitForTimeout(300)
        await medirAcciones(v, `panel ${valor}px D1`, 'd1')
      }
      expect(anchos[0]).toBe(300)
      expect(anchos[1]).toBe(360)
      expect(anchos[2]).toBeGreaterThanOrEqual(420)
      // D3 con los tres anchos.
      await v.getByRole('button', { name: E.tema.editar, exact: true }).click()
      for (const tecla of ['Home', 'End'] as const) {
        await divisor.focus()
        await v.keyboard.press(tecla)
        await v.waitForTimeout(300)
        await medirAcciones(v, `panel ${tecla} D3`, 'd3')
      }
      await divisor.dblclick()
      await v.waitForTimeout(300)
      await medirAcciones(v, 'panel 360px D3', 'd3')
    })
  })
})
