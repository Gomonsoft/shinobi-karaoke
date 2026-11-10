import { ESTILO_PREDETERMINADO, type Estilo } from '@shared/estilo'
import type { CatalogoIpc, DestinoHeredarIpc, ResumenCancionIpc } from '@shared/ipc'
import type { Procedencia } from '@shared/temas'
import type { BorradorTema, SeleccionEditor } from './estado'

/*
 * Lectura de la apariencia para el panel Estilo (0170). El editor NO resuelve apariencias: la
 * procedencia, el tema efectivo, el estilo resuelto y `alHeredar` salen del resumen vivo de la
 * canción (main, ADR 0016 §9). Cuando la selección del editor aún no ha llegado a main (autoguardado
 * con debounce), solo se traducen datos que ya se conocen: el tema elegido del catálogo o el destino
 * `alHeredar`; nunca se recorren los niveles de la precedencia.
 */

export type EstadoTema = 'd1' | 'd2' | 'd3' | 'd4'

type TemaCatalogo = CatalogoIpc['temas'][number]

export interface EntradaVista {
  seleccion: SeleccionEditor
  /** Estilo guardado en la canción: el propio con `propio`; el respaldo en los demás modos. */
  estiloPropio: Estilo
  resumen: ResumenCancionIpc
  catalogo: CatalogoIpc | null
  borrador: BorradorTema | null
}

export interface VistaTema {
  estado: EstadoTema
  seleccion: SeleccionEditor
  /** Procedencia vigente (`propio` en D2). */
  procedencia: Procedencia
  temaId: string | null
  temaNombre: string | null
  /** Destino de «Volver a heredar», calculado en main. */
  alHeredar: DestinoHeredarIpc
  /** Tema efectivo del catálogo (también si está en borrado). */
  tema: TemaCatalogo | null
  catalogoCargado: boolean
  soloLectura: boolean
  /** Catálogo sin temas ofrecibles y estilo incluido: D1 sin selector. */
  catalogoVacio: boolean
  /** Motivo por el que no se puede editar, renombrar, duplicar ni eliminar el tema efectivo. */
  bloqueo: 'borrado' | 'solo_lectura' | 'sin_tema' | null
}

/** Procedencias que apuntan a un tema del catálogo que se puede editar. */
const CON_TEMA: readonly Procedencia[] = [
  'cancion',
  'album',
  'artista',
  'aleatorio',
  'predeterminado_anterior',
  'predeterminado'
]

function coincideConResumen(seleccion: SeleccionEditor, resumen: ResumenCancionIpc): boolean {
  const ap = resumen.apariencia
  return ap.modo === seleccion.modo && (seleccion.modo !== 'tema' || ap.temaId === seleccion.temaId)
}

export function vistaTema(e: EntradaVista): VistaTema {
  const { seleccion, resumen, catalogo, borrador } = e
  const alHeredar = resumen.apariencia.alHeredar
  let procedencia: Procedencia = 'propio'
  let temaId: string | null = null
  let temaNombre: string | null = null
  if (seleccion.modo !== 'propio') {
    if (coincideConResumen(seleccion, resumen)) {
      ;({ procedencia, temaId, temaNombre } = resumen.apariencia)
    } else if (seleccion.modo === 'tema') {
      const t = catalogo?.temas.find((x) => x.id === seleccion.temaId)
      // Sin catálogo todavía no se sabe si existe: se asume que sí hasta que llegue.
      procedencia = t || catalogo === null ? 'cancion' : 'respaldo'
      temaId = seleccion.temaId
      temaNombre = t?.nombre ?? null
    } else {
      ;({ procedencia, temaId, temaNombre } = alHeredar)
    }
  }
  const tema =
    CON_TEMA.includes(procedencia) && temaId !== null
      ? (catalogo?.temas.find((t) => t.id === temaId) ?? null)
      : null
  const soloLectura = catalogo?.soloLectura ?? false
  const estado: EstadoTema = borrador
    ? 'd3'
    : seleccion.modo === 'propio'
      ? 'd2'
      : procedencia === 'respaldo'
        ? 'd4'
        : 'd1'
  const ofrecibles = (catalogo?.temas ?? []).filter((t) => !t.enBorrado)
  return {
    estado,
    seleccion,
    procedencia,
    temaId,
    temaNombre,
    alHeredar,
    tema,
    catalogoCargado: catalogo !== null,
    soloLectura,
    catalogoVacio:
      catalogo !== null && ofrecibles.length === 0 && !soloLectura && procedencia === 'incluido',
    bloqueo: soloLectura
      ? 'solo_lectura'
      : tema?.enBorrado
        ? 'borrado'
        : tema === null
          ? 'sin_tema'
          : null
  }
}

/** Estilo que pinta la vista previa: el borrador, el propio, o el que corresponde al tema. */
export function estiloVisible(e: EntradaVista): Estilo {
  const { seleccion, estiloPropio, resumen, catalogo, borrador } = e
  if (borrador) return borrador.estilo
  if (seleccion.modo === 'propio') return estiloPropio
  if (coincideConResumen(seleccion, resumen) && resumen.estilo) return resumen.estilo
  const delTema = (id: string | null): Estilo | undefined =>
    catalogo?.temas.find((t) => t.id === id)?.estilo
  if (seleccion.modo === 'tema') return delTema(seleccion.temaId) ?? resumen.estilo ?? estiloPropio
  const destino = resumen.apariencia.alHeredar
  if (destino.procedencia === 'incluido') return ESTILO_PREDETERMINADO
  if (destino.procedencia === 'respaldo') return estiloPropio
  return delTema(destino.temaId) ?? resumen.estilo ?? estiloPropio
}

/** Selección que guarda el disco: sin `apariencia` equivale a estilo propio (canciones de 0.1.0). */
export function seleccionDeDisco(
  apariencia: { modo: 'propio' | 'tema' | 'heredar'; tema_id?: string | null } | undefined
): SeleccionEditor {
  if (apariencia?.modo === 'tema' && apariencia.tema_id) {
    return { modo: 'tema', temaId: apariencia.tema_id }
  }
  return apariencia?.modo === 'heredar' ? { modo: 'heredar' } : { modo: 'propio' }
}
