import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { linea, letra } from '@shared/__fixtures__'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import type {
  EstadoMotorReproductor,
  OpcionesMotorReproductor
} from '../../karaoke/motorReproductor'
import {
  apiEditorFalsa,
  cancionSeparando,
  cancionSincronizadaLrclib,
  cancionSinSincronizar
} from './fixturesApi'
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
  estado: vi.fn(() => ({
    sonando: false,
    duracionMs: 30_000,
    pista: 'original',
    velocidad: 1
  }))
}))

const motorPrueba = vi.hoisted(() => {
  const estado: EstadoMotorReproductor = {
    listo: true,
    sonando: true,
    cargando: false,
    finalizado: false,
    duracionMs: 30_000,
    vozDisponible: false,
    errorPrincipal: null,
    errorVoz: null
  }
  return {
    opciones: vi.fn<(o: OpcionesMotorReproductor) => void>(),
    cargar: vi.fn(async () => undefined),
    reproducir: vi.fn(async () => undefined),
    posicionMs: vi.fn(() => 8400),
    estado: () => estado,
    suscribir: vi.fn((cb: (e: EstadoMotorReproductor) => void) => {
      cb(estado)
      return () => undefined
    }),
    destruir: vi.fn()
  }
})

vi.mock('../../karaoke/motorReproductor', () => ({
  MotorReproductor: function (opciones: OpcionesMotorReproductor) {
    motorPrueba.opciones(opciones)
    return motorPrueba
  }
}))

vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => ({
    motor,
    estado: { sonando: false, pista: 'original', velocidad: 1, duracionMs: 30_000 }
  })
}))

function montar(cancion = cancionSinSincronizar()) {
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = falso.api as unknown as typeof window.shinobi
  const ir = vi.fn()
  const utils = render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir }}
    >
      <Editor id={cancion.id} />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { ...falso, ...utils, ir }
}

afterEach(() => {
  vi.clearAllMocks()
  act(() => cerrarTodosLosToasts())
})

it('abre un borrador sin tiempos en Voz, selecciona la primera línea y enfoca Sincronizar', async () => {
  montar()
  const boton = await screen.findByRole('button', { name: 'Sincronizar al ritmo (S)' })
  await waitFor(() => expect(boton).toHaveFocus())
  expect(screen.getByRole('option', { name: /^Línea 1, sin sincronizar/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getByRole('separator', { name: 'pausa' })).toBeVisible()
  expect(motor.usarPista).toHaveBeenCalledExactlyOnceWith('voz')
})

it('activa Voz al terminar la separación sin cambiar lo que suena', async () => {
  const { api, emitirCambio } = montar(cancionSeparando())
  const voz = await screen.findByRole('radio', { name: 'Voz' })
  expect(voz).toHaveAttribute('aria-disabled', 'true')
  fireEvent.focus(voz)
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'Disponible cuando termine la separación (42 %)'
  )
  const resumen = (await api.biblioteca.listar!())[0]!
  act(() =>
    emitirCambio({
      ...resumen,
      pasos: {
        ...resumen.pasos!,
        separacion: { estado: 'completado', progreso: null, error: null }
      }
    })
  )
  expect(screen.getByRole('radio', { name: 'Voz' })).not.toHaveAttribute('aria-disabled')
  expect(motor.usarPista).toHaveBeenCalledExactlyOnceWith('original')
})

it('selecciona la primera línea pendiente desde el contador y guarda los tiempos mostrados con offset', async () => {
  const c = cancionSincronizadaLrclib()
  c.letra!.offset_ms = 250
  c.letra!.lineas[1]!.inicio_ms = null
  montar(c)
  const segunda = await screen.findByRole('option', { name: /^Línea 2, sin sincronizar/ })
  expect(segunda).toHaveFocus()
  expect(screen.getByRole('option', { name: /^Línea 1, 00:02.25/ })).toBeVisible()
  fireEvent.keyDown(segunda, { key: 'ArrowUp' })
  fireEvent.click(screen.getByRole('button', { name: '5/6 sincronizadas' }))
  expect(segunda).toHaveFocus()
})

it('Esc cierra el diálogo de atajos antes de volver a la Biblioteca', async () => {
  const { ir } = montar()
  const boton = await screen.findByRole('button', { name: /Sincronizar al ritmo/ })
  await waitFor(() => expect(boton).toHaveFocus())
  fireEvent.keyDown(boton, { key: 'F1' })
  expect(screen.getByRole('dialog', { name: 'Atajos de teclado' })).toBeVisible()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Cerrar' }), { key: 'Escape' })
  expect(ir).not.toHaveBeenCalled()
  fireEvent.keyDown(boton, { key: 'Escape' })
  expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca' })
})

it('S entra en Sincronizar al ritmo con cuenta atrás y Esc la cancela sin marcar', async () => {
  const { ir } = montar()
  const boton = await screen.findByRole('button', { name: /Sincronizar al ritmo/ })
  await waitFor(() => expect(boton).toBeEnabled())
  fireEvent.keyDown(boton, { key: 's' })
  expect(await screen.findByRole('region', { name: 'Sincronizando al ritmo' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Deshacer (Retroceso)' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Estilo' })).toHaveAttribute('aria-disabled', 'true')
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: 'Sincronizando al ritmo' })).toBeNull()
  )
  expect(ir).not.toHaveBeenCalled()
  expect(motor.reproducir).not.toHaveBeenCalled()
})

