import { describe, expect, it } from 'vitest'
import { letra, linea, pausa } from '../__fixtures__'
import { validarInvariantesLetra, validarPalabrasManuales, type Letra } from '../letra'
import {
  ajustarPalabra,
  aplicarEdicionPrecisa,
  cargarBorrador,
  finAlSoltar,
  limitesEditorDe,
  marcarAlVuelo,
  moverLimiteLinea,
  moverPalabra,
  quitarPalabras,
  reaplicarTexto,
  repartir,
  repartirDeNuevo,
  validarBorrador,
  type BorradorLinea
} from './palabras'

const D = 60_000
const REAL_LIFE = 'Is this the real life?'

function lineaReal(extra: Parameters<typeof linea>[3] = {}): Letra {
  return letra([
    linea('a', 'Antes', 5000, { fin_ms: 8000 }),
    linea('b', REAL_LIFE, 12000, { fin_ms: 14000, ...extra }),
    pausa('p', 16000),
    linea('c', 'Después', 20000)
  ])
}

const borradorReal = () => cargarBorrador(lineaReal(), 'b', D).borrador
const tiempos = (b: BorradorLinea) => b.palabras.map((p) => [p.inicio_ms, p.fin_ms])
const marcadas = (b: BorradorLinea) => b.palabras.map((p) => p.marcada)

function manuales(): Letra {
  return lineaReal({
    palabras: [
      { texto: 'Is', inicio_ms: 12000, fin_ms: 12500 },
      { texto: 'this', inicio_ms: 12500, fin_ms: 13000 },
      { texto: 'the', inicio_ms: 13000, fin_ms: 13200 },
      { texto: 'real', inicio_ms: 13300, fin_ms: 13600 },
      { texto: 'life?', inicio_ms: 13700, fin_ms: 14000 }
    ],
    origen_palabras: 'manual'
  })
}

describe('cargarBorrador y repartir (P5, P21)', () => {
  it('sin palabras: todas sin marcar, repartidas por caracteres (P5)', () => {
    const { borrador, invalidas } = cargarBorrador(lineaReal(), 'b', D)
    expect(invalidas).toBe(false)
    expect(marcadas(borrador)).toEqual([false, false, false, false, false])
    const [is, , , , life] = borrador.palabras
    expect(Math.abs(is!.inicio_ms - 12000)).toBeLessThanOrEqual(1)
    expect(Math.abs(is!.fin_ms - 12222)).toBeLessThanOrEqual(1)
    expect(Math.abs(life!.inicio_ms - 13444)).toBeLessThanOrEqual(1)
    expect(life!.fin_ms).toBe(14000)
    // sin huecos
    borrador.palabras
      .slice(1)
      .forEach((p, i) => expect(p.inicio_ms).toBe(borrador.palabras[i]!.fin_ms))
    expect(validarBorrador(borrador)).toEqual([])
  })

  it('las importadas se cargan como sin marcar y sin aviso', () => {
    const importadas = lineaReal({
      palabras: [{ texto: 'Is', inicio_ms: 100, fin_ms: 200 }]
    })
    const r = cargarBorrador(importadas, 'b', D)
    expect(r.invalidas).toBe(false)
    expect(marcadas(r.borrador)).toEqual([false, false, false, false, false])
  })

  it('manuales válidas: todas marcadas con sus tiempos', () => {
    const { borrador, invalidas } = cargarBorrador(manuales(), 'b', D)
    expect(invalidas).toBe(false)
    expect(marcadas(borrador)).toEqual([true, true, true, true, true])
    expect(tiempos(borrador)[3]).toEqual([13300, 13600])
  })

  it('manuales no válidas (solapadas): sin marcar con el reparto y aviso (P21)', () => {
    const mala = manuales()
    mala.lineas[1]!.palabras![1]!.inicio_ms = 12400
    const { borrador, invalidas } = cargarBorrador(mala, 'b', D)
    expect(invalidas).toBe(true)
    expect(marcadas(borrador)).toEqual([false, false, false, false, false])
    expect(validarBorrador(borrador)).toEqual([])
  })

  it('con fin automático usa el fin efectivo de la línea', () => {
    const l = letra([linea('a', 'Uno dos', 1000), linea('b', 'x', 5000)])
    const { borrador } = cargarBorrador(l, 'a', D)
    expect(borrador.fin_ms).toBe(5000)
  })

  it('un tramo entre marcadas se reparte, con el mínimo de 20 ms aunque pese poco', () => {
    const b = borradorReal()
    const marcada = {
      ...b,
      palabras: b.palabras.map((p, i) =>
        i === 4 ? { ...p, marcada: true, inicio_ms: 13990, fin_ms: 14000 } : p
      )
    }
    const r = repartir(marcada)
    // life? empieza a 13990, 10 ms: no válido por sí solo; los otros caben en 11990 ms
    expect(r.palabras[3]!.fin_ms).toBe(13990)
    expect(r.palabras.slice(0, 4).every((p) => p.fin_ms - p.inicio_ms >= 20)).toBe(true)
  })
})

