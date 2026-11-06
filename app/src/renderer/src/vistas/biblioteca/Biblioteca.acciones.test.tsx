import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ApiShinobi, EventoCancionIpc, ResumenCancionIpc, TrabajoIpc } from '@shared/ipc'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { TrabajosContexto, type EstadoTrabajos } from '../../trabajos/useTrabajos'
import { Biblioteca, reiniciarFiltroDeSesion } from './Biblioteca'
import { fixtures } from './fixturesApi'
import { paso as pasoPrueba, resumenPrueba } from './resumenPrueba'

const lista = resumenPrueba({ id: 'a', titulo: 'Canción lista', estado: 'lista' })
const incompleta = resumenPrueba({
  id: 'b',
  titulo: 'Casi lista',
  estado: 'lista',
  incompleta: true,
  lineasSinSincronizar: 2
})
const borrador = resumenPrueba({ id: 'c', titulo: 'La flaca', artista: 'Jarabe de Palo' })
const danada = resumenPrueba({
  id: 'd',
  titulo: 'Rota',
  danada: true,
  motivo: 'json',
  pasos: null,
  estilo: null
})

type Biblio = Partial<ApiShinobi['biblioteca']>

function montar(
  canciones: ResumenCancionIpc[],
  biblioteca: Biblio = {},
  trabajos?: EstadoTrabajos
) {
  const ir = vi.fn<(v: Vista) => void>()
  let emitir: (e: EventoCancionIpc) => void = () => undefined
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = fixtures({
    listar: () => Promise.resolve(canciones),
    alCambiarCancion: (cb) => {
      emitir = cb
      return () => undefined
    },
    biblioteca
  })
  const arbol = (
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir }}>
      <TrabajosContexto.Provider
        value={trabajos ?? { trabajos: [], progreso: {}, terminado: false }}
      >
        <Biblioteca />
      </TrabajosContexto.Provider>
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  render(arbol)
  return { ir, emitir: (e: EventoCancionIpc) => act(() => emitir(e)) }
}

const titulos = () => screen.queryAllByRole('article').map((t) => t.getAttribute('data-tarjeta'))

beforeEach(() => {
  reiniciarFiltroDeSesion()
  cerrarTodosLosToasts()
})

