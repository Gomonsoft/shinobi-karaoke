import type { EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { textoReintentoRed } from '../../trabajos/useCuentaAtras'
import { textoEstimacionPrevia } from '@shared/estimacion'
import { SEP, TEXTO, textoCola, textoDeError } from './textos'

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
  /** Fase de la separación en curso (un cambio de fase se anuncia). */
  fase?: string
  /** Anuncio del inicio de la fase, sin valores interpolados (0064). */
  textoFase?: string
}

export type ModoSeparacion = 'calidad' | 'rapido'

export type Bloque =
  /** `editor`: ya hay letra, el primario pasa a "Ir al editor" (ux/00 §3). */
  | { tipo: 'mientras'; editor?: true }
  /** Separación terminada con la vista abierta: duración, escucha y primario (0069). */
  | { tipo: 'terminado'; editor?: true }
  | { tipo: 'pendiente' }
  /** La separación quedó pendiente (tras cancelar) o nunca se lanzó. */
  | { tipo: 'pendienteSeparacion'; estimacion: string | null }
  | { tipo: 'interrumpidoSeparacion' }
  | {
      tipo: 'errorSeparacion'
      codigo: string
      mensaje: string
      modo: ModoSeparacion
      /** `dialogo`: "Usar el modelo Rápido…"; `directa`: "Usar el modelo Rápido" (ya aceptado). */
      oferta: 'dialogo' | 'directa' | null
      /** Añade la línea `rapido.oferta.separacion` al banner. */
      textoOferta: boolean
      /** "Reintentar" repite primero `aceptarYUsarRapido('separacion')` sin diálogo. */
      reintentaRapido: boolean
      /** Error de la descarga de Rápido (no de la separación): sin oferta. */
      deDescargaRapido: boolean
    }
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
  /** Segundos que faltan para el reintento de red en curso (cuenta atrás de la interfaz). */
  esperaS?: number | null
  /** Paso `separacion` persistido (0068). */
  separacion?: {
    estado: string
    error: { codigo: string; mensaje: string } | null
    /** Duración real de la separación (0069). */
    segundos?: number | null
  }
  /** Trabajo vivo de la separación. */
  vivoSep?: { trabajo: TrabajoIpc; progreso: EventoProgresoIpc | null } | null
  /** Título de la canción que ocupa la cola `pesada`. */
  tituloOtraSep?: string | null
  /** Estimación previa de `separacion.estimar` (minutos, 0067). */
  estimacion?: { min: number; max: number } | null
  /** Modelo realmente usado (trabajo vivo, `pistas.modelo` o vigente). */
  modo?: ModoSeparacion
  ofrecerRapido?: boolean
  rapidoPendiente?: boolean
  /** Descarga de Rápido aceptada en esta vista, en curso. */
  aceptandoRapido?: { bytes: number; total: number | null } | null
  /** Error de la descarga de Rápido aceptada en esta vista. */
  errorRapido?: { codigo: string; mensaje: string } | null
  hayLetra?: boolean
  /** Valor 0-1 ya mostrado en la fase determinada de la separación. */
  pisoSep?: number
}

export interface ModeloProgreso {
  filas: Fila[]
  bloque: Bloque
  /** Qué botón de cancelar mostrar. */
  cancelar: 'cola' | 'curso' | null
  /** A qué paso se refiere `cancelar`. */
  cancelarPaso: 'fuente' | 'separacion'
}

export const formatearMB = (bytes: number): string =>
  `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB`

