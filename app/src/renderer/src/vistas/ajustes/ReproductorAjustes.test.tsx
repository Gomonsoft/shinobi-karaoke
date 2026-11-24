import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { configPredeterminada } from '@shared/config'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ReproductorAjustes, opcionesCuenta } from './ReproductorAjustes'

function montar(transicion?: number, actualizar = vi.fn().mockResolvedValue({})) {
  const config = configPredeterminada()
  if (transicion !== undefined) config.reproductor.transicion_s = transicion
  window.shinobi = {
    config: { obtener: () => Promise.resolve(config), actualizar }
  } as never
  render(
    <>
      <ReproductorAjustes />
      <ContenedorToasts />
    </>
  )
  return { actualizar }
}

const selector = () => screen.findByRole('combobox', { name: 'Cuenta entre canciones' })

afterEach(() => act(() => cerrarTodosLosToasts()))

describe('ReproductorAjustes', () => {
  it('AR1: sección «Reproductor» con 4 s (predeterminado) y las siete opciones', async () => {
    montar()
    expect(screen.getByRole('heading', { name: 'Reproductor', level: 2 })).toBeInTheDocument()
    const caja = await selector()
    expect(caja).toHaveValue('4')
    expect(
      within(caja)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['2 s', '3 s', '4 s (predeterminado)', '5 s', '8 s', '10 s', '15 s'])
  })

  it('AR1: la ayuda está asociada al selector con aria-describedby', async () => {
    montar()
    const caja = await selector()
    const ayuda = document.getElementById(caja.getAttribute('aria-describedby')!)
    expect(ayuda).toHaveTextContent(
      'Cuando termina una canción y hay otra en la cola, la pantalla del reproductor cuenta estos segundos antes de empezarla.'
    )
  })

  it('AR2: elegir 10 s guarda `reproductor.transicion_s` sin toast de éxito', async () => {
    const { actualizar } = montar()
    fireEvent.change(await selector(), { target: { value: '10' } })
    await waitFor(() =>
      expect(actualizar).toHaveBeenCalledWith({ reproductor: { transicion_s: 10 } })
    )
    expect(screen.getByRole('combobox')).toHaveValue('10')
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('un valor válido fuera de la lista (7) se añade como «7 s» y queda seleccionado', async () => {
    montar(7)
    const caja = await selector()
    await waitFor(() => expect(caja).toHaveValue('7'))
    expect(within(caja).getByRole('option', { name: '7 s' })).toBeInTheDocument()
  })

  it('con un valor no válido (ya leído como 4) muestra «4 s (predeterminado)»', async () => {
    montar(4)
    const caja = await selector()
    expect(within(caja).getByRole('option', { name: '4 s (predeterminado)' })).toHaveProperty(
      'selected',
      true
    )
  })

  it('AR3: si falla el guardado vuelve al valor anterior y avisa con «Copiar detalles»', async () => {
    montar(5, vi.fn().mockRejectedValue({ codigo: 'X', mensaje: 'no se pudo' }))
    const caja = await selector()
    await waitFor(() => expect(caja).toHaveValue('5'))
    fireEvent.change(caja, { target: { value: '10' } })
    expect(await screen.findByText('No se pudo guardar el ajuste.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar detalles' })).toBeInTheDocument()
    expect(caja).toHaveValue('5')
  })
})

describe('opcionesCuenta', () => {
  it('añade solo valores válidos de 1 a 30', () => {
    expect(opcionesCuenta(7)).toEqual([2, 3, 4, 5, 7, 8, 10, 15])
    expect(opcionesCuenta(1)).toEqual([1, 2, 3, 4, 5, 8, 10, 15])
    expect(opcionesCuenta(30)).toContain(30)
    expect(opcionesCuenta(31)).toEqual([2, 3, 4, 5, 8, 10, 15])
    expect(opcionesCuenta(0)).toEqual([2, 3, 4, 5, 8, 10, 15])
  })
})

describe('ReproductorAjustes · subrayado (0.2.2)', () => {
  const casilla = () => screen.findByRole('checkbox', { name: 'Subrayar siempre lo ya cantado' })

  it('F2-A1: casilla desmarcada sin configuración previa, con su ayuda asociada', async () => {
    montar()
    const c = await casilla()
    expect(c).not.toBeChecked()
    expect(c).toHaveAccessibleDescription(/Añade una línea bajo la parte cantada/)
  })

  it('F2-A2: marcarla se guarda al instante y la lee al volver', async () => {
    const { actualizar } = montar()
    fireEvent.click(await casilla())
    expect(actualizar).toHaveBeenCalledWith({ reproductor: { subrayar_cantado: true } })
    expect(await casilla()).toBeChecked()
  })

  it('F2-A3: con un fallo de escritura vuelve al valor anterior y avisa', async () => {
    montar(undefined, vi.fn().mockRejectedValue(new Error('disco')))
    fireEvent.click(await casilla())
    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeChecked())
    expect(await screen.findByText('No se pudo guardar el ajuste.')).toBeVisible()
  })
})
