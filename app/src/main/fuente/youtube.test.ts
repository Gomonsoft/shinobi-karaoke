import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancionSchema, configPredeterminada } from '../../shared'
import { letraSincronizada } from '../../shared/__fixtures__'
import { ServicioBiblioteca } from '../biblioteca'
import { crearClienteWorker, GestorTrabajos, resolverLanzador } from '../trabajos'
import { procesosCon } from '../trabajos/procesosCon.testutil'
import {
  cerrojoTrivial,
  entornoYtdlpFalso,
  ejecutarConCerrojo,
  MAX_CONSULTAS,
  ServicioYoutube,
  VIDA_CONSULTA_MS,
  type DependenciasYoutube
} from './youtube'

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

/** JPEG mínimo válido (1x1) para la miniatura del doble. */
const JPEG_1X1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==',
  'base64'
)

const ID = 'aaaaaaaaaaa'
const URL = `https://youtu.be/${ID}`
const META = { titulo: ' Canción de prueba ', artista: 'Artista', album: '' }

describe('entornoYtdlpFalso', () => {
  it('solo pasa el doble sin empaquetar', () => {
    const env = { SHINOBI_YTDLP_FALSO: '/x' }
    expect(entornoYtdlpFalso(env, false)).toEqual({ SHINOBI_YTDLP_FALSO: '/x' })
    expect(entornoYtdlpFalso(env, true)).toEqual({})
    expect(entornoYtdlpFalso({}, false)).toEqual({})
  })
})

describe('ejecutarConCerrojo', () => {
  it('solo los comandos de yt-dlp pasan por el cerrojo de lectura', async () => {
    const conLectura = vi.fn((fn: () => Promise<unknown>) => fn())
    const base = vi.fn(() => Promise.resolve({}))
    const e = ejecutarConCerrojo(base, { conLectura } as never)
    await e('info-youtube', {})
    await e('descargar-youtube', {})
    await e('importar-archivo', {})
    expect(conLectura).toHaveBeenCalledTimes(2)
    expect(base).toHaveBeenCalledTimes(3)
  })
})

