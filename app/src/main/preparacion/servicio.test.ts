import { rm } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Cancion, ElementoLetra } from '../../shared'
import { generarPicos } from '../../shared/__fixtures__/picos'
import type { CandidatoLetra } from '../../shared/letrasBusqueda'
import { ServicioBiblioteca } from '../biblioteca'
import { comprobarLetraGuardada } from '../letras/comprobacion'
import { contarDudosasGuardadas } from '../letras/dudosas'
import { ErrorLrclib } from '../letras/lrclib'
import { ServicioLetras } from '../letras/servicio'
import type { NivelBase } from '../picos/formato'
import { cancionConFuente, nuevoDirDatos } from '../separacion/servicio.testutil'
import { ServicioPreparacion, type DependenciasPreparacion } from './servicio'

const DUR = 60_000
/** Cantos de 4,4 s cada 5 s desde el segundo 3 (voz sintética, con 0,6 s de silencio entre versos). */
const CANTOS: [number, number][] = [3, 8, 13, 18, 23, 28].map((t) => [t * 1000, t * 1000 + 4400])

const nivel = (): NivelBase => {
  const { pares } = generarPicos({
    duracionMs: DUR,
    tramos: CANTOS.map(([desdeMs, hastaMs]) => ({ desdeMs, hastaMs, dbfs: -6 }))
  })
  return { pasoMs: 10, pares, duracionMs: DUR }
}

/** Líneas de una letra inventada, sin fines (como las de un LRC), desplazadas `desfase` ms. */
const lineas = (desfase = 0, prefijo = 'Verso inventado', conFines = false): ElementoLetra[] =>
  CANTOS.map(([a, b], i) => ({
    id: `x${i}`,
    tipo: 'linea',
    texto: `${prefijo} ${i + 1}`,
    inicio_ms: a - desfase,
    fin_ms: conFines ? b - desfase : null,
    palabras: null
  }))
/** Desfase de las letras que deben salir `desfasada` (con fines: sin ellos la voz continua no distingue). */
const DESFASE = 1500

const candidato = (id: number, extra: Partial<CandidatoLetra> = {}): CandidatoLetra => ({
  lrclib_id: id,
  titulo: 'Título de LRCLIB',
  artista: 'Artista de LRCLIB',
  album: 'Álbum de LRCLIB',
  duracion_ms: DUR,
  sincronia: 'linea',
  diferencia_ms: 0,
  lineas: lineas(),
  ...extra
})

const encontrados = (...candidatos: CandidatoLetra[]) => ({
  resultado: { candidatos, instrumental: false },
  busqueda: {
    resultado: 'elige' as const,
    candidatas: candidatos.length,
    motivo: null,
    ids: candidatos.map((c) => c.lrclib_id)
  }
})
const sinResultado = (resultado: 'sin_letra' | 'instrumental' | 'pendiente', motivo: string) => ({
  resultado: null,
  busqueda: { resultado, candidatas: 0, motivo, ids: [] }
})

let datos: string
let biblioteca: ServicioBiblioteca
let letras: ServicioLetras
let id: string
let respuestas: ReturnType<typeof encontrados>[]
type Busqueda = DependenciasPreparacion['busqueda']
let buscarParaPreparacion: Mock<Busqueda['buscarParaPreparacion']>
let cancelarAutomaticas: Mock<Busqueda['cancelarAutomaticas']>
let bloqueada: boolean
let consultasBloqueo: number
let automatica: boolean
let picosEstado: 'lista' | 'generando' | 'error'
let emitir: Mock<NonNullable<DependenciasPreparacion['emitir']>>
let servicio: ServicioPreparacion

const picos = {
  solicitar: () =>
    Promise.resolve(
      picosEstado === 'lista'
        ? { estado: 'lista' as const, generacion: 'a'.repeat(64) }
        : { estado: picosEstado }
    ),
  nivelBase: () => Promise.resolve(nivel())
}

