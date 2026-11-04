import { _electron as electron, expect, test } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { crearTemporal } from './temporales'

const ID = '5eed0000-0000-4000-8000-000000000001'

test('el renderer lee audio por shinobi-media:// y no sale de la lista blanca', async () => {
  const datos = crearTemporal('medios')
  await sembrar(datos)
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos }
  })
  try {
    const ventana = await app.firstWindow()
    const r = await ventana.evaluate(async (id) => {
      const ok = await fetch(`shinobi-media://${id}/pistas/instrumental.flac`)
      const buf = await ok.arrayBuffer()
      const parcial = await fetch(`shinobi-media://${id}/pistas/instrumental.flac`, {
        headers: { Range: 'bytes=0-3' }
      })
      const malo = await fetch(`shinobi-media://${id}/cancion.json`)
      return {
        estado: ok.status,
        tipo: ok.headers.get('content-type'),
        bytes: buf.byteLength,
        magia: new TextDecoder().decode(buf.slice(0, 4)),
        estadoParcial: parcial.status,
        estadoMalo: malo.status
      }
    }, ID)
    expect(r.estado).toBe(200)
    expect(r.tipo).toBe('audio/flac')
    expect(r.bytes).toBeGreaterThan(4)
    expect(r.magia).toBe('fLaC')
    expect(r.estadoParcial).toBe(206)
    expect(r.estadoMalo).toBe(404)
  } finally {
    await app.close()
  }
})

test('la ventana carga shinobi-app:// y otro origen no puede leer shinobi-media', async () => {
  const datos = crearTemporal('medios-origen')
  await sembrar(datos)
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos }
  })
  try {
    const ventana = await app.firstWindow()
    expect(ventana.url()).toMatch(/^shinobi-app:\/\/app\//)
    const r = await ventana.evaluate(async (id) => {
      const ok = await fetch(`shinobi-media://${id}/pistas/instrumental.flac`)
      return { estado: ok.status, cors: ok.headers.get('access-control-allow-origin') }
    }, ID)
    expect(r.estado).toBe(200)
    expect(r.cors).toBe('shinobi-app://app')
    // Un origen distinto (página http real en otro puerto) no puede leer los medios.
    const servidor = createServer((_q, res) => {
      res.setHeader('Content-Type', 'text/html')
      res.end('<html></html>')
    })
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok))
    const puerto = (servidor.address() as AddressInfo).port
    try {
      const ajeno = await app.evaluate(
        async ({ BrowserWindow }, [id, p]) => {
          const v = new BrowserWindow({ show: false })
          await v.loadURL(`http://127.0.0.1:${p}/`)
          try {
            return await v.webContents.executeJavaScript(
              `fetch('shinobi-media://${id}/pistas/instrumental.flac').then(r => 'LEIDO ' + r.status, () => 'bloqueado')`
            )
          } finally {
            v.destroy()
          }
        },
        [ID, puerto] as const
      )
      expect(ajeno).toBe('LEIDO 404')
    } finally {
      servidor.close()
    }
  } finally {
    await app.close()
  }
})
