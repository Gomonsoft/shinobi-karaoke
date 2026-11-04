import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrarConfig } from '../../shared'
import {
  escribirJsonAtomico,
  flush,
  leerJson,
  sistemaReal,
  type SistemaArchivos
} from './jsonAtomico'

const validar = (j: unknown): { n: number } => {
  if (typeof j !== 'object' || j === null || typeof (j as { n?: unknown }).n !== 'number') {
    throw new Error('inválido')
  }
  return { n: (j as { n: number }).n }
}

let dir: string
let ruta: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'shinobi-json-'))
  ruta = join(dir, 'cancion.json')
})
afterEach(async () => {
  await flush()
  vi.useRealTimers()
  await rm(dir, { recursive: true, force: true })
})

describe('escribirJsonAtomico', () => {
  it('escribe el archivo y no deja .tmp', async () => {
    await escribirJsonAtomico(ruta, { n: 1 })
    expect(JSON.parse(await readFile(ruta, 'utf8'))).toEqual({ n: 1 })
    expect(await readdir(dir)).toEqual(['cancion.json'])
  })

  it('guarda la versión anterior en .bak', async () => {
    await escribirJsonAtomico(ruta, { n: 1 })
    await escribirJsonAtomico(ruta, { n: 2 })
    expect(JSON.parse(await readFile(`${ruta}.bak`, 'utf8'))).toEqual({ n: 1 })
    expect(JSON.parse(await readFile(ruta, 'utf8'))).toEqual({ n: 2 })
  })

  it('un fallo entre escribir tmp y renombrar deja el principal intacto', async () => {
    await escribirJsonAtomico(ruta, { n: 1 })
    const sistema: SistemaArchivos = {
      ...sistemaReal,
      renombrar: () => Promise.reject(new Error('corte de luz'))
    }
    await expect(escribirJsonAtomico(ruta, { n: 2 }, { sistema })).rejects.toThrow('corte de luz')
    expect(JSON.parse(await readFile(ruta, 'utf8'))).toEqual({ n: 1 })
    expect(await readdir(dir)).not.toContain('cancion.json.tmp')
  })

  it('en Windows reintenta el renombrado ante EPERM/EBUSY', async () => {
    const renombrar = vi
      .fn<SistemaArchivos['renombrar']>()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'EPERM' }))
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'EBUSY' }))
      .mockImplementation(sistemaReal.renombrar)
    await escribirJsonAtomico(
      ruta,
      { n: 3 },
      { sistema: { ...sistemaReal, renombrar }, plataforma: 'win32', esperaReintentoMs: 1 }
    )
    expect(renombrar).toHaveBeenCalledTimes(3)
    expect(JSON.parse(await readFile(ruta, 'utf8'))).toEqual({ n: 3 })
  })

  it('en Windows se rinde tras 5 intentos; fuera de Windows no reintenta', async () => {
    const err = Object.assign(new Error('ocupado'), { code: 'EBUSY' })
    const renombrar = vi.fn<SistemaArchivos['renombrar']>().mockRejectedValue(err)
    const sistema = { ...sistemaReal, renombrar }
    await expect(
      escribirJsonAtomico(ruta, { n: 1 }, { sistema, plataforma: 'win32', esperaReintentoMs: 1 })
    ).rejects.toThrow('ocupado')
    expect(renombrar).toHaveBeenCalledTimes(5)
    renombrar.mockClear()
    await expect(
      escribirJsonAtomico(ruta, { n: 1 }, { sistema, plataforma: 'linux' })
    ).rejects.toThrow('ocupado')
    expect(renombrar).toHaveBeenCalledTimes(1)
  })

  it('100 escrituras concurrentes terminan con el último valor y un archivo válido', async () => {
    // Sin fsync reales (cientos de fsync saturan el disco con la suite en paralelo):
    // se verifica la serialización de la cola y el resultado final en disco.
    let activas = 0
    let maxActivas = 0
    const escritos: number[] = []
    const sistema: SistemaArchivos = {
      ...sistemaReal,
      async escribirYSincronizar(r, contenido) {
        activas++
        maxActivas = Math.max(maxActivas, activas)
        await writeFile(r, contenido, 'utf8')
        escritos.push((JSON.parse(contenido) as { n: number }).n)
        await new Promise((res) => setImmediate(res))
        activas--
      },
      sincronizarDirectorio: async () => undefined
    }
    await Promise.all(
      Array.from({ length: 100 }, (_, i) => escribirJsonAtomico(ruta, { n: i }, { sistema }))
    )
    expect(maxActivas).toBe(1)
    expect(escritos).toEqual(Array.from({ length: 100 }, (_, i) => i))
    expect(JSON.parse(await readFile(ruta, 'utf8'))).toEqual({ n: 99 })
    expect(await leerJson(ruta, validar, { sistema })).toMatchObject({ ok: true, datos: { n: 99 } })
  })
})