const montar = (extra: Partial<DependenciasPreparacion> = {}): ServicioPreparacion =>
  new ServicioPreparacion({
    biblioteca,
    busqueda: { buscarParaPreparacion, cancelarAutomaticas },
    letras,
    picos,
    comprobar: (c) =>
      comprobarLetraGuardada(
        {
          biblioteca,
          letras,
          picos,
          enTandaDeVarias: (x) => servicio.enTandaDeVarias(x)
        },
        c
      ),
    contarDudosas: (c) => contarDudosasGuardadas({ picos }, c),
    config: { obtener: () => ({ preparacion: { automatica, pausada: false } }) },
    edicionBloqueada: () => {
      consultasBloqueo++
      return bloqueada
    },
    emitir,
    // Espera breve de verdad: un bucle de microtareas dejaría sin turno a los temporizadores.
    esperar: (_ms, señal) =>
      new Promise((resolver) => {
        const t = setTimeout(resolver, 1)
        señal.addEventListener('abort', () => (clearTimeout(t), resolver(undefined)), {
          once: true
        })
      }),
    reintentosBusquedaMs: [1],
    sondeoMs: 1,
    ...extra
  })

const cancion = (): Cancion => biblioteca.obtener(id)!
const registro = () => cancion().preparacion
const separar = (estado: 'completado' | 'error' | 'en_curso' | 'pendiente' = 'completado') =>
  biblioteca.actualizar(id, {
    pasos: { separacion: { estado, actualizado: new Date().toISOString(), error: null } }
  })

/**
 * Espera a que la corrida haya empezado a mirar la canción (se suscribió y ya hizo su primera lectura):
 * el registro `esperando_separacion` solo dice que el paso se escribió, no que la espera esté en marcha.
 */
const esperandoLaCancion = async (iniciar: () => void): Promise<void> => {
  const suscribir = vi.spyOn(biblioteca, 'suscribir')
  iniciar()
  await vi.waitFor(() => expect(suscribir).toHaveBeenCalled())
}

beforeEach(async () => {
  datos = await nuevoDirDatos()
  biblioteca = new ServicioBiblioteca(datos)
  letras = new ServicioLetras({
    biblioteca,
    dialogo: { showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }) },
    debounceEdicionMs: 5
  })
  id = await cancionConFuente(biblioteca, datos)
  await biblioteca.actualizar(id, { metadatos: { album: null } })
  respuestas = [encontrados(candidato(1))]
  buscarParaPreparacion = vi.fn(() => Promise.resolve((respuestas.shift() ?? respuestas[0])!))
  cancelarAutomaticas = vi.fn()
  bloqueada = false
  consultasBloqueo = 0
  automatica = true
  picosEstado = 'lista'
  emitir = vi.fn()
  servicio = montar()
})
afterEach(async () => {
  await servicio.cerrar()
  await biblioteca.flushTodo()
  await rm(datos, { recursive: true, force: true })
})

/** Prepara a mano y espera a que la corrida acabe. */
async function preparar(origen: 'automatica' | 'manual' = 'manual'): Promise<void> {
  servicio.iniciar(id, origen)
  await servicio.enReposo()
}