it('mantiene menos de 100 opciones montadas para una letra de mil líneas', async () => {
  const cancion = cancionSincronizadaLrclib()
  cancion.letra = letra(
    Array.from({ length: 1000 }, (_, i) => linea(String(i), `Línea inventada ${i}`, i * 10))
  )
  montar(cancion)
  await screen.findByRole('listbox', { name: 'Líneas' })
  await waitFor(() => expect(screen.getAllByRole('option').length).toBeLessThan(100))
})

it('I aplica el desplazamiento, y deshacer restaura palabras descartadas por un ajuste', async () => {
  const c = cancionSincronizadaLrclib()
  const l = c.letra!
  l.offset_ms = 250
  l.lineas[0]!.palabras = [{ texto: 'Baila', inicio_ms: 2000, fin_ms: 4200 }]
  const { llamadas } = montar(c)
  const segunda = await screen.findByRole('option', { name: /^Línea 2,/ })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Escuchar al ajustar' }))
  fireEvent.click(segunda)
  fireEvent.keyDown(segunda, { key: 'i' })
  expect(screen.getByRole('option', { name: /^Línea 2, 00:04.20/ })).toBeVisible()
  await waitFor(
    () => {
      const llamada = llamadas.find((l) => l.metodo === 'letras.guardarTiempos')
      expect(llamada?.args[0]).toMatchObject({
        tiempos: expect.arrayContaining([expect.objectContaining({ id: 'l2', inicio_ms: 3950 })])
      })
    },
    { timeout: 2500 }
  )
  expect(screen.getByText(/La línea 1 ya no se resaltará palabra a palabra/)).toBeVisible()
  const aviso = screen
    .getByText(/La línea 1 ya no se resaltará palabra a palabra/)
    .closest('[data-testid=toast]')!
  fireEvent.click(aviso.querySelector('button')!)
  expect(screen.getByRole('option', { name: /^Línea 2, 00:05.25/ })).toBeVisible()
})