describe('filtros y búsqueda', () => {
  it('muestra los recuentos y una lista incompleta aparece en Listas y cuenta en su recuento', async () => {
    montar([lista, incompleta, borrador, danada])
    await screen.findAllByRole('article')
    expect(screen.getByRole('radio', { name: 'Todas 4' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Listas 2' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Borradores 1' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Listas 2' }))
    expect(titulos()).toEqual(['a', 'b'])
    fireEvent.click(screen.getByRole('radio', { name: 'Borradores 1' }))
    expect(titulos()).toEqual(['c'])
    fireEvent.click(screen.getByRole('radio', { name: 'Todas 4' }))
    expect(titulos()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('el filtro persiste al volver a montar la vista (sesión)', async () => {
    montar([lista, borrador])
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('radio', { name: 'Borradores 1' }))
    cleanup()
    montar([lista, borrador])
    await screen.findAllByRole('article')
    expect(screen.getByRole('radio', { name: 'Borradores 1' })).toBeChecked()
    expect(titulos()).toEqual(['c'])
  })

  it('busca por título y artista sin distinguir mayúsculas ni tildes', async () => {
    montar([
      resumenPrueba({ id: 'x', titulo: 'Canción', artista: 'Ñandú' }),
      resumenPrueba({ id: 'y', titulo: 'Otra', artista: 'Nadie' })
    ])
    await screen.findAllByRole('article')
    const campo = screen.getByRole('searchbox', { name: 'Buscar título o artista' })
    fireEvent.change(campo, { target: { value: 'CANCION' } })
    expect(titulos()).toEqual(['x'])
    fireEvent.change(campo, { target: { value: 'nandu' } })
    expect(titulos()).toEqual(['x'])
  })

  it('sin resultados: mensaje con el texto y "Borrar búsqueda"; Esc vacía el campo; Ctrl+F enfoca', async () => {
    montar([lista, borrador])
    await screen.findAllByRole('article')
    const campo = screen.getByRole('searchbox')
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true })
    expect(campo).toHaveFocus()
    fireEvent.change(campo, { target: { value: 'zzz' } })
    expect(screen.getByText('No hay canciones que coincidan con «zzz».')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar búsqueda' }))
    expect(campo).toHaveValue('')
    expect(titulos()).toEqual(['a', 'c'])
    fireEvent.change(campo, { target: { value: 'flaca' } })
    fireEvent.keyDown(campo, { key: 'Escape' })
    expect(campo).toHaveValue('')
  })

  it('Cmd+F también enfoca', async () => {
    montar([lista])
    await screen.findAllByRole('article')
    fireEvent.keyDown(document, { key: 'f', metaKey: true })
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it('filtro Listas sin canciones listas: mensaje bib.sinlistas', async () => {
    montar([borrador])
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('radio', { name: 'Listas 0' }))
    expect(
      screen.getByText(
        'Aún no tienes canciones listas. Termina un borrador y márcalo como lista para poder cantarlo aquí.'
      )
    ).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'abc' } })
    expect(screen.getByText('No hay canciones listas que coincidan con «abc».')).toBeInTheDocument()
  })

  it('sin resultados con filtro Listas / Borradores: textos propios, Borrar búsqueda y Ver todas', async () => {
    montar([lista, borrador])
    await screen.findAllByRole('article')
    const campo = screen.getByRole('searchbox')
    fireEvent.change(campo, { target: { value: 'zzz' } })
    // Todas: solo «Borrar búsqueda».
    expect(screen.queryByRole('button', { name: 'Ver todas' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Listas 1' }))
    expect(screen.getByText('No hay canciones listas que coincidan con «zzz».')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrar búsqueda' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Borradores 1' }))
    expect(screen.getByText('No hay borradores que coincidan con «zzz».')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }))
    expect(screen.getByRole('radio', { name: 'Todas 2' })).toBeChecked()
    expect(campo).toHaveValue('zzz')
    expect(screen.getByText('No hay canciones que coincidan con «zzz».')).toBeInTheDocument()
  })

  it('Borradores vacío sin texto: bib.sinborradores y sin botones', async () => {
    montar([lista])
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('radio', { name: 'Borradores 0' }))
    expect(
      screen.getByText(
        'No tienes borradores. Las canciones que añadas aparecerán aquí hasta que las marques como listas.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ver todas' })).toBeNull()
  })

  it('las flechas se mueven solo entre las tarjetas filtradas', async () => {
    montar([lista, borrador, incompleta])
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('radio', { name: 'Listas 2' }))
    const t = screen.getAllByRole('article')
    t[0]!.focus()
    fireEvent.keyDown(t[0]!, { key: 'ArrowRight' })
    expect(t[1]).toHaveFocus()
    fireEvent.keyDown(t[1]!, { key: 'ArrowRight' })
    expect(t[1]).toHaveFocus()
  })
})

async function abrirMenu(titulo: string) {
  const tarjeta = (await screen.findAllByRole('article')).find((a) =>
    a.getAttribute('aria-label')?.startsWith(`${titulo},`)
  )!
  fireEvent.click(within(tarjeta).getByRole('button', { name: `Más acciones de «${titulo}»` }))
  return tarjeta
}
const opciones = () => screen.getAllByRole('menuitem').map((m) => m.textContent)

describe('menú ⋯', () => {
  it('ofrece las opciones de cada estado', async () => {
    montar([lista, borrador, danada])
    await abrirMenu('Canción lista')
    expect(opciones()).toEqual([
      'Reproducir',
      'Editar',
      'Editar datos',
      'Volver a borrador',
      'Mostrar en la carpeta',
      'Eliminar…'
    ])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await abrirMenu('La flaca')
    expect(opciones()).toEqual(['Continuar', 'Editar datos', 'Mostrar en la carpeta', 'Eliminar…'])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await abrirMenu('Canción sin nombre')
    expect(opciones()).toEqual(['Mostrar en la carpeta', 'Eliminar…'])
    // M3: separador de 1 px antes de «Eliminar…», no interactivo.
    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })

  it('se abre con la tecla Menú y con Mayús+F10', async () => {
    montar([lista])
    const t = await screen.findByRole('article')
    t.focus()
    fireEvent.keyDown(t, { key: 'ContextMenu' })
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.keyDown(t, { key: 'F10', shiftKey: true })
    expect(await screen.findByRole('menu')).toBeInTheDocument()
  })
})

