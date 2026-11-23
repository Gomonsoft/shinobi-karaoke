import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { nombrePropuesto } from '../src/shared/exportacion'
import type { ApiShinobi } from '../src/shared/ipc'
import { idSemilla } from './fixtures/editor'
import { leerCancion, leerConfig, carpeta } from './fixtures/separacion'
import { crearTemporal } from './temporales'

/**
 * Exportación de video de punta a punta (0237, 0241): la app real con el worker PyAV, la ventana
 * offscreen y la tubería, a 640×480 y 24 FPS. «Reproductor: lista» tiene 30 s de audio y su primera
 * línea empieza en 2 s (el barrido recorre la línea entre el fotograma 48 y el 120).
 */
async function preparar(nombre: string, duracionMs: number, modalidad?: 'letra_lista') {
  const datos = crearTemporal(nombre)
  const salida = crearTemporal(`${nombre}-salida`)
  await sembrar(datos)
  const id = idSemilla(20)
  const cancion = leerCancion(datos, id)
  cancion.metadatos.duracion_ms = duracionMs
  if (modalidad) cancion.modalidad = modalidad
  writeFileSync(join(carpeta(datos, id), 'cancion.json'), JSON.stringify(cancion, null, 2))
  const config = leerConfig(datos)
  config.instalacion.estado = 'completa'
  config.exportacion = { carpeta: salida }
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos, SHINOBI_SILENCIAR_AUDIO: '1' }
  })
  return { datos, salida, id, app }
}

/** Abre el archivo con PyAV: fotogramas, medidas, audio, FPS, duración y cambio de imagen del barrido. */
function sondear(archivo: string): {
  n: number
  w: number
  h: number
  a: number
  fps: number
  seg: number
  /** Píxeles del color de resaltado en los fotogramas 53 (2,2 s) y 69 (2,9 s). */
  amarillo: [number, number]
  /** Diferencia media (× 100) entre fotogramas contiguos: a mitad del cambio (52→53) y en reposo (62→63). */
  movimiento: [number, number]
} {
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
        'v = c.streams.video[0]',
        'n = sum(1 for p in c.demux(v) if p.pts is not None)',
        'c.seek(0)',
        'm = {}',
        'g = {}',
        'for i, f in enumerate(c.decode(v)):',
        '    a = f.to_ndarray(format="rgb24").astype("int16")',
        '    if i in (53, 69):',
        '        m[i] = int(((a[..., 0] > 200) & (a[..., 1] > 170) & (a[..., 2] < 130)).sum())',
        '    if i in (52, 53, 62, 63): g[i] = a',
        '    if i > 69: break',
        'amarillo = [m.get(53, -1), m.get(69, -1)]',
        'mov = [int(abs(g[b] - g[a]).mean() * 100) for a, b in ((52, 53), (62, 63))]',
        'print(json.dumps({"n": n, "w": v.width, "h": v.height, "a": len(c.streams.audio),',
        '  "fps": round(float(v.average_rate), 2), "seg": round(float(c.duration / 1e6), 1), "amarillo": amarillo, "movimiento": mov}))'
      ].join('\n'),
      archivo
    ],
    { encoding: 'utf8' }
  )
  return JSON.parse(salida.trim().split('\n').at(-1)!)
}

const sha = (ruta: string): string => createHash('sha256').update(readFileSync(ruta)).digest('hex')

