import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estiloPredeterminado } from '@shared/estilo'
import { letra, linea } from '@shared/__fixtures__'
import {
  crearApiReproductorFalsa,
  entrada,
  estadoS1,
  estadoS2,
  estadoS3,
  estadoS4,
  SESION_ID,
  TRANSICION_ID,
  type ApiReproductorFalsa
} from '@shared/__fixtures__/sesion'
import type { EntradaCargarIpc, ComandoSecundariaIpc } from '@shared/sesion'
import type { EstadoMotorReproductor } from '../karaoke/motorReproductor'
import { R } from '../vistas/reproductor/textos'
import { AppSecundaria } from './AppSecundaria'
import { SES } from './textos'

const ID_CANDIDATA = '00000000-0000-4000-8000-000000000002'
const ID_ACTIVA = '00000000-0000-4000-8000-000000000001'

const ENTRADA_ID = entrada(1).entradaId
const OTRA_ENTRADA_ID = entrada(7).entradaId

function entradaCargar(extra: Partial<EntradaCargarIpc> = {}): EntradaCargarIpc {
  return {
    entradaId: ENTRADA_ID,
    cancionId: 'cancion-1',
    titulo: 'Canción 1',
    artista: 'Artista 1',
    duracionMs: 30_000,
    gananciaDb: 0,
    letra: letra([linea('l1', 'Luz sobre el río', 2_000)]),
    estilo: estiloPredeterminado(),
    modalidad: 'karaoke',
    lineasSinSincronizar: 0,
    silencioPrevio: true,
    ...extra
  }
}

function cargar(
  extra: Partial<Extract<ComandoSecundariaIpc, { tipo: 'cargar' }>> = {}
): ComandoSecundariaIpc {
  return {
    tipo: 'cargar',
    sesionId: SESION_ID,
    revision: 5,
    entrada: entradaCargar(),
    desdeMs: 0,
    pausada: false,
    anuncio: 'inicio',
    ...extra
  }
}

function motorFalso(posicion = 0) {
  let estado: EstadoMotorReproductor = {
    listo: false,
    cargando: false,
    sonando: false,
    finalizado: false,
    duracionMs: 30_000,
    vozDisponible: true,
    errorPrincipal: null,
    errorVoz: null
  }
  const oyentes = new Set<(e: EstadoMotorReproductor) => void>()
  const emitir = (cambio: Partial<EstadoMotorReproductor>) => {
    estado = { ...estado, ...cambio }
    for (const oyente of oyentes) oyente(estado)
  }
  const motor = {
    cargar: vi.fn(async () => emitir({ listo: true })),
    reproducir: vi.fn(async () => emitir({ sonando: true })),
    pausar: vi.fn(() => emitir({ sonando: false })),
    buscar: vi.fn(() => emitir({ finalizado: false })),
    posicionMs: vi.fn(() => posicion),
    fijarVolumen: vi.fn(),
    fijarVoz: vi.fn(),
    estado: () => estado,
    suscribir: (cb: (e: EstadoMotorReproductor) => void) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    destruir: vi.fn()
  }
  return { motor, emitir }
}

type Motor = ReturnType<typeof motorFalso>

async function montar(estado = estadoS1(), posicion = 0) {
  const f = crearApiReproductorFalsa(estado)
  const motores: Motor[] = []
  const crearMotor = vi.fn(() => {
    const m = motorFalso(posicion)
    motores.push(m)
    return m.motor as never
  })
  render(<AppSecundaria api={f.api} crearMotor={crearMotor} />)
  await act(async () => undefined)
  return { f, motores, crearMotor }
}

const avanzar = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms))
const llamadas = (f: ApiReproductorFalsa, nombre: string) =>
  f.llamadas.filter(([n]) => n === nombre)
