import {
  MAX_LOTE,
  type InfoYoutubeIpc,
  type LecturaLoteIpc,
  type ListaYoutubeIpc,
  type LoteIpc,
  type PropuestaDatos
} from '@shared/ipc'
import { cuantasCaben, estimarEspacioLote, estimarTiempoLote } from '@shared/lote'
import { formatearDuracion } from '../../biblioteca/tarjeta'
import { ORIGEN_DATO, TEXTO } from '../textos'
import { LOTE } from './textosLote'

/** Modelo puro de la tabla de revisión del lote (docs/ux/03 · 0.2.2 · Feature 7). */

export type CampoFila = 'titulo' | 'artista' | 'album'
export type Problema = 'ilegible' | 'corta' | 'no_disponible' | 'directo'

/** Más de 10 minutos: la fila lleva `add.lote.fila.larga`. */
export const UMBRAL_LARGA_MS = 600_000

export interface FilaTabla {
  /** Estable: la referencia del archivo o `yt:<id>`. */
  clave: string
  entrada: { tipo: 'archivo'; ref: string } | { tipo: 'youtube'; id: string }
  /** Nombre del archivo o título original de la entrada. */
  nombre: string
  titulo: string
  artista: string
  album: string
  duracionMs: number | null
  duplicado: 'YA_EN_BIBLIOTECA' | null
  problema: Problema | null
  /** Procedencia de lo propuesto (feature 6): da las líneas «compruébalo» y los datos comunes. */
  datos: PropuestaDatos | null
  /** Campos que el usuario cambió: lo propuesto ya no los toca. */
  tocados: CampoFila[]
  marcada: boolean
  /** Quedó fuera de las 50 primeras al leer. */
  fueraLimite: boolean
  /** YouTube: faltan los datos de `fuente.infoYoutube` (título limpio, artista, miniatura). */
  pendienteDatos: boolean
  /** YouTube: enlace con el que se piden esos datos (`watch?v=…&list=…` trae el álbum de la lista). */
  urlInfo: string | null
}

export type FuenteTabla = 'archivos' | 'carpeta' | 'lista' | 'enlaces'

export interface TablaLote {
  filas: FilaTabla[]
  fuente: FuenteTabla
  /** Nombre de la lista o de la carpeta, si se conoce. */
  nombreOrigen: string | null
  youtube: boolean
  repetidas: number
  ignorados: number
  enlacesIgnorados: number
  paqueteIgnorado: boolean
  truncada: boolean
  recortada: boolean
  libreBytes: number | null
  factorMinutos: number | null
}

export const sePuedeMarcar = (f: FilaTabla): boolean => f.problema === null

/** Marca las 50 primeras filas añadibles que no estén ya en la biblioteca; el resto se queda fuera. */
export function marcarIniciales(filas: FilaTabla[]): FilaTabla[] {
  let marcadas = 0
  return filas.map((f) => {
    const candidata = sePuedeMarcar(f) && f.duplicado === null
    if (candidata && marcadas < MAX_LOTE) {
      marcadas++
      return { ...f, marcada: true, fueraLimite: false }
    }
    return { ...f, marcada: false, fueraLimite: candidata }
  })
}

export function filasDeLectura(lectura: LecturaLoteIpc): FilaTabla[] {
  return marcarIniciales(
    lectura.filas.map((f) => ({
      clave: f.ref,
      entrada: { tipo: 'archivo' as const, ref: f.ref },
      nombre: f.nombre,
      titulo: f.metadatos.titulo,
      artista: f.metadatos.artista,
      album: f.metadatos.album ?? '',
      duracionMs: f.duracionMs,
      duplicado: f.duplicado === 'YA_EN_BIBLIOTECA' ? ('YA_EN_BIBLIOTECA' as const) : null,
      problema: f.problema,
      datos: f.datos ?? null,
      tocados: [],
      marcada: false,
      fueraLimite: false,
      pendienteDatos: false,
      urlInfo: null
    }))
  )
}

type EntradaLista = ListaYoutubeIpc['entradas'][number]

/** El título de la lista sin el prefijo «Album - » con el que YouTube Music nombra los álbumes. */
export const nombreDeLista = (titulo: string): string => titulo.replace(/^Album - /i, '').trim()

