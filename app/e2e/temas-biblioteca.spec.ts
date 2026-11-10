import type { ApiShinobi } from '../src/shared/ipc'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { BIB_GRUPO, TEMA } from '../src/renderer/src/temas/textos'
import { LOTE, SEL } from '../src/renderer/src/vistas/biblioteca/textosSeleccion'
import {
  botonesDentroDelDialogo,
  conTemas,
  envenenarEscritura,
  clonarCancion,
  escribirCatalogo,
  idTemas,
  leerCatalogo,
  modificarCancion,
  reabrir,
  rutaCancion,
  TEMA_INEXISTENTE,
  TEMA_NEON,
  TEMA_SOL
} from './fixtures/temas'
import { leerCancion } from './fixtures/separacion'

/**
 * Biblioteca agrupada, tema de artista y álbum, selección múltiple y «Aplicar tema…» (tareas 0172,
 * 0173 y 0174; criterios B1–B16) en Electron real, sin red, con la semilla de temas.
 */

const tarjeta = (v: Page, titulo: string): Locator =>
  v.getByRole('article', { name: new RegExp(`^${titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`) })
const agrupar = (v: Page, por: 'Sin agrupar' | 'Artista' | 'Álbum') =>
  v.getByRole('radio', { name: por, exact: true }).click()
const buscar = (v: Page) => v.getByRole('searchbox', { name: /^Buscar título/ })
/**
 * Abre el menú ⋯ de una tarjeta. Un menú abierto se cierra si la lista se desplaza o se reordena
 * (agrupar, filtrar, eventos en vivo), así que se espera a que la vista se asiente y se reintenta la
 * apertura hasta que el menú aparezca.
 */
async function abrirMenuTarjeta(v: Page, titulo: string, item: string): Promise<Locator> {
  const t = tarjeta(v, titulo)
  await t.scrollIntoViewIfNeeded()
  await v.waitForTimeout(400)
  const entrada = v.getByRole('menuitem', { name: item })
  await expect(async () => {
    await t.getByRole('button', { name: `Más acciones de «${titulo}»` }).click()
    await expect(entrada).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 15_000 })
  return entrada
}
const apariencia = (datos: string, id: string) => leerCancion(datos, id).apariencia

/** Añade la asignación de tema al álbum «Álbum Doble» de «Artista Doble» (canciones 40 y 41). */
function albumDobleConSol(datos: string): void {
  const c = leerCatalogo(datos)
  c.asignaciones.albumes.push({
    artista: 'artista doble',
    album: 'álbum doble',
    nombre_artista: 'Artista Doble',
    nombre_album: 'Álbum Doble',
    tema_id: TEMA_SOL
  })
  escribirCatalogo(datos, c)
}

/** Álbum Doble con tres canciones: heredada, con base al azar existente y con base inexistente. */
function albumDobleB5b(datos: string): void {
  albumDobleConSol(datos)
  modificarCancion(datos, idTemas(41), (c) => {
    c.apariencia = {
      modo: 'heredar',
      base: { tipo: 'aleatorio', tema_id: TEMA_NEON },
      tema_nombre: 'Neón'
    }
  })
  clonarCancion(datos, idTemas(40), idTemas(62), {
    titulo: 'Doble tres',
    artista: 'Artista Doble',
    album: 'Álbum Doble',
    apariencia: {
      modo: 'heredar',
      base: { tipo: 'aleatorio', tema_id: TEMA_INEXISTENTE },
      tema_nombre: 'Tema perdido'
    }
  })
}

const baseInexistente = (datos: string, n: number): void =>
  modificarCancion(datos, idTemas(n), (c) => {
    c.apariencia = {
      modo: 'heredar',
      base: { tipo: 'aleatorio', tema_id: TEMA_INEXISTENTE },
      tema_nombre: 'Tema perdido'
    }
  })

