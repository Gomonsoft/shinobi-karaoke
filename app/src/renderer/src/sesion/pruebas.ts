import type { EstadoSesionIpc, ListaPantallasIpc, PosicionSesionIpc } from '@shared/sesion'

/**
 * Doble de la parte de sesión de `window.shinobi` para las pruebas del renderer (0183 en
 * adelante): estado inicial, llamadas registradas y emisores de eventos. Usa los estados de
 * `@shared/__fixtures__/sesion` (P1–P6).
 */
export interface ApiSesionFalsa {
  /** Llamadas recibidas, como `[método, ...argumentos]`. */
  llamadas: unknown[][]
  emitirEstado(estado: EstadoSesionIpc): void
  emitirPosicion(posicion: PosicionSesionIpc): void
  emitirPantallas(lista: ListaPantallasIpc): void
}

const UNA_PANTALLA: ListaPantallasIpc = { pantallas: [], colocacion: 'libre' }

/**
 * Añade la API de sesión a `window.shinobi` (que debe existir). `estadoActual` se actualiza con
 * cada `emitirEstado`; las acciones devuelven el estado vigente.
 */
export function instalarApiSesion(
  inicial: EstadoSesionIpc,
  pantallas: ListaPantallasIpc = UNA_PANTALLA
): ApiSesionFalsa {
  const llamadas: unknown[][] = []
  let actual = inicial
  const estados = new Set<(e: EstadoSesionIpc) => void>()
  const posiciones = new Set<(p: PosicionSesionIpc) => void>()
  const listas = new Set<(l: ListaPantallasIpc) => void>()
  const suscribir =
    <T>(conjunto: Set<(v: T) => void>) =>
    (cb: (v: T) => void): (() => void) => {
      conjunto.add(cb)
      return () => {
        conjunto.delete(cb)
      }
    }
  const registrar =
    (nombre: string, resultado: () => unknown = () => actual) =>
    (...args: unknown[]) => {
      llamadas.push([nombre, ...args])
      return Promise.resolve(resultado())
    }

  Object.assign(window.shinobi, {
    sesion: {
      estado: registrar('sesion.estado'),
      abrir: registrar('sesion.abrir'),
      mostrar: registrar('sesion.mostrar', () => undefined),
      moverAPantalla: registrar('sesion.moverAPantalla'),
      fijarPantallaCompleta: registrar('sesion.fijarPantallaCompleta', () => undefined),
      transporte: registrar('sesion.transporte'),
      siguiente: registrar('sesion.siguiente'),
      empezar: registrar('sesion.empezar'),
      detenerTransicion: registrar('sesion.detenerTransicion'),
      repetir: registrar('sesion.repetir'),
      forzarCierre: registrar('sesion.forzarCierre'),
      solicitarCierre: registrar('sesion.solicitarCierre'),
      confirmarCierre: registrar('sesion.confirmarCierre', () => undefined),
      cancelarCierre: registrar('sesion.cancelarCierre', () => undefined)
    },
    cola: {
      agregar: registrar('cola.agregar', () => ({ estado: actual, entradaId: 'nueva' })),
      mover: registrar('cola.mover'),
      quitar: registrar('cola.quitar', () => ({ estado: actual, antesDe: null })),
      vaciar: registrar('cola.vaciar')
    },
    pantallas: { listar: registrar('pantallas.listar', () => pantallas) },
    alCambiarSesion: suscribir(estados),
    alPosicionSesion: suscribir(posiciones),
    alCambiarPantallas: suscribir(listas)
  })

  return {
    llamadas,
    emitirEstado: (e) => {
      actual = e
      estados.forEach((cb) => cb(e))
    },
    emitirPosicion: (p) => posiciones.forEach((cb) => cb(p)),
    emitirPantallas: (l) => listas.forEach((cb) => cb(l))
  }
}
