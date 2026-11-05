import type { EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { TEXTO, textoCola, textoDeError } from './textos'

/** Lógica pura de la vista de progreso (docs/ux/04 §1): filas, bloque inferior y anuncios. */

export type IconoFila = 'pendiente' | 'curso' | 'completado' | 'error' | 'interrumpido' | 'cola'
export type IdFila = 'descargar' | 'preparar' | 'separar'

export interface Fila {
  id: IdFila
  etiqueta: string
  icono: IconoFila
  /** Dato a la derecha (MB descargados al terminar). */
  dato: string | null
  texto: string | null
  /** `null` = sin barra; `'indeterminada'`; o 0-100. */
  barra: number | 'indeterminada' | null
  eta: string | null
}

export type Bloque =
  | { tipo: 'mientras' }
  | { tipo: 'pendiente' }
  | { tipo: 'error'; codigo: string; mensaje: string; reintentable: boolean }
  | { tipo: 'interrumpido' }
  | { tipo: 'ninguno' }

export interface EntradaModelo {
  tipoFuente: 'archivo' | 'youtube'
  fuente: { estado: string; error: { codigo: string; mensaje: string } | null }
  vivo: { trabajo: TrabajoIpc; progreso: EventoProgresoIpc | null } | null
  /** Título de la canción cuya descarga ocupa la cola `ligera`; `null` si es mantenimiento o no se sabe. */
  tituloOtra: string | null
  /** La cola `ligera` está ocupada por otro trabajo. */
  colaOcupada: boolean
  /** Bytes descargados al terminar la descarga (recordados mientras la vista está abierta). */
  bytesFinales: number | null
  /** Valor 0-1 ya mostrado (la barra no retrocede). */
  piso?: number
}

export interface ModeloProgreso {
  filas: Fila[]
  bloque: Bloque
  /** Qué botón de cancelar mostrar. */
  cancelar: 'cola' | 'curso' | null
}

export const formatearMB = (bytes: number): string =>
  `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB`

/** `prog.eta` completo. */
export function textoEtaLargo(segundos: number): string {
  if (segundos < 60) return 'menos de 1 minuto'
  const m = Math.round(segundos / 60)
  return m <= 1 ? 'queda 1 minuto aprox.' : `quedan unos ${m} minutos`
}

const pct = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 100)

function filaDescarga(e: EntradaModelo): Fila {
  const base: Fila = {
    id: 'descargar',
    etiqueta: TEXTO.descargar,
    icono: 'pendiente',
    dato: null,
    texto: null,
    barra: null,
    eta: null
  }
  const { vivo } = e
  if (vivo) {
    const t = vivo.trabajo
    if (t.estado === 'en_cola') {
      const pos = t.posicion !== null && t.posicion > 1 ? ` · ${t.posicion}.ª en la cola` : ''
      const texto =
        t.motivo === 'mantenimiento'
          ? TEXTO.colaMantenimiento
          : e.tituloOtra !== null
            ? textoCola(e.tituloOtra)
            : e.colaOcupada
              ? TEXTO.colaMantenimiento
              : 'En cola.'
      return { ...base, icono: 'cola', texto: texto + pos }
    }
    const p = vivo.progreso ?? t.progreso
    const fase = p?.fase ?? 'descargando'
    if (fase === 'preparando') {
      return {
        ...base,
        icono: 'completado',
        dato: e.bytesFinales ? formatearMB(e.bytesFinales) : null
      }
    }
    if (fase === 'actualizando') {
      return { ...base, icono: 'curso', texto: TEXTO.reintentoYtdlp, barra: 'indeterminada' }
    }
    const valor = p?.valor ?? null
    if (valor === null)
      return { ...base, icono: 'curso', texto: 'Descargando…', barra: 'indeterminada' }
    const v = pct(Math.max(valor, e.piso ?? 0))
    const bytes = p?.detalle?.bytes
    const total = p?.detalle?.total
    let texto = `Descargando… ${v} %`
    if (bytes !== undefined && total) texto += ` · ${formatearMB(bytes)} de ${formatearMB(total)}`
    const eta = p && p.etaSegundos !== null ? textoEtaLargo(p.etaSegundos) : TEXTO.etaCalculando
    return { ...base, icono: 'curso', texto, barra: v, eta }
  }
  switch (e.fuente.estado) {
    case 'completado':
      return {
        ...base,
        icono: 'completado',
        dato: e.bytesFinales ? formatearMB(e.bytesFinales) : null
      }
    case 'error':
      return { ...base, icono: 'error' }
    case 'interrumpido':
      return { ...base, icono: 'interrumpido' }
    case 'en_curso':
      return { ...base, icono: 'curso', barra: 'indeterminada' }
    default:
      return base
  }
}