describe('marcarAlVuelo (P7)', () => {
  it('marca el inicio, avanza la selección y deja el fin abierto', () => {
    const r = marcarAlVuelo(borradorReal(), 0, 12300)
    expect(r.motivo).toBeNull()
    expect(r.siguiente).toBe(1)
    expect(r.borrador.palabras[0]).toMatchObject({
      inicio_ms: 12300,
      marcada: true,
      finAbierto: true
    })
    expect(validarBorrador(r.borrador)).toEqual([])
  })

  it('cada marca recorta el fin abierto de la anterior al nuevo inicio', () => {
    let b = marcarAlVuelo(borradorReal(), 0, 12100).borrador
    b = marcarAlVuelo(b, 1, 12800).borrador
    expect(b.palabras[0]).toMatchObject({ inicio_ms: 12100, fin_ms: 12800, finAbierto: false })
    expect(b.palabras[1]!.inicio_ms).toBe(12800)
    expect(validarBorrador(b)).toEqual([])
  })

  it('las posteriores que empiezan antes pasan a sin marcar y se reparten', () => {
    let b = borradorReal()
    b = marcarAlVuelo(b, 0, 12100).borrador
    b = marcarAlVuelo(b, 1, 12500).borrador
    b = marcarAlVuelo(b, 2, 12900).borrador
    // marcar la palabra 0 más tarde que la 1 y la 2 las deja sin marcar
    const r2 = marcarAlVuelo(b, 0, 13000)
    expect(marcadas(r2.borrador)).toEqual([true, false, false, false, false])
    expect(validarBorrador(r2.borrador)).toEqual([])
  })

  it('fuera de la línea: antes del inicio o desde el fin', () => {
    expect(marcarAlVuelo(borradorReal(), 0, 11999).motivo).toBe('fuera')
    expect(marcarAlVuelo(borradorReal(), 0, 14000).motivo).toBe('fuera')
  })

  it('demasiado pronto: ≤ inicio de la anterior marcada o sin 20 ms por cada sin marcar', () => {
    const b = marcarAlVuelo(borradorReal(), 0, 12100).borrador
    expect(marcarAlVuelo(b, 1, 12100).motivo).toBe('pronto')
    expect(marcarAlVuelo(b, 1, 12119).motivo).toBe('pronto')
    expect(marcarAlVuelo(b, 1, 12120).motivo).toBeNull()
    // palabra 3 con tres sin marcar delante: ≥ 12000 + 3 × 20
    expect(marcarAlVuelo(borradorReal(), 3, 12059).motivo).toBe('pronto')
    expect(marcarAlVuelo(borradorReal(), 3, 12060).motivo).toBeNull()
  })

  it('no hay sitio para las que faltan por marcar: fuera', () => {
    expect(marcarAlVuelo(borradorReal(), 0, 13950).motivo).toBe('fuera')
  })

  it('la última palabra se vuelve a marcar sin pasar de ella', () => {
    const r = marcarAlVuelo(borradorReal(), 4, 13500)
    expect(r.siguiente).toBe(4)
    expect(r.borrador.palabras[4]).toMatchObject({ inicio_ms: 13500, fin_ms: 14000 })
  })

  it('una sola palabra', () => {
    const l = letra([linea('a', 'Hola', 1000, { fin_ms: 3000 })])
    const b = cargarBorrador(l, 'a', D).borrador
    const r = marcarAlVuelo(b, 0, 1500)
    expect(r.siguiente).toBe(0)
    expect(tiempos(r.borrador)).toEqual([[1500, 3000]])
  })

  it('finAlSoltar fija el fin limitado por la siguiente marcada y el fin de la línea', () => {
    let b = marcarAlVuelo(borradorReal(), 0, 12100).borrador
    b = marcarAlVuelo(b, 2, 13000).borrador
    const largo = finAlSoltar(b, 0, 13500)
    // la palabra 1 (sin marcar) necesita 20 ms antes de la 2
    expect(largo.palabras[0]!.fin_ms).toBe(12980)
    expect(largo.palabras[0]!.finAbierto).toBe(false)
    const corto = finAlSoltar(b, 0, 12105)
    expect(corto.palabras[0]!.fin_ms).toBe(12120)
    expect(validarBorrador(largo)).toEqual([])
    expect(finAlSoltar(b, 1, 13000)).toBe(b) // sin marcar: no hace nada
  })

  it('no muta la entrada', () => {
    const b = borradorReal()
    const copia = structuredClone(b)
    marcarAlVuelo(b, 0, 12300)
    finAlSoltar(b, 0, 12500)
    moverPalabra(b, 1, 'inicio', 12600)
    reaplicarTexto(b, 'Otra cosa')
    expect(b).toEqual(copia)
  })
})

