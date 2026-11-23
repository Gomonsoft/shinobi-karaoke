import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  crearApiExportacionFalsa,
  exportacionDePrueba,
  ID_CARPETA,
  ID_LOTE,
  type ApiExportacionFalsa
} from '@shared/__fixtures__/exportacion'
import type { ExportacionIpc } from '@shared/exportacion'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { SesionContexto, sesionVacia } from '../../sesion/ProveedorSesion'
import { useExportaciones } from '../contexto'
import { cancionIpcDePrueba, instalarApiExportacion } from '../pruebas'
import { ProveedorExportacion } from '../ProveedorExportacion'
import type { LoteVista } from './modelo'
import { esNoIntentada, filasDelLote, minutosRestantes, reintentables, resumirLote } from './modelo'
import { reiniciarSiExiste } from './useFormularioLote'

const IDS = ['c1', 'c2', 'c3']
const trabajo = (i: number) => `b0000000-0000-4000-8000-${String(i + 10).padStart(12, '0')}`

function Disparador() {
  const { abrirLote, verLote } = useExportaciones()
  return (
    <>
      <button
        onClick={() =>
          abrirLote(IDS, [{ id: 'c9', titulo: 'Rota', artista: 'Z', motivo: 'danada' }])
        }
      >
        Abrir lote
      </button>
      <button onClick={() => verLote(ID_LOTE)}>Ver lote</button>
    </>
  )
}

const hecho = (i: number, extra: Partial<ExportacionIpc> = {}) =>
  exportacionDePrueba({
    trabajoId: trabajo(i),
    cancionId: IDS[i],
    titulo: `Tema ${IDS[i]}`,
    loteId: ID_LOTE,
    estado: 'terminada',
    resultado: 'completada',
    progreso: null,
    bytes: 30_000_000,
    archivo: `Tema ${IDS[i]} (karaoke).mkv`,
    iniciadaEn: '2026-11-20T10:00:00.000Z',
    terminadaEn: '2026-11-20T10:01:00.000Z',
    ...extra
  })

