import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  cancionLista,
  cancionSeparando,
  cancionSincronizadaLrclib,
  cancionSinSincronizar
} from './fixturesApi'
import { Editor } from './Editor'
import { E } from './textos'
import { LL } from './textosLetraLista'

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
  const boton = await screen.findByRole('button', { name: 'Sincronizar al ritmo' })
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

it('S no hace nada; el botón entra en Sincronizar al ritmo con cuenta atrás y Esc la cancela sin marcar', async () => {
  const { ir } = montar()
  const boton = await screen.findByRole('button', { name: 'Sincronizar al ritmo' })
  await waitFor(() => expect(boton).toBeEnabled())
  fireEvent.keyDown(boton, { key: 's' })
  expect(screen.queryByRole('region', { name: 'Sincronizando al ritmo' })).toBeNull()
  fireEvent.click(boton)
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

it('I respeta offset_ms, y deshacer restaura palabras hechas a mano descartadas por un ajuste', async () => {
  const c = cancionSincronizadaLrclib()
  const l = c.letra!
  l.offset_ms = 250
  l.lineas[0]!.palabras = [{ texto: 'Baila', inicio_ms: 2000, fin_ms: 4200 }]
  l.lineas[0]!.origen_palabras = 'manual'
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
  expect(screen.getByText(/La línea 1 vuelve al barrido progresivo/)).toBeVisible()
  const aviso = screen
    .getByText(/La línea 1 vuelve al barrido progresivo/)
    .closest('[data-testid=toast]')!
  fireEvent.click(aviso.querySelector('button')!)
  expect(screen.getByRole('option', { name: /^Línea 2, 00:05.25/ })).toBeVisible()
})

it('Mayús + L escucha la línea seleccionada con 0,5 s de margen y L sigue sin pausa al final', async () => {
  montar(cancionSincronizadaLrclib())
  const primera = await screen.findByRole('option', { name: /^Línea 1, 00:02.00/ })
  await act(async () => {})
  fireEvent.keyDown(primera, { key: 'L', shiftKey: true })
  expect(motor.reproducir).toHaveBeenLastCalledWith({
    desdeMs: 1500,
    hastaMs: expect.any(Number)
  })
  const { hastaMs } = (motor.reproducir.mock.lastCall as unknown as [{ hastaMs: number }])[0]
  expect(hastaMs).toBeGreaterThan(2500)
  fireEvent.keyDown(primera, { key: 'l' })
  expect(motor.reproducir).toHaveBeenLastCalledWith({ desdeMs: 0 })
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
  // Los atajos se registran en un efecto pasivo (useAtajosEditor): bajo carga caen después de que
  // aparezca la línea y la tecla se perdía (~10 % con 8 procesos en paralelo).
  await act(async () => {})
  fallar('letras.guardarTiempos', 'LETRA_DESACTUALIZADA')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Escuchar al ajustar' }))
  fireEvent.keyDown(primero, { key: 'ArrowRight', altKey: true })
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
  fireEvent.keyDown(segunda, { key: 'ArrowRight', altKey: true, shiftKey: true })
  await screen.findByRole('option', { name: /^Línea 2, 00:05.10/ })
  motor.estado.mockReturnValueOnce({
    sonando: false,
    duracionMs: 30_000,
    pista: 'original',
    velocidad: 0.75
  })
  fireEvent.keyDown(segunda, { key: 'f' })

  const dialogo = await screen.findByRole('dialog', { name: /Reproductor de/ })
  await waitFor(() =>
    expect(motorPrueba.opciones).toHaveBeenCalledWith(expect.objectContaining({ modo: 'original' }))
  )
  expect(
    screen.getByText('Vista previa con la canción original: aún no hay pista instrumental.')
  ).toBeVisible()
  expect(motor.liberarAudio).toHaveBeenCalledOnce()
  expect(llamadas).toContainEqual(
    expect.objectContaining({
      metodo: 'letras.guardarTiempos',
      args: [
        expect.objectContaining({
          tiempos: expect.arrayContaining([expect.objectContaining({ id: 'l2', inicio_ms: 5100 })])
        }),
        expect.any(String)
      ]
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
  fireEvent.click(sync)
  const banda = await screen.findByRole('region', { name: 'Sincronizando al ritmo' })
  expect(screen.getByRole('button', { name: 'Probar a pantalla completa' })).toBeDisabled()
  fireEvent.keyDown(banda, { key: 'f' })
  expect(motorPrueba.opciones).not.toHaveBeenCalled()
})

it('si el vaciado falla, usa la confirmación del editor antes de abrir la prueba', async () => {
  const { fallar } = montar(cancionSincronizadaLrclib())
  const probar = await screen.findByRole('button', { name: 'Probar a pantalla completa' })
  fallar('letras.guardarTiempos', 'ERROR_INTERNO', 2)
  const primera = await screen.findByRole('option', { name: /^Línea 1,/ })
  fireEvent.keyDown(primera, { key: 'ArrowRight', altKey: true, shiftKey: true })
  await screen.findByRole('option', { name: /^Línea 1, 00:02.10/ })
  fireEvent.click(probar)
  const quedarse = await screen.findByRole('button', { name: 'Quedarme en el editor' })
  await waitFor(() => expect(quedarse).toHaveFocus())
  fireEvent.click(quedarse)
  expect(motor.liberarAudio).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog', { name: /Reproductor de/ })).toBeNull()

  await waitFor(() => expect(quedarse).not.toBeInTheDocument())
  fireEvent.click(probar)
  fireEvent.click(await screen.findByRole('button', { name: 'Salir sin guardarlos' }))
  expect(await screen.findByRole('dialog', { name: /Reproductor de/ })).toBeVisible()
  expect(motor.liberarAudio).toHaveBeenCalledOnce()
})

it('«,» y «.» no hacen nada en la prueba desde el editor ni crean pasos de deshacer', async () => {
  const c = cancionSincronizadaLrclib()
  c.letra!.offset_ms = 1500
  const { llamadas } = montar(c)
  const probar = await screen.findByRole('button', { name: 'Probar a pantalla completa' })
  fireEvent.click(probar)
  const dialogo = await screen.findByRole('dialog', { name: /Reproductor de/ })
  await waitFor(() =>
    expect(motorPrueba.opciones).toHaveBeenCalledWith(expect.objectContaining({ modo: 'karaoke' }))
  )

  fireEvent.keyDown(dialogo, { key: '.' })
  fireEvent.keyDown(dialogo, { key: ',' })
  expect(screen.queryByText(/Desplazamiento/)).toBeNull()

  fireEvent.keyDown(dialogo, { key: 'Escape' })
  // offset_ms se sigue aplicando: 2,0 s + 1,5 s.
  await screen.findByRole('option', { name: /^Línea 1, 00:03.50/ })
  expect(probar).toHaveFocus()
  expect(screen.getByRole('button', { name: /^Deshacer/ })).toBeDisabled()
  expect(llamadas.filter((l) => l.metodo === 'letras.guardarTiempos')).toHaveLength(0)
})

it('cambia entre Lista y Letra lista desde Funciones sin salir ni tocar el historial', async () => {
  const { llamadas, ir } = montar(cancionLista())
  await screen.findByRole('button', { name: 'Más acciones del editor' })
  expect(screen.getByText('Lista')).toBeVisible()
  fireEvent.click(screen.getByRole('radio', { name: 'Funciones' }))
  fireEvent.click(screen.getByRole('button', { name: E.funciones.modo.aLetraLista }))
  const dialogo = await screen.findByRole('dialog', { name: LL.dialogoTitulo })
  fireEvent.click(within(dialogo).getByRole('button', { name: LL.confirmarCambio }))
  expect(await screen.findByText('Letra lista')).toBeVisible()
  expect(screen.getAllByText(LL.toastCambio).length).toBeGreaterThan(0)
  expect(llamadas.find((l) => l.metodo === 'biblioteca.marcarLista')?.args[1]).toEqual({
    modalidad: 'letra_lista'
  })
  expect(ir).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /^Deshacer/ })).toBeDisabled()
  // El foco pasa al botón que sustituye al pulsado.
  await waitFor(() =>
    expect(screen.getByRole('button', { name: E.funciones.modo.aLista })).toHaveFocus()
  )

  fireEvent.click(screen.getByRole('button', { name: E.funciones.modo.aLista }))
  expect(await screen.findByText('Lista')).toBeVisible()
  expect(screen.getAllByText(LL.toastKaraoke).length).toBeGreaterThan(0)
})

it('el dock de una Lista ofrece «Marcar como letra lista» y «Hecho»; el primero cambia la modalidad y vuelve a la Biblioteca (E8-12, E8-13)', async () => {
  const { llamadas, ir } = montar(cancionLista())
  const letraLista = await screen.findByRole('button', { name: 'Marcar como letra lista' })
  expect(screen.getByRole('button', { name: 'Hecho' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Marcar como lista' })).toBeNull()
  fireEvent.click(letraLista)
  const dialogo = await screen.findByRole('dialog', { name: LL.dialogoTitulo })
  fireEvent.click(within(dialogo).getByRole('button', { name: LL.boton }))
  await waitFor(() =>
    expect(ir).toHaveBeenCalledWith({
      tipo: 'biblioteca',
      enfocar: { id: expect.any(String), resaltar: true }
    })
  )
  expect(llamadas.find((l) => l.metodo === 'biblioteca.marcarLista')?.args[1]).toEqual({
    modalidad: 'letra_lista'
  })
})

it('el dock de una Letra lista ofrece «Marcar como lista» y «Hecho»; con líneas sin inicio, el aviso sale una sola vez entre los dos', async () => {
  const cancion = cancionLista()
  cancion.modalidad = 'letra_lista'
  cancion.letra!.lineas[1]!.inicio_ms = null
  const { llamadas, ir } = montar(cancion)
  const lista = await screen.findByRole('button', { name: 'Marcar como lista' })
  expect(screen.getByRole('button', { name: 'Hecho' })).toBeVisible()
  fireEvent.click(lista)
  const popover = await screen.findByRole('dialog', { name: /falta 1 línea por sincronizar/ })
  expect(ir).not.toHaveBeenCalled()
  fireEvent.click(within(popover).getByRole('button', { name: 'Salir igualmente' }))
  // El doble de main exige todas las líneas con inicio y rechaza el cambio (ver preguntas/0151).
  await waitFor(() =>
    expect(llamadas.find((l) => l.metodo === 'biblioteca.marcarLista')?.args[1]).toEqual({
      modalidad: 'karaoke'
    })
  )
  // Una segunda pulsación ya no repite el aviso: va directa a cambiar.
  fireEvent.click(screen.getByRole('button', { name: 'Hecho' }))
  expect(screen.queryByRole('dialog', { name: /falta 1 línea por sincronizar/ })).toBeNull()
  expect(ir).toHaveBeenCalledOnce()
})
