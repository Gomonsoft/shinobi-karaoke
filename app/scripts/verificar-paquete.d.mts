export type WireFuses = Record<string, number | string>

export interface InformePaquete {
  plataforma: 'darwin' | 'win32' | 'linux'
  tamano_desempaquetado: number
  fuses: Record<string, boolean>
  comprobaciones: string[]
}

export interface IconosExe {
  grupos: number
  imagenes: string[]
}

export interface OpcionesVerificacion {
  entrada: string
  plataforma?: 'darwin' | 'win32' | 'linux'
  leerFuses?: (ruta: string) => Promise<WireFuses> | WireFuses
  listarAsar?: (ruta: string, opciones: { isPack: false }) => string[]
  leerAsar?: (ruta: string, archivo: string) => Buffer
  comprobarEjecutable?: (ruta: string, plataforma: 'darwin' | 'win32' | 'linux') => boolean
  leerIconos?: (ruta: string) => IconosExe
  ejecutar?: (comando: string, argumentos: string[]) => string
}

export function verificarPaquete(opciones: OpcionesVerificacion): Promise<InformePaquete>
export const FUSES_ESPERADOS: Readonly<Record<string, boolean>>
export const ENTRADAS_PROHIBIDAS: readonly string[]
export function iconosDelExe(contenido: Buffer): IconosExe
export function comprobarIconoExe(propio: IconosExe, electron: IconosExe): void
