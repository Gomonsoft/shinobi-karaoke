import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estiloPredeterminado, type Catalogo } from '../../shared'
import { catalogoDePrueba, idDePrueba, temaDePrueba } from '../../shared/__fixtures__'
import { flush, sistemaReal, type SistemaArchivos } from '../persistencia'
import { rutaCatalogo } from './catalogo'
import { ServicioTemas, type OpcionesServicioTemas, type PuertoCanciones } from './servicio'
import type { CancionIndice } from './usos'

let dir: string
let ruta: string
let contador = 0
let canciones: CancionIndice[]

const puerto: PuertoCanciones = {
  indice: () => canciones,
  leer: () => null,
  actualizar: () => Promise.resolve()
}

const abrir = (extra: Partial<OpcionesServicioTemas> = {}) =>
  ServicioTemas.abrir({
    dirBiblioteca: dir,
    puerto,
    estiloInicial: estiloPredeterminado(),
    ahora: () => '2026-11-09T12:00:00.000Z',
    nuevoId: () => idDePrueba(100 + ++contador),
    ...extra
  })

const leerCatalogo = async (): Promise<Catalogo> =>
  JSON.parse(await readFile(ruta, 'utf8')) as Catalogo

const ESTILO_B = (() => {
  const e = estiloPredeterminado()
  e.letra.color = '#112233'
  return e
})()

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'shinobi-servicio-temas-'))
  ruta = rutaCatalogo(dir)
  contador = 0
  canciones = []
})
afterEach(async () => {
  await flush()
  vi.useRealTimers()
  await rm(dir, { recursive: true, force: true })
})

