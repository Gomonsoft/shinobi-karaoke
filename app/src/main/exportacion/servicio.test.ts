import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configPredeterminada, type Config } from '../../shared/config'
import type { Cancion } from '../../shared/cancion'
import { estiloPredeterminado } from '../../shared/estilo'
import type { ExportacionIpc } from '../../shared/exportacion'
import { lista } from '../../shared/__fixtures__'
import type { OpcionesEjecucion } from '../trabajos/worker'
import { Destinos, discoReal, type DiscoDestinos } from './destinos'
import { DiarioExportacion } from './diario'
import {
  INTERVALO_MIN_PROGRESO_MS,
  ServicioExportacion,
  type DependenciasServicioExportacion
} from './servicio'
import type { OpcionesExportacion, VentanaExportacion } from './ventana'

const GIB = 1024 ** 3
const ID_A = 'cancion-a'
const ID_B = 'cancion-b'

const existe = (ruta: string): Promise<boolean> =>
  stat(ruta).then(
    () => true,
    () => false
  )

interface LlamadaExportar {
  args: Record<string, unknown>
  opciones: OpcionesEjecucion
  resolver(r: Record<string, unknown>): void
  rechazar(e: unknown): void
}

interface StdinFalso {
  escritos: number
  cerrado: boolean
  destruido: boolean
}

let raiz: string
let datos: string
let videos: string
let ahoraMs: number

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'shinobi-servicio-exp-'))
  datos = join(raiz, 'datos')
  videos = join(raiz, 'videos')
  await mkdir(videos, { recursive: true })
  ahoraMs = Date.UTC(2026, 10, 20, 10, 0, 0)
  for (const id of [ID_A, ID_B]) {
    await mkdir(join(datos, 'biblioteca', id, 'pistas'), { recursive: true })
    await writeFile(join(datos, 'biblioteca', id, 'pistas', 'instrumental.flac'), 'i')
    await writeFile(join(datos, 'biblioteca', id, 'pistas', 'voz.flac'), 'v')
  }
})
afterEach(() => rm(raiz, { recursive: true, force: true }))

function cancionDe(id: string, extra: Partial<Cancion> = {}, titulo?: string): Cancion {
  const base = lista()
  return {
    ...base,
    id,
    metadatos: {
      ...base.metadatos,
      titulo: titulo ?? (id === ID_B ? 'Otra' : 'Mi canción'),
      artista: 'Yo',
      duracion_ms: 1000
    },
    pistas: {
      voz: 'pistas/voz.flac',
      instrumental: 'pistas/instrumental.flac',
      modelo: { perfil: 'calidad', nombre: 'm', version: '1' }
    },
    ...extra
  }
}

interface Opciones {
  canciones?: Record<string, Cancion>
  memoria?: number
  capacidades?: () => Promise<Record<string, unknown>>
  disco?: Partial<DiscoDestinos>
  borrarDiario?: (ruta: string) => Promise<void>
  /** Cuánto espera `capturar` por fotograma (puerta). */
  puertaCaptura?: () => Promise<void>
  ventanaFalla?: boolean
}

