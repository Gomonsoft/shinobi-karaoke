import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiShinobi, CambioPreparacionIpc, ResumenCancionIpc } from '@shared/ipc'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto } from '../../navegacion/estado'
import { paso, resumenPrueba } from './resumenPrueba'
import { puedeAjustarFines, useAjustarFines } from './useAjustarFines'

const conLetraSinMarca = (extra: Partial<ResumenCancionIpc> = {}): ResumenCancionIpc =>
  resumenPrueba({
    id: 'c1',
    titulo: 'Semestre de Otoño',
    pasos: {
      fuente: paso('completado'),
      separacion: paso('completado'),
      letra: paso('completado'),
      edicion: paso('pendiente')
    },
    prepararFinesSinMarca: true,
    lineasSinFin: 31,
    ...extra
  } as ResumenCancionIpc)

function Arnes({ resumen }: { resumen: ResumenCancionIpc }) {
  const a = useAjustarFines((id) => (id === resumen.id ? resumen : undefined))
  return (
    <>
      <button onClick={() => a.pedir(resumen.id)}>abrir</button>
      {a.dialogo}
    </>
  )
}

function montar(preparar: ReturnType<typeof vi.fn>) {
  let cambio: (c: CambioPreparacionIpc) => void = () => undefined
  ;(window as unknown as { shinobi: Partial<ApiShinobi> }).shinobi = {
    preparacion: {
      preparar,
      alCambiar: (cb: (c: CambioPreparacionIpc) => void) => ((cambio = cb), () => undefined)
    }
  } as unknown as Partial<ApiShinobi>
  const ir = vi.fn()
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir }}>
      <Arnes resumen={conLetraSinMarca()} />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { ir, emitir: (c: CambioPreparacionIpc) => act(() => cambio(c)) }
}

afterEach(() => {
  cleanup()
  cerrarTodosLosToasts()
})

describe('«Ajustar los fines…» (F5-B12)', () => {
  it('solo se ofrece con letra sin marca, líneas sin fin y sin trabajo en curso', () => {
    expect(puedeAjustarFines(conLetraSinMarca(), false)).toBe(true)
    expect(puedeAjustarFines(conLetraSinMarca(), true)).toBe(false)
    expect(puedeAjustarFines(conLetraSinMarca({ prepararFinesSinMarca: false }), false)).toBe(false)
    expect(puedeAjustarFines(conLetraSinMarca({ lineasSinFin: 0 }), false)).toBe(false)
  })

  it('el diálogo dice cuántas líneas, enfoca Cancelar y Cancelar no llama a main', () => {
    const preparar = vi.fn()
    montar(preparar)
    fireEvent.click(screen.getByText('abrir'))
    const dlg = screen.getByRole('dialog', { name: '¿Ajustar los fines de «Semestre de Otoño»?' })
    expect(dlg).toHaveTextContent('Solo pondremos fin a las 31 líneas que no lo tienen')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(preparar).not.toHaveBeenCalled()
  })

  it('confirmar llama con finesSinMarca y avisa al empezar y al terminar con los fines puestos', async () => {
    const preparar = vi.fn(() => Promise.resolve({ aceptadas: ['c1'], omitidas: [] }))
    const { emitir, ir } = montar(preparar)
    fireEvent.click(screen.getByText('abrir'))
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar los fines' }))
    await waitFor(() =>
      expect(screen.getByText('Ajustando los fines de «Semestre de Otoño»…')).toBeInTheDocument()
    )
    expect(preparar).toHaveBeenCalledWith(['c1'], { finesSinMarca: true })
    emitir({ id: 'c1', preparacion: { estado: 'lista_para_revisar', fines: { lineas: 28 } } })
    expect(
      await screen.findByText(
        'Pusimos fin a 28 de 31 líneas de «Semestre de Otoño». Las demás no tenían una pausa clara.'
      )
    ).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver la letra' }).at(-1)!)
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'editor' })
  })

  it('con 0 fines puestos lo dice y no ofrece ver la letra', async () => {
    const { emitir } = montar(vi.fn(() => Promise.resolve({ aceptadas: ['c1'], omitidas: [] })))
    fireEvent.click(screen.getByText('abrir'))
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar los fines' }))
    await screen.findByText(/Ajustando los fines/)
    emitir({ id: 'c1', preparacion: { estado: 'lista_para_revisar', fines: { lineas: 0 } } })
    expect(
      await screen.findByText(
        'No encontramos pausas claras en «Semestre de Otoño»: no hemos cambiado nada.'
      )
    ).toBeInTheDocument()
  })

  it('en una Lista (sin registro) main devuelve los fines y se avisa al momento', async () => {
    montar(vi.fn(() => Promise.resolve({ aceptadas: ['c1'], omitidas: [], fines: { c1: 0 } })))
    fireEvent.click(screen.getByText('abrir'))
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar los fines' }))
    expect(
      await screen.findByText(
        'No encontramos pausas claras en «Semestre de Otoño»: no hemos cambiado nada.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Ajustando los fines/)).toBeNull()
  })
})
