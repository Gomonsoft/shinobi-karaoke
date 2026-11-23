import {
  catalogoSchema,
  claveNombreTema,
  claveTexto,
  crearIndiceCatalogo,
  estilosIguales,
  resolverApariencia,
  LONGITUD_MAXIMA_NOMBRE_TEMA,
  type Apariencia,
  type Cancion,
  type Catalogo,
  type Tema
} from '../../shared'

/**
 * Qué hacer con los temas de un paquete (ADR 0027 §3, 0157 §8). Funciones puras sobre el catálogo del
 * paquete y el local: el que escribe `temas.json` es `ServicioTemas`, que las llama desde su cola.
 */

export type ExisteTema = 'igual' | 'distinto' | 'no'

const SUFIJO = 'importado'

function temaLocalDeId(local: Catalogo, id: string): Tema | undefined {
  return local.temas.find((t) => t.id === id)
}

/**
 * Igual: mismo id y mismo estilo, o (refinación de 0.2.2, pregunta 0256) mismo nombre y mismo estilo con
 * otro id, p. ej. el «Shinobi» que siembra cada instalación nueva: se reutiliza el de este equipo.
 * Distinto: mismo id con otro estilo, o mismo nombre con otro estilo. Un tema que se está borrando no
 * cuenta como igual.
 */
export function buscarTema(
  paquete: Tema,
  local: Catalogo | null
): { existe: ExisteTema; destino: Tema | null } {
  if (!local) return { existe: 'no', destino: null }
  const enBorrado = local.borrado_pendiente?.tema_id
  const mismoId = temaLocalDeId(local, paquete.id)
  const clave = claveNombreTema(paquete.nombre)
  const mismoNombre = local.temas.find((t) => claveNombreTema(t.nombre) === clave)
  // Si hay varios iguales, el primero por fecha de creación; nunca uno que se esté borrando.
  const iguales = [mismoId, mismoNombre]
    .filter((t): t is Tema => !!t && t.id !== enBorrado && estilosIguales(t.estilo, paquete.estilo))
    .sort((a, b) => a.creado.localeCompare(b.creado))
  if (iguales[0]) return { existe: 'igual', destino: iguales[0] }
  return { existe: mismoId || mismoNombre ? 'distinto' : 'no', destino: null }
}

export const existenciaTema = (paquete: Tema, local: Catalogo | null): ExisteTema =>
  buscarTema(paquete, local).existe

/** Nombre libre «<nombre> (importado)», «… (importado 2)», recortado a la longitud máxima. */
function nombreImportado(nombre: string, ocupados: ReadonlySet<string | null>): string {
  for (let n = 1; n < 1000; n++) {
    const sufijo = n === 1 ? ` (${SUFIJO})` : ` (${SUFIJO} ${n})`
    const candidato = `${[...nombre]
      .slice(0, LONGITUD_MAXIMA_NOMBRE_TEMA - sufijo.length)
      .join('')
      .trimEnd()}${sufijo}`
    if (!ocupados.has(claveNombreTema(candidato))) return candidato
  }
  return `${nombre.slice(0, 40)} (${SUFIJO} ${Date.now()})`
}

export interface OpcionesPlanTemas {
  paquete: Catalogo
  local: Catalogo
  /** Ids de los temas del paquete que hay que traer (los que usan las canciones, o todos en una copia). */
  ids: ReadonlySet<string>
  /** Copia de seguridad: restaura asignaciones y predeterminado donde el equipo no tiene ya uno. */
  restaurarAsignaciones: boolean
  nuevoId: () => string
  ahora: () => string
}

export interface PlanTemas {
  /** Catálogo resultante, o `null` si no cambia nada. */
  nuevo: Catalogo | null
  /** Id del tema en el paquete → id del tema en este equipo. */
  mapa: ReadonlyMap<string, string>
  /** Nombres con los que entraron los temas nuevos (incluidas las copias «(importado)»). */
  importados: string[]
  reutilizados: number
  asignaciones: {
    restauradas: number
    omitidas: string[]
    predeterminado: 'restaurado' | 'no_aplica' | 'sin'
  }
}

