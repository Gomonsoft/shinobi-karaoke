/**
 * Canciones de ejemplo reutilizables por los tests y por el script `semilla` (0009).
 * Cada fixture se construye de nuevo en cada llamada (sin estado compartido).
 */
import type { Cancion, PasoCancion } from '../cancion'
import { estiloPredeterminado } from '../estilo'
import type { ElementoLetra, Letra } from '../letra'
import type { Apariencia, Catalogo, Tema } from '../temas'

const AHORA = '2026-11-03T10:20:00Z'

const paso = (estado: PasoCancion['estado'], extra: Partial<PasoCancion> = {}): PasoCancion => ({
  estado,
  actualizado: estado === 'pendiente' ? null : AHORA,
  error: null,
  ...extra
})

export function linea(
  id: string,
  texto: string,
  inicio: number | null,
  extra: Partial<ElementoLetra> = {}
): ElementoLetra {
  return { id, tipo: 'linea', texto, inicio_ms: inicio, fin_ms: null, palabras: null, ...extra }
}

export function pausa(id: string, inicio: number | null = null): ElementoLetra {
  return { id, tipo: 'pausa', texto: '', inicio_ms: inicio, fin_ms: null, palabras: null }
}

export function letra(lineas: ElementoLetra[]): Letra {
  return { origen: 'manual', lrclib_id: null, offset_ms: 0, lineas }
}

/** Letra de 4 líneas con una pausa, totalmente sincronizada. */
export function letraSincronizada(): Letra {
  return letra([
    linea('l1', 'Primera línea de la canción', 17000),
    linea('l2', 'Segunda línea', 21000),
    pausa('p1'),
    linea('l3', 'Tercera línea tras la pausa', 30000),
    linea('l4', 'Última línea', 34000)
  ])
}

/** Letra sincronizada con palabras en dos líneas. */
export function letraConPalabras(): Letra {
  return letra([
    linea('l1', 'Hola mundo cruel', 10000, {
      palabras: [
        { texto: 'Hola', inicio_ms: 10000, fin_ms: 10500 },
        { texto: 'mundo', inicio_ms: 10600, fin_ms: 11200 },
        { texto: 'cruel', inicio_ms: 11300, fin_ms: 12000 }
      ]
    }),
    linea('l2', 'Adiós amigo', 14000, {
      palabras: [
        { texto: 'Adiós', inicio_ms: 14000, fin_ms: 14800 },
        { texto: 'amigo', inicio_ms: 14900, fin_ms: 15600 }
      ]
    }),
    pausa('p1'),
    linea('l3', 'Fin del canto', 20000)
  ])
}

function base(sobrescribir: Partial<Cancion> = {}): Cancion {
  return {
    esquema: 1,
    id: '6f1c2a10-0000-4000-8000-000000000001',
    creada: '2026-11-03T10:00:00Z',
    modificada: AHORA,
    estado: 'borrador',
    metadatos: {
      titulo: 'Canción de prueba',
      artista: 'Artista',
      album: null,
      duracion_ms: 215000
    },
    fuente: {
      tipo: 'archivo',
      nombre_original: 'cancion.mp3',
      url: null,
      youtube_id: null,
      mezcla: 'fuente/mezcla.flac',
      miniatura: null,
      ganancia_db: -2.5
    },
    pistas: null,
    letra: null,
    estilo: estiloPredeterminado(),
    pasos: {
      fuente: paso('completado'),
      separacion: paso('pendiente'),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    },
    ...sobrescribir
  }
}

const PISTAS: NonNullable<Cancion['pistas']> = {
  voz: 'pistas/voz.flac',
  instrumental: 'pistas/instrumental.flac',
  modelo: { perfil: 'rapido', nombre: 'modelo-de-prueba', version: '1' }
}

/** Borrador recién creado: fuente completada, nada más. */
export const borradorRecienCreado = (): Cancion => base()

/** Fuente de YouTube todavía descargándose. */
export const descargando = (): Cancion =>
  base({
    fuente: {
      ...base().fuente,
      tipo: 'youtube',
      url: 'https://youtu.be/abc',
      youtube_id: 'abc',
      nombre_original: null
    },
    pasos: {
      fuente: paso('en_curso', { progreso: 0.3 }),
      separacion: paso('pendiente'),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    }
  })

/** Separando, sin letra todavía. */
export const separando = (): Cancion =>
  base({
    pasos: {
      fuente: paso('completado'),
      separacion: paso('en_curso', { progreso: 0.42 }),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    }
  })

