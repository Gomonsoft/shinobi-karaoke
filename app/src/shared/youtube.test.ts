import { describe, expect, it } from 'vitest'
import casos from './__fixtures__/youtube-urls.json'
import { analizarUrlYoutube } from './youtube'

interface Caso {
  entrada: string
  id?: string
  codigo?: string
}

describe('analizarUrlYoutube', () => {
  it('la tabla de casos tiene al menos 25 entradas', () => {
    expect((casos as Caso[]).length).toBeGreaterThanOrEqual(25)
  })

  it.each((casos as Caso[]).map((c) => [JSON.stringify(c.entrada), c] as const))(
    '%s',
    (_n, caso) => {
      const r = analizarUrlYoutube(caso.entrada)
      if (caso.id !== undefined) {
        expect(r).toEqual({
          ok: true,
          idVideo: caso.id,
          urlCanonica: `https://www.youtube.com/watch?v=${caso.id}`
        })
      } else {
        expect(r).toEqual({ ok: false, codigo: caso.codigo })
      }
    }
  )

  it('rechaza más de 2048 caracteres aunque el principio sea válido', () => {
    const larga = `https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=${'a'.repeat(2100)}`
    expect(analizarUrlYoutube(larga)).toEqual({ ok: false, codigo: 'URL_NO_VALIDA' })
    const limite = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&x='
    expect(analizarUrlYoutube(limite + 'a'.repeat(2048 - limite.length)).ok).toBe(true)
  })

  it('no lanza con entradas que no son texto', () => {
    expect(analizarUrlYoutube(undefined as unknown as string)).toEqual({
      ok: false,
      codigo: 'URL_NO_VALIDA'
    })
  })
})
