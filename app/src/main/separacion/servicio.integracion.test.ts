import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TrabajoIpc } from '../../shared'
import { ServicioBiblioteca } from '../biblioteca'
import { GestorTrabajos } from '../trabajos'
import { crearClienteWorker, resolverLanzador } from '../trabajos/worker'
import { entornoSeparadorFalso, ServicioSeparacion } from './servicio'
import { cancionConFuente, configEnMemoria, manifiesto, nuevoDirDatos } from './servicio.testutil'

/* Servicio de separación + gestor + worker real con el separador falso (0060). Se omite sin uv. */

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
  datos = await nuevoDirDatos()
})
afterEach(() => rm(datos, { recursive: true, force: true }))

const esperarHasta = async (cond: () => boolean, ms = 60_000): Promise<void> => {
  const fin = Date.now() + ms
  while (!cond()) {
    if (Date.now() > fin) throw new Error('tiempo agotado')
    await new Promise((r) => setTimeout(r, 25))
  }
}

/** FLAC PCM 16, 44,1 kHz, estéreo (lo que exige `separar`), generado con el Python del worker. */
function crearFlac(ruta: string): void {
  execFileSync(
    uv,
    [
      'run',
      '--project',
      join(raizRepo, 'worker'),
      'python',
      '-c',
      'import sys, numpy as np, soundfile as sf; sf.write(sys.argv[1], np.zeros((44100, 2)), 44100, subtype="PCM_16", format="FLAC")',
      ruta
    ],
    { stdio: 'ignore' }
  )
}

describe.skipIf(!hayUv())('servicio de separación con el worker real y el separador falso', () => {
  it('dos canciones: la segunda espera en la cola pesada hasta que termina la primera', async () => {
    const escenario = join(datos, 'escenario.json')
    await writeFile(escenario, JSON.stringify({ segundos: 1.5, pasos: 5 }))
    await mkdir(join(datos, 'modelos'), { recursive: true })
    await writeFile(join(datos, 'modelos', 'vocals_mel_band_roformer.ckpt'), 'x')
    await writeFile(join(datos, 'modelos', 'vocals_mel_band_roformer.yaml'), 'x')

    const lanzador = resolverLanzador({ modo: 'desarrollo', raizRepo, uv })
    const cliente = crearClienteWorker({
      lanzador: {
        ...lanzador,
        env: {
          ...lanzador.env,
          ...entornoSeparadorFalso({ SHINOBI_SEPARADOR_FALSO: escenario }, false)
        }
      },
      dirRegistros: join(datos, 'registros'),
      esperaKillMs: 3000
    })
    const biblioteca = new ServicioBiblioteca(datos)
    const gestor = new GestorTrabajos({ biblioteca, ejecutar: cliente.ejecutar })
    const config = configEnMemoria()
    const servicio = new ServicioSeparacion({
      biblioteca,
      gestor,
      config,
      manifiesto: () => manifiesto,
      dirDatos: datos,
      estimarSeparacion: () => null
    })
    const a = await cancionConFuente(biblioteca, datos, { duracionMs: 1000 })
    const b = await cancionConFuente(biblioteca, datos, { duracionMs: 1000 })
    crearFlac(join(datos, 'biblioteca', a, 'fuente', 'mezcla.flac'))
    crearFlac(join(datos, 'biblioteca', b, 'fuente', 'mezcla.flac'))
    const cambios: TrabajoIpc[] = []
    gestor.suscribir((t) => cambios.push(t))

    await servicio.separar(a)
    await servicio.separar(b)
    const segundo = gestor.listar().find((t) => t.cancionId === b)!
    expect(segundo).toMatchObject({ estado: 'en_cola', posicion: 1 })
    expect(biblioteca.obtener(b)!.pasos.separacion.estado).toBe('pendiente')

    await esperarHasta(() => !gestor.hayPendientes())
    // El segundo no empezó hasta que terminó el primero.
    const finPrimero = cambios.findIndex((t) => t.cancionId === a && t.estado === 'terminado')
    const iniSegundo = cambios.findIndex((t) => t.cancionId === b && t.estado === 'en_curso')
    expect(finPrimero).toBeGreaterThanOrEqual(0)
    expect(iniSegundo).toBeGreaterThan(finPrimero)

    for (const id of [a, b]) {
      const c = biblioteca.obtener(id)!
      expect(c.pasos.separacion).toMatchObject({ estado: 'completado', error: null })
      expect(c.pistas).toMatchObject({ voz: 'pistas/voz.flac', modelo: { version: 'falso' } })
      expect(existsSync(join(datos, 'biblioteca', id, 'pistas', 'instrumental.flac'))).toBe(true)
      expect(existsSync(join(datos, 'biblioteca', id, 'pistas.tmp'))).toBe(false)
      expect(biblioteca.obtenerResumen(id)?.danada).toBe(false)
    }
    expect(config.obtener().separacion.factores_medidos.calidad).toBeGreaterThan(0)
    servicio.cerrar()
    await biblioteca.flushTodo()
  }, 120_000)

  it('memoria con CUDA: 3 intentos (cuda, cuda pequeños, cpu pequeños) con SHINOBI_INTENTO por intento', async () => {
    const escenario = join(datos, 'escenario.json')
    // Falla mientras sea CUDA (intentos 1 y 2); en CPU termina.
    await writeFile(
      escenario,
      JSON.stringify({
        segundos: 0.2,
        pasos: 2,
        fallos: [
          { cuando: { dispositivo: 'cuda' }, codigo: 'MEMORIA_INSUFICIENTE', reintentable: true }
        ]
      })
    )
    await mkdir(join(datos, 'modelos'), { recursive: true })
    await writeFile(join(datos, 'modelos', 'vocals_mel_band_roformer.ckpt'), 'x')
    await writeFile(join(datos, 'modelos', 'vocals_mel_band_roformer.yaml'), 'x')
    const lanzador = resolverLanzador({ modo: 'desarrollo', raizRepo, uv })
    const cliente = crearClienteWorker({
      lanzador: {
        ...lanzador,
        env: {
          ...lanzador.env,
          ...entornoSeparadorFalso({ SHINOBI_SEPARADOR_FALSO: escenario }, false)
        }
      },
      dirRegistros: join(datos, 'registros'),
      esperaKillMs: 3000
    })
    const biblioteca = new ServicioBiblioteca(datos)
    const gestor = new GestorTrabajos({ biblioteca, ejecutar: cliente.ejecutar })
    const config = configEnMemoria({ instalacion: { perfil_hardware: 'cuda' } })
    const servicio = new ServicioSeparacion({
      biblioteca,
      gestor,
      config,
      manifiesto: () => manifiesto,
      dirDatos: datos,
      estimarSeparacion: () => null,
      intentoEnEntorno: true
    })
    const id = await cancionConFuente(biblioteca, datos, { duracionMs: 1000 })
    crearFlac(join(datos, 'biblioteca', id, 'fuente', 'mezcla.flac'))
    const motivos: unknown[] = []
    gestor.suscribirProgreso((p) => {
      if (p.fase === 'reintentando') motivos.push((p.detalle as { motivo: string }).motivo)
    })
    await servicio.separar(id)
    await esperarHasta(() => !gestor.hayPendientes())
    expect(motivos).toEqual(['memoria', 'memoria_cpu'])
    expect(biblioteca.obtener(id)!.pasos.separacion).toMatchObject({ estado: 'completado' })
    expect(config.obtener().separacion.factores_medidos.calidad).toBeUndefined()
    servicio.cerrar()
    await biblioteca.flushTodo()
  }, 120_000)
})
