import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { interpretarRango, interpretarUrlMedios, servirMedio } from './medios'

const ORIGEN = 'shinobi-app://app'

const ID = '5eed0000-0000-4000-8000-000000000001'
const CONTENIDO = Buffer.from('0123456789abcdefghij') // 20 bytes
let raiz: string
let bib: string

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'medios-'))
  bib = join(raiz, 'biblioteca')
  await mkdir(join(bib, ID, 'pistas'), { recursive: true })
  await mkdir(join(bib, ID, 'fuente'), { recursive: true })
  await writeFile(join(bib, ID, 'pistas', 'instrumental.flac'), CONTENIDO)
  await writeFile(join(bib, ID, 'fuente', 'miniatura.jpg'), Buffer.from([0xff, 0xd8]))
  await writeFile(join(bib, ID, 'cancion.json'), '{}')
  await writeFile(join(raiz, 'secreto.flac'), 'secreto')
})
afterEach(() => rm(raiz, { recursive: true, force: true }))

const url = (ruta: string, id = ID): string => `shinobi-media://${id}/${ruta}`
const texto = async (r: Response): Promise<string> => Buffer.from(await r.arrayBuffer()).toString()

describe('servirMedio', () => {
  it('sirve el archivo completo con su tipo', async () => {
    const r = await servirMedio(bib, url('pistas/instrumental.flac'), 'GET', null)
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('audio/flac')
    expect(r.headers.get('Content-Length')).toBe('20')
    expect(r.headers.get('Accept-Ranges')).toBe('bytes')
    expect(await texto(r)).toBe(CONTENIDO.toString())
  })

  it('sirve la miniatura como image/jpeg', async () => {
    const r = await servirMedio(bib, url('fuente/miniatura.jpg'), 'GET', null)
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('image/jpeg')
  })

  it('responde 206 con Content-Range a un rango parcial', async () => {
    const r = await servirMedio(bib, url('pistas/instrumental.flac'), 'GET', 'bytes=5-9')
    expect(r.status).toBe(206)
    expect(r.headers.get('Content-Range')).toBe('bytes 5-9/20')
    expect(r.headers.get('Content-Length')).toBe('5')
    expect(await texto(r)).toBe('56789')
  })

  it('admite rangos abiertos y de sufijo', async () => {
    const a = await servirMedio(bib, url('pistas/instrumental.flac'), 'GET', 'bytes=15-')
    expect(await texto(a)).toBe('fghij')
    const b = await servirMedio(bib, url('pistas/instrumental.flac'), 'GET', 'bytes=-3')
    expect(b.headers.get('Content-Range')).toBe('bytes 17-19/20')
    expect(await texto(b)).toBe('hij')
  })

  it('responde 416 a un rango fuera del archivo', async () => {
    const r = await servirMedio(bib, url('pistas/instrumental.flac'), 'GET', 'bytes=50-60')
    expect(r.status).toBe(416)
    expect(r.headers.get('Content-Range')).toBe('bytes */20')
  })

  it('HEAD no devuelve cuerpo', async () => {
    const r = await servirMedio(bib, url('pistas/instrumental.flac'), 'HEAD', null)
    expect(r.status).toBe(200)
    expect(r.body).toBeNull()
  })

  it('rechaza id inexistente, archivo ausente y rutas fuera de la lista blanca', async () => {
    const otro = '5eed0000-0000-4000-8000-0000000000ff'
    for (const u of [
      url('pistas/instrumental.flac', otro),
      url('pistas/voz.flac'),
      url('cancion.json'),
      url('pistas/'),
      url('')
    ]) {
      expect((await servirMedio(bib, u, 'GET', null)).status).toBe(404)
    }
  })

  it('rechaza traversal y rutas absolutas', async () => {
    for (const u of [
      url('../../secreto.flac'),
      url('pistas/../cancion.json'),
      url('%2e%2e/%2e%2e/secreto.flac'),
      url('pistas/%2e%2e/cancion.json'),
      url('..%2fsecreto.flac'),
      url('pistas\\..\\cancion.json'),
      `shinobi-media://..//secreto.flac`,
      `shinobi-media://${ID}//etc/passwd`,
      `shinobi-media://${ID}/${raiz}/secreto.flac`,
      'shinobi-media://%2e%2e/pistas/instrumental.flac',
      'file:///etc/passwd'
    ]) {
      expect((await servirMedio(bib, u, 'GET', null)).status).toBe(404)
    }
  })

  it('rechaza enlaces simbólicos que escapan de la carpeta', async () => {
    await writeFile(join(bib, ID, 'pistas', 'x'), '')
    await rm(join(bib, ID, 'pistas', 'instrumental.flac'))
    await symlink(join(raiz, 'secreto.flac'), join(bib, ID, 'pistas', 'instrumental.flac'))
    expect((await servirMedio(bib, url('pistas/instrumental.flac'), 'GET', null)).status).toBe(404)
  })

  it('rechaza una carpeta de canción que es enlace hacia fuera de la biblioteca', async () => {
    const fuera = join(raiz, 'fuera')
    await mkdir(join(fuera, 'pistas'), { recursive: true })
    await writeFile(join(fuera, 'pistas', 'voz.flac'), 'x')
    const id2 = '5eed0000-0000-4000-8000-000000000002'
    await symlink(fuera, join(bib, id2))
    expect((await servirMedio(bib, url('pistas/voz.flac', id2), 'GET', null)).status).toBe(404)
  })

  it('solo admite GET y HEAD', async () => {
    expect((await servirMedio(bib, url('pistas/instrumental.flac'), 'POST', null)).status).toBe(404)
  })
})

