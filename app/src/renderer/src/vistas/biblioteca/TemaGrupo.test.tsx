import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AgruparBiblioteca } from '@shared/config'
import type { ApiShinobi, ResumenCancionIpc } from '@shared/ipc'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto } from '../../navegacion/estado'
import { afectada, origen } from '../../temas/pruebas'
import { Biblioteca, reiniciarFiltroDeSesion } from './Biblioteca'
import { fixtures } from './fixturesApi'
import { aparienciaResumenPrueba, resumenConIdentidad } from './resumenPrueba'
import { catalogoPrueba, impactoPrueba, temaCatalogoPrueba, temasFalsos } from './temasFalsos'
import { temaAsignadoAGrupo } from './agrupacion'

const NEON = '11111111-1111-4111-8111-111111111111'
const NOCHE = '22222222-2222-4222-8222-222222222222'
const temas = [
  temaCatalogoPrueba({ id: NEON, nombre: 'Neón' }),
  temaCatalogoPrueba({ id: NOCHE, nombre: 'Noche ninja' })
]
const claveAlbum = JSON.stringify(['queen', 'greatest hits'])

const q1 = resumenConIdentidad('q1', 'Queen', 'Greatest Hits')
const q2 = resumenConIdentidad('q2', 'QUEEN', 'Greatest Hits')
const suelta = resumenConIdentidad('su', '', null)

function montar(
  canciones: () => ResumenCancionIpc[],
  catalogo = catalogoPrueba({ temas }),
  agrupar: AgruparBiblioteca = 'artista'
) {
  const t = temasFalsos(catalogo)
  const listar = vi.fn(() => Promise.resolve(canciones()))
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = fixtures({ listar, agrupar, temas: t })
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() }}>
      <Biblioteca />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { t, listar }
}

const botonTema = (nombre: string) => screen.findByRole('button', { name: nombre })

async function elegir(d: HTMLElement, nombre: RegExp) {
  fireEvent.click(within(d).getByRole('button', { name: /^Tema: / }))
  fireEvent.click(await screen.findByRole('option', { name: nombre }))
}

beforeEach(() => {
  reiniciarFiltroDeSesion()
  cerrarTodosLosToasts()
})

describe('temaAsignadoAGrupo', () => {
  const asignaciones = {
    artistas: [{ artista: 'queen', temaId: NEON }],
    albumes: [{ artista: 'queen', album: 'greatest hits', temaId: NOCHE }]
  }
  it('busca por clave, no por el nombre visible', () => {
    expect(temaAsignadoAGrupo({ id: 'artista:queen', tipo: 'artista' }, asignaciones)).toBe(NEON)
    expect(temaAsignadoAGrupo({ id: 'artista:Queen', tipo: 'artista' }, asignaciones)).toBeNull()
    expect(temaAsignadoAGrupo({ id: `album:${claveAlbum}`, tipo: 'album' }, asignaciones)).toBe(
      NOCHE
    )
    expect(temaAsignadoAGrupo({ id: 'sinArtista', tipo: 'sinArtista' }, asignaciones)).toBeNull()
  })
})

describe('temaAsignadoAGrupo con el nombre visible que emite main', () => {
  // `CatalogoIpc.asignaciones` trae la grafía visible («Queen»), no la clave (hallado en E2E, 0176).
  const asignaciones = {
    artistas: [{ artista: 'Queen', temaId: NEON }],
    albumes: [{ artista: 'Queen', album: 'A Night at the Opera', temaId: NOCHE }]
  }
  it('encuentra el tema del artista y del álbum por su clave derivada', () => {
    expect(temaAsignadoAGrupo({ id: 'artista:queen', tipo: 'artista' }, asignaciones)).toBe(NEON)
    expect(
      temaAsignadoAGrupo(
        { id: 'album:' + JSON.stringify(['queen', 'a night at the opera']), tipo: 'album' },
        asignaciones
      )
    ).toBe(NOCHE)
    expect(temaAsignadoAGrupo({ id: 'artista:abba', tipo: 'artista' }, asignaciones)).toBeNull()
  })
})

