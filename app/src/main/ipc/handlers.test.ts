import { describe, expect, it, vi } from 'vitest'
import { CANALES, configPredeterminada, enlacePermitido, ErrorDatosInvalidos } from '../../shared'
import { ErrorBiblioteca, type EventoCancion, type ResumenCancion } from '../biblioteca'
import { crearManejadores, registrarIpc, type DependenciasIpc, type IpcMainLike } from './handlers'

const resumen = (id: string, miniatura: string | null = null): ResumenCancion => ({
  id,
  titulo: 'T',
  artista: 'A',
  duracionMs: 1000,
  estado: 'borrador',
  modificada: '2026-01-01T00:00:00.000Z',
  estilo: null,
  miniatura,
  pasos: null,
  incompleta: false,
  lineasSinSincronizar: 0,
  danada: false,
  motivo: null
})

function crearDeps() {
  const oyentesCancion: ((e: EventoCancion) => void)[] = []
  const oyentesTrabajo: ((t: unknown) => void)[] = []
  const oyentesProgreso: ((p: unknown) => void)[] = []
  const oyentesConfig: ((c: ReturnType<typeof configPredeterminada>) => void)[] = []
  const deps = {
    biblioteca: {
      listar: vi.fn(() => [resumen('abc', '/ruta/absoluta/miniatura.jpg'), resumen('d')]),
      obtener: vi.fn(() => null),
      actualizar: vi.fn((id: string) => Promise.resolve(resumen(id))),
      volverABorrador: vi.fn((id: string) => Promise.resolve(resumen(id))),
      eliminar: vi.fn(() => Promise.resolve()),
      mostrarEnCarpeta: vi.fn(() => Promise.resolve()),
      suscribir: vi.fn((cb: (e: EventoCancion) => void) => {
        oyentesCancion.push(cb)
        return () => oyentesCancion.splice(0)
      })
    },
    trabajos: {
      listar: vi.fn(() => []),
      cancelar: vi.fn(() => Promise.resolve(true)),
      hayPendientes: vi.fn(() => false),
      suscribir: vi.fn((cb: (t: unknown) => void) => {
        oyentesTrabajo.push(cb)
        return () => oyentesTrabajo.splice(0)
      }),
      suscribirProgreso: vi.fn((cb: (p: unknown) => void) => {
        oyentesProgreso.push(cb)
        return () => oyentesProgreso.splice(0)
      })
    },
    config: {
      obtener: vi.fn(() => configPredeterminada()),
      actualizar: vi.fn(() => Promise.resolve(configPredeterminada())),
      suscribir: vi.fn((cb: (c: ReturnType<typeof configPredeterminada>) => void) => {
        oyentesConfig.push(cb)
        return () => oyentesConfig.splice(0)
      })
    },
    infoSistema: vi.fn(() => ({ version: '1.0.0', so: 'Test 1', plataforma: 'linux' })),
    abrirExterno: vi.fn(() => Promise.resolve()),
    registrar: vi.fn()
  }
  return {
    deps: deps as unknown as DependenciasIpc & typeof deps,
    oyentesCancion,
    oyentesConfig,
    oyentesTrabajo,
    oyentesProgreso
  }
}

