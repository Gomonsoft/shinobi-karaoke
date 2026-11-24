import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import {
  EditorPreciso,
  type CambiosPreciso,
  type EditorPrecisoProps,
  type PuertoMotorPreciso
} from './EditorPreciso'

const L = letra([
  linea('a', 'Antes', 5000, { fin_ms: 8000 }),
  linea('b', 'Is this the real life?', 12000, { fin_ms: 14000 })
])
const area = { left: 0, top: 48, width: 1366, height: 700 }

interface Doble extends PuertoMotorPreciso {
  emitir(cambio: Partial<ReturnType<PuertoMotorPreciso['estado']>>): void
  tiempo: number
}

function motorDoble(velocidad: 0.5 | 0.75 | 1 = 1): Doble {
  let estado = {
    pista: 'original',
    cargandoPista: null,
    cargando: false,
    error: null,
    sonando: false,
    velocidad,
    duracionMs: 60000,
    volumen: 1,
    tonoConservado: true
  } as ReturnType<PuertoMotorPreciso['estado']>
  const oyentes = new Set<(e: typeof estado) => void>()
  const doble: Doble = {
    tiempo: 12300,
    estado: () => estado,
    suscribir: (cb) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    posicionMs: () => doble.tiempo,
    reproducir: vi.fn(async () => {}),
    pausar: vi.fn(),
    buscar: vi.fn(),
    fijarBucle: vi.fn(() => true),
    fijarTramoConTono: vi.fn(),
    fijarVelocidad: vi.fn(),
    tiempoDeEvento: vi.fn(() => doble.tiempo),
    emitir(cambio) {
      estado = { ...estado, ...cambio }
      act(() => oyentes.forEach((cb) => cb(estado)))
    }
  }
  return doble
}

let motor: Doble
const alAplicar = vi.fn<(c: CambiosPreciso) => void>()
const alCerrar = vi.fn()
const alCambiarLinea = vi.fn()
const alCambiarMargen = vi.fn()

function montar(extra: Partial<EditorPrecisoProps> = {}) {
  return render(
    <EditorPreciso
      letra={L}
      lineaId="b"
      duracionMs={60000}
      cancionId="c"
      separada={false}
      numeroLinea={2}
      totalLineas={2}
      hayAnterior
      haySiguiente={false}
      motor={motor}
      margenMs={500}
      alCambiarMargen={alCambiarMargen}
      limites={area}
      alAplicar={alAplicar}
      alCerrar={alCerrar}
      alCambiarLinea={alCambiarLinea}
      {...extra}
    />
  )
}

beforeEach(() => {
  motor = motorDoble()
})
afterEach(() => vi.clearAllMocks())

/** Evento de teclado con `timeStamp` fijado (el del navegador no se puede indicar al crearlo). */
function tecla(el: Element, tipo: 'keyDown' | 'keyUp', key: string, timeStamp: number) {
  const e = createEvent[tipo](el, { key })
  Object.defineProperty(e, 'timeStamp', { value: timeStamp })
  fireEvent(el, e)
}
const lista = () => screen.getByRole('listbox')
const recuento = (a: number) => screen.getByText(`${a} de 5 palabras marcadas a mano`)

it('abre con todas sin marcar, el foco en la primera y el tramo con tono de la vista', () => {
  montar()
  expect(screen.getByRole('dialog', { name: 'Editor preciso · Línea 2 de 2' })).toBeInTheDocument()
  recuento(0)
  expect(screen.getAllByRole('option')[0]).toHaveFocus()
  expect(motor.fijarTramoConTono).toHaveBeenCalledWith({ inicioMs: 11500, finMs: 14500 })
})

it.each([0.5, 0.75, 1] as const)('Intro marca el inicio con el instante del motor a %s×', (v) => {
  motor = motorDoble(v)
  motor.tiempo = 12000 + 400 * v
  montar()
  tecla(screen.getAllByRole('option')[0]!, 'keyDown', 'Enter', 1234)
  expect(motor.tiempoDeEvento).toHaveBeenCalledWith(1234)
  recuento(1)
  // La selección pasa a la palabra siguiente.
  expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByLabelText(/Palabra 1 de 5, Is, de 00:12\./)).toBeInTheDocument()
})

it('ignora las repeticiones del teclado y marca fuera de la línea con su aviso', () => {
  montar()
  const o = screen.getAllByRole('option')[0]!
  const e = createEvent.keyDown(o, { key: 'Enter', repeat: true })
  fireEvent(o, e)
  recuento(0)
  motor.tiempo = 11000
  tecla(o, 'keyDown', 'Enter', 1)
  recuento(0)
  expect(screen.getByText(/Fuera de la línea/)).toBeInTheDocument()
  motor.tiempo = 12500
  motor.tiempo = 12400
  tecla(o, 'keyDown', 'Enter', 2)
  motor.tiempo = 12300
  tecla(screen.getAllByRole('option')[1]!, 'keyDown', 'Enter', 3)
  expect(screen.getByText(/Demasiado pronto/)).toBeInTheDocument()
})

