import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DiarioExportacion } from './diario'

let raiz: string
beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'shinobi-diario-'))
})
afterEach(() => rm(raiz, { recursive: true, force: true }))

const entrada = (temporal: string) => ({
  trabajoId: 't1',
  cancionId: 'c1',
  titulo: 'Mi canción',
  temporal,
  destino: join(raiz, 'a.mkv'),
  inicio: 1
})

describe('DiarioExportacion', () => {
  it('sin diario no hay aviso', async () => {
    expect(await new DiarioExportacion(raiz).recuperarAlArrancar()).toBeNull()
  })

  it('tras una caída borra el temporal y el diario y avisa una sola vez', async () => {
    const temporal = join(raiz, '.a.mkv.12345678.shinobi-parcial')
    await writeFile(temporal, 'parcial')
    const d = new DiarioExportacion(raiz)
    await d.escribir(entrada(temporal))
    expect(JSON.parse(await readFile(d.ruta, 'utf8')).titulo).toBe('Mi canción')
    expect(await d.recuperarAlArrancar()).toEqual({
      titulo: 'Mi canción',
      cancionId: 'c1',
      temporal,
      limpiezaFallida: false
    })
    await expect(stat(temporal)).rejects.toThrow()
    await expect(stat(d.ruta)).rejects.toThrow()
    expect(await d.recuperarAlArrancar()).toBeNull()
  })

  it('avisa aunque el temporal ya no exista', async () => {
    const d = new DiarioExportacion(raiz)
    await d.escribir(entrada(join(raiz, 'no-esta')))
    expect(await d.recuperarAlArrancar()).toMatchObject({ cancionId: 'c1', limpiezaFallida: false })
  })

  it('si el temporal no se puede borrar lo indica y el diario se borra igual', async () => {
    const temporal = join(raiz, '.a.mkv.12345678.shinobi-parcial')
    const d = new DiarioExportacion(raiz, {
      borrarArchivo: async (ruta) => {
        if (ruta === temporal) throw new Error('EBUSY')
        await rm(ruta, { force: true })
      }
    })
    await d.escribir(entrada(temporal))
    expect(await d.recuperarAlArrancar()).toMatchObject({ temporal, limpiezaFallida: true })
    await expect(stat(d.ruta)).rejects.toThrow()
  })

  it('borrar elimina el diario', async () => {
    const d = new DiarioExportacion(raiz)
    await d.escribir(entrada(join(raiz, 'x')))
    await d.borrar()
    await expect(stat(d.ruta)).rejects.toThrow()
  })
})
