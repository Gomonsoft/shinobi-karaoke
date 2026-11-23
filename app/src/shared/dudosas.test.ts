import { describe, expect, it } from 'vitest'
import {
  contarImportantes,
  contarRevisadas,
  detectarDudosas,
  esImportante,
  revisadaVigente,
  type MotivoDudosa
} from './dudosas'
import type { ElementoLetra, Letra } from './letra'

const DURACION = 120_000

function linea(
  id: string,
  inicio: number | null,
  fin: number | null,
  texto = 'una frase inventada',
  extra: Partial<ElementoLetra> = {}
): ElementoLetra {
  return { id, tipo: 'linea', texto, inicio_ms: inicio, fin_ms: fin, palabras: null, ...extra }
}

const letraDe = (lineas: ElementoLetra[], offset_ms = 0): Letra => ({
  origen: 'manual',
  lrclib_id: null,
  offset_ms,
  lineas
})

/** Una línea objetivo en 10 000 y otra lejos, en 60 000, que cierra el límite. */
const conCola = (objetivo: ElementoLetra): Letra =>
  letraDe([objetivo, linea('cola', 60_000, 62_000, 'cola de la canción')])

const motivosDe = (
  letra: Letra,
  voz: [number, number][] | null,
  id = 'x'
): MotivoDudosa[] | undefined =>
  detectarDudosas(letra, voz ? { intervalos: voz } : null, { duracionMs: DURACION }).find(
    (d) => d.id === id
  )?.motivos

describe('detectarDudosas', () => {
  it('una línea que cuadra con la voz no se señala', () => {
    expect(motivosDe(conCola(linea('x', 10_000, 13_000)), [[10_000, 13_050]])).toBeUndefined()
  })

  it('sinInicio', () => {
    expect(motivosDe(conCola(linea('x', null, null)), [])).toEqual(['sinInicio'])
  })

  it('sinVoz: positivo y negativo', () => {
    expect(motivosDe(conCola(linea('x', 10_000, 13_000)), [[40_000, 42_000]])).toEqual(['sinVoz'])
    expect(motivosDe(conCola(linea('x', 10_000, 13_000)), [[10_000, 13_000]])).toBeUndefined()
  })

  it('vozTarde: la voz empieza después de la ventana inicial, con su cifra', () => {
    const letra = conCola(linea('x', 10_000, 13_000))
    const d = detectarDudosas(letra, { intervalos: [[11_200, 13_000]] }, { duracionMs: DURACION })
    expect(d[0]).toMatchObject({ id: 'x', motivos: ['vozTarde'], detalleMs: 1200 })
    // Con voz dentro de los primeros 500 ms ya no.
    expect(motivosDe(letra, [[10_300, 13_000]])).toBeUndefined()
  })

  it('finCorta: la voz sigue tras el fin y la siguiente tarda', () => {
    const letra = conCola(linea('x', 10_000, 13_000))
    const d = detectarDudosas(letra, { intervalos: [[10_000, 14_500]] }, { duracionMs: DURACION })
    expect(d[0]).toMatchObject({ motivos: ['finCorta'], detalleMs: 1500 })
    // Si la siguiente línea empieza enseguida, no hay hueco para que la voz «sobre».
    const pegada = letraDe([linea('x', 10_000, 13_000), linea('y', 13_400, 15_000)])
    expect(motivosDe(pegada, [[10_000, 15_000]])).toBeUndefined()
    // Voz que apenas sobrepasa el fin: no llega al 90 % de la ventana.
    expect(motivosDe(letra, [[10_000, 13_300]])).toBeUndefined()
  })

  it('finTarde: con fin fijado y con fin automático', () => {
    const fijado = conCola(linea('x', 10_000, 16_000))
    const d = detectarDudosas(fijado, { intervalos: [[10_000, 13_000]] }, { duracionMs: DURACION })
    expect(d[0]).toMatchObject({ motivos: ['finTarde'], detalleMs: 3000, finAutomatico: false })

    const auto = letraDe([linea('x', 10_000, null), linea('y', 16_000, 18_000)])
    const da = detectarDudosas(
      auto,
      {
        intervalos: [
          [10_000, 13_000],
          [16_000, 18_000]
        ]
      },
      { duracionMs: DURACION }
    )
    expect(da.find((l) => l.id === 'x')).toMatchObject({
      motivos: ['finTarde'],
      finAutomatico: true
    })
    // Una voz que termina a menos de 1,2 s del fin no se señala.
    expect(motivosDe(fijado, [[10_000, 15_000]])).toBeUndefined()
  })

  it('muyCorta: por duración y por ritmo; muyLarga: lenta', () => {
    expect(motivosDe(conCola(linea('x', 10_000, 10_200)), null)).toEqual(['muyCorta'])
    const rapida = linea('x', 10_000, 11_000, 'a'.repeat(40))
    expect(motivosDe(conCola(rapida), null)).toEqual(['muyCorta'])
    const lenta = linea('x', 10_000, 18_000, 'oh')
    expect(motivosDe(conCola(lenta), null)).toEqual(['muyLarga'])
    // Dentro de lo normal, ninguna.
    expect(motivosDe(conCola(linea('x', 10_000, 13_000)), null)).toBeUndefined()
  })

  it('reconocimiento: confianza baja de la alineación', () => {
    const baja = linea('x', 10_000, 13_000, undefined, { alineacion: { confianza: 0.3 } })
    expect(motivosDe(conCola(baja), null)).toEqual(['reconocimiento'])
    const alta = linea('x', 10_000, 13_000, undefined, { alineacion: { confianza: 0.9 } })
    expect(motivosDe(conCola(alta), null)).toBeUndefined()
  })

  it('sin picos solo aplica los motivos que no necesitan la voz', () => {
    const letra = conCola(linea('x', 10_000, 13_000))
    expect(motivosDe(letra, null)).toBeUndefined()
    expect(motivosDe(conCola(linea('x', null, null)), null)).toEqual(['sinInicio'])
  })

  it('varios motivos van en orden de prioridad y cuentan', () => {
    const letra = conCola(linea('x', 10_000, 20_000, 'ah', { alineacion: { confianza: 0.1 } }))
    const d = detectarDudosas(letra, { intervalos: [[11_000, 12_000]] }, { duracionMs: DURACION })
    expect(d[0]!.motivos).toEqual(['reconocimiento', 'vozTarde', 'finTarde', 'muyLarga'])
    expect(d[0]!.prioridad).toBe(4)
  })

  it('usa el desfase de la letra (tiempo de audio)', () => {
    const letra = letraDe([linea('x', 10_000, 13_000), linea('cola', 60_000, 62_000)], 2000)
    expect(motivosDe(letra, [[12_000, 15_050]])).toBeUndefined()
    expect(motivosDe(letra, [[14_000, 15_050]])).toContain('vozTarde')
  })

  it('las pausas no son líneas', () => {
    const letra = letraDe([
      linea('x', 10_000, 13_000),
      { id: 'p', tipo: 'pausa', texto: '', inicio_ms: 14_000, fin_ms: null, palabras: null },
      linea('y', 20_000, 23_000)
    ])
    expect(detectarDudosas(letra, null, { duracionMs: DURACION })).toEqual([])
  })
})

