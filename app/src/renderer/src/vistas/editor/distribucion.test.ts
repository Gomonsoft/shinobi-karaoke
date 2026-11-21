// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PreferenciasPaneles } from '@shared/config'
import { preferenciasPanelesPredeterminadas } from '@shared/paneles'
import {
  aplicarArrastre,
  aplicarTecla,
  calcularDistribucion,
  preferenciaTrasAccion,
  type Distribucion,
  type DivisorEditor,
  type EntradaDistribucion
} from './distribucion'

/** Viewport CSS -> entrada con las medidas reales de cabecera y transporte. */
function entrada(
  vw: number,
  vh: number,
  extra: Partial<EntradaDistribucion> = {},
  pref: PreferenciasPaneles = preferenciasPanelesPredeterminadas()
): EntradaDistribucion {
  const compacto = vh < 800
  return {
    medidas: {
      ancho: vw - 32,
      alto: vh - 56,
      altoCabecera: compacto ? 48 : 80,
      altoTransporte: compacto ? 80 : 96
    },
    preferencias: pref,
    pestana: 'sincronia',
    sincronizando: false,
    ...extra
  }
}

describe('calcularDistribucion: matriz de viewports', () => {
  it.each([
    [1024, 576, 160, true],
    [1280, 720, 304, true],
    [1376, 1152, null, false],
    [1536, 864, 384, false],
    [1720, 1440, null, false],
    [1920, 1080, null, false]
  ])('%i x %i cabe completo con las preferencias por defecto', (vw, vh, zona, compacto) => {
    const d = calcularDistribucion(entrada(vw, vh))
    expect(d.bajoMinimo).toBeNull()
    expect(d.compacto).toBe(compacto)
    expect(d.lineaTiempo.minimizado).toBe(false)
    expect(d.lineaTiempo.alto).toBe(compacto ? 204 : 216)
    expect(d.lineaTiempo.altoPistaVoz).toBe(76)
    expect(d.altoZonaSuperior).toBeGreaterThanOrEqual(136)
    if (zona !== null) expect(Math.abs(d.altoZonaSuperior - zona)).toBeLessThanOrEqual(8)
    // A 1024 las preferencias por defecto (300 + 360) no dejan 320 a la previa: cede la lista.
    expect(d.lista.ancho).toBe(vw === 1024 ? 288 : 300)
    expect(d.panel.ancho).toBe(360)
    expect(vw - 32 - 24 - d.lista.ancho - d.panel.ancho).toBeGreaterThanOrEqual(320)
  })

  it('el corte de modo compacto es 800 px de viewport', () => {
    expect(calcularDistribucion(entrada(1280, 799)).compacto).toBe(true)
    expect(calcularDistribucion(entrada(1280, 800)).compacto).toBe(false)
  })
})

describe('calcularDistribucion: alto', () => {
  it('1024 x 500 minimiza por espacio sin tocar las preferencias', () => {
    const pref = preferenciasPanelesPredeterminadas()
    const copia = structuredClone(pref)
    const d = calcularDistribucion(entrada(1024, 500, {}, pref))
    expect(d.lineaTiempo.minimizadoPorEspacio).toBe(true)
    expect(d.lineaTiempo.minimizado).toBe(true)
    expect(d.lineaTiempo.alto).toBe(40)
    expect(d.bajoMinimo).toBeNull()
    expect(pref).toEqual(copia)
  })

  it('con alto 600 a 1280 de ancho la línea de tiempo se recorta y la zona queda en 136', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.linea_tiempo.alto = 400
    const d = calcularDistribucion(entrada(1280, 600 + 56, {}, pref))
    expect(d.lineaTiempo.minimizadoPorEspacio).toBe(false)
    expect(d.lineaTiempo.alto).toBeLessThan(400)
    expect(d.lineaTiempo.alto).toBeGreaterThanOrEqual(d.lineaTiempo.min)
    expect(d.altoZonaSuperior).toBe(136)
    expect(d.lineaTiempo.altoPistaVoz).toBeGreaterThanOrEqual(48)
    expect(pref.linea_tiempo.alto).toBe(400)
  })

  it('la pista de voz crece con el alto preferido y el máximo deja 136 a la zona', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.linea_tiempo.alto = 300
    const d = calcularDistribucion(entrada(1920, 1080, {}, pref))
    expect(d.lineaTiempo.alto).toBe(300)
    expect(d.lineaTiempo.altoPistaVoz).toBe(300 - 140)
    expect(d.lineaTiempo.min).toBe(188)
    expect(d.lineaTiempo.max).toBe(1080 - 56 - (12 + 80 + 8 + 96) - 12 - 136)
  })

  it('un alto preferido menor que el mínimo normal sube a 188', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.linea_tiempo.alto = 176
    expect(calcularDistribucion(entrada(1920, 1080, {}, pref)).lineaTiempo.alto).toBe(188)
    expect(calcularDistribucion(entrada(1280, 720, {}, pref)).lineaTiempo.alto).toBe(176)
  })

  it('línea de tiempo minimizada por el usuario: 44 px (40 en compacto)', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.linea_tiempo.minimizado = true
    expect(calcularDistribucion(entrada(1920, 1080, {}, pref)).lineaTiempo.alto).toBe(44)
    const c = calcularDistribucion(entrada(1280, 720, {}, pref))
    expect(c.lineaTiempo.alto).toBe(40)
    expect(c.lineaTiempo.minimizadoPorEspacio).toBe(false)
  })

  it('bajoMinimo alto cuando ni minimizada cabe', () => {
    const d = calcularDistribucion(entrada(1280, 300 + 56))
    expect(d.lineaTiempo.minimizadoPorEspacio).toBe(true)
    expect(d.bajoMinimo).toBe('alto')
    expect(d.altoZonaSuperior).toBe(136)
  })
})

