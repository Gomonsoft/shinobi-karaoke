import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Cancion, TrabajoIpc } from '../../shared'
import { DiarioPendientes } from '../trabajos/diario'
import { GestorTrabajos, type EjecutarWorker, type TrabajoRetenible } from '../trabajos/gestor'
import {
  ColaPreparacion,
  COMPROBACION_CONEXION_MS,
  ESPERA_ESTIMACION_MS,
  type DependenciasCola
} from './cola'
import type { EventoCorrida } from './servicio'

const trabajo = (
  cancionId: string,
  extra: Partial<TrabajoIpc> = {},
  comando = 'separar'
): TrabajoIpc =>
  ({
    id: `${comando}-${cancionId}`,
    cancionId,
    paso: comando === 'separar' ? 'separacion' : 'fuente',
    cola: comando === 'separar' ? 'pesada' : 'ligera',
    comando,
    estado: 'en_cola',
    posicion: 1,
    motivo: null,
    resultado: null,
    error: null,
    progreso: null,
    intento: null,
    ...extra
  }) as TrabajoIpc
const terminado = (
  cancionId: string,
  resultado: 'completado' | 'error' | 'cancelado',
  comando = 'separar',
  codigo?: string
): TrabajoIpc =>
  trabajo(
    cancionId,
    {
      estado: 'terminado',
      resultado,
      error: codigo ? { codigo, mensaje: '' } : null
    },
    comando
  )

let dir: string
let tiempo: number
let pausada: boolean
let trabajos: TrabajoIpc[]
let oyenteGestor: (t: TrabajoIpc) => void
let oyenteCorrida: (e: EventoCorrida) => void
let programados: { fn: () => void; ms: number; cancelado: boolean }[]
let freno: ((t: TrabajoRetenible) => boolean) | null
let canciones: Map<string, Partial<Cancion>>
let conexion: boolean
let diario: DiarioPendientes
let d: {
  reanudarCola: Mock<() => void>
  iniciar: Mock<(id: string, o: string) => boolean>
  ids: string[]
  separar: Mock<(id: string) => Promise<void>>
  reintentarDescarga: Mock<(id: string) => Promise<void>>
  emitirTanda: Mock<DependenciasCola['emitirTanda']>
  emitirReanudada: Mock<DependenciasCola['emitirReanudada']>
  avisarTanda: Mock<NonNullable<DependenciasCola['avisarTanda']>>
  actualizar: Mock<(p: unknown) => Promise<void>>
}
let cola: ColaPreparacion

const cancion = (extra: Partial<Cancion> = {}): Partial<Cancion> => ({
  pasos: {
    fuente: { estado: 'completado' },
    separacion: { estado: 'pendiente' }
  } as Cancion['pasos'],
  ...extra
})

const montar = (extra: Partial<DependenciasCola> = {}): ColaPreparacion =>
  new ColaPreparacion({
    gestor: {
      suscribir: (cb) => ((oyenteGestor = cb), () => undefined),
      listar: () => trabajos,
      fijarFreno: (f) => (freno = f),
      reanudarCola: d.reanudarCola
    },
    preparacion: {
      suscribirCorridas: (cb) => ((oyenteCorrida = cb), () => undefined),
      iniciar: d.iniciar,
      ids: () => d.ids
    },
    biblioteca: { obtener: (id) => (canciones.get(id) as Cancion | undefined) ?? null },
    config: {
      obtener: () => ({ preparacion: { automatica: true, pausada } }),
      actualizar: (p) => {
        pausada = (p as { preparacion: { pausada: boolean } }).preparacion.pausada
        return d.actualizar(p)
      }
    },
    diario,
    hayConexion: () => Promise.resolve(conexion),
    estimarMin: () => 2,
    reintentarDescarga: d.reintentarDescarga,
    separar: d.separar,
    emitirTanda: d.emitirTanda,
    emitirReanudada: d.emitirReanudada,
    avisarTanda: d.avisarTanda,
    ahora: () => tiempo,
    programar: (fn, ms) => {
      const p = { fn, ms, cancelado: false }
      programados.push(p)
      return () => (p.cancelado = true)
    },
    ...extra
  })

