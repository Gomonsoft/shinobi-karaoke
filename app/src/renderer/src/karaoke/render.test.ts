import { describe, expect, it } from 'vitest'
import { letra, linea, pausa } from '@shared/__fixtures__'
import { ESPERA_LEGADA } from '@shared/espera'
import { PANTALLA_PREDETERMINADA, type Pantalla } from '@shared/pantalla'
import { fotogramaEn, fotogramaEstatico } from './render'

const contexto = { titulo: 'Inventada', artista: 'Shinobi', duracionMs: 30_000 }

describe('modelo de render', () => {
  it('barre la línea entre inicio y fin y omite una línea sin inicio en reproducción', () => {
    const l = letra([
      linea('a', 'El sol', 1000, { fin_ms: 3000 }),
      linea('b', 'Sin marcar', null),
      linea('c', 'La luna', 5000)
    ])
    expect(fotogramaEn(l, 2000, contexto)).toMatchObject({
      actual: { id: 'a', progreso: 0.5 },
      siguiente: { id: 'c', progreso: 0 }
    })
    expect(fotogramaEn(l, 3000, contexto)).toMatchObject({
      actual: null,
      siguiente: { id: 'c' },
      espera: null
    })
    expect(fotogramaEstatico(l, 'b')).toMatchObject({
      titulo: null,
      actual: { id: 'b', progreso: 0.5 },
      siguiente: { id: 'c', progreso: 0 },
      espera: null
    })
    expect(fotogramaEstatico(l, null).actual?.id).toBe('a')
  })

  it('respeta el fin independiente y reconstruye el silencio al volver con una búsqueda', () => {
    const l = {
      ...letra([
        linea('a', 'El sol', 12_400, { fin_ms: 15_800 }),
        pausa('p', 16_100),
        linea('b', 'La luna', 17_100, { fin_ms: 20_300 })
      ]),
      offset_ms: 250
    }
    const enAudio = (ms: number) => fotogramaEn(l, ms - l.offset_ms, contexto)
    expect(enAudio(16_049).actual?.id).toBe('a')
    const espera = {
      actual: null,
      siguiente: { id: 'b', progreso: 0 },
      espera: null
    }
    expect(enAudio(16_050)).toMatchObject(espera)
    expect(enAudio(17_349)).toMatchObject(espera)
    expect(enAudio(17_350).actual).toMatchObject({ id: 'b', progreso: 0 })
    expect(enAudio(16_350)).toMatchObject(espera)
  })

  it('conserva el final automático anterior que alcanza el inicio siguiente', () => {
    const l = letra([linea('a', 'El sol', 12_400), linea('b', 'La luna', 17_100)])
    expect(fotogramaEn(l, 17_099, contexto).actual?.id).toBe('a')
    expect(fotogramaEn(l, 17_100, contexto).actual?.id).toBe('b')
    expect(l.lineas[0]?.fin_ms).toBeNull()
  })

  it('resalta cada palabra según sus tiempos y muestra media línea en pausa', () => {
    const l = letra([
      linea('a', 'Sol y mar', 1000, {
        origen_palabras: 'manual',
        palabras: [
          { texto: 'Sol', inicio_ms: 1000, fin_ms: 1500 },
          { texto: 'y', inicio_ms: 1500, fin_ms: 2000 },
          { texto: 'mar', inicio_ms: 2000, fin_ms: 2500 }
        ]
      })
    ])
    expect(fotogramaEn(l, 1750, contexto).actual?.palabras?.map((p) => p.progreso)).toEqual([
      1, 0.5, 0
    ])
    expect(fotogramaEstatico(l, 'a').actual?.palabras?.map((p) => p.progreso)).toEqual([1, 0.5, 0])
  })

  it('barre de forma progresiva las líneas con palabras importadas', () => {
    const l = letra([
      linea('a', 'Sol y mar', 1000, {
        fin_ms: 3000,
        origen_palabras: 'importada',
        palabras: [
          { texto: 'Sol', inicio_ms: 1000, fin_ms: 1500 },
          { texto: 'y', inicio_ms: 1500, fin_ms: 2000 },
          { texto: 'mar', inicio_ms: 2000, fin_ms: 2500 }
        ]
      })
    ])
    expect(fotogramaEn(l, 2000, contexto).actual).toMatchObject({ progreso: 0.5, palabras: null })
    expect(fotogramaEstatico(l, 'a').actual).toMatchObject({ progreso: 0.5, palabras: null })
  })

  it.each([500, 3000, 5900, 20_000])('avisa la primera entrada a %i ms', (inicio) => {
    const l = letra([linea('omitida', 'Sin marcar', null), linea('a', 'El sol', inicio)])
    const comienzo = Math.min(0, inicio - 6000)
    for (const tiempo of [comienzo, inicio - 4001]) {
      expect(fotogramaEn(l, tiempo, contexto)).toMatchObject({
        titulo: { titulo: contexto.titulo, artista: contexto.artista },
        actual: null,
        siguiente: null,
        espera: null
      })
    }
    for (const tiempo of [inicio - 4000, inicio - 3001]) {
      expect(fotogramaEn(l, tiempo, contexto)).toMatchObject({
        titulo: null,
        actual: null,
        siguiente: { id: 'a' }
      })
    }
    expect(
      [-3000, -2001, -2000, -1001, -1000, -1].map(
        (delta) => fotogramaEn(l, inicio + delta, contexto).espera?.puntos ?? 0
      )
    ).toEqual([3, 3, 2, 2, 1, 1])
    expect(fotogramaEn(l, inicio, contexto)).toMatchObject({
      actual: { id: 'a', progreso: 0 },
      espera: null
    })
  })

  it('muestra el indicador con un hueco de 4 s que incluye pausas y líneas omitidas', () => {
    const l = letra([
      linea('a', 'El sol', 8000),
      pausa('p', 10_000),
      linea('omitida', 'Sin marcar', null),
      linea('b', 'El mar', 14_000)
    ])
    expect(fotogramaEn(l, 9000, contexto).actual?.progreso).toBe(0.5)
    expect(fotogramaEn(l, 10_000, contexto)).toMatchObject({
      actual: null,
      siguiente: { id: 'b' }
    })
    expect(
      [11_000, 12_000, 13_000, 14_000].map((t) => fotogramaEn(l, t, contexto).espera?.puntos ?? 0)
    ).toEqual([3, 2, 1, 0])
  })

  it('acota el fin de la última línea y conserva el título si no hay tiempos', () => {
    const l = letra([linea('a', 'Mar', 28_000)])
    expect(fotogramaEn(l, 29_000, contexto).actual?.progreso).toBe(0.5)
    expect(fotogramaEn(l, 30_000, contexto).actual).toBeNull()
    const sinTiempos = letra([linea('b', 'Nube', null)])
    for (const tiempo of [-6000, 0, 20_000]) {
      expect(fotogramaEn(sinTiempos, tiempo, contexto)).toMatchObject({
        titulo: { titulo: 'Inventada' },
        actual: null,
        siguiente: null,
        espera: null
      })
    }
  })

  it('resuelve mil fotogramas de una letra de 5000 líneas sin degradarse con el tamaño', () => {
    // Sin límite fijo ajustado (inestable bajo carga): límite holgado y comparación de complejidad.
    const medir = (n: number): { ms: number; ultimo: string | undefined } => {
      const l = letra(Array.from({ length: n }, (_, i) => linea(String(i), 'Nube', i * 300)))
      const ctx = { ...contexto, duracionMs: n * 300 }
      const inicio = performance.now()
      let ultimo: string | undefined
      for (let i = 0; i < 1000; i++) ultimo = fotogramaEn(l, (i * 1500) % (n * 300), ctx).actual?.id
      return { ms: performance.now() - inicio, ultimo }
    }
    const pequeno = medir(500)
    const grande = medir(5000)
    expect(grande.ultimo).toBe('4995')
    expect(grande.ms).toBeLessThan(2000)
    // Un algoritmo lineal por fotograma sería ~10 veces más lento con 10 veces más líneas.
    expect(grande.ms).toBeLessThan(Math.max(pequeno.ms, 25) * 8)
  })

  describe('espera ampliada', () => {
    const cfg = { ...ESPERA_LEGADA, barra: true, cuenta: true }
    const ctx = { ...contexto, espera: cfg }
    const dos = letra([linea('a', 'A', 1000, { fin_ms: 2000 }), linea('b', 'B', 12_000)])

    it('tabla legada: puntos por instante', () => {
      const l = letra([
        linea('a', 'A', 10_000, { fin_ms: 11_000 }),
        linea('b', 'B', 14_900, { fin_ms: 15_000 }),
        linea('c', 'C', 19_000, { fin_ms: 20_000 }),
        linea('d', 'D', 30_000, { fin_ms: 31_000 })
      ])
      const p = (t: number) => fotogramaEn(l, t, contexto).espera?.puntos ?? 0
      expect([5000, 6500, 7000, 9999].map(p)).toEqual([0, 0, 3, 1])
      expect([11_500, 12_000, 14_000, 14_500].map(p)).toEqual([0, 0, 0, 0])
      expect([16_000, 16_100, 17_500, 18_999].map(p)).toEqual([3, 3, 2, 1])
      expect([27_000, 28_000, 29_999, 31_500].map(p)).toEqual([3, 2, 1, 0])
    })

    it('barra y cuenta en un hueco de 10 s', () => {
      const l = letra([linea('a', 'A', 0, { fin_ms: 2000 }), linea('b', 'B', 12_000)])
      const e = (t: number) => fotogramaEn(l, t, ctx).espera!
      expect(e(7000).fraccion).toBe(0.5)
      expect(e(11_999).fraccion).toBeCloseTo(1, 3)
      expect([9000, 10_000, 11_000].map((t) => e(t).cuenta)).toEqual([3, 2, 1])
      expect(e(5000)).toMatchObject({ cuenta: null, puntos: 0, barra: true, primera: false })
      expect(fotogramaEn(l, 12_000, ctx).espera).toBeNull()
    })

    it('hueco de 2 s con umbral 1000 empieza la cuenta en 2', () => {
      const l = letra([linea('a', 'A', 0, { fin_ms: 1000 }), linea('b', 'B', 3000)])
      const c = { ...contexto, espera: { ...cfg, umbral_ms: 1000 } }
      expect(fotogramaEn(l, 1000, c).espera?.cuenta).toBe(2)
    })

    it('sin siguiente, sin primera entrada o sin casillas no hay espera', () => {
      expect(fotogramaEn(dos, 14_000, ctx).espera).toBeNull()
      const sinPrimera = { ...ctx, espera: { ...cfg, primera_entrada: false } }
      expect(fotogramaEn(letra([linea('a', 'A', 10_000)]), 7000, sinPrimera).espera).toBeNull()
      const ninguna = { ...ctx, espera: { ...cfg, puntos: false, barra: false, cuenta: false } }
      expect(fotogramaEn(dos, 5000, ninguna).espera).toBeNull()
    })

    it('primera entrada con barra y clave estable por hueco', () => {
      const l = letra([linea('a', 'A', 10_000, { fin_ms: 11_000 }), linea('b', 'B', 30_000)])
      expect(fotogramaEn(l, 6000, ctx).espera).toMatchObject({ primera: true, fraccion: 0 })
      const claves = [11_500, 20_000, 27_500, 29_000].map(
        (t) => fotogramaEn(l, t, ctx).espera!.clave
      )
      expect(new Set(claves).size).toBe(1)
      expect(fotogramaEn(l, 8000, ctx).espera!.clave).not.toBe(claves[0])
      expect(fotogramaEn(l, 20_000, ctx)).toEqual(fotogramaEn(l, 20_000, ctx))
    })
  })
})