function montar(o: Opciones = {}) {
  const canciones = o.canciones ?? { [ID_A]: cancionDe(ID_A), [ID_B]: cancionDe(ID_B) }
  const config: Config = configPredeterminada()
  const actualizar = vi.fn(async (p: { exportacion?: Partial<Config['exportacion']> }) => {
    Object.assign(config.exportacion, p.exportacion)
  })
  const llamadas: LlamadaExportar[] = []
  const sondeos = vi.fn()
  const stdins: StdinFalso[] = []
  const ventanas: { opciones: OpcionesExportacion; destruir: ReturnType<typeof vi.fn> }[] = []

  const ejecutar: DependenciasServicioExportacion['ejecutar'] = (comando, args, opciones = {}) => {
    if (comando === 'capacidades-exportacion') {
      sondeos()
      return (
        o.capacidades?.() ??
        Promise.resolve({
          formatos: {
            mkv_av1: { disponible: true, max_16_9: true, max_4_3: true },
            webm_vp9: { disponible: true, max_16_9: true, max_4_3: true }
          }
        })
      )
    }
    return new Promise((resolver, rechazar) => {
      const llamada: LlamadaExportar = { args, opciones, resolver, rechazar }
      llamadas.push(llamada)
      const stdin: StdinFalso = { escritos: 0, cerrado: false, destruido: false }
      stdins.push(stdin)
      // El worker real crea el temporal; lo que queda tras matarlo lo limpia main.
      const creado = writeFile(String(args.temporal), 'parcial').catch(() => undefined)
      const cancelado = () =>
        // El proceso real ya no escribe cuando `ejecutar` rechaza.
        void creado.then(() =>
          rechazar({ codigo: 'CANCELADO', mensaje: 'Trabajo cancelado', reintentable: false })
        )
      if (opciones.señal?.aborted) cancelado()
      else opciones.señal?.addEventListener('abort', cancelado)
      opciones.alEntrada?.({
        write: () => {
          stdin.escritos++
          return true
        },
        writableLength: 0,
        writableEnded: false,
        once: () => undefined,
        off: () => undefined,
        end: () => {
          stdin.cerrado = true
          // Con la entrada completa, el worker «codifica» y responde.
          void (async () => {
            await creado
            await writeFile(String(args.temporal), 'video').catch(() => undefined)
            resolver({ bytes: 5, fotogramas: args.total_fotogramas, duracion_ms: 1000 })
          })()
        },
        destroy: () => {
          stdin.destruido = true
        }
      } as never)
    })
  }

  const disco: DiscoDestinos = { ...discoReal, ...o.disco }
  const destinos = new Destinos({
    disco,
    dialogoGuardar: async () => null,
    directorioDatos: datos,
    carpetaVideos: () => videos,
    carpetaHogar: () => videos
  })
  const diario = new DiarioExportacion(
    datos,
    o.borrarDiario ? { borrarArchivo: o.borrarDiario } : {}
  )
  const mostrarEnCarpeta = vi.fn()
  const avisarSistema = vi.fn()
  const bloqueador = (() => {
    let activo = false
    return {
      start: vi.fn(() => {
        activo = true
        return 7
      }),
      stop: vi.fn(() => {
        activo = false
      }),
      isStarted: () => activo
    }
  })()
  const crearVentana = vi.fn(async (opciones: OpcionesExportacion): Promise<VentanaExportacion> => {
    if (o.ventanaFalla) throw Object.assign(new Error('sin ventana'), { codigo: 'ERROR_INTERNO' })
    let romper: (e: Error) => void = () => undefined
    const rota = new Promise<never>((_, rechazar) => {
      romper = rechazar
    })
    rota.catch(() => undefined)
    const destruir = vi.fn(() => romper(new Error('ventana destruida')))
    ventanas.push({ opciones, destruir })
    return {
      trabajoId: opciones.trabajoId,
      lista: Promise.resolve(),
      inicial: () => {
        throw new Error('no se usa')
      },
      pintar: async () => undefined,
      capturar: async () => {
        await Promise.race([o.puertaCaptura?.() ?? Promise.resolve(), rota])
        return Buffer.alloc(opciones.ancho * opciones.alto * 4)
      },
      confirmarListo: () => undefined,
      destruir
    }
  })
  const servicio = new ServicioExportacion({
    biblioteca: {
      obtener: (id) => canciones[id] ?? null,
      estiloDe: () => estiloPredeterminado()
    },
    dirDatos: datos,
    config: { obtener: () => config, actualizar },
    destinos,
    diario,
    ejecutar,
    crearVentana,
    ventanaPrincipal: () => null,
    mostrarEnCarpeta,
    avisarSistema,
    bloqueador,
    memoriaTotal: () => o.memoria ?? 16 * GIB,
    nucleos: () => 8,
    plataforma: 'linux',
    ahora: () => ahoraMs,
    registrar: () => undefined
  })
  const cambios: ExportacionIpc[] = []
  servicio.suscribir((e) => cambios.push(e))
  return {
    servicio,
    config,
    actualizar,
    llamadas,
    sondeos,
    stdins,
    ventanas,
    diario,
    destinos,
    mostrarEnCarpeta,
    avisarSistema,
    bloqueador,
    cambios,
    canciones,
    crearVentana,
    ultimo: (id: string) => cambios.filter((c) => c.trabajoId === id).at(-1)
  }
}

type Montaje = ReturnType<typeof montar>

