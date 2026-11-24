import { describe, expect, it } from 'vitest'
import type { CandidatoLetra, EncajeCandidato } from '../../shared/letrasBusqueda'
import { elegirLetra, type CandidatoEvaluado } from './eleccion'

const linea = (i: number, texto: string) => ({
  id: `l${i}`,
  tipo: 'linea' as const,
  texto,
  inicio_ms: i * 1000,
  fin_ms: null,
  palabras: null
})
const ev = (
  id: number,
  encaje: EncajeCandidato | null,
  extra: Partial<CandidatoLetra> = {},
  texto = 'Verso inventado'
): CandidatoEvaluado => ({
  candidato: {
    lrclib_id: id,
    titulo: 't',
    artista: 'a',
    album: null,
    duracion_ms: 1,
    sincronia: 'linea',
    diferencia_ms: 0,
    lineas: [linea(1, texto), linea(2, `${texto} dos`)],
    ...extra
  },
  encaje
})
const coincide: EncajeCandidato = { veredicto: 'coincide', desfaseMs: 0 }

describe('elegirLetra (ADR 0025 §3)', () => {
  it('elige un candidato con tiempos, duración ≤ 2 s y encaje coincide', () => {
    expect(elegirLetra([ev(1, coincide)])).toMatchObject({ tipo: 'elige', desfaseMs: null })
  })

  it('con desfasada guarda la corrección', () => {
    const d = elegirLetra([ev(1, { veredicto: 'desfasada', desfaseMs: 800 })])
    expect(d).toMatchObject({ tipo: 'elige', desfaseMs: 800 })
  })

  it('nunca elige solo texto, ni con más de 2 s de diferencia (con signo), ni dudosa o no_coincide', () => {
    expect(elegirLetra([ev(1, coincide, { sincronia: 'texto' })])).toMatchObject({
      motivo: 'sin_tiempos'
    })
    expect(elegirLetra([ev(1, coincide, { diferencia_ms: 2001 })])).toMatchObject({
      motivo: 'duracion'
    })
    expect(elegirLetra([ev(1, coincide, { diferencia_ms: -2001 })])).toMatchObject({
      motivo: 'duracion'
    })
    expect(elegirLetra([ev(1, coincide, { diferencia_ms: -2000 })]).tipo).toBe('elige')
    expect(elegirLetra([ev(1, { veredicto: 'dudosa', desfaseMs: 0 })])).toMatchObject({
      motivo: 'dudosa'
    })
    expect(elegirLetra([ev(1, { veredicto: 'no_coincide', desfaseMs: 0 })])).toMatchObject({
      motivo: 'no_coincide'
    })
    expect(elegirLetra([ev(1, null)])).toMatchObject({ motivo: 'sin_encaje' })
    expect(elegirLetra([ev(1, { veredicto: 'no_comprobable', desfaseMs: 0 })]).tipo).toBe(
      'no_elige'
    )
  })

  it('con varios válidos elige el primero si dicen lo mismo (aunque cambien mayúsculas o signos)', () => {
    const d = elegirLetra([ev(1, coincide), ev(2, coincide, {}, 'VERSO inventado,')])
    expect(d).toMatchObject({ tipo: 'elige', candidato: { lrclib_id: 1 } })
  })

  it('con dos válidos de texto distinto es ambiguo', () => {
    expect(
      elegirLetra([ev(1, coincide), ev(2, coincide, {}, 'Otra cosa inventada')])
    ).toStrictEqual({ tipo: 'no_elige', motivo: 'ambigua' })
  })

  it('un candidato no válido de otro texto no crea ambigüedad', () => {
    const d = elegirLetra([
      ev(1, coincide),
      ev(2, { veredicto: 'no_coincide', desfaseMs: 0 }, {}, 'Otra cosa inventada')
    ])
    expect(d.tipo).toBe('elige')
  })

  describe('elegir sin comprobar (revisión de ADR 0025, 2026-11-23)', () => {
    const limitada = (limitacion: 'vozContinua' | 'sinContraste'): EncajeCandidato => ({
      veredicto: 'dudosa',
      desfaseMs: 0,
      limitacion
    })

    it.each(['vozContinua', 'sinContraste'] as const)('elige un único `dudosa` con %s', (l) => {
      expect(elegirLetra([ev(1, limitada(l))])).toMatchObject({
        tipo: 'elige',
        candidato: { lrclib_id: 1 },
        desfaseMs: null,
        sinComprobar: true,
        limitacion: l
      })
    })

    it('`dudosa` sin limitación no se elige', () => {
      expect(elegirLetra([ev(1, { veredicto: 'dudosa', desfaseMs: 0, limitacion: null })])).toEqual(
        {
          tipo: 'no_elige',
          motivo: 'dudosa'
        }
      )
    })

    it('con el mismo texto (mayúsculas y signos aparte) elige el primero; con textos distintos, ambigua', () => {
      expect(
        elegirLetra([
          ev(1, limitada('vozContinua')),
          ev(2, limitada('sinContraste'), {}, 'VERSO inventado,')
        ])
      ).toMatchObject({ tipo: 'elige', candidato: { lrclib_id: 1 }, sinComprobar: true })
      expect(
        elegirLetra([
          ev(1, limitada('vozContinua')),
          ev(2, limitada('vozContinua'), {}, 'Otra cosa inventada')
        ])
      ).toStrictEqual({ tipo: 'no_elige', motivo: 'ambigua' })
    })

    it('un `coincide` manda sobre un `dudosa` con limitación de otro texto', () => {
      expect(
        elegirLetra([ev(1, limitada('vozContinua'), {}, 'Otra cosa inventada'), ev(2, coincide)])
      ).toMatchObject({ tipo: 'elige', candidato: { lrclib_id: 2 }, sinComprobar: false })
    })

    it('a 2500 ms de duración no se elige', () => {
      expect(elegirLetra([ev(1, limitada('sinContraste'), { diferencia_ms: 2500 })])).toEqual({
        tipo: 'no_elige',
        motivo: 'duracion'
      })
    })
  })

  it('sin candidatos no elige', () => {
    expect(elegirLetra([]).tipo).toBe('no_elige')
  })
})