describe('calcularDistribucion: ancho', () => {
  it('853 x 480 (zoom 150 %) usa la disposición B', () => {
    const d = calcularDistribucion(entrada(853, 480))
    expect(d.bajoMinimo).toBe('ancho')
    expect(d.lista.minimizado).toBe(false)
    expect(d.panel.minimizado).toBe(false)
  })

  it('la barra vertical de main a 1024 px no baja a la disposición B', () => {
    const base = entrada(1024, 300 + 56)
    const conBarra = (barra: number) => ({
      ...base,
      medidas: { ...base.medidas, ancho: base.medidas.ancho - barra, barraVertical: barra }
    })
    expect(calcularDistribucion(conBarra(15)).bajoMinimo).toBe('alto')
    // Sin informar de la barra, el ancho reducido sí cruza el umbral (el caso que se corrige).
    expect(
      calcularDistribucion({
        ...conBarra(15),
        medidas: { ...conBarra(15).medidas, barraVertical: 0 }
      }).bajoMinimo
    ).toBe('ancho')
    // Por debajo de 1024 reales sigue siendo B, con o sin barra.
    expect(
      calcularDistribucion({
        ...entrada(1023, 300 + 56),
        medidas: { ...entrada(1023, 300 + 56).medidas, ancho: 1023 - 32 - 15, barraVertical: 15 }
      }).bajoMinimo
    ).toBe('ancho')
  })

  it('lista 480 y panel 480 a 1024: se recortan y la previa conserva 320', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.lista.ancho = 480
    pref.panel.ancho = 480
    const d = calcularDistribucion(entrada(1024, 800, {}, pref))
    const previa = 1024 - 32 - 24 - d.lista.ancho - d.panel.ancho
    expect(previa).toBeGreaterThanOrEqual(320)
    expect(d.lista.ancho).toBe(256)
    expect(d.panel.ancho).toBeGreaterThanOrEqual(300)
    expect(d.panel.ancho).toBe(392)
    expect(pref.lista.ancho).toBe(480)
    expect(pref.panel.ancho).toBe(480)
  })

  it('el máximo efectivo deja 320 a la vista previa y nunca pasa de 480', () => {
    const ancho = calcularDistribucion(entrada(1920, 1080))
    expect(ancho.lista.max).toBe(480)
    expect(ancho.panel.max).toBe(480)
    const justo = calcularDistribucion(entrada(1024, 800))
    expect(justo.lista.max).toBe(992 - 24 - 320 - 360)
    // La lista ya cedió a 288: el panel conserva sus 360.
    expect(justo.panel.max).toBe(992 - 24 - 320 - 288)
  })

  it('un panel minimizado aporta su riel y libera ancho', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.lista.minimizado = true
    pref.panel.minimizado = true
    pref.lista.ancho = 400
    const d = calcularDistribucion(entrada(1280, 800, {}, pref))
    expect(d.lista).toMatchObject({ ancho: 72, minimizado: true, min: 256 })
    expect(d.panel).toMatchObject({ ancho: 120, minimizado: true })
    expect(d.lista.max).toBe(480)
  })
})

