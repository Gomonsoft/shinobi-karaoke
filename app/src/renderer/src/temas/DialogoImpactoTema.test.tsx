import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ESTILO_PREDETERMINADO } from '@shared/estilo'
import type { OperacionTema, ResultadoOperacionIpc } from '@shared/ipc'
import {
  FICHA_PRUEBA,
  ID_TEMA_PRUEBA,
  impactoPrueba,
  temasFalsos,
  type TemasFalsos
} from '../vistas/biblioteca/temasFalsos'
import { DialogoImpactoTema, type VarianteImpacto } from './DialogoImpactoTema'
import { afectada, impactoCon, instalar } from './pruebas'

let t: TemasFalsos
const alHecho = vi.fn()
const alCancelar = vi.fn()

const editar: OperacionTema = {
  tipo: 'editar',
  temaId: ID_TEMA_PRUEBA,
  revisionTema: 1,
  estilo: ESTILO_PREDETERMINADO
}
const quitar: OperacionTema = { tipo: 'predeterminado', temaId: null }

function abrir(variante: VarianteImpacto, op: OperacionTema) {
  return render(
    <DialogoImpactoTema
      abierto
      variante={variante}
      op={op}
      onCancelar={alCancelar}
      onHecho={alHecho}
      onGuardarNuevo={vi.fn()}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  t = temasFalsos()
  instalar(t)
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
})

