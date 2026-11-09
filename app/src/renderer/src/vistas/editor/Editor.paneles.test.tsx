import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { configPredeterminada, type Config } from '@shared/config'
import { estiloPredeterminado } from '@shared/estilo'
import { NavegacionContexto } from '../../navegacion/estado'
import { apiEditorFalsa, cancionSinSincronizar } from './fixturesApi'
import { Editor } from './Editor'

/**
 * Divisores, modos minimizados y persistencia de la distribución (tareas 0159, 0160 y 0161) con el
 * editor completo. Los tamaños los da un doble de las medidas (jsdom no hace layout).
 */

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

const observadores: Array<() => void> = []
class ResizeObserverFalso {
  constructor(alDetectar: () => void) {
    observadores.push(alDetectar)
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const medidas = { ancho: 1248, alto: 664, cabecera: 48, transporte: 80 }

beforeEach(() => {
  observadores.length = 0
  vi.stubGlobal('ResizeObserver', ResizeObserverFalso)
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
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
  Object.assign(medidas, { ancho: 1248, alto: 664, cabecera: 48, transporte: 80 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
})

type Falso = ReturnType<typeof apiEditorFalsa>

function montar(cancion = cancionSinSincronizar(), config?: Config) {
  const falso = apiEditorFalsa({ cancion, config })
  window.shinobi = falso.api as unknown as typeof window.shinobi
  const utils = render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir: vi.fn() }}
    >
      <Editor id={cancion.id} />
    </NavegacionContexto.Provider>
  )
  return { ...utils, falso }
}

const raiz = () => document.querySelector<HTMLElement>('[data-pestana]')!
const escrituras = (falso: Falso) => falso.llamadas.filter((l) => l.metodo === 'config.actualizar')
const anuncios = () => document.querySelector('[data-anuncio-layout]')!.textContent
const boton = (nombre: string) => screen.getByRole('button', { name: nombre })
const esperarEditor = () => screen.findByRole('option', { name: /^Línea 1/ })
const variable = (nombre: string) => raiz().style.getPropertyValue(nombre)
const redimensionar = (cambio: Partial<typeof medidas>) => {
  Object.assign(medidas, cambio)
  act(() => observadores.forEach((alDetectar) => alDetectar()))
}

it('minimizar la lista con su botón deja el riel, anuncia una vez, pasa el foco y guarda una vez', async () => {
  const { falso } = montar()
  await esperarEditor()
  fireEvent.click(boton('Minimizar lista de líneas'))
  expect(screen.getByRole('region', { name: 'Lista de líneas, minimizada' })).toBeInTheDocument()
  expect(screen.queryByRole('option')).toBeNull()
  expect(boton('Expandir lista de líneas')).toHaveFocus()
  expect(boton('Expandir lista de líneas')).toHaveAttribute('aria-expanded', 'false')
  expect(anuncios()).toBe('Lista de líneas minimizada')
  expect(variable('--ancho-lista')).toBe('72px')
  expect(escrituras(falso)).toHaveLength(1)
  expect(escrituras(falso)[0]!.args[0]).toMatchObject({
    editor: { paneles: { lista: { ancho: 300, minimizado: true } } }
  })

  fireEvent.click(boton('Expandir lista de líneas'))
  expect(boton('Minimizar lista de líneas')).toHaveFocus()
  expect(anuncios()).toBe('Lista de líneas expandida')
  expect(variable('--ancho-lista')).toBe('300px')
})

it('Intro en el divisor alterna y el foco se queda en el divisor', async () => {
  montar()
  await esperarEditor()
  const divisor = screen.getByRole('separator', { name: 'Ancho del panel' })
  divisor.focus()
  fireEvent.keyDown(divisor, { key: 'Enter' })
  expect(screen.getByRole('region', { name: 'Panel, minimizado' })).toBeInTheDocument()
  expect(divisor).toHaveFocus()
  expect(divisor).toHaveAttribute('aria-valuetext', 'Minimizado')
  expect(anuncios()).toBe('Panel minimizado')
  fireEvent.keyDown(divisor, { key: 'Enter' })
  expect(divisor).toHaveFocus()
  expect(divisor).toHaveAttribute('aria-valuetext', '360 píxeles')
  expect(anuncios()).toBe('Panel expandido')
})

it('el riel de la lista y los atajos ↑/↓ producen la misma selección, saltando pausas', async () => {
  montar()
  await esperarEditor()
  fireEvent.click(boton('Minimizar lista de líneas'))
  const linea = () =>
    within(screen.getByRole('region', { name: 'Lista de líneas, minimizada' }))
      .getByRole('group')
      .getAttribute('aria-label')
  expect(linea()).toMatch(/^Línea 1 de 6, sin sincronizar: Baila la lluvia/)
  fireEvent.click(boton('Línea siguiente (↓)'))
  fireEvent.click(boton('Línea siguiente (↓)'))
  expect(linea()).toMatch(/^Línea 3 de 6/)
  fireEvent.keyDown(window, { key: 'ArrowDown' })
  // La pausa que sigue a la línea 3 no cuenta: la siguiente es la línea 4.
  expect(linea()).toMatch(/^Línea 4 de 6/)
  fireEvent.click(boton('Línea anterior (↑)'))
  expect(linea()).toMatch(/^Línea 3 de 6/)
  fireEvent.keyDown(window, { key: 'ArrowUp' })
  expect(linea()).toMatch(/^Línea 2 de 6/)
})

it('«I» del riel fija el inicio con el mismo resultado que el atajo', async () => {
  montar()
  await esperarEditor()
  fireEvent.click(boton('Minimizar lista de líneas'))
  const riel = within(screen.getByRole('region', { name: 'Lista de líneas, minimizada' }))
  fireEvent.click(riel.getByRole('button', { name: 'Fijar inicio aquí (I)' }))
  const grupo = riel.getByRole('group')
  expect(grupo).toHaveAttribute('aria-label', expect.stringMatching(/^Línea 1 de 6, 00:00\.00:/))
})

it('el riel del panel queda inactivo sin inicio, con su motivo, y el aviso de contraste se nombra', async () => {
  const cancion = cancionSinSincronizar()
  cancion.estilo = estiloPredeterminado()
  cancion.estilo.letra.color = '#1B1033'
  montar(cancion)
  await esperarEditor()
  fireEvent.click(boton('Minimizar panel'))
  const riel = screen.getByRole('region', { name: 'Panel, minimizado' })
  const fijarFin = within(riel).getByRole('button', { name: 'Fijar fin aquí (O)' })
  expect(fijarFin).toHaveAttribute('aria-disabled', 'true')
  expect(fijarFin).toHaveAccessibleDescription('Fija primero el inicio')
  expect(within(riel).getByRole('checkbox', { name: /Bloquear enunciado/ })).toBeDisabled()
  const expandir = boton('Expandir panel (hay avisos de contraste)')
  expect(expandir.querySelector('[data-aviso]')).not.toBeNull()
  expect(expandir).toHaveFocus()
})

it('arrastrar cambia la variable en vivo, no guarda hasta soltar y guarda una sola vez', async () => {
  let fotogramas: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => fotogramas.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  const { falso } = montar()
  await esperarEditor()
  const divisor = screen.getByRole('separator', { name: 'Ancho de la lista de líneas' })
  fireEvent.pointerDown(divisor, { pointerId: 1, button: 0, clientX: 300, clientY: 100 })
  fireEvent.pointerMove(divisor, { pointerId: 1, clientX: 340, clientY: 100 })
  act(() => {
    fotogramas.forEach((cb) => cb(0))
    fotogramas = []
  })
  expect(variable('--ancho-lista')).toBe('340px')
  expect(escrituras(falso)).toHaveLength(0)
  fireEvent.pointerUp(divisor, { pointerId: 1, clientX: 340, clientY: 100 })
  expect(escrituras(falso)).toHaveLength(1)
  expect(escrituras(falso)[0]!.args[0]).toMatchObject({
    editor: { paneles: { lista: { ancho: 340, minimizado: false } } }
  })
  expect(divisor).toHaveAttribute('aria-valuenow', '340')
  // Ni un paso de deshacer ni el guardado de la canción intervienen.
  expect(boton('Deshacer (Ctrl+Z)')).toHaveAttribute('disabled')
  expect(falso.llamadas.some((l) => l.metodo === 'letras.guardarTiempos')).toBe(false)
})

it('«Restablecer distribución de paneles» devuelve los valores por defecto, lo anuncia y deja el foco en ⋯', async () => {
  const { falso } = montar()
  await esperarEditor()
  fireEvent.click(boton('Minimizar lista de líneas'))
  const divisorPanel = screen.getByRole('separator', { name: 'Ancho del panel' })
  fireEvent.keyDown(divisorPanel, { key: 'ArrowLeft', shiftKey: true })
  expect(divisorPanel).toHaveAttribute('aria-valuenow', '424')
  fireEvent.click(boton('Más acciones del editor'))
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'Restablecer distribución de paneles' })
  )
  expect(screen.getByRole('option', { name: /^Línea 1/ })).toBeInTheDocument()
  expect(divisorPanel).toHaveAttribute('aria-valuenow', '360')
  expect(anuncios()).toBe('Distribución de paneles restablecida.')
  expect(boton('Más acciones del editor')).toHaveFocus()
  expect(escrituras(falso).at(-1)!.args[0]).toMatchObject({
    editor: {
      paneles: {
        lista: { ancho: 300, minimizado: false },
        panel: { ancho: 360, minimizado: false },
        linea_tiempo: { alto: null, minimizado: false }
      }
    }
  })
})