describe('cadena completa hasta «Lista para revisar»', () => {
  it('elige la letra segura, anota el álbum, ajusta los fines prudentes y no marca Lista', async () => {
    await separar()
    await preparar()
    const c = cancion()
    expect(registro()).toMatchObject({
      estado: 'lista_para_revisar',
      paso: null,
      origen: 'manual',
      busqueda: { resultado: 'elegida', candidatas: 1, ids: [1] },
      eleccion: { por: 'app', lrclib_id: 1 },
      fines: { metodo: 'silencios', lineas: 6 },
      revisada: false
    })
    expect(c.estado).toBe('borrador')
    expect(c.pasos.letra.estado).toBe('completado')
    expect(c.letra).toMatchObject({
      origen: 'lrclib',
      lrclib_id: 1,
      offset_ms: 0,
      datos_lrclib: {
        titulo: 'Título de LRCLIB',
        artista: 'Artista de LRCLIB',
        album: 'Álbum de LRCLIB'
      }
    })
    // Los fines son de la preparación y llegan 100 ms después del final de la voz.
    expect(c.letra!.lineas.map((l) => [l.fin_ms, l.origen_fin])).toStrictEqual(
      CANTOS.map(([, fin]) => [fin + 100, 'preparacion'])
    )
    // El álbum vacío se rellena desde LRCLIB, con su origen; título y artista no cambian.
    expect(c.metadatos.album).toBe('Álbum de LRCLIB')
    expect(c.metadatos.origen?.album).toBe('lrclib')
    expect(c.metadatos.titulo).not.toBe('Título de LRCLIB')
    expect(registro()!.dudosas).toBe(0)
    expect(emitir).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        preparacion: expect.objectContaining({ estado: 'lista_para_revisar' })
      })
    )
  })

  it('una letra desfasada se guarda corregida y lo anota', async () => {
    respuestas = [encontrados(candidato(1, { lineas: lineas(DESFASE, 'Verso inventado', true) }))]
    await separar()
    await preparar()
    const { letra } = cancion()
    expect(Math.abs(letra!.offset_ms - DESFASE)).toBeLessThanOrEqual(20)
    expect(letra!.desfase_corregido_ms).toBe(letra!.offset_ms)
    expect(registro()!.desfase_ms).toBe(letra!.offset_ms)
    // Los fines venían en la letra: la preparación no los toca.
    expect(registro()!.fines).toMatchObject({ lineas: 0 })
    expect(registro()!.estado).toBe('lista_para_revisar')
  })

  it('espera a la separación y no pide nada más hasta entonces', async () => {
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('esperando_separacion'))
    expect(cancion().letra).toBeNull()
    expect(registro()!.busqueda?.resultado).toBe('elige')
    await separar()
    await servicio.enReposo()
    expect(registro()!.estado).toBe('lista_para_revisar')
  })

  it('espera a que los picos estén listos', async () => {
    picosEstado = 'generando'
    await separar()
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('esperando_separacion'))
    picosEstado = 'lista'
    await servicio.enReposo()
    expect(registro()!.estado).toBe('lista_para_revisar')
  })
})

describe('elección automática', () => {
  it('con dos letras buenas distintas no elige: elige_letra y sin letra guardada', async () => {
    respuestas = [
      encontrados(candidato(1), candidato(2, { lineas: lineas(0, 'Otra letra inventada') }))
    ]
    await separar()
    await preparar()
    expect(registro()).toMatchObject({ estado: 'elige_letra', paso: null })
    expect(cancion().letra).toBeNull()
    expect(registro()!.busqueda).toMatchObject({
      resultado: 'elige',
      candidatas: 2,
      no_elige: 'varias'
    })
  })

  it('guarda el motivo de la no elección: soloTexto, sinExacta y duda', async () => {
    const casos: [Parameters<typeof candidato>[1], string][] = [
      [{ sincronia: 'texto' }, 'soloTexto'],
      [{ diferencia_ms: 2500 }, 'sinExacta'],
      [{ lineas: lineas(0).map((l, i) => ({ ...l, inicio_ms: 1000 + i * 4100 })) }, 'duda']
    ]
    for (const [extra, motivo] of casos) {
      respuestas = [encontrados(candidato(1, extra))]
      await separar()
      await preparar()
      expect(registro()!.busqueda?.no_elige).toBe(motivo)
    }
  })

  it('una separación en error guarda sinComprobar', async () => {
    await separar('error')
    await preparar()
    expect(registro()!.busqueda?.no_elige).toBe('sinComprobar')
  })

  it('con dos letras buenas iguales elige la primera', async () => {
    respuestas = [encontrados(candidato(7), candidato(8))]
    await separar()
    await preparar()
    expect(cancion().letra!.lrclib_id).toBe(7)
  })

  it('solo texto, duración distinta o letra de otra versión: elige_letra', async () => {
    for (const c of [
      candidato(1, { sincronia: 'texto' }),
      candidato(1, { diferencia_ms: 2500 }),
      candidato(1, { lineas: lineas(0).map((l, i) => ({ ...l, inicio_ms: 1000 + i * 4100 })) })
    ]) {
      respuestas = [encontrados(c)]
      await separar()
      await preparar()
      expect(registro()!.estado).toBe('elige_letra')
      expect(cancion().letra).toBeNull()
    }
  })

  it('una separación en error deja elige_letra con las candidatas sin encaje', async () => {
    await separar('error')
    await preparar()
    expect(registro()).toMatchObject({ estado: 'elige_letra' })
    expect(cancion().letra).toBeNull()
  })
})