it('selecciona una región y ajusta un tirador por teclado sin mover el cabezal', async () => {
  montar(cancionSincronizadaLrclib())
  const segunda = await screen.findByRole('button', { name: /^En la ventana$/ })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Escuchar al ajustar' }))
  fireEvent.click(segunda)
  expect(segunda).toHaveAttribute('aria-pressed', 'true')
  const fin = screen.getByRole('slider', { name: 'Fin de la línea (automático)' })
  expect(fin).toHaveAttribute('aria-valuenow', '8000')
  fireEvent.keyDown(fin, { key: 'ArrowLeft', shiftKey: true })
  expect(screen.getByRole('slider', { name: 'Fin de la línea' })).toHaveAttribute(
    'aria-valuenow',
    '7900'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Zoom a la línea' }))
  const minimapa = screen.getByRole('slider', { name: 'Vista general' })
  const ventana = minimapa.getAttribute('aria-valuenow')
  fireEvent.keyDown(minimapa, { key: 'ArrowRight' })
  expect(minimapa.getAttribute('aria-valuenow')).not.toBe(ventana)
  expect(motor.buscar).not.toHaveBeenCalled()
  expect(motor.reproducir).not.toHaveBeenCalled()
})

it('bloquea el enunciado y restaura la posición al escapar sin salir del editor', async () => {
  const { ir } = montar(cancionSincronizadaLrclib())
  const bloqueo = await screen.findByRole('checkbox', { name: 'Bloquear enunciado' })
  fireEvent.click(bloqueo)
  expect(bloqueo).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Escuchar al ajustar' })).toBeDisabled()
  expect(motor.fijarBucle).toHaveBeenLastCalledWith(
    expect.objectContaining({ inicioMs: 2000, finMs: 5000 })
  )
  expect(motor.buscar).toHaveBeenLastCalledWith(2000)
  expect(motor.reproducir).toHaveBeenCalledOnce()
  fireEvent.keyDown(bloqueo, { key: 'Escape' })
  expect(bloqueo).not.toBeChecked()
  expect(motor.fijarBucle).toHaveBeenLastCalledWith(null)
  expect(motor.buscar).toHaveBeenLastCalledWith(4200)
  expect(ir).not.toHaveBeenCalled()
})

it('restaura o desarma el bucle según se cancele o confirme un fin inaudible', async () => {
  const cancion = cancionSincronizadaLrclib()
  cancion.letra!.offset_ms = -2500
  const { ir } = montar(cancion)
  const bloqueo = await screen.findByRole('checkbox', { name: 'Bloquear enunciado' })
  fireEvent.click(bloqueo)
  const fin = screen.getByRole('slider', { name: 'Fin de la línea (automático)' })
  vi.spyOn(fin.parentElement!, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ width: 1000 })
  )
  motor.estado.mockReturnValueOnce({
    sonando: true,
    duracionMs: 30_000,
    pista: 'original',
    velocidad: 1
  })
  fireEvent.pointerDown(fin, { pointerId: 1, button: 0, clientX: 100 })
  fireEvent.pointerMove(fin, { pointerId: 1, clientX: 10 })
  expect(motor.pausar).toHaveBeenCalledTimes(2)
  expect(bloqueo).toBeChecked()
  fireEvent.keyDown(fin, { key: 'Escape' })
  expect(bloqueo).toBeChecked()
  expect(motor.reproducir).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('slider', { name: 'Fin de la línea (automático)' })).toHaveAttribute(
    'aria-valuenow',
    '2500'
  )
  fireEvent.pointerDown(fin, { pointerId: 2, button: 0, clientX: 100 })
  fireEvent.pointerMove(fin, { pointerId: 2, clientX: 10 })
  fireEvent.pointerUp(fin, { pointerId: 2, clientX: 10 })
  expect(bloqueo).not.toBeChecked()
  expect(bloqueo).toBeDisabled()
  expect(bloqueo).toHaveAccessibleDescription('Esta línea queda fuera del audio.')
  expect(motor.fijarBucle).toHaveBeenLastCalledWith(null)
  expect(motor.buscar).toHaveBeenLastCalledWith(4200)
  expect(ir).not.toHaveBeenCalled()
})

