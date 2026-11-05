import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventoProgresoIpc, TrabajoIpc } from '../../shared'
import type { CambioCancion } from '../biblioteca'
import { GestorTrabajos, INTERVALO_PROGRESO_MS, type EjecutarWorker } from './gestor'

type Mensaje = Parameters<NonNullable<Parameters<EjecutarWorker>[2]['alProgreso']>>[0]

/** Worker falso: cada llamada queda a la espera de que el test la resuelva, falle o la cancelen. */
function crearWorkerFalso() {
  interface Llamada {
    comando: string
    args: Record<string, unknown>
    alProgreso: (m: Mensaje) => void
    resolver: (datos?: Record<string, unknown>) => void
    fallar: (e: { codigo: string; mensaje: string }) => void
    cancelada: () => boolean
  }
  const llamadas: Llamada[] = []
  const vivas = new Set<Llamada>()
  const ejecutar: EjecutarWorker = (comando, args, opciones) =>
    new Promise((resolver, rechazar) => {
      const llamada: Llamada = {
        comando,
        args,
        alProgreso: (m) => opciones.alProgreso?.(m),
        resolver: (d = {}) => (vivas.delete(llamada), resolver(d)),
        fallar: (e) => (vivas.delete(llamada), rechazar({ ...e, reintentable: false })),
        cancelada: () => opciones.señal?.aborted === true
      }
      llamadas.push(llamada)
      vivas.add(llamada)
      opciones.señal?.addEventListener('abort', () => {
        // El proceso muere un poco después, como en el cliente real.
        setTimeout(() => {
          vivas.delete(llamada)
          rechazar({ codigo: 'CANCELADO', mensaje: 'Trabajo cancelado', reintentable: false })
        }, 5)
      })
    })
  return { ejecutar, llamadas, vivas }
}

function crearBiblioteca() {
  const cambios: { id: string; cambio: CambioCancion }[] = []
  return {
    cambios,
    actualizar: vi.fn((id: string, cambio: CambioCancion) => {
      cambios.push({ id, cambio })
      return Promise.resolve({})
    }),
    /** Estados de paso escritos para una canción y paso. */
    estados: (id: string, paso = 'separacion') =>
      cambios
        .filter((c) => c.id === id)
        .map((c) => (c.cambio.pasos as Record<string, { estado?: string }>)[paso]?.estado)
        .filter((e) => e !== undefined)
  }
}

const peticion = (cancionId: string, cola: 'pesada' | 'ligera' = 'pesada', extra = {}) => ({
  cancionId,
  paso: cola === 'pesada' ? ('separacion' as const) : ('fuente' as const),
  cola,
  comando: 'demo',
  args: { cancionId },
  ...extra
})

const reposo = (ms = 20) => new Promise((r) => setTimeout(r, ms))

let worker: ReturnType<typeof crearWorkerFalso>
let bib: ReturnType<typeof crearBiblioteca>
let gestor: GestorTrabajos
let cambios: TrabajoIpc[]

beforeEach(() => {
  worker = crearWorkerFalso()
  bib = crearBiblioteca()
  gestor = new GestorTrabajos({ biblioteca: bib, ejecutar: worker.ejecutar })
  cambios = []
  gestor.suscribir((t) => cambios.push(t))
})
afterEach(() => vi.useRealTimers())

describe('colas', () => {
  it('FIFO con concurrencia 1 por cola y posición en cola', async () => {
    const a = gestor.encolar(peticion('a'))
    const b = gestor.encolar(peticion('b'))
    const c = gestor.encolar(peticion('c'))
    await reposo()
    expect([a.estado, b.estado, c.estado]).toEqual(['en_curso', 'en_cola', 'en_cola'])
    expect(b.posicion).toBe(1)
    expect(c.posicion).toBe(2)
    expect(worker.llamadas.map((l) => l.args.cancionId)).toEqual(['a'])

    worker.llamadas[0]!.resolver()
    await reposo()
    expect(worker.llamadas.map((l) => l.args.cancionId)).toEqual(['a', 'b'])
    expect(gestor.obtener(c.id)?.posicion).toBe(1)
    worker.llamadas[1]!.resolver()
    await reposo()
    worker.llamadas[2]!.resolver()
    await reposo()
    expect(worker.llamadas.map((l) => l.args.cancionId)).toEqual(['a', 'b', 'c'])
    expect(gestor.hayPendientes()).toBe(false)
    expect(bib.estados('c')).toEqual(['en_curso', 'completado'])
  })

  it('una tarea ligera y una pesada corren en paralelo', async () => {
    gestor.encolar(peticion('a', 'pesada'))
    gestor.encolar(peticion('b', 'ligera'))
    gestor.encolar(peticion('c', 'ligera'))
    await reposo()
    expect(worker.llamadas.map((l) => l.args.cancionId)).toEqual(['a', 'b'])
    expect(gestor.listar().map((t) => [t.cancionId, t.estado])).toEqual([
      ['a', 'en_curso'],
      ['b', 'en_curso'],
      ['c', 'en_cola']
    ])
  })
})

