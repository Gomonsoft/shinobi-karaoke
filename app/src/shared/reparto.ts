import type { Estilo } from './estilo'
import type { ElementoLetra, Letra } from './letra'

/*
 * Reparto de la letra entre cantantes y coro (ADR 0029 §1 y §3). Funciones puras, sin E/S: el editor
 * las usa antes de guardar, main al escribir y el render al pintar. Una canción sin `letra.partes` ni
 * líneas de coro es de un solo cantante y no cambia en nada.
 */

export const PARTES = ['c1', 'c2', 'c3', 'c4', 'todos', 'coro'] as const
export type Parte = (typeof PARTES)[number]
export type IdCantante = 'c1' | 'c2' | 'c3' | 'c4'

/** Ranuras de cantante en orden; `c1` siempre existe. */
export const RANURAS = ['c1', 'c2', 'c3', 'c4'] as const
/** Lo que se escribe en `lineas[].parte`: `c1` no se escribe (ausente = `c1`). */
export const PARTES_ESCRITAS = ['c2', 'c3', 'c4', 'todos', 'coro'] as const
export const MAX_CANTANTES = 4
export const NOMBRE_MAX = 40
/** Nivel de la voz en los coros cuando falta (ADR 0030 §1); pasos de 0,05. */
export const VOZ_EN_COROS_PREDETERMINADA = 0.5

/** Colores de las cinco ranuras que no son `c1` (`c1` es `color_resaltado`). */
export const COLORES_PARTES_PREDETERMINADOS = {
  c2: '#35C6E8',
  c3: '#FF5C8A',
  c4: '#7CFF6B',
  todos: '#B388FF',
  coro: '#FF9F1C'
} as const

export interface Cantante {
  id: IdCantante
  nombre: string | null
}
/** Lo mínimo que se lee de una letra: estructural, para no depender del tipo inferido del esquema (que usa `cantantesDe`). */
type PartesCrudas = { partes?: { cantantes?: unknown; voz_en_coros?: unknown } | undefined }
type LetraReparto = Pick<Letra, 'lineas' | 'partes'>

export type InicialParte = { tipo: 'texto'; texto: string } | { tipo: 'icono'; icono: 'users' }

export type RecuentoPartes = Record<Parte, number>

const esRanura = (v: unknown): v is IdCantante => (RANURAS as readonly unknown[]).includes(v)

/** Nombre sin espacios sobrantes y de como mucho 40 caracteres; vacío o no válido = `null`. */
export function nombreNormalizado(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = Array.from(valor.trim()).slice(0, NOMBRE_MAX).join('').trim()
  return t === '' ? null : t
}

/**
 * Cantantes efectivos (lectura tolerante, ADR 0029 §1): ids únicos de `c1`…`c4` en orden de ranura,
 * siempre con `c1`; sin `partes` es solo `c1`. No modifica nada.
 */
export function cantantesDe(letra: PartesCrudas): Cantante[] {
  const crudos = letra.partes?.cantantes
  const nombres = new Map<IdCantante, string | null>()
  if (Array.isArray(crudos)) {
    for (const c of crudos as unknown[]) {
      const id = (c as { id?: unknown } | null)?.id
      if (esRanura(id) && !nombres.has(id)) {
        nombres.set(id, nombreNormalizado((c as { nombre?: unknown }).nombre))
      }
    }
  }
  if (!nombres.has('c1')) nombres.set('c1', null)
  return RANURAS.filter((id) => nombres.has(id)).map((id) => ({
    id,
    nombre: nombres.get(id) ?? null
  }))
}

/** Nivel de la voz en los coros: el de la canción o 0,5. */
export function vozEnCoros(letra: PartesCrudas): number {
  const v = letra.partes?.voz_en_coros
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : VOZ_EN_COROS_PREDETERMINADA
}

/**
 * Parte efectiva de una línea (`c1` si falta). Con `letra`, la lectura es tolerante del todo: una parte
 * de un cantante que no existe, o `todos` con un solo cantante, se lee como `c1` (ADR 0029 §1).
 */
export function parteDe(linea: Pick<ElementoLetra, 'parte'>, letra?: Pick<Letra, 'partes'>): Parte {
  const p: unknown = linea.parte
  if (!(PARTES_ESCRITAS as readonly unknown[]).includes(p)) return 'c1'
  if (!letra) return p as Parte
  const cantantes = cantantesDe(letra)
  if (p === 'todos') return cantantes.length >= 2 ? 'todos' : 'c1'
  if (p === 'coro') return 'coro'
  return cantantes.some((c) => c.id === p) ? (p as Parte) : 'c1'
}

