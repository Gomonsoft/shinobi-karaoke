import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiShinobi } from '@shared/ipc'
import { ContenedorToasts } from '../../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../../componentes/gestorToasts'
import { paso, resumenPrueba } from '../resumenPrueba'
import { motivoNoAplica } from './modelo'
import { DialogoPreparar } from './DialogoPreparar'

const pasos = {
  fuente: paso('completado'),
  separacion: paso('completado'),
  letra: paso('completado'),
  edicion: paso('pendiente')
}
const sinMarca = resumenPrueba({
  id: 'a',
  titulo: 'Semestre de Otoño',
  pasos,
  prepararFinesSinMarca: true,
  lineasSinFin: 5
})
const otra = resumenPrueba({
  id: 'b',
  titulo: 'Eco de Plata',
  pasos: { ...pasos, letra: paso('pendiente') }
})

afterEach(() => {
  cleanup()
  cerrarTodosLosToasts()
})

describe('«Preparar» por lotes con letras sin marca (F5-B13)', () => {
  it('la nota y el aviso hacen de confirmación y main recibe finesSinMarca', async () => {
    const preparar = vi.fn(() => Promise.resolve({ aceptadas: ['a', 'b'], omitidas: [] }))
    ;(window as unknown as { shinobi: Partial<ApiShinobi> }).shinobi = {
      preparacion: {
        previsualizar: () =>
          Promise.resolve([
            { id: 'a', aplica: true, pasos: ['ajustando_fines'], confirmar: 'finesSinMarca' },
            { id: 'b', aplica: true, pasos: ['buscando_letra', 'comprobando', 'ajustando_fines'] }
          ]),
        preparar
      }
    } as unknown as Partial<ApiShinobi>
    const alCerrar = vi.fn()
    render(
      <>
        <DialogoPreparar canciones={[sinMarca, otra]} alCerrar={alCerrar} />
        <ContenedorToasts />
      </>
    )
    expect(await screen.findByText(/solo pondrá los fines que faltan/)).toBeInTheDocument()
    expect(
      screen.getByText(/1 de estas canciones tiene una letra de una versión anterior/)
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Preparar 2 canciones/ }))
    await waitFor(() => expect(alCerrar).toHaveBeenCalledWith({ tipo: 'hecho' }))
    expect(preparar).toHaveBeenCalledWith(['a', 'b'], { finesSinMarca: true })
  })

  it('en la barra, una canción con letra sin marca cuenta como aplicable', () => {
    const ctx = { conTrabajo: new Set<string>(), exportando: new Set<string>(), activaId: null }
    expect(motivoNoAplica('preparar', sinMarca, ctx)).toBeNull()
    expect(
      motivoNoAplica('preparar', { ...sinMarca, prepararFinesSinMarca: false }, ctx)
    ).not.toBeNull()
  })
})