describe('estado del paso', () => {
  it('en_curso al empezar y completado al terminar, aplicando el resultado del llamador', async () => {
    const alResultado = vi.fn((d: Record<string, unknown>) => ({
      pistas: { voz: String(d.voz), instrumental: 'pistas/instrumental.flac' }
    })) as unknown as (d: Record<string, unknown>) => CambioCancion
    gestor.encolar(peticion('a', 'pesada', { alResultado }))
    await reposo()
    expect(bib.estados('a')).toEqual(['en_curso'])
    worker.llamadas[0]!.resolver({ voz: 'pistas/voz.flac' })
    await reposo()
    expect(alResultado).toHaveBeenCalledWith({ voz: 'pistas/voz.flac' })
    const ultimo = bib.cambios.at(-1)!.cambio
    expect(ultimo.pistas).toEqual({
      voz: 'pistas/voz.flac',
      instrumental: 'pistas/instrumental.flac'
    })
    expect(ultimo.pasos?.separacion).toMatchObject({ estado: 'completado', error: null })
    expect(cambios.at(-1)).toMatchObject({ estado: 'terminado', resultado: 'completado' })
  })

  it('error del worker -> paso error {codigo, mensaje} y la cola sigue', async () => {
    gestor.encolar(peticion('a'))
    gestor.encolar(peticion('b'))
    await reposo()
    worker.llamadas[0]!.fallar({ codigo: 'DEMO_FALLO', mensaje: 'Fallo simulado' })
    await reposo()
    expect(bib.estados('a')).toEqual(['en_curso', 'error'])
    expect(bib.cambios.at(-2)!.cambio.pasos?.separacion).toMatchObject({
      estado: 'error',
      error: { codigo: 'DEMO_FALLO', mensaje: 'Fallo simulado' }
    })
    expect(cambios.find((t) => t.cancionId === 'a' && t.estado === 'terminado')).toMatchObject({
      resultado: 'error',
      error: { codigo: 'DEMO_FALLO' }
    })
    expect(worker.llamadas).toHaveLength(2)
  })

  it('si alResultado lanza, el paso queda en error', async () => {
    gestor.encolar(
      peticion('a', 'pesada', {
        alResultado: () => {
          throw Object.assign(new Error('mal'), { codigo: 'SIN_ESPACIO' })
        }
      })
    )
    await reposo()
    worker.llamadas[0]!.resolver()
    await reposo()
    expect(bib.estados('a')).toEqual(['en_curso', 'error'])
    expect(bib.cambios.at(-1)!.cambio.pasos?.separacion?.error).toEqual({
      codigo: 'SIN_ESPACIO',
      mensaje: 'mal'
    })
  })

  it('si el servicio rechaza el paso en_curso no se lanza nada', async () => {
    bib.actualizar.mockRejectedValueOnce(new Error('no existe'))
    gestor.encolar(peticion('zzz'))
    await reposo()
    expect(worker.llamadas).toHaveLength(0)
    expect(gestor.hayPendientes()).toBe(false)
    expect(cambios.at(-1)).toMatchObject({ resultado: 'error' })
  })
})

