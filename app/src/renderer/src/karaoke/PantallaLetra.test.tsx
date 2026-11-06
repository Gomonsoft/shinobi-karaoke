import { act, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
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

afterEach(() => vi.unstubAllGlobals())

it('muestra la línea seleccionada a la mitad y aplica el estilo', () => {
  const { container } = render(<PantallaLetra {...props} reproduciendo={false} idEstatico="b" />)
  const pantalla = container.firstElementChild as HTMLElement
  expect(pantalla).toHaveAttribute('aria-hidden', 'true')
  expect(pantalla.style.getPropertyValue('--k-resaltado')).toBe('#FFD400')
  expect(pantalla.style.getPropertyValue('--k-fuente')).toBe('"Atkinson Hyperlegible Next"')
  const linea = container.querySelector<HTMLElement>('[data-linea=b]')
  expect(linea).toHaveTextContent('Cantan al viento')
  expect(linea?.style.getPropertyValue('--progreso')).toBe('50%')
})

it.each([false, true])(
  'actualiza texto y barrido al ritmo del audio (movimiento reducido %s)',
  (reducido) => {
    vi.stubGlobal('matchMedia', () => ({ matches: reducido }))
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
    expect(nodoA?.style.getPropertyValue('--progreso')).toBe('0%')
    ms = 4000
    siguiente()
    expect(container.querySelector('[data-linea=a]')).toBe(nodoA)
    expect(nodoA?.style.getPropertyValue('--progreso')).toBe('50%')
    ms = 6100
    siguiente()
    const nodoB = container.querySelector<HTMLElement>('[data-linea=b]')
    expect(nodoB).toHaveTextContent('Cantan al viento')
    expect(nodoB?.classList.contains(estilos.transicion!)).toBe(!reducido)
    unmount()
    expect(cancelar).toHaveBeenCalledOnce()
    expect(pendientes.size).toBe(0)
  }
)
