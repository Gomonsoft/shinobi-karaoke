import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ErrorDatosInvalidos,
  estiloPredeterminado,
  type Catalogo,
  type Estilo,
  type ImpactoIpc,
  type OperacionTema,
  type ProgresoTemaIpc
} from '../../shared'
import { catalogoDePrueba, idDePrueba, temaDePrueba } from '../../shared/__fixtures__'
import { leerCatalogoEnDisco, montarServicio, PuertoDePrueba, type Montaje } from './puertoDePrueba'
import type { OpcionesServicioTemas } from './servicio'

const X = idDePrueba(1)
const Y = idDePrueba(2)
const Z = idDePrueba(3)

const estiloCon = (color: string): Estilo => {
  const e = estiloPredeterminado()
  e.letra.color = color
  return e
}

const catalogo = (extra: Partial<Catalogo> = {}): Catalogo =>
  catalogoDePrueba({
    predeterminado: X,
    temas: [
      temaDePrueba({ id: X, nombre: 'Uno', estilo: estiloCon('#111111') }),
      temaDePrueba({ id: Y, nombre: 'Dos', estilo: estiloCon('#222222') }),
      temaDePrueba({ id: Z, nombre: 'Tres', estilo: estiloCon('#333333') })
    ],
    ...extra
  })

const montajes: Montaje[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(montajes.splice(0).map((m) => m.limpiar()))
})

async function montar(
  cat: Catalogo,
  puerto: PuertoDePrueba,
  extra: Partial<OpcionesServicioTemas> = {}
): Promise<Montaje> {
  const m = await montarServicio(cat, puerto, extra)
  montajes.push(m)
  return m
}

const detallesDe = (e: unknown): ImpactoIpc => (e as { detalles: ImpactoIpc }).detalles

const heredar = { modo: 'heredar' } as const

describe('editar (T8, T10)', () => {
  const poblar = (): PuertoDePrueba => {
    const p = new PuertoDePrueba()
    p.añadir('asig', { titulo: 'A', apariencia: { modo: 'tema', tema_id: X } })
    p.añadir('alb', { titulo: 'B', artista: 'Abba', album: 'Arrival', apariencia: heredar })
    p.añadir('art', { titulo: 'C', artista: 'Queen', apariencia: heredar })
    p.añadir('pred', { titulo: 'D', apariencia: heredar })
    p.añadir('propio', { titulo: 'E' })
    p.añadir('otro', { titulo: 'F', apariencia: { modo: 'tema', tema_id: Y } })
    return p
  }
  const conGrupos = (): Catalogo =>
    catalogo({
      asignaciones: {
        artistas: [{ artista: 'queen', nombre_artista: 'Queen', tema_id: X }],
        albumes: [
          {
            artista: 'abba',
            album: 'arrival',
            nombre_artista: 'Abba',
            nombre_album: 'Arrival',
            tema_id: X
          }
        ]
      }
    })
  const op = (revisionTema = 1): OperacionTema => ({
    tipo: 'editar',
    temaId: X,
    revisionTema,
    estilo: estiloCon('#abcdef')
  })

  it('cuenta 4 afectadas con su desglose y escribe solo el catálogo', async () => {
    const p = poblar()
    const alCambiar = vi.fn()
    const { servicio, ruta } = await montar(conGrupos(), p, { alCambiar })
    const impacto = await servicio.previsualizar(op())
    expect(impacto.afectadas.map((a) => a.id)).toEqual(['asig', 'alb', 'art', 'pred'])
    expect(impacto.desglose).toMatchObject({ cancion: 1, album: 1, artista: 1, predeterminado: 1 })
    expect(impacto.afectadas.every((a) => a.efecto === 'cambia')).toBe(true)
    expect(impacto).toMatchObject({ revisionTema: 1, esPredeterminado: true, sesionEnCurso: false })

    const r = await servicio.ejecutar(op(), impacto.ficha)
    expect(r).toEqual({ catalogoEscrito: true, canciones: [] })
    expect(p.escritas).toEqual([])
    const guardado = (await leerCatalogoEnDisco(ruta)).temas.find((t) => t.id === X)
    expect(guardado).toMatchObject({ revision: 2, estilo: estiloCon('#abcdef') })
    expect(alCambiar).toHaveBeenCalledTimes(1)
  })

  it('T10: una canción nueva que hereda el predeterminado da CONFIRMACION_OBSOLETA con 5 afectadas y no escribe', async () => {
    const p = poblar()
    const { servicio, ruta } = await montar(conGrupos(), p)
    const impacto = await servicio.previsualizar(op())
    p.añadir('nueva', { titulo: 'G', apariencia: heredar })
    const error = await servicio.ejecutar(op(), impacto.ficha).catch((e: unknown) => e)
    expect(error).toMatchObject({ codigo: 'CONFIRMACION_OBSOLETA' })
    expect(detallesDe(error).afectadas).toHaveLength(5)
    expect((await leerCatalogoEnDisco(ruta)).temas.find((t) => t.id === X)?.revision).toBe(1)

    // La ficha nueva del error sí vale.
    const r = await servicio.ejecutar(op(), detallesDe(error).ficha)
    expect(r.catalogoEscrito).toBe(true)
  })

  it('una revisión de tema distinta (renombrar entre medias, o en la operación) da CONFIRMACION_OBSOLETA', async () => {
    const { servicio, ruta } = await montar(conGrupos(), poblar())
    const impacto = await servicio.previsualizar(op())
    await servicio.renombrar({ temaId: X, revisionTema: 1, nombre: 'Uno bis' })
    await expect(servicio.ejecutar(op(), impacto.ficha)).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
    await expect(servicio.previsualizar(op(1))).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
    expect((await leerCatalogoEnDisco(ruta)).temas.find((t) => t.id === X)?.estilo).toEqual(
      estiloCon('#111111')
    )
  })
})

