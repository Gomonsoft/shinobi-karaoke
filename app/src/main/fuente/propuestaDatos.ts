import {
  claveFlexible,
  claveTexto,
  metadatosDeCarpeta,
  metadatosDeNombre,
  partirPorSeparador,
  tituloConRestos,
  type CampoPropuesto,
  type EtiquetasArchivo,
  type MusicaYoutube,
  type OrigenDato,
  type OrigenMetadatos,
  type OrigenPropuesta,
  type PropuestaDatos,
  type ValoresDatosIpc
} from '../../shared'

/** Fuente del archivo: etiquetas leídas por el worker y, en un lote desde carpeta, el nombre de ésta. */
export interface EntradaArchivo {
  tipo: 'archivo'
  nombre: string
  etiquetas?: Partial<EtiquetasArchivo>
  carpeta?: string | null
}

/** Fuente de YouTube: campos de música del vídeo, título y canal ya limpios por el worker. */
export interface EntradaYoutube {
  tipo: 'youtube'
  musica?: Partial<MusicaYoutube>
  /** Título del vídeo sin «(Official Video)», «ft. …», etc. */
  tituloLimpio: string
  /** Canal sin « - Topic», «VEVO» y «Official». */
  canalLimpio: string
  /** Título de la lista, solo en un lote desde una lista que es un álbum. */
  lista?: string | null
}

export interface ResultadoPropuesta {
  datos: PropuestaDatos
  /** Qué se guarda en `metadatos.origen` si el usuario no cambia el campo. */
  guardado: OrigenMetadatos
}

interface Candidato {
  valor: string
  origen: OrigenPropuesta | null
  dudoso: boolean
  invertido?: true
}

const VACIO: Candidato = { valor: '', origen: null, dudoso: false }
const texto = (t: string | undefined | null): string => (t ?? '').trim()

const cand = (
  valor: string | undefined | null,
  origen: OrigenPropuesta,
  dudoso = false
): Candidato => (texto(valor) === '' ? VACIO : { valor: texto(valor), origen, dudoso })

const primero = (...c: Candidato[]): Candidato => c.find((x) => x.valor !== '') ?? VACIO

const guardadoDe = (origen: OrigenPropuesta | null): OrigenDato | undefined =>
  origen === null ? undefined : origen === 'etiquetas' || origen === 'pista' ? 'fuente' : 'nombre'

function coincide(a: string, b: string): boolean {
  const k = claveFlexible(a)
  return k !== null && k === claveFlexible(b)
}

function estaEn(valor: string, lista: { valor: string }[]): boolean {
  return lista.some((v) => coincide(v.valor, valor))
}

/**
 * Regla 2 de la spec: al partir por « - », si la parte derecha es un artista de la biblioteca (o el
 * canal) y la izquierda no, se proponen intercambiados.
 */
function invertir(izquierda: string, derecha: string, conocidos: { valor: string }[]): boolean {
  const esArtista = (v: string): boolean => estaEn(v, conocidos)
  return esArtista(derecha) && !esArtista(izquierda)
}

function deArchivo(e: EntradaArchivo, valores: ValoresDatosIpc): [Candidato, Candidato, Candidato] {
  const t = e.etiquetas ?? {}
  const n = metadatosDeNombre(e.nombre)
  const c = e.carpeta ? metadatosDeCarpeta(e.carpeta) : { artista: '', album: '' }
  let titulo = primero(
    cand(t.title, 'etiquetas'),
    cand(n.titulo, 'nombre', n.patron === 'ninguno' || tituloConRestos(n.titulo))
  )
  let artista = primero(
    cand(t.artist, 'etiquetas'),
    cand(t.album_artist, 'etiquetas'),
    cand(n.artista, 'nombre'),
    cand(c.artista, 'carpeta')
  )
  const album = primero(
    cand(t.album, 'etiquetas'),
    cand(n.album, 'nombre'),
    cand(c.album, 'carpeta')
  )
  if (
    titulo.origen === 'nombre' &&
    artista.origen === 'nombre' &&
    invertir(artista.valor, titulo.valor, valores.artistas)
  ) {
    ;[titulo, artista] = [
      { ...cand(artista.valor, 'nombre', true), invertido: true },
      { ...cand(titulo.valor, 'nombre', true), invertido: true }
    ]
  }
  return [titulo, artista, album]
}

