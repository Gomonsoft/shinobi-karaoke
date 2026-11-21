import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { BIB_GRUPO, TEMA } from '../src/renderer/src/temas/textos'
import { AJT } from '../src/renderer/src/vistas/ajustes/textos'
import { LOTE, SEL } from '../src/renderer/src/vistas/biblioteca/textosSeleccion'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { abrirEditor } from './fixtures/editor'
import { leerCancion } from './fixtures/separacion'
import {
  catalogoDeSemilla,
  type Catalogo,
  conTemas,
  envenenarEscritura,
  escribirCatalogo,
  idTemas,
  leerCatalogo,
  modificarCancion,
  rutaCancion,
  rutaCatalogo,
  TEMA_NEON,
  TEMA_NOCHE_NINJA,
  TEMA_SOL
} from './fixtures/temas'
import type { ApiShinobi } from '../src/shared/ipc'

/**
 * Capturas de revisión de la fase 3 (tarea 0176, `docs/ux/revision-fase-3/README.md`). Opt-in:
 * `SHINOBI_CAPTURAS_3=1 npx playwright test e2e/temas-capturas.spec.ts --workers=1`. No escribe nada
 * en CI. El nombre usa el tamaño físico: `{vista}-{ancho}x{alto}-{escala}-{estado}.png`.
 */

const CAPTURAS = process.env.SHINOBI_CAPTURAS_3 === '1'
const DIR = join(process.cwd(), '..', 'docs', 'ux', 'revision-fase-3')

