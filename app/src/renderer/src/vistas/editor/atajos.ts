import type { Pista } from '../../karaoke/pistas'

export type AccionAtajo =
  | {
      tipo:
        | 'reproducir'
        | 'principio'
        | 'marcar'
        | 'deshacer_marca'
        | 'borrar_tiempos'
        | 'escapar'
        | 'fijar_inicio'
        | 'fijar_fin'
        | 'escuchar_linea'
        | 'escuchar_tramo_linea'
        | 'abrir_preciso'
        | 'deshacer'
        | 'rehacer'
        | 'probar'
        | 'atajos'
        | 'exportar'
        | 'revisar'
        | 'revision_bien'
    }
  | { tipo: 'ajustar_inicio' | 'ajustar_fin' | 'buscar'; deltaMs: number }
  | { tipo: 'mover_seleccion'; sentido: -1 | 1; extender: boolean }
  | { tipo: 'dudosa'; sentido: -1 | 1 }
  /** Reparto (0.2.3): `C` abre «¿Quién canta?»; `Alt + 1…4` asigna; `Alt + ↑/↓` va a la parte vecina. */
  | { tipo: 'quien_canta' }
  | { tipo: 'parte_n'; n: 1 | 2 | 3 | 4 }
  | { tipo: 'parte_vecina'; sentido: -1 | 1 }
  | { tipo: 'pista'; pista: Pista }

export type FocoEditor =
  'lista' | 'region' | 'barra' | 'volumen' | 'dial' | 'segmentado' | 'divisor' | 'otro'

type Tecla = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> &
  Partial<Pick<KeyboardEvent, 'repeat' | 'isComposing' | 'code'>>

export function accionDeTecla(
  e: Tecla,
  opciones: {
    enCampoTexto: boolean
    sync: boolean
    focoEn: FocoEditor
    mac?: boolean
    /** Canción con reparto: sin él, Alt + ↑/↓ no hace nada (ni se captura). Por defecto, sí. */
    reparto?: boolean
  }
): AccionAtajo | null {
  const { enCampoTexto, sync, focoEn, mac, reparto = true } = opciones
  const tecla = e.key.toLowerCase()
  const control = e.ctrlKey || e.metaKey
  if (e.isComposing) return null
  if (tecla === 'f1' || (tecla === '?' && !enCampoTexto && !control && !e.altKey))
    return { tipo: 'atajos' }
  if (enCampoTexto) return null

  if (!e.altKey && control) {
    if (tecla === 'z') return { tipo: e.shiftKey ? 'rehacer' : 'deshacer' }
    if (tecla === 'e' && !e.shiftKey) return { tipo: 'exportar' }
    if (tecla === 'y' && e.ctrlKey && !e.metaKey && !mac) return { tipo: 'rehacer' }
    // Línea dudosa siguiente / anterior (feature 11): también fuera del recorrido.
    if ((tecla === 'arrowdown' || tecla === 'arrowup') && !sync && !e.shiftKey)
      return { tipo: 'dudosa', sentido: tecla === 'arrowup' ? -1 : 1 }
  }

  if (tecla === 'arrowleft' || tecla === 'arrowright') {
    const sentido = tecla === 'arrowleft' ? -1 : 1
    if (e.altKey || control) {
      return !sync && e.altKey !== control
        ? {
            tipo: e.altKey ? 'ajustar_inicio' : 'ajustar_fin',
            deltaMs: sentido * (e.shiftKey ? 100 : 10)
          }
        : null
    }
    return focoEn === 'barra' && !e.shiftKey ? { tipo: 'buscar', deltaMs: sentido * 5000 } : null
  }
  // Reparto (0.2.3). Alt + número se lee por la tecla física (`code`): en macOS Opción cambia `key`.
  // AltGr llega como Ctrl + Alt, así que `control` lo descarta. Ninguno actúa al ritmo.
  if (e.altKey && !control && !sync) {
    const digito = /^Digit([1-4])$/.exec(e.code ?? '')
    if (digito) return { tipo: 'parte_n', n: Number(digito[1]) as 1 | 2 | 3 | 4 }
    if ((tecla === 'arrowup' || tecla === 'arrowdown') && !e.shiftKey && reparto) {
      return focoEn === 'lista' || focoEn === 'region'
        ? { tipo: 'parte_vecina', sentido: tecla === 'arrowup' ? -1 : 1 }
        : null
    }
  }
  if (control || e.altKey) return null
  const enControl = ['barra', 'volumen', 'dial', 'segmentado', 'divisor'].includes(focoEn)
  if (tecla === 'arrowup' || tecla === 'arrowdown') {
    // En un divisor las cuatro flechas son suyas: ↑/↓ no cambian de línea.
    if (focoEn === 'divisor') return null
    return !sync && (!enControl || e.shiftKey)
      ? {
          tipo: 'mover_seleccion',
          sentido: tecla === 'arrowup' ? -1 : 1,
          // Mayús + ↑/↓ extiende el rango con el foco en la lista (o en una región).
          extender: e.shiftKey && (focoEn === 'lista' || focoEn === 'region')
        }
      : null
  }
  if (tecla === 'escape') return { tipo: 'escapar' }
  if (tecla === ' ' && (!enControl || focoEn === 'divisor')) return { tipo: 'reproducir' }
  if (tecla === 'home' && !enControl) return { tipo: 'principio' }
  if (tecla === 'f' && !sync && !e.repeat && !e.shiftKey) return { tipo: 'probar' }
  if (tecla === 'enter' && sync && !e.repeat) return { tipo: 'marcar' }
  if (tecla === 'backspace') return { tipo: sync ? 'deshacer_marca' : 'borrar_tiempos' }
  if (tecla === 'delete' && !sync) return { tipo: 'borrar_tiempos' }
  if (tecla === 'c' && !sync && !e.repeat && !e.shiftKey) return { tipo: 'quien_canta' }
  if (tecla === 'i' && !sync) return { tipo: 'fijar_inicio' }
  if (tecla === 'o' && !sync) return { tipo: 'fijar_fin' }
  if (tecla === 'p' && !sync && !e.repeat && !e.shiftKey) return { tipo: 'abrir_preciso' }
  if (tecla === 'r' && !sync && !e.repeat && !e.shiftKey) return { tipo: 'revisar' }
  if (tecla === 'n' && !sync && !e.repeat && !e.shiftKey) return { tipo: 'revision_bien' }
  if (tecla === 'l' && !sync)
    return { tipo: e.shiftKey ? 'escuchar_tramo_linea' : 'escuchar_linea' }
  const pistas: Record<string, Pista> = { '1': 'original', '2': 'voz', '3': 'instrumental' }
  const pista = pistas[tecla]
  return pista ? { tipo: 'pista', pista } : null
}
