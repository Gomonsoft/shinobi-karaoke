import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContenedorToasts } from '../../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../../componentes/gestorToasts'
import { NavegacionContexto } from '../../../navegacion/estado'
import { reiniciarPaquetes } from './almacen'
import { ControladorPaquetes } from './ControladorPaquetes'
import { exportarLetras } from './letras'
import { montarApiPaquetes } from './pruebas'

const UBICACION = '0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0'
const canciones = [
  { id: 'a', titulo: 'Aurora', artista: 'Ana' },
  { id: 'b', titulo: 'Brisa', artista: 'Beto' },
  { id: 'c', titulo: 'Cometa', artista: '' }
]

function montar(letras: object) {
  const fake = montarApiPaquetes()
  Object.assign((window as unknown as { shinobi: { letras: object } }).shinobi.letras, letras)
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() } as never}>
      <ControladorPaquetes />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return fake
}

beforeEach(() => {
  reiniciarPaquetes()
  cerrarTodosLosToasts()
})
afterEach(cleanup)

describe('exportar la letra de varias canciones (F9-14)', () => {
  it('sin omitidas: un toast con «Mostrar la carpeta»', async () => {
    const exportarLrcVarias = vi.fn(() =>
      Promise.resolve({ escritas: 3, omitidas: [], ubicacionId: UBICACION })
    )
    const fake = montar({ exportarLrcVarias })
    await act(() => exportarLetras(canciones))
    expect(exportarLrcVarias).toHaveBeenCalledWith(['a', 'b', 'c'])
    expect(screen.getByText('3 letras exportadas.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar la carpeta' }))
    expect(fake.mostrarEnCarpeta).toHaveBeenCalledWith(UBICACION)
  })

  it('con el nombre de la carpeta, el toast dice «a «{carpeta}»» (nunca la ruta)', async () => {
    montar({
      exportarLrcVarias: () =>
        Promise.resolve({ escritas: 3, omitidas: [], ubicacionId: UBICACION, carpeta: 'Karaoke' })
    })
    await act(() => exportarLetras(canciones))
    expect(screen.getByText('3 letras exportadas a «Karaoke».')).toBeInTheDocument()
  })

  it('con una omitida: el resultado por canción con su motivo y sin «Copiar detalles» en la sin tiempos', async () => {
    montar({
      exportarLrcVarias: () =>
        Promise.resolve({
          escritas: 2,
          omitidas: [
            { id: 'b', motivo: 'SIN_TIEMPOS' },
            { id: 'c', motivo: 'SIN_ESPACIO' }
          ],
          ubicacionId: UBICACION
        })
    })
    await act(() => exportarLetras(canciones))
    const dialogo = await screen.findByRole('dialog', { name: 'Letras exportadas' })
    expect(within(dialogo).getByText('2 de 3 letras exportadas.')).toBeInTheDocument()
    const filas = within(dialogo).getAllByRole('listitem')
    expect(filas[0]).toHaveTextContent(
      'Brisa — BetoEsta canción aún no tiene ninguna línea sincronizada.'
    )
    expect(within(filas[0]!).queryByRole('button', { name: 'Copiar detalles' })).toBeNull()
    expect(filas[1]).toHaveTextContent('CometaNo queda espacio en el disco.')
    expect(within(filas[1]!).getByRole('button', { name: 'Copiar detalles' })).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('cancelar el selector de carpeta no hace nada', async () => {
    montar({ exportarLrcVarias: () => Promise.resolve(null) })
    await act(() => exportarLetras(canciones))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByTestId('toast')).toBeNull()
  })
})
