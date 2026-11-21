import { join } from 'node:path'

export interface OpcionesIcono {
  empaquetada: boolean
  plataforma: NodeJS.Platform
  dirApp: string
  dirRecursos: string
}

/**
 * Icono para `BrowserWindow.icon` (ADR 0012, revisión alpha.2). Sin empaquetar, el PNG de
 * `build/`. Empaquetada, Windows y macOS usan el icono del ejecutable o del bundle; en Linux se
 * copia `icon.png` a `resources/`.
 */
export function rutaIcono({
  empaquetada,
  plataforma,
  dirApp,
  dirRecursos
}: OpcionesIcono): string | undefined {
  if (!empaquetada) return join(dirApp, 'build', 'icon.png')
  return plataforma === 'linux' ? join(dirRecursos, 'icon.png') : undefined
}