describe('cancelación', () => {
  it('en cola: se retira sin lanzar nada ni tocar la canción', async () => {
    gestor.encolar(peticion('a'))
    const b = gestor.encolar(peticion('b'))
    const c = gestor.encolar(peticion('c'))
    await reposo()
    expect(await gestor.cancelar(b.id)).toBe(true)
    expect(bib.estados('b')).toEqual([])
    expect(gestor.obtener(c.id)?.posicion).toBe(1)
    worker.llamadas[0]!.resolver()
    await reposo()
    expect(worker.llamadas.map((l) => l.args.cancionId)).toEqual(['a', 'c'])
    expect(cambios.find((t) => t.id === b.id && t.estado === 'terminado')?.resultado).toBe(
      'cancelado'
    )
  })

  it('en curso: mata el proceso, descarta el parcial, el paso vuelve a pendiente y sigue el siguiente', async () => {
    const alDescartar = vi.fn()
    const a = gestor.encolar(peticion('a', 'pesada', { alDescartar }))
    gestor.encolar(peticion('b'))
    await reposo()
    await gestor.cancelar(a.id)
    expect(worker.llamadas[0]!.cancelada()).toBe(true)
    expect(alDescartar).toHaveBeenCalledTimes(1)
    expect(bib.estados('a')).toEqual(['en_curso', 'pendiente'])
    await reposo()
    expect(worker.llamadas.map((l) => l.args.cancionId)).toEqual(['a', 'b'])
  })

  it('id desconocido: false', async () => {
    expect(await gestor.cancelar('nada')).toBe(false)
  })

  it('cancelarDeCancion solo afecta a esa canción', async () => {
    gestor.encolar(peticion('a'))
    gestor.encolar(peticion('x'))
    gestor.encolar(peticion('a', 'ligera'))
    await reposo()
    await gestor.cancelarDeCancion('a')
    expect(gestor.listar().map((t) => t.cancionId)).toEqual(['x'])
  })
})

describe('cierre de la app', () => {
  it('hayPendientes refleja trabajos en curso o en cola', async () => {
    expect(gestor.hayPendientes()).toBe(false)
    gestor.encolar(peticion('a'))
    gestor.encolar(peticion('b'))
    expect(gestor.hayPendientes()).toBe(true)
  })

  it('cancelarTodos mata todo, deja los pasos interrumpidos y no admite más trabajos', async () => {
    gestor.encolar(peticion('a'))
    gestor.encolar(peticion('b'))
    gestor.encolar(peticion('c', 'ligera'))
    await reposo()
    await gestor.cancelarTodos()
    expect(worker.vivas.size).toBe(0)
    expect(gestor.hayPendientes()).toBe(false)
    expect(bib.estados('a')).toEqual(['en_curso', 'interrumpido'])
    expect(bib.estados('c', 'fuente')).toEqual(['en_curso', 'interrumpido'])
    expect(bib.estados('b')).toEqual([])
    expect(worker.llamadas).toHaveLength(2)
    expect(() => gestor.encolar(peticion('d'))).toThrow()
  })
})