describe('resultados de la búsqueda', () => {
  it.each([
    ['sin_letra', 'LETRA_NO_ENCONTRADA'],
    ['instrumental', 'INSTRUMENTAL']
  ] as const)('%s deja sin_letra con su motivo', async (resultado, motivo) => {
    respuestas = [sinResultado(resultado, motivo) as never]
    await preparar()
    expect(registro()).toMatchObject({ estado: 'sin_letra', busqueda: { resultado, motivo } })
  })

  it('sin red reintenta una vez y luego queda en error con la letra pendiente', async () => {
    buscarParaPreparacion.mockResolvedValue(sinResultado('pendiente', 'SIN_CONEXION'))
    await preparar()
    expect(buscarParaPreparacion).toHaveBeenCalledTimes(2)
    expect(registro()).toMatchObject({
      estado: 'error',
      busqueda: { resultado: 'pendiente' },
      error: { codigo: 'SIN_CONEXION' }
    })
  })

  it('si el reintento responde, sigue la cadena', async () => {
    respuestas = [sinResultado('pendiente', 'SIN_CONEXION') as never, encontrados(candidato(1))]
    await separar()
    await preparar()
    expect(registro()!.estado).toBe('lista_para_revisar')
  })

  it('«Preparar» pide la búsqueda como explícita; la automática, no', async () => {
    await separar()
    await preparar('manual')
    expect(buscarParaPreparacion).toHaveBeenLastCalledWith(id, { explicita: true })
  })

  it('con el interruptor apagado (CANCELADO) no deja registro ni letra', async () => {
    buscarParaPreparacion.mockRejectedValue(new ErrorLrclib('CANCELADO', 'desactivada'))
    await preparar('automatica')
    expect(registro()).toBeUndefined()
    expect(cancion().letra).toBeNull()
  })

  it('un fallo inesperado deja error con su código sin tumbar nada', async () => {
    buscarParaPreparacion.mockRejectedValue(new Error('roto'))
    await preparar()
    expect(registro()).toMatchObject({ estado: 'error', error: { codigo: 'ERROR_INTERNO' } })
  })
})

describe('privacidad: alFuenteLista', () => {
  it('con el interruptor apagado no busca ni deja registro', async () => {
    automatica = false
    servicio.alFuenteLista(id)
    await servicio.enReposo()
    expect(buscarParaPreparacion).not.toHaveBeenCalled()
    expect(registro()).toBeUndefined()
  })

  it('con el interruptor activo empieza sola, como automática', async () => {
    await separar()
    servicio.alFuenteLista(id)
    await servicio.enReposo()
    expect(buscarParaPreparacion).toHaveBeenCalledWith(id, { explicita: false })
    expect(registro()).toMatchObject({ estado: 'lista_para_revisar', origen: 'automatica' })
  })

  it('una canción con registro no se vuelve a preparar sola', async () => {
    await separar()
    await preparar()
    buscarParaPreparacion.mockClear()
    servicio.alFuenteLista(id)
    await servicio.enReposo()
    expect(buscarParaPreparacion).not.toHaveBeenCalled()
  })
})

