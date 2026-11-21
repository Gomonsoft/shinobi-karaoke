import { useCallback, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Icono } from '../componentes/Icono'
import { useSesion } from './ProveedorSesion'
import estilos from './sesion.module.css'
import { EDI_BLOQUEO } from './textos'

/** Icono `lock` de 14 px junto al texto de un elemento bloqueado (sistema visual, fase 4). */
export function Candado(): ReactNode {
  return <Icono icono={Lock} tamano={14} className={estilos.candado} />
}

export interface AccionBloqueable {
  bloqueada: boolean
  /** `<Candado />` si la acción está bloqueada; `null` si no. */
  candado: ReactNode
  /**
   * Atributos del elemento: con bloqueo, `aria-disabled` y el nombre accesible con
   * `edi.bloqueo.aria` añadido. Sin bloqueo no añade nada (`nombre` no se toca).
   */
  atributos(nombre: string): { 'aria-disabled'?: true; 'aria-label'?: string }
  /**
   * Ejecuta `accion`, o abre el diálogo `edi.bloqueo` si hay sesión. El elemento sigue
   * enfocable y el foco vuelve a él al cerrar el diálogo.
   */
  intentar(accion: () => void): void
}

/**
 * Acciones que abren Letra o Editor (spec 06, «Puntos de entrada bloqueados»). El elemento queda
 * `aria-disabled` con candado pero sigue enfocable: al pulsarlo se explica por qué.
 */
export function useAccionBloqueable(): AccionBloqueable {
  const { edicionBloqueada, abrirBloqueo } = useSesion()
  const intentar = useCallback(
    (accion: () => void) => {
      if (edicionBloqueada) abrirBloqueo()
      else accion()
    },
    [edicionBloqueada, abrirBloqueo]
  )
  return {
    bloqueada: edicionBloqueada,
    candado: edicionBloqueada ? <Candado /> : null,
    atributos: (nombre) =>
      edicionBloqueada
        ? { 'aria-disabled': true, 'aria-label': `${nombre}${EDI_BLOQUEO.aria}` }
        : {},
    intentar
  }
}
