import type { EventoProgresoIpc, ResumenCancionIpc, TrabajoIpc } from '@shared/ipc'
import type { EstadoInsignia } from '../../componentes/InsigniaEstado'
import { textoReintentoRed } from '../../trabajos/useCuentaAtras'
import { textoDeError } from '../progreso/textos'
import { lineaDeTema } from './textosTema'
import { tituloDeError } from './textosError'

/** Tipo de línea bajo la insignia; decide el icono y el color. */
export type TipoLinea = 'curso' | 'cola' | 'error' | 'aviso' | 'texto'

export interface LineaPasoDatos {
  tipo: TipoLinea
  texto: string
  /** Barra bajo la línea: `null` = indeterminada; ausente = sin barra. Valor 0–100. */
  barra?: number | null
}

/** Trabajo activo de una canción con su último progreso en vivo (0014). */
export interface TrabajoVivo {
  trabajo: TrabajoIpc
  progreso: EventoProgresoIpc | null
  /** Segundos que faltan para el reintento de red en curso (cuenta atrás de la interfaz). */
  esperaS?: number | null
}

/** `ver`: error que repetir no arregla; abre la vista de progreso como "Continuar". */
export type AccionTarjeta = 'reproducir' | 'continuar' | 'reintentar' | 'ver'

/** `bib.paso.modelo` / `bib.paso.reintento.memoria`. */
export const textoPasoModelo = (n: number): string => `Descargando el modelo ${n} %`
export const TEXTO_REINTENTO_MEMORIA = 'Reintentando la separación…'

/**
 * Paso con error o interrumpido que "Reintentar" relanza (el primero, como la línea de paso), o
 * `null` si no hay ninguno.
 */
export function pasoConProblema(r: ResumenCancionIpc): 'fuente' | 'separacion' | null {
  for (const nombre of ['fuente', 'separacion'] as const) {
    const e = r.pasos?.[nombre]?.estado
    if (e === 'error' || e === 'interrumpido') return nombre
  }
  return null
}

/** ¿Repetir el paso lo arregla? Los errores no reintentables llevan a "Ver". */
export function esReintentable(r: ResumenCancionIpc): boolean {
  const p = pasoConProblema(r)
  const paso = p ? r.pasos?.[p] : null
  if (paso?.estado === 'error' && paso.error?.codigo === 'RUNTIME_NO_DISPONIBLE') return false
  if (p !== 'fuente') return true
  return paso?.estado !== 'error' || textoDeError(paso.error?.codigo ?? '').reintentable
}

export interface DatosTarjeta {
  insignia: EstadoInsignia
  /** Texto de la insignia (para lectores: "Lista", "Borrador", "Dañada", "Error"). */
  textoEstado: string
  linea: LineaPasoDatos | null
  /** Acción principal visible (botón de la tarjeta); `null` en dañadas. */
  accion: AccionTarjeta | null
}

/** `bib.paso.sincronia` / `bib.lista.incompleta` (sin el icono ⚠: lo pone el componente). */
export function textoSincronia(n: number): string {
  return `${n === 1 ? 'Falta 1 línea' : `Faltan ${n} líneas`} por sincronizar`
}

