import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { cancionDosCantantes, cancionUnCantanteConCoros } from '@shared/__fixtures__/reparto'
import { estiloPredeterminado } from '@shared/estilo'
import { PantallaLetra } from './PantallaLetra'

// 0.2.3 · tarea 0348: color por parte, insignia y paréntesis del coro (ADR 0029 §4).
const props = {
  estilo: estiloPredeterminado(),
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