test('exporta a MKV: 3 s a 640×480 con 5 líneas, fotogramas, barrido y cambio de línea', async () => {
  test.setTimeout(240_000)
  const { datos, salida, id, app } = await preparar('exportacion', 3000)
  try {
    const ventana = await app.firstWindow()
    const r = await ventana.evaluate(
      async ({ cancionId }) => {
        const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi.exportacion
        const perfiles = await api.perfiles()
        const destino = await api.destinoPropuesto({ cancionId, formato: 'mkv_av1' })
        const { trabajoId } = await api.iniciar({
          cancionId,
          formato: 'mkv_av1',
          ancho: 640,
          alto: 480,
          fps: 24,
          audio: 'instrumental',
          destinoId: destino.destinoId
        })
        const inicio = Date.now()
        for (;;) {
          const e = (await api.estado()).find((x) => x.trabajoId === trabajoId)
          if (e?.estado === 'terminada') return { e, perfiles: perfiles.perfiles.length, destino }
          if (Date.now() - inicio > 200_000) throw new Error('la exportación no terminó')
          await new Promise((res) => setTimeout(res, 250))
        }
      },
      { cancionId: id }
    )
    expect(r.perfiles).toBe(48)
    expect(r.e.error).toBeNull()
    expect(r.e).toMatchObject({
      resultado: 'completada',
      fotogramas: 72,
      archivo: expect.stringMatching(/\.mkv$/),
      limpiezaFallida: false
    })
    // Solo queda el video: ni temporales ni diario.
    expect(readdirSync(salida)).toEqual([r.e.archivo])
    expect(existsSync(join(datos, 'exportacion', 'en-curso.json'))).toBe(false)
    expect(statSync(join(salida, r.e.archivo)).size).toBeGreaterThan(1000)
    expect(leerConfig(datos).exportacion).toMatchObject({ ancho: 640, alto: 480, fps: 24 })

    const s = sondear(join(salida, r.e.archivo))
    expect(s).toMatchObject({ n: 72, w: 640, h: 480, a: 1, fps: 24, seg: 3 })
    // V17: el barrido de la primera línea avanza entre 2,2 s y 2,9 s: aparece color de resaltado.
    expect(s.amarillo[1]).toBeGreaterThan(s.amarillo[0] + 200)
    // F1-R23: con 5 líneas (el predeterminado de la semilla) la entrada de la primera línea (2,0 a
    // 2,35 s) mueve el bloque, y el fotograma depende solo del instante: entre 52 y 53 la imagen
    // cambia mucho más que en reposo (medido: 658 frente a 4, en centésimas de nivel) (62 → 63, donde solo avanza el barrido).
    expect(s.movimiento[0]).toBeGreaterThan(Math.max(100, s.movimiento[1] * 5))
  } finally {
    await app.close().catch(() => undefined)
  }
})

test('cancelar a mitad conserva el archivo previo y no deja temporal ni diario', async () => {
  test.setTimeout(240_000)
  const { datos, salida, id, app } = await preparar('exportacion-cancelar', 30_000)
  try {
    const ventana = await app.firstWindow()
    const previo = await ventana.evaluate(async (cancionId) => {
      const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi.exportacion
      return (await api.destinoPropuesto({ cancionId, formato: 'webm_vp9' })).ruta
    }, id)
    writeFileSync(previo, 'video anterior')
    const hash = sha(previo)

    const r = await ventana.evaluate(
      async ({ cancionId }) => {
        const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi.exportacion
        const destino = await api.destinoPropuesto({ cancionId, formato: 'webm_vp9' })
        const { trabajoId } = await api.iniciar({
          cancionId,
          formato: 'webm_vp9',
          ancho: 640,
          alto: 480,
          fps: 24,
          audio: 'instrumental',
          destinoId: destino.destinoId
        })
        const buscar = async () => (await api.estado()).find((x) => x.trabajoId === trabajoId)
        const inicio = Date.now()
        // Espera a estar renderizando, a mitad de camino.
        for (;;) {
          const e = await buscar()
          if (e?.estado === 'terminada') throw new Error('terminó antes de poder cancelar')
          if ((e?.progreso?.fotograma ?? 0) >= 20) break
          if (Date.now() - inicio > 120_000) throw new Error('no empezó a renderizar')
          await new Promise((res) => setTimeout(res, 100))
        }
        await api.cancelar(trabajoId)
        for (;;) {
          const e = await buscar()
          if (e?.estado === 'terminada') return e
          if (Date.now() - inicio > 120_000) throw new Error('la cancelación no terminó')
          await new Promise((res) => setTimeout(res, 100))
        }
      },
      { cancionId: id }
    )
    expect(r).toMatchObject({ resultado: 'cancelada', limpiezaFallida: false })
    expect(r.fotogramas ?? 0).toBeLessThan(720)
    expect(readdirSync(salida)).toEqual([previo.split(/[\\/]/).at(-1)])
    expect(sha(previo)).toBe(hash)
    expect(existsSync(join(datos, 'exportacion', 'en-curso.json'))).toBe(false)
  } finally {
    await app.close().catch(() => undefined)
  }
})

