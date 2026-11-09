import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { copyFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { cpus, release, totalmem } from 'node:os'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import { pulsosFlac } from '../src/main/biblioteca/flac'
import type { ApiShinobi } from '../src/shared/ipc'
import { TEXTO } from '../src/renderer/src/vistas/letra/textos'
import { TEXTO_ELEGIDA } from '../src/renderer/src/vistas/letra/textosElegida'
import { TEXTO_PEGAR } from '../src/renderer/src/vistas/letra/textosPegar'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { R } from '../src/renderer/src/vistas/reproductor/textos'
import {
  lanzar as lanzarSeparacion,
  leerCancion,
  preparar as prepararSeparacion,
  tarjeta
} from './fixtures/separacion'
import { abrirEditor, conEditor, idSemilla } from './fixtures/editor'

/**
 * Editor sin red: semilla de desarrollo con audio de 30 s, salida silenciada y LRCLIB apuntando
 * a un puerto cerrado. La fase 2 también compara el cabezal con el reloj audible de Chromium.
 */

/** Id de la semilla de la canción `n` (la 11 tiene el JSON dañado a propósito: no se puede buscar por título). */
const ID: Record<string, string> = {}
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

const lineasDe = (datos: string, titulo: string): Linea[] =>
  leerCancion(datos, idDe(titulo)).letra.lineas
const soloLineas = (datos: string, titulo: string): Linea[] =>
  lineasDe(datos, titulo).filter((l) => l.tipo === 'linea')

const abrir = abrirEditor

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

  test('fin independiente: conserva la marca y muestra el hueco al buscar con offset', async () => {
    await conEditor(
      'editor-fin-independiente',
      async (v, datos) => {
        await abrir(v, T19)
        await opcionLinea(v, 1).click()
        const fin = v.getByRole('textbox', { name: E.fin, exact: true })
        await fin.fill('00:15.80')
        await fin.press('Enter')
        await expect.poll(() => soloLineas(datos, T19)[0]!.fin_ms).toBe(15_800)
        await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
        await abrir(v, T19)
        await opcionLinea(v, 1).click()
        await expect(fin).toHaveValue('00:15.80')
        await expect(opcionLinea(v, 2)).toContainText('00:17.10')

        for (let i = 0; i < 5; i++) await v.keyboard.press('.')
        await expect.poll(() => leerCancion(datos, idDe(T19)).letra.offset_ms).toBe(500)

        const barra = v.getByRole('slider', { name: 'Tiempo de reproducción' })
        await v.getByRole('button', { name: 'Reproducir', exact: true }).click()
        await expect(v.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible()
        // A 15,90 s de audio el verso sigue activo por el desplazamiento de +500 ms.
        await barra.fill('15900')
        await expect(v.locator('[data-linea="i1"]')).toBeVisible()
        await barra.fill('16500')
        await expect(v.locator('[data-linea]')).toHaveCount(0)
        await barra.fill('17300')
        await expect(v.locator('[data-linea="i2"]')).toBeVisible()

        await v.getByRole('button', { name: E.botonProbar }).click()
        const capa = v.getByRole('dialog', { name: /Reproductor de/ })
        await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible({
          timeout: 10_000
        })
        const tiempo = capa.getByRole('slider', { name: 'Barra de tiempo' })
        await tiempo.fill('15900')
        await expect(capa.locator('[data-linea="i1"]')).toBeVisible()
        await tiempo.fill('16500')
        await expect(capa.locator('[data-linea]')).toHaveCount(0)
        await expect(capa.getByText('El faro nos espera', { exact: true })).toBeVisible()
        await expect(capa.locator('[data-linea="i2"]')).toBeVisible()
      },
      (datos) => {
        const cancion = leerCancion(datos, idDe(T19))
        cancion.letra.lineas = [
          { ...cancion.letra.lineas[0], inicio_ms: 12_400, fin_ms: null },
          {
            ...cancion.letra.lineas[1],
            texto: 'El faro nos espera',
            inicio_ms: 17_100,
            fin_ms: 20_300
          }
        ]
        writeFileSync(join(datos, 'biblioteca', idDe(T19), 'cancion.json'), JSON.stringify(cancion))
      }
    )
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

const rangoTimeline = (v: Page) => v.getByRole('slider', { name: E.timeline.regla })
const tiempoEditor = (v: Page) => v.getByRole('slider', { name: 'Tiempo de reproducción' })
const botonBucle = (v: Page) => v.getByRole('checkbox', { name: E.timeline.bucle })
const cabezalTimeline = (v: Page) =>
  v.getByRole('region', { name: E.timeline.titulo }).locator('[data-cabezal]')

async function dragMarcador(v: Page, borde: string, cambioMs: number): Promise<void> {
  const marcador = v.getByRole('slider', { name: borde, exact: true })
  await marcador.scrollIntoViewIfNeeded()
  const escala = await rangoTimeline(v).evaluate((r: HTMLInputElement) => {
    return r.getBoundingClientRect().width / (Number(r.max) - Number(r.min))
  })
  const caja = (await marcador.boundingBox())!
  const x = caja.x + caja.width / 2
  const y = caja.y + caja.height / 2
  await v.mouse.move(x, y)
  await v.mouse.down()
  await v.mouse.move(x + cambioMs * escala, y, { steps: 4 })
}

function tiemposCortos(datos: string, offset: number, fin: number, titulo = T19): void {
  const cancion = leerCancion(datos, idDe(titulo))
  cancion.letra.offset_ms = offset
  cancion.letra.lineas = [
    { ...cancion.letra.lineas[0], inicio_ms: 2000, fin_ms: fin },
    {
      ...cancion.letra.lineas.filter((l: Linea) => l.tipo === 'linea')[1],
      inicio_ms: 6000,
      fin_ms: 9000
    }
  ]
  writeFileSync(join(datos, 'biblioteca', idDe(titulo), 'cancion.json'), JSON.stringify(cancion))
}

test.describe('línea de tiempo del editor', () => {
  test.describe.configure({ timeout: 45_000 })

  test('los marcadores previsualizan, cancelan y guardan un único paso con y sin offset', async () => {
    await conEditor(
      'timeline-marcadores',
      async (v, datos) => {
        await abrir(v, T19)
        await opcionLinea(v, 1).click()
        const inicio = v.getByRole('slider', { name: E.timeline.inicio })
        const fin = v.getByRole('slider', { name: E.timeline.fin, exact: true })
        const guardada = () => soloLineas(datos, T19)[0]!
        await expect(inicio).toHaveAttribute('aria-valuenow', '2000')
        await dragMarcador(v, E.timeline.inicio, 800)
        await expect(inicio).not.toHaveAttribute('aria-valuenow', '2000')
        expect(guardada().inicio_ms).toBe(2000)
        await v.keyboard.press('Escape')
        await v.mouse.up()
        await expect(inicio).toHaveAttribute('aria-valuenow', '2000')
        expect(guardada().inicio_ms).toBe(2000)

        await dragMarcador(v, E.timeline.inicio, 800)
        await v.mouse.up()
        const desplazada = Number(await inicio.getAttribute('aria-valuenow'))
        expect(Math.abs(desplazada - 2800)).toBeLessThan(45)
        await expect.poll(() => guardada().inicio_ms).toBe(desplazada)
        await v.keyboard.press('ControlOrMeta+z')
        await expect(inicio).toHaveAttribute('aria-valuenow', '2000')
        await expect.poll(() => guardada().inicio_ms).toBe(2000)
        await inicio.press('Shift+ArrowRight')
        await expect.poll(() => guardada().inicio_ms).toBe(2100)

        for (let i = 0; i < 5; i++) await v.keyboard.press('.')
        await expect(fin).toHaveAttribute('aria-valuenow', '4500')
        await dragMarcador(v, E.timeline.fin, 500)
        await v.mouse.up()
        const finAudio = Number(await fin.getAttribute('aria-valuenow'))
        expect(Math.abs(finAudio - 5000)).toBeLessThan(45)
        await expect.poll(() => guardada().fin_ms).toBe(finAudio - 500)
        expect(leerCancion(datos, idDe(T19)).letra.offset_ms).toBe(500)
        expect(soloLineas(datos, T19)[1]!.inicio_ms).toBe(6000)
      },
      (datos) => tiemposCortos(datos, 0, 4000)
    )
  })

  test('el bucle nativo mantiene la fase audible, se pausa y restaura al salir', async () => {
    await conEditor(
      'timeline-bucle',
      async (v, datos) => {
        await v.evaluate(() => {
          type Fuente = { nodo: AudioBufferSourceNode; inicio: number; offset: number }
          const observado = window as typeof window & { fuenteBucle?: Fuente }
          const start = AudioBufferSourceNode.prototype.start
          AudioBufferSourceNode.prototype.start = function (
            this: AudioBufferSourceNode,
            when = 0,
            offset = 0,
            duration?: number
          ) {
            if (this.loop) observado.fuenteBucle = { nodo: this, inicio: when, offset }
            if (duration === undefined) start.call(this, when, offset)
            else start.call(this, when, offset, duration)
          }
        })
        await abrir(v, T17)
        await opcionLinea(v, 1).click()
        await tiempoEditor(v).fill('6000')
        const bucle = botonBucle(v)
        const pausa = v.getByRole('button', { name: 'Pausar', exact: true })
        const reproduce = v.getByRole('button', { name: 'Reproducir', exact: true })
        await bucle.check()
        await expect(pausa).toBeVisible()
        const fase = await cabezalTimeline(v).evaluate(
          (cabezal) =>
            new Promise<{
              vueltas: number
              muestras: number
              errorMax: number
            }>((resolve) => {
              const fuente = (
                window as typeof window & {
                  fuenteBucle?: { nodo: AudioBufferSourceNode; inicio: number; offset: number }
                }
              ).fuenteBucle
              if (!fuente) throw new Error('No se inició una fuente Web Audio en bucle')
              const ctx = fuente.nodo.context as AudioContext
              const fin = performance.now() + 2100
              const periodo = fuente.nodo.loopEnd - fuente.nodo.loopStart
              let vueltas = 0
              let previo = 0
              let muestras = 0
              let errorMax = 0
              function medir() {
                const ahora = performance.now()
                const observado = Number.parseFloat((cabezal as HTMLElement).style.left) * 300
                const marca = ctx.getOutputTimestamp()
                if (Number.isFinite(observado)) {
                  const oido =
                    marca.performanceTime && marca.contextTime !== undefined
                      ? marca.contextTime + (ahora - marca.performanceTime) / 1000
                      : ctx.currentTime - (ctx.outputLatency + ctx.baseLatency)
                  const transcurrido = fuente!.offset + Math.max(0, oido - fuente!.inicio)
                  const esperado = (transcurrido % periodo) * 1000
                  const error = Math.abs(esperado - observado)
                  errorMax = Math.max(errorMax, Math.min(error, Math.abs(error - periodo * 1000)))
                  if (previo > observado + 300) vueltas++
                  previo = observado
                  muestras++
                }
                if (ahora < fin) requestAnimationFrame(medir)
                else resolve({ vueltas, muestras, errorMax })
              }
              requestAnimationFrame(medir)
            })
        )
        expect(fase.vueltas).toBeGreaterThanOrEqual(2)
        expect(fase.muestras).toBeGreaterThan(10)
        expect(fase.errorMax).toBeLessThanOrEqual(20)
        const finMarcador = v.getByRole('slider', { name: E.timeline.fin, exact: true })
        await finMarcador.press('Shift+ArrowRight')
        await expect
          .poll(() =>
            v.evaluate(() => {
              const f = (
                window as typeof window & { fuenteBucle?: { nodo: AudioBufferSourceNode } }
              ).fuenteBucle
              return f?.nodo.loopEnd
            })
          )
          .toBe(0.9)
        await finMarcador.press('Shift+ArrowLeft')
        await expect.poll(() => soloLineas(datos, T17)[0]!.fin_ms).toBe(3300)

        const lenta = v.getByRole('radio', { name: '0,5×' })
        await lenta.click()
        await expect(lenta).toBeChecked()
        await expect
          .poll(() =>
            v.evaluate(() => {
              const f = (
                window as typeof window & { fuenteBucle?: { nodo: AudioBufferSourceNode } }
              ).fuenteBucle
              return f?.nodo.playbackRate.value
            })
          )
          .toBe(0.5)

        // Al acortar el fin por debajo de cero, el gesto pausa sin desarmar.
        await dragMarcador(v, E.timeline.fin, -950)
        await expect(reproduce).toBeVisible()
        await expect(bucle).toBeChecked()
        await v.keyboard.press('Escape')
        await v.mouse.up()
        await expect(pausa).toBeVisible()
        await expect(bucle).toBeChecked()
        expect(soloLineas(datos, T17)[0]!.fin_ms).toBe(3300)

        await pausa.click()
        await expect(reproduce).toBeVisible()
        const pausado = await tiempoEditor(v).inputValue()
        await expect(tiempoEditor(v)).toHaveValue(pausado)
        await reproduce.click()
        await expect(pausa).toBeVisible()
        await dragMarcador(v, E.timeline.fin, -950)
        await v.mouse.up()
        await expect(bucle).not.toBeChecked()
        await expect(reproduce).toBeVisible()
        await expect(tiempoEditor(v)).toHaveValue('6000')
        await expect.poll(() => soloLineas(datos, T17)[0]!.fin_ms!).toBeLessThan(2500)
      },
      (datos) => {
        tiemposCortos(datos, -2500, 3300, T17)
        writeFileSync(
          join(datos, 'biblioteca', idDe(T17), 'fuente', 'mezcla.flac'),
          pulsosFlac({ segundos: 30, periodoMs: 400, desfaseMs: 100 })
        )
      }
    )
  })
})

const timeline = (v: Page) => v.getByRole('region', { name: E.timeline.titulo })
const lienzosOnda = (v: Page) => timeline(v).locator('canvas')
const limitesRegla = (v: Page) =>
  rangoTimeline(v).evaluate((r: HTMLInputElement) => [Number(r.min), Number(r.max)] as const)

async function esperarOnda(v: Page): Promise<void> {
  await expect(lienzosOnda(v)).toHaveCount(2, { timeout: 20_000 })
  await expect
    .poll(
      () =>
        lienzosOnda(v).evaluateAll(
          (lienzos) =>
            lienzos.length === 2 &&
            lienzos.every((nodo) => {
              const canvas = nodo as HTMLCanvasElement
              if (!canvas.width || !canvas.height) return false
              const pixeles = canvas
                .getContext('2d')
                ?.getImageData(0, 0, canvas.width, canvas.height).data
              return pixeles?.some((p, i) => i % 4 === 3 && p !== 0)
            })
        ),
      { timeout: 20_000 }
    )
    .toBe(true)
}

test('línea de tiempo: zoom, minimapa y resize conservan el cabezal y la voz se regenera', async () => {
  test.setTimeout(65_000)
  const entorno = prepararSeparacion('timeline-picos', { segundos: 2, pasos: 6 })
  await sembrar(entorno.datos)
  const app = await lanzarSeparacion(entorno, {
    SHINOBI_SILENCIAR_AUDIO: '1',
    SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1'
  })
  try {
    const v = await app.firstWindow()
    await abrir(v, T18)
    await expect(timeline(v).getByRole('status')).toHaveText(
      'Disponible cuando termine la separación.'
    )
    await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
    await abrir(v, T19)
    await esperarOnda(v)
    const pistas = join(entorno.datos, 'biblioteca', idDe(T19), 'pistas')
    const caches = () =>
      readdirSync(pistas).filter((n) => /^\.picos-voz-v1-[a-f0-9]{64}\.bin$/.test(n))
    const [anterior] = caches()
    expect(anterior).toBeDefined()
    await tiempoEditor(v).fill('8000')

    const [inicio, fin] = await limitesRegla(v)
    await rangoTimeline(v).scrollIntoViewIfNeeded()
    const { x, y, width, height } = (await rangoTimeline(v).boundingBox())!
    const fraccion = 0.37
    await v.mouse.move(x + width * fraccion, y + height / 2)
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await v.keyboard.down(mod)
    await v.mouse.wheel(0, -200)
    await v.keyboard.up(mod)
    await expect
      .poll(async () => {
        const [a, b] = await limitesRegla(v)
        return b - a
      })
      .toBeLessThan(fin - inicio)
    const [a, b] = await limitesRegla(v)
    expect(Math.abs(a + (b - a) * fraccion - (inicio + (fin - inicio) * fraccion))).toBeLessThan(50)

    await v.getByRole('slider', { name: E.timeline.general }).press('ArrowRight')
    await expect.poll(async () => (await limitesRegla(v))[0]).toBeGreaterThan(a)
    const vista = await limitesRegla(v)
    await expect(tiempoEditor(v)).toHaveValue('8000')
    const ancho = await lienzosOnda(v).first().getAttribute('width')
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setContentSize(1100, 700)
    )
    await expect(lienzosOnda(v).first()).not.toHaveAttribute('width', ancho!)
    expect(await limitesRegla(v)).toEqual(vista)
    await expect(tiempoEditor(v)).toHaveValue('8000')
    await esperarOnda(v)

    // El flujo normal solo permite re-separar si faltan pistas. La voz aún existe y se reemplazará.
    unlinkSync(join(pistas, 'instrumental.flac'))
    const reiniciada = await v.evaluate(async (id) => {
      const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi
      try {
        await api.biblioteca.comprobarPistas(id)
        await api.separacion.separar(id)
        return null
      } catch (e) {
        return e
      }
    }, idDe(T19))
    expect(reiniciada).toBeNull()
    await expect
      .poll(() => caches().some((archivo) => archivo !== anterior), { timeout: 25_000 })
      .toBe(true)
    await esperarOnda(v)
    expect(caches()).toHaveLength(1)
  } finally {
    await app.close().catch(() => undefined)
  }
})

const DENSIDADES = [1, 1.25, 1.5]
const TAMANOS_VENTANA = [
  [1300, 800],
  [1700, 900],
  [1250, 800]
] as const

const anchoPagina = (v: Page) =>
  v.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    ventana: window.innerWidth
  }))

