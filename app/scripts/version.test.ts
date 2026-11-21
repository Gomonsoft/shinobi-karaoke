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
      const valor = ruta.startsWith('worker/') ? aPep440(version) : version
      writeFileSync(join(raiz, ruta), texto.replace(propio + valor, propio + '9.9.9'))
      expect(() => comprobarVersiones(raiz)).toThrow(ruta.split(' ')[0]!)
    }
  })

  it('comprobar detecta una etiqueta distinta', () => {
    const raiz = copiaDelRepositorio()
    expect(() => comprobarVersiones(raiz, { etiqueta: 'v9.9.9' })).toThrow(/no coincide/)
  })
})

describe('sexto sitio: enlaces del README e INSTALAR.md', () => {
  const BASE = 'https://github.com/Gomonsoft/shinobi-karaoke/releases'
  const readmeEjemplo = (v: string): string =>
    [
      '# Ejemplo',
      '',
      `**Última versión: ${v}, versión preliminar.** Prueba. [Novedades de ${v}](${BASE}/tag/v${v})`,
      `[![A](x.svg)](${BASE}/download/v${v}/Shinobi-Karaoke-Windows-x64.exe)`,
      `[![B](x.svg)](${BASE}/download/v${v}/Shinobi-Karaoke-Mac-chip-Apple.dmg)`,
      `[![C](x.svg)](${BASE}/download/v${v}/shinobi-karaoke-linux-x64.deb)`,
      `[![D](x.svg)](${BASE}/download/v${v}/Shinobi-Karaoke-Linux-x64.AppImage)`,
      `Solo desde su [página de versiones](${BASE}). Otra versión citada: 0.1.0 y v0.1.0.`
    ].join('\n')

  it('subir cambia los 5 enlaces y la línea de versión sin tocar nada más', () => {
    const raiz = copiaDelRepositorio()
    const actual = comprobarVersiones(raiz)
    writeFileSync(join(raiz, 'README.md'), readmeEjemplo(actual))
    writeFileSync(join(raiz, 'INSTALAR.md'), `Aviso [versiones](${BASE}/tag/v${actual}) fin`)
    subirVersion(raiz, '99.0.0-alpha.2')
    expect(leer(raiz, 'README.md')).toBe(readmeEjemplo('99.0.0-alpha.2'))
    expect(leer(raiz, 'INSTALAR.md')).toBe(`Aviso [versiones](${BASE}/tag/v99.0.0-alpha.2) fin`)
    expect(comprobarVersiones(raiz)).toBe('99.0.0-alpha.2')
  })

  it('comprobar falla nombrando el archivo con un enlace desfasado', () => {
    const raiz = copiaDelRepositorio()
    const actual = comprobarVersiones(raiz)
    expect(() => comprobarVersiones(raiz)).not.toThrow()
    writeFileSync(join(raiz, 'README.md'), readmeEjemplo(actual))
    expect(() => comprobarVersiones(raiz)).not.toThrow()
    writeFileSync(
      join(raiz, 'README.md'),
      readmeEjemplo(actual).replace(`download/v${actual}/shinobi`, 'download/v0.0.9/shinobi')
    )
    expect(() => comprobarVersiones(raiz)).toThrow(/README\.md.*0\.0\.9/)
    writeFileSync(join(raiz, 'README.md'), readmeEjemplo(actual))
    writeFileSync(join(raiz, 'INSTALAR.md'), `[Novedades de 0.0.9](${BASE}/tag/v${actual})`)
    expect(() => comprobarVersiones(raiz)).toThrow(/INSTALAR\.md/)
  })

  it('sin ningún enlace (estado E0) no comprueba ni cambia nada', () => {
    const raiz = copiaDelRepositorio()
    const e0 = `Todavía no hay versión. Ver ${BASE} y 0.0.1.`
    writeFileSync(join(raiz, 'README.md'), e0)
    expect(() => comprobarVersiones(raiz)).not.toThrow()
    subirVersion(raiz, '99.0.0-alpha.1')
    expect(leer(raiz, 'README.md')).toBe(e0)
  })
})
