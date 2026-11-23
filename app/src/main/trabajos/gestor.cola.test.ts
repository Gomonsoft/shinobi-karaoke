import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiarioPendientes } from './diario'
import { GestorTrabajos, type EjecutarWorker } from './gestor'

/** Worker falso: cada llamada queda a la espera; se resuelve a mano o al cancelarla. */
function workerFalso() {
  const llamadas: { comando: string; args: Record<string, unknown>; resolver: () => void }[] = []
  const ejecutar: EjecutarWorker = (comando, args, opciones) =>
    new Promise((resolver, rechazar) => {
      llamadas.push({ comando, args, resolver: () => resolver({}) })
      opciones.señal?.addEventListener('abort', () =>
        setTimeout(() => rechazar({ codigo: 'CANCELADO', mensaje: 'x' }), 1)
      )
    })
  return { ejecutar, llamadas }
}
const biblioteca = { actualizar: vi.fn(() => Promise.resolve({})) }
const pet = (cancionId: string, comando: string, paso: 'fuente' | 'separacion' = 'separacion') => ({
  cancionId,
  paso,
  cola: paso === 'separacion' ? ('pesada' as const) : ('ligera' as const),
  comando,
  args: {}
})
const reposo = (ms = 15) => new Promise((r) => setTimeout(r, ms))

let carpeta: string | null = null
afterEach(async () => {
  if (carpeta) await rm(carpeta, { recursive: true, force: true })
  carpeta = null
  vi.useRealTimers()
})

describe('freno de la cola (pausa y paradas)', () => {
  it('un trabajo retenido no empieza, los demás de su cola sí, y reanudarCola lo lanza', async () => {
    const w = workerFalso()
    const gestor = new GestorTrabajos({ biblioteca, ejecutar: w.ejecutar })
    gestor.fijarFreno((t) => t.cancionId === 'a')
    gestor.encolar(pet('a', 'separar'))
    gestor.encolar(pet('b', 'separar'))
    await reposo()
    expect(w.llamadas).toHaveLength(1)
    expect(gestor.listar().find((t) => t.cancionId === 'a')?.estado).toBe('en_cola')
    // La del medio termina y la retenida sigue esperando.
    w.llamadas[0]!.resolver()
    await reposo()
    expect(w.llamadas).toHaveLength(1)
    gestor.fijarFreno(null)
    gestor.reanudarCola()
    await reposo()
    expect(w.llamadas).toHaveLength(2)
  })

  it('con todo retenido (pausa) deja terminar el trabajo en curso y no lanza más', async () => {
    const w = workerFalso()
    const gestor = new GestorTrabajos({ biblioteca, ejecutar: w.ejecutar })
    gestor.encolar(pet('a', 'separar'))
    gestor.encolar(pet('b', 'separar'))
    await reposo()
    gestor.fijarFreno(() => true)
    w.llamadas[0]!.resolver()
    await reposo()
    expect(w.llamadas).toHaveLength(1)
    gestor.fijarFreno(null)
    gestor.reanudarCola()
    await reposo()
    expect(w.llamadas).toHaveLength(2)
  })
})

describe('pausa entre descargas de YouTube', () => {
  it('espera entre dos descargas seguidas y no antes de la primera', async () => {
    vi.useFakeTimers()
    const w = workerFalso()
    const gestor = new GestorTrabajos({
      biblioteca,
      ejecutar: w.ejecutar,
      pausaEntreDescargasMs: () => 5000
    })
    gestor.encolar(pet('a', 'descargar-youtube', 'fuente'))
    await vi.advanceTimersByTimeAsync(10)
    expect(w.llamadas).toHaveLength(1)
    gestor.encolar(pet('b', 'descargar-youtube', 'fuente'))
    w.llamadas[0]!.resolver()
    await vi.advanceTimersByTimeAsync(4000)
    expect(w.llamadas).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1500)
    expect(w.llamadas).toHaveLength(2)
  })
})

describe('cerrar justo después de empezar', () => {
  it('cancelar con motivo cierre un trabajo recién lanzado lo termina, escribe `interrumpido` y conserva el diario', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shinobi-diario-'))
    carpeta = dir
    const diario = new DiarioPendientes(dir)
    await diario.cargar()
    const pasos: string[] = []
    const w = workerFalso()
    const gestor = new GestorTrabajos({
      biblioteca: {
        actualizar: (_id: string, c) => {
          const e = (c.pasos as Record<string, { estado?: string }> | undefined)?.separacion?.estado
          if (e) pasos.push(e)
          return Promise.resolve({})
        }
      },
      ejecutar: w.ejecutar,
      diario
    })
    gestor.encolar(pet('a', 'separar'))
    gestor.encolar(pet('b', 'separar'))
    // Sin dejar que el worker llegue a arrancar: el cierre llega en cuanto el trabajo sale de la cola.
    await gestor.cancelarTodos()
    expect(gestor.listar()).toEqual([])
    expect(pasos.at(-1)).toBe('interrumpido')
    await diario.vaciar()
    const siguiente = new DiarioPendientes(dir)
    await siguiente.cargar()
    expect(siguiente.tomarHeredadas().map((e) => e.cancionId)).toStrictEqual(['a', 'b'])
  })
})

describe('diario de pendientes', () => {
  const nuevo = async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'shinobi-diario-'))
    return carpeta
  }
  const leer = async (dir: string) =>
    JSON.parse(await readFile(join(dir, 'trabajos', 'pendientes.json'), 'utf8')) as {
      cancionId: string
      tipo: string
      orden: number
      interrupciones: number
      enCurso: boolean
    }[]

  it('anota lo encolado y en curso, y lo quita al terminar', async () => {
    const dir = await nuevo()
    const diario = new DiarioPendientes(dir)
    await diario.cargar()
    const w = workerFalso()
    const gestor = new GestorTrabajos({ biblioteca, ejecutar: w.ejecutar, diario })
    gestor.encolar(pet('a', 'separar'))
    gestor.encolar(pet('b', 'separar'))
    await reposo()
    await diario.vaciar()
    expect(await leer(dir)).toMatchObject([
      { cancionId: 'a', tipo: 'separacion', orden: 0, enCurso: true },
      { cancionId: 'b', tipo: 'separacion', orden: 1, enCurso: false }
    ])
    w.llamadas[0]!.resolver()
    await reposo()
    await diario.vaciar()
    expect((await leer(dir)).map((e) => e.cancionId)).toStrictEqual(['b'])
  })

  it('cerrar la app conserva lo pendiente; cancelar a mano lo quita', async () => {
    const dir = await nuevo()
    const diario = new DiarioPendientes(dir)
    await diario.cargar()
    const w = workerFalso()
    const gestor = new GestorTrabajos({ biblioteca, ejecutar: w.ejecutar, diario })
    const a = gestor.encolar(pet('a', 'separar'))
    gestor.encolar(pet('b', 'separar'))
    const c = gestor.encolar(pet('c', 'separar'))
    await reposo()
    await gestor.cancelar(c.id)
    await gestor.cancelarTodos()
    await diario.vaciar()
    expect(a.cancionId).toBe('a')
    expect(await leer(dir)).toMatchObject([
      { cancionId: 'a', enCurso: true },
      { cancionId: 'b', enCurso: false }
    ])
    // Una sesión nueva lo recibe en su orden.
    const siguiente = new DiarioPendientes(dir)
    await siguiente.cargar()
    expect(siguiente.tomarHeredadas().map((e) => e.cancionId)).toStrictEqual(['a', 'b'])
  })
})
