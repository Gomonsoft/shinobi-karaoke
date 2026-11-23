import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estimarEspacioLote, MAX_LOTE } from '../../shared'
import { ServicioBiblioteca } from '../biblioteca'
import type { PeticionTrabajo } from '../trabajos'
import { esDuplicadoArchivo, ServicioLote, VIDA_REF_MS, type DependenciasLote } from './lote'

let datos: string
let origen: string
let ahora = new Date('2026-11-22T10:00:00Z')

beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-lote-datos-'))
  origen = await mkdtemp(join(tmpdir(), 'shinobi-lote-origen-'))
  ahora = new Date('2026-11-22T10:00:00Z')
})
afterEach(async () => {
  await rm(datos, { recursive: true, force: true })
  await rm(origen, { recursive: true, force: true })
})

/** Respuesta de `leer-etiquetas` inventada: cada archivo con su duración y sus etiquetas. */
type Etiquetas = Partial<Record<'title' | 'artist' | 'album', string>>
function lector(
  info: Record<string, { duracion_ms: number | null; etiquetas?: Etiquetas } | 'mal'>
) {
  return vi.fn((comando: string, args: Record<string, unknown>) => {
    expect(comando).toBe('leer-etiquetas')
    const rutas = args.rutas as string[]
    return Promise.resolve({
      archivos: rutas.map((ruta) => {
        const nombre = ruta.split(/[\\/]/).pop() ?? ''
        const i = info[nombre]
        return i === undefined || i === 'mal'
          ? { ruta, ok: false, codigo: 'FORMATO_NO_SOPORTADO' }
          : { ruta, ok: true, duracion_ms: i.duracion_ms, etiquetas: i.etiquetas ?? {} }
      })
    })
  })
}

async function archivo(...ruta: string[]): Promise<string> {
  const destino = join(origen, ...ruta)
  await mkdir(join(destino, '..'), { recursive: true })
  await writeFile(destino, 'x')
  return destino
}

function montar(extra: Partial<DependenciasLote> = {}) {
  const biblioteca = new ServicioBiblioteca(datos)
  const encoladas: PeticionTrabajo[] = []
  const gestor = { encolar: (p: PeticionTrabajo) => encoladas.push(p), listar: () => [] }
  const ejecutar = lector({})
  const servicio = new ServicioLote({
    biblioteca,
    gestor,
    ejecutar,
    dialogo: {
      elegirArchivos: () => Promise.resolve(null),
      elegirCarpeta: () => Promise.resolve(null)
    },
    dirDatos: datos,
    ahora: () => ahora,
    ...extra
  })
  return { biblioteca, encoladas, servicio, ejecutar }
}

describe('duplicados de archivo (regla de la spec)', () => {
  const indice = [
    {
      youtubeId: null,
      nombreOriginal: 'uno.mp3',
      titulo: 'Canción Inventada',
      artista: 'Grupo Uno',
      duracionMs: 200_000
    }
  ]
  const fila = {
    nombre: 'otro.wav',
    duracionMs: 201_500,
    titulo: 'cancion inventada!',
    artista: 'GRUPO UNO'
  }

  it('mismo nombre y duración a ±1 s', () => {
    expect(
      esDuplicadoArchivo(indice, {
        ...fila,
        nombre: 'uno.mp3',
        titulo: 'x',
        artista: 'y',
        duracionMs: 200_900
      })
    ).toBe(true)
    expect(
      esDuplicadoArchivo(indice, {
        ...fila,
        nombre: 'uno.mp3',
        titulo: 'x',
        artista: 'y',
        duracionMs: 201_100
      })
    ).toBe(false)
  })

  it('misma identidad de título y artista (claveFlexible) a ±2 s', () => {
    expect(esDuplicadoArchivo(indice, fila)).toBe(true)
    expect(esDuplicadoArchivo(indice, { ...fila, duracionMs: 202_500 })).toBe(false)
    expect(esDuplicadoArchivo(indice, { ...fila, artista: 'Otro' })).toBe(false)
  })

  it('sin duración no hay duplicado ni se compara un título vacío', () => {
    expect(esDuplicadoArchivo(indice, { ...fila, duracionMs: null })).toBe(false)
    expect(
      esDuplicadoArchivo([{ ...indice[0]!, titulo: '', artista: '' }], {
        ...fila,
        nombre: 'z',
        titulo: '',
        artista: ''
      })
    ).toBe(false)
  })
})

