import type { ElementoLetra } from '@shared/letra'
import {
  ajustarVistaLineaTiempo,
  centrarLineaTiempo,
  crearVistaLineaTiempo,
  desplazarLineaTiempo,
  pixelATiempo,
  proyectarLineaTiempo,
  recortarIntervalo,
  tiempoAPixel,
  tiempoAudioALetra,
  tiempoLetraAAudio,
  zoomALinea,
  zoomLineaTiempo
} from './lineaTiempo'

function linea(id: string, inicio_ms: number | null, fin_ms: number | null = null): ElementoLetra {
  return { id, tipo: 'linea', texto: 'Verso inventado', inicio_ms, fin_ms, palabras: null }
}

describe('proyección de líneas y pausas', () => {
  it.each([-300, 300])('aplica el offset %i en ambos sentidos sin redondear', (offset) => {
    const vista = { inicioMs: 1000, finMs: 6100 }
    const audio = tiempoLetraAAudio(2450.25, offset)
    const pixel = tiempoAPixel(vista, 320, audio)
    expect(tiempoAudioALetra(pixelATiempo(vista, 320, pixel), offset)).toBeCloseTo(2450.25)
    expect(tiempoAPixel(vista, 640, audio)).toBeCloseTo(pixel * 2)
  })

  it('reutiliza el fin efectivo, proyecta la pausa e ignora líneas sin inicio', () => {
    const pausa = { ...linea('p', 1800), tipo: 'pausa' as const }
    const lineas = [linea('a', 1000), pausa, linea('b', 2300, 3100), linea('c', null)]
    const modelo = proyectarLineaTiempo({ lineas, offset_ms: 500 }, 5000)
    expect(modelo.pausas).toEqual([{ id: 'p', tiempoMs: 2300 }])
    expect(
      modelo.regiones.map(({ id, finAutomatico, real }) => ({ id, finAutomatico, real }))
    ).toEqual([
      { id: 'a', finAutomatico: true, real: { inicioMs: 1500, finMs: 2300 } },
      { id: 'b', finAutomatico: false, real: { inicioMs: 2800, finMs: 3600 } }
    ])
  })

  it('preserva los bordes reales y distingue los bordes recortados', () => {
    const { regiones } = proyectarLineaTiempo(
      { lineas: [linea('a', 100, 500), linea('b', 900, 2200)], offset_ms: -300 },
      1500
    )
    expect(regiones[0]).toMatchObject({
      real: { inicioMs: -200, finMs: 200 },
      audible: { inicioMs: 0, finMs: 200, inicioRecortado: true, finRecortado: false }
    })
    expect(regiones[1]).toMatchObject({
      real: { inicioMs: 600, finMs: 1900 },
      audible: { inicioMs: 600, finMs: 1500, inicioRecortado: false, finRecortado: true }
    })
  })

  it('excluye regiones externas y las que solo tocan un extremo de la ventana', () => {
    const { regiones } = proyectarLineaTiempo(
      { lineas: [linea('a', 200, 300), linea('b', 2500, 2600)], offset_ms: -300 },
      1000
    )
    expect(regiones.map(({ audible }) => audible)).toEqual([null, null])
    expect(recortarIntervalo({ inicioMs: 0, finMs: 10 }, { inicioMs: 10, finMs: 20 })).toBeNull()
    expect(recortarIntervalo({ inicioMs: 10, finMs: 20 }, { inicioMs: 10, finMs: 20 })).toEqual({
      inicioMs: 10,
      finMs: 20,
      inicioRecortado: false,
      finRecortado: false
    })
  })
})

describe('viewport de línea de tiempo', () => {
  it('mantiene el tiempo bajo el puntero al acercar y alejar', () => {
    const vista = crearVistaLineaTiempo(10_000)
    const zoom = zoomLineaTiempo(vista, 10_000, 2, 0.25)
    expect(zoom).toEqual({ inicioMs: 1250, finMs: 6250 })
    expect(pixelATiempo(zoom, 800, 200)).toBe(pixelATiempo(vista, 800, 200))
    expect(zoomLineaTiempo(zoom, 10_000, 0.5, 0.25)).toEqual(vista)
  })

  it('satura la escala y el ancla en los extremos de la pista', () => {
    const izq = { inicioMs: 0, finMs: 2000 }
    const der = { inicioMs: 8000, finMs: 10_000 }
    expect(zoomLineaTiempo(izq, 10_000, 0.5, 0.5)).toEqual({ inicioMs: 0, finMs: 4000 })
    expect(zoomLineaTiempo(der, 10_000, 0.5, 0.5)).toEqual({ inicioMs: 6000, finMs: 10_000 })
    expect(zoomLineaTiempo(der, 10_000, 10, 1)).toEqual({ inicioMs: 9000, finMs: 10_000 })
  })

  it('encaja la porción audible de una línea con margen y respeta la ventana mínima', () => {
    expect(zoomALinea({ inicioMs: 3000, finMs: 5000 }, 10_000)).toEqual({
      inicioMs: 2800,
      finMs: 5200
    })
    expect(zoomALinea({ inicioMs: 0, finMs: 400 }, 10_000)).toEqual({ inicioMs: 0, finMs: 1000 })
    expect(zoomALinea({ inicioMs: 400, finMs: 600 }, 750)).toEqual(crearVistaLineaTiempo(750))
  })

  it('centra y desplaza sin cambiar escala, ajustando la vista a una duración menor', () => {
    const vista = { inicioMs: 3000, finMs: 6000 }
    expect(centrarLineaTiempo(vista, 10_000, 7000)).toEqual({ inicioMs: 5500, finMs: 8500 })
    expect(centrarLineaTiempo(vista, 10_000, 500)).toEqual({ inicioMs: 0, finMs: 3000 })
    expect(desplazarLineaTiempo(vista, 10_000, 5000)).toEqual({ inicioMs: 7000, finMs: 10_000 })
    expect(desplazarLineaTiempo(vista, 10_000, -1000)).toEqual({ inicioMs: 2000, finMs: 5000 })
    expect(ajustarVistaLineaTiempo(vista, 4000)).toEqual({ inicioMs: 1000, finMs: 4000 })
    expect(ajustarVistaLineaTiempo(vista, 750)).toEqual(crearVistaLineaTiempo(750))
  })
})
