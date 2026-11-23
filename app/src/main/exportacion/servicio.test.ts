import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configPredeterminada, type Config } from '../../shared/config'
import type { Cancion } from '../../shared/cancion'
import { estiloPredeterminado } from '../../shared/estilo'
import type { ExportacionIpc } from '../../shared/exportacion'
import { lista, linea } from '../../shared/__fixtures__'
import { envolvente, tramosCoro } from '../../shared/coros'
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
// El servicio puede seguir escribiendo el diario cuando acaba la prueba: `rm` reintenta ante ENOTEMPTY.
afterEach(() => rm(raiz, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }))

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
  /** La ventana doble nunca asienta la captura. */
  sinAsentar?: boolean
  probarCaptura?: (ancho: number, alto: number) => Promise<boolean>
  plazoSondeoCapturaMs?: number
  /** Lotes: carpeta que devuelve el selector de carpetas del sistema. */
  carpetaElegida?: string | null
  libreBytes?: number | null
  /** Lotes: el worker de la n-ésima exportación (1, 2…) falla con este error. */
  falla?: Record<number, { codigo: string; mensaje: string }>
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
      const falla = o.falla?.[llamadas.length]
      if (falla) {
        rechazar(falla)
        return
      }
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
    dialogoCarpeta: async () => o.carpetaElegida ?? null,
    directorioDatos: datos,
    carpetaVideos: () => videos,
    carpetaHogar: () => videos
  })
  const diario = new DiarioExportacion(
    datos,
    o.borrarDiario ? { borrarArchivo: o.borrarDiario } : {}
  )
  const mostrarEnCarpeta = vi.fn()
  const abrirCarpeta = vi.fn((ruta: string) => Promise.resolve(ruta && ''))
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
        return {
          imagen: Buffer.alloc(opciones.ancho * opciones.alto * 4),
          asentada: !o.sinAsentar,
          intentos: o.sinAsentar ? 5 : 2
        }
      },
      confirmarListo: () => undefined,
      destruir
    }
  })
  const registrar = vi.fn()
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
    abrirCarpeta,
    avisarSistema,
    ...(o.libreBytes !== undefined ? { libreBytes: async () => o.libreBytes ?? null } : {}),
    bloqueador,
    memoriaTotal: () => o.memoria ?? 16 * GIB,
    nucleos: () => 8,
    plataforma: 'linux',
    ahora: () => ahoraMs,
    registrar,
    ...(o.probarCaptura ? { probarCaptura: o.probarCaptura } : {}),
    ...(o.plazoSondeoCapturaMs ? { plazoSondeoCapturaMs: o.plazoSondeoCapturaMs } : {})
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
    abrirCarpeta,
    avisarSistema,
    bloqueador,
    cambios,
    canciones,
    crearVentana,
    registrar,
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
    audio?: 'instrumental' | 'instrumental_voz'
    coros?: boolean
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
    audio: extra.audio ?? 'instrumental',
    ...(extra.coros !== undefined ? { coros: extra.coros } : {}),
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

  it('anota en el registro los fotogramas no asentados y calla si todo se asienta', async () => {
    const m = montar({ sinAsentar: true })
    const { trabajoId } = await iniciar(m)
    await hasta(() => m.ultimo(trabajoId)?.estado === 'terminada')
    expect(m.ultimo(trabajoId)).toMatchObject({ resultado: 'completada', fotogramas: 24 })
    expect(m.registrar).toHaveBeenCalledTimes(1)
    expect(m.registrar).toHaveBeenCalledWith('aviso', expect.stringContaining('24 de 24'))
    const limpio = montar()
    const r = await iniciar(limpio)
    await hasta(() => limpio.ultimo(r.trabajoId)?.estado === 'terminada')
    expect(limpio.registrar).not.toHaveBeenCalled()
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
    // Cancelar es `info`, nunca `error`.
    expect(m.registrar).toHaveBeenCalledTimes(1)
    expect(m.registrar).toHaveBeenCalledWith(
      'info',
      expect.stringContaining(`exportación ${trabajoId} cancelada en el fotograma`)
    )
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
    // Una sola línea de error, con código, mensaje, perfil y fotogramas.
    expect(m.registrar).toHaveBeenCalledTimes(1)
    expect(m.registrar).toHaveBeenCalledWith(
      'error',
      `exportación ${trabajoId} falló: SIN_ESPACIO: Disco lleno · MKV AV1 640×480 a 24 fps, audio instrumental · 12 de 24 fotogramas`
    )
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
    expect(m.registrar).toHaveBeenCalledTimes(1)
    expect(m.registrar).toHaveBeenCalledWith(
      'error',
      expect.stringContaining(`exportación ${trabajoId} falló: DESTINO_NO_DISPONIBLE`)
    )
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
    expect(m.registrar).toHaveBeenCalledTimes(1)
    expect(m.registrar).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('falló: ERROR_INTERNO')
    )
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
    ).rejects.toMatchObject({
      codigo: 'CANCION_EXPORTANDOSE',
      detalle: { trabajoId: primera.trabajoId },
      detalles: JSON.stringify({ trabajoId: primera.trabajoId })
    })
    g.abrir()
    await hasta(() => m.ultimo(segunda.trabajoId)?.estado === 'terminada')
    expect(m.ultimo(primera.trabajoId)!.resultado).toBe('completada')
    expect(m.ultimo(segunda.trabajoId)!.resultado).toBe('completada')
    expect(m.servicio.hayEnCurso()).toBe(false)
  })

  it('una carpeta sin permiso se rechaza al empezar, sin worker, ventana ni diario (V35)', async () => {
    let escribible = true
    const m = montar({ disco: { esCarpetaEscribible: async () => escribible } })
    const destino = await m.servicio.destinoPropuesto({ cancionId: ID_A, formato: 'mkv_av1' })
    escribible = false
    await expect(
      m.servicio.iniciar({
        cancionId: ID_A,
        formato: 'mkv_av1',
        ancho: 640,
        alto: 480,
        fps: 24,
        audio: 'instrumental',
        destinoId: destino.destinoId
      })
    ).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE',
      detalle: { campo: 'destino' }
    })
    expect(m.llamadas).toHaveLength(0)
    expect(m.crearVentana).not.toHaveBeenCalled()
    expect(m.servicio.hayEnCurso()).toBe(false)
    // El destinoId sigue vigente: elegir otra carpeta o arreglar permisos basta.
    expect(m.destinos.rutaDe(destino.destinoId)).toBe(destino.ruta)
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

