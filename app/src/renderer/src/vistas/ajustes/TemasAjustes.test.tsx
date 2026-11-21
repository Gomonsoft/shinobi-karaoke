import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiShinobi, CatalogoIpc } from '@shared/ipc'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { afectada, impactoCon } from '../../temas/pruebas'
import { AJ_TEMAS } from '../../temas/textos'
import {
  FICHA_PRUEBA,
  catalogoPrueba,
  temaCatalogoPrueba,
  temasFalsos,
  type TemasFalsos
} from '../biblioteca/temasFalsos'
import { TemasAjustes, reiniciarAvisoApartado } from './TemasAjustes'
import { AJT } from './textos'

const ID = {
  neon: '11111111-1111-4111-8111-111111111111',
  noche: '22222222-2222-4222-8222-222222222222',
  papel: '33333333-3333-4333-8333-333333333333',
  sol: '44444444-4444-4444-8444-444444444444'
}

const usos = (total: number) => ({
  total,
  cancion: total,
  album: 0,
  artista: 0,
  predeterminado: 0,
  aleatorio: 0,
  predeterminadoAnterior: 0
})

function catalogo(cambios: Partial<CatalogoIpc> = {}): CatalogoIpc {
  return catalogoPrueba({
    temas: [
      temaCatalogoPrueba({
        id: ID.sol,
        nombre: 'Sol',
        usos: usos(3)
      }),
      temaCatalogoPrueba({
        id: ID.noche,
        nombre: 'Noche ninja',
        usos: usos(9)
      }),
      temaCatalogoPrueba({
        id: ID.neon,
        nombre: 'Neón',
        usos: usos(14),
        grupos: { artistas: ['Queen'], albumes: [{ artista: 'Queen', album: 'A Night' }] }
      }),
      temaCatalogoPrueba({ id: ID.papel, nombre: 'Papel', usos: usos(0) })
    ],
    predeterminado: ID.noche,
    predeterminadoUsos: 9,
    ...cambios
  })
}

let t: TemasFalsos
const abrirCarpeta = vi.fn()

function montar(cat: CatalogoIpc = catalogo()) {
  t = temasFalsos(cat)
  window.shinobi = {
    temas: t.api.temas,
    alCambiarTemas: t.api.alCambiarTemas,
    sistema: { abrirCarpetaDatos: abrirCarpeta }
  } as unknown as ApiShinobi
  return render(
    <>
      <TemasAjustes />
      <ContenedorToasts />
    </>
  )
}

const selector = () => screen.getByRole('button', { name: /^Tema predeterminado:/ })
const llamadas = (metodo: string) => t.llamadas.filter((l) => l.metodo === metodo)
const lista = () => screen.getByRole('list')
const fila = (nombre: string) =>
  within(lista())
    .getAllByRole('listitem')
    .find((li) => li.getAttribute('aria-label')?.startsWith(nombre))!

async function abrirMenu(nombre: string, opcion: string) {
  fireEvent.click(within(fila(nombre)).getByRole('button', { name: `Más acciones de «${nombre}»` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: opcion }))
}

async function esperarLista() {
  await screen.findByRole('heading', { name: /^Tus temas/ })
}

beforeEach(() => {
  vi.clearAllMocks()
  reiniciarAvisoApartado()
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
})
afterEach(() => cerrarTodosLosToasts())

describe('Ajustes › Temas: estructura (A1)', () => {
  it('muestra el selector, los usos y la lista ordenada con usos y grupos', async () => {
    montar()
    await esperarLista()
    expect(screen.getByRole('heading', { level: 2, name: 'Temas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Tus temas (4)' })).toBeInTheDocument()
    expect(selector()).toHaveAccessibleName(/Noche ninja/)
    expect(screen.getByText('Ahora lo usan 9 canciones.')).toBeInTheDocument()
    expect(
      within(lista())
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label'))
    ).toEqual([
      'Neón, 14 canciones, artista Queen, 1 álbum',
      'Noche ninja, predeterminado, 9 canciones',
      'Papel, Sin usar',
      'Sol, 3 canciones'
    ])
    expect(within(fila('Noche ninja')).getByText('Predeterminado')).toBeInTheDocument()
    expect(screen.getByText(AJT.editarNota)).toBeInTheDocument()
    expect(selector()).toHaveAttribute('aria-describedby')
  })

  it('catálogo vacío: sin selector y con los textos de vacío', async () => {
    montar(catalogo({ temas: [], predeterminado: null, predeterminadoUsos: 0 }))
    await screen.findByText(AJT.vacioPredet)
    expect(screen.getByText(AJT.vacioLista)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tus temas (0)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Tema predeterminado:/ })).toBeNull()
  })

  it('sin predeterminado: el selector está en «Ninguno» con la explicación del azar', async () => {
    montar(catalogo({ predeterminado: null, predeterminadoUsos: 0 }))
    await esperarLista()
    expect(selector()).toHaveAccessibleName(`Tema predeterminado: ${AJ_TEMAS.ninguno}`)
    expect(screen.getByText(AJT.predetAzar)).toBeInTheDocument()
  })

  it('un error de carga ofrece reintentar', async () => {
    t = temasFalsos(catalogo())
    t.fallar('temas.catalogo', 'ERROR_INTERNO')
    window.shinobi = {
      temas: t.api.temas,
      alCambiarTemas: t.api.alCambiarTemas,
      sistema: { abrirCarpetaDatos: abrirCarpeta }
    } as unknown as ApiShinobi
    render(<TemasAjustes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    await esperarLista()
  })
})

