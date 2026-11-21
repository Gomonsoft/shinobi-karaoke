import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { Boton } from '../../../componentes/Boton'
import { BotonIcono } from '../../../componentes/BotonIcono'
import { useSesion } from '../../../sesion/ProveedorSesion'
import { SES } from '../../../sesion/textos'
import { interrumpidaDe } from '../sesion/empieza'
import estilos from './panelCola.module.css'

/** Espera de [Esperar] antes de volver a avisar de que la secundaria sigue sin responder. */
export const ESPERA_SIN_RESPUESTA_MS = 10_000

const sinAccion = (): void => undefined

/** Clave de la incidencia vigente: al cambiar, un aviso cerrado vuelve a mostrarse. */
export function claveIncidencia(estado: ReturnType<typeof useSesion>['estado']): string | null {
  const dentro = estado?.sesion?.incidencia
  if (dentro) {
    return dentro.tipo === 'pantalla_perdida'
      ? `perdida:${dentro.etiqueta}`
      : dentro.tipo === 'pantalla_reconectada'
        ? `vuelve:${dentro.etiqueta}`
        : 'sin_respuesta'
  }
  return estado?.incidencia?.tipo === 'secundaria_caida' ? 'caida' : null
}

/**
 * Banners de recuperación del panel (spec 02, «Recuperación»): pantalla perdida o de vuelta, caída
 * del reproductor y reproductor sin respuesta. En Wayland no hay banners de pantalla.
 */
export function BannersRecuperacion() {
  const { estado, pantallas, acciones, abrirDialogoPantallas } = useSesion()
  const clave = claveIncidencia(estado)
  const [cerrado, setCerrado] = useState<string | null>(null)
  // [Esperar]: oculta el aviso de «no responde» y lo devuelve a los 10 s si sigue igual.
  const [esperando, setEsperando] = useState<string | null>(null)

  useEffect(() => {
    if (esperando === null) return
    const id = setTimeout(() => setEsperando(null), ESPERA_SIN_RESPUESTA_MS)
    return () => clearTimeout(id)
  }, [esperando])

  if (clave === null || cerrado === clave) return null
  const wayland = pantallas?.colocacion === 'sistema'
  const dentro = estado?.sesion?.incidencia ?? null
  const cierre = <BotonIcono icono={X} etiqueta="Cerrar aviso" onClick={() => setCerrado(clave)} />

  if (dentro?.tipo === 'pantalla_perdida') {
    if (wayland) return null
    const nueva = estado?.sesion?.pantalla?.etiqueta ?? ''
    return (
      <div className={estilos.banners}>
        <AvisoEnLinea
          tipo="aviso"
          accion={
            <Boton onClick={() => abrirDialogoPantallas({ inicio: 'mover' })}>{SES.mover}</Boton>
          }
        >
          {SES.rec.monitor(dentro.etiqueta, nueva)}
        </AvisoEnLinea>
      </div>
    )
  }
  if (dentro?.tipo === 'pantalla_reconectada') {
    if (wayland) return null
    const destino = dentro.pantallaId
    return (
      <div className={estilos.banners}>
        <AvisoEnLinea
          tipo="info"
          accion={
            <span className={estilos.bannerAcciones}>
              <Boton onClick={() => void acciones.moverAPantalla(destino).catch(sinAccion)}>
                {SES.rec.llevar}
              </Boton>
              {cierre}
            </span>
          }
        >
          {SES.rec.vuelve(dentro.etiqueta)}
        </AvisoEnLinea>
      </div>
    )
  }
  if (dentro?.tipo === 'secundaria_no_responde') {
    if (esperando === clave) return null
    return (
      <div className={estilos.banners}>
        <AvisoEnLinea
          tipo="aviso"
          accion={
            <span className={estilos.bannerAcciones}>
              <Boton onClick={() => setEsperando(clave)}>{SES.rec.esperar}</Boton>
              <Boton
                onClick={() =>
                  void acciones
                    .forzarCierre()
                    .then(() => abrirDialogoPantallas({ inicio: 'reanudar' }))
                    .catch(sinAccion)
                }
              >
                {SES.rec.cerrarYAbrir}
              </Boton>
            </span>
          }
        >
          {SES.rec.noResponde}
        </AvisoEnLinea>
      </div>
    )
  }
  if (estado?.incidencia?.tipo === 'secundaria_caida') {
    return (
      <div className={estilos.banners}>
        <AvisoEnLinea
          tipo="error"
          accion={
            <span className={estilos.bannerAcciones}>
              <Boton onClick={() => abrirDialogoPantallas({ inicio: 'reanudar' })}>
                {SES.rec.volverAbrir}
              </Boton>
              {cierre}
            </span>
          }
        >
          {SES.rec.caida(interrumpidaDe(estado))}
        </AvisoEnLinea>
      </div>
    )
  }
  return null
}