describe('ServicioLote: lectura', () => {
  it('lee archivos sueltos y carpetas, con las propuestas de la feature 6 y sin crear nada', async () => {
    const a = await archivo('Artista Inventado - Tema Uno.mp3')
    const b = await archivo('Disco Inventado', '02 Tema Dos.mp3')
    await archivo('Disco Inventado', 'notas.txt')
    const { servicio, biblioteca } = montar({
      ejecutar: lector({
        'Artista Inventado - Tema Uno.mp3': { duracion_ms: 200_000 },
        '02 Tema Dos.mp3': {
          duracion_ms: 180_000,
          etiquetas: { title: 'Tema Dos', artist: 'Artista Inventado', album: 'Disco Inventado' }
        }
      })
    })
    const r = await servicio.leerArchivos([
      a,
      join(origen, 'Disco Inventado'),
      join(origen, 'no-existe.mp3')
    ])
    expect(r?.rechazadas).toBe(2) // un .txt dentro de la carpeta y una ruta inexistente
    expect(r?.filas.map((f) => [f.nombre, f.duracionMs, f.metadatos])).toEqual([
      [
        'Artista Inventado - Tema Uno.mp3',
        200_000,
        { titulo: 'Tema Uno', artista: 'Artista Inventado', album: null }
      ],
      [
        '02 Tema Dos.mp3',
        180_000,
        { titulo: 'Tema Dos', artista: 'Artista Inventado', album: 'Disco Inventado' }
      ]
    ])
    expect(r?.filas.every((f) => f.duplicado === null)).toBe(true)
    expect(new Set(r?.filas.map((f) => f.ref)).size).toBe(2)
    expect(b).toBeTruthy()
    expect(biblioteca.listar()).toEqual([])
  })

  it('el álbum de una fila sin etiquetas sale del nombre de la carpeta', async () => {
    await archivo('Querido Disco', '01 Tema.mp3')
    const { servicio } = montar({ ejecutar: lector({ '01 Tema.mp3': { duracion_ms: 100_000 } }) })
    const r = await servicio.leerCarpeta(join(origen, 'Querido Disco'))
    expect(r?.filas[0]?.metadatos.album).toBe('Querido Disco')
  })

  it('leerCarpeta devuelve solo el nombre de la carpeta, con ruta dada o con el diálogo, nunca la ruta (0384)', async () => {
    await archivo('Querido Disco', '01 Tema.mp3')
    const ruta = join(origen, 'Querido Disco')
    const { servicio } = montar({
      ejecutar: lector({ '01 Tema.mp3': { duracion_ms: 100_000 } }),
      dialogo: {
        elegirArchivos: () => Promise.resolve(null),
        elegirCarpeta: () => Promise.resolve(ruta)
      }
    })
    const conRuta = await servicio.leerCarpeta(ruta)
    const conDialogo = await servicio.leerCarpeta()
    expect(conRuta?.carpeta).toBe('Querido Disco')
    expect(conDialogo?.carpeta).toBe('Querido Disco')
    expect(conDialogo?.carpeta).not.toContain(origen)
  })

  it('un archivo ilegible es una fila con problema «ilegible» y el resto se lee', async () => {
    const buena = await archivo('buena.mp3')
    const mala = await archivo('mala.mp3')
    const { servicio } = montar({
      ejecutar: lector({ 'buena.mp3': { duracion_ms: 100_000 }, 'mala.mp3': 'mal' })
    })
    const r = await servicio.leerArchivos([mala, buena])
    expect(r?.filas.map((f) => [f.nombre, f.problema, f.duracionMs])).toEqual([
      ['mala.mp3', 'ilegible', null],
      ['buena.mp3', null, 100_000]
    ])
    expect(r?.rechazadas).toBe(0)
  })

  it('rechaza lo que no es audio, lo que está en la carpeta de datos y las rutas repetidas', async () => {
    const dentro = join(datos, 'biblioteca', 'x', 'fuente', 'mezcla.flac')
    await mkdir(join(dentro, '..'), { recursive: true })
    await writeFile(dentro, 'x')
    const texto = await archivo('notas.txt')
    const buena = await archivo('buena.mp3')
    const ejecutar = lector({ 'buena.mp3': { duracion_ms: 1000 } })
    const { servicio } = montar({ ejecutar })
    const r = await servicio.leerArchivos([dentro, texto, buena, buena])
    expect(r?.filas).toHaveLength(1)
    expect(r?.rechazadas).toBe(2)
    expect(r?.truncada).toBe(false)
    expect(ejecutar).toHaveBeenCalledTimes(1)
    await expect(servicio.leerArchivos(['relativa.mp3'])).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  })

  it('una carpeta sin audio da un resultado vacío sin lanzar el worker', async () => {
    await archivo('Vacia', 'solo.txt')
    const { servicio, ejecutar } = montar()
    expect(await servicio.leerCarpeta(join(origen, 'Vacia'))).toMatchObject({
      filas: [],
      rechazadas: 1,
      truncada: false
    })
    expect(ejecutar).not.toHaveBeenCalled()
  })

  it('sin rutas abre el diálogo y devuelve null si se cancela', async () => {
    const buena = await archivo('buena.mp3')
    const elegirArchivos = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce([buena])
    const { servicio } = montar({
      ejecutar: lector({ 'buena.mp3': { duracion_ms: 1000 } }),
      dialogo: { elegirArchivos, elegirCarpeta: () => Promise.resolve(null) }
    })
    expect(await servicio.leerArchivos()).toBeNull()
    expect((await servicio.leerArchivos())?.filas).toHaveLength(1)
    expect(await servicio.leerCarpeta()).toBeNull()
  })

  it('marca como YA_EN_BIBLIOTECA lo que ya está por nombre y duración', async () => {
    const buena = await archivo('Tema.mp3')
    const { servicio, biblioteca } = montar({
      ejecutar: lector({ 'Tema.mp3': { duracion_ms: 100_000 } })
    })
    const r1 = await servicio.leerArchivos([buena])
    await servicio.lote({
      entradas: [{ tipo: 'archivo', ref: r1!.filas[0]!.ref }],
      metadatos: [{ titulo: 'Tema', artista: 'A', album: null }]
    })
    expect(biblioteca.listar()).toHaveLength(1)
    const r2 = await servicio.leerArchivos([buena])
    expect(r2?.filas[0]?.duplicado).toBe('YA_EN_BIBLIOTECA')
  })
})

