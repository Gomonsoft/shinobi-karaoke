export interface DatosCompilacion {
  canal: 'publicada' | 'desarrollo' | 'local'
  numero: number | null
  commit: string | null
}

export function contar(opciones?: { cwd?: string }): { numero: number; commit: string }
export function datosCompilacion(opciones?: {
  env?: Record<string, string | undefined>
  git?: () => string
}): DatosCompilacion

export interface Decision {
  desarrollo: 'publicar' | 'ensayo' | 'omitir'
  construir: boolean
  canal_app: 'publicada' | 'desarrollo'
  motivo: string
}
export interface EstadoCanal {
  configurado: boolean
  compilado: boolean
  faltas: string[]
}
export function decidir(opciones: {
  evento: string
  ref: string
  configurado?: boolean
  compilado?: boolean
  faltas?: string[]
  sha?: string
}): Decision
export function consultarCanal(opciones: {
  repo: string
  hayToken: boolean
  sha: string
  gh: (ruta: string) => number
}): EstadoCanal
export function resolverDecision(opciones: {
  evento: string
  ref: string
  sha: string
  repo: string
  hayToken: boolean
  gh: (ruta: string) => number
}): Decision & { configurado: boolean }