describe('modelo de puestos por tiempo (ADR 0022 §2)', () => {
  const ctx = (pantalla: Partial<Pantalla> = {}, movimiento?: 'reducido') => ({
    ...contexto,
    duracionMs: 120_000,
    pantalla: { ...PANTALLA_PREDETERMINADA, ...pantalla },
    movimiento
  })
  const puestos = (f: ReturnType<typeof fotogramaEn>) =>
    Object.fromEntries(f.lineas.map((l) => [l.id, [l.desde, l.hacia]]))
  const cadena = (n: number, paso: number, dur: number) =>
    letra(
      Array.from({ length: n }, (_, i) =>
        linea(`l${i}`, `Verso ${i}`, 10_000 + i * paso, { fin_ms: 10_000 + i * paso + dur })
      )
    )

  it('relevo de 100 ms: un solo movimiento que empieza en el inicio de la segunda (R12)', () => {
    const l = cadena(3, 2100, 2000)
    expect(puestos(fotogramaEn(l, 12_050, ctx()))).toMatchObject({ l0: [0, 0], l1: [1, 1] })
    expect(fotogramaEn(l, 12_099, ctx()).cambio).toBeNull()
    const medio = fotogramaEn(l, 12_100 + 175, ctx())
    expect(medio.cambio).toMatchObject({
      tipo: 'desplazamiento',
      inicioMs: 12_100,
      duracionMs: 350
    })
    expect(medio.cambio!.avance).toBeCloseTo(0.875)
    expect(puestos(medio)).toMatchObject({ l0: [0, -1], l1: [1, 0], l2: [2, 1] })
    expect(puestos(fotogramaEn(l, 12_100 + 350, ctx()))).toMatchObject({ l0: [-1, -1], l1: [0, 0] })
  })

  it('hueco de 1,3 s: sale en su fin, deja libre el puesto 0 y la siguiente entra en su inicio (R12)', () => {
    const l = letra([
      linea('a', 'El sol', 12_400, { fin_ms: 15_800 }),
      linea('b', 'La luna', 17_100, { fin_ms: 20_300 }),
      linea('c', 'El mar', 21_000, { fin_ms: 23_000 })
    ])
    const salida = fotogramaEn(l, 15_800 + 100, {
      ...ctx(),
      espera: { ...ESPERA_LEGADA, barra: true, umbral_ms: 1000 }
    })
    expect(puestos(salida)).toMatchObject({ a: [0, -1], b: [1, 1] })
    expect(salida.esperaAparicion).toBeGreaterThan(0)
    const libre = puestos(fotogramaEn(l, 16_500, ctx()))
    expect(libre).toMatchObject({ a: [-1, -1], b: [1, 1], c: [2, 2] })
    expect(Object.values(libre).some(([d, h]) => d === 0 || h === 0)).toBe(false)
    expect(puestos(fotogramaEn(l, 17_100 + 100, ctx()))).toMatchObject({ b: [1, 0], c: [2, 1] })
  })

  it('hueco de 8 s: las ya cantadas se retiran a los 2 s y no reaparecen (R8, R9)', () => {
    const l = letra([
      linea('a', 'Uno', 1000, { fin_ms: 3000 }),
      linea('b', 'Dos', 3500, { fin_ms: 5000 }),
      linea('c', 'Tres', 13_000, { fin_ms: 15_000 }),
      linea('d', 'Cuatro', 15_500, { fin_ms: 17_000 })
    ])
    const c = ctx({ lineas: 6, pasadas: 2 })
    const en = (ms: number) => fotogramaEn(l, ms, c)
    expect(en(5000 + 2000).lineas.find((x) => x.id === 'b')).toMatchObject({ retirada: 1 })
    expect(en(5000 + 2200).lineas.find((x) => x.id === 'b')!.retirada).toBeCloseTo(0.5)
    expect(en(5000 + 2400).lineas.map((x) => x.id)).toEqual(['c', 'd'])
    expect(en(13_000 + 1000).lineas.map((x) => x.id)).toEqual(['c', 'd'])
    // c sale: es la única ya cantada aunque P = 2.
    const tras = puestos(en(15_000 + 400))
    expect(tras).toMatchObject({ c: [-1, -1], d: [1, 1] })
    expect(Object.keys(tras)).not.toContain('b')
    expect(en(17_000 + 2400).lineas).toEqual([])
  })

  it('duraciones: 0,27 s entra en 162 ms; 0,15 s y 15 ms cambian al instante (R13)', () => {
    const l = letra([
      linea('a', 'Uno', 1000, { fin_ms: 3000 }),
      linea('b', 'Dos', 5000, { fin_ms: 5270 }),
      linea('c', 'Tres', 8000, { fin_ms: 8150 }),
      linea('d', 'Cuatro', 11_000, { fin_ms: 11_015 })
    ])
    expect(fotogramaEn(l, 5100, ctx()).cambio?.duracionMs).toBe(162)
    expect(fotogramaEn(l, 8000, ctx()).cambio).toBeNull()
    expect(puestos(fotogramaEn(l, 8000, ctx()))).toMatchObject({ c: [0, 0] })
    expect(fotogramaEn(l, 11_000, ctx()).cambio).toBeNull()
    expect(fotogramaEn(l, 5100, ctx({ transicion: 'fundido' })).cambio).toMatchObject({
      tipo: 'fundido',
      duracionMs: 162
    })
    expect(fotogramaEn(l, 5100, ctx({ transicion: 'ninguna' })).cambio).toBeNull()
  })

  it('diez líneas de 0,3 s a 60 FPS no dan saltos mayores que la curva (R13)', () => {
    const l = cadena(10, 300, 300)
    const c = ctx()
    const posicion = (ms: number) =>
      new Map(
        fotogramaEn(l, ms, c).lineas.map((x) => [x.id, x.desde + (x.hacia - x.desde) * x.avance])
      )
    let previo = posicion(8000)
    for (let ms = 8000 + 1000 / 60; ms < 13_500; ms += 1000 / 60) {
      const actual = posicion(ms)
      for (const [id, p] of actual) {
        const antes = previo.get(id)
        // 3 · (16,7 ms / 180 ms) = 0,28 puestos como máximo por fotograma.
        if (antes !== undefined) expect(Math.abs(p - antes)).toBeLessThanOrEqual(0.3)
      }
      previo = actual
    }
  })

  it('50 instantes al azar dan lo mismo que reproducir hasta ellos, y la pausa congela (R14, R15)', () => {
    const l = cadena(8, 2500, 1800)
    const copia = structuredClone(l)
    let semilla = 7
    const azar = () => (semilla = (semilla * 16_807) % 2_147_483_647) / 2_147_483_647
    const instantes = Array.from({ length: 50 }, () => 5000 + azar() * 25_000)
    for (const ms of instantes) {
      expect(fotogramaEn(l, ms, ctx())).toEqual(fotogramaEn(copia, ms, ctx()))
    }
    const mitad = fotogramaEn(l, 12_600 + 100, ctx())
    expect(mitad.cambio).not.toBeNull()
    expect(fotogramaEn(l, 12_700, ctx())).toEqual(mitad)
  })

  it('en reposo hay como mucho N líneas y durante un cambio N + 1 (R1)', () => {
    const l = cadena(12, 2100, 2000)
    for (let n = 2; n <= 7; n++) {
      const c = ctx({ lineas: n, pasadas: 2 })
      let maximoCambio = 0
      for (let ms = 5000; ms < 42_000; ms += 25) {
        const f = fotogramaEn(l, ms, c)
        if (f.cambio) maximoCambio = Math.max(maximoCambio, f.lineas.length)
        else expect(f.lineas.length).toBeLessThanOrEqual(n)
        expect(f.lineas.length).toBeLessThanOrEqual(n + 1)
      }
      expect(maximoCambio).toBe(n + 1)
    }
  })

  it('con 2 líneas y «Sin animación» coincide con 0.2.1 (R2) y respeta las pasadas efectivas (R7)', () => {
    const l = cadena(6, 3000, 2800)
    const dos = fotogramaEn(l, 14_000, ctx({ lineas: 2, transicion: 'ninguna' }))
    expect(puestos(dos)).toEqual({ l1: [0, 0], l2: [1, 1] })
    expect(dos.actual?.id).toBe('l1')
    expect(dos.siguiente?.id).toBe('l2')
    // Tras el fin de l1 y antes de l2 (hueco 200 ms) no hay animación: el cambio es instantáneo.
    const cinco = fotogramaEn(l, 13_500, ctx({ lineas: 5, pasadas: 2 }))
    expect(
      Object.values(puestos(cinco))
        .map(([p]) => p)
        .sort()
    ).toEqual([-1, 0, 1, 2, 3])
    const tres = fotogramaEn(l, 13_500, ctx({ lineas: 3, pasadas: 2 }))
    expect(Object.values(puestos(tres)).every((v) => v[0]! >= 0)).toBe(true)
  })

  it('aparición del bloque tras el título: 250 ms (y 0 con movimiento reducido)', () => {
    const l = cadena(3, 3000, 2800)
    expect(fotogramaEn(l, 5999, ctx()).titulo).not.toBeNull()
    expect(fotogramaEn(l, 6000, ctx()).aparicion).toBe(0)
    expect(fotogramaEn(l, 6125, ctx()).aparicion).toBeCloseTo(0.5)
    expect(fotogramaEn(l, 6250, ctx()).aparicion).toBe(1)
    expect(fotogramaEn(l, 6000, ctx({}, 'reducido')).aparicion).toBe(1)
    expect(puestos(fotogramaEn(l, 6000, ctx()))).toEqual({ l0: [1, 1], l1: [2, 2], l2: [3, 3] })
  })

  it('con movimiento reducido no hay cambio ni interpolación y la retirada es instantánea (R16)', () => {
    const l = cadena(4, 2100, 2000)
    for (let ms = 9000; ms < 20_000; ms += 37) {
      const f = fotogramaEn(l, ms, ctx({}, 'reducido'))
      expect(f.cambio).toBeNull()
      expect(f.lineas.every((x) => x.avance === 1 && x.desde === x.hacia)).toBe(true)
    }
    const solo = letra([
      linea('a', 'Uno', 1000, { fin_ms: 3000 }),
      linea('b', 'Dos', 9000, { fin_ms: 11_000 })
    ])
    expect(fotogramaEn(solo, 3000 + 1999, ctx({}, 'reducido')).lineas.map((x) => x.id)).toContain(
      'a'
    )
    expect(fotogramaEn(solo, 3000 + 2000, ctx({}, 'reducido')).lineas.map((x) => x.id)).toEqual([
      'b'
    ])
  })

  it('las líneas sin inicio no ocupan puesto y la espera aparece con la salida (R20)', () => {
    const l = letra([
      linea('a', 'Uno', 1000, { fin_ms: 3000 }),
      linea('x', 'Sin marcar', null),
      linea('b', 'Dos', 9000, { fin_ms: 11_000 })
    ])
    const f = fotogramaEn(l, 3000 + 175, {
      ...ctx(),
      espera: { ...ESPERA_LEGADA, barra: true, umbral_ms: 1000 }
    })
    expect(f.lineas.map((x) => x.id)).toEqual(['a', 'b'])
    expect(f.espera).not.toBeNull()
    expect(f.esperaAparicion).toBeCloseTo(0.875)
  })

  it('fotogramaEstatico pone la seleccionada en el puesto 0 a medio barrer', () => {
    const l = cadena(6, 3000, 2800)
    const f = fotogramaEstatico(l, 'l3', { lineas: 5, pasadas: 1, transicion: 'desplazamiento' })
    expect(puestos(f)).toEqual({ l2: [-1, -1], l3: [0, 0], l4: [1, 1], l5: [2, 2] })
    expect(f.lineas.find((x) => x.id === 'l3')?.progreso).toBe(0.5)
    expect(f.cambio).toBeNull()
  })

  it('dos subsecuencias de una misma letra dan fotogramas independientes (ADR 0029 §4 bis)', () => {
    const l = cadena(8, 1000, 900)
    const pares = { lineas: l.lineas.filter((_, i) => i % 2 === 0) }
    const impares = { lineas: l.lineas.filter((_, i) => i % 2 === 1) }
    // Cada subsecuencia deja huecos mayores (1,1 s): dos tiempos, sin relevo.
    const c = ctx({ lineas: 3, pasadas: 0 })
    expect(Object.keys(puestos(fotogramaEn(pares, 10_000 + 100, c)))).toEqual(['l0', 'l2', 'l4'])
    expect(Object.keys(puestos(fotogramaEn(impares, 11_000 + 100, c)))).toEqual(['l1', 'l3', 'l5'])
    expect(fotogramaEn(pares, 11_100, c).lineas.map((x) => x.id)).not.toContain('l1')
    // Nunca dos cambios a la vez en ninguna de las dos: los sucesos no se solapan.
    for (const sub of [pares, impares, l]) {
      let enCambio = 0
      let ultimoFin = -Infinity
      for (let ms = 9000; ms < 20_000; ms += 5) {
        const f = fotogramaEn(sub, ms, c)
        if (f.cambio) {
          if (f.cambio.inicioMs >= ultimoFin) enCambio++
          ultimoFin = Math.max(ultimoFin, f.cambio.inicioMs + f.cambio.duracionMs)
          expect(ms).toBeLessThan(f.cambio.inicioMs + f.cambio.duracionMs)
        }
      }
      expect(enCambio).toBeGreaterThan(0)
    }
  })
})