/** Emite un evento del gestor como lo haría: el trabajo sale de `listar` al terminar. */
const gestor = (t: TrabajoIpc): void => {
  if (t.estado === 'terminado') trabajos = trabajos.filter((x) => x.id !== t.id)
  else if (!trabajos.some((x) => x.id === t.id)) trabajos.push(t)
  oyenteGestor(t)
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'shinobi-cola-'))
  tiempo = 1000
  pausada = false
  trabajos = []
  programados = []
  freno = null
  conexion = false
  canciones = new Map(['a', 'b', 'c', 'd'].map((id) => [id, cancion()]))
  d = {
    reanudarCola: vi.fn(),
    iniciar: vi.fn(() => true),
    ids: [],
    separar: vi.fn(() => Promise.resolve()),
    reintentarDescarga: vi.fn(() => Promise.resolve()),
    emitirTanda: vi.fn(),
    emitirReanudada: vi.fn(),
    avisarTanda: vi.fn(),
    actualizar: vi.fn(() => Promise.resolve())
  }
  diario = new DiarioPendientes(dir)
  await diario.cargar()
  cola = montar()
  cola.arrancar()
})
afterEach(async () => {
  cola.cerrar()
  await diario.vaciar()
  await rm(dir, { recursive: true, force: true })
})

describe('tanda', () => {
  it('va de cola vacía a cola vacía, con un solo aviso y el resultado por canción', () => {
    gestor(trabajo('a'))
    gestor(trabajo('b'))
    expect(cola.estado()).toMatchObject({ total: 2, terminadas: 0, pausada: false })
    expect(cola.enTandaDeVarias('a')).toBe(true)
    expect(cola.enTandaDeVarias('z')).toBe(false)
    // «a» llega a una lista para revisar con su corrida; «b» queda sin buscar (sin preparación).
    oyenteCorrida({ tipo: 'inicio', id: 'a', origen: 'automatica' })
    d.ids = ['a']
    gestor(terminado('a', 'completado'))
    expect(d.avisarTanda).not.toHaveBeenCalled()
    d.ids = []
    oyenteCorrida({
      tipo: 'fin',
      id: 'a',
      preparacion: { estado: 'lista_para_revisar', dudosas: 3 } as never
    })
    gestor(terminado('b', 'completado'))
    expect(d.avisarTanda).toHaveBeenCalledTimes(1)
    expect(d.avisarTanda).toHaveBeenCalledWith({
      total: 2,
      listas: 1,
      esperanLetra: 1,
      conError: 0
    })
    expect(cola.estado()).toMatchObject({
      total: 2,
      terminadas: 2,
      estimacionMin: 0,
      canciones: [
        { id: 'a', resultado: 'lista_para_revisar', dudosas: 3 },
        { id: 'b', resultado: 'sin_letra', motivo: 'SIN_BUSCAR' }
      ]
    })
    expect(cola.enTandaDeVarias()).toBe(false)
    // Un trabajo nuevo empieza otra tanda.
    gestor(trabajo('c'))
    expect(cola.estado()).toMatchObject({ total: 1, terminadas: 0 })
  })

  it('una sola canción no da aviso de tanda', () => {
    gestor(trabajo('a'))
    gestor(terminado('a', 'completado'))
    expect(d.avisarTanda).not.toHaveBeenCalled()
    expect(cola.estado()).toMatchObject({ total: 1, terminadas: 1 })
  })

  it('la tanda no termina mientras quede algo vivo en el gestor', () => {
    gestor(trabajo('a'))
    gestor(trabajo('b'))
    gestor(terminado('a', 'completado'))
    gestor(terminado('b', 'error', 'separar', 'MEMORIA_INSUFICIENTE'))
    expect(d.avisarTanda).toHaveBeenCalledWith(expect.objectContaining({ conError: 1 }))
  })

  it('la estimación es null los primeros 15 s y luego suma lo que falta', () => {
    gestor(trabajo('a'))
    gestor(trabajo('b'))
    expect(cola.estado()!.estimacionMin).toBeNull()
    tiempo += ESPERA_ESTIMACION_MS + 1
    expect(cola.estado()!.estimacionMin).toBe(4)
    gestor(terminado('a', 'completado'))
    expect(cola.estado()!.estimacionMin).toBe(2)
  })

  it('con la cola cerrándose, las cancelaciones no cuentan ni avisan', () => {
    gestor(trabajo('a'))
    gestor(trabajo('b'))
    cola.alCierre()
    gestor(terminado('a', 'cancelado'))
    gestor(terminado('b', 'cancelado'))
    expect(d.avisarTanda).not.toHaveBeenCalled()
    expect(cola.estado()).toBeNull()
  })
})