describe('DialogoImpactoTema · guardar', () => {
  const variante: VarianteImpacto = { tipo: 'guardar', tema: 'Noche ninja', incluidaEsta: true }

  it('T8: 4 canciones, desglose sin líneas a 0 y lista revelable con las 4', async () => {
    t.programarImpacto(
      impactoCon(4, {
        desglose: {
          cancion: 1,
          album: 1,
          artista: 1,
          predeterminado: 1,
          aleatorio: 0,
          predeterminadoAnterior: 0,
          propio: 1,
          respaldo: 0,
          incluido: 0
        }
      })
    )
    abrir(variante, editar)
    expect(
      await screen.findByText('Cambiará el aspecto de 4 canciones, incluida esta.')
    ).toBeVisible()
    const lineas = screen.getAllByRole('listitem').map((l) => l.textContent)
    expect(lineas).toEqual([
      '1 lo tiene asignado',
      '2 lo heredan de su álbum o artista',
      '1 lo usa como tema predeterminado'
    ])
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    const revelar = screen.getByRole('button', { name: /Ver las canciones/ })
    expect(revelar).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(revelar)
    expect(revelar).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText(/^Canción \d — Queen$/)).toHaveLength(4)
    expect(screen.queryByText(TEMA_SESION)).toBeNull()
  })

  it('con sesión en curso muestra el aviso', async () => {
    t.programarImpacto(impactoCon(1, { sesionEnCurso: true }))
    abrir(variante, editar)
    expect(await screen.findByText(TEMA_SESION)).toBeVisible()
    expect(screen.getByText('Cambiará el aspecto de 1 canción, que es esta.')).toBeVisible()
  })

  it('CONFIRMACION_OBSOLETA: actualiza recuento y lista, alerta, foco en el botón; la segunda confirma', async () => {
    t.programarImpacto(impactoCon(2))
    abrir(variante, editar)
    const guardar = await screen.findByRole('button', { name: 'Guardar en «Noche ninja»' })
    guardar.focus()
    t.obsoleta(impactoPrueba({ ficha: FICHA_PRUEBA, afectadas: impactoCon(5).afectadas }))
    fireEvent.click(guardar)
    expect(
      await screen.findByText('Cambiará el aspecto de 5 canciones, incluida esta.')
    ).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Mientras confirmabas cambió')
    expect(screen.getByRole('button', { name: 'Guardar en «Noche ninja»' })).toHaveFocus()
    expect(alHecho).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en «Noche ninja»' }))
    await waitFor(() => expect(alHecho).toHaveBeenCalledTimes(1))
    expect(t.llamadas.filter((l) => l.metodo === 'temas.ejecutar')).toHaveLength(2)
  })

  it('TEMA_NO_ENCONTRADO muestra tema.error.noExiste con Guardar como tema nuevo', async () => {
    t.programarImpacto(impactoCon(1))
    abrir(variante, editar)
    t.fallar('temas.ejecutar', 'TEMA_NO_ENCONTRADO')
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar en «Noche ninja»' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Este tema ya no existe')
    expect(screen.getByRole('button', { name: 'Guardar como tema nuevo…' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar en «Noche ninja»' })).toBeNull()
  })
})

const TEMA_SESION =
  'Lo que ya se está reproduciendo seguirá con el aspecto anterior hasta que termine.'

describe('DialogoImpactoTema · predeterminado', () => {
  it('variante con anterior y variante sin anterior', async () => {
    t.programarImpacto(impactoCon(1))
    const { unmount } = abrir(
      { tipo: 'predeterminado', nuevo: 'Neón', anterior: 'Noche ninja' },
      { tipo: 'predeterminado', temaId: ID_TEMA_PRUEBA }
    )
    expect(
      await screen.findByText(
        'Cambiará el aspecto de 1 canción que usa el predeterminado «Noche ninja».'
      )
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Usar «Neón»' })).toBeVisible()
    expect(screen.getByText(/ni las que recibieron un tema al azar/)).toBeVisible()
    unmount()
    t.programarImpacto(impactoCon(3))
    abrir(
      { tipo: 'predeterminado', nuevo: 'Neón', anterior: null },
      { tipo: 'predeterminado', temaId: ID_TEMA_PRUEBA }
    )
    expect(
      await screen.findByText(
        'Cambiará el aspecto de 3 canciones que ahora usan el estilo incluido de Shinobi Karaoke.'
      )
    ).toBeVisible()
  })
})

describe('DialogoImpactoTema · quitar el predeterminado', () => {
  const variante: VarianteImpacto = { tipo: 'ninguno', anterior: 'Noche ninja' }
  const cancion = (id: string, estado: 'aplicada' | 'error' | 'pendiente') => ({
    id,
    titulo: `Título ${id}`,
    artista: 'Queen',
    estado,
    ...(estado === 'error' ? { codigo: 'ERROR_INTERNO' as const } : {})
  })

  it('fallo en la 2.ª de 4: lista de 3 filas, nota, foco en Reintentar; Reintentar vuelve a previsualizar', async () => {
    t.programarImpacto(impactoCon(4, { esPredeterminado: true }))
    t.programarResultado({
      catalogoEscrito: false,
      canciones: [
        cancion('1', 'aplicada'),
        cancion('2', 'error'),
        cancion('3', 'pendiente'),
        cancion('4', 'pendiente')
      ]
    })
    abrir(variante, quitar)
    expect(
      await screen.findByText(/Las 4 canciones que usan «Noche ninja» lo conservarán/)
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar predeterminado' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('falló al guardar «Título 2»')
    expect(alerta).toHaveTextContent('Faltan 3 canciones')
    expect(alerta).toHaveTextContent('«Noche ninja» sigue siendo el predeterminado')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Copiar detalles' })).toHaveLength(1)
    expect(screen.getByText(/Las pendientes no se intentaron/)).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus())
    expect(alHecho).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() =>
      expect(t.llamadas.filter((l) => l.metodo === 'temas.previsualizar')).toHaveLength(2)
    )
    expect(await screen.findByRole('button', { name: 'Quitar predeterminado' })).toBeVisible()
  })

  it('con 8 canciones se ve el progreso avanzando y Esc no cierra mientras se aplica', async () => {
    t.programarImpacto(impactoCon(8))
    let resolver!: (r: ResultadoOperacionIpc) => void
    t.api.temas.ejecutar = vi.fn(() => new Promise<ResultadoOperacionIpc>((r) => (resolver = r)))
    abrir(variante, quitar)
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar predeterminado' }))
    expect(await screen.findByRole('button', { name: /Quitando…/ })).toBeInTheDocument()
    act(() =>
      t.emitirProgreso({
        ficha: FICHA_PRUEBA,
        operacion: 'predeterminado',
        temaId: ID_TEMA_PRUEBA,
        hechas: 3,
        total: 8
      })
    )
    expect(screen.getAllByText('Guardando 3 de 8 canciones…').length).toBeGreaterThan(0)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(alCancelar).not.toHaveBeenCalled()
    await act(async () => {
      resolver({ catalogoEscrito: true, canciones: [] })
    })
    await waitFor(() => expect(alHecho).toHaveBeenCalledTimes(1))
  })

  it('la lista de afectadas incluye títulos con valores por defecto', async () => {
    t.programarImpacto(impactoPrueba({ afectadas: [afectada('1', { titulo: '', artista: '' })] }))
    abrir(variante, quitar)
    fireEvent.click(await screen.findByRole('button', { name: /Ver las canciones/ }))
    expect(screen.getByText('Canción sin nombre — Sin artista')).toBeVisible()
  })
})