describe('fichas', () => {
  it('son de un solo uso; una operación distinta de la previsualizada es ErrorDatosInvalidos', async () => {
    const p = new PuertoDePrueba()
    const { servicio } = await montar(catalogo(), p)
    const op: OperacionTema = { tipo: 'predeterminado', temaId: Y }
    const i = await servicio.previsualizar(op)
    await expect(servicio.ejecutar({ tipo: 'predeterminado', temaId: Z }, i.ficha)).rejects.toThrow(
      ErrorDatosInvalidos
    )
    // La ficha se consumió incluso con el error.
    await expect(servicio.ejecutar(op, i.ficha)).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
    const j = await servicio.previsualizar(op)
    await servicio.ejecutar(op, j.ficha)
    await expect(servicio.ejecutar(op, j.ficha)).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
  })

  it('la 17.ª expulsa a la más antigua y a los 10 min caducan (reloj falso)', async () => {
    let t = 0
    const { servicio } = await montar(catalogo(), new PuertoDePrueba(), { reloj: () => t })
    const op: OperacionTema = { tipo: 'predeterminado', temaId: Y }
    const fichas: string[] = []
    for (let i = 0; i < 17; i++) fichas.push((await servicio.previsualizar(op)).ficha)
    await expect(servicio.ejecutar(op, fichas[0]!)).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
    t = 10 * 60 * 1000 - 1
    const vigente = (await servicio.previsualizar(op)).ficha
    t += 10 * 60 * 1000 - 1
    await expect(servicio.ejecutar(op, vigente)).resolves.toMatchObject({ catalogoEscrito: true })
    const caduca = (await servicio.previsualizar(op)).ficha
    t += 10 * 60 * 1000
    await expect(servicio.ejecutar(op, caduca)).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
  })
})

