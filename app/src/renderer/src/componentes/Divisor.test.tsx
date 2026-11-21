import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { preferenciasPanelesPredeterminadas } from '@shared/paneles'
import { aplicarArrastre, aplicarTecla, calcularDistribucion } from '../vistas/editor/distribucion'
import { Divisor, ATRIBUTO_ARRASTRE_DIVISOR, type DivisorProps } from './Divisor'

/** Distribución real a 1280 × 720: lista 300 (min 256), panel 360 y línea de tiempo 204. */
const d = calcularDistribucion({
  medidas: { ancho: 1248, alto: 664, altoCabecera: 48, altoTransporte: 80 },
  preferencias: preferenciasPanelesPredeterminadas(),
  pestana: 'sincronia',
  sincronizando: false
})
function montar(extra: Partial<DivisorProps> = {}) {
  const alCambiar = vi.fn()
  const alConfirmar = vi.fn()
  const alRestablecer = vi.fn()
  const alAlternar = vi.fn()
  const props: DivisorProps = {
    nombre: 'lista',
    orientacion: 'vertical',
    controla: 'zona-lista',
    etiqueta: 'Ancho de la lista de líneas',
    valor: d.lista.ancho,
    min: d.lista.min,
    max: d.lista.max,
    minimizado: false,
    textoValor: `${d.lista.ancho} píxeles`,
    tooltip: 'Arrastra para cambiar el tamaño. Doble clic: tamaño original.',
    alTecla: (tecla, mayus) => aplicarTecla(d, 'lista', tecla, mayus),
    alArrastre: (inicio, delta) => aplicarArrastre(d, 'lista', inicio, delta),
    alCambiar,
    alConfirmar,
    alRestablecer,
    alAlternar,
    ...extra
  }
  render(<Divisor {...props} />)
  return {
    separador: screen.getByRole('separator'),
    alCambiar,
    alConfirmar,
    alRestablecer,
    alAlternar
  }
}

/** Fotogramas pendientes: el tamaño en vivo se aplica en el siguiente fotograma tras cada `pointermove`. */
let fotogramas: FrameRequestCallback[] = []
const fotograma = () => {
  const pendientes = fotogramas
  fotogramas = []
  act(() => pendientes.forEach((cb) => cb(0)))
}
const mover = (el: HTMLElement, x: number, y = 100) => {
  fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: y })
  fotograma()
}

