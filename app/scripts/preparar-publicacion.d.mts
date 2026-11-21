export const INSTALADORES: readonly string[]
export function sha256(ruta: string): string
export function verificarInstaladores(carpeta: string): void
export function generarSumas(carpeta: string): string
export function componerNotas(opciones: {
  aviso: string
  cabecera: string
  notas: string
  previa: boolean
}): string
export function rutaNotas(raiz: string, version: string): string
export function resolver(plantilla: string, valores: Record<string, string>, nombre: string): string
export function revisarNotasAMano(opciones: {
  existe: boolean
  texto: string
  ensayo?: boolean
}): string[]
export function leerQueCambio(texto: string): {
  separador: string
  encabezado: string
  quitar: string[]
  sustituciones: { buscar: string; poner: string }[]
  todosLosCambios: string
  compilacion: string
  sinPr: string
  primeraVersion: string
}
export function componerPie(opciones: {
  plantilla: string
  compilacion: string
  sha: string
  ejecucion: string
}): string
export function prepararPublicacion(opciones: {
  entrada: string
  salida: string
  raiz: string
  version: string
  etiqueta: string
  previa: boolean
  ensayo?: boolean
  compilacion?: string
  sha?: string
  ejecucion?: string
}): {
  datos: { version: string; etiqueta: string; previa: boolean }
  resumen: string
}
export function nombreDesarrollo(nombre: string, compilacion: string): string
export function fechaLarga(fecha: Date): string
export function tamanoMB(bytes: number): string
export function componerCuerpoDesarrollo(opciones: {
  plantilla: string
  compilacion: string
  sha: string
  anterior: string
  ejecucion: string
  fecha: Date
  archivos: Record<string, { nombre: string; bytes: number; sha256: string }>
}): string
export function prepararDesarrollo(opciones: {
  entrada: string
  salida: string
  raiz: string
  version: string
  compilacion: string
  sha: string
  anterior?: string
  ejecucion: string
  fecha?: Date
}): {
  datos: {
    etiqueta: string
    titulo: string
    version: string
    sha: string
    archivos: string[]
  }
  resumen: string
}
