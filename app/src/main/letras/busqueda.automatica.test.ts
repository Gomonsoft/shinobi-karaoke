import { describe, expect, it, vi } from 'vitest'
import type { Cancion } from '../../shared'
import { leerFixtureLetraJson } from '../../shared/__fixtures__/letras'
import type { RegistroApp } from '../registro'
import { aBusquedaGuardada, BusquedaLetras } from './busqueda'
import {
  crearClienteLrclib,
  ErrorLrclib,
  registroLrclibSchema,
  type FetchLrclib,
  type RespuestaMinima
} from './lrclib'

/** Búsqueda automática de la preparación (ADR 0025 §4): interruptor, cola y `busqueda` guardable. */

const REGISTRO = registroLrclibSchema.parse(
  leerFixtureLetraJson<Record<string, unknown>>('lrclib-get.json')
)

function resp(status: number, cuerpo: unknown = ''): RespuestaMinima {
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)
  return {
    status,
    headers: { get: () => null },
    body: new Response(texto).body,
    text: async () => texto
  }
}

/** El doble de LRCLIB: responde según la ruta y cuenta cada petición que le llega. */
function doble(
  rutas: (ruta: string) => RespuestaMinima = (ruta) =>
    ruta === '/api/search' ? resp(200, []) : resp(404)
) {
  const peticiones: string[] = []
  const fetch = vi.fn<FetchLrclib>(async (url) => {
    const u = new URL(url)
    peticiones.push(u.pathname)
    return rutas(u.pathname)
  })
  return { fetch, peticiones }
}

function montar(
  opciones: {
    activa?: () => boolean
    rutas?: (ruta: string) => RespuestaMinima
    preparacion?: Cancion['preparacion']
  } = {}
) {
  const d = doble(opciones.rutas)
  const registro: RegistroApp = { escribir: () => undefined }
  const cliente = crearClienteLrclib({
    fetch: d.fetch,
    version: '1.0.0',
    registro,
    empaquetada: false,
    separacionMs: 0,
    separacionAutomaticaMs: 0,
    dormir: async () => undefined
  })
  const cancion = {
    metadatos: {
      titulo: 'Canción inventada',
      artista: 'Grupo inventado',
      album: null,
      duracion_ms: 215_000
    },
    preparacion: opciones.preparacion
  } as Cancion
  const b = new BusquedaLetras({
    biblioteca: { obtener: (id) => (id === 'c1' ? cancion : null), actualizar: vi.fn() as never },
    cliente,
    registro,
    ...(opciones.activa ? { automaticaActiva: opciones.activa } : {})
  })
  return { b, ...d }
}

describe('interruptor «Buscar la letra automáticamente»', () => {
  it('apagado: la preparación no envía ninguna petición a LRCLIB', async () => {
    const { b, peticiones } = montar({ activa: () => false })
    await expect(b.buscarParaPreparacion('c1')).rejects.toMatchObject({ codigo: 'CANCELADO' })
    await expect(b.buscarParaPreparacion('c1')).rejects.toMatchObject({ codigo: 'CANCELADO' })
    expect(peticiones).toEqual([])
  })

  it('apagado en mitad de la cola: lo que esperaba no sale', async () => {
    let activa = true
    const { b, peticiones } = montar({
      activa: () => activa,
      rutas: () => {
        activa = false // se apaga mientras sale la primera petición
        return resp(404)
      }
    })
    await expect(b.buscarParaPreparacion('c1')).rejects.toMatchObject({ codigo: 'CANCELADO' })
    // `get` salió; ni `search` ni la segunda búsqueda de texto libre.
    expect(peticiones).toEqual(['/api/get'])
  })

  it('«Preparar» es una acción explícita: sale aunque el interruptor esté apagado', async () => {
    const { b, peticiones } = montar({ activa: () => false })
    const r = await b.buscarParaPreparacion('c1', { explicita: true })
    expect(r.busqueda.resultado).toBe('sin_letra')
    expect(peticiones.length).toBeGreaterThan(0)
  })

  it('la búsqueda interactiva de la vista Letra no depende del interruptor', async () => {
    const { b, peticiones } = montar({ activa: () => false })
    await b
      .buscar({ cancionId: 'c1', titulo: 'Canción inventada', artista: 'Grupo inventado' })
      .catch(() => undefined)
    expect(peticiones.length).toBeGreaterThan(0)
  })

  it('cancelarAutomaticas aborta las de esa canción', async () => {
    let soltar: () => void = () => undefined
    const d = montar({})
    const lenta = new BusquedaLetras({
      biblioteca: {
        obtener: () =>
          ({ metadatos: { titulo: 't', artista: 'a', album: null, duracion_ms: 1000 } }) as Cancion,
        actualizar: vi.fn() as never
      },
      cliente: {
        get: () => new Promise((r) => (soltar = () => r(null))),
        buscar: async () => []
      },
      registro: { escribir: () => undefined }
    })
    const p = lenta.buscarParaPreparacion('c1')
    lenta.cancelarAutomaticas('c1')
    soltar()
    await expect(p).rejects.toMatchObject({ codigo: 'CANCELADO' })
    expect(d.peticiones).toEqual([])
  })
})

