import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CambioCopiaIpc, ResultadoImportacionIpc, ResumenPaqueteIpc } from '@shared/ipc'
import { ContenedorToasts } from '../../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../../componentes/gestorToasts'
import { NavegacionContexto, type Vista } from '../../../navegacion/estado'
import { resumenPrueba } from '../resumenPrueba'
import { abrirImportarPaquete, estadoPaquetes, reiniciarPaquetes } from './almacen'
import { ControladorPaquetes } from './ControladorPaquetes'
import { montarApiPaquetes, resumenPaquete } from './pruebas'

const ORIGEN = '99999999-aaaa-4bbb-8ccc-dddddddddddd'
const TRABAJO = '8d0c1f2e-3b44-4a55-8a66-0123456789ab'
const OTRO = '00000000-0000-4000-8000-000000000000'

const nueva = { id: 'n', titulo: 'Arrópame', artista: 'Ana', existe: false, bytes: 40_000_000 }
const antigua = {
  id: 'e',
  titulo: 'A Pesar de Mí',
  artista: 'Ana',
  existe: true,
  modificada: '2026-11-20T10:00:00Z',
  modificadaLocal: '2026-11-21T10:00:00Z',
  bytes: 30_000_000
}
const igual = {
  id: 'i',
  titulo: '¿Y Ahora Qué?',
  artista: 'Ana',
  existe: true,
  igual: true,
  bytes: 20_000_000
}

