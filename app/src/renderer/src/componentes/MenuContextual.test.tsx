import { act, fireEvent, render, screen } from '@testing-library/react'
import { calcularPosicionMenu, MenuContextual } from './MenuContextual'
import { RETARDO_TOOLTIP_MS } from './Tooltip'

function montar(alElegir = vi.fn()) {
  render(
    <MenuContextual
      etiqueta="Más acciones"
      items={[
        { id: '1', etiqueta: 'Duplicar', alSeleccionar: alElegir },
        { id: '2', etiqueta: 'Renombrar', alSeleccionar: vi.fn() },
        { id: '3', etiqueta: 'Eliminar', destructivo: true, alSeleccionar: vi.fn() }
      ]}
    />
  )
  return screen.getByRole('button', { name: 'Más acciones' })
}

describe('MenuContextual', () => {
  it('se abre con clic, enfoca el primer ítem y expone aria-expanded', () => {
    const t = montar()
    expect(t).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(t)
    expect(t).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Duplicar' })).toHaveFocus()
  })

  it('flecha abajo en el botón abre el menú; ArrowUp abre en el último', () => {
    const t = montar()
    t.focus()
    fireEvent.keyDown(t, { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toHaveFocus()
  })

  it('las flechas navegan con vuelta, Inicio/Fin saltan', () => {
    const t = montar()
    fireEvent.click(t)
    const items = screen.getAllByRole('menuitem')
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' })
    expect(items[1]).toHaveFocus()
    fireEvent.keyDown(items[1]!, { key: 'End' })
    expect(items[2]).toHaveFocus()
    fireEvent.keyDown(items[2]!, { key: 'ArrowDown' })
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(items[0]!, { key: 'ArrowUp' })
    expect(items[2]).toHaveFocus()
  })

  it('Esc cierra y devuelve el foco al botón', () => {
    const t = montar()
    fireEvent.click(t)
    fireEvent.keyDown(screen.getAllByRole('menuitem')[1]!, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(t).toHaveFocus()
  })

  it('elegir un ítem ejecuta la acción y cierra', () => {
    const fn = vi.fn()
    const t = montar(fn)
    fireEvent.click(t)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicar' }))
    expect(fn).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(t).toHaveFocus()
  })

  it('el ítem destructivo tiene la clase de error', () => {
    fireEvent.click(montar())
    expect(screen.getByRole('menuitem', { name: 'Eliminar' }).className).toMatch(/itemDestructivo/)
  })

  it('clic fuera cierra', () => {
    fireEvent.click(montar())
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('MenuContextual en portal', () => {
  const rect = (r: Partial<DOMRect>) =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON: () => ({}),
      ...r
    }) as DOMRect

  function conGeometria(disp: Partial<DOMRect>, altoViewport: number) {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(altoViewport)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      return this.getAttribute('role') === 'menu' ? rect({ width: 192, height: 120 }) : rect(disp)
    })
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(120)
  }
  afterEach(() => vi.restoreAllMocks())

  it('se pinta en document.body, fuera de la tarjeta', () => {
    const t = montar()
    fireEvent.click(t)
    const menu = screen.getByRole('menu')
    expect(menu.parentElement).toBe(document.body)
    expect(t).toHaveAttribute('aria-controls', menu.id)
  })

  it('se abre hacia abajo si cabe', () => {
    conGeometria({ top: 100, bottom: 136, right: 500, left: 464 }, 600)
    fireEvent.click(montar())
    const { top, left } = screen.getByRole('menu').style
    expect(parseFloat(top)).toBeCloseTo(140) // bottom + e-1 (4 px de respaldo)
    expect(parseFloat(left)).toBe(500 - 192)
  })

  it('se abre hacia arriba si no cabe debajo', () => {
    conGeometria({ top: 540, bottom: 576, right: 500, left: 464 }, 600)
    fireEvent.click(montar())
    expect(parseFloat(screen.getByRole('menu').style.top)).toBeCloseTo(540 - 4 - 120)
  })

  it('el menú no se sale por la izquierda', () => {
    conGeometria({ top: 100, bottom: 136, right: 50, left: 14 }, 600)
    fireEvent.click(montar())
    expect(parseFloat(screen.getByRole('menu').style.left)).toBe(8)
  })

  it('se cierra con resize, desplazamiento fuera del menú y pérdida de foco de la ventana', () => {
    for (const cerrar of [
      () => window.dispatchEvent(new Event('resize')),
      () => document.body.dispatchEvent(new Event('scroll')),
      () => window.dispatchEvent(new Event('blur'))
    ]) {
      const { unmount } = render(
        <MenuContextual etiqueta="X" items={[{ id: 'a', etiqueta: 'A', alSeleccionar: vi.fn() }]} />
      )
      fireEvent.click(screen.getByRole('button', { name: 'X' }))
      expect(screen.getByRole('menu')).toBeTruthy()
      act(() => cerrar())
      expect(screen.queryByRole('menu')).toBeNull()
      unmount()
    }
  })

  it('desplazar dentro del propio menú no lo cierra', () => {
    fireEvent.click(montar())
    fireEvent.scroll(screen.getByRole('menu'))
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('oculta el tooltip del disparador al abrir y no lo vuelve a mostrar hasta reentrar', () => {
    vi.useFakeTimers()
    try {
      const t = montar()
      fireEvent.mouseEnter(t.parentElement!)
      act(() => void vi.advanceTimersByTime(RETARDO_TOOLTIP_MS))
      expect(screen.getByRole('tooltip')).toBeTruthy()
      fireEvent.click(t)
      expect(screen.queryByRole('tooltip')).toBeNull()
      fireEvent.mouseDown(document.body) // cierra sin devolver el foco al disparador
      expect(screen.queryByRole('tooltip')).toBeNull()
      fireEvent.mouseLeave(t.parentElement!)
      fireEvent.mouseEnter(t.parentElement!)
      act(() => void vi.advanceTimersByTime(RETARDO_TOOLTIP_MS))
      expect(screen.getByRole('tooltip')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('las teclas dentro del menú no reabren ni reenfocan desde el disparador', () => {
    fireEvent.click(montar())
    const items = screen.getAllByRole('menuitem')
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' })
    fireEvent.keyDown(items[1]!, { key: 'ArrowDown' })
    expect(items[2]).toHaveFocus()
  })
})

describe('calcularPosicionMenu', () => {
  const disp = { top: 300, bottom: 336, right: 500 }
  const menu = { width: 192, height: 200 }
  it('sin espacio arriba ni abajo usa el lado con más y limita la altura', () => {
    const p = calcularPosicionMenu(
      disp,
      { width: 192, height: 400 },
      { width: 1000, height: 640 },
      8,
      4
    )
    expect(p.maxHeight).toBeDefined()
    expect(p.top + p.maxHeight!).toBeLessThanOrEqual(640 - 8)
    expect(p.top).toBeGreaterThanOrEqual(8)
  })
  it('abajo cuando cabe', () => {
    expect(calcularPosicionMenu(disp, menu, { width: 1000, height: 800 }, 8, 4)).toEqual({
      top: 340,
      left: 308,
      maxHeight: undefined
    })
  })
})

it('busca por letra sin distinguir mayúsculas ni acentos y cicla entre coincidencias', () => {
  render(
    <MenuContextual
      etiqueta="Opciones"
      items={[
        { id: 'a', etiqueta: 'Álbum', alSeleccionar: () => {} },
        { id: 'b', etiqueta: 'Añadir', alSeleccionar: () => {} },
        { id: 'c', etiqueta: 'Editar', alSeleccionar: () => {} }
      ]}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Opciones' }))
  const primero = screen.getByRole('menuitem', { name: 'Álbum' })
  const segundo = screen.getByRole('menuitem', { name: 'Añadir' })
  expect(primero).toHaveFocus()
  fireEvent.keyDown(primero, { key: 'A' })
  expect(segundo).toHaveFocus()
  fireEvent.keyDown(segundo, { key: 'á' })
  expect(primero).toHaveFocus()
})
