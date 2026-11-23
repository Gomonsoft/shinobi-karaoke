import type { EventoProgresoIpc, ResumenCancionIpc, TrabajoIpc } from '@shared/ipc'
import type { EstadoSesionIpc } from '@shared/sesion'
import type { EstadoInsignia } from '../../componentes/InsigniaEstado'
import { BIB_COLA } from '../../sesion/textos'
import { textoReintentoRed } from '../../trabajos/useCuentaAtras'
import { textoDeError } from '../progreso/textos'
import { lineaDeTema } from './textosTema'
import { tituloDeError } from './textosError'
import { BIB_PREP } from './textosPreparacion'

/** Tipo de línea bajo la insignia; decide el icono y el color. */
export type TipoLinea = 'curso' | 'cola' | 'error' | 'aviso' | 'texto' | 'sinRed' | 'atencion'

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
export type AccionTarjeta =
  | 'reproducir'
  | 'continuar'
  | 'reintentar'
  | 'ver'
  | 'revisar'
  | 'elegirLetra'
  | 'anadirLetra'
  /** «Reintentar» de «Letra pendiente»: repite la búsqueda sin salir de la Biblioteca. */
  | 'reintentarBusqueda'

/** `bib.paso.modelo` / `bib.paso.reintento.memoria`. */
export const textoPasoModelo = (n: number): string => `Descargando el modelo ${n} %`
export const TEXTO_LETRA_LISTA = {
  ayuda: 'Se reproduce con la letra sincronizada por líneas, sin barrido.',
  aria: 'Letra lista, sin barrido'
}
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
  /** `title` de la insignia (solo Letra lista: `bib.estado.letraLista.ayuda`). */
  ayudaEstado?: string
  linea: LineaPasoDatos | null
  /** Acción principal visible (botón de la tarjeta); `null` en dañadas. */
  accion: AccionTarjeta | null
  /** Segundo botón de la fila (solo «Lista para revisar»: «▶ Probar»). */
  secundaria?: 'probar'
}

/**
 * ¿Es una «Lista para revisar»? Lo deriva main (`estadoPreparacion`); sin ese dato (resúmenes de
 * antes de 0.2.2 en pruebas) se deduce de los pasos con la misma regla.
 */
export function esListaParaRevisar(r: ResumenCancionIpc): boolean {
  if (r.danada || r.estado !== 'borrador') return false
  if (r.estadoPreparacion !== undefined) return r.estadoPreparacion === 'lista_para_revisar'
  const p = r.pasos
  return (
    p !== null &&
    p.fuente.estado === 'completado' &&
    p.separacion.estado === 'completado' &&
    p.letra.estado === 'completado' &&
    r.lineasSinSincronizar === 0
  )
}

/** Línea de origen de la letra elegida por la app (`bib.prep.origen.*`); `null` si no aplica. */
export function lineaDeOrigen(r: ResumenCancionIpc): LineaPasoDatos | null {
  const p = r.preparacion
  if (!p || !p.eleccionAutomatica || p.revisada) return null
  return {
    tipo: 'texto',
    texto: p.desfaseCorregido ? BIB_PREP.origen.autoCorregida : BIB_PREP.origen.auto
  }
}

/** Línea ⟳ de un paso de la preparación en curso (buscar, comprobar, ajustar fines). */
function lineaDePreparando(r: ResumenCancionIpc): LineaPasoDatos | null {
  if (r.estadoPreparacion !== 'preparando') return null
  const texto = {
    buscando_letra: BIB_PREP.paso.buscando,
    comprobando: BIB_PREP.paso.comprobando,
    ajustando_fines: BIB_PREP.paso.fines
  }[r.preparacion?.paso as 'buscando_letra' | 'comprobando' | 'ajustando_fines']
  return texto ? { tipo: 'curso', texto, barra: null } : null
}

