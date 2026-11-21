import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { estiloPredeterminado, type Cancion, type Catalogo } from '../../shared'
import { FIXTURES } from '../../shared/__fixtures__'
import { flush } from '../persistencia'
import { ServicioTemas } from '../temas'
import {
  catalogoDeSemilla,
  sembrar,
  TEMA_INEXISTENTE,
  TEMA_NEON,
  TEMA_NOCHE_NINJA,
  TEMA_SOL
} from './semilla'
import { ServicioBiblioteca } from './servicio'

let datos: string
let biblio: string
const idSemilla = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`

beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-bib-temas-'))
  biblio = join(datos, 'biblioteca')
})
afterEach(async () => {
  await flush()
  await rm(datos, { recursive: true, force: true })
})

async function abrir(): Promise<{ b: ServicioBiblioteca; t: ServicioTemas }> {
  await mkdir(biblio, { recursive: true })
  const b = new ServicioBiblioteca(datos)
  const t = await ServicioTemas.abrir({
    dirBiblioteca: biblio,
    puerto: b.puerto(),
    estiloInicial: estiloPredeterminado(),
    esperaIndiceMs: 5
  })
  b.conectarTemas(t)
  await b.arrancar()
  return { b, t }
}

async function hashes(): Promise<Record<string, string>> {
  const r: Record<string, string> = {}
  const ids = (await readdir(biblio)).filter((n) => !n.startsWith('.') && n !== 'temas.json')
  for (const id of ids) {
    const bytes = await readFile(join(biblio, id, 'cancion.json'))
    r[id] = createHash('sha256').update(bytes).digest('hex')
  }
  return r
}

const leerDisco = async (id: string): Promise<Cancion> =>
  JSON.parse(await readFile(join(biblio, id, 'cancion.json'), 'utf8')) as Cancion

function datosNuevos(artista: string, album: string | null = null) {
  const b = FIXTURES.borradorRecienCreado()
  return {
    metadatos: { ...b.metadatos, artista, album },
    fuente: b.fuente,
    pasos: { fuente: b.pasos.fuente }
  }
}

describe('biblioteca de esquema 1 (0.1.0)', () => {
  it('se abre y se lista como propio sin reescribir ningún cancion.json', async () => {
    await sembrar(datos)
    const antes = await hashes()
    const { b, t } = await abrir()
    const lista = b.listar().filter((c) => !c.danada)
    expect(lista.length).toBeGreaterThan(10)
    for (const c of lista) {
      expect(c.apariencia).toMatchObject({ modo: 'propio', procedencia: 'propio', temaId: null })
      const disco = await leerDisco(c.id)
      expect(disco.apariencia).toBeUndefined()
      expect(c.estilo).toEqual(disco.estilo)
    }
    await flush()
    // Salvo las canciones con un paso `en_curso`, que al arrancar pasan a `interrumpido` (ADR 0006,
    // comportamiento de 0.1.0 ajeno a los temas), ningún archivo cambia.
    const despues = await hashes()
    const interrumpidas = Object.keys(antes).filter((id) => antes[id] !== despues[id])
    for (const id of interrumpidas) {
      const pasos = Object.values((await leerDisco(id)).pasos)
      expect(pasos.some((p) => p.estado === 'interrumpido')).toBe(true)
    }
    expect(interrumpidas.length).toBeLessThanOrEqual(2)
    expect(t.datos()?.temas.map((x) => x.nombre)).toEqual(['Shinobi'])
  })
})

describe('creación de canciones', () => {
  it('con predeterminado hereda sin base y resuelve predeterminado; la instantánea coincide', async () => {
    const { b, t } = await abrir()
    const r = await b.crear(datosNuevos('Nadie'))
    expect(r.apariencia).toMatchObject({ modo: 'heredar', procedencia: 'predeterminado' })
    const disco = await leerDisco(r.id)
    expect(disco.apariencia).toEqual({ modo: 'heredar', tema_nombre: 'Shinobi' })
    expect(disco.estilo).toEqual(t.datos()?.temas[0]?.estilo)
  })

  it('con tema de artista resuelve artista', async () => {
    await sembrar(datos, { temas: true })
    const { b } = await abrir()
    const r = await b.crear(datosNuevos('Queen', 'Otro disco'))
    expect(r.apariencia.procedencia).toBe('artista')
    expect(r.apariencia.temaNombre).toBe('Neón')
  })

  it('sin predeterminado y con 3 temas usa base aleatorio, estable tras reiniciar', async () => {
    await sembrar(datos, { temas: true })
    const catalogo: Catalogo = { ...catalogoDeSemilla(), predeterminado: null }
    await writeFile(join(biblio, 'temas.json'), JSON.stringify(catalogo))
    const { b } = await abrir()
    const r = await b.crear(datosNuevos('Sin tema'))
    expect(r.apariencia.procedencia).toBe('aleatorio')
    const disco = await leerDisco(r.id)
    expect(disco.apariencia?.base?.tipo).toBe('aleatorio')
    await flush()
    const otra = await abrir()
    expect(otra.b.obtenerResumen(r.id)?.apariencia).toEqual(r.apariencia)
  })

  it('con el catálogo vacío usa base incluido', async () => {
    await sembrar(datos, { temas: true })
    const vacio: Catalogo = {
      ...catalogoDeSemilla(),
      predeterminado: null,
      temas: [],
      asignaciones: { artistas: [], albumes: [] }
    }
    await writeFile(join(biblio, 'temas.json'), JSON.stringify(vacio))
    const { b } = await abrir()
    const r = await b.crear(datosNuevos('Sin tema'))
    expect(r.apariencia.procedencia).toBe('incluido')
    expect((await leerDisco(r.id)).apariencia?.base).toEqual({ tipo: 'incluido' })
  })

  it('editar el artista a uno con tema refresca la procedencia y la instantánea en esa escritura', async () => {
    await sembrar(datos, { temas: true })
    const { b } = await abrir()
    const id = idSemilla(33)
    expect(b.obtenerResumen(id)?.apariencia.procedencia).toBe('predeterminado')
    const r = await b.actualizar(id, { metadatos: { artista: 'Queen', album: null } })
    expect(r.apariencia).toMatchObject({ procedencia: 'artista', temaNombre: 'Neón' })
    await flush()
    const disco = await leerDisco(id)
    expect(disco.apariencia?.tema_nombre).toBe('Neón')
    expect(disco.estilo).toEqual(r.estilo)
  })
})

describe('guardarApariencia', () => {
  it('tema inexistente, heredar conservando la base, tema y propio', async () => {
    await sembrar(datos, { temas: true })
    const { b } = await abrir()
    await expect(
      b.guardarApariencia(idSemilla(33), { modo: 'tema', temaId: TEMA_INEXISTENTE })
    ).rejects.toMatchObject({ codigo: 'TEMA_NO_ENCONTRADO' })
    const r = await b.guardarApariencia(idSemilla(38), { modo: 'heredar' })
    expect(r.apariencia.procedencia).toBe('predeterminado_anterior')
    await flush()
    expect((await leerDisco(idSemilla(38))).apariencia?.base).toEqual({
      tipo: 'predeterminado_anterior',
      tema_id: TEMA_SOL
    })
    const aTema = await b.guardarApariencia(idSemilla(33), { modo: 'tema', temaId: TEMA_NEON })
    expect(aTema.apariencia).toMatchObject({ modo: 'tema', procedencia: 'cancion' })
    const propio = await b.guardarApariencia(idSemilla(33), {
      modo: 'propio',
      estilo: estiloPredeterminado()
    })
    expect(propio.apariencia.modo).toBe('propio')
  })

  it('en solo lectura solo admite propio', async () => {
    await sembrar(datos, { temas: true })
    await writeFile(join(biblio, 'temas.json'), JSON.stringify({ esquema: 99, claves: 1 }))
    const { b } = await abrir()
    await expect(
      b.guardarApariencia(idSemilla(33), { modo: 'tema', temaId: TEMA_NEON })
    ).rejects.toMatchObject({ codigo: 'TEMAS_SOLO_LECTURA' })
    await expect(b.guardarApariencia(idSemilla(33), { modo: 'heredar' })).rejects.toMatchObject({
      codigo: 'TEMAS_SOLO_LECTURA'
    })
    const r = await b.guardarApariencia(idSemilla(33), {
      modo: 'propio',
      estilo: estiloPredeterminado()
    })
    expect(r.apariencia.modo).toBe('propio')
  })
})

describe('resolución en el resumen', () => {
  it('alHeredar llega igual en resumen, resuelta y tras asignar un tema', async () => {
    await sembrar(datos, { temas: true })
    const { b, t } = await abrir()
    const id = idSemilla(38)
    const esperado = { procedencia: 'predeterminado_anterior', temaId: TEMA_SOL, temaNombre: 'Sol' }
    expect(b.obtenerResumen(id)?.apariencia).toMatchObject({
      procedencia: 'predeterminado_anterior'
    })
    expect(b.obtenerResumen(id)?.apariencia.alHeredar).toEqual(esperado)
    expect(b.resolver(b.obtener(id)!).alHeredar).toEqual(esperado)
    const r = await b.guardarApariencia(id, { modo: 'tema', temaId: TEMA_NEON })
    expect(r.apariencia.alHeredar).toEqual(esperado)
    expect(b.obtenerResumen(idSemilla(39))?.apariencia.alHeredar).toEqual(esperado)

    // Tras asignar un tema al artista, el siguiente listar() lo refleja.
    const op = {
      tipo: 'asignarGrupo',
      nivel: 'artista',
      artista: 'Artista Anterior',
      temaId: TEMA_NOCHE_NINJA
    } as const
    const imp = await t.previsualizar(op)
    await t.ejecutar(op, imp.ficha)
    const lista = b.listar()
    expect(lista.find((c) => c.id === id)?.apariencia.alHeredar.procedencia).toBe('artista')
  })

  it('neutra en YouTube con predeterminado, y no neutra tras asignar tema a su álbum', async () => {
    await sembrar(datos, { temas: true })
    const { b, t } = await abrir()
    const id = idSemilla(37)
    const antes = b.obtenerResumen(id)
    expect(antes?.apariencia).toMatchObject({ procedencia: 'predeterminado', neutra: true })
    expect(antes?.miniatura).not.toBeNull()
    const op = {
      tipo: 'asignarGrupo',
      nivel: 'album',
      artista: 'Artista Youtube',
      album: 'Álbum Youtube',
      temaId: TEMA_SOL
    } as const
    const imp = await t.previsualizar(op)
    await t.ejecutar(op, imp.ficha)
    expect(b.obtenerResumen(id)?.apariencia).toMatchObject({ procedencia: 'album', neutra: false })
  })

  it('una referencia a un tema inexistente resuelve respaldo con su instantánea y nombre', async () => {
    await sembrar(datos, { temas: true })
    const { b, t } = await abrir()
    const r = b.obtenerResumen(idSemilla(36))
    expect(r?.apariencia).toMatchObject({ procedencia: 'respaldo', temaNombre: 'Tema perdido' })
    expect(r?.estilo).toEqual((await leerDisco(idSemilla(36))).estilo)
    expect(t.catalogo().referenciasFaltantes).toBe(1)
  })
})
