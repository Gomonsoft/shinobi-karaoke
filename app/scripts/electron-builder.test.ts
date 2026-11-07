import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { ID_APP_WINDOWS, TITULO_APP } from '../src/shared/titulo'

const RAIZ = resolve(import.meta.dirname, '..')
const configuracion = parse(readFileSync(resolve(RAIZ, 'electron-builder.yml'), 'utf8'))

describe('electron-builder.yml', () => {
  it('mantiene la identidad de la aplicación y empaqueta el build en asar', () => {
    expect(configuracion.appId).toBe(ID_APP_WINDOWS)
    expect(configuracion.productName).toBe(TITULO_APP)
    expect(configuracion.files).toEqual(['out/**', 'package.json', '!**/*.map', '!**/src/**'])
    expect(configuracion.asar).toBe(true)
    expect(configuracion.npmRebuild).toBe(false)
    expect(configuracion.publish).toBeNull()
  })

  it('genera solo los destinos y arquitecturas acordados', () => {
    expect(configuracion.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
    expect(configuracion.nsis).toMatchObject({
      oneClick: true,
      perMachine: false,
      deleteAppDataOnUninstall: false,
      differentialPackage: false
    })
    expect(configuracion.mac.target).toEqual([{ target: 'dmg', arch: ['arm64'] }])
    expect(configuracion.mac).toMatchObject({
      identity: '-',
      hardenedRuntime: false,
      notarize: false
    })
    expect(configuracion.mac).not.toHaveProperty('minimumSystemVersion')
    expect(configuracion.dmg.sign).toBe(false)
    expect(configuracion.linux.target).toEqual([
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] }
    ])
    expect(configuracion.deb.packageName).toBe('shinobi-karaoke')
  })

  it('declara todas las opciones de firma preparadas y desactivadas', () => {
    expect(configuracion.forceCodeSigning).toBe(false)
    expect(configuracion.win.signtoolOptions).toBeNull()
    expect(configuracion.win.azureSignOptions).toBeNull()
    expect(configuracion.mac.notarize).toBe(false)
  })

  it('fija los ocho fuses y el runtime de AppImage del ADR 0012', () => {
    expect(configuracion.electronFuses).toEqual({
      runAsNode: false,
      enableCookieEncryption: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      enableEmbeddedAsarIntegrityValidation: true,
      onlyLoadAppFromAsar: true,
      loadBrowserProcessSpecificV8Snapshot: false,
      grantFileProtocolExtraPrivileges: false
    })
    expect(configuracion.toolsets.appimage).toBe('1.0.3')
  })

  it('incluye los recursos externos desde las rutas acordadas', () => {
    expect(configuracion.extraResources).toEqual([
      { from: '../worker/shinobi_worker', to: 'worker/shinobi_worker', filter: ['**/*.py'] },
      { from: '../worker/requisitos', to: 'worker/requisitos' },
      { from: '../worker/pyproject.toml', to: 'worker/pyproject.toml' },
      { from: '../worker/uv.lock', to: 'worker/uv.lock' },
      { from: 'resources/runtime-manifest.json', to: 'runtime-manifest.json' },
      { from: '../LICENSE', to: 'LICENSE' },
      { from: '../THIRD_PARTY_NOTICES.md', to: 'THIRD_PARTY_NOTICES.md' },
      { from: 'resources/fonts', to: 'fonts', filter: ['**/*.woff2', '**/OFL.txt'] },
      { from: 'resources/bin', to: 'bin', filter: ['uv', 'uv.exe'] }
    ])
  })

  it('usa los nombres de artefacto acordados', () => {
    expect(configuracion.win.artifactName).toBe('Shinobi-Karaoke-Windows-x64.${ext}')
    expect(configuracion.mac.artifactName).toBe('Shinobi-Karaoke-Mac-chip-Apple.${ext}')
    expect(configuracion.linux.artifactName).toBe('Shinobi-Karaoke-Linux-x64.${ext}')
    expect(configuracion.deb.artifactName).toBe('shinobi-karaoke-linux-x64.${ext}')
  })
})
