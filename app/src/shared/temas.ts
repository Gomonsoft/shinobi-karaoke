import { z } from 'zod'
import { ESTILO_PREDETERMINADO, estiloSchema, type Estilo } from './estilo'
import {
  claveAlbum,
  claveAlbumTexto,
  claveArtista,
  claveNombreTema,
  claveTexto,
  normalizarNombreTema,
  VERSION_CLAVES
} from './identidad'

/*
 * Catálogo de temas, apariencia de la canción y resolución (ADR 0016 §1–§3). Sin E/S.
 * No importa `cancion.ts` (que importa este archivo): evita un ciclo de módulos.
 */

/** Versión actual del esquema de temas.json. */
export const VERSION_ESQUEMA_CATALOGO = 1

const fechaIso = z.iso.datetime()

/** Un tema guarda un estilo completo, validado igual que el de una canción. */
export const estiloTemaSchema = estiloSchema

export const LONGITUD_MAXIMA_NOMBRE_TEMA = 60

/** Nombre de tema: se normaliza (NFC, recortado, espacios colapsados) y mide 1–60 caracteres. */
export const nombreTemaSchema = z
  .string()
  .transform(normalizarNombreTema)
  .pipe(z.string().min(1).max(LONGITUD_MAXIMA_NOMBRE_TEMA))

export const temaSchema = z.object({
  id: z.uuid(),
  nombre: nombreTemaSchema,
  creado: fechaIso,
  modificado: fechaIso,
  revision: z.number().int().min(1),
  estilo: estiloTemaSchema
})
export type Tema = z.infer<typeof temaSchema>

const claveNormalizada = z.string().min(1)

export const asignacionArtistaSchema = z.object({
  artista: claveNormalizada,
  nombre_artista: z.string().transform(normalizarNombreTema),
  tema_id: z.uuid()
})
export const asignacionAlbumSchema = z.object({
  artista: claveNormalizada,
  album: claveNormalizada,
  nombre_artista: z.string().transform(normalizarNombreTema),
  nombre_album: z.string().transform(normalizarNombreTema),
  tema_id: z.uuid()
})

export const borradoPendienteSchema = z.object({
  tema_id: z.uuid(),
  iniciado: fechaIso,
  canciones: z.array(z.string().min(1))
})

export const catalogoSchema = z
  .object({
    esquema: z.literal(VERSION_ESQUEMA_CATALOGO),
    claves: z.literal(VERSION_CLAVES),
    predeterminado: z.uuid().nullable(),
    temas: z.array(temaSchema),
    asignaciones: z.object({
      artistas: z.array(asignacionArtistaSchema),
      albumes: z.array(asignacionAlbumSchema)
    }),
    borrado_pendiente: borradoPendienteSchema.nullable(),
    apartado: fechaIso.nullable()
  })
  .superRefine((c, ctx) => {
    const problema = (path: (string | number)[], message: string): void => {
      ctx.addIssue({ code: 'custom', path, message })
    }
    const ids = new Set<string>()
    const nombres = new Set<string>()
    c.temas.forEach((t, i) => {
      if (ids.has(t.id)) problema(['temas', i, 'id'], 'Id de tema repetido')
      ids.add(t.id)
      const clave = claveNombreTema(t.nombre)
      if (clave !== null) {
        if (nombres.has(clave)) problema(['temas', i, 'nombre'], 'Nombre de tema repetido')
        nombres.add(clave)
      }
    })
    if (c.predeterminado !== null && !ids.has(c.predeterminado)) {
      problema(['predeterminado'], 'El tema predeterminado no existe')
    }
    const artistas = new Set<string>()
    c.asignaciones.artistas.forEach((a, i) => {
      const ruta = ['asignaciones', 'artistas', i]
      if (!ids.has(a.tema_id)) {
        problema([...ruta, 'tema_id'], 'La asignación apunta a un tema inexistente')
      }
      if (claveTexto(a.artista) !== a.artista)
        problema([...ruta, 'artista'], 'Clave no normalizada')
      if (claveTexto(a.nombre_artista) !== a.artista) {
        problema([...ruta, 'nombre_artista'], 'El nombre no corresponde a la clave')
      }
      if (artistas.has(a.artista)) problema(ruta, 'Asignación de artista repetida')
      artistas.add(a.artista)
    })
    const albumes = new Set<string>()
    c.asignaciones.albumes.forEach((a, i) => {
      const ruta = ['asignaciones', 'albumes', i]
      if (!ids.has(a.tema_id)) {
        problema([...ruta, 'tema_id'], 'La asignación apunta a un tema inexistente')
      }
      if (claveTexto(a.artista) !== a.artista)
        problema([...ruta, 'artista'], 'Clave no normalizada')
      if (claveTexto(a.album) !== a.album) problema([...ruta, 'album'], 'Clave no normalizada')
      if (claveTexto(a.nombre_artista) !== a.artista) {
        problema([...ruta, 'nombre_artista'], 'El nombre no corresponde a la clave')
      }
      if (claveTexto(a.nombre_album) !== a.album) {
        problema([...ruta, 'nombre_album'], 'El nombre no corresponde a la clave')
      }
      const k = claveAlbumTexto({ artista: a.artista, album: a.album })
      if (albumes.has(k)) problema(ruta, 'Asignación de álbum repetida')
      albumes.add(k)
    })
    if (c.borrado_pendiente && !ids.has(c.borrado_pendiente.tema_id)) {
      problema(['borrado_pendiente', 'tema_id'], 'El tema en borrado no existe')
    }
  })
