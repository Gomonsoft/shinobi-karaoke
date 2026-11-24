import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { LimiteErrores } from '../../navegacion/LimiteErrores'
import { NavegacionContexto } from '../../navegacion/estado'
import { ERR } from '../../navegacion/textosError'
import { reiniciarErroresInterfaz } from '../../soporte/erroresInterfaz'
import { reiniciarSalvamento } from '../../soporte/salvamento'
import { useGuardadoEditor } from './useGuardadoEditor'

/*
 * ERR-5: desmontar el editor por un fallo de dibujo envía el lote pendiente (antes `destruir()` lo descartaba).
 */
const inicial = letra([linea('a', 'Nubes de sal', 1000, { fin_ms: 3000 })])

function EditorFalso({ romper }: { romper: boolean }) {
  const g = useGuardadoEditor({
    cancionId: 'c-1',
    titulo: 'Inventada',
    obtenerSesion: () => 'sesion-1',
    alDesactualizada: () => undefined,
    letraInicial: inicial
  })
  const { cambiarLetra } = g
  useEffect(() => {
    cambiarLetra({ ...inicial, offset_ms: 5 })
  }, [cambiarLetra])
  if (romper) throw new Error('fallo de dibujo')
  return <p>editor</p>
}

describe('guardado del editor al fallar la interfaz', () => {
  const guardarTiempos = vi.fn(() => Promise.resolve({}))
  beforeEach(() => {
    vi.useRealTimers()
    reiniciarErroresInterfaz()
    reiniciarSalvamento()
    guardarTiempos.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(window as unknown as { shinobi: unknown }).shinobi = {
      app: { registrarError: () => Promise.resolve(), guardadoPendiente: () => Promise.resolve() },
      letras: { guardarTiempos, editarTextoLinea: () => Promise.resolve({}) },
      biblioteca: { guardarApariencia: () => Promise.resolve({}) },
      sistema: { info: () => Promise.reject(new Error('x')) }
    }
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as { shinobi?: unknown }).shinobi
  })

  it('el lote sin enviar se envía antes de destruir el guardado', async () => {
    const arbol = (romper: boolean) => (
      <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: () => undefined }}>
        <LimiteErrores variante="vista" esEditor>
          <EditorFalso romper={romper} />
        </LimiteErrores>
      </NavegacionContexto.Provider>
    )
    const { rerender } = render(arbol(false))
    // El cambio ya está pendiente (dentro del debounce de 1 s); el fallo llega en el siguiente dibujo.
    rerender(arbol(true))
    expect(await screen.findByText(ERR.editor.guardado)).toBeInTheDocument()
    await waitFor(() => expect(guardarTiempos).toHaveBeenCalledOnce())
  })
})
