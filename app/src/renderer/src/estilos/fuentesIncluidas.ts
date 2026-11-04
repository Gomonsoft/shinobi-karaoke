import { generarFontFace } from '@shared/fuentes'

// Vite empaqueta los WOFF2 con hash: se cargan desde la app, sin red.
const urls = import.meta.glob<string>('../../../../resources/fonts/**/*.woff2', {
  query: '?url',
  import: 'default',
  eager: true
})

const PREFIJO = '../../../../resources/fonts/'

/** Reglas `@font-face` de las familias del registro (único sitio donde se generan). */
export function cssFuentesIncluidas(): string {
  return generarFontFace((archivo) => {
    const url = urls[PREFIJO + archivo]
    if (!url) throw new Error(`Falta el archivo de fuente ${archivo}`)
    return url
  })
}

export function instalarFuentesIncluidas(doc: Document = document): void {
  if (doc.getElementById('fuentes-incluidas')) return
  const estilo = doc.createElement('style')
  estilo.id = 'fuentes-incluidas'
  estilo.textContent = cssFuentesIncluidas()
  doc.head.appendChild(estilo)
}