export type Catalogo = z.infer<typeof catalogoSchema>
export type AsignacionArtista = z.infer<typeof asignacionArtistaSchema>
export type AsignacionAlbum = z.infer<typeof asignacionAlbumSchema>
export type BorradoPendiente = z.infer<typeof borradoPendienteSchema>

// ---------------------------------------------------------------- migración

/** Migración de la versión N a la N+1 (clave = N). Vacía: la versión 1 es la única. */
type MigracionCatalogo = (json: Record<string, unknown>) => Record<string, unknown>
export const MIGRACIONES_CATALOGO: Record<number, MigracionCatalogo> = {}

export type ResultadoMigrarCatalogo =
  { tipo: 'ok'; catalogo: Catalogo } | { tipo: 'mas_nuevo' } | { tipo: 'invalido'; error: string }

function resumirZod(error: z.ZodError): string {
  return error.issues
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('\n')
}

/**
 * Lee un temas.json de cualquier versión soportada. Esquema (o algoritmo de claves) más nuevo:
 * `mas_nuevo` (el catálogo queda en solo lectura); cualquier otra cosa ilegible: `invalido`.
 */
export function migrarCatalogo(json: unknown): ResultadoMigrarCatalogo {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { tipo: 'invalido', error: 'Se esperaba un objeto JSON' }
  }
  const objeto = json as Record<string, unknown>
  const declarada = objeto.esquema
  if (typeof declarada !== 'number' || !Number.isInteger(declarada) || declarada < 1) {
    return { tipo: 'invalido', error: `Versión de formato no válida (${String(declarada)})` }
  }
  if (declarada > VERSION_ESQUEMA_CATALOGO) return { tipo: 'mas_nuevo' }
  if (typeof objeto.claves === 'number' && objeto.claves > VERSION_CLAVES) {
    return { tipo: 'mas_nuevo' }
  }
  let datos: Record<string, unknown> = { ...objeto }
  for (let v = declarada; v < VERSION_ESQUEMA_CATALOGO; v++) {
    const migrar = MIGRACIONES_CATALOGO[v]
    if (!migrar) return { tipo: 'invalido', error: `Sin migración desde la versión ${v}` }
    datos = { ...migrar(datos), esquema: v + 1 }
  }
  const r = catalogoSchema.safeParse(datos)
  return r.success
    ? { tipo: 'ok', catalogo: r.data }
    : { tipo: 'invalido', error: resumirZod(r.error) }
}

