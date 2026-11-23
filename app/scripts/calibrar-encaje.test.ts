import { mkdir, mkdtemp, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generarPicos } from '../src/shared/__fixtures__/picos'
import { calibrarEncaje, formatearEncaje, DESPLAZAMIENTOS_MS } from './calibrar-encaje'

const DUR = 60_000
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
  return Buffer.concat([
    cabecera,
    ...niveles.map((n) => Buffer.from(n.buffer, n.byteOffset, n.byteLength))
  ])
}

/** Cantos de ritmo propio de cada canción (duraciones y huecos que no se repiten entre ellas). */
const RITMOS: Record<string, { primero: number; duraciones: number[]; huecos: number[] }> = {
  'cancion-a': {
    primero: 3000,
    duraciones: [2000, 2600, 1800, 3000, 2200, 2400],
    huecos: [1000, 1700, 900, 2300, 1300, 1000]
  },
  'cancion-b': {
    primero: 5200,
    duraciones: [3400, 1600, 2800, 2000, 3100, 1500],
    huecos: [1900, 1100, 2600, 800, 1500, 1000]
  },
  'cancion-c': {
    primero: 2400,
    duraciones: [1500, 3200, 2100, 2700, 1700, 3300],
    huecos: [2400, 1200, 1600, 1000, 2200, 1000]
  }
}
function cantos(id: string): [number, number][] {
  const { primero, duraciones, huecos } = RITMOS[id]!
  let t = primero
  return duraciones.map((d, i) => {
    const c: [number, number] = [t, t + d]
    t += d + huecos[i]!
    return c
  })
}

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
  raiz = await realpath(await mkdtemp(join(tmpdir(), 'calibrar-encaje-')))
  for (const id of Object.keys(RITMOS)) {
    const letra = {
      origen: 'manual',
      lrclib_id: null,
      offset_ms: 0,
      lineas: cantos(id).map(([a, b], i) => ({
        id: `${id}-${i}`,
        tipo: 'linea',
        texto: `Verso inventado ${i + 1}`,
        inicio_ms: a,
        fin_ms: b,
        palabras: null
      }))
    }
    await mkdir(join(raiz, id, 'pistas'), { recursive: true })
    await writeFile(
      join(raiz, id, 'cancion.json'),
      JSON.stringify({ letra, metadatos: { titulo: `Título de ${id}`, duracion_ms: DUR } })
    )
    const picos = generarPicos({
      duracionMs: DUR,
      tramos: cantos(id).map(([desdeMs, hastaMs]) => ({ desdeMs, hastaMs, dbfs: -6 }))
    })
    await writeFile(
      join(raiz, id, 'pistas', `.picos-voz-v1-${'b'.repeat(64)}.bin`),
      codificarPicos(picos)
    )
  }
  await mkdir(join(raiz, 'sin-picos'), { recursive: true })
  await writeFile(
    join(raiz, 'sin-picos', 'cancion.json'),
    JSON.stringify({
      letra: {
        origen: 'manual',
        lrclib_id: null,
        offset_ms: 0,
        lineas: [
          {
            id: 'x',
            tipo: 'linea',
            texto: 'Otro verso',
            inicio_ms: 1000,
            fin_ms: null,
            palabras: null
          }
        ]
      },
      metadatos: { titulo: 'Sin picos', duracion_ms: DUR }
    })
  )
})
afterAll(() => rm(raiz, { recursive: true, force: true }))

describe('calibrar-encaje', () => {
  it('propias coinciden, ajenas se rechazan, desplazadas se recuperan, omite lo que no tiene picos y no escribe', async () => {
    const antes = await arbol(raiz)
    const r = await calibrarEncaje(raiz)
    expect(await arbol(raiz)).toStrictEqual(antes)

    expect(r.canciones).toStrictEqual(['cancion-a', 'cancion-b', 'cancion-c'])
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0]).toContain('sin-picos')
    expect(r.propias.map((p) => p.veredicto)).toStrictEqual(['coincide', 'coincide', 'coincide'])
    expect(r.ajenas).toHaveLength(6)
    expect(r.resumen).toMatchObject({
      propiasAceptadas: 3,
      propias: 3,
      ajenasAceptadas: 0,
      pares: 6
    })
    expect(r.desplazadas).toHaveLength(3 * DESPLAZAMIENTOS_MS.length)
    // Una letra 0,8 s más tarde que su voz se recupera con d* ≈ −0,8 s.
    const d800 = r.desplazadas.filter((d) => d.desplazamientoMs === 800)
    expect(d800.every((d) => d.recuperado && d.errorMs <= 50)).toBe(true)
    expect(r.resumen.recuperadas).toBeGreaterThanOrEqual(r.resumen.desplazadas - 3)
  })

  it('la salida solo lleva títulos, ids y cifras: nunca el texto de la letra', async () => {
    const r = await calibrarEncaje(raiz, { ids: ['cancion-a'] })
    const texto = formatearEncaje(r)
    expect(texto).toContain('Título de cancion-a')
    expect(texto).toContain('Resumen:')
    expect(texto).not.toContain('Verso inventado')
    expect(JSON.stringify(r)).not.toContain('Verso inventado')
  })
})
