import { describe, expect, it, vi } from 'vitest'
import { dialogoConDoblePruebas, VARIABLE_DIALOGO_PRUEBAS } from './dialogoPruebas'

const real = { showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })) }
const opciones = { properties: ['openFile' as const], filters: [] }

describe('dialogoConDoblePruebas', () => {
  it('sin variable o empaquetada devuelve el diálogo real', () => {
    expect(dialogoConDoblePruebas(real, { env: {}, empaquetada: false })).toBe(real)
    const env = { [VARIABLE_DIALOGO_PRUEBAS]: '/x/a.wav' }
    expect(dialogoConDoblePruebas(real, { env, empaquetada: true })).toBe(real)
  })

  it('con variable devuelve la ruta o cancela, sin tocar el real', async () => {
    const elige = dialogoConDoblePruebas(real, {
      env: { [VARIABLE_DIALOGO_PRUEBAS]: '/x/a.wav' },
      empaquetada: false
    })
    expect(await elige.showOpenDialog(opciones)).toEqual({
      canceled: false,
      filePaths: ['/x/a.wav']
    })
    const cancela = dialogoConDoblePruebas(real, {
      env: { [VARIABLE_DIALOGO_PRUEBAS]: 'cancelar' },
      empaquetada: false
    })
    expect((await cancela.showOpenDialog(opciones)).canceled).toBe(true)
    expect(real.showOpenDialog).not.toHaveBeenCalled()
  })
})