it('sin espacio la línea de tiempo se minimiza sola, sin guardar nada, y vuelve al agrandar', async () => {
  Object.assign(medidas, { alto: 360, transporte: 64 })
  const { falso } = montar()
  await esperarEditor()
  const region = screen.getByRole('region', { name: 'Línea de tiempo, minimizada' })
  const expandir = within(region).getByRole('button', { name: /^Expandir línea de tiempo/ })
  expect(expandir).toHaveAttribute('aria-disabled', 'true')
  expect(expandir).toHaveAccessibleDescription(
    'No cabe en esta ventana. Agrándala para ver la línea de tiempo completa.'
  )
  expect(anuncios()).toBe('La línea de tiempo se ha minimizado porque no cabe en la ventana.')
  fireEvent.click(expandir)
  expect(screen.queryByRole('region', { name: 'Línea de tiempo' })).toBeNull()
  redimensionar({ alto: 664, transporte: 80 })
  expect(screen.getByRole('region', { name: 'Línea de tiempo' })).toBeInTheDocument()
  expect(escrituras(falso)).toHaveLength(0)
})

it('una preferencia mayor que lo que cabe se dibuja recortada sin sobrescribirla', async () => {
  Object.assign(medidas, { ancho: 992 })
  const config = configPredeterminada()
  config.editor.paneles.lista.ancho = 480
  config.editor.paneles.panel.ancho = 480
  const { falso } = montar(undefined, config)
  await esperarEditor()
  const lista = Number.parseInt(variable('--ancho-lista'))
  const panel = Number.parseInt(variable('--ancho-panel'))
  expect(lista).toBeLessThan(480)
  expect(panel).toBeLessThan(480)
  expect(lista + panel + 24 + 320).toBeLessThanOrEqual(992)
  expect(escrituras(falso)).toHaveLength(0)
  // Al agrandar se recupera la preferencia, que nadie ha tocado.
  redimensionar({ ancho: 1888 })
  expect(variable('--ancho-lista')).toBe('480px')
  expect(variable('--ancho-panel')).toBe('480px')
})