describe('ServicioLote: filas con problema, truncada, espacio y tiempo (0375)', () => {
  it('una canción de menos de 10 s es una fila «corta» y no se puede crear', async () => {
    const a = await archivo('corta.mp3')
    const b = await archivo('buena.mp3')
    const { servicio, biblioteca } = montar({
      ejecutar: lector({
        'corta.mp3': { duracion_ms: 9_000 },
        'buena.mp3': { duracion_ms: 10_000 }
      })
    })
    const r = await servicio.leerArchivos([a, b])
    expect(r?.filas.map((f) => f.problema)).toEqual(['corta', null])
    const res = await servicio.lote({
      entradas: r!.filas.map((f) => ({ tipo: 'archivo' as const, ref: f.ref })),
      metadatos: [
        { titulo: 'x', artista: '', album: null },
        { titulo: 'y', artista: '', album: null }
      ]
    })
    expect(res.omitidas).toEqual([{ fila: 0, motivo: 'AUDIO_DEMASIADO_CORTO' }])
    expect(biblioteca.listar()).toHaveLength(1)
  })

  it('un audio ilegible (sin permiso o que el worker no abre) no se puede crear: FORMATO_NO_SOPORTADO', async () => {
    const mala = await archivo('mala.mp3')
    const { servicio } = montar({ ejecutar: lector({ 'mala.mp3': 'mal' }) })
    const r = await servicio.leerArchivos([mala])
    expect(r?.filas[0]).toMatchObject({ problema: 'ilegible', duracionMs: null })
    const res = await servicio.lote({
      entradas: [{ tipo: 'archivo', ref: r!.filas[0]!.ref }],
      metadatos: [{ titulo: 'x', artista: '', album: null }]
    })
    expect(res).toEqual({ creadas: [], omitidas: [{ fila: 0, motivo: 'FORMATO_NO_SOPORTADO' }] })
  })

  it('con más de 500 archivos de audio devuelve 500 filas y truncada', async () => {
    for (let i = 0; i < 503; i++) await archivo('Disco', `${String(i).padStart(4, '0')}.mp3`)
    const info: Record<string, { duracion_ms: number }> = {}
    for (let i = 0; i < 503; i++)
      info[`${String(i).padStart(4, '0')}.mp3`] = { duracion_ms: 100_000 }
    const { servicio } = montar({ ejecutar: lector(info) })
    const r = await servicio.leerCarpeta(join(origen, 'Disco'))
    expect(r?.filas).toHaveLength(500)
    expect(r?.truncada).toBe(true)
  })

  it('las lecturas traen el espacio libre y el factor; espacioLibre() lo da suelto', async () => {
    const a = await archivo('a.mp3')
    const { servicio } = montar({
      ejecutar: lector({ 'a.mp3': { duracion_ms: 100_000 } }),
      espacioLibre: () => Promise.resolve(12345),
      factorMinutos: () => 0.4
    })
    expect(await servicio.leerArchivos([a])).toMatchObject({
      libreBytes: 12345,
      factorMinutos: 0.4
    })
    expect(await servicio.espacioLibre()).toEqual({ libreBytes: 12345, factorMinutos: 0.4 })
    const sin = montar()
    expect(await sin.servicio.espacioLibre()).toEqual({ libreBytes: null, factorMinutos: null })
  })
})