describe('calcularDistribucion: Estilo y sincronizar', () => {
  it('Estilo no tiene línea de tiempo y la zona absorbe el alto', () => {
    const sync = calcularDistribucion(entrada(1920, 1080))
    const est = calcularDistribucion(entrada(1920, 1080, { pestana: 'estilo' }))
    expect(est.lineaTiempo.visible).toBe(false)
    expect(est.lineaTiempo.alto).toBe(0)
    expect(est.altoZonaSuperior).toBeGreaterThan(sync.altoZonaSuperior)
    expect(est.altoZonaSuperior).toBe(1080 - 56 - 12 - 80 - 8 - 96)
  })

  it('Estilo en 1024 x 576 no minimiza ni cambia la preferencia del dock', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.linea_tiempo.alto = 300
    const d = calcularDistribucion(entrada(1024, 576, { pestana: 'estilo' }, pref))
    expect(d.bajoMinimo).toBeNull()
    expect(pref.linea_tiempo.alto).toBe(300)
  })

  it('sincronizar reserva banner + fila minimizada y mantiene la zona >= 136', () => {
    const d = calcularDistribucion(
      entrada(1280, 800, {
        sincronizando: true,
        medidas: { ...entrada(1280, 800).medidas, altoBannerSync: 140 }
      })
    )
    expect(d.lineaTiempo.minimizado).toBe(true)
    expect(d.lineaTiempo.minimizadoPorEspacio).toBe(false)
    expect(d.lineaTiempo.alto).toBe(140 + 44)
    expect(d.altoZonaSuperior).toBeGreaterThanOrEqual(136)
    expect(d.bajoMinimo).toBeNull()
  })

  it('sincronizar en 1024 x 576 sigue con la zona >= 136 y no toca preferencias', () => {
    const base = entrada(1024, 576)
    const pref = base.preferencias
    const copia = structuredClone(pref)
    const d = calcularDistribucion({
      ...base,
      sincronizando: true,
      medidas: { ...base.medidas, altoBannerSync: 140 }
    })
    expect(d.altoZonaSuperior).toBeGreaterThanOrEqual(136)
    expect(d.lineaTiempo.alto).toBe(140 + 40)
    expect(pref).toEqual(copia)
  })
})

describe('aplicarTecla', () => {
  const normal = (): Distribucion => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.lista.ancho = 380
    pref.panel.ancho = 400
    pref.linea_tiempo.alto = 300
    return calcularDistribucion(entrada(1920, 1080, {}, pref))
  }
  const flechas: Record<DivisorEditor, { mas: string; menos: string; otras: string[] }> = {
    lista: { mas: 'ArrowRight', menos: 'ArrowLeft', otras: ['ArrowUp', 'ArrowDown'] },
    panel: { mas: 'ArrowLeft', menos: 'ArrowRight', otras: ['ArrowUp', 'ArrowDown'] },
    dock: { mas: 'ArrowUp', menos: 'ArrowDown', otras: ['ArrowLeft', 'ArrowRight'] }
  }
  const actual = (d: Distribucion, v: DivisorEditor): number =>
    v === 'dock' ? d.lineaTiempo.alto : d[v].ancho

  it.each(['lista', 'panel', 'dock'] as const)('%s: flechas de su eje, Mayús y otras', (v) => {
    const d = normal()
    const f = flechas[v]
    const a = actual(d, v)
    expect(aplicarTecla(d, v, f.mas, false)).toEqual({ tipo: 'tamano', valor: a + 16 })
    expect(aplicarTecla(d, v, f.menos, false)).toEqual({ tipo: 'tamano', valor: a - 16 })
    expect(aplicarTecla(d, v, f.mas, true)).toEqual({ tipo: 'tamano', valor: a + 64 })
    expect(aplicarTecla(d, v, f.menos, true)).toEqual({ tipo: 'tamano', valor: a - 64 })
    for (const o of f.otras) expect(aplicarTecla(d, v, o, false)).toBeNull()
    for (const t of ['a', ' ', 'Tab', 'Escape', 'PageUp'])
      expect(aplicarTecla(d, v, t, false)).toBeNull()
    expect(aplicarTecla(d, v, 'Enter', false)).toEqual({ tipo: 'alternar' })
  })

  it.each(['lista', 'panel', 'dock'] as const)('%s: Inicio es el mínimo y Fin el máximo', (v) => {
    const d = normal()
    const el = v === 'dock' ? d.lineaTiempo : d[v]
    expect(aplicarTecla(d, v, 'Home', false)).toEqual({ tipo: 'tamano', valor: el.min })
    expect(aplicarTecla(d, v, 'End', false)).toEqual({ tipo: 'tamano', valor: el.max })
  })

  it('se acota a los límites', () => {
    const d = normal()
    const defecto = calcularDistribucion(entrada(1920, 1080))
    expect(aplicarTecla(defecto, 'lista', 'ArrowLeft', true)).toEqual({
      tipo: 'tamano',
      valor: 256
    })
    expect(aplicarTecla(defecto, 'lista', 'ArrowRight', true)).toEqual({
      tipo: 'tamano',
      valor: 364
    })
    expect(d.lista.ancho).toBe(380)
    const grande = preferenciasPanelesPredeterminadas()
    grande.lista.ancho = 470
    const dg = calcularDistribucion(entrada(1920, 1080, {}, grande))
    expect(aplicarTecla(dg, 'lista', 'ArrowRight', false)).toEqual({ tipo: 'tamano', valor: 480 })
  })

  it('desde minimizado, solo una flecha que agranda expande partiendo del mínimo', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.lista.minimizado = true
    pref.panel.minimizado = true
    pref.linea_tiempo.minimizado = true
    const d = calcularDistribucion(entrada(1920, 1080, {}, pref))
    expect(aplicarTecla(d, 'lista', 'ArrowRight', false)).toEqual({ tipo: 'tamano', valor: 272 })
    expect(aplicarTecla(d, 'lista', 'ArrowLeft', false)).toBeNull()
    expect(aplicarTecla(d, 'panel', 'ArrowLeft', true)).toEqual({ tipo: 'tamano', valor: 364 })
    expect(aplicarTecla(d, 'dock', 'ArrowUp', false)).toEqual({ tipo: 'tamano', valor: 204 })
    expect(aplicarTecla(d, 'dock', 'ArrowDown', false)).toBeNull()
    expect(aplicarTecla(d, 'lista', 'Enter', false)).toEqual({ tipo: 'alternar' })
  })

  it('el dock no responde en Estilo, en sincronizar ni a Intro si falta espacio', () => {
    const est = calcularDistribucion(entrada(1920, 1080, { pestana: 'estilo' }))
    expect(aplicarTecla(est, 'dock', 'ArrowUp', false)).toBeNull()
    expect(aplicarTecla(est, 'dock', 'Enter', false)).toBeNull()
    const sync = calcularDistribucion(entrada(1920, 1080, { sincronizando: true }))
    expect(aplicarTecla(sync, 'dock', 'Home', false)).toBeNull()
    const poco = calcularDistribucion(entrada(1024, 500))
    expect(aplicarTecla(poco, 'dock', 'Enter', false)).toBeNull()
    expect(aplicarTecla(poco, 'lista', 'Enter', false)).toEqual({ tipo: 'alternar' })
  })
})

