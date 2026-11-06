import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FUENTES_REGISTRO } from '@shared/fuentes'
import { SUGERIDOS_FONDO } from '../karaoke/colores'
import { SelectorColor } from './SelectorColor'
import { SelectorFuente } from './SelectorFuente'
import { DialAngulo } from './DialAngulo'
import { Deslizador } from './Deslizador'

describe('SelectorColor', () => {
  it('solo aplica hex válido, Escape restaura y los sugeridos tienen nombre', () => {
    const alCambiar = vi.fn()
    const { container } = render(
      <SelectorColor
        etiqueta="Fondo"
        valor="#1B1033"
        sugeridos={SUGERIDOS_FONDO}
        alCambiar={alCambiar}
      />
    )
    const campo = screen.getByRole('textbox', { name: 'Fondo' })
    fireEvent.change(campo, { target: { value: '#FFF' } })
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Usa el formato #RRGGBB.')).toBeVisible()
    expect(alCambiar).not.toHaveBeenCalled()
    fireEvent.keyDown(campo, { key: 'Escape' })
    expect(campo).toHaveValue('#1B1033')
    fireEvent.change(campo, { target: { value: '#abcdef' } })
    expect(alCambiar).toHaveBeenLastCalledWith('#ABCDEF', 'hex')
    const grupo = screen.getByRole('radiogroup', { name: 'Colores sugeridos de Fondo' })
    const radios = within(grupo).getAllByRole('radio')
    expect(radios).toHaveLength(8)
    fireEvent.keyDown(radios[1]!, { key: 'ArrowRight' })
    expect(alCambiar).toHaveBeenLastCalledWith('#5A1E6E', 'sugerido')
    const nativo = container.querySelector('input[type=color]')!
    fireEvent.input(nativo, { target: { value: '#112233' } })
    fireEvent.input(nativo, { target: { value: '#223344' } })
    expect(alCambiar).toHaveBeenNthCalledWith(3, '#112233', 'nativo')
    expect(alCambiar).toHaveBeenNthCalledWith(4, '#223344', 'nativo')
  })
})

describe('SelectorFuente', () => {
  it('renderiza cada familia en su peso y permite elegir con teclado', () => {
    const alCambiar = vi.fn()
    render(<SelectorFuente valor="Nunito" alCambiar={alCambiar} />)
    const boton = screen.getByRole('button', { name: 'Fuente: Nunito' })
    fireEvent.keyDown(boton, { key: 'ArrowDown' })
    const lista = screen.getByRole('listbox', { name: 'Fuente' })
    expect(lista).toHaveFocus()
    const opciones = within(lista).getAllByRole('option')
    expect(opciones).toHaveLength(8)
    opciones.forEach((opcion, i) => {
      expect(opcion).toHaveStyle({
        fontFamily: FUENTES_REGISTRO[i]!.familia,
        fontWeight: FUENTES_REGISTRO[i]!.peso
      })
      expect(opcion).toHaveTextContent('¿Cantamos? Ñandú')
    })
    fireEvent.keyDown(lista, { key: 'End' })
    expect(lista).toHaveAttribute('aria-activedescendant', opciones[7]!.id)
    fireEvent.keyDown(lista, { key: 'm' })
    fireEvent.keyDown(lista, { key: 'Enter' })
    expect(alCambiar).toHaveBeenCalledWith('Montserrat')
    expect(boton).toHaveFocus()
    fireEvent.click(boton)
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('SelectorFuente y scroll', () => {
  it('ignora un scroll ajeno que no mueve el botón y se cierra si lo mueve', () => {
    render(<SelectorFuente valor="Nunito" alCambiar={vi.fn()} />)
    const boton = screen.getByRole('button', { name: 'Fuente: Nunito' })
    let top = 100
    boton.getBoundingClientRect = () => ({ top, left: 10 }) as DOMRect
    fireEvent.click(boton)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.scroll(document.body)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    top = 60
    fireEvent.scroll(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('DialAngulo y Deslizador', () => {
  it('ajusta el ángulo con módulo y aplica los pasos de teclado', () => {
    const alCambiar = vi.fn()
    render(<DialAngulo valor={359} alCambiar={alCambiar} />)
    const campo = screen.getByRole('spinbutton', { name: 'Ángulo' })
    fireEvent.change(campo, { target: { value: '360' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(alCambiar).toHaveBeenLastCalledWith(0, { arrastrando: false })
    const dial = screen.getByRole('slider', { name: 'Dial de ángulo' })
    expect(dial).toHaveAttribute('aria-valuenow', '359')
    fireEvent.keyDown(dial, { key: 'ArrowRight' })
    expect(alCambiar).toHaveBeenLastCalledWith(14, { arrastrando: false })
    fireEvent.keyDown(dial, { key: 'ArrowLeft', shiftKey: true })
    expect(alCambiar).toHaveBeenLastCalledWith(358, { arrastrando: false })
  })

  it('el deslizador recorre el 5 % con cada flecha y expone el texto accesible', () => {
    const alCambiar = vi.fn()
    render(<Deslizador etiqueta="Volumen" valor={0.8} textoValor="80 %" alCambiar={alCambiar} />)
    const barra = screen.getByRole('slider', { name: 'Volumen' })
    expect(barra).toHaveAttribute('aria-valuetext', '80 %')
    fireEvent.keyDown(barra, { key: 'ArrowDown' })
    expect(alCambiar).toHaveBeenLastCalledWith(0.75)
    fireEvent.keyDown(barra, { key: 'ArrowRight' })
    expect(alCambiar).toHaveBeenLastCalledWith(0.85)
  })
})