/** Fila de una entrada de lista (consulta rápida): se completa después con `fuente.infoYoutube`. */
export function filaDeEntradaLista(
  e: EntradaLista,
  lista: ListaYoutubeIpc,
  idLista: string
): FilaTabla {
  const noDisponible = e.problema !== null
  const album = lista.tipo === 'album' && !noDisponible ? nombreDeLista(lista.titulo) : ''
  return {
    clave: `yt:${e.id}`,
    entrada: { tipo: 'youtube', id: e.id },
    nombre: e.titulo,
    titulo: e.titulo,
    artista: '',
    album,
    duracionMs: e.duracionS === null ? null : Math.round(e.duracionS * 1000),
    duplicado: e.duplicado === 'YA_EN_BIBLIOTECA' ? 'YA_EN_BIBLIOTECA' : null,
    problema: e.problema,
    datos:
      album === ''
        ? null
        : {
            titulo: { valor: e.titulo, origen: null, dudoso: false },
            artista: { valor: '', origen: null, dudoso: false },
            album: { valor: album, origen: 'lista', dudoso: false }
          },
    tocados: [],
    marcada: false,
    fueraLimite: false,
    pendienteDatos: !noDisponible,
    urlInfo: `https://www.youtube.com/watch?v=${e.id}&list=${idLista}`
  }
}

/** Fila de un enlace de video suelto, con lo que devolvió `fuente.infoYoutube`. */
export function filaDeInfo(info: InfoYoutubeIpc): FilaTabla {
  return {
    clave: `yt:${info.idVideo}`,
    entrada: { tipo: 'youtube', id: info.idVideo },
    nombre: info.tituloOriginal,
    titulo: info.metadatos.titulo,
    artista: info.metadatos.artista,
    album: info.metadatos.album,
    duracionMs: Math.round(info.duracionS * 1000),
    duplicado: info.duplicado === 'YA_EN_BIBLIOTECA' ? 'YA_EN_BIBLIOTECA' : null,
    problema: null,
    datos: info.datos ?? null,
    tocados: [],
    marcada: false,
    fueraLimite: false,
    pendienteDatos: false,
    urlInfo: null
  }
}

/** Un enlace que no se pudo consultar: fila sin casilla con su motivo. */
export function filaNoDisponible(id: string, nombre: string): FilaTabla {
  return {
    clave: `yt:${id}`,
    entrada: { tipo: 'youtube', id },
    nombre,
    titulo: nombre,
    artista: '',
    album: '',
    duracionMs: null,
    duplicado: null,
    problema: 'no_disponible',
    datos: null,
    tocados: [],
    marcada: false,
    fueraLimite: false,
    pendienteDatos: false,
    urlInfo: null
  }
}

/** Funde las filas con la misma clave (el mismo video dos veces en el lote) y cuenta las sobrantes. */
export function fusionarRepetidas(filas: FilaTabla[]): { filas: FilaTabla[]; repetidas: number } {
  const vistas = new Set<string>()
  const unicas: FilaTabla[] = []
  for (const f of filas) {
    if (vistas.has(f.clave)) continue
    vistas.add(f.clave)
    unicas.push(f)
  }
  return { filas: unicas, repetidas: filas.length - unicas.length }
}

/** Aplica a una fila los datos de `fuente.infoYoutube` sin pisar lo que el usuario ya cambió. */
export function completarConInfo(f: FilaTabla, info: InfoYoutubeIpc): FilaTabla {
  const nuevo = (c: CampoFila): string =>
    f.tocados.includes(c) ? f[c] : (info.datos?.[c].valor ?? info.metadatos[c])
  return {
    ...f,
    titulo: nuevo('titulo'),
    artista: nuevo('artista'),
    album: nuevo('album'),
    duracionMs: f.duracionMs ?? Math.round(info.duracionS * 1000),
    datos: info.datos ?? f.datos,
    pendienteDatos: false
  }
}

/** Álbum y artista que se pusieron a todas las filas por la lista, la carpeta o el canal (`add.lote.comunes`). */
export function comunesDe(filas: FilaTabla[]): { album: string | null; artista: string | null } {
  const validas = filas.filter(sePuedeMarcar)
  const comun = (campo: 'album' | 'artista', origenes: readonly string[]): string | null => {
    if (validas.length < 2) return null
    const primero = validas[0]
    const valor = primero ? primero[campo] : ''
    if (valor === '') return null
    const todas = validas.every(
      (f) =>
        f[campo] === valor &&
        !f.tocados.includes(campo) &&
        f.datos?.[campo].origen !== null &&
        f.datos !== null &&
        origenes.includes(f.datos[campo].origen ?? '')
    )
    return todas ? valor : null
  }
  return {
    album: comun('album', ['carpeta', 'lista']),
    artista: comun('artista', ['carpeta', 'canal'])
  }
}

export type TipoLinea = 'aviso' | 'info' | 'error'
export interface LineaFila {
  tipo: TipoLinea
  texto: string
}

