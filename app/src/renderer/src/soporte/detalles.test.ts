import { afterEach, describe, expect, it, vi } from 'vitest'
import { conLineaVersion, copiarDetalles, olvidarLineaVersion } from './detalles'

const SHA = '9e07c55' + 'a'.repeat(33)

function api(info: () => Promise<unknown>): void {
  ;(window as unknown as { shinobi: unknown }).shinobi = { sistema: { info } }
}

afterEach(() => olvidarLineaVersion())

describe('detalles de soporte', () => {
  it('añade la línea de versión al final y pide info una sola vez', async () => {
    const info = vi.fn(() =>
      Promise.resolve({
        version: '0.2.0-alpha.3',
        compilacion: { canal: 'desarrollo', numero: 1260, commit: SHA }
      })
    )
    api(info)
    const esperado = 'ERROR_INTERNO: x\nVersión: 0.2.0-alpha.3-1260 (desarrollo, commit 9e07c55)'
    expect(await conLineaVersion('ERROR_INTERNO: x\n')).toBe(esperado)
    expect(await conLineaVersion('ERROR_INTERNO: x')).toBe(esperado)
    expect(info).toHaveBeenCalledTimes(1)
  })

  it('si info() falla copia el texto sin línea ni undefined', async () => {
    api(() => Promise.reject(new Error('no')))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    await copiarDetalles('texto')
    expect(writeText).toHaveBeenCalledWith('texto')
  })

  it('copiarDetalles usa el portapapeles con la línea', async () => {
    api(() =>
      Promise.resolve({
        version: '0.1.0',
        compilacion: { canal: 'local', numero: null, commit: null }
      })
    )
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    await copiarDetalles('a')
    expect(writeText).toHaveBeenCalledWith('a\nVersión: 0.1.0 (local, sin número, sin commit)')
  })
})
