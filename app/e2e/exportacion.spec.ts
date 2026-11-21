import { execFileSync } from 'node:child_process'
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import type { ApiShinobi } from '../src/shared/ipc'
import { idSemilla } from './fixtures/editor'
import { leerCancion, leerConfig, carpeta } from './fixtures/separacion'
import { crearTemporal } from './temporales'

/**
 * Exportación de video de punta a punta (0237): la app real con el worker PyAV, la ventana
 * offscreen y la tubería. La 0241 completa el resto de casos.
 */
test('exporta una canción de 3 s a 640×480 y el archivo tiene los fotogramas esperados', async () => {
  test.setTimeout(240_000)
  const datos = crearTemporal('exportacion')
  const salida = crearTemporal('exportacion-salida')
  await sembrar(datos)
  // «Reproductor: lista»: 30 s de audio; se exportan los 3 primeros segundos.
  const id = idSemilla(20)
  const cancion = leerCancion(datos, id)
  cancion.metadatos.duracion_ms = 3000
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
    expect(statSync(join(salida, r.e.archivo)).size).toBeGreaterThan(1000)
    expect(leerConfig(datos).exportacion).toMatchObject({ ancho: 640, alto: 480, fps: 24 })

    // Se vuelve a abrir el archivo con PyAV: flujos, fotogramas y duración.
    const uv = process.env.SHINOBI_UV ?? 'uv'
    const sonda = execFileSync(
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
          'print(json.dumps({"n": n, "w": v.width, "h": v.height, "a": len(c.streams.audio)}))'
        ].join('\n'),
        join(salida, r.e.archivo)
      ],
      { encoding: 'utf8' }
    )
    expect(JSON.parse(sonda.trim().split('\n').at(-1)!)).toEqual({ n: 72, w: 640, h: 480, a: 1 })
  } finally {
    await app.close().catch(() => undefined)
  }
})