describe('sondeo de captura (0260)', () => {
  const motivos = async (m: Montaje, alto: number) =>
    (await m.servicio.perfiles()).perfiles
      .filter((p) => p.alto === alto && p.formato === 'mkv_av1' && p.fps === 30)
      .map((p) => p.motivo)

  it('marca con `captura` lo mayor que el máximo capturable de cada proporción (V31)', async () => {
    const probarCaptura = vi.fn(async (_a: number, alto: number) => alto <= 1440)
    const m = montar({ probarCaptura })
    expect(await motivos(m, 2160)).toEqual(['captura', 'captura'])
    expect(await motivos(m, 1440)).toEqual([null])
    expect(await motivos(m, 1200)).toEqual([null])
    // Una vez por arranque: de 3840×2160 baja a 2560×1440 y de 2880×2160 a 1600×1200.
    expect(probarCaptura.mock.calls.map(([a, h]) => `${a}x${h}`)).toEqual([
      '3840x2160',
      '2560x1440',
      '2880x2160',
      '1600x1200'
    ])
    await m.servicio.perfiles()
    expect(probarCaptura).toHaveBeenCalledTimes(4)
  })

  it('lo no comprobado a los plazos sale `no_comprobado` (V32)', async () => {
    const m = montar({
      probarCaptura: () => new Promise<boolean>(() => undefined),
      plazoSondeoCapturaMs: 30
    })
    expect(await motivos(m, 1080)).toEqual(['no_comprobado'])
    expect(await motivos(m, 768)).toEqual(['no_comprobado'])
  })

  it('una excepción del sondeo no marca nada y se registra (V32)', async () => {
    const m = montar({ probarCaptura: () => Promise.reject(new Error('sin GPU')) })
    expect(await motivos(m, 2160)).toEqual([null, null])
    expect(m.registrar).toHaveBeenCalledWith('aviso', expect.stringContaining('sondeo de captura'))
  })

  it('un «no» seguido de una excepción deja marcado el tamaño que respondió «no»', async () => {
    let sondeos = 0
    const m = montar({
      probarCaptura: () =>
        sondeos++ % 2 === 0 ? Promise.resolve(false) : Promise.reject(new Error('UnknownVizError'))
    })
    expect(await motivos(m, 2160)).toEqual(['captura', 'captura'])
    expect(await motivos(m, 1440)).toEqual([null])
  })

  it.each([
    [true, true],
    [false, false]
  ])('un fallo de captura recomprueba: reintentable %s (V33)', async (vuelve, reintentable) => {
    let sondeos = 0
    const m = montar({
      probarCaptura: async () => (sondeos++ === 0 ? true : vuelve),
      ventanaFalla: false
    })
    m.crearVentana.mockImplementationOnce(async () => {
      throw Object.assign(new Error('La captura es de 639×480.'), {
        codigo: 'PERFIL_NO_SOPORTADO',
        causa: 'captura'
      })
    })
    const r = await iniciar(m, ID_A)
    await hasta(() => m.ultimo(r.trabajoId)?.estado === 'terminada')
    expect(m.ultimo(r.trabajoId)!.error).toMatchObject({
      codigo: 'PERFIL_NO_SOPORTADO',
      detalle: { causa: 'captura', reintentable }
    })
    const motivo = (await m.servicio.perfiles()).perfiles.find(
      (p) => p.formato === 'mkv_av1' && p.ancho === 640 && p.fps === 24
    )!.motivo
    expect(motivo).toBe(reintentable ? null : 'captura')
  })
})

