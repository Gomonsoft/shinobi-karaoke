import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { cancionDosCantantes, cancionUnCantanteConCoros } from '@shared/__fixtures__/reparto'
import { cancionVocesAlaVez } from '@shared/__fixtures__/voces'
import { estiloPredeterminado } from '@shared/estilo'
import { PANTALLA_PREDETERMINADA } from '@shared/pantalla'
import { PantallaLetra } from './PantallaLetra'

// 0.2.3 · tarea 0348: color por parte, insignia y paréntesis del coro (ADR 0029 §4).
// Estos tests miran el bloque único (`zonas: "una"`); las zonas, en `zonas.test.ts` y más abajo.
const estiloBloque = (() => {
  const e = estiloPredeterminado()
  e.pantalla = { ...PANTALLA_PREDETERMINADA, zonas: 'una' }
  return e
})()
const props = {
  estilo: estiloBloque,
  titulo: 'Inventada',
  artista: 'Shinobi',
  duracionMs: 30_000,
  reproduciendo: true,
  movimiento: 'completo' as const
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(720)
})
afterEach(() => vi.restoreAllMocks())

const nodo = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-linea=${id}]`)!
const raiz = (c: HTMLElement) => c.firstElementChild as HTMLElement

describe('sin reparto (regla de oro: igual que en 0.2.2)', () => {
  const sola = letra([
    linea('a', 'Nubes de sal', 2000, { fin_ms: 4900 }),
    linea('b', 'Cantan al viento', 5000, { fin_ms: 7900 })
  ])
  // Un cantante con nombre y un nivel de coros propio: `partes` sin reparto.
  const conPartes = {
    ...sola,
    partes: { cantantes: [{ id: 'c1' as const, nombre: 'Ana' }], voz_en_coros: 0.7 }
  }

  it('no añade insignias, colores, paréntesis ni cambia el ancho, ni con `partes` sin reparto', () => {
    for (let i = 0; i < 50; i++) {
      const t = i * 400
      const x = render(<PantallaLetra {...props} letra={sola} tiempoFijoMs={t} />)
      const y = render(<PantallaLetra {...props} letra={conPartes} tiempoFijoMs={t} />)
      expect(y.container.innerHTML).toBe(x.container.innerHTML)
      x.unmount()
      y.unmount()
    }
    const a = render(<PantallaLetra {...props} letra={sola} tiempoFijoMs={5200} />)
    expect(a.container.querySelector('[data-insignia], [data-texto]')).toBeNull()
    expect(raiz(a.container).style.getPropertyValue('--k-ancho-linea')).toBe('')
    const n = nodo(a.container, 'a')
    expect(n.style.cssText).toContain('--k-resaltado-linea: #FFD400')
    expect(n.style.getPropertyValue('--k-color-linea')).toBe('')
    expect(n).toHaveTextContent(/^Nubes de sal\s*Nubes de sal$/)
  })
})

describe('dúo con Todos y coro', () => {
  const duo = cancionDosCantantes().letra!
  const dibujar = (t: number, extra = {}) =>
    render(<PantallaLetra {...props} letra={duo} tiempoFijoMs={t} {...extra} />)

  it('barre en el color de su parte, con su insignia y al 80 % de ancho', () => {
    const v = dibujar(5500).container
    expect(raiz(v).style.getPropertyValue('--k-ancho-linea')).toBe('80%')
    const color = (id: string) => nodo(v, id).style.getPropertyValue('--k-resaltado-linea')
    expect(color('d1')).toBe('#FFD400')
    expect(color('d2')).toBe('#35C6E8')
    expect(color('d3')).toBe('#B388FF')
    const marca = (id: string) => nodo(v, id).querySelector('[data-insignia]')?.textContent
    expect(marca('d1')).toBe('A')
    expect(marca('d2')).toBe('L')
    expect(marca('d3')).toBe('A·L')
    // El texto sin cantar sigue en el color de la letra: nadie lo tiñe.
    expect(nodo(v, 'd2').style.getPropertyValue('--k-color-linea')).toBe('')
  })

  it('el coro lleva paréntesis y no insignia; con paréntesis guardados no se duplican', () => {
    const v = dibujar(19_000).container
    const coro = nodo(v, 'd6')
    expect(coro.querySelector('[data-insignia]')).toBeNull()
    expect(coro).toHaveTextContent(/^\(Ya duerme la bahía\)/)
    expect(coro.style.getPropertyValue('--k-resaltado-linea')).toBe('#FF9F1C')
    const w = dibujar(15_000).container
    expect(nodo(w, 'd4').textContent).toContain('(Ah, ah, la marea)')
    expect(nodo(w, 'd4').textContent).not.toContain('((')
  })

  it('los indicadores de espera toman el color de la línea que viene', () => {
    // Hueco largo entre una línea de Ana y la primera de Luis.
    const hueco = {
      ...duo,
      lineas: [
        linea('h1', 'Cruza el faro la gaviota', 2000, { fin_ms: 4000 }),
        linea('h2', 'Responde el viento del sur', 15_000, { parte: 'c2' })
      ]
    }
    const v = render(<PantallaLetra {...props} letra={hueco} tiempoFijoMs={12_500} />).container
    const indicador = v.querySelector<HTMLElement>('[data-indicador]')!
    expect(indicador.style.getPropertyValue('--k-indicador')).toBe('#35C6E8')
  })

  it('Letra lista: el texto entero en el color de su parte, sin barrido', () => {
    const v = dibujar(5500, { barrido: false }).container
    expect(v.querySelector('[data-barrido]')).toBeNull()
    expect(nodo(v, 'd2').style.getPropertyValue('--k-color-linea')).toBe('#35C6E8')
    expect(nodo(v, 'd1').style.getPropertyValue('--k-color-linea')).toBe('#FFD400')
  })

  it('con palabras, «(» va con la primera y «)» con la última', () => {
    const palabras = [
      { texto: 'Ah', inicio_ms: 14_000, fin_ms: 15_000 },
      { texto: 'oh', inicio_ms: 15_000, fin_ms: 16_000 }
    ]
    const l = {
      ...duo,
      lineas: duo.lineas.map((x) =>
        x.id === 'd6'
          ? {
              ...x,
              texto: 'Ah oh',
              inicio_ms: 14_000,
              origen_palabras: 'manual' as const,
              palabras
            }
          : x.id === 'd4'
            ? { ...x, inicio_ms: 10_000 }
            : x
      )
    }
    const v = render(<PantallaLetra {...props} letra={l} tiempoFijoMs={14_500} />).container
    const partes = Array.from(
      nodo(v, 'd6').querySelectorAll('[data-barrido]'),
      (n) => n.firstChild!.textContent
    )
    expect(partes).toEqual(['(Ah', 'oh)'])
  })
})

describe('un cantante con coros', () => {
  const l = cancionUnCantanteConCoros().letra!
  it('sin insignias y al 88 %; solo el coro cambia de color y lleva paréntesis', () => {
    const v = render(<PantallaLetra {...props} letra={l} tiempoFijoMs={8500} />).container
    expect(v.querySelector('[data-insignia]')).toBeNull()
    expect(raiz(v).style.getPropertyValue('--k-ancho-linea')).toBe('')
    expect(nodo(v, 'u3').style.getPropertyValue('--k-resaltado-linea')).toBe('#FF9F1C')
    expect(nodo(v, 'u3').textContent).toContain('(Eco de la plaza vacía)')
    expect(nodo(v, 'u2').style.getPropertyValue('--k-resaltado-linea')).toBe('#FFD400')
    expect(nodo(v, 'u2').textContent).not.toContain('(')
  })

  it('Letra lista: solo las líneas de coro se tiñen', () => {
    const v = render(
      <PantallaLetra {...props} letra={l} tiempoFijoMs={8500} barrido={false} />
    ).container
    expect(nodo(v, 'u3').style.getPropertyValue('--k-color-linea')).toBe('#FF9F1C')
    expect(nodo(v, 'u2').style.getPropertyValue('--k-color-linea')).toBe('')
  })
})

// --- 0.2.3 · tarea 0364: zonas en pantalla ---

describe('zonas por parte', () => {
  const duo = cancionDosCantantes().letra!
  const zonasProps = { ...props, estilo: estiloPredeterminado(), letra: duo }
  const dibujar = (t: number, extra = {}) =>
    render(<PantallaLetra {...zonasProps} tiempoFijoMs={t} {...extra} />).container

  const centro = (n: HTMLElement) => parseFloat(n.style.getPropertyValue('--k-y'))
  const zona = (c: HTMLElement, id: string, linea: string) =>
    c.querySelector<HTMLElement>(`[data-zona=${id}][data-linea=${linea}]`)!

  it('cada línea se dibuja en su zona: el coro arriba y cada cantante debajo, sin moverse de sitio', () => {
    // clientHeight 720: coro y cantantes dentro del 12 %–86 %.
    const a = dibujar(5600)
    const b = dibujar(9000)
    const c1 = zona(a, 'c1', 'd3')
    const c2 = zona(a, 'c2', 'd2')
    expect(c1.dataset.zona).toBe('c1')
    expect(centro(c2)).toBeGreaterThan(centro(c1))
    for (const n of [c1, c2]) {
      expect(centro(n)).toBeGreaterThan(0.12 * 720)
      expect(centro(n)).toBeLessThan(0.86 * 720)
    }
    // Todos se repite en la zona de cada cantante, en el mismo sitio en dos instantes.
    expect(centro(zona(b, 'c1', 'd3'))).toBeCloseTo(centro(c1))
    expect(centro(zona(b, 'c2', 'd3'))).toBeGreaterThan(centro(zona(b, 'c1', 'd3')))
    expect(b.querySelectorAll('[data-linea=d3]')).toHaveLength(2)
  })

  it('la zona que no suena se atenúa al 55 % y la que suena queda al 100 %', () => {
    const v = dibujar(5600)
    const opacidad = (n: HTMLElement) => parseFloat(n.style.getPropertyValue('--k-opacidad'))
    expect(opacidad(zona(v, 'c2', 'd2'))).toBe(1)
    expect(opacidad(zona(v, 'c1', 'd3'))).toBeGreaterThanOrEqual(0.55)
    expect(opacidad(zona(v, 'c1', 'd3'))).toBeLessThan(1)
  })

  it('el tamaño de la zona viaja en --k-escala-zona y la insignia sigue a su línea', () => {
    const v = dibujar(5600)
    expect(zona(v, 'c2', 'd2').style.getPropertyValue('--k-escala-zona')).toBe('1')
    expect(zona(v, 'c2', 'd2').querySelector('[data-insignia]')?.textContent).toBe('L')
  })

  it('C1-R11: el instante fijo (video) y el reloj (reproductor) pintan lo mismo', () => {
    const vars = (c: HTMLElement) =>
      Array.from(c.querySelectorAll<HTMLElement>('[data-linea]'), (n) =>
        [
          n.dataset.zona,
          n.dataset.linea,
          n.dataset.copia,
          n.style.getPropertyValue('--k-y'),
          n.style.getPropertyValue('--k-escala'),
          n.style.getPropertyValue('--k-opacidad'),
          n.style.getPropertyValue('--k-escala-zona')
        ].join('|')
      )
    for (const t of [5600, 8100, 15_050]) {
      const fijo = vars(dibujar(t))
      const pendientes: FrameRequestCallback[] = []
      vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => pendientes.push(fn))
      vi.stubGlobal('cancelAnimationFrame', () => {})
      const vivo = render(<PantallaLetra {...zonasProps} obtenerTiempoAudio={() => t} />).container
      act(() => pendientes.shift()!(t))
      expect(vars(vivo)).toEqual(fijo)
      vi.unstubAllGlobals()
    }
  })

  it('con «Todas en un bloque» las líneas van en el bloque único, con colores, insignias y paréntesis', () => {
    const v = render(<PantallaLetra {...props} letra={duo} tiempoFijoMs={5600} />).container
    expect(
      Array.from(v.querySelectorAll<HTMLElement>('[data-linea]'), (n) => n.dataset.zona)
    ).toEqual(expect.arrayContaining(['todas']))
    expect(v.querySelectorAll('[data-zona]:not([data-zona=todas])')).toHaveLength(0)
  })

  it('la espera va en una fila de la zona de la próxima, sobre su texto y en el orden puntos · barra · cuenta', () => {
    const hueco = {
      ...duo,
      lineas: [
        linea('h1', 'Cruza el faro la gaviota', 2000, { fin_ms: 4000 }),
        linea('h2', 'Responde el viento del sur', 15_000, { parte: 'c2' as const })
      ]
    }
    const estilo = {
      ...zonasProps.estilo,
      espera: { puntos: true, barra: true, cuenta: true, primera_entrada: true, umbral_ms: 2000 }
    }
    const v = render(
      <PantallaLetra {...zonasProps} estilo={estilo} letra={hueco} tiempoFijoMs={12_500} />
    ).container
    const filas = v.querySelectorAll<HTMLElement>('[data-fila-espera]')
    expect(filas).toHaveLength(1)
    const fila = filas[0]!
    expect(Array.from(fila.children, (n) => (n as HTMLElement).dataset.indicador)).toEqual([
      'puntos',
      'barra',
      'cuenta'
    ])
    // Sobre el centro del primer renglón de la próxima (0,9 S ≈ 0,9 × 54 px a 720 de alto).
    const proxima = parseFloat(zona(v, 'c2', 'h2').style.getPropertyValue('--k-y'))
    const y = parseFloat(fila.style.getPropertyValue('--k-y'))
    expect(y).toBeLessThan(proxima - 0.6 * 54)
    expect(fila.style.getPropertyValue('--k-escala-zona')).toBe('1')
  })

  it('sin zonas los indicadores siguen donde estaban (sin fila)', () => {
    const hueco = {
      ...duo,
      lineas: [
        linea('h1', 'Cruza el faro la gaviota', 2000, { fin_ms: 4000 }),
        linea('h2', 'Responde el viento del sur', 15_000, { parte: 'c2' as const })
      ]
    }
    const estilo = {
      ...props.estilo,
      espera: { puntos: true, barra: true, cuenta: true, primera_entrada: true, umbral_ms: 2000 }
    }
    const v = render(
      <PantallaLetra {...props} estilo={estilo} letra={hueco} tiempoFijoMs={12_500} />
    ).container
    expect(v.querySelector('[data-fila-espera]')).toBeNull()
    expect(v.querySelector('[data-indicador=barra]')).not.toBeNull()
  })
})

describe('voces a la vez (0360)', () => {
  const voces = cancionVocesAlaVez().letra!
  const dibujar = (t: number) =>
    render(
      <PantallaLetra {...props} estilo={estiloPredeterminado()} letra={voces} tiempoFijoMs={t} />
    ).container
  const opacidad = (c: HTMLElement, zona: string, id: string) =>
    parseFloat(
      c
        .querySelector<HTMLElement>(`[data-zona=${zona}][data-linea=${id}]`)!
        .style.getPropertyValue('--k-opacidad')
    )

  it('C1S-R1: con tres voces a la vez, las tres zonas están al 100 % y no hay espera', () => {
    for (const t of [7900, 8000, 8200, 8400]) {
      const v = dibujar(t)
      expect(opacidad(v, 'coro', 'v4')).toBe(1)
      expect(opacidad(v, 'c1', 'v3')).toBe(1)
      expect(opacidad(v, 'c2', 'v2')).toBe(1)
      expect(v.querySelector('[data-fila-espera]')).toBeNull()
    }
  })

  it('con dos voces a la vez, cada una en su zona; la zona sin voz espera al 55 %', () => {
    const v = dibujar(5200)
    expect(opacidad(v, 'c1', 'v1')).toBe(1)
    expect(opacidad(v, 'c2', 'v2')).toBe(1)
    expect(opacidad(v, 'coro', 'v4')).toBeLessThan(1)
  })

  it('C1S-R4: durante el solape cada línea se pinta con el color exacto de su parte, como fuera de él', () => {
    const colores: Record<string, string> = {
      c1: '#FFD400',
      c2: '#35C6E8',
      coro: '#FF9F1C',
      todos: '#B388FF'
    }
    const parteDe: Record<string, string> = {
      v1: 'c1',
      v2: 'c2',
      v3: 'c1',
      v4: 'coro',
      v5: 'todos',
      v6: 'c2',
      v7: 'coro'
    }
    const sonando = (t: number) =>
      voces.lineas.filter((l) => l.inicio_ms! <= t && t < l.fin_ms!).map((l) => l.id)
    // Lo que pinta cada línea que suena: el color del barrido y que no se mezcla con el gris ni se atenúa.
    const pintado = (t: number) => {
      const v = dibujar(t)
      return sonando(t).flatMap((id) =>
        Array.from(v.querySelectorAll<HTMLElement>(`[data-linea=${id}]`), (n) => ({
          id,
          color: n.style.getPropertyValue('--k-resaltado-linea'),
          gris: n.style.getPropertyValue('--k-gris'),
          opacidad: n.style.getPropertyValue('--k-opacidad')
        }))
      )
    }
    // Diez instantes del solape (C1S-R1) y uno suelto de cada línea, sin solape.
    const solape = [4900, 5200, 5900, 7900, 8000, 8400, 16_900, 17_500, 18_500, 18_900]
    for (const t of [...solape, 3000, 13_000]) {
      const lineas = pintado(t)
      expect(lineas.length, `t=${t}`).toBeGreaterThan(0)
      for (const l of lineas) {
        expect(l.color, `${l.id} a ${t}`).toBe(colores[parteDe[l.id]!])
        expect(l.gris, `${l.id} a ${t}`).toBe('0')
        expect(l.opacidad, `${l.id} a ${t}`).toBe('1')
      }
    }
    // Y es el mismo valor que la línea tiene a solas.
    const ia = pintado(3000)[0]!
    const ib = pintado(5200).find((l) => l.id === 'v1')!
    expect([ib.color, ib.gris, ib.opacidad]).toEqual([ia.color, ia.gris, ia.opacidad])
  })
})
