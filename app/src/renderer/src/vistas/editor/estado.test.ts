import { describe, expect, it } from 'vitest'
import { letra, linea, pausa } from '@shared/__fixtures__'
import { estiloPredeterminado } from '@shared/estilo'
import {
  estadoInicial,
  gestoMarcadorVigente,
  iniciarGestoMarcador,
  moverGestoMarcador,
  puedeDeshacer,
  puedeRehacer,
  reducirEditor,
  ultimaMarcaDeSesion
} from './estado'

describe('gesto de marcadores', () => {
  const duracionMs = 10_000

  function estadoParaGesto(offset_ms = 0) {
    const conPalabras = {
      ...linea('1', 'Dos palabras', 1000),
      palabras: [
        { texto: 'Dos', inicio_ms: 1000, fin_ms: 1400 },
        { texto: 'palabras', inicio_ms: 1400, fin_ms: 1800 }
      ]
    }
    return estadoInicial(
      {
        letra: {
          ...letra([conPalabras, { ...pausa('p'), inicio_ms: 2200 }, linea('2', 'Sigue', 3000)]),
          offset_ms
        },
        estilo: estiloPredeterminado()
      },
      '1'
    )
  }

  it.each([-200, 200])('previsualiza desde la misma base con offset %i', (offset) => {
    const e = estadoParaGesto(offset)
    const original = iniciarGestoMarcador(e, 'inicio', duracionMs)!
    const primera = moverGestoMarcador(original, 1500 + offset)
    const segunda = moverGestoMarcador(primera, 1200 + offset)
    expect(primera.resultado?.letra.lineas[0]?.inicio_ms).toBe(1500)
    expect(segunda.resultado?.letra.lineas[0]).toMatchObject({
      inicio_ms: 1200,
      palabras: [
        { inicio_ms: 1200, fin_ms: 1600 },
        { inicio_ms: 1600, fin_ms: 2000 }
      ]
    })
    expect(e.actual.letra.lineas[0]?.inicio_ms).toBe(1000)
    expect(e.version).toBe(0)
    expect(e.pasado).toHaveLength(0)

    const confirmada = reducirEditor(e, { tipo: 'confirmar_marcador', gesto: segunda, ahora: 0 })
    expect(confirmada.actual.letra).toBe(segunda.resultado?.letra)
    expect(confirmada.version).toBe(1)
    expect(confirmada.pasado).toHaveLength(1)
    expect(reducirEditor(confirmada, { tipo: 'deshacer' }).actual.letra).toBe(e.actual.letra)
  })

  it('mantiene el último límite legal junto a la pausa y consolida las consecuencias', () => {
    const e = estadoParaGesto()
    const original = iniciarGestoMarcador(e, 'inicio', duracionMs)!
    const provisional = moverGestoMarcador(moverGestoMarcador(original, 2400), 2700)
    const limite = { tipo: 'inicio_siguiente', vecino: 'pausa' }
    expect(provisional.resultado).toMatchObject({ limite, palabrasDescartadas: ['1'] })
    expect(provisional.resultado?.letra.lineas[0]).toMatchObject({
      inicio_ms: 2199,
      palabras: null
    })
    const confirmada = reducirEditor(e, {
      tipo: 'confirmar_marcador',
      gesto: provisional,
      ahora: 1
    })
    expect(confirmada.aviso).toMatchObject({
      tipo: 'consecuencias',
      id: '1',
      limite,
      palabrasDescartadas: ['1'],
      n: 1
    })
    expect(
      reducirEditor(confirmada, { tipo: 'confirmar_marcador', gesto: provisional, ahora: 2 })
    ).toBe(confirmada)
    expect(reducirEditor(confirmada, { tipo: 'deshacer' }).actual.letra).toBe(e.actual.letra)
  })

  it('conserva el fin automático al volver al origen y lo restaura al deshacer', () => {
    const e = estadoParaGesto()
    const original = iniciarGestoMarcador(e, 'fin', duracionMs)!
    const provisional = moverGestoMarcador(original, 2100)
    const vuelta = moverGestoMarcador(provisional, original.tiempoOriginalMs)
    expect(reducirEditor(e, { tipo: 'confirmar_marcador', gesto: original, ahora: 0 })).toBe(e)
    expect(reducirEditor(e, { tipo: 'confirmar_marcador', gesto: vuelta, ahora: 1 })).toBe(e)
    const confirmada = reducirEditor(e, {
      tipo: 'confirmar_marcador',
      gesto: provisional,
      ahora: 2
    })
    expect(confirmada.actual.letra.lineas[0]?.fin_ms).toBe(2100)
    expect(confirmada.pasado).toHaveLength(1)
    expect(
      reducirEditor(confirmada, { tipo: 'deshacer' }).actual.letra.lineas[0]?.fin_ms
    ).toBeNull()
  })

  it('avisa sin fijar un fin automático que ya coincide con el límite', () => {
    const e = estadoParaGesto()
    e.actual.letra.lineas[0]!.palabras = null
    const original = iniciarGestoMarcador(e, 'fin', duracionMs)!
    const gesto = moverGestoMarcador(original, 4000)
    const confirmada = reducirEditor(e, { tipo: 'confirmar_marcador', gesto, ahora: 0 })
    expect(confirmada.actual).toBe(e.actual)
    expect(confirmada.version).toBe(0)
    expect(confirmada.pasado).toHaveLength(0)
    expect(confirmada.aviso).toMatchObject({ tipo: 'limite', limite: { tipo: 'fin_siguiente' } })
  })

  it('rechaza confirmaciones con selección, revisión o letra base obsoletas', () => {
    const e = estadoParaGesto()
    const gesto = moverGestoMarcador(iniciarGestoMarcador(e, 'fin', duracionMs)!, 2100)
    const externa = estadoParaGesto()
    expect(gestoMarcadorVigente(e, gesto)).toBe(true)
    for (const invalida of [
      reducirEditor(e, { tipo: 'seleccionar', id: '2' }),
      reducirEditor(e, { tipo: 'desplazar', deltaMs: 100, ahora: 0 }),
      reducirEditor(e, { tipo: 'entrar_sync', desdeId: '1' }),
      reducirEditor(e, { tipo: 'cargar', instantanea: externa.actual, seleccion: '1' })
    ]) {
      expect(gestoMarcadorVigente(invalida, gesto)).toBe(false)
      expect(reducirEditor(invalida, { tipo: 'confirmar_marcador', gesto, ahora: 1 })).toBe(
        invalida
      )
    }
  })
})

