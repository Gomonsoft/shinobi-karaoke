import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiShinobi, EstadoActualizacionesIpc, InfoSistema } from '@shared/ipc'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { AcercaDe } from './AcercaDe'
import { cuandoComprobado, hayNueva, hayPunto } from './modeloActualizaciones'
import { Ajustes } from '../ajustes/Ajustes'
import { NavegacionContexto } from '../../navegacion/estado'
import { configPredeterminada } from '@shared/config'

const info: InfoSistema = {
  version: '0.2.2-alpha.1',
  compilacion: { canal: 'publicada', numero: 5, commit: null },
  so: 'Darwin',
  plataforma: 'win32',
  youtube: true
}
const BASE = 'https://github.com/Gomonsoft/shinobi-karaoke/releases'
const NUEVA = {
  version: '0.2.2-alpha.2',
  publicada: '2026-11-25T18:00:00Z',
  recursos: ['Shinobi-Karaoke-Windows-x64.exe']
}
const estado = (extra: Partial<EstadoActualizacionesIpc> = {}): EstadoActualizacionesIpc => ({
  canal: 'publicada',
  avisar: true,
  disponible: null,
  vista: null,
  ultimaComprobacion: new Date().toISOString(),
  comprobando: false,
  enlaces: null,
  ...extra
})
const conNueva = (extra: Partial<EstadoActualizacionesIpc> = {}) =>
  estado({
    disponible: NUEVA,
    enlaces: {
      novedades: `${BASE}/tag/v0.2.2-alpha.2`,
      descargar: `${BASE}/download/v0.2.2-alpha.2/Shinobi-Karaoke-Windows-x64.exe`,
      directa: true
    },
    ...extra
  })

function instalar(inicial: EstadoActualizacionesIpc, comprobar?: () => Promise<unknown>) {
  const sistema = {
    info: vi.fn().mockResolvedValue(info),
    abrirEnlace: vi.fn().mockResolvedValue(undefined),
    abrirCarpetaDatos: vi.fn(),
    textoLegal: vi.fn()
  }
  const actualizaciones = {
    estado: vi.fn().mockResolvedValue(inicial),
    comprobar: vi.fn(comprobar ?? (() => Promise.resolve({ resultado: 'al_dia' }))),
    marcarVista: vi.fn().mockResolvedValue(undefined),
    alCambiar: vi.fn(() => () => undefined)
  }
  const config = {
    obtener: vi.fn().mockResolvedValue(configPredeterminada()),
    actualizar: vi.fn().mockResolvedValue(undefined)
  }
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = {
    sistema,
    actualizaciones,
    config,
    alCambiarConfig: () => () => undefined
  } as unknown as ApiShinobi
  return { sistema, actualizaciones, config }
}

afterEach(() => cerrarTodosLosToasts())

describe('modelo', () => {
  it('punto solo con versión nueva, aviso activo, canal publicada y sin ver', () => {
    expect(hayPunto(conNueva())).toBe(true)
    expect(hayPunto(conNueva({ vista: '0.2.2-alpha.2' }))).toBe(false)
    expect(hayPunto(conNueva({ avisar: false }))).toBe(false)
    expect(hayPunto(conNueva({ canal: 'desarrollo' }))).toBe(false)
    expect(hayNueva(estado())).toBe(false)
  })
  it('fecha: hoy, ayer o corta', () => {
    const ahora = new Date(2026, 10, 25, 20, 0)
    expect(cuandoComprobado(new Date(2026, 10, 25, 18, 42).toISOString(), ahora)).toBe(
      'hoy a las 18:42'
    )
    expect(cuandoComprobado(new Date(2026, 10, 24, 9, 0).toISOString(), ahora)).toBe('ayer')
    expect(cuandoComprobado(new Date(2026, 10, 18, 9, 0).toISOString(), ahora)).toMatch(
      /18 nov 2026/
    )
  })
})