/** `m:ss` (o `h:mm:ss` desde la hora); `null` si no hay duración. */
export function formatearDuracion(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null
  const total = Math.round(ms / 1000)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** `prog.eta` en versión corta para la tarjeta; `null` si aún no hay estimación. */
export function textoEta(segundos: number | null | undefined): string | null {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return null
  if (segundos < 60) return 'queda menos de 1 min'
  const minutos = Math.round(segundos / 60)
  return minutos <= 1 ? 'queda alrededor de 1 min' : `quedan unos ${minutos} min`
}

/**
 * Línea de un borrador con trabajo activo (docs/ux/02 "Línea de paso"). Cada actualización
 * en vivo prevalece sobre lo persistido en `cancion.json`.
 */
function lineaDeTrabajo({ trabajo, progreso, esperaS }: TrabajoVivo): LineaPasoDatos {
  const separacion = trabajo.paso === 'separacion'
  if (trabajo.estado === 'en_cola') {
    return {
      tipo: 'cola',
      texto: separacion ? 'En cola para separar' : 'En cola para descargar'
    }
  }
  const fase = progreso?.fase ?? trabajo.progreso?.fase
  if (!separacion && fase === 'reintentando' && esperaS) {
    // `bib.paso.reintento.red`: sin barra, no es un error.
    return { tipo: 'curso', texto: textoReintentoRed(esperaS) }
  }
  if (separacion && fase === 'descargando_modelo') {
    // `bib.paso.modelo`: barra determinada, sin tiempo restante y nunca como error.
    const d = progreso?.detalle ?? trabajo.progreso?.detalle
    const v =
      progreso?.valor ??
      trabajo.progreso?.valor ??
      (d && 'bytes' in d && d.total ? d.bytes / d.total : null)
    return v === null
      ? { tipo: 'curso', texto: 'Descargando el modelo…', barra: null }
      : { tipo: 'curso', texto: textoPasoModelo(porcentaje(v)), barra: porcentaje(v) }
  }
  if (separacion && fase === 'reintentando') {
    const d = progreso?.detalle ?? trabajo.progreso?.detalle
    if (d && 'motivo' in d && d.motivo !== 'red') {
      return { tipo: 'curso', texto: TEXTO_REINTENTO_MEMORIA, barra: null }
    }
  }
  if (!separacion && fase === 'actualizando') {
    return { tipo: 'curso', texto: 'Actualizando el descargador…', barra: null }
  }
  const valor = progreso?.valor ?? trabajo.progreso?.valor ?? null
  if (valor === null) {
    return {
      tipo: 'curso',
      texto: separacion ? 'Preparando la separación…' : 'Preparando el audio…',
      barra: null
    }
  }
  const n = porcentaje(valor)
  const eta = textoEta(progreso ? progreso.etaSegundos : trabajo.progreso?.etaSegundos)
  const base = separacion ? `Separando ${n} %` : `Descargando ${n} %`
  return { tipo: 'curso', texto: eta ? `${base} · ${eta}` : base, barra: n }
}

const porcentaje = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 100)

/**
 * Línea de paso de un borrador (docs/ux/02 "Línea de paso"): el primer paso no completado,
 * con prioridad para trabajos activos y problemas. El progreso sale de lo persistido en
 * `cancion.json` (sin tiempo restante ni cola real: llegan con el gestor de trabajos, Fase 3).
 */
export function lineaDeBorrador(
  r: ResumenCancionIpc,
  vivo?: TrabajoVivo | null
): {
  linea: LineaPasoDatos
  accion: AccionTarjeta
  error: boolean
} {
  if (vivo) return { linea: lineaDeTrabajo(vivo), accion: 'continuar', error: false }
  const pasos = r.pasos
  const fuente = pasos?.fuente
  const separacion = pasos?.separacion

  if (fuente?.estado === 'en_curso') {
    const p = fuente.progreso
    return {
      linea:
        p === null || p === undefined
          ? { tipo: 'curso', texto: 'Preparando el audio…', barra: null }
          : { tipo: 'curso', texto: `Descargando ${porcentaje(p)} %`, barra: porcentaje(p) },
      accion: 'continuar',
      error: false
    }
  }
  if (separacion?.estado === 'en_curso') {
    const p = separacion.progreso
    return {
      linea:
        p === null || p === undefined
          ? { tipo: 'curso', texto: 'Preparando la separación…', barra: null }
          : { tipo: 'curso', texto: `Separando ${porcentaje(p)} %`, barra: porcentaje(p) },
      accion: 'continuar',
      error: false
    }
  }
  for (const paso of [fuente, separacion]) {
    if (paso?.estado === 'error') {
      return {
        linea: { tipo: 'error', texto: tituloDeError(paso.error?.codigo ?? '') },
        accion: esReintentable(r) ? 'reintentar' : 'ver',
        error: true
      }
    }
  }
  if (fuente?.estado === 'interrumpido' || separacion?.estado === 'interrumpido') {
    return {
      linea: { tipo: 'aviso', texto: 'Interrumpido' },
      accion: 'reintentar',
      error: false
    }
  }
  if (fuente && fuente.estado !== 'completado') {
    return {
      linea: { tipo: 'texto', texto: 'Falta descargar el audio' },
      accion: 'continuar',
      error: false
    }
  }
  if (separacion && separacion.estado !== 'completado') {
    return {
      linea: { tipo: 'texto', texto: 'Falta separar las pistas' },
      accion: 'continuar',
      error: false
    }
  }
  if (r.lineasSinSincronizar > 0) {
    return {
      linea: { tipo: 'texto', texto: textoSincronia(r.lineasSinSincronizar) },
      accion: 'continuar',
      error: false
    }
  }
  if (pasos?.letra.estado !== 'completado') {
    return { linea: { tipo: 'texto', texto: 'Falta la letra' }, accion: 'continuar', error: false }
  }
  return {
    linea: { tipo: 'texto', texto: 'Lista para revisar' },
    accion: 'continuar',
    error: false
  }
}