async function iniciar(
  m: Montaje,
  cancionId = ID_A,
  extra: {
    formato?: 'mkv_av1' | 'webm_vp9'
    ancho?: number
    alto?: number
    fps?: 24 | 30 | 60
  } = {}
) {
  const formato = extra.formato ?? 'mkv_av1'
  const destino = await m.servicio.destinoPropuesto({ cancionId, formato })
  const r = await m.servicio.iniciar({
    cancionId,
    formato,
    ancho: extra.ancho ?? 640,
    alto: extra.alto ?? 480,
    fps: extra.fps ?? 24,
    audio: 'instrumental',
    destinoId: destino.destinoId
  })
  return { ...r, destino }
}

/** Detiene `capturar` hasta `abrir()`: la exportación queda en curso para que la prueba actúe. */
function puerta() {
  let abrir!: () => void
  const promesa = new Promise<void>((r) => (abrir = r))
  return { esperar: () => promesa, abrir }
}

const hasta = (cond: () => boolean) => vi.waitFor(() => expect(cond()).toBe(true))

describe('éxito', () => {
  it('worker, ventana y bucle producen el archivo en el destino y limpian todo', async () => {
    const m = montar()
    const { trabajoId, destino } = await iniciar(m)
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    const e = m.ultimo(trabajoId)!
    expect(e).toMatchObject({
      resultado: 'completada',
      error: null,
      bytes: 5,
      fotogramas: 24,
      limpiezaFallida: false,
      destinoExistia: false,
      archivo: 'Mi canción — Yo (karaoke).mkv',
      iniciadaEn: '2026-11-20T10:00:00.000Z',
      terminadaEn: '2026-11-20T10:00:00.000Z'
    })
    expect(await readFile(destino.ruta, 'utf8')).toBe('video')
    // Sin temporal ni diario.
    expect(await existe(m.destinos.rutaTemporal(destino.ruta, trabajoId))).toBe(false)
    expect(await existe(m.diario.ruta)).toBe(false)
    expect(m.stdins[0]).toMatchObject({ escritos: 24, cerrado: true })
    expect(m.ventanas[0]!.destruir).toHaveBeenCalled()
    expect(m.avisarSistema).toHaveBeenCalledWith('«Mi canción»: video exportado.')
    // Suspensión: tomada y liberada.
    expect(m.bloqueador.start).toHaveBeenCalledWith('prevent-app-suspension')
    expect(m.bloqueador.stop).toHaveBeenCalledWith(7)
    // Preferencias y carpeta recordada.
    expect(m.config.exportacion).toMatchObject({
      formato: 'mkv_av1',
      ancho: 640,
      alto: 480,
      fps: 24,
      carpeta: videos
    })
  })

  it('lanza el worker con la tubería, la prioridad baja y los parámetros del perfil', async () => {
    const m = montar()
    await iniciar(m, ID_A, { formato: 'webm_vp9', ancho: 1920, alto: 1080, fps: 30 })
    await hasta(() => m.llamadas.length === 1)
    const { args, opciones } = m.llamadas[0]!
    expect(opciones).toMatchObject({ entrada: 'tuberia', prioridad: 'baja' })
    expect(args).toMatchObject({
      formato: 'webm_vp9',
      ancho: 1920,
      alto: 1080,
      fps: 30,
      total_fotogramas: 30,
      duracion_ms: 1000,
      hilos: 7,
      parametros: { cpu_used: 8, crf: 32 },
      audio: {
        instrumental: join(datos, 'biblioteca', ID_A, 'pistas', 'instrumental.flac'),
        voz: null
      }
    })
    expect(String(args.temporal)).toMatch(/\.shinobi-parcial$/)
  })

  it('el factor corrector aprende de lo que tardó', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    const { trabajoId } = await iniciar(m)
    await hasta(() => m.llamadas.length === 1)
    ahoraMs += 2000
    g.abrir() // estimado: round(0,6 × 1 s) = 1 s; real 2 s → media móvil de 1 y 2
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.config.exportacion.factor_corrector).toBeCloseTo(1.5, 5)
  })
})