function filaPreparar(e: EntradaModelo): Fila {
  const base: Fila = {
    id: 'preparar',
    etiqueta: TEXTO.preparar,
    icono: 'pendiente',
    dato: null,
    texto: null,
    barra: null,
    eta: null
  }
  const fase =
    e.vivo?.trabajo.estado === 'en_curso'
      ? (e.vivo.progreso ?? e.vivo.trabajo.progreso)?.fase
      : null
  if (fase === 'preparando') {
    return { ...base, icono: 'curso', texto: TEXTO.preparando, barra: 'indeterminada' }
  }
  if (!e.vivo && e.fuente.estado === 'completado') return { ...base, icono: 'completado' }
  return base
}

/** Modelo de la vista a partir de lo persistido y del trabajo vivo de la fuente. */
export function modeloDeProgreso(e: EntradaModelo): ModeloProgreso {
  const filas: Fila[] = []
  if (e.tipoFuente === 'youtube') filas.push(filaDescarga(e))
  filas.push(filaPreparar(e))
  // Provisional (Fase 3): la separación aparece siempre pendiente y sin acciones.
  filas.push({
    id: 'separar',
    etiqueta: TEXTO.separar,
    icono: 'pendiente',
    dato: null,
    texto: null,
    barra: null,
    eta: null
  })

  let bloque: Bloque
  let cancelar: ModeloProgreso['cancelar'] = null
  if (e.vivo) {
    bloque = { tipo: 'mientras' }
    if (e.tipoFuente === 'youtube')
      cancelar = e.vivo.trabajo.estado === 'en_cola' ? 'cola' : 'curso'
  } else if (e.fuente.estado === 'error') {
    const codigo = e.fuente.error?.codigo ?? ''
    bloque = {
      tipo: 'error',
      codigo,
      mensaje: e.fuente.error?.mensaje ?? '',
      reintentable: e.tipoFuente === 'youtube' && textoDeError(codigo).reintentable
    }
  } else if (e.fuente.estado === 'interrumpido') {
    bloque = { tipo: 'interrumpido' }
  } else if (e.fuente.estado === 'pendiente' && e.tipoFuente === 'youtube') {
    bloque = { tipo: 'pendiente' }
  } else if (e.fuente.estado === 'completado') {
    bloque = { tipo: 'mientras' }
  } else {
    bloque = { tipo: 'ninguno' }
  }
  return { filas, bloque, cancelar }
}

/** Instantánea para los anuncios a lectores de pantalla. */
export type Instantanea = Record<string, { icono: IconoFila; tramo: number }>

export const instantanea = (m: ModeloProgreso): Instantanea =>
  Object.fromEntries(
    m.filas.map((f) => [
      f.id,
      { icono: f.icono, tramo: typeof f.barra === 'number' ? Math.floor(f.barra / 25) * 25 : 0 }
    ])
  )

/** Mensaje a anunciar al pasar de `antes` a `ahora`: inicio, 25/50/75 %, fin y error (o `null`). */
export function anuncio(
  antes: Instantanea | null,
  ahora: Instantanea,
  m: ModeloProgreso
): string | null {
  if (!antes) return null
  for (const f of m.filas) {
    const a = antes[f.id]
    const n = ahora[f.id]
    if (!a || !n) continue
    if (n.icono === 'error' && a.icono !== 'error') {
      return `Error: ${f.etiqueta}`
    }
    if (n.icono === 'completado' && a.icono !== 'completado') return `${f.etiqueta}: terminado`
    if (n.icono === 'curso' && a.icono !== 'curso') return `${f.etiqueta}: en curso`
    if (n.icono === 'curso' && n.tramo > a.tramo && n.tramo >= 25)
      return `${f.etiqueta}: ${n.tramo} %`
  }
  return null
}
