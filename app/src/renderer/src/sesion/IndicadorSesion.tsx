import { useEffect, useRef, useState } from 'react'
import { Clock, ListMusic, MonitorPlay, Pause, Timer, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Icono } from '../componentes/Icono'
import { useNavegacion } from '../navegacion/estado'
import { datosIndicador, textoCuenta, type TipoIndicador } from './estadoSesion'
import { enfocarPanelColaCuandoEste } from './foco'
import { useSesion } from './ProveedorSesion'
import estilos from './sesion.module.css'
import { SES } from './textos'

const ICONOS: Record<TipoIndicador, LucideIcon> = {
  otraPantalla: MonitorPlay,
  pausa: Pause,
  cuenta: Timer,
  espera: Clock,
  atencion: TriangleAlert,
  cola: ListMusic
}

/** Milisegundos restantes de la cuenta, con un reloj local entre un estado y el siguiente. */
function useRestanteLocal(restanteMs: number, recibidoEn: number, activo: boolean): number {
  const [ahora, setAhora] = useState(recibidoEn)
  useEffect(() => {
    if (!activo) return
    const id = setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(id)
  }, [activo])
  return activo ? Math.max(0, restanteMs - Math.max(0, ahora - recibidoEn)) : restanteMs
}

/**
 * Indicador de sesión de la barra superior (spec 02, «Indicador de sesión»), a la izquierda del
 * de actividad. Visible con sesión, con cola o con una incidencia. El clic lleva a la Biblioteca
 * por su salida normal, abre el panel y pone el foco dentro; si el panel aún no existe, en el
 * botón «Cola».
 */
export function IndicadorSesion() {
  const { estado, recibidoEn, abrirPanel } = useSesion()
  const { vista, ir } = useNavegacion()
  const cancelarFoco = useRef<(() => void) | null>(null)
  const datos = datosIndicador(estado)
  const restante = useRestanteLocal(
    datos?.restanteMs ?? 0,
    recibidoEn,
    datos?.tipo === 'cuenta' && datos.congelada === false
  )
  useEffect(() => () => cancelarFoco.current?.(), [])

  if (!datos) return null
  const texto = datos.tipo === 'cuenta' ? textoCuenta(restante) : datos.texto
  const nombre =
    datos.tipo === 'cola' ? datos.aria : SES.ind.aria(datos.tipo === 'cuenta' ? texto : datos.aria)

  const alPulsar = () => {
    const abrir = () => {
      abrirPanel()
      cancelarFoco.current?.()
      cancelarFoco.current = enfocarPanelColaCuandoEste()
    }
    if (vista.tipo === 'biblioteca') abrir()
    else ir({ tipo: 'biblioteca' }, abrir)
  }

  return (
    <button
      type="button"
      className={`${estilos.indicador} ${datos.tipo === 'atencion' ? estilos.atencion : ''} ${datos.tipo === 'cola' ? estilos.sinSesion : ''}`}
      data-indicador-sesion={datos.tipo}
      aria-label={nombre}
      onClick={alPulsar}
    >
      <Icono icono={ICONOS[datos.tipo]} tamano={16} />
      <span aria-hidden="true">{texto}</span>
    </button>
  )
}