async function ajustarVentana(app: ElectronApplication, ancho: number, alto: number) {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w!, h!),
    [ancho, alto]
  )
}

for (const dpr of DENSIDADES) {
  test(`el editor no desborda en horizontal con el cabezal fuera de la vista (DPR ${dpr})`, async () => {
    test.setTimeout(75_000)
    await conEditor(
      `ancho-cabezal-${dpr}`,
      async (v, _datos, app) => {
        await abrir(v, T19)
        expect(await v.evaluate(() => window.devicePixelRatio)).toBe(dpr)
        const comprobar = async (contexto: string) => {
          const { scroll, ventana } = await anchoPagina(v)
          expect(scroll, contexto).toBeLessThanOrEqual(ventana)
        }
        await comprobar('en espera')
        for (let i = 0; i < 6; i++) await v.getByRole('button', { name: E.timeline.mas }).click()
        await v.getByRole('button', { name: E.timeline.cabezal }).click()
        await v.getByRole('button', { name: 'Reproducir', exact: true }).click()
        await expect(v.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible()
        for (let i = 0; i < 20; i++) {
          await v.waitForTimeout(500)
          await comprobar(`reproduciendo, muestra ${i}`)
        }
        // El cabezal ya salió por la derecha: no ocupa espacio.
        await expect(cabezalTimeline(v)).toHaveCSS('display', 'none')
        for (const [ancho, alto] of TAMANOS_VENTANA) {
          await ajustarVentana(app, ancho, alto)
          await expect
            .poll(async () => Math.abs((await anchoPagina(v)).ventana - ancho))
            .toBeLessThanOrEqual(2)
          await v.waitForTimeout(300)
          await comprobar(`tras redimensionar a ${ancho}`)
        }
      },
      undefined,
      dpr
    )
  })
}

for (const dpr of DENSIDADES) {
  test(`la forma de onda y el minimapa tienen ancho estable y siguen al contenedor (DPR ${dpr})`, async () => {
    test.setTimeout(90_000)
    const entorno = prepararSeparacion(`ancho-onda-${dpr}`, { segundos: 2, pasos: 6 })
    await sembrar(entorno.datos)
    const app = await lanzarSeparacion(
      entorno,
      { SHINOBI_SILENCIAR_AUDIO: '1', SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1' },
      [`--force-device-scale-factor=${dpr}`]
    )
    try {
      const v = await app.firstWindow()
      await abrir(v, T19)
      expect(await v.evaluate(() => window.devicePixelRatio)).toBe(dpr)
      await esperarOnda(v)
      const medidas = () =>
        lienzosOnda(v).evaluateAll((lienzos) =>
          lienzos.map((nodo) => ({
            canvas: nodo.getBoundingClientRect().width,
            contenedor: nodo.parentElement!.getBoundingClientRect().width
          }))
        )
      const inicial = await medidas()
      await v.waitForTimeout(3000)
      expect((await medidas()).map((m) => m.canvas)).toEqual(inicial.map((m) => m.canvas))

      let previo = inicial[0]!.contenedor
      for (const [i, [ancho, alto]] of TAMANOS_VENTANA.entries()) {
        await ajustarVentana(app, ancho, alto)
        await expect
          .poll(async () => {
            const m = await medidas()
            return m.every((x) => Math.abs(x.canvas - x.contenedor) <= 1)
          })
          .toBe(true)
        await v.waitForTimeout(500)
        const final = await medidas()
        final.forEach((m) => expect(Math.abs(m.canvas - m.contenedor)).toBeLessThanOrEqual(1))
        if (i === 1) expect(final[0]!.contenedor).toBeGreaterThan(previo)
        if (i === 2) expect(final[0]!.contenedor).toBeLessThan(previo)
        previo = final[0]!.contenedor
        const { scroll, ventana } = await anchoPagina(v)
        expect(scroll).toBeLessThanOrEqual(ventana)
      }
    } finally {
      await app.close().catch(() => undefined)
    }
  })
}

const audioPerfil = process.env.SHINOBI_PERFIL_PICOS

test('perfil opt-in: una hora de voz, zoom y reproducción', async () => {
  test.skip(!audioPerfil, 'Solo se ejecuta con un FLAC sintético de una hora')
  test.setTimeout(150_000)
  await conEditor(
    'perfil-picos',
    async (v, datos, app) => {
      const medirCPU = () =>
        app.evaluate(({ app }) =>
          app.getAppMetrics().map((p) => ({
            tipo: p.type,
            cpu: p.cpu.percentCPUUsage,
            memoriaKiB: p.memory.workingSetSize
          }))
        )
      const inicio = performance.now()
      await abrir(v, T19)
      await esperarOnda(v)
      const frioMs = Math.round(performance.now() - inicio)
      const pistas = join(datos, 'biblioteca', idDe(T19), 'pistas')
      const nombre = readdirSync(pistas).find((n) => n.endsWith('.bin'))!
      const archivo = join(pistas, nombre)
      const cache = statSync(archivo)
      await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
      const reapertura = performance.now()
      await abrir(v, T19)
      await esperarOnda(v)
      const calidoMs = Math.round(performance.now() - reapertura)
      expect(statSync(archivo).mtimeMs).toBe(cache.mtimeMs)

      await expect(rangoTimeline(v)).toHaveAttribute('max', '3600000')
      await v.getByRole('button', { name: E.timeline.mas }).click()
      const [a, b] = await limitesRegla(v)
      const lectura = await v.evaluate(
        async ({ id, a, b }) => {
          const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi
          const ancho = document
            .querySelector<HTMLCanvasElement>('canvas')!
            .getBoundingClientRect().width
          const presupuesto = Math.min(4096, Math.ceil(ancho))
          const p = await api.picos.leer({
            cancionId: id,
            inicioMs: a,
            finMs: b,
            presupuesto
          })
          return { bloques: p ? p.bytes.length / 4 : 0, presupuesto, pasoMs: p?.pasoMs }
        },
        { id: idDe(T19), a, b }
      )
      expect(lectura.bloques).toBeGreaterThan(0)
      expect(lectura.bloques).toBeLessThanOrEqual(lectura.presupuesto)
      await esperarOnda(v)

      await tiempoEditor(v).fill(String(Math.round((a + b) / 2)))
      const antes = Number(await tiempoEditor(v).inputValue())
      await v.getByRole('button', { name: 'Reproducir', exact: true }).click()
      await expect(v.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible()
      await medirCPU()
      const perfilar = () =>
        v.evaluate(async () => {
          let repintados = 0
          let bloques = 0
          let maxBloques = 0
          const prototipo = CanvasRenderingContext2D.prototype
          const limpiar = prototipo.clearRect
          const rellenar = prototipo.fillRect
          prototipo.clearRect = function (this: CanvasRenderingContext2D, x, y, ancho, alto) {
            repintados++
            bloques = 0
            limpiar.call(this, x, y, ancho, alto)
          }
          prototipo.fillRect = function (this: CanvasRenderingContext2D, x, y, ancho, alto) {
            maxBloques = Math.max(maxBloques, ++bloques)
            rellenar.call(this, x, y, ancho, alto)
          }
          const intervalos: number[] = []
          let anterior = performance.now()
          const inicio = anterior
          try {
            await new Promise<void>((resolve) => {
              function medir() {
                const ahora = performance.now()
                intervalos.push(ahora - anterior)
                anterior = ahora
                if (ahora - inicio < 1200) requestAnimationFrame(medir)
                else resolve()
              }
              requestAnimationFrame(medir)
            })
          } finally {
            prototipo.clearRect = limpiar
            prototipo.fillRect = rellenar
          }
          return {
            frames: intervalos.length,
            peorMs: Math.max(...intervalos),
            repintados,
            maxBloques
          }
        })
      const perfil = await perfilar()
      const medirZoom = perfilar()
      await v.getByRole('button', { name: E.timeline.mas }).click()
      const zoom = await medirZoom
      const procesos = await medirCPU()
      const despues = Number(await tiempoEditor(v).inputValue())
      await v.getByRole('button', { name: 'Pausar', exact: true }).click()
      expect(despues).toBeGreaterThan(antes)
      expect(perfil.repintados).toBe(0)
      expect(zoom.repintados).toBeGreaterThan(0)
      expect(zoom.maxBloques).toBeGreaterThan(0)
      expect(zoom.maxBloques).toBeLessThanOrEqual(lectura.presupuesto)
      console.log(
        JSON.stringify({
          frioMs,
          calidoMs,
          cacheBytes: cache.size,
          lectura,
          perfil,
          zoom,
          procesos,
          equipo: {
            cpu: cpus()[0]?.model,
            nucleos: cpus().length,
            memoriaBytes: totalmem(),
            so: release()
          }
        })
      )
    },
    (datos) => {
      const raiz = join(datos, 'biblioteca', idDe(T19))
      copyFileSync(audioPerfil!, join(raiz, 'pistas', 'voz.flac'))
      copyFileSync(audioPerfil!, join(raiz, 'fuente', 'mezcla.flac'))
      const cancion = leerCancion(datos, idDe(T19))
      cancion.metadatos.duracion_ms = 3_600_000
      writeFileSync(join(raiz, 'cancion.json'), JSON.stringify(cancion))
    }
  )
})
