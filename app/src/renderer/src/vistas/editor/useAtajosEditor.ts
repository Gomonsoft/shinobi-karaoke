import { useEffect, useEffectEvent } from 'react'
import { accionDeTecla, type AccionAtajo, type FocoEditor } from './atajos'

export function useAtajosEditor(
  sync: boolean,
  alAtajo: (accion: AccionAtajo, evento: KeyboardEvent) => void,
  alSoltar?: (evento: KeyboardEvent) => void
): void {
  const pulsar = useEffectEvent((e: KeyboardEvent) => {
    if (
      e.defaultPrevented ||
      document.querySelector(
        '[role="dialog"], [role="menu"], [role="listbox"][aria-activedescendant]'
      )
    )
      return
    const objetivo = e.target instanceof HTMLElement ? e.target : null
    const enCampoTexto = !!objetivo?.closest(
      'textarea, input:not([type="range"]):not([type="checkbox"]), [contenteditable="true"]'
    )
    const control = objetivo?.closest<HTMLElement>('[data-foco-editor]')
    const focoEn = (control?.dataset.focoEditor as FocoEditor | undefined) ?? 'otro'
    if (e.key === ' ' && !sync && focoEn !== 'lista' && objetivo?.closest('button, a[href], input'))
      return
    if (sync && e.key === 'Enter' && e.repeat && !enCampoTexto) {
      e.preventDefault()
      return
    }
    const accion = accionDeTecla(e, {
      sync,
      enCampoTexto,
      focoEn,
      mac: /Mac/i.test(navigator.platform)
    })
    if (!accion) {
      if (!enCampoTexto && e.altKey && ['ArrowLeft', 'ArrowRight'].includes(e.key))
        e.preventDefault()
      return
    }
    e.preventDefault()
    alAtajo(accion, e)
  })
  const soltar = useEffectEvent((e: KeyboardEvent) => alSoltar?.(e))

  useEffect(() => {
    const down = (e: KeyboardEvent) => pulsar(e)
    const up = (e: KeyboardEvent) => soltar(e)
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
  }, [])
}
