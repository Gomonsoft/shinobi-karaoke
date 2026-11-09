import {
  claveAlbum,
  claveArtista,
  claveTexto,
  crearIndiceCatalogo,
  normalizarNombreTema,
  resolverApariencia,
  type Apariencia,
  type Catalogo,
  type Estilo,
  type IndiceCatalogo,
  type ImpactoIpc,
  type OperacionTema,
  type OrigenAparienciaIpc,
  type Procedencia,
  type ResolucionApariencia
} from '../../shared'
import { ErrorTemas } from './errores'
import { construirCatalogoTemas, type CancionIndice } from './usos'

/** Impacto sin ficha: lo que se compara al ejecutar. */
export type ImpactoCalculado = Omit<ImpactoIpc, 'ficha'>
export type Afectada = ImpactoIpc['afectadas'][number]
export type OperacionDe<T extends OperacionTema['tipo']> = Extract<OperacionTema, { tipo: T }>

/** Canción cuyo `cancion.json` se pudo leer (tiene estilo). */
export type CancionLegible = CancionIndice & { estilo: Estilo }

export const esLegible = (c: CancionIndice): c is CancionLegible =>
  c.danada !== 'json' && c.estilo !== null

/** Procedencias que resuelven a un tema del catálogo y dependen de él (se ven afectadas al editarlo). */
const VINCULADAS: ReadonlySet<Procedencia> = new Set([
  'cancion',
  'album',
  'artista',
  'aleatorio',
  'predeterminado_anterior',
  'predeterminado'
])

const CLAVE_DESGLOSE: Record<Procedencia, keyof ImpactoIpc['desglose']> = {
  propio: 'propio',
  cancion: 'cancion',
  album: 'album',
  artista: 'artista',
  aleatorio: 'aleatorio',
  predeterminado_anterior: 'predeterminadoAnterior',
  predeterminado: 'predeterminado',
  incluido: 'incluido',
  respaldo: 'respaldo'
}

export const origenDe = (r: ResolucionApariencia): OrigenAparienciaIpc => ({
  procedencia: r.procedencia,
  temaId: r.temaId,
  temaNombre: r.temaNombre
})

export const resolverCancion = (
  c: CancionLegible,
  indice: IndiceCatalogo,
  apariencia: Apariencia | undefined = c.apariencia
): ResolucionApariencia =>
  resolverApariencia({ metadatos: c.metadatos, estilo: c.estilo, apariencia }, indice)

const mismoOrigen = (a: OrigenAparienciaIpc, b: OrigenAparienciaIpc): boolean =>
  a.procedencia === b.procedencia && a.temaId === b.temaId

const colador = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

const afectadaDe = (
  c: CancionLegible,
  antes: OrigenAparienciaIpc,
  despues: OrigenAparienciaIpc,
  efecto: Afectada['efecto']
): Afectada => ({
  id: c.id,
  titulo: c.metadatos.titulo ?? '',
  artista: c.metadatos.artista ?? '',
  antes,
  despues,
  efecto
})

/** Ordena por título con la comparación del idioma; el id desempata. */
function ordenar(afectadas: Afectada[]): Afectada[] {
  return afectadas.sort((a, b) => colador.compare(a.titulo, b.titulo) || a.id.localeCompare(b.id))
}

function armar(afectadas: Afectada[], extra: Partial<ImpactoCalculado> = {}): ImpactoCalculado {
  const desglose: ImpactoIpc['desglose'] = {
    cancion: 0,
    album: 0,
    artista: 0,
    predeterminado: 0,
    aleatorio: 0,
    predeterminadoAnterior: 0,
    propio: 0,
    respaldo: 0,
    incluido: 0
  }
  for (const a of afectadas) desglose[CLAVE_DESGLOSE[a.antes.procedencia]]++
  return {
    afectadas: ordenar(afectadas),
    desglose,
    excluidas: { propio: 0, cancion: 0, album: 0 },
    totalGrupo: null,
    esPredeterminado: false,
    asignacionesRetiradas: { artistas: [], albumes: [] },
    revisionTema: null,
    sesionEnCurso: false,
    ...extra
  }
}

function temaDe(catalogo: Catalogo, temaId: string) {
  const tema = catalogo.temas.find((t) => t.id === temaId)
  if (!tema) throw new ErrorTemas('TEMA_NO_ENCONTRADO', 'El tema no existe')
  return tema
}

// ---------------------------------------------------------------- editar y borrar