describe('Editar datos', () => {
  const cancionConAlbum = {
    metadatos: { titulo: 'Canción lista', artista: 'Artista', album: 'Disco', duracion_ms: 1000 }
  }

  it('precarga los datos, exige título y guarda recortando espacios', async () => {
    const actualizarMetadatos = vi.fn().mockResolvedValue(lista)
    montar([lista], {
      obtener: () => Promise.resolve(cancionConAlbum as never),
      actualizarMetadatos
    })
    await abrirMenu('Canción lista')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar datos' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar datos' })
    const titulo = within(dialogo).getByLabelText('Título')
    expect(titulo).toHaveValue('Canción lista')
    expect(within(dialogo).getByLabelText('Álbum (opcional)')).toHaveValue('Disco')

    fireEvent.change(titulo, { target: { value: '   ' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialogo).findByText('Escribe un título.')).toBeInTheDocument()
    expect(actualizarMetadatos).not.toHaveBeenCalled()

    fireEvent.change(titulo, { target: { value: '  Nuevo  ' } })
    fireEvent.change(within(dialogo).getByLabelText('Artista'), { target: { value: ' Yo ' } })
    fireEvent.change(within(dialogo).getByLabelText('Álbum (opcional)'), {
      target: { value: '  ' }
    })
    expect(within(dialogo).getByLabelText('Título')).toHaveAttribute('maxlength', '200')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(actualizarMetadatos).toHaveBeenCalledWith('a', {
        titulo: 'Nuevo',
        artista: 'Yo',
        album: null
      })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('Volver a borrador', () => {
  it('pide confirmación con el texto de la spec y llama al servicio', async () => {
    const volverABorrador = vi.fn().mockResolvedValue(borrador)
    montar([lista], { volverABorrador })
    await abrirMenu('Canción lista')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Volver a borrador' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Volver a borrador?' })
    expect(
      within(dialogo).getByText(
        '«Canción lista» dejará de poder reproducirse hasta que la marques como lista otra vez. No se pierde nada.'
      )
    ).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(volverABorrador).not.toHaveBeenCalled()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Volver a borrador' }))
    await waitFor(() => expect(volverABorrador).toHaveBeenCalledWith('a'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('Eliminar…', () => {
  it('Cancelar no elimina nada', async () => {
    const eliminar = vi.fn().mockResolvedValue(undefined)
    montar([lista], { eliminar })
    await abrirMenu('Canción lista')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(eliminar).not.toHaveBeenCalled()
  })

  it('confirma, elimina y muestra el toast bib.toast.eliminada', async () => {
    const eliminar = vi.fn().mockResolvedValue(undefined)
    montar([lista, borrador], { eliminar })
    await abrirMenu('Canción lista')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar…' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Eliminar «Canción lista»?' })
    expect(
      within(dialogo).getByText(
        'Se moverá a la papelera de tu sistema, con sus pistas y su letra. Podrás recuperarla desde allí.'
      )
    ).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(eliminar).toHaveBeenCalledWith('a'))
    expect(await screen.findByText('«Canción lista» se movió a la papelera.')).toBeInTheDocument()
  })

  it('con un trabajo en curso el texto añade "Se cancelará la separación en curso."', async () => {
    const trabajo: TrabajoIpc = {
      id: 't1',
      cancionId: 'c',
      paso: 'separacion',
      cola: 'pesada',
      comando: 'demo',
      estado: 'en_curso',
      posicion: null,
      resultado: null,
      error: null,
      progreso: null
    }
    montar([borrador], {}, { trabajos: [trabajo], progreso: {}, terminado: false })
    const t = await abrirMenu('La flaca')
    void t
    fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar…' }))
    expect(
      await screen.findByText(
        /Podrás recuperarla desde allí\. Se cancelará la separación en curso\./
      )
    ).toBeInTheDocument()
  })

  it('si la papelera falla: toast de error con "Copiar detalles" y la canción sigue', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribir },
      configurable: true
    })
    const eliminar = vi
      .fn()
      .mockRejectedValue({ codigo: 'ERROR_INTERNO', mensaje: 'No se pudo usar la papelera' })
    montar([lista], { eliminar })
    await abrirMenu('Canción lista')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(
      await screen.findByText('No se pudo mover «Canción lista» a la papelera.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar detalles' }))
    expect(escribir).toHaveBeenCalledWith('ERROR_INTERNO: No se pudo usar la papelera')
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('Supr sobre la tarjeta abre el diálogo de eliminar', async () => {
    montar([lista])
    const t = await screen.findByRole('article')
    t.focus()
    fireEvent.keyDown(t, { key: 'Delete' })
    expect(
      await screen.findByRole('dialog', { name: '¿Eliminar «Canción lista»?' })
    ).toBeInTheDocument()
  })
})

describe('Reintentar, Cancelar trabajo y Re-separar pistas (0070)', () => {
  const trabajo = (extra: Partial<TrabajoIpc> = {}): TrabajoIpc => ({
    id: 't1',
    cancionId: 'c',
    paso: 'separacion',
    cola: 'pesada',
    comando: 'demo',
    estado: 'en_curso',
    posicion: null,
    resultado: null,
    error: null,
    progreso: null,
    ...extra
  })
  const conError = (paso: 'fuente' | 'separacion', codigo: string) =>
    resumenPrueba({
      id: 'c',
      titulo: 'La flaca',
      pasos: {
        fuente: pasoPrueba(paso === 'fuente' ? 'error' : 'completado', {
          error: paso === 'fuente' ? { codigo, mensaje: '' } : null
        }),
        separacion: pasoPrueba(paso === 'separacion' ? 'error' : 'pendiente', {
          error: paso === 'separacion' ? { codigo, mensaje: '' } : null
        }),
        letra: pasoPrueba('pendiente'),
        edicion: pasoPrueba('pendiente')
      }
    })
  const api = () => {
    const mocks = {
      reintentar: vi.fn().mockResolvedValue(undefined),
      separar: vi.fn().mockResolvedValue(undefined),
      cancelar: vi.fn().mockResolvedValue(true)
    }
    return mocks
  }
  const instalar = (m: ReturnType<typeof api>) =>
    Object.assign(window.shinobi, {
      fuente: { reintentar: m.reintentar },
      separacion: { separar: m.separar },
      trabajos: { cancelar: m.cancelar }
    })

  it('Reintentar relanza la fuente de YouTube sin navegar', async () => {
    const m = api()
    const { ir } = montar([conError('fuente', 'SIN_CONEXION')])
    instalar(m)
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar «La flaca»' }))
    await waitFor(() => expect(m.reintentar).toHaveBeenCalledWith('c'))
    expect(ir).not.toHaveBeenCalled()
  })

  it('Reintentar relanza la separación sin navegar', async () => {
    const m = api()
    const { ir } = montar([conError('separacion', 'MEMORIA_INSUFICIENTE')])
    instalar(m)
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar «La flaca»' }))
    await waitFor(() => expect(m.separar).toHaveBeenCalledWith('c'))
    expect(ir).not.toHaveBeenCalled()
  })

  it('Reintentar usa el paso del resumen actualizado de la tarjeta', async () => {
    const m = api()
    const { ir, emitir } = montar([conError('separacion', 'MEMORIA_INSUFICIENTE')])
    instalar(m)
    await screen.findByRole('button', { name: 'Reintentar «La flaca»' })
    emitir({ id: 'c', resumen: conError('fuente', 'SIN_CONEXION') })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar «La flaca»' }))
    expect(m.reintentar).toHaveBeenCalledOnce()
    expect(m.reintentar).toHaveBeenCalledWith('c')
    expect(m.separar).not.toHaveBeenCalled()
    expect(ir).not.toHaveBeenCalled()
  })

  it('error no reintentable: Ver abre el progreso, sin relanzar', async () => {
    const m = api()
    const { ir } = montar([conError('fuente', 'VIDEO_NO_DISPONIBLE')], {
      obtener: () => Promise.resolve(null)
    })
    instalar(m)
    expect(await screen.findByRole('button', { name: 'Ver «La flaca»' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull()
    expect(m.reintentar).not.toHaveBeenCalled()
    void ir
  })

  it('si el reintento falla: toast de error con el texto del código', async () => {
    const m = api()
    m.reintentar.mockRejectedValue({ codigo: 'SIN_CONEXION', mensaje: 'x' })
    montar([conError('fuente', 'SIN_CONEXION')])
    instalar(m)
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar «La flaca»' }))
    expect(m.reintentar).toHaveBeenCalledWith('c')
    expect(await screen.findByTestId('toast')).toHaveTextContent('Sin conexión a internet')
  })

  it('Cancelar trabajo en cola: sin diálogo', async () => {
    const m = api()
    montar(
      [borrador],
      {},
      {
        trabajos: [trabajo({ cancionId: 'c', estado: 'en_cola', posicion: 1 })],
        progreso: {},
        terminado: false
      }
    )
    instalar(m)
    await abrirMenu('La flaca')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancelar trabajo' }))
    await waitFor(() => expect(m.cancelar).toHaveBeenCalledWith('t1'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    ['separacion', '¿Cancelar la separación?', 'Cancelar separación'],
    ['fuente', '¿Cancelar la descarga?', 'Cancelar descarga']
  ] as const)(
    'Cancelar trabajo en curso (%s): diálogo y cancelación',
    async (paso, titulo, boton) => {
      const m = api()
      montar(
        [borrador],
        {},
        {
          trabajos: [trabajo({ cancionId: 'c', paso })],
          progreso: {},
          terminado: false
        }
      )
      instalar(m)
      await abrirMenu('La flaca')
      fireEvent.click(screen.getByRole('menuitem', { name: 'Cancelar trabajo' }))
      expect(await screen.findByRole('dialog', { name: titulo })).toBeInTheDocument()
      expect(m.cancelar).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: boton }))
      await waitFor(() => expect(m.cancelar).toHaveBeenCalledWith('t1'))
    }
  )

  it('sin trabajo vivo no hay Cancelar trabajo', async () => {
    montar([borrador])
    await abrirMenu('La flaca')
    expect(opciones()).not.toContain('Cancelar trabajo')
  })

  describe('Re-separar pistas', () => {
    const sinPistas = resumenPrueba({
      id: 'p',
      titulo: 'Sin pistas',
      danada: true,
      motivo: 'pistas'
    })

    it('solo en dañadas por pistas con mezcla; llama a separar', async () => {
      const m = api()
      montar([sinPistas])
      instalar(m)
      await abrirMenu('Sin pistas')
      expect(opciones()).toEqual(['Re-separar pistas', 'Mostrar en la carpeta', 'Eliminar…'])
      fireEvent.click(screen.getByRole('menuitem', { name: 'Re-separar pistas' }))
      await waitFor(() => expect(m.separar).toHaveBeenCalledWith('p'))
    })

    it('no aparece en dañada por JSON, sin mezcla ni en una lista (p. ej. hecha con Rápido)', async () => {
      montar([
        danada,
        { ...sinPistas, id: 'q', titulo: 'Sin mezcla', sinMezcla: true },
        resumenPrueba({ id: 'r', titulo: 'Con Rápido', estado: 'lista' })
      ])
      await abrirMenu('Canción sin nombre')
      expect(opciones()).not.toContain('Re-separar pistas')
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
      await abrirMenu('Sin mezcla')
      expect(opciones()).not.toContain('Re-separar pistas')
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
      await abrirMenu('Con Rápido')
      expect(opciones()).not.toContain('Re-separar pistas')
    })

    it('con la separación en cola la tarjeta dice "En cola para separar"', async () => {
      montar(
        [sinPistas],
        {},
        {
          trabajos: [trabajo({ cancionId: 'p', estado: 'en_cola', posicion: 1 })],
          progreso: {},
          terminado: false
        }
      )
      expect(await screen.findByText('En cola para separar')).toBeInTheDocument()
      await abrirMenu('Sin pistas')
      expect(opciones()).toEqual(['Cancelar trabajo', 'Mostrar en la carpeta', 'Eliminar…'])
    })
  })
})
