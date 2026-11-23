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
  /** Clic en la notificación de una tanda: abrir su resultado (evento sin carga). */
  difundirAbrirResultado?: () => void
  obtenerCancion: (id: string) => Cancion | null
  /**
   * Hay una tanda de 2 o más canciones en marcha (ADR 0025 §5): no se avisa por cada canción; al vaciarse
   * la cola sale un solo aviso `tanda` (`avisarTanda`).
   */
  enTandaDeVarias?: () => boolean
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
    // La preparación en marcha avisa por su cuenta («está lista para revisar») y sustituye a «ya se puede
    // marcar como lista» (spec 04); «voz e instrumental separadas» sigue como siempre.
    const enPreparacion = cancion.preparacion?.estado === 'en_curso'
    if (enPreparacion && puedeMarcarseLista(cancion)) return null
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
  /** Canciones cuyo último estado de preparación visto fue «Preparando». */
  private readonly preparando = new Set<string>()

  constructor(private readonly deps: DepsAvisos) {}

  /** Cambio de un trabajo del gestor (suscripción). */
  alCambiarTrabajo(t: TrabajoIpc): void {
    const aviso = avisoDeTrabajo(t, this.deps.obtenerCancion)
    if (aviso && !this.deps.enTandaDeVarias?.()) this.avisar(aviso)
  }

  /**
   * Fin de la preparación de **una** canción (spec 04 §3): la notificación del sistema de siempre con la
   * ventana sin foco. El toast lo pone el renderer; dentro de una tanda de varias no hay nada por canción.
   */
  alCambiarCancion(e: {
    id: string
    eliminada?: boolean
    resumen?: { titulo: string; estadoPreparacion?: string | null }
  }): void {
    if (e.eliminada || !e.resumen) {
      this.preparando.delete(e.id)
      return
    }
    const antes = this.preparando.has(e.id)
    const ahora = e.resumen.estadoPreparacion
    if (ahora === 'preparando') this.preparando.add(e.id)
    else this.preparando.delete(e.id)
    if (!antes || ahora === 'preparando') return
    const tipo =
      ahora === 'lista_para_revisar'
        ? 'revisar'
        : ahora === 'elige_letra'
          ? 'elige'
          : ahora === 'sin_letra' || ahora === 'instrumental'
            ? 'sinLetra'
            : null
    if (!tipo || this.deps.enTandaDeVarias?.()) return
    this.alertarSistema(AVISOS.preparacion[tipo](e.resumen.titulo), () =>
      this.abrir(e.id, tipo === 'revisar' ? 'editor' : 'progreso')
    )
  }

  /** Resumen de una tanda terminada: un solo aviso (toast y notificación del sistema). */
  avisarTanda(resumen: {
    total: number
    listas: number
    esperanLetra: number
    conError: number
  }): void {
    this.avisar({
      cancionId: '',
      tipo: 'tanda',
      texto: AVISOS.tanda(resumen),
      etiqueta: AVISOS.etiquetaTanda,
      destino: 'biblioteca'
    })
  }

  avisar(aviso: AvisoTrabajoIpc): void {
    this.deps.difundirAviso(aviso)
    this.alertarSistema(aviso.texto, () => {
      if (aviso.tipo === 'tanda') {
        this.deps.ventana()?.traer()
        this.deps.difundirAbrirResultado?.()
      } else this.abrir(aviso.cancionId, aviso.destino)
    })
  }

  /**
   * Solo la parte del sistema (notificación, parpadeo o Dock), sin evento al renderer: lo usa la
   * exportación de video (0237), cuyo toast sale del propio estado de la exportación.
   */
  avisarSistema(texto: string): void {
    this.alertarSistema(texto, () => this.deps.ventana()?.traer())
  }

  private alertarSistema(texto: string, alClic: () => void): void {
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
        cuerpo: texto,
        alClic,
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