describe('nunca sustituye ni toca lo del usuario', () => {
  const guardarManual = (intacta: boolean) =>
    letras
      .guardar({
        cancionId: id,
        origen: 'manual',
        lrclib_id: null,
        lineas: lineas(0, 'Letra propia inventada')
      })
      .then(() => (intacta ? undefined : letras.aplicarFinesPreparacion(id, new Map())))

  it('con una letra ya guardada no busca y solo continúa con los fines si está intacta', async () => {
    await guardarManual(true)
    await separar()
    await preparar()
    expect(buscarParaPreparacion).not.toHaveBeenCalled()
    const { letra } = cancion()
    expect(letra!.origen).toBe('manual')
    expect(letra!.lineas[0]!.texto).toBe('Letra propia inventada 1')
    expect(registro()).toMatchObject({ estado: 'lista_para_revisar', fines: { lineas: 6 } })
  })

  it('con tiempos tocados por el usuario no toca ningún fin', async () => {
    await guardarManual(true)
    const sesion = letras.abrirEdicion(id)!.sesionId
    const l = cancion().letra!
    await letras.guardarTiempos(
      {
        cancionId: id,
        offset_ms: 0,
        tiempos: l.lineas.map((e, i) => ({
          id: e.id,
          inicio_ms: e.inicio_ms,
          fin_ms: i === 0 ? 4000 : null,
          palabras: null
        }))
      },
      sesion
    )
    letras.cerrarEdicion(sesion)
    expect(cancion().letra!.intacta).toBeUndefined()
    await separar()
    await preparar()
    expect(cancion().letra!.lineas.map((e) => e.fin_ms)).toStrictEqual([
      4000,
      null,
      null,
      null,
      null,
      null
    ])
    expect(registro()!.fines).toBeUndefined()
  })

  it('una letra que el usuario elige mientras se espera la separación no se sustituye', async () => {
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('esperando_separacion'))
    await letras.guardar({
      cancionId: id,
      origen: 'manual',
      lrclib_id: null,
      lineas: lineas(0, 'Letra propia inventada')
    })
    await separar()
    await servicio.enReposo()
    expect(cancion().letra!.origen).toBe('manual')
    expect(registro()!.estado).toBe('lista_para_revisar')
    expect(registro()!.eleccion).toBeUndefined()
    // Elegir una letra es una edición del usuario: la preparación queda revisada.
    expect(registro()!.revisada).toBe(true)
  })

  it('una letra desfasada ya guardada se comprueba con la misma función y se corrige si está intacta', async () => {
    await letras.guardar({
      cancionId: id,
      origen: 'lrclib',
      lrclib_id: 3,
      lineas: lineas(DESFASE, 'Verso inventado', true)
    })
    await separar()
    await preparar()
    expect(Math.abs(cancion().letra!.offset_ms - DESFASE)).toBeLessThanOrEqual(20)
    expect(registro()!.desfase_ms).toBe(cancion().letra!.offset_ms)
  })

  it('no corrige sola una letra a la que el usuario quitó la corrección (desfase_descartado)', async () => {
    await letras.guardar({
      cancionId: id,
      origen: 'lrclib',
      lrclib_id: 3,
      lineas: lineas(DESFASE, 'Verso inventado', true)
    })
    await biblioteca.actualizar(id, { letra: { ...cancion().letra!, desfase_descartado: true } })
    await separar()
    await preparar()
    expect(cancion().letra!.offset_ms).toBe(0)
    expect(registro()!.desfase_ms).toBeUndefined()
  })
})

