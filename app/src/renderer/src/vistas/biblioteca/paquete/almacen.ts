import { useSyncExternalStore } from 'react'
import type {
  CambioCopiaIpc,
  ProgresoCopiaIpc,
  ResultadoExportacionCopiaIpc,
  ResultadoImportacionIpc
} from '@shared/ipc'
import { mostrarToast } from '../../../componentes/gestorToasts'
import { copiarDetalles } from '../../../soporte/detalles'
import { detallesDeError } from '../errores'
import { contarImportadas, esResultadoExportacion, esResultadoImportacion } from './modelo'
import { AJCOPIA, PAQ } from './textos'
import { formatearTamano } from '../../../exportacion/dialogo/textos'

/**
 * Estado de los paquetes y las copias (docs/ux/02 y 08 · Feature 9). Es global, como los toasts, porque
 * los trabajos siguen cuando se cierra el diálogo («Seguir en segundo plano») y se pueden abrir desde la
 * tarjeta, la Biblioteca vacía, Ajustes o arrastrando un `.shinobi`. El `ControladorPaquetes` pinta los
 * diálogos; los canales (`copias:cambio`, `copias:progreso`) se escuchan una sola vez desde él.
 */

export type PeticionExportar = { tipo: 'canciones'; ids: string[] } | { tipo: 'biblioteca' }

/** Importar: elegir el archivo con el selector del sistema o abrir el que se soltó sobre la ventana. */
export interface PeticionImportar {
  archivo?: File
}

export interface SeguimientoCopia {
  tipo: 'exportar' | 'importar'
  trabajoId: string
  estado: 'en_curso' | 'terminada' | 'error' | 'cancelada'
  fraccion: number
  cancion: ProgresoCopiaIpc['cancion'] | null
  codigo: string | null
  mensaje: string | null
  /** Se cancela y se espera el cambio de estado (`paq.creando.cancelando`). */
  cancelando: boolean
  /** Para los textos y para «Reintentar». */
  completo: boolean
  esCopia: boolean
  n: number
  /** Carpeta de destino (solo exportar), para «En {carpeta}». */
  carpeta: string | null
  peticion: PeticionExportar | null
  resultadoExp: ResultadoExportacionCopiaIpc | null
  resultadoImp: ResultadoImportacionIpc | null
  /** Título y artista de cada canción del paquete, para las filas del resultado de importar. */
  titulos: Readonly<Record<string, { titulo: string; artista: string }>>
}

/** Varias letras exportadas con alguna omitida o fallida: el resultado por canción (spec 02 · feature 8). */
export interface ResultadoLetras {
  escritas: number
  total: number
  omitidas: { id: string; motivo: string; titulo: string; artista: string }[]
  ubicacionId: string
}

export interface EstadoPaquetes {
  exportar: PeticionExportar | null
  importar: PeticionImportar | null
  seguimiento: SeguimientoCopia | null
  resultadoLetras: ResultadoLetras | null
}

let estado: EstadoPaquetes = {
  exportar: null,
  importar: null,
  seguimiento: null,
  resultadoLetras: null
}
const oyentes = new Set<() => void>()

function fijar(parcial: Partial<EstadoPaquetes>): void {
  estado = { ...estado, ...parcial }
  oyentes.forEach((o) => o())
}

export function usePaquetes(): EstadoPaquetes {
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    () => estado
  )
}

export const estadoPaquetes = (): EstadoPaquetes => estado

/** La última elección de «Qué incluye» y de «Incluir mis ajustes» (se recuerda mientras la app está abierta). */
export const eleccion = { completo: true, ajustes: true }

/** Solo para pruebas. */
export function reiniciarPaquetes(): void {
  buffer.clear()
  eleccion.completo = true
  eleccion.ajustes = true
  estado = { exportar: null, importar: null, seguimiento: null, resultadoLetras: null }
  oyentes.forEach((o) => o())
}

// --- Diálogos ----------------------------------------------------------------------------------------

export function abrirExportarPaquete(peticion: PeticionExportar): void {
  fijar({ exportar: peticion })
}

