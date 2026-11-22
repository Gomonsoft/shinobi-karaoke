import { describe, expect, it } from 'vitest'
import { PANTALLA_PREDETERMINADA, pasadasEfectivas, type Pantalla } from '@shared/pantalla'
import { disponerBloque, escalaDePuesto, objetivoOpacidad, type Region } from './pantalla'
import type { LineaEnPantalla } from './render'

// [N, P, ancla en % del alto] (tabla «Puestos y ancla» de la spec 07)
const TABLA: [number, number, number][] = [
  [2, 0, 45],
  [3, 0, 38.0],
  [4, 0, 34.3],
  [4, 1, 42.9],
  [5, 0, 30.7],
  [5, 1, 39.3],
  [6, 0, 27.1],
  [6, 1, 35.6],
  [6, 2, 42.9],
  [7, 0, 23.4],
  [7, 1, 32.0],
  [7, 2, 39.3]
]

const pantallaDe = (
  lineas: number,
  pasadas: number,
  transicion: Pantalla['transicion'] = 'ninguna'
): Pantalla => ({ lineas, pasadas, transicion })

/** Líneas en reposo con los puestos de una configuración; `renglones` por puesto (1 si falta). */
function reposo(p: Pantalla, renglones: Record<number, number> = {}, S = 81) {
  const pas = pasadasEfectivas(p)
  const futuras = p.lineas - 1 - pas
  const lineas: LineaEnPantalla[] = []
  const alturas: Record<string, number> = {}
  for (let puesto = -pas; puesto <= futuras; puesto++) {
    const id = `l${puesto}`
    lineas.push({
      id,
      texto: id,
      progreso: 0,
      palabras: null,
      desde: puesto,
      hacia: puesto,
      avance: 1,
      retirada: 1
    })
    alturas[id] = (renglones[puesto] ?? 1) * 1.2 * S
  }
  return { lineas, alturas }
}

const copia = (b: ReturnType<typeof disponerBloque>, id: string) =>
  b.lineas.find((l) => l.id === id)!.copias[0]!

const REGION = { y0Px: 0, altoPx: 1080 }

