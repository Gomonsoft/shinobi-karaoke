import type {
  AbrirCancionIpc,
  AvisoTrabajoIpc,
  Cancion,
  DestinoAviso,
  TrabajoIpc
} from '../../shared'
import { AVISOS, puedeMarcarseLista, tituloErrorAviso } from '../../shared'

/** Notificación del sistema (Electron `Notification`). */
export interface Notificador {
  soportado(): boolean
  /** `alClic` al pulsarla; `alFallar` si el sistema no pudo mostrarla (macOS sin firma, sin libnotify). */
  mostrar(n: { titulo: string; cuerpo: string; alClic: () => void; alFallar: () => void }): void
}

/** Icono del Dock de macOS. */
export interface Dock {
  rebotar(): void
  /** Cadena vacía quita la insignia. */
  fijarInsignia(texto: string): void
}

/** Ventana principal. */
export interface Ventana {
  /** `false` si está minimizada, oculta o sin foco. */
  enfocada(): boolean
  parpadear(activo: boolean): void
  traer(): void
}

export interface DepsAvisos {
  plataforma: NodeJS.Platform
  ventana: () => Ventana | null
  notificador: Notificador
  dock: Dock
  /** Envía un evento al renderer. */
  difundirAviso: (aviso: AvisoTrabajoIpc) => void
  difundirAbrir: (evento: AbrirCancionIpc) => void
  obtenerCancion: (id: string) => Cancion | null
  registrar?: (nivel: 'aviso', mensaje: string) => void
}

/** Aviso que corresponde a un trabajo terminado; `null` si no hay que avisar (cancelado, etc.). */
export function avisoDeTrabajo(
  t: TrabajoIpc,
  obtenerCancion: (id: string) => Cancion | null
): AvisoTrabajoIpc | null {
  if (t.estado !== 'terminado') return null
  const cancion = obtenerCancion(t.cancionId)
  if (!cancion) return null
  const titulo = cancion.metadatos.titulo
  if (t.resultado === 'completado') {
    // La descarga que encadena la separación no avisa: avisa la separación al terminar.
    if (t.paso !== 'separacion') return null
    const lista = puedeMarcarseLista(cancion)
    return {
      cancionId: t.cancionId,
      tipo: lista ? 'lista' : 'ok',
      texto: lista ? AVISOS.lista(titulo) : AVISOS.ok(titulo),
      etiqueta: lista ? AVISOS.etiquetaLista : AVISOS.etiquetaOk,
      destino: lista ? 'editor' : 'progreso'
    }
  }
  if (t.resultado === 'error') {
    const tituloError = tituloErrorAviso(t.paso, t.error?.codigo ?? '', t.modo ?? 'calidad')
    return {
      cancionId: t.cancionId,
      tipo: 'error',
      texto: AVISOS.error(titulo, tituloError),
      etiqueta: AVISOS.etiquetaError,
      destino: 'progreso'
    }
  }
  return null
}

/**
 * Avisos del sistema (0072, `arquitectura.md` §6). Siempre envía el aviso al renderer (que muestra el
 * toast o lo guarda hasta recuperar el foco). Con la ventana sin foco, además: Windows y Linux,
 * notificación y parpadeo; macOS (sin firma), rebote del Dock e insignia con los avisos pendientes.
 */
export class ServicioAvisos {
  private pendientes = 0

  constructor(private readonly deps: DepsAvisos) {}

  /** Cambio de un trabajo del gestor (suscripción). */
  alCambiarTrabajo(t: TrabajoIpc): void {
    const aviso = avisoDeTrabajo(t, this.deps.obtenerCancion)
    if (aviso) this.avisar(aviso)
  }

  avisar(aviso: AvisoTrabajoIpc): void {
    this.deps.difundirAviso(aviso)
    const ventana = this.deps.ventana()
    if (!ventana || ventana.enfocada()) return
    this.pendientes++
    if (this.deps.plataforma === 'darwin') {
      this.deps.dock.rebotar()
      this.deps.dock.fijarInsignia(String(this.pendientes))
      return
    }
    ventana.parpadear(true)
    if (!this.deps.notificador.soportado()) return
    try {
      this.deps.notificador.mostrar({
        titulo: 'Shinobi Karaoke',
        cuerpo: aviso.texto,
        alClic: () => this.abrir(aviso.cancionId, aviso.destino),
        // Sin error visible: queda el parpadeo.
        alFallar: () => this.deps.registrar?.('aviso', 'la notificación del sistema falló')
      })
    } catch (e) {
      this.deps.registrar?.('aviso', `la notificación del sistema lanzó: ${String(e)}`)
    }
  }

  /** La ventana recuperó el foco: se borran la insignia y el parpadeo. */
  alRecuperarFoco(): void {
    if (this.pendientes === 0) return
    this.pendientes = 0
    if (this.deps.plataforma === 'darwin') this.deps.dock.fijarInsignia('')
    else this.deps.ventana()?.parpadear(false)
  }

  private abrir(cancionId: string, destino: DestinoAviso): void {
    this.deps.ventana()?.traer()
    this.deps.difundirAbrir({ cancionId, destino })
  }
}
