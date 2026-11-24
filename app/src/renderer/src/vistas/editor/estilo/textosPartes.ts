import type { Letra } from '@shared/letra'
import { cantantesDe, RANURAS, type Parte } from '@shared/reparto'

/** Textos de «Colores de los cantantes» y de sus avisos (spec 06 · 0.2.3, claves `edi.estiloPartes.*` y `edi.contraste.*`). */
export const T_PARTES = {
  titulo: 'Colores de los cantantes',
  c1: '= Color de lo ya cantado',
  c1Aria: 'Ir a «Color de lo ya cantado»',
  mas: (lista: string): string => `Más colores (${lista})`,
  plegado: 'Colores para dúos y coros (esta canción no los usa)',
  mostrar: 'Mostrar',
  color: (nombre: string): string => `Color de ${nombre}`,
  contraste: {
    parte: (parte: string): string => `El color de ${parte} apenas se ve sobre el fondo.`,
    parteLetra: (parte: string): string =>
      `El color de ${parte} se distingue poco del de la letra.`,
    daltonismo: (parte: string): string =>
      `Con daltonismo, el color de ${parte} puede no distinguirse de la letra.`,
    parecidas: (a: string, b: string): string =>
      `${a} y ${b} se parecen: se distinguirán por la inicial.`,
    sugerir: 'Sugerir un color'
  }
} as const

/** Nombre que ve el usuario: el del cantante o «Cantante {n}»; «Todos» y «Coro». */
export function nombreDeParte(letra: Pick<Letra, 'partes'>, parte: Parte): string {
  if (parte === 'todos') return 'Todos'
  if (parte === 'coro') return 'Coro'
  const n = RANURAS.indexOf(parte) + 1
  return cantantesDe(letra).find((c) => c.id === parte)?.nombre ?? `Cantante ${n}`
}
