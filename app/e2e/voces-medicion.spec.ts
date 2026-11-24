import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { ApiShinobi } from '../src/shared/ipc'
import { leerCancion, leerConfig, carpeta } from './fixtures/separacion'
import { sembrar } from '../src/main/biblioteca/semilla'
import { R } from '../src/renderer/src/vistas/reproductor/textos'
import { idSemilla, lanzar } from './fixtures/editor'
import { tarjeta } from './fixtures/separacion'
import { crearTemporal } from './temporales'

/**
 * Voces a la vez en la app real (0.2.3, 0360 · C1S-R1, C1S-R4): pausa en instantes del solape y lee la
 * opacidad EFECTIVA de cada línea (producto de la de sus ancestros), su mezcla con el gris y el color real
 * del texto resaltado. Una zona que suena pasada la transición `D` (350 ms) debe estar al 100 %.
 */
const TITULO = 'Voces a la vez: dúo con coro'
// Instantes con voces a la vez, a más de `D` del inicio de la línea más reciente y del fin de la más próxima.
// Color real del texto resaltado de cada zona (c1 = color de lo ya cantado; Iván = cian; coro = naranja).
const COLOR_REAL: Record<string, string> = {
  c1: 'color(srgb 1 0.831373 0)',
  c2: 'color(srgb 0.207843 0.776471 0.909804)',
  coro: 'color(srgb 1 0.623529 0.109804)'
}
const INSTANTES = [5200, 8000, 17_500]

test('en un solape cada línea que suena está al 100 % y con el color exacto de su parte', async () => {
  test.setTimeout(240_000)
  const datos = crearTemporal('voces-medicion')
  await sembrar(datos, { voces: true })
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
    await v.getByRole('searchbox', { name: /^Buscar título/ }).fill(TITULO)
    await tarjeta(v, TITULO)
      .getByRole('button', { name: /^Reproducir/ })
      .click()
    const capa = v.getByRole('dialog', { name: `Reproductor de «${TITULO}»` })
    await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible({
      timeout: 15_000
    })
    await capa.getByRole('button', { name: R.tooltip.pausa }).click()
    expect(idSemilla(52)).toBeTruthy()
    for (const ms of INSTANTES) {
      await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill(String(ms))
      await v.waitForTimeout(800)
      const medidas = await v.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-linea]')).map((nodo) => {
          let efectiva = 1
          for (let n: HTMLElement | null = nodo; n; n = n.parentElement) {
            efectiva *= parseFloat(getComputedStyle(n).opacity)
          }
          const resaltado = nodo.querySelector<HTMLElement>('[data-barrido] > span[aria-hidden]')
          return {
            zona: nodo.dataset.zona,
            id: nodo.dataset.linea,
            efectiva: Math.round(efectiva * 1000) / 1000,
            kOpacidad: nodo.style.getPropertyValue('--k-opacidad'),
            kGris: nodo.style.getPropertyValue('--k-gris'),
            colorTexto: resaltado ? getComputedStyle(resaltado).color : null,
            clip: resaltado ? getComputedStyle(resaltado).clipPath.slice(0, 40) : null
          }
        })
      )
      console.log(`VOCES t=${ms} ${JSON.stringify(medidas)}`)
      const suenan = medidas.filter((m) => m.clip !== 'inset(100%)')
      // C1S-R1: varias zonas suenan a la vez y cada una con línea en curso está al 100 %, sin gris.
      expect(new Set(suenan.map((m) => m.zona)).size, `t=${ms}`).toBeGreaterThanOrEqual(2)
      for (const m of suenan) {
        expect(m.efectiva, `${m.zona}/${m.id} a ${ms}`).toBe(1)
        expect(m.kGris).toBe('0')
        expect(m.colorTexto).toBe(COLOR_REAL[m.zona!])
      }
      if (process.env.SHINOBI_VOCES_FOTOS) {
        await v.screenshot({ path: `${process.env.SHINOBI_VOCES_FOTOS}/${ms}-a.png` })
        await v.waitForTimeout(1500)
        await v.screenshot({ path: `${process.env.SHINOBI_VOCES_FOTOS}/${ms}-b.png` })
      }
    }
  } finally {
    await app.close().catch(() => undefined)
  }
})

