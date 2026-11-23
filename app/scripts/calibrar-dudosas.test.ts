import { mkdir, mkdtemp, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generarPicos } from '../src/shared/__fixtures__/picos'
import { calibrarDudosas, formatearDudosas } from './calibrar-dudosas'

const DUR = 60_000

/** Formato v1 de main/picos/formato.ts (un solo nivel basta para `leerNivelBase`). */
function codificarPicos({ pares }: { pares: Int16Array }): Buffer {
  const bloques = pares.length / 2
  const cabecera = Buffer.alloc(24)
  cabecera.write('SKPV', 0, 'ascii')
  cabecera.writeUInt32LE(1, 4)
  cabecera.writeUInt32LE(44100, 8)
  cabecera.writeBigUInt64LE(BigInt(bloques * 441), 12)
  cabecera.writeUInt32LE(bloques, 20)
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
  return Buffer.concat([
    cabecera,
    ...niveles.map((n) => Buffer.from(n.buffer, n.byteOffset, n.byteLength))
  ])
}

const linea = (id: string, inicio: number, fin: number) => ({
  id,
  tipo: 'linea',
  texto: `Verso inventado ${id}`,
  inicio_ms: inicio,
  fin_ms: fin,
  palabras: null
})

async function arbol(dir: string): Promise<string[]> {
  const salida: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    const ruta = join(e.parentPath, e.name)
    const s = await stat(ruta)
    salida.push(`${ruta}:${s.size}:${s.mtimeMs}`)
  }
  return salida.sort()
}

let raiz: string

beforeAll(async () => {
  raiz = await realpath(await mkdtemp(join(tmpdir(), 'calibrar-dudosas-')))
  // «buena»: cada línea con su voz; «mala»: una línea cae donde no hay voz.
  const casos = {
    buena: {
      lineas: [linea('a', 2000, 5000), linea('b', 8000, 11000)],
      voz: [
        [2000, 5050],
        [8000, 11050]
      ]
    },
    mala: { lineas: [linea('a', 2000, 5000), linea('b', 8000, 11000)], voz: [[2000, 5050]] }
  } as const
  for (const [id, caso] of Object.entries(casos)) {
    await mkdir(join(raiz, id, 'pistas'), { recursive: true })
    await writeFile(
      join(raiz, id, 'cancion.json'),
      JSON.stringify({
        letra: { origen: 'manual', lrclib_id: null, offset_ms: 0, lineas: caso.lineas },
        metadatos: { titulo: `Título de ${id}`, duracion_ms: DUR }
      })
    )
    const picos = generarPicos({
      duracionMs: DUR,
      tramos: caso.voz.map(([desdeMs, hastaMs]) => ({ desdeMs, hastaMs, dbfs: -6 }))
    })
    await writeFile(
      join(raiz, id, 'pistas', `.picos-voz-v1-${'c'.repeat(64)}.bin`),
      codificarPicos(picos)
    )
  }
})
afterAll(() => rm(raiz, { recursive: true, force: true }))

describe('calibrar-dudosas', () => {
  it('cuenta las líneas señaladas por canción, mide el objetivo y no escribe nada', async () => {
    const antes = await arbol(raiz)
    const r = await calibrarDudosas(raiz)
    expect(await arbol(raiz)).toStrictEqual(antes)

    const buena = r.filas.find((f) => f.id === 'buena')!
    const mala = r.filas.find((f) => f.id === 'mala')!
    expect(buena).toMatchObject({ lineas: 2, señaladas: 0, dentroDelObjetivo: true })
    expect(mala).toMatchObject({ lineas: 2, señaladas: 1, motivos: { sinVoz: 1 } })
    expect(mala.dentroDelObjetivo).toBe(false)
    expect(r.resumen).toMatchObject({ canciones: 2, dentroDelObjetivo: 1, lineas: 4, señaladas: 1 })
  })

  it('la salida solo lleva títulos, ids y cifras: nunca el texto de la letra', async () => {
    const texto = formatearDudosas(await calibrarDudosas(raiz))
    expect(texto).toContain('Título de mala')
    expect(texto).toContain('Resumen:')
    expect(texto).not.toContain('Verso inventado')
  })
})
