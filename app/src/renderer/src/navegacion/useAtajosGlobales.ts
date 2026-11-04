import { useEffect, useRef } from 'react'
import type { AccionMenu } from '@shared/ipc'
import { VISTAS_CON_ESC, type Vista } from './estado'

export type AccionAtajo = AccionMenu

const CAMPO_TEXTO = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

function enCampoDeTexto(destino: EventTarget | null): boolean {
  return destino instanceof Element && destino.closest(CAMPO_TEXTO) !== null
}

/** Hay un diálogo modal o un menú abierto: ellos gestionan su propio Esc y los atajos quedan en pausa. */
function hayCapaAbierta(): boolean {
  return document.querySelector('[aria-modal="true"], [role="menu"]') !== null
}

/** Acción de navegación para un atajo en la vista actual, o `null` si no aplica (docs/ux/00 §6). */
export function destinoDeAtajo(accion: AccionAtajo, vista: Vista): Vista | null {
  if (accion === 'anadir') {
    // Biblioteca y espacio de canción (vistas 3-6).
    if (vista.tipo === 'biblioteca' || vista.tipo === 'cancion') return { tipo: 'anadir' }
    return null
  }
  // Ajustes: todas salvo primer arranque y reproductor.
  if (vista.tipo === 'primer-arranque' || vista.tipo === 'reproductor') return null
  return vista.tipo === 'ajustes' ? null : { tipo: 'ajustes' }
}

/**
 * Atajos globales (docs/ux/00 §6): Ctrl/Cmd+N, Ctrl/Cmd+, y Esc. Los de una tecla (Esc)
 * no se disparan con el foco en un campo de texto. El zoom lo resuelve el menú nativo.
 * `alAccionMenu` entrega las mismas acciones cuando llegan desde el menú de la aplicación.
 */
export function useAtajosGlobales(vista: Vista, ir: (v: Vista) => void): void {
  const ref = useRef({ vista, ir })
  useEffect(() => {
    ref.current = { vista, ir }
  })

  useEffect(() => {
    const ejecutar = (accion: AccionAtajo) => {
      const destino = destinoDeAtajo(accion, ref.current.vista)
      if (destino && !hayCapaAbierta()) ref.current.ir(destino)
    }

    const alTeclear = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      const { vista: actual, ir: navegar } = ref.current
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        const tecla = e.key.toLowerCase()
        if (tecla === 'n' || tecla === ',') {
          const accion: AccionAtajo = tecla === 'n' ? 'anadir' : 'ajustes'
          if (destinoDeAtajo(accion, actual)) e.preventDefault()
          ejecutar(accion)
        }
        return
      }
      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (!VISTAS_CON_ESC.includes(actual.tipo)) return
        if (enCampoDeTexto(e.target) || hayCapaAbierta()) return
        e.preventDefault()
        navegar({ tipo: 'biblioteca' })
      }
    }

    window.addEventListener('keydown', alTeclear)
    const baja = window.shinobi?.alAccionMenu?.(ejecutar)
    return () => {
      window.removeEventListener('keydown', alTeclear)
      baja?.()
    }
  }, [])
}