/** Líneas de estado bajo la fila (spec 03 · «Línea de estado de una fila»); vacío si está lista. */
export function lineasDeFila(f: FilaTabla, comunes: { artista: string | null }): LineaFila[] {
  if (f.problema !== null) {
    const texto = {
      no_disponible: LOTE.noDisponible,
      directo: LOTE.directo,
      ilegible: LOTE.ilegible,
      corta: LOTE.corta
    }[f.problema]
    return [{ tipo: 'error', texto }]
  }
  const lineas: LineaFila[] = []
  if (f.duplicado) {
    lineas.push({ tipo: 'info', texto: f.marcada ? LOTE.duplicadaMarcada : LOTE.duplicada })
  }
  if (f.fueraLimite && !f.marcada) lineas.push({ tipo: 'info', texto: LOTE.fueraLimite })
  if (f.duracionMs !== null && f.duracionMs > UMBRAL_LARGA_MS) {
    lineas.push({
      tipo: 'aviso',
      texto: LOTE.larga(formatearDuracion(f.duracionMs) ?? '')
    })
  }
  const dudoso = lineaDudosa(f, comunes)
  if (dudoso) lineas.push({ tipo: 'aviso', texto: dudoso })
  if (f.pendienteDatos && f.marcada) lineas.push({ tipo: 'info', texto: LOTE.completando })
  return lineas
}

function lineaDudosa(f: FilaTabla, comunes: { artista: string | null }): string | null {
  const d = f.datos
  if (!d) return null
  const tocado = (c: CampoFila): boolean => f.tocados.includes(c)
  if ((d.titulo.invertido || d.artista.invertido) && !tocado('titulo') && !tocado('artista')) {
    return TEXTO.dudosoInvertido
  }
  if (d.titulo.dudoso && !tocado('titulo')) {
    return d.titulo.origen === 'nombre' ? LOTE.dudosoNombre : LOTE.dudosoTitulo
  }
  if (d.artista.dudoso && !tocado('artista') && comunes.artista === null) {
    return d.artista.origen === 'canal' || d.artista.origen === null
      ? LOTE.dudosoArtista
      : TEXTO.dudoso(ORIGEN_DATO[d.artista.origen])
  }
  return null
}

/** Filas con un dato dudoso (la casilla «Solo las que hay que comprobar»). */
export function esDudosa(f: FilaTabla, comunes: { artista: string | null }): boolean {
  return f.problema === null && lineaDudosa(f, comunes) !== null
}

export interface ResumenTabla {
  marcadas: number
  bytes: number
  /** `null` sin factor medido en este equipo. */
  tiempo: { minutos: number; conocida: boolean } | null
  /** Cuántas caben con el espacio libre; `null` si no se sabe. */
  caben: number | null
  sinEspacio: boolean
  tituloVacio: boolean
}

/** Resumen de las filas marcadas con las mismas funciones que usa main (`shared/lote.ts`). */
export function resumirTabla(
  filas: FilaTabla[],
  libreBytes: number | null,
  factorMinutos: number | null
): ResumenTabla {
  const marcadas = filas.filter((f) => f.marcada && f.problema === null)
  const duraciones = marcadas.map((f) => f.duracionMs)
  const caben = libreBytes === null ? null : cuantasCaben(duraciones, libreBytes)
  return {
    marcadas: marcadas.length,
    bytes: estimarEspacioLote(duraciones),
    tiempo: estimarTiempoLote(duraciones, factorMinutos),
    caben,
    sinEspacio: caben !== null && caben < marcadas.length,
    tituloVacio: marcadas.some((f) => f.titulo.trim() === '')
  }
}

/** Minutos que se muestran: hacia arriba, al menos 1. */
export const minutosMostrados = (minutos: number): number => Math.max(1, Math.ceil(minutos))

/** La petición de `fuente.lote`: las filas marcadas, en el orden de la tabla. */
export function armarLote(filas: FilaTabla[]): LoteIpc {
  const marcadas = filas.filter((f) => f.marcada && f.problema === null)
  return {
    entradas: marcadas.map((f) => f.entrada),
    metadatos: marcadas.map((f) => ({
      titulo: f.titulo.trim(),
      artista: f.artista.trim(),
      album: f.album.trim() === '' ? null : f.album.trim()
    }))
  }
}

/** La tabla de una lectura de archivos o de una carpeta. */
export function tablaDeArchivos(
  lectura: LecturaLoteIpc,
  opciones: { carpeta: boolean; nombreCarpeta: string | null; paqueteIgnorado?: boolean }
): TablaLote {
  const filas = filasDeLectura(lectura)
  // Sin nombre de carpeta conocido, se deduce del álbum que salió de ella.
  const deAlbum =
    lectura.filas.find((f) => f.datos?.album.origen === 'carpeta')?.datos?.album.valor ?? null
  return {
    filas,
    fuente: opciones.carpeta ? 'carpeta' : 'archivos',
    nombreOrigen: opciones.carpeta ? (opciones.nombreCarpeta ?? deAlbum) : null,
    youtube: false,
    repetidas: 0,
    ignorados: lectura.rechazadas,
    enlacesIgnorados: 0,
    paqueteIgnorado: opciones.paqueteIgnorado ?? false,
    truncada: lectura.truncada,
    recortada: false,
    libreBytes: lectura.libreBytes,
    factorMinutos: lectura.factorMinutos
  }
}
