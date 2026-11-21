import { describe, expect, it } from 'vitest'
import { idPorEntrada, requiresLocales } from './preloads-autocontenidos'

describe('idPorEntrada', () => {
  it('etiqueta módulos propios con ids POSIX y raíz con barra invertida (Windows)', () => {
    expect(
      idPorEntrada(
        'C:/repo/app/src/shared/canales.ts',
        'C:/repo/app/src/preload/index.ts',
        'C:\\repo\\app\\src'
      )
    ).toBe('C:/repo/app/src/shared/canales.ts?e=index')
  })

  it('acepta ids con barra invertida y propaga la etiqueta del importador', () => {
    expect(
      idPorEntrada(
        'C:\\repo\\app\\src\\shared\\canales.ts',
        'C:\\repo\\app\\src\\shared\\x.ts?e=secundaria',
        'C:\\repo\\app\\src'
      )
    ).toBe('C:\\repo\\app\\src\\shared\\canales.ts?e=secundaria')
  })

  it('ignora node_modules, virtuales y módulos fuera de src', () => {
    const raiz = 'C:\\repo\\app\\src'
    const imp = 'C:/repo/app/src/preload/index.ts'
    expect(idPorEntrada('C:/repo/app/node_modules/x/i.js', imp, raiz)).toBeNull()
    expect(idPorEntrada('\0virtual', imp, raiz)).toBeNull()
    expect(idPorEntrada('C:/repo/app/srcother/a.ts', imp, raiz)).toBeNull()
  })
})

describe('requiresLocales', () => {
  it('solo admite require("electron")', () => {
    expect(requiresLocales('const e=require("electron");')).toEqual([])
    expect(requiresLocales('require("electron");require("./chunks/c.js")')).toEqual([
      './chunks/c.js'
    ])
  })
})