describe('aplicar (B10)', () => {
  const lote = (): PuertoDePrueba => {
    const p = new PuertoDePrueba()
    for (let i = 1; i <= 5; i++) p.añadir(`s${i}`, { titulo: `a${i}`, artista: 'Queen' })
    return p
  }
  const ids = ['s1', 's2', 's3', 's4', 's5']
  const op: OperacionTema = {
    tipo: 'aplicar',
    cancionIds: ids,
    seleccion: { modo: 'tema', temaId: Z }
  }

  it('fallo en la 3.ª y la 4.ª cambiada entre confirmar y ejecutar: 3 aplicadas, 1 error, 1 omitida', async () => {
    const p = lote()
    const { servicio } = await montar(catalogo(), p)
    const impacto = await servicio.previsualizar(op)
    expect(impacto.afectadas.map((a) => a.efecto)).toEqual(Array(5).fill('cambia'))
    expect(impacto.desglose.propio).toBe(5)
    p.fallan.add('s3')
    p.alEscribir = (id): void => {
      if (id === 's1') p.canciones.get('s4')!.apariencia = { modo: 'tema', tema_id: Y }
    }
    const r = await servicio.ejecutar(op, impacto.ficha)
    expect(r.catalogoEscrito).toBe(false)
    expect(r.canciones.map((c) => c.estado)).toEqual([
      'aplicada',
      'aplicada',
      'error',
      'omitida',
      'aplicada'
    ])
    expect(r.canciones[2]).toMatchObject({ codigo: 'SIN_ESPACIO', titulo: 'a3', artista: 'Queen' })
    expect(r.canciones[3]).toMatchObject({ motivo: 'cambio', titulo: 'a4' })
    expect(p.escritas).toEqual(['s1', 's2', 's5'])
    for (const id of ['s1', 's2', 's5']) {
      const c = p.canciones.get(id)!
      expect(c.apariencia).toEqual({ modo: 'tema', tema_id: Z, tema_nombre: 'Tres' })
      expect(c.estilo).toEqual(estiloCon('#333333'))
    }
    expect(p.canciones.get('s3')!.apariencia).toBeUndefined()
    expect(p.canciones.get('s4')!.apariencia).toEqual({ modo: 'tema', tema_id: Y })
  })

  it('no_existe toma título y artista del impacto confirmado; dañadas y sin_cambios; heredar conserva la base', async () => {
    const p = new PuertoDePrueba()
    p.añadir('a', { titulo: 'Alfa', artista: 'Q', apariencia: { modo: 'tema', tema_id: Z } })
    p.añadir('b', {
      titulo: 'Beta',
      artista: 'R',
      apariencia: { modo: 'tema', tema_id: Y, base: { tipo: 'aleatorio', tema_id: Z } }
    })
    p.añadir('c', { titulo: 'Gamma' })
    p.danadas.add('c')
    const { servicio } = await montar(catalogo(), p)
    const sel = { modo: 'tema', temaId: Z } as const
    const o1: OperacionTema = { tipo: 'aplicar', cancionIds: ['a', 'b', 'c', 'zz'], seleccion: sel }
    const i1 = await servicio.previsualizar(o1)
    expect(i1.excluidas).toMatchObject({ danadas: 1, noExisten: 1 })
    expect(i1.afectadas.map((a) => [a.id, a.efecto])).toEqual([
      ['a', 'sin_cambios'],
      ['b', 'cambia']
    ])
    const r1 = await servicio.ejecutar(o1, i1.ficha)
    expect(r1.canciones.map((c) => [c.id, c.estado, c.motivo])).toEqual([
      ['a', 'sin_cambios', undefined],
      ['b', 'aplicada', undefined],
      ['c', 'omitida', 'danada'],
      ['zz', 'omitida', 'no_existe']
    ])

    // «Beta» desaparece tras confirmar: se rotula con lo confirmado.
    const o2: OperacionTema = {
      tipo: 'aplicar',
      cancionIds: ['a', 'b'],
      seleccion: { modo: 'heredar' }
    }
    const i2 = await servicio.previsualizar(o2)
    p.canciones.delete('b')
    const r2 = await servicio.ejecutar(o2, i2.ficha)
    expect(r2.canciones[1]).toMatchObject({
      id: 'b',
      estado: 'omitida',
      motivo: 'no_existe',
      titulo: 'Beta',
      artista: 'R'
    })
    expect(p.canciones.get('a')!.apariencia).toMatchObject({ modo: 'heredar', tema_nombre: 'Uno' })

    // Heredar conserva la base.
    p.añadir('b', {
      titulo: 'Beta',
      apariencia: { modo: 'tema', tema_id: Y, base: { tipo: 'aleatorio', tema_id: Z } }
    })
    const o3: OperacionTema = { tipo: 'aplicar', cancionIds: ['b'], seleccion: { modo: 'heredar' } }
    await servicio.ejecutar(o3, (await servicio.previsualizar(o3)).ficha)
    expect(p.canciones.get('b')!.apariencia).toEqual({
      modo: 'heredar',
      base: { tipo: 'aleatorio', tema_id: Z },
      tema_nombre: 'Tres'
    })
  })

  it('con una ficha inválida da CONFIRMACION_OBSOLETA; con el tema en borrado, BORRADO_PENDIENTE', async () => {
    const p = lote()
    const { servicio } = await montar(catalogo(), p)
    await expect(servicio.ejecutar(op, idDePrueba(77))).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
    expect(p.escritas).toEqual([])
    await expect(
      servicio.previsualizar({
        tipo: 'aplicar',
        cancionIds: ['s1'],
        seleccion: { modo: 'tema', temaId: idDePrueba(99) }
      })
    ).rejects.toMatchObject({ codigo: 'TEMA_NO_ENCONTRADO' })
  })

  it('el progreso de un lote de 50 llega a hechas: 50 y no pasa de 10 eventos por segundo', async () => {
    const p = new PuertoDePrueba()
    const todos: string[] = []
    for (let i = 0; i < 50; i++) {
      p.añadir(`n${i}`, { titulo: `t${i}` })
      todos.push(`n${i}`)
    }
    let t = 0
    const eventos: { p: ProgresoTemaIpc; t: number }[] = []
    const { servicio } = await montar(catalogo(), p, {
      reloj: () => (t += 30),
      alProgreso: (e) => eventos.push({ p: e, t })
    })
    const o: OperacionTema = {
      tipo: 'aplicar',
      cancionIds: todos,
      seleccion: { modo: 'tema', temaId: Y }
    }
    const i = await servicio.previsualizar(o)
    const antes = t
    await servicio.ejecutar(o, i.ficha)
    expect(eventos.at(-1)!.p).toEqual({
      ficha: i.ficha,
      operacion: 'aplicar',
      temaId: Y,
      hechas: 50,
      total: 50
    })
    expect(eventos.length).toBeGreaterThan(2)
    const segundos = (t - antes) / 1000
    expect(eventos.length / segundos).toBeLessThanOrEqual(10)
  })
})

