import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIXTURES } from '../../shared/__fixtures__'
import type { EventoProgresoIpc, TrabajoIpc } from '../../shared'
import { ServicioBiblioteca } from '../biblioteca'
import { GestorTrabajos } from './gestor'
import { procesosCon } from './procesosCon.testutil'
import { crearClienteWorker, resolverLanzador } from './worker'

/* Gestor + ServicioBiblioteca real + worker real (comando `demo`). Se omite sin uv. */

const raizRepo = resolve(__dirname, '..', '..', '..', '..')
const uv = process.env.SHINOBI_UV ?? 'uv'
function hayUv(): boolean {
  try {
    execFileSync(uv, ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

let datos: string
beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-gestor-'))
  await mkdir(join(datos, 'biblioteca'), { recursive: true })
})
afterEach(() => rm(datos, { recursive: true, force: true }))

const esperarHasta = async (cond: () => boolean, ms = 30_000): Promise<void> => {
  const fin = Date.now() + ms
  while (!cond()) {
    if (Date.now() > fin) throw new Error('tiempo agotado')
    await new Promise((r) => setTimeout(r, 25))
  }
}

describe.skipIf(!hayUv())('gestor de trabajos con el worker real (demo)', () => {
  async function montar() {
    const biblioteca = new ServicioBiblioteca(datos)
    const b = FIXTURES.borradorRecienCreado()
    const { id } = await biblioteca.crear({ metadatos: b.metadatos, fuente: b.fuente })
    const cliente = crearClienteWorker({
      lanzador: resolverLanzador({ modo: 'desarrollo', raizRepo, uv }),
      dirRegistros: join(datos, 'registros'),
      esperaKillMs: 3000
    })
    const gestor = new GestorTrabajos({ biblioteca, ejecutar: cliente.ejecutar })
    const cambios: TrabajoIpc[] = []
    const progresos: EventoProgresoIpc[] = []
    gestor.suscribir((t) => cambios.push(t))
    gestor.suscribirProgreso((p) => progresos.push(p))
    return { biblioteca, id, gestor, cambios, progresos }
  }

  it('demo completo: paso completado y progreso persistido', async () => {
    const { biblioteca, id, gestor, progresos } = await montar()
    gestor.encolar({
      cancionId: id,
      paso: 'separacion',
      cola: 'pesada',
      comando: 'demo',
      args: { segundos: 1, indeterminado_s: 0.2 }
    })
    await esperarHasta(() => !gestor.hayPendientes())
    expect(biblioteca.obtener(id)?.pasos.separacion).toMatchObject({
      estado: 'completado',
      error: null
    })
    expect(progresos.some((p) => p.fase === 'procesando')).toBe(true)
    expect(progresos.at(-1)?.valor).toBe(1)
    await biblioteca.flushTodo()
  }, 90_000)

  it('DEMO_FALLO deja el paso en error', async () => {
    const { biblioteca, id, gestor } = await montar()
    gestor.encolar({
      cancionId: id,
      paso: 'fuente',
      cola: 'ligera',
      comando: 'demo',
      args: { segundos: 1, fallar_en: 0.5 }
    })
    await esperarHasta(() => !gestor.hayPendientes())
    expect(biblioteca.obtener(id)?.pasos.fuente).toMatchObject({
      estado: 'error',
      error: { codigo: 'DEMO_FALLO' }
    })
    await biblioteca.flushTodo()
  }, 90_000)

  it('cierre con trabajos: cancela todo, pasos interrumpidos y ningún proceso hijo vivo', async () => {
    const { biblioteca, id, gestor, cambios } = await montar()
    const parcial = join(datos, 'parcial.tmp')
    const parcial2 = join(datos, 'parcial2.tmp')
    gestor.encolar({
      cancionId: id,
      paso: 'separacion',
      cola: 'pesada',
      comando: 'demo',
      args: { segundos: 60, ruta_parcial: parcial },
      alDescartar: () => rm(parcial, { force: true })
    })
    gestor.encolar({
      cancionId: id,
      paso: 'fuente',
      cola: 'ligera',
      comando: 'demo',
      args: { segundos: 60, ruta_parcial: parcial2 }
    })
    await esperarHasta(() => existsSync(parcial) && existsSync(parcial2))
    expect(gestor.hayPendientes()).toBe(true)
    await gestor.cancelarTodos()
    expect(gestor.hayPendientes()).toBe(false)
    expect(existsSync(parcial)).toBe(false)
    expect(cambios.filter((c) => c.estado === 'terminado').map((c) => c.resultado)).toEqual(
      expect.arrayContaining(['interrumpido', 'interrumpido'])
    )
    const pasos = biblioteca.obtener(id)!.pasos
    expect(pasos.separacion.estado).toBe('interrumpido')
    expect(pasos.fuente.estado).toBe('interrumpido')
    await new Promise((r) => setTimeout(r, 300))
    expect(procesosCon(parcial)).toBe(0)
    expect(procesosCon(parcial2)).toBe(0)
    await biblioteca.flushTodo()
  }, 90_000)
})