function editor() {
  return estadoInicial(
    {
      estilo: estiloPredeterminado(),
      letra: letra([
        ...[1, 2, 3].map((i) => linea(String(i), `Verso ${i}`, null)),
        pausa('p'),
        ...[4, 5, 6].map((i) => linea(String(i), `Verso ${i}`, null))
      ])
    },
    null
  )
}

describe('sesión de sincronía', () => {
  it('marca seis líneas saltando la pausa y permite deshacer las dos últimas', () => {
    let e = reducirEditor(editor(), { tipo: 'entrar_sync', desdeId: null })
    expect(e.seleccion).toBe('1')
    for (let i = 1; i <= 6; i++) {
      e = reducirEditor(e, { tipo: 'marcar', ms: i * 1000, ahora: i * 1000 })
    }
    expect(e.sync.siguiente).toBeNull()
    expect(ultimaMarcaDeSesion(e)).toEqual({ id: '6', ms: 6000 })
    e = reducirEditor(reducirEditor(e, { tipo: 'deshacer_marca' }), { tipo: 'deshacer_marca' })
    expect(e.sync.siguiente).toBe('5')
    expect(e.actual.letra.lineas.at(-2)?.inicio_ms).toBeNull()
    e = reducirEditor(e, { tipo: 'marcar', ms: 5500, ahora: 7000 })
    expect(e.sync.siguiente).toBe('6')
    expect(ultimaMarcaDeSesion(e)).toEqual({ id: '5', ms: 5500 })
    expect(puedeRehacer(e)).toBe(false)
  })

  it('marca y fija fin al soltar en una entrada, limitada por el vecino', () => {
    let e = editor()
    e.actual.letra.lineas[1]!.inicio_ms = 4000
    e = reducirEditor(e, { tipo: 'entrar_sync', desdeId: '1' })
    e = reducirEditor(e, { tipo: 'marcar', ms: 2000, ahora: 0 })
    e = reducirEditor(e, { tipo: 'fin_al_soltar', id: '1', ms: 4500, duracionMs: 30000 })
    expect(e.pasado).toHaveLength(1)
    expect(e.actual.letra.lineas[0]).toMatchObject({ inicio_ms: 2000, fin_ms: 4000 })
    e = reducirEditor(e, { tipo: 'deshacer_marca' })
    expect(e.actual.letra.lineas[0]).toMatchObject({ inicio_ms: null, fin_ms: null })
    e = reducirEditor(e, { tipo: 'rehacer' })
    expect(ultimaMarcaDeSesion(e)).toEqual({ id: '1', ms: 2000 })
    expect(e.actual.letra.lineas[0]?.fin_ms).toBe(4000)
  })

  it('avisa al marcar pronto y bloquea los ajustes finos y de estilo durante la pasada', () => {
    let e = reducirEditor(editor(), { tipo: 'entrar_sync', desdeId: null })
    e = reducirEditor(e, { tipo: 'marcar', ms: 1000, ahora: 0 })
    e = reducirEditor(e, { tipo: 'marcar', ms: 1000, ahora: 1 })
    expect(e.aviso).toMatchObject({ tipo: 'limite', limite: { tipo: 'demasiado_pronto' }, id: '2' })
    expect(e.sync.siguiente).toBe('2')
    expect(reducirEditor(e, { tipo: 'borrar_tiempos', ahora: 2 })).toBe(e)
    expect(reducirEditor(e, { tipo: 'mover_seleccion', sentido: -1 })).toBe(e)
    expect(reducirEditor(e, { tipo: 'ajustar_inicio', deltaMs: 10, ahora: 2 })).toBe(e)
    const estilo = { ...e.actual.estilo, fondo: { tipo: 'solido', color: '#112233' } as const }
    expect(reducirEditor(e, { tipo: 'estilo', estilo, clave: 'fondo.tipo', ahora: 2 })).toBe(e)
    e = reducirEditor(e, { tipo: 'desplazar', deltaMs: 100, ahora: 2 })
    expect(e.actual.letra.offset_ms).toBe(100)
    expect(reducirEditor(e, { tipo: 'salir_sync' }).seleccion).toBe('2')
  })
})

