import type { ListaPantallasIpc, PantallaIpc } from '../../shared/sesion'

export interface Rectangulo {
  x: number
  y: number
  width: number
  height: number
}

/** Subconjunto de `Electron.Display`. */
export interface PantallaSistema {
  id: number
  label: string
  bounds: Rectangulo
  workArea: Rectangulo
  scaleFactor: number
}

export type EventoPantallas = 'display-added' | 'display-removed' | 'display-metrics-changed'

export type OyentePantallas = (evento: unknown, pantalla: PantallaSistema) => void

/** Subconjunto de `Electron.Screen` (se simula con `SHINOBI_PANTALLAS_SIMULADAS`). */
export interface ScreenLike {
  getAllDisplays(): PantallaSistema[]
  getPrimaryDisplay(): PantallaSistema
  getDisplayMatching(rect: Rectangulo): PantallaSistema
  on(evento: EventoPantallas, cb: OyentePantallas): unknown
  removeListener(evento: EventoPantallas, cb: OyentePantallas): unknown
}

/** Identidad recordada de una pantalla (`config.reproductor.secundaria.pantalla`). */
export interface PantallaRecordada {
  id: number
  etiqueta: string
  ancho: number
  alto: number
}

function ordenadas(pantallas: PantallaSistema[]): PantallaSistema[] {
  return [...pantallas].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
}

/** Pantallas para la interfaz (ADR 0017 §2). La etiqueta de respaldo es «Pantalla {n}» por orden. */
export function listarPantallas(
  screen: Pick<ScreenLike, 'getAllDisplays' | 'getPrimaryDisplay' | 'getDisplayMatching'>,
  ventanaPrincipal: { getBounds(): Rectangulo } | null
): ListaPantallasIpc {
  const primaria = screen.getPrimaryDisplay()
  const conPrincipal = ventanaPrincipal
    ? screen.getDisplayMatching(ventanaPrincipal.getBounds())
    : primaria
  const pantallas: PantallaIpc[] = ordenadas(screen.getAllDisplays()).map((d, i) => ({
    id: d.id,
    etiqueta: d.label.trim() === '' ? `Pantalla ${i + 1}` : d.label,
    ancho: d.bounds.width,
    alto: d.bounds.height,
    escala: d.scaleFactor,
    principal: d.id === primaria.id,
    conVentanaPrincipal: d.id === conPrincipal.id
  }))
  return { pantallas, colocacion: colocacionDelSistema() }
}

/** `sistema` solo en Linux con Wayland, donde la aplicación no puede colocar ventanas (0061). */
export function colocacionDelSistema(
  plataforma: string = process.platform,
  env: Record<string, string | undefined> = process.env
): 'libre' | 'sistema' {
  return plataforma === 'linux' && env.XDG_SESSION_TYPE === 'wayland' ? 'sistema' : 'libre'
}

/** Pantalla preseleccionada: por id, luego por etiqueta y tamaño, y si no, la primera ajena a la principal. */
export function preseleccion(
  preferencia: PantallaRecordada | null | undefined,
  lista: ListaPantallasIpc
): PantallaIpc | null {
  const { pantallas } = lista
  if (preferencia) {
    const porId = pantallas.find((p) => p.id === preferencia.id)
    if (porId) return porId
    const porEtiqueta = pantallas.find(
      (p) =>
        p.etiqueta === preferencia.etiqueta &&
        p.ancho === preferencia.ancho &&
        p.alto === preferencia.alto
    )
    if (porEtiqueta) return porEtiqueta
  }
  return pantallas.find((p) => !p.conVentanaPrincipal) ?? null
}

export type CambioPantallas =
  | { tipo: 'anadida'; pantalla: PantallaSistema }
  | { tipo: 'quitada'; pantalla: PantallaSistema }
  | { tipo: 'metricas'; pantalla: PantallaSistema }

/** Observa altas, bajas y cambios de métricas. Devuelve la baja de la suscripción. */
export function observarPantallas(
  screen: Pick<ScreenLike, 'on' | 'removeListener'>,
  cb: (cambio: CambioPantallas) => void
): () => void {
  const alta = ((_e: unknown, d: PantallaSistema) => cb({ tipo: 'anadida', pantalla: d })) as never
  const baja = ((_e: unknown, d: PantallaSistema) => cb({ tipo: 'quitada', pantalla: d })) as never
  const metricas = ((_e: unknown, d: PantallaSistema) =>
    cb({ tipo: 'metricas', pantalla: d })) as never
  screen.on('display-added', alta)
  screen.on('display-removed', baja)
  screen.on('display-metrics-changed', metricas)
  return () => {
    screen.removeListener('display-added', alta)
    screen.removeListener('display-removed', baja)
    screen.removeListener('display-metrics-changed', metricas)
  }
}