describe('manejadores IPC', () => {
  it('listar devuelve URLs shinobi-media y nunca rutas absolutas', async () => {
    const { deps } = crearDeps()
    const r = await crearManejadores(deps)[CANALES.biblioteca.listar]([])
    expect(r).toMatchObject({ ok: true })
    const lista = (r as { valor: { id: string; miniatura: string | null }[] }).valor
    expect(lista[0]?.miniatura).toBe('shinobi-media://abc/fuente/miniatura.jpg')
    expect(lista[1]?.miniatura).toBeNull()
    expect(JSON.stringify(lista)).not.toContain('/ruta/absoluta')
  })

  it('rechaza argumentos inválidos sin llamar al servicio', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    const casos: [string, unknown[]][] = [
      [CANALES.biblioteca.listar, ['sobra']],
      [CANALES.biblioteca.obtener, []],
      [CANALES.biblioteca.obtener, [42]],
      [CANALES.biblioteca.eliminar, ['']],
      [CANALES.biblioteca.actualizarMetadatos, ['x', { titulo: '', artista: '', album: null }]],
      [
        CANALES.biblioteca.actualizarMetadatos,
        ['x', { titulo: 't', artista: 'a', album: null, id: 'z' }]
      ],
      [CANALES.config.actualizar, [{ instalacion: { estado: 'completa' } }]],
      [CANALES.config.actualizar, [{ reproductor: { volumen: 5 } }]],
      [CANALES.config.actualizar, [{ ultima_comprobacion_ytdlp: null }]],
      [CANALES.sistema.abrirEnlace, ['http://lrclib.net/']],
      [CANALES.sistema.abrirEnlace, ['file:///etc/passwd']]
    ]
    for (const [canal, args] of casos) {
      const r = await m[canal as keyof typeof m](args)
      expect(r, canal).toEqual({
        ok: false,
        error: { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: expect.any(String) }
      })
    }
    expect(deps.biblioteca.eliminar).not.toHaveBeenCalled()
    expect(deps.biblioteca.actualizar).not.toHaveBeenCalled()
    expect(deps.config.actualizar).not.toHaveBeenCalled()
    expect(deps.abrirExterno).not.toHaveBeenCalled()
  })

  it('trabajos: listar, cancelar y hayPendientes; id vacío rechazado', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    expect(await m[CANALES.trabajos.listar]([])).toEqual({ ok: true, valor: [] })
    expect(await m[CANALES.trabajos.hayPendientes]([])).toEqual({ ok: true, valor: false })
    expect(await m[CANALES.trabajos.cancelar](['t1'])).toEqual({ ok: true, valor: true })
    expect(deps.trabajos.cancelar).toHaveBeenCalledWith('t1')
    expect((await m[CANALES.trabajos.cancelar]([''])).ok).toBe(false)
    expect((await m[CANALES.trabajos.cancelar]([])).ok).toBe(false)
  })

  it('actualizarMetadatos solo pasa metadatos al servicio', async () => {
    const { deps } = crearDeps()
    const r = await crearManejadores(deps)[CANALES.biblioteca.actualizarMetadatos]([
      'abc',
      { titulo: 'Nuevo', artista: 'Yo', album: null }
    ])
    expect(r.ok).toBe(true)
    expect(deps.biblioteca.actualizar).toHaveBeenCalledWith('abc', {
      metadatos: { titulo: 'Nuevo', artista: 'Yo', album: null }
    })
  })

  it('config.actualizar acepta solo los campos permitidos', async () => {
    const { deps } = crearDeps()
    const parcial = {
      reproductor: { volumen: 0.5 },
      separacion: { modo: 'calidad' },
      aviso_youtube_aceptado: '2026-01-01T00:00:00.000Z'
    }
    const r = await crearManejadores(deps)[CANALES.config.actualizar]([parcial])
    expect(r.ok).toBe(true)
    expect(deps.config.actualizar).toHaveBeenCalledWith(parcial)
  })

  it('traduce los errores a { codigo, mensaje } y oculta los desconocidos', async () => {
    const { deps } = crearDeps()
    deps.biblioteca.eliminar.mockRejectedValueOnce(
      new ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', 'No existe la canción x.')
    )
    deps.biblioteca.volverABorrador.mockRejectedValueOnce(new Error('/secreto/ruta EACCES'))
    deps.config.actualizar.mockRejectedValueOnce(new ErrorDatosInvalidos('detalle interno'))
    const m = crearManejadores(deps)
    expect(await m[CANALES.biblioteca.eliminar](['x'])).toEqual({
      ok: false,
      error: { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: 'No existe la canción x.' }
    })
    const interno = await m[CANALES.biblioteca.volverABorrador](['x'])
    expect(interno).toEqual({
      ok: false,
      error: { codigo: 'ERROR_INTERNO', mensaje: 'Algo salió mal.' }
    })
    expect(deps.registrar).toHaveBeenCalledWith('error', expect.stringContaining('/secreto/ruta'))
    const cfg = await m[CANALES.config.actualizar]([{ reproductor: { silenciado: true } }])
    expect(cfg).toMatchObject({ ok: false, error: { codigo: 'ARGUMENTOS_NO_VALIDOS' } })
    expect(JSON.stringify(cfg)).not.toContain('detalle interno')
  })

  it('abrirEnlace llama al navegador solo con enlaces de la lista blanca', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    expect((await m[CANALES.sistema.abrirEnlace](['https://lrclib.net/docs'])).ok).toBe(true)
    expect(deps.abrirExterno).toHaveBeenCalledWith('https://lrclib.net/docs')
  })

  it('sistema.info devuelve versión, SO y plataforma', async () => {
    const { deps } = crearDeps()
    expect(await crearManejadores(deps)[CANALES.sistema.info]([])).toEqual({
      ok: true,
      valor: { version: '1.0.0', so: 'Test 1', plataforma: 'linux' }
    })
  })
})

