import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PERFILES,
  bytesTotalesInstalacion,
  manifiestoSchema,
  modeloDelPerfil,
  requisitosDe
} from './manifiesto'

/** Valida el manifiesto REAL (`app/resources/runtime-manifest.json`, tarea 0030). */

const RAIZ_APP = fileURLToPath(new URL('../../', import.meta.url))
const RAIZ_REPO = fileURLToPath(new URL('../../../', import.meta.url))

const manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(`${RAIZ_APP}resources/runtime-manifest.json`, 'utf8'))
)

const combinaciones = Object.entries(manifiesto.runtime).flatMap(([plataforma, perfiles]) =>
  Object.entries(perfiles ?? {}).map(([perfil, datos]) => ({ plataforma, perfil, datos }))
)

describe('runtime-manifest.json', () => {
  it('es válido y cubre las plataformas y perfiles soportados', () => {
    expect(manifiesto.version).toBeGreaterThanOrEqual(1)
    expect(manifiesto.python.version).toBe('3.12.16')
    expect(combinaciones.map((c) => `${c.plataforma}-${c.perfil}`).sort()).toEqual([
      'darwin-arm64-mps',
      'linux-x64-cpu',
      'linux-x64-cuda',
      'win32-x64-cpu',
      'win32-x64-cuda'
    ])
  })

  it.each(combinaciones)(
    '$plataforma $perfil: el archivo de requisitos existe y su SHA-256 coincide',
    ({ plataforma, perfil, datos }) => {
      expect(datos.requisitos).toBe(`worker/requisitos/${plataforma}-${perfil}.txt`)
      const ruta = `${RAIZ_REPO}${datos.requisitos}`
      expect(existsSync(ruta), `${datos.requisitos} no existe`).toBe(true)
      const contenido = readFileSync(ruta)
      const huella = createHash('sha256').update(contenido).digest('hex')
      expect(
        huella,
        'Se regeneraron los requisitos sin actualizar sha256_requisitos (y version) en el manifiesto'
      ).toBe(datos.sha256_requisitos)
      const texto = contenido.toString('utf8')
      expect(texto).toContain('uv pip compile')
      expect(texto).toContain('--hash=sha256:')
    }
  )

  it('cada plataforma tiene Python y cada perfil tiene el espacio y el modelo previstos', () => {
    for (const { plataforma, perfil, datos } of combinaciones) {
      expect(manifiesto.python.bytes_descarga).toHaveProperty(plataforma)
      expect(datos.espacio_requerido).toBe(
        { cpu: 3e9, mps: 4e9, cuda: 10e9 }[perfil as (typeof PERFILES)[number]]
      )
      expect(manifiesto.modelos.some((m) => m.id === modeloDelPerfil(perfil as 'cpu'))).toBe(true)
      expect(bytesTotalesInstalacion(manifiesto, plataforma, perfil as 'cpu')).toBeGreaterThan(
        datos.bytes_descarga
      )
    }
  })

  it('solo darwin-arm64 está medido; los demás no tienen bytes_disco', () => {
    for (const { plataforma, datos } of combinaciones) {
      expect(datos.medido).toBe(plataforma === 'darwin-arm64')
      expect(datos.bytes_disco === null).toBe(plataforma !== 'darwin-arm64')
    }
  })

  it('macOS Intel no está soportado (preguntas/0015)', () => {
    expect(requisitosDe(manifiesto, 'darwin-x64', 'cpu')).toBeNull()
  })

  it('modelos: Rápido provisional con licencia no declarada; Calidad MIT con su yaml', () => {
    const rapido = manifiesto.modelos.find((m) => m.id === 'rapido')
    const calidad = manifiesto.modelos.find((m) => m.id === 'calidad')
    expect(rapido).toMatchObject({
      archivo: 'UVR-MDX-NET-Inst_HQ_4.onnx',
      bytes: 59074342,
      licencia: 'no declarada',
      provisional: true
    })
    expect(calidad).toMatchObject({
      archivo: 'vocals_mel_band_roformer.ckpt',
      bytes: 913106900,
      licencia: 'MIT',
      provisional: false
    })
    expect(calidad?.extra).toHaveLength(1)
    expect(calidad?.extra[0]).toMatchObject({
      archivo: 'vocals_mel_band_roformer.yaml',
      bytes: 944
    })
    // Espejo de audio-separator primero, origen después.
    expect(rapido?.urls[0]).toContain('nomadkaraoke/python-audio-separator')
    expect(rapido?.urls).toHaveLength(2)
    expect(calidad?.urls[0]).toContain('nomadkaraoke/python-audio-separator')
    expect(calidad?.urls).toHaveLength(2)
  })

  it('factores: medidos en el M1 y sin medir (null + estimación) en x86 y CUDA', () => {
    expect(manifiesto.factores.mps).toEqual({ rapido: [0.7, 0.79], calidad: [1.08, 1.27] })
    expect(manifiesto.factores.cpu).toEqual({ rapido: null, calidad: null })
    expect(manifiesto.factores.cuda?.calidad).toBeNull()
    expect(manifiesto.estimacion.cpu?.rapido).toEqual([0.75, 1.75])
    expect(manifiesto.estimacion.cpu?.calidad).toEqual([1.5, 4])
    expect(manifiesto.estimacion.cuda?.calidad).toEqual([0.15, 0.5])
  })
})

// Con red (se omite en la CI normal): SHINOBI_TESTS_RED=1 npx vitest run manifiestoReal
describe.skipIf(!process.env.SHINOBI_TESTS_RED)('URLs de modelos (red)', () => {
  const archivos = manifiesto.modelos.flatMap((m) => [
    { nombre: m.archivo, urls: m.urls, bytes: m.bytes },
    ...m.extra.map((e) => ({ nombre: e.archivo, urls: e.urls, bytes: e.bytes }))
  ])
  const casos = archivos.flatMap((a) => a.urls.map((url) => ({ ...a, url })))

  it.each(casos)(
    'HEAD $url devuelve Content-Length = $bytes',
    async ({ url, bytes }) => {
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow' })
      expect(r.status).toBe(200)
      expect(Number(r.headers.get('content-length'))).toBe(bytes)
    },
    30_000
  )
})