describe('ServicioLote: infoLista', () => {
  it('añade duplicado por entrada con el servicio de YouTube', async () => {
    const youtube = {
      leerLista: vi.fn().mockResolvedValue({
        titulo: 'Álbum',
        tipo: 'album',
        recortada: false,
        entradas: [
          {
            id: 'aaaaaaaaaaa',
            titulo: 'Uno',
            canal: 'C',
            duracion_s: 100,
            disponible: true,
            problema: null
          },
          {
            id: 'bbbbbbbbbbb',
            titulo: '[Private video]',
            canal: '',
            duracion_s: null,
            disponible: false,
            problema: 'no_disponible'
          }
        ]
      }),
      crearDeLote: vi.fn(),
      esDuplicado: (id: string) => id === 'aaaaaaaaaaa'
    }
    const { servicio } = montar({ youtube })
    expect(await servicio.infoLista('https://www.youtube.com/playlist?list=OLAK5uy_x')).toEqual({
      titulo: 'Álbum',
      tipo: 'album',
      recortada: false,
      libreBytes: null,
      factorMinutos: null,
      entradas: [
        {
          id: 'aaaaaaaaaaa',
          titulo: 'Uno',
          canal: 'C',
          duracionS: 100,
          disponible: true,
          problema: null,
          duplicado: 'YA_EN_BIBLIOTECA'
        },
        {
          id: 'bbbbbbbbbbb',
          titulo: '[Private video]',
          canal: '',
          duracionS: null,
          disponible: false,
          problema: 'no_disponible',
          duplicado: null
        }
      ]
    })
  })

  it('sin el módulo de YouTube responde ARGUMENTOS_NO_VALIDOS', async () => {
    const { servicio } = montar()
    await expect(
      servicio.infoLista('https://www.youtube.com/playlist?list=OLAK5uy_x')
    ).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  })
})