describe('avisos de la comprobación en una tanda', () => {
  it('con otra preparación en marcha no hay toast por canción', async () => {
    const avisar = vi.fn()
    servicio = montar({
      comprobar: (c) =>
        comprobarLetraGuardada(
          {
            biblioteca,
            letras,
            picos,
            avisar,
            enTandaDeVarias: (x) => servicio.enTandaDeVarias(x)
          },
          c
        )
    })
    await letras.guardar({
      cancionId: id,
      origen: 'lrclib',
      lrclib_id: 3,
      lineas: lineas(DESFASE, 'Verso inventado', true)
    })
    await separar()
    const otro = await cancionConFuente(biblioteca, datos)
    servicio.iniciar(otro, 'manual')
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.estado).toBe('lista_para_revisar'))
    expect(avisar).not.toHaveBeenCalled()
    expect(registro()!.desfase_ms).toBeDefined()
    await servicio.cancelar(otro)
  })

  it('con una sola preparación sí avisa', async () => {
    const avisar = vi.fn()
    servicio = montar({
      comprobar: (c) =>
        comprobarLetraGuardada(
          {
            biblioteca,
            letras,
            picos,
            avisar,
            enTandaDeVarias: (x) => servicio.enTandaDeVarias(x)
          },
          c
        )
    })
    await letras.guardar({
      cancionId: id,
      origen: 'lrclib',
      lrclib_id: 3,
      lineas: lineas(DESFASE, 'Verso inventado', true)
    })
    await separar()
    await preparar()
    expect(avisar).toHaveBeenCalledTimes(1)
  })
})

describe('detenciones', () => {
  it('cancelar a mitad deja detenida con su paso y las candidatas, y cancela las automáticas', async () => {
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('esperando_separacion'))
    await servicio.cancelar(id)
    expect(cancelarAutomaticas).toHaveBeenCalledWith(id)
    expect(registro()).toMatchObject({
      estado: 'detenida',
      paso: 'esperando_separacion',
      error: null,
      busqueda: { resultado: 'elige' }
    })
    expect(servicio.enCurso(id)).toBe(false)
  })

  it('cancelar sin haber hecho nada retira el registro', async () => {
    buscarParaPreparacion.mockImplementation(
      () =>
        new Promise((_resolver, rechazar) => {
          // `cancelarAutomaticas` aborta la petición en cola: la búsqueda acaba en CANCELADO.
          cancelarAutomaticas.mockImplementation(() =>
            rechazar(new ErrorLrclib('CANCELADO', 'cancelada'))
          )
        })
    )
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('buscando_letra'))
    await servicio.cancelar(id)
    expect(registro()).toBeUndefined()
    expect(servicio.enCurso(id)).toBe(false)
  })

  it('cerrar la app deja detenida por CIERRE', async () => {
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('esperando_separacion'))
    await servicio.cerrar()
    expect(registro()).toMatchObject({
      estado: 'detenida',
      paso: 'esperando_separacion',
      error: { codigo: 'CIERRE' }
    })
  })

  it('cancelar la separación detiene la cadena sin borrar las candidatas', async () => {
    await separar('en_curso')
    await esperandoLaCancion(() => servicio.iniciar(id, 'manual'))
    await separar('pendiente')
    await servicio.enReposo()
    expect(registro()).toMatchObject({ estado: 'detenida', busqueda: { resultado: 'elige' } })
  })

  it('cancelar la separación en cola, antes de que llegue a `en_curso`, también detiene la cadena (0240)', async () => {
    let trabajo = true
    const encolar = vi.fn(() => Promise.resolve())
    servicio = montar({ separacion: { hayTrabajo: () => trabajo, encolar } })
    await esperandoLaCancion(() => servicio.iniciar(id, 'manual'))
    // El usuario cancela el trabajo en cola: no hay trabajo y la separación sigue `pendiente`.
    trabajo = false
    await separar('pendiente')
    await servicio.enReposo()
    expect(registro()).toMatchObject({ estado: 'detenida', busqueda: { resultado: 'elige' } })
  })

  it('eliminar la canción detiene la corrida sin escribir más', async () => {
    await esperandoLaCancion(() => servicio.iniciar(id, 'manual'))
    const antes = emitir.mock.calls.length
    await servicio.alEliminar(id)
    expect(servicio.enCurso(id)).toBe(false)
    expect(emitir.mock.calls.length).toBe(antes)
  })

  it('una edición del usuario sobre una letra que ya existía la detiene', async () => {
    await letras.guardar({ cancionId: id, origen: 'manual', lrclib_id: null, lineas: lineas() })
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('esperando_separacion'))
    await letras.editarTexto({ cancionId: id, texto: 'Otra letra inventada\nuna línea más' })
    await servicio.enReposo()
    // No había hecho nada: no deja registro, y ningún fin es suyo.
    expect(registro()).toBeUndefined()
    expect(cancion().letra!.lineas.every((l) => l.origen_fin === undefined)).toBe(true)
  })

  it('con una sesión en vivo no escribe hasta que acaba', async () => {
    bloqueada = true
    await separar()
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('comprobando'))
    // Ya consultó el bloqueo varias veces (sondeo) y sigue sin escribir.
    await vi.waitFor(() => expect(consultasBloqueo).toBeGreaterThan(2))
    expect(cancion().letra).toBeNull()
    bloqueada = false
    await servicio.enReposo()
    expect(registro()!.estado).toBe('lista_para_revisar')
  })

  it('normalizarAlArrancar deja detenida por cierre la que quedó en curso por una caída', async () => {
    await biblioteca.actualizar(id, {
      preparacion: {
        estado: 'en_curso',
        paso: 'buscando_letra',
        origen: 'automatica',
        actualizado: new Date().toISOString(),
        dudosas: 0,
        revisada: false
      }
    })
    await servicio.normalizarAlArrancar()
    expect(registro()).toMatchObject({ estado: 'detenida', error: { codigo: 'CIERRE' } })
  })
})