describe('Bloque «Actualizaciones»', () => {
  it('versión nueva preliminar: estado, ayuda, enlaces de main y nota tras «Descargar»', async () => {
    const { sistema } = instalar(conNueva())
    render(<AcercaDe />)
    expect(await screen.findByRole('heading', { name: 'Actualizaciones', level: 3 })).toBeTruthy()
    expect(
      screen.getByText(
        (_, n) =>
          n?.tagName === 'SPAN' &&
          n.textContent === 'Hay una versión nueva: 0.2.2-alpha.2 (versión preliminar)'
      )
    ).toBeTruthy()
    expect(
      screen.getByText(/Tienes la 0\.2\.2-alpha\.1\. La app no se actualiza sola/)
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver novedades (se abre en el navegador)' }))
    expect(sistema.abrirEnlace).toHaveBeenLastCalledWith(`${BASE}/tag/v0.2.2-alpha.2`)
    fireEvent.click(screen.getByRole('button', { name: 'Descargar (se abre en el navegador)' }))
    expect(sistema.abrirEnlace).toHaveBeenLastCalledWith(
      `${BASE}/download/v0.2.2-alpha.2/Shinobi-Karaoke-Windows-x64.exe`
    )
    expect(
      await screen.findByText(
        /Se ha abierto tu navegador para descargar la versión 0\.2\.2-alpha\.2/
      )
    ).toBeTruthy()
    expect(
      screen.getByText(/Es una versión preliminar: haz antes una copia de seguridad/)
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Guía de instalación/ }))
    expect(sistema.abrirEnlace).toHaveBeenLastCalledWith(expect.stringContaining('INSTALAR.md'))
  })

  it('estable sin copia de seguridad y con la variante de la página de la versión', async () => {
    instalar(
      conNueva({
        disponible: { ...NUEVA, version: '0.2.3' },
        enlaces: {
          novedades: `${BASE}/tag/v0.2.3`,
          descargar: `${BASE}/tag/v0.2.3`,
          directa: false
        }
      })
    )
    render(<AcercaDe />)
    fireEvent.click(await screen.findByRole('button', { name: /^Descargar/ }))
    expect(await screen.findByText(/en la página de la versión 0\.2\.3/)).toBeTruthy()
    expect(screen.queryByText(/copia de seguridad/)).toBeNull()
  })

  it('al día, con la privacidad asociada a la casilla', async () => {
    instalar(estado())
    render(<AcercaDe />)
    expect(await screen.findByText('Tienes la última versión.')).toBeTruthy()
    const casilla = screen.getByRole('checkbox', { name: 'Avisarme cuando haya una versión nueva' })
    expect(casilla.getAttribute('aria-describedby')).toBeTruthy()
    expect(casilla.closest('div')?.textContent).toContain('GitHub ve tu dirección IP')
  })

  it('sin comprobar nunca', async () => {
    instalar(estado({ ultimaComprobacion: null }))
    render(<AcercaDe />)
    expect(
      await screen.findByText('Aún no se ha comprobado si hay una versión nueva.')
    ).toBeTruthy()
  })

  it('buscar a mano: «Buscando…», una sola vez, y anuncia el resultado', async () => {
    let soltar!: (v: unknown) => void
    const { actualizaciones } = instalar(estado(), () => new Promise((r) => (soltar = r)))
    render(<AcercaDe />)
    const boton = await screen.findByRole('button', { name: 'Buscar actualizaciones' })
    fireEvent.click(boton)
    await screen.findByText('Buscando…')
    fireEvent.click(screen.getByRole('button', { name: /Buscando/ }))
    expect(actualizaciones.comprobar).toHaveBeenCalledTimes(1)
    await act(async () => soltar({ resultado: 'al_dia' }))
    await waitFor(() =>
      expect(
        screen.getAllByRole('status').some((n) => n.textContent === 'Tienes la última versión.')
      ).toBe(true)
    )
  })

  it('error a mano: mensaje con la última comprobación; sin conexión no cambia lo que se veía', async () => {
    instalar(estado(), () => Promise.resolve({ resultado: 'error', codigo: 'SIN_CONEXION' }))
    render(<AcercaDe />)
    fireEvent.click(await screen.findByRole('button', { name: 'Buscar actualizaciones' }))
    expect(
      await screen.findByText(
        'No se pudo comprobar ahora. Revisa tu conexión a internet e inténtalo más tarde.'
      )
    ).toBeTruthy()
    expect(screen.getByText('Tienes la última versión.')).toBeTruthy()
    expect(screen.getByText(/^Última comprobación: hoy a las/)).toBeTruthy()
  })

  it('casilla: guarda con config.actualizar y, si falla, vuelve atrás con un toast', async () => {
    const { config } = instalar(estado())
    config.actualizar.mockRejectedValueOnce(new Error('x'))
    render(
      <>
        <AcercaDe />
        <ContenedorToasts />
      </>
    )
    const casilla = await screen.findByRole('checkbox', { name: /Avisarme/ })
    fireEvent.click(casilla)
    expect(config.actualizar).toHaveBeenCalledWith({ actualizaciones: { avisar: false } })
    expect(await screen.findByText('No se pudo guardar el ajuste.')).toBeTruthy()
    await waitFor(() => expect((casilla as HTMLInputElement).checked).toBe(true))
  })

  it('aviso desactivado: texto propio en lugar de la privacidad', async () => {
    instalar(estado({ avisar: false }))
    render(<AcercaDe />)
    expect(await screen.findByText(/El aviso está desactivado/)).toBeTruthy()
    expect(screen.queryByText(/GitHub ve tu dirección IP/)).toBeNull()
  })

  it.each([
    ['desarrollo', /Las compilaciones de desarrollo no buscan versiones nuevas/],
    ['local', /Las compilaciones locales no buscan versiones nuevas/]
  ] as const)('canal %s: solo el texto, sin botón ni casilla', async (canal, texto) => {
    instalar(estado({ canal }))
    render(<AcercaDe />)
    expect(await screen.findByText(texto)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Buscar actualizaciones' })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('sin la API de actualizaciones no hay bloque', async () => {
    instalar(estado())
    delete (window.shinobi as unknown as Record<string, unknown>).actualizaciones
    render(<AcercaDe />)
    await screen.findByText(/Versión 0\.2\.2/)
    expect(screen.queryByText('Actualizaciones')).toBeNull()
  })
})