describe('progreso', () => {
  it('emite como mucho 4 eventos por segundo y no pierde el último valor', async () => {
    vi.useFakeTimers()
    let t = 0
    const w = crearWorkerFalso()
    const g = new GestorTrabajos({ biblioteca: bib, ejecutar: w.ejecutar, ahora: () => t })
    const eventos: EventoProgresoIpc[] = []
    g.suscribirProgreso((e) => eventos.push(e))
    g.encolar(peticion('a'))
    await vi.advanceTimersByTimeAsync(0)
    for (let i = 1; i <= 100; i++) {
      t += 10
      await vi.advanceTimersByTimeAsync(10)
      w.llamadas[0]!.alProgreso({ tipo: 'progreso', fase: 'separando', valor: i / 100 })
    }
    await vi.advanceTimersByTimeAsync(INTERVALO_PROGRESO_MS * 2)
    expect(eventos.length).toBeLessThanOrEqual(5) // 1 s -> ≤ 4 por segundo (+1 de cola final)
    expect(eventos.length).toBeGreaterThanOrEqual(3)
    expect(eventos.at(-1)).toMatchObject({ cancionId: 'a', fase: 'separando', valor: 1 })
    for (let i = 1; i < eventos.length; i++)
      expect(eventos[i]!.valor!).toBeGreaterThanOrEqual(eventos[i - 1]!.valor!)
  })

  it('guarda pasos.<paso>.progreso cada 5 % como mínimo', async () => {
    gestor.encolar(peticion('a'))
    await reposo()
    const w = worker.llamadas[0]!
    for (let i = 1; i <= 100; i++) w.alProgreso({ tipo: 'progreso', fase: 'f', valor: i / 100 })
    await reposo()
    w.resolver()
    await reposo()
    const guardados = bib.cambios
      .map((c) => c.cambio.pasos?.separacion)
      .filter((p) => p && 'progreso' in p && p.estado === undefined)
      .map((p) => p!.progreso as number)
    expect(guardados.length).toBeGreaterThan(3)
    expect(guardados.length).toBeLessThan(25)
    for (let i = 1; i < guardados.length; i++)
      expect(guardados[i]! - guardados[i - 1]!).toBeGreaterThanOrEqual(0.04)
    // Los estados siguen en orden y el progreso se limpia al completar.
    expect(bib.estados('a')).toEqual(['en_curso', 'completado'])
    expect(bib.cambios.at(-1)!.cambio.pasos?.separacion?.progreso).toBeNull()
  })

  it('el evento de progreso incluye ETA solo pasados 15 s de fase determinada', async () => {
    let t = 0
    const w = crearWorkerFalso()
    const g = new GestorTrabajos({ biblioteca: bib, ejecutar: w.ejecutar, ahora: () => t })
    const eventos: EventoProgresoIpc[] = []
    g.suscribirProgreso((e) => eventos.push(e))
    g.encolar(peticion('a'))
    await reposo()
    w.llamadas[0]!.alProgreso({ tipo: 'progreso', fase: 'separando', valor: 0 })
    t += 20_000
    w.llamadas[0]!.alProgreso({ tipo: 'progreso', fase: 'separando', valor: 0.25 })
    await reposo(INTERVALO_PROGRESO_MS + 50)
    expect(eventos[0]!.etaSegundos).toBeNull()
    expect(eventos.at(-1)!.etaSegundos).toBe(60)
    await g.cancelarTodos()
  })
})