/** Copia de la línea sin `parte` (= `c1`). */
function sinParte(e: ElementoLetra): ElementoLetra {
  const copia = { ...e }
  delete copia.parte
  return copia
}

const lineasDe = (letra: Pick<Letra, 'lineas'>): ElementoLetra[] =>
  letra.lineas.filter((e) => e.tipo === 'linea')

/** Reparto activo: 2 o más cantantes, o alguna línea de coro (un solo cantante sin coros no lo es). */
export function tieneReparto(letra: LetraReparto): boolean {
  return cantantesDe(letra).length >= 2 || lineasDe(letra).some((l) => parteDe(l, letra) === 'coro')
}

/** Dos o más cantantes. */
export function variosCantantes(letra: Pick<Letra, 'partes'>): boolean {
  return cantantesDe(letra).length >= 2
}

/**
 * Carriles de la línea de tiempo en orden c1–c4, todos, coro. Sin reparto, `[]` (una sola pista).
 * Un carril por cada cantante; Coro siempre; Todos con 3 o más cantantes y, en un dúo, solo si tiene líneas.
 */
export function carriles(letra: LetraReparto): Parte[] {
  if (!tieneReparto(letra)) return []
  const cantantes = cantantesDe(letra)
  const hayTodos = lineasDe(letra).some((l) => parteDe(l, letra) === 'todos')
  const salida: Parte[] = cantantes.map((c) => c.id)
  if (cantantes.length >= 3 || hayTodos) salida.push('todos')
  salida.push('coro')
  return salida
}

/** Primera de `c2`…`c4` sin usar, o `null` con 4 cantantes. */
export function siguienteRanuraLibre(letra: Pick<Letra, 'partes'>): IdCantante | null {
  const usadas = new Set(cantantesDe(letra).map((c) => c.id))
  return RANURAS.find((id) => id !== 'c1' && !usadas.has(id)) ?? null
}

// ---------------------------------------------------------------------------
// Normalización y validación
// ---------------------------------------------------------------------------

/**
 * Deja el reparto en su forma canónica: `parte` solo en líneas, sin `c1`, de cantantes que existen y
 * `todos` solo con 2 o más (si no, pasan a `c1`); si `partes` no aporta nada (solo `c1` sin nombre, ni
 * `todos` ni `coro`, nivel ausente o 0,5), se quita. Nunca toca tiempos ni texto.
 */
export function normalizarReparto<L extends LetraReparto>(letra: L): L {
  const cantantes = cantantesDe(letra)
  const lineas = letra.lineas.map((e) => {
    const p = e.tipo === 'linea' ? parteDe(e, letra) : 'c1'
    if (p === 'c1') {
      if (e.parte === undefined) return e
      return sinParte(e)
    }
    return e.parte === p ? e : { ...e, parte: p as ElementoLetra['parte'] }
  })
  const { partes: previas, ...sinPartes } = letra
  const nivel = previas?.voz_en_coros
  const hayCompartidas = lineas.some((e) => e.parte === 'todos' || e.parte === 'coro')
  const soloC1 = cantantes.length === 1 && cantantes[0]!.nombre === null && !hayCompartidas
  const nivelValido = typeof nivel === 'number' && nivel >= 0 && nivel <= 1
  const nivelPropio = nivelValido && nivel !== VOZ_EN_COROS_PREDETERMINADA
  if (previas === undefined || (soloC1 && !nivelPropio)) return { ...sinPartes, lineas } as L
  return {
    ...sinPartes,
    lineas,
    partes: { cantantes, ...(nivelValido ? { voz_en_coros: nivel } : {}) }
  } as L
}

/**
 * Invariantes de escritura (estrictos, para main): devuelve los problemas, vacío si el reparto es
 * válido. `parte` solo en líneas, nunca `c1`, solo de cantantes que existen, `todos` con 2 o más.
 */