async function montar(api: ApiExportacionFalsa = crearApiExportacionFalsa()) {
  instalarApiExportacion({
    exportacion: api,
    extra: {
      biblioteca: {
        obtener: (id: string) =>
          Promise.resolve(
            cancionIpcDePrueba({
              id,
              metadatos: { ...cancionIpcDePrueba().metadatos, titulo: `Tema ${id}` }
            })
          )
      }
    }
  })
  render(
    <SesionContexto.Provider value={sesionVacia}>
      <ProveedorExportacion>
        <Disparador />
      </ProveedorExportacion>
      <ContenedorToasts />
    </SesionContexto.Provider>
  )
  await act(async () => undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir lote' }))
  return api
}

const emitir = (api: ApiExportacionFalsa, e: ExportacionIpc) => act(() => api.emitirCambio(e))
const llamada = (api: ApiExportacionFalsa, nombre: string) =>
  api.llamadas.filter((l) => l[0] === nombre)

beforeEach(() => {
  cerrarTodosLosToasts()
  reiniciarSiExiste()
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('modelo del lote', () => {
  it('«no intentada» es una cancelada con error; sin error la canceló el usuario', () => {
    const detenida = hecho(1, {
      resultado: 'cancelada',
      error: { codigo: 'SIN_ESPACIO', mensaje: 'x', posicionMs: null }
    })
    const usuario = hecho(2, { resultado: 'cancelada', error: null })
    expect(esNoIntentada(detenida)).toBe(true)
    expect(esNoIntentada(usuario)).toBe(false)
    const lote: LoteVista = {
      loteId: ID_LOTE,
      canciones: IDS.map((id) => ({ id, titulo: id, artista: 'a' })),
      trabajos: { c1: trabajo(0), c2: trabajo(1), c3: trabajo(2) },
      ronda: IDS,
      omitidas: [],
      carpeta: '/x',
      opciones: { audio: 'instrumental', formato: 'mkv_av1', ancho: 1280, alto: 720, fps: 30 },
      iniciadoEn: 0
    }
    const filas = filasDelLote(lote, [hecho(0), detenida, usuario])
    expect(reintentables(filas).map((f) => f.cancion.id)).toEqual(['c2'])
    const r = resumirLote(filas)
    expect(r).toMatchObject({ total: 3, terminadas: 3, completadas: 1, acabado: true })
    expect(r.detenidoPor?.trabajoId).toBe(trabajo(1))
  })

  it('el tiempo restante espera 15 s y no retrocede la estimación a cero', () => {
    expect(minutosRestantes(0.5, 10_000)).toBeNull()
    expect(minutosRestantes(0.5, 600_000)).toBe(10)
    expect(minutosRestantes(0, 600_000)).toBeNull()
  })
})

describe('diálogo de lote (G)', () => {
  it('abre con la carpeta ya rellena, sin diálogo del sistema, y las mismas opciones que A', async () => {
    const api = await montar()
    const d = await screen.findByRole('dialog', { name: 'Exportar 3 videos' })
    await waitFor(() =>
      expect(within(d).getByLabelText(/Guardar en la carpeta, /)).toHaveValue(
        '/home/usuario/Videos'
      )
    )
    expect(llamada(api, 'destinoCarpeta')).toEqual([['destinoCarpeta']])
    expect(within(d).getByText(/3 canciones · /)).toBeInTheDocument()
    expect(
      within(d).getByRole('radiogroup', { name: 'Si ya existe un video con el mismo nombre' })
    ).toBeInTheDocument()
    expect(within(d).getByRole('radio', { name: 'Conservar los dos' })).toBeChecked()
    expect(await within(d).findByText(/Ocuparán unos 240 MB/)).toBeInTheDocument()
    expect(within(d).getByText('Cada video usa el estilo de su canción.')).toBeInTheDocument()
    fireEvent.click(within(d).getByRole('button', { name: 'Ver cuáles' }))
    expect(within(d).getByText(/Rota — Z · Está dañada/)).toBeInTheDocument()
  })

  it('[Cambiar…] pasa el carpetaId; con null conserva la anterior', async () => {
    const api = crearApiExportacionFalsa()
    await montar(api)
    const d = await screen.findByRole('dialog', { name: 'Exportar 3 videos' })
    const campo = await within(d).findByLabelText(/Guardar en la carpeta, \/home/)
    ;(api.api as unknown as { destinoCarpeta: unknown }).destinoCarpeta = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ carpetaId: ID_CARPETA, ruta: '/mnt/usb/Karaoke', libreBytes: 10 })
    fireEvent.click(within(d).getByRole('button', { name: 'Cambiar…' }))
    await act(async () => undefined)
    expect(campo).toHaveValue('/home/usuario/Videos')
    fireEvent.click(within(d).getByRole('button', { name: 'Cambiar…' }))
    await waitFor(() => expect(campo).toHaveValue('/mnt/usb/Karaoke'))
    expect(
      (api.api as unknown as { destinoCarpeta: ReturnType<typeof vi.fn> }).destinoCarpeta
    ).toHaveBeenCalledWith(ID_CARPETA)
    // Con 10 bytes libres se avisa del espacio.
    expect(within(d).getByText(/Puede que no quepan/)).toBeInTheDocument()
  })

  it('sin dato de espacio libre no hay aviso de espacio', async () => {
    const api = crearApiExportacionFalsa({
      destinoCarpeta: { carpetaId: ID_CARPETA, ruta: '/x/V', libreBytes: null }
    })
    await montar(api)
    const d = await screen.findByRole('dialog', { name: 'Exportar 3 videos' })
    await within(d).findByLabelText(/Guardar en la carpeta, \/x\/V/)
    expect(within(d).queryByText(/Puede que no quepan/)).toBeNull()
  })

  it('«Exportar 3 videos» manda las opciones, la carpeta y «si ya existe», y pasa a H', async () => {
    const api = await montar()
    const d = await screen.findByRole('dialog', { name: 'Exportar 3 videos' })
    await within(d).findByLabelText(/Guardar en la carpeta, \/home/)
    fireEvent.click(within(d).getByRole('radio', { name: 'Omitir esa canción' }))
    fireEvent.click(within(d).getByRole('button', { name: 'Exportar 3 videos' }))
    const h = await screen.findByRole('dialog', { name: 'Exportando 3 videos' })
    const [, peticion] = llamada(api, 'iniciarLote')[0]!
    expect(peticion).toMatchObject({
      cancionIds: IDS,
      carpetaId: ID_CARPETA,
      siExiste: 'omitir',
      audio: 'instrumental'
    })
    expect(within(h).getByText('0 de 3 terminados · Calculando tiempo…')).toBeInTheDocument()
    expect(within(h).getAllByText(/En cola/)).toHaveLength(3)
    expect(within(h).getByRole('button', { name: 'Seguir en segundo plano' })).toHaveFocus()
  })
})

describe('qué existe ya en la carpeta (G, 0388)', () => {
  const fila = (cancionId: string, extra: object = {}) => ({
    cancionId,
    archivo: `Tema ${cancionId} (karaoke).mkv`,
    existe: false,
    accion: 'nuevo' as const,
    ...extra
  })
  const previa =
    (existe: string[], omitir = false) =>
    (p: { cancionIds: string[] }) => ({
      filas: p.cancionIds.map((id) =>
        existe.includes(id)
          ? fila(
              id,
              omitir
                ? { existe: true, accion: 'omitir', motivo: 'YA_EXISTE' }
                : { existe: true, accion: 'numerar', archivo: `Tema ${id} (karaoke) (2).mkv` }
            )
          : fila(id)
      ),
      exportables: p.cancionIds.length - (omitir ? existe.length : 0)
    })

  it('avisa de las que ya tienen un video y «Ver cuáles» muestra el nombre de cada archivo', async () => {
    const api = crearApiExportacionFalsa({ previsualizarLote: previa(['c2']) })
    await montar(api)
    const d = await screen.findByRole('dialog', { name: 'Exportar 3 videos' })
    expect(
      await within(d).findByText(
        '1 de estas canciones ya tienen un video en esta carpeta: se guardarán con « (2)» en el nombre.'
      )
    ).toBeInTheDocument()
    fireEvent.click(within(d).getByRole('button', { name: 'Ver cuáles' }))
    expect(within(d).getByText(/→ Tema c1 \(karaoke\)\.mkv/)).toBeInTheDocument()
    expect(within(d).getByText(/→ Tema c2 \(karaoke\) \(2\)\.mkv/)).toBeInTheDocument()
    expect(within(d).getByText(/Ya hay un video con este nombre/)).toBeInTheDocument()
    const [, peticion] = llamada(api, 'previsualizarLote')[0]!
    expect(peticion).toMatchObject({ cancionIds: IDS, carpetaId: ID_CARPETA, siExiste: 'numerar' })
  })

  it('con «omitir» el botón dice el número real, y vuelve a pedirse al cambiar «si ya existe»', async () => {
    const api = crearApiExportacionFalsa({
      previsualizarLote: (p: { cancionIds: string[]; siExiste: string }) =>
        previa(['c2'], p.siExiste === 'omitir')(p)
    })
    await montar(api)
    const d = await screen.findByRole('dialog', { name: 'Exportar 3 videos' })
    await within(d).findByText(/ya tienen un video en esta carpeta/)
    fireEvent.click(within(d).getByRole('radio', { name: 'Omitir esa canción' }))
    expect(await within(d).findByRole('button', { name: 'Exportar 2 videos' })).toBeInTheDocument()
    expect(
      within(d).getByText('1 canciones no se exportarán porque ya tienen un video en esta carpeta.')
    ).toBeInTheDocument()
    expect(
      llamada(api, 'previsualizarLote').map((l) => (l[1] as { siExiste: string }).siExiste)
    ).toEqual(['numerar', 'omitir'])
  })

  it('al cambiar de carpeta se vuelve a pedir con el carpetaId nuevo', async () => {
    const nueva = {
      carpetaId: 'c0000000-0000-4000-8000-000000000077',
      ruta: '/x/Otra',
      libreBytes: null
    }
    const api = crearApiExportacionFalsa({
      destinoCarpeta: (desde?: string) =>
        desde ? nueva : { carpetaId: ID_CARPETA, ruta: '/home/usuario/Videos', libreBytes: null }
    })
    await montar(api)
    const d = await screen.findByRole('dialog', { name: 'Exportar 3 videos' })
    await within(d).findByLabelText(/Guardar en la carpeta, \/home/)
    fireEvent.click(within(d).getByRole('button', { name: 'Cambiar…' }))
    await within(d).findByLabelText(/Guardar en la carpeta, \/x\/Otra/)
    await waitFor(() =>
      expect(
        llamada(api, 'previsualizarLote').map((l) => (l[1] as { carpetaId: string }).carpetaId)
      ).toEqual([ID_CARPETA, nueva.carpetaId])
    )
  })
})

async function enH(api: ApiExportacionFalsa = crearApiExportacionFalsa()) {
  await montar(api)
  const d = await screen.findByRole('dialog', { name: 'Exportar 3 videos' })
  await within(d).findByLabelText(/Guardar en la carpeta, \/home/)
  fireEvent.click(within(d).getByRole('button', { name: 'Exportar 3 videos' }))
  await screen.findByRole('dialog', { name: 'Exportando 3 videos' })
  return api
}

describe('seguimiento (H) y resultado (I)', () => {
  it('muestra el progreso y, al terminar, el resultado con foco en «Mostrar la carpeta»', async () => {
    const api = await enH()
    await emitir(api, hecho(0))
    await emitir(api, hecho(1))
    expect(screen.getByText(/2 de 3 terminados/)).toBeInTheDocument()
    await emitir(api, hecho(2))
    const i = await screen.findByRole('dialog', { name: 'Videos exportados' })
    expect(within(i).getByText(/Se exportaron 3 videos · 90 MB · tardó 1 min/)).toBeInTheDocument()
    expect(within(i).getByText('En /home/usuario/Videos')).toBeInTheDocument()
    expect(within(i).getByText(/Tema c1 \(karaoke\)\.mkv/)).toBeInTheDocument()
    expect(within(i).getByRole('button', { name: 'Mostrar la carpeta' })).toHaveFocus()
    // Con el diálogo abierto no sale ningún toast.
    expect(screen.queryByText(/^3 videos exportados\.$/)).toBeNull()
  })

  it('con el diálogo cerrado: un solo toast del lote y ninguno por video; [Ver resultado] abre I', async () => {
    const api = await enH()
    fireEvent.click(screen.getByRole('button', { name: 'Seguir en segundo plano' }))
    await emitir(api, hecho(0))
    await emitir(
      api,
      hecho(1, {
        resultado: 'error',
        bytes: null,
        error: { codigo: 'MEMORIA_INSUFICIENTE', mensaje: 'x', posicionMs: null }
      })
    )
    expect(screen.queryByText(/video exportado\./)).toBeNull()
    await emitir(api, hecho(2))
    expect(await screen.findByText('Se exportaron 2 de 3 videos.')).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('status')
        .some((n) => /no se pudo exportar el video/.test(n.textContent ?? ''))
    ).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))
    const i = await screen.findByRole('dialog', { name: 'Videos exportados' })
    expect(
      within(i).getByText('Tu equipo se quedó sin memoria.', { exact: false })
    ).toBeInTheDocument()
  })

  it('un lote detenido: las no intentadas entran en «Reintentar las fallidas»; la cancelada a mano, no', async () => {
    const api = await enH()
    await emitir(api, hecho(0))
    await emitir(
      api,
      hecho(1, {
        resultado: 'error',
        bytes: null,
        error: { codigo: 'MEMORIA_INSUFICIENTE', mensaje: 'x', posicionMs: null }
      })
    )
    await emitir(
      api,
      hecho(2, {
        resultado: 'cancelada',
        bytes: null,
        error: { codigo: 'SIN_ESPACIO', mensaje: 'x', posicionMs: null }
      })
    )
    const i = await screen.findByRole('dialog', { name: 'Videos exportados' })
    expect(within(i).getByText(/El lote se detuvo/)).toBeInTheDocument()
    expect(within(i).getByText(/No se intentó: el lote se detuvo\./)).toBeInTheDocument()
    ;(api.api as unknown as { reintentarLote: unknown }).reintentarLote = vi
      .fn()
      .mockResolvedValue({
        loteId: ID_LOTE,
        encoladas: [
          { cancionId: 'c2', trabajoId: trabajo(5) },
          { cancionId: 'c3', trabajoId: trabajo(6) }
        ],
        omitidas: []
      })
    fireEvent.click(within(i).getByRole('button', { name: 'Reintentar las fallidas' }))
    const h = await screen.findByRole('dialog', { name: 'Exportando 2 videos' })
    expect(within(h).getAllByText(/En cola/)).toHaveLength(2)
  })

  it('si todas fallaron por algo que repetir no arregla, el botón es «Cambiar opciones» y vuelve a G con ellas', async () => {
    const api = await enH()
    await emitir(api, hecho(0))
    const sinEspacio = { codigo: 'SIN_ESPACIO', mensaje: 'x', posicionMs: null } as const
    await emitir(api, hecho(1, { resultado: 'error', bytes: null, error: sinEspacio }))
    await emitir(api, hecho(2, { resultado: 'cancelada', bytes: null, error: sinEspacio }))
    const i = await screen.findByRole('dialog', { name: 'Videos exportados' })
    expect(within(i).queryByRole('button', { name: 'Reintentar las fallidas' })).toBeNull()
    fireEvent.click(within(i).getByRole('button', { name: 'Cambiar opciones' }))
    const g = await screen.findByRole('dialog', { name: 'Exportar 2 videos' })
    await within(g).findByLabelText(/Guardar en la carpeta, /)
    const [, previa] = llamada(api, 'previsualizarLote').at(-1)!
    expect(previa).toMatchObject({ cancionIds: ['c2', 'c3'] })
    expect(llamada(api, 'reintentarLote')).toEqual([])
  })

  it('«Mostrar la carpeta» abre la carpeta del lote por su loteId', async () => {
    const api = await enH()
    for (const k of [0, 1, 2]) await emitir(api, hecho(k))
    const i = await screen.findByRole('dialog', { name: 'Videos exportados' })
    fireEvent.click(within(i).getByRole('button', { name: 'Mostrar la carpeta' }))
    await waitFor(() =>
      expect(llamada(api, 'mostrarCarpetaLote')).toEqual([['mostrarCarpetaLote', ID_LOTE]])
    )
    expect(llamada(api, 'mostrarEnCarpeta')).toEqual([])
  })

  it('«Cancelar las que faltan» pide confirmación y llama a cancelarLote; [✕] de una fila en cola no pregunta', async () => {
    const api = await enH()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar «Tema c2» de este lote' }))
    await waitFor(() => expect(llamada(api, 'cancelar')).toEqual([['cancelar', trabajo(1)]]))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar las que faltan' }))
    expect(
      screen.getByText('¿Cancelar las 3 que faltan? Los 0 videos ya terminados se conservan.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seguir exportando' })).toHaveFocus()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar las que faltan' }).at(-1)!)
    await waitFor(() => expect(llamada(api, 'cancelarLote')).toEqual([['cancelarLote', ID_LOTE]]))
  })

  it('«Ver exportación» de una canción del lote abre H, no B', async () => {
    const api = await enH()
    fireEvent.click(screen.getByRole('button', { name: 'Seguir en segundo plano' }))
    await emitir(
      api,
      exportacionDePrueba({ trabajoId: trabajo(0), cancionId: 'c1', loteId: ID_LOTE })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ver lote' }))
    expect(await screen.findByRole('dialog', { name: 'Exportando 3 videos' })).toBeInTheDocument()
  })
})