describe('busqueda guardable (sin letras)', () => {
  it('con candidatos: recuento, ids (como mucho 10) y ningún texto', async () => {
    const registros = Array.from({ length: 12 }, (_, i) => ({ ...REGISTRO, id: 100 + i }))
    const { b } = montar({
      rutas: (ruta) => (ruta === '/api/search' ? resp(200, registros) : resp(404))
    })
    const r = await b.buscarParaPreparacion('c1')
    expect(r.resultado?.candidatos.length).toBe(12)
    expect(r.busqueda).toMatchObject({ resultado: 'elige', candidatas: 12, motivo: null })
    expect(r.busqueda.ids).toHaveLength(10)
    const guardado = JSON.stringify(r.busqueda)
    for (const c of r.resultado!.candidatos) {
      for (const l of c.lineas) if (l.tipo === 'linea') expect(guardado).not.toContain(l.texto)
    }
    expect(Object.keys(r.busqueda).sort()).toEqual(['candidatas', 'ids', 'motivo', 'resultado'])
  })

  it('cada fallo se resume sin lanzar: sin letra, instrumental y pendiente de red', async () => {
    expect(aBusquedaGuardada(new ErrorLrclib('LETRA_NO_ENCONTRADA', 'x'))).toMatchObject({
      resultado: 'sin_letra',
      motivo: 'LETRA_NO_ENCONTRADA'
    })
    expect(aBusquedaGuardada(new ErrorLrclib('INSTRUMENTAL', 'x'))).toMatchObject({
      resultado: 'instrumental',
      motivo: 'INSTRUMENTAL'
    })
    for (const codigo of ['SIN_CONEXION', 'SERVICIO_NO_DISPONIBLE'] as const) {
      expect(aBusquedaGuardada(new ErrorLrclib(codigo, 'x'))).toMatchObject({
        resultado: 'pendiente',
        motivo: codigo
      })
    }
    // Lo que no es un resultado se relanza.
    expect(() => aBusquedaGuardada(new ErrorLrclib('CANCELADO', 'x'))).toThrow()
    expect(() => aBusquedaGuardada(new Error('interno'))).toThrow()
  })

  it('un servicio caído deja la búsqueda pendiente, no un error de la canción', async () => {
    const { b } = montar({ rutas: () => resp(500) })
    const r = await b.buscarParaPreparacion('c1')
    expect(r.resultado).toBeNull()
    expect(r.busqueda).toMatchObject({ resultado: 'pendiente', motivo: 'SERVICIO_NO_DISPONIBLE' })
  })
})

describe('candidatoPorId', () => {
  const preparacion = (ids: number[]): Cancion['preparacion'] =>
    ({
      estado: 'elige_letra',
      paso: null,
      origen: 'automatica',
      actualizado: '2026-11-21T10:00:00.000Z',
      busqueda: { resultado: 'elige', candidatas: ids.length, motivo: null, ids },
      dudosas: 0,
      revisada: false
    }) as Cancion['preparacion']

  it('pide el texto con /api/get/{id} solo si el id es de esta canción', async () => {
    const { b, peticiones } = montar({
      preparacion: preparacion([9001]),
      rutas: (ruta) => (ruta === '/api/get/9001' ? resp(200, REGISTRO) : resp(404))
    })
    const c = await b.candidatoPorId('c1', 9001)
    expect(c?.lrclib_id).toBe(9001)
    expect(c?.lineas.length).toBeGreaterThan(0)
    expect(peticiones).toEqual(['/api/get/9001'])
    await expect(b.candidatoPorId('c1', 5)).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    expect(peticiones).toHaveLength(1)
  })

  it('un registro que ya no existe da null y un fallo de red llega como error', async () => {
    const { b } = montar({ preparacion: preparacion([7]) })
    expect(await b.candidatoPorId('c1', 7)).toBeNull()
    const caido = montar({ preparacion: preparacion([7]), rutas: () => resp(500) })
    await expect(caido.b.candidatoPorId('c1', 7)).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
  })

  it('usa la búsqueda reciente en memoria sin pedir nada', async () => {
    const { b, peticiones } = montar({
      rutas: (ruta) => (ruta === '/api/get' ? resp(200, REGISTRO) : resp(404))
    })
    const r = await b.buscarParaPreparacion('c1', { explicita: true })
    const antes = peticiones.length
    const c = await b.candidatoPorId('c1', r.resultado!.candidatos[0]!.lrclib_id)
    expect(c).not.toBeNull()
    expect(peticiones).toHaveLength(antes)
  })
})
