import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { EventoCancionIpc, ResumenCancionIpc } from '@shared/ipc'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { paso, resumenPrueba } from '../biblioteca/resumenPrueba'
import { apiLetrasFalsa, lineasPorLinea } from './fixturesApi'
import { Letra } from './Letra'

type Prep = NonNullable<ResumenCancionIpc['preparacion']>
const prep = (extra: Partial<Prep> = {}): Prep => ({
  estado: 'elige_letra',
  paso: null,
  busqueda: { resultado: 'elige', candidatas: 3, motivo: null, noElige: 'varias' },
  dudosas: 0,
  revisada: false,
  eleccionAutomatica: false,
  eleccionSinComprobar: false,
  desfaseCorregido: false,
  ...extra
})

interface Opciones {
  resumen: Partial<ResumenCancionIpc>
  letra?: { lrclib_id: number | null; desfase_corregido_ms?: number } | null
}

function montar(o: Opciones) {
  const pasos = { ...resumenPrueba().pasos!, separacion: paso('completado') }
  const resumen = resumenPrueba({ pasos, ...o.resumen })
  const { letras, llamadas } = apiLetrasFalsa({ resumen: { pasos } })
  const cancion = {
    metadatos: { titulo: 'Canción inventada', artista: 'Artista inventado', album: null },
    letra: o.letra ? { origen: 'lrclib', offset_ms: 0, lineas: lineasPorLinea(), ...o.letra } : null
  } as unknown as Cancion
  const eventos: ((e: EventoCancionIpc) => void)[] = []
  const revisada = vi.fn().mockResolvedValue(null)
  const preparar = vi.fn().mockResolvedValue({ aceptadas: ['c1'], omitidas: [] })
  window.shinobi = {
    biblioteca: {
      listar: () => Promise.resolve([resumen]),
      obtener: () => Promise.resolve(cancion),
      marcarPreparacionRevisada: revisada
    },
    alCambiarCancion: (cb: (e: EventoCancionIpc) => void) => {
      eventos.push(cb)
      return () => undefined
    },
    sistema: { abrirEnlace: vi.fn() },
    preparacion: { preparar },
    letras
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: 'c1', paso: 'letra' }, ir }}
    >
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <Letra id="c1" />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  const busquedas = () => llamadas.filter((l) => l.canal === 'buscar').length
  return { busquedas, revisada, preparar, eventos, resumen }
}

afterEach(cleanup)

