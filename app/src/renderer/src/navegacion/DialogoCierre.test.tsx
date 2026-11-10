import { act, fireEvent, render, screen } from '@testing-library/react'
import { DialogoCierre } from './DialogoCierre'
import { registrarBorradorAlCerrar } from './salida'
import { cuerpoCierre, listaBreve } from './textosCierre'
import type { Vista } from './estado'

let solicitar: () => void
const confirmarCierre = vi.fn().mockResolvedValue(undefined)

function instalar(trabajos: string[], titulos: Record<string, string>) {
  confirmarCierre.mockClear()
  ;(window as unknown as { shinobi: unknown }).shinobi = {
    app: {
      confirmarCierre,
      alSolicitudCierre: (cb: () => void) => {
        solicitar = cb
        return () => undefined
      }
    },
    trabajos: {
      listar: () => Promise.resolve(trabajos.map((cancionId) => ({ cancionId })))
    },
    biblioteca: {
      listar: () => Promise.resolve(Object.entries(titulos).map(([id, titulo]) => ({ id, titulo })))
    }
  }
}

async function pedir(vista: Vista = { tipo: 'biblioteca' }) {
  render(<DialogoCierre vista={vista} />)
  await act(async () => solicitar())
}

describe('textos de cierre', () => {
  it('lista breve: hasta 3 títulos y "y {k} más"', () => {
    expect(listaBreve(['A'])).toBe('«A»')
    expect(listaBreve(['A', 'B', 'C'])).toBe('«A», «B» y «C»')
    expect(listaBreve(['A', 'B', 'C', 'D', 'E'])).toBe('«A», «B», «C» y 2 más')
  })
  it('singular y plural', () => {
    expect(cuerpoCierre(1, ['A'])).toMatch(/^Hay 1 trabajo sin terminar \(«A»\)\./)
    expect(cuerpoCierre(2, [])).toMatch(/^Hay 2 trabajos sin terminar\./)
  })
})

describe('DialogoCierre', () => {
  it('con trabajos muestra el diálogo con el foco en "Seguir trabajando"', async () => {
    instalar(['a', 'b'], { a: 'Bohemian Rhapsody', b: 'Imagine' })
    await pedir()
    expect(screen.getByRole('dialog', { name: '¿Cerrar Shinobi Karaoke?' })).toBeInTheDocument()
    expect(
      screen.getByText(/Hay 2 trabajos sin terminar \(«Bohemian Rhapsody» y «Imagine»\)/)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seguir trabajando' })).toHaveFocus()
    expect(confirmarCierre).not.toHaveBeenCalled()
  })

  it('nombra como máximo 3 canciones y resume el resto', async () => {
    instalar(['a', 'b', 'c', 'd', 'e'], { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' })
    await pedir()
    expect(screen.getByText(/«A», «B», «C» y 2 más/)).toBeInTheDocument()
  })

  it('Esc y "Seguir trabajando" cierran el diálogo sin cerrar la app', async () => {
    instalar(['a'], { a: 'A' })
    await pedir()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmarCierre).not.toHaveBeenCalled()
  })

  it('"Cerrar de todos modos" confirma el cierre a main', async () => {
    instalar(['a'], { a: 'A' })
    await pedir()
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar de todos modos' }))
    )
    expect(confirmarCierre).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sin trabajos responde sin diálogo', async () => {
    instalar([], {})
    await pedir()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmarCierre).toHaveBeenCalledOnce()
  })

  it('durante el primer arranque lo gestiona esa vista', async () => {
    instalar(['a'], { a: 'A' })
    await pedir({ tipo: 'primer-arranque' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmarCierre).not.toHaveBeenCalled()
  })

  it('con un borrador de tema sin guardar delega en su diálogo: seguir cancela el cierre', async () => {
    instalar([], {})
    const baja = registrarBorradorAlCerrar(async () => false)
    await pedir()
    expect(confirmarCierre).not.toHaveBeenCalled()
    baja()
  })

  it('con un borrador de tema, descartarlo o guardarlo permite el cierre', async () => {
    instalar([], {})
    const baja = registrarBorradorAlCerrar(async () => true)
    await pedir()
    expect(confirmarCierre).toHaveBeenCalledOnce()
    baja()
  })
})
