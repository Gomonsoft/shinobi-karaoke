/**
 * Lógica pura del plugin `preloadsAutocontenidos` (electron.vite.config.ts).
 * Rollup entrega ids con `/` incluso en Windows, mientras que `path.resolve` usa `\`:
 * se normaliza todo a `/` antes de comparar.
 */
export const aPosix = (ruta: string): string => ruta.replaceAll('\\', '/')

const nombreBase = (ruta: string): string => aPosix(ruta).split('/').pop() ?? ruta

/** Id con la etiqueta de la entrada (`?e=<entrada>`), o `null` si el módulo no es propio. */
export function idPorEntrada(id: string, importer: string, raizSrc: string): string | null {
  if (id.startsWith('\0') || aPosix(id).includes('node_modules')) return null
  const raiz = aPosix(raizSrc).replace(/\/+$/, '')
  if (!aPosix(id).toLowerCase().startsWith(`${raiz.toLowerCase()}/`)) return null
  const etiqueta = /\?e=([^&]+)/.exec(importer)?.[1] ?? nombreBase(importer).replace(/[.?].*$/, '')
  return `${id.replace(/\?e=[^&]+/, '')}?e=${etiqueta}`
}

/** Módulos locales que un preload cargaría con `require` (los preloads con sandbox no pueden). */
export function requiresLocales(codigo: string): string[] {
  const encontrados: string[] = []
  for (const m of codigo.matchAll(/\brequire\(\s*(["'`])([^"'`]+)\1\s*\)/g)) {
    const modulo = m[2] ?? ''
    if (modulo !== 'electron') encontrados.push(modulo)
  }
  return encontrados
}
