import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import type { ModoSeparacion } from './modelo'
import { SEP } from './textos'
import estilos from './progreso.module.css'

interface Props {
  modo: ModoSeparacion
  /** Dispositivo realmente usado (`TrabajoIpc.dispositivo`). */
  dispositivo: 'cpu' | 'cuda'
  alIrAjustes: () => void
}

/**
 * "Modelo Calidad · ⓘ" (ux/04 criterio 13). El popover se abre con clic, Intro o Espacio (un
 * `button` nativo); Esc lo cierra y devuelve el foco. Ningún texto dice que se pueda elegir modelo.
 */
export function IndicadorModelo({ modo, dispositivo, alIrAjustes }: Props) {
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    // Esc cierra el popover, no la vista: se trata antes que el atajo global (ignora `defaultPrevented`).
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setAbierto(false)
      boton.current?.focus()
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  return (
    <div ref={raiz} className={estilos.modelo}>
      <span>{SEP.modo[modo]}</span>
      <span aria-hidden="true">·</span>
      <button
        ref={boton}
        type="button"
        className={estilos.infoBoton}
        aria-label={SEP.modoInfo}
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
      >
        <Icono icono={Info} tamano={16} />
      </button>
      {abierto && (
        <div id={id} role="group" aria-label={SEP.modo[modo]} className={estilos.popover}>
          <p>
            {modo === 'calidad'
              ? SEP.ayudaCalidad(dispositivo === 'cuda' ? SEP.dispositivoCuda : SEP.dispositivoCpu)
              : SEP.ayudaRapido}
          </p>
          {modo === 'rapido' && (
            <Boton variante="fantasma" onClick={alIrAjustes}>
              {SEP.irAjustes}
            </Boton>
          )}
        </div>
      )}
    </div>
  )
}
