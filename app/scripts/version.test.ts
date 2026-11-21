import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  aPep440,
  analizarEtiqueta,
  comparar,
  comprobarVersiones,
  raizDelRepositorio,
  subirVersion,
  validar
} from './version.mjs'

const ARCHIVOS = [
  'app/package.json',
  'app/package-lock.json',
  'worker/pyproject.toml',
  'worker/shinobi_worker/__init__.py',
  'worker/uv.lock'
]

const temporales: string[] = []

function copiaDelRepositorio(): string {
  const raiz = mkdtempSync(join(tmpdir(), 'version-'))
  temporales.push(raiz)
  for (const ruta of ARCHIVOS) {
    mkdirSync(dirname(join(raiz, ruta)), { recursive: true })
    copyFileSync(join(raizDelRepositorio(), ruta), join(raiz, ruta))
  }
  return raiz
}

const leer = (raiz: string, ruta: string): string => readFileSync(join(raiz, ruta), 'utf8')

afterEach(() => {
  for (const carpeta of temporales.splice(0)) rmSync(carpeta, { recursive: true, force: true })
})

describe('formato, orden y PEP 440', () => {
  it('acepta solo X.Y.Z y X.Y.Z-(alpha|beta|rc).N con N ≥ 1', () => {
    for (const v of ['0.2.0', '0.2.0-alpha.1', '1.0.0-rc.12']) expect(validar(v)).toBe(true)
    for (const v of ['0.2.0-alpha', '0.2.0-alpha.0', 'v0.2.0', '0.2', '01.2.0', '0.2.0-dev.1']) {
      expect(validar(v)).toBe(false)
    }
  })

  it('ordena las previas antes de la estable', () => {
    const orden = ['0.2.0-alpha.1', '0.2.0-alpha.2', '0.2.0-beta.1', '0.2.0-rc.1', '0.2.0', '0.2.1']
    for (let i = 1; i < orden.length; i++) {
      expect(comparar(orden[i - 1]!, orden[i]!)).toBeLessThan(0)
      expect(comparar(orden[i]!, orden[i - 1]!)).toBeGreaterThan(0)
    }
    expect(comparar('0.2.0', '0.2.0')).toBe(0)
  })

  it('traduce a PEP 440 normalizada', () => {
    expect(aPep440('0.2.0-alpha.1')).toBe('0.2.0a1')
    expect(aPep440('0.2.0-beta.3')).toBe('0.2.0b3')
    expect(aPep440('0.2.0-rc.2')).toBe('0.2.0rc2')
    expect(aPep440('0.2.0')).toBe('0.2.0')
  })

  it('analiza la etiqueta', () => {
    expect(analizarEtiqueta('v0.2.0-alpha.1')).toBe('0.2.0-alpha.1')
    expect(() => analizarEtiqueta('0.2.0')).toThrow()
    expect(() => analizarEtiqueta('v0.2.0-alpha')).toThrow()
  })
})

describe('subir y comprobar sobre copias de los archivos reales', () => {
  it('los archivos actuales están alineados', () => {
    expect(() => comprobarVersiones(raizDelRepositorio())).not.toThrow()
  })

  it('subir cambia solo la línea de versión de los 5 archivos', () => {
    const raiz = copiaDelRepositorio()
    const antes = ARCHIVOS.map((ruta) => leer(raiz, ruta))
    const actual = comprobarVersiones(raiz)
    subirVersion(raiz, '99.0.0-alpha.1')
    expect(comprobarVersiones(raiz, { etiqueta: 'v99.0.0-alpha.1' })).toBe('99.0.0-alpha.1')
    ARCHIVOS.forEach((ruta, i) => {
      const despues = leer(raiz, ruta)
      const pep = ruta.startsWith('worker/')
      const nueva = pep ? '99.0.0a1' : '99.0.0-alpha.1'
      const anterior = pep ? aPep440(actual) : actual
      const cambios = ruta === 'app/package-lock.json' ? 2 : 1
      const lineasA = antes[i]!.split('\n')
      const lineasD = despues.split('\n')
      expect(lineasD.length).toBe(lineasA.length)
      const distintas = lineasA.filter((linea, k) => linea !== lineasD[k])
      expect(distintas).toHaveLength(cambios)
      expect(despues.replaceAll(nueva, anterior).replaceAll('99.0.0a1', anterior)).toBe(antes[i])
    })
  })

  it('rechaza una versión menor o igual y un formato inválido', () => {
    const raiz = copiaDelRepositorio()
    const actual = comprobarVersiones(raiz)
    expect(() => subirVersion(raiz, actual)).toThrow(/no es mayor/)
    expect(() => subirVersion(raiz, '0.0.1')).toThrow(/no es mayor/)
    expect(() => subirVersion(raiz, '0.2.0-alpha')).toThrow(/no válida/)
  })

  it.each(ARCHIVOS)('comprobar detecta %s desalineado', (ruta) => {
    const raiz = copiaDelRepositorio()
    const version = comprobarVersiones(raiz)
    const texto = leer(raiz, ruta)
    if (ruta === 'app/package.json') {
      // El de app es la referencia: se desalinean los demás subiendo solo este.
      writeFileSync(join(raiz, ruta), texto.replace(`"${version}"`, '"9.9.9"'))
      expect(() => comprobarVersiones(raiz)).toThrow(/app\/package-lock\.json/)
    } else {
      const propio = ruta === 'worker/uv.lock' ? 'name = "shinobi-worker"\nversion = "' : ''
      writeFileSync(join(raiz, ruta), texto.replace(propio + version, propio + '9.9.9'))
      expect(() => comprobarVersiones(raiz)).toThrow(ruta.split(' ')[0]!)
    }
  })

  it('comprobar detecta una etiqueta distinta', () => {
    const raiz = copiaDelRepositorio()
    expect(() => comprobarVersiones(raiz, { etiqueta: 'v9.9.9' })).toThrow(/no coincide/)
  })
})
