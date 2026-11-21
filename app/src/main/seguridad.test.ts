import { describe, expect, it, vi } from 'vitest'
import { CANALES } from '../shared/canales'
import {
  bloquearNavegacionTotal,
  conPlazo,
  instalarPermisos,
  instalarPoliticaNavegacion,
  origenDe,
  origenDePeticion,
  origenDelRenderer,
  permisoConcedido,
  remitenteIpcValido,
  type SesionLike,
  type WebContentsLike
} from './seguridad'

const ORIGEN = 'http://localhost:5173'

function crearWc() {
  const oyentes = new Map<string, (...a: never[]) => void>()
  let abrir: ((d: { url: string }) => { action: 'deny' }) | undefined
  const wc: WebContentsLike = {
    on: (e, cb) => void oyentes.set(e, cb),
    setWindowOpenHandler: (cb) => void (abrir = cb)
  }
  return { wc, oyentes, abrir: (url: string) => abrir!({ url }) }
}

describe('origenDePeticion', () => {
  it('prefiere Origin, usa el Referer y devuelve null sin ninguno', () => {
    expect(origenDePeticion('shinobi-app://app', null)).toBe('shinobi-app://app')
    expect(origenDePeticion(null, 'http://127.0.0.1:5/x')).toBe('http://127.0.0.1:5')
    expect(origenDePeticion('null', '')).toBeNull()
  })
})

describe('origenDe / origenDelRenderer', () => {
  it('calcula orígenes', () => {
    expect(origenDe('http://localhost:5173/x')).toBe(ORIGEN)
    expect(origenDe('file:///a/b.html')).toBe('file://')
    expect(origenDe('shinobi-app://app/index.html')).toBe('shinobi-app://app')
    expect(origenDe('basura')).toBeNull()
    expect(origenDelRenderer({ urlDev: ORIGEN + '/', empaquetada: false })).toBe(ORIGEN)
    expect(origenDelRenderer({ urlDev: ORIGEN, empaquetada: true })).toBe('file://')
    expect(origenDelRenderer({ empaquetada: true, origenProduccion: 'shinobi-app://app' })).toBe(
      'shinobi-app://app'
    )
  })
})

describe('política de navegación', () => {
  const montar = () => {
    const abrirExterno = vi.fn()
    const avisar = vi.fn()
    const c = crearWc()
    instalarPoliticaNavegacion(c.wc, { abrirExterno, avisar, origenRenderer: ORIGEN })
    return { ...c, abrirExterno, avisar }
  }

  it.each(['will-navigate', 'will-redirect', 'will-frame-navigate'])(
    '%s cancela lo externo y deja pasar el propio renderer',
    (nombre) => {
      const t = montar()
      const ev = { preventDefault: vi.fn(), url: 'https://example.com/' }
      t.oyentes.get(nombre)!(ev as never)
      expect(ev.preventDefault).toHaveBeenCalled()
      expect(t.abrirExterno).not.toHaveBeenCalled()
      expect(t.avisar).toHaveBeenCalled()
      const propio = { preventDefault: vi.fn(), url: ORIGEN + '/otra' }
      t.oyentes.get(nombre)!(propio as never)
      expect(propio.preventDefault).not.toHaveBeenCalled()
    }
  )

  it('abre en el sistema solo enlaces de la lista blanca', () => {
    const t = montar()
    const ev = { preventDefault: vi.fn(), url: 'https://lrclib.net/x' }
    t.oyentes.get('will-navigate')!(ev as never)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(t.abrirExterno).toHaveBeenCalledWith('https://lrclib.net/x')
  })

  it('window.open siempre deniega y respeta la lista blanca', () => {
    const t = montar()
    expect(t.abrir('https://example.com')).toEqual({ action: 'deny' })
    expect(t.abrirExterno).not.toHaveBeenCalled()
    expect(t.abrir('https://lrclib.net/')).toEqual({ action: 'deny' })
    expect(t.abrirExterno).toHaveBeenCalledTimes(1)
    expect(t.abrir('javascript:alert(1)')).toEqual({ action: 'deny' })
  })

  it('will-attach-webview se cancela', () => {
    const t = montar()
    const ev = { preventDefault: vi.fn() }
    t.oyentes.get('will-attach-webview')!(ev as never)
    expect(ev.preventDefault).toHaveBeenCalled()
  })
})

describe('permisos', () => {
  it('solo portapapeles desde el origen del renderer', () => {
    expect(permisoConcedido('fullscreen', ORIGEN + '/', ORIGEN)).toBe(false)
    expect(permisoConcedido('clipboard-sanitized-write', ORIGEN, ORIGEN)).toBe(true)
    expect(permisoConcedido('media', ORIGEN, ORIGEN)).toBe(false)
    expect(permisoConcedido('notifications', ORIGEN, ORIGEN)).toBe(false)
    expect(permisoConcedido('clipboard-sanitized-write', 'https://example.com', ORIGEN)).toBe(false)
  })

  it('instala los dos manejadores', () => {
    let pedir: Parameters<SesionLike['setPermissionRequestHandler']>[0] | undefined
    let comprobar: Parameters<SesionLike['setPermissionCheckHandler']>[0] | undefined
    instalarPermisos(
      {
        setPermissionRequestHandler: (cb) => void (pedir = cb),
        setPermissionCheckHandler: (cb) => void (comprobar = cb)
      },
      ORIGEN
    )
    const cb = vi.fn()
    pedir!(null, 'clipboard-sanitized-write', cb, { requestingUrl: ORIGEN })
    pedir!(null, 'fullscreen', cb, { requestingUrl: ORIGEN })
    pedir!(null, 'geolocation', cb, { requestingUrl: ORIGEN })
    expect(cb.mock.calls).toEqual([[true], [false], [false]])
    expect(comprobar!(null, 'clipboard-sanitized-write', ORIGEN, {})).toBe(true)
    expect(comprobar!(null, 'fullscreen', ORIGEN, {})).toBe(false)
    expect(comprobar!(null, 'media', ORIGEN, {})).toBe(false)
  })
})

