import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiShinobi, ResumenCancionIpc } from '@shared/ipc'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { NavegacionContexto } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { Biblioteca, reiniciarFiltroDeSesion } from './Biblioteca'
import { fixtures } from './fixturesApi'
import { estadoPaquetes, reiniciarPaquetes } from './paquete/almacen'
import { ControladorPaquetes } from './paquete/ControladorPaquetes'
import { resumenPrueba } from './resumenPrueba'

const UBICACION = '0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0'
const lista = resumenPrueba({ id: 'a', titulo: 'Aurora', estado: 'lista', lineasConTiempo: 8 })
const borradorSinTiempos = resumenPrueba({ id: 'b', titulo: 'Brisa', lineasConTiempo: 0 })
const danadaJson = resumenPrueba({
  id: 'd',
  titulo: 'Rota',
  danada: true,
  motivo: 'json',
  pasos: null,
  estilo: null
})

function montar(canciones: ResumenCancionIpc[], letras: Partial<ApiShinobi['letras']> = {}) {
  const api = fixtures({ listar: () => Promise.resolve(canciones) })
  ;(api as unknown as { letras: unknown }).letras = {
    ...(api as unknown as { letras: object }).letras,
    mostrarEnCarpeta: vi.fn(() => Promise.resolve()),
    ...letras
  }
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = api
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() } as never}>
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <Biblioteca />
        <ControladorPaquetes />
      </TrabajosContexto.Provider>
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return api
}

async function abrirMenu(titulo: string) {
  const tarjeta = (await screen.findAllByRole('article')).find((a) =>
    a.getAttribute('aria-label')?.startsWith(`${titulo},`)
  )!
  fireEvent.click(within(tarjeta).getByRole('button', { name: `Más acciones de «${titulo}»` }))
}

beforeEach(() => {
  reiniciarFiltroDeSesion()
  reiniciarPaquetes()
  cerrarTodosLosToasts()
})
afterEach(cleanup)

describe('paquetes y letra en el ⋯ de la tarjeta (F9-1)', () => {
  it('una Lista y un borrador ofrecen «Exportar paquete…» y «Exportar la letra (.lrc)…»; una dañada ilegible no', async () => {
    montar([lista, borradorSinTiempos, danadaJson])
    await abrirMenu('Aurora')
    expect(screen.getByRole('menuitem', { name: 'Exportar paquete…' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Exportar la letra (.lrc)…' })).not.toHaveAttribute(
      'aria-disabled'
    )
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await abrirMenu('Brisa')
    // Sin ninguna línea con inicio: aria-disabled con su motivo.
    const lrc = screen.getByRole('menuitem', { name: /Exportar la letra \(\.lrc\)…/ })
    expect(lrc).toHaveAttribute('aria-disabled', 'true')
    expect(lrc).toHaveAccessibleDescription('Esta canción aún no tiene ninguna línea sincronizada.')
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await abrirMenu('Canción sin nombre')
    expect(screen.queryByRole('menuitem', { name: 'Exportar paquete…' })).toBeNull()
  })

  it('«Exportar paquete…» abre el diálogo con esa canción', async () => {
    montar([lista])
    await abrirMenu('Aurora')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar paquete…' }))
    expect(estadoPaquetes().exportar).toEqual({ tipo: 'canciones', ids: ['a'] })
    expect(await screen.findByRole('dialog', { name: 'Exportar paquete' })).toBeInTheDocument()
  })

  it('«Exportar la letra (.lrc)…» guarda y avisa con «Mostrar en la carpeta» (ubicacionId de main)', async () => {
    const exportarLrc = vi.fn(() => Promise.resolve({ lineasOmitidas: 0, ubicacionId: UBICACION }))
    const api = montar([lista], { exportarLrc })
    await abrirMenu('Aurora')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar la letra (.lrc)…' }))
    expect(exportarLrc).toHaveBeenCalledWith('a')
    expect(await screen.findByText('Letra exportada.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar en la carpeta' }))
    expect(api.letras.mostrarEnCarpeta).toHaveBeenCalledWith(UBICACION)
  })

  it('con líneas sin tiempo usa la variante «sin k líneas»; cancelar el diálogo no hace nada', async () => {
    const exportarLrc = vi
      .fn()
      .mockResolvedValueOnce({ lineasOmitidas: 3, ubicacionId: UBICACION })
      .mockResolvedValueOnce(null)
    montar([lista], { exportarLrc })
    await abrirMenu('Aurora')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar la letra (.lrc)…' }))
    expect(
      await screen.findByText('Letra exportada sin 3 líneas que aún no tienen tiempo.')
    ).toBeInTheDocument()
    cerrarTodosLosToasts()
    await abrirMenu('Aurora')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar la letra (.lrc)…' }))
    await waitFor(() => expect(exportarLrc).toHaveBeenCalledTimes(2))
    await act(async () => undefined)
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('un fallo al escribir da el toast de error con «Copiar detalles»', async () => {
    montar([lista], {
      exportarLrc: () => Promise.reject({ codigo: 'DESTINO_NO_DISPONIBLE', mensaje: 'x' })
    })
    await abrirMenu('Aurora')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar la letra (.lrc)…' }))
    expect(
      await screen.findByText('No se pudo guardar la letra en esa carpeta.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar detalles' })).toBeInTheDocument()
  })
})

describe('Biblioteca vacía', () => {
  it('ofrece restaurar o importar un paquete bajo «Añadir canción»', async () => {
    const api = montar([])
    const elegirOrigen = vi.fn(() => Promise.resolve(null))
    api.copias.elegirOrigen = elegirOrigen
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restaurar una copia o importar un paquete…' })
    )
    await waitFor(() => expect(elegirOrigen).toHaveBeenCalled())
  })
})