describe('moverPalabra y ajustarPalabra (P6)', () => {
  const marcada = () => cargarBorrador(manuales(), 'b', D).borrador

  it('mueve el fin y marca la palabra', () => {
    const r = moverPalabra(borradorReal(), 1, 'fin', 12900)
    expect(r.limite).toBeNull()
    expect(r.borrador.palabras[1]).toMatchObject({ fin_ms: 12900, marcada: true })
    expect(r.borrador.palabras[2]!.inicio_ms).toBe(12900)
    expect(validarBorrador(r.borrador)).toEqual([])
  })

  it('se detiene en el inicio de la siguiente marcada', () => {
    const r = moverPalabra(marcada(), 3, 'fin', 13750)
    expect(r.limite).toBe('siguiente')
    expect(r.borrador.palabras[3]!.fin_ms).toBe(13700)
  })

  it('se detiene en el fin de la anterior marcada', () => {
    const r = moverPalabra(marcada(), 3, 'inicio', 13100)
    expect(r.limite).toBe('anterior')
    expect(r.borrador.palabras[3]!.inicio_ms).toBe(13200)
    const primera = moverPalabra(marcada(), 0, 'inicio', 11000)
    expect(primera.limite).toBe('anterior')
    expect(primera.borrador.palabras[0]!.inicio_ms).toBe(12000)
  })

  it('mínimo de 20 ms', () => {
    const r = moverPalabra(marcada(), 3, 'fin', 13000)
    expect(r.limite).toBe('minimo')
    expect(r.borrador.palabras[3]!.fin_ms).toBe(13320)
    const i = moverPalabra(marcada(), 3, 'inicio', 13700)
    expect(i.limite).toBe('minimo')
    expect(i.borrador.palabras[3]!.inicio_ms).toBe(13580)
  })

  it('la última no pasa del fin de la línea', () => {
    const r = moverPalabra(marcada(), 4, 'fin', 15000)
    expect(r.limite).toBe('siguiente')
    expect(r.borrador.palabras[4]!.fin_ms).toBe(14000)
  })

  it('con sin marcar entre medias deja 20 ms a cada una', () => {
    let b = moverPalabra(borradorReal(), 0, 'inicio', 12000).borrador // marca la 0
    b = marcarAlVuelo(b, 4, 13000).borrador
    const r = moverPalabra(b, 0, 'fin', 13500)
    expect(r.limite).toBe('siguiente')
    expect(r.borrador.palabras[0]!.fin_ms).toBe(12940) // 13000 − 3 × 20
    expect(validarBorrador(r.borrador)).toEqual([])
  })

  it('ajustarPalabra suma el delta y avisa del límite', () => {
    const r = ajustarPalabra(marcada(), 3, 'fin', 500)
    expect(r.limite).toBe('siguiente')
    expect(ajustarPalabra(marcada(), 3, 'fin', -10).borrador.palabras[3]!.fin_ms).toBe(13590)
    expect(ajustarPalabra(marcada(), 9, 'fin', 10).borrador).toEqual(marcada())
  })

  it('las sin marcar vecinas se reparten de nuevo', () => {
    const r = moverPalabra(borradorReal(), 3, 'inicio', 13000)
    expect(r.borrador.palabras[2]!.fin_ms).toBe(13000)
    expect(r.borrador.palabras[3]).toMatchObject({ marcada: true, inicio_ms: 13000 })
  })
})

