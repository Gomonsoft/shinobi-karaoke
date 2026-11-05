import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leerTextoLegal } from './textoLegal'

describe('leerTextoLegal', () => {
  it('lee LICENSE y THIRD_PARTY_NOTICES.md de la raíz o de los recursos', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'legal-'))
    await writeFile(join(dir, 'LICENSE'), 'GPL texto')
    await writeFile(join(dir, 'THIRD_PARTY_NOTICES.md'), '# Avisos')
    const sin = { empaquetada: false, dirRecursos: '/no-existe', raizRepo: dir }
    const con = { empaquetada: true, dirRecursos: dir, raizRepo: '/no-existe' }
    expect(await leerTextoLegal('gpl', sin)).toBe('GPL texto')
    expect(await leerTextoLegal('terceros', con)).toBe('# Avisos')
  })
  it('rechaza un tipo desconocido', async () => {
    await expect(
      leerTextoLegal('../x' as never, { empaquetada: false, dirRecursos: '', raizRepo: '' })
    ).rejects.toThrow()
  })
  it('lee los archivos reales del repo', async () => {
    const raizRepo = join(__dirname, '..', '..', '..')
    expect(
      await leerTextoLegal('gpl', { empaquetada: false, dirRecursos: '', raizRepo })
    ).toContain('GNU GENERAL PUBLIC LICENSE')
    expect(
      await leerTextoLegal('terceros', { empaquetada: false, dirRecursos: '', raizRepo })
    ).toContain('Avisos de terceros')
  })
})
