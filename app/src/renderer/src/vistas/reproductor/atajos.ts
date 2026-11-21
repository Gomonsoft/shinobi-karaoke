export type OrigenReproductor = 'biblioteca' | 'editor' | 'sesion'

export type AccionReproductor =
  | { tipo: 'alternar' }
  | { tipo: 'saltar'; deltaMs: -10000 | -5000 | 5000 | 10000 }
  | { tipo: 'volumen'; delta: 0.1 | -0.1 }
  | { tipo: 'silenciar' }
  | { tipo: 'voz' }
  | { tipo: 'nivel_voz'; delta: 0.1 | -0.1 }
  | { tipo: 'principio' }
  | { tipo: 'pantalla_completa' }
  | { tipo: 'salir' }
  | { tipo: 'desplazar'; deltaMs: 100 | -100 }
  | { tipo: 'atajos' }
  /** Solo en la ventana secundaria (spec 07, fase 4). */
  | { tipo: 'siguiente' }
  | { tipo: 'cerrar' }
  | { tipo: 'esc' }

type Tecla = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'isComposing'
>

const ACCIONES = new Map<string, AccionReproductor>([
  [' ', { tipo: 'alternar' }],
  ['k', { tipo: 'alternar' }],
  ['arrowleft', { tipo: 'saltar', deltaMs: -5000 }],
  ['arrowright', { tipo: 'saltar', deltaMs: 5000 }],
  ['j', { tipo: 'saltar', deltaMs: -10000 }],
  ['l', { tipo: 'saltar', deltaMs: 10000 }],
  ['arrowup', { tipo: 'volumen', delta: 0.1 }],
  ['arrowdown', { tipo: 'volumen', delta: -0.1 }],
  ['m', { tipo: 'silenciar' }],
  ['home', { tipo: 'principio' }],
  ['0', { tipo: 'principio' }],
  ['f', { tipo: 'pantalla_completa' }],
  ['escape', { tipo: 'salir' }],
  ['f1', { tipo: 'atajos' }]
])

export function accionDeTeclaReproductor(
  e: Tecla,
  {
    origen,
    vozDisponible,
    focoEnBoton
  }: {
    origen: OrigenReproductor
    vozDisponible: boolean
    focoEnBoton: boolean
  }
): AccionReproductor | null {
  if (e.isComposing) return null
  const tecla = e.key.toLowerCase()
  if (
    origen === 'sesion' &&
    (e.ctrlKey || e.metaKey) &&
    !e.altKey &&
    !e.shiftKey &&
    tecla === 'w'
  ) {
    return { tipo: 'cerrar' }
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  if (tecla === '?') return { tipo: 'atajos' }
  if (e.shiftKey) {
    if (origen === 'sesion' && tecla === 'n') return { tipo: 'siguiente' }
    if (vozDisponible && (tecla === 'arrowup' || tecla === 'arrowdown')) {
      return { tipo: 'nivel_voz', delta: tecla === 'arrowup' ? 0.1 : -0.1 }
    }
    return null
  }
  if (tecla === ' ' && focoEnBoton) return null
  if (tecla === 'v') return vozDisponible ? { tipo: 'voz' } : null
  if (tecla === ',' || tecla === '.') {
    return origen === 'editor' ? { tipo: 'desplazar', deltaMs: tecla === ',' ? -100 : 100 } : null
  }
  // Esc nunca cierra la sesión: solo sale de la pantalla completa.
  if (origen === 'sesion' && tecla === 'escape') return { tipo: 'esc' }
  return ACCIONES.get(tecla) ?? null
}
