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
export function prepararPublicacion(opciones: {
  entrada: string
  salida: string
  raiz: string
  version: string
  etiqueta: string
  previa: boolean
  ensayo?: boolean
}): {
  datos: { version: string; etiqueta: string; previa: boolean; generar_notas: boolean }
  resumen: string
}