export function validarReparto(letra: LetraReparto): string[] {
  const problemas: string[] = []
  const crudos: unknown = letra.partes?.cantantes
  if (letra.partes !== undefined) {
    const ids = Array.isArray(crudos) ? (crudos as { id?: unknown }[]).map((c) => c?.id) : []
    if (ids.length < 1 || ids.length > MAX_CANTANTES)
      problemas.push('Debe haber de 1 a 4 cantantes')
    if (!ids.includes('c1')) problemas.push('El Cantante 1 es obligatorio')
    if (new Set(ids).size !== ids.length) problemas.push('Hay cantantes repetidos')
    if (ids.some((id) => !esRanura(id)))
      problemas.push('Hay un cantante con un identificador no válido')
    for (const c of Array.isArray(crudos) ? (crudos as { nombre?: unknown }[]) : []) {
      if (c?.nombre !== null && nombreNormalizado(c?.nombre) !== c?.nombre) {
        problemas.push('El nombre de un cantante no es válido (vacío o de más de 40 caracteres)')
      }
    }
    const nivel = letra.partes.voz_en_coros
    if (
      nivel !== undefined &&
      !(nivel >= 0 && nivel <= 1 && Math.abs(nivel * 20 - Math.round(nivel * 20)) < 1e-9)
    ) {
      problemas.push('El nivel de la voz en los coros debe ir de 0 a 1 en pasos de 0,05')
    }
  }
  const ids = new Set(cantantesDe(letra).map((c) => c.id as string))
  for (const e of letra.lineas) {
    const p: unknown = e.parte
    if (p === undefined) continue
    if (e.tipo !== 'linea') problemas.push('Una pausa no puede tener parte')
    else if (p === 'c1') problemas.push('La parte «c1» no se escribe (ausente = Cantante 1)')
    else if (p === 'todos') {
      if (ids.size < 2) problemas.push('«Todos» necesita 2 o más cantantes')
    } else if (p !== 'coro' && !ids.has(p as string)) {
      problemas.push('Una línea es de un cantante que no existe')
    }
  }
  return problemas
}

// ---------------------------------------------------------------------------
// Edición (devuelven la letra nueva, normalizada)
// ---------------------------------------------------------------------------

/** Pone la parte de las líneas `ids`; una parte no disponible en la canción deja la letra igual. */
export function asignar<L extends LetraReparto>(letra: L, ids: readonly string[], parte: Parte): L {
  const disponible =
    parte === 'coro' ||
    (parte === 'todos'
      ? cantantesDe(letra).length >= 2
      : cantantesDe(letra).some((c) => c.id === parte))
  if (!disponible) return letra
  const elegidas = new Set(ids)
  const lineas = letra.lineas.map((e) => {
    if (e.tipo !== 'linea' || !elegidas.has(e.id)) return e
    return parte === 'c1' ? sinParte(e) : { ...e, parte }
  })
  return normalizarReparto({ ...letra, lineas })
}

/**
 * Añade el cantante de la primera ranura libre (sin nombre) y, si `asignarA`, le pasa esas líneas.
 * Sin reparto crea `partes` con `c1` y la ranura nueva. Con 4 cantantes no hace nada.
 */
export function anadirCantante<L extends LetraReparto>(letra: L, asignarA?: readonly string[]): L {
  const ranura = siguienteRanuraLibre(letra)
  if (ranura === null) return letra
  const cantantes = [...cantantesDe(letra), { id: ranura, nombre: null }].sort(
    (a, b) => RANURAS.indexOf(a.id) - RANURAS.indexOf(b.id)
  )
  const conCantante = { ...letra, partes: { ...letra.partes, cantantes } } as L
  return asignarA && asignarA.length > 0
    ? asignar(conCantante, asignarA, ranura)
    : normalizarReparto(conCantante)
}

/**
 * Quita un cantante (`c1` no se puede): sus líneas pasan a `c1` y, si queda uno solo, también las de
 * `todos`. Los demás no se renumeran.
 */
export function quitarCantante<L extends LetraReparto>(letra: L, id: Parte): L {
  if (id === 'c1' || !esRanura(id)) return letra
  const cantantes = cantantesDe(letra)
  if (!cantantes.some((c) => c.id === id)) return letra
  const quedan = cantantes.filter((c) => c.id !== id)
  const lineas = letra.lineas.map((e) => {
    if (e.parte !== id && !(quedan.length < 2 && e.parte === 'todos')) return e
    return sinParte(e)
  })
  return normalizarReparto({ ...letra, lineas, partes: { ...letra.partes, cantantes: quedan } })
}

/** Cambia el nombre de un cantante (recortado, vacío = `null`, como mucho 40 caracteres). */
export function renombrar<L extends LetraReparto>(letra: L, id: Parte, nombre: string | null): L {
  const cantantes = cantantesDe(letra)
  if (!esRanura(id) || !cantantes.some((c) => c.id === id)) return letra
  const nuevo = cantantes.map((c) =>
    c.id === id ? { ...c, nombre: nombreNormalizado(nombre) } : c
  )
  return normalizarReparto({ ...letra, partes: { ...letra.partes, cantantes: nuevo } })
}

// ---------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------

const primeraLetra = (nombre: string, cuantas: 1 | 2): string => {
  const letras = Array.from(nombre)
  const [a, b] = [letras[0] ?? '', letras[1] ?? '']
  return cuantas === 1
    ? a.toLocaleUpperCase('es')
    : a.toLocaleUpperCase('es') + b.toLocaleLowerCase('es')
}