function deYoutube(e: EntradaYoutube, valores: ValoresDatosIpc): [Candidato, Candidato, Candidato] {
  const m = e.musica ?? {}
  const partes = texto(m.track) === '' ? partirPorSeparador(e.tituloLimpio) : null
  let titulo = primero(
    cand(m.track, 'pista'),
    partes ? cand(partes[1], 'video', tituloConRestos(partes[1])) : VACIO,
    cand(e.tituloLimpio, 'video', tituloConRestos(e.tituloLimpio))
  )
  let artista = primero(
    cand(m.artist, 'pista'),
    cand(m.album_artist, 'pista'),
    partes ? cand(partes[0], 'video') : VACIO,
    cand(e.canalLimpio, 'canal', true)
  )
  const album = primero(cand(m.album, 'pista'), cand(e.lista, 'lista'))
  if (partes && titulo.origen === 'video' && artista.origen === 'video') {
    const conocidos = [...valores.artistas, { valor: e.canalLimpio }]
    if (invertir(partes[0], partes[1], conocidos)) {
      titulo = { ...cand(partes[0], 'video', true), invertido: true }
      artista = { ...cand(partes[1], 'video', true), invertido: true }
    }
  }
  return [titulo, artista, album]
}

/** «Como en tu biblioteca»: si solo difiere en tildes, puntuación o espacios, se usa la grafía existente. */
function comoEnBiblioteca(
  c: Candidato,
  lista: ValoresDatosIpc['artistas']
): Candidato & {
  alternativa?: string
} {
  if (c.valor === '') return c
  const clave = claveTexto(c.valor)
  if (lista.some((v) => claveTexto(v.valor) === clave)) return c
  const igual = lista.find((v) => coincide(v.valor, c.valor))
  return igual ? { ...c, valor: igual.valor, origen: 'biblioteca', alternativa: c.valor } : c
}

function campo(c: Candidato & { alternativa?: string }): CampoPropuesto {
  return {
    valor: c.valor,
    origen: c.origen,
    dudoso: c.dudoso,
    ...(c.invertido ? { invertido: true } : {}),
    ...(c.alternativa !== undefined ? { alternativa: c.alternativa } : {})
  }
}

/**
 * Propuesta de título, artista y álbum con su procedencia (ADR 0025 §6, spec 03 · Feature 6). Para
 * cada campo manda la primera fuente que da valor; después se aplica «Como en tu biblioteca».
 * Nunca falla: una fuente vacía pasa a la siguiente.
 */
export function proponerDatos(
  entrada: EntradaArchivo | EntradaYoutube,
  valores: ValoresDatosIpc
): ResultadoPropuesta {
  const [titulo, artista, album] =
    entrada.tipo === 'archivo' ? deArchivo(entrada, valores) : deYoutube(entrada, valores)
  return {
    datos: {
      titulo: campo(titulo),
      artista: campo(comoEnBiblioteca(artista, valores.artistas)),
      album: campo(comoEnBiblioteca(album, valores.albumes))
    },
    guardado: {
      titulo: guardadoDe(titulo.origen),
      artista: guardadoDe(artista.origen),
      album: guardadoDe(album.origen)
    }
  }
}

/**
 * `metadatos.origen` al confirmar: lo que el usuario dejó igual conserva la procedencia de la
 * fuente; lo que cambió (o escribió) es `usuario`. Un campo vacío no lleva origen.
 */
export function origenAlConfirmar(
  r: ResultadoPropuesta,
  confirmado: { titulo: string; artista: string; album: string | null }
): OrigenMetadatos | undefined {
  const de = (c: 'titulo' | 'artista' | 'album', valor: string | null): OrigenDato | undefined => {
    const v = (valor ?? '').trim()
    if (v === '') return undefined
    return v === r.datos[c].valor ? r.guardado[c] : 'usuario'
  }
  const origen: OrigenMetadatos = {
    titulo: de('titulo', confirmado.titulo),
    artista: de('artista', confirmado.artista),
    album: de('album', confirmado.album)
  }
  return Object.values(origen).some((v) => v !== undefined) ? origen : undefined
}
