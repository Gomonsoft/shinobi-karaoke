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
  needs?: string
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
  on: Record<string, unknown>
  permissions: Record<string, string>
  jobs: Record<string, Trabajo>
}

describe('workflow manual de empaquetado', () => {
  it('solo admite ejecución manual y concede lectura del repositorio', () => {
    expect(Object.keys(flujo.on)).toEqual(['workflow_dispatch'])
    expect(flujo.permissions).toEqual({ contents: 'read' })
    for (const trabajo of Object.values(flujo.jobs)) {
      if (trabajo.permissions) expect(trabajo.permissions).toEqual({ contents: 'read' })
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
})
