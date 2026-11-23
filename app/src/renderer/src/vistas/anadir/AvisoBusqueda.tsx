import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { Icono } from '../../componentes/Icono'
import { TEXTO } from './textos'
import estilos from './anadir.module.css'

/** `config.preparacion.automatica` (activada por defecto); sin configuración legible, no se avisa. */
function useBusquedaAutomatica(): boolean {
  const [activa, setActiva] = useState(false)
  useEffect(() => {
    let activo = true
    const leer = (c: { preparacion?: { automatica?: boolean } }) =>
      activo && setActiva(c.preparacion?.automatica !== false)
    void Promise.resolve(window.shinobi.config?.obtener?.()).then(
      (c) => c && leer(c),
      () => undefined
    )
    const baja = window.shinobi.alCambiarConfig?.(leer)
    return () => {
      activo = false
      baja?.()
    }
  }, [])
  return activa
}

/**
 * `add.dato.lrclib` (spec 03 · F6-N8): avisa de que al continuar se buscará la letra en LRCLIB y deja
 * cambiarlo. Solo con «Buscar la letra automáticamente» activado.
 */
export function AvisoBusqueda({ alCambiar }: { alCambiar: () => void }) {
  const activa = useBusquedaAutomatica()
  if (!activa) return null
  return (
    <p className={estilos.ayuda} data-aviso-busqueda>
      <Icono icono={Info} tamano={16} /> {TEXTO.busquedaLrclib}{' '}
      <button type="button" className={estilos.enlace} onClick={alCambiar}>
        {TEXTO.cambiarEnAjustes}
      </button>
    </p>
  )
}
