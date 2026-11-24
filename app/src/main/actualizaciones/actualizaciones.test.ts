import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configPredeterminada, type Config } from '../../shared/config'
import type { ConfigParcial } from '../configuracion'
import {
  archivoDeSistema,
  cabecerasConsulta,
  construirEnlaces,
  consultarReleases,
  elegirNueva,
  ErrorConsulta,
  leerReleases,
  urlBaseGithub,
  type FetchConsulta,
  type InitConsulta
} from './consulta'
import { INTERVALO_MS, RETRASO_ARRANQUE_MS, ServicioActualizaciones, VENTANA_MS } from './servicio'

const rel = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: /-/.test(tag),
  published_at: '2026-11-25T18:00:00Z',
  assets: [{ name: 'Shinobi-Karaoke-Windows-x64.exe' }],
  ...extra
})
const json = (cuerpo: unknown, status = 200) => ({
  status,
  headers: { get: () => null },
  body: new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)).body,
  text: async () => JSON.stringify(cuerpo)
})

describe('leerReleases / elegirNueva', () => {
  const lista = leerReleases([
    rel('v0.2.2-alpha.2'),
    rel('v0.2.1'),
    rel('v0.2.2-alpha.3', { draft: true }),
    rel('v0.2.2-alpha.10'),
    rel('nightly'),
    rel('v0.2.3', { published_at: null }),
    { basura: true }
  ])

  it('descarta borradores, etiquetas ajenas y entradas inválidas sin tirar la respuesta', () => {
    expect(lista.map((r) => r.version)).toEqual(['0.2.2-alpha.2', '0.2.1', '0.2.2-alpha.10'])
  })

  it('una preliminar ve preliminares y estables; elige la mayor (alpha.10 > alpha.2)', () => {
    expect(elegirNueva(lista, '0.2.2-alpha.1')?.version).toBe('0.2.2-alpha.10')
  })

  it('una estable solo ve estables', () => {
    expect(elegirNueva(lista, '0.2.1')).toBeNull()
    expect(elegirNueva([...lista, ...leerReleases([rel('v0.2.2')])], '0.2.1')?.version).toBe(
      '0.2.2'
    )
  })

  it('una rc ve la estable; una versión mayor que todas deja «al día»', () => {
    expect(elegirNueva(leerReleases([rel('v0.2.2')]), '0.2.2-rc.1')?.version).toBe('0.2.2')
    expect(elegirNueva(lista, '9.0.0')).toBeNull()
  })

  it('un cuerpo que no es lista es un error', () => {
    expect(() => leerReleases({})).toThrow(ErrorConsulta)
  })
})

describe('enlaces', () => {
  const base = 'https://github.com/Gomonsoft/shinobi-karaoke/releases'
  it('instalador de cada sistema si figura en los recursos', () => {
    const win = construirEnlaces('0.2.2', ['Shinobi-Karaoke-Windows-x64.exe'], 'win32', false)
    expect(win).toEqual({
      novedades: `${base}/tag/v0.2.2`,
      descargar: `${base}/download/v0.2.2/Shinobi-Karaoke-Windows-x64.exe`,
      directa: true
    })
    expect(archivoDeSistema('darwin', false)).toBe('Shinobi-Karaoke-Mac-chip-Apple.dmg')
    expect(archivoDeSistema('linux', true)).toBe('Shinobi-Karaoke-Linux-x64.AppImage')
    expect(archivoDeSistema('linux', false)).toBe('shinobi-karaoke-linux-x64.deb')
  })
  it('sin el recurso, la página de la versión', () => {
    const e = construirEnlaces('0.2.2', ['otro.zip'], 'darwin', false)
    expect(e.descargar).toBe(`${base}/tag/v0.2.2`)
    expect(e.directa).toBe(false)
  })
})

