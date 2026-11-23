import { useEffect, useState } from 'react'
import estilos from './biblioteca.module.css'

/** `bib.arrastrar.soltarVarios` (docs/ux/02 · 0.2.2 · Feature 7). */
export const SOLTAR_VARIOS = {
  n: (n: number): string => `Suelta para añadir ${n} canciones`,
  carpeta: 'Suelta para añadir las canciones de la carpeta',
  /** `paq.arrastrar.soltar` (docs/ux/02 · 0323): un `.shinobi` suelto. */
  paquete: 'Suelta para importar el paquete',
  /** `bib.arrastrar.soltarNeutro`: no se sabe qué se arrastra. */
  neutro: 'Suelta para añadir'
} as const

const traeArchivos = (e: DragEvent): boolean =>
  Array.from(e.dataTransfer?.types ?? []).includes('Files')

/** Texto del velo para lo que se arrastra; `null` con un solo archivo (no hay velo). */
export function textoDelVelo(e: DragEvent): string | null {
  const items = Array.from(e.dataTransfer?.items ?? []).filter((i) => i.kind === 'file')
  const carpeta = items.some((i) => i.webkitGetAsEntry?.()?.isDirectory === true)
  if (carpeta) return SOLTAR_VARIOS.carpeta
  if (items.length > 1) return SOLTAR_VARIOS.n(items.length)
  // Un solo archivo: el sistema no suele dar su nombre al entrar (solo el tipo). Con nombre: `.shinobi` → paquete.
  // Con un tipo conocido (audio, video) no hay velo, como siempre. Si no se sabe qué es (sin nombre ni tipo), el
  // texto neutro: nunca uno que pueda ser falso; al soltar, la app decide por la extensión real.
  const item = items[0]
  if (!item) return null
  const nombre = item.getAsFile?.()?.name
  if (nombre) return /\.shinobi$/i.test(nombre) ? SOLTAR_VARIOS.paquete : null
  return item.type === '' ? SOLTAR_VARIOS.neutro : null
}

/**
 * Velo de la ventana al arrastrar varios archivos o una carpeta sobre la Biblioteca. Se quita al salir de la
 * ventana o al soltar; no captura eventos (la suelta la atiende `useArrastrarArchivo`).
 */
export function VeloArrastre() {
  const [texto, setTexto] = useState<string | null>(null)
  useEffect(() => {
    let profundidad = 0
    const entrar = (e: DragEvent) => {
      if (!traeArchivos(e)) return
      profundidad++
      setTexto(textoDelVelo(e))
    }
    const salir = () => {
      profundidad = Math.max(0, profundidad - 1)
      if (profundidad === 0) setTexto(null)
    }
    const soltar = () => {
      profundidad = 0
      setTexto(null)
    }
    window.addEventListener('dragenter', entrar)
    window.addEventListener('dragleave', salir)
    window.addEventListener('drop', soltar)
    return () => {
      window.removeEventListener('dragenter', entrar)
      window.removeEventListener('dragleave', salir)
      window.removeEventListener('drop', soltar)
    }
  }, [])
  if (!texto) return null
  return (
    <div className={estilos.veloArrastre} role="status" data-velo-arrastre>
      <p>{texto}</p>
    </div>
  )
}
