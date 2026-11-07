export interface BinarioUv {
  archivo: string
  sha256: string
}

export interface ManifiestoUv {
  version: string
  binarios: Record<string, BinarioUv>
}

export interface OpcionesDescargarUv {
  plataforma?: NodeJS.Platform
  arquitectura?: string
  raizApp?: string
  manifiesto?: ManifiestoUv
  fetchImpl?: (url: string) => Promise<{
    ok: boolean
    status: number
    statusText: string
    arrayBuffer(): Promise<ArrayBuffer>
  }>
  ejecutarComando?: (comando: string, argumentos: string[], opciones?: { cwd?: string }) => string
  extraer?: (
    archivo: string,
    directorio: string,
    rutaInterna: string,
    ejecutar: (comando: string, argumentos: string[], opciones?: { cwd?: string }) => string
  ) => void | Promise<void>
}

export function clavePlataforma(plataforma: string, arquitectura: string): string | null
export function esVersionEsperada(salida: string, version: string): boolean
export function descargarUv(
  opciones?: OpcionesDescargarUv
): Promise<{ ruta: string; version: string; descargado: boolean }>
