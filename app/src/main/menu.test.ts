import { describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { plantillaMenu } from './menu'

function aplanar(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((i) => [i, ...(Array.isArray(i.submenu) ? aplanar(i.submenu) : [])])
}

describe('menú de aplicación', () => {
  it('los atajos propios envían la acción correspondiente', () => {
    const enviar = vi.fn()
    const items = aplanar(plantillaMenu('linux', enviar))
    items
      .find((i) => i.accelerator === 'CommandOrControl+N')
      ?.click?.({} as never, undefined, {} as never)
    items
      .find((i) => i.accelerator === 'CommandOrControl+,')
      ?.click?.({} as never, undefined, {} as never)
    expect(enviar.mock.calls).toEqual([['anadir'], ['ajustes']])
  })

  it('incluye edición, zoom y salir; en macOS el menú de la app con Salir', () => {
    const roles = (p: NodeJS.Platform) => aplanar(plantillaMenu(p, vi.fn())).map((i) => i.role)
    for (const p of ['linux', 'darwin'] as const) {
      expect(roles(p)).toEqual(
        expect.arrayContaining(['copy', 'paste', 'zoomIn', 'zoomOut', 'resetZoom', 'quit'])
      )
    }
    expect(plantillaMenu('darwin', vi.fn())[0]?.label).toBe('Shinobi Karaoke')
    expect(plantillaMenu('linux', vi.fn())[0]?.label).toBe('Archivo')
  })
})