// ---------------------------------------------------------------- estilos

function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonico)
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((k) => [k, canonico((valor as Record<string, unknown>)[k])])
    )
  }
  return valor
}

/** Igualdad campo a campo; el orden de las claves de los objetos es irrelevante. */
export function estilosIguales(a: Estilo, b: Estilo): boolean {
  return JSON.stringify(canonico(a)) === JSON.stringify(canonico(b))
}

/**
 * Catálogo del primer arranque de 0.2.0: un tema a partir del estilo predeterminado heredado, marcado
 * como predeterminado. «Shinobi» si es el estilo de fábrica; «Mi estilo» si no.
 */
export function catalogoInicial(opciones: { estilo: Estilo; ahora: string; id: string }): Catalogo {
  const { estilo, ahora, id } = opciones
  return {
    esquema: VERSION_ESQUEMA_CATALOGO,
    claves: VERSION_CLAVES,
    predeterminado: id,
    temas: [
      {
        id,
        nombre: estilosIguales(estilo, ESTILO_PREDETERMINADO) ? 'Shinobi' : 'Mi estilo',
        creado: ahora,
        modificado: ahora,
        revision: 1,
        estilo
      }
    ],
    asignaciones: { artistas: [], albumes: [] },
    borrado_pendiente: null,
    apartado: null
  }
}

// ---------------------------------------------------------------- apariencia

export const baseAparienciaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('aleatorio'), tema_id: z.uuid() }),
  z.object({ tipo: z.literal('predeterminado_anterior'), tema_id: z.uuid() }),
  z.object({ tipo: z.literal('incluido') })
])
export type BaseApariencia = z.infer<typeof baseAparienciaSchema>

/**
 * Apariencia de la canción (opcional en cancion.json; ausente equivale a `{ modo: "propio" }`).
 * Con `propio`, el `estilo` de la canción es la autoridad; con `tema`/`heredar`, es la instantánea de
 * respaldo. `tema_id` solo y obligatorio con `modo: "tema"` (`null` se tolera como ausente).
 */
export const aparienciaSchema = z
  .object({
    modo: z.enum(['propio', 'tema', 'heredar']),
    tema_id: z.uuid().nullable().optional(),
    base: baseAparienciaSchema.optional(),
    tema_nombre: nombreTemaSchema.optional()
  })
  .superRefine((a, ctx) => {
    const tiene = a.tema_id != null
    if (a.modo === 'tema' && !tiene) {
      ctx.addIssue({ code: 'custom', path: ['tema_id'], message: 'Falta tema_id con modo "tema"' })
    }
    if (a.modo !== 'tema' && tiene) {
      ctx.addIssue({ code: 'custom', path: ['tema_id'], message: 'tema_id solo con modo "tema"' })
    }
  })
export type Apariencia = z.infer<typeof aparienciaSchema>

export type Procedencia =
  | 'propio'
  | 'cancion'
  | 'album'
  | 'artista'
  | 'aleatorio'
  | 'predeterminado_anterior'
  | 'predeterminado'
  | 'incluido'
  | 'respaldo'

export interface IndiceCatalogo {
  porId: ReadonlyMap<string, Tema>
  /** claveArtista a tema_id. */
  porArtista: ReadonlyMap<string, string>
  /** claveAlbumTexto a tema_id. */
  porAlbum: ReadonlyMap<string, string>
  predeterminado: string | null
}

/** Mapas construidos una vez para resolver cada canción en O(1). */
export function crearIndiceCatalogo(catalogo: Catalogo): IndiceCatalogo {
  return {
    porId: new Map(catalogo.temas.map((t) => [t.id, t])),
    porArtista: new Map(catalogo.asignaciones.artistas.map((a) => [a.artista, a.tema_id])),
    porAlbum: new Map(
      catalogo.asignaciones.albumes.map((a) => [
        claveAlbumTexto({ artista: a.artista, album: a.album }),
        a.tema_id
      ])
    ),
    predeterminado: catalogo.predeterminado
  }
}