/** Canciones que resuelven al tema por cualquier nivel (incluidos los vínculos por `base`). */
function impactoDeTema(
  tipo: 'editar' | 'borrar',
  catalogo: Catalogo,
  canciones: readonly CancionIndice[],
  temaId: string
): ImpactoCalculado {
  const tema = temaDe(catalogo, temaId)
  const indice = crearIndiceCatalogo(catalogo)
  const afectadas: Afectada[] = []
  for (const c of canciones) {
    if (!esLegible(c)) continue
    const r = resolverCancion(c, indice)
    if (r.temaId !== temaId || !VINCULADAS.has(r.procedencia)) continue
    const antes = origenDe(r)
    afectadas.push(
      tipo === 'editar'
        ? afectadaDe(c, antes, antes, 'cambia')
        : // Se congela: conserva el aspecto y pasa a «Tema personalizado».
          afectadaDe(
            c,
            antes,
            { procedencia: 'propio', temaId: null, temaNombre: null },
            'fija_base'
          )
    )
  }
  let asignacionesRetiradas: ImpactoCalculado['asignacionesRetiradas'] = {
    artistas: [],
    albumes: []
  }
  if (tipo === 'borrar') {
    const grupos = construirCatalogoTemas(catalogo, canciones, { soloLectura: false }).temas.find(
      (t) => t.id === temaId
    )?.grupos
    if (grupos) asignacionesRetiradas = grupos
  }
  return armar(afectadas, {
    esPredeterminado: catalogo.predeterminado === temaId,
    asignacionesRetiradas,
    revisionTema: tema.revision
  })
}

// ---------------------------------------------------------------- aplicar

/** Apariencia que resulta de aplicar la selección conservando la `base`. */
export function aparienciaAplicada(
  actual: Apariencia | undefined,
  seleccion: OperacionDe<'aplicar'>['seleccion']
): Apariencia {
  const base = actual?.base
  return seleccion.modo === 'tema'
    ? { modo: 'tema', tema_id: seleccion.temaId, ...(base ? { base } : {}) }
    : { modo: 'heredar', ...(base ? { base } : {}) }
}

/** ¿La canción ya tiene exactamente esa selección? */
export function yaTieneSeleccion(
  c: CancionIndice,
  seleccion: OperacionDe<'aplicar'>['seleccion']
): boolean {
  const a = c.apariencia
  if (!a || a.modo !== seleccion.modo) return false
  return seleccion.modo === 'heredar' || a.tema_id === seleccion.temaId
}

function impactoAplicar(
  op: OperacionDe<'aplicar'>,
  catalogo: Catalogo,
  canciones: readonly CancionIndice[]
): ImpactoCalculado {
  const indice = crearIndiceCatalogo(catalogo)
  const porId = new Map(canciones.map((c) => [c.id, c]))
  const afectadas: Afectada[] = []
  let danadas = 0
  let noExisten = 0
  for (const id of op.cancionIds) {
    const c = porId.get(id)
    if (!c) {
      noExisten++
      continue
    }
    if (!esLegible(c)) {
      danadas++
      continue
    }
    const antes = origenDe(resolverCancion(c, indice))
    const despues = origenDe(
      resolverCancion(c, indice, aparienciaAplicada(c.apariencia, op.seleccion))
    )
    afectadas.push(
      afectadaDe(c, antes, despues, yaTieneSeleccion(c, op.seleccion) ? 'sin_cambios' : 'cambia')
    )
  }
  return armar(afectadas, { excluidas: { propio: 0, cancion: 0, album: 0, danadas, noExisten } })
}

// ---------------------------------------------------------------- asignarGrupo

/** Catálogo resultante de asignar (o quitar con `temaId: null`) el tema de un grupo. */
export function catalogoConAsignacion(
  catalogo: Catalogo,
  op: OperacionDe<'asignarGrupo'>
): Catalogo {
  const artista = claveTexto(op.artista)
  const album = op.album === undefined ? null : claveTexto(op.album)
  if (artista === null || (op.nivel === 'album' && album === null)) {
    throw new ErrorTemas('ARGUMENTOS_NO_VALIDOS', 'El artista y el álbum no pueden estar vacíos')
  }
  const nombreArtista = normalizarNombreTema(op.artista)
  if (op.nivel === 'artista') {
    const resto = catalogo.asignaciones.artistas.filter((a) => a.artista !== artista)
    return {
      ...catalogo,
      asignaciones: {
        ...catalogo.asignaciones,
        artistas:
          op.temaId === null
            ? resto
            : [...resto, { artista, nombre_artista: nombreArtista, tema_id: op.temaId }]
      }
    }
  }
  const claveDelAlbum = album as string
  const resto = catalogo.asignaciones.albumes.filter(
    (a) => !(a.artista === artista && a.album === claveDelAlbum)
  )
  return {
    ...catalogo,
    asignaciones: {
      ...catalogo.asignaciones,
      albumes:
        op.temaId === null
          ? resto
          : [
              ...resto,
              {
                artista,
                album: claveDelAlbum,
                nombre_artista: nombreArtista,
                nombre_album: normalizarNombreTema(op.album ?? ''),
                tema_id: op.temaId
              }
            ]
    }
  }
}

