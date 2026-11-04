import { describe, expect, it } from 'vitest'
import { resolverRutaDatos } from './rutas'

describe('resolverRutaDatos', () => {
  it('usa SHINOBI_DATOS si existe', () => {
    const ruta = resolverRutaDatos({
      plataforma: 'linux',
      env: { SHINOBI_DATOS: '/tmp/datos' },
      hogar: '/home/ana'
    })
    expect(ruta).toBe('/tmp/datos')
  })

  it('Windows: %LOCALAPPDATA%\\ShinobiKaraoke', () => {
    const ruta = resolverRutaDatos({
      plataforma: 'win32',
      env: { LOCALAPPDATA: 'C:\\Users\\ana\\AppData\\Local' },
      hogar: 'C:\\Users\\ana'
    })
    expect(ruta.replaceAll('\\', '/')).toMatch(/AppData\/Local\/ShinobiKaraoke$/)
  })

  it('macOS: Application Support/Shinobi Karaoke', () => {
    const ruta = resolverRutaDatos({ plataforma: 'darwin', env: {}, hogar: '/Users/ana' })
    expect(ruta).toBe('/Users/ana/Library/Application Support/Shinobi Karaoke')
  })

  it('Linux: respeta XDG_DATA_HOME', () => {
    const ruta = resolverRutaDatos({
      plataforma: 'linux',
      env: { XDG_DATA_HOME: '/xdg' },
      hogar: '/home/ana'
    })
    expect(ruta).toBe('/xdg/shinobi-karaoke')
  })

  it('Linux: por defecto ~/.local/share/shinobi-karaoke', () => {
    const ruta = resolverRutaDatos({ plataforma: 'linux', env: {}, hogar: '/home/ana' })
    expect(ruta).toBe('/home/ana/.local/share/shinobi-karaoke')
  })
})
