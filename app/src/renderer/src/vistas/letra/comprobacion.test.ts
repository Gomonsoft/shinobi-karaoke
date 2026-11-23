import { describe, expect, it } from 'vitest'
import { evaluarEncajeConPicos } from '@shared/encaje'
import type { CandidatoLetra } from '@shared/letrasBusqueda'
import { letra, linea } from '@shared/__fixtures__'
import {
  comprobacionDe,
  detalleNoCoincide,
  esConcluyente,
  grupoDeOrden,
  indiceDelMejor,
  motivosNoCoincide,
  sinPicos,
  textoComprobacion
} from './comprobacion'
import { segundosDe } from './textosComprobacion'

const cand = (extra: Partial<CandidatoLetra>): CandidatoLetra => ({
  lrclib_id: 1,
  titulo: 't',
  artista: 'a',
  album: null,
  duracion_ms: 1000,
  sincronia: 'linea',
  diferencia_ms: 0,
  lineas: [],
  ...extra
})
const texto = (c: ReturnType<typeof comprobacionDe>) => textoComprobacion(c, segundosDe)

describe('comprobación de un candidato', () => {
  it('cada veredicto lleva su texto; el signo del desfase da adelantada o atrasada', () => {
    const v = (veredicto: 'coincide' | 'desfasada' | 'dudosa' | 'no_coincide', desfaseMs = 0) =>
      texto(comprobacionDe(cand({ encaje: { veredicto, desfaseMs } }), 'lista', true))
    expect(v('coincide')).toBe('Coincide con tu audio')
    expect(v('desfasada', 800)).toBe('Va 0,8 s adelantada: la corregiremos')
    expect(v('desfasada', -1500)).toBe('Va 1,5 s atrasada: la corregiremos')
    expect(v('dudosa')).toBe('No está claro si coincide con tu audio')
    expect(v('no_coincide')).toBe('No coincide con tu audio: puede ser otra versión')
  })

  it('una dudosa con limitación dice que no se puede comprobar y no propone nada', () => {
    const c = comprobacionDe(
      cand({ encaje: { veredicto: 'dudosa', desfaseMs: 1200, limitacion: 'vozContinua' } }),
      'lista',
      true
    )
    expect(c).toStrictEqual({ tipo: 'dudosa', limitacion: 'vozContinua' })
    expect(texto(c)).toBe('No podemos comprobarla con tu audio')
    expect(
      grupoDeOrden(
        cand({ encaje: { veredicto: 'dudosa', desfaseMs: 0, limitacion: 'sinContraste' } })
      )
    ).toBe(1)
  })

  it('solo texto o no comprobable no muestran línea; sin picos depende de su estado', () => {
    expect(texto(comprobacionDe(cand({ sincronia: 'texto' }), 'lista', true))).toBeNull()
    expect(texto(comprobacionDe(cand({ encaje: null }), 'lista', true))).toBeNull()
    const sin = (p: Parameters<typeof sinPicos>[0], separada: boolean) =>
      texto(comprobacionDe(cand({}), p, separada))
    expect(sin(null, true)).toBe('Comprobando con tu audio…')
    expect(sin('generando', true)).toBe('Se comprobará con tu audio al terminar la separación')
    expect(sin('no_disponible', false)).toBe('Se comprobará con tu audio al terminar la separación')
    expect(sin('no_disponible', true)).toBe('No se pudo comprobar con tu audio')
    expect(sin('error', false)).toBe('No se pudo comprobar con tu audio')
  })

  it('solo coincide, desfasada y no coincide sustituyen a la duración', () => {
    expect(esConcluyente({ tipo: 'coincide' })).toBe(true)
    expect(esConcluyente({ tipo: 'desfasada', desfaseMs: 600 })).toBe(true)
    expect(esConcluyente({ tipo: 'noCoincide' })).toBe(true)
    for (const tipo of ['dudosa', 'pendiente', 'noDisponible', 'comprobando'] as const)
      expect(esConcluyente({ tipo })).toBe(false)
  })

  it('orden en cuatro grupos y mejor candidato', () => {
    const e = (veredicto: 'coincide' | 'no_coincide' | 'dudosa') =>
      cand({ encaje: { veredicto, desfaseMs: 0 } })
    expect(grupoDeOrden(e('coincide'))).toBe(0)
    expect(grupoDeOrden(e('dudosa'))).toBe(1)
    expect(grupoDeOrden(cand({}))).toBe(1)
    expect(grupoDeOrden(cand({ sincronia: 'texto' }))).toBe(2)
    expect(grupoDeOrden(e('no_coincide'))).toBe(3)
    expect(indiceDelMejor([cand({}), e('no_coincide'), e('coincide')])).toBe(2)
    expect(indiceDelMejor([cand({}), e('dudosa')])).toBe(-1)
  })
})

describe('motivos de un no_coincide', () => {
  // Voz en [0, 10 s) y [30 s, 40 s); la letra tiene líneas sobre el hueco [10, 30).
  const pares = new Int16Array(4000 * 2)
  for (let i = 0; i < 4000; i++) {
    const voz = i < 1000 || i >= 3000
    pares[i * 2] = voz ? -8000 : 0
    pares[i * 2 + 1] = voz ? 8000 : 0
  }
  it('lista las líneas sobre silencio y la voz sin letra, con tramos en m:ss', () => {
    const l = letra([
      linea('1', 'Uno', 1000, { fin_ms: 2000 }),
      linea('2', 'Dos', 12000, { fin_ms: 14000 }),
      linea('3', 'Tres', 16000, { fin_ms: 18000 }),
      linea('4', 'Cuatro', 20000, { fin_ms: 22000 }),
      linea('5', 'Cinco', 24000, { fin_ms: 26000 }),
      linea('6', 'Seis', 28000, { fin_ms: 29000 })
    ])
    const r = evaluarEncajeConPicos(l, { pasoMs: 10, pares }, { duracionMs: 40000 })
    expect(r.veredicto).toBe('no_coincide')
    const d = detalleNoCoincide(l, r, 40000)
    expect(d.lineasSinVoz).toBeGreaterThanOrEqual(4)
    expect(d.silencio).toHaveLength(1)
    expect(d.silencio[0]).toMatchObject({ desdeMs: 12000, lineaId: '2' })
    const m = motivosNoCoincide(d)
    expect(m[0]).toMatch(/líneas caen donde no hay voz \(de 0:12 a 0:2\d\)\.$/)
    expect(m.length).toBeLessThanOrEqual(3)
  })
})