test('«Letra lista» a WebM: sin barrido y con los fotogramas esperados', async () => {
  test.setTimeout(240_000)
  const { salida, id, app } = await preparar('exportacion-letra-lista', 3000, 'letra_lista')
  try {
    const ventana = await app.firstWindow()
    const e = await ventana.evaluate(
      async ({ cancionId }) => {
        const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi.exportacion
        const destino = await api.destinoPropuesto({ cancionId, formato: 'webm_vp9' })
        const { trabajoId } = await api.iniciar({
          cancionId,
          formato: 'webm_vp9',
          ancho: 640,
          alto: 480,
          fps: 24,
          audio: 'instrumental',
          destinoId: destino.destinoId
        })
        const inicio = Date.now()
        for (;;) {
          const x = (await api.estado()).find((y) => y.trabajoId === trabajoId)
          if (x?.estado === 'terminada') return x
          if (Date.now() - inicio > 200_000) throw new Error('la exportación no terminó')
          await new Promise((res) => setTimeout(res, 250))
        }
      },
      { cancionId: id }
    )
    expect(e).toMatchObject({ resultado: 'completada', fotogramas: 72, limpiezaFallida: false })
    expect(e.archivo).toMatch(/\.webm$/)
    const s = sondear(join(salida, e.archivo))
    expect(s).toMatchObject({ n: 72, w: 640, h: 480, a: 1, fps: 24, seg: 3 })
    // Sin barrido, la letra nunca toma el color de resaltado.
    expect(Math.max(...s.amarillo)).toBeLessThan(20)
  } finally {
    await app.close().catch(() => undefined)
  }
})

/** Datos sembrados con dos «Reproductor» de 3 s y las opciones recordadas apuntando a una carpeta temporal. */
async function prepararLote(nombre: string) {
  const datos = crearTemporal(nombre)
  const salida = crearTemporal(`${nombre}-salida`)
  await sembrar(datos)
  // Las dos «Reproductor» de la semilla, acortadas a 3 s.
  for (const n of [20, 21]) {
    const cancion = leerCancion(datos, idSemilla(n))
    cancion.metadatos.duracion_ms = 3000
    writeFileSync(
      join(carpeta(datos, idSemilla(n)), 'cancion.json'),
      JSON.stringify(cancion, null, 2)
    )
  }
  const config = leerConfig(datos)
  config.instalacion.estado = 'completa'
  // Opciones recordadas: el diálogo de lote las usa, y la carpeta propuesta es la temporal.
  config.exportacion = {
    carpeta: salida,
    formato: 'mkv_av1',
    ancho: 640,
    alto: 480,
    fps: 24,
    audio: 'instrumental'
  }
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
  return { datos, salida }
}

