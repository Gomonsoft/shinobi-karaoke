import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const readme = readFileSync(fileURLToPath(new URL('../../README.md', import.meta.url)), 'utf8')
const guia = readFileSync(fileURLToPath(new URL('../../INSTALAR.md', import.meta.url)), 'utf8')

function slug(encabezado: string): string {
  return encabezado
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

function enlacesInternosSinDestino(texto: string): string[] {
  const destinos = new Set(
    texto
      .split('\n')
      .filter((linea) => /^#{1,6} /.test(linea))
      .map((linea) => slug(linea.replace(/^#{1,6} /, '').replace(/[*`]/g, '')))
  )
  return [...texto.matchAll(/\]\(#([^)]*)\)/g)]
    .map(([, destino]) => destino ?? '')
    .filter((destino) => !destinos.has(destino))
}

describe('guía provisional de instalación', () => {
  it('publica el estado E0 sin descargas, enlaces latest ni marcadores', () => {
    const descargar = readme.split('## Descargar')[1]?.split('\n## ')[0] ?? ''
    expect(descargar).toContain('Todavía no hay ninguna versión publicada.')
    expect(descargar).not.toMatch(/\[[^\]]*(?:Descargar|Download)[^\]]*\]\(/i)
    expect(readme).not.toContain('releases/latest')
    for (const texto of [descargar, guia]) {
      expect(texto).not.toContain('⟦')
      expect(texto).not.toMatch(/<!--\s*(?:E0|PROVISIONAL)/)
      expect(texto).not.toMatch(/\{[^}]+\}/)
    }
  })

  it('mantiene iguales los requisitos y la advertencia de Mac Intel', () => {
    const lineaRequisitos = (texto: string) => texto.match(/^\*\*Requisitos:\*\* .*$/m)?.[0]
    const lineaIntel = 'Los Mac con procesador Intel no son compatibles por ahora.'
    expect(lineaRequisitos(readme)).toBe(lineaRequisitos(guia))
    expect(readme).toContain(lineaIntel)
    expect(guia).toContain(lineaIntel)
  })

  it('incluye las secciones requeridas y todos los enlaces internos resuelven', () => {
    for (const encabezado of [
      '## ¿Por qué mi equipo me avisa?',
      '## Windows',
      '## Mac con chip Apple',
      '## Linux',
      '## Después de instalar',
      '## ¿Sigue sin abrirse?',
      '## Desinstalar'
    ]) {
      expect(guia).toContain(encabezado)
    }
    expect(enlacesInternosSinDestino(guia)).toEqual([])
  })

  it('conserva los textos de macOS 14 y los dos casos de compatibilidad', () => {
    expect(guia).toContain('Alternativa solo en macOS 14 Sonoma:')
    expect(guia).toContain('macOS 15 o posterior')
    expect(guia).toMatch(
      /## ¿Sigue sin abrirse\?[\s\S]*macOS dice que la app no es compatible con este Mac/
    )
    expect(guia).toMatch(/La app se abre pero dice «Necesitas actualizar macOS»/)
    expect(guia).toMatch(/Si pone \*\*Chip\*\*: tu versión de macOS es demasiado antigua/)
    expect(guia).toMatch(/Si pone \*\*Procesador\*\* \(Intel…\): tu Mac no es compatible/)
  })

  it('no recomienda rebajar protecciones ni conserva texto de la versión anterior', () => {
    const texto = `${readme}\n${guia}`
    expect(texto).not.toContain('~1–2 GB')
    expect(texto).not.toMatch(/--no-sandbox|apparmor_restrict|xattr|FUSE/i)
    expect(guia).not.toMatch(/modelo Rápido/i)
    expect(readme).toContain('descarga entre 1 y 6 GB según tu equipo')
  })

  it('enlaza la guía y deja pendiente una captura de cada sistema', () => {
    expect(readme).toContain('[guía de instalación](INSTALAR.md)')
    for (const sistema of ['Windows', 'Mac', 'Linux']) {
      const seccion = guia.split(`## ${sistema}`)[1]?.split('\n## ')[0] ?? ''
      expect(seccion).toContain('Captura pendiente:')
    }
  })
})
