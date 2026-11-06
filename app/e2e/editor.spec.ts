import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import { TEXTO } from '../src/renderer/src/vistas/letra/textos'
import { TEXTO_ELEGIDA } from '../src/renderer/src/vistas/letra/textosElegida'
import { TEXTO_PEGAR } from '../src/renderer/src/vistas/letra/textosPegar'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { leerCancion, tarjeta } from './fixtures/separacion'
import { crearTemporal } from './temporales'

/**
 * Editor sin red (0110, ADR 0010 §1): semilla de desarrollo (canciones 17–19 con audio de 30 s),
 * audio de Chromium silenciado y LRCLIB apuntando a un puerto cerrado. Solo se comprueban orden,
 * rangos amplios y lo guardado en disco; la precisión en ms es de 0094 y 0111.
 */

/** Id de la semilla de la canción `n` (la 11 tiene el JSON dañado a propósito: no se puede buscar por título). */
const ID: Record<string, string> = {}
const idSemilla = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`
const idDe = (titulo: string): string => ID[titulo]!

const T17 = 'Editor: pista de clics'
const T18 = 'Editor: separación interrumpida'
const T19 = 'Editor: lista incompleta'
ID[T17] = idSemilla(17)
ID[T18] = idSemilla(18)
ID[T19] = idSemilla(19)

interface Linea {
  tipo: 'linea' | 'pausa'
  texto?: string
  inicio_ms: number | null
  fin_ms: number | null
}

async function lanzar(datos: string): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      SHINOBI_SILENCIAR_AUDIO: '1',
      SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1'
    }
  })
}

/** Siembra, lanza, ejecuta la prueba y cierra siempre. */
async function conEditor(
  nombre: string,
  prueba: (v: Page, datos: string, app: ElectronApplication) => Promise<void>
): Promise<void> {
  const datos = crearTemporal(nombre)
  await sembrar(datos)
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
    await prueba(v, datos, app)
  } finally {
    await app.close().catch(() => undefined)
  }
}

const lineasDe = (datos: string, titulo: string): Linea[] =>
  leerCancion(datos, idDe(titulo)).letra.lineas
const soloLineas = (datos: string, titulo: string): Linea[] =>
  lineasDe(datos, titulo).filter((l) => l.tipo === 'linea')

/** Biblioteca → «Continuar» de la canción → editor con el audio cargado. */
async function abrir(v: Page, titulo: string): Promise<void> {
  // Filtrar sube las tarjetas al principio: un menú abierto en una tarjeta que hay que desplazar se cierra.
  await v.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(titulo)
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

const botonMarcar = (v: Page) => v.getByRole('button', { name: E.syncMarcar })
const contador = (v: Page, a: number, b: number) =>
  v.getByText(`${a}/${b} sincronizadas`, { exact: false }).first()
const opcionLinea = (v: Page, n: number) =>
  v.getByRole('option', { name: new RegExp(`^Línea ${n},`) })

/** S → cuenta atrás → listo para marcar. */
async function entrarSync(v: Page): Promise<void> {
  await v.keyboard.press('s')
  await expect(v.getByRole('heading', { name: E.syncTitulo })).toBeVisible()
  await expect(botonMarcar(v)).toBeEnabled({ timeout: 10_000 })
}

/** Marca `n` líneas con Intro separadas ~1 s. */
async function marcar(v: Page, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await v.keyboard.press('Enter')
    await v.waitForTimeout(1000)
  }
}

async function terminarSync(v: Page): Promise<void> {
  await v.keyboard.press('Escape')
  await expect(v.getByRole('heading', { name: E.syncTitulo })).toHaveCount(0)
}

test.describe('editor sin red', () => {
  test.describe.configure({ timeout: 90_000 })

  test('sincronizar en una pasada y marcar como lista', async () => {
    await conEditor('editor-sync', async (v, datos) => {
      await abrir(v, T17)
      await expect(v.getByText(E.sinSync)).toBeVisible()
      await expect(v.getByRole('button', { name: /^Sincronizar al ritmo/ })).toBeFocused()
      await entrarSync(v)
      await marcar(v, 12)
      await expect(v.getByText('12/12 sincronizadas ✓')).toBeVisible()
      await terminarSync(v)
      await expect
        .poll(() => soloLineas(datos, T17).filter((l) => l.inicio_ms !== null).length, {
          timeout: 5000
        })
        .toBe(12)
      const lineas = soloLineas(datos, T17)
      const inicios = lineas.map((l) => l.inicio_ms as number)
      inicios.forEach((ms, i) => {
        expect(ms).toBeLessThan(30_000)
        if (i > 0) expect(ms).toBeGreaterThan(inicios[i - 1]!)
      })
      expect(lineasDe(datos, T17).find((l) => l.tipo === 'pausa')!.inicio_ms).toBeNull()

      // Marcar como lista: vuelve a la Biblioteca con la tarjeta enfocada y resaltada.
      await v.getByRole('button', { name: E.marcarLista }).click()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await expect(v.getByText(`«${T17}» está lista para cantar.`)).toBeVisible()
      await expect(tarjeta(v, T17)).toBeFocused()
      await expect(v.locator('[data-resaltada]')).toHaveCount(1)
      await expect.poll(() => leerCancion(datos, idDe(T17)).estado).toBe('lista')
    })
  })

  test('mantener Intro marca el fin y Retroceso deshace la última marca', async () => {
    await conEditor('editor-fin', async (v, datos) => {
      await abrir(v, T17)
      await entrarSync(v)
      await v.keyboard.down('Enter')
      await v.waitForTimeout(600)
      await v.keyboard.up('Enter')
      await expect(contador(v, 1, 12)).toBeVisible()
      await v.waitForTimeout(500)
      await v.keyboard.press('Enter')
      await expect(contador(v, 2, 12)).toBeVisible()
      await v.keyboard.press('Backspace')
      await expect(contador(v, 1, 12)).toBeVisible()
      await terminarSync(v)
      await expect.poll(() => soloLineas(datos, T17)[0]!.fin_ms, { timeout: 5000 }).not.toBeNull()
      expect(soloLineas(datos, T17)[1]!.inicio_ms).toBeNull()
    })
  })

  test('ajuste fino, límites, deshacer/rehacer y desplazamiento', async () => {
    await conEditor('editor-ajuste', async (v, datos) => {
      await abrir(v, T19)
      await opcionLinea(v, 1).click()
      await expect(opcionLinea(v, 1)).toContainText('00:02.00')
      for (let i = 0; i < 3; i++) await v.keyboard.press('Alt+ArrowRight')
      await expect(opcionLinea(v, 1)).toContainText('00:02.03')
      await expect.poll(() => soloLineas(datos, T19)[0]!.inicio_ms).toBe(2030)
      await v.keyboard.press('ControlOrMeta+z')
      await expect(opcionLinea(v, 1)).toContainText('00:02.00')
      await v.keyboard.press('ControlOrMeta+Shift+z')
      await expect(opcionLinea(v, 1)).toContainText('00:02.03')

      // Empujar el inicio contra el de la línea siguiente (5500 ms).
      for (let i = 0; i < 40; i++) await v.keyboard.press('Alt+Shift+ArrowRight')
      await expect(v.getByRole('tooltip').getByText(E.limiteSiguiente(false))).toBeVisible()
      await expect
        .poll(() => soloLineas(datos, T19)[0]!.inicio_ms!, { timeout: 5000 })
        .toBeLessThanOrEqual(5500)

      // Desplazamiento de toda la letra.
      for (let i = 0; i < 3; i++) await v.keyboard.press('.')
      await expect.poll(() => leerCancion(datos, idDe(T19)).letra.offset_ms).toBe(300)
      await v.getByRole('button', { name: E.restablecer }).click()
      await expect.poll(() => leerCancion(datos, idDe(T19)).letra.offset_ms).toBe(0)
    })
  })

  test('estilo: aviso de contraste, letra blanca, fuente y guardado', async () => {
    await conEditor('editor-estilo', async (v, datos) => {
      await abrir(v, T17)
      await v.getByRole('radio', { name: 'Estilo', exact: true }).click()
      await v.getByRole('radio', { name: E.solido }).click()
      await v.getByRole('textbox', { name: E.color, exact: true }).fill('#2A0F36')
      await v.getByRole('textbox', { name: E.colorLetra, exact: true }).fill('#5A1E6E')
      await expect(v.getByText(E.contrasteLetra)).toBeVisible()
      // Punto de aviso en la pestaña mientras haya avisos.
      const pestana = v.getByRole('radio', { name: 'Estilo', exact: true })
      await expect(pestana.locator('[data-aviso]')).toHaveCount(1)
      await expect(pestana).toHaveAccessibleDescription('Hay avisos de contraste')
      await v.getByRole('button', { name: E.usarBlanca }).click()
      await expect(v.getByText(E.contrasteOk)).toBeVisible()
      await expect(pestana.locator('[data-aviso]')).toHaveCount(0)

      // Por teclado: desplazar la lista hasta la opción con el ratón cerraría el selector (scroll).
      // Con carga, un scroll tardío puede cerrarlo nada más abrirlo: se reintenta la apertura.
      const lista = v.getByRole('listbox', { name: 'Fuente' })
      await expect(async () => {
        if (!(await lista.count())) await v.getByRole('button', { name: /^Fuente: / }).click()
        await expect(lista).toBeFocused({ timeout: 1500 })
      }).toPass({ timeout: 15_000 })
      await v.keyboard.press('b')
      await expect(v.locator('[role="option"][data-activa]')).toContainText('Bangers')
      await v.keyboard.press('Enter')
      await expect
        .poll(() => leerCancion(datos, idDe(T17)).estilo, { timeout: 6000 })
        .toMatchObject({
          fondo: { tipo: 'solido', color: '#2A0F36' },
          letra: { color: '#FFFFFF', fuente: { familia: 'Bangers' } }
        })
    })
  })

  test('canción separándose: pistas inactivas y motivo en Marcar como lista', async () => {
    await conEditor('editor-separando', async (v) => {
      await abrir(v, T18)
      for (const nombre of [E.voz, E.instrumental]) {
        const radio = v.getByRole('radio', { name: nombre, exact: true })
        await expect(radio).toHaveAttribute('aria-disabled', 'true')
        // La semilla marca «en curso» al 42 %, pero al arrancar la app la reconcilia como
        // interrumpida (no hay trabajo vivo): el motivo es el de «sin pistas» (pregunta 0029).
        await expect(radio).toHaveAccessibleDescription(E.noDisponibleSeparar)
      }
      // aria-disabled: Playwright no lo pulsaría, pero el botón abre el popover con el motivo.
      await v.getByRole('button', { name: E.marcarLista }).click({ force: true })
      await expect(v.getByRole('heading', { name: E.faltaTitulo })).toBeVisible()
      await expect(v.getByRole('dialog').getByText(E.faltaSeparar)).toBeVisible()
      await expect(v.getByRole('button', { name: E.irSeparacion })).toBeVisible()
    })
  })

  test('lista incompleta: insignia y popover de Hecho', async () => {
    await conEditor('editor-incompleta', async (v) => {
      await abrir(v, T19)
      await expect(v.getByText('Falta 1 línea').first()).toBeVisible()
      await v.getByRole('button', { name: E.hecho }).click()
      await expect(
        v.getByRole('dialog', { name: E.hechoIncompleta(1) }).getByRole('paragraph')
      ).toBeVisible()
      await v.getByRole('button', { name: E.salirIgualmente }).click()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
    })
  })

  test('toast «Borrador guardado.» solo si hubo cambios', async () => {
    await conEditor('editor-borrador', async (v) => {
      const biblioteca = () => v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
      await abrir(v, T17)
      await biblioteca()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await v.waitForTimeout(1200)
      await expect(v.getByText(E.borradorGuardado)).toHaveCount(0)

      await abrir(v, T17)
      await v.keyboard.press('.')
      await biblioteca()
      await expect(v.getByText(E.borradorGuardado)).toBeVisible()
    })
  })

  test('corregir la letra conserva los tiempos de las líneas no modificadas', async () => {
    await conEditor('editor-corregir', async (v, datos) => {
      await abrir(v, T19)
      await v.getByRole('button', { name: E.corregir }).click()
      await expect(v.getByRole('heading', { level: 1, name: 'Letra' })).toBeVisible()
      const paso = v.getByRole('button', { name: /^Paso \d, Letra/ })
      await expect(paso).toHaveAttribute('aria-current', 'step')
      await expect(paso).toHaveAccessibleName(/paso actual/)
      const area = v.getByRole('textbox', { name: TEXTO_ELEGIDA.etiquetaArea })
      const texto = await area.inputValue()
      await area.fill(texto.replace('Hasta que vuelva', 'Hasta que vuelva el sol'))
      await expect
        .poll(() => soloLineas(datos, T19).at(-1)!.texto, { timeout: 6000 })
        .toBe('Hasta que vuelva el sol')
      await v.getByRole('button', { name: TEXTO_ELEGIDA.editor }).click()
      await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
      await expect(opcionLinea(v, 1)).toContainText('00:02.00')
      expect(soloLineas(datos, T19)[0]!.inicio_ms).toBe(2000)
      expect(soloLineas(datos, T19).at(-1)!.inicio_ms).toBeNull()
    })
  })

  test('cerrar la ventana con cambios pendientes los guarda', async () => {
    await conEditor('editor-cierre', async (v, datos, app) => {
      await abrir(v, T17)
      await v.getByRole('radio', { name: 'Estilo', exact: true }).click()
      await v.getByRole('textbox', { name: E.colorLetra, exact: true }).fill('#FFE600')
      await expect(v.getByRole('textbox', { name: E.colorLetra, exact: true })).toHaveValue(
        '#FFE600'
      )
      await app.close()
      expect(leerCancion(datos, idDe(T17)).estilo.letra.color).toBe('#FFE600')
    })
  })

  test('pegar más de 5000 renglones se rechaza', async () => {
    await conEditor('editor-largo', async (v, _datos, app) => {
      await abrir(v, T19)
      await v.getByRole('button', { name: E.corregir }).click()
      await v.getByRole('button', { name: TEXTO_ELEGIDA.otra }).click()
      await v.getByRole('button', { name: TEXTO.pegar }).click()
      const area = v.getByRole('textbox', { name: TEXTO_PEGAR.etiquetaArea, exact: true })
      // Pegado real (un solo evento): `fill` lo reparte por renglones y tarda ~25 s.
      await app.evaluate(({ clipboard }, texto) => clipboard.writeText(texto), 'a\n'.repeat(5001))
      await area.focus()
      await v.keyboard.press('ControlOrMeta+v')
      await expect(v.getByText(TEXTO_PEGAR.demasiado)).toBeVisible()
      await expect(v.getByRole('button', { name: TEXTO.usar })).toBeDisabled()
    })
  })
})