describe('revisada', () => {
  const revisada = { inicio_ms: 10_000, fin_ms: 13_000, texto: 'una frase inventada' }
  const voz = [[40_000, 42_000]] as [number, number][]

  it('una línea dada por buena vigente no se señala', () => {
    const letra = conCola(linea('x', 10_000, 13_000, undefined, { revisada }))
    expect(revisadaVigente(letra, 'x', DURACION)).toBe(true)
    expect(motivosDe(letra, voz)).toBeUndefined()
    expect(contarRevisadas(letra, DURACION)).toBe(1)
  })

  it('deja de valer si cambia el inicio, el fin o el texto', () => {
    for (const cambio of [
      linea('x', 10_100, 13_000, undefined, { revisada }),
      linea('x', 10_000, 13_200, undefined, { revisada }),
      linea('x', 10_000, 13_000, 'otro texto distinto', { revisada })
    ]) {
      const letra = conCola(cambio)
      expect(revisadaVigente(letra, 'x', DURACION)).toBe(false)
      expect(motivosDe(letra, voz)).toEqual(['sinVoz'])
    }
  })

  it('compara con el fin efectivo (también si es automático)', () => {
    const auto = letraDe([
      linea('x', 10_000, null, undefined, {
        revisada: { inicio_ms: 10_000, fin_ms: 16_000, texto: 'una frase inventada' }
      }),
      linea('y', 16_000, 18_000)
    ])
    expect(revisadaVigente(auto, 'x', DURACION)).toBe(true)
  })
})

describe('importantes para «Marcar como lista» (F11-E12)', () => {
  const d = (motivos: MotivoDudosa[], finAutomatico = false) => ({ motivos, finAutomatico })
  it.each<[string, MotivoDudosa[], boolean, boolean]>([
    ['sinVoz', ['sinVoz'], false, true],
    ['vozTarde', ['vozTarde'], true, true],
    ['reconocimiento', ['reconocimiento'], true, true],
    ['finCorta con fin fijado', ['finCorta'], false, true],
    ['finCorta con fin automático', ['finCorta'], true, false],
    ['finTarde con fin fijado', ['finTarde'], false, true],
    ['finTarde con fin automático', ['finTarde'], true, false],
    ['muyCorta', ['muyCorta'], false, false],
    ['muyLarga', ['muyLarga'], false, false],
    ['sinInicio', ['sinInicio'], false, false],
    ['automático + otro importante', ['finTarde', 'muyCorta', 'sinVoz'], true, true]
  ])('%s', (_n, motivos, auto, esperado) => {
    expect(esImportante(d(motivos, auto))).toBe(esperado)
  })
  it('cuenta solo las importantes', () => {
    const lista = [
      { id: 'a', prioridad: 1, detalles: {}, ...d(['muyCorta']) },
      { id: 'b', prioridad: 1, detalles: {}, ...d(['sinVoz']) }
    ]
    expect(contarImportantes(lista)).toBe(1)
  })
})

describe('finTarde con fin automático (R4)', () => {
  it('se marca como automático y no cuenta como importante', () => {
    const letra = letraDe([linea('x', 10_000, null), linea('y', 16_000, 18_000)])
    const [d] = detectarDudosas(
      letra,
      {
        intervalos: [
          [10_000, 13_000],
          [16_000, 18_000]
        ]
      },
      { duracionMs: DURACION }
    )
    expect(d).toMatchObject({ id: 'x', motivos: ['finTarde'], finAutomatico: true })
    expect(contarImportantes([d!])).toBe(0)
  })
})
