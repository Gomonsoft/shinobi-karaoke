import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cancionSchema,
  estaIncompleta,
  estiloPredeterminado,
  finEfectivo,
  migrarCatalogo,
  migrarConfig,
  numerosLineasSinInicio
} from '../../shared'
import { sembrar } from './semilla'
import { ServicioBiblioteca } from './servicio'

let datos: string
const idSemilla = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`

beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-semilla-'))
})
afterEach(async () => {
  await rm(datos, { recursive: true, force: true })
})

describe('sembrar', () => {
  it('crea la variedad pedida, es idempotente y recrea con limpiar', async () => {
    const r = await sembrar(datos)
    expect(r.creadas).toHaveLength(20)
    const config = migrarConfig(JSON.parse(await readFile(join(datos, 'config.json'), 'utf8')))
    expect(config.instalacion.estado).toBe('completa')

    const lista = await new ServicioBiblioteca(datos).arrancar()
    expect(lista.filter((c) => c.estado === 'lista' && !c.incompleta && !c.danada)).toHaveLength(3)
    expect(lista.filter((c) => c.incompleta)).toHaveLength(3)
    expect(lista.filter((c) => c.motivo === 'json')).toHaveLength(1)
    expect(lista.filter((c) => c.motivo === 'pistas')).toHaveLength(1)
    const sana = lista.filter((c) => !c.danada)
    expect(sana.filter((c) => c.estado === 'borrador')).toHaveLength(12)
    expect(sana.some((c) => c.pasos?.separacion.error)).toBe(true)
    expect(sana.some((c) => c.pasos?.separacion.estado === 'interrumpido')).toBe(true)
    expect(new Set(sana.map((c) => c.estilo?.letra.fuente.familia)).size).toBeGreaterThan(1)

    const yt = sana.filter((c) => c.miniatura !== null)
    expect(yt).toHaveLength(2)
    expect(yt.map((c) => c.estilo)).toContainEqual(estiloPredeterminado())
    expect(
      yt.filter((c) => JSON.stringify(c.estilo) !== JSON.stringify(estiloPredeterminado()))
    ).toHaveLength(1)
    const jpg = await readFile(join(datos, 'biblioteca', yt[0]!.id, 'fuente', 'miniatura.jpg'))
    expect(jpg.subarray(0, 2).toString('hex')).toBe('ffd8')

    const r2 = await sembrar(datos)
    expect(r2.creadas).toHaveLength(0)
    expect(r2.existentes).toHaveLength(20)

    const r3 = await sembrar(datos, { limpiar: true })
    expect(r3.creadas).toHaveLength(20)
  })

  it('añade solo los dos casos nuevos a una semilla anterior', async () => {
    await sembrar(datos)
    const idsNuevos = [idSemilla(20), idSemilla(21)]
    for (const id of idsNuevos) await rm(join(datos, 'biblioteca', id), { recursive: true })

    const resultado = await sembrar(datos)
    expect(resultado.creadas).toEqual(idsNuevos)
    expect(resultado.existentes).toHaveLength(18)
  })
})

it('siembra los casos del editor y reproductor con FLAC de 30 s y letras válidas', async () => {
  await sembrar(datos)
  for (const [n, titulo, conPistas, total] of [
    [17, 'Editor: pista de clics', true, 12],
    [18, 'Editor: separación interrumpida', false, 6],
    [19, 'Editor: lista incompleta', true, 8],
    [20, 'Reproductor: lista', true, 6],
    [21, 'Reproductor: lista incompleta', true, 5]
  ] as const) {
    const id = idSemilla(n)
    const carpeta = join(datos, 'biblioteca', id)
    const c = cancionSchema.parse(JSON.parse(await readFile(join(carpeta, 'cancion.json'), 'utf8')))
    expect(c.metadatos).toMatchObject({ titulo, duracion_ms: 30_000 })
    expect(c.letra?.lineas.filter((l) => l.tipo === 'linea')).toHaveLength(total)
    expect(Boolean(c.pistas)).toBe(conPistas)
    if (n === 18) expect(c.pasos.separacion).toMatchObject({ estado: 'en_curso', progreso: 0.42 })
    if (n === 19) {
      expect(c.estado).toBe('lista')
      expect(c.letra?.lineas.filter((l) => l.inicio_ms === null)).toHaveLength(1)
    }
    if (n === 20) {
      expect(c.estado).toBe('lista')
      expect(estaIncompleta(c)).toBe(false)
      expect(c.estilo.fondo.tipo).toBe('degradado')
      expect(c.estilo.letra.fuente).not.toEqual(estiloPredeterminado().letra.fuente)
      expect(c.letra!.lineas.map((l) => l.inicio_ms)).toEqual([
        2000, 5000, 8000, 12000, 16000, 19000, 22000
      ])
      expect(c.letra!.lineas[1]!.palabras).toHaveLength(5)
      expect(finEfectivo(c.letra!, 'r3', 30_000)).toBe(12000)
      expect(finEfectivo(c.letra!, 'r4', 30_000)).toBe(19000)
    }
    if (n === 21) {
      expect(estaIncompleta(c)).toBe(true)
      expect(numerosLineasSinInicio(c.letra)).toEqual([3])
      expect(c.letra!.lineas.map((l) => l.inicio_ms)).toEqual([8000, 11000, null, 17000, 20000])
    }
    const archivos = ['fuente/mezcla.flac']
    if (conPistas) archivos.push('pistas/voz.flac', 'pistas/instrumental.flac')
    for (const ruta of archivos) {
      const flac = await readFile(join(carpeta, ruta))
      expect(Number(flac.readBigUInt64BE(18) & 0xfffffffffn)).toBe(30 * 44_100)
    }
  }
})

describe('sembrar con temas', () => {
  it('añade el catálogo y 12 canciones, sin tocar el conjunto base', async () => {
    const r = await sembrar(datos, { temas: true })
    expect(r.creadas).toHaveLength(32)
    const catalogo = migrarCatalogo(
      JSON.parse(await readFile(join(datos, 'biblioteca', 'temas.json'), 'utf8'))
    )
    expect(catalogo.tipo).toBe('ok')
    if (catalogo.tipo === 'ok') {
      expect(catalogo.catalogo.temas.map((t) => t.nombre)).toEqual(['Neón', 'Noche ninja', 'Sol'])
      expect(catalogo.catalogo.predeterminado).toBe(catalogo.catalogo.temas[1]?.id)
    }
    expect((await sembrar(datos, { temas: true })).creadas).toHaveLength(0)
    // Sin la opción, el conjunto sigue siendo el de siempre.
    expect((await sembrar(datos, { limpiar: true })).creadas).toHaveLength(20)
  })
})
