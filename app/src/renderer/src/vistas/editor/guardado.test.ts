import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { letra, linea, pausa } from '@shared/__fixtures__'
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
  editor.cambiarApariencia({ modo: 'propio', estilo: estiloPredeterminado() })
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
  editor.cambiarApariencia({ modo: 'propio', estilo: estiloPredeterminado() })
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

it('guarda la última selección de apariencia (tema o heredar) y la reenvía tras un fallo', async () => {
  const { editor, guardarApariencia } = preparar()
  const temaId = '0b9f7a4e-3c1d-4f6a-9d2e-5a8b1c7e4f30'
  guardarApariencia.mockRejectedValueOnce({ codigo: 'ERROR_INTERNO', mensaje: 'Disco ocupado' })
  editor.cambiarApariencia({ modo: 'tema', temaId })
  editor.cambiarApariencia({ modo: 'heredar' })
  expect(await editor.vaciar()).toBe(false)
  await vi.advanceTimersByTimeAsync(5000)
  expect(guardarApariencia).toHaveBeenCalledTimes(2)
  expect(guardarApariencia).toHaveBeenLastCalledWith('c', { modo: 'heredar' })
  expect(editor.hayPendiente()).toBe(false)
})

it('llama a editarTextoLinea antes de guardarTiempos, solo por las líneas con texto distinto', async () => {
  const orden: string[] = []
  const editarTextoLinea = vi.fn(async () => void orden.push('texto'))
  const guardarTiempos = vi.fn(async () => void orden.push('tiempos'))
  const inicial = letra([linea('a', 'El viento', 2000), linea('b', 'Dos', 4000)])
  const editor = new GuardadoEditor({
    cancionId: 'c',
    letraInicial: inicial,
    api: { guardarTiempos, editarTextoLinea, guardarApariencia: vi.fn(async () => undefined) },
    alEstado: vi.fn(),
    alDesactualizada: vi.fn()
  })
  editor.cambiarLetra({
    ...inicial,
    lineas: inicial.lineas.map((e) => (e.id === 'a' ? { ...e, texto: 'El viento sopla' } : e))
  })
  await vi.advanceTimersByTimeAsync(1000)
  expect(editarTextoLinea).toHaveBeenCalledExactlyOnceWith({
    cancionId: 'c',
    id: 'a',
    texto: 'El viento sopla'
  })
  expect(orden).toEqual(['texto', 'tiempos'])
  // Una segunda escritura sin cambiar el texto no vuelve a llamarlo.
  editor.cambiarLetra({
    ...inicial,
    offset_ms: 100,
    lineas: inicial.lineas.map((e) => (e.id === 'a' ? { ...e, texto: 'El viento sopla' } : e))
  })
  await vi.advanceTimersByTimeAsync(1000)
  expect(editarTextoLinea).toHaveBeenCalledOnce()
})

it('envía el reparto completo y normalizado; sin reparto, `partes: null` (ADR 0029 §2)', async () => {
  const { editor, guardarTiempos } = preparar()
  const conReparto = {
    ...letra([linea('a', 'El viento', 2000), linea('b', 'La sal', 4000, { parte: 'c2' })]),
    partes: {
      cantantes: [
        { id: 'c1' as const, nombre: null },
        { id: 'c2' as const, nombre: 'Luis' }
      ]
    }
  }
  editor.cambiarLetra(conReparto)
  await vi.advanceTimersByTimeAsync(1000)
  const [primera] = guardarTiempos.mock.calls[0] as unknown as [
    { partes: unknown; tiempos: { parte?: string }[] }
  ]
  expect(primera.partes).toEqual(conReparto.partes)
  expect(primera.tiempos.map((t) => t.parte)).toEqual([undefined, 'c2'])

  editor.cambiarLetra(l(0))
  await vi.advanceTimersByTimeAsync(1000)
  expect(guardarTiempos).toHaveBeenLastCalledWith(expect.objectContaining({ partes: null }))
})

it('nunca envía `parte` en una pausa, ni aunque el dato venga raro (ADR 0029 §2)', async () => {
  const { editor, guardarTiempos } = preparar()
  const base = letra([linea('a', 'El viento', 2000), pausa('p'), linea('b', 'La sal', 6000)])
  const rara = {
    ...base,
    partes: { cantantes: [{ id: 'c1' as const, nombre: null }] },
    lineas: base.lineas.map((e) => (e.tipo === 'pausa' ? { ...e, parte: 'coro' as const } : e))
  }
  editor.cambiarLetra(rara)
  await vi.advanceTimersByTimeAsync(1000)
  const [peticion] = guardarTiempos.mock.calls[0] as unknown as [
    { tiempos: { id: string; parte?: string }[] }
  ]
  expect(peticion.tiempos.find((t) => t.id === 'p')).not.toHaveProperty('parte')
})