/** Todo lo que la tarjeta necesita saber del estado de una canción. */
/** Título visible: una canción con `cancion.json` ilegible no muestra el nombre de la carpeta. */
export function tituloDeTarjeta(r: ResumenCancionIpc): string {
  return r.danada && r.motivo === 'json' ? 'Canción sin nombre' : r.titulo
}

export function datosDeTarjeta(r: ResumenCancionIpc, vivo?: TrabajoVivo | null): DatosTarjeta {
  if (r.danada) {
    return {
      insignia: 'danada',
      textoEstado: 'Dañada',
      // Re-separando: la línea del trabajo ("En cola para separar", "Separando…") sustituye al aviso.
      linea: vivo
        ? lineaDeTrabajo(vivo)
        : {
            tipo: 'error',
            texto:
              r.motivo === 'pistas'
                ? 'Faltan las pistas separadas'
                : 'No se puede abrir esta canción'
          },
      accion: null
    }
  }
  if (r.estado === 'lista') {
    return {
      insignia: 'lista',
      textoEstado: 'Lista',
      linea:
        r.incompleta && r.lineasSinSincronizar > 0
          ? { tipo: 'aviso', texto: textoSincronia(r.lineasSinSincronizar) }
          : null,
      accion: 'reproducir'
    }
  }
  const { linea, accion, error } = lineaDeBorrador(r, vivo)
  return {
    insignia: error ? 'error' : 'borrador',
    textoEstado: error ? 'Error' : 'Borrador',
    linea,
    accion
  }
}

/** Línea de tema visible: una canción con `cancion.json` ilegible no tiene apariencia que mostrar. */
export function temaDeTarjeta(r: ResumenCancionIpc): ReturnType<typeof lineaDeTema> | null {
  return r.danada && r.motivo === 'json' ? null : lineaDeTema(r.apariencia)
}

/** `bib.aria.tarjeta`: "{título}, {artista}, {estado}. {línea de paso}. Tema: {línea de tema}." */
export function textoAriaTarjeta(r: ResumenCancionIpc, d: DatosTarjeta): string {
  const quien = r.artista === '' ? '' : `${r.artista}, `
  const base = `${tituloDeTarjeta(r)}, ${quien}${d.textoEstado}.`
  const tema = temaDeTarjeta(r)
  const conPaso = d.linea ? `${base} ${d.linea.texto}.` : base
  return tema ? `${conPaso} Tema: ${tema.texto}.` : conPaso
}

/**
 * Portada: la miniatura con velo solo mientras la apariencia es neutra (ADR 0016 §3 y §9). Lo decide
 * main en `apariencia.neutra`; aquí no se comparan estilos ni se lee `config.estilo_predeterminado`.
 */
export function usaMiniatura(r: ResumenCancionIpc): boolean {
  return !r.danada && r.miniatura !== null && r.apariencia.neutra
}
