import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  VentanaFlotante,
  type VentanaFlotanteApi,
  type VentanaFlotanteProps
} from './VentanaFlotante'

const limites = { left: 0, top: 48, width: 1366, height: 600 }
const lista = { left: 0, top: 48, width: 300, height: 500 }

function montar(extra: Partial<VentanaFlotanteProps> = {}) {
  const alCambiarPreferencia = vi.fn()
  const alSalirDelFoco = vi.fn()
  const ref = createRef<VentanaFlotanteApi>()
  const props: VentanaFlotanteProps = {
    titulo: 'Editor preciso',
    botones: <button type="button">Cerrar</button>,
    limites,
    referencia: lista,
    alCambiarPreferencia,
    alSalirDelFoco,
    ref,
    children: (
      <>
        <button type="button">Uno</button>
        <button type="button">Dos</button>
      </>
    ),
    ...extra
  }
  const r = render(<VentanaFlotante {...props} />)
  return { ...r, props, alCambiarPreferencia, alSalirDelFoco, ref }
}
const ventana = () => screen.getByRole('dialog')

afterEach(() => vi.useRealTimers())

it('es un diálogo no modal con el título como nombre, 760 × 440 junto a la lista', () => {
  montar()
  const v = ventana()
  expect(v).toHaveAttribute('aria-modal', 'false')
  expect(v).toHaveAccessibleName('Editor preciso')
  expect(v).toHaveAttribute('data-ventana-flotante')
  expect(v.style.width).toBe('760px')
  expect(v.style.height).toBe('440px')
  expect(v.style.left).toBe('312px')
  expect(v.style.top).toBe('60px')
})

it('con un tamaño recomendado se abre a ese tamaño y lo recorta al área si no cabe', () => {
  const { unmount } = montar({ tamanoRecomendadoRem: { ancho: 60, alto: 30 } })
  expect(ventana().style.width).toBe('960px')
  expect(ventana().style.height).toBe('480px')
  unmount()
  montar({ tamanoRecomendadoRem: { ancho: 60, alto: 40 } })
  // El área mide 600 px de alto: 600 − 16 por lado.
  expect(ventana().style.height).toBe('568px')
})

it('Tab cicla dentro de la ventana y un clic fuera no la cierra', () => {
  montar()
  const asa = screen.getByRole('button', { name: 'Cambiar el tamaño de la ventana' })
  const mover = screen.getByRole('button', { name: 'Mover la ventana' })
  asa.focus()
  fireEvent.keyDown(asa, { key: 'Tab' })
  expect(mover).toHaveFocus()
  fireEvent.keyDown(mover, { key: 'Tab', shiftKey: true })
  expect(asa).toHaveFocus()
  fireEvent.pointerDown(document.body)
  expect(ventana()).toBeInTheDocument()
})

it('F6 llama a alSalirDelFoco y, desde fuera, devuelve el foco al último elemento interno', () => {
  const { alSalirDelFoco } = montar()
  const dos = screen.getByRole('button', { name: 'Dos' })
  dos.focus()
  fireEvent.keyDown(dos, { key: 'F6' })
  expect(alSalirDelFoco).toHaveBeenCalledTimes(1)
  ;(document.activeElement as HTMLElement).blur()
  fireEvent.keyDown(document.body, { key: 'F6', shiftKey: true })
  expect(dos).toHaveFocus()
})

it('F6 no actúa con un diálogo modal abierto', () => {
  const { alSalirDelFoco } = montar()
  const modal = document.createElement('div')
  modal.setAttribute('aria-modal', 'true')
  document.body.append(modal)
  fireEvent.keyDown(document.body, { key: 'F6' })
  modal.remove()
  expect(alSalirDelFoco).not.toHaveBeenCalled()
})

it('las flechas sobre el asa mueven 16 px (Mayús 64), Inicio restablece y se guarda tras la ráfaga', () => {
  vi.useFakeTimers()
  const { alCambiarPreferencia } = montar()
  const asa = screen.getByRole('button', { name: 'Mover la ventana' })
  fireEvent.keyDown(asa, { key: 'ArrowRight' })
  fireEvent.keyDown(asa, { key: 'ArrowDown', shiftKey: true })
  expect(ventana().style.left).toBe('328px')
  expect(ventana().style.top).toBe('124px')
  expect(alCambiarPreferencia).not.toHaveBeenCalled()
  act(() => void vi.advanceTimersByTime(500))
  expect(alCambiarPreferencia).toHaveBeenCalledTimes(1)
  expect(alCambiarPreferencia).toHaveBeenCalledWith({ x: 328, y: 76, ancho: 760, alto: 440 })
  fireEvent.keyDown(asa, { key: 'Home' })
  expect(ventana().style.left).toBe('312px')
})