test.describe('Biblioteca: agrupación, identidad y búsqueda', () => {
  test.describe.configure({ timeout: 90_000 })

  test('la agrupación persiste al reiniciar (B1) y agrupa por identidad (B2, B3)', async () => {
    await conTemas('bib-agrupar', async (v, datos, app) => {
      await agrupar(v, 'Artista')
      await expect(v.getByRole('heading', { name: 'Plegar Queen', level: 2 })).toBeVisible()
      await expect(v.getByRole('button', { name: 'Plegar Queen' })).toContainText('3 canciones')
      // Las canciones sin artista forman su propio grupo.
      await expect(v.getByRole('heading', { name: 'Plegar Sin artista', level: 2 })).toBeVisible()
      await app.close()

      const { app: app2, v: v2 } = await reabrir(datos)
      try {
        await expect(v2.getByRole('radio', { name: 'Artista', exact: true })).toBeChecked()
        await expect(v2.getByRole('heading', { name: 'Plegar Queen', level: 2 })).toBeVisible()
      } finally {
        await app2.close().catch(() => undefined)
      }
    })
  })

  test('la búsqueda encuentra por álbum y por varias palabras (B4)', async () => {
    await conTemas('bib-buscar', async (v) => {
      await buscar(v).fill('opera')
      await expect(v.getByRole('article')).toHaveCount(1)
      await expect(tarjeta(v, 'Bohemian Rhapsody')).toBeVisible()
      await buscar(v).fill('queen jazz')
      await expect(v.getByRole('article')).toHaveCount(1)
      await expect(tarjeta(v, "Don't Stop Me Now")).toBeVisible()
      await expect(v.getByRole('status').first()).toContainText('1 canción')
    })
  })

  test('línea de tema larga a 1280×720 al 125 %: «…» y texto completo en title (B16)', async () => {
    await conTemas(
      'bib-linea-larga',
      async (v, _datos, app) => {
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]!.setContentSize(1280, 720)
        )
        await v.waitForTimeout(500)
        const t = tarjeta(v, 'Bohemian Rhapsody')
        await expect(t).toBeVisible()
        const linea = t.locator('[data-linea-tema]')
        const completo = 'Sol con un nombre larguísimo para probar el recorte · del álbum'
        await expect(linea).toHaveAttribute('title', completo)
        await expect(t).toHaveAccessibleName(new RegExp(`Tema: ${completo}\\.$`))
        const medidas = await linea.locator('> span').evaluate((e) => ({
          recorta: e.scrollWidth > e.clientWidth,
          puntos: getComputedStyle(e).textOverflow,
          cajaDentro:
            e.getBoundingClientRect().right <= e.closest('article')!.getBoundingClientRect().right
        }))
        expect(medidas.puntos).toBe('ellipsis')
        expect(medidas.recorta).toBe(true)
        expect(medidas.cajaDentro).toBe(true)
      },
      {
        dpr: 1.25,
        preparar: (datos) => {
          const c = leerCatalogo(datos)
          c.temas.find((x: { id: string }) => x.id === TEMA_SOL).nombre =
            'Sol con un nombre larguísimo para probar el recorte'
          escribirCatalogo(datos, c)
        }
      }
    )
  })
})

