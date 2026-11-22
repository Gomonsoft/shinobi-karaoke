import { createHash } from 'node:crypto'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  INSTALADORES,
  componerNotas,
  fechaLarga,
  generarSumas,
  nombreDesarrollo,
  prepararDesarrollo,
  prepararPublicacion,
  tamanoMB,
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

const SHA = '9e07c55' + 'a'.repeat(33)
const ANTERIOR = '1234567' + 'b'.repeat(33)
const EJECUCION = 'https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/42'
const raizReal = join(import.meta.dirname, '..', '..')

/** Raíz falsa con las plantillas reales y, opcionalmente, notas a mano de la versión. */
function raizConNotas(version: string, notas?: string): string {
  const raiz = mkdtempSync(join(tmpdir(), 'raiz-'))
  temporales.push(raiz)
  mkdirSync(join(raiz, '.github'), { recursive: true })
  cpSync(join(raizReal, '.github', 'publicacion'), join(raiz, '.github', 'publicacion'), {
    recursive: true
  })
  if (notas !== undefined) {
    const carpeta = join(raiz, 'lanzamientos', 'notas', version.replace(/-.*$/, ''))
    mkdirSync(carpeta, { recursive: true })
    writeFileSync(join(carpeta, `${version}.md`), notas)
  }
  return raiz
}

describe('prepararPublicacion (canal de versiones)', () => {
  const version = '9.9.9-alpha.1'
  const base = {
    version,
    etiqueta: 'v9.9.9-alpha.1',
    previa: true,
    compilacion: '9.9.9-alpha.1-1234',
    sha: SHA,
    ejecucion: EJECUCION
  }

  it('escribe notas.md, pie.md con los valores, que-cambio.json y datos.json sin generar_notas', () => {
    const entrada = carpetaConInstaladores()
    const salida = join(entrada, 'salida')
    const raiz = raizConNotas(version, '## Novedades\n\n- Algo.\n')
    const { datos, resumen } = prepararPublicacion({ entrada, salida, raiz, ...base })
    expect(datos).toEqual({ version, etiqueta: 'v9.9.9-alpha.1', previa: true })
    const notas = readFileSync(join(salida, 'notas.md'), 'utf8')
    expect(notas.startsWith('> **Versión preliminar.**')).toBe(true)
    expect(notas).toContain('tu navegador y tu sistema pueden avisarte')
    expect(notas).toContain('## Novedades')
    expect(readFileSync(join(salida, 'pie.md'), 'utf8')).toBe(
      '**Compilación:** `9.9.9-alpha.1-1234`, del commit ' +
        `[\`9e07c55\`](https://github.com/Gomonsoft/shinobi-karaoke/commit/${SHA}). ` +
        `Los instaladores se construyeron y se probaron en [esta ejecución de «Empaquetado y publicación»](${EJECUCION}).\n`
    )
    expect(readdirSync(salida)).toContain('que-cambio.json')
    expect(resumen).toContain('### Compilación (pie.md)')
    expect(resumen).toContain('«Qué cambió» se genera al publicar.')
    expect(resumen).not.toContain('**Aviso:**')
  })

  it('con etiqueta falla sin notas a mano o con una línea «> Borrador»', () => {
    const entrada = carpetaConInstaladores()
    const salida = join(entrada, 'salida')
    expect(() =>
      prepararPublicacion({ entrada, salida, raiz: raizConNotas(version), ...base })
    ).toThrow(/No existen las notas/)
    const conBorrador = raizConNotas(version, '> Borrador: revisar\n\n## Novedades\n')
    expect(() => prepararPublicacion({ entrada, salida, raiz: conBorrador, ...base })).toThrow(
      /> Borrador/
    )
  })

  it('en el ensayo solo lo avisa en el resumen', () => {
    const entrada = carpetaConInstaladores()
    const salida = join(entrada, 'salida')
    const ensayo = { entrada, salida, ensayo: true, ...base }
    const sin = prepararPublicacion({ ...ensayo, raiz: raizConNotas(version) })
    expect(sin.resumen).toContain('**Aviso:** No existen las notas')
    expect(sin.resumen).toContain('Ensayo: no se ha publicado nada.')
    const borrador = prepararPublicacion({
      ...ensayo,
      raiz: raizConNotas(version, '> Borrador: x\n')
    })
    expect(borrador.resumen).toContain('«> Borrador»')
  })

  it('falla con un marcador sin resolver y con datos de compilación incompletos', () => {
    const entrada = carpetaConInstaladores()
    const salida = join(entrada, 'salida')
    const raiz = raizConNotas(version, 'Texto con {PENDIENTE}\n')
    expect(() => prepararPublicacion({ entrada, salida, raiz, ...base })).toThrow(/marcador/)
    const ok = raizConNotas(version, 'Texto\n')
    expect(() =>
      prepararPublicacion({ entrada, salida, raiz: ok, ...base, ejecucion: undefined })
    ).toThrow(/se dan juntos/)
  })

  it('sin --compilacion sigue valiendo la llamada de siempre (sin pie.md)', () => {
    const entrada = carpetaConInstaladores()
    const salida = join(entrada, 'salida')
    const raiz = raizConNotas(version, 'Texto\n')
    prepararPublicacion({ entrada, salida, raiz, version, etiqueta: base.etiqueta, previa: true })
    expect(readdirSync(salida)).not.toContain('pie.md')
  })
})

