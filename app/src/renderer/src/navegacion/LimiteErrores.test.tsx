import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fijarContextoError, reiniciarErroresInterfaz } from '../soporte/erroresInterfaz'
import { registrarSalvador, reiniciarSalvamento } from '../soporte/salvamento'
import { LimiteErrores } from './LimiteErrores'
import { ERR } from './textosError'

function Roto({ roto }: { roto: boolean }) {
  if (roto) throw new Error('boom de prueba')
  return <p>Todo bien</p>
}

describe('límite de errores de la interfaz', () => {
  const registrarError = vi.fn(() => Promise.resolve())
  beforeEach(() => {
    reiniciarErroresInterfaz()
    reiniciarSalvamento()
    registrarError.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(window as unknown as { shinobi: unknown }).shinobi = {
      app: { registrarError },
      sistema: { info: () => Promise.reject(new Error('sin info')) }
    }
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as { shinobi?: unknown }).shinobi
  })

  it('un componente que lanza muestra la pantalla de error y se registra con su contexto', () => {
    fijarContextoError({ vista: 'cancion/editor', cancionId: 'c-1' })
    render(
      <LimiteErrores variante="vista" esEditor alBiblioteca={() => undefined}>
        <Roto roto />
      </LimiteErrores>
    )
    expect(screen.getByRole('heading', { name: ERR.vista.titulo })).toHaveFocus()
    expect(screen.getByText(ERR.editor.historial)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ERR.vista.biblioteca })).toBeInTheDocument()
    expect(registrarError).toHaveBeenCalledOnce()
    const [carga] = registrarError.mock.calls[0] as unknown as [Record<string, string>]
    expect(carga).toMatchObject({
      origen: 'react',
      vista: 'cancion/editor',
      cancionId: 'c-1'
    })
    expect(carga.mensaje).toContain('boom de prueba')
    expect(carga.componentes).toContain('Roto')
  })

  it('«Volver a cargar» monta de nuevo; si falla otra vez en menos de 10 s, recomienda la Biblioteca', async () => {
    function Contenedor() {
      const [roto, setRoto] = useState(true)
      return (
        <>
          <button onClick={() => setRoto(false)}>arreglar</button>
          <LimiteErrores variante="vista" alBiblioteca={() => undefined}>
            <Roto roto={roto} />
          </LimiteErrores>
        </>
      )
    }
    render(<Contenedor />)
    fireEvent.click(screen.getByRole('button', { name: ERR.vista.recargar }))
    // Sigue roto: falla de nuevo enseguida.
    expect(await screen.findByText(ERR.vista.repetido)).toBeInTheDocument()
    fireEvent.click(screen.getByText('arreglar'))
    fireEvent.click(screen.getByRole('button', { name: ERR.vista.recargar }))
    await waitFor(() => expect(screen.getByText('Todo bien')).toBeInTheDocument())
  })

  it('el lote pendiente del editor se envía antes de mostrar «guardado»', async () => {
    let enviado = false
    registrarSalvador(async () => {
      await Promise.resolve()
      enviado = true
      return true
    })
    render(
      <LimiteErrores variante="vista" esEditor>
        <Roto roto />
      </LimiteErrores>
    )
    expect(await screen.findByText(ERR.editor.guardado)).toBeInTheDocument()
    expect(enviado).toBe(true)
  })

  it('si el guardado falla, la pantalla lo dice', async () => {
    registrarSalvador(async () => false)
    render(
      <LimiteErrores variante="vista" esEditor>
        <Roto roto />
      </LimiteErrores>
    )
    expect(await screen.findByText(ERR.editor.noGuardado)).toBeInTheDocument()
  })

  it('variante pública: solo el texto, sin botones ni detalles', () => {
    render(
      <LimiteErrores variante="publico">
        <Roto roto />
      </LimiteErrores>
    )
    expect(screen.getByText(ERR.publico)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('reproductor: Esc sale', async () => {
    const salir = vi.fn()
    render(
      <LimiteErrores variante="reproductor" alSalir={salir}>
        <Roto roto />
      </LimiteErrores>
    )
    await act(async () => {})
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(salir).toHaveBeenCalledOnce()
  })

  it('al cambiar de vista (clave) el límite se reinicia', () => {
    const { rerender } = render(
      <LimiteErrores variante="vista" clave="a">
        <Roto roto />
      </LimiteErrores>
    )
    expect(screen.getByText(ERR.vista.titulo)).toBeInTheDocument()
    rerender(
      <LimiteErrores variante="vista" clave="b">
        <Roto roto={false} />
      </LimiteErrores>
    )
    expect(screen.getByText('Todo bien')).toBeInTheDocument()
  })
})