describe('exportar varias canciones (lote, ADR 0026 §5)', () => {
  const IDS = ['c1', 'c2', 'c3', 'c4']
  const PERFIL = { formato: 'mkv_av1', ancho: 640, alto: 480, fps: 24 } as const

  /** Cuatro canciones sintéticas con títulos inventados (dos comparten título y artista). */
  async function montarLote(o: Opciones = {}) {
    const canciones: Record<string, Cancion> = {}
    const titulos = ['Aurora', 'Brisa', 'Aurora', 'Cometa']
    for (const [i, id] of IDS.entries()) {
      await mkdir(join(datos, 'biblioteca', id, 'pistas'), { recursive: true })
      await writeFile(join(datos, 'biblioteca', id, 'pistas', 'instrumental.flac'), 'i')
      await writeFile(join(datos, 'biblioteca', id, 'pistas', 'voz.flac'), 'v')
      canciones[id] = cancionDe(id, {}, titulos[i])
    }
    const carpeta = join(raiz, 'salida')
    await mkdir(carpeta, { recursive: true })
    const m = montar({ canciones, carpetaElegida: carpeta, ...o })
    return { m, carpeta }
  }

  const pedir = async (
    m: Montaje,
    cancionIds: string[],
    extra: {
      siExiste?: 'numerar' | 'sustituir' | 'omitir'
      audio?: 'instrumental' | 'instrumental_voz'
      coros?: boolean
    } = {}
  ) => {
    const propuesta = (await m.servicio.destinoCarpeta())!
    return m.servicio.iniciarLote({
      cancionIds,
      ...PERFIL,
      audio: extra.audio ?? 'instrumental',
      ...(extra.coros !== undefined ? { coros: extra.coros } : {}),
      carpetaId: propuesta.carpetaId,
      siExiste: extra.siExiste ?? 'numerar'
    })
  }
  const terminado = (m: Montaje, trabajoId: string) => m.ultimo(trabajoId)?.estado === 'terminada'

  it('la carpeta se propone sin diálogo; «Cambiar…» abre el selector y rechaza la de los datos', async () => {
    const { m, carpeta } = await montarLote({ libreBytes: 5 * GIB })
    const propuesta = await m.servicio.destinoCarpeta()
    expect(propuesta).toMatchObject({ ruta: videos })
    const elegida = await m.servicio.destinoCarpeta(propuesta!.carpetaId)
    expect(elegida).toMatchObject({ ruta: carpeta })
    expect(elegida!.carpetaId).not.toBe(propuesta!.carpetaId)

    const m2 = montar({ carpetaElegida: null })
    const p2 = (await m2.servicio.destinoCarpeta())!
    expect(await m2.servicio.destinoCarpeta(p2.carpetaId)).toBeNull()
    const m3 = montar({ carpetaElegida: join(datos, 'biblioteca') })
    const p3 = (await m3.servicio.destinoCarpeta())!
    await expect(m3.servicio.destinoCarpeta(p3.carpetaId)).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE',
      detalle: { campo: 'destino' }
    })
  })

  it('encola todas en orden con el mismo loteId; los nombres repetidos se numeran', async () => {
    const { m } = await montarLote()
    const r = await pedir(m, IDS)
    expect(r.omitidas).toEqual([])
    expect(r.encoladas.map((e) => e.cancionId)).toEqual(IDS)
    for (const e of r.encoladas) await hasta(() => terminado(m, e.trabajoId))
    const finales = r.encoladas.map((e) => m.ultimo(e.trabajoId)!)
    expect(finales.every((f) => f.loteId === r.loteId && f.resultado === 'completada')).toBe(true)
    expect(finales.map((f) => f.archivo)).toEqual([
      'Aurora — Yo (karaoke).mkv',
      'Brisa — Yo (karaoke).mkv',
      'Aurora — Yo (karaoke) (2).mkv',
      'Cometa — Yo (karaoke).mkv'
    ])
    // Concurrencia 1: una a una.
    expect(m.llamadas.every((l) => l.args.total_fotogramas === 24)).toBe(true)
    // Un solo aviso del sistema por el lote, ninguno por video.
    expect(m.avisarSistema.mock.calls).toEqual([['4 videos exportados.']])
    // La última carpeta usada y las opciones se recuerdan.
    expect(m.config.exportacion).toMatchObject({ audio: 'instrumental', fps: 24 })
  })

  it('el carpetaId es de un solo uso', async () => {
    const { m } = await montarLote()
    const propuesta = (await m.servicio.destinoCarpeta())!
    const peticion = {
      cancionIds: ['c2'],
      ...PERFIL,
      audio: 'instrumental' as const,
      carpetaId: propuesta.carpetaId,
      siExiste: 'numerar' as const
    }
    await m.servicio.iniciarLote(peticion)
    await expect(m.servicio.iniciarLote(peticion)).rejects.toMatchObject({
      codigo: 'DESTINO_NO_DISPONIBLE'
    })
  })

  it.each([
    ['numerar', ['Brisa — Yo (karaoke) (2).mkv'], 'x'],
    ['sustituir', ['Brisa — Yo (karaoke).mkv'], 'video'],
    ['omitir', [], 'x']
  ] as const)(
    'siExiste «%s» con un video ya en la carpeta',
    async (siExiste, esperados, previo) => {
      const { m } = await montarLote()
      const propuesta = (await m.servicio.destinoCarpeta())!
      await writeFile(join(propuesta.ruta, 'Brisa — Yo (karaoke).mkv'), 'x')
      const r = await m.servicio.iniciarLote({
        cancionIds: ['c2'],
        ...PERFIL,
        audio: 'instrumental',
        carpetaId: propuesta.carpetaId,
        siExiste
      })
      expect(r.encoladas).toHaveLength(esperados.length)
      expect(r.omitidas).toEqual(siExiste === 'omitir' ? [{ id: 'c2', motivo: 'YA_EXISTE' }] : [])
      for (const e of r.encoladas) await hasta(() => terminado(m, e.trabajoId))
      expect(r.encoladas.map((e) => m.ultimo(e.trabajoId)!.archivo)).toEqual(esperados)
      // «Numerar» y «omitir» no tocan el existente; «sustituir» lo cambia al terminar bien.
      expect(await readFile(join(propuesta.ruta, 'Brisa — Yo (karaoke).mkv'), 'utf8')).toBe(
        previo === 'video' ? 'video' : 'x'
      )
    }
  )

  describe('previsualizar y mostrar la carpeta (0388)', () => {
    const previsualizar = async (
      m: Montaje,
      cancionIds: string[],
      siExiste: 'numerar' | 'sustituir' | 'omitir',
      carpetaId?: string
    ) =>
      m.servicio.previsualizarLote({
        cancionIds,
        formato: 'mkv_av1',
        carpetaId: carpetaId ?? (await m.servicio.destinoCarpeta())!.carpetaId,
        siExiste
      })
    const listado = (ruta: string) => readdir(ruta)

    it('numera los repetidos del lote y los que ya están en la carpeta, y no escribe nada', async () => {
      const { m } = await montarLote()
      const propuesta = (await m.servicio.destinoCarpeta())!
      await writeFile(join(propuesta.ruta, 'Brisa — Yo (karaoke).mkv'), 'x')
      const antes = await listado(propuesta.ruta)
      const r = await previsualizar(m, IDS, 'numerar', propuesta.carpetaId)
      expect(r.filas).toEqual([
        { cancionId: 'c1', archivo: 'Aurora — Yo (karaoke).mkv', existe: false, accion: 'nuevo' },
        {
          cancionId: 'c2',
          archivo: 'Brisa — Yo (karaoke) (2).mkv',
          existe: true,
          accion: 'numerar'
        },
        {
          cancionId: 'c3',
          archivo: 'Aurora — Yo (karaoke) (2).mkv',
          existe: false,
          accion: 'numerar'
        },
        { cancionId: 'c4', archivo: 'Cometa — Yo (karaoke).mkv', existe: false, accion: 'nuevo' }
      ])
      expect(r.exportables).toBe(4)
      expect(await listado(propuesta.ruta)).toEqual(antes)
      expect(m.llamadas).toHaveLength(0)
    })

    it.each([
      ['sustituir', 'sustituir', 4],
      ['omitir', 'omitir', 3]
    ] as const)('con «%s» la existente es «%s» y exportables = %i', async (siExiste, accion, n) => {
      const { m } = await montarLote()
      const propuesta = (await m.servicio.destinoCarpeta())!
      await writeFile(join(propuesta.ruta, 'Brisa — Yo (karaoke).mkv'), 'x')
      const r = await previsualizar(m, IDS, siExiste, propuesta.carpetaId)
      expect(r.filas[1]).toMatchObject({ cancionId: 'c2', existe: true, accion })
      if (accion === 'omitir') expect(r.filas[1]).toMatchObject({ motivo: 'YA_EXISTE' })
      expect(r.exportables).toBe(n)
    })

    it('el carpetaId sigue sirviendo para iniciarLote; uno desconocido da DESTINO_NO_DISPONIBLE', async () => {
      const { m } = await montarLote()
      const propuesta = (await m.servicio.destinoCarpeta())!
      await previsualizar(m, ['c1'], 'numerar', propuesta.carpetaId)
      await previsualizar(m, ['c1'], 'omitir', propuesta.carpetaId)
      const r = await m.servicio.iniciarLote({
        cancionIds: ['c1'],
        ...PERFIL,
        audio: 'instrumental',
        carpetaId: propuesta.carpetaId,
        siExiste: 'numerar'
      })
      expect(r.encoladas).toHaveLength(1)
      await expect(
        previsualizar(m, ['c1'], 'numerar', 'a0000000-0000-4000-8000-000000000009')
      ).rejects.toMatchObject({ codigo: 'DESTINO_NO_DISPONIBLE' })
    })

    it('una canción que ya se exporta o no existe sale omitida con su motivo', async () => {
      const p = puerta()
      const { m } = await montarLote({ puertaCaptura: p.esperar })
      await pedir(m, ['c1'])
      const r = await previsualizar(m, ['c1', 'c2', 'nada'], 'numerar')
      expect(r.filas.map((f) => [f.cancionId, f.accion, f.motivo])).toEqual([
        ['c1', 'omitir', 'YA_EN_COLA'],
        ['c2', 'nuevo', undefined],
        ['nada', 'omitir', 'CANCION_NO_DISPONIBLE']
      ])
      expect(r.exportables).toBe(1)
      p.abrir()
    })

    it('mostrarCarpetaLote abre la carpeta del lote; un lote desconocido o una carpeta borrada fallan', async () => {
      const { m } = await montarLote()
      const propuesta = (await m.servicio.destinoCarpeta())!
      const r = await m.servicio.iniciarLote({
        cancionIds: ['c2'],
        ...PERFIL,
        audio: 'instrumental',
        carpetaId: propuesta.carpetaId,
        siExiste: 'numerar'
      })
      await m.servicio.mostrarCarpetaLote(r.loteId)
      expect(m.abrirCarpeta).toHaveBeenCalledWith(propuesta.ruta)
      expect(m.mostrarEnCarpeta).not.toHaveBeenCalled()
      await expect(
        m.servicio.mostrarCarpetaLote('d0000000-0000-4000-8000-000000000099')
      ).rejects.toMatchObject({ codigo: 'DESTINO_NO_DISPONIBLE' })
      for (const e of r.encoladas) await hasta(() => terminado(m, e.trabajoId))
      await rm(propuesta.ruta, { recursive: true, force: true })
      await expect(m.servicio.mostrarCarpetaLote(r.loteId)).rejects.toMatchObject({
        codigo: 'DESTINO_NO_DISPONIBLE'
      })
    })
  })

  it('toma la instantánea de cada canción al confirmar, no cuando le toca', async () => {
    const p = puerta()
    const { m } = await montarLote({ puertaCaptura: p.esperar })
    const r = await pedir(m, ['c1', 'c2'])
    m.canciones.c2!.metadatos.titulo = 'Título cambiado después'
    p.abrir()
    for (const e of r.encoladas) await hasta(() => terminado(m, e.trabajoId))
    expect(m.ventanas[1]!.opciones.inicial!.instantanea.titulo).toBe('Brisa')
  })

  it('una canción que ya se exporta o que no puede exportarse sale omitida', async () => {
    const p = puerta()
    const { m } = await montarLote({ puertaCaptura: p.esperar })
    const suelta = await iniciar(m, 'c1')
    m.canciones.c4!.pistas = null
    const r = await pedir(m, ['c1', 'c2', 'c4'])
    expect(r.omitidas).toEqual([
      { id: 'c1', motivo: 'YA_EN_COLA' },
      { id: 'c4', motivo: 'CANCION_NO_DISPONIBLE' }
    ])
    expect(r.encoladas.map((e) => e.cancionId)).toEqual(['c2'])
    // Las del lote esperan detrás de la suelta.
    expect(m.ultimo(r.encoladas[0]!.trabajoId)).toMatchObject({ estado: 'en_cola', posicion: 1 })
    p.abrir()
    await hasta(() => terminado(m, r.encoladas[0]!.trabajoId))
    expect(m.ultimo(suelta.trabajoId)!.loteId).toBeUndefined()
  })

  it('«Instrumental y voz» sin pista de voz: esa canción sale solo con instrumental', async () => {
    const { m } = await montarLote()
    await rm(join(datos, 'biblioteca', 'c2', 'pistas', 'voz.flac'))
    const r = await pedir(m, ['c1', 'c2'], { audio: 'instrumental_voz' })
    for (const e of r.encoladas) await hasta(() => terminado(m, e.trabajoId))
    expect(r.encoladas.map((e) => m.ultimo(e.trabajoId)!.audio)).toEqual([
      'instrumental_voz',
      'instrumental'
    ])
  })

  it('espacio total insuficiente: SIN_ESPACIO antes de encolar nada y la carpeta sigue vigente', async () => {
    let libre = 10
    const { m } = await montarLote({ libreBytes: 10 })
    ;(m.servicio as unknown as { deps: { libreBytes: () => Promise<number> } }).deps.libreBytes =
      async () => libre
    const propuesta = (await m.servicio.destinoCarpeta())!
    const peticion = {
      cancionIds: IDS,
      ...PERFIL,
      audio: 'instrumental' as const,
      carpetaId: propuesta.carpetaId,
      siExiste: 'numerar' as const
    }
    await expect(m.servicio.iniciarLote(peticion)).rejects.toMatchObject({ codigo: 'SIN_ESPACIO' })
    expect(m.servicio.estado()).toEqual([])
    libre = 10 * GIB
    const r = await m.servicio.iniciarLote(peticion)
    expect(r.encoladas).toHaveLength(4)
    for (const e of r.encoladas) await hasta(() => terminado(m, e.trabajoId))
  })

  it('un fallo cualquiera no detiene el lote', async () => {
    const { m } = await montarLote({
      falla: { 2: { codigo: 'PROCESO_TERMINADO', mensaje: 'sin memoria' } }
    })
    const r = await pedir(m, IDS)
    for (const e of r.encoladas) await hasta(() => terminado(m, e.trabajoId))
    expect(r.encoladas.map((e) => m.ultimo(e.trabajoId)!.resultado)).toEqual([
      'completada',
      'error',
      'completada',
      'completada'
    ])
    expect(m.ultimo(r.encoladas[1]!.trabajoId)!.error!.codigo).toBe('MEMORIA_INSUFICIENTE')
    expect(m.avisarSistema.mock.calls).toEqual([['Se exportaron 3 de 4 videos.']])
  })

  it('SIN_ESPACIO a mitad detiene el lote: las que faltan no se intentan y se reintentan', async () => {
    const { m } = await montarLote({
      falla: { 2: { codigo: 'SIN_ESPACIO', mensaje: 'disco lleno' } }
    })
    const r = await pedir(m, IDS)
    for (const e of r.encoladas) await hasta(() => terminado(m, e.trabajoId))
    const finales = r.encoladas.map((e) => m.ultimo(e.trabajoId)!)
    expect(finales.map((f) => f.resultado)).toEqual([
      'completada',
      'error',
      'cancelada',
      'cancelada'
    ])
    expect(finales[2]!.error).toMatchObject({ codigo: 'SIN_ESPACIO' })
    expect(m.llamadas).toHaveLength(2)

    // Reintentar: las dos no intentadas y la fallida, con los mismos nombres y una instantánea nueva.
    m.canciones.c2!.metadatos.titulo = 'Brisa'
    const otra = await m.servicio.reintentarLote(r.loteId)
    expect(otra.loteId).toBe(r.loteId)
    expect(otra.encoladas.map((e) => e.cancionId)).toEqual(['c2', 'c3', 'c4'])
    for (const e of otra.encoladas) await hasta(() => terminado(m, e.trabajoId))
    expect(otra.encoladas.map((e) => m.ultimo(e.trabajoId)!.archivo)).toEqual([
      'Brisa — Yo (karaoke).mkv',
      'Aurora — Yo (karaoke) (2).mkv',
      'Cometa — Yo (karaoke).mkv'
    ])
    expect(otra.encoladas.every((e) => m.ultimo(e.trabajoId)!.resultado === 'completada')).toBe(
      true
    )
    // Nada más que reintentar.
    expect((await m.servicio.reintentarLote(r.loteId)).encoladas).toEqual([])
  })

  it('DESTINO_NO_DISPONIBLE también detiene el lote', async () => {
    const { m } = await montarLote({
      falla: { 1: { codigo: 'DESTINO_NO_DISPONIBLE', mensaje: 'la carpeta ya no está' } }
    })
    const r = await pedir(m, IDS)
    for (const e of r.encoladas) await hasta(() => terminado(m, e.trabajoId))
    expect(r.encoladas.map((e) => m.ultimo(e.trabajoId)!.resultado)).toEqual([
      'error',
      'cancelada',
      'cancelada',
      'cancelada'
    ])
    expect(m.llamadas).toHaveLength(1)
  })

  it('cancelarLote cancela la que está en curso y las que esperan; lo terminado se conserva', async () => {
    const p = puerta()
    const { m } = await montarLote({ puertaCaptura: p.esperar })
    p.abrir()
    const primera = await pedir(m, ['c1'])
    await hasta(() => terminado(m, primera.encoladas[0]!.trabajoId))
    const q = puerta()
    const { m: m2 } = await montarLote({ puertaCaptura: q.esperar })
    const r = await pedir(m2, IDS)
    await hasta(() => m2.ultimo(r.encoladas[0]!.trabajoId)?.estado === 'en_curso')
    await m2.servicio.cancelarLote(r.loteId)
    for (const e of r.encoladas) await hasta(() => terminado(m2, e.trabajoId))
    expect(r.encoladas.map((e) => m2.ultimo(e.trabajoId)!.resultado)).toEqual([
      'cancelada',
      'cancelada',
      'cancelada',
      'cancelada'
    ])
    // Canceladas por el usuario: sin error y fuera de «reintentar».
    expect(m2.ultimo(r.encoladas[1]!.trabajoId)!.error).toBeNull()
    expect((await m2.servicio.reintentarLote(r.loteId)).encoladas).toEqual([])
    // Lo que ya estaba terminado se conserva (la carpeta propuesta es la de Vídeos) y no queda diario.
    expect(await existe(join(videos, 'Aurora — Yo (karaoke).mkv'))).toBe(true)
    expect(await existe(m2.diario.ruta)).toBe(false)
  })

  it('rechaza un perfil no válido y un lote desconocido', async () => {
    const { m } = await montarLote()
    const propuesta = (await m.servicio.destinoCarpeta())!
    await expect(
      m.servicio.iniciarLote({
        cancionIds: ['c1'],
        ...PERFIL,
        alto: 481,
        audio: 'instrumental',
        carpetaId: propuesta.carpetaId,
        siExiste: 'numerar'
      })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    await expect(m.servicio.reintentarLote(propuesta.carpetaId)).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  })
})

