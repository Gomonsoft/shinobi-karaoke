import { useState } from 'react'
import { Music } from 'lucide-react'
import { Icono } from '../../componentes/Icono'
import estilos from './anadir.module.css'

/**
 * Miniatura 160 x 90. Sin URL o si la imagen no carga: marcador C2 (fondo-2, icono `Music` de
 * 32 px, sin texto ni aviso; docs/ux/03 criterio 16).
 */
export function Miniatura({ url }: { url: string | null }) {
  const [fallo, setFallo] = useState(false)
  if (!url || fallo) {
    return (
      <span className={estilos.marcador} aria-hidden="true" data-testid="miniatura-vacia">
        <Icono icono={Music} tamano={32} />
      </span>
    )
  }
  return <img className={estilos.miniatura} src={url} alt="" onError={() => setFallo(true)} />
}
