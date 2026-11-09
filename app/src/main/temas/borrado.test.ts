import { afterEach, describe, expect, it } from 'vitest'
import {
  estiloPredeterminado,
  type Catalogo,
  type Estilo,
  type ProgresoTemaIpc,
  type OperacionTema
} from '../../shared'
import { catalogoDePrueba, idDePrueba, temaDePrueba } from '../../shared/__fixtures__'
import { sistemaReal } from '../persistencia'
import { leerCatalogoEnDisco, montarServicio, PuertoDePrueba, type Montaje } from './puertoDePrueba'
import type { OpcionesServicioTemas } from './servicio'

const X = idDePrueba(1)
const Y = idDePrueba(2)

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
      temaDePrueba({ id: Y, nombre: 'Dos', estilo: estiloCon('#222222') })
    ],
    ...extra
  })

const montajes: Montaje[] = []
afterEach(async () => {
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

const heredar = { modo: 'heredar' } as const
const borrar = (temaId: string): OperacionTema => ({ tipo: 'borrar', temaId })

/** Cinco canciones de predeterminado, t1..t5, cada una de un artista. */
const cinco = (): PuertoDePrueba => {
  const p = new PuertoDePrueba()
  for (let i = 1; i <= 5; i++)
    p.añadir(`c${i}`, { titulo: `t${i}`, artista: `A${i}`, apariencia: heredar })
  return p
}

describe('borrar (T18, A4)', () => {
  it('congela las 4 canciones que resuelven al tema con el estilo idéntico y retira el tema', async () => {
    const p = new PuertoDePrueba()
    p.añadir('p1', { titulo: 'a', apariencia: heredar })
    p.añadir('p2', { titulo: 'b', apariencia: heredar })
    p.añadir('alb', { titulo: 'c', artista: 'Abba', album: 'Arrival', apariencia: heredar })
    p.añadir('asig', { titulo: 'd', apariencia: { modo: 'tema', tema_id: X } })
    p.añadir('otra', { titulo: 'e', apariencia: { modo: 'tema', tema_id: Y } })
    p.añadir('propio', { titulo: 'f', estilo: estiloCon('#abcabc') })
    const cat = catalogo({
      asignaciones: {
        artistas: [{ artista: 'zeta', nombre_artista: 'Zeta', tema_id: X }],
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
    const { servicio, ruta } = await montar(cat, p)
    const antes = new Map(
      [...p.canciones.keys()].map((id) => [
        id,
        structuredClone(servicio.resolver(p.canciones.get(id)!))
      ])
    )

    const i = await servicio.previsualizar(borrar(X))
    expect(i.afectadas.map((a) => a.id)).toEqual(['p1', 'p2', 'alb', 'asig'])
    expect(i).toMatchObject({
      esPredeterminado: true,
      revisionTema: 1,
      asignacionesRetiradas: {
        artistas: ['Zeta'],
        albumes: [{ artista: 'Abba', album: 'Arrival' }]
      }
    })
    const r = await servicio.ejecutar(borrar(X), i.ficha)
    expect(r.catalogoEscrito).toBe(true)
    expect(r.canciones.map((c) => c.estado)).toEqual(Array(4).fill('aplicada'))

    for (const id of ['p1', 'p2', 'alb', 'asig']) {
      const c = p.canciones.get(id)!
      expect(c.apariencia).toEqual({ modo: 'propio' })
      expect(c.estilo).toEqual(estiloCon('#111111'))
      expect(c.estilo).toEqual(antes.get(id)!.estilo)
      expect(servicio.resolver(c).procedencia).toBe('propio')
    }
    expect(p.canciones.get('otra')!.apariencia).toEqual({ modo: 'tema', tema_id: Y })
    expect(p.canciones.get('propio')!.estilo).toEqual(estiloCon('#abcabc'))
    const c = await leerCatalogoEnDisco(ruta)
    expect(c.temas.map((t) => t.id)).toEqual([Y])
    expect(c.predeterminado).toBeNull()
    expect(c.asignaciones).toEqual({ artistas: [], albumes: [] })
    expect(c.borrado_pendiente).toBeNull()
    expect(servicio.catalogo().borradoPendiente).toBeNull()
  })

  it('una canción con base hacia el tema que hereda de su artista pierde la base y conserva su aspecto', async () => {
    const p = new PuertoDePrueba()
    // Hereda de su artista (tema Y): la base hacia X es solo un vínculo latente.
    p.añadir('latente', {
      titulo: 'a',
      artista: 'Queen',
      estilo: estiloCon('#222222'),
      apariencia: {
        modo: 'heredar',
        base: { tipo: 'predeterminado_anterior', tema_id: X },
        tema_nombre: 'Dos'
      }
    })
    p.añadir('porBase', {
      titulo: 'b',
      apariencia: { modo: 'heredar', base: { tipo: 'aleatorio', tema_id: X } }
    })
    const cat = catalogo({
      predeterminado: Y,
      asignaciones: {
        artistas: [{ artista: 'queen', nombre_artista: 'Queen', tema_id: Y }],
        albumes: []
      }
    })
    const { servicio } = await montar(cat, p)
    const i = await servicio.previsualizar(borrar(X))
    // Solo la que resuelve a X cuenta en el impacto, pero la otra también se escribe.
    expect(i.afectadas.map((a) => a.id)).toEqual(['porBase'])
    const r = await servicio.ejecutar(borrar(X), i.ficha)
    expect(r.canciones.map((c) => [c.id, c.titulo, c.estado])).toEqual([
      ['latente', 'a', 'aplicada'],
      ['porBase', 'b', 'aplicada']
    ])
    const latente = p.canciones.get('latente')!
    expect(latente.apariencia).toEqual({ modo: 'heredar', tema_nombre: 'Dos' })
    expect(servicio.resolver(latente)).toMatchObject({ procedencia: 'artista', temaId: Y })
    expect(p.canciones.get('porBase')!.apariencia).toEqual({ modo: 'propio' })
    expect(p.canciones.get('porBase')!.estilo).toEqual(estiloCon('#111111'))
  })
})

describe('borrado interrumpido (T19)', () => {
  const sinRespaldo = (servicio: Montaje['servicio'], p: PuertoDePrueba): void => {
    for (const c of p.canciones.values()) {
      expect(servicio.resolver(c).procedencia).not.toBe('respaldo')
    }
  }

  it('fallo en la 3.ª de 5: resultado completo, tema con diario, reanudar termina y emite progreso sin ficha', async () => {
    const p = cinco()
    p.fallan.add('c3')
    const progreso: ProgresoTemaIpc[] = []
    const { servicio, ruta } = await montar(catalogo(), p, { alProgreso: (e) => progreso.push(e) })
    const i = await servicio.previsualizar(borrar(X))
    const r = await servicio.ejecutar(borrar(X), i.ficha)
    expect(r.catalogoEscrito).toBe(false)
    expect(r.canciones).toEqual([
      { id: 'c1', titulo: 't1', artista: 'A1', estado: 'aplicada' },
      { id: 'c2', titulo: 't2', artista: 'A2', estado: 'aplicada' },
      { id: 'c3', titulo: 't3', artista: 'A3', estado: 'error', codigo: 'SIN_ESPACIO' },
      { id: 'c4', titulo: 't4', artista: 'A4', estado: 'pendiente' },
      { id: 'c5', titulo: 't5', artista: 'A5', estado: 'pendiente' }
    ])
    expect(progreso.at(-1)).toEqual({
      ficha: i.ficha,
      operacion: 'borrar',
      temaId: X,
      hechas: 2,
      total: 5
    })
    const en = await leerCatalogoEnDisco(ruta)
    expect(en.temas.map((t) => t.id)).toContain(X)
    expect(en.borrado_pendiente).toMatchObject({
      tema_id: X,
      canciones: ['c1', 'c2', 'c3', 'c4', 'c5']
    })
    expect(servicio.catalogo().borradoPendiente).toEqual({
      temaId: X,
      nombre: 'Uno',
      total: 5,
      restantes: 3
    })
    expect(servicio.catalogo().temas.find((t) => t.id === X)?.enBorrado).toBe(true)
    sinRespaldo(servicio, p)

    // Mientras dura, las operaciones sobre el tema se rechazan.
    await expect(
      servicio.renombrar({ temaId: X, revisionTema: 1, nombre: 'N' })
    ).rejects.toMatchObject({ codigo: 'BORRADO_PENDIENTE' })
    await expect(servicio.duplicar({ temaId: X, nombre: 'N' })).rejects.toMatchObject({
      codigo: 'BORRADO_PENDIENTE'
    })

    progreso.length = 0
    p.fallan.clear()
    const fin = await servicio.reanudarBorrado()
    expect(fin.catalogoEscrito).toBe(true)
    expect(fin.canciones.map((c) => [c.id, c.estado])).toEqual([
      ['c3', 'aplicada'],
      ['c4', 'aplicada'],
      ['c5', 'aplicada']
    ])
    expect(progreso.length).toBeGreaterThan(0)
    expect(
      progreso.every((e) => e.ficha === null && e.operacion === 'borrar' && e.temaId === X)
    ).toBe(true)
    expect(progreso.at(-1)).toMatchObject({ hechas: 3, total: 3 })
    const final = await leerCatalogoEnDisco(ruta)
    expect(final.temas.map((t) => t.id)).toEqual([Y])
    expect(final.borrado_pendiente).toBeNull()
    expect(final.predeterminado).toBeNull()
    for (const c of p.canciones.values()) {
      expect(c.apariencia).toEqual({ modo: 'propio' })
      expect(c.estilo).toEqual(estiloCon('#111111'))
    }
  })

  it('cancelarBorrado deja el tema disponible y las 2 convertidas como propias', async () => {
    const p = cinco()
    p.fallan.add('c3')
    const { servicio } = await montar(catalogo(), p)
    const i = await servicio.previsualizar(borrar(X))
    await servicio.ejecutar(borrar(X), i.ficha)
    await servicio.cancelarBorrado()
    expect(servicio.catalogo().borradoPendiente).toBeNull()
    expect(servicio.catalogo().temas.find((t) => t.id === X)?.enBorrado).toBe(false)
    expect(p.canciones.get('c1')!.apariencia).toEqual({ modo: 'propio' })
    expect(p.canciones.get('c2')!.apariencia).toEqual({ modo: 'propio' })
    expect(p.canciones.get('c3')!.apariencia).toEqual(heredar)
    sinRespaldo(servicio, p)
    // Se puede volver a editar.
    await expect(
      servicio.previsualizar({
        tipo: 'editar',
        temaId: X,
        revisionTema: 1,
        estilo: estiloCon('#000002')
      })
    ).resolves.toBeDefined()
    // Cancelar sin diario no hace nada.
    await expect(servicio.cancelarBorrado()).resolves.toBeUndefined()
    await expect(servicio.reanudarBorrado()).rejects.toMatchObject({ codigo: 'TEMA_NO_ENCONTRADO' })
  })

  it('un fallo al escribir el diario no cambia nada', async () => {
    const p = cinco()
    let rotos = false
    const { servicio, ruta } = await montar(catalogo(), p, {
      sistema: {
        ...sistemaReal,
        escribirYSincronizar: (r, c) =>
          rotos ? Promise.reject(new Error('disco lleno')) : sistemaReal.escribirYSincronizar(r, c)
      }
    })
    const i = await servicio.previsualizar(borrar(X))
    rotos = true
    await expect(servicio.ejecutar(borrar(X), i.ficha)).rejects.toThrow('disco lleno')
    rotos = false
    expect(p.escritas).toEqual([])
    expect(servicio.datos()?.borrado_pendiente).toBeNull()
    expect((await leerCatalogoEnDisco(ruta)).borrado_pendiente).toBeNull()
  })

  it('cierre entre congelación y retirada: el proceso nuevo no reanuda solo, reanudar termina y congela también lo nuevo del álbum', async () => {
    const p = new PuertoDePrueba()
    p.añadir('c1', { titulo: 't1', artista: 'Abba', album: 'Arrival', apariencia: heredar })
    p.añadir('c2', { titulo: 't2', artista: 'Abba', album: 'Arrival', apariencia: heredar })
    p.añadir('c3', { titulo: 't3', artista: 'Abba', album: 'Arrival', apariencia: heredar })
    p.fallan.add('c2')
    const cat = catalogo({
      predeterminado: Y,
      asignaciones: {
        artistas: [],
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
    const m = await montar(cat, p)
    await m.servicio.ejecutar(borrar(X), (await m.servicio.previsualizar(borrar(X))).ficha)
    expect(p.escritas).toEqual(['c1'])
    m.servicio.cerrar()

    // Mientras la app estaba cerrada se creó otra canción en el álbum.
    p.añadir('c4', { titulo: 't4', artista: 'ABBA', album: 'arrival', apariencia: heredar })
    p.fallan.clear()
    const nuevo = await m.reabrir()
    expect(nuevo.catalogo().borradoPendiente).toMatchObject({ temaId: X, total: 3, restantes: 3 })
    expect(p.escritas).toEqual(['c1'])
    const r = await nuevo.reanudarBorrado()
    expect(r.catalogoEscrito).toBe(true)
    expect(r.canciones.map((c) => c.id)).toEqual(['c2', 'c3', 'c4'])
    for (const id of ['c1', 'c2', 'c3', 'c4']) {
      expect(p.canciones.get(id)!.apariencia).toEqual({ modo: 'propio' })
      expect(p.canciones.get(id)!.estilo).toEqual(estiloCon('#111111'))
    }
    const c = await leerCatalogoEnDisco(m.ruta)
    expect(c.asignaciones.albumes).toEqual([])
    expect(c.temas.map((t) => t.id)).toEqual([Y])
  })
})

describe('tema en borrado y sorteo', () => {
  it('aparienciaInicial nunca elige el tema en borrado', async () => {
    const { servicio } = await montar(
      catalogo({
        predeterminado: null,
        borrado_pendiente: { tema_id: X, iniciado: '2026-11-09T10:00:00Z', canciones: [] }
      }),
      new PuertoDePrueba()
    )
    const vistos = new Set<number>()
    const r = servicio.aparienciaInicial({}, (min, max) => {
      vistos.add(max - min)
      return min
    })
    expect(vistos).toEqual(new Set([1]))
    expect(r.apariencia.base).toEqual({ tipo: 'aleatorio', tema_id: Y })
  })
})
