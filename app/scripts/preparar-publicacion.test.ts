import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  INSTALADORES,
  componerNotas,
  generarSumas,
  prepararPublicacion,
  verificarInstaladores
} from './preparar-publicacion.mjs'

const temporales: string[] = []
const sha = (texto: string): string => createHash('sha256').update(texto).digest('hex')

function carpetaConInstaladores(): string {
  const dir = mkdtempSync(join(tmpdir(), 'publicacion-'))
  temporales.push(dir)
  const por = {
    windows: [INSTALADORES[2]!],
    macos: [INSTALADORES[1]!],
    linux: [INSTALADORES[0]!, INSTALADORES[3]!]
  }
  for (const [so, nombres] of Object.entries(por)) {
    const sumas = nombres.map((n) => {
      writeFileSync(join(dir, n), `contenido de ${n}`)
      return `${sha(`contenido de ${n}`)}  ${n}\n`
    })
    writeFileSync(join(dir, `SHA256SUMS-${so}.txt`), sumas.join(''))
  }
  return dir
}

afterEach(() => {
  for (const d of temporales.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('instaladores y sumas', () => {
  it('genera SHA256SUMS.txt ordenado por nombre', () => {
    const dir = carpetaConInstaladores()
    verificarInstaladores(dir)
    const nombres = [...INSTALADORES].sort()
    expect(generarSumas(dir)).toBe(
      nombres.map((n) => `${sha(`contenido de ${n}`)}  ${n}`).join('\n') + '\n'
    )
  })

  it('falla con un instalador de más, de menos o una suma alterada', () => {
    let dir = carpetaConInstaladores()
    writeFileSync(join(dir, 'Otro.exe'), 'x')
    expect(() => verificarInstaladores(dir)).toThrow(/Sobran: Otro\.exe/)
    dir = carpetaConInstaladores()
    rmSync(join(dir, INSTALADORES[3]!))
    expect(() => verificarInstaladores(dir)).toThrow(/Faltan: shinobi-karaoke-linux-x64\.deb/)
    dir = carpetaConInstaladores()
    writeFileSync(join(dir, INSTALADORES[2]!), 'alterado')
    expect(() => verificarInstaladores(dir)).toThrow(/no coincide/)
  })
})

describe('notas', () => {
  const base = { aviso: '> aviso\n', cabecera: 'cabecera\n', notas: 'novedades\n' }

  it('pone aviso, cabecera y notas, y omite el aviso en una estable', () => {
    expect(componerNotas({ ...base, previa: true })).toBe('> aviso\n\ncabecera\n\nnovedades\n')
    expect(componerNotas({ ...base, previa: false })).toBe('cabecera\n\nnovedades\n')
    expect(componerNotas({ ...base, notas: '', previa: true })).toBe('> aviso\n\ncabecera\n')
  })

  it('falla con marcadores sin resolver', () => {
    expect(() => componerNotas({ ...base, notas: '⟦P1⟧', previa: false })).toThrow(/marcador/)
    expect(() => componerNotas({ ...base, notas: '{ENLACE_MAC}', previa: false })).toThrow()
  })
})

describe('prepararPublicacion con las plantillas reales', () => {
  it('compone notas.md sin marcadores, datos.json y resumen', () => {
    const entrada = carpetaConInstaladores()
    const salida = join(entrada, 'salida')
    const raiz = join(import.meta.dirname, '..', '..')
    const { datos, resumen } = prepararPublicacion({
      entrada,
      salida,
      raiz,
      version: '9.9.9-alpha.1',
      etiqueta: 'v9.9.9-alpha.1',
      previa: true,
      ensayo: true
    })
    expect(datos.generar_notas).toBe(true)
    const notas = readFileSync(join(salida, 'notas.md'), 'utf8')
    expect(notas.startsWith('> **Versión preliminar.**')).toBe(true)
    expect(notas).toContain('**¿Qué archivo descargo?**')
    expect(resumen).toContain('Ensayo: no se ha publicado nada.')
    expect(resumen).toContain('generadas por GitHub')
  })
})