const esLetraONumero = (c: string): boolean => /^[\p{L}\p{N}]$/u.test(c)

/** Iniciales de los cantantes (regla de ADR 0029 §3: 1 letra, 2 si chocan y, si no, número de ranura). */
function inicialesCantantes(letra: Pick<Letra, 'partes'>): Map<IdCantante, string> {
  const cantantes = cantantesDe(letra)
  const numero = (id: IdCantante): string => String(RANURAS.indexOf(id) + 1)
  const salida = new Map<IdCantante, string>()
  const nombrados = cantantes.filter(
    (c) => c.nombre !== null && esLetraONumero(Array.from(c.nombre)[0]!)
  )
  for (const c of cantantes) salida.set(c.id, numero(c.id))
  const iguales = (a: string, b: string): boolean =>
    a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es')
  const una = new Map(nombrados.map((c) => [c.id, primeraLetra(c.nombre!, 1)]))
  const chocan = (mapa: Map<IdCantante, string>, id: IdCantante): boolean =>
    [...mapa].some(([otro, t]) => otro !== id && iguales(t, mapa.get(id)!))
  const dos = new Map<IdCantante, string>()
  for (const c of nombrados) {
    if (!chocan(una, c.id)) salida.set(c.id, una.get(c.id)!)
    else dos.set(c.id, primeraLetra(c.nombre!, 2))
  }
  for (const [id, texto] of dos) {
    if (!chocan(dos, id) && Array.from(texto).length === 2) salida.set(id, texto)
  }
  return salida
}

/** Lo que identifica a la parte en chips, carriles y menú. */
export function inicial(letra: Pick<Letra, 'partes'>, parte: Parte): InicialParte {
  if (parte === 'coro') return { tipo: 'texto', texto: '( )' }
  const iniciales = inicialesCantantes(letra)
  if (parte === 'todos') {
    const cantantes = cantantesDe(letra)
    if (cantantes.length === 2) {
      return {
        tipo: 'texto',
        texto: `${iniciales.get(cantantes[0]!.id)}·${iniciales.get(cantantes[1]!.id)}`
      }
    }
    return { tipo: 'icono', icono: 'users' }
  }
  return { tipo: 'texto', texto: iniciales.get(parte) ?? String(RANURAS.indexOf(parte) + 1) }
}

/** Insignia en pantalla: la inicial con varios cantantes; `null` para el coro y con un solo cantante. */
export function insignia(letra: Pick<Letra, 'partes'>, parte: Parte): InicialParte | null {
  if (parte === 'coro' || !variosCantantes(letra)) return null
  return inicial(letra, parte)
}

const entreParentesis = (texto: string): boolean => {
  const t = texto.trim()
  return t.startsWith('(') && t.endsWith(')')
}

/**
 * Paréntesis de una línea: solo `coro` cuyo texto no los trae ya. El render los dibuja; el texto
 * guardado no cambia (con palabras visibles, «(» va con la primera y «)» con la última).
 */
export function textoEnPantalla(linea: Pick<ElementoLetra, 'texto' | 'parte' | 'tipo'>): {
  texto: string
  parentesis: boolean
} {
  return {
    texto: linea.texto,
    parentesis: linea.tipo === 'linea' && linea.parte === 'coro' && !entreParentesis(linea.texto)
  }
}

/** Color de la parte: `color_resaltado` para `c1`; si no, el del estilo o el predeterminado de la ranura. */
export function colorDeParte(estilo: Pick<Estilo, 'letra'>, parte: Parte): string {
  if (parte === 'c1') return estilo.letra.color_resaltado
  return estilo.letra.colores_partes?.[parte] ?? COLORES_PARTES_PREDETERMINADOS[parte]
}

/** Ids de las líneas `c1` cuyo texto recortado empieza por «(» y acaba en «)» (sugerencia «Marcarlas como coro»). */
export function lineasEntreParentesis(letra: LetraReparto): string[] {
  return lineasDe(letra)
    .filter((l) => parteDe(l, letra) === 'c1' && entreParentesis(l.texto))
    .map((l) => l.id)
}

/** Número de líneas de cada parte (para Funciones › «Cantantes y coros»). */
export function recuentoPorParte(letra: LetraReparto): RecuentoPartes {
  const cuenta: RecuentoPartes = { c1: 0, c2: 0, c3: 0, c4: 0, todos: 0, coro: 0 }
  for (const l of lineasDe(letra)) cuenta[parteDe(l, letra)]++
  return cuenta
}
