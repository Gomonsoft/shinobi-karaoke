import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

/**
 * Sumidero de LRCLIB (regla «sin red real en las pruebas»). Desde la preparación desatendida (0308),
 * añadir una canción lanza solo la búsqueda de letra: un E2E que no fije `SHINOBI_LRCLIB_URL` saldría a
 * lrclib.net con el título y el artista del fixture. Si la variable no viene definida, se fija aquí a
 * este servidor local, que responde 503 a todo (como un servicio caído: la app reintenta más tarde y la
 * interfaz no cambia) y guarda lo que le llega en `GET /__sumidero`, que lee `sin-red-real.spec.ts`.
 * Las specs que necesitan su propio doble o la red real (`*-red.spec.ts`, opt-in) fijan o borran la
 * variable en el `env` de su `electron.launch`, como hasta ahora. Se hereda en los workers de Playwright.
 */
export const ENTORNO_SUMIDERO = 'SHINOBI_SUMIDERO_LRCLIB'

let sumidero: Server | null = null

async function iniciarSumidero(): Promise<void> {
  const recibidas: { metodo: string; ruta: string; host: string | undefined }[] = []
  sumidero = createServer((req, res) => {
    if (req.url === '/__sumidero') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(recibidas))
      return
    }
    recibidas.push({ metodo: req.method ?? '', ruta: req.url ?? '', host: req.headers.host })
    res.statusCode = 503
    res.end()
  })
  await new Promise<void>((ok) => sumidero!.listen(0, '127.0.0.1', ok))
  const puerto = (sumidero.address() as { port: number }).port
  process.env.SHINOBI_LRCLIB_URL = `http://127.0.0.1:${puerto}`
  process.env[ENTORNO_SUMIDERO] = '1'
}

/** Electron instala su binario al primer require; hacerlo antes de iniciar los workers. */
export default async function prepararElectron(): Promise<() => Promise<void>> {
  createRequire(resolve(__dirname, '../package.json'))('electron')
  // Segunda barrera (0372): con SHINOBI_E2E=1 el producto nunca usa la URL real de LRCLIB. Las specs
  // opt-in de red (`*-red.spec.ts`) la borran de su `env` de forma explícita.
  process.env.SHINOBI_E2E ??= '1'
  if (!process.env.SHINOBI_LRCLIB_URL) await iniciarSumidero()
  return async () => {
    await new Promise<void>((ok) => (sumidero ? sumidero.close(() => ok()) : ok()))
  }
}
