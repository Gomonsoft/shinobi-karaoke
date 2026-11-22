import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const raiz = fileURLToPath(new URL('../../', import.meta.url))
const leer = (ruta: string): string => readFileSync(join(raiz, ruta), 'utf8')
const readme = leer('README.md')
const guia = leer('INSTALAR.md')
const version = (JSON.parse(leer('app/package.json')) as { version: string }).version

// Estado E½ preparado (spec 09 §1.1b): se aplica al publicar la primera pre-release pública.
const bloques = [
  ...leer('lanzamientos/plantillas/estado-e-medio.md').matchAll(/```markdown\n([\s\S]*?)\n```/g)
].map(([, bloque]) => (bloque ?? '').replaceAll('{VERSION}', version))
const readmeE12 = bloques[0] ?? ''
const avisoE12 = bloques[1] ?? ''

const SISTEMAS = ['windows', 'mac', 'deb', 'appimage'] as const
const ARCHIVOS = {
  windows: 'Shinobi-Karaoke-Windows-x64.exe',
  mac: 'Shinobi-Karaoke-Mac-chip-Apple.dmg',
  deb: 'shinobi-karaoke-linux-x64.deb',
  appimage: 'Shinobi-Karaoke-Linux-x64.AppImage'
}
const TEXTOS_ALT = {
  windows: 'Descargar para Windows',
  mac: 'Descargar para Mac con chip Apple',
  deb: 'Descargar .deb para Ubuntu, Debian y Linux Mint',
  appimage: 'Descargar AppImage para otras distribuciones de Linux'
}

const seccionDescargar = (texto: string): string =>
  texto.split('## Descargar')[1]?.split('\n## ')[0] ?? ''

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
  it('el README está en E0 (sin descargas) o en E½ (idéntico a la plantilla), sin latest ni marcadores', () => {
    const descargar = seccionDescargar(readme)
    expect(readme).not.toContain('releases/latest')
    if (descargar.includes('Última versión:')) {
      expect(descargar).toBe(seccionDescargar(readmeE12))
      expect(guia).toContain(avisoE12)
    } else {
      expect(descargar).toContain('Todavía no hay ninguna versión publicada.')
      expect(descargar).not.toMatch(/\[[^\]]*(?:Descargar|Download)[^\]]*\]\(/i)
      expect(guia).toContain('Todavía no hay ninguna versión publicada')
    }
    for (const texto of [descargar, guia, readmeE12, avisoE12]) {
      expect(texto).not.toContain('⟦')
      expect(texto).not.toMatch(/<!--\s*(?:E0|PROVISIONAL)/)
      expect(texto).not.toMatch(/\{[^}]+\}/)
    }
  })

  it('la plantilla E½ cumple los criterios 17, 18, 21 y 22 de la spec 09', () => {
    expect(readmeE12).toContain(`**Última versión: ${version}, versión preliminar.**`)
    expect(readmeE12).toContain(
      `[Novedades de ${version}](https://github.com/Gomonsoft/shinobi-karaoke/releases/tag/v${version})`
    )
    const base = `https://github.com/Gomonsoft/shinobi-karaoke/releases/download/v${version}/`
    for (const sistema of SISTEMAS) {
      const svg = `lanzamientos/descarga/descargar-${sistema}.svg`
      expect(readmeE12).toContain(
        `[![${TEXTOS_ALT[sistema]}](${svg})](${base}${ARCHIVOS[sistema]})`
      )
      expect(existsSync(join(raiz, svg))).toBe(true)
    }
    expect(readmeE12.match(/releases\/download\/v/g)).toHaveLength(4)
    expect(readmeE12).not.toContain('releases/latest')
    expect(readmeE12).not.toContain('shinobi-karaoke-builds')
    const pasos = readmeE12.split('### Cómo instalarla')[1] ?? ''
    expect(pasos.match(/^[1-4]\. /gm)).toHaveLength(4)
    expect(pasos).toContain('**poco común** o **sospechoso**')
    expect(pasos).toContain('**peligroso** o que tiene un **virus**')
    for (const destino of ['#windows', '#mac-con-chip-apple', '#linux']) {
      expect(pasos).toContain(`(INSTALAR.md${destino})`)
    }
    expect(pasos).toContain('copia la carpeta **biblioteca**')
    expect(pasos).toContain(
      '**Descarga Shinobi Karaoke solo desde aquí o desde su [página de versiones](https://github.com/Gomonsoft/shinobi-karaoke/releases).**'
    )
    expect(avisoE12).toContain('**Por ahora solo hay versiones preliminares.**')
  })

  it('los botones SVG son válidos, accesibles y sin scripts ni recursos externos', () => {
    for (const sistema of SISTEMAS) {
      const svg = leer(`lanzamientos/descarga/descargar-${sistema}.svg`)
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="360" height="64"/)
      expect(svg).toContain('viewBox="0 0 360 64"')
      expect(svg).toContain('role="img"')
      expect(svg).toContain(`<title>${TEXTOS_ALT[sistema]}</title>`)
      expect(svg).toContain('fill="#C8303B"')
      expect(svg).not.toMatch(/<script|foreignObject|<a[ >]|href=|url\(|@import/i)
      expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//)
    }
  })

  it('mantiene iguales los requisitos y la advertencia de Mac Intel', () => {
    const lineaRequisitos = (texto: string) => texto.match(/^\*\*Requisitos:\*\* .*$/m)?.[0]
    const lineaIntel = 'Los Mac con procesador Intel no son compatibles por ahora.'
    expect(lineaRequisitos(readme)).toBe(lineaRequisitos(guia))
    expect(lineaRequisitos(readmeE12)).toBe(lineaRequisitos(guia))
    expect(readme).toContain(lineaIntel)
    expect(guia).toContain(lineaIntel)
  })

  it('incluye las secciones requeridas y todos los enlaces internos resuelven', () => {
    for (const encabezado of [
      '## ¿Por qué mi equipo me avisa?',
      '## Si el navegador bloquea la descarga',
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
    expect(
      enlacesInternosSinDestino(`${guia}\n${readmeE12.replaceAll('(INSTALAR.md#', '(#')}`)
    ).toEqual([])
    expect(guia.split('# Instalar Shinobi Karaoke')[1]).toContain(
      '](#si-el-navegador-bloquea-la-descarga)'
    )
    const windows = guia.split('\n## Windows')[1]?.split('\n## ')[0] ?? ''
    expect(windows).toContain('(#si-el-navegador-bloquea-la-descarga)')
    const navegador =
      guia.split('## Si el navegador bloquea la descarga')[1]?.split('\n## ')[0] ?? ''
    expect(navegador).toContain('**En Chrome:**')
    expect(navegador).toContain('**En Edge:**')
    expect(navegador).toMatch(/«Peligroso», «virus» o «malware»[^\n]*No lo conserves/)
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
    const texto = `${readme}\n${guia}\n${readmeE12}`
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
