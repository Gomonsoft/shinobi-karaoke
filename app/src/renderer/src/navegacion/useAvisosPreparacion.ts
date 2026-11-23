import { useEffect, useRef } from 'react'
import { mostrarToast } from '../componentes/gestorToasts'
import { useSesion } from '../sesion/ProveedorSesion'
import { BIB_PREP } from '../vistas/biblioteca/textosPreparacion'
import { PREP } from '../vistas/progreso/textosPreparacion'
import type { Vista } from './estado'
import { estaEnSuProgreso } from './useAvisosTrabajos'

/**
 * Toast del resultado de la preparación de **una** canción (docs/ux/04 · Feature 5): `prog.toast.revisar`,
 * `.elige` o `.sinLetra`, con su acción. «Letra pendiente» no da toast. Dentro de una tanda de varias
 * canciones no hay toasts por canción (hay un resumen). Se detecta al pasar el estado derivado del
 * resumen de «preparando» a un resultado.
 */
export function useAvisosPreparacion(vista: Vista, ir: (v: Vista) => void): void {
  const vistaRef = useRef(vista)
  const irRef = useRef(ir)
  const sesion = useSesion()
  const sesionRef = useRef(sesion)
  useEffect(() => {
    vistaRef.current = vista
    irRef.current = ir
    sesionRef.current = sesion
  })

  useEffect(() => {
    const previos = new Map<string, string | null | undefined>()
    const baja = window.shinobi.alCambiarCancion((ev) => {
      if (ev.eliminada) {
        previos.delete(ev.id)
        return
      }
      const antes = previos.get(ev.id)
      const ahora = ev.resumen.estadoPreparacion
      previos.set(ev.id, ahora)
      if (antes !== 'preparando') return
      const tipo =
        ahora === 'lista_para_revisar'
          ? 'revisar'
          : ahora === 'elige_letra'
            ? 'elige'
            : ahora === 'sin_letra' || ahora === 'instrumental'
              ? 'sinLetra'
              : null
      if (!tipo || vistaRef.current.tipo === 'primer-arranque') return
      if (estaEnSuProgreso(vistaRef.current, ev.id)) return
      const titulo = ev.resumen.titulo
      void Promise.resolve(window.shinobi.preparacion?.tanda?.()).then(
        (tanda) => {
          // Una tanda de 2 o más canciones tiene su resumen: nada por canción.
          if (tanda && tanda.canciones.length >= 2) return
          mostrarToast({
            tipo: 'exito',
            mensaje: PREP.toast[tipo](titulo),
            accion: {
              etiqueta:
                tipo === 'revisar'
                  ? BIB_PREP.accion.revisar
                  : tipo === 'elige'
                    ? BIB_PREP.accion.elegirLetra
                    : BIB_PREP.accion.anadirLetra,
              alAccionar: () => {
                const editor = tipo === 'revisar'
                if (editor && sesionRef.current.edicionBloqueada) {
                  sesionRef.current.abrirBloqueo()
                  return
                }
                irRef.current({
                  tipo: 'cancion',
                  id: ev.id,
                  paso: editor ? 'editor' : 'letra',
                  // «Revisar» de un toast abre el recorrido de revisión (spec 06, F11-E11).
                  ...(editor ? { revisar: true } : {})
                })
              }
            }
          })
        },
        () => undefined
      )
    })
    return baja
  }, [])
}
