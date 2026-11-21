import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ApiShinobi } from '@shared/ipc'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { ReproductorContexto } from '../../navegacion/reproductor'
import { BotonLetraLista } from './BotonLetraLista'
import { apiEditorFalsa, cancionListaIncompleta, cancionSincronizadaLrclib } from './fixturesApi'
import { LL } from './textosLetraLista'

afterEach(() => cerrarTodosLosToasts())

const separada = { disponible: true, enCola: false, porcentaje: null }

async function montar(omitirAviso: boolean, incompleta = false) {
  const cancion = cancionSincronizadaLrclib()
  const falsa = apiEditorFalsa({ cancion })
  window.shinobi = falsa.api as unknown as ApiShinobi
  const resumen = (await falsa.api.biblioteca.listar!())[0]!
  const letra = incompleta ? cancionListaIncompleta().letra! : cancion.letra!
  const ir = vi.fn<(vista: Vista) => void>()
  const alOmitirAviso = vi.fn()
  const alEnfocarPrimera = vi.fn()
  const vista: Vista = { tipo: 'cancion', id: cancion.id, paso: 'editor' }
  render(
    <NavegacionContexto.Provider value={{ vista, ir }}>
      <ReproductorContexto.Provider value={{ abrir: vi.fn(), abierto: null }}>
        <BotonLetraLista
          resumen={resumen}
          cancion={cancion}
          letra={letra}
          separacion={separada}
          omitirAviso={omitirAviso}
          alOmitirAviso={alOmitirAviso}
          vaciar={async () => true}
          alEnfocarPrimera={alEnfocarPrimera}
        />
      </ReproductorContexto.Provider>
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { ...falsa, ir, alOmitirAviso, alEnfocarPrimera, id: cancion.id }
}

describe('Marcar como letra lista', () => {
  it('con faltas muestra el popover con su título y «Ir a ella»', async () => {
    const { alEnfocarPrimera } = await montar(true, true)
    const boton = screen.getByRole('button', { name: LL.boton })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(boton)
    const popover = screen.getByRole('dialog', { name: LL.faltaTitulo })
    fireEvent.click(within(popover).getByRole('button', { name: 'Ir a ella' }))
    expect(alEnfocarPrimera).toHaveBeenCalledOnce()
  })

  it('cancelar el aviso no escribe nada y devuelve el foco', async () => {
    const { llamadas } = await montar(false)
    const boton = screen.getByRole('button', { name: LL.boton })
    boton.focus()
    fireEvent.click(boton)
    const dialogo = screen.getByRole('dialog', { name: LL.dialogoTitulo })
    expect(within(dialogo).getByRole('button', { name: LL.boton })).toHaveFocus()
    fireEvent.click(within(dialogo).getByRole('checkbox'))
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(boton).toHaveFocus()
    const metodos = llamadas.map((l) => l.metodo)
    expect(metodos).not.toContain('biblioteca.marcarLista')
    expect(metodos).not.toContain('config.actualizar')
  })

  it('confirmar con la casilla guarda la preferencia y marca con la modalidad', async () => {
    const { llamadas, ir, alOmitirAviso, id } = await montar(false)
    fireEvent.click(screen.getByRole('button', { name: LL.boton }))
    const dialogo = screen.getByRole('dialog', { name: LL.dialogoTitulo })
    fireEvent.click(within(dialogo).getByRole('checkbox'))
    fireEvent.click(within(dialogo).getByRole('button', { name: LL.boton }))
    await waitFor(() => expect(ir).toHaveBeenCalled())
    expect(llamadas.find((l) => l.metodo === 'config.actualizar')?.args).toEqual([
      { editor: { omitir_aviso_letra_lista: true } }
    ])
    expect(llamadas.find((l) => l.metodo === 'biblioteca.marcarLista')?.args).toEqual([
      id,
      { modalidad: 'letra_lista' }
    ])
    expect(alOmitirAviso).toHaveBeenCalled()
  })

  it('con el aviso omitido marca directamente sin escribir la preferencia', async () => {
    const { llamadas, ir } = await montar(true)
    fireEvent.click(screen.getByRole('button', { name: LL.boton }))
    await waitFor(() => expect(ir).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(llamadas.map((l) => l.metodo)).not.toContain('config.actualizar')
  })
})