test('exportar varias desde la barra de la Biblioteca: 2 videos a 640×480 en una carpeta temporal (0321)', async () => {
  test.setTimeout(300_000)
  const { datos, salida } = await prepararLote('exportacion-lote')
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos, SHINOBI_SILENCIAR_AUDIO: '1' }
  })
  try {
    const v = await app.firstWindow()
    await v.getByRole('button', { name: 'Seleccionar', exact: true }).click()
    await v.getByRole('checkbox', { name: 'Seleccionar «Reproductor: lista»' }).click()
    await v.getByRole('checkbox', { name: 'Seleccionar «Reproductor: lista incompleta»' }).click()
    // `click()` desplazaría la página para centrar la barra fija y un scroll cierra el menú: se abre sin desplazar.
    await v.getByRole('button', { name: 'Más acciones', exact: true }).dispatchEvent('click')
    await v.getByRole('menuitem', { name: 'Exportar video…' }).click()
    const g = v.getByRole('dialog', { name: 'Exportar 2 videos' })
    await expect(g.getByLabel(/^Guardar en la carpeta, /)).toHaveValue(salida)
    await g.getByRole('button', { name: 'Exportar 2 videos' }).click()
    const i = v.getByRole('dialog', { name: 'Videos exportados' })
    await expect(i).toBeVisible({ timeout: 240_000 })
    await expect(i.getByText(/Se exportaron 2 videos/)).toBeVisible()
    const archivos = readdirSync(salida).filter((n) => n.endsWith('.mkv'))
    expect(archivos).toHaveLength(2)
    expect(readdirSync(salida)).toHaveLength(2)
    for (const a of archivos) expect(statSync(join(salida, a)).size).toBeGreaterThan(1000)
    const s = sondear(join(salida, archivos[0]!))
    expect(s).toMatchObject({ w: 640, h: 480, fps: 24, seg: 3 })
  } finally {
    await app.close().catch(() => undefined)
  }
})

test('exportar varias con un video ya presente y «omitir»: el botón dice uno menos y se exporta uno menos (0388)', async () => {
  test.setTimeout(300_000)
  const { datos, salida } = await prepararLote('exportacion-lote-omitir')
  const lista = leerCancion(datos, idSemilla(20))
  const yaExiste = nombrePropuesto(lista.metadatos.titulo, lista.metadatos.artista, 'mkv')
  writeFileSync(join(salida, yaExiste), 'anterior')
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos, SHINOBI_SILENCIAR_AUDIO: '1' }
  })
  try {
    const v = await app.firstWindow()
    await v.getByRole('button', { name: 'Seleccionar', exact: true }).click()
    await v.getByRole('checkbox', { name: 'Seleccionar «Reproductor: lista»' }).click()
    await v.getByRole('checkbox', { name: 'Seleccionar «Reproductor: lista incompleta»' }).click()
    await v.getByRole('button', { name: 'Más acciones', exact: true }).dispatchEvent('click')
    await v.getByRole('menuitem', { name: 'Exportar video…' }).click()
    const g = v.getByRole('dialog', { name: 'Exportar 2 videos' })
    await expect(g.getByLabel(/^Guardar en la carpeta, /)).toHaveValue(salida)
    await expect(
      g.getByText(/^1 de estas canciones ya tienen un video en esta carpeta/)
    ).toBeVisible()
    await g.getByRole('button', { name: 'Ver cuáles' }).click()
    await expect(g.getByText(`→ ${yaExiste.replace('.mkv', ' (2).mkv')}`)).toBeVisible()
    await g.getByRole('radio', { name: 'Omitir esa canción' }).click()
    await expect(g.getByText(/^1 canciones no se exportarán/)).toBeVisible()
    await g.getByRole('button', { name: 'Exportar 1 video', exact: true }).click()
    const i = v.getByRole('dialog', { name: 'Videos exportados' })
    await expect(i).toBeVisible({ timeout: 240_000 })
    await expect(i.getByText(/Se exportaron 1 de 2 videos/)).toBeVisible()
    const archivos = readdirSync(salida).filter((n) => n.endsWith('.mkv'))
    expect(archivos).toHaveLength(2)
    expect(readFileSync(join(salida, yaExiste), 'utf8')).toBe('anterior')
  } finally {
    await app.close().catch(() => undefined)
  }
})