function montar(
  resumen: ResumenPaqueteIpc,
  extra: { copias?: object; vacia?: boolean; vista?: Vista } = {}
) {
  const ir = vi.fn<(v: Vista) => void>()
  const importar = vi.fn(() => Promise.resolve({ trabajoId: TRABAJO }))
  const cancelar = vi.fn(() => Promise.resolve())
  const fake = montarApiPaquetes({
    canciones: extra.vacia ? [] : [resumenPrueba({ id: 'e' })],
    copias: {
      elegirOrigen: () => Promise.resolve({ origenId: ORIGEN, nombre: 'x.shinobi' }),
      leer: () => Promise.resolve(resumen),
      importar,
      cancelar,
      ...extra.copias
    }
  })
  render(
    <NavegacionContexto.Provider
      value={{ vista: extra.vista ?? { tipo: 'biblioteca' }, ir } as never}
    >
      <ControladorPaquetes />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { ...fake, ir, importar, cancelar }
}

const base = (extra: Partial<ResumenPaqueteIpc> = {}) =>
  resumenPaquete({
    nombre: '3 canciones.shinobi',
    creado: '2026-11-21T10:00:00Z',
    app: '0.2.2',
    bytes: 90_000_000,
    libreBytes: 120_000_000_000,
    canciones: [nueva, antigua, igual],
    temas: [
      { id: 't1', nombre: 'Neón', existe: 'no' },
      { id: 't2', nombre: 'Noche', existe: 'igual' }
    ],
    ...extra
  })

const abrir = async () => {
  act(() => abrirImportarPaquete())
  return screen.findByRole('dialog', { name: /Importar paquete|Restaurar copia/ })
}

beforeEach(() => {
  reiniciarPaquetes()
  cerrarTodosLosToasts()
})
afterEach(cleanup)

describe('Importar: elegir, leer y revisar', () => {
  it('cancelar el selector del sistema no abre nada', async () => {
    montar(base(), { copias: { elegirOrigen: () => Promise.resolve(null) } })
    act(() => abrirImportarPaquete())
    await waitFor(() => expect(estadoPaquetes().importar).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('un archivo soltado se registra con origenDeArchivo (el renderer no maneja la ruta)', async () => {
    const origenDeArchivo = vi.fn(() => Promise.resolve({ origenId: ORIGEN, nombre: 'y.shinobi' }))
    const elegirOrigen = vi.fn()
    montar(base(), { copias: { origenDeArchivo, elegirOrigen } })
    const archivo = new File(['x'], 'y.shinobi')
    act(() => abrirImportarPaquete(archivo))
    await screen.findByRole('dialog', { name: 'Importar paquete' })
    expect(origenDeArchivo).toHaveBeenCalledWith(archivo)
    expect(elegirOrigen).not.toHaveBeenCalled()
  })

  it('un arrastre que main rechaza dice que no es un paquete', async () => {
    montar(base(), { copias: { origenDeArchivo: () => Promise.resolve(null) } })
    act(() => abrirImportarPaquete(new File(['x'], 'raro.shinobi')))
    expect(
      await screen.findByText('Este archivo no es un paquete de Shinobi Karaoke.')
    ).toBeInTheDocument()
  })

  it('muestra el resumen y una fila por canción: Nueva, Ya la tienes (más antigua) e igual', async () => {
    montar(base())
    const dialogo = await abrir()
    expect(within(dialogo).getByText('3 canciones.shinobi')).toBeInTheDocument()
    expect(
      within(dialogo).getByText(
        'Creado el 21 nov 2026 con Shinobi Karaoke 0.2.2 · completo · 3 canciones · 2 temas · 90 MB'
      )
    ).toBeInTheDocument()
    const filas = within(
      within(dialogo).getByRole('list', { name: 'Importar paquete' })
    ).getAllByRole('listitem')
    expect(filas).toHaveLength(3)
    expect(filas[0]).toHaveTextContent('Nueva')
    expect(filas[1]).toHaveTextContent(
      'Ya la tienes. La del paquete es más antigua (20 nov 2026; la tuya, 21 nov 2026).'
    )
    expect(filas[2]).toHaveTextContent('Ya la tienes igual: se omite')
    // Solo las «Ya la tienes» (no iguales) tienen selector.
    expect(within(filas[0]!).queryByRole('combobox')).toBeNull()
    expect(
      within(filas[1]!).getByRole('combobox', { name: 'Qué hacer con «A Pesar de Mí»' })
    ).toHaveValue('omitir')
    expect(within(filas[2]!).queryByRole('combobox')).toBeNull()
    // La etiqueta del control general se ve, a su izquierda (no solo como nombre accesible).
    expect(within(dialogo).getByText('Para las que ya tienes:')).toBeVisible()
    // Por defecto «Omitir»: entra 1 y el foco está en el primer selector.
    expect(within(dialogo).getByRole('button', { name: 'Importar 1 canción' })).toBeInTheDocument()
    expect(
      within(dialogo).getByText('Hacen falta 40 MB; tienes 120,0 GB libres.')
    ).toBeInTheDocument()
    expect(within(dialogo).getByText('Temas: 1 nuevo · 1 ya lo tienes')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Qué hacer con/ })).toHaveFocus()
  })

  it('el selector de una fila cambia solo esa y el general pasa a «Mixto»', async () => {
    const otra = { ...antigua, id: 'e2', titulo: 'Valiente' }
    const { importar } = montar(base({ canciones: [nueva, antigua, otra, igual] }))
    const dialogo = await abrir()
    fireEvent.change(within(dialogo).getByRole('combobox', { name: /A Pesar de Mí/ }), {
      target: { value: 'sustituir' }
    })
    expect(within(dialogo).getByRole('radio', { name: 'Mixto' })).toBeChecked()
    expect(
      within(dialogo).getByText('La tuya irá a la papelera de tu sistema.')
    ).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Importar 2 canciones' }))
    await waitFor(() => expect(importar).toHaveBeenCalled())
    expect(importar).toHaveBeenCalledWith({
      origenId: ORIGEN,
      conflictos: 'omitir',
      porCancion: { e: 'sustituir' },
      ajustes: false
    })
  })

  it('«Conservar las dos» en el control general fija todas y borra las de cada fila', async () => {
    const { importar } = montar(base())
    const dialogo = await abrir()
    fireEvent.change(within(dialogo).getByRole('combobox', { name: /A Pesar de Mí/ }), {
      target: { value: 'sustituir' }
    })
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Conservar las dos' }))
    expect(within(dialogo).getByRole('combobox', { name: /A Pesar de Mí/ })).toHaveValue(
      'conservar_ambas'
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Importar 2 canciones' }))
    await waitFor(() => expect(importar).toHaveBeenCalled())
    expect(importar).toHaveBeenCalledWith({
      origenId: ORIGEN,
      conflictos: 'conservar_ambas',
      ajustes: false
    })
  })

  it('todas iguales: nada que importar y el botón no actúa', async () => {
    const { importar } = montar(base({ canciones: [igual] }))
    const dialogo = await abrir()
    const boton = within(dialogo).getByRole('button', { name: 'Importar 0 canciones' })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(boton)
    expect(importar).not.toHaveBeenCalled()
    expect(
      within(dialogo).getAllByText('No hay nada que importar: ya tienes todas estas canciones.')
        .length
    ).toBeGreaterThan(0)
  })

  it('sin espacio suficiente avisa y el botón no actúa', async () => {
    const { importar } = montar(base({ libreBytes: 10_000_000 }))
    const dialogo = await abrir()
    expect(
      within(dialogo).getAllByText('⚠ Hacen falta 40 MB y solo tienes 10 MB libres.').length
    ).toBeGreaterThan(0)
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Importar 1 canción' }))
    expect(importar).not.toHaveBeenCalled()
  })

  it('un paquete ligero lo dice en las filas nuevas y al sustituir', async () => {
    montar(base({ conAudio: false }))
    const dialogo = await abrir()
    expect(
      within(dialogo).getByText(
        'Sin audio: entrará como borrador y habrá que volver a añadir su audio.'
      )
    ).toBeInTheDocument()
    fireEvent.change(within(dialogo).getByRole('combobox', { name: /A Pesar de Mí/ }), {
      target: { value: 'sustituir' }
    })
    expect(
      within(dialogo).getByText(
        'Se sustituyen la letra, los tiempos y el estilo. Tu audio se conserva y la versión anterior se guarda como copia de la canción.'
      )
    ).toBeInTheDocument()
  })

  it('una canción parecida lo anota', async () => {
    montar(base({ canciones: [{ ...nueva, parecida: true }] }))
    const dialogo = await abrir()
    expect(
      within(dialogo).getByText(
        'Tienes otra canción con el mismo título y artista. Se importará como una canción aparte.'
      )
    ).toBeInTheDocument()
  })

  it.each([
    ['PAQUETE_NO_VALIDO', 'Este archivo no es un paquete de Shinobi Karaoke.'],
    ['PAQUETE_VERSION_NUEVA', 'Este paquete es de una versión más nueva de Shinobi Karaoke.'],
    ['PAQUETE_INCOMPLETO', 'El paquete está dañado o incompleto.']
  ])('error de lectura %s: su texto y «Elegir otro archivo»', async (codigo, titulo) => {
    const elegirOrigen = vi.fn(() => Promise.resolve({ origenId: ORIGEN, nombre: 'x.shinobi' }))
    montar(base(), {
      copias: { elegirOrigen, leer: () => Promise.reject({ codigo, mensaje: 'x' }) }
    })
    const dialogo = await abrir()
    expect(within(dialogo).getByText(titulo)).toBeInTheDocument()
    // Nunca aparece una lista parcial.
    expect(within(dialogo).queryByRole('list')).toBeNull()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Elegir otro archivo' }))
    await waitFor(() => expect(elegirOrigen).toHaveBeenCalledTimes(2))
  })
})

describe('Restaurar una copia de seguridad', () => {
  const copia = () =>
    base({
      tipo: 'copia',
      ajustes: true,
      temas: [{ id: 't1', nombre: 'Neón', existe: 'distinto' }],
      asignaciones: { aplicables: 2, noAplicables: ['Álbum Disco A'], predeterminado: 'no_aplica' }
    })

  it('título propio, «no borra», asignaciones y ajustes desmarcados con canciones', async () => {
    montar(copia())
    const dialogo = await screen
      .findByRole('dialog', { name: 'Restaurar copia de seguridad' }, { timeout: 3000 })
      .catch(async () => {
        act(() => abrirImportarPaquete())
        return screen.findByRole('dialog', { name: 'Restaurar copia de seguridad' })
      })
    expect(within(dialogo).getByText(/Restaurar añade lo que falta/)).toBeInTheDocument()
    expect(
      within(dialogo).getByText(
        'Temas de artistas y álbumes: se restauran 2; 1 no, porque aquí ya tienen otro.'
      )
    ).toBeInTheDocument()
    expect(
      within(dialogo).getByText(
        'El tema predeterminado de la copia no se aplica: aquí ya tienes uno.'
      )
    ).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ver cuáles' }))
    expect(within(dialogo).getByText('Álbum Disco A')).toBeInTheDocument()
    expect(
      within(dialogo).getByRole('checkbox', { name: 'Restaurar también mis ajustes' })
    ).not.toBeChecked()
    expect(within(dialogo).getByRole('button', { name: 'Restaurar 1 canción' })).toBeInTheDocument()
  })

  it('en un equipo nuevo (biblioteca vacía) los ajustes vienen marcados y se envían', async () => {
    const { importar } = montar(copia(), { vacia: true })
    act(() => abrirImportarPaquete())
    const dialogo = await screen.findByRole('dialog', { name: 'Restaurar copia de seguridad' })
    await waitFor(() =>
      expect(
        within(dialogo).getByRole('checkbox', { name: 'Restaurar también mis ajustes' })
      ).toBeChecked()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Restaurar 1 canción' }))
    await waitFor(() => expect(importar).toHaveBeenCalled())
    expect(importar).toHaveBeenCalledWith({ origenId: ORIGEN, conflictos: 'omitir', ajustes: true })
  })
})

describe('Importando y resultado', () => {
  const resultado: ResultadoImportacionIpc = {
    resultados: [
      { id: 'n', resultado: 'importada' },
      { id: 'e', resultado: 'sustituida', ligera: true },
      { id: 'i', resultado: 'omitida', motivo: 'IGUAL' },
      { id: 'x', resultado: 'error', motivo: 'PAQUETE_INCOMPLETO' }
    ],
    temas: { importados: ['Neón (importado)'], reutilizados: 0 },
    ajustes: true
  }
  const cuatro = () =>
    base({
      canciones: [
        nueva,
        antigua,
        igual,
        { id: 'x', titulo: 'Sinmigo', artista: 'Ana', existe: false }
      ]
    })

  async function importando(extra?: Parameters<typeof montar>[1]) {
    const m = montar(cuatro(), extra)
    const dialogo = await abrir()
    fireEvent.click(within(dialogo).getByRole('button', { name: /Importar \d canciones?/ }))
    await screen.findByText('Preparando la importación…')
    return m
  }

  it('cancelar usa el trabajoId que devuelve importar, no el de otro evento', async () => {
    const m = await importando()
    act(() => m.cambio({ trabajoId: OTRO, estado: 'en_curso', tipo: 'importar' } as CambioCopiaIpc))
    act(() =>
      m.progreso({
        trabajoId: TRABAJO,
        fraccion: 0.3,
        cancion: { hechas: 1, total: 2, titulo: 'Arrópame' }
      })
    )
    expect(screen.getByText('Importando «Arrópame»… 1 de 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(m.cancelar).toHaveBeenCalledTimes(1)
    expect(m.cancelar).toHaveBeenCalledWith(TRABAJO)
  })

  it('un cambio de otro trabajo no termina el nuestro', async () => {
    const m = await importando()
    act(() => m.cambio({ trabajoId: OTRO, estado: 'terminada', tipo: 'importar', resultado }))
    expect(screen.getByText('Preparando la importación…')).toBeInTheDocument()
  })

  it('el resultado trae una fila por canción con icono y texto, y «Copiar detalles» solo en los ✕', async () => {
    const m = await importando()
    act(() => m.cambio({ trabajoId: TRABAJO, estado: 'terminada', tipo: 'importar', resultado }))
    const dialogo = await screen.findByRole('dialog', { name: 'Importar paquete' })
    expect(within(dialogo).getByText('Se importaron 2 de 4 canciones.')).toBeInTheDocument()
    const filas = within(dialogo).getAllByRole('listitem')
    expect(filas).toHaveLength(4)
    expect(filas[0]).toHaveTextContent('Arrópame — AnaImportada')
    expect(filas[1]).toHaveTextContent(
      'Sustituidas la letra, los tiempos y el estilo; tu audio se conserva'
    )
    expect(filas[2]).toHaveTextContent('Omitida: ya la tenías igual')
    expect(filas[3]).toHaveTextContent(
      'Sus archivos están dañados en el paquete. No se ha importado.'
    )
    expect(within(filas[3]!).getByRole('button', { name: 'Copiar detalles' })).toBeInTheDocument()
    expect(within(filas[0]!).queryByRole('button', { name: 'Copiar detalles' })).toBeNull()
    expect(
      within(dialogo).getByText('Temas: 1 importado («Neón (importado)»).')
    ).toBeInTheDocument()
    expect(within(dialogo).getByText('Ajustes restaurados.')).toBeInTheDocument()
  })

  it('al cerrar el resultado vuelve a la Biblioteca con la primera importada enfocada y todas resaltadas', async () => {
    const m = await importando({ vista: { tipo: 'ajustes' } })
    act(() => m.cambio({ trabajoId: TRABAJO, estado: 'terminada', tipo: 'importar', resultado }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))
    expect(m.ir).toHaveBeenCalledWith({
      tipo: 'biblioteca',
      enfocar: { id: 'n', resaltar: false, tambien: ['n', 'e'] }
    })
    expect(estadoPaquetes().seguimiento).toBeNull()
  })

  it('con el diálogo cerrado: toast parcial con «Ver resultado» que lo reabre', async () => {
    const m = await importando()
    fireEvent.click(screen.getByRole('button', { name: 'Seguir en segundo plano' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    act(() => m.cambio({ trabajoId: TRABAJO, estado: 'terminada', tipo: 'importar', resultado }))
    expect(await screen.findByText('Se importaron 2 de 4 canciones.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))
    expect(await screen.findByRole('dialog', { name: 'Importar paquete' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('todas importadas con el diálogo cerrado: un toast con el recuento', async () => {
    const m = montar(base({ canciones: [nueva] }))
    const dialogo = await abrir()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Importar 1 canción' }))
    await screen.findByText('Preparando la importación…')
    fireEvent.click(screen.getByRole('button', { name: 'Seguir en segundo plano' }))
    act(() =>
      m.cambio({
        trabajoId: TRABAJO,
        estado: 'terminada',
        tipo: 'importar',
        resultado: { resultados: [{ id: 'n', resultado: 'importada' }] }
      })
    )
    expect(await screen.findByText('«Arrópame» importada.')).toBeInTheDocument()
  })

  it('cancelada: las pendientes salen como «No importada: cancelaste la importación»', async () => {
    const m = await importando()
    act(() =>
      m.cambio({
        trabajoId: TRABAJO,
        estado: 'cancelada',
        tipo: 'importar',
        resultado: {
          resultados: [
            { id: 'n', resultado: 'importada' },
            { id: 'e', resultado: 'omitida', motivo: 'CANCELADO' }
          ]
        }
      })
    )
    const dialogo = await screen.findByRole('dialog', { name: 'Importar paquete' })
    expect(within(dialogo).getByText('No importada: cancelaste la importación')).toBeInTheDocument()
  })
})
