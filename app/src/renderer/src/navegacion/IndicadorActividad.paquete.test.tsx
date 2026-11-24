import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ApiShinobi } from '@shared/ipc'
import { NavegacionContexto } from './estado'
import { IndicadorActividad } from './IndicadorActividad'
import { TrabajosContexto } from '../trabajos/useTrabajos'
import {
  estadoPaquetes,
  iniciarSeguimiento,
  reiniciarPaquetes
} from '../vistas/biblioteca/paquete/almacen'

const cancelar = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  reiniciarPaquetes()
  cancelar.mockClear()
  window.shinobi = {
    copias: { cancelar },
    preparacion: { tanda: () => Promise.resolve(null), alTanda: () => () => undefined },
    config: { obtener: () => Promise.resolve({ preparacion: { automatica: true } }) }
  } as unknown as ApiShinobi
})

function pintar() {
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() }}>
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <IndicadorActividad />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
}

describe('fila act.paq del panel de actividad', () => {
  it('cuenta el paquete en el indicador y ofrece [Ir] y [✕]', async () => {
    pintar()
    act(() =>
      iniciarSeguimiento({
        tipo: 'exportar',
        trabajoId: 'p1',
        completo: true,
        esCopia: false,
        n: 3,
        peticion: { tipo: 'canciones', ids: ['a', 'b', 'c'] }
      })
    )
    fireEvent.click(await screen.findByRole('button', { name: '1 en curso' }))
    expect(screen.getByText('Creando paquete · 0 de 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ir' }))
    expect(estadoPaquetes().exportar).toEqual({ tipo: 'canciones', ids: ['a', 'b', 'c'] })

    fireEvent.click(await screen.findByRole('button', { name: '1 en curso' }))
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar «Creando paquete/ }))
    expect(cancelar).toHaveBeenCalledWith('p1')
  })

  it('al importar, [Ir] reabre el diálogo de importación', async () => {
    pintar()
    act(() =>
      iniciarSeguimiento({
        tipo: 'importar',
        trabajoId: 'p2',
        completo: true,
        esCopia: false,
        n: 2,
        peticion: null
      })
    )
    fireEvent.click(await screen.findByRole('button', { name: '1 en curso' }))
    expect(screen.getByText('Importando paquete · 0 de 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ir' }))
    expect(estadoPaquetes().importar).not.toBeNull()
  })
})