it('una búsqueda fuera del bucle conserva su destino', async () => {
  montar(cancionSincronizadaLrclib())
  const bloqueo = await screen.findByRole('checkbox', { name: 'Bloquear enunciado' })
  fireEvent.click(bloqueo)
  const regla = screen.getByRole('slider', { name: 'Posición en la línea de tiempo' })
  fireEvent.change(regla, { target: { value: '9900' } })
  expect(bloqueo).not.toBeChecked()
  expect(motor.fijarBucle).toHaveBeenLastCalledWith(null)
  expect(motor.buscar.mock.calls).toEqual([[2000], [9900]])
})

it('recarga una visita desactualizada en pausa, vacía historial y no reintenta', async () => {
  const { fallar, llamadas } = montar(cancionSincronizadaLrclib())
  const primero = await screen.findByRole('option', { name: /^Línea 1,/ })
  fallar('letras.guardarTiempos', 'LETRA_DESACTUALIZADA')
  fireEvent.keyDown(primero, { key: '.' })
  // Esperar a que React aplique el cambio: en la CI de Linux la aserción
  // síncrona se adelantaba al render.
  await waitFor(() => expect(screen.getByRole('button', { name: /^Deshacer/ })).toBeEnabled())
  await screen.findByText(/La letra ha cambiado fuera del editor/, {}, { timeout: 2500 })
  expect(screen.getByRole('button', { name: /^Deshacer/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: /^Rehacer/ })).toBeDisabled()
  expect(screen.getByRole('option', { name: /^Línea 1, 00:02.00/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(motor.pausar).toHaveBeenCalledOnce()
  expect(motor.buscar).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByText('Guardado', { exact: true })).toBeVisible())
  expect(llamadas.filter((l) => l.metodo === 'letras.guardarTiempos')).toHaveLength(1)
  expect(llamadas.filter((l) => l.metodo === 'letras.abrirEdicion')).toHaveLength(2)
})

it('F vacía el guardado y prueba la mezcla desde la selección cuando la separación está en curso', async () => {
  const cancion = { ...cancionSeparando(), letra: cancionSincronizadaLrclib().letra }
  const { llamadas } = montar(cancion)
  const segunda = await screen.findByRole('option', { name: /^Línea 2,/ })
  fireEvent.click(segunda)
  fireEvent.click(screen.getByRole('button', { name: '+0,1 s' }))
  await screen.findByRole('option', { name: /^Línea 2, 00:05.10/ })
  motor.estado.mockReturnValueOnce({
    sonando: false,
    duracionMs: 30_000,
    pista: 'original',
    velocidad: 0.75
  })
  fireEvent.keyDown(segunda, { key: 'f' })

  const dialogo = await screen.findByRole('dialog', { name: /Reproductor de/ })
  expect(motorPrueba.opciones).toHaveBeenCalledWith(expect.objectContaining({ modo: 'original' }))
  expect(
    screen.getByText('Vista previa con la canción original: aún no hay pista instrumental.')
  ).toBeVisible()
  expect(motor.liberarAudio).toHaveBeenCalledOnce()
  expect(llamadas).toContainEqual(
    expect.objectContaining({
      metodo: 'letras.guardarTiempos',
      args: [expect.objectContaining({ offset_ms: 100 }), expect.any(String)]
    })
  )
  await waitFor(() => expect(motorPrueba.reproducir).toHaveBeenCalledWith({ desdeMs: 2100 }))

  fireEvent.keyDown(dialogo, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: /Reproductor de/ })).toBeNull()
  expect(screen.getByRole('option', { name: /^Línea 3,/ })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('button', { name: 'Probar a pantalla completa' })).toHaveFocus()
  expect(motor.usarPista).toHaveBeenLastCalledWith('original')
  await waitFor(() => expect(motor.buscar).toHaveBeenLastCalledWith(8400))
  expect(motorPrueba.destruir).toHaveBeenCalledBefore(motor.buscar)
  expect(motor.fijarVelocidad).toHaveBeenLastCalledWith(0.75)
  expect(llamadas.filter(({ metodo }) => metodo === 'letras.abrirEdicion')).toHaveLength(1)
  expect(llamadas.filter(({ metodo }) => metodo === 'letras.cerrarEdicion')).toHaveLength(0)
})

