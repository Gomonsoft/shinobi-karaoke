import { mkdtemp, mkdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CADUCIDAD_DESTINO_MS, Destinos, discoReal, type PuertosDestinos } from './destinos'

let raiz: string
let datos: string
let videos: string
let ahora: number
let eleccion: string | null

const cancion = { titulo: 'Canción', artista: 'Artista' }

function crear(extra: Partial<PuertosDestinos> = {}): Destinos {
  return new Destinos({
    directorioDatos: datos,
    carpetaVideos: () => videos,
    carpetaHogar: () => raiz,
    dialogoGuardar: async () => eleccion,
    ahora: () => ahora,
    ...extra
  })
}

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'shinobi-dest-'))
  datos = join(raiz, 'datos')
  videos = join(raiz, 'videos')
  await mkdir(datos)
  await mkdir(videos)
  ahora = 1000
  eleccion = null
})
afterEach(() => rm(raiz, { recursive: true, force: true }))

describe('destinoPropuesto', () => {
  it('usa la carpeta recordada, o videos si no existe', async () => {
    const otra = join(raiz, 'otra')
    await mkdir(otra)
    const d = crear()
    const a = await d.destinoPropuesto(cancion, 'mkv_av1', otra)
    expect(a.ruta).toBe(join(otra, 'Canción — Artista (karaoke).mkv'))
    expect(a.carpetaRecordadaNoDisponible).toBe(false)
    expect(a.existe).toBe(false)
    expect(a.libreBytes).toBeGreaterThan(0)
    const b = await d.destinoPropuesto(cancion, 'webm_vp9', join(raiz, 'no-existe'))
    expect(b.ruta).toBe(join(videos, 'Canción — Artista (karaoke).webm'))
    expect(b.carpetaRecordadaNoDisponible).toBe(true)
  })

  it('no propone una carpeta dentro de los datos', async () => {
    const r = await crear().destinoPropuesto(cancion, 'mkv_av1', datos)
    expect(r.ruta.startsWith(videos)).toBe(true)
    expect(r.carpetaRecordadaNoDisponible).toBe(true)
  })

  it('desdeDestinoId conserva carpeta y nombre y cambia la extensión; el anterior caduca', async () => {
    const d = crear()
    const a = await d.destinoPropuesto(cancion, 'mkv_av1', null)
    eleccion = join(videos, 'Mi versión.mkv')
    const elegido = (await d.elegirDestino(a.destinoId, null))!
    const b = await d.destinoPropuesto(cancion, 'webm_vp9', null, elegido.destinoId)
    expect(b.ruta).toBe(join(videos, 'Mi versión.webm'))
    expect(b.destinoId).not.toBe(elegido.destinoId)
    const c = await d.destinoPropuesto(cancion, 'mkv_av1', null, elegido.destinoId)
    expect(c.ruta).toBe(join(videos, 'Canción — Artista (karaoke).mkv'))
  })
})

describe('elegirDestino y consumir', () => {
  it('cancelar devuelve null y el destinoId sigue valiendo', async () => {
    const d = crear()
    const a = await d.destinoPropuesto(cancion, 'mkv_av1', null)
    expect(await d.elegirDestino(a.destinoId, null)).toBeNull()
    expect(await d.consumir(a.destinoId)).toBe(a.ruta)
  })

  it('fuerza la extensión del formato', async () => {
    const d = crear()
    const a = await d.destinoPropuesto(cancion, 'mkv_av1', null)
    eleccion = join(videos, 'x.avi')
    expect((await d.elegirDestino(a.destinoId, null))!.ruta).toBe(join(videos, 'x.avi.mkv'))
    const b = await d.destinoPropuesto(cancion, 'mkv_av1', null)
    eleccion = join(videos, 'y.WEBM')
    expect((await d.elegirDestino(b.destinoId, null))!.ruta).toBe(join(videos, 'y.mkv'))
  })

  it('rechaza destinos dentro de los datos o en carpetas inexistentes', async () => {
    const d = crear()
    const a = await d.destinoPropuesto(cancion, 'mkv_av1', null)
    eleccion = join(datos, 'x.mkv')
    await expect(d.elegirDestino(a.destinoId, null)).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
    eleccion = join(videos, 'no-hay', 'x.mkv')
    await expect(d.elegirDestino(a.destinoId, null)).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
  })

  it('rechaza nombres reservados en Windows', async () => {
    const d = crear({ plataforma: 'win32', directorioDatos: 'C:\\no\\datos' })
    const a = await d.destinoPropuesto(cancion, 'mkv_av1', null)
    eleccion = join(videos, 'NUL.mkv')
    await expect(d.elegirDestino(a.destinoId, null)).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
  })

  it('el destinoId es de un solo uso y caduca a los 30 min', async () => {
    const d = crear()
    const a = await d.destinoPropuesto(cancion, 'mkv_av1', null)
    await d.consumir(a.destinoId)
    await expect(d.consumir(a.destinoId)).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
    const b = await d.destinoPropuesto(cancion, 'mkv_av1', null)
    ahora += CADUCIDAD_DESTINO_MS
    await expect(d.consumir(b.destinoId)).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
  })
})

describe('temporal y sustitución', () => {
  it('rutaTemporal queda junto al destino', () => {
    const t = crear().rutaTemporal(join(videos, 'a.mkv'), 'abcdef12-3456')
    expect(t).toBe(join(videos, '.a.mkv.abcdef12.shinobi-parcial'))
  })

  it('el éxito sustituye el archivo previo', async () => {
    const d = crear()
    const destino = join(videos, 'a.mkv')
    const temporal = d.rutaTemporal(destino, 'trabajo1')
    await writeFile(destino, 'viejo')
    await writeFile(temporal, 'nuevo')
    await d.sustituir(temporal, destino)
    expect(await readFile(destino, 'utf8')).toBe('nuevo')
    await expect(stat(temporal)).rejects.toThrow()
  })

  it('un fallo del rename borra el temporal y deja el anterior intacto', async () => {
    const destino = join(videos, 'a.mkv')
    const d = crear({
      disco: {
        ...discoReal,
        renombrar: async () => {
          throw Object.assign(new Error('x'), { code: 'EBUSY' })
        }
      }
    })
    const temporal = d.rutaTemporal(destino, 'trabajo1')
    await writeFile(destino, 'viejo')
    const fecha = new Date('2020-01-01T00:00:00Z')
    await utimes(destino, fecha, fecha)
    await writeFile(temporal, 'nuevo')
    await expect(d.sustituir(temporal, destino)).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
    expect(await readFile(destino, 'utf8')).toBe('viejo')
    expect((await stat(destino)).mtime).toEqual(fecha)
    await expect(stat(temporal)).rejects.toThrow()
  })

  it('limpiar falla con LIMPIEZA_FALLIDA y la ruta', async () => {
    const d = crear({
      disco: {
        ...discoReal,
        borrar: async () => {
          throw new Error('bloqueado')
        }
      }
    })
    await expect(d.limpiar('/x/.a.parcial')).rejects.toMatchObject({
      codigo: 'LIMPIEZA_FALLIDA',
      detalles: '/x/.a.parcial'
    })
  })
})