describe('interpretarUrlMedios / interpretarRango', () => {
  it('valida la forma de la URL', () => {
    expect(interpretarUrlMedios(url('pistas/voz.flac'))).toEqual({
      id: ID,
      ruta: 'pistas/voz.flac'
    })
    expect(interpretarUrlMedios(url('pistas/voz.flac') + '?x=1')).toBeNull()
    expect(interpretarUrlMedios('http://x/pistas/voz.flac')).toBeNull()
    expect(interpretarUrlMedios('no es url')).toBeNull()
  })
  it('ignora rangos mal formados y rechaza los imposibles', () => {
    expect(interpretarRango(null, 10)).toBeNull()
    expect(interpretarRango('items=1-2', 10)).toBeNull()
    expect(interpretarRango('bytes=0-1,3-4', 10)).toBeNull()
    expect(interpretarRango('bytes=5-2', 10)).toBe('invalido')
    expect(interpretarRango('bytes=0-99', 10)).toEqual({ inicio: 0, fin: 9 })
  })
})

describe('CORS de servirMedio (ADR 0008)', () => {
  const u = url('pistas/instrumental.flac')
  it('origen permitido: cabecera exacta y Vary, nunca *', async () => {
    const r = await servirMedio(bib, u, 'GET', null, {
      origenRenderer: ORIGEN,
      origenPeticion: ORIGEN
    })
    expect(r.status).toBe(200)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ORIGEN)
    expect(r.headers.get('Vary')).toBe('Origin')
  })
  it('sin Origin se sirve igual', async () => {
    const r = await servirMedio(bib, u, 'GET', null, {
      origenRenderer: ORIGEN,
      origenPeticion: null
    })
    expect(r.status).toBe(200)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ORIGEN)
  })
  it('otro origen: 404 sin cabeceras CORS', async () => {
    const r = await servirMedio(bib, u, 'GET', null, {
      origenRenderer: ORIGEN,
      origenPeticion: 'https://malo.example'
    })
    expect(r.status).toBe(404)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
  it('404 y 416 del origen permitido llevan CORS', async () => {
    const cors = { origenRenderer: ORIGEN, origenPeticion: ORIGEN }
    const r404 = await servirMedio(bib, url('cancion.json'), 'GET', null, cors)
    expect(r404.status).toBe(404)
    expect(r404.headers.get('Access-Control-Allow-Origin')).toBe(ORIGEN)
    const r416 = await servirMedio(bib, u, 'GET', 'bytes=100-200', cors)
    expect(r416.status).toBe(416)
    expect(r416.headers.get('Access-Control-Allow-Origin')).toBe(ORIGEN)
  })
})