test.describe('Biblioteca: tema de artista y de álbum (B5, B5b, B6)', () => {
  test.describe.configure({ timeout: 90_000 })

  test('asignar un tema a un artista y quitarlo; las canciones que lo heredan cambian (B5, B6)', async () => {
    await conTemas('bib-tema-artista', async (v, datos) => {
      await agrupar(v, 'Artista')
      // «Abba» no tiene tema: [Tema…] abre el diálogo con el impacto.
      await v.getByRole('button', { name: 'Tema del artista ABBA…' }).click()
      const d = v.getByRole('dialog', { name: BIB_GRUPO.tituloArtista('ABBA') })
      await d.getByRole('button', { name: /^Tema:/ }).click()
      await v.getByRole('option', { name: /^Neón/ }).click()
      await expect(d.getByText(BIB_GRUPO.impacto(1, 1))).toBeVisible()
      await d.getByRole('button', { name: BIB_GRUPO.aplicar, exact: true }).click()
      await expect(d).toHaveCount(0)
      await expect(v.getByText(BIB_GRUPO.toast('artista', 'ABBA', 'Neón'))).toBeVisible()
      await expect(tarjeta(v, 'Dancing Queen')).toHaveAccessibleName(/Tema: Neón · del artista\./)
      // Asignar a un grupo no escribe las canciones: la herencia se resuelve en vivo.
      expect(apariencia(datos, idTemas(33)).modo).toBe('heredar')
      expect(
        leerCatalogo(datos).asignaciones.artistas.map(
          (a: { nombre_artista: string }) => a.nombre_artista
        )
      ).toContain('ABBA')
      // Queen ya tenía tema de artista: el encabezado lo dice.
      await expect(v.getByText('Tema del artista: Neón').first()).toBeVisible()
    })
  })

  test('quitar el tema de un álbum con una canción cuya base no existe: destinos distintos (B5b)', async () => {
    await conTemas(
      'bib-b5b',
      async (v, datos) => {
        await agrupar(v, 'Álbum')
        await expect(tarjeta(v, 'Doble uno')).toHaveAccessibleName(/Sol · del álbum/)
        await v.getByRole('button', { name: 'Tema del álbum Álbum Doble…' }).click()
        const d = v.getByRole('dialog', {
          name: BIB_GRUPO.tituloAlbum('Álbum Doble', 'Artista Doble')
        })
        await d.getByRole('button', { name: /^Tema:/ }).click()
        await v.getByRole('option', { name: BIB_GRUPO.sinTemaAlbum }).click()
        await expect(d.getByText(BIB_GRUPO.impactoDistintos(2, 'album'))).toBeVisible()
        await expect(d.getByText(BIB_GRUPO.noDisponible(1))).toBeVisible()
        await d.getByRole('button', { name: BIB_GRUPO.aplicar, exact: true }).click()
        await expect(d).toHaveCount(0)
        await expect(tarjeta(v, 'Doble uno')).toHaveAccessibleName(/Noche ninja · predeterminado/)
        await expect(tarjeta(v, 'Doble dos')).toHaveAccessibleName(/Neón · al azar/)
        await expect(tarjeta(v, 'Doble tres')).toHaveAccessibleName(/Tema: Tema no disponible\./)
        expect(
          leerCatalogo(datos).asignaciones.albumes.some(
            (a: { nombre_album: string }) => a.nombre_album === 'Álbum Doble'
          )
        ).toBe(false)
      },
      {
        preparar: albumDobleB5b
      }
    )
  })

  test('quitar el tema de un álbum cuyas canciones no tienen tema de origen (B5b, todas no disponibles)', async () => {
    await conTemas(
      'bib-b5b-todas',
      async (v) => {
        await agrupar(v, 'Álbum')
        await v.getByRole('button', { name: 'Tema del álbum Álbum Doble…' }).click()
        const d = v.getByRole('dialog', {
          name: BIB_GRUPO.tituloAlbum('Álbum Doble', 'Artista Doble')
        })
        await d.getByRole('button', { name: /^Tema:/ }).click()
        await v.getByRole('option', { name: BIB_GRUPO.sinTemaAlbum }).click()
        await expect(d.getByText(BIB_GRUPO.impactoTodasNoDisponibles(2))).toBeVisible()
        await d.getByRole('button', { name: BIB_GRUPO.aplicar, exact: true }).click()
        await expect(d).toHaveCount(0)
        for (const t of ['Doble uno', 'Doble dos']) {
          await expect(tarjeta(v, t)).toHaveAccessibleName(/Tema: Tema no disponible\./)
        }
      },
      {
        preparar: (datos) => {
          albumDobleConSol(datos)
          baseInexistente(datos, 40)
          baseInexistente(datos, 41)
        }
      }
    )
  })
})

