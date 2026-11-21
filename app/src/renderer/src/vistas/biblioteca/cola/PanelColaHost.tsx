import { useEffect, useRef, useState } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { useSesion } from '../../../sesion/ProveedorSesion'
import { COLA } from '../../../sesion/textos'
import { claveIncidencia } from './BannersRecuperacion'
import { PanelCola } from './PanelCola'
import estilos from './panelCola.module.css'

/**
 * Monta el panel cuando está abierto y decide cuándo se abre solo (spec 02): al empezar una
 * sesión, al volver con una cola conservada y ante una incidencia (sin mover el foco). Siempre
 * montado en la Biblioteca: lleva la región `aria-live` de los anuncios del panel.
 */
export function PanelColaHost({ canciones }: { canciones: readonly ResumenCancionIpc[] }) {
  const { estado, haySesion, panelAbierto, abrirPanel } = useSesion()
  const hubo = useRef(false)
  const clave = claveIncidencia(estado)
  const claveVista = useRef<string | null>(null)
  const activaVista = useRef<string | null>(null)
  const [anuncio, setAnuncio] = useState('')

  const hayCola = (estado?.pendientes.length ?? 0) > 0 || estado?.contexto != null
  useEffect(() => {
    if (haySesion && !hubo.current) abrirPanel()
    // Sesión cerrada con cola conservada: el panel vuelve a abrirse (P5).
    if (!haySesion && hubo.current && hayCola) abrirPanel()
    hubo.current = haySesion
  }, [haySesion, hayCola, abrirPanel])

  useEffect(() => {
    if (clave !== null && clave !== claveVista.current) abrirPanel()
    claveVista.current = clave
  }, [clave, abrirPanel])

  // Hito: empieza una entrada (nunca cada segundo de la cuenta ni del progreso).
  const activa = estado?.activa ?? null
  const idActiva = haySesion ? (activa?.entradaId ?? null) : null
  useEffect(() => {
    if (idActiva !== null && idActiva !== activaVista.current && activa) {
      setAnuncio(COLA.anuncio.empieza(activa.titulo, activa.artista))
    }
    activaVista.current = idActiva
  }, [idActiva, activa])

  return (
    <>
      <p aria-live="polite" className={estilos.soloLector}>
        {anuncio}
      </p>
      {panelAbierto && <PanelCola canciones={canciones} />}
    </>
  )
}