describe('cancelación y fallos', () => {
  it('cancelar en curso mata el worker y limpia temporal y diario', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    const { trabajoId, destino } = await iniciar(m)
    await hasta(() => m.llamadas.length === 1 && m.ventanas.length === 1)
    await m.servicio.cancelar(trabajoId)
    g.abrir()
    const e = m.ultimo(trabajoId)!
    expect(e).toMatchObject({ estado: 'terminada', resultado: 'cancelada', error: null })
    expect(e.limpiezaFallida).toBe(false)
    expect(await existe(m.destinos.rutaTemporal(destino.ruta, trabajoId))).toBe(false)
    expect(await existe(destino.ruta)).toBe(false)
    expect(await existe(m.diario.ruta)).toBe(false)
    expect(m.ventanas[0]!.destruir).toHaveBeenCalled()
    expect(m.avisarSistema).not.toHaveBeenCalled()
    expect(m.bloqueador.stop).toHaveBeenCalled()
  })

  it('cancelar una exportación en cola la quita sin rastro y la siguiente avanza', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    const primera = await iniciar(m, ID_A)
    const segunda = await iniciar(m, ID_B)
    expect(m.ultimo(segunda.trabajoId)).toMatchObject({ estado: 'en_cola', posicion: 1 })
    await m.servicio.cancelar(segunda.trabajoId)
    expect(m.ultimo(segunda.trabajoId)).toMatchObject({
      estado: 'terminada',
      resultado: 'cancelada'
    })
    await hasta(() => m.llamadas.length === 1)
    g.abrir()
    await hasta(() => m.ultimo(primera.trabajoId)?.estado === 'terminada')
    expect(m.llamadas).toHaveLength(1)
  })

  it('un fallo del worker da su código con la posición alcanzada y limpia', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    const { trabajoId, destino } = await iniciar(m)
    await hasta(() => m.llamadas.length === 1)
    m.llamadas[0]!.opciones.alProgreso?.({
      tipo: 'progreso',
      fase: 'codificando',
      valor: 0.5,
      detalle: { fotograma: 12, total: 24 }
    })
    m.llamadas[0]!.rechazar({ codigo: 'SIN_ESPACIO', mensaje: 'Disco lleno', reintentable: false })
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.ultimo(trabajoId)).toMatchObject({
      resultado: 'error',
      error: { codigo: 'SIN_ESPACIO', posicionMs: 500 }
    })
    expect(await existe(m.destinos.rutaTemporal(destino.ruta, trabajoId))).toBe(false)
    expect(await existe(m.diario.ruta)).toBe(false)
    expect(m.avisarSistema).toHaveBeenCalledWith('«Mi canción»: no se pudo exportar el video.')
  })

  it('PROCESO_TERMINADO es MEMORIA_INSUFICIENTE; sin fotogramas, posicionMs es null', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    const { trabajoId } = await iniciar(m)
    await hasta(() => m.llamadas.length === 1)
    m.llamadas[0]!.rechazar({ codigo: 'PROCESO_TERMINADO', mensaje: 'x', reintentable: true })
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.ultimo(trabajoId)!.error).toMatchObject({
      codigo: 'MEMORIA_INSUFICIENTE',
      posicionMs: null
    })
  })

  it('un fallo de rename da DESTINO_NO_DISPONIBLE y deja intacto el archivo anterior', async () => {
    const m = montar({
      disco: {
        renombrar: async () => {
          throw Object.assign(new Error('ocupado'), { code: 'EBUSY' })
        }
      }
    })
    const destino = await m.servicio.destinoPropuesto({ cancionId: ID_A, formato: 'mkv_av1' })
    await writeFile(destino.ruta, 'anterior')
    const { trabajoId } = await m.servicio.iniciar({
      cancionId: ID_A,
      formato: 'mkv_av1',
      ancho: 640,
      alto: 480,
      fps: 24,
      audio: 'instrumental',
      destinoId: destino.destinoId
    })
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.ultimo(trabajoId)).toMatchObject({
      resultado: 'error',
      destinoExistia: true,
      error: { codigo: 'DESTINO_NO_DISPONIBLE' }
    })
    expect(await readFile(destino.ruta, 'utf8')).toBe('anterior')
    expect(await existe(m.destinos.rutaTemporal(destino.ruta, trabajoId))).toBe(false)
  })

  it('si el temporal no se puede borrar: limpiezaFallida con el resultado real y «mostrar» lo señala', async () => {
    const g = puerta()
    const m = montar({
      puertaCaptura: g.esperar,
      disco: {
        borrar: async (ruta) => {
          if (ruta.endsWith('.shinobi-parcial')) throw new Error('EBUSY')
          await discoReal.borrar(ruta)
        }
      }
    })
    const { trabajoId, destino } = await iniciar(m)
    await hasta(() => m.llamadas.length === 1)
    await m.servicio.cancelar(trabajoId)
    expect(m.ultimo(trabajoId)).toMatchObject({
      resultado: 'cancelada',
      error: null,
      limpiezaFallida: true
    })
    // El diario se borra igual.
    expect(await existe(m.diario.ruta)).toBe(false)
    await m.servicio.mostrarEnCarpeta({ trabajoId })
    expect(m.mostrarEnCarpeta).toHaveBeenCalledWith(
      m.destinos.rutaTemporal(destino.ruta, trabajoId)
    )
  })

  it('la caída de la ventana offscreen es ERROR_INTERNO y mata el worker', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    const { trabajoId } = await iniciar(m)
    await hasta(() => m.ventanas.length === 1)
    m.ventanas[0]!.opciones.alCaer?.(
      Object.assign(new Error('renderer caído'), { codigo: 'ERROR_INTERNO' })
    )
    g.abrir()
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.ultimo(trabajoId)).toMatchObject({
      resultado: 'error',
      error: { codigo: 'ERROR_INTERNO' }
    })
    expect(m.ventanas[0]!.destruir).toHaveBeenCalled()
  })

  it('ENTRADA_INCOMPLETA del worker se traduce a ERROR_INTERNO', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    const { trabajoId } = await iniciar(m)
    await hasta(() => m.llamadas.length === 1)
    m.llamadas[0]!.rechazar({ codigo: 'ENTRADA_INCOMPLETA', mensaje: 'x', reintentable: false })
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.ultimo(trabajoId)!.error).toMatchObject({ codigo: 'ERROR_INTERNO' })
  })

  it('no se puede crear la ventana: falla y el worker se mata', async () => {
    const m = montar({ ventanaFalla: true })
    const { trabajoId } = await iniciar(m)
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.ultimo(trabajoId)).toMatchObject({
      resultado: 'error',
      error: { codigo: 'ERROR_INTERNO' }
    })
  })
})