describe('Letra con preparación (feature 5)', () => {
  it('F5-L1: letra elegida sola abre en C con el aviso; [Ver otras candidatas] abre A con la actual marcada; [×] la da por vista', async () => {
    const m = montar({
      resumen: {
        estado: 'borrador',
        estadoPreparacion: 'lista_para_revisar',
        preparacion: prep({ estado: 'lista_para_revisar', eleccionAutomatica: true })
      },
      letra: { lrclib_id: 9001 }
    })
    expect(
      await screen.findByText(
        /^Elegimos esta letra por ti: es la coincidencia exacta de LRCLIB y coincide/
      )
    ).toBeVisible()
    expect(m.busquedas()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    expect(m.revisada).toHaveBeenCalledWith('c1')
    expect(screen.queryByText(/Elegimos esta letra por ti/)).toBeNull()
  })

  it('F5-L9: sin comprobar usa su texto y nunca dice «coincide con tu audio»', async () => {
    montar({
      resumen: {
        estadoPreparacion: 'lista_para_revisar',
        preparacion: prep({
          estado: 'lista_para_revisar',
          eleccionAutomatica: true,
          eleccionSinComprobar: true
        })
      },
      letra: { lrclib_id: 9001 }
    })
    const aviso = (await screen.findByText('no hemos podido comprobarla con tu audio')).closest(
      '[role="status"]'
    )!
    expect(aviso).toHaveTextContent(
      'Elegimos esta letra por ti: es la coincidencia exacta de LRCLIB, pero no hemos podido comprobarla con tu audio. Pasa a menudo y no quiere decir que esté mal: al revisarla, fíjate en que vaya a tiempo con la voz.'
    )
    expect(aviso.querySelector('strong')).toHaveTextContent(
      'no hemos podido comprobarla con tu audio'
    )
    expect(screen.queryByText(/coincide con tu audio/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver otras candidatas' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cerrar aviso' })).toBeVisible()
  })

  it('con el desfase corregido usa la variante `.corregida`', async () => {
    montar({
      resumen: {
        estadoPreparacion: 'lista_para_revisar',
        preparacion: prep({
          estado: 'lista_para_revisar',
          eleccionAutomatica: true,
          desfaseCorregido: true
        })
      },
      letra: { lrclib_id: 9001, desfase_corregido_ms: 800 }
    })
    expect(await screen.findByText(/Iba 0,8 s adelantada y la hemos corregido/)).toBeVisible()
  })

  it('[Ver otras candidatas] muestra A con la lista y la letra actual seleccionada', async () => {
    const m = montar({
      resumen: {
        estadoPreparacion: 'lista_para_revisar',
        preparacion: prep({ estado: 'lista_para_revisar', eleccionAutomatica: true })
      },
      letra: { lrclib_id: 9002 }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ver otras candidatas' }))
    expect(await screen.findByText(/Letra actual/)).toBeVisible()
    const seleccionada = await screen.findByRole('option', { selected: true })
    expect(seleccionada).toHaveTextContent('Letra actual')
    expect(m.busquedas()).toBe(1)
  })

  it('F5-L2: «Elige la letra» abre en A con el aviso y su motivo', async () => {
    montar({
      resumen: { estadoPreparacion: 'elige_letra', preparacion: prep() }
    })
    expect(await screen.findByText('Elige la letra.')).toBeVisible()
    expect(
      screen.getByText(
        'No la elegimos por ti porque hay varias versiones que coinciden con tu audio.'
      )
    ).toBeVisible()
  })

  it('F5-L2: al usar una letra, la preparación continúa sola', async () => {
    const m = montar({ resumen: { estadoPreparacion: 'elige_letra', preparacion: prep() } })
    await screen.findByText('Elige la letra.')
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta letra' }))
    await waitFor(() => expect(m.preparar).toHaveBeenCalledWith(['c1']))
  })

  it('F5-L3: «No encontramos la letra» muestra su banner sin repetir la búsqueda', async () => {
    const m = montar({
      resumen: {
        estadoPreparacion: 'sin_letra',
        preparacion: prep({
          estado: 'sin_letra',
          busqueda: { resultado: 'sin_letra', candidatas: 0, motivo: null, noElige: null }
        })
      }
    })
    expect(await screen.findByText('No encontramos la letra.')).toBeVisible()
    expect(m.busquedas()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(m.busquedas()).toBe(1))
  })

  it('F5-L5: con la preparación buscando espera y no lanza otra búsqueda; al terminar lee el resultado', async () => {
    const m = montar({
      resumen: {
        estadoPreparacion: 'preparando',
        preparacion: prep({ estado: 'en_curso', paso: 'buscando_letra', busqueda: null })
      }
    })
    expect(await screen.findByText('Buscando la letra…')).toBeVisible()
    expect(m.busquedas()).toBe(0)
    const resumen = { ...m.resumen, estadoPreparacion: 'elige_letra' as const, preparacion: prep() }
    act(() => m.eventos.forEach((cb) => cb({ id: 'c1', resumen })))
    await waitFor(() => expect(m.busquedas()).toBe(1))
  })

  it('F5-L4: con «Letra pendiente» entrar reintenta la búsqueda', async () => {
    const m = montar({
      resumen: {
        estadoPreparacion: 'letra_pendiente',
        preparacion: prep({
          estado: 'error',
          busqueda: { resultado: 'pendiente', candidatas: 0, motivo: 'SIN_CONEXION', noElige: null }
        })
      }
    })
    await waitFor(() => expect(m.busquedas()).toBe(1))
  })

  it('F5-L7: sin preparación, la búsqueda se lanza al entrar como en 0.2.1', async () => {
    const m = montar({ resumen: {} })
    await waitFor(() => expect(m.busquedas()).toBe(1))
  })
})
