import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrarConfig } from '../../shared'
import { silencioFlac } from './flac'
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
    expect(r.creadas).toHaveLength(10)
    const config = migrarConfig(JSON.parse(await readFile(join(datos, 'config.json'), 'utf8')))
    expect(config.instalacion.estado).toBe('completa')

    const lista = await new ServicioBiblioteca(datos).arrancar()
    expect(lista.filter((c) => c.estado === 'lista' && !c.incompleta && !c.danada)).toHaveLength(2)
    expect(lista.filter((c) => c.incompleta)).toHaveLength(1)
    expect(lista.filter((c) => c.motivo === 'json')).toHaveLength(1)
    expect(lista.filter((c) => c.motivo === 'pistas')).toHaveLength(1)
    const sana = lista.filter((c) => !c.danada)
    expect(sana.filter((c) => c.estado === 'borrador')).toHaveLength(5)
    expect(sana.some((c) => c.pasos?.separacion.error)).toBe(true)
    expect(sana.some((c) => c.pasos?.separacion.estado === 'interrumpido')).toBe(true)
    expect(new Set(sana.map((c) => c.estilo?.letra.fuente.familia)).size).toBeGreaterThan(1)

    const r2 = await sembrar(datos)
    expect(r2.creadas).toHaveLength(0)
    expect(r2.existentes).toHaveLength(10)

    const r3 = await sembrar(datos, { limpiar: true })
    expect(r3.creadas).toHaveLength(10)
  })
})

describe('silencioFlac', () => {
  it('tiene marca fLaC, STREAMINFO y las muestras declaradas', () => {
    const b = silencioFlac(3)
    expect(b.subarray(0, 4).toString()).toBe('fLaC')
    expect(b[4]).toBe(0x80)
    expect(b.readUInt16BE(8)).toBe(4096)
    expect(Number(b.readBigUInt64BE(18) & 0xfffffffffn)).toBe(3 * 4096)
  })
})
