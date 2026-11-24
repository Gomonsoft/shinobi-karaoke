import type { Cancion, Catalogo } from '../../shared'
import type { ResumenCancion } from '../biblioteca/resumen'
import type { PuertoCanciones } from '../temas'
import type { ConfigParcial } from '../configuracion'
import type { Config } from '../../shared'

/** Lo que usa `ServicioCopias` de la biblioteca (`ServicioBiblioteca` lo cumple). */
export interface BibliotecaCopias {
  listar(): ResumenCancion[]
  obtener(id: string): Cancion | null
  obtenerResumen(id: string): ResumenCancion | null
  /** Indexa una carpeta de canción ya materializada en `biblioteca/<id>/`. */
  incorporar(id: string, cancion: Cancion): Promise<ResumenCancion>
  puerto(): PuertoCanciones
  /** Mueve la canción a la papelera del sistema. */
  eliminar(id: string): Promise<void>
}

/** Lo que usa de `ServicioTemas` (único escritor de `temas.json`). */
export interface TemasCopias {
  /** `null` si el catálogo es de un esquema más nuevo (solo lectura). */
  datos(): Readonly<Catalogo> | null
  enCola<T>(tarea: () => Promise<T> | T): Promise<T>
  confirmarCatalogo(nuevo: Catalogo): Promise<void>
}

export interface ConfigCopias {
  obtener(): Config
  actualizar(parcial: ConfigParcial): Promise<Config>
}

export interface PuertosCopias {
  /** `<datos>/biblioteca`. */
  dirBiblioteca: string
  biblioteca: BibliotecaCopias
  /** Ausente: sin catálogo (las canciones entran con su apariencia guardada). */
  temas?: TemasCopias | undefined
  config: ConfigCopias
  libreBytes(carpeta: string): Promise<number | null>
  /** `false` si la canción suena en una sesión: «Sustituir» no se aplica a esa. */
  puedeSustituir?(id: string): boolean
  version: string
  ahora?: () => Date
  uuid?: () => string
  registrar?(nivel: 'aviso' | 'error', mensaje: string): void
}

/** Progreso que cada operación comunica al servicio (que lo reparte con un máximo de 4 por segundo). */
export interface Avance {
  /** Bytes que se prevé procesar en total (para la fracción). */
  total(n: number): void
  /** Bytes procesados desde el principio. */
  bytes(n: number): void
  /** Canción en curso: `{hechas}` de `{total}`. */
  cancion(hechas: number, total: number, titulo: string): void
}