describe('historial de la visita', () => {
  it('agrupa todo el desplazamiento de una prueba y mantiene las pruebas como pasos separados', () => {
    let e = reducirEditor(editor(), { tipo: 'desplazar', deltaMs: 100, ahora: 0 })
    e = reducirEditor(e, { tipo: 'desplazar', deltaMs: 100, ahora: 1, grupo: 'primera' })
    e = reducirEditor(e, { tipo: 'desplazar', deltaMs: 100, ahora: 15_000, grupo: 'primera' })
    e = reducirEditor(e, { tipo: 'desplazar', deltaMs: -100, ahora: 15_001, grupo: 'segunda' })
    expect(e.actual.letra.offset_ms).toBe(200)
    expect(e.pasado).toHaveLength(3)
    e = reducirEditor(e, { tipo: 'deshacer' })
    expect(e.actual.letra.offset_ms).toBe(300)
    e = reducirEditor(e, { tipo: 'deshacer' })
    expect(e.actual.letra.offset_ms).toBe(100)
    expect(reducirEditor(e, { tipo: 'rehacer' }).actual.letra.offset_ms).toBe(300)
  })

  it('agrupa ajustes y cambios de color, deshace y rehace sin mutar', () => {
    let e = editor()
    e.actual.letra.lineas[0]!.inicio_ms = 1000
    e = reducirEditor(e, { tipo: 'seleccionar', id: '1' })
    const inicial = e
    function congelar(o: unknown): void {
      if (o && typeof o === 'object') {
        Object.values(o).forEach(congelar)
        Object.freeze(o)
      }
    }
    for (let i = 0; i < 5; i++) {
      congelar(e)
      e = reducirEditor(e, { tipo: 'ajustar_inicio', deltaMs: 10, ahora: i * 200 })
    }
    expect(e.pasado).toHaveLength(1)
    expect(e.version).toBe(5)
    expect(e.cambiosEnVisita).toBe(true)
    expect(inicial.actual.letra.lineas[0]?.inicio_ms).toBe(1000)
    e = reducirEditor(e, { tipo: 'ajustar_inicio', deltaMs: 10, ahora: 2000 })
    expect(e.pasado).toHaveLength(2)
    for (const [i, color] of ['#FFFFFF', '#222222', '#333333'].entries()) {
      const estilo = { ...e.actual.estilo, letra: { ...e.actual.estilo.letra, color } }
      e = reducirEditor(e, { tipo: 'estilo', estilo, clave: 'letra.color', ahora: 2100 + i * 300 })
    }
    expect(e.pasado).toHaveLength(3)
    const editada = e.actual
    e = reducirEditor(e, { tipo: 'deshacer' })
    expect(puedeDeshacer(e)).toBe(true)
    expect(puedeRehacer(e)).toBe(true)
    expect(e.actual.estilo.letra.color).toBe('#FFFFFF')
    expect(reducirEditor(e, { tipo: 'rehacer' }).actual).toEqual(editada)
    expect(
      reducirEditor(e, { tipo: 'cargar', instantanea: editada, seleccion: '1' })
    ).toMatchObject({
      pasado: [],
      futuro: [],
      cambiosEnVisita: false,
      version: 0
    })
  })

  it('limita el historial y avisa cuando descarta palabras', () => {
    let e = editor()
    e.actual.letra.lineas[0]!.inicio_ms = 1000
    e.actual.letra.lineas[0]!.palabras = [{ texto: 'Verso', inicio_ms: 1000, fin_ms: 2400 }]
    e = reducirEditor(e, { tipo: 'seleccionar', id: '2' })
    e = reducirEditor(e, { tipo: 'fijar_inicio', ms: 2000, ahora: 0 })
    expect(e.aviso).toMatchObject({ tipo: 'consecuencias', palabrasDescartadas: ['1'] })
    for (let i = 0; i < 205; i++) {
      e = reducirEditor(e, { tipo: 'desplazar', deltaMs: 10, ahora: i * 1200 })
    }
    expect(e.pasado).toHaveLength(200)
  })
})

