import { _electron as electron, expect, test } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { crearTemporal } from './temporales'

const ID = '5eed0000-0000-4000-8000-000000000001'
const ID_YT_PORTADA = '5eed0000-0000-4000-8000-000000000012'

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

test('la miniatura de una canción de YouTube se sirve por shinobi-media:// y se usa de portada', async () => {
  const datos = crearTemporal('medios-miniatura')
  await sembrar(datos)
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos }
  })
  try {
    const v = await app.firstWindow()
    const tarjeta = v.getByRole('article', { name: /^Desde YouTube con portada,/ })
    await expect(tarjeta).toBeVisible()
    // La tarjeta pinta la miniatura como imagen de fondo CSS (no `<img>`): se comprueba la URL y que carga.
    const estilo = await tarjeta.locator('[style*="shinobi-media://"]').getAttribute('style')
    const url = /url\("?([^")]+)"?\)/.exec(estilo ?? '')?.[1] ?? ''
    expect(url).toBe(`shinobi-media://${ID_YT_PORTADA}/fuente/miniatura.jpg`)
    const dim = await v.evaluate((u: string) => {
      const g = globalThis as unknown as {
        Image: new () => {
          naturalWidth: number
          naturalHeight: number
          onload: () => void
          onerror: () => void
          src: string
        }
      }
      return new Promise<number[]>((ok, mal) => {
        const i = new g.Image()
        i.onload = () => ok([i.naturalWidth, i.naturalHeight])
        i.onerror = () => mal(new Error('no carga'))
        i.src = u
      })
    }, url)
    expect(dim).toEqual([320, 180])
    // Con estilo propio y sin miniatura no se usa la imagen de portada.
    for (const nombre of [/^Desde YouTube con estilo propio,/, /^Canción lista,/]) {
      await expect(
        v.getByRole('article', { name: nombre }).locator('[style*="shinobi-media://"]')
      ).toHaveCount(0)
    }
    await expect(v.locator('article img')).toHaveCount(0)
    const estados = await v.evaluate(async (id) => {
      const png = await fetch(`shinobi-media://${id}/fuente/miniatura.png`)
      return png.status
    }, ID_YT_PORTADA)
    expect(estados).toBe(404)
  } finally {
    await app.close()
  }
})