describe('validaciones y destinos', () => {
  it('un rechazo no consume el destinoId; aceptar sí lo consume', async () => {
    const m = montar({
      canciones: {
        [ID_A]: cancionDe(ID_A, { letra: { ...lista().letra!, lineas: [] } }),
        [ID_B]: cancionDe(ID_B, {}, 'Mi canción')
      }
    })
    const destino = await m.servicio.destinoPropuesto({ cancionId: ID_A, formato: 'mkv_av1' })
    const peticion = {
      cancionId: ID_A,
      formato: 'mkv_av1' as const,
      ancho: 640,
      alto: 480,
      fps: 24 as const,
      audio: 'instrumental' as const,
      destinoId: destino.destinoId
    }
    await expect(m.servicio.iniciar(peticion)).rejects.toMatchObject({
      codigo: 'CANCION_NO_DISPONIBLE'
    })
    expect(m.destinos.rutaDe(destino.destinoId)).toBe(destino.ruta)
    // Misma ruta, otra canción: la acepta y gasta el id.
    await m.servicio.iniciar({ ...peticion, cancionId: ID_B })
    expect(m.destinos.rutaDe(destino.destinoId)).toBeNull()
    await expect(m.servicio.iniciar({ ...peticion, cancionId: ID_B })).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
  })

  it('DESTINO_OCUPADO con el mismo destino que otra exportación en cola; el id sigue valiendo', async () => {
    const g = puerta()
    const m = montar({
      puertaCaptura: g.esperar,
      canciones: { [ID_A]: cancionDe(ID_A), [ID_B]: cancionDe(ID_B, {}, 'Mi canción') }
    })
    await iniciar(m, ID_A)
    const mismo = await m.servicio.destinoPropuesto({ cancionId: ID_B, formato: 'mkv_av1' })
    expect(mismo.ruta).toContain('Mi canción — Yo (karaoke).mkv')
    await expect(
      m.servicio.iniciar({
        cancionId: ID_B,
        formato: 'mkv_av1',
        ancho: 640,
        alto: 480,
        fps: 24,
        audio: 'instrumental',
        destinoId: mismo.destinoId
      })
    ).rejects.toMatchObject({ codigo: 'DESTINO_OCUPADO' })
    expect(m.destinos.rutaDe(mismo.destinoId)).toBe(mismo.ruta)
  })

  it('la segunda exportación espera y empieza sola; la misma canción se rechaza', async () => {
    const g = puerta()
    const m = montar({
      puertaCaptura: g.esperar,
      canciones: {
        [ID_A]: cancionDe(ID_A),
        [ID_B]: cancionDe(ID_B, { metadatos: { ...cancionDe(ID_B).metadatos, titulo: 'Otra' } })
      }
    })
    const primera = await iniciar(m, ID_A)
    const segunda = await iniciar(m, ID_B)
    expect(m.ultimo(primera.trabajoId)!.estado).toBe('en_curso')
    expect(m.ultimo(segunda.trabajoId)).toMatchObject({ estado: 'en_cola', posicion: 1 })
    const otro = await m.servicio.destinoPropuesto({ cancionId: ID_A, formato: 'webm_vp9' })
    await expect(
      m.servicio.iniciar({
        cancionId: ID_A,
        formato: 'webm_vp9',
        ancho: 640,
        alto: 480,
        fps: 24,
        audio: 'instrumental',
        destinoId: otro.destinoId
      })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    g.abrir()
    await hasta(() => m.ultimo(segunda.trabajoId)?.estado === 'terminada')
    expect(m.ultimo(primera.trabajoId)!.resultado).toBe('completada')
    expect(m.ultimo(segunda.trabajoId)!.resultado).toBe('completada')
    expect(m.servicio.hayEnCurso()).toBe(false)
  })

  it('hayEnCurso cuenta una exportación en cola', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    expect(m.servicio.hayEnCurso()).toBe(false)
    await iniciar(m, ID_A)
    expect(m.servicio.hayEnCurso()).toBe(true)
    await m.servicio.cancelarTodas()
    expect(m.servicio.hayEnCurso()).toBe(false)
  })

  it('editar la canción durante la exportación no cambia la instantánea (V14)', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    const { trabajoId } = await iniciar(m)
    await hasta(() => m.ventanas.length === 1)
    const original = m.ventanas[0]!.opciones.inicial!.instantanea.letra.lineas.length
    const c = m.canciones[ID_A]!
    c.letra!.lineas.length = 0
    c.metadatos.titulo = 'Cambiado'
    expect(m.ventanas[0]!.opciones.inicial!.instantanea.letra.lineas).toHaveLength(original)
    expect(m.ventanas[0]!.opciones.inicial!.instantanea.titulo).toBe('Mi canción')
    g.abrir()
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.ultimo(trabajoId)!.titulo).toBe('Mi canción')
  })

  it('cancelarDeCancion cancela la en curso y la en cola de esa canción', async () => {
    const g = puerta()
    const m = montar({
      puertaCaptura: g.esperar,
      canciones: {
        [ID_A]: cancionDe(ID_A),
        [ID_B]: cancionDe(ID_B, { metadatos: { ...cancionDe(ID_B).metadatos, titulo: 'Otra' } })
      }
    })
    const a = await iniciar(m, ID_A)
    const b = await iniciar(m, ID_B)
    await m.servicio.cancelarDeCancion(ID_B)
    expect(m.ultimo(b.trabajoId)!.resultado).toBe('cancelada')
    expect(m.ultimo(a.trabajoId)!.estado).not.toBe('terminada')
    await m.servicio.cancelarDeCancion(ID_A)
    expect(m.ultimo(a.trabajoId)!.resultado).toBe('cancelada')
  })

  it('destinoPropuesto({ desdeTrabajoId }) repite carpeta y nombre con la extensión del formato', async () => {
    const m = montar()
    const { trabajoId, destino } = await iniciar(m)
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    const mismo = await m.servicio.destinoPropuesto({
      cancionId: ID_A,
      formato: 'mkv_av1',
      desdeTrabajoId: trabajoId
    })
    expect(mismo.ruta).toBe(destino.ruta)
    expect(mismo.existe).toBe(true)
    const otro = await m.servicio.destinoPropuesto({
      cancionId: ID_A,
      formato: 'webm_vp9',
      desdeTrabajoId: trabajoId
    })
    expect(otro.ruta).toBe(destino.ruta.replace(/\.mkv$/, '.webm'))
    // Trabajo desconocido: el propuesto normal.
    const normal = await m.servicio.destinoPropuesto({
      cancionId: ID_A,
      formato: 'mkv_av1',
      desdeTrabajoId: 'b0000000-0000-4000-8000-0000000000ff'
    })
    expect(normal.ruta).toBe(destino.ruta)
  })

  it('estado() incluye las terminadas de la sesión', async () => {
    const m = montar()
    const { trabajoId } = await iniciar(m)
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.servicio.estado().map((e) => e.trabajoId)).toEqual([trabajoId])
  })
})