describe('aplicarArrastre', () => {
  const d = calcularDistribucion(entrada(1920, 1080))
  it('sigue al puntero con el signo de cada divisor', () => {
    expect(aplicarArrastre(d, 'lista', 300, 40)).toBe(340)
    expect(aplicarArrastre(d, 'panel', 360, 40)).toBe(320)
    expect(aplicarArrastre(d, 'dock', 216, -40)).toBe(256)
    expect(aplicarArrastre(d, 'dock', 216, 20)).toBe(196)
  })
  it('se detiene en ambos límites y nunca minimiza', () => {
    expect(aplicarArrastre(d, 'lista', 300, -1000)).toBe(256)
    expect(aplicarArrastre(d, 'lista', 300, 1000)).toBe(480)
    expect(aplicarArrastre(d, 'panel', 360, 1000)).toBe(300)
    expect(aplicarArrastre(d, 'panel', 360, -1000)).toBe(480)
    expect(aplicarArrastre(d, 'dock', 216, 1000)).toBe(188)
    expect(aplicarArrastre(d, 'dock', 216, -5000)).toBe(d.lineaTiempo.max)
  })
  it('desde minimizado parte del mínimo', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.lista.minimizado = true
    const dm = calcularDistribucion(entrada(1920, 1080, {}, pref))
    expect(aplicarArrastre(dm, 'lista', 72, 50)).toBe(306)
    expect(aplicarArrastre(dm, 'lista', 72, -50)).toBe(256)
  })
})

describe('preferenciaTrasAccion', () => {
  it('guarda el valor visible redondeado y expande', () => {
    const pref = preferenciasPanelesPredeterminadas()
    pref.lista.minimizado = true
    const copia = structuredClone(pref)
    const r = preferenciaTrasAccion(pref, 'lista', 321.6)
    expect(r.lista).toEqual({ ancho: 322, minimizado: false })
    expect(r.panel).toEqual(pref.panel)
    expect(pref).toEqual(copia)
  })
  it('panel y dock', () => {
    const pref = preferenciasPanelesPredeterminadas()
    expect(preferenciaTrasAccion(pref, 'panel', 400).panel.ancho).toBe(400)
    expect(preferenciaTrasAccion(pref, 'dock', 250.2).linea_tiempo).toEqual({
      alto: 250,
      minimizado: false
    })
  })
  it('no sale de los límites absolutos', () => {
    const pref = preferenciasPanelesPredeterminadas()
    expect(preferenciaTrasAccion(pref, 'lista', 9999).lista.ancho).toBe(480)
    expect(preferenciaTrasAccion(pref, 'dock', 10).linea_tiempo.alto).toBe(176)
  })
})