it('deshabilita la prueba sin líneas sincronizadas y durante la sincronía al ritmo', async () => {
  const sinTiempos = montar()
  const boton = await screen.findByRole('button', { name: 'Probar a pantalla completa' })
  expect(boton).toHaveAttribute('aria-disabled', 'true')
  fireEvent.focus(boton)
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'Sincroniza al menos una línea para probarla.'
  )
  fireEvent.keyDown(boton, { key: 'f' })
  fireEvent.click(boton)
  expect(motorPrueba.opciones).not.toHaveBeenCalled()
  sinTiempos.unmount()

  const cancion = cancionSincronizadaLrclib()
  cancion.letra!.lineas[1]!.inicio_ms = null
  montar(cancion)
  const sync = await screen.findByRole('button', { name: /Sincronizar al ritmo/ })
  await waitFor(() => expect(sync).toBeEnabled())
  fireEvent.keyDown(sync, { key: 's' })
  const banda = await screen.findByRole('region', { name: 'Sincronizando al ritmo' })
  expect(screen.getByRole('button', { name: 'Probar a pantalla completa' })).toBeDisabled()
  fireEvent.keyDown(banda, { key: 'f' })
  expect(motorPrueba.opciones).not.toHaveBeenCalled()
})

it('si el vaciado falla, usa la confirmación del editor antes de abrir la prueba', async () => {
  const { fallar } = montar(cancionSincronizadaLrclib())
  const probar = await screen.findByRole('button', { name: 'Probar a pantalla completa' })
  fallar('letras.guardarTiempos', 'ERROR_INTERNO', 2)
  fireEvent.click(screen.getByRole('button', { name: '+0,1 s' }))
  await screen.findByRole('option', { name: /^Línea 1, 00:02.10/ })
  fireEvent.click(probar)
  const quedarse = await screen.findByRole('button', { name: 'Quedarme en el editor' })
  expect(quedarse).toHaveFocus()
  fireEvent.click(quedarse)
  expect(motor.liberarAudio).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog', { name: /Reproductor de/ })).toBeNull()

  await waitFor(() => expect(quedarse).not.toBeInTheDocument())
  fireEvent.click(probar)
  fireEvent.click(await screen.findByRole('button', { name: 'Salir sin guardarlos' }))
  expect(await screen.findByRole('dialog', { name: /Reproductor de/ })).toBeVisible()
  expect(motor.liberarAudio).toHaveBeenCalledOnce()
})

it('guarda el desplazamiento desde la prueba con pistas y lo deshace en un paso', async () => {
  const { llamadas } = montar(cancionSincronizadaLrclib())
  const probar = await screen.findByRole('button', { name: 'Probar a pantalla completa' })
  fireEvent.click(probar)
  const dialogo = await screen.findByRole('dialog', { name: /Reproductor de/ })
  await waitFor(() =>
    expect(motorPrueba.opciones).toHaveBeenCalledWith(expect.objectContaining({ modo: 'karaoke' }))
  )

  fireEvent.keyDown(dialogo, { key: '.' })
  await screen.findByText('Desplazamiento: +0,10 s')
  fireEvent.keyDown(dialogo, { key: '.' })
  await screen.findByText('Desplazamiento: +0,20 s')
  await waitFor(
    () => {
      expect(llamadas).toContainEqual(
        expect.objectContaining({
          metodo: 'letras.guardarTiempos',
          args: [expect.objectContaining({ offset_ms: 200 }), expect.any(String)]
        })
      )
    },
    { timeout: 2500 }
  )

  fireEvent.keyDown(dialogo, { key: 'Escape' })
  await screen.findByRole('option', { name: /^Línea 1, 00:02.20/ })
  expect(probar).toHaveFocus()
  fireEvent.keyDown(probar, { key: 'z', ctrlKey: true })
  await screen.findByRole('option', { name: /^Línea 1, 00:02.00/ })
  expect(screen.getByRole('button', { name: /^Deshacer/ })).toBeDisabled()
})
