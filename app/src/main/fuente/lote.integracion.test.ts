import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cancionSchema, configPredeterminada } from '../../shared'
import { ServicioBiblioteca } from '../biblioteca'
import { crearClienteWorker, GestorTrabajos, resolverLanzador } from '../trabajos'
import { cerrojoTrivial, ejecutarConCerrojo, ServicioYoutube } from './youtube'
import { ServicioLote } from './lote'

/* Lote con el worker real (`leer-etiquetas`, `importar-archivo-cola`, `info-lista-youtube`) y el doble de
 * yt-dlp. Archivos y títulos inventados; sin red. Se omite sin uv. */

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

/** WAV PCM 16 bits mono con un tono. */
function wav(segundos: number, fs = 8000): Buffer {
  const n = Math.round(segundos * fs)
  const datos = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) {
    datos.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / fs)), i * 2)
  }
  const cab = Buffer.alloc(44)
  cab.write('RIFF', 0)
  cab.writeUInt32LE(36 + datos.length, 4)
  cab.write('WAVEfmt ', 8)
  cab.writeUInt32LE(16, 16)
  cab.writeUInt16LE(1, 20)
  cab.writeUInt16LE(1, 22)
  cab.writeUInt32LE(fs, 24)
  cab.writeUInt32LE(fs * 2, 28)
  cab.writeUInt16LE(2, 32)
  cab.writeUInt16LE(16, 34)
  cab.write('data', 36)
  cab.writeUInt32LE(datos.length, 40)
  return Buffer.concat([cab, datos])
}

const LISTA = 'OLAK5uy_inventado01'
let datos: string
let externa: string
let falso: string
beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-lote-datos-'))
  externa = await mkdtemp(join(tmpdir(), 'shinobi-lote-ext-'))
  falso = await mkdtemp(join(tmpdir(), 'shinobi-lote-falso-'))
  await mkdir(join(datos, 'biblioteca'), { recursive: true })
})
afterEach(async () => {
  await rm(datos, { recursive: true, force: true })
  await rm(externa, { recursive: true, force: true })
  await rm(falso, { recursive: true, force: true })
})