it('mantener Intro 300 ms o más fija también el fin; Retroceso deshace la marca', () => {
  montar()
  const o = screen.getAllByRole('option')[0]!
  tecla(o, 'keyDown', 'Enter', 1000)
  motor.tiempo = 12900
  tecla(o, 'keyUp', 'Enter', 1500)
  expect(
    screen.getByLabelText(/Palabra 1 de 5, Is, de 00:12\.30 a 00:12\.90, marcada/)
  ).toBeInTheDocument()
  fireEvent.keyDown(lista(), { key: 'Backspace' })
  recuento(0)
  expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
})

it('el bucle fija el intervalo con margen y reproduce; el margen y la velocidad son controles', () => {
  montar()
  const bucle = screen.getByRole('button', { name: /Bucle de la línea/ })
  expect(bucle).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(bucle)
  expect(motor.fijarBucle).toHaveBeenCalledWith({ inicioMs: 11500, finMs: 14500 })
  expect(motor.reproducir).toHaveBeenCalled()
  motor.emitir({ sonando: true })
  expect(bucle).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(bucle)
  expect(motor.pausar).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('radio', { name: '1 s' }))
  expect(alCambiarMargen).toHaveBeenCalledWith(1000)
  fireEvent.click(screen.getByRole('radio', { name: '0,5×' }))
  expect(motor.fijarVelocidad).toHaveBeenCalledWith(0.5)
})

it('▶ Palabra escucha la palabra con 250 ms antes y después', () => {
  montar()
  fireEvent.click(screen.getByRole('button', { name: /Escuchar la palabra seleccionada/ }))
  // «Is» ocupa 12 000–12 222 con el reparto automático.
  expect(motor.reproducir).toHaveBeenCalledWith({ desdeMs: 11750, hastaMs: 12472 })
})

it('doble clic con la canción sonando reproduce desde la palabra y no vuelve (I3-1)', async () => {
  montar()
  motor.emitir({ sonando: true })
  fireEvent.doubleClick(screen.getAllByRole('option')[0]!)
  expect(motor.reproducir).toHaveBeenCalledWith({ desdeMs: 11750 })
  expect(motor.pausar).not.toHaveBeenCalled()
  motor.emitir({ sonando: false })
  await Promise.resolve()
  expect(motor.buscar).not.toHaveBeenCalled()
})

it('doble clic en pausa empieza a sonar desde la palabra y no vuelve (I3-2)', async () => {
  montar()
  fireEvent.doubleClick(screen.getAllByRole('option')[0]!)
  expect(motor.reproducir).toHaveBeenCalledWith({ desdeMs: 11750 })
  await Promise.resolve()
  await Promise.resolve()
  expect(motor.buscar).not.toHaveBeenCalled()
})

it('doble clic con el bucle activo salta dentro del bucle (I3-3)', () => {
  montar()
  fireEvent.click(screen.getByRole('button', { name: /Bucle de la línea/ }))
  motor.emitir({ sonando: true })
  vi.mocked(motor.reproducir).mockClear()
  vi.mocked(motor.fijarBucle).mockClear()
  fireEvent.doubleClick(screen.getAllByRole('option')[3]!)
  // «this» (3.ª palabra) está a mitad de la línea: se salta 250 ms antes de su inicio.
  expect(motor.buscar).toHaveBeenCalledTimes(1)
  const destino = vi.mocked(motor.buscar).mock.calls[0]![0]
  expect(destino).toBeGreaterThanOrEqual(11500)
  expect(motor.fijarBucle).toHaveBeenCalled()
  expect(motor.fijarBucle).not.toHaveBeenCalledWith(null)
  // Sonando: el bucle sigue sin reiniciar la reproducción.
  expect(motor.reproducir).not.toHaveBeenCalled()
})

it('▶ Palabra con el transporte sonando sigue sonando desde donde estaba (I3-5)', async () => {
  montar()
  motor.emitir({ sonando: true })
  fireEvent.click(screen.getByRole('button', { name: /Escuchar la palabra seleccionada/ }))
  expect(motor.reproducir).toHaveBeenCalledWith({ desdeMs: 11750, hastaMs: 12472 })
  motor.emitir({ sonando: false })
  expect(motor.buscar).toHaveBeenCalledWith(12300)
  expect(motor.reproducir).toHaveBeenLastCalledWith({ desdeMs: 12300 })
})

it('Mayús + Intro reproduce desde la palabra seleccionada y no marca (I3-7)', () => {
  montar()
  const o = screen.getAllByRole('option')[0]!
  fireEvent.keyDown(o, { key: 'Enter', shiftKey: true })
  expect(motor.reproducir).toHaveBeenCalledWith({ desdeMs: 11750 })
  recuento(0)
  tecla(o, 'keyDown', 'Enter', 1)
  recuento(1)
})

