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
  it('oculta los marcadores de generación del texto que se presenta en la app', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'legal-'))
    await writeFile(
      join(dir, 'THIRD_PARTY_NOTICES.md'),
      '# Avisos\n<!-- inicio:dependencias-js -->\nLicencia JS\n<!-- fin:dependencias-js -->\n' +
        '<!-- inicio:dependencias-python -->\nLicencia Python\n<!-- fin:dependencias-python -->\n'
    )
    const texto = await leerTextoLegal('terceros', {
      empaquetada: false,
      dirRecursos: '/no-existe',
      raizRepo: dir
    })
    expect(texto).toBe('# Avisos\nLicencia JS\nLicencia Python\n')
    expect(texto).not.toContain('<!--')
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
    const terceros = await leerTextoLegal('terceros', {
      empaquetada: false,
      dirRecursos: '',
      raizRepo
    })
    expect(terceros).toContain('Avisos de terceros')
    expect(terceros).not.toContain('<!--')
  })
})