test.describe('Biblioteca: editar datos, plegado y teclado (B7, B12, B15)', () => {
  test.describe.configure({ timeout: 90_000 })

  test('editar datos que cambian el grupo mueve la tarjeta y la enfoca (B7)', async () => {
    await conTemas('bib-b7', async (v, datos) => {
      await agrupar(v, 'Artista')
      await (await abrirMenuTarjeta(v, 'Doble uno', 'Editar datos')).click()
      const d = v.getByRole('dialog', { name: 'Editar datos' })
      await d.getByLabel('Artista').fill('Queen')
      await d.getByRole('button', { name: /^Guardar/ }).click()
      await expect(d).toHaveCount(0)
      const lista = v.getByRole('list', { name: 'Queen', exact: true })
      await expect(lista.getByRole('article', { name: /^Doble uno,/ })).toBeVisible()
      await expect(tarjeta(v, 'Doble uno')).toBeFocused()
      // Con «Queen» hereda el tema del artista (Neón).
      await expect(tarjeta(v, 'Doble uno')).toHaveAccessibleName(/Neón · del artista/)
      expect(leerCancion(datos, idTemas(40)).metadatos.artista).toBe('Queen')
    })
  })

  test('plegar, buscar y volver del reproductor conserva agrupación, plegado, filtro y desplazamiento (B12, B15)', async () => {
    await conTemas('bib-b15', async (v, _datos, app) => {
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.setContentSize(1280, 520)
      )
      await agrupar(v, 'Artista')
      await v.getByRole('button', { name: 'Plegar ABBA' }).click()
      await expect(v.getByRole('button', { name: 'Desplegar ABBA' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      await v.getByRole('radio', { name: /^Listas/ }).click()
      // Desplaza la lista y reproduce «Bohemian Rhapsody».
      const t = tarjeta(v, 'Bohemian Rhapsody')
      await t.scrollIntoViewIfNeeded()
      await v.waitForTimeout(300)
      const antes = await v.evaluate(() => document.querySelector('main')!.scrollTop)
      await t.getByRole('button', { name: /^Reproducir/ }).click()
      const capa = v.getByRole('dialog', { name: 'Reproductor de «Bohemian Rhapsody»' })
      await expect(capa).toBeVisible({ timeout: 15_000 })
      await v.keyboard.press('Escape')
      await expect(capa).toHaveCount(0)

      await expect(v.getByRole('radio', { name: 'Artista', exact: true })).toBeChecked()
      await expect(v.getByRole('radio', { name: /^Listas/ })).toBeChecked()
      await expect(v.getByRole('button', { name: 'Desplegar ABBA' })).toBeVisible()
      await expect(tarjeta(v, 'Bohemian Rhapsody')).toBeFocused()
      const despues = await v.evaluate(() => document.querySelector('main')!.scrollTop)
      expect(Math.abs(despues - antes)).toBeLessThan(60)
    })
  })

  test('escribir en la búsqueda mantiene el foco en el campo (B12)', async () => {
    await conTemas('bib-b12', async (v) => {
      await buscar(v).click()
      await v.keyboard.type('queen')
      await expect(buscar(v)).toBeFocused()
      await expect(v.getByRole('article')).toHaveCount(4)
    })
  })
})

test.describe('Biblioteca: selección múltiple y «Aplicar tema…» (B8–B11)', () => {
  test.describe.configure({ timeout: 90_000 })

  const abrirSeleccion = async (v: Page) => {
    await v.getByRole('button', { name: SEL.boton, exact: true }).click()
    await expect(v.getByRole('toolbar', { name: 'Selección' })).toBeVisible()
  }

  test('seleccionar, aplicar un tema y volver el foco a «Seleccionar» (B8, B9)', async () => {
    await conTemas('bib-sel', async (v, datos) => {
      await buscar(v).fill('queen')
      await abrirSeleccion(v)
      await tarjeta(v, 'Bohemian Rhapsody').getByRole('checkbox').check()
      await tarjeta(v, "Don't Stop Me Now").getByRole('checkbox').check()
      await expect(v.getByText(SEL.contador(2))).toBeVisible()
      await v.getByRole('button', { name: SEL.aplicarTema }).click()
      const d = v.getByRole('dialog')
      await expect(d).toBeVisible()
      await d.getByRole('button', { name: /^Tema:/ }).click()
      await v.getByRole('option', { name: /^Neón/ }).click()
      expect(await botonesDentroDelDialogo(d)).toBeGreaterThanOrEqual(2)
      await d.getByRole('button', { name: /^Aplicar a \d+ canciones?$/ }).click()
      await expect(d).toContainText(LOTE.resultado('Neón', 2, 2))
      await d.getByRole('button', { name: LOTE.cerrar }).click()
      await expect(d).toHaveCount(0)
      expect(apariencia(datos, idTemas(30))).toMatchObject({ modo: 'tema' })
      // Terminar con Esc devuelve el foco a «Seleccionar».
      await v.keyboard.press('Escape')
      await expect(v.getByRole('button', { name: SEL.boton, exact: true })).toBeFocused()
    })
  })

  test('Esc cierra primero el diálogo y después el modo selección; el foco vuelve a «Aplicar tema…» (B9)', async () => {
    await conTemas('bib-sel-esc', async (v) => {
      await abrirSeleccion(v)
      await tarjeta(v, 'Dancing Queen').getByRole('checkbox').check()
      const aplicar = v.getByRole('button', { name: SEL.aplicarTema })
      await aplicar.click()
      const d = v.getByRole('dialog', { name: LOTE.titulo(1) })
      await expect(d).toBeVisible()
      await v.keyboard.press('Escape')
      await expect(d).toHaveCount(0)
      // El modo selección sigue activo y el foco está en el botón que abrió el diálogo.
      await expect(v.getByRole('toolbar', { name: 'Selección' })).toBeVisible()
      await expect(aplicar).toBeFocused()
      await v.keyboard.press('Escape')
      await expect(v.getByRole('toolbar', { name: 'Selección' })).toHaveCount(0)
      await expect(v.getByRole('button', { name: SEL.boton, exact: true })).toBeFocused()
    })
  })

  test('lote con un fallo de escritura y «Revisar y reintentar» (B10)', async () => {
    await conTemas(
      'bib-lote-fallo',
      async (v, datos) => {
        await abrirSeleccion(v)
        for (const t of ['Dancing Queen', 'Doble uno', 'Doble dos']) {
          await tarjeta(v, t).getByRole('checkbox').check()
        }
        await v.getByRole('button', { name: SEL.aplicarTema }).click()
        const d = v.getByRole('dialog')
        await d.getByRole('button', { name: /^Tema:/ }).click()
        await v.getByRole('option', { name: /^Neón/ }).click()
        await d.getByRole('button', { name: LOTE.aplicar(3) }).click()
        await expect(d).toContainText(LOTE.resultado('Neón', 2, 3))
        await expect(d.getByRole('button', { name: LOTE.copiarDetalles })).toHaveCount(1)
        expect(await botonesDentroDelDialogo(d)).toBeGreaterThanOrEqual(3)
        // Reparar y reintentar solo la fallida.
        const { rm } = await import('node:fs/promises')
        await rm(`${rutaCancion(datos, idTemas(41))}.tmp`, { recursive: true, force: true })
        await d.getByRole('button', { name: LOTE.reintentar }).click()
        await d.getByRole('button', { name: LOTE.aplicar(1) }).click()
        await expect(d).toContainText(LOTE.resultado('Neón', 1, 1))
        expect(apariencia(datos, idTemas(41))).toMatchObject({ modo: 'tema' })
      },
      { preparar: (datos) => envenenarEscritura(rutaCancion(datos, idTemas(41))) }
    )
  })

  test('una canción que cambia mientras se confirma se omite y se puede reintentar (B11)', async () => {
    await conTemas('bib-lote-cambio', async (v, datos) => {
      await abrirSeleccion(v)
      for (const t of ['Doble uno', 'Doble dos']) await tarjeta(v, t).getByRole('checkbox').check()
      await v.getByRole('button', { name: SEL.aplicarTema }).click()
      const d = v.getByRole('dialog')
      await d.getByRole('button', { name: /^Tema:/ }).click()
      await v.getByRole('option', { name: /^Neón/ }).click()
      await expect(d.getByRole('button', { name: LOTE.aplicar(2) })).toBeEnabled()
      // Otra vía cambia la apariencia de una de ellas tras la previsualización.
      await v.evaluate(
        ([id, tema]) =>
          (window as unknown as { shinobi: ApiShinobi }).shinobi.biblioteca.guardarApariencia(id!, {
            modo: 'tema',
            temaId: tema!
          }),
        [idTemas(41), TEMA_SOL] as const
      )
      await d.getByRole('button', { name: LOTE.aplicar(2) }).click()
      await expect(d).toContainText(LOTE.falloCambio)
      await expect(d.getByRole('button', { name: LOTE.reintentar })).toBeVisible()
      expect(apariencia(datos, idTemas(40))).toMatchObject({ modo: 'tema' })
      expect(apariencia(datos, idTemas(41)).temaId ?? apariencia(datos, idTemas(41)).tema_id).toBe(
        TEMA_SOL
      )
    })
  })

  test('el diálogo del tema del grupo no desborda con el impacto largo (B16)', async () => {
    await conTemas(
      'bib-dialogo-grupo',
      async (v, _d, app) => {
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]!.setContentSize(1280, 720)
        )
        await agrupar(v, 'Álbum')
        await v.getByRole('button', { name: 'Tema del álbum Álbum Doble…' }).click()
        const d = v.getByRole('dialog', {
          name: BIB_GRUPO.tituloAlbum('Álbum Doble', 'Artista Doble')
        })
        await d.getByRole('button', { name: /^Tema:/ }).click()
        await v.getByRole('option', { name: BIB_GRUPO.sinTemaAlbum }).click()
        await expect(d.getByText(BIB_GRUPO.impactoDistintos(2, 'album'))).toBeVisible()
        expect(await botonesDentroDelDialogo(d)).toBeGreaterThanOrEqual(2)
      },
      { preparar: albumDobleB5b }
    )
  })

  test('la tarjeta ofrece «Aplicar tema…» en su menú ⋯ y devuelve el foco (B9)', async () => {
    await conTemas('bib-aplicar-tarjeta', async (v) => {
      const t = tarjeta(v, 'Dancing Queen')
      await (await abrirMenuTarjeta(v, 'Dancing Queen', SEL.aplicarTema)).click()
      const d = v.getByRole('dialog', { name: LOTE.tituloUna('Dancing Queen') })
      await expect(d).toBeVisible()
      await d.getByRole('button', { name: TEMA.cancelar }).click()
      await expect(d).toHaveCount(0)
      await expect(t).toBeFocused()
    })
  })
})
