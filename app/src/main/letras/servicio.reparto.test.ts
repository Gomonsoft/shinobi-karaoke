import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { aPeticionTiempos, cancionSchema, type ElementoLetra } from '../../shared'
import { pausa } from '../../shared/__fixtures__'
import { ServicioBiblioteca } from '../biblioteca'
import { cancionConFuente, nuevoDirDatos } from '../separacion/servicio.testutil'
import { ServicioLetras } from './servicio'

/** Reparto de la letra en main (0.2.3, tarea 0341). Letras inventadas. */

let datos: string
let biblioteca: ServicioBiblioteca
let servicio: ServicioLetras

const el = (id: string, texto: string, inicio: number | null = null): ElementoLetra => ({
  id,
  tipo: 'linea',
  texto,
  inicio_ms: inicio,
  fin_ms: null,
  palabras: null
})

beforeEach(async () => {
  datos = await nuevoDirDatos()
  biblioteca = new ServicioBiblioteca(datos)
  servicio = new ServicioLetras({
    biblioteca,
    dialogo: { showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }) },
    debounceEdicionMs: 5
  })
})
afterEach(async () => {
  await biblioteca.flushTodo()
  await rm(datos, { recursive: true, force: true })
})

const ruta = (id: string) => join(datos, 'biblioteca', id, 'cancion.json')
const textoEnDisco = async (id: string) => {
  await biblioteca.flushTodo()
  return readFile(ruta(id), 'utf8')
}
const enDisco = async (id: string) => cancionSchema.parse(JSON.parse(await textoEnDisco(id)))

const DUO = {
  cantantes: [
    { id: 'c1' as const, nombre: 'Ana' },
    { id: 'c2' as const, nombre: null }
  ]
}

async function abrir() {
  const id = await cancionConFuente(biblioteca, datos)
  const a = el('a', 'Cruza el faro la gaviota', 1000)
  a.fin_ms = 2500
  await servicio.guardar({
    cancionId: id,
    origen: 'lrclib',
    lrclib_id: 5,
    lineas: [a, pausa('p', 3000), el('b', 'Responde el viento', 5000), el('c', 'Ya duerme', 8000)]
  })
  const { cancion, sesionId } = servicio.abrirEdicion(id)!
  return { id, sesionId, peticion: aPeticionTiempos(id, cancion.letra!) }
}