/** «Reintentar» tras un fallo: el mismo diálogo vuelve al formulario con las mismas canciones. */
export function reintentarExportarPaquete(peticion: PeticionExportar): void {
  fijar({ exportar: peticion, seguimiento: null })
}

export function cerrarExportarPaquete(): void {
  const s = estado.seguimiento
  fijar({
    exportar: null,
    // Un fin ya visto no se vuelve a mostrar.
    ...(s?.tipo === 'exportar' && s.estado !== 'en_curso' ? { seguimiento: null } : {})
  })
}

export function mostrarResultadoLetras(r: ResultadoLetras | null): void {
  fijar({ resultadoLetras: r })
}

export function abrirImportarPaquete(archivo?: File): void {
  fijar({ importar: archivo ? { archivo } : {} })
}

export function cerrarImportarPaquete(): void {
  const s = estado.seguimiento
  fijar({
    importar: null,
    ...(s?.tipo === 'importar' && s.estado !== 'en_curso' ? { seguimiento: null } : {})
  })
}

// --- Seguimiento del trabajo -------------------------------------------------------------------------

interface Ultimo {
  cambio?: CambioCopiaIpc
  progreso?: ProgresoCopiaIpc
}
/** Lo que llegó antes de que `exportar`/`importar` devolviera su `trabajoId`. */
const buffer = new Map<string, Ultimo>()

const recordar = (id: string, parte: Ultimo): void => {
  buffer.set(id, { ...buffer.get(id), ...parte })
  for (const k of buffer.keys()) {
    if (buffer.size <= 20) break
    buffer.delete(k)
  }
}

export type DatosSeguimiento = Pick<
  SeguimientoCopia,
  'tipo' | 'trabajoId' | 'completo' | 'esCopia' | 'n' | 'peticion'
> &
  Partial<Pick<SeguimientoCopia, 'titulos' | 'carpeta'>>

/** El trabajo acaba de aceptarse: desde aquí lo siguen los diálogos, Ajustes y el panel de actividad. */
export function iniciarSeguimiento(datos: DatosSeguimiento): void {
  const nuevo: SeguimientoCopia = {
    tipo: datos.tipo,
    trabajoId: datos.trabajoId,
    estado: 'en_curso',
    fraccion: 0,
    cancion: null,
    codigo: null,
    mensaje: null,
    cancelando: false,
    completo: datos.completo,
    esCopia: datos.esCopia,
    n: datos.n,
    carpeta: datos.carpeta ?? null,
    peticion: datos.peticion,
    resultadoExp: null,
    resultadoImp: null,
    titulos: datos.titulos ?? {}
  }
  fijar({ seguimiento: nuevo })
  const previo = buffer.get(datos.trabajoId)
  if (previo?.progreso) alProgreso(previo.progreso)
  if (previo?.cambio) alCambio(previo.cambio)
}

export function descartarSeguimiento(): void {
  fijar({ seguimiento: null })
}

export function marcarCancelando(): void {
  const s = estado.seguimiento
  if (s) fijar({ seguimiento: { ...s, cancelando: true } })
}

export function alProgreso(p: ProgresoCopiaIpc): void {
  recordar(p.trabajoId, { progreso: p })
  const s = estado.seguimiento
  if (!s || s.trabajoId !== p.trabajoId || s.estado !== 'en_curso') return
  fijar({
    seguimiento: {
      ...s,
      // Nunca retrocede.
      fraccion: Math.max(s.fraccion, Math.min(1, Math.max(0, p.fraccion))),
      cancion: p.cancion ?? s.cancion
    }
  })
}