describe('ServicioLote: confirmar', () => {
  async function dosFilas() {
    const a = await archivo('a.mp3')
    const b = await archivo('b.mp3')
    const m = montar({
      ejecutar: lector({ 'a.mp3': { duracion_ms: 200_000 }, 'b.mp3': { duracion_ms: 100_000 } })
    })
    const lectura = await m.servicio.leerArchivos([a, b])
    return { ...m, a, b, filas: lectura!.filas }
  }

  it('crea las canciones en el orden de la tabla con la fuente pendiente y encola importar-archivo-cola', async () => {
    const { servicio, biblioteca, encoladas, filas } = await dosFilas()
    const r = await servicio.lote({
      entradas: filas.map((f) => ({ tipo: 'archivo' as const, ref: f.ref })),
      metadatos: [
        { titulo: 'Primera', artista: 'Artista', album: 'Disco' },
        { titulo: 'Segunda', artista: 'Artista', album: null }
      ]
    })
    expect(r.omitidas).toEqual([])
    expect(r.creadas).toHaveLength(2)
    const canciones = r.creadas.map((c) => biblioteca.obtener(c.id)!)
    expect(canciones.map((c) => c.metadatos.titulo)).toEqual(['Primera', 'Segunda'])
    expect(canciones[0]).toMatchObject({
      estado: 'borrador',
      metadatos: { duracion_ms: 200_000, album: 'Disco' },
      fuente: { tipo: 'archivo', nombre_original: 'a.mp3', mezcla: 'fuente/mezcla.flac' },
      pasos: { fuente: { estado: 'pendiente' } }
    })
    expect(canciones[0]?.fuente.ruta_pendiente).toMatch(/a\.mp3$/)
    expect(canciones[1]?.fuente.ruta_pendiente).toMatch(/b\.mp3$/)
    expect(encoladas.map((e) => [e.cancionId, e.cola, e.paso, e.comando])).toEqual(
      r.creadas.map((c) => [c.id, 'ligera', 'fuente', 'importar-archivo-cola'])
    )
  })

  it('al llegarle el turno comprueba el original y, al completarse, borra ruta_pendiente', async () => {
    const { servicio, biblioteca, encoladas, filas, a } = await dosFilas()
    const r = await servicio.lote({
      entradas: [{ tipo: 'archivo', ref: filas[0]!.ref }],
      metadatos: [{ titulo: 'Primera', artista: 'Artista', album: null }]
    })
    const id = r.creadas[0]!.id
    const peticion = encoladas[0]!
    const inicio = await peticion.alEmpezar!({ id: 't', cancionId: id }, {} as never)
    expect(inicio.args).toMatchObject({
      salida: join(datos, 'biblioteca', id),
      borrar_entrada: false
    })
    expect(String(inicio.args.entrada)).toMatch(/a\.mp3$/)

    const cambio = await peticion.alResultado!(
      {
        duracion_ms: 200_123,
        metadatos: { titulo: 't', artista: 'a', album: '' },
        etiquetas: {},
        ganancia_db: -3.5,
        lufs: -12,
        nombre_original: 'a.mp3',
        mezcla: 'fuente/mezcla.flac'
      },
      { intento: 1, args: {} }
    )
    const actualizada = await biblioteca.actualizar(id, cambio as never)
    expect(actualizada.duracionMs).toBe(200_123)
    const c = biblioteca.obtener(id)!
    expect(c.fuente.ganancia_db).toBe(-3.5)
    expect(c.fuente.ruta_pendiente).toBeUndefined()

    await rm(a)
    await expect(
      peticion.alEmpezar!({ id: 't', cancionId: id }, {} as never)
    ).rejects.toMatchObject({
      codigo: 'ARCHIVO_NO_ENCONTRADO'
    })
  })

  it('ARCHIVO_NO_ENCONTRADO también si el original vive ya en la carpeta de datos', async () => {
    const { servicio, biblioteca, encoladas, filas } = await dosFilas()
    const r = await servicio.lote({
      entradas: [{ tipo: 'archivo', ref: filas[0]!.ref }],
      metadatos: [{ titulo: 'Primera', artista: 'Artista', album: null }]
    })
    const id = r.creadas[0]!.id
    const dentro = join(datos, 'copia.mp3')
    await writeFile(dentro, 'x')
    await biblioteca.actualizar(id, { fuente: { ruta_pendiente: dentro } })
    await expect(
      encoladas[0]!.alEmpezar!({ id: 't', cancionId: id }, {} as never)
    ).rejects.toMatchObject({
      codigo: 'ARCHIVO_NO_ENCONTRADO'
    })
  })

  it('una referencia caducada o desconocida se omite y el resto se crea', async () => {
    const { servicio, filas } = await dosFilas()
    ahora = new Date(ahora.getTime() + VIDA_REF_MS + 1000)
    const r1 = await servicio.lote({
      entradas: [{ tipo: 'archivo', ref: filas[0]!.ref }],
      metadatos: [{ titulo: 'x', artista: '', album: null }]
    })
    expect(r1).toEqual({ creadas: [], omitidas: [{ fila: 0, motivo: 'ARCHIVO_NO_ENCONTRADO' }] })
  })

  it('el tope de 50 y un metadato por entrada los exige el contrato; main también', async () => {
    const { servicio, filas } = await dosFilas()
    const entrada = { tipo: 'archivo' as const, ref: filas[0]!.ref }
    await expect(
      servicio.lote({
        entradas: Array.from({ length: MAX_LOTE + 1 }, () => entrada),
        metadatos: Array.from({ length: MAX_LOTE + 1 }, () => ({
          titulo: 'x',
          artista: '',
          album: null
        }))
      })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    await expect(servicio.lote({ entradas: [entrada], metadatos: [] })).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  })

  it('un título vacío omite solo esa fila', async () => {
    const { servicio, filas } = await dosFilas()
    const r = await servicio.lote({
      entradas: filas.map((f) => ({ tipo: 'archivo' as const, ref: f.ref })),
      metadatos: [
        { titulo: '   ', artista: '', album: null },
        { titulo: 'Buena', artista: '', album: null }
      ]
    })
    expect(r.creadas).toHaveLength(1)
    expect(r.omitidas).toEqual([{ fila: 0, motivo: 'ERROR_INTERNO' }])
  })

  it('SIN_ESPACIO: no crea nada y dice cuántas caben', async () => {
    const GB = 1024 ** 3
    await archivo('a.mp3')
    await archivo('b.mp3')
    const { servicio, biblioteca, encoladas } = montar({
      ejecutar: lector({ 'a.mp3': { duracion_ms: 240_000 }, 'b.mp3': { duracion_ms: 240_000 } }),
      espacioLibre: () => Promise.resolve(GB + estimarEspacioLote([240_000]) + 1)
    })
    const l = await servicio.leerArchivos([join(origen, 'a.mp3'), join(origen, 'b.mp3')])
    const err = await servicio
      .lote({
        entradas: l!.filas.map((f) => ({ tipo: 'archivo' as const, ref: f.ref })),
        metadatos: [
          { titulo: 'A', artista: '', album: null },
          { titulo: 'B', artista: '', album: null }
        ]
      })
      .catch((e: unknown) => e)
    expect(err).toMatchObject({ codigo: 'SIN_ESPACIO', detalles: '{"caben":1}' })
    expect(biblioteca.listar()).toEqual([])
    expect(encoladas).toEqual([])
  })

  it('con YouTube desactivado rechaza las entradas de vídeo', async () => {
    const { servicio } = montar()
    await expect(
      servicio.lote({
        entradas: [{ tipo: 'youtube', id: 'aaaaaaaaaaa' }],
        metadatos: [{ titulo: 'x', artista: '', album: null }]
      })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
  })

  it('las entradas de YouTube se crean con el servicio de YouTube, en el orden de la tabla', async () => {
    const a = await archivo('a.mp3')
    const crearDeLote = vi.fn((id: string) => Promise.resolve({ id: `cancion-${id}` }))
    const { servicio } = montar({
      ejecutar: lector({ 'a.mp3': { duracion_ms: 100_000 } }),
      youtube: { leerLista: vi.fn(), crearDeLote: crearDeLote as never, esDuplicado: () => false }
    })
    const l = await servicio.leerArchivos([a])
    const r = await servicio.lote({
      entradas: [
        { tipo: 'youtube', id: 'aaaaaaaaaaa' },
        { tipo: 'archivo', ref: l!.filas[0]!.ref },
        { tipo: 'youtube', id: 'bbbbbbbbbbb' }
      ],
      metadatos: [
        { titulo: 'Uno', artista: '', album: null },
        { titulo: 'Dos', artista: '', album: null },
        { titulo: 'Tres', artista: '', album: null }
      ]
    })
    expect(crearDeLote.mock.calls.map((c) => c[0])).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb'])
    expect(r.creadas).toHaveLength(3)
    expect(r.creadas[0]?.id).toBe('cancion-aaaaaaaaaaa')
  })

  it('reintentar: solo canciones de archivo con ruta pendiente; el resto devuelve false', async () => {
    const { servicio, biblioteca, encoladas, filas } = await dosFilas()
    const r = await servicio.lote({
      entradas: [{ tipo: 'archivo', ref: filas[0]!.ref }],
      metadatos: [{ titulo: 'Primera', artista: 'Artista', album: null }]
    })
    const id = r.creadas[0]!.id
    await biblioteca.actualizar(id, {
      pasos: {
        fuente: { estado: 'error', error: { codigo: 'ARCHIVO_NO_ENCONTRADO', mensaje: 'x' } }
      }
    })
    expect(await servicio.reintentar(id)).toBe(true)
    expect(encoladas).toHaveLength(2)
    expect(biblioteca.obtener(id)?.pasos.fuente.estado).toBe('pendiente')
    expect(await servicio.reintentar('no-existe')).toBe(false)
  })
})