describe('consultarReleases', () => {
  const llamar = (fetch: FetchConsulta) =>
    consultarReleases({ fetch, urlBase: 'https://api.github.com', versionApp: '1.2.3' })

  it('petición con las cabeceras exactas y sin credenciales', async () => {
    const fetch = vi.fn<FetchConsulta>().mockResolvedValue(json([rel('v1.0.0')]))
    await llamar(fetch)
    const [url, init] = fetch.mock.calls[0] as [string, InitConsulta]
    expect(url).toBe('https://api.github.com/repos/Gomonsoft/shinobi-karaoke/releases?per_page=30')
    expect(init.headers).toEqual(cabecerasConsulta('1.2.3'))
    expect(Object.keys(init.headers).sort()).toEqual([
      'Accept',
      'User-Agent',
      'X-GitHub-Api-Version'
    ])
    expect(init).toMatchObject({ credentials: 'omit', cache: 'no-store', redirect: 'error' })
  })

  it.each([
    ['sin red', () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED')), 'SIN_CONEXION'],
    ['403 por cuota', () => Promise.resolve(json({}, 403)), 'SERVICIO_NO_DISPONIBLE'],
    ['cuerpo que no es JSON', () => Promise.resolve(json('{no')), 'SERVICIO_NO_DISPONIBLE'],
    [
      'cuerpo de más de 1 MB',
      () => Promise.resolve(json('x'.repeat(1024 * 1024 + 1))),
      'SERVICIO_NO_DISPONIBLE'
    ]
  ])('%s', async (_n, f, codigo) => {
    await expect(llamar(f as FetchConsulta)).rejects.toMatchObject({ codigo })
  })

  it('tiempo agotado', async () => {
    const fetch: FetchConsulta = (_u, init) =>
      new Promise((_r, rechazar) =>
        init.signal.addEventListener('abort', () => rechazar(new Error('abort')))
      )
    await expect(
      consultarReleases({ fetch, urlBase: 'x', versionApp: '1', tiempoMs: 5 })
    ).rejects.toMatchObject({ codigo: 'SERVICIO_NO_DISPONIBLE' })
  })

  it('urlBaseGithub: el doble solo sin empaquetar y solo local', () => {
    expect(urlBaseGithub('http://127.0.0.1:5000/', false)).toBe('http://127.0.0.1:5000')
    expect(urlBaseGithub('http://127.0.0.1:5000', true)).toBe('https://api.github.com')
    expect(urlBaseGithub('http://evil.com', false)).toBe('https://api.github.com')
  })
})

describe('ServicioActualizaciones', () => {
  let config: Config
  let oyentesConfig: Array<(c: Config) => void>
  const t0 = Date.parse('2026-11-25T10:00:00Z')
  let reposo: () => void

  const crear = (
    fetch: FetchConsulta,
    extra: Partial<ConstructorParameters<typeof ServicioActualizaciones>[0]> = {}
  ) =>
    new ServicioActualizaciones({
      config: {
        obtener: () => structuredClone(config),
        actualizar: async (p: ConfigParcial) => {
          const a = p.actualizaciones ?? {}
          config = {
            ...config,
            actualizaciones: { ...config.actualizaciones, ...a } as Config['actualizaciones']
          }
          for (const cb of oyentesConfig) cb(structuredClone(config))
          return config
        },
        suscribir: (cb) => {
          oyentesConfig.push(cb)
          return () => undefined
        }
      },
      fetch,
      registro: { escribir: () => undefined },
      version: '0.2.2-alpha.1',
      canal: 'publicada',
      empaquetada: true,
      plataforma: 'win32',
      appimage: false,
      reposo: { on: (_e, cb) => void (reposo = cb) },
      ...extra
    })

  beforeEach(() => {
    vi.useFakeTimers({ now: t0 })
    config = configPredeterminada()
    oyentesConfig = []
  })
  afterEach(() => vi.useRealTimers())

  const ok = () => vi.fn<FetchConsulta>(async () => json([rel('v0.2.2-alpha.2'), rel('v0.2.1')]))

  it('arranque: una consulta a los 10 s; otra arrancada antes de 24 h no consulta', async () => {
    const fetch = ok()
    const s = crear(fetch)
    s.iniciar()
    await vi.advanceTimersByTimeAsync(RETRASO_ARRANQUE_MS - 1)
    expect(fetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(s.estado()).toMatchObject({
      disponible: { version: '0.2.2-alpha.2' },
      enlaces: { directa: true },
      comprobando: false
    })
    s.detener()
    const fetch2 = ok()
    const s2 = crear(fetch2)
    s2.iniciar()
    await vi.advanceTimersByTimeAsync(RETRASO_ARRANQUE_MS + 1)
    expect(fetch2).not.toHaveBeenCalled()
    s2.detener()
  })

  it('un cambio de configuración antes de iniciar no consulta (D1)', async () => {
    const fetch = ok()
    const s = crear(fetch)
    await s.marcarVista('0.0.1')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).not.toHaveBeenCalled()
    s.iniciar()
    await vi.advanceTimersByTimeAsync(RETRASO_ARRANQUE_MS + 1)
    expect(fetch).toHaveBeenCalledTimes(1)
    s.detener()
  })

  it('la manual no espera las 24 h del reintento automático', async () => {
    let falla = true
    const fetch = vi.fn<FetchConsulta>(async () => {
      if (falla) throw new Error('net::ERR_NAME_NOT_RESOLVED')
      return json([rel('v0.2.2-alpha.2')])
    })
    const s = crear(fetch)
    s.iniciar()
    await vi.advanceTimersByTimeAsync(RETRASO_ARRANQUE_MS + 1)
    expect(fetch).toHaveBeenCalledTimes(1)
    falla = false
    expect((await s.comprobar()).resultado).toBe('nueva')
    expect(fetch).toHaveBeenCalledTimes(2)
    s.detener()
  })

  it('con la última comprobación a más de 24 h, consulta con el temporizador horario', async () => {
    const fetch = ok()
    const s = crear(fetch)
    s.iniciar()
    await vi.advanceTimersByTimeAsync(RETRASO_ARRANQUE_MS + 1)
    await vi.advanceTimersByTimeAsync(VENTANA_MS - 1000)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(INTERVALO_MS)
    expect(fetch).toHaveBeenCalledTimes(2)
    s.detener()
  })

  it('tras «resume» se evalúa con la misma regla', async () => {
    const fetch = ok()
    const s = crear(fetch, { reposo: { on: (_e, cb) => void (reposo = cb) } })
    config.actualizaciones.ultima_comprobacion = new Date(t0 - VENTANA_MS - 1).toISOString()
    s.iniciar()
    reposo()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    reposo()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    s.detener()
  })

  it('desarrollo y local no consultan nunca, ni a mano', async () => {
    for (const canal of ['desarrollo', 'local'] as const) {
      const fetch = ok()
      const s = crear(fetch, { canal })
      s.iniciar()
      await vi.advanceTimersByTimeAsync(RETRASO_ARRANQUE_MS + INTERVALO_MS)
      expect((await s.comprobar()).resultado).toBe('error')
      expect(fetch).not.toHaveBeenCalled()
      s.detener()
    }
  })

  it('con el aviso apagado no hay consulta automática pero sí manual', async () => {
    config.actualizaciones.avisar = false
    const fetch = ok()
    const s = crear(fetch)
    s.iniciar()
    await vi.advanceTimersByTimeAsync(RETRASO_ARRANQUE_MS + 1)
    expect(fetch).not.toHaveBeenCalled()
    expect((await s.comprobar()).resultado).toBe('nueva')
    expect(fetch).toHaveBeenCalledTimes(1)
    s.detener()
  })

  it('sin red: en automático no cambia nada y no reintenta hasta 24 h; a mano devuelve el código', async () => {
    const fetch = vi.fn<FetchConsulta>(async () => {
      throw new Error('net::ERR_NAME_NOT_RESOLVED')
    })
    const s = crear(fetch)
    s.iniciar()
    await vi.advanceTimersByTimeAsync(RETRASO_ARRANQUE_MS + INTERVALO_MS * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(config.actualizaciones.ultima_comprobacion).toBeNull()
    expect(await s.comprobar()).toEqual({ resultado: 'error', codigo: 'SIN_CONEXION' })
    s.detener()
  })

  it('una manual a la vez y marca «comprobando»', async () => {
    let soltar!: () => void
    const fetch = vi.fn<FetchConsulta>(
      () => new Promise((r) => (soltar = () => r(json([rel('v0.2.1')]))))
    )
    const s = crear(fetch)
    const cambios: boolean[] = []
    s.suscribir((e) => cambios.push(e.comprobando))
    const a = s.comprobar()
    const b = s.comprobar()
    expect(s.estado().comprobando).toBe(true)
    soltar()
    expect(await a).toEqual({ resultado: 'al_dia' })
    expect(await b).toEqual({ resultado: 'al_dia' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(cambios[0]).toBe(true)
    expect(s.estado().comprobando).toBe(false)
  })

  it('marcarVista se guarda; una versión ya instalada se retira sola', async () => {
    const s = crear(ok())
    await s.comprobar()
    await s.marcarVista('0.2.2-alpha.2')
    expect(s.estado().vista).toBe('0.2.2-alpha.2')
    const actualizada = crear(ok(), { version: '0.2.2-alpha.2' })
    expect(actualizada.estado().disponible).toBeNull()
    actualizada.iniciar()
    await vi.advanceTimersByTimeAsync(0)
    expect(config.actualizaciones.disponible).toBeNull()
    actualizada.detener()
  })

  it('variables SHINOBI_*: versión y canal simulados solo sin empaquetar', () => {
    const env = {
      SHINOBI_ACTUALIZACIONES_VERSION: '0.1.0',
      SHINOBI_ACTUALIZACIONES_CANAL: 'publicada'
    }
    const sim = crear(ok(), { empaquetada: false, canal: 'local', env })
    expect([sim.version, sim.canal]).toEqual(['0.1.0', 'publicada'])
    const real = crear(ok(), { empaquetada: true, canal: 'local', env })
    expect([real.version, real.canal]).toEqual(['0.2.2-alpha.1', 'local'])
  })
})
