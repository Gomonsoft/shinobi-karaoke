import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { estiloPredeterminado } from '@shared/estilo'
import { GuardadoEditor } from './guardado'

function preparar() {
  const guardarTiempos = vi.fn(async () => undefined)
  const guardarApariencia = vi.fn(async () => undefined)
  const alEstado = vi.fn()
  const alDesactualizada = vi.fn()
  const editor = new GuardadoEditor({
    cancionId: 'c',
    api: { guardarTiempos, guardarApariencia },
    alEstado,
    alDesactualizada
  })
  return { editor, guardarTiempos, guardarApariencia, alEstado, alDesactualizada }
}

const l = (offset_ms: number) => ({ ...letra([linea('a', 'El viento', 2000)]), offset_ms })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('envía la última instantánea tras 1 s sin cambios y agrupa estilo con tiempos', async () => {
  const { editor, guardarTiempos, guardarApariencia, alEstado } = preparar()
  editor.cambiarLetra(l(100))
  await vi.advanceTimersByTimeAsync(900)
  editor.cambiarLetra(l(200))
  editor.cambiarEstilo(estiloPredeterminado())
  await vi.advanceTimersByTimeAsync(999)
  expect(guardarTiempos).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(guardarTiempos).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ offset_ms: 200 })
  )
  expect(guardarApariencia).toHaveBeenCalledExactlyOnceWith('c', {
    modo: 'propio',
    estilo: estiloPredeterminado()
  })
  expect(alEstado.mock.calls.map(([e]) => e.estado)).toEqual(['guardando', 'guardado'])
})

it('escribe antes de superar 2 s aunque haya cambios continuos', async () => {
  const { editor, guardarTiempos } = preparar()
  editor.cambiarLetra(l(100))
  await vi.advanceTimersByTimeAsync(900)
  editor.cambiarLetra(l(200))
  await vi.advanceTimersByTimeAsync(900)
  editor.cambiarLetra(l(300))
  await vi.advanceTimersByTimeAsync(200)
  expect(guardarTiempos).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ offset_ms: 300 })
  )
})

it('un fallo conserva el último cambio y reintenta al cabo de 5 s', async () => {
  const { editor, guardarTiempos, alEstado } = preparar()
  guardarTiempos.mockRejectedValueOnce({ codigo: 'ERROR_INTERNO', mensaje: 'Disco ocupado' })
  editor.cambiarLetra(l(100))
  expect(await editor.vaciar()).toBe(false)
  expect(alEstado).toHaveBeenLastCalledWith({
    estado: 'error',
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Disco ocupado' }
  })
  editor.cambiarLetra(l(200))
  await vi.advanceTimersByTimeAsync(4999)
  expect(guardarTiempos).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1)
  expect(guardarTiempos).toHaveBeenLastCalledWith(expect.objectContaining({ offset_ms: 200 }))
  expect(alEstado).toHaveBeenLastCalledWith({ estado: 'guardado' })
})

it('descarta tiempos desactualizados y conserva el guardado del estilo', async () => {
  const { editor, guardarTiempos, guardarApariencia, alDesactualizada, alEstado } = preparar()
  guardarTiempos.mockRejectedValueOnce({ codigo: 'LETRA_DESACTUALIZADA' })
  editor.cambiarLetra(l(100))
  editor.cambiarEstilo(estiloPredeterminado())
  expect(await editor.vaciar()).toBe(true)
  expect(alDesactualizada).toHaveBeenCalledOnce()
  expect(alEstado).toHaveBeenLastCalledWith({ estado: 'guardado' })
  await vi.advanceTimersByTimeAsync(6000)
  expect(guardarTiempos).toHaveBeenCalledOnce()
  expect(guardarApariencia).toHaveBeenCalledOnce()
})

it('reenvía un cambio que llega en vuelo antes de resolver el vaciado', async () => {
  const { editor, guardarTiempos } = preparar()
  let resolver!: () => void
  guardarTiempos.mockReturnValueOnce(
    new Promise<undefined>((r) => {
      resolver = () => r(undefined)
    })
  )
  editor.cambiarLetra(l(100))
  const vaciado = editor.vaciar()
  await vi.advanceTimersByTimeAsync(0)
  editor.cambiarLetra(l(200))
  expect(guardarTiempos).toHaveBeenCalledOnce()
  resolver()
  expect(await vaciado).toBe(true)
  expect(guardarTiempos).toHaveBeenCalledTimes(2)
  expect(guardarTiempos).toHaveBeenLastCalledWith(expect.objectContaining({ offset_ms: 200 }))
  expect(editor.hayPendiente()).toBe(false)
})