describe('asignarGrupo (B5)', () => {
  const poblar = (): PuertoDePrueba => {
    const p = new PuertoDePrueba()
    p.añadir('g1', { titulo: 'g1', artista: 'Queen', apariencia: heredar })
    p.añadir('g2', { titulo: 'g2', artista: 'queen' })
    p.añadir('g3', { titulo: 'g3', artista: ' QUEEN ', apariencia: { modo: 'tema', tema_id: Y } })
    p.añadir('g4', { titulo: 'g4', artista: 'Queen', album: 'Greatest', apariencia: heredar })
    p.añadir('h1', { titulo: 'h1', artista: 'Brian', album: 'Greatest', apariencia: heredar })
    return p
  }
  const cat = (): Catalogo =>
    catalogo({
      asignaciones: {
        artistas: [],
        albumes: [
          {
            artista: 'queen',
            album: 'greatest',
            nombre_artista: 'Queen',
            nombre_album: 'Greatest',
            tema_id: Y
          }
        ]
      }
    })
  const asignar = (temaId: string | null): OperacionTema => ({
    tipo: 'asignarGrupo',
    nivel: 'artista',
    artista: ' Queen ',
    temaId
  })

  it('excluye personalizadas, asignadas y de álbum con tema; cuenta el grupo; quitar devuelve al siguiente nivel', async () => {
    const p = poblar()
    const { servicio, ruta } = await montar(cat(), p)
    const i = await servicio.previsualizar(asignar(Z))
    expect(i.afectadas.map((a) => a.id)).toEqual(['g1'])
    expect(i.afectadas[0]).toMatchObject({
      antes: { procedencia: 'predeterminado', temaId: X },
      despues: { procedencia: 'artista', temaId: Z },
      efecto: 'cambia'
    })
    expect(i.excluidas).toEqual({ propio: 1, cancion: 1, album: 1 })
    expect(i.totalGrupo).toBe(4)
    await servicio.ejecutar(asignar(Z), i.ficha)
    expect((await leerCatalogoEnDisco(ruta)).asignaciones.artistas).toEqual([
      { artista: 'queen', nombre_artista: 'Queen', tema_id: Z }
    ])
    expect(p.escritas).toEqual([])

    const q = await servicio.previsualizar(asignar(null))
    expect(q.afectadas[0]).toMatchObject({
      antes: { procedencia: 'artista', temaId: Z },
      despues: { procedencia: 'predeterminado', temaId: X }
    })
    await servicio.ejecutar(asignar(null), q.ficha)
    expect((await leerCatalogoEnDisco(ruta)).asignaciones.artistas).toEqual([])
  })

  it('a nivel de álbum el homónimo de otro artista no cuenta', async () => {
    const { servicio } = await montar(cat(), poblar())
    const op: OperacionTema = {
      tipo: 'asignarGrupo',
      nivel: 'album',
      artista: 'queen',
      album: 'GREATEST',
      temaId: Z
    }
    const i = await servicio.previsualizar(op)
    expect(i.totalGrupo).toBe(1)
    expect(i.afectadas.map((a) => a.id)).toEqual(['g4'])
  })

  it('quitar un tema de grupo cuyas canciones tienen una base inexistente da procedencia respaldo', async () => {
    const p = new PuertoDePrueba()
    p.añadir('r1', {
      titulo: 'r1',
      artista: 'Queen',
      apariencia: { modo: 'heredar', base: { tipo: 'aleatorio', tema_id: idDePrueba(98) } }
    })
    const { servicio } = await montar(
      catalogo({
        asignaciones: {
          artistas: [{ artista: 'queen', nombre_artista: 'Queen', tema_id: Y }],
          albumes: []
        }
      }),
      p
    )
    const i = await servicio.previsualizar(asignar(null))
    expect(i.afectadas[0]).toMatchObject({ despues: { procedencia: 'respaldo' }, efecto: 'cambia' })
  })
})

