import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generarPicos } from '../src/shared/__fixtures__/picos'
import { linea } from '../src/shared/__fixtures__'
import { calibrar, formatearTabla, REJILLA } from './calibrar-silencios'

const DUR = 15000
const FRECUENCIA = 44100

/** Escribe picos en el formato v1 de main/picos/formato.ts. */
function codificarPicos({ pares }: { pares: Int16Array }): Buffer {
  const niveles: Int16Array[] = [pares]
  while (niveles[niveles.length - 1]!.length > 2) {
    const prev = niveles[niveles.length - 1]!
    const n = Math.ceil(prev.length / 4)
    const sig = new Int16Array(n * 2)
    for (let i = 0; i < n; i++) {
      const a = 2 * i * 2
      const b = Math.min(a + 2, prev.length - 2)
      sig[2 * i] = Math.min(prev[a]!, prev[b]!)
      sig[2 * i + 1] = Math.max(prev[a + 1]!, prev[b + 1]!)
    }
    niveles.push(sig)
  }
  const bloques = pares.length / 2
  const cabecera = Buffer.alloc(24)
  cabecera.write('SKPV', 0, 'ascii')
  cabecera.writeUInt32LE(1, 4)
  cabecera.writeUInt32LE(FRECUENCIA, 8)
  cabecera.writeBigUInt64LE(BigInt(bloques * 441), 12)
  cabecera.writeUInt32LE(bloques, 20)
  const cuerpo = niveles.map((n) => Buffer.from(n.buffer, n.byteOffset, n.byteLength))
  return Buffer.concat([cabecera, ...cuerpo])
}

async function marcas(dir: string): Promise<string[]> {
  const salida: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    const ruta = join(e.parentPath, e.name)
    salida.push(`${ruta}:${(await stat(ruta)).mtimeMs}`)
  }
  return salida.sort()
}

let raiz: string

beforeAll(async () => {
  raiz = await realpath(await mkdtemp(join(tmpdir(), 'calibrar-')))
  const picos = generarPicos({
    duracionMs: DUR,
    tramos: [
      { desdeMs: 1000, hastaMs: 3200, dbfs: -6 },
      { desdeMs: 3700, hastaMs: 6000, dbfs: -6 },
      { desdeMs: 11000, hastaMs: 13000, dbfs: -6 }
    ]
  })
  const letra = {
    origen: 'manual',
    lrclib_id: null,
    offset_ms: 0,
    lineas: [
      linea('a', 'A', 1000, { fin_ms: 3300 }),
      linea('b', 'B', 3700, { fin_ms: 6100 }),
      linea('c', 'C', 11000, { fin_ms: 13100 })
    ]
  }
  await mkdir(join(raiz, 'con-picos', 'pistas'), { recursive: true })
  await writeFile(
    join(raiz, 'con-picos', 'cancion.json'),
    JSON.stringify({ letra, metadatos: { duracion_ms: DUR } })
  )
  await writeFile(
    join(raiz, 'con-picos', 'pistas', `.picos-voz-v1-${'a'.repeat(64)}.bin`),
    codificarPicos(picos)
  )
  await mkdir(join(raiz, 'sin-picos'), { recursive: true })
  await writeFile(
    join(raiz, 'sin-picos', 'cancion.json'),
    JSON.stringify({ letra, metadatos: { duracion_ms: DUR } })
  )
})

afterAll(() => rm(raiz, { recursive: true, force: true }))

describe('calibrar-silencios', () => {
  it('recorre la rejilla, acierta con los valores actuales, omite lo que no tiene picos y no escribe', async () => {
    const antes = await marcas(raiz)
    const r = await calibrar(raiz)
    expect(await marcas(raiz)).toStrictEqual(antes)

    expect(r.canciones).toStrictEqual(['con-picos'])
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0]).toContain('sin-picos')
    expect(r.filas).toHaveLength(
      REJILLA.umbralRelativoDb.length *
        REJILLA.silencioMinimoMs.length *
        REJILLA.margenColaMs.length
    )
    const actual = r.filas.find((f) => f.porDefecto)!
    expect(actual).toMatchObject({ lineas: 3, errorMaximoMs: 0, sinSilencio: 0, cortes: 0 })
    expect(actual.huecosLargos).toBe(1)
    expect(formatearTabla(r).split('\n').length).toBeGreaterThan(r.filas.length)
  })

  it('no está en el paquete de electron-builder', async () => {
    const yml = await readFile(join(import.meta.dirname, '..', 'electron-builder.yml'), 'utf8')
    expect(yml).not.toContain('calibrar')
    expect(yml).not.toMatch(/^\s*- ['"]?scripts/m)
  })
})
