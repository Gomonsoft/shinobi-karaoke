import { describe, expect, it, vi } from 'vitest'
import {
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
  it('solo fullscreen y portapapeles desde el origen del renderer', () => {
    expect(permisoConcedido('fullscreen', ORIGEN + '/', ORIGEN)).toBe(true)
    expect(permisoConcedido('clipboard-sanitized-write', ORIGEN, ORIGEN)).toBe(true)
    expect(permisoConcedido('media', ORIGEN, ORIGEN)).toBe(false)
    expect(permisoConcedido('notifications', ORIGEN, ORIGEN)).toBe(false)
    expect(permisoConcedido('fullscreen', 'https://example.com', ORIGEN)).toBe(false)
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
    pedir!(null, 'fullscreen', cb, { requestingUrl: ORIGEN })
    pedir!(null, 'geolocation', cb, { requestingUrl: ORIGEN })
    expect(cb.mock.calls).toEqual([[true], [false]])
    expect(comprobar!(null, 'fullscreen', ORIGEN, {})).toBe(true)
    expect(comprobar!(null, 'media', ORIGEN, {})).toBe(false)
  })
})

describe('remitenteIpcValido', () => {
  const frame = { url: ORIGEN + '/index.html' }
  const wc = { mainFrame: frame }
  it('acepta el frame principal del renderer', () => {
    expect(remitenteIpcValido({ sender: wc, senderFrame: frame }, [wc], ORIGEN)).toBe(true)
  })
  it('rechaza ventana desconocida, subframe, sin frame u otro origen', () => {
    expect(remitenteIpcValido({ sender: {}, senderFrame: frame }, [wc], ORIGEN)).toBe(false)
    expect(remitenteIpcValido({ sender: wc, senderFrame: { url: frame.url } }, [wc], ORIGEN)).toBe(
      false
    )
    expect(remitenteIpcValido({ sender: wc }, [wc], ORIGEN)).toBe(false)
    expect(remitenteIpcValido(null, [wc], ORIGEN)).toBe(false)
    const mal = { url: 'https://example.com/' }
    expect(remitenteIpcValido({ sender: { mainFrame: mal }, senderFrame: mal }, [], ORIGEN)).toBe(
      false
    )
    const w2 = { mainFrame: mal }
    expect(remitenteIpcValido({ sender: w2, senderFrame: mal }, [w2], ORIGEN)).toBe(false)
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