const numero = () => screen.getByTestId('numero-cuenta').textContent
const anuncio = () => document.querySelector('[aria-live="polite"]')!.textContent

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance']
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('AppSecundaria · estados S1–S4', () => {
  it('S1 pinta la cuenta hacia la candidata y la anuncia una vez (P3)', async () => {
    const { f } = await montar()
    expect(llamadas(f, 'sesion.inicial')).toHaveLength(1)
    expect(screen.getByRole('region', { name: R.cola.ventana })).toHaveAttribute(
      'style',
      expect.stringContaining('--k-fondo')
    )
    expect(numero()).toBe('3')
    expect(screen.getByTestId('anillo-cuenta')).toBeInTheDocument()
    expect(screen.getByTestId('tarjeta-siguiente')).toHaveTextContent(
      `${R.cola.aContinuacion}Canción 2Artista 2`
    )
    expect(anuncio()).toBe(R.cola.aria.cuenta('Canción 2', 'Artista 2', 3))
    await avanzar(1000)
    expect(numero()).toBe('2')
    await avanzar(1500)
    expect(numero()).toBe('1')
    // Nunca muestra 0: la candidata empieza cuando main lo ordena.
    await avanzar(5000)
    expect(numero()).toBe('1')
  })

  it('con movimiento reducido no hay anillo y el número cambia de golpe (P4)', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    )
    await montar()
    expect(screen.queryByTestId('anillo-cuenta')).not.toBeInTheDocument()
    expect(numero()).toBe('3')
    await avanzar(1000)
    expect(numero()).toBe('2')
  })

  it('cambiar la candidata reinicia la cuenta y anuncia el cambio una vez; reordenar las demás no (P5)', async () => {
    const { f } = await montar()
    await avanzar(2000)
    expect(numero()).toBe('1')
    const otra = estadoS1({
      revision: 2,
      candidata: {
        entradaId: '00000000-0000-4000-8000-000000000077',
        titulo: 'Otra',
        artista: 'Alguien',
        estilo: estiloPredeterminado()
      },
      transicion: {
        transicionId: '00000000-0000-4000-8000-000000000999',
        restanteMs: 4000,
        duracionMs: 4000,
        congelada: false
      }
    })
    act(() => f.emitirEstado(otra))
    expect(screen.getByTestId('tarjeta-siguiente')).toHaveTextContent('Otra')
    expect(numero()).toBe('4')
    expect(anuncio()).toBe(R.cola.aria.cambio('Otra', 'Alguien', 4))
    await avanzar(1000)
    // Misma candidata (mismo transicionId), otra revisión: no reinicia ni anuncia otra vez.
    act(() =>
      f.emitirEstado({
        ...otra,
        revision: 3,
        transicion: { ...otra.transicion!, restanteMs: 3000 }
      })
    )
    expect(numero()).toBe('3')
    expect(anuncio()).toBe(R.cola.aria.cambio('Otra', 'Alguien', 4))
    // Se queda sin pendientes: S3.
    act(() => f.emitirEstado(estadoS3({ revision: 4 })))
    expect(screen.getByTestId('fin-de-cola')).toBeInTheDocument()
    expect(screen.queryByTestId('cuenta-transicion')).not.toBeInTheDocument()
  })

  it('S3 no se cierra sola y al llegar una canción empieza la cuenta con un único anuncio (P7)', async () => {
    const { f } = await montar(estadoS3())
    expect(screen.getByText(R.cola.fin)).toBeInTheDocument()
    expect(anuncio()).toBe(R.cola.aria.fin)
    await avanzar(60_000)
    expect(screen.getByTestId('fin-de-cola')).toBeInTheDocument()
    expect(llamadas(f, 'sesion.cierre.solicitar')).toHaveLength(0)
    act(() => f.emitirEstado(estadoS1({ revision: 6 })))
    expect(numero()).toBe('3')
    expect(anuncio()).toBe(R.cola.aria.cuenta('Canción 2', 'Artista 2', 3))
    // Los botones aparecen con actividad del ratón.
    fireEvent.pointerMove(screen.getByRole('region', { name: R.cola.ventana }))
    fireEvent.click(screen.getByRole('button', { name: R.cola.detener }))
    expect(llamadas(f, 'sesion.detenerTransicion')).toEqual([
      ['sesion.detenerTransicion', TRANSICION_ID]
    ])
    act(() => f.emitirEstado(estadoS2({ revision: 7 })))
    expect(screen.queryByTestId('cuenta-transicion')).not.toBeInTheDocument()
    expect(anuncio()).toBe(R.cola.aria.espera('Canción 2'))
    fireEvent.pointerMove(screen.getByRole('region', { name: R.cola.ventana }))
    fireEvent.click(screen.getByRole('button', { name: R.cola.iniciar('Canción 2') }))
    expect(llamadas(f, 'sesion.empezar')).toEqual([['sesion.empezar', ID_CANDIDATA]])
  })

  it('S3 ofrece «Otra vez» y S2 sin candidata muestra la marca (P11)', async () => {
    const { f } = await montar(estadoS3())
    fireEvent.click(screen.getByRole('button', { name: R.cola.otraVez }))
    // «Otra vez» repite la última terminada (0068).
    expect(llamadas(f, 'sesion.repetir')).toEqual([['sesion.repetir', ID_ACTIVA]])
    act(() => f.emitirEstado(estadoS2({ revision: 9, candidata: null, pendientes: 0 })))
    expect(screen.getByTestId('espera-vacia')).toHaveTextContent(R.cola.espera)
    expect(screen.queryByRole('button', { name: /Iniciar/ })).not.toBeInTheDocument()
  })

  it('S2 con candidata no muestra cuenta y Espacio la inicia', async () => {
    const { f } = await montar(estadoS2())
    expect(screen.getByTestId('tarjeta-siguiente')).toBeInTheDocument()
    expect(screen.queryByTestId('cuenta-transicion')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: ' ' })
    expect(llamadas(f, 'sesion.empezar')).toEqual([['sesion.empezar', ID_CANDIDATA]])
  })

  it('S4 es una alerta; sin pendientes no ofrece pasar y añade el texto de fin', async () => {
    const { f } = await montar(estadoS4({ pendientes: 1 }))
    expect(screen.getByRole('alert')).toHaveTextContent(R.cola.fallo)
    fireEvent.click(screen.getByRole('button', { name: R.cola.pasar }))
    // Un fallo de una entrada que la secundaria nunca cargó: título e id vienen del estado (0068).
    expect(screen.getByText('«Canción 1»')).toBeInTheDocument()
    expect(llamadas(f, 'sesion.siguiente')).toEqual([['sesion.siguiente', ID_ACTIVA]])
    act(() => f.emitirEstado(estadoS4({ revision: 3, pendientes: 0 })))
    expect(screen.getByRole('alert')).toHaveTextContent(`${R.cola.fallo} ${R.cola.falloFin}`)
    expect(screen.queryByRole('button', { name: R.cola.pasar })).not.toBeInTheDocument()
  })

  it('con el diálogo de cierre abierto la cuenta no cambia en 5 s y sigue desde el mismo número (P9)', async () => {
    const { f } = await montar()
    await avanzar(1000)
    expect(numero()).toBe('2')
    act(() => f.emitirEstado(estadoS1({ revision: 2, cierrePendiente: { origen: 'secundaria' } })))
    expect(screen.getByRole('dialog', { name: SES.cierre.titulo })).toBeInTheDocument()
    // «Quedan {n} canciones» (0068).
    expect(screen.getByRole('dialog')).toHaveTextContent('Quedan 2 canciones')
    await avanzar(5000)
    expect(numero()).toBe('2')
    act(() => f.emitirEstado(estadoS1({ revision: 3 })))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(numero()).toBe('2')
    await avanzar(1500)
    expect(numero()).toBe('1')
  })

  it('si el cierre se pidió en la principal no se muestra nada al público', async () => {
    const { f } = await montar(estadoS1({ cierrePendiente: { origen: 'principal' } }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await avanzar(5000)
    expect(numero()).toBe('3')
    expect(llamadas(f, 'sesion.cierre.cancelar')).toHaveLength(0)
  })

  it('el diálogo de cierre confirma con la revisión del estado y avisa si quedó obsoleto', async () => {
    const f = crearApiReproductorFalsa(
      estadoS1({ revision: 11, cierrePendiente: { origen: 'secundaria' } })
    )
    f.api.sesion.cierre.confirmar = vi
      .fn()
      .mockRejectedValue({ codigo: 'CONFIRMACION_OBSOLETA', mensaje: 'x' })
    render(<AppSecundaria api={f.api} />)
    await act(async () => undefined)
    expect(screen.getByRole('button', { name: SES.cierre.cancelar })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: SES.cierre.conservar }))
    await act(async () => undefined)
    expect(f.api.sesion.cierre.confirmar).toHaveBeenCalledWith('conservar', 11)
    expect(screen.getByRole('alert')).toHaveTextContent(SES.cierre.obsoleto)
    fireEvent.click(screen.getByRole('button', { name: SES.cierre.cancelar }))
    expect(llamadas(f, 'sesion.cierre.cancelar')).toHaveLength(1)
  })

  it('el volumen se guarda como mucho cada 500 ms', async () => {
    const { f } = await montar()
    fireEvent.click(screen.getByRole('button', { name: R.tooltip.silenciar }))
    fireEvent.click(screen.getByRole('button', { name: R.tooltip.activarSonido }))
    expect(llamadas(f, 'sesion.guardarPreferencias')).toHaveLength(0)
    await avanzar(500)
    expect(llamadas(f, 'sesion.guardarPreferencias')).toHaveLength(1)
  })
})

