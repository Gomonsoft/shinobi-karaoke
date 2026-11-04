// Hook de resolución: permite importar módulos .ts sin extensión (como hace el bundler).
import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

async function existe(url) {
  try {
    await access(fileURLToPath(url))
    return true
  } catch {
    return false
  }
}

export async function resolve(specifier, contexto, siguiente) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && contexto.parentURL) {
    for (const sufijo of ['.ts', '/index.ts']) {
      const url = new URL(specifier + sufijo, contexto.parentURL)
      if (!specifier.endsWith('.ts') && (await existe(url.href))) {
        return { url: url.href, shortCircuit: true }
      }
    }
  }
  return siguiente(specifier, contexto)
}
