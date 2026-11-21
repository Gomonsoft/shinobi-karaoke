import { COMPILACION_LOCAL, compilacionSchema, type Compilacion } from '../shared/compilacion'

/** Inyectada por electron-vite al compilar (`define`). Sin definir (pruebas, `dev`) es local. */
declare const __SHINOBI_COMPILACION__: unknown

export function leerCompilacion(valor: unknown): Compilacion {
  const r = compilacionSchema.safeParse(valor)
  return r.success ? r.data : COMPILACION_LOCAL
}

export const COMPILACION: Compilacion = leerCompilacion(
  typeof __SHINOBI_COMPILACION__ === 'undefined' ? undefined : __SHINOBI_COMPILACION__
)
