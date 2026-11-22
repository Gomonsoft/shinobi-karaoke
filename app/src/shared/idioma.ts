/**
 * Detección del idioma de una letra (ADR 0028 §3.3): proporción de palabras vacías
 * frecuentes de cada idioma y caracteres propios. Pura. Devuelve `es`, `en` o `null`.
 */
const VACIAS_ES = new Set(
  'el la los las un una unos unas de del y o que en con por para no me te se mi tu su lo al es soy eres estoy está como pero si ya más muy yo tú él ella nos le cuando donde hay sin sobre'.split(
    ' '
  )
)
const VACIAS_EN = new Set(
  "the a an and or of to in on at is are was were be i you he she it we they my your his her our their me him us them this that with for not but so do don't just all can will".split(
    ' '
  )
)

/** Mínimo de palabras reconocidas y ventaja sobre el otro idioma para decidir. */
const MINIMO_PALABRAS = 4
const VENTAJA = 1.5

export function detectarIdioma(entrada: string | readonly { texto: string }[]): 'es' | 'en' | null {
  const texto = typeof entrada === 'string' ? entrada : entrada.map((l) => l.texto).join('\n')
  const palabras = texto.toLowerCase().match(/[a-záéíóúüñ']+/g) ?? []
  if (palabras.length === 0) return null
  let es = 0
  let en = 0
  for (const p of palabras) {
    if (VACIAS_ES.has(p)) es++
    if (VACIAS_EN.has(p)) en++
  }
  // Caracteres propios del español: ñ, vocales con tilde, ¿ y ¡.
  es += (texto.match(/[ñáéíóú¿¡]/gi) ?? []).length
  if (es + en < MINIMO_PALABRAS) return null
  if (es >= en * VENTAJA && es > 0) return 'es'
  if (en >= es * VENTAJA && en > 0) return 'en'
  return null
}