it('un solo clic en una palabra con la canción sonando solo la selecciona', () => {
  montar()
  motor.emitir({ sonando: true })
  fireEvent.click(screen.getAllByRole('option')[1]!)
  expect(motor.reproducir).not.toHaveBeenCalled()
  expect(motor.pausar).not.toHaveBeenCalled()
  expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
})

it('la nota del tono solo aparece si falla la preparación con velocidad < 1×', () => {
  montar()
  expect(screen.queryByText(/el tono también baja/)).toBeNull()
  motor.emitir({ velocidad: 0.5, tonoConservado: false })
  expect(screen.getByText(/el tono también baja/)).toBeInTheDocument()
})

it('el texto se confirma con Intro, no admite vacío y se devuelve al aplicar', () => {
  montar()
  const campo = screen.getByRole('textbox', { name: 'Texto' })
  fireEvent.change(campo, { target: { value: '   ' } })
  fireEvent.keyDown(campo, { key: 'Enter' })
  expect(screen.getByText(/no puede quedar vacía/)).toBeInTheDocument()
  fireEvent.change(campo, { target: { value: 'Is this the reel life?' } })
  fireEvent.keyDown(campo, { key: 'Enter' })
  fireEvent.keyDown(campo, { key: 'Enter', ctrlKey: true })
  expect(alAplicar).toHaveBeenCalledTimes(1)
  const cambios = alAplicar.mock.calls[0]![0]
  expect(cambios.textoNuevo).toBe('Is this the reel life?')
  expect(cambios.borrador.palabras).toHaveLength(5)
  expect(alCerrar).toHaveBeenCalled()
})

it('una palabra añadida avisa de que queda sin marcar', () => {
  montar()
  const campo = screen.getByRole('textbox', { name: 'Texto' })
  fireEvent.change(campo, { target: { value: 'Is this the real life? Oh' } })
  fireEvent.keyDown(campo, { key: 'Enter' })
  expect(
    screen.getByText('1 palabra nueva sin marcar: márcala o revisa su reparto.')
  ).toBeInTheDocument()
})

it('Ctrl + Z deshace solo el borrador y los atajos no actúan dentro del campo', () => {
  montar()
  tecla(screen.getAllByRole('option')[0]!, 'keyDown', 'Enter', 1)
  recuento(1)
  const campo = screen.getByRole('textbox', { name: 'Texto' })
  fireEvent.keyDown(campo, { key: 'z', ctrlKey: true })
  recuento(1)
  fireEvent.keyDown(lista(), { key: 'z', ctrlKey: true })
  recuento(0)
  fireEvent.keyDown(lista(), { key: 'z', ctrlKey: true, shiftKey: true })
  recuento(1)
})

it('Cancelar sin cambios cierra; con cambios pide confirmar y descartar no aplica', () => {
  montar()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(alCerrar).toHaveBeenCalledTimes(1)
  tecla(screen.getAllByRole('option')[0]!, 'keyDown', 'Enter', 1)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(alCerrar).toHaveBeenCalledTimes(1)
  expect(screen.getByText('¿Descartar los cambios de esta línea?')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Seguir editando' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(alCerrar).toHaveBeenCalledTimes(2)
  expect(alAplicar).not.toHaveBeenCalled()
})

it('Esc y ✕ cierran aplicando, solo si hay cambios', () => {
  montar()
  fireEvent.keyDown(lista(), { key: 'Escape' })
  expect(alAplicar).not.toHaveBeenCalled()
  expect(alCerrar).toHaveBeenCalledTimes(1)
  tecla(screen.getAllByRole('option')[0]!, 'keyDown', 'Enter', 1)
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar y aplicar (Esc)' }))
  expect(alAplicar).toHaveBeenCalledTimes(1)
  expect(alCerrar).toHaveBeenCalledTimes(2)
})

it('Anterior y ↑ cambian de línea aplicando; Siguiente está sin disponer en el extremo', () => {
  montar()
  expect(screen.getByRole('button', { name: /Línea siguiente/ })).toHaveAttribute(
    'aria-disabled',
    'true'
  )
  tecla(screen.getAllByRole('option')[0]!, 'keyDown', 'Enter', 1)
  fireEvent.keyDown(lista(), { key: 'ArrowUp' })
  expect(alAplicar).toHaveBeenCalledTimes(1)
  expect(alCambiarLinea).toHaveBeenCalledWith(-1)
})

it('una línea sin inicio ofrece fijarlo', () => {
  const alFijarInicioAqui = vi.fn()
  montar({
    letra: letra([linea('b', 'Sin inicio', null)]),
    alFijarInicioAqui
  })
  expect(screen.getByText(/aún no tiene inicio/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Fijar inicio aquí (I)' }))
  expect(alFijarInicioAqui).toHaveBeenCalled()
})

it('al cerrar libera el tramo con tono y el bucle', () => {
  const { unmount } = montar()
  fireEvent.click(screen.getByRole('button', { name: /Bucle de la línea/ }))
  unmount()
  expect(motor.fijarBucle).toHaveBeenLastCalledWith(null)
  expect(motor.fijarTramoConTono).toHaveBeenLastCalledWith(null)
})