describe('guardarTiempos con reparto', () => {
  it('guarda parte y partes sin retirar intacta ni origen_fin', async () => {
    const { id, sesionId, peticion } = await abrir()
    const tiempos = peticion.tiempos.map((t, i) =>
      i === 2 ? { ...t, parte: 'c2' as const } : i === 3 ? { ...t, parte: 'coro' as const } : t
    )
    await servicio.guardarTiempos({ ...peticion, partes: DUO, tiempos }, sesionId)
    const { letra } = await enDisco(id)
    expect(letra?.partes).toEqual(DUO)
    expect(letra?.lineas.map((l) => l.parte)).toEqual([undefined, undefined, 'c2', 'coro'])
    expect(letra?.intacta).toBe(true)
    expect(letra?.lineas[0]).toMatchObject({ origen_fin: 'letra' })
    // `partes` ausente conserva las que hay; `null` las quita (y deja los coros sin cantantes).
    await servicio.guardarTiempos({ ...peticion, tiempos }, sesionId)
    expect((await enDisco(id)).letra?.partes).toEqual(DUO)
    await servicio.guardarTiempos(
      { ...peticion, partes: null, tiempos: peticion.tiempos },
      sesionId
    )
    const sin = (await enDisco(id)).letra!
    expect(sin).not.toHaveProperty('partes')
    expect(sin.lineas.some((l) => 'parte' in l)).toBe(false)
  })

  it('aPeticionTiempos envía parte y partes y un viaje de ida y vuelta no cambia el archivo', async () => {
    const { id, sesionId, peticion } = await abrir()
    const tiempos = peticion.tiempos.map((t, i) => (i === 2 ? { ...t, parte: 'c2' as const } : t))
    await servicio.guardarTiempos({ ...peticion, partes: DUO, tiempos }, sesionId)
    const antes = await textoEnDisco(id)
    const { cancion } = servicio.abrirEdicion(id)!
    const otra = aPeticionTiempos(id, cancion.letra!)
    expect(otra.partes).toEqual(DUO)
    expect(otra.tiempos.map((t) => t.parte)).toEqual([undefined, undefined, 'c2', undefined])
    await servicio.guardarTiempos(otra, servicio.abrirEdicion(id)!.sesionId)
    expect(await textoEnDisco(id)).toBe(antes)
  })

  it.each([
    ['un cantante que no existe', { partes: DUO, parte: 'c3' as const }],
    [
      '«todos» con un solo cantante',
      { partes: { cantantes: [{ id: 'c1' as const, nombre: null }] }, parte: 'todos' as const }
    ],
    [
      'una ranura repetida',
      { partes: { cantantes: [DUO.cantantes[0]!, DUO.cantantes[0]!] }, parte: 'coro' as const }
    ],
    ['un nivel fuera de paso', { partes: { ...DUO, voz_en_coros: 0.33 }, parte: 'coro' as const }]
  ])('rechaza %s con ARGUMENTOS_NO_VALIDOS', async (_n, { partes, parte }) => {
    const { id, sesionId, peticion } = await abrir()
    const antes = await textoEnDisco(id)
    const tiempos = peticion.tiempos.map((t, i) => (i === 2 ? { ...t, parte } : t))
    await expect(
      servicio.guardarTiempos({ ...peticion, partes, tiempos }, sesionId)
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    expect(await textoEnDisco(id)).toBe(antes)
  })

  it('descarta la parte que llega en una pausa', async () => {
    const { id, sesionId, peticion } = await abrir()
    const tiempos = peticion.tiempos.map((t, i) => (i === 1 ? { ...t, parte: 'coro' as const } : t))
    await servicio.guardarTiempos({ ...peticion, tiempos }, sesionId)
    expect((await enDisco(id)).letra?.lineas[1]).not.toHaveProperty('parte')
  })

  it('regresión 0.2.2: `partes: null` en una canción sin reparto no cambia el archivo', async () => {
    const { id, sesionId, peticion } = await abrir()
    const antes = await textoEnDisco(id)
    await servicio.guardarTiempos({ ...peticion, partes: null }, sesionId)
    expect(await textoEnDisco(id)).toBe(antes)
  })

  it('C1S-E4: acepta el fin fijado que pasa de otra parte y rechaza el que pasa de la suya', async () => {
    const { id, sesionId, peticion } = await abrir()
    const conFin = (parte: 'c2' | undefined) =>
      peticion.tiempos.map((t, i) =>
        i === 2 ? { ...t, fin_ms: 9000, ...(parte ? { parte } : {}) } : t
      )
    // «b» es de Luis y acaba a los 9 s, después del inicio de «c» (8 s) que es de Ana: voces a la vez.
    await servicio.guardarTiempos({ ...peticion, partes: DUO, tiempos: conFin('c2') }, sesionId)
    const { letra } = await enDisco(id)
    expect(letra?.lineas[2]).toMatchObject({ fin_ms: 9000, parte: 'c2' })
    // Si «b» fuera de Ana, el mismo fin pasaría del inicio de la siguiente de su parte.
    const antes = await textoEnDisco(id)
    await expect(
      servicio.guardarTiempos({ ...peticion, partes: DUO, tiempos: conFin(undefined) }, sesionId)
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    expect(await textoEnDisco(id)).toBe(antes)
  })

  it('normaliza: un reparto que no aporta nada no deja `partes`', async () => {
    const { id, sesionId, peticion } = await abrir()
    await servicio.guardarTiempos(
      { ...peticion, partes: { cantantes: [{ id: 'c1', nombre: null }], voz_en_coros: 0.5 } },
      sesionId
    )
    expect(await enDisco(id).then((c) => c.letra)).not.toHaveProperty('partes')
  })

  it('regresión 0.2.2: sin reparto el archivo es el mismo y un cambio de tiempos no añade campos', async () => {
    const { id, sesionId, peticion } = await abrir()
    const antes = await textoEnDisco(id)
    await servicio.guardarTiempos(peticion, sesionId)
    expect(await textoEnDisco(id)).toBe(antes)
    const tiempos = peticion.tiempos.map((t, i) => (i === 2 ? { ...t, inicio_ms: 5200 } : t))
    await servicio.guardarTiempos({ ...peticion, tiempos }, sesionId)
    const despues = await textoEnDisco(id)
    expect(despues).not.toMatch(/"parte/)
    const antesLetra = JSON.parse(antes).letra
    const despuesLetra = JSON.parse(despues).letra
    delete antesLetra.intacta
    antesLetra.lineas[2].inicio_ms = 5200
    expect(despuesLetra).toEqual(antesLetra)
    expect(JSON.parse(despues).letra).not.toHaveProperty('partes')
  })
})

describe('corregir y sustituir la letra con reparto', () => {
  async function conReparto() {
    const { id, sesionId, peticion } = await abrir()
    const tiempos = peticion.tiempos.map((t, i) =>
      i === 2 ? { ...t, parte: 'c2' as const } : i === 3 ? { ...t, parte: 'coro' as const } : t
    )
    await servicio.guardarTiempos(
      { ...peticion, partes: { ...DUO, voz_en_coros: 0.8 }, tiempos },
      sesionId
    )
    servicio.liberarEdicion()
    return id
  }

  it('editarTexto: las emparejadas conservan la parte y la nueva hereda la de la anterior', async () => {
    const id = await conReparto()
    await servicio.editarTexto({
      cancionId: id,
      texto: 'Cruza el faro la gaviota\n\nResponde el viento\nUna nueva\nYa duerme'
    })
    const { letra } = await enDisco(id)
    expect(letra?.lineas.filter((l) => l.tipo === 'linea').map((l) => [l.texto, l.parte])).toEqual([
      ['Cruza el faro la gaviota', undefined],
      ['Responde el viento', 'c2'],
      ['Una nueva', 'c2'],
      ['Ya duerme', 'coro']
    ])
    expect(letra?.partes).toMatchObject({ voz_en_coros: 0.8 })
  })

  it('sustituir la letra conserva partes y deja todas las líneas en c1', async () => {
    const id = await conReparto()
    await servicio.guardar({
      cancionId: id,
      origen: 'manual',
      lrclib_id: null,
      lineas: [el('x', 'Otra letra', 100), el('y', 'Y otra más', 200)]
    })
    const { letra } = await enDisco(id)
    expect(letra?.partes).toEqual({ ...DUO, voz_en_coros: 0.8 })
    expect(letra?.lineas.some((l) => 'parte' in l)).toBe(false)
  })

  it('sin reparto previo, sustituir no crea `partes`', async () => {
    const { id } = await abrir()
    await servicio.guardar({
      cancionId: id,
      origen: 'manual',
      lrclib_id: null,
      lineas: [el('x', 'Otra letra', 100)]
    })
    expect((await enDisco(id)).letra).not.toHaveProperty('partes')
  })
})