describe('perfiles', () => {
  it('con 7,5 GiB se ofrece 2160 líneas y con 6 GiB sale motivo memoria', async () => {
    const con = await montar({ memoria: 7.5 * GIB }).servicio.perfiles()
    const grande = (p: (typeof con.perfiles)[number]) => p.alto === 2160
    expect(con.perfiles).toHaveLength(48)
    expect(con.perfiles.filter(grande).every((p) => p.soportado && p.motivo === null)).toBe(true)
    const sin = await montar({ memoria: 6 * GIB }).servicio.perfiles()
    expect(sin.perfiles.filter(grande).every((p) => !p.soportado && p.motivo === 'memoria')).toBe(
      true
    )
    expect(sin.perfiles.filter((p) => !grande(p)).every((p) => p.soportado)).toBe(true)
  })

  it('un codificador que no abre la resolución máxima marca el perfil con motivo codificador', async () => {
    const m = montar({
      capacidades: async () => ({
        formatos: {
          mkv_av1: { disponible: true, max_16_9: false, max_4_3: true },
          webm_vp9: { disponible: false, max_16_9: false, max_4_3: false }
        }
      })
    })
    const p = await m.servicio.perfiles()
    const de = (formato: string, ancho: number, alto: number, fps: number) =>
      p.perfiles.find(
        (x) => x.formato === formato && x.ancho === ancho && x.alto === alto && x.fps === fps
      )
    expect(de('mkv_av1', 1920, 1080, 30)).toMatchObject({ soportado: false, motivo: 'codificador' })
    expect(de('mkv_av1', 1024, 768, 30)).toMatchObject({ soportado: true })
    expect(de('webm_vp9', 1024, 768, 30)).toMatchObject({ motivo: 'codificador' })
  })

  it('el sondeo se hace una vez; un fallo no se recuerda', async () => {
    let fallar = true
    const m = montar({
      capacidades: async () => {
        if (fallar) throw { codigo: 'PROCESO_TERMINADO', mensaje: 'x', reintentable: true }
        return {
          formatos: {
            mkv_av1: { disponible: true, max_16_9: true, max_4_3: true },
            webm_vp9: { disponible: true, max_16_9: true, max_4_3: true }
          }
        }
      }
    })
    const mal = await m.servicio.perfiles()
    expect(mal.perfiles.every((p) => !p.soportado && p.motivo === 'no_comprobado')).toBe(true)
    fallar = false
    const bien = await m.servicio.perfiles()
    expect(bien.perfiles.every((p) => p.soportado)).toBe(true)
    await m.servicio.perfiles()
    expect(m.sondeos).toHaveBeenCalledTimes(2)
  })

  it('sin motor de audio, perfiles() rechaza con RUNTIME_NO_DISPONIBLE', async () => {
    const m = montar({
      capacidades: async () => {
        throw { codigo: 'RUNTIME_NO_DISPONIBLE', mensaje: 'x', reintentable: false }
      }
    })
    await expect(m.servicio.perfiles()).rejects.toMatchObject({ codigo: 'RUNTIME_NO_DISPONIBLE' })
  })

  it('iniciar con un perfil no soportado lo rechaza sin consumir el destino', async () => {
    const m = montar({ memoria: 4 * GIB })
    const destino = await m.servicio.destinoPropuesto({ cancionId: ID_A, formato: 'mkv_av1' })
    await expect(
      m.servicio.iniciar({
        cancionId: ID_A,
        formato: 'mkv_av1',
        ancho: 3840,
        alto: 2160,
        fps: 30,
        audio: 'instrumental',
        destinoId: destino.destinoId
      })
    ).rejects.toMatchObject({ codigo: 'PERFIL_NO_SOPORTADO' })
    expect(m.destinos.rutaDe(destino.destinoId)).toBe(destino.ruta)
  })
})

