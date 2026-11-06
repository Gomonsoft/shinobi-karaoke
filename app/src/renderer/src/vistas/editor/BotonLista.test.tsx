import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ApiShinobi } from '@shared/ipc'
import { aPeticionTiempos } from '@shared/letras/tiempos'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { avisarBorradorAlSalir, BotonLista, DialogoVolverABorradorEditor } from './BotonLista'
import {
  apiEditorFalsa,
  cancionLista,
  cancionListaIncompleta,
  cancionSeparando,
  cancionSinSincronizar,
  cancionSincronizadaLrclib
} from './fixturesApi'
import { E } from './textos'
import type { SeparacionEditor } from './Transporte'

const separada = { disponible: true, enCola: false, porcentaje: null }
const pendiente = { disponible: false, enCola: false, porcentaje: null }

afterEach(() => cerrarTodosLosToasts())

async function montar(
  cancion = cancionSincronizadaLrclib(),
  opciones: { separacion?: SeparacionEditor; letra?: typeof cancion.letra } = {}
) {
  const falsa = apiEditorFalsa({ cancion })
  const api = falsa.api
  window.shinobi = api as unknown as ApiShinobi
  const resumen = (await api.biblioteca.listar!())[0]!
  const letra = opciones.letra ?? cancion.letra!
  const ir = vi.fn<(vista: Vista) => void>()
  const vaciar = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
  const alEnfocarPrimera = vi.fn()
  const vista: Vista = { tipo: 'cancion', id: cancion.id, paso: 'editor' }
  const contenido = (separacion: SeparacionEditor) => (
    <NavegacionContexto.Provider value={{ vista, ir }}>
      <BotonLista
        resumen={resumen}
        letra={letra}
        separacion={separacion}
        vaciar={vaciar}
        alEnfocarPrimera={alEnfocarPrimera}
      />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  const vistaRenderizada = render(contenido(opciones.separacion ?? separada))
  return {
    ...falsa,
    resumen,
    letra,
    ir,
    vaciar,
    alEnfocarPrimera,
    cambiarSeparacion: (s: SeparacionEditor) => vistaRenderizada.rerender(contenido(s))
  }
}

describe('Marcar como lista', () => {
  it('explica el progreso en vivo, la cola y las líneas sin inicio', async () => {
    const { cambiarSeparacion, alEnfocarPrimera } = await montar(cancionSeparando(), {
      separacion: { ...pendiente, porcentaje: 42, minutos: 3 }
    })
    const boton = screen.getByRole('button', { name: E.marcarLista })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    act(() => boton.focus())
    expect(boton).toHaveFocus()
    const popover = screen.getByRole('dialog', { name: E.faltaTitulo })
    expect(
      within(popover).getByText('La separación de pistas (42 %, quedan unos 3 min)')
    ).toBeVisible()
    expect(within(popover).getByText('Sincronizar 6 líneas')).toBeVisible()
    cambiarSeparacion({ ...pendiente, porcentaje: 45 })
    expect(within(popover).getByText('La separación de pistas (45 %)')).toBeVisible()
    cambiarSeparacion({ ...pendiente, enCola: true })
    expect(within(popover).getByText(E.faltaCola)).toBeVisible()
    fireEvent.click(within(popover).getByRole('button', { name: 'Ir a la primera' }))
    expect(alEnfocarPrimera).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ofrece ir a Separación cuando falta separar y conserva el foco al cerrar con Esc', async () => {
    const cancion = cancionSincronizadaLrclib()
    const { ir } = await montar(cancion, { separacion: pendiente })
    const boton = screen.getByRole('button', { name: E.marcarLista })
    fireEvent.click(boton)
    const popover = screen.getByRole('dialog', { name: E.faltaTitulo })
    expect(within(popover).getByText(E.faltaSeparar)).toBeVisible()
    fireEvent.keyDown(popover, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(boton).toHaveFocus()
    fireEvent.click(boton)
    fireEvent.click(screen.getByRole('button', { name: E.irSeparacion }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: cancion.id, paso: 'progreso' })
  })

  it('indica una única línea pendiente según la letra local', async () => {
    const cancion = cancionSincronizadaLrclib()
    const letra = cancionListaIncompleta().letra!
    const { alEnfocarPrimera } = await montar(cancion, { letra })
    fireEvent.click(screen.getByRole('button', { name: E.marcarLista }))
    expect(screen.getByText('Sincronizar 1 línea')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a ella' }))
    expect(alEnfocarPrimera).toHaveBeenCalledOnce()
  })

  it('vacía los cambios, marca como Lista y vuelve con foco y toast sin acción', async () => {
    const cancion = cancionSinSincronizar()
    const { api, letra, llamadas, vaciar, ir } = await montar(cancion, {
      letra: cancionSincronizadaLrclib().letra
    })
    const visita = (await api.letras.abrirEdicion!(cancion.id))!
    vaciar.mockImplementation(async () => {
      await api.letras.guardarTiempos!(aPeticionTiempos(cancion.id, letra), visita.sesionId)
      return true
    })
    ir.mockImplementation(() => {
      llamadas.push({ metodo: 'ir', args: [] })
    })
    fireEvent.click(screen.getByRole('button', { name: E.marcarLista }))
    await waitFor(() =>
      expect(ir).toHaveBeenCalledWith({
        tipo: 'biblioteca',
        enfocar: { id: cancion.id, resaltar: true }
      })
    )
    expect(llamadas.slice(-3).map((x) => x.metodo)).toEqual([
      'letras.guardarTiempos',
      'biblioteca.marcarLista',
      'ir'
    ])
    expect(screen.getByText(`«${cancion.metadatos.titulo}» está lista para cantar.`)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Reproducir' })).not.toBeInTheDocument()
  })

  it('se queda en el editor si falla el vaciado o el IPC de marcar Lista', async () => {
    const { vaciar, ir, fallar, llamadas } = await montar()
    const boton = screen.getByRole('button', { name: E.marcarLista })
    vaciar.mockResolvedValueOnce(false)
    await act(async () => {
      fireEvent.click(boton)
    })
    expect(llamadas.some((x) => x.metodo === 'biblioteca.marcarLista')).toBe(false)
    expect(ir).not.toHaveBeenCalled()
    fallar('biblioteca.marcarLista', 'ERROR_INTERNO')
    fireEvent.click(boton)
    expect(await screen.findByRole('button', { name: 'Copiar detalles' })).toBeVisible()
    expect(ir).not.toHaveBeenCalled()
  })
})

describe('Hecho y volver a borrador', () => {
  it('en una Lista incompleta ofrece sincronizar primero y sale al pulsar de nuevo', async () => {
    const cancion = cancionListaIncompleta()
    const { alEnfocarPrimera, ir } = await montar(cancion)
    const boton = screen.getByRole('button', { name: E.hecho })
    fireEvent.click(boton)
    const aviso = screen.getByRole('dialog', { name: E.hechoIncompleta(1) })
    expect(within(aviso).getByRole('button', { name: E.salirIgualmente })).toBeVisible()
    fireEvent.click(within(aviso).getByRole('button', { name: E.sincronizarAhora }))
    expect(alEnfocarPrimera).toHaveBeenCalledOnce()
    expect(ir).not.toHaveBeenCalled()
    fireEvent.click(boton)
    expect(ir).toHaveBeenCalledWith({
      tipo: 'biblioteca',
      enfocar: { id: cancion.id, resaltar: false }
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirma el retorno a borrador y conserva letra y estilo', async () => {
    const cancion = cancionLista()
    const { api } = apiEditorFalsa({ cancion })
    window.shinobi = api as unknown as ApiShinobi
    const resumen = (await api.biblioteca.listar!())[0]!
    const cerrar = vi.fn()
    render(<DialogoVolverABorradorEditor resumen={resumen} alCerrar={cerrar} />)
    const dialogo = screen.getByRole('dialog', { name: '¿Volver a borrador?' })
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Volver a borrador' }))
    await waitFor(() => expect(cerrar).toHaveBeenCalledOnce())
    const guardada = await api.biblioteca.obtener!(cancion.id)
    expect(guardada).toMatchObject({
      estado: 'borrador',
      letra: cancion.letra,
      estilo: cancion.estilo
    })
  })

  it('muestra el toast de borrador solo al volver a Biblioteca con cambios', () => {
    render(<ContenedorToasts />)
    act(() => {
      avisarBorradorAlSalir({ tipo: 'biblioteca' }, 'borrador', false)
      avisarBorradorAlSalir({ tipo: 'ajustes' }, 'borrador', true)
      avisarBorradorAlSalir({ tipo: 'biblioteca' }, 'lista', true)
      avisarBorradorAlSalir(
        { tipo: 'biblioteca', enfocar: { id: 'a', resaltar: true } },
        'borrador',
        true
      )
    })
    expect(screen.queryByText(E.borradorGuardado)).not.toBeInTheDocument()
    act(() => avisarBorradorAlSalir({ tipo: 'biblioteca' }, 'borrador', true))
    expect(screen.getByText(E.borradorGuardado)).toBeVisible()
  })
})
