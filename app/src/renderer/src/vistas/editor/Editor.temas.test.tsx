import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { confirmarBorradorAlCerrar, type GuardaSalida } from '../../navegacion/salida'
import type { AparienciaResumenIpc, DestinoHeredarIpc } from '@shared/ipc'
import { estiloPredeterminado, type Estilo } from '@shared/estilo'
import {
  catalogoPrueba,
  ID_TEMA_PRUEBA,
  impactoPrueba,
  temaCatalogoPrueba,
  temasFalsos
} from '../biblioteca/temasFalsos'
import { Editor } from './Editor'
import { apiEditorFalsa, cancionSincronizadaLrclib } from './fixturesApi'

const motor = vi.hoisted(() => ({
  usarPista: vi.fn(async () => undefined),
  posicionMs: vi.fn(() => 4200),
  buscar: vi.fn(),
  pausar: vi.fn(),
  liberarAudio: vi.fn(),
  reproducir: vi.fn(async () => undefined),
  fijarVelocidad: vi.fn(),
  fijarBucle: vi.fn(() => true),
  suscribir: vi.fn(() => () => undefined),
  estado: vi.fn(() => ({ sonando: false, duracionMs: 30_000, pista: 'original', velocidad: 1 }))
}))

vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => ({
    motor,
    estado: { sonando: false, pista: 'original', velocidad: 1, duracionMs: 30_000 }
  })
}))

const SOL = '11111111-1111-4111-8111-111111111111'
const NEON = '22222222-2222-4222-8222-222222222222'

const estiloNeon: Estilo = {
  ...estiloPredeterminado(),
  fondo: { tipo: 'solido', color: '#112233' }
}

function catalogo(extra: Parameters<typeof catalogoPrueba>[0] = {}) {
  return catalogoPrueba({
    temas: [
      temaCatalogoPrueba({
        id: SOL,
        nombre: 'Sol',
        usos: { ...temaCatalogoPrueba().usos, total: 3 }
      }),
      temaCatalogoPrueba({ id: NEON, nombre: 'Neón', estilo: estiloNeon })
    ],
    ...extra
  })
}

const heredaAnterior: Partial<AparienciaResumenIpc> = {
  modo: 'heredar',
  procedencia: 'predeterminado_anterior',
  temaId: SOL,
  temaNombre: 'Sol',
  neutra: false,
  alHeredar: { procedencia: 'predeterminado_anterior', temaId: SOL, temaNombre: 'Sol' }
}

interface Opciones {
  apariencia?: Partial<AparienciaResumenIpc>
  catalogo?: ReturnType<typeof catalogoPrueba>
  disco?: 'tema' | 'heredar'
  pestana?: 'estilo'
}

async function montar(o: Opciones = {}) {
  const cancion = cancionSincronizadaLrclib()
  cancion.metadatos.artista = 'Queen'
  cancion.metadatos.album = 'Ópera'
  if (o.disco === 'heredar') cancion.apariencia = { modo: 'heredar' }
  if (o.disco === 'tema') cancion.apariencia = { modo: 'tema', tema_id: NEON }
  const temas = temasFalsos()
  temas.fijarCatalogo(o.catalogo ?? catalogo())
  const falso = apiEditorFalsa({ cancion, temas, apariencia: o.apariencia })
  window.shinobi = falso.api as unknown as typeof window.shinobi
  const ir = vi.fn()
  const guardas: GuardaSalida[] = []
  const vista: Vista = { tipo: 'cancion', id: cancion.id, paso: 'editor', pestana: o.pestana }
  const utils = render(
    <NavegacionContexto.Provider
      value={{
        vista,
        ir,
        registrarGuardaSalida: (fn) => {
          guardas.push(fn)
          return () => undefined
        }
      }}
    >
      <Editor id={cancion.id} />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  await screen.findByRole('heading', { name: 'Editor', hidden: true })
  if (o.pestana !== 'estilo') fireEvent.click(await screen.findByRole('radio', { name: 'Estilo' }))
  await screen.findByRole('heading', { name: 'Tema' })
  return { ...falso, temas, ir, guardas, ...utils, cancion }
}

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre })
const llamadasApariencia = (llamadas: { metodo: string; args: unknown[] }[]) =>
  llamadas.filter((l) => l.metodo === 'biblioteca.guardarApariencia')
const anuncios = () => document.querySelector('[data-region="anuncios-editor"]')!.textContent