describe('predeterminado (A1, B1, C1)', () => {
  const poblar = (): PuertoDePrueba => {
    const p = new PuertoDePrueba()
    p.añadir('p1', { titulo: 'a', artista: 'Ana', apariencia: heredar })
    p.añadir('p2', { titulo: 'b', apariencia: heredar })
    p.añadir('p3', { titulo: 'c', apariencia: heredar })
    p.añadir('azar', {
      titulo: 'd',
      apariencia: { modo: 'heredar', base: { tipo: 'aleatorio', tema_id: Z } }
    })
    p.añadir('ant', {
      titulo: 'e',
      apariencia: { modo: 'heredar', base: { tipo: 'predeterminado_anterior', tema_id: Z } }
    })
    p.añadir('inc', { titulo: 'f', apariencia: { modo: 'heredar', base: { tipo: 'incluido' } } })
    p.añadir('propio', { titulo: 'g' })
    return p
  }
  const aT = (temaId: string | null): OperacionTema => ({ tipo: 'predeterminado', temaId })

  it('A1: de X a Y cambia solo a las que no tienen base', async () => {
    const p = poblar()
    const { servicio, ruta } = await montar(catalogo(), p)
    const i = await servicio.previsualizar(aT(Y))
    expect(i.afectadas.map((a) => a.id)).toEqual(['p1', 'p2', 'p3'])
    expect(i.afectadas[0]).toMatchObject({
      antes: { procedencia: 'predeterminado', temaId: X },
      despues: { procedencia: 'predeterminado', temaId: Y },
      efecto: 'cambia'
    })
    const r = await servicio.ejecutar(aT(Y), i.ficha)
    expect(r).toEqual({ catalogoEscrito: true, canciones: [] })
    expect((await leerCatalogoEnDisco(ruta)).predeterminado).toBe(Y)
    const res = (id: string) => servicio.resolver(p.canciones.get(id)!)
    expect(res('p1')).toMatchObject({ procedencia: 'predeterminado', temaId: Y })
    expect(res('azar')).toMatchObject({ procedencia: 'aleatorio', temaId: Z })
    expect(res('ant')).toMatchObject({ procedencia: 'predeterminado_anterior', temaId: Z })
    expect(res('inc').procedencia).toBe('incluido')
    expect(p.escritas).toEqual([])
  })

  it('C1: de null a un tema afecta a las sin base (procedencia incluido) y no a las de base', async () => {
    const p = poblar()
    const { servicio } = await montar(catalogo({ predeterminado: null }), p)
    const i = await servicio.previsualizar(aT(Y))
    expect(i.afectadas.map((a) => a.id)).toEqual(['p1', 'p2', 'p3'])
    expect(i.afectadas[0]!.antes.procedencia).toBe('incluido')
    expect(i.desglose.incluido).toBe(3)
  })

  it('B1: quitar X conserva el aspecto con base predeterminado_anterior y rotula cada entrada', async () => {
    const p = poblar()
    const progreso: ProgresoTemaIpc[] = []
    const { servicio, ruta } = await montar(catalogo(), p, { alProgreso: (e) => progreso.push(e) })
    const i = await servicio.previsualizar(aT(null))
    expect(i.afectadas.map((a) => [a.id, a.efecto, a.despues.procedencia])).toEqual([
      ['p1', 'fija_base', 'predeterminado_anterior'],
      ['p2', 'fija_base', 'predeterminado_anterior'],
      ['p3', 'fija_base', 'predeterminado_anterior']
    ])
    expect(i.afectadas[0]!.despues.temaId).toBe(X)
    const r = await servicio.ejecutar(aT(null), i.ficha)
    expect(r.catalogoEscrito).toBe(true)
    expect(r.canciones).toEqual([
      { id: 'p1', titulo: 'a', artista: 'Ana', estado: 'aplicada' },
      { id: 'p2', titulo: 'b', artista: 'Nadie', estado: 'aplicada' },
      { id: 'p3', titulo: 'c', artista: 'Nadie', estado: 'aplicada' }
    ])
    expect((await leerCatalogoEnDisco(ruta)).predeterminado).toBeNull()
    for (const id of ['p1', 'p2', 'p3']) {
      const c = p.canciones.get(id)!
      expect(c.apariencia).toMatchObject({
        modo: 'heredar',
        base: { tipo: 'predeterminado_anterior', tema_id: X },
        tema_nombre: 'Uno'
      })
      expect(servicio.resolver(c)).toMatchObject({
        procedencia: 'predeterminado_anterior',
        estilo: estiloCon('#111111')
      })
    }
    expect(progreso.at(-1)).toEqual({
      ficha: i.ficha,
      operacion: 'predeterminado',
      temaId: X,
      hechas: 3,
      total: 3
    })
    // Editar X después las cambia.
    const e: OperacionTema = {
      tipo: 'editar',
      temaId: X,
      revisionTema: 1,
      estilo: estiloCon('#fedcba')
    }
    await servicio.ejecutar(e, (await servicio.previsualizar(e)).ficha)
    expect(servicio.resolver(p.canciones.get('p2')!).estilo).toEqual(estiloCon('#fedcba'))
  })

  it('B1 con fallo en la 2.ª de 3: [aplicada, error, pendiente], catálogo intacto y sin cambio de aspecto', async () => {
    const p = new PuertoDePrueba()
    for (const [id, titulo] of [
      ['p1', 'a'],
      ['p2', 'b'],
      ['p3', 'c']
    ] as const) {
      p.añadir(id, { titulo, artista: 'Ana', apariencia: heredar })
    }
    p.fallan.add('p2')
    const { servicio, ruta } = await montar(catalogo(), p)
    const antes = ['p1', 'p2', 'p3'].map((id) => servicio.resolver(p.canciones.get(id)!).estilo)
    const i = await servicio.previsualizar(aT(null))
    const r = await servicio.ejecutar(aT(null), i.ficha)
    expect(r.catalogoEscrito).toBe(false)
    expect(r.canciones).toEqual([
      { id: 'p1', titulo: 'a', artista: 'Ana', estado: 'aplicada' },
      { id: 'p2', titulo: 'b', artista: 'Ana', estado: 'error', codigo: 'SIN_ESPACIO' },
      { id: 'p3', titulo: 'c', artista: 'Ana', estado: 'pendiente' }
    ])
    expect((await leerCatalogoEnDisco(ruta)).predeterminado).toBe(X)
    expect(servicio.datos()?.predeterminado).toBe(X)
    const despues = ['p1', 'p2', 'p3'].map((id) => servicio.resolver(p.canciones.get(id)!).estilo)
    expect(despues).toEqual(antes)

    // Reintento: solo cuenta las 2 que faltan.
    const reintento = await servicio.previsualizar(aT(null))
    expect(reintento.afectadas.map((a) => a.id)).toEqual(['p2', 'p3'])
    p.fallan.clear()
    const ok = await servicio.ejecutar(aT(null), reintento.ficha)
    expect(ok.catalogoEscrito).toBe(true)
    expect(ok.canciones.map((c) => c.estado)).toEqual(['aplicada', 'aplicada'])
    expect(servicio.datos()?.predeterminado).toBeNull()
  })
})

