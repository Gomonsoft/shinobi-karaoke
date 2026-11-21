import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { estiloPredeterminado, type Catalogo } from '../../shared'
import { catalogoDePrueba, idDePrueba, temaDePrueba } from '../../shared/__fixtures__'
import { flush } from '../persistencia'
import { registroNulo, type NivelRegistro } from '../registro'
import { cargarCatalogo, rutaCatalogo } from './catalogo'

let dir: string
let ruta: string
const AHORA = '2026-11-09T12:00:00.000Z'
let contador = 0

const cargar = (estiloInicial = estiloPredeterminado(), registro = registroNulo) =>
  cargarCatalogo(ruta, {
    estiloInicial,
    registro,
    ahora: () => AHORA,
    nuevoId: () => idDePrueba(++contador)
  })

const leer = async (r = ruta): Promise<unknown> => JSON.parse(await readFile(r, 'utf8'))

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'shinobi-temas-'))
  ruta = rutaCatalogo(dir)
  contador = 0
})
afterEach(async () => {
  await flush()
  await rm(dir, { recursive: true, force: true })
})

describe('cargarCatalogo · siembra', () => {
  it('sin archivo siembra «Shinobi» predeterminado con el estilo de fábrica y lo escribe', async () => {
    const e = await cargar()
    expect(e.soloLectura).toBe(false)
    expect(e.catalogo?.temas).toHaveLength(1)
    expect(e.catalogo?.temas[0]?.nombre).toBe('Shinobi')
    expect(e.catalogo?.predeterminado).toBe(e.catalogo?.temas[0]?.id)
    expect(e.catalogo?.apartado).toBeNull()
    expect(await leer()).toEqual(e.catalogo)
  })

  it('con un estilo cambiado siembra «Mi estilo»', async () => {
    const estilo = estiloPredeterminado()
    estilo.letra.color = '#00FF00'
    const e = await cargar(estilo)
    expect(e.catalogo?.temas[0]?.nombre).toBe('Mi estilo')
    expect(e.catalogo?.temas[0]?.estilo).toEqual(estilo)
  })

  it('reiniciar no crea otro tema', async () => {
    const a = await cargar()
    const b = await cargar()
    expect(b.catalogo).toEqual(a.catalogo)
    expect(b.catalogo?.temas).toHaveLength(1)
  })
})

describe('cargarCatalogo · recuperación', () => {
  const valido = (): Catalogo =>
    catalogoDePrueba({
      temas: [temaDePrueba({ nombre: 'Del bak' })],
      predeterminado: idDePrueba(1)
    })

  it('con basura en el principal usa el .bak válido y repone el principal', async () => {
    await writeFile(ruta, '{ basura', 'utf8')
    await writeFile(`${ruta}.bak`, JSON.stringify(valido()), 'utf8')
    const e = await cargar()
    expect(e.soloLectura).toBe(false)
    expect(e.catalogo?.temas[0]?.nombre).toBe('Del bak')
    expect((await leer()) as Catalogo).toMatchObject({ temas: [{ nombre: 'Del bak' }] })
  })

  it('si principal y .bak son ilegibles aparta el principal como .danado y siembra con `apartado`', async () => {
    await writeFile(ruta, '{ basura', 'utf8')
    await writeFile(`${ruta}.bak`, 'tampoco', 'utf8')
    const niveles: NivelRegistro[] = []
    const e = await cargar(undefined, { escribir: (n) => void niveles.push(n) })
    expect(await readFile(`${ruta}.danado`, 'utf8')).toBe('{ basura')
    expect(e.catalogo?.apartado).toBe(AHORA)
    expect(e.catalogo?.temas[0]?.nombre).toBe('Shinobi')
    expect(((await leer()) as Catalogo).apartado).toBe(AHORA)
    expect(niveles).toContain('error')
  })

  it('un .danado anterior se sustituye', async () => {
    await writeFile(`${ruta}.danado`, 'viejo', 'utf8')
    await writeFile(ruta, 'nuevo roto', 'utf8')
    await cargar()
    expect(await readFile(`${ruta}.danado`, 'utf8')).toBe('nuevo roto')
  })

  it('un catálogo con referencias colgantes es ilegible', async () => {
    await writeFile(
      ruta,
      JSON.stringify(catalogoDePrueba({ predeterminado: idDePrueba(9) })),
      'utf8'
    )
    const e = await cargar()
    expect(await readdir(dir)).toContain('temas.json.danado')
    expect(e.catalogo?.apartado).toBe(AHORA)
  })
})

describe('cargarCatalogo · solo lectura', () => {
  it('un esquema más nuevo queda en solo lectura y el archivo no cambia (aunque haya .bak antiguo)', async () => {
    const nuevo = `${JSON.stringify({ esquema: 2, cosas: ['futuro'] })}\n`
    await writeFile(ruta, nuevo, 'utf8')
    const antiguo = JSON.stringify(catalogoDePrueba())
    await writeFile(`${ruta}.bak`, antiguo, 'utf8')
    const e = await cargar()
    expect(e).toEqual({ catalogo: null, soloLectura: true })
    expect(await readFile(ruta, 'utf8')).toBe(nuevo)
    expect(await readFile(`${ruta}.bak`, 'utf8')).toBe(antiguo)
    expect(await readdir(dir)).not.toContain('temas.json.danado')
  })

  it('principal ilegible con .bak de esquema más nuevo: solo lectura, nada se aparta', async () => {
    await writeFile(ruta, 'roto', 'utf8')
    await writeFile(`${ruta}.bak`, JSON.stringify({ esquema: 3 }), 'utf8')
    const e = await cargar()
    expect(e.soloLectura).toBe(true)
    expect(await readFile(ruta, 'utf8')).toBe('roto')
    expect(await readdir(dir)).not.toContain('temas.json.danado')
  })
})