/** Resultado de la búsqueda que necesita al usuario o a la red (spec 02, «Línea de paso»). */
function lineaDeResultado(
  r: ResumenCancionIpc
): { linea: LineaPasoDatos; accion: AccionTarjeta } | null {
  switch (r.estadoPreparacion) {
    case 'elige_letra':
      return {
        linea: {
          tipo: 'atencion',
          texto: BIB_PREP.paso.elige(r.preparacion?.busqueda?.candidatas ?? 0)
        },
        accion: 'elegirLetra'
      }
    case 'sin_letra':
      return {
        linea: { tipo: 'atencion', texto: BIB_PREP.paso.noEncontrada },
        accion: 'anadirLetra'
      }
    case 'instrumental':
      return {
        linea: { tipo: 'atencion', texto: BIB_PREP.paso.instrumental },
        accion: 'anadirLetra'
      }
    case 'letra_pendiente':
      return {
        linea: {
          tipo: 'sinRed',
          texto:
            r.preparacion?.busqueda?.motivo === 'SERVICIO_NO_DISPONIBLE'
              ? BIB_PREP.paso.pendienteServicio
              : BIB_PREP.paso.pendiente
        },
        accion: 'reintentarBusqueda'
      }
    default:
      return null
  }
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
  const preparando = lineaDePreparando(r)
  if (preparando) return { linea: preparando, accion: 'continuar', error: false }
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
  const resultado = lineaDeResultado(r)
  if (resultado) return { ...resultado, error: false }
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
    const letraLista = r.modalidad === 'letra_lista'
    return {
      insignia: letraLista ? 'letra-lista' : 'lista',
      textoEstado: letraLista ? TEXTO_LETRA_LISTA.aria : 'Lista',
      ...(letraLista ? { ayudaEstado: TEXTO_LETRA_LISTA.ayuda } : null),
      linea:
        r.incompleta && r.lineasSinSincronizar > 0
          ? { tipo: 'aviso', texto: textoSincronia(r.lineasSinSincronizar) }
          : null,
      accion: 'reproducir'
    }
  }
  if (!vivo && esListaParaRevisar(r)) {
    return {
      insignia: 'revisar',
      textoEstado: BIB_PREP.estado.revisar,
      ayudaEstado: BIB_PREP.ayudaRevisar,
      linea: lineaDeOrigen(r),
      accion: 'revisar',
      secundaria: 'probar'
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
  const rev = r.revision
  const conRevision =
    d.accion === 'revisar' && rev
      ? `${conPaso} ${rev.dudosas > 0 ? BIB_PREP.revision.linea(rev.dudosas) : BIB_PREP.revision.sinDudas}.`
      : conPaso
  return tema ? `${conRevision} Tema: ${tema.texto}.` : conRevision
}

/**
 * Portada: la miniatura con velo solo mientras la apariencia es neutra (ADR 0016 §3 y §9). Lo decide
 * main en `apariencia.neutra`; aquí no se comparan estilos ni se lee `config.estilo_predeterminado`.
 */
export function usaMiniatura(r: ResumenCancionIpc): boolean {
  return !r.danada && r.miniatura !== null && r.apariencia.neutra
}

/**
 * «Continuar» de un borrador que lleva sí o sí a Letra o al Editor (fuente y pistas completas):
 * con una sesión abierta queda bloqueado (spec 06, E1). Los demás destinos se deciden al pulsar.
 */
export function continuaHaciaEdicion(r: ResumenCancionIpc): boolean {
  return (
    !r.danada &&
    r.estado !== 'lista' &&
    r.pasos?.fuente.estado === 'completado' &&
    r.pasos.separacion.estado === 'completado'
  )
}

/** Línea de cola de la tarjeta (`bib.cola.sonando` / `bib.cola.enCola`); `null` si no aplica. */
export function lineaDeCola(estado: EstadoSesionIpc | null, cancionId: string): string | null {
  if (!estado) return null
  if (estado.sesion && estado.activa?.cancionId === cancionId) return BIB_COLA.sonando
  return estado.pendientes.some((e) => e.cancionId === cancionId) ? BIB_COLA.enCola : null
}

/** `bib.toast.lista` / `bib.toast.letraLista`: aviso al volver del editor tras marcar la canción. */
export function mensajeListaMarcada(r: ResumenCancionIpc): string {
  const titulo = tituloDeTarjeta(r)
  return r.modalidad === 'letra_lista'
    ? `«${titulo}» tiene la letra lista para cantar.`
    : `«${titulo}» está lista para cantar.`
}
