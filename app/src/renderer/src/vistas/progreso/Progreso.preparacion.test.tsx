import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { ResumenCancionIpc } from '@shared/ipc'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { ReproductorContexto } from '../../navegacion/reproductor'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { paso, resumenPrueba } from '../biblioteca/resumenPrueba'
import { Progreso } from './Progreso'

const ahora = '2026-11-22T10:00:00Z'
type Registro = NonNullable<Cancion['preparacion']>
const registro = (extra: Partial<Registro> = {}): Registro =>
  ({
    estado: 'lista_para_revisar',
    paso: null,
    origen: 'automatica',
    actualizado: ahora,
    dudosas: 0,
    revisada: false,
    ...extra
  }) as Registro

interface Opciones {
  registro?: Registro
  estado?: ResumenCancionIpc['estadoPreparacion']
  automatica?: boolean
  desfaseMs?: number
  separacion?: 'completado' | 'en_curso'
  revision?: { dudosas: number; dudosasImportantes: number }
  artista?: string
}

function montar(o: Opciones = {}) {
  const resumen = resumenPrueba({
    pasos: {
      fuente: paso('completado'),
      separacion: paso(o.separacion ?? 'completado'),
      letra: paso(o.estado === 'lista_para_revisar' ? 'completado' : 'pendiente'),
      edicion: paso('pendiente')
    },
    estadoPreparacion: o.estado ?? null,
    ...(o.artista !== undefined ? { artista: o.artista } : {}),
    ...(o.revision ? { revision: o.revision } : {})
  })
  const cancion = {
    metadatos: { album: null },
    fuente: { tipo: 'archivo' },
    letra:
      o.estado === 'lista_para_revisar'
        ? {
            lineas: [{ tipo: 'linea', texto: 'x', inicio_ms: 1000 }],
            ...(o.desfaseMs ? { desfase_corregido_ms: o.desfaseMs } : null)
          }
        : null,
    pistas: null,
    preparacion: o.registro
  } as unknown as Cancion
  const preparar = vi.fn().mockResolvedValue({ aceptadas: ['c1'], omitidas: [] })
  const abrir = vi.fn()
  window.shinobi = {
    biblioteca: {
      listar: () => Promise.resolve([resumen]),
      obtener: () => Promise.resolve(cancion)
    },
    trabajos: { listar: () => Promise.resolve([]), cancelar: vi.fn() },
    alCambiarCancion: () => () => undefined,
    separacion: { separar: vi.fn(), estimar: () => Promise.resolve(null) },
    runtime: {
      estado: () => Promise.resolve({ modo: 'calidad', perfil: 'cpu' }),
      alCambiar: () => () => undefined,
      alProgreso: () => () => undefined
    },
    config: {
      obtener: () => Promise.resolve({ preparacion: { automatica: o.automatica ?? true } })
    },
    preparacion: { preparar }
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: 'c1', paso: 'progreso' }, ir }}
    >
      <ReproductorContexto.Provider value={{ abrir, abierto: null }}>
        <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
          <Progreso id="c1" />
        </TrabajosContexto.Provider>
      </ReproductorContexto.Provider>
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { ir, preparar, abrir }
}

afterEach(cleanup)