describe('moverLimiteLinea (P10)', () => {
  const lim = (l: Letra = lineaReal()) => limitesEditorDe(l, 'b', D)

  it('los límites del editor salen de los vecinos y la duración', () => {
    expect(lim()).toEqual({ inicioMin: 5001, inicioMax: 15999, finMax: 16000 })
    const ultima = letra([linea('a', 'x', 1000)])
    expect(limitesEditorDe(ultima, 'a', D)).toEqual({ inicioMin: 0, inicioMax: null, finMax: D })
  })

  it('mueve el inicio y reparte las sin marcar', () => {
    const r = moverLimiteLinea(borradorReal(), 'inicio', 11000, lim())
    expect(r.limite).toBeNull()
    expect(r.borrador.inicio_ms).toBe(11000)
    expect(r.borrador.palabras[0]!.inicio_ms).toBe(11000)
    expect(validarBorrador(r.borrador)).toEqual([])
  })

  it('respeta las reglas del editor', () => {
    expect(moverLimiteLinea(borradorReal(), 'inicio', 1000, lim()).limite).toBe('editor')
    expect(moverLimiteLinea(borradorReal(), 'inicio', 1000, lim()).borrador.inicio_ms).toBe(5001)
    const fin = moverLimiteLinea(borradorReal(), 'fin', 30000, lim())
    expect(fin.limite).toBe('editor')
    expect(fin.borrador.fin_ms).toBe(16000)
  })

  it('no cruza la primera ni la última marcada', () => {
    const b = cargarBorrador(manuales(), 'b', D).borrador
    const ini = moverLimiteLinea(b, 'inicio', 12800, lim())
    expect(ini.limite).toBe('linea')
    expect(ini.borrador.inicio_ms).toBe(12000)
    const fin = moverLimiteLinea(b, 'fin', 13000, lim())
    expect(fin.limite).toBe('linea')
    expect(fin.borrador.fin_ms).toBe(14000)
    // fuera de las palabras sí se puede ampliar y recortar hasta ellas
    expect(moverLimiteLinea(b, 'fin', 15000, lim()).borrador.fin_ms).toBe(15000)
  })

  it('con sin marcar antes de la primera marcada deja 20 ms a cada una', () => {
    const b = marcarAlVuelo(borradorReal(), 2, 12500).borrador
    const r = moverLimiteLinea(b, 'inicio', 12900, lim())
    expect(r.limite).toBe('linea')
    expect(r.borrador.inicio_ms).toBe(12460)
    expect(validarBorrador(r.borrador)).toEqual([])
  })
})

describe('repartirDeNuevo y quitarPalabras', () => {
  it('repartirDeNuevo deja todas sin marcar y quita el «quitar»', () => {
    const b = quitarPalabras(cargarBorrador(manuales(), 'b', D).borrador)
    expect(b.quitar).toBe(true)
    const r = repartirDeNuevo(b)
    expect(r.quitar).toBe(false)
    expect(marcadas(r)).toEqual([false, false, false, false, false])
  })

  it('cualquier marca nueva sale de «quitar»', () => {
    const q = quitarPalabras(borradorReal())
    expect(q.quitar).toBe(true)
    expect(marcarAlVuelo(q, 0, 12300).borrador.quitar).toBe(false)
    expect(moverPalabra(q, 0, 'fin', 12300).borrador.quitar).toBe(false)
    expect(
      moverLimiteLinea(q, 'fin', 15000, limitesEditorDe(lineaReal(), 'b', D)).borrador.quitar
    ).toBe(true)
  })
})