/** Separación terminada, aún sin letra. */
export const sinLetra = (): Cancion =>
  base({
    pistas: PISTAS,
    pasos: {
      fuente: paso('completado'),
      separacion: paso('completado'),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    }
  })

/** Letra a medias con una sola línea sin inicio (la última). */
export const letraAMediasUnaSinInicio = (): Cancion => {
  const l = letraSincronizada()
  l.lineas[4] = linea('l4', 'Última línea', null)
  return base({
    pistas: PISTAS,
    letra: l,
    pasos: {
      fuente: paso('completado'),
      separacion: paso('completado'),
      letra: paso('completado'),
      edicion: paso('pendiente')
    }
  })
}

/** Letra a medias con varias líneas sin inicio (líneas 2, 3 y 4). */
export const letraAMediasVariasSinInicio = (): Cancion => {
  const c = letraAMediasUnaSinInicio()
  const l = c.letra!
  l.lineas[1] = linea('l2', 'Segunda línea', null)
  l.lineas[3] = linea('l3', 'Tercera línea tras la pausa', null)
  return c
}

/** Letra a medias mientras la separación sigue en curso. */
export const letraMientrasSepara = (): Cancion => {
  const c = letraAMediasUnaSinInicio()
  c.pistas = null
  c.pasos.separacion = paso('en_curso', { progreso: 0.6 })
  return c
}

/** Canción lista, sincronizada por línea. */
export const lista = (): Cancion =>
  base({
    estado: 'lista',
    pistas: PISTAS,
    letra: letraSincronizada(),
    pasos: {
      fuente: paso('completado'),
      separacion: paso('completado'),
      letra: paso('completado'),
      edicion: paso('completado')
    }
  })

/** Canción lista con sincronía por palabra. */
export const listaConPalabras = (): Cancion => ({
  ...lista(),
  letra: { ...letraConPalabras(), origen: 'lrclib', lrclib_id: 12345 }
})

/** Lista, pero con una línea sin inicio (indicador derivado "incompleta"). */
export const listaIncompletaUna = (): Cancion => {
  const c = lista()
  c.letra!.lineas[3] = linea('l3', 'Tercera línea tras la pausa', null)
  return c
}

/** Lista, pero con varias líneas sin inicio. */
export const listaIncompletaVarias = (): Cancion => {
  const c = listaIncompletaUna()
  c.letra!.lineas[0] = linea('l1', 'Primera línea de la canción', null)
  return c
}

/** Separación fallida por falta de memoria. */
export const conError = (): Cancion =>
  base({
    pasos: {
      fuente: paso('completado'),
      separacion: paso('error', {
        error: { codigo: 'MEMORIA_INSUFICIENTE', mensaje: 'Sin memoria durante la separación' }
      }),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    }
  })

/** Separación interrumpida por el cierre de la app. */
export const interrumpida = (): Cancion =>
  base({
    pasos: {
      fuente: paso('completado'),
      separacion: paso('interrumpido', { progreso: 0.42 }),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    }
  })

/** Todas las fixtures por nombre. */
export const FIXTURES = {
  borradorRecienCreado,
  descargando,
  separando,
  sinLetra,
  letraAMediasUnaSinInicio,
  letraAMediasVariasSinInicio,
  letraMientrasSepara,
  lista,
  listaConPalabras,
  listaIncompletaUna,
  listaIncompletaVarias,
  conError,
  interrumpida
} as const

// ---------------------------------------------------------------- temas (fase 3, 0163)

/** UUID v4 válido y determinista para las pruebas: `idDePrueba(1)`. */
export const idDePrueba = (n: number): string =>
  `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Tema de ejemplo (estilo de fábrica salvo que se sobrescriba). */
export function temaDePrueba(sobrescribir: Partial<Tema> = {}): Tema {
  return {
    id: idDePrueba(1),
    nombre: 'Noche ninja',
    creado: '2026-11-09T10:00:00Z',
    modificado: '2026-11-09T10:00:00Z',
    revision: 1,
    estilo: estiloPredeterminado(),
    ...sobrescribir
  }
}

/** Catálogo vacío y válido; `catalogoDePrueba({ temas: [...] })` para rellenarlo. */
export function catalogoDePrueba(sobrescribir: Partial<Catalogo> = {}): Catalogo {
  return {
    esquema: 1,
    claves: 1,
    predeterminado: null,
    temas: [],
    asignaciones: { artistas: [], albumes: [] },
    borrado_pendiente: null,
    apartado: null,
    ...sobrescribir
  }
}

export function aparienciaDePrueba(sobrescribir: Partial<Apariencia> = {}): Apariencia {
  return { modo: 'heredar', ...sobrescribir }
}