describe('Progreso con preparación (feature 5)', () => {
  it('F5-P1: título nuevo, subpasos nuevos y foco en «Volver a la biblioteca»', async () => {
    montar({
      registro: registro({ estado: 'en_curso', paso: 'buscando_letra' }),
      estado: 'preparando'
    })
    expect(await screen.findByRole('heading', { name: 'Preparando tu canción' })).toBeVisible()
    const filas = screen.getByRole('list', { name: 'Subpasos' })
    expect(within(filas).getByText('Buscar la letra')).toBeVisible()
    expect(within(filas).getByText('Comprobar la letra con la voz')).toBeVisible()
    expect(within(filas).getByText('Ajustar los fines de línea')).toBeVisible()
    expect(within(filas).getByText('Buscando la letra en LRCLIB…')).toBeVisible()
    const volver = await screen.findByRole('button', { name: 'Volver a la biblioteca' })
    await vi.waitFor(() => expect(volver).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Ver la letra' })).toBeVisible()
  })

  it('P2: mientras se busca la letra y la separación sigue, «Comprobar» dice que empezará al terminar', async () => {
    montar({
      registro: registro({ estado: 'en_curso', paso: 'buscando_letra' }),
      estado: 'preparando',
      separacion: 'en_curso'
    })
    const filas = await screen.findByRole('list', { name: 'Subpasos' })
    expect(within(filas).getByText('Empezará al terminar la separación.')).toBeVisible()
  })

  it('sin registro y con la búsqueda automática desactivada, la vista es la de 0.2.1', async () => {
    montar({ automatica: false })
    expect(
      await screen.findByRole('heading', { name: 'Separando la voz de la música' })
    ).toBeVisible()
    expect(screen.queryByText('Comprobar la letra con la voz')).toBeNull()
  })

  it('R1: lo que se hizo, Revisar y Probar', async () => {
    const { ir, abrir } = montar({
      estado: 'lista_para_revisar',
      desfaseMs: 800,
      registro: registro({
        busqueda: { resultado: 'elegida', candidatas: 3, motivo: null, ids: [] },
        eleccion: { por: 'app', fecha: ahora, lrclib_id: 1 },
        fines: { metodo: 'silencios', lineas: 31 }
      })
    })
    const r = await screen.findByText('Lista para revisar')
    const bloque = r.closest('[data-resultado]') as HTMLElement
    expect(within(bloque).getByText('Letra de LRCLIB, coincidencia exacta.')).toBeVisible()
    expect(
      within(bloque).getByText('Desfase corregido: toda la letra 0,8 s más tarde.')
    ).toBeVisible()
    expect(within(bloque).getByText('Fin de 31 líneas ajustado con la voz.')).toBeVisible()
    // F5-P13: título del resultado sin subtítulo, bloque bajo el título (antes de los subpasos), foco en el
    // primario y [Volver a la biblioteca] secundario en su misma fila.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Tu canción está lista para revisar'
    )
    expect(screen.queryByText(/No hace falta que esperes/)).toBeNull()
    const subpasos = screen.getByRole('list', { name: 'Subpasos' })
    expect(bloque.compareDocumentPosition(subpasos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await vi.waitFor(() =>
      expect(within(bloque).getByRole('button', { name: 'Revisar' })).toHaveFocus()
    )
    expect(within(bloque).getByRole('button', { name: 'Volver a la biblioteca' })).toBeVisible()
    fireEvent.click(within(bloque).getByRole('button', { name: 'Revisar' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'editor', revisar: true })
    fireEvent.click(within(bloque).getByRole('button', { name: 'Probar' }))
    expect(abrir).toHaveBeenCalledWith('c1', expect.objectContaining({ prueba: true }))
  })

  it('F11-B3: el [Marcar como lista] del toast tras «Probar» pregunta si hay líneas pendientes', async () => {
    const { abrir } = montar({
      estado: 'lista_para_revisar',
      registro: registro(),
      revision: { dudosas: 2, dudosasImportantes: 2 }
    })
    const r = await screen.findByText('Lista para revisar')
    const bloque = r.closest('[data-resultado]') as HTMLElement
    fireEvent.click(within(bloque).getByRole('button', { name: 'Probar' }))
    act(() => abrir.mock.calls[0]![1].alCerrar())
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como lista' }))
    expect(
      await screen.findByRole('dialog', { name: '¿Marcar como lista sin revisar?' })
    ).toBeVisible()
  })

  it('R2 con el artista vacío explica `sinArtista`', async () => {
    montar({
      estado: 'elige_letra',
      artista: '',
      registro: registro({
        estado: 'elige_letra',
        busqueda: {
          resultado: 'elige',
          candidatas: 3,
          motivo: null,
          no_elige: 'sinExacta',
          ids: []
        }
      })
    })
    expect(
      await screen.findByText(/falta el artista de la canción: escríbelo arriba/)
    ).toBeVisible()
  })

  it('R2, R3 y R4 con su botón', async () => {
    const r2 = montar({
      estado: 'elige_letra',
      registro: registro({
        estado: 'elige_letra',
        busqueda: {
          resultado: 'elige',
          candidatas: 3,
          motivo: null,
          no_elige: 'soloTexto',
          ids: []
        }
      })
    })
    expect(await screen.findByText(/Hay 3 candidatas\. No la elegimos por ti/)).toBeVisible()
    expect(screen.getByText(/solo hay letras sin sincronizar/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Elegir la letra' }))
    expect(r2.ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'letra' })
    cleanup()
    montar({
      estado: 'sin_letra',
      registro: registro({
        estado: 'sin_letra',
        busqueda: { resultado: 'sin_letra', candidatas: 0, motivo: 'LETRA_NO_ENCONTRADA', ids: [] }
      })
    })
    expect(
      await screen.findByText('Revisa el título y el artista, o pega la letra tú.')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Añadir la letra' })).toBeVisible()
    cleanup()
    const r4 = montar({
      estado: 'letra_pendiente',
      registro: registro({
        estado: 'error',
        busqueda: { resultado: 'pendiente', candidatas: 0, motivo: 'SIN_CONEXION', ids: [] }
      })
    })
    expect(
      await screen.findByText('No pudimos buscar la letra: sin conexión a internet.')
    ).toBeVisible()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    })
    expect(r4.preparar).toHaveBeenCalledWith(['c1'])
  })
})