test.describe('capturas de revisión de la fase 3', () => {
  test.skip(!CAPTURAS, 'se generan solo con SHINOBI_CAPTURAS_3=1')
  test.describe.configure({ timeout: 240_000 })

  interface Formato {
    /** Tamaño físico de la ventana (contenido). */
    ancho: number
    alto: number
    dpr: 1 | 1.25
  }
  const escala = (dpr: number): string => (dpr === 1 ? '100' : '125')

  /** Ajusta el contenido al tamaño físico pedido y devuelve el ayudante de captura. */
  async function preparar(app: ElectronApplication, v: Page, vista: string, f: Formato) {
    await app.evaluate(
      ({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w!, h!),
      [Math.round(f.ancho / f.dpr), Math.round(f.alto / f.dpr)]
    )
    await v.waitForTimeout(500)
    const real = await v.evaluate(() => [
      window.devicePixelRatio,
      window.innerWidth,
      window.innerHeight
    ])
    expect(Math.abs(real[0]! - f.dpr)).toBeLessThan(0.01)
    test.info().annotations.push({ type: `${vista}-${f.dpr}`, description: real.join(' × ') })
    mkdirSync(DIR, { recursive: true })
    return async (estado: string, opciones: { conFoco?: boolean } = {}) => {
      await v.mouse.move(0, 0)
      if (!opciones.conFoco)
        await v.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await v.waitForTimeout(350)
      await v.screenshot({
        path: join(DIR, `${vista}-${f.ancho}x${f.alto}-${escala(f.dpr)}-${estado}.png`)
      })
    }
  }

  // ------------------------------------------------------------------ editor
  const FORMATOS_EDITOR: Formato[] = [
    { ancho: 1280, alto: 720, dpr: 1 },
    { ancho: 1280, alto: 720, dpr: 1.25 }
  ]
  const enEstilo = async (v: Page) => {
    await v.getByRole('radio', { name: 'Estilo' }).click()
    await expect(v.getByRole('region', { name: 'Tema' })).toBeVisible()
    await v.getByRole('region', { name: 'Tema' }).scrollIntoViewIfNeeded()
  }
  const menuTema = async (v: Page) => {
    const mas = v.getByRole('button', { name: E.tema.mas })
    await mas.scrollIntoViewIfNeeded()
    await v.waitForTimeout(400)
    await mas.click()
    await expect(v.getByRole('menu', { name: E.tema.mas })).toBeVisible()
  }
  const verde = async (v: Page) =>
    v.getByRole('textbox', { name: 'Color de la letra', exact: true }).fill('#00FF00')

  for (const f of FORMATOS_EDITOR) {
    test(`editor ${f.ancho}x${f.alto} al ${escala(f.dpr)} %`, async () => {
      await conTemas(
        `cap-editor-${f.dpr}`,
        async (v, datos, app) => {
          const capturar = await preparar(app, v, 'editor', f)
          await abrirEditor(v, 'Bohemian Rhapsody')
          await enEstilo(v)
          await capturar('tema-definidos')

          // D3: editando el tema (con un cambio de color) y sus diálogos.
          await v.getByRole('button', { name: E.tema.editar, exact: true }).click()
          await verde(v)
          await capturar('tema-editando')
          await v.getByRole('button', { name: E.tema.guardarEn, exact: true }).click()
          const impacto = v.getByRole('dialog', { name: TEMA.guardar.titulo('Sol') })
          await expect(impacto.getByText(TEMA.guardar.cuerpo(2, true))).toBeVisible()
          await capturar('dialogo-guardar-impacto')
          // Cambio concurrente: otra canción pasa a heredar «Sol» mientras se confirma.
          await v.evaluate(
            (id) =>
              (window as unknown as { shinobi: ApiShinobi }).shinobi.biblioteca.actualizarMetadatos(
                id,
                { titulo: 'Doble uno', artista: 'Queen', album: 'A Night at the Opera' }
              ),
            idTemas(40)
          )
          await impacto.getByRole('button', { name: TEMA.guardar.guardarEn('Sol') }).click()
          await expect(impacto.getByText(TEMA.obsoleto)).toBeVisible()
          await capturar('dialogo-guardar-obsoleto')
          await impacto.getByRole('button', { name: TEMA.cancelar }).click()

          await v.getByRole('button', { name: E.tema.guardarNuevo, exact: true }).click()
          const nombre = v.getByRole('dialog', { name: TEMA.nombre.tituloNuevo })
          await nombre.getByRole('textbox', { name: TEMA.nombre.campo }).fill('Verde lima')
          await capturar('dialogo-nuevo-nombre')
          await nombre.getByRole('button', { name: TEMA.cancelar }).click()

          await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
          await expect(
            v.getByRole('dialog', { name: E.tema.dialogoSalir.titulo('Sol') })
          ).toBeVisible()
          await capturar('dialogo-salir-borrador')
          await v
            .getByRole('dialog')
            .getByRole('button', { name: E.tema.dialogoSalir.descartar })
            .click()
          await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()

          // Asignado, personalizado y no disponible (otras canciones de la semilla).
          await abrirEditor(v, 'Neón con base anterior')
          await enEstilo(v)
          await capturar('tema-asignado')
          await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
          await abrirEditor(v, 'Personalizada de 0.1.0')
          await enEstilo(v)
          await capturar('tema-personalizado')
          await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
          await abrirEditor(v, 'Tema que ya no existe')
          await enEstilo(v)
          await capturar('tema-no-disponible')
          await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()

          // Eliminar un tema (con 2 canciones).
          await abrirEditor(v, 'Bohemian Rhapsody')
          await enEstilo(v)
          await menuTema(v)
          await v.getByRole('menuitem', { name: E.tema.eliminar }).click()
          await expect(v.getByRole('dialog', { name: TEMA.eliminar.titulo('Sol') })).toBeVisible()
          await capturar('dialogo-eliminar')
          void datos
        },
        { dpr: f.dpr }
      )

      // Catálogo vacío.
      await conTemas(
        `cap-editor-vacio-${f.dpr}`,
        async (v, _datos, app) => {
          const capturar = await preparar(app, v, 'editor', f)
          await abrirEditor(v, 'Canción lista')
          await enEstilo(v)
          await v.getByRole('radio', { name: /^Temas definidos/ }).click()
          await expect(v.getByText(E.tema.catalogoVacio)).toBeVisible()
          await capturar('tema-catalogo-vacio')
        },
        {
          dpr: f.dpr,
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
  }

  // ------------------------------------------------------------------ biblioteca
  const FORMATOS_BIB: Formato[] = [
    { ancho: 1280, alto: 800, dpr: 1 },
    { ancho: 1280, alto: 720, dpr: 1.25 }
  ]
  const tarjeta = (v: Page, titulo: string) =>
    v.getByRole('article', {
      name: new RegExp(`^${titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`)
    })

  for (const f of FORMATOS_BIB) {
    test(`biblioteca ${f.ancho}x${f.alto} al ${escala(f.dpr)} %`, async () => {
      await conTemas(
        `cap-bib-${f.dpr}`,
        async (v, datos, app) => {
          const capturar = await preparar(app, v, 'biblioteca', f)
          const agrupar = (por: string) => v.getByRole('radio', { name: por, exact: true }).click()

          await agrupar('Artista')
          await v.getByRole('heading', { name: 'Plegar Queen', level: 2 }).scrollIntoViewIfNeeded()
          await capturar('artista')
          await agrupar('Álbum')
          await v
            .getByRole('heading', { name: 'Plegar Greatest Hits — ABBA', level: 2 })
            .scrollIntoViewIfNeeded()
          await capturar('album')
          await agrupar('Artista')
          await v
            .getByRole('heading', { name: 'Plegar Sin artista', level: 2 })
            .scrollIntoViewIfNeeded()
          await capturar('sin-metadatos')
          await v.getByRole('radio', { name: 'Sin agrupar', exact: true }).click()
          await v.evaluate(() => document.querySelector('main')!.scrollTo(0, 0))

          const buscar = v.getByRole('searchbox', { name: /^Buscar título/ })
          await buscar.fill('opera')
          await expect(v.getByRole('article')).toHaveCount(1)
          await capturar('busqueda-album')
          await buscar.fill('')

          // Selección con «fuera de la vista».
          await agrupar('Álbum')
          await v.getByRole('button', { name: SEL.boton, exact: true }).click()
          await tarjeta(v, 'Dancing Queen').getByRole('checkbox').check()
          await tarjeta(v, 'Doble uno').getByRole('checkbox').check()
          await tarjeta(v, 'Bohemian Rhapsody').getByRole('checkbox').check()
          await buscar.fill('doble')
          await expect(v.getByText(SEL.fuera(2))).toBeVisible()
          await capturar('seleccion')
          await buscar.fill('')
          await v.evaluate(() => document.querySelector('main')!.scrollTo(0, 0))

          // Aplicar tema a 3 canciones.
          await v.getByRole('button', { name: SEL.aplicarTema }).click()
          const d = v.getByRole('dialog')
          await d.getByRole('button', { name: /^Tema:/ }).click()
          await v.getByRole('option', { name: /^Neón/ }).click()
          await expect(d.getByRole('button', { name: /^Aplicar a \d+ canciones?$/ })).toBeVisible()
          await capturar('dialogo-aplicar-tema')
          // Un fallo de escritura para mostrar el resultado con «Revisar y reintentar».
          envenenarEscritura(rutaCancion(datos, idTemas(40)))
          await d.getByRole('button', { name: /^Aplicar a \d+ canciones?$/ }).click()
          await expect(d.getByRole('button', { name: LOTE.reintentar })).toBeVisible()
          await capturar('resultado-lote', { conFoco: true })
          await d.getByRole('button', { name: LOTE.cerrar }).click()
          await v.getByRole('button', { name: SEL.terminar }).click()

          // Tema del grupo.
          await v
            .getByRole('button', { name: 'Tema del álbum Álbum Doble…' })
            .scrollIntoViewIfNeeded()
          await v.getByRole('button', { name: 'Tema del álbum Álbum Doble…' }).click()
          const g = v.getByRole('dialog', {
            name: BIB_GRUPO.tituloAlbum('Álbum Doble', 'Artista Doble')
          })
          await g.getByRole('button', { name: /^Tema:/ }).click()
          await v.getByRole('option', { name: /^Sol/ }).click()
          await expect(g.getByText(BIB_GRUPO.futuras('album'))).toBeVisible()
          await capturar('dialogo-tema-grupo')
          await g.getByRole('button', { name: TEMA.cancelar }).click()

          // Foco tras mover: «Editar datos» cambia el artista y la tarjeta cambia de grupo.
          await agrupar('Artista')
          const t = tarjeta(v, 'Doble dos')
          await t.scrollIntoViewIfNeeded()
          await v.waitForTimeout(500)
          await t.getByRole('button', { name: 'Más acciones de «Doble dos»' }).click()
          await v.getByRole('menuitem', { name: 'Editar datos' }).dispatchEvent('click')
          const ed = v.getByRole('dialog', { name: 'Editar datos' })
          await ed.getByLabel('Artista').fill('Queen')
          await ed.getByRole('button', { name: /^Guardar/ }).click()
          await expect(tarjeta(v, 'Doble dos')).toBeFocused()
          await capturar('foco-tras-mover', { conFoco: true })
        },
        { dpr: f.dpr }
      )
    })
  }

  // ------------------------------------------------------------------ ajustes
  const F_AJ: Formato = { ancho: 1280, alto: 800, dpr: 1 }

  /** Abre Ajustes › Temas con una preparación de datos y captura el estado. */
  async function ajustes(
    nombre: string,
    estado: string,
    preparar_: ((datos: string) => void) | undefined,
    accion?: (v: Page) => Promise<void>
  ): Promise<void> {
    await conTemas(
      `cap-aj-${estado}`,
      async (v, _datos, app) => {
        const capturar = await preparar(app, v, 'ajustes', F_AJ)
        await v.getByRole('button', { name: 'Ajustes', exact: true }).click()
        const seccion = v.getByRole('group', { name: AJT.titulo })
        await expect(seccion).toBeVisible()
        await seccion.scrollIntoViewIfNeeded()
        await v.waitForTimeout(400)
        if (accion) await accion(v)
        await capturar(estado)
        void nombre
      },
      preparar_ ? { preparar: preparar_ } : {}
    )
  }
  const fijarCatalogo =
    (cambio: (c: Catalogo) => void) =>
    (datos: string): void => {
      const c = leerCatalogo(datos)
      cambio(c)
      escribirCatalogo(datos, c)
    }

  test('ajustes 1280x800 al 100 %: temas, sin predeterminado, vacío, apartado, solo lectura, borrado pendiente, faltan', async () => {
    await ajustes('temas', 'temas', undefined)
    await ajustes(
      'sin predeterminado',
      'temas-sin-predeterminado',
      fijarCatalogo((c) => {
        c.predeterminado = null
      })
    )
    await ajustes('vacío', 'temas-vacio', (datos) =>
      writeFileSync(
        rutaCatalogo(datos),
        JSON.stringify({
          ...catalogoDeSemilla(),
          temas: [],
          predeterminado: null,
          asignaciones: { artistas: [], albumes: [] }
        })
      )
    )
    await ajustes('apartado', 'temas-apartado', (datos) =>
      writeFileSync(rutaCatalogo(datos), '{ esto no es json')
    )
    await ajustes('solo lectura', 'temas-solo-lectura', (datos) =>
      writeFileSync(
        rutaCatalogo(datos),
        JSON.stringify({ ...catalogoDeSemilla(), esquema: 99 }, null, 2)
      )
    )
    await ajustes(
      'borrado pendiente',
      'temas-borrado-pendiente',
      fijarCatalogo((c) => {
        c.borrado_pendiente = {
          tema_id: TEMA_NEON,
          iniciado: '2026-11-09T10:00:00.000Z',
          canciones: [idTemas(31), idTemas(32)]
        }
      })
    )
    await ajustes('faltan', 'temas-faltan', (datos) => {
      for (const n of [34, 35]) {
        modificarCancion(datos, idTemas(n), (c) => {
          c.apariencia = {
            modo: 'tema',
            tema_id: '7e3a0000-0000-4000-8000-000000000098',
            tema_nombre: 'Otro tema'
          }
        })
      }
    })

    await ajustes('diálogo predeterminado', 'dialogo-predeterminado', undefined, async (v) => {
      const seccion = v.getByRole('group', { name: AJT.titulo })
      await seccion.getByRole('button', { name: `${AJT.selector}: Noche ninja` }).click()
      await v.getByRole('option', { name: /^Sol/ }).click()
      await expect(v.getByRole('dialog')).toBeVisible()
    })
    await ajustes('diálogo quitar', 'dialogo-quitar-predeterminado', undefined, async (v) => {
      const seccion = v.getByRole('group', { name: AJT.titulo })
      await seccion.getByRole('button', { name: `${AJT.selector}: Noche ninja` }).click()
      await v.getByRole('option', { name: /^Ninguno/ }).click()
      const d = v.getByRole('dialog')
      await expect(d).toBeVisible()
      // Lista revelada: «Ver las canciones».
      await d.getByRole('button', { name: TEMA.verCanciones }).click()
      await expect(d.getByRole('button', { name: TEMA.ocultarCanciones })).toBeVisible()
    })
    await ajustes(
      'diálogo eliminar predeterminado',
      'dialogo-eliminar-predeterminado',
      undefined,
      async (v) => {
        const seccion = v.getByRole('group', { name: AJT.titulo })
        await seccion
          .getByRole('listitem', { name: /^Noche ninja, predeterminado/ })
          .getByRole('button', { name: AJT.menu.etiqueta('Noche ninja') })
          .click()
        await v.getByRole('menuitem', { name: AJT.menu.eliminar }).click()
        await expect(
          v.getByRole('dialog', { name: TEMA.eliminar.titulo('Noche ninja') })
        ).toBeVisible()
      }
    )
    void TEMA_NOCHE_NINJA
    void TEMA_SOL
    void leerCancion
  })
})