describe('reaplicarTexto (P11)', () => {
  const marcadoReal = () => cargarBorrador(manuales(), 'b', D).borrador

  it('mismo número de palabras: conserva tiempos y estado por posición', () => {
    const r = reaplicarTexto(marcadoReal(), 'Is this the reel life?')
    expect(r.repartidas).toBe(0)
    expect(r.borrador.texto).toBe('Is this the reel life?')
    expect(r.borrador.palabras[3]).toMatchObject({
      texto: 'reel',
      inicio_ms: 13300,
      fin_ms: 13600,
      marcada: true
    })
    expect(tiempos(r.borrador)).toEqual(tiempos(marcadoReal()))
  })

  it('una palabra más: las cinco conservan y «Oh» queda sin marcar', () => {
    const r = reaplicarTexto(marcadoReal(), 'Is this the real life? Oh')
    expect(r.repartidas).toBe(1)
    expect(r.borrador.palabras.map((p) => p.texto)).toEqual([
      'Is',
      'this',
      'the',
      'real',
      'life?',
      'Oh'
    ])
    expect(marcadas(r.borrador)).toEqual([true, true, true, true, true, false])
    expect(r.borrador.palabras[0]).toMatchObject({ inicio_ms: 12000, fin_ms: 12500 })
    expect(validarBorrador(r.borrador)).toEqual([])
  })

  it('una palabra nueva en medio se reparte en su hueco y los espacios dobles no cuentan', () => {
    const r = reaplicarTexto(marcadoReal(), '  Is this  the very real life? ')
    expect(r.repartidas).toBe(1)
    expect(r.borrador.texto).toBe('Is this  the very real life?')
    const very = r.borrador.palabras[3]!
    expect(very).toMatchObject({ texto: 'very', marcada: false })
    expect(very.inicio_ms).toBeGreaterThanOrEqual(13000)
    expect(very.fin_ms).toBeLessThanOrEqual(13300)
    expect(validarBorrador(r.borrador)).toEqual([])
  })

  it('menos palabras: las no emparejadas desaparecen', () => {
    const r = reaplicarTexto(marcadoReal(), 'Is this life?')
    expect(r.repartidas).toBe(0)
    expect(r.borrador.palabras.map((p) => p.texto)).toEqual(['Is', 'this', 'life?'])
    expect(validarBorrador(r.borrador)).toEqual([])
  })

  it('texto vacío: no cambia nada', () => {
    const b = marcadoReal()
    expect(reaplicarTexto(b, '   ').borrador).toBe(b)
  })
})

