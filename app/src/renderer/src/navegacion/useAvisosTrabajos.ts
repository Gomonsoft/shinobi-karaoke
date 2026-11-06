import { useEffect, useRef } from 'react'
import type { AbrirCancionIpc, AvisoTrabajoIpc } from '@shared/avisos'
import { mostrarToast } from '../componentes/gestorToasts'
import type { Vista } from './estado'

/** El usuario ya está viendo el progreso de esa canción: no hace falta avisarle (0072). */
export function estaEnSuProgreso(vista: Vista, cancionId: string): boolean {
  return vista.tipo === 'cancion' && vista.paso === 'progreso' && vista.id === cancionId
}

/**
 * Avisos de trabajos terminados o fallidos (docs/ux/04 §3). Main envía el aviso con su texto; aquí
 * se muestra el toast salvo en la vista de progreso de esa canción. Con la ventana sin foco se
 * guardan y se muestran al recuperarlo. El error queda hasta que el usuario lo cierre.
 */
export function useAvisosTrabajos(vista: Vista, ir: (v: Vista) => void): void {
  const vistaRef = useRef(vista)
  const irRef = useRef(ir)

  // Las referencias se actualizan tras cada render: los oyentes siempre ven la vista actual.
  useEffect(() => {
    vistaRef.current = vista
    irRef.current = ir
  })

  useEffect(() => {
    let pendientes: AvisoTrabajoIpc[] = []
    const abrirCancion = (e: AbrirCancionIpc): void => {
      if (vistaRef.current.tipo === 'primer-arranque') return
      irRef.current({
        tipo: 'cancion',
        id: e.cancionId,
        paso: e.destino === 'editor' ? 'editor' : 'progreso'
      })
    }
    const mostrar = (a: AvisoTrabajoIpc): void => {
      if (vistaRef.current.tipo === 'primer-arranque') return
      if (estaEnSuProgreso(vistaRef.current, a.cancionId)) return
      mostrarToast({
        tipo: a.tipo === 'error' ? 'error' : 'exito',
        mensaje: a.texto,
        accion: {
          etiqueta: a.etiqueta,
          alAccionar: () => abrirCancion(a)
        }
      })
    }
    const alAviso = (a: AvisoTrabajoIpc): void => {
      if (document.hasFocus()) mostrar(a)
      else pendientes.push(a)
    }
    const alFoco = (): void => {
      const lista = pendientes
      pendientes = []
      lista.forEach(mostrar)
    }
    const bajaAviso = window.shinobi.avisos.alAviso(alAviso)
    const bajaAbrir = window.shinobi.avisos.alAbrirCancion(abrirCancion)
    window.addEventListener('focus', alFoco)
    return () => {
      bajaAviso()
      bajaAbrir()
      window.removeEventListener('focus', alFoco)
    }
  }, [])
}