describe('AppSecundaria · reproductor de la sesión', () => {
  it('carga la entrada, informa al motor y no muestra avisos de línea ni toasts (P15)', async () => {
    const { f, motores } = await montar()
    act(() => f.emitirComando(cargar({ entrada: entradaCargar({ lineasSinSincronizar: 2 }) })))
    await act(async () => undefined)
    const region = screen.getByRole('region', { name: R.aria.region('Canción 1') })
    expect(region).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(region).not.toHaveAttribute('aria-modal')
    expect(document.body.querySelector('[inert]')).toBeNull()
    expect(screen.queryByText(/por sincronizar/)).not.toBeInTheDocument()
    expect(motores).toHaveLength(1)
    expect(motores[0]!.motor.reproducir).toHaveBeenCalledWith({ desdeMs: -4000 })
    expect(f.informes.map((i) => i.tipo)).toEqual(['lista', 'reproduciendo'])
    expect(f.informes.every((i) => i.sesionId === SESION_ID && i.entradaId === ENTRADA_ID)).toBe(
      true
    )
    expect(screen.getByRole('button', { name: R.cola.cerrar })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: R.cola.tooltipReiniciar })).toBeInTheDocument()
  })

  it('informa la posición como mucho dos veces por segundo', async () => {
    const { f } = await montar()
    act(() => f.emitirComando(cargar()))
    await act(async () => undefined)
    await avanzar(2000)
    expect(f.informes.filter((i) => i.tipo === 'posicion')).toHaveLength(4)
  })

  it('ignora comandos de otra sesión, un pausar de otra entrada y un cargar repetido', async () => {
    const { f, motores, crearMotor } = await montar()
    act(() => f.emitirComando(cargar({ sesionId: '00000000-0000-4000-8000-000000000123' })))
    expect(crearMotor).not.toHaveBeenCalled()
    act(() => f.emitirComando(cargar()))
    await act(async () => undefined)
    act(() => f.emitirComando(cargar({ revision: 6 })))
    expect(crearMotor).toHaveBeenCalledTimes(1)
    const { motor } = motores[0]!
    act(() =>
      f.emitirComando({
        tipo: 'pausar',
        sesionId: SESION_ID,
        revision: 7,
        entradaId: OTRA_ENTRADA_ID,
        causa: 'principal'
      })
    )
    expect(motor.pausar).not.toHaveBeenCalled()
    act(() =>
      f.emitirComando({
        tipo: 'pausar',
        sesionId: SESION_ID,
        revision: 8,
        entradaId: ENTRADA_ID,
        causa: 'principal'
      })
    )
    expect(motor.pausar).toHaveBeenCalledOnce()
    expect(f.informes.at(-1)?.tipo).toBe('pausada')
    act(() =>
      f.emitirComando({ tipo: 'reanudar', sesionId: SESION_ID, revision: 9, entradaId: ENTRADA_ID })
    )
    await act(async () => undefined)
    expect(motor.reproducir).toHaveBeenCalledTimes(2)
    act(() =>
      f.emitirComando({
        tipo: 'reiniciar',
        sesionId: SESION_ID,
        revision: 10,
        entradaId: ENTRADA_ID
      })
    )
    expect(motor.buscar).toHaveBeenCalledWith(0)
  })

  it('informa `fin` una sola vez aunque el motor repita finalizado y no crea cuenta de cierre', async () => {
    const { f, motores } = await montar()
    act(() => f.emitirComando(cargar()))
    await act(async () => undefined)
    const { emitir } = motores[0]!
    act(() => emitir({ sonando: false, finalizado: true }))
    act(() => emitir({ finalizado: true }))
    act(() => emitir({ finalizado: true, listo: true }))
    expect(f.informes.filter((i) => i.tipo === 'fin')).toHaveLength(1)
    await avanzar(30_000)
    // Sin pantalla final ni «Se cerrará en…»: la ventana espera la orden de main.
    expect(screen.queryByText(/Se cerrará/)).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: R.aria.region('Canción 1') })).toBeInTheDocument()
    expect(llamadas(f, 'sesion.cierre.solicitar')).toHaveLength(0)
    expect(f.informes.filter((i) => i.tipo === 'fin')).toHaveLength(1)
  })

  it('un error de la pista principal se informa y el comando `error` lo sustituye por S4', async () => {
    const { f, motores } = await montar()
    act(() => f.emitirComando(cargar()))
    await act(async () => undefined)
    act(() =>
      motores[0]!.emitir({
        sonando: false,
        errorPrincipal: { tipo: 'no_encontrada', detalle: 'HTTP 404', ruta: 'x' }
      })
    )
    expect(f.informes.at(-1)).toMatchObject({
      tipo: 'error',
      error: { motivo: 'no_encontrada', pista: 'instrumental' }
    })
    act(() =>
      f.emitirComando({
        tipo: 'error',
        sesionId: SESION_ID,
        revision: 6,
        motivo: 'sin_pistas',
        entradaId: ENTRADA_ID,
        titulo: 'Canción 1'
      })
    )
    act(() => f.emitirEstado(estadoS4({ revision: 6 })))
    expect(screen.getByRole('alert')).toHaveTextContent(R.cola.fallo)
    expect(screen.getByText('«Canción 1»')).toBeInTheDocument()
  })

  it('reanuda en pausa sin título ni silencio previo y muestra el indicador (P10)', async () => {
    const { f, motores } = await montar(estadoS1(), 133_000)
    act(() =>
      f.emitirComando(
        cargar({
          desdeMs: 133_000,
          pausada: true,
          anuncio: 'reanudacion',
          entrada: entradaCargar({ duracionMs: 300_000 })
        })
      )
    )
    await act(async () => undefined)
    const { motor } = motores[0]!
    expect(motor.reproducir).not.toHaveBeenCalled()
    expect(motor.buscar).toHaveBeenCalledWith(133_000)
    expect(screen.getByText(R.cola.reanudada('02:13'))).toBeInTheDocument()
    expect(anuncio()).toBe(R.cola.aria.reanudada('02:13'))
    await avanzar(2100)
    expect(screen.queryByText(R.cola.reanudada('02:13'))).not.toBeInTheDocument()
    // Al reanudar empieza en ese segundo.
    act(() =>
      f.emitirComando({ tipo: 'reanudar', sesionId: SESION_ID, revision: 6, entradaId: ENTRADA_ID })
    )
    await act(async () => undefined)
    expect(motor.reproducir).toHaveBeenCalledWith({ desdeMs: 133_000 })
  })

  it('reanuda sonando desde el segundo guardado, sin silencio previo', async () => {
    const { f, motores } = await montar()
    act(() => f.emitirComando(cargar({ desdeMs: 90_000, anuncio: 'reanudacion' })))
    await act(async () => undefined)
    expect(motores[0]!.motor.reproducir).toHaveBeenCalledWith({ desdeMs: 90_000 })
  })

  it('Esc pasa de pantalla completa a ventana y nunca cierra; Ctrl+W y Cmd+W piden el cierre (P12)', async () => {
    const { f } = await montar()
    act(() => f.emitirComando(cargar()))
    await act(async () => undefined)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(llamadas(f, 'ventana.fijarPantallaCompleta')).toHaveLength(0)
    expect(llamadas(f, 'sesion.cierre.solicitar')).toHaveLength(0)
    act(() => f.emitirPantallaCompleta(true))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(llamadas(f, 'ventana.fijarPantallaCompleta')).toEqual([
      ['ventana.fijarPantallaCompleta', false]
    ])
    expect(llamadas(f, 'sesion.cierre.solicitar')).toHaveLength(0)
    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'w', metaKey: true })
    expect(llamadas(f, 'sesion.cierre.solicitar')).toHaveLength(2)
  })

  it('Mayús + N avanza con pendientes y sin ellas solo lo indica', async () => {
    const { f } = await montar()
    act(() => f.emitirComando(cargar()))
    await act(async () => undefined)
    fireEvent.keyDown(window, { key: 'N', shiftKey: true })
    expect(llamadas(f, 'sesion.siguiente')).toEqual([['sesion.siguiente', ENTRADA_ID]])
    act(() =>
      f.emitirEstado(
        estadoS1({ revision: 9, fase: 'reproduciendo', transicion: null, pendientes: 0 })
      )
    )
    fireEvent.keyDown(window, { key: 'N', shiftKey: true })
    expect(llamadas(f, 'sesion.siguiente')).toHaveLength(1)
    expect(screen.getByText(R.cola.siguienteNo)).toBeInTheDocument()
  })

  it('un estado anterior al cargar no sustituye al reproductor; uno posterior sí', async () => {
    const { f } = await montar()
    act(() => f.emitirComando(cargar({ revision: 10 })))
    await act(async () => undefined)
    act(() => f.emitirEstado(estadoS3({ revision: 9 })))
    expect(screen.getByRole('region', { name: R.aria.region('Canción 1') })).toBeInTheDocument()
    act(() => f.emitirEstado(estadoS3({ revision: 11 })))
    expect(screen.getByTestId('fin-de-cola')).toBeInTheDocument()
    expect(screen.getByText('Canción 1')).toBeInTheDocument()
  })

  it('`transicion` de main sustituye al reproductor por la cuenta', async () => {
    const { f, motores } = await montar()
    act(() => f.emitirComando(cargar()))
    await act(async () => undefined)
    act(() =>
      f.emitirComando({
        tipo: 'transicion',
        sesionId: SESION_ID,
        revision: 6,
        transicion: {
          candidata: { entradaId: ENTRADA_ID, titulo: 'Canción 2', artista: 'Artista 2' },
          restanteMs: 3000,
          duracionMs: 4000
        }
      })
    )
    expect(screen.getByTestId('cuenta-transicion')).toBeInTheDocument()
    expect(motores[0]!.motor.destruir).toHaveBeenCalled()
  })
})