function impactoGrupo(
  op: OperacionDe<'asignarGrupo'>,
  catalogo: Catalogo,
  canciones: readonly CancionIndice[]
): ImpactoCalculado {
  const nuevo = catalogoConAsignacion(catalogo, op)
  const antesIdx = crearIndiceCatalogo(catalogo)
  const despuesIdx = crearIndiceCatalogo(nuevo)
  const artista = claveTexto(op.artista)
  const album = claveTexto(op.album)
  const afectadas: Afectada[] = []
  const excluidas = { propio: 0, cancion: 0, album: 0 }
  let totalGrupo = 0
  for (const c of canciones) {
    if (!esLegible(c)) continue
    const k = claveAlbum(c.metadatos)
    const pertenece =
      op.nivel === 'artista'
        ? claveArtista(c.metadatos) === artista
        : k !== null && k.artista === artista && k.album === album
    if (!pertenece) continue
    totalGrupo++
    const modo = c.apariencia?.modo ?? 'propio'
    if (modo === 'propio') {
      excluidas.propio++
      continue
    }
    if (modo === 'tema') {
      excluidas.cancion++
      continue
    }
    const r = resolverCancion(c, antesIdx)
    if (op.nivel === 'artista' && r.procedencia === 'album') {
      excluidas.album++
      continue
    }
    const antes = origenDe(r)
    const despues = origenDe(resolverCancion(c, despuesIdx))
    if (!mismoOrigen(antes, despues)) afectadas.push(afectadaDe(c, antes, despues, 'cambia'))
  }
  return armar(afectadas, { excluidas, totalGrupo })
}

// ---------------------------------------------------------------- predeterminado

/** Canciones que heredan sin base y sin tema de álbum ni de artista (las de base quedan fuera: C1). */
export function heredanSinBase(c: CancionLegible, r: ResolucionApariencia): boolean {
  return (
    c.apariencia?.modo === 'heredar' &&
    c.apariencia.base === undefined &&
    (r.procedencia === 'predeterminado' || r.procedencia === 'incluido')
  )
}

function impactoPredeterminado(
  op: OperacionDe<'predeterminado'>,
  catalogo: Catalogo,
  canciones: readonly CancionIndice[]
): ImpactoCalculado {
  const actual = catalogo.predeterminado
  // Sin cambio de predeterminado, o B1 sin tema que conservar: no hay nada que tocar.
  if (op.temaId === actual) return armar([], { esPredeterminado: actual !== null })
  const indice = crearIndiceCatalogo(catalogo)
  const despuesIdx = crearIndiceCatalogo({ ...catalogo, predeterminado: op.temaId })
  const afectadas: Afectada[] = []
  for (const c of canciones) {
    if (!esLegible(c)) continue
    const r = resolverCancion(c, indice)
    if (!heredanSinBase(c, r)) continue
    const antes = origenDe(r)
    if (op.temaId === null) {
      // B1: conserva el aspecto y pasa a «predeterminado anterior» (solo las que resuelven a `actual`).
      if (r.procedencia !== 'predeterminado') continue
      afectadas.push(
        afectadaDe(c, antes, { ...antes, procedencia: 'predeterminado_anterior' }, 'fija_base')
      )
    } else {
      afectadas.push(afectadaDe(c, antes, origenDe(resolverCancion(c, despuesIdx)), 'cambia'))
    }
  }
  return armar(afectadas, { esPredeterminado: actual !== null })
}

// ---------------------------------------------------------------- punto de entrada

/** Impacto de una operación sobre el catálogo y el índice vigentes (función pura). */
export function calcularImpacto(
  op: OperacionTema,
  catalogo: Catalogo,
  canciones: readonly CancionIndice[]
): ImpactoCalculado {
  switch (op.tipo) {
    case 'editar':
      return impactoDeTema('editar', catalogo, canciones, op.temaId)
    case 'borrar':
      return impactoDeTema('borrar', catalogo, canciones, op.temaId)
    case 'aplicar':
      return impactoAplicar(op, catalogo, canciones)
    case 'asignarGrupo':
      return impactoGrupo(op, catalogo, canciones)
    case 'predeterminado':
      return impactoPredeterminado(op, catalogo, canciones)
  }
}

/**
 * ¿Coinciden los impactos en lo que el usuario confirmó? Canciones, efectos, cómo se resuelven antes y
 * después, revisión del tema, estado de predeterminado y asignaciones retiradas. Los títulos no cuentan.
 */
export function mismoImpacto(a: ImpactoCalculado, b: ImpactoCalculado): boolean {
  const firma = (i: ImpactoCalculado): string =>
    JSON.stringify([
      i.afectadas.map((x) => [
        x.id,
        x.efecto,
        x.antes.procedencia,
        x.antes.temaId,
        x.despues.procedencia,
        x.despues.temaId
      ]),
      i.revisionTema,
      i.esPredeterminado,
      i.asignacionesRetiradas
    ])
  return firma(a) === firma(b)
}
