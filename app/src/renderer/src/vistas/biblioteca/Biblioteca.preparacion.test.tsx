import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ApiShinobi, ResumenCancionIpc, TandaPreparacionIpc } from '@shared/ipc'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { ReproductorContexto, type ControlReproductor } from '../../navegacion/reproductor'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { publicarAvisoReanudacion } from './avisoReanudacion'
import { Biblioteca, reiniciarFiltroDeSesion } from './Biblioteca'
import { contarImportantes, detectarDudosas } from '@shared/dudosas'
import { fixtures } from './fixturesApi'
import { paso, resumenPrueba } from './resumenPrueba'

const letraHecha = { letra: paso('completado') }
const pasos = (letra: 'completado' | 'pendiente') => ({
  fuente: paso('completado'),
  separacion: paso('completado'),
  letra: paso(letra),
  edicion: paso('pendiente')
})
const prep = (extra: Partial<NonNullable<ResumenCancionIpc['preparacion']>> = {}) => ({
  estado: 'lista_para_revisar' as const,
  paso: null,
  busqueda: null,
  dudosas: 0,
  revisada: false,
  eleccionAutomatica: false,
  desfaseCorregido: false,
  ...extra
})

const revisar = resumenPrueba({
  id: 'r1',
  titulo: 'Semestre de Otoño',
  pasos: { ...pasos('completado'), ...letraHecha },
  estadoPreparacion: 'lista_para_revisar',
  preparacion: prep({ eleccionAutomatica: true, desfaseCorregido: true })
})
const elige = resumenPrueba({
  id: 'e1',
  titulo: 'Eco de Plata',
  pasos: pasos('pendiente'),
  estadoPreparacion: 'elige_letra',
  preparacion: prep({
    estado: 'elige_letra',
    busqueda: { resultado: 'elige', candidatas: 3, motivo: null, noElige: null }
  })
})
const sinLetra = resumenPrueba({
  id: 's1',
  titulo: 'Sin Rastro',
  pasos: pasos('pendiente'),
  estadoPreparacion: 'sin_letra',
  preparacion: prep({
    estado: 'sin_letra',
    busqueda: {
      resultado: 'sin_letra',
      candidatas: 0,
      motivo: 'LETRA_NO_ENCONTRADA',
      noElige: null
    }
  })
})
const pendiente = resumenPrueba({
  id: 'p1',
  titulo: 'Sin Red',
  pasos: pasos('pendiente'),
  estadoPreparacion: 'letra_pendiente',
  preparacion: prep({
    estado: 'error',
    busqueda: { resultado: 'pendiente', candidatas: 0, motivo: 'SIN_CONEXION', noElige: null }
  })
})
const lista = resumenPrueba({ id: 'l1', titulo: 'Ya Cantada', estado: 'lista' })

const tandaPrueba: TandaPreparacionIpc = {
  total: 3,
  terminadas: 3,
  pausada: false,
  motivoPausa: null,
  estimacionMin: null,
  descargasParadas: null,
  canciones: [
    { id: 'r1', resultado: 'lista_para_revisar', dudosas: 2 },
    { id: 'e1', resultado: 'elige_letra' },
    { id: 's1', resultado: 'error', motivo: 'VIDEO_NO_DISPONIBLE' }
  ]
}

