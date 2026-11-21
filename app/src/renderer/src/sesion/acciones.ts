import type { ApiShinobi } from '@shared/ipc'
import type { AbrirSesion, DondeAgregar, EstadoSesionIpc } from '@shared/sesion'

type Aplicar = (estado: EstadoSesionIpc) => void

/**
 * Acciones finas sobre `window.shinobi.sesion` y `cola`. Cada una pasa el estado de la respuesta
 * por `aplicar` (que descarta las revisiones viejas) y devuelve lo que la vista necesite.
 * Los errores se propagan: cada vista decide cómo contarlos.
 */
export function crearAcciones(api: () => ApiShinobi, aplicar: Aplicar) {
  const estado = async (promesa: Promise<EstadoSesionIpc>): Promise<EstadoSesionIpc> => {
    const e = await promesa
    aplicar(e)
    return e
  }
  return {
    abrir: (peticion: AbrirSesion) => estado(api().sesion.abrir(peticion)),
    mostrar: () => api().sesion.mostrar(),
    moverAPantalla: (pantallaId: number) => estado(api().sesion.moverAPantalla(pantallaId)),
    fijarPantallaCompleta: (activa: boolean) => api().sesion.fijarPantallaCompleta(activa),
    transporte: (accion: 'pausar' | 'reanudar' | 'reiniciar', entradaId: string) =>
      estado(api().sesion.transporte(accion, entradaId)),
    siguiente: (desdeEntradaId: string) => estado(api().sesion.siguiente(desdeEntradaId)),
    empezar: (candidataId: string) => estado(api().sesion.empezar(candidataId)),
    detenerTransicion: (transicionId: string) =>
      estado(api().sesion.detenerTransicion(transicionId)),
    repetir: (entradaId: string) => estado(api().sesion.repetir(entradaId)),
    forzarCierre: () => estado(api().sesion.forzarCierre()),
    solicitarCierre: () => estado(api().sesion.solicitarCierre()),
    confirmarCierre: (cola: 'eliminar' | 'conservar', revision: number) =>
      api().sesion.confirmarCierre(cola, revision),
    cancelarCierre: () => api().sesion.cancelarCierre(),
    cola: {
      agregar: async (cancionId: string, donde: DondeAgregar) => {
        const r = await api().cola.agregar(cancionId, donde)
        aplicar(r.estado)
        return r
      },
      mover: (entradaId: string, antesDe: string | null) =>
        estado(api().cola.mover(entradaId, antesDe)),
      quitar: async (entradaId: string) => {
        const r = await api().cola.quitar(entradaId)
        aplicar(r.estado)
        return r
      },
      vaciar: (contexto: boolean) => estado(api().cola.vaciar(contexto))
    }
  }
}

export type AccionesSesion = ReturnType<typeof crearAcciones>
