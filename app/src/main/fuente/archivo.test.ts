import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIXTURES } from '../../shared/__fixtures__'
import { cancionSchema } from '../../shared'
import { ServicioBiblioteca } from '../biblioteca'
import { crearClienteWorker, resolverLanzador } from '../trabajos'
import { procesosCon } from '../trabajos/procesosCon.testutil'
import { elegirArchivoAudio, ServicioImportacionArchivo } from './archivo'

/* Importación con el worker real (`importar-archivo`, 0041) y un WAV generado aquí. Se omite sin uv. */

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

const sha = async (ruta: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(ruta))
    .digest('hex')

let datos: string
let externa: string
beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-imp-datos-'))
  externa = await mkdtemp(join(tmpdir(), 'shinobi-imp-ext-'))
  await mkdir(join(datos, 'biblioteca'), { recursive: true })
})
afterEach(async () => {
  await rm(datos, { recursive: true, force: true })
  await rm(externa, { recursive: true, force: true })
})

const importando = async (): Promise<string[]> => {
  const dir = join(datos, 'biblioteca', '.importando')
  return existsSync(dir) ? readdir(dir) : []
}

describe.skipIf(!hayUv())('importación de archivo con el worker real', () => {
  function montar(hayTrabajoVivo?: (id: string) => boolean) {
    const biblioteca = new ServicioBiblioteca(datos)
    const cliente = crearClienteWorker({
      lanzador: resolverLanzador({ modo: 'desarrollo', raizRepo, uv }),
      dirRegistros: join(datos, 'registros'),
      esperaKillMs: 3000
    })
    let alEmpezar: () => void = () => undefined
    const empezo = (): Promise<void> => new Promise((r) => (alEmpezar = r))
    const servicio = new ServicioImportacionArchivo({
      biblioteca,
      dirDatos: datos,
      ...(hayTrabajoVivo ? { hayTrabajoVivo } : {}),
      ejecutar: (comando, args, opciones) =>
        cliente.ejecutar(comando, args, {
          ...opciones,
          alProgreso: () => alEmpezar()
        })
    })
    return { biblioteca, servicio, empezo }
  }

  async function archivo(nombre: string, contenido: Buffer): Promise<string> {
    const ruta = join(externa, nombre)
    await writeFile(ruta, contenido)
    return ruta
  }

  it('importar y confirmar crea la canción con su mezcla y vacía .importando; el original no cambia', async () => {
    const { biblioteca, servicio } = montar()
    const ruta = await archivo('Queen - Bohemian.wav', wav(15))
    const antes = { sha: await sha(ruta), mtime: (await stat(ruta)).mtimeMs }

    const leida = await servicio.importar(ruta)
    expect(leida).toMatchObject({ nombre: 'Queen - Bohemian.wav', larga: false })
    expect(leida.duracionMs).toBeGreaterThan(14_000)
    expect(leida.metadatos).toMatchObject({ titulo: 'Bohemian', artista: 'Queen' })
    expect(await importando()).toEqual([leida.importacionId])
    expect(existsSync(join(datos, 'biblioteca', leida.importacionId))).toBe(false)

    const resumen = await servicio.confirmar(leida.importacionId, {
      titulo: ' Bohemian Rhapsody ',
      artista: 'Queen',
      album: ''
    })
    expect(resumen).toMatchObject({ id: leida.importacionId, titulo: 'Bohemian Rhapsody' })
    const carpeta = join(datos, 'biblioteca', leida.importacionId)
    const cancion = cancionSchema.parse(
      JSON.parse(await readFile(join(carpeta, 'cancion.json'), 'utf8'))
    )
    expect(cancion).toMatchObject({
      estado: 'borrador',
      metadatos: { titulo: 'Bohemian Rhapsody', album: null },
      fuente: {
        tipo: 'archivo',
        nombre_original: 'Queen - Bohemian.wav',
        mezcla: 'fuente/mezcla.flac'
      },
      pasos: { fuente: { estado: 'completado' }, separacion: { estado: 'pendiente' } }
    })
    expect(cancion.fuente.ganancia_db).toBeCloseTo(leida.gananciaDb, 5)
    expect(existsSync(join(carpeta, 'fuente', 'mezcla.flac'))).toBe(true)
    expect(await importando()).toEqual([])
    expect({ sha: await sha(ruta), mtime: (await stat(ruta)).mtimeMs }).toEqual(antes)
    expect(biblioteca.obtener(leida.importacionId)?.id).toBe(leida.importacionId)
  }, 60_000)

  it('importar y descartar no deja nada; ids desconocidos se rechazan', async () => {
    const { servicio } = montar()
    const leida = await servicio.importar(await archivo('a.wav', wav(12)))
    await expect(servicio.descartar('otro')).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    await expect(
      servicio.confirmar('otro', { titulo: 'x', artista: '', album: null })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    await servicio.descartar(leida.importacionId)
    expect(await importando()).toEqual([])
    expect(await readdir(join(datos, 'biblioteca'))).toEqual(['.importando'])
    await expect(servicio.descartar(leida.importacionId)).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  }, 60_000)

  it('metadatos no válidos se rechazan sin materializar y la importación sigue viva', async () => {
    const { servicio } = montar()
    const leida = await servicio.importar(await archivo('a.wav', wav(12)))
    await expect(
      servicio.confirmar(leida.importacionId, { titulo: '   ', artista: '', album: null })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    await expect(
      servicio.confirmar(leida.importacionId, { titulo: 'x', artista: 5 } as never)
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    expect(await readdir(join(datos, 'biblioteca'))).toEqual(['.importando'])
    await servicio.confirmar(leida.importacionId, { titulo: 'x', artista: '', album: null })
    expect(existsSync(join(datos, 'biblioteca', leida.importacionId, 'cancion.json'))).toBe(true)
  }, 60_000)

  it('cancelar a mitad no deja carpeta ni procesos', async () => {
    const { servicio, empezo } = montar()
    const ruta = await archivo('largo-cancelar.wav', wav(660))
    const arrancada = empezo()
    const lectura = servicio.importar(ruta)
    const rechazo = expect(lectura).rejects.toMatchObject({ codigo: 'CANCELADO' })
    await arrancada
    await servicio.cancelar()
    await rechazo
    expect(await importando()).toEqual([])
    expect(procesosCon('largo-cancelar.wav')).toBe(0)
  }, 60_000)

  it('importar dos veces seguidas cancela la primera', async () => {
    const { servicio, empezo } = montar()
    const larga = await archivo('larga-primera.wav', wav(660))
    const corta = await archivo('corta.wav', wav(12))
    const arrancada = empezo()
    const primera = servicio.importar(larga)
    const rechazo = expect(primera).rejects.toMatchObject({ codigo: 'CANCELADO' })
    await arrancada
    const segunda = await servicio.importar(corta)
    await rechazo
    expect(await importando()).toEqual([segunda.importacionId])
    expect(procesosCon('larga-primera.wav')).toBe(0)
    await servicio.descartar(segunda.importacionId)
  }, 90_000)

  it('archivo corrupto: FORMATO_NO_SOPORTADO con detalles y sin restos', async () => {
    const { servicio } = montar()
    const ruta = await archivo(
      'falso.mp3',
      Buffer.from('esto no es audio, es texto plano\n'.repeat(50))
    )
    await expect(servicio.importar(ruta)).rejects.toMatchObject({ codigo: 'FORMATO_NO_SOPORTADO' })
    expect(await importando()).toEqual([])
  }, 60_000)

  it('audio de menos de 10 s: AUDIO_DEMASIADO_CORTO sin restos', async () => {
    const { servicio } = montar()
    await expect(servicio.importar(await archivo('corto.wav', wav(3)))).rejects.toMatchObject({
      codigo: 'AUDIO_DEMASIADO_CORTO'
    })
    expect(await importando()).toEqual([])
  }, 60_000)

  describe('sustitución de la fuente de una canción de YouTube sin audio', () => {
    async function cancionYoutube(biblioteca: ServicioBiblioteca) {
      const y = FIXTURES.descargando()
      const resumen = await biblioteca.crear({
        metadatos: y.metadatos,
        fuente: { ...y.fuente, miniatura: 'fuente/miniatura.jpg' },
        letra: {
          origen: 'manual',
          lrclib_id: null,
          offset_ms: 0,
          lineas: [
            {
              id: 'l1',
              tipo: 'linea',
              texto: 'Letra inventada',
              inicio_ms: 1000,
              fin_ms: null,
              palabras: null
            }
          ]
        },
        pasos: {
          fuente: { estado: 'pendiente', actualizado: null, error: null },
          letra: { estado: 'completado', actualizado: '2026-01-01T00:00:00.000Z', error: null }
        }
      })
      const carpeta = join(datos, 'biblioteca', resumen.id)
      await mkdir(join(carpeta, 'fuente'), { recursive: true })
      await writeFile(join(carpeta, 'fuente', 'miniatura.jpg'), 'jpg')
      await writeFile(join(carpeta, 'fuente', 'descarga.webm'), 'parcial')
      return { id: resumen.id, carpeta }
    }
    const meta = { titulo: 'Nuevo título', artista: 'Otro', album: null }

    it('mismo id, letra intacta, sin miniatura, fuente archivo completada', async () => {
      const { biblioteca, servicio } = montar()
      const { id, carpeta } = await cancionYoutube(biblioteca)
      const leida = await servicio.importar(await archivo('otro.wav', wav(12)))
      const resumen = await servicio.confirmar(leida.importacionId, meta, { cancionId: id })
      expect(resumen).toMatchObject({ id, titulo: 'Nuevo título' })
      const cancion = cancionSchema.parse(
        JSON.parse(await readFile(join(carpeta, 'cancion.json'), 'utf8'))
      )
      expect(cancion).toMatchObject({
        id,
        fuente: {
          tipo: 'archivo',
          url: null,
          youtube_id: null,
          miniatura: null,
          nombre_original: 'otro.wav'
        },
        pasos: { fuente: { estado: 'completado' } }
      })
      expect(cancion.metadatos.duracion_ms).toBeGreaterThan(11_000)
      expect(existsSync(join(carpeta, 'fuente', 'mezcla.flac'))).toBe(true)
      expect(existsSync(join(carpeta, 'fuente', 'miniatura.jpg'))).toBe(false)
      expect(existsSync(join(carpeta, 'fuente', 'descarga.webm'))).toBe(false)
      expect(cancion.letra?.lineas.map((l) => l.texto)).toEqual(['Letra inventada'])
      expect(cancion.pasos.letra.estado).toBe('completado')
      expect(await importando()).toEqual([])
      expect((await readdir(join(datos, 'biblioteca'))).sort()).toEqual(['.importando', id])
    }, 60_000)

    it('se rechaza si ya tiene mezcla.flac o un trabajo vivo, y la canción queda como estaba', async () => {
      let vivo = true
      const { biblioteca, servicio } = montar(() => vivo)
      const { id, carpeta } = await cancionYoutube(biblioteca)
      const leida = await servicio.importar(await archivo('otro.wav', wav(12)))
      await expect(
        servicio.confirmar(leida.importacionId, meta, { cancionId: id })
      ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
      vivo = false
      await writeFile(join(carpeta, 'fuente', 'mezcla.flac'), 'audio')
      await expect(
        servicio.confirmar(leida.importacionId, meta, { cancionId: id })
      ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
      expect(await readFile(join(carpeta, 'fuente', 'mezcla.flac'), 'utf8')).toBe('audio')
      expect(biblioteca.obtener(id)?.fuente.tipo).toBe('youtube')
      expect(existsSync(join(carpeta, 'fuente', 'miniatura.jpg'))).toBe(true)
      await expect(
        servicio.confirmar(leida.importacionId, meta, { cancionId: 'no-existe' })
      ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
      await servicio.descartar(leida.importacionId)
      expect(await importando()).toEqual([])
    }, 60_000)

    it('se rechaza si la fuente ya está completada', async () => {
      const { biblioteca, servicio } = montar()
      const { id } = await cancionYoutube(biblioteca)
      await biblioteca.actualizar(id, { pasos: { fuente: { estado: 'completado' } } })
      const leida = await servicio.importar(await archivo('otro.wav', wav(12)))
      await expect(
        servicio.confirmar(leida.importacionId, meta, { cancionId: id })
      ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
      await servicio.descartar(leida.importacionId)
    }, 60_000)
  })

  it('cerrar la app con una importación sin confirmar borra su carpeta', async () => {
    const { servicio } = montar()
    await servicio.importar(await archivo('a.wav', wav(12)))
    expect(await importando()).toHaveLength(1)
    await servicio.cerrar()
    expect(await importando()).toEqual([])
  }, 60_000)
})

describe('comprobación de la ruta de entrada (sin worker)', () => {
  function sinWorker() {
    let llamadas = 0
    const biblioteca = new ServicioBiblioteca(datos)
    const servicio = new ServicioImportacionArchivo({
      biblioteca,
      dirDatos: datos,
      ejecutar: () => {
        llamadas++
        return Promise.reject({ codigo: 'ERROR_INTERNO', mensaje: 'no debería llamarse' })
      }
    })
    return { servicio, llamadas: () => llamadas }
  }

  it('rechaza directorios, rutas relativas, el directorio de datos y archivos inexistentes', async () => {
    const { servicio, llamadas } = sinWorker()
    await writeFile(join(datos, 'config.json'), '{}')
    await expect(servicio.importar(externa)).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    await expect(servicio.importar('a.wav')).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    await expect(servicio.importar(join(datos, 'config.json'))).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    await expect(servicio.importar(join(externa, 'no-existe.mp3'))).rejects.toMatchObject({
      codigo: 'FORMATO_NO_SOPORTADO'
    })
    expect(llamadas()).toBe(0)
  })

  it('un error del worker con código desconocido se propaga como ERROR_INTERNO con detalles', async () => {
    const biblioteca = new ServicioBiblioteca(datos)
    const servicio = new ServicioImportacionArchivo({
      biblioteca,
      dirDatos: datos,
      ejecutar: () =>
        Promise.reject({
          codigo: 'RARO',
          mensaje: 'fallo',
          reintentable: false,
          detalles: 'línea 1'
        })
    })
    const ruta = join(externa, 'a.wav')
    await writeFile(ruta, wav(1))
    await expect(servicio.importar(ruta)).rejects.toMatchObject({
      codigo: 'ERROR_INTERNO',
      detalles: 'línea 1'
    })
  })

  it.each(['SIN_ESPACIO', 'RUNTIME_NO_DISPONIBLE'])('propaga %s', async (codigo) => {
    const biblioteca = new ServicioBiblioteca(datos)
    const servicio = new ServicioImportacionArchivo({
      biblioteca,
      dirDatos: datos,
      ejecutar: () => Promise.reject({ codigo, mensaje: 'x', reintentable: true })
    })
    const ruta = join(externa, 'a.wav')
    await writeFile(ruta, wav(1))
    await expect(servicio.importar(ruta)).rejects.toMatchObject({ codigo })
    expect(existsSync(join(datos, 'biblioteca', '.importando'))).toBe(true)
    expect(await readdir(join(datos, 'biblioteca', '.importando'))).toEqual([])
  })

  it('elegirArchivoAudio: filtros y cancelación', async () => {
    let opciones: unknown
    const dialogo = (canceled: boolean, filePaths: string[]) => ({
      showOpenDialog: (o: unknown) => {
        opciones = o
        return Promise.resolve({ canceled, filePaths })
      }
    })
    expect(await elegirArchivoAudio(dialogo(false, ['/x/a.mp3']))).toBe('/x/a.mp3')
    expect(opciones).toMatchObject({
      properties: ['openFile'],
      filters: [
        { name: 'Audio y vídeo', extensions: expect.arrayContaining(['mp3', 'mkv', 'mov']) },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    })
    expect(await elegirArchivoAudio(dialogo(true, []))).toBeNull()
  })
})
