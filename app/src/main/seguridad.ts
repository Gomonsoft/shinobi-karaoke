/**
 * Endurecimiento de Electron (ADR 0008, tarea 0021): política de navegación, permisos y
 * remitente IPC. Las funciones son puras o reciben dobles para poder probarlas sin Electron.
 */
import { enlacePermitido } from '../shared/ipc'

export const PERMISOS_PERMITIDOS: readonly string[] = ['fullscreen', 'clipboard-sanitized-write']

/** Origen (`protocolo//host`) de una URL, o `null` si no es válida u opaca. */
export function origenDe(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.origin && u.origin !== 'null') return u.origin
    if (u.protocol === 'file:') return 'file://'
    // Esquemas propios (`shinobi-app:`): Node no calcula su origen; se usa `protocolo//host`.
    return u.host ? `${u.protocol}//${u.host}` : null
  } catch {
    return null
  }
}

export function esOrigenRenderer(url: string, origenRenderer: string): boolean {
  return origenDe(url) === origenRenderer
}

/** Origen del renderer vigente: dev (Vite) o `origenProduccion` (`shinobi-app://app`, 0022). */
export function origenDelRenderer(env: {
  urlDev?: string
  empaquetada: boolean
  origenProduccion?: string
}): string {
  if (!env.empaquetada && env.urlDev) return origenDe(env.urlDev) ?? 'file://'
  return env.origenProduccion ?? 'file://'
}

export interface WebContentsLike {
  on(evento: string, cb: (...args: never[]) => void): unknown
  setWindowOpenHandler(cb: (d: { url: string }) => { action: 'deny' }): void
}

export interface DepsNavegacion {
  abrirExterno: (url: string) => unknown
  avisar: (mensaje: string) => void
  origenRenderer: string
}

/** Instala la política de navegación en un `webContents`. */
export function instalarPoliticaNavegacion(wc: WebContentsLike, deps: DepsNavegacion): void {
  const externo = (url: string): void => {
    if (enlacePermitido(url)) void deps.abrirExterno(url)
    else deps.avisar(`navegación bloqueada: ${url.slice(0, 200)}`)
  }
  const bloquear = (evento: { preventDefault(): void }, url: string): void => {
    if (esOrigenRenderer(url, deps.origenRenderer)) return
    evento.preventDefault()
    externo(url)
  }
  for (const nombre of ['will-navigate', 'will-redirect', 'will-frame-navigate']) {
    wc.on(nombre, ((detalles: { preventDefault(): void; url?: string }, urlLegada?: string) => {
      bloquear(detalles, urlLegada ?? detalles.url ?? '')
    }) as never)
  }
  wc.on('will-attach-webview', ((evento: { preventDefault(): void }) => {
    evento.preventDefault()
  }) as never)
  wc.setWindowOpenHandler(({ url }) => {
    externo(url)
    return { action: 'deny' }
  })
}

export function permisoConcedido(permiso: string, urlSolicitante: string, origen: string): boolean {
  return PERMISOS_PERMITIDOS.includes(permiso) && esOrigenRenderer(urlSolicitante, origen)
}

export interface SesionLike {
  setPermissionRequestHandler(
    cb: (
      wc: unknown,
      permiso: string,
      callback: (ok: boolean) => void,
      detalles: { requestingUrl?: string }
    ) => void
  ): void
  setPermissionCheckHandler(
    cb: (
      wc: unknown,
      permiso: string,
      origenSolicitante: string,
      detalles: { requestingUrl?: string }
    ) => boolean
  ): void
}

export function instalarPermisos(sesion: SesionLike, origenRenderer: string): void {
  sesion.setPermissionRequestHandler((_wc, permiso, callback, detalles) => {
    callback(permisoConcedido(permiso, detalles.requestingUrl ?? '', origenRenderer))
  })
  sesion.setPermissionCheckHandler((_wc, permiso, origenSolicitante, detalles) =>
    permisoConcedido(permiso, detalles.requestingUrl ?? origenSolicitante, origenRenderer)
  )
}

interface EventoIpcLike {
  sender?: unknown
  senderFrame?: { url?: string } | null
}

/** Valida que el evento IPC venga del frame principal del renderer. */
export function remitenteIpcValido(
  evento: unknown,
  ventanas: readonly { mainFrame?: unknown }[],
  origenRenderer: string
): boolean {
  const e = evento as EventoIpcLike | null
  if (!e || !e.sender || !e.senderFrame) return false
  const wc = ventanas.find((v) => v === e.sender)
  if (!wc) return false
  if (e.senderFrame !== wc.mainFrame) return false
  return (
    typeof e.senderFrame.url === 'string' && esOrigenRenderer(e.senderFrame.url, origenRenderer)
  )
}

/** Espera `trabajo` como máximo `plazoMs`; devuelve `true` si terminó a tiempo. */
export async function conPlazo(
  trabajo: Promise<unknown>,
  plazoMs: number,
  alExpirar: () => void
): Promise<boolean> {
  let temporizador: NodeJS.Timeout | undefined
  const expira = new Promise<boolean>((res) => {
    temporizador = setTimeout(() => {
      alExpirar()
      res(false)
    }, plazoMs)
  })
  try {
    return await Promise.race([
      trabajo.then(
        () => true,
        () => true
      ),
      expira
    ])
  } finally {
    clearTimeout(temporizador)
  }
}

/**
 * Origen de una petición a un protocolo propio. `protocol.handle` no expone `Origin` (comprobado
 * en Electron 45), así que se usa `Origin` si llega y, si no, el origen del `Referer`.
 * `null` si no hay ninguno (p. ej. `<audio src>` o una página con `no-referrer`).
 */
export function origenDePeticion(origin: string | null, referrer: string | null): string | null {
  if (origin && origin !== 'null') return origin
  return referrer ? origenDe(referrer) : null
}