it('edita un fin sin mover la pausa ni la línea vecina y permite deshacerlo', () => {
  const l = letra([
    linea('a', 'Sol', 1000, {
      palabras: [{ texto: 'Sol', inicio_ms: 1000, fin_ms: 1400 }]
    }),
    pausa('p', 2500),
    linea('b', 'Mar', 3000)
  ])
  const inicial = estadoInicial({ letra: l, estilo: estiloPredeterminado() }, 'a')
  const fijar = (ms: number) => ({
    tipo: 'fijar_fin' as const,
    ms,
    duracionMs: 30_000,
    ahora: 0
  })
  const fijado = reducirEditor(inicial, fijar(1700))
  expect(fijado.actual.letra.lineas).toEqual([
    { ...l.lineas[0], fin_ms: 1700 },
    ...l.lineas.slice(1)
  ])

  const invalido = reducirEditor(fijado, fijar(2600))
  expect(invalido.actual.letra).toBe(fijado.actual.letra)
  expect(invalido.aviso?.limite?.tipo).toBe('fin_siguiente')
  expect(reducirEditor(fijado, { tipo: 'deshacer' }).actual.letra).toBe(l)
  expect(
    reducirEditor(fijado, { tipo: 'fin_automatico', ahora: 10 }).actual.letra.lineas[0]?.fin_ms
  ).toBeNull()
})
