import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultadoOperacionIpc } from '@shared/ipc'
import {
  FICHA_PRUEBA,
  ID_TEMA_PRUEBA,
  catalogoPrueba,
  impactoPrueba,
  temasFalsos,
  type TemasFalsos
} from '../vistas/biblioteca/temasFalsos'
import { DialogoEliminarTema } from './DialogoEliminarTema'
import { impactoCon, instalar } from './pruebas'

type Cancion = ResultadoOperacionIpc['canciones'][number]
const cancion = (id: string, estado: Cancion['estado'], extra: Partial<Cancion> = {}): Cancion => ({
  id,
  titulo: `Título ${id}`,
  artista: `Artista ${id}`,
  estado,
  ...extra
})

let t: TemasFalsos
const alEliminado = vi.fn()
const alCancelado = vi.fn()
const alCerrar = vi.fn()

function abrir(reanudar = false) {
  return render(
    <DialogoEliminarTema
      abierto
      temaId={ID_TEMA_PRUEBA}
      temaNombre="Noche ninja"
      reanudar={reanudar}
      onCancelar={alCerrar}
      onEliminado={alEliminado}
      onBorradoCancelado={alCancelado}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  t = temasFalsos()
  instalar(t)
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
})

describe('DialogoEliminarTema', () => {
  it('muestra recuento, grupos, frase de predeterminado y foco en Cancelar', async () => {
    t.programarImpacto(
      impactoCon(12, {
        esPredeterminado: true,
        asignacionesRetiradas: {
          artistas: ['Queen'],
          albumes: [
            { artista: 'Q', album: 'A' },
            { artista: 'Q', album: 'B' }
          ]
        }
      })
    )
    abrir()
    expect(await screen.findByText(/^12 canciones lo usan\./)).toBeInTheDocument()
    expect(screen.getByText('También se quitará de 1 artista y 2 álbumes.')).toBeInTheDocument()
    expect(screen.getByText(/Las canciones nuevas recibirán un tema al azar/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('con 0 canciones usa tema.eliminar.cero', async () => {
    abrir()
    expect(await screen.findByText('Ninguna canción lo usa.')).toBeInTheDocument()
  })

  it('pasa por «Eliminando…», muestra el progreso con el total del evento y filtra por ficha', async () => {
    t.programarImpacto(impactoCon(12))
    let resolver!: (r: ResultadoOperacionIpc) => void
    t.api.temas.ejecutar = vi.fn(() => new Promise<ResultadoOperacionIpc>((r) => (resolver = r)))
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar tema' }))
    expect(await screen.findByRole('button', { name: /Eliminando…/ })).toBeInTheDocument()
    act(() =>
      t.emitirProgreso({
        ficha: FICHA_PRUEBA,
        operacion: 'borrar',
        temaId: ID_TEMA_PRUEBA,
        hechas: 4,
        total: 14
      })
    )
    expect(
      screen.getAllByText('Guardando el aspecto de 4 de 14 canciones…').length
    ).toBeGreaterThan(0)
    act(() =>
      t.emitirProgreso({
        ficha: 'otra',
        operacion: 'borrar',
        temaId: ID_TEMA_PRUEBA,
        hechas: 9,
        total: 14
      } as never)
    )
    expect(screen.queryByText(/9 de 14/)).toBeNull()
    // La región de estado no se anuncia en cada paso.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Guardando el aspecto de 4 de 14 canciones…'
    )
    act(() =>
      t.emitirProgreso({
        ficha: FICHA_PRUEBA,
        operacion: 'borrar',
        temaId: ID_TEMA_PRUEBA,
        hechas: 8,
        total: 14
      })
    )
    expect(screen.getByRole('status')).toHaveTextContent('4 de 14')
    resolver({ catalogoEscrito: true, canciones: [cancion('1', 'aplicada')] })
    await waitFor(() => expect(alEliminado).toHaveBeenCalledTimes(1))
    expect(alEliminado.mock.calls[0]![1]).toBe(1)
  })

  it('T19: fallo en la 3.ª de 5 muestra 3 filas, nota, alerta y foco en Reintentar', async () => {
    t.programarImpacto(impactoCon(5))
    t.programarResultado({
      catalogoEscrito: false,
      canciones: [
        cancion('1', 'aplicada'),
        cancion('2', 'aplicada'),
        cancion('3', 'error', {
          titulo: 'La flaca',
          artista: 'Jarabe de Palo',
          codigo: 'ERROR_INTERNO'
        }),
        cancion('4', 'pendiente', { titulo: 'Lucía', artista: '' }),
        cancion('5', 'pendiente', { titulo: 'Vivir', artista: 'Queen' })
      ]
    })
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar tema' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('falló al guardar «La flaca»')
    expect(alerta).toHaveTextContent('Faltan 3 canciones')
    const filas = screen.getAllByRole('listitem')
    expect(filas).toHaveLength(3)
    expect(filas[0]).toHaveAccessibleName('La flaca — Jarabe de Palo, no se pudo guardar')
    expect(filas[1]).toHaveAccessibleName('Lucía — Sin artista, pendiente')
    expect(within(filas[0]!).getByText('✕')).toHaveAttribute('aria-hidden', 'true')
    expect(within(filas[1]!).getByText('–')).toHaveAttribute('aria-hidden', 'true')
    expect(within(filas[1]!).queryByRole('button')).toBeNull()
    expect(within(filas[2]!).queryByRole('button')).toBeNull()
    fireEvent.click(within(filas[0]!).getByRole('button', { name: 'Copiar detalles' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ERROR_INTERNO')
    expect(screen.getByText(/Las pendientes no se intentaron/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Cancelar el borrado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\d+ de \d+/)
  })

  it('fallo en la última: una fila, sin nota y variante f = 1', async () => {
    t.programarImpacto(impactoCon(5))
    t.programarResultado({
      catalogoEscrito: false,
      canciones: [
        ...['1', '2', '3', '4'].map((i) => cancion(i, 'aplicada')),
        cancion('5', 'error', { codigo: 'ERROR_INTERNO' })
      ]
    })
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar tema' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falta esa canción')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText(/Las pendientes/)).toBeNull()
  })

  it('Reintentar llama a reanudarBorrado y, si completa, termina', async () => {
    t.programarImpacto(impactoCon(2))
    t.programarResultado({
      catalogoEscrito: false,
      canciones: [cancion('1', 'error', { codigo: 'ERROR_INTERNO' }), cancion('2', 'pendiente')]
    })
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar tema' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    await waitFor(() =>
      expect(t.llamadas.some((l) => l.metodo === 'temas.reanudarBorrado')).toBe(true)
    )
    // El mismo resultado programado vuelve a fallar: la lista es la del intento nuevo.
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toHaveFocus()
    t.programarResultado({
      catalogoEscrito: true,
      canciones: [cancion('1', 'aplicada'), cancion('2', 'aplicada')]
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(alEliminado).toHaveBeenCalledTimes(1))
  })

  it('[Cancelar el borrado] llama a temas.cancelarBorrado', async () => {
    t.programarImpacto(impactoCon(3))
    t.programarResultado({
      catalogoEscrito: false,
      canciones: [
        cancion('1', 'aplicada'),
        cancion('2', 'error', { codigo: 'ERROR_INTERNO' }),
        cancion('3', 'pendiente')
      ]
    })
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar tema' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar el borrado' }))
    await waitFor(() => expect(alCancelado).toHaveBeenCalledTimes(1))
    expect(t.llamadas.some((l) => l.metodo === 'temas.cancelarBorrado')).toBe(true)
  })

  it('abierto para reanudar: progreso con ficha null y lista del intento si falla', async () => {
    t.fijarCatalogo(
      catalogoPrueba({
        borradoPendiente: { temaId: ID_TEMA_PRUEBA, nombre: 'Noche ninja', total: 8, restantes: 5 }
      })
    )
    let resolver!: (r: ResultadoOperacionIpc) => void
    t.api.temas.reanudarBorrado = vi.fn(
      () => new Promise<ResultadoOperacionIpc>((r) => (resolver = r))
    )
    abrir(true)
    expect(await screen.findByRole('button', { name: /Eliminando…/ })).toBeInTheDocument()
    expect(t.llamadas.some((l) => l.metodo === 'temas.previsualizar')).toBe(false)
    act(() =>
      t.emitirProgreso({
        ficha: null,
        operacion: 'borrar',
        temaId: ID_TEMA_PRUEBA,
        hechas: 3,
        total: 8
      })
    )
    expect(screen.getAllByText('Guardando el aspecto de 3 de 8 canciones…').length).toBeGreaterThan(
      0
    )
    act(() =>
      t.emitirProgreso({
        ficha: FICHA_PRUEBA,
        operacion: 'borrar',
        temaId: ID_TEMA_PRUEBA,
        hechas: 7,
        total: 8
      })
    )
    expect(screen.queryByText(/7 de 8/)).toBeNull()
    await act(async () => {
      resolver({
        catalogoEscrito: false,
        canciones: [cancion('1', 'error', { codigo: 'ERROR_INTERNO' }), cancion('2', 'pendiente')]
      })
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Faltan 2 canciones')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('confirmación obsoleta: nuevo recuento, alerta y foco en el botón pulsado', async () => {
    t.programarImpacto(impactoCon(2))
    abrir()
    const boton = await screen.findByRole('button', { name: 'Eliminar tema' })
    boton.focus()
    t.obsoleta(impactoPrueba({ afectadas: impactoCon(3).afectadas }))
    fireEvent.click(boton)
    expect(await screen.findByText(/^3 canciones lo usan/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Mientras confirmabas')
    expect(screen.getByRole('button', { name: 'Eliminar tema' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar tema' }))
    await waitFor(() => expect(alEliminado).toHaveBeenCalledTimes(1))
  })

  it('BORRADO_PENDIENTE al previsualizar se explica en el diálogo', async () => {
    t.fallar('temas.previsualizar', 'BORRADO_PENDIENTE')
    abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('quedó a medias')
    expect(screen.queryByRole('button', { name: 'Eliminar tema' })).toBeNull()
  })
})
