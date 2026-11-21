/** Teclado de la ventana del editor preciso (spec 06, fase 9, «Teclado de la ventana»). */

export type AccionTeclado =
  | { tipo: 'bucle' }
  | { tipo: 'escucharPalabra' }
  | { tipo: 'retroceso' }
  | { tipo: 'fijar'; campo: 'inicio' | 'fin' }
  | { tipo: 'linea'; sentido: -1 | 1 }
  | { tipo: 'pista'; indice: 1 | 2 | 3 }
  | { tipo: 'deshacer' }
  | { tipo: 'rehacer' }
  | { tipo: 'aplicar' }
  | { tipo: 'cerrar' }
  | { tipo: 'ajustar'; campo: 'inicio' | 'fin'; deltaMs: number }
  /** Atajos del editor que no actúan con el foco en la ventana: solo `preventDefault`. */
  | { tipo: 'ignorar' }

/** Dónde está el foco: campo de texto, control propio (botón, radio, control deslizante) o resto. */
export type ContextoTeclado = 'campo' | 'control' | 'general'

export interface TeclaPreciso {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  repeat?: boolean
}

/** Clasifica el elemento con el foco. */
export function contextoDe(el: Element | null): ContextoTeclado {
  if (!el) return 'general'
  if (el.closest('textarea')) return 'campo'
  const campo = el.closest('input')
  if (campo) return campo.type === 'range' ? 'control' : 'campo'
  if (el.closest('button, [role="radio"], [role="slider"], [role="radiogroup"]')) return 'control'
  return 'general'
}

/**
 * Acción de una tecla con el foco dentro de la ventana, o `null` si no es suya (Intro y las
 * flechas sin modificador de la tira las atiende la tira). En un campo de texto solo
 * Ctrl/Cmd + Intro: Esc y Intro son del propio campo.
 */
export function resolverTecla(t: TeclaPreciso, contexto: ContextoTeclado): AccionTeclado | null {
  const orden = t.ctrlKey || t.metaKey
  if (t.key === 'Enter' && orden) return { tipo: 'aplicar' }
  if (contexto === 'campo') return null
  const letra = t.key.length === 1 ? t.key.toLowerCase() : t.key

  if (orden && !t.altKey) {
    if (letra === 'z') return { tipo: t.shiftKey ? 'rehacer' : 'deshacer' }
    if (letra === 'y') return { tipo: 'rehacer' }
    if (letra === 'e') return { tipo: 'ignorar' }
    if (t.key === 'ArrowLeft' || t.key === 'ArrowRight') {
      return {
        tipo: 'ajustar',
        campo: 'fin',
        deltaMs: (t.key === 'ArrowLeft' ? -1 : 1) * (t.shiftKey ? 100 : 10)
      }
    }
    return null
  }
  if (t.altKey && !orden) {
    if (t.key === 'ArrowLeft' || t.key === 'ArrowRight') {
      return {
        tipo: 'ajustar',
        campo: 'inicio',
        deltaMs: (t.key === 'ArrowLeft' ? -1 : 1) * (t.shiftKey ? 100 : 10)
      }
    }
    return null
  }
  if (orden || t.altKey) return null

  switch (t.key) {
    case ' ':
      // Espacio activa el botón con el foco; en el resto de la ventana inicia o pausa el bucle.
      if (contexto === 'control') return null
      return { tipo: t.shiftKey ? 'escucharPalabra' : 'bucle' }
    case 'Escape':
      return { tipo: 'cerrar' }
    case 'Backspace':
      return contexto === 'control' ? null : { tipo: 'retroceso' }
    case 'ArrowUp':
    case 'ArrowDown':
      return contexto === 'control'
        ? null
        : { tipo: 'linea', sentido: t.key === 'ArrowUp' ? -1 : 1 }
    case 'Delete':
    case 'F':
    case 'P':
    case 'L':
      return { tipo: 'ignorar' }
  }
  switch (letra) {
    case 'i':
      return { tipo: 'fijar', campo: 'inicio' }
    case 'o':
      return { tipo: 'fijar', campo: 'fin' }
    case '1':
    case '2':
    case '3':
      return { tipo: 'pista', indice: Number(letra) as 1 | 2 | 3 }
    case 'l':
    case 'p':
    case 'f':
      return { tipo: 'ignorar' }
  }
  return null
}
