import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cancionSchema, estiloPredeterminado, migrarConfig } from '../../shared'
import { sembrar } from './semilla'
import { ServicioBiblioteca } from './servicio'

let datos: string
beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-semilla-'))
})
afterEach(async () => {
  await rm(datos, { recursive: true, force: true })
})

describe('sembrar', () => {
  it('crea la variedad pedida, es idempotente y recrea con limpiar', async () => {
    const r = await sembrar(datos)
    expect(r.creadas).toHaveLength(18)
    const config = migrarConfig(JSON.parse(await readFile(join(datos, 'config.json'), 'utf8')))
    expect(config.instalacion.estado).toBe('completa')

    const lista = await new ServicioBiblioteca(datos).arrancar()
    expect(lista.filter((c) => c.estado === 'lista' && !c.incompleta && !c.danada)).toHaveLength(2)
    expect(lista.filter((c) => c.incompleta)).toHaveLength(2)
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
    expect(r2.existentes).toHaveLength(18)

    const r3 = await sembrar(datos, { limpiar: true })
    expect(r3.creadas).toHaveLength(18)
  })
})

it('siembra los tres casos del editor con FLAC de 30 s y letras válidas', async () => {
  await sembrar(datos)
  for (const [n, titulo, conPistas, total] of [
    [17, 'Editor: pista de clics', true, 12],
    [18, 'Editor: separando', false, 6],
    [19, 'Editor: lista incompleta', true, 8]
  ] as const) {
    const id = `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`
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
    const archivos = ['fuente/mezcla.flac']
    if (conPistas) archivos.push('pistas/voz.flac', 'pistas/instrumental.flac')
    for (const ruta of archivos) {
      const flac = await readFile(join(carpeta, ruta))
      expect(Number(flac.readBigUInt64BE(18) & 0xfffffffffn)).toBe(30 * 44_100)
    }
  }
})