it('las flechas sobre el asa de tamaño lo cambian entre mínimo y máximo', () => {
  montar()
  const asa = screen.getByRole('button', { name: 'Cambiar el tamaño de la ventana' })
  fireEvent.keyDown(asa, { key: 'ArrowRight', shiftKey: true })
  expect(ventana().style.width).toBe('824px')
  for (let i = 0; i < 20; i++) fireEvent.keyDown(asa, { key: 'ArrowLeft', shiftKey: true })
  expect(ventana().style.width).toBe('560px')
})

it('arrastrar la barra mueve la ventana, la deja dentro del área y guarda al soltar', () => {
  const { alCambiarPreferencia } = montar()
  const barra = ventana().querySelector<HTMLElement>('[data-barra-titulo]')!
  fireEvent.pointerDown(barra, { pointerId: 1, button: 0, clientX: 500, clientY: 100 })
  fireEvent.pointerMove(barra, { pointerId: 1, clientX: 540, clientY: 130 })
  expect(ventana().style.left).toBe('352px')
  expect(ventana().style.top).toBe('90px')
  fireEvent.pointerMove(barra, { pointerId: 1, clientX: 5000, clientY: 5000 })
  expect(ventana().style.left).toBe('606px')
  expect(ventana().style.top).toBe('208px')
  expect(alCambiarPreferencia).not.toHaveBeenCalled()
  fireEvent.pointerUp(barra, { pointerId: 1 })
  expect(alCambiarPreferencia).toHaveBeenCalledWith({ x: 606, y: 160, ancho: 760, alto: 440 })
})

it('Esc cancela el arrastre y los botones de la ranura no arrastran', () => {
  const { alCambiarPreferencia } = montar()
  const barra = ventana().querySelector<HTMLElement>('[data-barra-titulo]')!
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Cerrar' }), {
    pointerId: 2,
    button: 0,
    clientX: 0,
    clientY: 0
  })
  fireEvent.pointerMove(barra, { pointerId: 2, clientX: 50, clientY: 50 })
  expect(ventana().style.left).toBe('312px')
  fireEvent.pointerDown(barra, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(barra, { pointerId: 1, clientX: 50, clientY: 0 })
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(ventana().style.left).toBe('312px')
  fireEvent.pointerUp(barra, { pointerId: 1 })
  expect(alCambiarPreferencia).not.toHaveBeenCalled()
})

it('el doble clic en la barra restablece posición y tamaño', () => {
  const { alCambiarPreferencia } = montar({ preferencia: { x: 50, y: 50, ancho: 600, alto: 400 } })
  expect(ventana().style.left).toBe('50px')
  fireEvent.doubleClick(ventana().querySelector('[data-barra-titulo]')!)
  expect(ventana().style.left).toBe('312px')
  expect(alCambiarPreferencia).toHaveBeenCalledWith({ x: 312, y: 12, ancho: 760, alto: 440 })
})

it('una preferencia que no cabe se dibuja recolocada sin llamar a alCambiarPreferencia', () => {
  const { alCambiarPreferencia } = montar({
    preferencia: { x: 1300, y: 500, ancho: 760, alto: 440 }
  })
  expect(ventana().style.left).toBe('606px')
  expect(ventana().style.top).toBe('208px')
  expect(alCambiarPreferencia).not.toHaveBeenCalled()
})

it('por debajo del mínimo ocupa el área menos 16 px por lado y no se mueve', () => {
  const { alCambiarPreferencia } = montar({
    limites: { left: 0, top: 48, width: 500, height: 300 }
  })
  const v = ventana()
  expect([v.style.left, v.style.top, v.style.width, v.style.height]).toEqual([
    '16px',
    '64px',
    '468px',
    '268px'
  ])
  fireEvent.keyDown(screen.getByRole('button', { name: 'Mover la ventana' }), { key: 'ArrowRight' })
  expect(v.style.left).toBe('16px')
  expect(alCambiarPreferencia).not.toHaveBeenCalled()
})
