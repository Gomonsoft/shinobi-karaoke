export interface MapaFuentes {
  sources?: string[]
}

export interface InfoLicencia {
  licenses?: string | string[]
  licenseText?: string
  copyright?: string
  repository?: string
  url?: string
}

export function paquetesDeMapas(mapas: MapaFuentes[]): Set<string>
export function paquetesDeArbolNpm(arbol: {
  dependencies?: Record<string, { dependencies?: Record<string, unknown> }>
}): Set<string>
export function paquetesDistribuidos(
  mapas: MapaFuentes[],
  arbolNpm: Parameters<typeof paquetesDeArbolNpm>[0]
): string[]
export function generarBloque(opciones: {
  paquetes: string[]
  inventario: Record<string, InfoLicencia>
}): string
export function reemplazarBloque(contenido: string, bloque: string): string
