import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import { iniciarSeguimiento, reiniciarPaquetes, alProgreso } from '../biblioteca/paquete/almacen'
import { ControladorPaquetes } from '../biblioteca/paquete/ControladorPaquetes'
import { montarApiPaquetes } from '../biblioteca/paquete/pruebas'
import { CopiaAjustes } from './CopiaAjustes'

const TRABAJO = '8d0c1f2e-3b44-4a55-8a66-0123456789ab'
const listas = (n: number, modificada = '2026-11-03T10:00:00Z') =>
  Array.from({ length: n }, (_, i) => resumenPrueba({ id: `l${i}`, estado: 'lista', modificada }))

function montar(
  canciones = listas(0),
  ultima: unknown = null,
  extra: Parameters<typeof montarApiPaquetes>[0] = {}
) {
  const fake = montarApiPaquetes({
    canciones,
    config: { copias: { ultima } },
    copias: {
      destinoPropuesto: () =>
        Promise.resolve({
          destinoId: '11111111-2222-4333-8444-555555555555',
          nombre: 'Copia de Shinobi Karaoke 2026-11-21.shinobi',
          carpeta: '/Documentos',
          libreBytes: null
        })
    },
    ...extra
  })
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'ajustes' }, ir: vi.fn() } as never}>
      <CopiaAjustes />
      <ControladorPaquetes />
    </NavegacionContexto.Provider>
  )
  return fake
}

beforeEach(reiniciarPaquetes)
afterEach(cleanup)

describe('Ajustes › Copia de seguridad', () => {
  it('sin ninguna copia: lo dice, y con 3 canciones listas recuerda hacer una', async () => {
    montar(listas(3))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Copia de seguridad' })
    ).toBeInTheDocument()
    expect(screen.getByText('Aún no has hecho ninguna copia de seguridad.')).toBeInTheDocument()
    expect(
      await screen.findByText(
        'Tienes 3 canciones listas. Una copia las protege si se estropea el disco o cambias de equipo.'
      )
    ).toBeInTheDocument()
  })

  it('con 2 listas no recuerda nada', async () => {
    montar(listas(2))
    await screen.findByText('Aún no has hecho ninguna copia de seguridad.')
    await act(async () => undefined)
    expect(document.querySelector('[data-recordatorio]')).toBeNull()
  })

  it('con copia: fecha, canciones, tamaño y tipo; con 5 cambiadas desde entonces, el recordatorio', async () => {
    const ultima = {
      fecha: '2026-11-12T17:00:00.000Z',
      canciones: 17,
      bytes: 1_700_000_000,
      tipo: 'completa'
    }
    montar(
      [
        ...listas(6, '2026-11-20T10:00:00Z'),
        ...listas(2, '2026-11-01T10:00:00Z').map((c) => ({ ...c, id: `v${c.id}` }))
      ],
      ultima
    )
    expect(
      await screen.findByText('Última copia: 12 nov 2026 · 17 canciones · 1,7 GB · completa')
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Desde entonces has añadido o cambiado 6 canciones.')
    ).toBeInTheDocument()
  })

  it('con 4 cambiadas desde la copia no recuerda nada', async () => {
    const ultima = {
      fecha: '2026-11-12T17:00:00.000Z',
      canciones: 1,
      bytes: 5_000_000,
      tipo: 'ligera'
    }
    montar(listas(4, '2026-11-20T10:00:00Z'), ultima)
    expect(
      await screen.findByText('Última copia: 12 nov 2026 · 1 canción · 5 MB · ligera')
    ).toBeInTheDocument()
    await act(async () => undefined)
    expect(document.querySelector('[data-recordatorio]')).toBeNull()
  })

  it('con la biblioteca vacía «Crear copia de seguridad…» no actúa y dice por qué', async () => {
    montar([])
    const crear = await screen.findByRole('button', { name: 'Crear copia de seguridad…' })
    await act(async () => undefined)
    expect(screen.getByRole('button', { name: 'Crear copia de seguridad…' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    fireEvent.click(crear)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Restaurar o importar…' })).not.toHaveAttribute(
      'aria-disabled'
    )
  })

  it('«Crear copia de seguridad…» abre el diálogo y «Restaurar o importar…» el selector', async () => {
    const elegirOrigen = vi.fn(() => Promise.resolve(null))
    montar(listas(2), null, { copias: { elegirOrigen } })
    await act(async () => undefined)
    fireEvent.click(await screen.findByRole('button', { name: 'Crear copia de seguridad…' }))
    expect(
      await screen.findByRole('dialog', { name: 'Crear copia de seguridad' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar o importar…' }))
    await act(async () => undefined)
    expect(elegirOrigen).toHaveBeenCalled()
  })

  it('mientras se crea: «Ver la copia en curso» y la barra con la canción actual', async () => {
    montar(listas(2))
    act(() =>
      iniciarSeguimiento({
        tipo: 'exportar',
        trabajoId: TRABAJO,
        completo: true,
        esCopia: true,
        n: 2,
        peticion: { tipo: 'biblioteca' }
      })
    )
    act(() =>
      alProgreso({
        trabajoId: TRABAJO,
        fraccion: 0.5,
        cancion: { hechas: 1, total: 2, titulo: 'X' }
      })
    )
    expect(
      await screen.findByText('Creando la copia de seguridad… 1 de 2 canciones')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver la copia en curso' }))
    expect(
      await screen.findByRole('dialog', { name: 'Creando la copia de seguridad' })
    ).toBeInTheDocument()
  })
})