describe('enlacePermitido', () => {
  it.each([
    ['https://lrclib.net', true],
    ['https://lrclib.net/docs', true],
    ['https://github.com/Gomonsoft/shinobi-karaoke', true],
    ['https://github.com/Gomonsoft/shinobi-karaoke/issues/new', true],
    ['https://github.com/Gomonsoft/shinobi-karaoke-falso', false],
    ['https://github.com/otro/repo', false],
    ['http://lrclib.net', false],
    ['https://lrclib.net.evil.com', false],
    ['https://user:pw@lrclib.net', false],
    ['https://lrclib.net:8443/', false],
    ['javascript:alert(1)', false],
    ['no es url', false]
  ])('%s -> %s', (url, esperado) => {
    expect(enlacePermitido(url)).toBe(esperado)
  })
})

describe('registrarIpc', () => {
  function ipcFalso() {
    const manejadores = new Map<string, (e: unknown, ...a: unknown[]) => unknown>()
    const ipc: IpcMainLike = {
      handle: (c, f) => void manejadores.set(c, f),
      removeHandler: (c) => void manejadores.delete(c)
    }
    return { ipc, manejadores }
  }

  it('registra 13 canales, rechaza remitentes ajenos y difunde eventos con URL de medios', async () => {
    const { deps, oyentesCancion, oyentesConfig, oyentesTrabajo, oyentesProgreso } = crearDeps()
    const { ipc, manejadores } = ipcFalso()
    const difundir = vi.fn()
    const deshacer = registrarIpc(ipc, deps, {
      remitenteValido: (e) => e === 'mio',
      difundir
    })
    expect(manejadores.size).toBe(13)
    expect(await manejadores.get(CANALES.sistema.info)?.('ajeno')).toMatchObject({ ok: false })
    expect(await manejadores.get(CANALES.sistema.info)?.('mio')).toMatchObject({ ok: true })

    oyentesCancion[0]?.({ id: 'abc', resumen: resumen('abc', '/abs/m.jpg') })
    oyentesCancion[0]?.({ id: 'abc', eliminada: true })
    oyentesConfig[0]?.(configPredeterminada())
    expect(difundir).toHaveBeenNthCalledWith(1, CANALES.eventos.cancion, {
      id: 'abc',
      resumen: expect.objectContaining({ miniatura: 'shinobi-media://abc/fuente/miniatura.jpg' })
    })
    expect(difundir).toHaveBeenNthCalledWith(2, CANALES.eventos.cancion, {
      id: 'abc',
      eliminada: true
    })
    expect(difundir).toHaveBeenNthCalledWith(3, CANALES.eventos.config, expect.any(Object))
    oyentesTrabajo[0]?.({ id: 't' })
    oyentesProgreso[0]?.({ id: 't', valor: 0.5 })
    expect(difundir).toHaveBeenNthCalledWith(4, CANALES.eventos.trabajo, { id: 't' })
    expect(difundir).toHaveBeenNthCalledWith(5, CANALES.eventos.trabajoProgreso, {
      id: 't',
      valor: 0.5
    })

    deshacer()
    expect(manejadores.size).toBe(0)
  })
})