afterEach(() => {
  vi.clearAllMocks()
  act(() => cerrarTodosLosToasts())
})

async function elegir(tema: string) {
  fireEvent.click(screen.getByRole('button', { name: /^Tema: / }))
  fireEvent.click(await screen.findByRole('option', { name: tema }))
}

describe('sección Tema del panel Estilo (0170)', () => {
  it('T1: una canción sin apariencia abre en D2 y no escribe nada', async () => {
    const { llamadas } = await montar()
    expect(screen.getByRole('radio', { name: 'Tema personalizado' })).toBeChecked()
    expect(
      screen.getByText('Estilo propio de esta canción. Los cambios no afectan a ningún tema.')
    ).toBeVisible()
    expect(screen.getByLabelText('Color de la letra')).toBeVisible()
    expect(llamadas.filter((l) => l.metodo.includes('guardar'))).toEqual([])
  })

  it('abre en la pestaña Estilo al volver de Ajustes', async () => {
    await montar({ pestana: 'estilo' })
    expect(screen.getByRole('radio', { name: 'Estilo' })).toBeChecked()
  })

  it('T2b: elegir un tema lo asigna, y Volver a heredar lo devuelve a su procedencia', async () => {
    const { llamadas, api, fijarApariencia, temas } = await montar({
      apariencia: heredaAnterior,
      disco: 'heredar'
    })
    expect(screen.getByText('Tema predeterminado anterior')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Volver a heredar' })).toBeNull()
    await elegir('Neón')
    expect(screen.getByText('Asignado a esta canción')).toBeVisible()
    expect(screen.getByText('Usará «Sol», el tema predeterminado anterior.')).toBeVisible()
    expect(anuncios()).toContain('Tema «Neón» asignado a esta canción.')
    await waitFor(
      () =>
        expect(llamadasApariencia(llamadas).at(-1)?.args).toEqual([
          expect.any(String),
          { modo: 'tema', temaId: NEON }
        ]),
      { timeout: 3000 }
    )

    // Ctrl/Cmd + Z revierte la asignación y la reenvía.
    fireEvent.click(boton(/^Deshacer/))
    await waitFor(
      () => expect(llamadasApariencia(llamadas).at(-1)?.args[1]).toEqual({ modo: 'heredar' }),
      { timeout: 3000 }
    )
    expect(screen.getByText('Tema predeterminado anterior')).toBeVisible()

    // Un cambio en el catálogo (otro `alHeredar`) llega con temas:cambiado y el texto cambia.
    await elegir('Neón')
    await screen.findByRole('button', { name: 'Volver a heredar' })
    const artista: DestinoHeredarIpc = { procedencia: 'artista', temaId: SOL, temaNombre: 'Sol' }
    fijarApariencia({ alHeredar: artista }, { silencioso: true })
    act(() => temas.emitirCambio())
    expect(await screen.findByText('Usará «Sol», del artista Queen.')).toBeVisible()
    expect(api).toBeDefined()
  })

  it('T22b: con destino respaldo no se nombra ningún tema y Volver a heredar pasa a D4', async () => {
    const { llamadas } = await montar({
      disco: 'tema',
      apariencia: {
        modo: 'tema',
        procedencia: 'cancion',
        temaId: NEON,
        temaNombre: 'Neón',
        neutra: false,
        alHeredar: { procedencia: 'respaldo', temaId: SOL, temaNombre: 'Sol' }
      }
    })
    const linea = screen.getByText(/Su tema de origen no está en tus temas\. Se verá con/)
    expect(linea).toHaveTextContent('(«Tema no disponible»)')
    expect(linea.querySelector('[aria-hidden="true"]')).toHaveTextContent('⚠')
    expect(screen.queryByText(/Sol/)).toBeNull()

    fireEvent.click(boton('Volver a heredar'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('heading', { name: 'Tema no disponible' })).toBeVisible()
    expect(anuncios()).toContain('Esta canción vuelve a heredar, pero su tema de origen no está')
    await waitFor(() => expect(screen.getByRole('button', { name: /^Tema: / })).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Usar como tema personalizado' })).toBeVisible()
    // Resumen de solo lectura, sin controles.
    expect(screen.queryByLabelText('Color de la letra')).toBeNull()

    fireEvent.click(boton(/^Deshacer/))
    expect(await screen.findByRole('button', { name: 'Volver a heredar' })).toBeVisible()
    expect(llamadasApariencia(llamadas)).toBeDefined()
  })

  it('con destino incluido, el anuncio de heredar es la variante «estilo incluido»', async () => {
    await montar({
      disco: 'tema',
      apariencia: {
        modo: 'tema',
        procedencia: 'cancion',
        temaId: NEON,
        temaNombre: 'Neón',
        neutra: false,
        alHeredar: { procedencia: 'incluido', temaId: null, temaNombre: null }
      }
    })
    expect(screen.getByText('Usará el estilo incluido de Shinobi Karaoke.')).toBeVisible()
    fireEvent.click(boton('Volver a heredar'))
    expect(anuncios()).toContain(
      'Esta canción vuelve a heredar: usa el estilo incluido de Shinobi Karaoke.'
    )
  })

  it('T4–T5: Personalizar conserva el aspecto y volver a Temas definidos muestra el toast con Deshacer', async () => {
    const { llamadas } = await montar({ apariencia: heredaAnterior, disco: 'heredar' })
    // D1: resumen de solo lectura y sin acciones rápidas de contraste.
    expect(screen.queryByLabelText('Color de la letra')).toBeNull()
    fireEvent.click(boton('Personalizar'))
    expect(screen.getByRole('radio', { name: 'Tema personalizado' })).toBeChecked()
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Tema personalizado' })).toHaveFocus()
    )
    expect(screen.getByLabelText('Color de la letra')).toBeVisible()
    await waitFor(
      () => expect(llamadasApariencia(llamadas).at(-1)?.args[1]).toMatchObject({ modo: 'propio' }),
      { timeout: 3000 }
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Temas definidos' }))
    expect(
      await screen.findByText('Esta canción usa ahora «Sol» (predeterminado anterior).')
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /^Deshacer$/ }))
    expect(screen.getByRole('radio', { name: 'Tema personalizado' })).toBeChecked()
  })

  it('T22: con el catálogo vacío y estilo incluido solo se ofrece Personalizar', async () => {
    await montar({
      catalogo: catalogoPrueba({ temas: [] }),
      apariencia: {
        modo: 'heredar',
        procedencia: 'incluido',
        neutra: true,
        alHeredar: { procedencia: 'incluido', temaId: null, temaNombre: null }
      },
      disco: 'heredar'
    })
    expect(screen.getByText(/Aún no tienes temas\./)).toBeVisible()
    expect(screen.getByText('Estilo incluido de Shinobi Karaoke')).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Tema: / })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar tema' })).toBeNull()
    expect(boton('Personalizar')).toBeVisible()
  })

  it('T24: solo lectura sustituye el selector por el aviso y desactiva las acciones del catálogo', async () => {
    await montar({
      catalogo: catalogo({ soloLectura: true }),
      disco: 'tema',
      apariencia: {
        modo: 'tema',
        procedencia: 'respaldo',
        temaId: NEON,
        temaNombre: 'Neón',
        neutra: false
      }
    })
    expect(screen.getAllByText(/Tus temas se guardaron con una versión más nueva/)[0]).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Tema: / })).toBeNull()
    expect(boton('Guardar como tema nuevo…')).toHaveAttribute('aria-disabled', 'true')
    expect(boton('Usar como tema personalizado')).not.toHaveAttribute('aria-disabled')
  })

  it('T14–T15: Guardar como tema nuevo no cambia la canción y el aviso permite usarlo', async () => {
    const { llamadas, temas } = await montar()
    fireEvent.click(boton('Guardar como tema nuevo…'))
    const dialogo = await screen.findByRole('dialog', { name: 'Guardar como tema nuevo' })
    const campo = within(dialogo).getByRole('textbox', { name: 'Nombre del tema' })
    expect(campo).toHaveValue('Tema de «Canción de prueba»')
    fireEvent.change(campo, { target: { value: 'Mi tema' } })
    temas.fijarCatalogo(
      catalogo({
        temas: [...catalogo().temas, temaCatalogoPrueba({ id: ID_TEMA_PRUEBA, nombre: 'Mi tema' })]
      })
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear tema' }))
    const usar = await screen.findByRole('button', { name: 'Usar «Mi tema» en esta canción' })
    await waitFor(() => expect(usar).toHaveFocus())
    expect(screen.getByRole('radio', { name: 'Tema personalizado' })).toBeChecked()
    expect(screen.getByText(/Esta canción sigue con su tema personalizado/)).toBeVisible()
    expect(temas.llamadas.find((l) => l.metodo === 'temas.crear')?.args[0]).toMatchObject({
      nombre: 'Mi tema'
    })
    expect(llamadasApariencia(llamadas)).toEqual([])

    fireEvent.click(usar)
    expect(screen.getByText('Asignado a esta canción')).toBeVisible()
  })

  it('T21: Administrar temas… navega a Ajustes › Temas con el origen del editor', async () => {
    const { ir, cancion } = await montar({ apariencia: heredaAnterior, disco: 'heredar' })
    fireEvent.click(boton('Más acciones del tema'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Administrar temas…' }))
    expect(ir).toHaveBeenCalledWith({
      tipo: 'ajustes',
      origen: { tipo: 'editor', id: cancion.id },
      seccion: 'temas'
    })
  })

  it('T21: sin álbum o sin artista las opciones de grupo quedan aria-disabled con su motivo', async () => {
    const cancion = cancionSincronizadaLrclib()
    cancion.apariencia = { modo: 'heredar' }
    cancion.metadatos.artista = ''
    cancion.metadatos.album = null
    const temas = temasFalsos()
    temas.fijarCatalogo(catalogo())
    const falso = apiEditorFalsa({ cancion, temas, apariencia: heredaAnterior })
    window.shinobi = falso.api as unknown as typeof window.shinobi
    render(
      <NavegacionContexto.Provider
        value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir: vi.fn() }}
      >
        <Editor id={cancion.id} />
      </NavegacionContexto.Provider>
    )
    fireEvent.click(await screen.findByRole('radio', { name: 'Estilo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Más acciones del tema' }))
    const album = await screen.findByRole('menuitem', { name: 'Tema del álbum…' })
    expect(album).toHaveAttribute('aria-disabled', 'true')
    expect(album).toHaveAttribute('title', expect.stringContaining('no tiene álbum'))
    expect(screen.getByRole('menuitem', { name: 'Tema del artista…' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })
})

describe('eliminar el tema efectivo', () => {
  it('T18: si la canción estaba afectada pasa a D2, con foco en el radio y anuncio', async () => {
    const { temas } = await montar({ apariencia: heredaAnterior, disco: 'heredar' })
    fireEvent.click(boton('Más acciones del tema'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Eliminar tema…' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Eliminar el tema «Sol»?' })
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar tema' }))
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Tema personalizado' })).toBeChecked()
    )
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Tema personalizado' })).toHaveFocus()
    )
    expect(anuncios()).toContain('Tema eliminado. Esta canción conserva su aspecto')
    expect(temas.llamadas.some((l) => l.metodo === 'temas.ejecutar')).toBe(true)
    // Ctrl/Cmd + Z no vuelve a vincular la canción al tema borrado.
    expect(boton(/^Deshacer/)).toBeDisabled()
  })
})