/** Píxeles con el color exacto de cada parte (con la tolerancia de la compresión) en fotogramas del video. */
function sondear(archivo: string, fotogramas: number[]): Record<string, number[]> {
  const uv = process.env.SHINOBI_UV ?? 'uv'
  const salida = execFileSync(
    uv,
    [
      'run',
      '--project',
      resolve(process.cwd(), '..', 'worker'),
      'python',
      '-c',
      [
        'import av, json, sys',
        'c = av.open(sys.argv[1])',
        'quiero = [int(x) for x in sys.argv[2:]]',
        'r = {}',
        'for i, f in enumerate(c.decode(c.streams.video[0])):',
        '    if i in quiero:',
        '        a = f.to_ndarray(format="rgb24").astype("int16")',
        '        R, G, B = a[..., 0], a[..., 1], a[..., 2]',
        '        oro = int(((R > 235) & (G > 195) & (G < 230) & (B < 40)).sum())',
        '        cian = int(((R > 35) & (R < 75) & (G > 180) & (G < 215) & (B > 215) & (B < 250)).sum())',
        '        naranja = int(((R > 235) & (G > 145) & (G < 175) & (B < 50)).sum())',
        '        r[i] = [oro, cian, naranja]',
        '    if i > max(quiero): break',
        'print(json.dumps({str(k): v for k, v in r.items()}))'
      ].join('\n'),
      archivo,
      ...fotogramas.map(String)
    ],
    { encoding: 'utf8' }
  )
  return JSON.parse(salida.trim().split('\n').at(-1)!)
}

test('el video exportado en el solape tiene los mismos colores exactos que la pantalla', async () => {
  test.setTimeout(300_000)
  const datos = crearTemporal('voces-video')
  const salida = crearTemporal('voces-video-salida')
  await sembrar(datos, { voces: true })
  const cancion = leerCancion(datos, idSemilla(52))
  cancion.metadatos.duracion_ms = 9000
  writeFileSync(
    join(carpeta(datos, idSemilla(52)), 'cancion.json'),
    JSON.stringify(cancion, null, 2)
  )
  const config = leerConfig(datos)
  config.instalacion.estado = 'completa'
  config.exportacion = { carpeta: salida }
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    const e = await v.evaluate(async (id) => {
      const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi.exportacion
      const destino = await api.destinoPropuesto({ cancionId: id, formato: 'mkv_av1' })
      const { trabajoId } = await api.iniciar({
        cancionId: id,
        formato: 'mkv_av1',
        ancho: 1280,
        alto: 720,
        fps: 24,
        audio: 'instrumental',
        destinoId: destino.destinoId
      })
      for (;;) {
        const x = (await api.estado()).find((y) => y.trabajoId === trabajoId)
        if (x?.estado === 'terminada') return x
        await new Promise((res) => setTimeout(res, 250))
      }
    }, idSemilla(52))
    expect(e.resultado).toBe('completada')
    // 5,2 s (oro y cian a la vez; el coro espera al 55 %) y 8,0 s (oro, cian y naranja).
    const m = sondear(join(salida, e.archivo!), [125, 192])
    console.log(`VOCES-VIDEO ${JSON.stringify(m)}`)
    const [a, b] = [m['125']!, m['192']!]
    expect(a[0]).toBeGreaterThan(300)
    expect(a[1]).toBeGreaterThan(300)
    expect(a[2]).toBe(0)
    expect(b[0]).toBeGreaterThan(300)
    expect(b[1]).toBeGreaterThan(300)
    expect(b[2]).toBeGreaterThan(30)
  } finally {
    await app.close().catch(() => undefined)
  }
})
