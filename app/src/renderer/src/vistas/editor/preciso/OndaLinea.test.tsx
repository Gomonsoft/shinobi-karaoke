import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { EstadoPicos, LecturaPicos } from '@shared/ipc'
import { OndaLinea } from './OndaLinea'

type PeticionPicos = { cancionId: string; inicioMs: number; finMs: number; presupuesto: number }
const solicitar = vi.fn<(id: string, reintentar?: boolean) => Promise<EstadoPicos>>()
const leer = vi.fn<(p: PeticionPicos) => Promise<LecturaPicos | null>>()
const vista = { inicioMs: 11500, finMs: 14500 }

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('shinobi', { picos: { solicitar, leer } })
  vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 600, 72)
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    clearRect: vi.fn()
  } as unknown as CanvasRenderingContext2D)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  solicitar.mockReset()
  leer.mockReset()
})
const avanzar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

function montar(separada = true, offsetMs = 0) {
  return render(
    <OndaLinea
      cancionId="c"
      separada={separada}
      vista={vista}
      inicioLineaMs={12000}
      finLineaMs={14000}
      offsetMs={offsetMs}
    />
  )
}

it('pide los picos de la vista (en tiempo de audio) con el ancho como presupuesto', async () => {
  solicitar.mockResolvedValue({ estado: 'lista', generacion: 'g1' })
  leer.mockResolvedValue(null)
  montar(true, 40)
  await avanzar(10)
  await avanzar(100)
  expect(leer).toHaveBeenCalledWith({
    cancionId: 'c',
    inicioMs: 11540,
    finMs: 14540,
    presupuesto: 600
  })
})

it('sombrea los márgenes fuera de la línea', async () => {
  solicitar.mockResolvedValue({ estado: 'lista', generacion: 'g1' })
  leer.mockResolvedValue(null)
  const { container } = montar()
  await avanzar(200)
  const margenes = Array.from(container.querySelectorAll<HTMLElement>('[class*="margen"]'))
  expect(margenes).toHaveLength(2)
  expect(parseFloat(margenes[0]!.style.width)).toBeCloseTo(16.67, 1)
  expect(parseFloat(margenes[1]!.style.left)).toBeCloseTo(83.33, 1)
})

it('sin separación o con error muestra su estado, y el error ofrece reintentar', async () => {
  const { unmount } = montar(false)
  expect(screen.getByRole('status')).toHaveTextContent('Disponible cuando termine la separación.')
  unmount()
  solicitar.mockResolvedValue({ estado: 'error' })
  montar()
  await avanzar(10)
  expect(screen.getByRole('status')).toHaveTextContent('Forma de onda no disponible.')
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
})