describe('ServicioTemas · crear, renombrar, duplicar', () => {
  it('crear añade el tema sin aplicarlo ni hacerlo predeterminado, con .bak', async () => {
    const s = await abrir()
    const antes = s.datos()?.predeterminado
    const t = await s.crear({ nombre: '  Noche   ninja ', estilo: ESTILO_B })
    expect(t).toMatchObject({ nombre: 'Noche ninja', revision: 1, estilo: ESTILO_B })
    const c = await leerCatalogo()
    expect(c.temas).toHaveLength(2)
    expect(c.predeterminado).toBe(antes)
    expect(JSON.parse(await readFile(`${ruta}.bak`, 'utf8')).temas).toHaveLength(1)
  })

  it('nombre duplicado por clave: «noche  NINJA» choca con «Noche ninja»; «Noché ninja» no', async () => {
    const s = await abrir()
    await s.crear({ nombre: 'Noche ninja', estilo: ESTILO_B })
    await expect(s.crear({ nombre: 'noche  NINJA', estilo: ESTILO_B })).rejects.toMatchObject({
      codigo: 'TEMA_NOMBRE_DUPLICADO'
    })
    await expect(s.crear({ nombre: 'Noché ninja', estilo: ESTILO_B })).resolves.toBeDefined()
    expect(s.datos()?.temas).toHaveLength(3)
  })

  it('rechaza nombres vacíos o de más de 60 caracteres y estilos incompletos', async () => {
    const s = await abrir()
    await expect(s.crear({ nombre: '   ', estilo: ESTILO_B })).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    await expect(s.crear({ nombre: 'x'.repeat(61), estilo: ESTILO_B })).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    await expect(
      s.crear({ nombre: 'Roto', estilo: { version: 1 } as never })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
  })

  it('renombrar sube la revisión; con revisión antigua da CONFIRMACION_OBSOLETA', async () => {
    const s = await abrir()
    const t = await s.crear({ nombre: 'Uno', estilo: ESTILO_B })
    const r = await s.renombrar({ temaId: t.id, revisionTema: 1, nombre: 'UNO' }) // solo mayúsculas: permitido
    expect(r).toMatchObject({ nombre: 'UNO', revision: 2 })
    await expect(
      s.renombrar({ temaId: t.id, revisionTema: 1, nombre: 'Dos' })
    ).rejects.toMatchObject({ codigo: 'CONFIRMACION_OBSOLETA' })
    expect((await leerCatalogo()).temas.find((x) => x.id === t.id)?.nombre).toBe('UNO')
  })

  it('renombrar a un nombre ajeno ya usado da TEMA_NOMBRE_DUPLICADO; tema inexistente, TEMA_NO_ENCONTRADO', async () => {
    const s = await abrir()
    const t = await s.crear({ nombre: 'Uno', estilo: ESTILO_B })
    await expect(
      s.renombrar({ temaId: t.id, revisionTema: 1, nombre: ' shinobi ' })
    ).rejects.toMatchObject({ codigo: 'TEMA_NOMBRE_DUPLICADO' })
    await expect(
      s.renombrar({ temaId: idDePrueba(9), revisionTema: 1, nombre: 'X' })
    ).rejects.toMatchObject({ codigo: 'TEMA_NO_ENCONTRADO' })
    await expect(s.duplicar({ temaId: idDePrueba(9), nombre: 'X' })).rejects.toMatchObject({
      codigo: 'TEMA_NO_ENCONTRADO'
    })
  })

  it('duplicar da id nuevo, mismo estilo, revisión 1 y 0 usos', async () => {
    const s = await abrir()
    const origen = await s.crear({ nombre: 'Origen', estilo: ESTILO_B })
    const copia = await s.duplicar({ temaId: origen.id, nombre: 'Copia' })
    expect(copia.id).not.toBe(origen.id)
    expect(copia).toMatchObject({ nombre: 'Copia', revision: 1, estilo: ESTILO_B })
    const cat = s.catalogo()
    expect(cat.temas.find((t) => t.id === copia.id)?.usos.total).toBe(0)
    expect(cat.temas.find((t) => t.id === copia.id)?.grupos).toEqual({ artistas: [], albumes: [] })
  })

  it('un tema en borrado no admite renombrar ni duplicar (BORRADO_PENDIENTE)', async () => {
    const id = idDePrueba(1)
    await writeFile(
      ruta,
      JSON.stringify(
        catalogoDePrueba({
          temas: [temaDePrueba({ id })],
          borrado_pendiente: { tema_id: id, iniciado: '2026-11-09T10:00:00Z', canciones: [] }
        })
      ),
      'utf8'
    )
    const s = await abrir()
    await expect(s.renombrar({ temaId: id, revisionTema: 1, nombre: 'X' })).rejects.toMatchObject({
      codigo: 'BORRADO_PENDIENTE'
    })
    await expect(s.duplicar({ temaId: id, nombre: 'X' })).rejects.toMatchObject({
      codigo: 'BORRADO_PENDIENTE'
    })
  })

  it('emite temas:cambiado tras cada mutación', async () => {
    const alCambiar = vi.fn()
    const s = await abrir({ alCambiar })
    await s.crear({ nombre: 'Uno', estilo: ESTILO_B })
    expect(alCambiar).toHaveBeenCalledTimes(1)
    expect(alCambiar.mock.calls[0]?.[0].temas).toHaveLength(2)
  })
})

describe('ServicioTemas · catálogo apartado', () => {
  it('descartarAvisoApartado deja `apartado` en null de forma persistente', async () => {
    await writeFile(ruta, 'roto', 'utf8')
    const s = await abrir()
    expect(s.catalogo().apartado).toBe('2026-11-09T12:00:00.000Z')
    await s.descartarAvisoApartado()
    expect(s.catalogo().apartado).toBeNull()
    expect((await leerCatalogo()).apartado).toBeNull()
    expect((await abrir()).catalogo().apartado).toBeNull()
  })
})

describe('ServicioTemas · solo lectura', () => {
  it('con esquema 2: catalogo().soloLectura, nada se escribe y las mutaciones dan TEMAS_SOLO_LECTURA', async () => {
    const original = `${JSON.stringify({ esquema: 2, temas: [] }, null, 2)}\n`
    await writeFile(ruta, original, 'utf8')
    const s = await abrir()
    expect(s.catalogo().soloLectura).toBe(true)
    expect(s.catalogo().temas).toEqual([])
    const falla = { codigo: 'TEMAS_SOLO_LECTURA' }
    await expect(s.crear({ nombre: 'A', estilo: ESTILO_B })).rejects.toMatchObject(falla)
    await expect(
      s.renombrar({ temaId: idDePrueba(1), revisionTema: 1, nombre: 'B' })
    ).rejects.toMatchObject(falla)
    await expect(s.duplicar({ temaId: idDePrueba(1), nombre: 'C' })).rejects.toMatchObject(falla)
    await expect(s.descartarAvisoApartado()).rejects.toMatchObject(falla)
    expect(await readFile(ruta, 'utf8')).toBe(original)
  })

  it('resuelve con índice nulo: tema ausente da respaldo y `incluido` como base sigue valiendo', async () => {
    await writeFile(ruta, JSON.stringify({ esquema: 2 }), 'utf8')
    const s = await abrir()
    const estilo = estiloPredeterminado()
    expect(
      s.resolver({
        metadatos: {},
        estilo,
        apariencia: { modo: 'tema', tema_id: idDePrueba(1) }
      }).procedencia
    ).toBe('respaldo')
    expect(
      s.resolver({
        metadatos: {},
        estilo,
        apariencia: { modo: 'heredar', base: { tipo: 'incluido' } }
      }).procedencia
    ).toBe('incluido')
  })
})

describe('ServicioTemas · cola', () => {
  it('serializa dos mutaciones simultáneas: se escriben en orden y cada promesa se resuelve tras su escritura', async () => {
    const s = await abrir()
    const orden: string[] = []
    const p1 = s.crear({ nombre: 'Primero', estilo: ESTILO_B }).then(async (t) => {
      orden.push('fin primero')
      expect((await leerCatalogo()).temas.map((x) => x.nombre)).toContain('Primero')
      return t
    })
    const p2 = s.crear({ nombre: 'Segundo', estilo: ESTILO_B }).then((t) => {
      orden.push('fin segundo')
      return t
    })
    await Promise.all([p1, p2])
    expect(orden).toEqual(['fin primero', 'fin segundo'])
    expect((await leerCatalogo()).temas.map((x) => x.nombre)).toEqual([
      'Shinobi',
      'Primero',
      'Segundo'
    ])
  })

  it('un fallo de escritura rechaza esa promesa, no cambia la memoria y no bloquea la cola', async () => {
    let fallos = 0
    const sistema: SistemaArchivos = {
      ...sistemaReal,
      renombrar: (o, d) =>
        fallos > 0 && fallos-- > 0
          ? Promise.reject(new Error('disco lleno'))
          : sistemaReal.renombrar(o, d)
    }
    const s = await abrir({ sistema })
    fallos = 1
    const mala = s.crear({ nombre: 'Mala', estilo: ESTILO_B })
    const buena = s.crear({ nombre: 'Buena', estilo: ESTILO_B })
    await expect(mala).rejects.toThrow('disco lleno')
    await expect(buena).resolves.toMatchObject({ nombre: 'Buena' })
    expect(s.datos()?.temas.map((t) => t.nombre)).toEqual(['Shinobi', 'Buena'])
    expect((await leerCatalogo()).temas.map((t) => t.nombre)).toEqual(['Shinobi', 'Buena'])
  })

  it('enCola sirve a otras mutaciones (creación de canciones, metadatos)', async () => {
    const s = await abrir()
    const orden: number[] = []
    await Promise.all([
      s.enCola(async () => {
        await Promise.resolve()
        orden.push(1)
      }),
      s.enCola(() => void orden.push(2))
    ])
    expect(orden).toEqual([1, 2])
  })
})

describe('ServicioTemas · aparienciaInicial', () => {
  const tres = async () => {
    await writeFile(
      ruta,
      JSON.stringify(
        catalogoDePrueba({
          temas: [
            temaDePrueba({ id: idDePrueba(1), nombre: 'A' }),
            temaDePrueba({ id: idDePrueba(2), nombre: 'B', estilo: ESTILO_B }),
            temaDePrueba({ id: idDePrueba(3), nombre: 'C' })
          ]
        })
      ),
      'utf8'
    )
    return abrir()
  }

  it('con predeterminado hereda sin base y devuelve su estilo', async () => {
    const s = await abrir()
    const r = s.aparienciaInicial({ artista: 'X' })
    expect(r.apariencia).toEqual({ modo: 'heredar', tema_nombre: 'Shinobi' })
    expect(r.estilo).toEqual(estiloPredeterminado())
  })

  it('sin predeterminado reparte entre los 3 temas según el azar inyectado', async () => {
    const s = await tres()
    const elegidos = [0, 1, 2].map((i) => s.aparienciaInicial({}, () => i).apariencia)
    expect(elegidos.map((a) => (a.base?.tipo === 'aleatorio' ? a.base.tema_id : null))).toEqual([
      idDePrueba(1),
      idDePrueba(2),
      idDePrueba(3)
    ])
    const b = s.aparienciaInicial({}, () => 1)
    expect(b.estilo).toEqual(ESTILO_B)
    expect(b.apariencia.tema_nombre).toBe('B')
  })

  it('el azar recibe el rango [0, n) y nunca elige el tema en borrado', async () => {
    await writeFile(
      ruta,
      JSON.stringify(
        catalogoDePrueba({
          temas: [
            temaDePrueba({ id: idDePrueba(1), nombre: 'A' }),
            temaDePrueba({ id: idDePrueba(2), nombre: 'B' }),
            temaDePrueba({ id: idDePrueba(3), nombre: 'C' })
          ],
          borrado_pendiente: {
            tema_id: idDePrueba(2),
            iniciado: '2026-11-09T10:00:00Z',
            canciones: []
          }
        })
      ),
      'utf8'
    )
    const s = await abrir()
    const rango = vi.fn((_min: number, max: number) => max - 1)
    const vistos = new Set<string>()
    for (const i of [0, 1]) {
      const a = s.aparienciaInicial({}, (min, max) => {
        rango(min, max)
        return i
      }).apariencia
      if (a.base?.tipo === 'aleatorio') vistos.add(a.base.tema_id)
    }
    expect([...vistos].sort()).toEqual([idDePrueba(1), idDePrueba(3)])
    expect(rango).toHaveBeenCalledWith(0, 2)
  })

  it('con catálogo vacío da base incluido y el estilo de fábrica', async () => {
    await writeFile(ruta, JSON.stringify(catalogoDePrueba()), 'utf8')
    const s = await abrir()
    const r = s.aparienciaInicial({})
    expect(r.apariencia).toEqual({ modo: 'heredar', base: { tipo: 'incluido' } })
    expect(r.estilo).toEqual(estiloPredeterminado())
  })

  it('la precedencia de álbum y artista fija la instantánea, pero la base se guarda igual', async () => {
    await writeFile(
      ruta,
      JSON.stringify(
        catalogoDePrueba({
          temas: [
            temaDePrueba({ id: idDePrueba(1), nombre: 'A' }),
            temaDePrueba({ id: idDePrueba(2), nombre: 'B', estilo: ESTILO_B })
          ],
          asignaciones: {
            artistas: [{ artista: 'queen', nombre_artista: 'Queen', tema_id: idDePrueba(2) }],
            albumes: []
          }
        })
      ),
      'utf8'
    )
    const s = await abrir()
    const r = s.aparienciaInicial({ artista: 'QUEEN' }, () => 0)
    expect(r.estilo).toEqual(ESTILO_B)
    expect(r.apariencia).toMatchObject({
      modo: 'heredar',
      base: { tipo: 'aleatorio', tema_id: idDePrueba(1) },
      tema_nombre: 'B'
    })
  })

  it('el estilo devuelto es una copia', async () => {
    const s = await abrir()
    const r = s.aparienciaInicial({})
    r.estilo.letra.color = '#000000'
    expect(s.datos()?.temas[0]?.estilo.letra.color).toBe('#FFFFFF')
  })
})

describe('ServicioTemas · eventos del índice', () => {
  it('notificarIndiceCambiado agrupa en 250 ms', async () => {
    vi.useFakeTimers()
    const alCambiar = vi.fn()
    const s = await abrir({ alCambiar })
    s.notificarIndiceCambiado()
    s.notificarIndiceCambiado()
    vi.advanceTimersByTime(249)
    expect(alCambiar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(alCambiar).toHaveBeenCalledTimes(1)
    s.notificarIndiceCambiado()
    vi.advanceTimersByTime(250)
    expect(alCambiar).toHaveBeenCalledTimes(2)
  })
})

describe('ServicioTemas · resolver (neutra y alHeredar)', () => {
  const SOL = idDePrueba(1)
  const NOCHE = idDePrueba(2)
  const montar = async (extra: Partial<Catalogo> = {}) => {
    await writeFile(
      ruta,
      JSON.stringify(
        catalogoDePrueba({
          temas: [
            temaDePrueba({ id: SOL, nombre: 'Sol' }),
            temaDePrueba({ id: NOCHE, nombre: 'Noche ninja', estilo: ESTILO_B })
          ],
          ...extra
        })
      ),
      'utf8'
    )
    return abrir()
  }
  const estilo = estiloPredeterminado()
  const queen = { artista: 'Queen', album: 'Opera' }
  const conAlbum: Partial<Catalogo> = {
    asignaciones: {
      artistas: [],
      albumes: [
        {
          artista: 'queen',
          album: 'opera',
          nombre_artista: 'Queen',
          nombre_album: 'Opera',
          tema_id: SOL
        }
      ]
    }
  }

  it('asignada a un tema en un álbum con tema de álbum: alHeredar es album', async () => {
    const s = await montar(conAlbum)
    const r = s.resolver({
      metadatos: queen,
      estilo,
      apariencia: { modo: 'tema', tema_id: NOCHE }
    })
    expect(r).toMatchObject({ procedencia: 'cancion', neutra: false })
    expect(r.alHeredar).toEqual({ procedencia: 'album', temaId: SOL, temaNombre: 'Sol' })
  })

  it('base predeterminado_anterior sin tema de grupo', async () => {
    const s = await montar({ predeterminado: SOL })
    const r = s.resolver({
      metadatos: {},
      estilo,
      apariencia: { modo: 'heredar', base: { tipo: 'predeterminado_anterior', tema_id: NOCHE } }
    })
    expect(r.neutra).toBe(true)
    expect(r.alHeredar).toEqual({
      procedencia: 'predeterminado_anterior',
      temaId: NOCHE,
      temaNombre: 'Noche ninja'
    })
  })

  it('sin base y con predeterminado: predeterminado; una canción propia también lo trae', async () => {
    const s = await montar({ predeterminado: SOL })
    expect(
      s.resolver({ metadatos: {}, estilo, apariencia: { modo: 'heredar' } }).alHeredar
    ).toEqual({ procedencia: 'predeterminado', temaId: SOL, temaNombre: 'Sol' })
    const propia = s.resolver({ metadatos: {}, estilo: ESTILO_B })
    expect(propia.procedencia).toBe('propio')
    expect(propia.neutra).toBe(false)
    expect(propia.alHeredar.procedencia).toBe('predeterminado')
  })

  it('base aleatorio hacia un tema ausente: respaldo', async () => {
    const s = await montar()
    const r = s.resolver({
      metadatos: {},
      estilo,
      apariencia: { modo: 'heredar', base: { tipo: 'aleatorio', tema_id: idDePrueba(77) } }
    })
    expect(r.alHeredar.procedencia).toBe('respaldo')
    expect(r.alHeredar.temaId).toBe(idDePrueba(77))
  })
})