describe('remitenteIpcValido', () => {
  const frameP = { url: ORIGEN + '/index.html' }
  const principal = { mainFrame: frameP }
  const frameS = { url: ORIGEN + '/reproductor.html' }
  const secundaria = { mainFrame: frameS }
  const registro = {
    rolDe: (wc: unknown) =>
      wc === principal ? ('principal' as const) : wc === secundaria ? ('secundaria' as const) : null
  }
  const valido = (evento: unknown, canal: string): boolean =>
    remitenteIpcValido(evento, canal, registro, ORIGEN)
  const evP = { sender: principal, senderFrame: frameP }
  const evS = { sender: secundaria, senderFrame: frameS }
  /** Evento de un `webContents` con el rol y el documento dados (para casos de ruta). */
  const conRol = (rol: 'principal' | 'secundaria' | null, url: string, canal: string): boolean => {
    const f = { url }
    const wc = { mainFrame: f }
    return remitenteIpcValido({ sender: wc, senderFrame: f }, canal, { rolDe: () => rol }, ORIGEN)
  }

  it('acepta cada rol en sus canales', () => {
    expect(valido(evP, CANALES.biblioteca.listar)).toBe(true)
    expect(valido(evP, CANALES.sesion.estado)).toBe(true)
    expect(valido(evS, CANALES.sesion.informar)).toBe(true)
    expect(valido(evS, CANALES.ventana.fijarPantallaCompleta)).toBe(true)
  })
  it('acepta "/" para la principal (desarrollo)', () => {
    expect(conRol('principal', ORIGEN + '/', CANALES.biblioteca.listar)).toBe(true)
  })
  it('rechaza los canales de otro rol', () => {
    expect(valido(evS, CANALES.biblioteca.listar)).toBe(false)
    expect(valido(evS, CANALES.temas.catalogo)).toBe(false)
    expect(valido(evP, CANALES.sesion.informar)).toBe(false)
  })
  it('rechaza canales desconocidos', () => {
    expect(valido(evP, 'canal:inexistente')).toBe(false)
    expect(valido(evP, 'toString')).toBe(false)
  })
  it('rechaza webContents sin registrar, subframe, sin frame u otro origen', () => {
    expect(valido({ sender: {}, senderFrame: frameP }, CANALES.biblioteca.listar)).toBe(false)
    expect(
      valido({ sender: principal, senderFrame: { url: frameP.url } }, CANALES.biblioteca.listar)
    ).toBe(false)
    expect(valido({ sender: principal }, CANALES.biblioteca.listar)).toBe(false)
    expect(valido(null, CANALES.biblioteca.listar)).toBe(false)
    expect(conRol('principal', 'https://example.com/index.html', CANALES.biblioteca.listar)).toBe(
      false
    )
    expect(conRol(null, ORIGEN + '/index.html', CANALES.biblioteca.listar)).toBe(false)
  })
  it('la ventana de exportación solo llega a sus canales y desde su documento', () => {
    const f = { url: ORIGEN + '/exportacion.html' }
    const ev = { sender: { mainFrame: f }, senderFrame: f }
    const reg = { rolDe: () => 'exportacion' as const }
    const ok = (canal: string): boolean => remitenteIpcValido(ev, canal, reg, ORIGEN)
    expect(ok(CANALES.exportacion.inicial)).toBe(true)
    expect(ok(CANALES.exportacion.listo)).toBe(true)
    expect(ok(CANALES.biblioteca.listar)).toBe(false)
    expect(ok(CANALES.exportacion.iniciar)).toBe(false)
    expect(valido(evP, CANALES.exportacion.listo)).toBe(false)
    expect(conRol('principal', ORIGEN + '/exportacion.html', CANALES.biblioteca.listar)).toBe(false)
  })
  it('rechaza un documento que no es el del rol', () => {
    expect(conRol('principal', ORIGEN + '/reproductor.html', CANALES.biblioteca.listar)).toBe(false)
    expect(conRol('secundaria', ORIGEN + '/index.html', CANALES.sesion.informar)).toBe(false)
    expect(conRol('secundaria', ORIGEN + '/', CANALES.sesion.informar)).toBe(false)
  })
})

describe('bloquearNavegacionTotal', () => {
  it('cancela will-navigate, will-redirect y will-frame-navigate', () => {
    const oyentes = new Map<string, (d: { preventDefault(): void }) => void>()
    bloquearNavegacionTotal({ on: (n, cb) => void oyentes.set(n, cb as never) })
    expect([...oyentes.keys()].sort()).toEqual([
      'will-frame-navigate',
      'will-navigate',
      'will-redirect'
    ])
    for (const cb of oyentes.values()) {
      const preventDefault = vi.fn()
      cb({ preventDefault })
      expect(preventDefault).toHaveBeenCalled()
    }
  })
})

describe('conPlazo', () => {
  it('devuelve true si termina y false (avisando) si expira', async () => {
    const aviso = vi.fn()
    expect(await conPlazo(Promise.resolve(), 50, aviso)).toBe(true)
    expect(aviso).not.toHaveBeenCalled()
    expect(await conPlazo(new Promise(() => {}), 20, aviso)).toBe(false)
    expect(aviso).toHaveBeenCalled()
  })
})
