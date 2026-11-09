import { _electron as electron, expect, test } from '@playwright/test'
import type { ApiShinobi } from '../src/shared/ipc'
import { sembrar } from '../src/main/biblioteca/semilla'
import { crearTemporal } from './temporales'

test('window.shinobi.biblioteca.listar() devuelve la semilla y el renderer no ve Node', async () => {
  const datos = crearTemporal('ipc')
  const { creadas } = await sembrar(datos)
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos }
  })
  try {
    const ventana = await app.firstWindow()
    const r = await ventana.evaluate(async () => {
      const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi
      const lista = await api.biblioteca.listar()
      const info = await api.sistema.info()
      const cfg = await api.config.obtener()
      const trabajos = {
        lista: await api.trabajos.listar(),
        pendientes: await api.trabajos.hayPendientes()
      }
      const malo = await api.biblioteca.eliminar('').catch((e: unknown) => e)
      const enlace = await api.sistema.abrirEnlace('https://example.com').catch((e: unknown) => e)
      const w = globalThis as unknown as Record<string, unknown>
      return {
        ids: lista.map((c) => c.id),
        miniaturas: lista.map((c) => c.miniatura),
        plataforma: info.plataforma,
        volumen: cfg.reproductor.volumen,
        trabajos,
        malo,
        enlace,
        claves: Object.keys(api).sort(),
        clavesPicos: Object.keys(api.picos).sort(),
        ipcRenderer: typeof w.ipcRenderer,
        require: typeof w.require,
        process: typeof w.process
      }
    })
    expect([...r.ids].sort()).toEqual([...creadas].sort())
    for (const m of r.miniaturas) expect(m === null || m.startsWith('shinobi-media://')).toBe(true)
    expect(r.plataforma).toBe(process.platform)
    expect(r.volumen).toBeGreaterThanOrEqual(0)
    expect(r.trabajos).toEqual({ lista: [], pendientes: false })
    expect(r.malo).toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    expect(r.enlace).toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    expect(r.claves).toEqual([
      'alAccionMenu',
      'alCambiarCancion',
      'alCambiarConfig',
      'alCambiarEstadoInfo',
      'alCambiarTemas',
      'app',
      'avisos',
      'biblioteca',
      'config',
      'fuente',
      'letras',
      'picos',
      'runtime',
      'rutaDeArchivo',
      'separacion',
      'sistema',
      'temas',
      'trabajos',
      'ventana'
    ])
    expect(r.clavesPicos).toEqual(['leer', 'solicitar'])
    expect([r.ipcRenderer, r.require, r.process]).toEqual(['undefined', 'undefined', 'undefined'])
  } finally {
    await app.close()
  }
})