describe('pausa', () => {
  it('se guarda en la configuración, retiene todo y reanudar vuelve a mirar la cola', async () => {
    gestor(trabajo('a'))
    await cola.pausar()
    expect(d.actualizar).toHaveBeenCalledWith({ preparacion: { pausada: true } })
    expect(cola.estado()).toMatchObject({ pausada: true, motivoPausa: null })
    expect(freno!({ cancionId: 'a', comando: 'separar', paso: 'separacion' })).toBe(true)
    expect(freno!({ cancionId: 'a', comando: 'descargar-youtube', paso: 'fuente' })).toBe(true)
    await cola.reanudar()
    expect(d.actualizar).toHaveBeenLastCalledWith({ preparacion: { pausada: false } })
    expect(freno!({ cancionId: 'a', comando: 'separar', paso: 'separacion' })).toBe(false)
    expect(d.reanudarCola).toHaveBeenCalled()
  })

  it('una pausa guardada de otra sesión vale desde el principio', () => {
    pausada = true
    expect(cola.pausada()).toBe(true)
    expect(freno!({ cancionId: 'a', comando: 'separar', paso: 'separacion' })).toBe(true)
  })
})

describe('paradas automáticas', () => {
  it('YOUTUBE_BLOQUEADO para solo las descargas; las separaciones siguen', () => {
    gestor(trabajo('a', {}, 'descargar-youtube'))
    gestor(terminado('a', 'error', 'descargar-youtube', 'YOUTUBE_BLOQUEADO'))
    expect(cola.estado()).toMatchObject({ descargasParadas: 'YOUTUBE_BLOQUEADO', pausada: false })
    expect(freno!({ cancionId: 'b', comando: 'descargar-youtube', paso: 'fuente' })).toBe(true)
    expect(freno!({ cancionId: 'b', comando: 'separar', paso: 'separacion' })).toBe(false)
  })

  it('SIN_CONEXION comprueba cada 60 s y reanuda sola las descargas al volver la red', async () => {
    gestor(trabajo('a', {}, 'descargar-youtube'))
    gestor(terminado('a', 'error', 'descargar-youtube', 'SIN_CONEXION'))
    expect(cola.estado()!.descargasParadas).toBe('SIN_CONEXION')
    expect(programados).toHaveLength(1)
    expect(programados[0]!.ms).toBe(COMPROBACION_CONEXION_MS)
    // Sigue sin red: se vuelve a programar.
    programados[0]!.fn()
    await vi.waitFor(() => expect(programados).toHaveLength(2))
    expect(cola.estado()!.descargasParadas).toBe('SIN_CONEXION')
    conexion = true
    programados[1]!.fn()
    await vi.waitFor(() => expect(cola.estado()!.descargasParadas).toBeNull())
    expect(d.reanudarCola).toHaveBeenCalled()
    expect(programados).toHaveLength(2)
  })

  it('SIN_ESPACIO y RUNTIME_NO_DISPONIBLE paran toda la cola con su motivo', () => {
    for (const codigo of ['SIN_ESPACIO', 'RUNTIME_NO_DISPONIBLE']) {
      gestor(trabajo('a'))
      gestor(terminado('a', 'error', 'separar', codigo))
      expect(cola.estado()).toMatchObject({ pausada: true, motivoPausa: codigo })
      expect(freno!({ cancionId: 'b', comando: 'separar', paso: 'separacion' })).toBe(true)
    }
  })

  it('tres fallos seguidos con el mismo código paran toda la cola; otro código o un éxito reinician la cuenta', () => {
    const falla = (id: string, codigo: string) => {
      gestor(trabajo(id))
      gestor(terminado(id, 'error', 'separar', codigo))
    }
    falla('a', 'MEMORIA_INSUFICIENTE')
    falla('b', 'MEMORIA_INSUFICIENTE')
    falla('c', 'ERROR_INTERNO')
    expect(cola.estado()!.motivoPausa).toBeNull()
    falla('a', 'MEMORIA_INSUFICIENTE')
    gestor(trabajo('d'))
    gestor(terminado('d', 'completado'))
    falla('b', 'MEMORIA_INSUFICIENTE')
    expect(cola.estado()!.motivoPausa).toBeNull()
    falla('c', 'MEMORIA_INSUFICIENTE')
    falla('d', 'MEMORIA_INSUFICIENTE')
    expect(cola.estado()).toMatchObject({ pausada: true, motivoPausa: 'MEMORIA_INSUFICIENTE' })
  })

  it('reanudar levanta la parada automática y las descargas paradas', async () => {
    gestor(trabajo('a', {}, 'descargar-youtube'))
    gestor(terminado('a', 'error', 'descargar-youtube', 'YOUTUBE_BLOQUEADO'))
    gestor(trabajo('b'))
    gestor(terminado('b', 'error', 'separar', 'SIN_ESPACIO'))
    await cola.reanudar()
    expect(cola.estado()).toMatchObject({
      pausada: false,
      motivoPausa: null,
      descargasParadas: null
    })
  })
})