/** Lo mínimo que necesita la resolución de una canción (una `Cancion` lo cumple). */
export interface CancionResoluble {
  metadatos: { artista?: string | null; album?: string | null }
  estilo: Estilo
  apariencia?: Apariencia | undefined
}

export interface ResolucionApariencia {
  /** Estilo completo a pintar (referencia al del tema o de la canción: no mutar). */
  estilo: Estilo
  procedencia: Procedencia
  temaId: string | null
  temaNombre: string | null
}

/**
 * Resolución única (ADR 0016 §3). `indice` `null` = catálogo ausente o en solo lectura: `tema` y
 * `heredar` dan `respaldo` (sin base fija no se puede conocer el predeterminado), salvo `base: incluido`.
 */
export function resolverApariencia(
  cancion: CancionResoluble,
  indice: IndiceCatalogo | null
): ResolucionApariencia {
  const ap: Apariencia = cancion.apariencia ?? { modo: 'propio' }
  if (ap.modo === 'propio') {
    return { estilo: cancion.estilo, procedencia: 'propio', temaId: null, temaNombre: null }
  }
  const respaldo = (temaId: string | null): ResolucionApariencia => ({
    estilo: cancion.estilo,
    procedencia: 'respaldo',
    temaId,
    temaNombre: ap.tema_nombre ?? null
  })
  const deTema = (id: string, procedencia: Procedencia): ResolucionApariencia | null => {
    const tema = indice?.porId.get(id)
    return tema
      ? { estilo: tema.estilo, procedencia, temaId: tema.id, temaNombre: tema.nombre }
      : null
  }
  const incluido = (): ResolucionApariencia => ({
    estilo: ESTILO_PREDETERMINADO,
    procedencia: 'incluido',
    temaId: null,
    temaNombre: null
  })

  if (ap.modo === 'tema') {
    const id = ap.tema_id ?? null
    return (id !== null ? deTema(id, 'cancion') : null) ?? respaldo(id)
  }

  // heredar: álbum, artista, base, predeterminado, incluido.
  if (indice) {
    const album = claveAlbum(cancion.metadatos)
    if (album) {
      const id = indice.porAlbum.get(claveAlbumTexto(album))
      const r = id !== undefined ? deTema(id, 'album') : null
      if (r) return r
    }
    const artista = claveArtista(cancion.metadatos)
    if (artista !== null) {
      const id = indice.porArtista.get(artista)
      const r = id !== undefined ? deTema(id, 'artista') : null
      if (r) return r
    }
  }
  const base = ap.base
  if (base) {
    if (base.tipo === 'incluido') return incluido()
    return deTema(base.tema_id, base.tipo) ?? respaldo(base.tema_id)
  }
  if (!indice) return respaldo(null)
  if (indice.predeterminado !== null) {
    return deTema(indice.predeterminado, 'predeterminado') ?? respaldo(indice.predeterminado)
  }
  return incluido()
}

/**
 * `neutra` (ADR 0016 §3): nadie eligió un aspecto para la canción, su álbum ni su artista.
 * `estiloHeredado` = `config.estilo_predeterminado` de 0.1.0 (o `null`).
 */
export function esAparienciaNeutra(
  resolucion: ResolucionApariencia,
  cancion: Pick<CancionResoluble, 'estilo'>,
  estiloHeredado: Estilo | null
): boolean {
  switch (resolucion.procedencia) {
    case 'predeterminado':
    case 'predeterminado_anterior':
    case 'aleatorio':
    case 'incluido':
      return true
    case 'propio':
      return (
        estilosIguales(cancion.estilo, ESTILO_PREDETERMINADO) ||
        (estiloHeredado !== null && estilosIguales(cancion.estilo, estiloHeredado))
      )
    default:
      return false
  }
}