describe('voz en los coros (0.2.3, ADR 0030 §5)', () => {
  /** Una línea normal y una de coro dentro de una canción de 1 s; `nivel` ausente = 0,5. */
  const conCoros = (id: string, nivel?: number, sinCoro = false): Cancion => {
    const c = cancionDe(id)
    c.letra = {
      origen: 'manual',
      lrclib_id: null,
      offset_ms: 0,
      ...(nivel === undefined
        ? {}
        : { partes: { cantantes: [{ id: 'c1' as const, nombre: null }], voz_en_coros: nivel } }),
      lineas: [
        { ...linea('x1', 'Verso inventado', 0), fin_ms: 100 },
        { ...linea('x2', 'Eco inventado', 300, sinCoro ? {} : { parte: 'coro' }), fin_ms: 600 }
      ]
    }
    return c
  }
  const esperado = (c: Cancion) =>
    envolvente(tramosCoro(c.letra!, c.metadatos.duracion_ms), c.letra!.partes?.voz_en_coros ?? 0.5)
  const vozDe = (id: string) => join(datos, 'biblioteca', id, 'pistas', 'voz.flac')

  it('con la casilla, «Solo instrumental» y coros: la voz y los puntos de tramosCoro llegan al worker', async () => {
    const c = conCoros(ID_A)
    const m = montar({ canciones: { [ID_A]: c } })
    await iniciar(m, ID_A, { coros: true })
    await hasta(() => m.llamadas.length === 1)
    const audio = m.llamadas[0]!.args.audio as Record<string, unknown>
    expect(audio.voz).toBe(vozDe(ID_A))
    expect(audio.voz_envolvente).toEqual(esperado(c))
    expect(esperado(c)).toEqual([
      [150, 0],
      [300, 0.5],
      [750, 0.5],
      [900, 0]
    ])
  })

  it('el estado de la exportación dice a qué nivel lleva la voz de los coros (y nada si no la lleva)', async () => {
    const con = montar({ canciones: { [ID_A]: conCoros(ID_A, 0.35) } })
    const r = await iniciar(con, ID_A, { coros: true })
    await hasta(() => con.ultimo(r.trabajoId)?.estado === 'terminada')
    expect(con.ultimo(r.trabajoId)!.corosNivel).toBe(0.35)
    const sin = montar({ canciones: { [ID_A]: conCoros(ID_A, 0.35) } })
    const s = await iniciar(sin, ID_A, { coros: false })
    await hasta(() => sin.ultimo(s.trabajoId)?.estado === 'terminada')
    expect(sin.ultimo(s.trabajoId)).not.toHaveProperty('corosNivel')
  })

  it('regresión 0.2.2: sin la casilla (o ausente) el audio del worker es el de siempre', async () => {
    for (const coros of [undefined, false]) {
      const m = montar({ canciones: { [ID_A]: conCoros(ID_A) } })
      await iniciar(m, ID_A, coros === undefined ? {} : { coros })
      await hasta(() => m.llamadas.length === 1)
      expect(m.llamadas[0]!.args.audio).toStrictEqual({
        instrumental: join(datos, 'biblioteca', ID_A, 'pistas', 'instrumental.flac'),
        voz: null,
        ganancia_db: -2.5
      })
    }
  })

  it.each([
    ['«Instrumental y voz»', conCoros(ID_A), { audio: 'instrumental_voz' as const }],
    ['nivel 0', conCoros(ID_A, 0), {}],
    ['una canción sin coros', conCoros(ID_A, undefined, true), {}]
  ])('%s: sin envolvente', async (_n, c, extra) => {
    const m = montar({ canciones: { [ID_A]: c } })
    await iniciar(m, ID_A, { coros: true, ...extra })
    await hasta(() => m.llamadas.length === 1)
    const audio = m.llamadas[0]!.args.audio as Record<string, unknown>
    expect(audio).not.toHaveProperty('voz_envolvente')
    expect(audio.voz).toBe('audio' in extra ? vozDe(ID_A) : null)
  })

  it('sin pista de voz utilizable no hay envolvente', async () => {
    await rm(vozDe(ID_A))
    const m = montar({ canciones: { [ID_A]: conCoros(ID_A) } })
    await iniciar(m, ID_A, { coros: true })
    await hasta(() => m.llamadas.length === 1)
    expect(m.llamadas[0]!.args.audio).not.toHaveProperty('voz_envolvente')
  })

  it('lote: cada canción usa su nivel; las que no tienen coros no llevan envolvente', async () => {
    const IDS = ['c1', 'c2', 'c3', 'c4']
    const canciones: Record<string, Cancion> = {
      c1: conCoros('c1', 0.2),
      c2: conCoros('c2', 0.7),
      c3: conCoros('c3', undefined, true),
      c4: conCoros('c4', 0.7)
    }
    for (const id of IDS) {
      await mkdir(join(datos, 'biblioteca', id, 'pistas'), { recursive: true })
      await writeFile(join(datos, 'biblioteca', id, 'pistas', 'instrumental.flac'), 'i')
      if (id !== 'c4') await writeFile(vozDe(id), 'v')
    }
    const carpeta = join(raiz, 'salida')
    await mkdir(carpeta, { recursive: true })
    const m = montar({ canciones, carpetaElegida: carpeta })
    const propuesta = (await m.servicio.destinoCarpeta())!
    const r = await m.servicio.iniciarLote({
      cancionIds: IDS,
      formato: 'mkv_av1',
      ancho: 640,
      alto: 480,
      fps: 24,
      audio: 'instrumental',
      coros: true,
      carpetaId: propuesta.carpetaId,
      siExiste: 'numerar'
    })
    for (const e of r.encoladas) await hasta(() => m.ultimo(e.trabajoId)?.estado === 'terminada')
    const audioDe = (id: string) =>
      m.llamadas.find((l) =>
        String((l.args.audio as { instrumental: string }).instrumental).includes(`/${id}/`)
      )!.args.audio as Record<string, unknown>
    expect(audioDe('c1').voz_envolvente).toEqual(esperado(canciones.c1!))
    expect(audioDe('c2').voz_envolvente).toEqual(esperado(canciones.c2!))
    expect((audioDe('c1').voz_envolvente as number[][])[1]![1]).toBe(0.2)
    expect((audioDe('c2').voz_envolvente as number[][])[1]![1]).toBe(0.7)
    expect(audioDe('c3')).not.toHaveProperty('voz_envolvente')
    expect(audioDe('c4')).not.toHaveProperty('voz_envolvente')
  })
})