describe('canal de desarrollo', () => {
  const version = '9.9.9-alpha.3'
  const compilacion = `${version}-1260`
  const fecha = new Date('2026-11-22T23:59:59Z')

  it('renombra los cuatro instaladores (función pura)', () => {
    expect(INSTALADORES.map((n) => nombreDesarrollo(n, compilacion)).sort()).toEqual([
      `Shinobi-Karaoke-desarrollo-${compilacion}-Linux-x64.AppImage`,
      `Shinobi-Karaoke-desarrollo-${compilacion}-Mac-chip-Apple.dmg`,
      `Shinobi-Karaoke-desarrollo-${compilacion}-Windows-x64.exe`,
      `shinobi-karaoke-desarrollo-${compilacion}-linux-x64.deb`
    ])
    expect(() => nombreDesarrollo('Otro.exe', compilacion)).toThrow(/desconocido/)
  })

  it('da la fecha larga en UTC y los tamaños en MB decimales con coma', () => {
    expect(fechaLarga(fecha)).toBe('22 de noviembre de 2026')
    expect(fechaLarga(new Date('2027-01-01T00:00:00Z'))).toBe('1 de enero de 2027')
    expect(tamanoMB(152_300_000)).toBe('152,3 MB')
    expect(tamanoMB(1_949_999)).toBe('1,9 MB')
  })

  function preparar(anterior: string) {
    const entrada = carpetaConInstaladores()
    const salida = join(entrada, 'salida')
    const resultado = prepararDesarrollo({
      entrada,
      salida,
      raiz: raizReal,
      version,
      compilacion,
      sha: SHA,
      anterior,
      ejecucion: EJECUCION,
      fecha
    })
    return { salida, ...resultado }
  }

  it('compone el cuerpo con anterior: sin marcadores, con enlaces completos y sumas reales', () => {
    const { salida, datos, resumen } = preparar(ANTERIOR)
    const notas = readFileSync(join(salida, 'notas.md'), 'utf8')
    expect(notas).not.toMatch(/\{[A-Z]/)
    expect(notas).toContain(`**Compilación de desarrollo \`${compilacion}\` de Shinobi Karaoke**`)
    expect(notas).toContain('el 22 de noviembre de 2026 a partir del commit')
    expect(notas).toContain(
      `[1234567…9e07c55](https://github.com/Gomonsoft/shinobi-karaoke/compare/${ANTERIOR}...${SHA})`
    )
    expect(notas).toContain(`https://github.com/Gomonsoft/shinobi-karaoke/tree/${SHA}`)
    const exe = `Shinobi-Karaoke-desarrollo-${compilacion}-Windows-x64.exe`
    expect(notas).toContain(`\`${exe}\` · 0,0 MB`)
    expect(notas).toContain(`SHA-256: \`${sha(`contenido de ${INSTALADORES[2]}`)}\``)
    expect(datos).toEqual({
      etiqueta: `build-${SHA}`,
      titulo: compilacion,
      version,
      sha: SHA,
      archivos: expect.arrayContaining([exe])
    })
    expect(datos.archivos).toHaveLength(4)
    expect(resumen).toContain(`Etiqueta prevista en el canal: \`build-${SHA}\``)
  })

  it('sin anterior usa la frase de la primera compilación', () => {
    const { salida } = preparar('')
    const notas = readFileSync(join(salida, 'notas.md'), 'utf8')
    expect(notas).toContain('Es la primera compilación de este canal.')
    expect(notas).not.toContain('compare/')
  })

  it('SHA256SUMS.txt lleva los nombres nuevos y sus sumas son ciertas', () => {
    const { salida } = preparar('')
    const lineas = readFileSync(join(salida, 'SHA256SUMS.txt'), 'utf8').trim().split('\n')
    expect(lineas).toHaveLength(4)
    for (const l of lineas) {
      const [hash, nombre] = l.split('  ') as [string, string]
      expect(nombre).toContain(`desarrollo-${compilacion}`)
      expect(sha(readFileSync(join(salida, nombre), 'utf8'))).toBe(hash)
    }
  })

  it('falla con un marcador sin resolver, un sha o una compilación mal formados', () => {
    const entrada = carpetaConInstaladores()
    const base = {
      entrada,
      salida: join(entrada, 'salida'),
      version,
      compilacion,
      sha: SHA,
      ejecucion: EJECUCION,
      fecha
    }
    const raiz = raizConNotas(version)
    const plantilla = join(raiz, '.github', 'publicacion', 'cuerpo-desarrollo.md')
    writeFileSync(plantilla, readFileSync(plantilla, 'utf8') + '\n{INVENTADO}\n')
    expect(() => prepararDesarrollo({ ...base, raiz })).toThrow(/sin resolver: \{INVENTADO\}/)
    expect(() => prepararDesarrollo({ ...base, raiz: raizReal, sha: '9e07c55' })).toThrow(/40/)
    expect(() => prepararDesarrollo({ ...base, raiz: raizReal, anterior: 'abc' })).toThrow(/40/)
    expect(() => prepararDesarrollo({ ...base, raiz: raizReal, compilacion: '1.0.0-5' })).toThrow(
      /<versión>-<N>/
    )
  })
})
