import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ejecutar as ejecutarWorker } from '../trabajos/worker'
import { ServicioPicos } from './servicio'

const id = '5eed0000-0000-4000-8000-000000000001'
const otroId = '5eed0000-0000-4000-8000-000000000002'
const fixture = fileURLToPath(
  new URL('../../../../worker/tests/fixtures/picos-v1.bin', import.meta.url)
)
const peticion = { cancionId: id, inicioMs: 0, finMs: 25, presupuesto: 3 }

describe('ServicioPicos', () => {
  let biblioteca: string
  let pistas: string
  let servicio: ServicioPicos
  const ejecutar = vi.fn<typeof ejecutarWorker>(async (_comando, args) => {
    await copyFile(fixture, args.salida as string)
    return {}
  })

  beforeEach(async () => {
    ejecutar.mockClear()
    biblioteca = await mkdtemp(join(tmpdir(), 'shinobi-picos-'))
    pistas = join(biblioteca, id, 'pistas')
    await mkdir(pistas, { recursive: true })
    await writeFile(join(pistas, 'voz.flac'), 'voz de prueba')
    servicio = new ServicioPicos({ dirBiblioteca: biblioteca, tieneVoz: () => true, ejecutar })
  })

  afterEach(async () => {
    await servicio.cerrar()
    await rm(biblioteca, { force: true, recursive: true })
  })

  async function esperarLista(): Promise<string> {
    return vi.waitFor(async () => {
      const estado = await servicio.solicitar(id)
      if (estado.estado !== 'lista') throw new Error(`Caché aún no disponible: ${estado.estado}`)
      return estado.generacion
    })
  }

  it('deduplica solicitudes, reutiliza la caché y lee solo el nivel y rango pedidos', async () => {
    await Promise.all([servicio.solicitar(id), servicio.solicitar(id), servicio.solicitar(id)])
    const generacion = await esperarLista()
    const completa = await servicio.leer(peticion)
    expect(completa).toEqual({
      generacion,
      primerBloque: 0,
      pasoMs: 10,
      bytes: new Uint8Array((await readFile(fixture)).subarray(24, 36))
    })
    expect(await servicio.leer({ ...peticion, inicioMs: 11, finMs: 20 })).toEqual({
      generacion,
      primerBloque: 1,
      pasoMs: 10,
      bytes: completa?.bytes.slice(4, 8)
    })
    expect(await servicio.leer({ ...peticion, inicioMs: 20 })).toMatchObject({
      primerBloque: 2,
      pasoMs: 10
    })
    expect(await servicio.leer({ ...peticion, presupuesto: 1 })).toMatchObject({
      primerBloque: 0,
      pasoMs: 40,
      bytes: new Uint8Array((await readFile(fixture)).subarray(44, 48))
    })
    expect(await servicio.leer({ ...peticion, inicioMs: 21 })).toBeNull()
    await servicio.cerrar()
    servicio = new ServicioPicos({ dirBiblioteca: biblioteca, tieneVoz: () => true, ejecutar })
    expect(await servicio.solicitar(id)).toEqual({ estado: 'lista', generacion })
    expect(ejecutar).toHaveBeenCalledTimes(1)
  })

  it.each(['truncada', 'versión desconocida'])('regenera una caché %s', async (tipo) => {
    const generacion = await esperarLista()
    const cache = join(pistas, `.picos-voz-v1-${generacion}.bin`)
    const bytes = await readFile(fixture)
    if (tipo === 'versión desconocida') bytes.writeUInt16LE(2, 4)
    await writeFile(cache, tipo === 'truncada' ? bytes.subarray(0, -1) : bytes)
    expect(await servicio.leer(peticion)).toBeNull()
    expect(await esperarLista()).toBe(generacion)
    expect(ejecutar).toHaveBeenCalledTimes(2)
  })

  it('deja reintentar un fallo del worker sin tocar la pista ni publicar un temporal', async () => {
    ejecutar.mockImplementationOnce(async (_comando, args) => {
      await writeFile(args.salida as string, 'parcial')
      throw new Error('Motor no disponible')
    })
    await servicio.solicitar(id)
    await vi.waitFor(async () => expect(await servicio.solicitar(id)).toEqual({ estado: 'error' }))
    await vi.waitFor(async () => expect(await readdir(pistas)).toEqual(['voz.flac']))
    expect(ejecutar).toHaveBeenCalledTimes(1)
    await servicio.solicitar(id, true)
    await esperarLista()
    expect(ejecutar).toHaveBeenCalledTimes(2)
    expect(await readFile(join(pistas, 'voz.flac'), 'utf8')).toBe('voz de prueba')
  })

  it('descarta una generación si la pista se reemplaza mientras trabaja', async () => {
    let terminar!: () => void
    const listo = new Promise<void>((resolve) => {
      terminar = resolve
    })
    ejecutar.mockImplementationOnce(async (_comando, args) => {
      await copyFile(fixture, args.salida as string)
      await listo
      return {}
    })
    await servicio.solicitar(id)
    await vi.waitFor(() => expect(ejecutar).toHaveBeenCalledTimes(1))
    const nuevo = join(pistas, 'voz-nueva')
    await writeFile(nuevo, 'voz sustituida')
    await rename(nuevo, join(pistas, 'voz.flac'))
    terminar()
    await esperarLista()
    expect(ejecutar).toHaveBeenCalledTimes(2)
    expect((await readdir(pistas)).filter((nombre) => nombre.startsWith('.picos'))).toHaveLength(1)
  })

  it('cancela y espera antes de borrar y no inicia otra canción hasta liberar el turno', async () => {
    const otrasPistas = join(biblioteca, otroId, 'pistas')
    await mkdir(otrasPistas, { recursive: true })
    await writeFile(join(otrasPistas, 'voz.flac'), 'otra voz de prueba')
    ejecutar.mockImplementationOnce(async (_comando, args, opciones) => {
      const señal = opciones?.señal as AbortSignal
      const cancelado = new Promise<void>((resolver) =>
        señal.addEventListener('abort', () => resolver(), { once: true })
      )
      await copyFile(fixture, args.salida as string)
      await cancelado
      return {}
    })
    await servicio.solicitar(id)
    await vi.waitFor(() => expect(ejecutar).toHaveBeenCalledTimes(1))
    expect(await servicio.solicitar(otroId)).toEqual({ estado: 'generando' })
    expect(ejecutar).toHaveBeenCalledTimes(1)

    await servicio.duranteCambio(id, async () => {
      expect(await servicio.solicitar(id)).toEqual({ estado: 'no_disponible' })
      expect(await readdir(pistas)).toEqual(['voz.flac'])
      await rm(join(biblioteca, id), { recursive: true })
    })
    expect(await servicio.solicitar(id)).toEqual({ estado: 'no_disponible' })
    expect(await readdir(biblioteca)).toEqual([otroId])
    await vi.waitFor(async () =>
      expect(await servicio.solicitar(otroId)).toMatchObject({ estado: 'lista' })
    )
  })
})
