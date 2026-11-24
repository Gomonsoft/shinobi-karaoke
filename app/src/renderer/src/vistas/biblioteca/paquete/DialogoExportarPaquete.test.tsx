import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContenedorToasts } from '../../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../../componentes/gestorToasts'
import { NavegacionContexto } from '../../../navegacion/estado'
import { paso, resumenPrueba } from '../resumenPrueba'
import { abrirExportarPaquete, estadoPaquetes, reiniciarPaquetes } from './almacen'
import { ControladorPaquetes } from './ControladorPaquetes'
import { montarApiPaquetes } from './pruebas'

const TRABAJO = '8d0c1f2e-3b44-4a55-8a66-0123456789ab'
const UBICACION = '0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0'
const destino = (extra: object = {}) => ({
  destinoId: '11111111-2222-4333-8444-555555555555',
  nombre: 'Aurora — Ana.shinobi',
  carpeta: '/Documentos',
  libreBytes: 50_000_000_000,
  existe: false,
  estimacion: { completoBytes: 290_000_000, ligeroBytes: 400_000 },
  ...extra
})

const aurora = resumenPrueba({ id: 'a', titulo: 'Aurora', artista: 'Ana', estado: 'lista' })
const brisa = resumenPrueba({
  id: 'b',
  titulo: 'Brisa',
  artista: 'Beto',
  pasos: {
    fuente: paso('completado'),
    separacion: paso('pendiente'),
    letra: paso('pendiente'),
    edicion: paso('pendiente')
  }
})
const cometa = resumenPrueba({
  id: 'c',
  titulo: 'Cometa',
  artista: 'Ceci',
  pasos: {
    fuente: paso('completado'),
    separacion: paso('en_curso'),
    letra: paso('pendiente'),
    edicion: paso('pendiente')
  } as never
})

function montar(opciones: Parameters<typeof montarApiPaquetes>[0] = {}) {
  const fake = montarApiPaquetes({ canciones: [aurora, brisa, cometa], ...opciones })
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() } as never}>
      <ControladorPaquetes />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return fake
}

beforeEach(() => {
  reiniciarPaquetes()
  cerrarTodosLosToasts()
})
afterEach(cleanup)

