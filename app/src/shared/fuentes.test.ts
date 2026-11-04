/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FUENTE_PREDETERMINADA,
  FUENTES_REGISTRO,
  buscarFuente,
  familiaValida,
  generarFontFace
} from './fuentes'
import { estiloSchema, ESTILO_PREDETERMINADO } from './estilo'

const RAIZ = resolve(import.meta.dirname, '../../resources/fonts')

describe('registro de fuentes incluidas', () => {
  it('tiene las 8 familias decididas con el peso indicado', () => {
    expect(FUENTES_REGISTRO.map((f) => [f.familia, f.peso])).toEqual([
      ['Atkinson Hyperlegible Next', 700],
      ['Nunito', 800],
      ['Montserrat', 700],
      ['Oswald', 600],
      ['Lora', 700],
      ['Playfair Display', 800],
      ['Bangers', 400],
      ['Noto Sans', 700]
    ])
    expect(FUENTES_REGISTRO[0]?.familia).toBe(FUENTE_PREDETERMINADA)
  })

  it.each(FUENTES_REGISTRO.map((f) => [f.familia, f] as const))(
    '%s: existe el WOFF2 y su licencia OFL 1.1',
    (_, f) => {
      const archivo = resolve(RAIZ, f.archivo)
      expect(existsSync(archivo)).toBe(true)
      expect(readFileSync(archivo).subarray(0, 4).toString('latin1')).toBe('wOF2')
      const licencia = readFileSync(resolve(dirname(archivo), 'OFL.txt'), 'utf8')
      expect(licencia).toContain('SIL OPEN FONT LICENSE Version 1.1')
    }
  )

  it('no hay WOFF2 en resources/fonts fuera del registro', () => {
    const enDisco = readdirSync(RAIZ, { recursive: true, encoding: 'utf8' })
      .filter((p) => p.endsWith('.woff2'))
      .map((p) => p.split('\\').join('/'))
    const registrados = new Set(FUENTES_REGISTRO.map((f) => f.archivo))
    // Atkinson 400 y 600 son de la interfaz, no del registro de la letra.
    const extra = enDisco.filter(
      (p) => !registrados.has(p) && !p.startsWith('atkinson-hyperlegible-next/')
    )
    expect(extra).toEqual([])
  })

  it('pesa en total 2,5 MB o menos', () => {
    const total = FUENTES_REGISTRO.reduce((n, f) => n + statSync(resolve(RAIZ, f.archivo)).size, 0)
    expect(total).toBeLessThanOrEqual(2.5 * 1024 * 1024)
  })

  it('una familia desconocida cae a la predeterminada', () => {
    expect(familiaValida('Comic Sans')).toBe(FUENTE_PREDETERMINADA)
    expect(familiaValida('Lora')).toBe('Lora')
    expect(buscarFuente('Nope')).toBeUndefined()
    const estilo = estiloSchema.parse({
      ...ESTILO_PREDETERMINADO,
      letra: {
        ...ESTILO_PREDETERMINADO.letra,
        fuente: { familia: 'Nope', origen: 'incluida' }
      }
    })
    expect(estilo.letra.fuente.familia).toBe(FUENTE_PREDETERMINADA)
  })

  it('genera una @font-face por familia', () => {
    const css = generarFontFace((a) => `/f/${a}`)
    expect(css.match(/@font-face/g)).toHaveLength(FUENTES_REGISTRO.length)
    expect(css).toContain("font-family:'Playfair Display';font-weight:400 900")
    expect(css).toContain("url('/f/lora/Lora-Bold.woff2')")
  })
})
