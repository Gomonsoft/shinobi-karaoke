import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface Paso {
  id?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

interface Trabajo {
  needs?: string | string[]
  permissions?: Record<string, string>
  'timeout-minutes'?: number
  steps: Paso[]
  strategy?: {
    'fail-fast': boolean
    matrix: { include: { os: string; forma?: string; informativa?: boolean }[] }
  }
}

const flujo = parse(
  readFileSync(new URL('../../.github/workflows/empaquetado.yml', import.meta.url), 'utf8')
) as {
  on: { workflow_dispatch: unknown; push: { tags: string[] } }
  permissions: Record<string, string>
  concurrency: Record<string, unknown>
  jobs: Record<string, Trabajo>
}

describe('workflow manual de empaquetado', () => {
  it('se dispara a mano o con etiquetas v* y solo publicar escribe', () => {
    expect(Object.keys(flujo.on).sort()).toEqual(['push', 'workflow_dispatch'])
    expect(flujo.on.push).toEqual({ tags: ['v*'] })
    expect(flujo.permissions).toEqual({ contents: 'read' })
    expect(flujo.concurrency).toEqual({
      group: 'empaquetado-${{ github.ref }}',
      'cancel-in-progress': false
    })
    for (const [nombre, trabajo] of Object.entries(flujo.jobs)) {
      if (nombre === 'publicar') continue
      if (trabajo.permissions) expect(trabajo.permissions).toEqual({ contents: 'read' })
    }
  })

  it('comprueba la versión antes de construir y no interpola datos del evento en run', () => {
    const comprobar = flujo.jobs['comprobar-version']!
    expect(comprobar['timeout-minutes']).toBe(10)
    expect(comprobar.steps.some(({ run }) => run?.includes('npm ci'))).toBe(false)
    expect(flujo.jobs.construir!.needs).toBe('comprobar-version')
    expect(comprobar.steps.find(({ uses }) => uses?.startsWith('actions/checkout@'))?.with).toEqual(
      { 'fetch-depth': 0 }
    )
    for (const trabajo of Object.values(flujo.jobs)) {
      for (const { run } of trabajo.steps) expect(run ?? '').not.toContain('${{')
    }
  })

  it('fija por SHA todas las acciones y no utiliza acciones de publicación', () => {
    const acciones = Object.values(flujo.jobs).flatMap(({ steps }) =>
      steps.flatMap(({ uses }) => (uses ? [uses] : []))
    )
    expect(acciones.length).toBeGreaterThan(0)
    for (const accion of acciones) {
      expect(accion).toMatch(
        /^actions\/(checkout|setup-node|upload-artifact|download-artifact)@[a-f0-9]{40}$/
      )
    }
  })

  it('construye en los tres SO y guarda solo las rutas de instaladores y comprobaciones', () => {
    const construir = flujo.jobs.construir!
    expect(construir['timeout-minutes']).toBe(45)
    expect(construir.strategy?.['fail-fast']).toBe(false)
    expect(construir.strategy?.matrix.include.map(({ os }) => os)).toEqual([
      'windows-2025',
      'macos-26',
      'ubuntu-24.04'
    ])
    const publicar = construir.steps.find(({ uses }) =>
      uses?.startsWith('actions/upload-artifact@')
    )
    expect(publicar?.with).toMatchObject({
      'retention-days': 14,
      'if-no-files-found': 'error',
      path: '${{ steps.instaladores.outputs.rutas }}'
    })
  })

  it('prueba los instaladores en un runner separado y deja Ubuntu 26.04 como informativo', () => {
    const probar = flujo.jobs['probar-instalador']!
    expect(probar.needs).toBe('construir')
    expect(probar.strategy?.['fail-fast']).toBe(false)
    expect(
      probar.strategy?.matrix.include.map(({ os, forma, informativa }) => [os, forma, informativa])
    ).toEqual([
      ['windows-2025', 'NSIS', false],
      ['macos-26', 'DMG', false],
      ['macos-15', 'DMG', false],
      ['ubuntu-24.04', '.deb', false],
      ['ubuntu-26.04', '.deb', true],
      ['ubuntu-24.04', 'AppImage', false]
    ])
    expect(probar.steps.some(({ uses }) => uses?.startsWith('actions/download-artifact@'))).toBe(
      true
    )
  })

  it('comprueba la instalación NSIS de un clic y conserva los datos al desinstalar', () => {
    const paso = flujo.jobs['probar-instalador']!.steps.find(({ id }) => id === 'nsis')!.run!
    const paquete = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as {
      name: string
    }
    expect(paso).toContain(`Programs\\${paquete.name}`)
    expect(paso).toContain("'Shinobi Karaoke.exe'")
    expect(paso).toContain("'Uninstall Shinobi Karaoke.exe'")
    expect(paso).toContain('-PathType Leaf')
    expect(paso).toContain('npm run test:paquete')
    expect(paso).toContain('node scripts/humo-instalador.mjs datos')
    expect(paso).toContain('Get-FileHash -LiteralPath $config')
    expect(paso).toContain("throw 'El ejecutable sigue instalado'")
    expect(paso).toContain("throw 'La desinstalación alteró los datos'")
  })

  it('prepara la publicación sin permisos de escritura y sube publicacion-…', () => {
    const preparar = flujo.jobs['preparar-publicacion']!
    expect(preparar.needs).toEqual(['comprobar-version', 'construir', 'probar-instalador'])
    expect(preparar.permissions).toEqual({ contents: 'read' })
    const subida = preparar.steps.find(({ uses }) => uses?.startsWith('actions/upload-artifact@'))
    expect(subida?.with).toMatchObject({
      name: 'publicacion-${{ needs.comprobar-version.outputs.version }}',
      'retention-days': 14,
      'if-no-files-found': 'error'
    })
    const descarga = preparar.steps.find(({ uses }) =>
      uses?.startsWith('actions/download-artifact@')
    )
    expect(descarga?.with).toMatchObject({ 'merge-multiple': true })
  })
})