describe.skipIf(!hayUv())('lote con el worker real', () => {
  function montar(avisoListas: string | null = '2026-01-01T00:00:00.000Z') {
    const biblioteca = new ServicioBiblioteca(datos)
    const lanzador = resolverLanzador({ modo: 'desarrollo', raizRepo, uv })
    const cliente = crearClienteWorker({
      lanzador: { ...lanzador, env: { SHINOBI_YTDLP_FALSO: falso } },
      dirRegistros: join(datos, 'registros'),
      esperaKillMs: 3000
    })
    const ejecutar = ejecutarConCerrojo(cliente.ejecutar, cerrojoTrivial)
    const gestor = new GestorTrabajos({ biblioteca, ejecutar })
    const youtube = new ServicioYoutube({
      biblioteca,
      gestor,
      ejecutar,
      config: {
        obtener: () => ({
          ...configPredeterminada(),
          aviso_youtube_aceptado: '2026-01-01T00:00:00.000Z',
          aviso_youtube_listas_aceptado: avisoListas
        })
      },
      dirDatos: datos,
      valoresDatos: () => biblioteca.valoresDatos(),
      esDuplicado: (id) => biblioteca.indiceDuplicados().some((c) => c.youtubeId === id)
    })
    const servicio = new ServicioLote({
      biblioteca,
      gestor,
      ejecutar,
      youtube,
      dialogo: {
        elegirArchivos: () => Promise.resolve(null),
        elegirCarpeta: () => Promise.resolve(null)
      },
      dirDatos: datos
    })
    return { biblioteca, gestor, servicio, youtube }
  }

  async function esperarFin(gestor: GestorTrabajos): Promise<void> {
    const limite = Date.now() + 80_000
    while (gestor.hayPendientes()) {
      if (Date.now() > limite) throw new Error('los trabajos no terminaron')
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  const leer = async (id: string) =>
    cancionSchema.parse(
      JSON.parse(await readFile(join(datos, 'biblioteca', id, 'cancion.json'), 'utf8'))
    )

  it('3 WAV de una carpeta: lectura sin decodificar, lote, cola y fuentes completadas', async () => {
    const dir = join(externa, 'Disco Inventado')
    await mkdir(dir)
    for (const n of ['01 Uno.wav', '02 Dos.wav', '03 Tres.wav'])
      await writeFile(join(dir, n), wav(12))
    const { servicio, gestor } = montar()

    const lectura = await servicio.leerCarpeta(dir)
    expect(lectura?.rechazadas).toBe(0)
    expect(lectura?.filas.map((f) => [f.nombre, f.metadatos.titulo, f.metadatos.album])).toEqual([
      ['01 Uno.wav', 'Uno', 'Disco Inventado'],
      ['02 Dos.wav', 'Dos', 'Disco Inventado'],
      ['03 Tres.wav', 'Tres', 'Disco Inventado']
    ])
    expect(lectura?.filas.every((f) => (f.duracionMs ?? 0) > 11_000)).toBe(true)

    const r = await servicio.lote({
      entradas: lectura!.filas.map((f) => ({ tipo: 'archivo' as const, ref: f.ref })),
      metadatos: lectura!.filas.map((f) => ({ ...f.metadatos, artista: 'Grupo Inventado' }))
    })
    expect(r.creadas).toHaveLength(3)
    expect(gestor.listar().map((t) => t.comando)).toEqual(Array(3).fill('importar-archivo-cola'))
    await esperarFin(gestor)

    for (const { id } of r.creadas) {
      const c = await leer(id)
      expect(c.pasos.fuente.estado).toBe('completado')
      expect(c.fuente.ruta_pendiente).toBeUndefined()
      expect(c.metadatos.duracion_ms).toBeGreaterThan(11_500)
      expect(existsSync(join(datos, 'biblioteca', id, 'fuente', 'mezcla.flac'))).toBe(true)
    }
  }, 120_000)

  it('un archivo que desaparece antes de su turno queda con ARCHIVO_NO_ENCONTRADO y el resto sigue', async () => {
    const a = join(externa, 'a.wav')
    const b = join(externa, 'b.wav')
    await writeFile(a, wav(12))
    await writeFile(b, wav(12))
    const { servicio, gestor } = montar()
    const lectura = await servicio.leerArchivos([a, b])
    // El original desaparece después de leerlo y antes de que le toque el turno.
    await rm(a)
    const r = await servicio.lote({
      entradas: lectura!.filas.map((f) => ({ tipo: 'archivo' as const, ref: f.ref })),
      metadatos: lectura!.filas.map((f) => f.metadatos)
    })
    await esperarFin(gestor)
    const [ca, cb] = await Promise.all(r.creadas.map((c) => leer(c.id)))
    expect(ca?.pasos.fuente).toMatchObject({
      estado: 'error',
      error: { codigo: 'ARCHIVO_NO_ENCONTRADO' }
    })
    expect(ca?.fuente.ruta_pendiente).toMatch(/a\.wav$/)
    expect(cb?.pasos.fuente.estado).toBe('completado')
  }, 120_000)

  it('una lista falsa con un álbum de 2 vídeos y uno privado: lectura, duplicado y descarga', async () => {
    const dos = ['Vid_0000001', 'Vid_0000002']
    for (const [i, id] of dos.entries()) {
      await writeFile(
        join(falso, `${id}.json`),
        JSON.stringify({
          id,
          title: `Tema ${i + 1} (Official Video)`,
          channel: 'Grupo Inventado - Topic',
          track: `Tema ${i + 1}`,
          artists: ['Grupo Inventado'],
          duration: 11,
          live_status: 'not_live'
        })
      )
    }
    await writeFile(
      join(falso, `lista-${LISTA}.json`),
      JSON.stringify({
        _type: 'playlist',
        title: 'Album - Disco Inventado',
        entries: [
          ...dos.map((id, i) => ({
            id,
            title: `Tema ${i + 1}`,
            channel: 'Grupo Inventado',
            duration: 11
          })),
          { id: 'Vid_0000003', title: '[Private video]', duration: null }
        ]
      })
    )
    const { servicio, gestor, youtube } = montar()
    const lista = await servicio.infoLista(`https://music.youtube.com/playlist?list=${LISTA}`)
    expect(lista).toMatchObject({
      titulo: 'Album - Disco Inventado',
      tipo: 'album',
      recortada: false
    })
    expect(lista.entradas.map((e) => e.disponible)).toEqual([true, true, false])

    // El completado de cada entrada (opción 1A) usa `infoYoutube`: el álbum sale del título de la lista.
    const info = await youtube.info(`https://www.youtube.com/watch?v=${dos[0]}&list=${LISTA}`)
    expect(info.datos.album).toMatchObject({ valor: 'Disco Inventado', origen: 'lista' })
    expect(info.duplicado).toBeNull()

    const r = await servicio.lote({
      entradas: dos.map((id) => ({ tipo: 'youtube' as const, id })),
      metadatos: [
        { titulo: 'Tema 1', artista: 'Grupo Inventado', album: 'Disco Inventado' },
        { titulo: 'Tema 2', artista: 'Grupo Inventado', album: 'Disco Inventado' }
      ]
    })
    expect(r.creadas).toHaveLength(2)
    await esperarFin(gestor)
    for (const [i, { id }] of r.creadas.entries()) {
      const c = await leer(id)
      expect(c).toMatchObject({
        fuente: { tipo: 'youtube', youtube_id: dos[i], mezcla: 'fuente/mezcla.flac' },
        pasos: { fuente: { estado: 'completado' } }
      })
    }
    // Repetir la lista marca las dos primeras como ya añadidas.
    const otra = await servicio.infoLista(`https://music.youtube.com/playlist?list=${LISTA}`)
    expect(otra.entradas.map((e) => e.duplicado)).toEqual([
      'YA_EN_BIBLIOTECA',
      'YA_EN_BIBLIOTECA',
      null
    ])
  }, 120_000)

  it('lista privada o inexistente: LISTA_NO_DISPONIBLE; sin el aviso de listas no se consulta', async () => {
    const { servicio } = montar()
    await expect(
      servicio.infoLista('https://www.youtube.com/playlist?list=PLinventada0000001')
    ).rejects.toMatchObject({ codigo: 'LISTA_NO_DISPONIBLE' })
    await expect(
      servicio.infoLista('https://www.youtube.com/playlist?list=RDCLAK5uy_inventadoxx')
    ).rejects.toMatchObject({ codigo: 'URL_NO_SOPORTADA' })
    const sinAviso = montar(null).servicio
    await expect(
      sinAviso.infoLista(`https://music.youtube.com/playlist?list=${LISTA}`)
    ).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  }, 60_000)
})