/** Duración real: "48 s", "2 min" o "1 min 48 s". */
export function formatearDuracion(segundos: number): string {
  const total = Math.max(0, Math.round(segundos))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s} s`
  return s === 0 ? `${m} min` : `${m} min ${s} s`
}

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
    if (fase === 'reintentando' && e.esperaS) {
      // `prog.reintento.red`: cuenta como descarga en curso, sin barra ni banner de error.
      return { ...base, icono: 'curso', texto: textoReintentoRed(e.esperaS) }
    }
    if (fase === 'actualizando') {
      return { ...base, icono: 'curso', texto: TEXTO.reintentoYtdlp, barra: 'indeterminada' }
    }
    const valor = p?.valor ?? null
    if (valor === null)
      return { ...base, icono: 'curso', texto: 'Descargando…', barra: 'indeterminada' }
    const v = pct(Math.max(valor, e.piso ?? 0))
    const progresoBytes = p?.detalle && 'bytes' in p.detalle ? p.detalle : null
    const bytes = progresoBytes?.bytes
    const total = progresoBytes?.total
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

const textoEstimacion = (e: EntradaModelo): string | null =>
  e.estimacion
    ? textoEstimacionPrevia({ min: e.estimacion.min * 60, max: e.estimacion.max * 60 })
    : null

function filaSeparar(e: EntradaModelo): Fila {
  const base: Fila = {
    id: 'separar',
    etiqueta: TEXTO.separar,
    icono: 'pendiente',
    dato: null,
    texto: null,
    barra: null,
    eta: null
  }
  const previa = textoEstimacion(e)
  if (e.aceptandoRapido) {
    const { bytes, total } = e.aceptandoRapido
    const v = total ? pct(bytes / total) : null
    return {
      ...base,
      icono: 'curso',
      texto: SEP.modelo(true, v ?? 0, formatearMB(bytes), total ? formatearMB(total) : null),
      barra: v ?? 'indeterminada',
      fase: 'modelo-rapido',
      textoFase: 'Descargando el modelo Rápido.'
    }
  }
  const vivo = e.vivoSep
  if (vivo) {
    const t = vivo.trabajo
    if (t.estado === 'en_cola') {
      const pos = t.posicion !== null && t.posicion > 1 ? ` · ${t.posicion}.ª en la cola` : ''
      const texto = e.tituloOtraSep ? SEP.cola(e.tituloOtraSep) : SEP.colaSinTitulo
      return { ...base, icono: 'cola', texto: texto + pos, eta: previa }
    }
    const p = vivo.progreso ?? t.progreso
    const fase = p?.fase ?? 'preparando'
    const detalle = p?.detalle
    switch (fase) {
      case 'descargando_modelo': {
        const d = detalle && 'bytes' in detalle ? detalle : null
        const rapido = t.modo === 'rapido'
        const valor = p?.valor ?? (d?.total ? d.bytes / d.total : null)
        const v = valor === null ? null : pct(Math.max(valor, e.pisoSep ?? 0))
        return {
          ...base,
          icono: 'curso',
          texto: SEP.modelo(
            rapido,
            v ?? 0,
            formatearMB(d?.bytes ?? 0),
            d?.total ? formatearMB(d.total) : null
          ),
          barra: v ?? 'indeterminada',
          fase: 'modelo',
          textoFase: `Descargando el modelo ${rapido ? 'Rápido' : 'Calidad'}.`
        }
      }
      case 'separando': {
        const v = pct(Math.max(p?.valor ?? 0, e.pisoSep ?? 0))
        const eta = p && p.etaSegundos !== null ? textoEtaLargo(p.etaSegundos) : TEXTO.etaCalculando
        return {
          ...base,
          icono: 'curso',
          texto: SEP.separando(v),
          barra: v,
          eta,
          fase: 'separando',
          textoFase: 'Separando la voz de la música.'
        }
      }
      case 'guardando':
        return {
          ...base,
          icono: 'curso',
          texto: SEP.guardando,
          barra: 'indeterminada',
          fase: 'guardando',
          textoFase: SEP.guardando
        }
      case 'reintentando': {
        const cpu = detalle && 'motivo' in detalle && detalle.motivo === 'memoria_cpu'
        const texto = cpu ? SEP.reintentoMemoriaCpu : SEP.reintentoMemoria
        return {
          ...base,
          icono: 'curso',
          texto,
          barra: 'indeterminada',
          fase: cpu ? 'reintento-cpu' : 'reintento',
          textoFase: texto
        }
      }
      default:
        return {
          ...base,
          icono: 'curso',
          texto: SEP.cargando,
          barra: 'indeterminada',
          eta: previa,
          fase: 'cargando',
          textoFase: SEP.cargando
        }
    }
  }
  switch (e.separacion?.estado) {
    case 'completado': {
      const s = e.separacion?.segundos
      return {
        ...base,
        icono: 'completado',
        dato: typeof s === 'number' ? formatearDuracion(s) : null
      }
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

/** Modelo de la vista a partir de lo persistido y del trabajo vivo de la fuente. */
export function modeloDeProgreso(e: EntradaModelo): ModeloProgreso {
  const filas: Fila[] = []
  if (e.tipoFuente === 'youtube') filas.push(filaDescarga(e))
  filas.push(filaPreparar(e))
  filas.push(filaSeparar(e))

  let bloque: Bloque
  let cancelar: ModeloProgreso['cancelar'] = null
  let cancelarPaso: ModeloProgreso['cancelarPaso'] = 'fuente'
  const mientras: Bloque = e.hayLetra ? { tipo: 'mientras', editor: true } : { tipo: 'mientras' }
  const sep = e.separacion
  if (e.vivo) {
    bloque = mientras
    if (e.tipoFuente === 'youtube')
      cancelar = e.vivo.trabajo.estado === 'en_cola' ? 'cola' : 'curso'
  } else if (e.vivoSep) {
    bloque = mientras
    cancelar = e.vivoSep.trabajo.estado === 'en_cola' ? 'cola' : 'curso'
    cancelarPaso = 'separacion'
  } else if (e.aceptandoRapido) {
    bloque = mientras
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
  } else if (e.fuente.estado === 'completado' && e.errorRapido) {
    const modo = e.modo ?? 'calidad'
    bloque = {
      tipo: 'errorSeparacion',
      codigo: e.errorRapido.codigo,
      mensaje: e.errorRapido.mensaje,
      modo,
      oferta: null,
      textoOferta: false,
      reintentaRapido: true,
      deDescargaRapido: true
    }
  } else if (e.fuente.estado === 'completado' && sep?.estado === 'error') {
    const codigo = sep.error?.codigo ?? ''
    const modo = e.modo ?? 'calidad'
    const ofertable = codigo === 'MEMORIA_INSUFICIENTE' || codigo === 'MODELO_NO_DISPONIBLE'
    const ofrecer = ofertable && e.ofrecerRapido === true && e.rapidoPendiente !== true
    bloque = {
      tipo: 'errorSeparacion',
      codigo,
      mensaje: sep.error?.mensaje ?? '',
      modo,
      oferta: ofrecer ? 'dialogo' : ofertable && e.rapidoPendiente === true ? 'directa' : null,
      textoOferta: ofrecer,
      reintentaRapido: e.rapidoPendiente === true,
      deDescargaRapido: false
    }
  } else if (e.fuente.estado === 'completado' && sep?.estado === 'interrumpido') {
    bloque = { tipo: 'interrumpidoSeparacion' }
  } else if (e.fuente.estado === 'completado' && sep?.estado === 'pendiente') {
    bloque = { tipo: 'pendienteSeparacion', estimacion: textoEstimacion(e) }
  } else if (e.fuente.estado === 'completado' && sep?.estado === 'completado') {
    bloque = e.hayLetra ? { tipo: 'terminado', editor: true } : { tipo: 'terminado' }
  } else if (e.fuente.estado === 'completado') {
    bloque = mientras
  } else {
    bloque = { tipo: 'ninguno' }
  }
  return { filas, bloque, cancelar, cancelarPaso }
}

/** Instantánea para los anuncios a lectores de pantalla. */
export type Instantanea = Record<
  string,
  { icono: IconoFila; tramo: number; fase: string | undefined }
>

export const instantanea = (m: ModeloProgreso): Instantanea =>
  Object.fromEntries(
    m.filas.map((f) => [
      f.id,
      {
        icono: f.icono,
        tramo: typeof f.barra === 'number' ? Math.floor(f.barra / 25) * 25 : 0,
        fase: f.fase
      }
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
    if (n.icono === 'completado' && a.icono !== 'completado')
      return f.id === 'separar' ? 'Terminado' : `${f.etiqueta}: terminado`
    if (n.icono === 'curso' && f.textoFase && (a.icono !== 'curso' || n.fase !== a.fase))
      return f.textoFase
    if (n.icono === 'curso' && a.icono !== 'curso') return `${f.etiqueta}: en curso`
    if (n.icono === 'curso' && n.tramo > a.tramo && n.tramo >= 25 && n.fase === a.fase)
      return `${f.etiqueta}: ${n.tramo} %`
  }
  return null
}