describe('Tema del encabezado de grupo (B5)', () => {
  it('muestra el tema del grupo y el botón con su nombre accesible', async () => {
    montar(
      () => [q1, q2, suelta],
      catalogoPrueba({
        temas,
        asignaciones: { artistas: [{ artista: 'queen', temaId: NEON }], albumes: [] }
      })
    )
    expect(await screen.findByText('Tema del artista: Neón')).toBeInTheDocument()
    expect(await botonTema('Tema del artista Queen…')).toHaveTextContent('Tema…')
    // «Sin artista» no es asignable: sin botón y con su texto.
    expect(screen.getAllByRole('button', { name: /^Tema del artista/ })).toHaveLength(1)
    expect(
      screen.getByText('Añade el artista con «Editar datos» para darles un tema.')
    ).toBeInTheDocument()
  })

  it('en álbum usa la clave del par artista + álbum', async () => {
    montar(
      () => [q1],
      catalogoPrueba({
        temas,
        asignaciones: {
          artistas: [],
          albumes: [{ artista: 'queen', album: 'greatest hits', temaId: NOCHE }]
        }
      }),
      'album'
    )
    expect(await screen.findByText('Tema del álbum: Noche ninja')).toBeInTheDocument()
    await botonTema('Tema del álbum Greatest Hits…')
  })

  it('un grupo sin tema propio lo dice', async () => {
    montar(() => [q1])
    expect(await screen.findByText('Sin tema de artista')).toBeInTheDocument()
  })

  it('un tema en borrado pendiente se ve con aviso y permite elegir otro', async () => {
    montar(
      () => [q1],
      catalogoPrueba({
        temas: [{ ...temas[0]!, enBorrado: true }, temas[1]!],
        asignaciones: { artistas: [{ artista: 'queen', temaId: NEON }], albumes: [] }
      })
    )
    expect(await screen.findByText(/Neón: eliminación sin terminar/)).toBeInTheDocument()
    fireEvent.click(await botonTema('Tema del artista Queen…'))
    const d = await screen.findByRole('dialog', { name: 'Tema del artista Queen' })
    expect(within(d).getByRole('button', { name: /^Tema: / })).toBeInTheDocument()
  })

  it('catálogo vacío: inactivo con su motivo', async () => {
    montar(() => [q1], catalogoPrueba({ temas: [] }))
    const b = await botonTema('Tema del artista Queen…')
    await waitFor(() => expect(b).toHaveAttribute('aria-disabled', 'true'))
    expect(
      screen.getAllByText('Aún no tienes temas. Crea uno desde el editor de una canción.').length
    ).toBeGreaterThan(0)
  })

  it('catálogo en solo lectura: inactivo con su motivo', async () => {
    montar(() => [q1], catalogoPrueba({ temas, soloLectura: true }))
    const b = await botonTema('Tema del artista Queen…')
    await waitFor(() => expect(b).toHaveAttribute('aria-disabled', 'true'))
    expect(screen.getAllByText(/Tus temas son de una versión más nueva/).length).toBeGreaterThan(0)
  })

  it('aplicar: asignarGrupo, toast, refresco único y foco de vuelta en el botón', async () => {
    let apariencia = aparienciaResumenPrueba()
    const { t, listar } = montar(() => [{ ...q1, apariencia }, q2])
    t.programarImpacto(
      impactoPrueba({ afectadas: [afectada('q1'), afectada('q2')], totalGrupo: 2 })
    )
    const boton = await botonTema('Tema del artista Queen…')
    fireEvent.click(boton)
    const d = await screen.findByRole('dialog', { name: 'Tema del artista Queen' })
    await elegir(d, /Neón/)
    expect(
      await within(d).findByText('Cambiará el aspecto de sus 2 canciones.')
    ).toBeInTheDocument()
    expect(document.querySelector('[data-tarjeta="q1"] [data-linea-tema]')?.textContent).toBe(
      'Tema personalizado'
    )

    apariencia = aparienciaResumenPrueba({
      procedencia: 'artista',
      temaId: NEON,
      temaNombre: 'Neón',
      modo: 'heredar'
    })
    const antes = listar.mock.calls.length
    fireEvent.click(within(d).getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(t.llamadas.find((l) => l.metodo === 'temas.ejecutar')!.args[0]).toMatchObject({
      tipo: 'asignarGrupo',
      nivel: 'artista',
      artista: 'Queen'
    })
    expect(await screen.findByText(/Artista Queen: tema «/)).toBeInTheDocument()
    expect(boton).toHaveFocus()

    // ADR 0016 §9: un temas:cambiado vuelve a pedir listar() una vez y actualiza la tarjeta en su sitio.
    act(() => t.emitirCambio())
    await waitFor(() => expect(listar.mock.calls.length).toBe(antes + 1))
    await waitFor(() =>
      expect(document.querySelector('[data-tarjeta="q1"] [data-linea-tema]')?.textContent).toBe(
        'Neón · del artista'
      )
    )
    expect(
      Array.from(document.querySelectorAll('[data-tarjeta]')).map((n) =>
        n.getAttribute('data-tarjeta')
      )
    ).toEqual(['q1', 'q2'])
  })

  it('B5b: quitar con destinos distintos y uno no disponible', async () => {
    const { t } = montar(
      () => [q1, q2],
      catalogoPrueba({
        temas,
        asignaciones: {
          artistas: [],
          albumes: [{ artista: 'queen', album: 'greatest hits', temaId: NEON }]
        }
      }),
      'album'
    )
    t.programarImpacto(
      impactoPrueba({
        totalGrupo: 2,
        afectadas: [
          afectada('q1', { titulo: 'Uno', despues: origen('respaldo') }),
          afectada('q2', { titulo: 'Dos', despues: origen('predeterminado', 'Sol') })
        ]
      })
    )
    fireEvent.click(await botonTema('Tema del álbum Greatest Hits…'))
    const d = await screen.findByRole('dialog')
    fireEvent.click(within(d).getByRole('button', { name: /^Tema: / }))
    fireEvent.click(await screen.findByRole('option', { name: /Sin tema de álbum/ }))
    expect(await within(d).findByText(/1 canción pasará a usar «Sol»/)).toBeInTheDocument()
    expect(within(d).getByText(/1 de ellas quedará como «Tema no disponible»/)).toBeInTheDocument()
    fireEvent.click(within(d).getByRole('button', { name: /Ver las canciones/ }))
    expect(within(d).getByText(/se verá con el último aspecto guardado/)).toBeInTheDocument()
  })

  it('un error al guardar avisa con toast y cierra', async () => {
    const { t } = montar(() => [q1])
    t.programarImpacto(impactoPrueba({ afectadas: [afectada('q1')], totalGrupo: 1 }))
    fireEvent.click(await botonTema('Tema del artista Queen…'))
    const d = await screen.findByRole('dialog')
    await elegir(d, /Neón/)
    await within(d).findByText('Cambiará el aspecto de su canción.')
    t.fallar('temas.ejecutar', 'ERROR_INTERNO')
    fireEvent.click(within(d).getByRole('button', { name: 'Aplicar' }))
    expect(
      await screen.findByText('No se pudo guardar el tema. Tus cambios siguen aquí.')
    ).toBeInTheDocument()
  })
})