describe('debounce y flush', () => {
  it('agrupa escrituras seguidas y escribe solo la última', async () => {
    vi.useFakeTimers()
    const escribir = vi.fn(sistemaReal.escribirYSincronizar)
    const opciones = {
      debounceMs: 1000,
      sistema: { ...sistemaReal, escribirYSincronizar: escribir }
    }
    const ps = [1, 2, 3].map((n) => escribirJsonAtomico(ruta, { n }, opciones))
    await vi.advanceTimersByTimeAsync(999)
    expect(escribir).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    await Promise.all(ps)
    expect(escribir).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
    expect(JSON.parse(await readFile(ruta, 'utf8'))).toEqual({ n: 3 })
  })

  it('flush escribe lo pendiente sin esperar al debounce', async () => {
    const p = escribirJsonAtomico(ruta, { n: 7 }, { debounceMs: 60_000 })
    await flush()
    await p
    expect(JSON.parse(await readFile(ruta, 'utf8'))).toEqual({ n: 7 })
  })

  it('flush sin nada pendiente no falla', async () => {
    await expect(flush()).resolves.toBeUndefined()
    await expect(flush(ruta)).resolves.toBeUndefined()
  })

  it('una escritura inmediata absorbe la pendiente con debounce', async () => {
    const a = escribirJsonAtomico(ruta, { n: 1 }, { debounceMs: 60_000 })
    const b = escribirJsonAtomico(ruta, { n: 2 })
    await Promise.all([a, b])
    expect(JSON.parse(await readFile(ruta, 'utf8'))).toEqual({ n: 2 })
  })

  it('el error de una escritura rechaza a todos los llamantes agrupados', async () => {
    const sistema = {
      ...sistemaReal,
      escribirYSincronizar: () => Promise.reject(new Error('disco lleno'))
    }
    const a = escribirJsonAtomico(ruta, { n: 1 }, { debounceMs: 60_000, sistema })
    const b = escribirJsonAtomico(ruta, { n: 2 }, { debounceMs: 60_000, sistema })
    const r = Promise.allSettled([a, b])
    await flush()
    expect((await r).map((x) => x.status)).toEqual(['rejected', 'rejected'])
  })
})

describe('leerJson', () => {
  it('lee un archivo válido', async () => {
    await escribirJsonAtomico(ruta, { n: 5 })
    expect(await leerJson(ruta, validar)).toEqual({
      ok: true,
      datos: { n: 5 },
      recuperadoDeBak: false
    })
  })

  it('recupera desde .bak con el principal truncado y reescribe el principal', async () => {
    await escribirJsonAtomico(ruta, { n: 1 })
    await escribirJsonAtomico(ruta, { n: 2 })
    await writeFile(ruta, '{"n": 2')
    const r = await leerJson(ruta, validar)
    expect(r).toEqual({ ok: true, datos: { n: 1 }, recuperadoDeBak: true })
    expect(JSON.parse(await readFile(ruta, 'utf8'))).toEqual({ n: 1 })
  })

  it('recupera desde .bak si el principal no existe', async () => {
    await writeFile(`${ruta}.bak`, '{"n": 9}')
    expect(await leerJson(ruta, validar)).toMatchObject({ ok: true, recuperadoDeBak: true })
  })

  it('principal inválido por esquema usa el .bak', async () => {
    await writeFile(ruta, '{"x": 1}')
    await writeFile(`${ruta}.bak`, '{"n": 4}')
    expect(await leerJson(ruta, validar)).toMatchObject({ ok: true, datos: { n: 4 } })
  })

  it('ambos inválidos o ausentes devuelve error', async () => {
    expect(await leerJson(ruta, validar)).toMatchObject({ ok: false })
    await writeFile(ruta, 'basura')
    await writeFile(`${ruta}.bak`, '{"n":')
    const r = await leerJson(ruta, validar)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('Copia de seguridad')
  })

  it('limpia .tmp huérfanos', async () => {
    await escribirJsonAtomico(ruta, { n: 1 })
    await writeFile(`${ruta}.tmp`, '{"n": 99')
    await leerJson(ruta, validar)
    expect(await readdir(dir)).not.toContain('cancion.json.tmp')
  })

  it('funciona con la migración de 0006 (migrarConfig)', async () => {
    await writeFile(ruta, '{}')
    const r = await leerJson(ruta, migrarConfig)
    expect(r.ok).toBe(true)
  })

  it('una versión de esquema futura no es válida (cae a .bak)', async () => {
    await writeFile(ruta, '{"esquema": 999}')
    expect((await leerJson(ruta, migrarConfig)).ok).toBe(false)
  })
})