export function planificarTemas(o: OpcionesPlanTemas): PlanTemas {
  const temas = [...o.local.temas]
  const nombres = new Set<string | null>(temas.map((t) => claveNombreTema(t.nombre)))
  const mapa = new Map<string, string>()
  const importados: string[] = []
  let reutilizados = 0
  for (const p of o.paquete.temas) {
    if (!o.ids.has(p.id)) continue
    const { existe, destino } = buscarTema(p, o.local)
    if (existe === 'igual' && destino) {
      mapa.set(p.id, destino.id)
      reutilizados++
      continue
    }
    const idLibre = !temas.some((t) => t.id === p.id)
    const nombreLibre = !nombres.has(claveNombreTema(p.nombre))
    const copia = !(idLibre && nombreLibre)
    const tema: Tema = copia
      ? {
          ...p,
          id: o.nuevoId(),
          nombre: nombreImportado(p.nombre, nombres),
          creado: o.ahora(),
          modificado: o.ahora(),
          revision: 1
        }
      : { ...p }
    temas.push(tema)
    nombres.add(claveNombreTema(tema.nombre))
    mapa.set(p.id, tema.id)
    importados.push(tema.nombre)
  }

  const asignaciones = {
    artistas: [...o.local.asignaciones.artistas],
    albumes: [...o.local.asignaciones.albumes]
  }
  let predeterminado = o.local.predeterminado
  const resumen: PlanTemas['asignaciones'] = { restauradas: 0, omitidas: [], predeterminado: 'sin' }
  if (o.restaurarAsignaciones) {
    for (const a of o.paquete.asignaciones.artistas) {
      const destino = mapa.get(a.tema_id)
      if (asignaciones.artistas.some((x) => x.artista === a.artista) || !destino) {
        resumen.omitidas.push(a.nombre_artista)
        continue
      }
      asignaciones.artistas.push({ ...a, tema_id: destino })
      resumen.restauradas++
    }
    for (const a of o.paquete.asignaciones.albumes) {
      const destino = mapa.get(a.tema_id)
      if (
        asignaciones.albumes.some((x) => x.artista === a.artista && x.album === a.album) ||
        !destino
      ) {
        resumen.omitidas.push(`${a.nombre_album} — ${a.nombre_artista}`)
        continue
      }
      asignaciones.albumes.push({ ...a, tema_id: destino })
      resumen.restauradas++
    }
    if (o.paquete.predeterminado !== null) {
      const destino = mapa.get(o.paquete.predeterminado)
      if (predeterminado === null && destino) {
        predeterminado = destino
        resumen.predeterminado = 'restaurado'
      } else resumen.predeterminado = 'no_aplica'
    }
  }

  const cambia =
    temas.length !== o.local.temas.length ||
    asignaciones.artistas.length !== o.local.asignaciones.artistas.length ||
    asignaciones.albumes.length !== o.local.asignaciones.albumes.length ||
    predeterminado !== o.local.predeterminado
  const nuevo = cambia
    ? catalogoSchema.parse({ ...o.local, temas, asignaciones, predeterminado })
    : null
  return { nuevo, mapa, importados, reutilizados, asignaciones: resumen }
}

/** Qué asignaciones de una copia se aplicarían (para el resumen de `leer`, sin escribir nada). */
export function previsualizarAsignaciones(
  paquete: Catalogo,
  local: Catalogo | null
): { aplicables: number; noAplicables: string[]; predeterminado: 'aplica' | 'no_aplica' | 'sin' } {
  let aplicables = 0
  const noAplicables: string[] = []
  for (const a of paquete.asignaciones.artistas) {
    if (local?.asignaciones.artistas.some((x) => x.artista === a.artista))
      noAplicables.push(a.nombre_artista)
    else aplicables++
  }
  for (const a of paquete.asignaciones.albumes) {
    if (local?.asignaciones.albumes.some((x) => x.artista === a.artista && x.album === a.album)) {
      noAplicables.push(`${a.nombre_album} — ${a.nombre_artista}`)
    } else aplicables++
  }
  const predeterminado =
    paquete.predeterminado === null
      ? 'sin'
      : local && local.predeterminado !== null
        ? 'no_aplica'
        : 'aplica'
  return { aplicables, noAplicables, predeterminado }
}

// ---------------------------------------------------------------------------------------------
// Reducir el catálogo para un paquete de canciones
// ---------------------------------------------------------------------------------------------

