import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContenedorToasts } from '../componentes/Toasts'
import { cerrarTodosLosToasts } from '../componentes/gestorToasts'
import { estadoPaquetes, reiniciarPaquetes } from '../vistas/biblioteca/paquete/almacen'
import type { Vista } from './estado'
import { useArrastrarArchivo } from './useArrastrarArchivo'

function Sonda({ vista, ir }: { vista: Vista; ir: (v: Vista) => void }) {
  useArrastrarArchivo(vista, ir)
  return null
}

function soltar(archivos: File[]) {
  const e = new Event('drop', { cancelable: true }) as Event & { dataTransfer: unknown }
  e.dataTransfer = { types: ['Files'], files: archivos, items: [] }
  act(() => {
    window.dispatchEvent(e)
  })
  return e
}

const montar = (vista: Vista) => {
  const ir = vi.fn()
  ;(window as unknown as { shinobi: unknown }).shinobi = { rutaDeArchivo: () => '/x/a.mp3' }
  render(
    <>
      <Sonda vista={vista} ir={ir} />
      <ContenedorToasts />
    </>
  )
  return ir
}

beforeEach(() => {
  reiniciarPaquetes()
  cerrarTodosLosToasts()
})
afterEach(cleanup)

describe('arrastrar un paquete .shinobi (F9-12)', () => {
  it('sobre la Biblioteca abre el diálogo de importar con ese archivo y no la vista 03', () => {
    const ir = montar({ tipo: 'biblioteca' })
    const archivo = new File(['x'], 'Copia.SHINOBI')
    const e = soltar([archivo])
    expect(e.defaultPrevented).toBe(true)
    expect(estadoPaquetes().importar?.archivo).toBe(archivo)
    expect(ir).not.toHaveBeenCalled()
  })

  it('en Ajustes también; en otras vistas no hace nada', () => {
    montar({ tipo: 'ajustes' })
    soltar([new File(['x'], 'copia.shinobi')])
    expect(estadoPaquetes().importar).not.toBeNull()
    cleanup()
    reiniciarPaquetes()
    montar({ tipo: 'cancion', id: 'a', paso: 'editor' })
    soltar([new File(['x'], 'copia.shinobi')])
    expect(estadoPaquetes().importar).toBeNull()
  })

  it('con varios archivos usa el primero y avisa', async () => {
    montar({ tipo: 'biblioteca' })
    const primero = new File(['x'], 'uno.shinobi')
    soltar([primero, new File(['x'], 'dos.shinobi')])
    expect(estadoPaquetes().importar?.archivo).toBe(primero)
    expect(
      await screen.findByText('Los paquetes se importan de uno en uno. Se abrirá el primero.')
    ).toBeInTheDocument()
  })

  it('con otro diálogo abierto se ignora', () => {
    montar({ tipo: 'biblioteca' })
    const dialogo = document.createElement('div')
    dialogo.setAttribute('role', 'dialog')
    document.body.append(dialogo)
    soltar([new File(['x'], 'copia.shinobi')])
    dialogo.remove()
    expect(estadoPaquetes().importar).toBeNull()
  })

  it('un audio sigue abriendo la vista 03', () => {
    const ir = montar({ tipo: 'biblioteca' })
    soltar([new File(['x'], 'cancion.mp3')])
    expect(estadoPaquetes().importar).toBeNull()
    expect(ir).toHaveBeenCalledWith({ tipo: 'anadir', archivo: '/x/a.mp3' })
  })
})
