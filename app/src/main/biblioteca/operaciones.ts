import type { Cancion, CodigoError, Estilo, Letra, Pasos } from '../../shared'
import type { ResumenCancion } from './resumen'

/** Error de una operación de escritura de la biblioteca, con código estable. */
export class ErrorBiblioteca extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string
  ) {
    super(mensaje)
    this.name = 'ErrorBiblioteca'
  }
}

/** Datos para crear una canción (el servicio rellena id, fechas, estado y estilo). */
export interface DatosNuevaCancion {
  metadatos: Cancion['metadatos']
  fuente: Cancion['fuente']
  pistas?: Cancion['pistas']
  letra?: Letra | null
  /** Por defecto todos `pendiente`; lo indicado sustituye al paso entero. */
  pasos?: Partial<Pasos>
}

/** Cambio parcial tipado. No admite `id`, `creada`, `modificada` ni `estado`. */
export interface CambioCancion {
  metadatos?: Partial<Cancion['metadatos']>
  fuente?: Partial<Cancion['fuente']>
  pistas?: Cancion['pistas']
  letra?: Letra | null
  estilo?: Estilo
  /** Por paso, se fusionan los campos indicados. */
  pasos?: { [P in keyof Pasos]?: Partial<Pasos[P]> }
}

export interface OpcionesActualizar {
  /** Espera para agrupar escrituras seguidas (ADR 0006: ~1000 para el editor). */
  debounceMs?: number
}

export type EventoCancion =
  { id: string; resumen: ResumenCancion; eliminada?: false } | { id: string; eliminada: true }

export interface ImportacionPreparada {
  id: string
  ruta: string
}

/** Subconjunto de `electron.shell` que usa el servicio (inyectable). */
export interface ShellBiblioteca {
  trashItem(ruta: string): Promise<void>
  /** Devuelve '' si todo fue bien, o un mensaje de error (como Electron). */
  openPath(ruta: string): Promise<string>
}