export function alCambio(c: CambioCopiaIpc): void {
  recordar(c.trabajoId, { cambio: c })
  const s = estado.seguimiento
  if (!s || s.trabajoId !== c.trabajoId) return
  const terminal = c.estado === 'terminada' || c.estado === 'error' || c.estado === 'cancelada'
  const siguiente: SeguimientoCopia = {
    ...s,
    estado: c.estado === 'en_cola' || c.estado === 'en_curso' ? 'en_curso' : c.estado,
    codigo: c.codigo ?? s.codigo,
    resultadoExp: esResultadoExportacion(c.resultado) ? c.resultado : s.resultadoExp,
    resultadoImp: esResultadoImportacion(c.resultado) ? c.resultado : s.resultadoImp,
    fraccion: c.estado === 'terminada' ? 1 : s.fraccion
  }
  fijar({ seguimiento: siguiente })
  if (terminal && s.estado === 'en_curso') avisarFin(siguiente)
}

// --- Aviso al terminar con el diálogo cerrado -------------------------------------------------------

const mostrarEnCarpeta = (ubicacionId: string): void => {
  void window.shinobi.letras.mostrarEnCarpeta(ubicacionId).catch(() => undefined)
}

function avisarFin(s: SeguimientoCopia): void {
  const visible = s.tipo === 'exportar' ? estado.exportar !== null : estado.importar !== null
  if (visible) return
  if (s.tipo === 'exportar') {
    const r = s.resultadoExp
    if (s.estado === 'terminada' && r) {
      const tamano = formatearTamano(r.bytes)
      mostrarToast({
        tipo: 'exito',
        mensaje: s.esCopia
          ? AJCOPIA.toastOk(r.canciones, tamano)
          : PAQ.ok.toast(r.canciones, tamano),
        accion: {
          etiqueta: PAQ.ok.mostrar,
          alAccionar: () => mostrarEnCarpeta(r.ubicacionId)
        }
      })
      fijar({ seguimiento: null })
    } else if (s.estado === 'cancelada') {
      mostrarToast({ tipo: 'info', mensaje: PAQ.ok.toastCancelado })
      fijar({ seguimiento: null })
    } else {
      const peticion = s.peticion
      mostrarToast({
        tipo: 'error',
        mensaje: textoErrorCrear(s.codigo),
        ...(peticion
          ? {
              accion: {
                etiqueta: PAQ.error.reintentar,
                alAccionar: () => abrirExportarPaquete(peticion)
              }
            }
          : {}),
        accionSecundaria: {
          etiqueta: PAQ.error.copiar,
          alAccionar: () =>
            void copiarDetalles(detallesDeError({ codigo: s.codigo, mensaje: s.mensaje ?? '' }))
        }
      })
      fijar({ seguimiento: null })
    }
    return
  }
  const r = s.resultadoImp
  if (s.estado === 'error' || !r) {
    mostrarToast({ tipo: 'error', mensaje: PAQ.imp.errorGenerico })
    fijar({ seguimiento: null })
    return
  }
  const a = contarImportadas(r)
  const n = r.resultados.length
  const reabrir = (): void => abrirImportarPaquete()
  if (s.estado === 'terminada' && a === n) {
    const unica = n === 1 ? s.titulos[r.resultados[0]?.id ?? '']?.titulo : undefined
    mostrarToast({ tipo: 'exito', mensaje: PAQ.imp.toast(n, unica) })
    fijar({ seguimiento: null })
    return
  }
  mostrarToast({
    tipo: 'info',
    mensaje: s.estado === 'cancelada' ? PAQ.imp.toastCancelada : PAQ.imp.toastParcial(a, n),
    accion: { etiqueta: PAQ.imp.verResultado, alAccionar: reabrir }
  })
}

export function textoErrorCrear(codigo: string | null): string {
  if (codigo === 'SIN_ESPACIO') return PAQ.error.SIN_ESPACIO
  if (codigo === 'DESTINO_NO_DISPONIBLE') return PAQ.error.DESTINO_NO_DISPONIBLE
  return PAQ.error.generico
}

/** Se suscribe a los eventos de `copias`; devuelve la baja. Sin API de copias (pruebas sueltas), no hace nada. */
export function suscribirCopias(): () => void {
  const api = window.shinobi.copias
  if (typeof api?.alCambiar !== 'function') return () => undefined
  const bajas = [api.alCambiar(alCambio), api.alProgreso(alProgreso)]
  return () => bajas.forEach((baja) => baja())
}
