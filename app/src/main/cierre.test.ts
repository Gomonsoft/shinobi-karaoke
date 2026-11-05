import { describe, expect, it, vi } from 'vitest'
import { crearControlCierre } from './cierre'

function preparar(enCurso: boolean) {
  const estado = { enCurso }
  const orden: string[] = []
  const deps = {
    hayAlgoEnCurso: () => estado.enCurso,
    pedirConfirmacion: vi.fn(() => void orden.push('pedir')),
    pausar: vi.fn(async () => {
      orden.push('pausar')
      estado.enCurso = false
    }),
    cerrarVentana: vi.fn(() => void orden.push('cerrar')),
    salir: vi.fn(() => void orden.push('salir'))
  }
  return { control: crearControlCierre(deps), deps, orden }
}

describe('solicitud de cierre', () => {
  it('sin instalación en curso el cierre sigue su camino', () => {
    const { control, deps } = preparar(false)
    const e = { preventDefault: vi.fn() }
    control.alCerrarVentana(e)
    control.alSalir(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(deps.pedirConfirmacion).not.toHaveBeenCalled()
  })

  it('con instalación en curso se frena el cierre y se pide confirmación', () => {
    const { control, deps } = preparar(true)
    const e = { preventDefault: vi.fn() }
    control.alCerrarVentana(e)
    expect(e.preventDefault).toHaveBeenCalledOnce()
    expect(deps.pedirConfirmacion).toHaveBeenCalledOnce()
    expect(deps.pausar).not.toHaveBeenCalled()
  })

  it('al confirmar se pausa y después se cierra la ventana', async () => {
    const { control, orden } = preparar(true)
    control.alCerrarVentana({ preventDefault: vi.fn() })
    await control.confirmar()
    expect(orden).toEqual(['pedir', 'pausar', 'cerrar'])
  })

  it('Salir (Cmd+Q) pasa por la solicitud y al confirmar sale de la app', async () => {
    const { control, deps, orden } = preparar(true)
    const e = { preventDefault: vi.fn() }
    control.alSalir(e)
    expect(e.preventDefault).toHaveBeenCalledOnce()
    await control.confirmar()
    expect(orden).toEqual(['pedir', 'pausar', 'salir'])
    expect(deps.cerrarVentana).not.toHaveBeenCalled()
  })

  it('si el renderer no responde no pasa nada; una confirmación suelta no cierra', async () => {
    const { control, deps } = preparar(true)
    await control.confirmar()
    expect(deps.pausar).not.toHaveBeenCalled()
    control.alCerrarVentana({ preventDefault: vi.fn() })
    await control.confirmar()
    await control.confirmar()
    expect(deps.pausar).toHaveBeenCalledOnce()
    expect(deps.cerrarVentana).toHaveBeenCalledOnce()
  })
})
