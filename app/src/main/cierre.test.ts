import { describe, expect, it, vi } from 'vitest'
import { crearControlCierre, hayAlgoEnCurso } from './cierre'

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

describe('hayAlgoEnCurso (0073)', () => {
  const fuentes = (instalando: boolean, hayTrabajos: boolean) => ({
    instalando: () => instalando,
    hayTrabajos: () => hayTrabajos
  })

  it('un trabajo en curso o solo en cola cuenta; sin nada, no', () => {
    expect(hayAlgoEnCurso(fuentes(false, true))).toBe(true)
    expect(hayAlgoEnCurso(fuentes(false, false))).toBe(false)
  })

  it('la instalación del runtime sigue contando', () => {
    expect(hayAlgoEnCurso(fuentes(true, false))).toBe(true)
  })

  it('con trabajos se frena el cierre y se pide confirmación', () => {
    const { control, deps } = preparar(hayAlgoEnCurso(fuentes(false, true)))
    const e = { preventDefault: vi.fn() }
    control.alSalir(e)
    expect(e.preventDefault).toHaveBeenCalledOnce()
    expect(deps.pedirConfirmacion).toHaveBeenCalledOnce()
  })
})

it('pide vaciado con guardado pendiente y permite el cierre confirmado si el renderer agotó su plazo', async () => {
  const pedirConfirmacion = vi.fn()
  const cierreConfirmado = { preventDefault: vi.fn() }
  const control = crearControlCierre({
    hayAlgoEnCurso: () =>
      hayAlgoEnCurso({
        instalando: () => false,
        hayTrabajos: () => false,
        guardadoPendiente: () => true
      }),
    pedirConfirmacion,
    pausar: async () => undefined,
    cerrarVentana: () => control.alCerrarVentana(cierreConfirmado),
    salir: vi.fn()
  })
  const evento = { preventDefault: vi.fn() }
  control.alCerrarVentana(evento)
  expect(evento.preventDefault).toHaveBeenCalledOnce()
  expect(pedirConfirmacion).toHaveBeenCalledOnce()
  await control.confirmar()
  expect(cierreConfirmado.preventDefault).not.toHaveBeenCalled()
})