describe('solo lectura y borrado pendiente', () => {
  it('en solo lectura todas las operaciones responden TEMAS_SOLO_LECTURA sin escribir', async () => {
    const p = new PuertoDePrueba()
    const { servicio, ruta } = await montar({ esquema: 2 } as never, p)
    const antes = await leerCatalogoEnDisco(ruta)
    const ops: OperacionTema[] = [
      { tipo: 'editar', temaId: X, revisionTema: 1, estilo: estiloCon('#000001') },
      { tipo: 'borrar', temaId: X },
      { tipo: 'aplicar', cancionIds: ['a'], seleccion: { modo: 'heredar' } },
      { tipo: 'asignarGrupo', nivel: 'artista', artista: 'A', temaId: null },
      { tipo: 'predeterminado', temaId: null }
    ]
    for (const op of ops) {
      await expect(servicio.previsualizar(op)).rejects.toMatchObject({
        codigo: 'TEMAS_SOLO_LECTURA'
      })
      await expect(servicio.ejecutar(op, idDePrueba(1))).rejects.toMatchObject({
        codigo: 'TEMAS_SOLO_LECTURA'
      })
    }
    await expect(servicio.reanudarBorrado()).rejects.toMatchObject({ codigo: 'TEMAS_SOLO_LECTURA' })
    expect(await leerCatalogoEnDisco(ruta)).toEqual(antes)
  })

  it('con un tema en borrado, las operaciones sobre él dan BORRADO_PENDIENTE', async () => {
    const { servicio } = await montar(
      catalogo({
        borrado_pendiente: { tema_id: Y, iniciado: '2026-11-09T10:00:00Z', canciones: [] }
      }),
      new PuertoDePrueba()
    )
    const ops: OperacionTema[] = [
      { tipo: 'editar', temaId: Y, revisionTema: 1, estilo: estiloCon('#000001') },
      { tipo: 'borrar', temaId: Y },
      { tipo: 'borrar', temaId: Z },
      { tipo: 'aplicar', cancionIds: ['a'], seleccion: { modo: 'tema', temaId: Y } },
      { tipo: 'asignarGrupo', nivel: 'artista', artista: 'A', temaId: Y },
      { tipo: 'predeterminado', temaId: Y }
    ]
    for (const op of ops) {
      await expect(servicio.previsualizar(op)).rejects.toMatchObject({
        codigo: 'BORRADO_PENDIENTE'
      })
    }
  })
})