describe('aplicarEdicionPrecisa (P13)', () => {
  const problemas = (l: Letra) => validarInvariantesLetra(l.lineas)

  it('escribe texto, inicio, fin y palabras manuales fijando el fin automático', () => {
    const l = letra([
      linea('a', 'Antes', 5000, { fin_ms: 8000 }),
      linea('b', REAL_LIFE, 12000),
      linea('c', 'Después', 20000)
    ])
    const copia = structuredClone(l)
    let b = cargarBorrador(l, 'b', D).borrador
    expect(b.fin_ms).toBe(20000)
    b = reaplicarTexto(b, 'Is this the reel life?').borrador
    b = moverPalabra(b, 0, 'fin', 12400).borrador
    const r = aplicarEdicionPrecisa(l, 'b', b, D)
    expect(l).toEqual(copia)
    const el = r.lineas[1]!
    expect(el.texto).toBe('Is this the reel life?')
    expect(el.origen_palabras).toBe('manual')
    expect(el.fin_ms).toBe(20000)
    expect(el.palabras).toHaveLength(5)
    expect(validarPalabrasManuales(el, el.fin_ms)).toEqual([])
    expect(problemas(r)).toEqual([])
  })

  it('con el fin fijado y las palabras manuales previas, las reescribe', () => {
    const b = moverPalabra(cargarBorrador(manuales(), 'b', D).borrador, 3, 'fin', 13650).borrador
    const r = aplicarEdicionPrecisa(manuales(), 'b', b, D)
    expect(r.lineas[1]!.palabras![3]).toEqual({ texto: 'real', inicio_ms: 13300, fin_ms: 13650 })
    expect(r.lineas[1]!.fin_ms).toBe(14000)
  })

  it('quitar: la línea queda sin palabras ni origen y el fin automático sigue siéndolo', () => {
    const l = letra([linea('a', 'Uno dos', 1000), linea('b', 'x', 5000)])
    const b = quitarPalabras(cargarBorrador(l, 'a', D).borrador)
    const r = aplicarEdicionPrecisa(l, 'a', b, D)
    expect(r.lineas[0]).toEqual({ ...l.lineas[0], palabras: null })
    expect(r.lineas[0]).not.toHaveProperty('origen_palabras')
    const m = aplicarEdicionPrecisa(
      manuales(),
      'b',
      quitarPalabras(cargarBorrador(manuales(), 'b', D).borrador),
      D
    )
    expect(m.lineas[1]!.palabras).toBeNull()
    expect(m.lineas[1]).not.toHaveProperty('origen_palabras')
    expect(m.lineas[1]!.fin_ms).toBe(14000)
  })

  it('mover el inicio no descarta las palabras propias pero sí trata a la anterior', () => {
    const l = letra([
      linea('a', 'Antes', 5000, {
        fin_ms: 12500,
        palabras: [{ texto: 'Antes', inicio_ms: 5000, fin_ms: 12400 }],
        origen_palabras: 'manual'
      }),
      linea('b', 'Hola mundo', 12600, { fin_ms: 14000 })
    ])
    let b = cargarBorrador(l, 'b', D).borrador
    b = moverLimiteLinea(b, 'inicio', 12000, limitesEditorDe(l, 'b', D)).borrador
    const r = aplicarEdicionPrecisa(l, 'b', b, D)
    expect(r.lineas[1]!.inicio_ms).toBe(12000)
    expect(r.lineas[1]!.palabras).toHaveLength(2)
    expect(r.lineas[1]!.palabras![0]!.inicio_ms).toBe(12000)
    expect(r.lineas[0]!.fin_ms).toBeNull() // su fin fijado (12500) pasa a automático
    expect(r.lineas[0]!.palabras).toBeNull() // y pierde las suyas
    expect(problemas(r)).toEqual([])
  })

  it('cambiar los límites con el fin automático y sin palabras lo fija', () => {
    const l = letra([linea('a', 'Uno dos', 1000), linea('b', 'x', 5000)])
    let b = cargarBorrador(l, 'a', D).borrador
    b = moverLimiteLinea(b, 'fin', 3000, limitesEditorDe(l, 'a', D)).borrador
    const r = aplicarEdicionPrecisa(l, 'a', quitarPalabras(b), D)
    expect(r.lineas[0]!.fin_ms).toBe(3000)
    expect(r.lineas[0]!.palabras).toBeNull()
  })

  it('un borrador no válido lanza', () => {
    const b = cargarBorrador(lineaReal(), 'b', D).borrador
    const roto = {
      ...b,
      palabras: b.palabras.map((p) => ({ ...p, marcada: true, fin_ms: p.inicio_ms }))
    }
    expect(() => aplicarEdicionPrecisa(lineaReal(), 'b', roto, D)).toThrow(RangeError)
  })
})

describe('ninguna operación rompe las reglas de validez', () => {
  it('secuencias pseudoaleatorias de operaciones', () => {
    let semilla = 12345
    const azar = (max: number) => {
      semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
      return semilla % max
    }
    const lim = limitesEditorDe(lineaReal(), 'b', D)
    for (let ronda = 0; ronda < 40; ronda++) {
      let b = borradorReal()
      for (let paso = 0; paso < 25; paso++) {
        const k = azar(b.palabras.length)
        const ms = 11900 + azar(4300)
        const op = azar(7)
        const antes = structuredClone(b)
        switch (op) {
          case 0:
            b = marcarAlVuelo(b, k, ms).borrador
            break
          case 1:
            b = finAlSoltar(b, k, ms)
            break
          case 2:
            b = moverPalabra(b, k, azar(2) ? 'inicio' : 'fin', ms).borrador
            break
          case 3:
            b = ajustarPalabra(b, k, azar(2) ? 'inicio' : 'fin', azar(400) - 200).borrador
            break
          case 4:
            b = moverLimiteLinea(b, azar(2) ? 'inicio' : 'fin', ms, lim).borrador
            break
          case 5:
            b = reaplicarTexto(b, azar(2) ? REAL_LIFE : `${REAL_LIFE} Oh yes`).borrador
            break
          default:
            b = repartir(b)
        }
        // Una línea demasiado corta para sus palabras (20 ms cada una) no se puede validar.
        if (b.fin_ms - b.inicio_ms < 20 * b.palabras.length) break
        expect(
          validarBorrador(b),
          `ronda ${ronda}, paso ${paso}, op ${op}, k ${k}, ms ${ms}: ${JSON.stringify(antes)}`
        ).toEqual([])
      }
    }
  })
})