describe('ServicioYoutube: reintento tras YOUTUBE_BLOQUEADO (0050)', () => {
  const bloqueo = { codigo: 'YOUTUBE_BLOQUEADO', mensaje: 'bloqueado', reintentable: true }
  const correcto = {
    id_video: ID,
    titulo_original: 'T',
    canal: 'C',
    duracion_s: 10,
    metadatos: { titulo: 'T', artista: 'A', album: '' }
  }
  function montar(ejecutar: DependenciasYoutube['ejecutar'], actualizar?: () => Promise<unknown>) {
    const eventos: { consultaId: string; fase: string }[] = []
    const servicio = new ServicioYoutube({
      biblioteca: {},
      gestor: { encolar: vi.fn(), listar: () => [] },
      ejecutar,
      config: {
        obtener: () => ({
          ...configPredeterminada(),
          aviso_youtube_aceptado: '2026-01-01T00:00:00Z'
        })
      },
      dirDatos: '/nada',
      ...(actualizar ? { actualizarYtDlp: actualizar } : {}),
      alEstadoInfo: (e: { consultaId: string; fase: string }) => eventos.push(e)
    } as unknown as DependenciasYoutube)
    return { servicio, eventos }
  }

  it('actualiza, emite estadoInfo actualizando con el id de la consulta y repite una vez', async () => {
    const ejecutar = vi
      .fn()
      .mockRejectedValueOnce(bloqueo)
      .mockResolvedValueOnce(correcto) as unknown as DependenciasYoutube['ejecutar']
    const actualizar = vi.fn(() => Promise.resolve())
    const { servicio, eventos } = montar(ejecutar, actualizar)
    const info = await servicio.info(URL)
    expect(actualizar).toHaveBeenCalledTimes(1)
    expect(ejecutar).toHaveBeenCalledTimes(2)
    expect(eventos).toEqual([{ consultaId: info.consultaId, fase: 'actualizando' }])
  })

  it('si vuelve a fallar, devuelve YOUTUBE_BLOQUEADO sin un tercer intento', async () => {
    const ejecutar = vi
      .fn()
      .mockRejectedValue(bloqueo) as unknown as DependenciasYoutube['ejecutar']
    const actualizar = vi.fn(() => Promise.resolve())
    const { servicio } = montar(ejecutar, actualizar)
    await expect(servicio.info(URL)).rejects.toMatchObject({ codigo: 'YOUTUBE_BLOQUEADO' })
    expect(ejecutar).toHaveBeenCalledTimes(2)
    expect(actualizar).toHaveBeenCalledTimes(1)
  })

  it('cancelar mientras actualiza resuelve CANCELADO y no aborta la actualización', async () => {
    const ejecutar = vi
      .fn()
      .mockRejectedValue(bloqueo) as unknown as DependenciasYoutube['ejecutar']
    let acabar: () => void = () => undefined
    let terminada = false
    const actualizar = vi.fn(
      () => new Promise<void>((r) => (acabar = () => ((terminada = true), r())))
    )
    const { servicio } = montar(ejecutar, actualizar)
    const p = servicio.info(URL)
    const rechazo = expect(p).rejects.toMatchObject({ codigo: 'CANCELADO' })
    await new Promise((r) => setTimeout(r, 10))
    await servicio.cancelarInfo()
    await rechazo
    expect(terminada).toBe(false)
    acabar()
    expect(ejecutar).toHaveBeenCalledTimes(1)
  })

  it('una consulta que espera una actualización en curso emite actualizando (alEsperar)', async () => {
    const ejecutar = vi.fn(async (_c: string, _a: unknown, o?: { alEsperar?: () => void }) => {
      o?.alEsperar?.()
      return correcto
    }) as unknown as DependenciasYoutube['ejecutar']
    const { servicio, eventos } = montar(ejecutar)
    const info = await servicio.info(URL)
    expect(eventos).toEqual([{ consultaId: info.consultaId, fase: 'actualizando' }])
  })

  it('sin actualizador, el bloqueo no se reintenta', async () => {
    const ejecutar = vi
      .fn()
      .mockRejectedValue(bloqueo) as unknown as DependenciasYoutube['ejecutar']
    const { servicio } = montar(ejecutar)
    await expect(servicio.info(URL)).rejects.toMatchObject({ codigo: 'YOUTUBE_BLOQUEADO' })
    expect(ejecutar).toHaveBeenCalledTimes(1)
  })
})

describe('ServicioYoutube sin worker', () => {
  function montar(aviso: string | null = '2026-01-01T00:00:00.000Z') {
    let ahora = new Date('2026-11-04T10:00:00Z')
    const ejecutar = vi.fn(() => {
      return Promise.resolve({
        id_video: ID,
        titulo_original: 'T',
        canal: 'C',
        duracion_s: 10,
        metadatos: { titulo: 'T', artista: 'A', album: '' }
      })
    })
    const deps = {
      biblioteca: {},
      gestor: { encolar: vi.fn(), listar: () => [] },
      ejecutar,
      config: { obtener: () => ({ ...configPredeterminada(), aviso_youtube_aceptado: aviso }) },
      dirDatos: '/nada',
      ahora: () => ahora
    } as unknown as DependenciasYoutube
    return {
      servicio: new ServicioYoutube(deps),
      ejecutar,
      avanzar: (ms: number) => (ahora = new Date(ahora.getTime() + ms))
    }
  }

  it('una URL inválida o de lista falla sin lanzar el worker', async () => {
    const { servicio, ejecutar } = montar()
    await expect(servicio.info('https://example.com/x')).rejects.toMatchObject({
      codigo: 'URL_NO_VALIDA'
    })
    await expect(servicio.info('https://www.youtube.com/playlist?list=abc')).rejects.toMatchObject({
      codigo: 'URL_NO_SOPORTADA'
    })
    expect(ejecutar).not.toHaveBeenCalled()
  })

  it('sin el aviso legal aceptado falla con ARGUMENTOS_NO_VALIDOS sin lanzar el worker', async () => {
    const { servicio, ejecutar } = montar(null)
    await expect(servicio.info(URL)).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    expect(ejecutar).not.toHaveBeenCalled()
  })

  it('guarda como mucho 5 consultas y las descarta a los 30 min', async () => {
    const { servicio, avanzar } = montar()
    const ids: string[] = []
    for (let i = 0; i < MAX_CONSULTAS + 1; i++) ids.push((await servicio.info(URL)).consultaId)
    // La más antigua se descartó; la última sigue.
    await expect(servicio.cancelarInfo(ids[0])).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    avanzar(VIDA_CONSULTA_MS + 1)
    await expect(servicio.cancelarInfo(ids[MAX_CONSULTAS])).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  })

  it('confirmar con un id desconocido o metadatos inválidos falla', async () => {
    const { servicio } = montar()
    await expect(servicio.confirmar('nada', META)).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    const { consultaId } = await servicio.info(URL)
    await expect(
      servicio.confirmar(consultaId, { titulo: '  ', artista: '', album: null })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
  })
})

let datos: string
let falso: string
beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-yt-datos-'))
  falso = await mkdtemp(join(tmpdir(), 'shinobi-yt-falso-'))
  await mkdir(join(datos, 'biblioteca'), { recursive: true })
})
afterEach(async () => {
  await rm(datos, { recursive: true, force: true })
  await rm(falso, { recursive: true, force: true })
})

