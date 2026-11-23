import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import type { Cancion } from '@shared/cancion'
import { apiPicosFalsa } from '../letra/fixturesPicos'
import { apiEditorFalsa, cancionLista, cancionSincronizadaLrclib } from './fixturesApi'
import { olvidarPicosBase } from './picosBase'
import { Editor } from './Editor'

const motor = vi.hoisted(() => ({
  usarPista: vi.fn(async () => undefined),
  posicionMs: vi.fn(() => 4200),
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

/**
 * Líneas de `cancionSincronizadaLrclib`, cada una de 2 s: l2 (5 s) tiene la voz solo medio segundo
 * (`finTarde`), l4 (15 s) no tiene voz (`sinVoz`) y el resto cuadra.
 */
const CANTOS: [number, number][] = [
  [2000, 4050],
  [5000, 5500],
  [8000, 10_050],
  [19_000, 21_050],
  [23_000, 25_050]
]

function conFines(cancion: Cancion): Cancion {
  for (const l of cancion.letra!.lineas)
    if (l.tipo === 'linea' && l.inicio_ms !== null) l.fin_ms = l.inicio_ms + 2000
  return cancion
}

function montar(
  cancion: Cancion = cancionSincronizadaLrclib(),
  cantos = CANTOS,
  fines = true,
  revisar = false
) {
  const falso = apiEditorFalsa({ cancion: fines ? conFines(cancion) : cancion })
  window.shinobi = {
    ...falso.api,
    picos: apiPicosFalsa(cantos)
  } as unknown as typeof window.shinobi
  const ir = vi.fn()
  render(
    <NavegacionContexto.Provider
      value={{
        vista: {
          tipo: 'cancion',
          id: cancion.id,
          paso: 'editor',
          ...(revisar ? { revisar: true } : {})
        },
        ir
      }}
    >
      <Editor id={cancion.id} />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { ...falso, ir }
}

beforeEach(() => olvidarPicosBase())
afterEach(() => {
  vi.clearAllMocks()
  act(() => cerrarTodosLosToasts())
})

const empezar = async () => {
  fireEvent.click(await screen.findByRole('radio', { name: 'Funciones' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar (2)…' }))
  return screen.findByRole('region', { name: /Revisión · quedan/ })
}
const teclear = async (init: KeyboardEventInit) => {
  await act(async () => {})
  fireEvent.keyDown(window, init)
}

it('F11-E2/E3: marca las líneas pendientes en la lista con su motivo y cuenta en Funciones', async () => {
  montar()
  const opcion = await screen.findByRole('option', { name: /En la ventana.*por revisar/ })
  expect(opcion).toHaveAccessibleName(/por revisar: el fin llega 1,5 s después de la voz/)
  expect(
    screen.getByRole('option', { name: /La madrugada.*por revisar: casi no se oye voz/ })
  ).toBeVisible()
  expect(screen.getByRole('option', { name: /Baila la lluvia/ })).not.toHaveAccessibleName(
    /por revisar/
  )
  fireEvent.click(screen.getByRole('radio', { name: 'Funciones' }))
  expect(await screen.findByRole('button', { name: 'Revisar (2)…' })).toBeVisible()
  expect(screen.getByText('2 líneas por revisar · 0 dadas por buenas')).toBeVisible()
})

it('F11-E4/E5/E10: el recorrido guía por las pendientes, «Está bien» se guarda y se deshace, y al final avisa', async () => {
  const { llamadas } = montar()
  const tarjeta = await empezar()
  expect(tarjeta).toHaveTextContent('Revisión · quedan 2 de 2')
  expect(tarjeta).toHaveTextContent('El fin llega 1,5 s después de la voz.')
  // Al empezar, la primera línea no suena sola (decisión provisional 0158 n.º 24) y el foco queda en
  // [✓ Está bien]; «Escuchar otra vez» la hace sonar (0,5 s antes y después).
  await waitFor(() =>
    expect(within(tarjeta).getByRole('button', { name: 'Está bien' })).toHaveFocus()
  )
  await new Promise((r) => setTimeout(r, 400))
  expect(motor.reproducir).not.toHaveBeenCalled()
  fireEvent.click(within(tarjeta).getByRole('button', { name: /^Escuchar la línea otra vez/ }))
  await waitFor(() =>
    expect(motor.reproducir).toHaveBeenCalledWith({ desdeMs: 4500, hastaMs: 7500 })
  )
  motor.reproducir.mockClear()

  // Desde la segunda, la autoescucha suena sola.
  fireEvent.click(within(tarjeta).getByRole('button', { name: 'Está bien' }))
  expect(await screen.findByText('Revisión · quedan 1 de 2')).toBeVisible()
  await waitFor(() => expect(motor.reproducir).toHaveBeenCalledTimes(1))
  expect(screen.getByText('Casi no se oye voz mientras dura esta línea.')).toBeVisible()
  expect(screen.getByText('Línea 4 de 6')).toBeVisible()

  // Ctrl/Cmd + Z devuelve la línea a pendiente y el contador lo refleja.
  await teclear({ key: 'z', ctrlKey: true })
  expect(await screen.findByText('Revisión · quedan 2 de 2')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Está bien' }))
  await screen.findByText('Revisión · quedan 1 de 2')
  fireEvent.click(screen.getByRole('button', { name: 'Está bien' }))

  const fin = await screen.findByRole('region', { name: 'Revisión terminada' })
  expect(fin).toHaveTextContent('Has revisado las 2 líneas señaladas.')
  expect(fin).toHaveTextContent('Si todo cuadra, usa «Marcar como lista».')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Probar a pantalla completa (F)' })).toHaveFocus()
  )

  // Las marcas viajan con el guardado y no cambian el estado de la canción.
  await waitFor(
    () => {
      const l = llamadas.filter((x) => x.metodo === 'letras.guardarTiempos').at(-1)
      const tiempos = (l!.args[0] as { tiempos: { id: string; revisada?: unknown }[] }).tiempos
      expect(tiempos.filter((t) => t.revisada).map((t) => t.id)).toEqual(['l2', 'l4'])
    },
    { timeout: 5000 }
  )
  expect(llamadas.some((x) => x.metodo === 'biblioteca.marcarLista')).toBe(false)
})

it('R1/R2: «Está bien» va justo tras el motivo, sin número, con la tecla N aparte', async () => {
  montar()
  const tarjeta = await empezar()
  const bien = within(tarjeta).getByRole('button', { name: 'Está bien' })
  expect(bien).toHaveAttribute('aria-keyshortcuts', 'N')
  expect(bien).toHaveTextContent('✓ Está bienN')
  // Orden: motivo · Está bien · navegación · escuchar / arreglo · casilla.
  const botones = within(tarjeta)
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? b.textContent)
  expect(botones.slice(1, 5)).toEqual([
    'Está bien',
    'Anterior (Ctrl + ↑ / ⌘↑)',
    'Siguiente (Ctrl + ↓ / ⌘↓)',
    'Escuchar la línea otra vez (Mayús + L)'
  ])
  expect(tarjeta.querySelector('p')).toHaveTextContent('El fin llega 1,5 s después de la voz.')
})

it('F11-E7/E8: «Fin al final de la voz» es un paso que corrige la línea y N pasa de línea sin marcar', async () => {
  const { llamadas } = montar()
  const tarjeta = await empezar()
  fireEvent.click(within(tarjeta).getByRole('button', { name: 'Fin al final de la voz' }))
  expect(await screen.findByText('✓ Ya no vemos nada raro en esta línea.')).toBeVisible()
  // La línea vuelve a sonar con el fin nuevo (5,6 s + 0,5 s).
  await waitFor(() =>
    expect(motor.reproducir).toHaveBeenCalledWith({ desdeMs: 4500, hastaMs: 6100 })
  )
  // R3: el principal pasa a «Siguiente» y el de la navegación se oculta (queda solo «Anterior»).
  expect(screen.getAllByRole('button', { name: /^Siguiente/ })).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveAttribute(
    'aria-keyshortcuts',
    'N'
  )
  expect(screen.getByRole('button', { name: /^Anterior/ })).toBeVisible()

  await teclear({ key: 'n' })
  expect(await screen.findByText('Casi no se oye voz mientras dura esta línea.')).toBeVisible()
  // Nada se dio por bueno: la línea corregida sigue sin marca.
  await waitFor(
    () => {
      const l = llamadas.filter((x) => x.metodo === 'letras.guardarTiempos').at(-1)
      const tiempos = (
        l!.args[0] as {
          tiempos: { id: string; fin_ms: number | null; origen_fin?: string; revisada?: unknown }[]
        }
      ).tiempos
      expect(tiempos.find((t) => t.id === 'l2')).toMatchObject({
        fin_ms: 5600,
        origen_fin: 'silencios'
      })
      expect(tiempos.some((t) => t.revisada)).toBe(false)
    },
    { timeout: 5000 }
  )
})

it('F11-E9: R termina el recorrido y Esc también, sin salir del editor; elegir otra línea lo deja en «fuera»', async () => {
  const { ir } = montar()
  await empezar()
  fireEvent.click(screen.getByRole('option', { name: /Baila la lluvia/ }))
  expect(await screen.findByText('Esta línea no está señalada.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a la revisión' }))
  expect(await screen.findByText('Línea 2 de 6')).toBeVisible()

  await teclear({ key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('region', { name: /Revisión/ })).toBeNull())
  expect(ir).not.toHaveBeenCalled()
  await teclear({ key: 'r' })
  expect(await screen.findByRole('region', { name: /Revisión · quedan/ })).toBeVisible()
  await teclear({ key: 'r' })
  await waitFor(() => expect(screen.queryByRole('region', { name: /Revisión/ })).toBeNull())
})

it('F11-E3/E13: fuera del recorrido, Ctrl+↓ salta entre pendientes y el panel ofrece «Está bien»; N no hace nada', async () => {
  const { llamadas } = montar()
  await screen.findByRole('option', { name: /En la ventana/ })
  await screen.findByRole('option', { name: /En la ventana.*por revisar/ })
  await teclear({ key: 'n' })
  await teclear({ key: 'ArrowDown', ctrlKey: true })
  expect(await screen.findByText('Línea 2 de 6')).toBeVisible()
  expect(screen.queryByRole('region', { name: /Revisión/ })).toBeNull()
  const marca = document.querySelector('[data-revision-marca]') as HTMLElement
  expect(marca).toHaveTextContent('El fin llega 1,5 s después de la voz.')
  fireEvent.click(within(marca).getByRole('button', { name: 'Está bien' }))
  await waitFor(() =>
    expect(screen.queryByRole('option', { name: /En la ventana.*por revisar/ })).toBeNull()
  )
  await waitFor(
    () => expect(llamadas.some((x) => x.metodo === 'letras.guardarTiempos')).toBe(true),
    { timeout: 5000 }
  )
})

it('F11-E12: la primera pulsación de «Marcar como lista» con pendientes pregunta; la segunda marca', async () => {
  const { llamadas } = montar()
  await screen.findByRole('option', { name: /En la ventana.*por revisar/ })
  fireEvent.click(await screen.findByRole('button', { name: 'Marcar como lista' }))
  const aviso = await screen.findByRole('dialog', { name: 'Quedan 2 líneas por revisar.' })
  expect(within(aviso).getByRole('button', { name: 'Revisar ahora' })).toBeVisible()
  fireEvent.click(within(aviso).getByRole('button', { name: 'Marcar igualmente' }))
  await waitFor(() =>
    expect(llamadas.some((x) => x.metodo === 'biblioteca.marcarLista')).toBe(true)
  )
})

it('«Hecho» en una canción Lista no pregunta por las pendientes', async () => {
  const { llamadas } = montar(cancionLista())
  await screen.findByRole('option', { name: /En la ventana.*por revisar/ })
  fireEvent.click(await screen.findByRole('button', { name: 'Hecho' }))
  expect(screen.queryByRole('dialog', { name: /por revisar/ })).toBeNull()
  expect(llamadas.some((x) => x.metodo === 'biblioteca.marcarLista')).toBe(false)
})

it('F11-E12: sin líneas importantes (solo fines automáticos) «Marcar como lista» marca sin preguntar', async () => {
  // Fines automáticos: l2 acaba tarde (finTarde automático) y l4 ya tiene voz; nada importante.
  const cantos: [number, number][] = [...CANTOS, [15_000, 17_050]]
  const { llamadas } = montar(cancionSincronizadaLrclib(), cantos, false)
  await screen.findByRole('option', { name: /En la ventana.*por revisar/ })
  fireEvent.click(await screen.findByRole('button', { name: 'Marcar como lista' }))
  expect(screen.queryByRole('dialog', { name: /por revisar/ })).toBeNull()
  await waitFor(() =>
    expect(llamadas.some((x) => x.metodo === 'biblioteca.marcarLista')).toBe(true)
  )
})

it('F11-B2: abierto con `revisar` el recorrido empieza solo, con todos los motivos de la voz', async () => {
  montar(cancionSincronizadaLrclib(), CANTOS, true, true)
  const tarjeta = await screen.findByRole('region', { name: /Revisión · quedan/ })
  await waitFor(() => expect(tarjeta).toHaveTextContent('Revisión · quedan 2 de 2'))
  expect(tarjeta).toHaveTextContent('El fin llega 1,5 s después de la voz.')
})

it('F11-B2: abierto con `revisar` y sin pendientes muestra el fin con «Probar a pantalla completa»', async () => {
  const cantos: [number, number][] = [...CANTOS, [15_000, 17_050]]
  const ajustados = cantos.map(([a, b]) => (a === 5000 ? ([a, 7000] as [number, number]) : [a, b]))
  montar(cancionSincronizadaLrclib(), ajustados as [number, number][], true, true)
  const fin = await screen.findByRole('region', { name: 'Revisión terminada' })
  expect(fin).toHaveTextContent('No vemos nada raro. Puedes probarla a pantalla completa.')
})
