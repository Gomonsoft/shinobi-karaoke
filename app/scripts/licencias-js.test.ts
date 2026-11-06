import { describe, expect, it } from 'vitest'
import {
  generarBloque,
  paquetesDeArbolNpm,
  paquetesDeMapas,
  paquetesDistribuidos,
  reemplazarBloque
} from './licencias-js.mjs'

const inventario = {
  'react@19.3.1': { licenses: 'MIT', licenseText: 'MIT license de React.' },
  'yaml@2.9.1': { licenses: 'ISC', licenseText: 'ISC license de yaml.' },
  '@acme/demo@1.2.3': { licenses: 'Apache-2.0', licenseText: 'Apache license inventada.' }
}

describe('licencias-js', () => {
  it('extrae paquetes de mapas con rutas POSIX, Windows y ámbitos', () => {
    const paquetes = paquetesDeMapas([
      {
        sources: [
          '/repos/app/node_modules/react/index.js',
          'C:\\repos\\app\\node_modules\\@acme\\demo\\index.js',
          '../node_modules/@scope/name/dist/index.mjs',
          '../src/componente.tsx'
        ]
      }
    ])
    expect([...paquetes].sort()).toEqual(['@acme/demo', '@scope/name', 'react'])
  })

  it('recorre el árbol de producción y une paquetes repetidos', () => {
    const arbol = {
      dependencies: {
        yaml: { dependencies: {} },
        zod: { dependencies: { yaml: { dependencies: {} } } }
      }
    }
    expect([...paquetesDeArbolNpm(arbol)].sort()).toEqual(['yaml', 'zod'])
    expect(paquetesDistribuidos([{ sources: ['/node_modules/react/index.js'] }], arbol)).toEqual([
      'react',
      'yaml',
      'zod'
    ])
  })

  it('falla ante una licencia fuera de la lista admitida', () => {
    expect(() =>
      generarBloque({
        paquetes: ['react'],
        inventario: { 'react@19.3.1': { licenses: 'UNLICENSED', licenseText: 'texto' } }
      })
    ).toThrow('Licencia no admitida para react@19.3.1')
  })

  it('falla si falta el texto completo de licencia', () => {
    expect(() =>
      generarBloque({
        paquetes: ['react'],
        inventario: { 'react@19.3.1': { licenses: 'MIT', licenseText: '  ' } }
      })
    ).toThrow('Falta el texto completo de licencia para react@19.3.1')
  })

  it('genera el mismo bloque ordenado aunque cambie el orden de entrada', () => {
    const primero = generarBloque({ paquetes: ['react', 'yaml'], inventario })
    const segundo = generarBloque({ paquetes: ['yaml', 'react'], inventario })
    expect(primero).toBe(segundo)
    expect(primero.indexOf('### react')).toBeLessThan(primero.indexOf('### yaml'))
    expect(primero).toContain('MIT license de React.')
    expect(primero).toContain('ISC license de yaml.')
  })

  it('reemplaza únicamente un único bloque marcado y falla con marcadores ambiguos', () => {
    const actual =
      '# Avisos\n\n<!-- inicio:dependencias-js -->\nantiguo\n<!-- fin:dependencias-js -->\n\n## Worker\n'
    expect(
      reemplazarBloque(
        actual,
        '<!-- inicio:dependencias-js -->\nnuevo\n<!-- fin:dependencias-js -->'
      )
    ).toContain('nuevo')
    expect(() => reemplazarBloque('# sin bloque', 'contenido')).toThrow(
      'exactamente un par de marcadores'
    )
  })
})