describe('reintentar las fallidas', () => {
  it('relanza solo las reintentables, al final y en una tanda nueva si la anterior terminó', async () => {
    canciones.set(
      'a',
      cancion({
        pasos: { fuente: { estado: 'error' }, separacion: { estado: 'pendiente' } } as never,
        fuente: { tipo: 'youtube' } as never
      })
    )
    gestor(trabajo('a', {}, 'descargar-youtube'))
    gestor(trabajo('b'))
    gestor(terminado('a', 'error', 'descargar-youtube', 'ERROR_INTERNO'))
    gestor(terminado('b', 'error', 'separar', 'FORMATO_NO_SOPORTADO'))
    expect(cola.estado()).toMatchObject({ terminadas: 2 })
    await cola.reintentarFallidas()
    expect(d.reintentarDescarga).toHaveBeenCalledWith('a')
    expect(d.separar).not.toHaveBeenCalled()
    expect(cola.estado()).toMatchObject({ total: 1, terminadas: 0 })
    expect(cola.estado()!.canciones[0]!.id).toBe('a')
  })

  it('una canción con la separación pendiente se vuelve a separar', async () => {
    gestor(trabajo('b'))
    gestor(terminado('b', 'error', 'separar', 'MEMORIA_INSUFICIENTE'))
    await cola.reintentarFallidas()
    expect(d.separar).toHaveBeenCalledWith('b')
  })
})

