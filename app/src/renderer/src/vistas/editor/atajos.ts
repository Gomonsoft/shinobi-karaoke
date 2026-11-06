import type { Pista } from '../../karaoke/pistas'

export type AccionAtajo =
  | {
      tipo:
        | 'reproducir'
        | 'principio'
        | 'entrar_sync'
        | 'marcar'
        | 'deshacer_marca'
        | 'borrar_tiempos'
        | 'escapar'
        | 'fijar_inicio'
        | 'fijar_fin'
        | 'escuchar_linea'
        | 'deshacer'
        | 'rehacer'
        | 'probar'
        | 'atajos'
    }
  | { tipo: 'ajustar_inicio' | 'ajustar_fin' | 'desplazar' | 'buscar'; deltaMs: number }
  | { tipo: 'mover_seleccion'; sentido: -1 | 1 }
  | { tipo: 'pista'; pista: Pista }

export type FocoEditor = 'lista' | 'barra' | 'volumen' | 'dial' | 'segmentado' | 'otro'

type Tecla = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> &
  Partial<Pick<KeyboardEvent, 'repeat' | 'isComposing'>>

export function accionDeTecla(
  e: Tecla,
  opciones: {
    enCampoTexto: boolean
    sync: boolean
    focoEn: FocoEditor
    mac?: boolean
  }
): AccionAtajo | null {
  const { enCampoTexto, sync, focoEn, mac } = opciones
  const tecla = e.key.toLowerCase()
  const control = e.ctrlKey || e.metaKey
  if (e.isComposing) return null
  if (tecla === 'f1' || (tecla === '?' && !enCampoTexto && !control && !e.altKey))
    return { tipo: 'atajos' }
  if (enCampoTexto) return null

  if (!e.altKey && control) {
    if (tecla === 'z') return { tipo: e.shiftKey ? 'rehacer' : 'deshacer' }
    if (tecla === 'y' && e.ctrlKey && !e.metaKey && !mac) return { tipo: 'rehacer' }
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
  if (control || e.altKey) return null
  const enControl = ['barra', 'volumen', 'dial', 'segmentado'].includes(focoEn)
  if (tecla === 'arrowup' || tecla === 'arrowdown') {
    return !sync && (!enControl || e.shiftKey)
      ? { tipo: 'mover_seleccion', sentido: tecla === 'arrowup' ? -1 : 1 }
      : null
  }
  if (tecla === 'escape') return { tipo: 'escapar' }
  if (tecla === ' ' && !enControl) return { tipo: 'reproducir' }
  if (tecla === 'home' && !enControl) return { tipo: 'principio' }
  if (tecla === 's' && !sync && !e.repeat) return { tipo: 'entrar_sync' }
  if (tecla === 'f' && !sync && !e.repeat && !e.shiftKey) return { tipo: 'probar' }
  if (tecla === 'enter' && sync && !e.repeat) return { tipo: 'marcar' }
  if (tecla === 'backspace') return { tipo: sync ? 'deshacer_marca' : 'borrar_tiempos' }
  if (tecla === 'delete' && !sync) return { tipo: 'borrar_tiempos' }
  if (tecla === 'i' && !sync) return { tipo: 'fijar_inicio' }
  if (tecla === 'o' && !sync) return { tipo: 'fijar_fin' }
  if (tecla === 'l' && !sync) return { tipo: 'escuchar_linea' }
  if (tecla === ',' || tecla === '.')
    return { tipo: 'desplazar', deltaMs: tecla === ',' ? -100 : 100 }
  const pistas: Record<string, Pista> = { '1': 'original', '2': 'voz', '3': 'instrumental' }
  const pista = pistas[tecla]
  return pista ? { tipo: 'pista', pista } : null
}
