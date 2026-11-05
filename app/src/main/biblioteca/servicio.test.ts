import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIXTURES } from '../../shared/__fixtures__'
import type { Cancion } from '../../shared'
import { silencioFlac } from './flac'
import { ServicioBiblioteca } from './servicio'

let datos: string
let biblio: string

beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-biblio-'))
  biblio = join(datos, 'biblioteca')
  await mkdir(join(biblio, '.importando'), { recursive: true })
})
afterEach(async () => {
  await rm(datos, { recursive: true, force: true })
})

async function crear(
  id: string,
  cancion: Cancion | string,
  opciones: { pistas?: boolean } = {}
): Promise<string> {
  const carpeta = join(biblio, id)
  await mkdir(join(carpeta, 'pistas'), { recursive: true })
  await writeFile(
    join(carpeta, 'cancion.json'),
    typeof cancion === 'string' ? cancion : JSON.stringify(cancion)
  )
  if (opciones.pistas !== false) {
    await writeFile(join(carpeta, 'pistas', 'voz.flac'), silencioFlac(1))
    await writeFile(join(carpeta, 'pistas', 'instrumental.flac'), silencioFlac(1))
  }
  return carpeta
}

describe('ServicioBiblioteca', () => {
  it('biblioteca vacía', async () => {
    const s = new ServicioBiblioteca(datos)
    expect(await s.escanear()).toEqual([])
    expect(s.obtener('x')).toBeNull()
  })

  it('crea biblioteca/ si no existe', async () => {
    await rm(biblio, { recursive: true })
    expect(await new ServicioBiblioteca(datos).escanear()).toEqual([])
  })

  it('indexa canciones válidas, ordenadas por modificada descendente, e ignora entradas con punto y archivos', async () => {
    const vieja = { ...FIXTURES.lista(), modificada: '2026-01-01T00:00:00Z' }
    const nueva = { ...FIXTURES.listaIncompletaVarias(), modificada: '2026-06-01T00:00:00Z' }
    await crear('a', vieja)
    await crear('b', nueva)
    await mkdir(join(biblio, '.oculta'))
    await writeFile(join(biblio, 'suelto.txt'), 'x')
    const s = new ServicioBiblioteca(datos)
    const lista = await s.escanear()
    expect(lista.map((r) => r.id)).toEqual(['b', 'a'])
    const b = lista[0]!
    expect(b).toMatchObject({
      titulo: 'Canción de prueba',
      duracionMs: 215000,
      estado: 'lista',
      incompleta: true,
      lineasSinSincronizar: 2,
      danada: false,
      motivo: null
    })
    expect(b.estilo).not.toBeNull()
    expect(b.pasos?.separacion.estado).toBe('completado')
    expect(lista[1]!.incompleta).toBe(false)
    expect(s.obtener('a')?.id).toBe(vieja.id)
  })

  it('resume progreso y error de los pasos y la miniatura existente', async () => {
    const c = FIXTURES.conError()
    c.fuente.miniatura = 'fuente/miniatura.jpg'
    const carpeta = await crear('e', c)
    await mkdir(join(carpeta, 'fuente'), { recursive: true })
    await writeFile(join(carpeta, 'fuente', 'miniatura.jpg'), 'x')
    const i = FIXTURES.interrumpida()
    i.fuente.miniatura = 'fuente/falta.jpg'
    await crear('i', i)
    const s = new ServicioBiblioteca(datos)
    await s.escanear()
    const e = s.obtenerResumen('e')!
    expect(e.pasos?.separacion.error?.codigo).toBe('MEMORIA_INSUFICIENTE')
    expect(e.miniatura).toBe(join(carpeta, 'fuente', 'miniatura.jpg'))
    const r = s.obtenerResumen('i')!
    expect(r.pasos?.separacion).toMatchObject({ estado: 'interrumpido', progreso: 0.42 })
    expect(r.miniatura).toBeNull()
  })

  it('JSON ilegible: dañada por json con la carpeta como título, sin cortar el resto', async () => {
    await crear('roto', '{ no es json')
    await crear('bien', FIXTURES.lista())
    const s = new ServicioBiblioteca(datos)
    const lista = await s.escanear()
    expect(lista).toHaveLength(2)
    const roto = s.obtenerResumen('roto')!
    expect(roto).toMatchObject({ titulo: 'roto', danada: true, motivo: 'json' })
    expect(s.obtener('roto')).toBeNull()
    expect(s.obtenerResumen('bien')!.danada).toBe(false)
  })

  it('JSON inválido (esquema) también es dañada; se recupera si hay .bak válido', async () => {
    const carpeta = await crear('inv', {
      ...FIXTURES.lista(),
      estado: 'otro'
    } as unknown as Cancion)
    await crear('rec', '{ roto')
    await writeFile(join(biblio, 'rec', 'cancion.json.bak'), JSON.stringify(FIXTURES.lista()))
    const s = new ServicioBiblioteca(datos)
    await s.escanear()
    expect(s.obtenerResumen('inv')!.motivo).toBe('json')
    expect(s.obtenerResumen('rec')!.danada).toBe(false)
    expect(carpeta).toContain('inv')
  })

  it('separación completada sin pistas: dañada por pistas y sin tocar cancion.json', async () => {
    const carpeta = await crear('p', FIXTURES.lista(), { pistas: false })
    const antes = await readFile(join(carpeta, 'cancion.json'), 'utf8')
    await crear('q', FIXTURES.lista())
    await rm(join(biblio, 'q', 'pistas', 'instrumental.flac'))
    const s = new ServicioBiblioteca(datos)
    await s.escanear()
    expect(s.obtenerResumen('p')).toMatchObject({ danada: true, motivo: 'pistas' })
    expect(s.obtenerResumen('q')).toMatchObject({ danada: true, motivo: 'pistas' })
    expect(s.obtenerResumen('p')!.titulo).toBe('Canción de prueba')
    expect(s.obtener('p')).not.toBeNull()
    expect(await readFile(join(carpeta, 'cancion.json'), 'utf8')).toBe(antes)
  })

  it('dañada por pistas: sinMezcla solo si tampoco existe fuente/mezcla.flac (0070)', async () => {
    await crear('p', FIXTURES.lista(), { pistas: false })
    await crear('q', FIXTURES.lista(), { pistas: false })
    await mkdir(join(biblio, 'q', 'fuente'), { recursive: true })
    await writeFile(join(biblio, 'q', 'fuente', 'mezcla.flac'), 'x')
    const s = new ServicioBiblioteca(datos)
    await s.escanear()
    expect(s.obtenerResumen('p')!.sinMezcla).toBe(true)
    expect(s.obtenerResumen('q')!.sinMezcla).toBeUndefined()
  })

  it('sin separación completada no exige pistas', async () => {
    await crear('n', FIXTURES.borradorRecienCreado(), { pistas: false })
    const s = new ServicioBiblioteca(datos)
    await s.escanear()
    expect(s.obtenerResumen('n')!.danada).toBe(false)
  })

  it('ruta de pistas fuera de la carpeta se trata como pistas ausentes', async () => {
    const c = FIXTURES.lista()
    c.pistas!.voz = '../../x.flac'
    await crear('t', c)
    const s = new ServicioBiblioteca(datos)
    await s.escanear()
    expect(s.obtenerResumen('t')!.motivo).toBe('pistas')
  })

  it('arrancar: en_curso pasa a interrumpido y se guarda; vacía .importando', async () => {
    const carpeta = await crear('s', FIXTURES.separando())
    const d = FIXTURES.descargando()
    await crear('d', d, { pistas: false })
    await mkdir(join(biblio, '.importando', 'u1', 'fuente'), { recursive: true })
    await writeFile(join(biblio, '.importando', 'u1', 'fuente', 'x'), 'x')
    const ahora = new Date('2026-11-04T08:00:00Z')
    const s = new ServicioBiblioteca(datos, { ahora: () => ahora })
    await s.arrancar()

    const r = s.obtenerResumen('s')!
    expect(r.pasos?.separacion).toMatchObject({ estado: 'interrumpido', progreso: 0.42 })
    expect(s.obtenerResumen('d')!.pasos?.fuente.estado).toBe('interrumpido')
    const enDisco = JSON.parse(await readFile(join(carpeta, 'cancion.json'), 'utf8')) as Cancion
    expect(enDisco.pasos.separacion.estado).toBe('interrumpido')
    expect(enDisco.pasos.separacion.actualizado).toBe(ahora.toISOString())
    expect(await readdir(join(biblio, '.importando'))).toEqual([])
  })

  it('escanear sin arrancar no toca los pasos en_curso', async () => {
    await crear('s', FIXTURES.separando())
    const s = new ServicioBiblioteca(datos)
    await s.escanear()
    expect(s.obtenerResumen('s')!.pasos?.separacion.estado).toBe('en_curso')
  })

  it('obtener devuelve copias', async () => {
    await crear('a', FIXTURES.lista())
    const s = new ServicioBiblioteca(datos)
    await s.escanear()
    s.obtener('a')!.metadatos.titulo = 'cambiado'
    expect(s.obtener('a')!.metadatos.titulo).toBe('Canción de prueba')
  })

  it('rendimiento: 300 canciones en menos de 1 s', async () => {
    const base = FIXTURES.lista()
    await Promise.all(
      Array.from({ length: 300 }, (_, i) => {
        const c = { ...base, id: `id-${i}`, modificada: new Date(1e12 + i * 1000).toISOString() }
        return crear(`id-${i}`, c)
      })
    )
    const s = new ServicioBiblioteca(datos)
    const t0 = performance.now()
    const lista = await s.escanear()
    const ms = performance.now() - t0
    expect(lista).toHaveLength(300)
    expect(ms).toBeLessThan(1000)
  })
})