describe('reanudar al abrir', () => {
  const escribirDiario = async (
    entradas: {
      cancionId: string
      tipo: string
      orden: number
      interrupciones: number
      enCurso: boolean
    }[]
  ) => {
    await mkdir(join(dir, 'trabajos'), { recursive: true })
    await writeFile(join(dir, 'trabajos', 'pendientes.json'), JSON.stringify(entradas))
    diario = new DiarioPendientes(dir)
    await diario.cargar()
    cola.cerrar()
    cola = montar()
    cola.arrancar()
  }

  it('vuelve a encolar en su orden; lo que estaba en curso suma una interrupción; con dos no se retoma', async () => {
    await escribirDiario([
      { cancionId: 'b', tipo: 'separacion', orden: 1, interrupciones: 0, enCurso: false },
      { cancionId: 'a', tipo: 'separacion', orden: 0, interrupciones: 0, enCurso: true },
      { cancionId: 'c', tipo: 'separacion', orden: 2, interrupciones: 1, enCurso: true },
      { cancionId: 'd', tipo: 'fuente', orden: 3, interrupciones: 0, enCurso: false }
    ])
    canciones.set(
      'd',
      cancion({
        pasos: { fuente: { estado: 'pendiente' }, separacion: { estado: 'pendiente' } } as never
      })
    )
    expect(await cola.reanudarAlAbrir()).toBe(3)
    expect(d.separar.mock.calls.map((c) => c[0])).toStrictEqual(['a', 'b'])
    expect(d.reintentarDescarga).toHaveBeenCalledWith('d')
    expect(d.emitirReanudada).toHaveBeenCalledWith({ total: 3 })
    // `c` llegó a dos interrupciones: no se retoma.
    expect(d.separar).not.toHaveBeenCalledWith('c')
    expect(cola.estado()!.canciones.map((x) => x.id)).toStrictEqual(['a', 'b', 'd'])
  })

  it('las interrupciones sumadas se guardan; sin diario previo no hace nada', async () => {
    expect(await cola.reanudarAlAbrir()).toBe(0)
    expect(d.emitirReanudada).not.toHaveBeenCalled()
    await escribirDiario([
      { cancionId: 'a', tipo: 'separacion', orden: 0, interrupciones: 0, enCurso: true }
    ])
    await cola.reanudarAlAbrir()
    await diario.vaciar()
    const siguiente = new DiarioPendientes(dir)
    await siguiente.cargar()
    expect(siguiente.tomarHeredadas()).toMatchObject([{ cancionId: 'a', interrupciones: 1 }])
  })

  it('una canción que ya no existe se descarta; en pausa se reanuda en pausa', async () => {
    await escribirDiario([
      { cancionId: 'z', tipo: 'separacion', orden: 0, interrupciones: 0, enCurso: false },
      { cancionId: 'a', tipo: 'separacion', orden: 1, interrupciones: 0, enCurso: false }
    ])
    pausada = true
    expect(await cola.reanudarAlAbrir()).toBe(1)
    expect(cola.estado()).toMatchObject({ pausada: true })
    expect(freno!({ cancionId: 'a', comando: 'separar', paso: 'separacion' })).toBe(true)
  })

  it('una preparación detenida por cierre vuelve a iniciarse con su origen', async () => {
    canciones.set('a', cancion({ preparacion: { origen: 'manual', estado: 'detenida' } as never }))
    await escribirDiario([
      { cancionId: 'a', tipo: 'preparacion', orden: 0, interrupciones: 0, enCurso: true }
    ])
    await cola.reanudarAlAbrir()
    expect(d.iniciar).toHaveBeenCalledWith('a', 'manual')
  })
})

describe('cerrar con trabajos en cola y volver a abrir los reanuda (criterio de la feature 5)', () => {
  it('el gestor real deja su diario al cerrar y la sesión siguiente retoma las separaciones en su orden', async () => {
    // Sesión 1: una separación en curso y dos en cola.
    const llamadas: string[] = []
    const ejecutar: EjecutarWorker = (_c, args, o) =>
      new Promise((_ok, no) => {
        llamadas.push(String(args.id))
        o.señal?.addEventListener('abort', () => setTimeout(() => no({ codigo: 'CANCELADO' }), 1))
      })
    const gestorReal = new GestorTrabajos({
      biblioteca: { actualizar: () => Promise.resolve({}) },
      ejecutar,
      diario
    })
    for (const id of ['a', 'b', 'c'])
      gestorReal.encolar({
        cancionId: id,
        paso: 'separacion',
        cola: 'pesada',
        comando: 'separar',
        args: { id }
      })
    await new Promise((r) => setTimeout(r, 15))
    expect(llamadas).toStrictEqual(['a'])
    cola.alCierre()
    await gestorReal.cancelarTodos()
    await diario.vaciar()

    // Sesión 2: otro diario, otra cola.
    diario = new DiarioPendientes(dir)
    await diario.cargar()
    cola.cerrar()
    cola = montar()
    cola.arrancar()
    expect(await cola.reanudarAlAbrir()).toBe(3)
    expect(d.separar.mock.calls.map((c) => c[0])).toStrictEqual(['a', 'b', 'c'])
    expect(d.emitirReanudada).toHaveBeenCalledWith({ total: 3 })
    await diario.vaciar()
    // `a` estaba en curso: lleva una interrupción; las otras, ninguna.
    const tercera = new DiarioPendientes(dir)
    await tercera.cargar()
    expect(tercera.tomarHeredadas().map((e) => [e.cancionId, e.interrupciones])).toStrictEqual([
      ['a', 1],
      ['b', 0],
      ['c', 0]
    ])
  })
})