/**
 * Catálogo mínimo de un paquete de canciones: los temas que resuelven la apariencia de las canciones y,
 * solo si alguna depende de ellas, la asignación de álbum o artista o el predeterminado que los eligió.
 * Con el catálogo vacío o ausente no lleva nada.
 */
export function catalogoParaPaquete(local: Catalogo, canciones: readonly Cancion[]): Catalogo {
  const indice = crearIndiceCatalogo(local)
  const temas = new Set<string>()
  const artistas = new Set<string>()
  const albumes = new Set<string>()
  let predeterminado: string | null = null
  for (const c of canciones) {
    if (!c.apariencia || c.apariencia.modo === 'propio') continue
    const r = resolverApariencia(c, indice)
    if (r.temaId === null || !indice.porId.has(r.temaId)) continue
    temas.add(r.temaId)
    if (r.procedencia === 'artista') artistas.add(claveTexto(c.metadatos.artista) ?? '')
    if (r.procedencia === 'album') {
      albumes.add(JSON.stringify([claveTexto(c.metadatos.artista), claveTexto(c.metadatos.album)]))
    }
    if (r.procedencia === 'predeterminado') predeterminado = r.temaId
  }
  return {
    ...local,
    predeterminado,
    temas: local.temas.filter((t) => temas.has(t.id)),
    asignaciones: {
      artistas: local.asignaciones.artistas.filter((a) => artistas.has(a.artista)),
      albumes: local.asignaciones.albumes.filter((a) =>
        albumes.has(JSON.stringify([a.artista, a.album]))
      )
    },
    borrado_pendiente: null,
    apartado: null
  }
}

// ---------------------------------------------------------------------------------------------
// Apariencia de cada canción importada
// ---------------------------------------------------------------------------------------------

export interface OpcionesApariencia {
  tipo: 'cancion' | 'copia'
  /** Catálogo del paquete (`null` si no traía `temas.json`). */
  paquete: Catalogo | null
  /** Id del tema en el paquete → tema de este equipo; vacío con `TEMAS_SOLO_LECTURA`. */
  mapa: ReadonlyMap<string, Tema>
  /** `false`: el catálogo de este equipo es de solo lectura (no se importaron temas). */
  temasEscribibles: boolean
}

const quitarBase = (ap: Apariencia): Apariencia => {
  const resto = { ...ap }
  delete resto.base
  return resto
}

/**
 * Apariencia con la que entra una canción (ADR 0027 §3). En un paquete de canciones, la que heredaba su
 * tema lo lleva asignado (`modo: tema`); en una copia, se conserva como estaba con los ids traducidos. Sin
 * catálogo escribible, la canción entra con apariencia `propio` y el estilo que se veía en origen.
 */
export function aparienciaImportada(c: Cancion, o: OpcionesApariencia): Cancion {
  const ap = c.apariencia
  if (!ap || ap.modo === 'propio') return c
  if (!o.temasEscribibles) {
    const r = resolverApariencia(c, o.paquete ? crearIndiceCatalogo(o.paquete) : null)
    return { ...c, estilo: structuredClone(r.estilo), apariencia: { modo: 'propio' } }
  }
  if (ap.modo === 'tema') {
    const t = ap.tema_id ? o.mapa.get(ap.tema_id) : undefined
    return t ? { ...c, apariencia: { ...ap, tema_id: t.id, tema_nombre: t.nombre } } : c
  }
  // heredar
  if (o.tipo === 'cancion' && o.paquete) {
    const r = resolverApariencia(c, crearIndiceCatalogo(o.paquete))
    const t = r.temaId ? o.mapa.get(r.temaId) : undefined
    if (t && r.procedencia !== 'respaldo' && r.procedencia !== 'incluido') {
      return {
        ...c,
        apariencia: { ...quitarBase(ap), modo: 'tema', tema_id: t.id, tema_nombre: t.nombre }
      }
    }
    return c
  }
  const base = ap.base
  if (base && base.tipo !== 'incluido') {
    const t = o.mapa.get(base.tema_id)
    if (t) return { ...c, apariencia: { ...ap, base: { ...base, tema_id: t.id } } }
  }
  return c
}