describe('edición del tema (0171)', () => {
  async function entrarEnD3() {
    const m = await montar({ apariencia: heredaAnterior, disco: 'heredar' })
    fireEvent.click(boton('Editar tema'))
    const banner = await screen.findByText('Editando el tema «Sol»')
    return { ...m, banner }
  }
  const cambiarLetra = (valor: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: 'Color de la letra' }), {
      target: { value: valor }
    })

  it('T7: D3 anuncia el banner, deja inertes modo y selector y no escribe nada', async () => {
    const { llamadas, banner } = await entrarEnD3()
    expect(banner).toBeVisible()
    await waitFor(() => expect(banner.closest('[tabindex="-1"]')).toHaveFocus())
    expect(anuncios()).toContain('Editando el tema «Sol»')
    expect(
      screen.getByText(/Lo usan 3 canciones\. Los cambios se ven en esta vista previa/)
    ).toBeVisible()
    expect(
      screen.getByRole('radiogroup', { name: 'Modo del tema' }).closest('[inert]')
    ).toBeTruthy()
    expect(boton('Guardar en el tema…')).toBeVisible()
    expect(boton('Descartar cambios')).toBeVisible()
    expect(boton('Guardar como tema nuevo…')).toBeVisible()
    cambiarLetra('#123456')
    await act(async () => new Promise((r) => setTimeout(r, 1200)))
    expect(llamadas.filter((l) => l.metodo.includes('guardar'))).toEqual([])
    expect(window.shinobi.app.guardadoPendiente).toBeDefined()
  })

  it('T8–T9: Guardar en el tema abre el impacto con foco en Cancelar y al confirmar sale de D3', async () => {
    const { temas } = await entrarEnD3()
    cambiarLetra('#123456')
    temas.programarImpacto(impactoPrueba({ revisionTema: 1 }))
    fireEvent.click(boton('Guardar en el tema…'))
    const dialogo = await screen.findByRole('dialog', {
      name: '¿Guardar los cambios en «Sol»?'
    })
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar en «Sol»' }))
    await waitFor(() => expect(screen.queryByText('Editando el tema «Sol»')).toBeNull())
    const ejecutar = temas.llamadas.find((l) => l.metodo === 'temas.ejecutar')
    expect(ejecutar?.args[0]).toMatchObject({ tipo: 'editar', temaId: SOL, revisionTema: 1 })
    expect((await screen.findAllByText('Tema «Sol» guardado.')).length).toBeGreaterThan(0)
  })

  it('T11: un fallo de escritura conserva el borrador y ofrece Reintentar', async () => {
    const { temas } = await entrarEnD3()
    cambiarLetra('#123456')
    temas.fallar('temas.ejecutar', 'ERROR_INTERNO')
    fireEvent.click(boton('Guardar en el tema…'))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar en «Sol»' }))
    expect(
      await screen.findByText('No se pudo guardar el tema. Tus cambios siguen aquí.')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copiar detalles' })).toBeVisible()
    expect(screen.getByText('Editando el tema «Sol»')).toBeVisible()
  })

  it('T13: tras descartar, Ctrl/Cmd + Z no toca pasos del borrador', async () => {
    await entrarEnD3()
    cambiarLetra('#123456')
    expect(boton(/^Deshacer/)).toBeEnabled()
    fireEvent.click(boton('Descartar cambios'))
    const dialogo = await screen.findByRole('dialog', { name: '¿Descartar los cambios del tema?' })
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Seguir editando' })).toHaveFocus()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar cambios' }))
    await waitFor(() => expect(screen.queryByText('Editando el tema «Sol»')).toBeNull())
    expect(boton(/^Deshacer/)).toBeDisabled()
    await waitFor(() => expect(boton('Editar tema')).toHaveFocus())
  })

  it('descartar sin cambios no pide confirmación', async () => {
    await entrarEnD3()
    fireEvent.click(boton('Descartar cambios'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('button', { name: 'Editar tema' })).toBeVisible()
  })

  it('T12: salir con cambios muestra tema.dialogo.salir con foco en Seguir editando', async () => {
    const { guardas } = await entrarEnD3()
    cambiarLetra('#123456')
    const guarda = guardas.at(-1)!
    let resultado: boolean | undefined
    act(() => {
      void guarda({ tipo: 'biblioteca' }).then((r) => (resultado = r))
    })
    const dialogo = await screen.findByRole('dialog', {
      name: 'Tienes cambios sin guardar en el tema «Sol»'
    })
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Seguir editando' })).toHaveFocus()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(resultado).toBe(false))

    act(() => {
      void guarda({ tipo: 'biblioteca' }).then((r) => (resultado = r))
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar cambios del tema' }))
    await waitFor(() => expect(resultado).toBe(true))
  })

  it('T12: sin cambios en el borrador se sale sin diálogo', async () => {
    const { guardas } = await entrarEnD3()
    await expect(guardas.at(-1)!({ tipo: 'biblioteca' })).resolves.toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('T23: cerrar la ventana con cambios declara guardado pendiente y usa el mismo diálogo', async () => {
    const { llamadas } = await entrarEnD3()
    cambiarLetra('#123456')
    await waitFor(() =>
      expect(llamadas).toContainEqual({ metodo: 'app.guardadoPendiente', args: [true] })
    )
    let cerrar: boolean | undefined
    act(() => {
      void confirmarBorradorAlCerrar().then((r) => (cerrar = r))
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(cerrar).toBe(false))

    act(() => {
      void confirmarBorradorAlCerrar().then((r) => (cerrar = r))
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar cambios del tema' }))
    await waitFor(() => expect(cerrar).toBe(true))
  })

  it('T27: con el panel minimizado, Expandir panel lleva el nombre de edición sin guardar', async () => {
    await entrarEnD3()
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar panel' }))
    const expandir = await screen.findByRole('button', {
      name: 'Expandir panel (editando un tema sin guardar)'
    })
    expect(expandir.querySelector('[data-info]')).toBeTruthy()
  })
})
