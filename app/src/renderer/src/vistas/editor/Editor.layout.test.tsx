import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { apiEditorFalsa, cancionSinSincronizar } from './fixturesApi'
import { Editor } from './Editor'

const motor = vi.hoisted(() => ({
  usarPista: vi.fn(async () => undefined),
  posicionMs: vi.fn(() => 0),
  buscar: vi.fn(),
  pausar: vi.fn(),
  liberarAudio: vi.fn(),
  reproducir: vi.fn(async () => undefined),
  fijarVelocidad: vi.fn(),
  fijarBucle: vi.fn(() => true),
  suscribir: vi.fn(() => () => undefined),
  estado: vi.fn(() => ({ sonando: false, duracionMs: 30_000, pista: 'original', velocidad: 1 }))
}))

vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => ({
    motor,
    estado: { sonando: false, pista: 'original', velocidad: 1, duracionMs: 30_000 }
  })
}))

/** Doble de `ResizeObserver`: guarda las devoluciones para dispararlas a mano. */
const observadores: Array<() => void> = []
class ResizeObserverFalso {
  constructor(alDetectar: () => void) {
    observadores.push(alDetectar)
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const medidas = { ancho: 1248, alto: 664, cabecera: 48, transporte: 64 }

function definirMedidas(): void {
  // Medidas por elemento según su rol en el editor (jsdom no hace layout).
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => medidas.ancho
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => medidas.alto
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.tagName === 'HEADER' ? medidas.cabecera : medidas.transporte
    }
  })
}

function montar() {
  const cancion = cancionSinSincronizar()
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = falso.api as unknown as typeof window.shinobi
  return render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir: vi.fn() }}
    >
      <Editor id={cancion.id} />
    </NavegacionContexto.Provider>
  )
}

beforeEach(() => {
  observadores.length = 0
  vi.stubGlobal('ResizeObserver', ResizeObserverFalso)
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
  definirMedidas()
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
})

const raiz = () => document.querySelector<HTMLElement>('[data-pestana]')!

it('a 1024 × 576 aplica el modo compacto y deja 320 px a la vista previa', async () => {
  Object.assign(medidas, { ancho: 992, alto: 520 })
  montar()
  await screen.findByRole('option', { name: /^Línea 1/ })
  const e = raiz()
  expect(e).toHaveAttribute('data-compacto', 'true')
  expect(e).not.toHaveAttribute('data-bajo-minimo')
  expect(e.style.getPropertyValue('--ancho-lista')).toBe('288px')
  expect(e.style.getPropertyValue('--ancho-panel')).toBe('360px')
  expect(e.style.getPropertyValue('--alto-linea-tiempo')).toBe('204px')
  // Compacto: la cabecera pasa a una fila y el encabezado de la previa solo es para lectores.
  expect(screen.getByText('«Canción de prueba»').closest('p')).toHaveAttribute('title')
  expect(screen.getByRole('heading', { name: 'Vista previa' }).className).toMatch(/soloLector/)
})

it('a 1536 × 864 usa los tamaños por defecto en modo normal', async () => {
  Object.assign(medidas, { ancho: 1504, alto: 808, transporte: 80 })
  montar()
  await screen.findByRole('option', { name: /^Línea 1/ })
  const e = raiz()
  expect(e).toHaveAttribute('data-compacto', 'false')
  expect(e.style.getPropertyValue('--ancho-lista')).toBe('300px')
  expect(e.style.getPropertyValue('--ancho-panel')).toBe('360px')
  expect(e.style.getPropertyValue('--alto-linea-tiempo')).toBe('216px')
  expect(screen.getByRole('heading', { name: 'Vista previa' }).className).not.toMatch(/soloLector/)
})

it('recalcula al cambiar el tamaño y pasa a la disposición B bajo 1024 px de ancho', async () => {
  Object.assign(medidas, { ancho: 1248, alto: 664, transporte: 64 })
  montar()
  await screen.findByRole('option', { name: /^Línea 1/ })
  expect(raiz()).not.toHaveAttribute('data-bajo-minimo')
  Object.assign(medidas, { ancho: 900, alto: 664 })
  act(() => observadores.forEach((alDetectar) => alDetectar()))
  expect(raiz()).toHaveAttribute('data-bajo-minimo', 'ancho')
})
