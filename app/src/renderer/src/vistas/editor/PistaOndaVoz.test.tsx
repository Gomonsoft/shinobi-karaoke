import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { EstadoPicos, LecturaPicos, TrabajoIpc } from '@shared/ipc'
import { LienzoPicosVoz, PistaOndaVoz, usePicosVoz } from './PistaOndaVoz'

const solicitar = vi.fn<(id: string, reintentar?: boolean) => Promise<EstadoPicos>>()
const leer = vi.fn<() => Promise<LecturaPicos | null>>()
const fillRect = vi.fn()
const clearRect = vi.fn()
let publicarTrabajo: (trabajo: TrabajoIpc) => void

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('shinobi', {
    picos: { solicitar, leer },
    trabajos: {
      alCambiar: (recibir: typeof publicarTrabajo) => {
        publicarTrabajo = recibir
        return () => {}
      }
    }
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 200, 32)
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ({ fillRect, clearRect }) as unknown as CanvasRenderingContext2D
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  solicitar.mockReset()
  leer.mockReset()
  fillRect.mockClear()
  clearRect.mockClear()
})

const avanzar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

function Vista({ separada }: { separada: boolean }) {
  const picos = usePicosVoz('cancion', separada)
  return (
    <PistaOndaVoz
      cancionId="cancion"
      separada={separada}
      vista={{ inicioMs: 0, finMs: 100 }}
      {...picos}
    />
  )
}

it('espera a la voz, sondea generación y ofrece reintentar ante error', async () => {
  solicitar
    .mockResolvedValueOnce({ estado: 'generando' })
    .mockResolvedValueOnce({ estado: 'error' })
    .mockResolvedValueOnce({ estado: 'lista', generacion: 'nueva' })
  leer.mockResolvedValue(null)
  const vista = render(<Vista separada={false} />)
  expect(screen.getByRole('status')).toHaveTextContent('Disponible cuando termine la separación.')
  expect(solicitar).not.toHaveBeenCalled()

  vista.rerender(<Vista separada />)
  expect(screen.getByRole('status')).toHaveTextContent('Preparando forma de onda…')
  await avanzar(0)
  await avanzar(500)
  expect(screen.getByRole('status')).toHaveTextContent('Forma de onda no disponible.')

  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(solicitar).toHaveBeenLastCalledWith('cancion', true)
  await avanzar(0)
  expect(vista.container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true')
})

it('ignora el estado de una generación anterior al publicar nueva voz', async () => {
  let resolver: (estado: EstadoPicos) => void = () => {}
  solicitar
    .mockImplementationOnce(() => new Promise((r) => (resolver = r)))
    .mockResolvedValueOnce({ estado: 'generando' })
  const vista = render(<Vista separada />)
  act(() =>
    publicarTrabajo({
      cancionId: 'cancion',
      paso: 'separacion',
      estado: 'terminado',
      resultado: 'completado'
    } as TrabajoIpc)
  )
  await act(async () => resolver({ estado: 'lista', generacion: 'vieja' }))
  expect(screen.getByRole('status')).toHaveTextContent('Preparando forma de onda…')
  expect(vista.container.querySelector('canvas')).toBeNull()
})

it('agrupa lecturas, descarta respuesta tardía y pinta los extremos sobre el eje común', async () => {
  let resolver: (lectura: LecturaPicos) => void = () => {}
  const lectura = {
    generacion: 'g',
    primerBloque: 2,
    pasoMs: 10,
    bytes: Uint8Array.of(0, 128, 0, 64)
  }
  leer.mockImplementationOnce(() => new Promise((r) => (resolver = r))).mockResolvedValue(lectura)
  const lienzo = (inicioMs: number) => (
    <LienzoPicosVoz cancionId="cancion" generacion="g" inicioMs={inicioMs} finMs={100} />
  )
  const vista = render(lienzo(0))
  await avanzar(60)
  vista.rerender(lienzo(10))
  vista.rerender(lienzo(20))
  await act(async () => resolver(lectura))
  expect(fillRect).not.toHaveBeenCalled()
  await avanzar(60)
  expect(leer).toHaveBeenCalledTimes(2)
  expect(leer).toHaveBeenLastCalledWith({
    cancionId: 'cancion',
    inicioMs: 20,
    finMs: 100,
    presupuesto: 200
  })
  expect(fillRect).toHaveBeenCalledExactlyOnceWith(0, 8, 25, 24)
})

it('acota el presupuesto y cambia densidad sin volver a pedir la misma porción', async () => {
  vi.mocked(HTMLCanvasElement.prototype.getBoundingClientRect).mockReturnValue(
    new DOMRect(0, 5000, 5000, 32)
  )
  vi.stubGlobal('devicePixelRatio', 1)
  leer.mockResolvedValue({
    generacion: 'g',
    primerBloque: 0,
    pasoMs: 10,
    bytes: Uint8Array.of(0, 128, 0, 64)
  })
  const vista = render(
    <LienzoPicosVoz cancionId="cancion" generacion="g" inicioMs={0} finMs={100} general />
  )
  await avanzar(60)
  expect(leer).toHaveBeenCalledExactlyOnceWith({
    cancionId: 'cancion',
    inicioMs: 0,
    finMs: 100,
    presupuesto: 4096
  })
  expect(vista.container.querySelector('canvas')).toHaveAttribute('width', '5000')
  expect(fillRect).toHaveBeenCalledExactlyOnceWith(0, 8, 500, 24)

  vi.stubGlobal('devicePixelRatio', 2)
  act(() => window.dispatchEvent(new Event('resize')))
  await avanzar(60)
  expect(vista.container.querySelector('canvas')).toHaveAttribute('width', '10000')
  expect(fillRect).toHaveBeenLastCalledWith(0, 16, 1000, 48)
  expect(leer).toHaveBeenCalledTimes(1)
})