async function fixture(id: string, extra: Record<string, unknown> = {}, miniatura = true) {
  await writeFile(
    join(falso, `${id}.json`),
    JSON.stringify({
      id,
      title: 'Artista - Canción de prueba (Official Video)',
      channel: 'ArtistaVEVO',
      duration: 11,
      live_status: 'not_live',
      ...extra
    })
  )
  if (miniatura) await writeFile(join(falso, `${id}.jpg`), JPEG_1X1)
}

describe.skipIf(!hayUv())('servicio de YouTube con el worker real y el doble de yt-dlp', () => {
  function montar() {
    const biblioteca = new ServicioBiblioteca(datos)
    const lanzador = resolverLanzador({ modo: 'desarrollo', raizRepo, uv })
    const cliente = crearClienteWorker({
      lanzador: { ...lanzador, env: { SHINOBI_YTDLP_FALSO: falso } },
      dirRegistros: join(datos, 'registros'),
      esperaKillMs: 3000
    })
    const ejecutar = ejecutarConCerrojo(cliente.ejecutar, cerrojoTrivial)
    const gestor = new GestorTrabajos({ biblioteca, ejecutar })
    const servicio = new ServicioYoutube({
      biblioteca,
      gestor,
      ejecutar,
      config: {
        obtener: () => ({
          ...configPredeterminada(),
          aviso_youtube_aceptado: '2026-01-01T00:00:00.000Z'
        })
      },
      dirDatos: datos
    })
    return { biblioteca, gestor, servicio }
  }

  const carpeta = (id: string): string => join(datos, 'biblioteca', id)
  const fuenteDe = async (id: string): Promise<string[]> =>
    (await readdir(join(carpeta(id), 'fuente'))).sort()
  const leer = async (id: string) =>
    cancionSchema.parse(JSON.parse(await readFile(join(carpeta(id), 'cancion.json'), 'utf8')))

  async function esperarFin(gestor: GestorTrabajos): Promise<void> {
    const limite = Date.now() + 50_000
    while (gestor.hayPendientes()) {
      if (Date.now() > limite) throw new Error('el trabajo no terminó')
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  async function esperarProgreso(gestor: GestorTrabajos): Promise<void> {
    await new Promise<void>((r) => {
      const baja = gestor.suscribirProgreso((p) => {
        if (p.fase === 'descargando') {
          baja()
          r()
        }
      })
    })
  }

  it('info -> confirmar -> descarga en la cola ligera -> canción completada con mezcla y miniatura', async () => {
    await fixture(ID)
    const { gestor, servicio, biblioteca } = montar()
    const info = await servicio.info(URL)
    expect(info).toMatchObject({
      idVideo: ID,
      canal: 'ArtistaVEVO',
      duracionS: 11,
      metadatos: { titulo: 'Canción de prueba', artista: 'Artista' }
    })
    expect(info.miniaturaDataUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(JSON.stringify(info)).not.toContain('watch?v=')

    const resumen = await servicio.confirmar(info.consultaId, META)
    expect(resumen).toMatchObject({ titulo: 'Canción de prueba', estado: 'borrador' })
    expect(resumen.miniatura).not.toBeNull()
    const trabajos = gestor.listar()
    expect(trabajos).toHaveLength(1)
    expect(trabajos[0]).toMatchObject({
      cancionId: resumen.id,
      cola: 'ligera',
      paso: 'fuente',
      comando: 'descargar-youtube'
    })
    // La consulta se descarta al confirmar.
    await expect(servicio.confirmar(info.consultaId, META)).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })

    await esperarFin(gestor)
    const c = await leer(resumen.id)
    expect(c).toMatchObject({
      metadatos: { titulo: 'Canción de prueba', artista: 'Artista', album: null },
      fuente: {
        tipo: 'youtube',
        url: `https://www.youtube.com/watch?v=${ID}`,
        youtube_id: ID,
        mezcla: 'fuente/mezcla.flac',
        miniatura: 'fuente/miniatura.jpg'
      },
      pasos: { fuente: { estado: 'completado', error: null } }
    })
    expect(c.metadatos.duracion_ms).toBeGreaterThan(10_500)
    expect(await fuenteDe(resumen.id)).toEqual(['mezcla.flac', 'miniatura.jpg'])
    expect(biblioteca.obtenerResumen(resumen.id)?.miniatura).not.toBeNull()
  }, 90_000)

  it('un error del doble deja el paso en error con su código y reintentar lo completa', async () => {
    await fixture(ID, { error_descarga: "ERROR: [youtube] Sign in to confirm you're not a bot" })
    const { gestor, servicio } = montar()
    const { consultaId } = await servicio.info(URL)
    const { id } = await servicio.confirmar(consultaId, META)
    await esperarFin(gestor)
    expect((await leer(id)).pasos.fuente).toMatchObject({
      estado: 'error',
      error: { codigo: 'YOUTUBE_BLOQUEADO' }
    })
    expect(await fuenteDe(id)).toEqual(['miniatura.jpg'])

    await fixture(ID)
    await servicio.reintentar(id)
    await esperarFin(gestor)
    expect((await leer(id)).pasos.fuente).toMatchObject({ estado: 'completado', error: null })
    expect(existsSync(join(carpeta(id), 'fuente', 'mezcla.flac'))).toBe(true)
    // Ya completada: no se puede reintentar.
    await expect(servicio.reintentar(id)).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
  }, 90_000)

  it('cancelar a mitad deja el paso pendiente, sin descarga.* ni procesos', async () => {
    await fixture(ID, { duration: 20, ritmo: 30, bytes_por_segundo: 1000 })
    const { gestor, servicio } = montar()
    const { consultaId } = await servicio.info(URL)
    const progreso = esperarProgreso(gestor)
    const { id } = await servicio.confirmar(consultaId, META)
    await progreso
    const [trabajo] = gestor.listar()
    expect(await gestor.cancelar(trabajo?.id ?? '')).toBe(true)
    expect((await leer(id)).pasos.fuente).toMatchObject({ estado: 'pendiente', error: null })
    expect((await fuenteDe(id)).filter((n) => n.startsWith('descarga.'))).toEqual([])
    expect(await fuenteDe(id)).not.toContain('mezcla.flac.tmp')
    expect(procesosCon(`${id}`)).toBe(0)
    // Pendiente y sin trabajo: "Descargar ahora" es un reintento.
    await fixture(ID)
    await servicio.reintentar(id)
    await esperarFin(gestor)
    expect((await leer(id)).pasos.fuente.estado).toBe('completado')
  }, 90_000)

  it('cerrar la app a mitad deja el paso interrumpido y se reintenta en otra sesión', async () => {
    await fixture(ID, { duration: 20, ritmo: 30, bytes_por_segundo: 1000 })
    const a = montar()
    const { consultaId } = await a.servicio.info(URL)
    const progreso = esperarProgreso(a.gestor)
    const { id } = await a.servicio.confirmar(consultaId, META)
    await progreso
    await a.gestor.cancelarTodos()
    expect((await leer(id)).pasos.fuente).toMatchObject({ estado: 'interrumpido' })
    expect((await fuenteDe(id)).filter((n) => n.startsWith('descarga.'))).toEqual([])
    expect(procesosCon(`${id}`)).toBe(0)

    await fixture(ID)
    const b = montar()
    await b.biblioteca.arrancar()
    await b.servicio.reintentar(id)
    await esperarFin(b.gestor)
    expect((await leer(id)).pasos.fuente.estado).toBe('completado')
  }, 90_000)

  it('sustituir la fuente (pendiente y error) conserva id y letra, cambia la miniatura y encola la URL nueva', async () => {
    const OTRO = 'bbbbbbbbbbb'
    await fixture(ID, { duration: 20, ritmo: 30, bytes_por_segundo: 1000 })
    await fixture(OTRO, { duration: 11 }, false) // sin miniatura
    const { gestor, servicio, biblioteca } = montar()
    const i1 = await servicio.info(URL)
    const progreso = esperarProgreso(gestor)
    const { id } = await servicio.confirmar(i1.consultaId, META)
    await progreso
    // Con el trabajo vivo se rechaza.
    const i2 = await servicio.info(`https://youtu.be/${OTRO}`)
    await expect(servicio.confirmar(i2.consultaId, META, { cancionId: id })).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    await gestor.cancelar(gestor.listar()[0]?.id ?? '')
    await biblioteca.actualizar(id, { letra: letraSincronizada() })
    const antes = await leer(id)
    expect(antes.pasos.fuente.estado).toBe('pendiente')

    // Pendiente -> otra URL, sin miniatura: se borra la anterior.
    const resumen = await servicio.confirmar(i2.consultaId, META, { cancionId: id })
    expect(resumen.id).toBe(id)
    expect(resumen.miniatura).toBeNull()
    expect(gestor.listar()).toHaveLength(1)
    await esperarFin(gestor)
    const c = await leer(id)
    expect(c).toMatchObject({
      id,
      creada: antes.creada,
      estilo: antes.estilo,
      fuente: { url: `https://www.youtube.com/watch?v=${OTRO}`, youtube_id: OTRO, miniatura: null },
      pasos: { fuente: { estado: 'completado' } }
    })
    expect(c.letra).toEqual(letraSincronizada())
    expect(await fuenteDe(id)).toEqual(['mezcla.flac'])

    // Con mezcla.flac ya no se puede sustituir.
    const i3 = await servicio.info(URL)
    await expect(servicio.confirmar(i3.consultaId, META, { cancionId: id })).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  }, 120_000)

  it('sustituir sobre una descarga en error: miniatura nueva y la URL nueva', async () => {
    const OTRO = 'ccccccccccc'
    await fixture(ID, { error_descarga: 'ERROR: [youtube] Video unavailable' })
    await fixture(OTRO, { duration: 11 })
    const { gestor, servicio } = montar()
    const { id } = await servicio.confirmar((await servicio.info(URL)).consultaId, META)
    await esperarFin(gestor)
    expect((await leer(id)).pasos.fuente.estado).toBe('error')

    const i2 = await servicio.info(`https://youtu.be/${OTRO}`)
    const resumen = await servicio.confirmar(i2.consultaId, META, { cancionId: id })
    expect(resumen).toMatchObject({ id })
    expect(resumen.miniatura).not.toBeNull()
    await esperarFin(gestor)
    const c = await leer(id)
    expect(c.fuente).toMatchObject({ youtube_id: OTRO, miniatura: 'fuente/miniatura.jpg' })
    expect(c.pasos.fuente).toMatchObject({ estado: 'completado', error: null })
    expect(await fuenteDe(id)).toEqual(['mezcla.flac', 'miniatura.jpg'])
  }, 120_000)
})