describe('arranque y avisos', () => {
  const entrada = (temporal: string) => ({
    trabajoId: 'b0000000-0000-4000-8000-000000000009',
    cancionId: ID_A,
    titulo: 'Mi canción',
    temporal,
    destino: join(videos, 'a.mkv'),
    inicio: 1
  })

  it('un diario de una caída da un único aviso «interrumpida», aunque la principal se suscriba tarde', async () => {
    const m = montar()
    const temporal = join(videos, '.a.mkv.00000009.shinobi-parcial')
    await writeFile(temporal, 'parcial')
    await m.diario.escribir(entrada(temporal))
    const emitidos: unknown[] = []
    m.servicio.suscribirAviso((a) => emitidos.push(a))
    await m.servicio.recuperarAlArrancar()
    await m.servicio.recuperarAlArrancar()
    expect(emitidos).toHaveLength(1)
    const lista = m.servicio.avisosPendientes()
    expect(lista).toEqual([
      expect.objectContaining({ tipo: 'interrumpida', cancionId: ID_A, titulo: 'Mi canción' })
    ])
    expect(m.servicio.avisosPendientes()).toEqual([])
    expect(await existe(temporal)).toBe(false)
  })

  it('si el temporal no se puede borrar, el aviso es «limpieza_fallida» y se muestra por avisoId', async () => {
    const temporal = join(videos, '.a.mkv.00000009.shinobi-parcial')
    const m = montar({
      borrarDiario: async (ruta) => {
        if (ruta === temporal) throw new Error('EBUSY')
        await rm(ruta, { force: true })
      }
    })
    await writeFile(temporal, 'parcial')
    await m.diario.escribir(entrada(temporal))
    await m.servicio.recuperarAlArrancar()
    const [aviso] = m.servicio.avisosPendientes()
    expect(aviso).toMatchObject({ tipo: 'limpieza_fallida', titulo: 'Mi canción' })
    await m.servicio.mostrarEnCarpeta({ avisoId: aviso!.avisoId })
    expect(m.mostrarEnCarpeta).toHaveBeenCalledWith(temporal)
    await expect(m.servicio.mostrarEnCarpeta({ avisoId: 'desconocido' })).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
  })

  it('«Mostrar en la carpeta» de un trabajo completado señala el destino; si no existe, rechaza', async () => {
    const m = montar()
    const { trabajoId, destino } = await iniciar(m)
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    await m.servicio.mostrarEnCarpeta({ trabajoId })
    expect(m.mostrarEnCarpeta).toHaveBeenCalledWith(destino.ruta)
    await rm(destino.ruta)
    await expect(m.servicio.mostrarEnCarpeta({ trabajoId })).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
  })
})