describe('Exportar paquete: formulario', () => {
  it('muestra la canción, las dos opciones con su tamaño, el destino y el aviso de derechos', async () => {
    montar({ copias: { destinoPropuesto: () => Promise.resolve(destino()) } })
    act(() => abrirExportarPaquete({ tipo: 'canciones', ids: ['a'] }))
    const dialogo = await screen.findByRole('dialog', { name: 'Exportar paquete' })
    expect(within(dialogo).getByText('«Aurora» · Ana')).toBeInTheDocument()
    await within(dialogo).findByText('unos 290 MB')
    expect(within(dialogo).getByText('menos de 1 MB')).toBeInTheDocument()
    expect(within(dialogo).getByRole('radio', { name: /Completo, con el audio/ })).toBeChecked()
    expect(within(dialogo).getByLabelText('Guardar como')).toHaveValue(
      '/Documentos/Aurora — Ana.shinobi'
    )
    expect(
      within(dialogo).getByText(/El audio y la letra de las canciones tienen derechos/)
    ).toBeVisible()
    // Con «Ligero» el aviso no habla del audio, y nunca aparece la palabra «compartir».
    fireEvent.click(within(dialogo).getByRole('radio', { name: /Ligero, sin audio/ }))
    expect(within(dialogo).queryByText(/El audio y la letra/)).toBeNull()
    expect(
      within(dialogo).getByText(/^Es una copia para ti\. La letra de las canciones/)
    ).toBeVisible()
    expect(dialogo.textContent).not.toMatch(/compartir/i)
  })

  it('varias canciones: cabecera, lista revelable y notas «sin audio» y «se está separando»', async () => {
    montar({
      copias: {
        destinoPropuesto: () => Promise.resolve(destino({ nombre: '3 canciones.shinobi' }))
      }
    })
    act(() => abrirExportarPaquete({ tipo: 'canciones', ids: ['a', 'b', 'c'] }))
    const dialogo = await screen.findByRole('dialog', { name: 'Exportar paquete' })
    expect(within(dialogo).getByText('3 canciones')).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ver cuáles' }))
    expect(within(dialogo).getByText('Aurora — Ana · Lista')).toBeInTheDocument()
    expect(within(dialogo).getByText('Brisa — Beto · Borrador')).toBeInTheDocument()
    expect(within(dialogo).getByText('Sin pistas todavía: se guarda sin audio')).toBeInTheDocument()
    expect(within(dialogo).getByText('Se está separando: se guarda sin pistas')).toBeInTheDocument()
  })

  it('con un archivo existente avisa y el botón sustituye; sin sitio avisa del espacio', async () => {
    montar({
      copias: {
        destinoPropuesto: () => Promise.resolve(destino({ existe: true, libreBytes: 100_000_000 }))
      }
    })
    act(() => abrirExportarPaquete({ tipo: 'canciones', ids: ['a'] }))
    const dialogo = await screen.findByRole('dialog', { name: 'Exportar paquete' })
    await within(dialogo).findByRole('button', { name: 'Exportar y sustituir' })
    expect(within(dialogo).getByText(/Ya hay un archivo con este nombre/)).toBeInTheDocument()
    expect(
      within(dialogo).getByText(
        'Puede que no quepa: ocupará unos 290 MB y quedan 100 MB libres en ese disco.'
      )
    ).toBeInTheDocument()
  })

  it('«Exportar paquete» envía las opciones y el destinoId y pasa a «Creando el paquete»', async () => {
    const exportarCanciones = vi.fn(() => Promise.resolve({ trabajoId: TRABAJO }))
    montar({ copias: { destinoPropuesto: () => Promise.resolve(destino()), exportarCanciones } })
    act(() => abrirExportarPaquete({ tipo: 'canciones', ids: ['a', 'b'] }))
    await screen.findByText('unos 290 MB')
    fireEvent.click(screen.getByRole('radio', { name: /Ligero, sin audio/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Exportar paquete' }))
    await screen.findByRole('dialog', { name: 'Creando el paquete' })
    expect(exportarCanciones).toHaveBeenCalledWith({
      ids: ['a', 'b'],
      conAudio: false,
      destinoId: '11111111-2222-4333-8444-555555555555'
    })
    expect(screen.getByText('2 canciones · ligero')).toBeInTheDocument()
  })

  it('una carpeta sin permiso se dice bajo el campo y no cambia de estado', async () => {
    const exportarCanciones = vi.fn(() =>
      Promise.reject({ codigo: 'DESTINO_NO_DISPONIBLE', mensaje: 'x' })
    )
    montar({ copias: { destinoPropuesto: () => Promise.resolve(destino()), exportarCanciones } })
    act(() => abrirExportarPaquete({ tipo: 'canciones', ids: ['a'] }))
    await screen.findByText('unos 290 MB')
    fireEvent.click(screen.getByRole('button', { name: 'Exportar paquete' }))
    expect(await screen.findByText(/No se puede guardar en esa carpeta/)).toBeInTheDocument()
    expect(screen.getByLabelText('Guardar como')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('dialog', { name: 'Exportar paquete' })).toBeInTheDocument()
  })
})

describe('Exportar paquete: creando y fin', () => {
  async function creando(extra: Parameters<typeof montarApiPaquetes>[0] = {}) {
    const fake = montar({
      copias: {
        destinoPropuesto: () => Promise.resolve(destino()),
        exportarCanciones: () => Promise.resolve({ trabajoId: TRABAJO }),
        cancelar: vi.fn(() => Promise.resolve()),
        ...extra?.copias
      }
    })
    act(() => abrirExportarPaquete({ tipo: 'canciones', ids: ['a', 'b', 'c'] }))
    await screen.findByText('unos 290 MB')
    fireEvent.click(screen.getByRole('button', { name: 'Exportar paquete' }))
    await screen.findByRole('dialog', { name: 'Creando el paquete' })
    return fake
  }

  it('muestra la canción y el avance; Esc sigue en segundo plano y no cancela', async () => {
    const cancelar = vi.fn(() => Promise.resolve())
    const fake = await creando({ copias: { cancelar } })
    act(() => {
      fake.progreso({
        trabajoId: TRABAJO,
        fraccion: 0.5,
        cancion: { hechas: 2, total: 3, titulo: 'Brisa' }
      })
    })
    expect(screen.getByText('Guardando «Brisa»… 2 de 3')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(cancelar).not.toHaveBeenCalled()
    expect(estadoPaquetes().seguimiento?.estado).toBe('en_curso')
  })

  it('un evento anterior a la respuesta de exportar no se pierde', async () => {
    let responder: (r: { trabajoId: string }) => void = () => undefined
    const fake = montar({
      copias: {
        destinoPropuesto: () => Promise.resolve(destino()),
        exportarCanciones: () => new Promise((res) => (responder = res))
      }
    })
    act(() => abrirExportarPaquete({ tipo: 'canciones', ids: ['a'] }))
    await screen.findByText('unos 290 MB')
    fireEvent.click(screen.getByRole('button', { name: 'Exportar paquete' }))
    act(() => {
      fake.progreso({
        trabajoId: TRABAJO,
        fraccion: 0.4,
        cancion: { hechas: 1, total: 1, titulo: 'Aurora' }
      })
    })
    await act(async () => responder({ trabajoId: TRABAJO }))
    expect(await screen.findByText('Guardando «Aurora»…')).toBeInTheDocument()
  })

  it('«Cancelar» usa el trabajoId y, al llegar «cancelada», cierra con su toast', async () => {
    const cancelar = vi.fn(() => Promise.resolve())
    const fake = await creando({ copias: { cancelar } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(cancelar).toHaveBeenCalledWith(TRABAJO)
    act(() => fake.cambio({ trabajoId: TRABAJO, estado: 'cancelada', tipo: 'exportar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(
      await screen.findByText('Paquete cancelado. No se ha guardado nada.')
    ).toBeInTheDocument()
  })

  it('con el diálogo abierto: «Paquete creado» con las omitidas y «Mostrar en la carpeta»', async () => {
    const fake = await creando()
    act(() =>
      fake.cambio({
        trabajoId: TRABAJO,
        estado: 'terminada',
        tipo: 'exportar',
        resultado: {
          nombre: 'Aurora — Ana.shinobi',
          bytes: 290_000_000,
          canciones: 2,
          omitidas: [{ id: 'c', motivo: 'CANCION_NO_DISPONIBLE' }],
          ubicacionId: UBICACION
        }
      })
    )
    const dialogo = await screen.findByRole('dialog', { name: 'Paquete creado' })
    expect(
      within(dialogo).getByText('Aurora — Ana.shinobi · 2 canciones · 290 MB')
    ).toBeInTheDocument()
    // La carpeta va en otro renglón, con la ruta entera en `title`.
    expect(within(dialogo).getByTitle('/Documentos')).toHaveTextContent('En /Documentos')
    expect(within(dialogo).getByText('1 canción no se pudo guardar:')).toBeInTheDocument()
    expect(within(dialogo).getByText('Cometa')).toBeInTheDocument()
    const mostrar = within(dialogo).getByRole('button', { name: 'Mostrar en la carpeta' })
    expect(mostrar).toHaveFocus()
    fireEvent.click(mostrar)
    expect(fake.mostrarEnCarpeta).toHaveBeenCalledWith(UBICACION)
    // Sin toast: el diálogo ya lo dice.
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('con el diálogo cerrado: toast con «Mostrar en la carpeta» que usa el ubicacionId del resultado', async () => {
    const fake = await creando()
    fireEvent.click(screen.getByRole('button', { name: 'Seguir en segundo plano' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    act(() =>
      fake.cambio({
        trabajoId: TRABAJO,
        estado: 'terminada',
        tipo: 'exportar',
        resultado: {
          nombre: 'x.shinobi',
          bytes: 290_000_000,
          canciones: 3,
          omitidas: [],
          ubicacionId: UBICACION
        }
      })
    )
    expect(await screen.findByText('Paquete creado: 3 canciones, 290 MB.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar en la carpeta' }))
    expect(fake.mostrarEnCarpeta).toHaveBeenCalledWith(UBICACION)
  })

  it('un fallo con el diálogo abierto da su texto, «Reintentar» y vuelve al formulario', async () => {
    const fake = await creando()
    act(() =>
      fake.cambio({ trabajoId: TRABAJO, estado: 'error', tipo: 'exportar', codigo: 'SIN_ESPACIO' })
    )
    const dialogo = await screen.findByRole('dialog', { name: 'Exportar paquete' })
    expect(
      within(dialogo).getByText(/No queda espacio en el disco\. Libera espacio o guarda el paquete/)
    ).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reintentar' }))
    // El formulario vuelve y vuelve a pedir el destino.
    await screen.findByText('unos 290 MB')
    expect(screen.getByRole('button', { name: 'Exportar paquete' })).toBeInTheDocument()
  })
})

describe('Crear copia de seguridad', () => {
  it('muestra la biblioteca entera, la casilla de ajustes y la nota de las que se procesan', async () => {
    const exportarBiblioteca = vi.fn(() => Promise.resolve({ trabajoId: TRABAJO }))
    montar({
      temas: 5,
      copias: {
        destinoPropuesto: () =>
          Promise.resolve(destino({ nombre: 'Copia de Shinobi Karaoke 2026-11-21.shinobi' })),
        exportarBiblioteca
      }
    })
    act(() => abrirExportarPaquete({ tipo: 'biblioteca' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Crear copia de seguridad' })
    expect(
      await within(dialogo).findByText('Toda tu biblioteca: 3 canciones y 5 temas')
    ).toBeInTheDocument()
    expect(
      within(dialogo).getByText(
        '1 canción se está procesando: se guardará como está ahora (si se está separando, sin pistas).'
      )
    ).toBeInTheDocument()
    const ajustes = within(dialogo).getByRole('checkbox', { name: 'Incluir mis ajustes' })
    expect(ajustes).toBeChecked()
    fireEvent.click(ajustes)
    fireEvent.click(
      await within(dialogo).findByRole('button', { name: 'Crear copia de seguridad' })
    )
    await waitFor(() =>
      expect(exportarBiblioteca).toHaveBeenCalledWith({
        conAudio: true,
        ajustes: false,
        destinoId: '11111111-2222-4333-8444-555555555555'
      })
    )
    expect(
      await screen.findByRole('dialog', { name: 'Creando la copia de seguridad' })
    ).toBeInTheDocument()
  })

  it('cancelar una copia da UN solo toast, el de la copia (no también el del paquete) (K2)', async () => {
    const fake = montar({
      copias: {
        destinoPropuesto: () => Promise.resolve(destino()),
        exportarBiblioteca: () => Promise.resolve({ trabajoId: TRABAJO }),
        cancelar: vi.fn(() => Promise.resolve())
      }
    })
    act(() => abrirExportarPaquete({ tipo: 'biblioteca' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Crear copia de seguridad' })
    fireEvent.click(
      await within(dialogo).findByRole('button', { name: 'Crear copia de seguridad' })
    )
    await screen.findByRole('dialog', { name: 'Creando la copia de seguridad' })
    act(() => fake.cambio({ trabajoId: TRABAJO, estado: 'cancelada', tipo: 'exportar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findAllByText(/cancelad[ao]\. No se ha guardado nada\./)).toHaveLength(1)
    expect(screen.getByText('Copia cancelada. No se ha guardado nada.')).toBeInTheDocument()
    expect(screen.queryByText('Paquete cancelado. No se ha guardado nada.')).toBeNull()
  })
})