describe('Ajustes: aviso del principio', () => {
  const montar = (e: EstadoActualizacionesIpc) => {
    const api = instalar(e)
    ;(window.shinobi as unknown as Record<string, unknown>).runtime = undefined
    render(
      <NavegacionContexto.Provider value={{ vista: { tipo: 'ajustes' }, ir: () => undefined }}>
        <Ajustes />
      </NavegacionContexto.Provider>
    )
    return api
  }

  it('muestra el aviso, marca la versión como vista y [Ver] da el foco al bloque', async () => {
    const { actualizaciones } = montar(conNueva())
    expect(await screen.findByText('Hay una versión nueva: 0.2.2-alpha.2.')).toBeTruthy()
    await waitFor(() => expect(actualizaciones.marcarVista).toHaveBeenCalledWith('0.2.2-alpha.2'))
    const titulo = await screen.findByRole('heading', { name: 'Actualizaciones' })
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }))
    expect(document.activeElement).toBe(titulo)
  })

  it('sin versión nueva o con el aviso apagado no hay aviso ni se marca nada', async () => {
    const { actualizaciones } = montar(conNueva({ avisar: false }))
    await screen.findByRole('heading', { name: 'Actualizaciones' })
    expect(screen.queryByRole('button', { name: 'Ver' })).toBeNull()
    expect(actualizaciones.marcarVista).not.toHaveBeenCalled()
  })
})