describe('previsualizar y preparar', () => {
  it('una canción sin letra haría los tres pasos', async () => {
    expect(servicio.previsualizar([id])).toStrictEqual([
      { id, aplica: true, pasos: ['buscando_letra', 'comprobando', 'ajustando_fines'] }
    ])
  })

  it('omite con su motivo: SIN_FUENTE, EN_CURSO, EDICION_BLOQUEADA, YA_LISTA, NADA_QUE_HACER', async () => {
    const sinFuente = await cancionConFuente(biblioteca, datos)
    await biblioteca.actualizar(sinFuente, {
      pasos: { fuente: { estado: 'pendiente', actualizado: null, error: null } }
    })
    expect(servicio.previsualizar([sinFuente])[0]).toMatchObject({ motivo: 'SIN_FUENTE' })

    bloqueada = true
    expect(servicio.previsualizar([id])[0]).toMatchObject({ motivo: 'EDICION_BLOQUEADA' })
    bloqueada = false

    servicio.iniciar(id, 'manual')
    expect(servicio.previsualizar([id])[0]).toMatchObject({ motivo: 'EN_CURSO' })
    expect(servicio.preparar([id])).toStrictEqual({
      aceptadas: [],
      omitidas: [{ id, motivo: 'EN_CURSO' }]
    })
    await servicio.cancelar(id)

    // Letra con tiempos editados y fines completos: no queda nada que hacer.
    await letras.guardar({
      cancionId: id,
      origen: 'manual',
      lrclib_id: null,
      lineas: lineas().map((l) => ({ ...l, fin_ms: (l.inicio_ms ?? 0) + 1000 }))
    })
    await biblioteca.actualizar(id, { letra: { ...cancion().letra!, intacta: undefined } })
    expect(servicio.previsualizar([id])[0]).toMatchObject({ motivo: 'NADA_QUE_HACER' })
    await biblioteca.actualizar(id, {
      preparacion: { ...registro()!, estado: 'lista_para_revisar' }
    })
    expect(servicio.previsualizar([id])[0]).toMatchObject({ motivo: 'YA_LISTA' })
  })

  it('preparar acepta las que aplican y arranca su corrida', async () => {
    await separar()
    expect(servicio.preparar([id, id])).toStrictEqual({ aceptadas: [id], omitidas: [] })
    expect(servicio.enCurso(id)).toBe(true)
    await servicio.enReposo()
    expect(registro()!.estado).toBe('lista_para_revisar')
  })
})