describe('yt-dlp: mantenimiento y reintento automático (0050)', () => {
  const descarga = (id: string) => peticion(id, 'ligera', { comando: 'descargar-youtube' })
  const bloqueo = { codigo: 'YOUTUBE_BLOQUEADO', mensaje: 'YouTube bloqueó la descarga' }

  function montarGestor(extra: Record<string, unknown> = {}) {
    const fin: (() => void)[] = []
    let mantenimiento = false
    const g = new GestorTrabajos({
      biblioteca: bib,
      ejecutar: worker.ejecutar,
      mantenimiento: {
        enMantenimiento: () => mantenimiento,
        alTerminarMantenimiento: (cb) => fin.push(cb)
      },
      ...extra
    })
    const vistos: TrabajoIpc[] = []
    g.suscribir((t) => vistos.push(t))
    return {
      g,
      vistos,
      empezar: () => (mantenimiento = true),
      terminar: () => {
        mantenimiento = false
        fin.splice(0).forEach((cb) => cb())
      }
    }
  }

  it('una descarga espera en_cola con motivo mantenimiento y arranca al terminar', async () => {
    const m = montarGestor()
    m.empezar()
    const t = m.g.encolar(descarga('a'))
    await reposo()
    expect(worker.llamadas).toHaveLength(0)
    expect(m.g.obtener(t.id)).toMatchObject({ estado: 'en_cola', motivo: 'mantenimiento' })
    expect(m.vistos.some((v) => v.motivo === 'mantenimiento')).toBe(true)
    m.terminar()
    await reposo()
    expect(worker.llamadas).toHaveLength(1)
    expect(m.g.obtener(t.id)).toMatchObject({ estado: 'en_curso', motivo: null })
    worker.llamadas[0]!.resolver()
    await reposo()
  })

  it('cancelar una descarga que espera el mantenimiento no lanza nada', async () => {
    const m = montarGestor()
    m.empezar()
    const t = m.g.encolar(descarga('a'))
    await reposo()
    await m.g.cancelar(t.id)
    m.terminar()
    await reposo()
    expect(worker.llamadas).toHaveLength(0)
    expect(bib.estados('a', 'fuente')).toEqual([])
  })

  it('los trabajos que no son de yt-dlp no esperan', async () => {
    const m = montarGestor()
    m.empezar()
    m.g.encolar(peticion('a', 'ligera'))
    await reposo()
    expect(worker.llamadas).toHaveLength(1)
    worker.llamadas[0]!.resolver()
    await reposo()
  })

  it('YOUTUBE_BLOQUEADO: emite actualizando, actualiza y relanza una vez sin soltar el puesto', async () => {
    const actualizar = vi.fn(() => Promise.resolve())
    const m = montarGestor({ actualizarYtDlp: actualizar })
    const a = m.g.encolar(descarga('a'))
    const b = m.g.encolar(descarga('b'))
    const progresos: string[] = []
    m.g.suscribirProgreso((p) => progresos.push(p.fase))
    await reposo()
    worker.llamadas[0]!.fallar(bloqueo)
    await reposo(30)
    expect(actualizar).toHaveBeenCalledTimes(1)
    expect(progresos).toContain('actualizando')
    // Relanzada la misma descarga; la siguiente sigue en cola.
    expect(worker.llamadas.map((l) => l.args.cancionId)).toEqual(['a', 'a'])
    expect(m.g.obtener(b.id)?.estado).toBe('en_cola')
    worker.llamadas[1]!.resolver()
    await reposo()
    expect(bib.estados('a', 'fuente')).toEqual(['en_curso', 'completado'])
    expect(m.g.obtener(a.id)).toBeUndefined()
  })

  it('si vuelve a fallar con YOUTUBE_BLOQUEADO termina en error sin un segundo reintento', async () => {
    const actualizar = vi.fn(() => Promise.resolve())
    const m = montarGestor({ actualizarYtDlp: actualizar })
    m.g.encolar(descarga('a'))
    await reposo()
    worker.llamadas[0]!.fallar(bloqueo)
    await reposo(30)
    worker.llamadas[1]!.fallar(bloqueo)
    await reposo(30)
    expect(actualizar).toHaveBeenCalledTimes(1)
    expect(worker.llamadas).toHaveLength(2)
    expect(bib.estados('a', 'fuente')).toEqual(['en_curso', 'error'])
    const ultimo = bib.cambios.at(-1)!.cambio.pasos as Record<string, { error: { codigo: string } }>
    expect(ultimo.fuente!.error.codigo).toBe('YOUTUBE_BLOQUEADO')
  })

  it('si la actualización falla, el trabajo termina con el error original', async () => {
    const m = montarGestor({ actualizarYtDlp: () => Promise.reject(new Error('sin red')) })
    m.g.encolar(descarga('a'))
    await reposo()
    worker.llamadas[0]!.fallar(bloqueo)
    await reposo(30)
    expect(worker.llamadas).toHaveLength(1)
    const ultimo = bib.cambios.at(-1)!.cambio.pasos as Record<string, { error: { codigo: string } }>
    expect(ultimo.fuente!.error.codigo).toBe('YOUTUBE_BLOQUEADO')
  })

  it('cancelar durante actualizando deja el paso pendiente y la actualización sigue', async () => {
    let terminada = false
    let acabar: () => void = () => undefined
    const actualizar = vi.fn(
      () =>
        new Promise<void>((r) => {
          acabar = () => ((terminada = true), r())
        })
    )
    const m = montarGestor({ actualizarYtDlp: actualizar })
    const t = m.g.encolar(descarga('a'))
    await reposo()
    worker.llamadas[0]!.fallar(bloqueo)
    await reposo(30)
    await m.g.cancelar(t.id)
    expect(bib.estados('a', 'fuente')).toEqual(['en_curso', 'pendiente'])
    expect(terminada).toBe(false)
    acabar()
    await reposo()
    expect(worker.llamadas).toHaveLength(1)
  })

  it('los demás comandos no se reintentan', async () => {
    const actualizar = vi.fn(() => Promise.resolve())
    const m = montarGestor({ actualizarYtDlp: actualizar })
    m.g.encolar(peticion('a', 'ligera'))
    await reposo()
    worker.llamadas[0]!.fallar(bloqueo)
    await reposo(30)
    expect(actualizar).not.toHaveBeenCalled()
  })
})
