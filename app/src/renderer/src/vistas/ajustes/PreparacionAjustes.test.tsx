import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { configPredeterminada } from '@shared/config'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { paso, resumenPrueba } from '../biblioteca/resumenPrueba'
import { PreparacionAjustes } from './PreparacionAjustes'

function montar({
  automatica = true,
  actualizar = vi.fn().mockResolvedValue({}),
  abrirEnlace = vi.fn().mockResolvedValue(undefined),
  borradoresSinLetra = 0,
  /** Borradores sin letra cuya fuente aún no está: la bandeja no los cuenta en «Esperan letra». */
  sinFuente = 0
} = {}) {
  const config = configPredeterminada()
  config.preparacion.automatica = automatica
  const lista = Array.from({ length: borradoresSinLetra + sinFuente }, (_, i) =>
    resumenPrueba({
      id: `b${i}`,
      pasos: {
        fuente: paso(i < borradoresSinLetra ? 'completado' : 'pendiente'),
        separacion: paso('completado'),
        letra: paso('pendiente'),
        edicion: paso('pendiente')
      }
    })
  )
  window.shinobi = {
    config: { obtener: () => Promise.resolve(config), actualizar },
    biblioteca: { listar: () => Promise.resolve(lista) },
    sistema: { abrirEnlace }
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'ajustes' }, ir }}>
      <PreparacionAjustes />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { actualizar, abrirEnlace, ir }
}

const casilla = () =>
  screen.findByRole('checkbox', { name: 'Buscar la letra automáticamente al añadir una canción' })

afterEach(() => act(() => cerrarTodosLosToasts()))

describe('Letras y preparación automática', () => {
  it('F5-J1: marcada por defecto, con la privacidad asociada a la casilla', async () => {
    montar()
    const c = await casilla()
    expect(c).toBeChecked()
    expect(document.getElementById(c.getAttribute('aria-describedby')!)).toHaveTextContent(
      'Para buscarla se envían el título, el artista, el álbum y la duración de la canción, y nada más'
    )
  })

  it('desmarcarla guarda `preparacion.automatica` y cambia el texto', async () => {
    const { actualizar } = montar()
    fireEvent.click(await casilla())
    await waitFor(() =>
      expect(actualizar).toHaveBeenCalledWith({ preparacion: { automatica: false } })
    )
    expect(screen.getByText(/^Desactivada: la letra solo se busca/)).toBeVisible()
  })

  it('F5-J7: si no se puede guardar, vuelve a su valor y avisa', async () => {
    montar({ actualizar: vi.fn().mockRejectedValue(new Error('disco')) })
    fireEvent.click(await casilla())
    expect(await screen.findByText('No se pudo guardar el ajuste.')).toBeVisible()
    expect(await casilla()).toBeChecked()
  })

  it('F5-J5: al marcarla con borradores sin letra avisa y lleva a la casilla «Esperan letra»', async () => {
    const { ir } = montar({ automatica: false, borradoresSinLetra: 5 })
    const c = await casilla()
    // La casilla nace marcada hasta que llega la configuración: se espera a que refleje «apagada».
    await waitFor(() => expect(c).not.toBeChecked())
    fireEvent.click(c)
    expect(await screen.findByText(/Tienes 5 borradores sin letra/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Verlos en la Biblioteca' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca', casilla: 'letra' })
  })

  it('F5-J5: cuenta lo mismo que la casilla «Esperan letra» (no los que aún no tienen fuente)', async () => {
    montar({ automatica: false, borradoresSinLetra: 3, sinFuente: 4 })
    const c = await casilla()
    await waitFor(() => expect(c).not.toBeChecked())
    fireEvent.click(c)
    expect(await screen.findByText(/Tienes 3 borradores sin letra/)).toBeVisible()
  })

  it('«Qué es LRCLIB» abre lrclib.net', async () => {
    const { abrirEnlace } = montar()
    fireEvent.click(await screen.findByRole('button', { name: /Qué es LRCLIB/ }))
    expect(abrirEnlace).toHaveBeenCalledWith('https://lrclib.net')
  })
})
