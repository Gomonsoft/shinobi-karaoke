import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { estiloPredeterminado } from '@shared/estilo'
import { PantallaLetra } from './PantallaLetra'
import estilos from './pantallaLetra.module.css'

const l = letra([linea('a', 'Nubes de sal', 2000), linea('b', 'Cantan al viento', 6000)])
const props = {
  letra: l,
  estilo: estiloPredeterminado(),
  titulo: 'Inventada',
  artista: 'Shinobi',
  duracionMs: 30_000
}

let cajas: DOMRect[]

beforeEach(() => {
  cajas = [new DOMRect(0, 0, 120, 20), new DOMRect(30, 24, 60, 20)]
  vi.spyOn(document, 'createRange').mockImplementation(
    () =>
      ({
        selectNodeContents: vi.fn(),
        getClientRects: () => cajas
      }) as unknown as Range
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, 120, 44)
  )
  const obtenerEstilo = window.getComputedStyle
  vi.stubGlobal('getComputedStyle', (nodo: Element) => {
    const estilo = obtenerEstilo(nodo)
    estilo.width = '120px'
    return estilo
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function recorte(nodo: ParentNode | null): string | undefined {
  return nodo?.querySelector<HTMLElement>(`.${estilos.resaltado}`)?.style.clipPath
}

it('muestra la línea seleccionada a la mitad y aplica el estilo', () => {
  const { container } = render(<PantallaLetra {...props} reproduciendo={false} idEstatico="b" />)
  const pantalla = container.firstElementChild as HTMLElement
  expect(pantalla).toHaveAttribute('aria-hidden', 'true')
  expect(pantalla.style.getPropertyValue('--k-resaltado')).toBe('#FFD400')
  expect(pantalla.style.getPropertyValue('--k-fuente')).toBe('"Atkinson Hyperlegible Next"')
  const linea = container.querySelector<HTMLElement>('[data-linea=b]')
  expect(linea).toHaveTextContent('Cantan al viento')
  expect(recorte(linea)).toContain('90px 0px')
  expect(recorte(linea)).not.toContain('24px')
})

it('muestra el aviso y el spinner de 24 px solo junto al título', () => {
  const aviso = 'Falta 1 línea por sincronizar: no se verá.'
  const textoCargando = 'Cargando…'
  const letraConTitulo = letra([linea('a', 'Nubes de sal', 8000)])
  const { container, rerender, getByText, queryByText } = render(
    <PantallaLetra
      {...props}
      letra={letraConTitulo}
      reproduciendo
      avisoTitulo={aviso}
      textoCargando={textoCargando}
    />
  )
  expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  expect(getByText(aviso)).toHaveTextContent(`⚠ ${aviso}`)
  expect(queryByText(textoCargando)).not.toBeInTheDocument()

  rerender(
    <PantallaLetra
      {...props}
      letra={letraConTitulo}
      reproduciendo
      avisoTitulo={aviso}
      cargando
      textoCargando={textoCargando}
    />
  )
  const spinner = getByText(textoCargando).querySelector('svg')
  expect(spinner).toHaveAttribute('width', '24')
  expect(spinner).toHaveAttribute('height', '24')

  rerender(
    <PantallaLetra
      {...props}
      reproduciendo
      avisoTitulo={aviso}
      cargando
      textoCargando={textoCargando}
    />
  )
  expect(queryByText(aviso)).not.toBeInTheDocument()
  expect(queryByText(textoCargando)).not.toBeInTheDocument()
})

it.each([false, true])(
  'actualiza texto y barrido al ritmo del audio (movimiento reducido %s)',
  (reducido) => {
    vi.stubGlobal('matchMedia', () => ({ matches: reducido }))
    const fuentes = new EventTarget()
    const observar = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(medir: () => void) {
          redimensionar = medir
        }
        observe = observar
        disconnect(): void {}
      }
    )
    let redimensionar: () => void
    Object.defineProperty(document, 'fonts', { configurable: true, value: fuentes })
    const pendientes = new Map<number, FrameRequestCallback>()
    let id = 0
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      pendientes.set(++id, fn)
      return id
    })
    const cancelar = vi.fn((id: number) => pendientes.delete(id))
    vi.stubGlobal('cancelAnimationFrame', cancelar)
    let ms = 2000
    const reloj = () => ms
    const siguiente = () => {
      const [id, fn] = [...pendientes][0]!
      pendientes.delete(id)
      act(() => fn(ms))
    }
    const { container, unmount } = render(
      <PantallaLetra {...props} reproduciendo obtenerTiempoAudio={reloj} />
    )
    siguiente()
    const nodoA = container.querySelector<HTMLElement>('[data-linea=a]')
    expect(recorte(nodoA)).toBe('inset(100%)')
    ms = 4000
    siguiente()
    expect(container.querySelector('[data-linea=a]')).toBe(nodoA)
    expect(recorte(nodoA)).toContain('90px 0px')
    expect(recorte(nodoA)).not.toContain('24px')

    // El texto puede cambiar de disposición con el mismo tamaño exterior de la pantalla.
    expect(observar).toHaveBeenCalledWith(nodoA)
    cajas = [new DOMRect(0, 0, 80, 20), new DOMRect(0, 24, 120, 20)]
    redimensionar!()
    expect(recorte(nodoA)).toContain('20px 24px')
    cajas = [new DOMRect(0, 0, 100, 20)]
    fuentes.dispatchEvent(new Event('loadingdone'))
    expect(recorte(nodoA)).toContain('50px 0px')
    expect(recorte(nodoA)).not.toContain('24px')

    ms = 6100
    siguiente()
    const nodoB = container.querySelector<HTMLElement>('[data-linea=b]')
    expect(nodoB).toHaveTextContent('Cantan al viento')
    expect(nodoB?.classList.contains(estilos.transicion!)).toBe(!reducido)
    unmount()
    expect(cancelar).toHaveBeenCalledOnce()
    expect(pendientes.size).toBe(0)
    Reflect.deleteProperty(document, 'fonts')
  }
)

it('reparte el avance de una palabra partida dentro de su propia ventana', () => {
  const lineaPorPalabras = {
    ...linea('a', 'Larguísima una palabra', 2000),
    palabras: [
      { texto: 'Larguísima', inicio_ms: 2000, fin_ms: 3000 },
      { texto: 'una', inicio_ms: 3000, fin_ms: 4000 },
      { texto: 'palabra', inicio_ms: 4000, fin_ms: 5000 }
    ]
  }
  const { container } = render(
    <PantallaLetra {...props} letra={letra([lineaPorPalabras])} reproduciendo={false} />
  )
  const [primera, segunda, tercera] = container.querySelectorAll('[data-barrido]')
  expect(recorte(primera!)).toContain('90px 24px')
  expect(recorte(segunda!)).toContain('90px 0px')
  expect(recorte(segunda!)).not.toContain('24px')
  expect(recorte(tercera!)).toBe('inset(100%)')
})