describe('Ajustes › Temas: predeterminado (A2, A13, A14, A15)', () => {
  async function elegir(texto: string | RegExp) {
    fireEvent.click(selector())
    fireEvent.click(await screen.findByRole('option', { name: texto }))
  }

  it('hacia otro tema con canciones afectadas pide confirmación con foco en Cancelar', async () => {
    montar()
    await esperarLista()
    t.programarImpacto(impactoCon(9))
    await elegir(/^Neón/)
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('¿Usar «Neón» como tema predeterminado?')).toBeVisible()
    expect(
      await within(dialogo).findByText(
        'Cambiará el aspecto de 9 canciones que usan el predeterminado «Noche ninja».'
      )
    ).toBeVisible()
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Usar «Neón»' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(llamadas('temas.ejecutar')[0]?.args[0]).toEqual({
      tipo: 'predeterminado',
      temaId: ID.neon
    })
    expect(await screen.findByText('Tema predeterminado: «Neón».')).toBeVisible()
    expect(selector()).toHaveFocus()
  })

  it('sin canciones afectadas se aplica directamente, sin diálogo', async () => {
    montar()
    await esperarLista()
    t.programarImpacto(impactoCon(0))
    await elegir(/^Papel/)
    expect(await screen.findByText('Tema predeterminado: «Papel».')).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(llamadas('temas.ejecutar')).toHaveLength(1)
    expect(selector()).toHaveFocus()
  })

  it('desde «Ninguno» con canciones del estilo incluido: variante «sin anterior»', async () => {
    montar(catalogo({ predeterminado: null, predeterminadoUsos: 0 }))
    await esperarLista()
    t.programarImpacto(impactoCon(2))
    await elegir(/^Sol/)
    expect(
      await screen.findByText(
        'Cambiará el aspecto de 2 canciones que ahora usan el estilo incluido de Shinobi Karaoke.'
      )
    ).toBeVisible()
  })

  it('A13: «Ninguno» muestra el diálogo con 3 canciones y, al confirmar, el selector queda en «Ninguno»', async () => {
    montar(catalogo({ predeterminadoUsos: 3 }))
    await esperarLista()
    t.programarImpacto(
      impactoCon(3, {
        afectadas: [1, 2, 3].map((i) => afectada(String(i), { efecto: 'fija_base' }))
      })
    )
    await elegir(new RegExp(`^${AJ_TEMAS.ninguno}`))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('¿Quitar el tema predeterminado?')).toBeVisible()
    expect(
      await within(dialogo).findByText(
        'Las 3 canciones que usan «Noche ninja» lo conservarán y seguirán recibiendo sus cambios. Su aspecto no cambia.'
      )
    ).toBeVisible()
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Quitar predeterminado' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(llamadas('temas.ejecutar')[0]?.args[0]).toEqual({
      tipo: 'predeterminado',
      temaId: null
    })
    act(() => t.fijarCatalogo(catalogo({ predeterminado: null, predeterminadoUsos: 0 })))
    expect(
      await screen.findByText(
        'Sin tema predeterminado: las canciones nuevas recibirán un tema al azar.'
      )
    ).toBeVisible()
    expect(selector()).toHaveAccessibleName(`Tema predeterminado: ${AJ_TEMAS.ninguno}`)
    expect(screen.getByText(AJT.predetAzar)).toBeInTheDocument()
    expect(selector()).toHaveFocus()
  })

  it('A15: fallo en la 2.ª de 4 muestra la lista de lo que falta; el selector sigue en el tema', async () => {
    montar(catalogo({ predeterminadoUsos: 4 }))
    await esperarLista()
    t.programarImpacto(impactoCon(4))
    t.programarResultado({
      catalogoEscrito: false,
      canciones: [
        { id: '1', titulo: 'Canción 1', artista: 'Queen', estado: 'aplicada' },
        {
          id: '2',
          titulo: 'Canción 2',
          artista: 'Queen',
          estado: 'error',
          codigo: 'ERROR_INTERNO'
        },
        { id: '3', titulo: 'Canción 3', artista: 'Queen', estado: 'pendiente' },
        { id: '4', titulo: 'Canción 4', artista: 'Queen', estado: 'pendiente' }
      ]
    })
    await elegir(new RegExp(`^${AJ_TEMAS.ninguno}`))
    await screen.findByRole('button', { name: /Ver las canciones/ })
    fireEvent.click(screen.getByRole('button', { name: 'Quitar predeterminado' }))
    expect(
      await screen.findByText(AJ_TEMAS.quitar.parcial('Canción 2', 3, 'Noche ninja'))
    ).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus())
    // Cerrar devuelve el foco al selector, que sigue en el tema.
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(selector()).toHaveAccessibleName(/Noche ninja/)
    expect(selector()).toHaveFocus()
  })

  it('un fallo de escritura deja el valor anterior y muestra el toast con Reintentar', async () => {
    montar()
    await esperarLista()
    t.programarImpacto(impactoCon(0))
    t.fallar('temas.ejecutar', 'ERROR_INTERNO')
    await elegir(/^Papel/)
    expect(
      await screen.findByText('No se pudo guardar el tema. Tus cambios siguen aquí.')
    ).toBeVisible()
    expect(selector()).toHaveAccessibleName(/Noche ninja/)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(llamadas('temas.ejecutar')).toHaveLength(2))
  })

  it('«Usar como predeterminado» del ⋯ sigue el mismo flujo y no se ofrece en el predeterminado', async () => {
    montar()
    await esperarLista()
    fireEvent.click(within(fila('Noche ninja')).getByRole('button', { name: /Más acciones/ }))
    expect(screen.queryByRole('menuitem', { name: 'Usar como predeterminado' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    t.programarImpacto(impactoCon(0))
    await abrirMenu('Sol', 'Usar como predeterminado')
    expect(await screen.findByText('Tema predeterminado: «Sol».')).toBeVisible()
  })
})

describe('Ajustes › Temas: avisos de estado (A7, A7c, A8)', () => {
  it('A7c: el aviso apartado sigue al volver; ✕ lo oculta, enfoca «Temas» y llama una vez', async () => {
    const cat = catalogo({ apartado: 'temas.json.danado' })
    const vista = montar(cat)
    expect(await screen.findByText(AJT.apartado)).toBeVisible()
    vista.unmount()
    montar(cat)
    expect(await screen.findByText(AJT.apartado)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir carpeta de datos' }))
    expect(abrirCarpeta).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    expect(screen.queryByText(AJT.apartado)).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Temas' })).toHaveFocus()
    expect(llamadas('temas.descartarAvisoApartado')).toHaveLength(1)
  })

  it('con la llamada fallida sigue oculto en la sesión y sin toast', async () => {
    const cat = catalogo({ apartado: 'temas.json.danado' })
    const vista = montar(cat)
    await screen.findByText(AJT.apartado)
    t.fallar('temas.descartarAvisoApartado', 'ERROR_INTERNO')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    await waitFor(() => expect(llamadas('temas.descartarAvisoApartado')).toHaveLength(1))
    expect(screen.queryByText(AJT.apartado)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    vista.unmount()
    montar(cat)
    await esperarLista()
    expect(screen.queryByText(AJT.apartado)).toBeNull()
  })

  it('solo lectura: aviso, lista sin ⋯ y selector inactivo', async () => {
    montar(catalogo({ soloLectura: true }))
    expect(await screen.findByText(AJT.soloLectura)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Más acciones/ })).toBeNull()
    expect(selector()).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(selector())
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it.each([
    [1, '1 canción usa un tema que no está en tu lista'],
    [2, '2 canciones usan temas que no están en tu lista']
  ])('referencias que faltan (%i): singular o plural y sin mencionar grupos', async (n, inicio) => {
    montar(catalogo({ referenciasFaltantes: n }))
    const aviso = await screen.findByText(new RegExp(`^${inicio}`))
    expect(aviso).toBeVisible()
    expect(aviso.textContent).not.toMatch(/grupo|álbum|artista/i)
  })

  it('sin referencias que faltan no hay aviso', async () => {
    montar()
    await esperarLista()
    expect(screen.queryByText(/no está en tu lista|no están en tu lista/)).toBeNull()
  })
})

describe('Ajustes › Temas: borrado pendiente (A9)', () => {
  const pendiente = () =>
    catalogo({
      borradoPendiente: { temaId: ID.papel, nombre: 'Papel', total: 5, restantes: 2 },
      temas: catalogo().temas.map((x) => (x.id === ID.papel ? { ...x, enBorrado: true } : x))
    })

  it('la fila muestra el aviso y el tema no se ofrece en el selector', async () => {
    montar(pendiente())
    await esperarLista()
    expect(
      within(fila('Papel')).getByText(
        'La eliminación de este tema quedó a medias: faltan 2 de 5 canciones por guardar su aspecto.'
      )
    ).toBeVisible()
    fireEvent.click(selector())
    const opciones = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(opciones.some((o) => o?.startsWith('Papel'))).toBe(false)
  })

  it('[Terminar de eliminar] reanuda y, si vuelve a fallar, muestra el intento nuevo', async () => {
    montar(pendiente())
    await esperarLista()
    t.programarResultado({
      catalogoEscrito: false,
      canciones: [
        { id: '9', titulo: 'Otra', artista: 'Queen', estado: 'error', codigo: 'ERROR_INTERNO' },
        { id: '10', titulo: 'Última', artista: 'Queen', estado: 'pendiente' }
      ]
    })
    fireEvent.click(within(fila('Papel')).getByRole('button', { name: 'Terminar de eliminar' }))
    expect(
      await screen.findByText(/falló al guardar «Otra» y el borrado se detuvo\. Faltan 2 canciones/)
    ).toBeVisible()
    expect(llamadas('temas.reanudarBorrado')).toHaveLength(1)
  })

  it('[Terminar de eliminar] completa el borrado con toast y foco en la fila siguiente', async () => {
    montar(pendiente())
    await esperarLista()
    t.programarResultado({
      catalogoEscrito: true,
      canciones: [{ id: '9', titulo: 'Otra', artista: 'Queen', estado: 'aplicada' }]
    })
    fireEvent.click(within(fila('Papel')).getByRole('button', { name: 'Terminar de eliminar' }))
    expect(
      await screen.findByText(
        /Tema «Papel» eliminado\. 1 canción conserva su aspecto como tema personalizado\./
      )
    ).toBeVisible()
    await waitFor(() => expect(fila('Sol')).toHaveFocus())
  })

  it('[Cancelar el borrado] llama a cancelarBorrado, avisa y deja el foco en la fila', async () => {
    montar(pendiente())
    await esperarLista()
    fireEvent.click(within(fila('Papel')).getByRole('button', { name: 'Cancelar el borrado' }))
    await waitFor(() => expect(llamadas('temas.cancelarBorrado')).toHaveLength(1))
    expect(
      await screen.findByText(
        'Eliminación de «Papel» cancelada. El tema sigue disponible; 3 canciones ya conservan su aspecto como tema personalizado.'
      )
    ).toBeVisible()
    await waitFor(() => expect(fila('Papel')).toHaveFocus())
  })

  it('el ⋯ de la fila pendiente solo tiene las dos acciones', async () => {
    montar(pendiente())
    await esperarLista()
    fireEvent.click(within(fila('Papel')).getByRole('button', { name: /Más acciones/ }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Terminar de eliminar',
      'Cancelar el borrado'
    ])
  })
})

describe('Ajustes › Temas: acciones de fila (A4, A6)', () => {
  it('A4: eliminar el predeterminado incluye la frase de nuevas, anuncia y enfoca la fila siguiente', async () => {
    montar()
    await esperarLista()
    t.programarImpacto(impactoCon(9, { esPredeterminado: true }))
    t.programarResultado({
      catalogoEscrito: true,
      canciones: [{ id: '1', titulo: 'a', artista: 'b', estado: 'aplicada' }]
    })
    await abrirMenu('Noche ninja', 'Eliminar…')
    const dialogo = await screen.findByRole('dialog')
    expect(
      await within(dialogo).findByText(/Las canciones nuevas recibirán un tema al azar/)
    ).toBeVisible()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar tema' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText(AJT.anuncioPredetBorrado)).toBeInTheDocument()
    await waitFor(() => expect(fila('Papel')).toHaveFocus())
    // El catálogo vivo ya sin el tema: el selector pasa a «Ninguno».
    act(() =>
      t.fijarCatalogo(
        catalogo({
          predeterminado: null,
          predeterminadoUsos: 0,
          temas: catalogo().temas.filter((x) => x.id !== ID.noche)
        })
      )
    )
    await waitFor(() =>
      expect(selector()).toHaveAccessibleName(`Tema predeterminado: ${AJ_TEMAS.ninguno}`)
    )
    expect(document.body).not.toHaveFocus()
  })

  it('eliminar el último tema deja el foco en el encabezado «Tus temas»', async () => {
    montar(
      catalogo({
        temas: [temaCatalogoPrueba({ id: ID.sol, nombre: 'Sol' })],
        predeterminado: null,
        predeterminadoUsos: 0
      })
    )
    await esperarLista()
    t.programarImpacto(impactoCon(0))
    await abrirMenu('Sol', 'Eliminar…')
    await screen.findByText('Ninguna canción lo usa.')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar tema' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /^Tus temas/ })).toHaveFocus())
  })

  it('A6: renombrar usa el diálogo, llama a la API y deja el foco en la fila', async () => {
    montar()
    await esperarLista()
    await abrirMenu('Sol', 'Renombrar…')
    const campo = await screen.findByLabelText('Nombre del tema')
    fireEvent.change(campo, { target: { value: 'Sol naciente' } })
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(llamadas('temas.renombrar')[0]?.args[0]).toMatchObject({
      temaId: ID.sol,
      nombre: 'Sol naciente'
    })
    expect(await screen.findByText('Tema renombrado: «Sol naciente».')).toBeVisible()
    await waitFor(() => expect(fila('Sol')).toHaveFocus())
  })

  it('A6: un nombre repetido se rechaza en el campo', async () => {
    montar()
    await esperarLista()
    await abrirMenu('Sol', 'Renombrar…')
    fireEvent.change(await screen.findByLabelText('Nombre del tema'), {
      target: { value: 'papel' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
    expect(await screen.findByText('Ya tienes un tema con ese nombre.')).toBeVisible()
    expect(llamadas('temas.renombrar')).toHaveLength(0)
  })

  it('A6: duplicar propone «(copia)», avisa y enfoca la fila nueva', async () => {
    montar()
    await esperarLista()
    await abrirMenu('Sol', 'Duplicar…')
    const campo = await screen.findByLabelText('Nombre del tema')
    expect(campo).toHaveValue('Sol (copia)')
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }))
    expect(await screen.findByText('Tema «Sol (copia)» creado.')).toBeVisible()
    expect(llamadas('temas.duplicar')[0]?.args[0]).toEqual({
      temaId: ID.sol,
      nombre: 'Sol (copia)'
    })
    // La fila nueva llega con el siguiente `temas:cambiado` y recibe el foco.
    act(() =>
      t.fijarCatalogo(
        catalogo({
          temas: [
            ...catalogo().temas,
            temaCatalogoPrueba({ id: FICHA_PRUEBA, nombre: 'Sol (copia)' })
          ]
        })
      )
    )
    await waitFor(() => expect(fila('Sol (copia)')).toHaveFocus())
  })
})

describe('Ajustes › Temas: teclado (A11)', () => {
  it('roving tabindex con ↑/↓/Inicio/Fin y ⋯ solo tabulable en la fila activa', async () => {
    montar()
    await esperarLista()
    const filas = within(lista()).getAllByRole('listitem')
    expect(filas.map((f) => f.tabIndex)).toEqual([0, -1, -1, -1])
    filas[0]!.focus()
    fireEvent.keyDown(filas[0]!, { key: 'ArrowDown' })
    expect(filas[1]).toHaveFocus()
    expect(filas.map((f) => f.tabIndex)).toEqual([-1, 0, -1, -1])
    expect(within(filas[1]!).getByRole('button', { name: /Más acciones/ })).toHaveAttribute(
      'tabindex',
      '0'
    )
    expect(within(filas[0]!).getByRole('button', { name: /Más acciones/ })).toHaveAttribute(
      'tabindex',
      '-1'
    )
    fireEvent.keyDown(filas[1]!, { key: 'End' })
    expect(filas[3]).toHaveFocus()
    fireEvent.keyDown(filas[3]!, { key: 'ArrowDown' })
    expect(filas[3]).toHaveFocus()
    fireEvent.keyDown(filas[3]!, { key: 'Home' })
    expect(filas[0]).toHaveFocus()
    fireEvent.keyDown(filas[0]!, { key: 'ArrowUp' })
    expect(filas[0]).toHaveFocus()
  })

  it('la tecla Menú y Mayús + F10 abren el ⋯ de la fila', async () => {
    montar()
    await esperarLista()
    const f = fila('Sol')
    f.focus()
    fireEvent.keyDown(f, { key: 'ContextMenu' })
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    f.focus()
    fireEvent.keyDown(f, { key: 'F10', shiftKey: true })
    expect(await screen.findByRole('menu')).toBeInTheDocument()
  })
})