describe('disposición del bloque', () => {
  describe.each([
    [1920, 1080],
    [1280, 720]
  ])('a %i × %i', (_ancho, alto) => {
    const region: Region = { y0Px: 0, altoPx: alto }
    it.each(TABLA)(
      'ancla de N=%i P=%i en %f %% (± 0,5), con uno y dos renglones (F1-R3)',
      (n, pasadas, esperado) => {
        const p = pantallaDe(n, pasadas)
        for (const renglones of [{} as Record<number, number>, { 0: 2, 1: 2, [-1]: 2 }]) {
          const { lineas, alturas } = reposo(p, renglones, 0.075 * alto)
          const b = disponerBloque({ lineas, alturas, pantalla: p, region, cambio: null })
          expect(Math.abs((b.ancla / alto) * 100 - esperado)).toBeLessThanOrEqual(0.5)
          expect(copia(b, 'l0').centroY).toBe(b.ancla)
        }
      }
    )
  })

  it('escalas: activa 100 %, +1 al 70 % y las demás al 60 % (F1-R4)', () => {
    expect([0, 1, 2, 3, -1, -2].map(escalaDePuesto)).toEqual([1, 0.7, 0.6, 0.6, 0.6, 0.6])
    const { lineas, alturas } = reposo(PANTALLA_PREDETERMINADA)
    const b = disponerBloque({
      lineas,
      alturas,
      pantalla: PANTALLA_PREDETERMINADA,
      region: REGION,
      cambio: null
    })
    expect(b.tamano).toBeCloseTo(81)
    expect(copia(b, 'l0').escala).toBe(1)
    expect(copia(b, 'l1').escala).toBe(0.7)
    expect(copia(b, 'l-1')).toMatchObject({ escala: 0.6, mezclaGris: 1, opacidad: 0.55 })
  })

  it('la activa no se mueve con líneas de 1 a 4 renglones y el apilado no solapa', () => {
    const p = pantallaDe(5, 0)
    let ancla: number | null = null
    for (const r of [1, 2, 3, 4]) {
      const { lineas, alturas } = reposo(p, { 0: r, 1: r, 2: r })
      const b = disponerBloque({ lineas, alturas, pantalla: p, region: REGION, cambio: null })
      ancla ??= b.ancla
      expect(copia(b, 'l0').centroY).toBeCloseTo(ancla)
      const cajas = lineas.map((l) => {
        const c = copia(b, l.id)
        const alto = alturas[l.id]! * c.escala
        return [c.centroY - alto / 2, c.centroY + alto / 2] as const
      })
      for (let i = 1; i < cajas.length; i++) expect(cajas[i]![0]).toBeGreaterThan(cajas[i - 1]![1])
      // la activa mide r × 1,2 × S y crece por igual hacia arriba y hacia abajo
      expect(cajas[0]![1] - cajas[0]![0]).toBeCloseTo(r * 1.2 * 81)
      expect(ancla - cajas[0]![0]).toBeCloseTo(cajas[0]![1] - ancla)
    }
  })

  it('con líneas de 3 y 4 renglones, las separaciones siguen siendo 0,6 × S y 0,25 × S', () => {
    const p = pantallaDe(6, 1)
    const { lineas, alturas } = reposo(p, { [-1]: 3, 0: 1, 1: 4, 2: 3 })
    const b = disponerBloque({ lineas, alturas, pantalla: p, region: REGION, cambio: null })
    const caja = (id: string) => {
      const c = copia(b, id)
      const h = alturas[id]! * c.escala
      return { arriba: c.centroY - h / 2, abajo: c.centroY + h / 2 }
    }
    expect(caja('l1').arriba - caja('l0').abajo).toBeCloseTo(0.6 * b.tamano)
    expect(caja('l0').arriba - caja('l-1').abajo).toBeCloseTo(0.6 * b.tamano)
    expect(caja('l2').arriba - caja('l1').abajo).toBeCloseTo(0.25 * b.tamano)
  })

  it('desplazamiento: a mitad del cambio interpola centro, escala, opacidad y gris (F1-R10)', () => {
    const p = PANTALLA_PREDETERMINADA
    const { lineas, alturas } = reposo(p)
    const mover = (avance: number) =>
      disponerBloque({
        lineas: lineas.map((l) => ({ ...l, desde: l.desde + 1, avance })),
        alturas,
        pantalla: p,
        region: REGION,
        cambio: { tipo: 'desplazamiento' }
      })
    const [ini, fin, medio] = [mover(0), mover(1), mover(0.875)]
    for (const l of lineas) {
      const a = copia(ini, l.id)
      const b = copia(fin, l.id)
      const m = copia(medio, l.id)
      expect(Math.abs(m.centroY - (a.centroY + (b.centroY - a.centroY) * 0.875))).toBeLessThan(1)
      expect(m.escala).toBeCloseTo(a.escala + (b.escala - a.escala) * 0.875)
      expect(m.opacidad).toBeCloseTo(a.opacidad + (b.opacidad - a.opacidad) * 0.875)
      expect(m.mezclaGris).toBeCloseTo(a.mezclaGris + (b.mezclaGris - a.mezclaGris) * 0.875)
    }
  })

  it('fundido: dos copias y ninguna a más de 0,3 × S del centro de un puesto (F1-R11)', () => {
    const p = pantallaDe(5, 1, 'fundido')
    const { lineas, alturas } = reposo(p)
    const reparto = (avance: number) =>
      disponerBloque({
        lineas: lineas.map((l) => ({ ...l, desde: l.desde + 1, avance })),
        alturas,
        pantalla: p,
        region: REGION,
        cambio: { tipo: 'fundido' }
      })
    const origen = reparto(0)
    const destino = reparto(1)
    const S = destino.tamano
    for (const a of [0, 0.25, 0.5, 0.875, 1]) {
      for (const l of reparto(a).lineas) {
        expect(l.copias.map((c) => c.rol)).toEqual(['saliente', 'entrante'])
        const [sal, ent] = l.copias
        const centroA = origen.lineas.find((x) => x.id === l.id)!.copias[0]!.centroY
        const centroB = destino.lineas.find((x) => x.id === l.id)!.copias[1]!.centroY
        expect(Math.abs(sal!.centroY - centroA)).toBeLessThanOrEqual(0.3 * S + 1e-6)
        expect(Math.abs(ent!.centroY - centroB)).toBeLessThanOrEqual(0.3 * S + 1e-6)
      }
    }
  })

  it('recorte: con 7 líneas de dos renglones no se dibuja la que pasa del 86 % ni las siguientes (F1-R18)', () => {
    const p = pantallaDe(7, 0)
    const { lineas, alturas } = reposo(p, { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 })
    const b = disponerBloque({ lineas, alturas, pantalla: p, region: REGION, cambio: null })
    const flags = lineas.map((l) => copia(b, l.id).dibujar)
    const primera = flags.indexOf(false)
    expect(flags[0]).toBe(true)
    expect(primera).toBeGreaterThan(0)
    expect(flags.slice(primera).every((f) => !f)).toBe(true)
    for (const l of lineas) {
      const c = copia(b, l.id)
      if (c.dibujar)
        expect(c.centroY + (alturas[l.id]! * c.escala) / 2).toBeLessThanOrEqual(0.86 * 1080)
    }
  })

  it('recorte por arriba: una ya cantada por encima del 10 % no se dibuja', () => {
    const p = pantallaDe(7, 2)
    const { lineas, alturas } = reposo(p, { [-1]: 3, [-2]: 3 })
    const b = disponerBloque({ lineas, alturas, pantalla: p, region: REGION, cambio: null })
    expect(copia(b, 'l-2').dibujar).toBe(false)
    expect(copia(b, 'l-1').dibujar).toBe(true)
  })

  it('los indicadores van relativos al ancla, igual con cualquier N y P (F1-R19)', () => {
    const relativos = new Set<string>()
    for (const [n, pas] of [
      [2, 0],
      [3, 0],
      [5, 1],
      [7, 2],
      [7, 0]
    ] as const) {
      const p = pantallaDe(n, pas)
      const { lineas, alturas } = reposo(p)
      const b = disponerBloque({ lineas, alturas, pantalla: p, region: REGION, cambio: null })
      const { barraY, cuentaY, puntosY } = b.indicadores
      expect(cuentaY).toBe(b.ancla)
      relativos.add(
        [barraY - b.ancla, puntosY - b.ancla].map((v) => (v / b.tamano).toFixed(3)).join('|')
      )
      // La barra queda entre la ya cantada y la activa; los puntos, sobre la +1.
      expect(barraY + 1e-6).toBeLessThan(b.ancla - 0.5 * b.tamano)
      if (pas > 0) {
        const ya = copia(b, 'l-1')
        expect(barraY).toBeGreaterThan(ya.centroY + (1.2 * 0.6 * b.tamano) / 2)
      }
      const mas1 = copia(b, 'l1')
      expect(puntosY).toBeLessThanOrEqual(mas1.centroY - (1.2 * 0.7 * b.tamano) / 2 + 1e-6)
    }
    expect(relativos.size).toBe(1)
  })

  it('suelo de contraste: sube al suelo del puesto, pero una línea que se va llega a 0', () => {
    const p = PANTALLA_PREDETERMINADA
    const { lineas, alturas } = reposo(p)
    const suelos = { [-1]: 0.7, 2: 0.9, 3: 0.2 }
    const b = disponerBloque({ lineas, alturas, pantalla: p, region: REGION, cambio: null, suelos })
    expect(copia(b, 'l-1').opacidad).toBe(0.7)
    expect(copia(b, 'l2').opacidad).toBe(0.9)
    expect(copia(b, 'l3').opacidad).toBe(0.65)
    const sale = lineas.map((l) => (l.id === 'l-1' ? { ...l, hacia: -2 } : l))
    expect(
      copia(
        disponerBloque({
          lineas: sale,
          alturas,
          pantalla: p,
          region: REGION,
          cambio: null,
          suelos
        }),
        'l-1'
      ).opacidad
    ).toBe(0)
    const retirada = lineas.map((l) => ({ ...l, retirada: 0.5 }))
    expect(
      copia(
        disponerBloque({
          lineas: retirada,
          alturas,
          pantalla: p,
          region: REGION,
          cambio: null,
          suelos
        }),
        'l-1'
      ).opacidad
    ).toBeCloseTo(0.35)
  })

  it('objetivos de opacidad por puesto: 0 fuera de [−P, F]', () => {
    expect(objetivoOpacidad(-1, 0, 3)).toBe(0)
    expect(objetivoOpacidad(-1, 1, 3)).toBe(0.55)
    expect(objetivoOpacidad(-2, 1, 3)).toBe(0)
    expect(objetivoOpacidad(4, 1, 3)).toBe(0)
  })

  it('una región en la mitad inferior mueve el ancla, el apilado y el recorte con ella (ADR 0029 §4 bis)', () => {
    const p = pantallaDe(5, 1)
    const { lineas, alturas } = reposo(p)
    const en = (region: Region, pantalla = p, datos = { lineas, alturas }) =>
      disponerBloque({ ...datos, pantalla, region, altoPantallaPx: 1080, cambio: null })
    const entera = en(REGION)
    const mitad = en({ y0Px: 540, altoPx: 540 })
    expect(mitad.tamano).toBe(entera.tamano)
    // S es la de la pantalla (81 px); el bloque se centra al 47 % de la región: 0,47 × 540 − 1,03 × S.
    expect(mitad.ancla).toBeCloseTo(540 + 0.47 * 540 - 1.03 * 81, 0)
    for (const l of mitad.lineas) {
      expect(l.copias[0]!.centroY).toBeGreaterThan(540)
      expect(l.copias[0]!.centroY).toBeLessThan(540 + 0.86 * 540)
    }
    // Con 7 líneas el recorte actúa respecto a la región, no a la pantalla.
    const siete = pantallaDe(7, 2)
    const g = reposo(siete)
    const recortado = en({ y0Px: 540, altoPx: 540 }, siete, g)
    expect(copia(recortado, 'l-2').dibujar).toBe(false)
    expect(copia(en(REGION, siete, g), 'l-2').dibujar).toBe(true)
  })
})
