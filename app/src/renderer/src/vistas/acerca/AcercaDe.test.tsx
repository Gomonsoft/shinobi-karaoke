import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configPredeterminada } from '@shared/config'
import type { ApiShinobi } from '@shared/ipc'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { AcercaDe, infoSoporte } from './AcercaDe'
import { DialogoAcercaDe } from './DialogoAcercaDe'

const info = { version: '0.1.0', so: 'Darwin 25', plataforma: 'darwin', youtube: true }

function instalar(
  extra: { aviso?: string | null; textoLegal?: ApiShinobi['sistema']['textoLegal'] } = {}
) {
  const config = configPredeterminada()
  config.aviso_youtube_aceptado = extra.aviso ?? null
  config.instalacion.perfil_hardware = 'cuda'
  config.separacion.modo = 'calidad'
  const sistema = {
    info: vi.fn().mockResolvedValue(info),
    abrirEnlace: vi.fn().mockResolvedValue(undefined),
    abrirCarpetaDatos: vi.fn().mockResolvedValue(undefined),
    textoLegal: vi.fn(
      extra.textoLegal ??
        ((t: string) =>
          Promise.resolve(t === 'gpl' ? 'GNU GENERAL PUBLIC LICENSE' : '# Avisos <b>x</b>'))
    )
  }
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = {
    sistema,
    config: { obtener: () => Promise.resolve(config) },
    alCambiarConfig: () => () => undefined
  } as unknown as ApiShinobi
  return sistema
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
afterEach(() => cerrarTodosLosToasts())

describe('AcercaDe', () => {
  it('muestra versión, botones y créditos', async () => {
    instalar()
    render(<AcercaDe />)
    expect(
      await screen.findByText(/Versión 0\.1\.0 · Software libre con licencia GPL-3\.0/)
    ).toBeTruthy()
    for (const n of [
      'Ver licencia',
      'Créditos y licencias de terceros',
      'Web del proyecto',
      'Aviso sobre YouTube',
      'Abrir carpeta de datos',
      'Copiar información para soporte'
    ])
      expect(screen.getByRole('button', { name: n })).toBeTruthy()
    expect(
      screen.getByText(
        /Letras: LRCLIB \(lrclib\.net\)\. Separación: audio-separator y MelBand RoFormer \(Kimberley Jensen\)/
      )
    ).toBeTruthy()
  })

  it('Ver licencia y Créditos abren diálogos con el texto como texto plano', async () => {
    const sistema = instalar()
    render(<AcercaDe />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver licencia' }))
    expect(await screen.findByText('GNU GENERAL PUBLIC LICENSE')).toBeTruthy()
    expect(sistema.textoLegal).toHaveBeenCalledWith('gpl')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Créditos y licencias de terceros' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Créditos y licencias de terceros' })
    await within(dialogo).findByText(/# Avisos <b>x<\/b>/)
    expect(dialogo.querySelector('b')).toBeNull()
  })

  it('avisa si no se puede leer el texto', async () => {
    instalar({ textoLegal: () => Promise.reject(new Error('x')) })
    render(<AcercaDe />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver licencia' }))
    expect(await screen.findByText('No se pudo leer el texto.')).toBeTruthy()
  })

  it('Web del proyecto usa el enlace permitido y la carpeta de datos se abre', () => {
    const sistema = instalar()
    render(<AcercaDe />)
    fireEvent.click(screen.getByRole('button', { name: 'Web del proyecto' }))
    expect(sistema.abrirEnlace).toHaveBeenCalledWith('https://github.com/Gomonsoft/shinobi-karaoke')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir carpeta de datos' }))
    expect(sistema.abrirCarpetaDatos).toHaveBeenCalled()
  })

  it('el aviso de YouTube muestra "No aceptado todavía" o la fecha', async () => {
    instalar()
    const { unmount } = render(<AcercaDe />)
    fireEvent.click(screen.getByRole('button', { name: 'Aviso sobre YouTube' }))
    expect(await screen.findByText('No aceptado todavía')).toBeTruthy()
    expect(screen.getByText(/Usa solo contenido que tengas derecho a descargar/)).toBeTruthy()
    unmount()

    instalar({ aviso: '2026-03-05T12:00:00.000Z' })
    render(<AcercaDe />)
    await screen.findByText(/Versión/)
    fireEvent.click(screen.getByRole('button', { name: 'Aviso sobre YouTube' }))
    expect(await screen.findByText(/Aceptado el 5 de marzo de 2026/)).toBeTruthy()
  })

  it('copiar información escribe versión, SO, perfil y modo y muestra el toast', async () => {
    instalar()
    render(
      <>
        <AcercaDe />
        <ContenedorToasts />
      </>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copiar información para soporte' }))
    await waitFor(() => expect(screen.getByText('Información copiada')).toBeTruthy())
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Shinobi Karaoke 0.1.0\nSistema: Darwin 25\nPerfil de hardware: GPU NVIDIA (CUDA)\nModelo de separación: calidad\nDispositivo: cuda\nyt-dlp: sin instalar\nÚltima comprobación de yt-dlp: sin instalar'
    )
  })

  it('infoSoporte con todo instalado incluye SO con versión, yt-dlp y comprobación', () => {
    const c = configPredeterminada()
    c.instalacion.perfil_hardware = 'mps'
    const t = infoSoporte(
      {
        ...info,
        versionSo: '14.5',
        arquitectura: 'arm64',
        emulada: false,
        ytdlp: { version: '2026.10.01', ultimaComprobacion: '2026-11-01T09:00:00.000Z' }
      },
      c
    )
    expect(t.split('\n')).toEqual([
      'Shinobi Karaoke 0.1.0',
      'Sistema: macOS 14.5 · arm64',
      'Perfil de hardware: GPU Apple (MPS)',
      'Modelo de separación: calidad',
      'Dispositivo: mps',
      'yt-dlp: 2026.10.01',
      'Última comprobación de yt-dlp: 2026-11-01T09:00:00.000Z'
    ])
  })

  it('infoSoporte sin motor copia todas las líneas con "sin instalar"', () => {
    const t = infoSoporte(
      { ...info, ytdlp: { version: null, ultimaComprobacion: null } },
      configPredeterminada()
    )
    expect(t.split('\n')).toHaveLength(7)
    expect(t).toContain('Perfil de hardware: sin instalar')
    expect(t).toContain('Modelo de separación: sin instalar')
    expect(t).toContain('Dispositivo: sin instalar')
    expect(t).toContain('yt-dlp: sin instalar')
    expect(t).toContain('Última comprobación de yt-dlp: sin instalar')
  })

  it('infoSoporte con Rápido incluye la fecha del consentimiento y el dispositivo', () => {
    const c = configPredeterminada()
    c.instalacion.perfil_hardware = 'cpu'
    c.separacion.modo = 'rapido'
    c.separacion.rapido_aceptado = '2026-11-05T10:00:00.000Z'
    c.separacion.modelos_descargados = ['rapido']
    const t = infoSoporte({ ...info, ytdlp: { version: null, ultimaComprobacion: null } }, c)
    expect(t).toContain('Modelo de separación: rapido (aceptado el 2026-11-05)')
    expect(t).toContain('Dispositivo: cpu')
  })

  it('infoSoporte marca la arquitectura emulada', () => {
    const t = infoSoporte(
      {
        ...info,
        plataforma: 'win32',
        versionSo: '10.0.22631',
        arquitectura: 'arm64',
        emulada: true
      },
      configPredeterminada()
    )
    expect(t).toContain('Sistema: Windows 10.0.22631 · arm64 (emulada)')
  })
})

describe('DialogoAcercaDe', () => {
  it('Esc en un diálogo anidado solo cierra el de arriba', async () => {
    instalar()
    const alCerrar = vi.fn()
    render(<DialogoAcercaDe abierto alCerrar={alCerrar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver licencia' }))
    await screen.findByText('GNU GENERAL PUBLIC LICENSE')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(alCerrar).not.toHaveBeenCalled()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(alCerrar).toHaveBeenCalledOnce()
  })
})