function montar(
  canciones: ResumenCancionIpc[],
  {
    preparacion = {},
    vista = { tipo: 'biblioteca' },
    abrir = vi.fn<ControlReproductor['abrir']>()
  }: {
    preparacion?: Partial<ApiShinobi['preparacion']>
    vista?: Vista
    abrir?: ReturnType<typeof vi.fn<ControlReproductor['abrir']>>
  } = {}
) {
  const ir = vi.fn<(v: Vista) => void>()
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = fixtures({
    listar: () => Promise.resolve(canciones),
    preparacion,
    biblioteca: { marcarLista: () => Promise.resolve({ ...revisar, estado: 'lista' }) }
  })
  render(
    <NavegacionContexto.Provider value={{ vista, ir }}>
      <ReproductorContexto.Provider value={{ abrir, abierto: null }}>
        <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
          <Biblioteca />
        </TrabajosContexto.Provider>
      </ReproductorContexto.Provider>
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { ir, abrir }
}

const tarjeta = async (titulo: string) =>
  (await screen.findAllByRole('article')).find((a) =>
    a.getAttribute('aria-label')?.startsWith(`${titulo},`)
  )!

beforeEach(() => {
  reiniciarFiltroDeSesion()
  cerrarTodosLosToasts()
  publicarAvisoReanudacion(null)
})
afterEach(cleanup)

describe('tarjeta «Lista para revisar»', () => {
  it('F5-B1/B5: insignia, línea de origen, Revisar y Probar; sin A la cola', async () => {
    montar([revisar])
    const t = await tarjeta('Semestre de Otoño')
    expect(within(t).getByText('Lista para revisar')).toBeInTheDocument()
    expect(within(t).getByText('Letra elegida automáticamente · desfase corregido')).toBeVisible()
    expect(within(t).getByRole('button', { name: 'Revisar «Semestre de Otoño»' })).toBeVisible()
    expect(
      within(t).getByRole('button', { name: 'Probar «Semestre de Otoño» a pantalla completa' })
    ).toBeVisible()
    expect(within(t).queryByRole('button', { name: /A la cola/ })).toBeNull()
  })

  it('sin línea de origen cuando la letra no la eligió la app', async () => {
    montar([{ ...revisar, preparacion: prep({ eleccionAutomatica: false }) }])
    const t = await tarjeta('Semestre de Otoño')
    expect(within(t).queryByText(/elegida automáticamente/)).toBeNull()
  })

  it('«Revisar» abre el editor; «Probar» abre el reproductor en prueba y, al salir, ofrece marcarla', async () => {
    const { ir, abrir } = montar([revisar])
    const t = await tarjeta('Semestre de Otoño')
    fireEvent.click(within(t).getByRole('button', { name: /^Revisar/ }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'r1', paso: 'editor', revisar: true })
    fireEvent.click(within(t).getByRole('button', { name: /^Probar/ }))
    expect(abrir).toHaveBeenCalledWith('r1', expect.objectContaining({ prueba: true }))
    act(() => abrir.mock.calls[0]![1]!.alCerrar!())
    expect(await screen.findByText('¿Qué tal «Semestre de Otoño»?')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como lista' }))
    await waitFor(() =>
      expect(ir).toHaveBeenCalledWith({
        tipo: 'biblioteca',
        enfocar: { id: 'r1', resaltar: true }
      })
    )
  })
})

describe('revisión guiada en la tarjeta (feature 11)', () => {
  const con = (dudosas: number) =>
    resumenPrueba({
      ...revisar,
      preparacion: prep({ dudosas }),
      revision: { dudosas, dudosasImportantes: dudosas }
    } as ResumenCancionIpc)

  it('F11-B1: línea ⚑ con las pendientes y «Sin líneas dudosas»; las Listas no la muestran', async () => {
    montar([con(4), { ...lista }])
    const t = await tarjeta('Semestre de Otoño')
    expect(within(t).getByText('4 líneas por revisar')).toBeVisible()
    expect(within(await tarjeta('Ya Cantada')).queryByText(/por revisar/)).toBeNull()
  })

  it('F11-B1: con 1 en singular y con 0 «Sin líneas dudosas»', async () => {
    montar([con(1)])
    expect(
      within(await tarjeta('Semestre de Otoño')).getByText('1 línea por revisar')
    ).toBeVisible()
    cleanup()
    montar([con(0)])
    expect(within(await tarjeta('Semestre de Otoño')).getByText('Sin líneas dudosas')).toBeVisible()
  })

  it('F11-B3: «Marcar como lista» con pendientes pregunta; «Marcar igualmente» marca sin abrir el editor', async () => {
    const { ir } = montar([con(4)])
    const t = await tarjeta('Semestre de Otoño')
    fireEvent.click(within(t).getByRole('button', { name: /Más acciones/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como lista' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Marcar como lista sin revisar?' })
    expect(dialogo).toHaveTextContent('«Semestre de Otoño» tiene 4 líneas que conviene escuchar')
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Revisar ahora' })).toHaveFocus()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Marcar igualmente' }))
    await waitFor(() =>
      expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca', enfocar: { id: 'r1', resaltar: true } })
    )
    expect(ir).not.toHaveBeenCalledWith(expect.objectContaining({ paso: 'editor' }))
  })

  it('F11-B3: «Revisar ahora» abre el editor con la revisión; sin pendientes marca sin diálogo', async () => {
    const { ir } = montar([con(2)])
    fireEvent.click(
      within(await tarjeta('Semestre de Otoño')).getByRole('button', { name: /Más acciones/ })
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como lista' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar ahora' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'r1', paso: 'editor', revisar: true })
    cleanup()
    const otra = montar([con(0)])
    fireEvent.click(
      within(await tarjeta('Semestre de Otoño')).getByRole('button', { name: /Más acciones/ })
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como lista' }))
    expect(screen.queryByRole('dialog', { name: /sin revisar/ })).toBeNull()
    await waitFor(() =>
      expect(otra.ir).toHaveBeenCalledWith({
        tipo: 'biblioteca',
        enfocar: { id: 'r1', resaltar: true }
      })
    )
  })

  it('D1: una «Lista para revisar» sin registro muestra ⚑ y pregunta con `revision`; sin él lo pide a main', async () => {
    const sinRegistro = resumenPrueba({
      ...revisar,
      preparacion: null,
      revision: { dudosas: 3, dudosasImportantes: 3 }
    } as ResumenCancionIpc)
    montar([sinRegistro])
    const t = await tarjeta('Semestre de Otoño')
    expect(within(t).getByText('3 líneas por revisar')).toBeVisible()
    fireEvent.click(within(t).getByRole('button', { name: /Más acciones/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como lista' }))
    expect(
      await screen.findByRole('dialog', { name: '¿Marcar como lista sin revisar?' })
    ).toBeVisible()
    cleanup()
    // `revision: null` (aún sin calcular): pide `recuentoRevision` antes de decidir.
    const recuentoRevision = vi.fn(() => Promise.resolve({ dudosas: 2, dudosasImportantes: 2 }))
    montar([{ ...sinRegistro, revision: null }])
    ;(window as unknown as { shinobi: ApiShinobi }).shinobi.biblioteca.recuentoRevision =
      recuentoRevision
    fireEvent.click(
      within(await tarjeta('Semestre de Otoño')).getByRole('button', { name: /Más acciones/ })
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como lista' }))
    expect(
      await screen.findByRole('dialog', { name: '¿Marcar como lista sin revisar?' })
    ).toBeVisible()
    expect(recuentoRevision).toHaveBeenCalledWith('r1')
  })

  it('el toast tras «Probar» también pregunta con pendientes', async () => {
    const { abrir } = montar([con(3)])
    const t = await tarjeta('Semestre de Otoño')
    fireEvent.click(within(t).getByRole('button', { name: /^Probar/ }))
    act(() => abrir.mock.calls[0]![1]!.alCerrar!())
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como lista' }))
    expect(
      await screen.findByRole('dialog', { name: '¿Marcar como lista sin revisar?' })
    ).toBeVisible()
  })
})

describe('F11-B3: la Biblioteca decide como el editor', () => {
  const lin = (
    id: string,
    ini: number,
    fin: number | null,
    texto = 'frase de prueba inventada'
  ) => ({
    id,
    tipo: 'linea' as const,
    texto,
    inicio_ms: ini,
    fin_ms: fin,
    palabras: null
  })
  /** Lo que main guarda: total e importantes salen de las mismas funciones que usa el editor. */
  const recuento = (lineas: ReturnType<typeof lin>[], voz: [number, number][]) => {
    const d = detectarDudosas({ lineas, offset_ms: 0 }, { intervalos: voz }, { duracionMs: 30_000 })
    return { dudosas: d.length, dudosasImportantes: contarImportantes(d) }
  }

  it('solo motivos de fin automático o de ritmo: el editor no pregunta y la Biblioteca tampoco', async () => {
    // Dos líneas de 0,5 s con mucho texto (`muyCorta`) y voz en las dos.
    const r = recuento(
      [lin('a', 2000, null, 'x'.repeat(40)), lin('b', 2500, null, 'y'.repeat(40))],
      [[2000, 3000]]
    )
    expect(r.dudosas).toBeGreaterThan(0)
    expect(r.dudosasImportantes).toBe(0)
    const { ir } = montar([
      resumenPrueba({ ...revisar, preparacion: prep(r), revision: r } as ResumenCancionIpc)
    ])
    fireEvent.click(
      within(await tarjeta('Semestre de Otoño')).getByRole('button', { name: /Más acciones/ })
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como lista' }))
    expect(screen.queryByRole('dialog', { name: /sin revisar/ })).toBeNull()
    await waitFor(() =>
      expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca', enfocar: { id: 'r1', resaltar: true } })
    )
  })

  it('una línea sin voz es importante: pregunta con ese número y la línea ⚑ sigue con el total', async () => {
    const r = recuento(
      [lin('a', 2000, 5000), lin('b', 8000, 11_000), lin('c', 12_000, 12_600, 'z'.repeat(40))],
      [
        [2000, 5050],
        [12_000, 12_600]
      ]
    )
    expect(r.dudosasImportantes).toBeGreaterThan(0)
    expect(r.dudosas).toBeGreaterThan(r.dudosasImportantes)
    montar([resumenPrueba({ ...revisar, preparacion: prep(r), revision: r } as ResumenCancionIpc)])
    const t = await tarjeta('Semestre de Otoño')
    expect(within(t).getByText(`${r.dudosas} líneas por revisar`)).toBeVisible()
    expect(t).toHaveAccessibleName(new RegExp(`${r.dudosas} líneas por revisar`))
    fireEvent.click(within(t).getByRole('button', { name: /Más acciones/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como lista' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Marcar como lista sin revisar?' })
    expect(dialogo).toHaveTextContent(
      `tiene ${r.dudosasImportantes === 1 ? '1 línea que conviene' : `${r.dudosasImportantes} líneas que conviene`} escuchar`
    )
  })
})

describe('líneas de resultado de la búsqueda', () => {
  it('F5-B4: elige, no encontrada y pendiente con su botón', async () => {
    const preparar = vi.fn(() => Promise.resolve({ aceptadas: ['p1'], omitidas: [] }))
    const { ir } = montar([elige, sinLetra, pendiente], { preparacion: { preparar } })
    const te = await tarjeta('Eco de Plata')
    expect(within(te).getByText('Elige la letra · 3 candidatas')).toBeVisible()
    fireEvent.click(within(te).getByRole('button', { name: /^Elegir la letra/ }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'e1', paso: 'letra' })
    const ts = await tarjeta('Sin Rastro')
    expect(within(ts).getByText('No encontramos la letra')).toBeVisible()
    expect(within(ts).getByRole('button', { name: /^Añadir la letra/ })).toBeVisible()
    const tp = await tarjeta('Sin Red')
    expect(within(tp).getByText('Letra pendiente: sin conexión')).toBeVisible()
    fireEvent.click(within(tp).getByRole('button', { name: /^Reintentar/ }))
    expect(preparar).toHaveBeenCalledWith(['p1'])
  })
})

describe('motivo de «Letra pendiente»', () => {
  it('distingue el servicio caído de la falta de conexión', async () => {
    const servicio = {
      ...pendiente,
      id: 'p2',
      titulo: 'Servicio Caído',
      preparacion: prep({
        estado: 'error',
        busqueda: {
          resultado: 'pendiente',
          candidatas: 0,
          motivo: 'SERVICIO_NO_DISPONIBLE',
          noElige: null
        }
      })
    }
    montar([servicio])
    const t = await tarjeta('Servicio Caído')
    expect(within(t).getByText('Letra pendiente: el servicio no responde')).toBeVisible()
  })
})

describe('«Preparar»', () => {
  it('F5-B6: está en el ⋯ de un borrador sin letra, avisa y no está en Listas ni en Lista para revisar', async () => {
    const preparar = vi.fn(() => Promise.resolve({ aceptadas: ['b1'], omitidas: [] }))
    const sinBuscar = resumenPrueba({
      id: 'b1',
      titulo: 'Borrador Nuevo',
      pasos: pasos('pendiente')
    })
    montar([sinBuscar, lista, revisar], { preparacion: { preparar } })
    const t = await tarjeta('Borrador Nuevo')
    fireEvent.click(within(t).getByRole('button', { name: /Más acciones/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Preparar/ }))
    expect(preparar).toHaveBeenCalledWith(['b1'])
    expect(
      await screen.findByText('Preparando «Borrador Nuevo». Te avisaremos al terminar.')
    ).toBeVisible()
    for (const titulo of ['Ya Cantada', 'Semestre de Otoño']) {
      const o = await tarjeta(titulo)
      fireEvent.click(within(o).getByRole('button', { name: /Más acciones/ }))
      expect(screen.queryByRole('menuitem', { name: /Preparar/ })).toBeNull()
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    }
  })
})

describe('bandeja de pendientes', () => {
  it('F5-B7: cuenta, filtra a Borradores, se quita al pulsar otra vez y no existe con todo a 0', async () => {
    montar([revisar, elige, sinLetra, lista])
    const grupo = await screen.findByRole('group', { name: 'Pendientes de ti:' })
    const casillaRevisar = within(grupo).getByRole('button', { name: '1 lista para revisar' })
    expect(within(grupo).getByRole('button', { name: '2 esperan letra' })).toBeVisible()
    expect(within(grupo).queryByRole('button', { name: /con error/ })).toBeNull()
    fireEvent.click(within(grupo).getByRole('button', { name: '2 esperan letra' }))
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('radio', { name: /^Borradores/ })).toBeChecked()
    fireEvent.click(casillaRevisar)
    expect(screen.getAllByRole('article')).toHaveLength(1)
    fireEvent.click(casillaRevisar)
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  it('sin pendientes, la fila no existe', async () => {
    montar([lista])
    await screen.findAllByRole('article')
    expect(screen.queryByRole('group', { name: 'Pendientes de ti:' })).toBeNull()
  })

  it('elegir otro filtro de estado quita la casilla', async () => {
    montar([revisar, elige, lista])
    fireEvent.click(await screen.findByRole('button', { name: '1 lista para revisar' }))
    fireEvent.click(screen.getByRole('radio', { name: /^Todas/ }))
    expect(screen.getByRole('button', { name: '1 lista para revisar' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  it('llegar con la casilla pedida (Ajustes) la activa', async () => {
    montar([revisar, elige, lista], { vista: { tipo: 'biblioteca', casilla: 'letra' } })
    await screen.findAllByRole('article')
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1))
  })
})

describe('reanudación y resultado', () => {
  it('F5-B9: [Detener] pausa la cola y pasa al aviso de pausa; [Reanudar] la retoma', async () => {
    const pausar = vi.fn(() => Promise.resolve())
    const reanudar = vi.fn(() => Promise.resolve())
    montar([lista], { preparacion: { pausar, reanudar } })
    await screen.findAllByRole('article')
    act(() => publicarAvisoReanudacion({ tipo: 'retomando', n: 2 }))
    expect(screen.getByText('Retomando 2 canciones que quedaron a medias al cerrar.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Detener' }))
    expect(await screen.findByText('Hay 2 canciones en pausa, a medio preparar.')).toBeVisible()
    expect(pausar).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }))
    await waitFor(() => expect(reanudar).toHaveBeenCalled())
  })

  it('abrirResultado abre «Resultado de la preparación» con la tanda y sus acciones', async () => {
    const reintentarFallidas = vi.fn(() => Promise.resolve())
    const { ir } = montar([revisar, elige, sinLetra], {
      vista: { tipo: 'biblioteca', abrirResultado: true },
      preparacion: { tanda: () => Promise.resolve(tandaPrueba), reintentarFallidas }
    })
    const d = await screen.findByRole('dialog', { name: 'Resultado de la preparación' })
    expect(
      await within(d).findByText(/3 canciones: 1 lista para revisar · 1 espera letra · 1 con error/)
    ).toBeVisible()
    expect(within(d).getByText(/2 líneas por revisar/)).toBeVisible()
    fireEvent.click(within(d).getByRole('button', { name: 'Revisar' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'r1', paso: 'editor', revisar: true })
  })
})

describe('aviso de un lote recién añadido (bib.import.anadidas)', () => {
  it('dice cuántas canciones se añadieron, abre la actividad y se cierra con [×]', async () => {
    const abrir = vi.fn()
    window.addEventListener('shinobi:abrir-actividad', abrir)
    montar([resumenPrueba({ id: 'a', titulo: 'Tema uno' })], {
      vista: { tipo: 'biblioteca', lote: { n: 5, conLetra: true } }
    })
    expect(
      await screen.findByText('Se añadieron 5 canciones y se están preparando solas.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver actividad' }))
    expect(abrir).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el aviso' }))
    expect(screen.queryByText(/Se añadieron 5 canciones/)).toBeNull()
    window.removeEventListener('shinobi:abrir-actividad', abrir)
  })

  it('con la búsqueda automática desactivada lo dice', async () => {
    montar([resumenPrueba({ id: 'a', titulo: 'Tema uno' })], {
      vista: { tipo: 'biblioteca', lote: { n: 3, conLetra: false } }
    })
    expect(
      await screen.findByText(
        'Se añadieron 3 canciones. Se están separando; la letra tendrás que buscarla tú.'
      )
    ).toBeInTheDocument()
  })
})