beforeEach(() => {
  fotogramas = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => fotogramas.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {
    fotogramas = []
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('expone los atributos ARIA del patrón Window Splitter con los px efectivos', () => {
  const { separador } = montar()
  expect(separador).toHaveAttribute('aria-orientation', 'vertical')
  expect(separador).toHaveAttribute('aria-controls', 'zona-lista')
  expect(separador).toHaveAttribute('aria-label', 'Ancho de la lista de líneas')
  expect(separador).toHaveAttribute('aria-valuenow', '300')
  expect(separador).toHaveAttribute('aria-valuemin', '256')
  expect(separador).toHaveAttribute('aria-valuemax', String(d.lista.max))
  expect(separador).toHaveAttribute('aria-valuetext', '300 píxeles')
  expect(separador).toHaveAttribute('tabindex', '0')
})

it('las flechas de su eje cambian 16 px y con Mayús 64 px, en el sentido de la tabla', () => {
  const { separador, alCambiar } = montar()
  fireEvent.keyDown(separador, { key: 'ArrowRight' })
  expect(alCambiar).toHaveBeenLastCalledWith(316, 'teclado')
  fireEvent.keyDown(separador, { key: 'ArrowLeft' })
  expect(alCambiar).toHaveBeenLastCalledWith(284, 'teclado')
  fireEvent.keyDown(separador, { key: 'ArrowRight', shiftKey: true })
  expect(alCambiar).toHaveBeenLastCalledWith(364, 'teclado')
  fireEvent.keyDown(separador, { key: 'ArrowLeft', shiftKey: true })
  expect(alCambiar).toHaveBeenLastCalledWith(256, 'teclado')
})

it('Inicio y Fin llevan al mínimo y al máximo efectivos', () => {
  const { separador, alCambiar } = montar()
  fireEvent.keyDown(separador, { key: 'Home' })
  expect(alCambiar).toHaveBeenLastCalledWith(d.lista.min, 'teclado')
  fireEvent.keyDown(separador, { key: 'End' })
  expect(alCambiar).toHaveBeenLastCalledWith(d.lista.max, 'teclado')
})

it('las flechas del otro eje se consumen sin efecto y no llegan a los atajos', () => {
  const { separador, alCambiar, alAlternar } = montar()
  const alPadre = vi.fn()
  document.addEventListener('keydown', alPadre)
  for (const key of ['ArrowUp', 'ArrowDown']) {
    const permitido = fireEvent.keyDown(separador, { key })
    expect(permitido).toBe(false)
  }
  expect(alCambiar).not.toHaveBeenCalled()
  expect(alAlternar).not.toHaveBeenCalled()
  expect(alPadre).not.toHaveBeenCalled()
  document.removeEventListener('keydown', alPadre)
})

it('Intro alterna y Espacio no se consume', () => {
  const { separador, alAlternar } = montar()
  fireEvent.keyDown(separador, { key: 'Enter' })
  expect(alAlternar).toHaveBeenCalledOnce()
  expect(fireEvent.keyDown(separador, { key: ' ' })).toBe(true)
})

const dMin = calcularDistribucion({
  medidas: { ancho: 1248, alto: 664, altoCabecera: 48, altoTransporte: 80 },
  preferencias: {
    ...preferenciasPanelesPredeterminadas(),
    lista: { ancho: 300, minimizado: true }
  },
  pestana: 'sincronia',
  sincronizando: false
})

it('minimizado, una flecha que agranda expande desde el mínimo y la que reduce no hace nada', () => {
  const { separador, alCambiar } = montar({
    valor: 72,
    minimizado: true,
    textoValor: 'Minimizada',
    alTecla: (tecla, mayus) => aplicarTecla(dMin, 'lista', tecla, mayus)
  })
  expect(separador).toHaveAttribute('aria-valuetext', 'Minimizada')
  expect(separador).toHaveAttribute('aria-valuenow', '256')
  fireEvent.keyDown(separador, { key: 'ArrowLeft' })
  expect(alCambiar).not.toHaveBeenCalled()
  fireEvent.keyDown(separador, { key: 'ArrowRight' })
  expect(alCambiar).toHaveBeenCalledWith(272, 'teclado')
})

function arrastrar(separador: HTMLElement, hasta: number) {
  fireEvent.pointerDown(separador, { pointerId: 1, button: 0, clientX: 300, clientY: 100 })
  mover(separador, hasta)
}

it('arrastrar cambia el tamaño en vivo, se detiene en los límites y confirma una vez al soltar', () => {
  const { separador, alCambiar, alConfirmar } = montar()
  arrastrar(separador, 340)
  expect(alCambiar).toHaveBeenLastCalledWith(340, 'arrastre')
  expect(separador).toHaveAttribute('aria-valuenow', '340')
  expect(document.body.dataset[ATRIBUTO_ARRASTRE_DIVISOR]).toBe('col')
  mover(separador, 5000)
  expect(alCambiar).toHaveBeenLastCalledWith(d.lista.max, 'arrastre')
  mover(separador, -5000)
  expect(alCambiar).toHaveBeenLastCalledWith(d.lista.min, 'arrastre')
  expect(alConfirmar).not.toHaveBeenCalled()
  fireEvent.pointerUp(separador, { pointerId: 1, clientX: -5000, clientY: 100 })
  expect(alConfirmar).toHaveBeenCalledExactlyOnceWith(d.lista.min)
  expect(document.body.dataset[ATRIBUTO_ARRASTRE_DIVISOR]).toBeUndefined()
})

it('Esc durante el arrastre lo cancela y devuelve el tamaño previo sin confirmar', () => {
  const { separador, alCambiar, alConfirmar } = montar()
  arrastrar(separador, 400)
  expect(alCambiar).toHaveBeenLastCalledWith(400, 'arrastre')
  const permitido = fireEvent.keyDown(window, { key: 'Escape' })
  expect(permitido).toBe(false)
  expect(alCambiar).toHaveBeenLastCalledWith(300, 'arrastre')
  // Soltar después ya no confirma nada.
  fireEvent.lostPointerCapture(separador, { pointerId: 1 })
  expect(alConfirmar).not.toHaveBeenCalled()
  expect(document.body.dataset[ATRIBUTO_ARRASTRE_DIVISOR]).toBeUndefined()
})

it('perder la captura confirma el último tamaño; un clic sin mover no confirma nada', () => {
  const { separador, alConfirmar } = montar()
  arrastrar(separador, 350)
  fireEvent.lostPointerCapture(separador, { pointerId: 1 })
  expect(alConfirmar).toHaveBeenCalledExactlyOnceWith(350)
  alConfirmar.mockClear()
  fireEvent.pointerDown(separador, { pointerId: 2, button: 0, clientX: 300, clientY: 100 })
  fireEvent.pointerUp(separador, { pointerId: 2, clientX: 300, clientY: 100 })
  expect(alConfirmar).not.toHaveBeenCalled()
})

it('desde el estado minimizado el arrastre parte del mínimo', () => {
  const { separador, alCambiar, alConfirmar } = montar({
    valor: 72,
    minimizado: true,
    alArrastre: (inicio, delta) => aplicarArrastre(dMin, 'lista', inicio, delta)
  })
  fireEvent.pointerDown(separador, { pointerId: 1, button: 0, clientX: 80, clientY: 100 })
  mover(separador, 120)
  expect(alCambiar).toHaveBeenLastCalledWith(d.lista.min + 40, 'arrastre')
  fireEvent.pointerUp(separador, { pointerId: 1, clientX: 120, clientY: 100 })
  expect(alConfirmar).toHaveBeenCalledWith(d.lista.min + 40)
})

it('el doble clic restablece', () => {
  const { separador, alRestablecer } = montar()
  fireEvent.doubleClick(separador)
  expect(alRestablecer).toHaveBeenCalledOnce()
})

it('el tooltip aparece a los 500 ms de hover y desaparece al salir', () => {
  vi.useFakeTimers()
  const { separador } = montar()
  fireEvent.mouseEnter(separador)
  act(() => vi.advanceTimersByTime(499))
  expect(screen.queryByRole('tooltip')).toBeNull()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'Arrastra para cambiar el tamaño. Doble clic: tamaño original.'
  )
  fireEvent.mouseLeave(separador)
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('el divisor horizontal usa el eje vertical y ↑ agranda', () => {
  const dock = d.lineaTiempo
  const { separador, alCambiar } = montar({
    nombre: 'dock',
    orientacion: 'horizontal',
    valor: dock.alto,
    min: dock.min,
    max: dock.max,
    alTecla: (t, m) => aplicarTecla(d, 'dock', t, m),
    alArrastre: (i, delta) => aplicarArrastre(d, 'dock', i, delta)
  })
  expect(separador).toHaveAttribute('aria-orientation', 'horizontal')
  fireEvent.keyDown(separador, { key: 'ArrowUp' })
  expect(alCambiar).toHaveBeenLastCalledWith(dock.alto + 16, 'teclado')
  expect(fireEvent.keyDown(separador, { key: 'ArrowLeft' })).toBe(false)
  expect(alCambiar).toHaveBeenCalledTimes(1)
  fireEvent.pointerDown(separador, { pointerId: 1, button: 0, clientX: 0, clientY: 500 })
  mover(separador, 0, 460)
  expect(alCambiar).toHaveBeenLastCalledWith(dock.alto + 40, 'arrastre')
  expect(document.body.dataset[ATRIBUTO_ARRASTRE_DIVISOR]).toBe('fila')
  fireEvent.pointerUp(separador, { pointerId: 1, clientX: 0, clientY: 460 })
})