describe('progreso', () => {
  it('como mucho 4 por segundo, y la ETA es null los primeros 15 s', async () => {
    const g = puerta()
    const m = montar({ puertaCaptura: g.esperar })
    const progresos: { fotograma: number; etaSegundos: number | null }[] = []
    m.servicio.suscribirProgreso((p) => progresos.push(p))
    const { trabajoId } = await iniciar(m)
    await hasta(() => m.llamadas.length === 1)
    const enviar = (fotograma: number) =>
      m.llamadas[0]!.opciones.alProgreso?.({
        tipo: 'progreso',
        fase: 'codificando',
        valor: fotograma / 24,
        detalle: { fotograma, total: 24 }
      })
    enviar(1)
    ahoraMs += 10
    enviar(2) // dentro de los 250 ms: no se emite
    ahoraMs += INTERVALO_MIN_PROGRESO_MS
    enviar(3)
    expect(progresos.map((p) => p.fotograma)).toEqual([1, 3])
    expect(progresos.every((p) => p.etaSegundos === null)).toBe(true)
    ahoraMs += 16_000
    enviar(8)
    expect(progresos.at(-1)!.etaSegundos).not.toBeNull()
    expect(m.servicio.estado()[0]!.progreso!.fotograma).toBe(8)
    g.abrir()
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
  })
})