describe('recuento de dudosas tras cada escritura de la letra', () => {
  const tiempos = (cambios: Record<number, Partial<ElementoLetra>>) =>
    cancion().letra!.lineas.map((e, i) => ({
      id: e.id,
      inicio_ms: e.inicio_ms,
      fin_ms: e.fin_ms,
      palabras: null,
      ...(e.origen_fin ? { origen_fin: e.origen_fin } : {}),
      ...(e.revisada ? { revisada: e.revisada } : {}),
      ...(cambios[i] as object)
    }))
  const guardarTiempos = async (cambios: Record<number, Partial<ElementoLetra>>) => {
    const sesion = letras.abrirEdicion(id)!.sesionId
    await letras.guardarTiempos(
      { cancionId: id, offset_ms: 0, tiempos: tiempos(cambios) as never },
      sesion
    )
    letras.cerrarEdicion(sesion)
  }

  it('cambia al mover un tiempo y al dar una línea por buena', async () => {
    await separar()
    await preparar()
    expect(registro()!.dudosas).toBe(0)

    // El inicio de x2 cae en el silencio entre versos (de 12,4 a 13 s): línea dudosa.
    await guardarTiempos({ 1: { fin_ms: 12_400 }, 2: { inicio_ms: 12_450, fin_ms: 13_000 } })
    await vi.waitFor(() => expect(registro()!.dudosas).toBe(1))

    // Darla por buena la saca del recuento.
    await guardarTiempos({
      2: { revisada: { inicio_ms: 12_450, fin_ms: 13_000, texto: 'Verso inventado 3' } }
    })
    await vi.waitFor(() => expect(registro()!.dudosas).toBe(0))

    // Mover su fin invalida la marca y vuelve a contar.
    await guardarTiempos({ 2: { fin_ms: 13_500 } })
    await vi.waitFor(() => expect(registro()!.dudosas).toBe(1))
  })
})

describe('separación pendiente que nadie lanzó (pregunta 0223 §4)', () => {
  it('encola exactamente una separación por el camino de siempre', async () => {
    const encolar = vi.fn(() => Promise.resolve())
    servicio = montar({ separacion: { hayTrabajo: () => false, encolar } })
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(encolar).toHaveBeenCalledTimes(1))
    expect(encolar).toHaveBeenCalledWith(id)
    await servicio.cancelar(id)
    expect(encolar).toHaveBeenCalledTimes(1)
  })

  it('no encola si ya hay un trabajo de separación, ni si la separación no está pendiente', async () => {
    const encolar = vi.fn(() => Promise.resolve())
    servicio = montar({ separacion: { hayTrabajo: () => true, encolar } })
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('esperando_separacion'))
    await servicio.cancelar(id)
    servicio = montar({ separacion: { hayTrabajo: () => false, encolar } })
    await separar('en_curso')
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(registro()?.paso).toBe('esperando_separacion'))
    await servicio.cancelar(id)
    expect(encolar).not.toHaveBeenCalled()
  })

  it('en pausa no sale ninguna búsqueda hasta reanudar', async () => {
    let retenida = true
    const consultas = vi.fn(() => retenida)
    servicio = montar({ retenida: consultas })
    await separar()
    servicio.iniciar(id, 'manual')
    await vi.waitFor(() => expect(consultas.mock.calls.length).toBeGreaterThan(2))
    expect(buscarParaPreparacion).not.toHaveBeenCalled()
    retenida = false
    await servicio.enReposo()
    expect(buscarParaPreparacion).toHaveBeenCalledTimes(1)
    expect(registro()!.estado).toBe('lista_para_revisar')
  })
})
