import type { Letra } from '@shared/letra'
import { cantantesDe, parteDe, RANURAS, type Parte } from '@shared/reparto'

/*
 * Textos y cálculos del reparto en el editor (0.2.3, spec 06 · Feature 1). Todo puro: el menú, el chip,
 * los atajos y el panel lo comparten.
 */

/** Microcopy de ux/06 · 0.2.3 (claves `edi.partes.*`). */
export const P = {
  menu: '¿Quién canta?',
  menuContextual: '¿Quién canta?… (C)',
  cantante: (n: number, nombre: string | null) =>
    nombre ? `Cantante ${n} · ${nombre}` : `Cantante ${n}`,
  predeterminado: (n: number) => `Cantante ${n}`,
  todos: 'Todos',
  todosDueto: 'Todos (los dos)',
  coro: 'Coro',
  anadir: 'Añadir cantante',
  nombres: 'Nombres de los cantantes…',
  chip: (parte: string) => `Canta: ${parte}`,
  canta: 'Canta',
  varias: 'Varias',
  seleccion: (n: number) => `${n} líneas seleccionadas`,
  seleccionAyuda: (k: number) =>
    `Los tiempos se editan de una en una: los controles de abajo son de la línea ${k}.`,
  soloPrincipal: (k: number) => `Solo en la línea ${k}`,
  paso: 'Quién canta',
  principal: ', principal',
  titulo: 'Cantantes y coros',
  ayuda:
    'Reparte la letra entre varias voces. Cada una se ve en su color y con su inicial al cantar.',
  repartir: 'Repartir entre varios cantantes',
  nombreAria: (n: number) => `Nombre del cantante ${n}`,
  recuento: (n: number) => (n === 0 ? 'Sin líneas' : n === 1 ? '1 línea' : `${n} líneas`),
  quitarAria: (nombre: string, destino: string) =>
    `Quitar a ${nombre}: sus líneas pasan a ${destino}`,
  quitado: (nombre: string, destino: string) => `${nombre} quitado: sus líneas pasan a ${destino}.`,
  maximo: 'Hasta 4 cantantes por canción.',
  sugerenciaCoro: (n: number) =>
    n === 1
      ? '1 línea va entre paréntesis: suele ser un coro.'
      : `${n} líneas van entre paréntesis: suelen ser coros.`,
  marcarCoro: (n: number) => (n === 1 ? 'Marcarla como coro' : 'Marcarlas como coro'),
  juntar: 'Juntar carriles',
  separar: 'Separar carriles',
  juntosSinEspacio: 'No caben los carriles: agranda la ventana o la línea de tiempo para verlos.',
  anuncioJuntar: 'Carriles juntos en una pista.',
  anuncioSeparar: 'Un carril por cantante.',
  nuevoCarril: 'Suelta aquí para un cantante nuevo',
  carrilVacio: (nombre: string) => `Arrastra aquí las líneas de ${nombre}`,
  anuncio: (n: number, parte: string) =>
    n === 1 ? `Línea para ${parte}.` : `${n} líneas para ${parte}.`,
  anuncioNuevo: (nombre: string, n = 0) =>
    n > 0
      ? `${nombre} añadido: ${n === 1 ? '1 línea' : `${n} líneas`} para ${nombre}.`
      : `${nombre} añadido.`,
  noExiste: (n: number) => `Esta canción no tiene cantante ${n}.`,
  atajos: {
    quienCanta: ['C', '¿Quién canta?'],
    asignar: ['Alt + 1…4', 'Asignar al cantante 1…4'],
    vecina: ['Alt + ↑ / ↓', 'Parte anterior / siguiente'],
    varias: [
      'Ctrl/Cmd + clic · Mayús + clic · Mayús + ↑ / ↓',
      'Añadir a la selección · seleccionar un rango'
    ],
    esc: ['Esc (con varias seleccionadas)', 'Dejar solo la línea principal']
  }
} as const

/** Número de ranura (1–4) de un cantante; `null` para Todos y Coro. */
export function ranuraDe(parte: Parte): number | null {
  const i = (RANURAS as readonly string[]).indexOf(parte)
  return i < 0 ? null : i + 1
}

/** Nombre completo de la parte para nombres accesibles y anuncios: «Luis», «Cantante 2», «Todos», «Coro». */
export function etiquetaParte(letra: Pick<Letra, 'partes'>, parte: Parte): string {
  if (parte === 'todos') return P.todos
  if (parte === 'coro') return P.coro
  const n = ranuraDe(parte)!
  const nombre = cantantesDe(letra).find((c) => c.id === parte)?.nombre ?? null
  return nombre ?? P.predeterminado(n)
}

/**
 * Orden de las partes para Alt + ↑/↓ (spec 06): los cantantes que hay, Todos (con 2 o más: en un dúo se
 * llega a él con Alt + ↓ desde el último cantante aunque su carril aún no exista) y Coro. No crea cantantes.
 */
export function partesEnOrden(letra: Pick<Letra, 'partes'>): Parte[] {
  const cantantes = cantantesDe(letra)
  return [
    ...cantantes.map((c) => c.id),
    ...(cantantes.length >= 2 ? ['todos' as const] : []),
    'coro'
  ]
}

/** La parte anterior (`-1`) o siguiente (`1`) a `desde`; `null` en los extremos. */
export function parteVecina(
  letra: Pick<Letra, 'partes'>,
  desde: Parte,
  sentido: -1 | 1
): Parte | null {
  const orden = partesEnOrden(letra)
  const i = orden.indexOf(desde)
  return orden[i + sentido] ?? null
}

/** La parte que comparten todas las líneas `ids`; `null` si hay partes distintas (o ninguna línea). */
export function parteComun(
  letra: Pick<Letra, 'lineas' | 'partes'>,
  ids: readonly string[]
): Parte | null {
  const elegidas = new Set(ids)
  const partes = new Set(
    letra.lineas
      .filter((l) => l.tipo === 'linea' && elegidas.has(l.id))
      .map((l) => parteDe(l, letra))
  )
  return partes.size === 1 ? [...partes][0]! : null
}

/** Microcopy de ux/06 · 0.2.3 · Feature 2 (claves `edi.coros.*`). */
export const C = {
  nivel: 'Voz en los coros',
  ayuda:
    'La voz original suena a este volumen mientras se cantan las líneas de coro, aunque la voz guía esté silenciada.',
  limite: 'Si en esas líneas también canta la voz principal, también se oirá.',
  cero: 'Sin voz (0 %)',
  escuchar: 'Escuchar un coro',
  detener: 'Detener',
  anuncioEscuchando: (tiempo: string, nivel: number) =>
    `Escuchando el coro de ${tiempo} con la voz al ${nivel} %.`,
  sinVoz: 'Hace falta separar la voz para oír los coros.',
  preparando: 'Preparando los coros…',
  error:
    'No se pudo preparar la voz de los coros en el editor: «Instrumental» suena sin ella. En el reproductor y en el video sí se oirá.'
} as const
