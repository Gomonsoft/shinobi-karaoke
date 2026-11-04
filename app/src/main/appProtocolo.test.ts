import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { rutaRelativaApp, servirRenderer } from './appProtocolo'

let raiz: string
let dir: string
beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'app-'))
  dir = join(raiz, 'renderer')
  await mkdir(join(dir, 'assets'), { recursive: true })
  await writeFile(join(dir, 'index.html'), '<html></html>')
  await writeFile(join(dir, 'assets', 'a.js'), 'x')
  await writeFile(join(dir, 'assets', 'f.woff2'), 'f')
  await writeFile(join(dir, 'assets', 'raro.bin'), 'b')
  await writeFile(join(raiz, 'secreto.js'), 'secreto')
  await symlink(join(raiz, 'secreto.js'), join(dir, 'assets', 'enlace.js'))
})
afterEach(() => rm(raiz, { recursive: true, force: true }))

const u = (r: string): string => `shinobi-app://app/${r}`

describe('servirRenderer', () => {
  it('sirve un archivo con su tipo y nosniff', async () => {
    const r = await servirRenderer(dir, u('assets/a.js'), 'GET')
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toContain('text/javascript')
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await r.text()).toBe('x')
  })
  it('la raíz sirve index.html', async () => {
    const r = await servirRenderer(dir, 'shinobi-app://app/', 'GET')
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toContain('text/html')
  })
  it('tipo de fuentes y HEAD', async () => {
    const r = await servirRenderer(dir, u('assets/f.woff2'), 'HEAD')
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('font/woff2')
  })
  it('traversal, codificaciones, extensión desconocida, método y host ajeno -> 404', async () => {
    for (const x of [
      u('../secreto.js'),
      u('assets/../../secreto.js'),
      u('%2e%2e/secreto.js'),
      u('assets%2f..%2f..%2fsecreto.js'),
      u('assets\\..\\a.js'),
      u('assets/raro.bin'),
      u('assets/no-existe.js'),
      u('assets'),
      'shinobi-app://otro/index.html',
      'shinobi-app://app:81/index.html'
    ]) {
      expect((await servirRenderer(dir, x, 'GET')).status, x).toBe(404)
    }
    expect((await servirRenderer(dir, u('index.html'), 'POST')).status).toBe(404)
  })
  it('un enlace simbólico que escapa -> 404', async () => {
    expect((await servirRenderer(dir, u('assets/enlace.js'), 'GET')).status).toBe(404)
  })
  it('rutaRelativaApp', () => {
    expect(rutaRelativaApp('shinobi-app://app/a/b.js')).toBe('a/b.js')
    expect(rutaRelativaApp('http://app/a.js')).toBeNull()
  })
})
