import { describe, expect, it, vi } from 'vitest'
import {
  CANALES,
  CONTRATO,
  configPredeterminada,
  enlacePermitido,
  ErrorDatosInvalidos
} from '../../shared'
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
  const oyentesRtProgreso: ((p: unknown) => void)[] = []
  const oyentesRtCambio: ((e: unknown) => void)[] = []
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
    fuente: {
      importar: vi.fn(() =>
        Promise.resolve({
          importacionId: 'imp1',
          nombre: 'a.wav',
          duracionMs: 30000,
          metadatos: { titulo: 'a', artista: '', album: '' },
          gananciaDb: 1.5,
          larga: false
        })
      ),
      cancelar: vi.fn(() => Promise.resolve()),
      confirmar: vi.fn((id: string) => Promise.resolve(resumen(id))),
      descartar: vi.fn(() => Promise.resolve())
    },
    elegirArchivoAudio: vi.fn(() => Promise.resolve('/x/a.wav' as string | null)),
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
    runtime: {
      estado: vi.fn(() => Promise.resolve(estadoRt)),
      requisitos: vi.fn(() => Promise.resolve({})),
      instalar: vi.fn(),
      pausar: vi.fn(() => Promise.resolve()),
      detalles: vi.fn(() => Promise.resolve('detalles')),
      estimarSeparacion: vi.fn(() => ({ min: 1, max: 2, origen: 'estimado' as const })),
      aceptarYUsarRapido: vi.fn(() => Promise.resolve()),
      volverACalidad: vi.fn(() => Promise.resolve()),
      cancelarVolverACalidad: vi.fn(),
      alProgreso: vi.fn((cb: (p: unknown) => void) => {
        oyentesRtProgreso.push(cb)
        return () => oyentesRtProgreso.splice(0)
      }),
      alCambiar: vi.fn((cb: (e: unknown) => void) => {
        oyentesRtCambio.push(cb)
        return () => oyentesRtCambio.splice(0)
      })
    },
    confirmarCierre: vi.fn(() => Promise.resolve()),
    salir: vi.fn(),
    infoSistema: vi.fn(() => ({
      version: '1.0.0',
      so: 'Test 1',
      plataforma: 'linux',
      youtube: true,
      versionSo: '6.1',
      arquitectura: 'x64',
      emulada: false,
      ytdlp: { version: '2026.10.01', ultimaComprobacion: null }
    })),
    abrirExterno: vi.fn(() => Promise.resolve()),
    textoLegal: vi.fn((tipo: string) => Promise.resolve(`texto ${tipo}`)),
    abrirCarpetaDatos: vi.fn(() => Promise.resolve()),
    registrar: vi.fn()
  }
  return {
    deps: deps as unknown as DependenciasIpc & typeof deps,
    oyentesCancion,
    oyentesConfig,
    oyentesTrabajo,
    oyentesProgreso,
    oyentesRtProgreso,
    oyentesRtCambio
  }
}

const estadoRt = {
  estado: 'pendiente',
  fases: { motor: 'pendiente', componentes: 'pendiente', modelo: 'pendiente' },
  error: null,
  perfilPrevisto: 'mps',
  perfil: null,
  motivoRebaja: null,
  modo: 'calidad',
  bytesRestantes: 1000,
  rapidoPendiente: false,
  ofrecerRapido: false,
  volverACalidad: null
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

  it('fuente: importar, cancelar (con y sin id), confirmar y descartar; argumentos inválidos rechazados', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    const lectura = await m[CANALES.fuente.importarArchivo](['/x/a.wav'])
    expect(lectura).toMatchObject({ ok: true, valor: { importacionId: 'imp1', gananciaDb: 1.5 } })
    expect(await m[CANALES.fuente.cancelarImportacion]([])).toEqual({ ok: true, valor: undefined })
    expect(deps.fuente.cancelar).toHaveBeenLastCalledWith(undefined)
    await m[CANALES.fuente.cancelarImportacion](['imp1'])
    expect(deps.fuente.cancelar).toHaveBeenLastCalledWith('imp1')
    const meta = { titulo: 'T', artista: '', album: null }
    const conf = await m[CANALES.fuente.confirmarArchivo](['imp1', meta])
    expect(conf).toMatchObject({ ok: true, valor: { id: 'imp1' } })
    await m[CANALES.fuente.descartarImportacion](['imp1'])
    expect(deps.fuente.descartar).toHaveBeenCalledWith('imp1')
    expect(await m[CANALES.sistema.elegirArchivoAudio]([])).toEqual({ ok: true, valor: '/x/a.wav' })
    // Ni ganancia ni rutas pueden venir del renderer.
    const casos: [string, unknown[]][] = [
      [CANALES.fuente.importarArchivo, []],
      [CANALES.fuente.importarArchivo, ['']],
      [CANALES.fuente.confirmarArchivo, ['imp1', { ...meta, ganancia_db: 20 }]],
      [CANALES.fuente.confirmarArchivo, ['imp1', { ...meta, titulo: '  ' }]],
      [CANALES.fuente.descartarImportacion, []]
    ]
    for (const [canal, args] of casos) {
      const r = await m[canal as keyof typeof m](args)
      expect(r, canal).toMatchObject({ ok: false, error: { codigo: 'ARGUMENTOS_NO_VALIDOS' } })
    }
    expect(deps.fuente.confirmar).toHaveBeenCalledTimes(1)
  })

  it('youtube: delega en el servicio, no admite URL en confirmar y desactivado responde ARGUMENTOS_NO_VALIDOS', async () => {
    const { deps } = crearDeps()
    const youtube = {
      info: vi.fn(() => Promise.resolve({ consultaId: 'c1' })),
      cancelarInfo: vi.fn(() => Promise.resolve()),
      confirmar: vi.fn(() => Promise.resolve({ id: 'abc', miniatura: null })),
      reintentar: vi.fn(() => Promise.resolve())
    }
    const m = crearManejadores({ ...deps, youtube } as unknown as DependenciasIpc)
    const meta = { titulo: 'T', artista: '', album: null }
    expect(await m[CANALES.fuente.infoYoutube](['https://youtu.be/aaaaaaaaaaa'])).toMatchObject({
      ok: true
    })
    await m[CANALES.fuente.cancelarInfo]([])
    expect(youtube.cancelarInfo).toHaveBeenLastCalledWith(undefined)
    await m[CANALES.fuente.confirmarYoutube](['c1', meta, { cancionId: 'abc' }])
    expect(youtube.confirmar).toHaveBeenLastCalledWith('c1', meta, { cancionId: 'abc' })
    await m[CANALES.fuente.reintentar](['abc'])
    expect(youtube.reintentar).toHaveBeenCalledWith('abc')
    // El renderer no puede enviar la URL al confirmar.
    const r = await m[CANALES.fuente.confirmarYoutube](['c1', meta, { url: 'https://x' }])
    expect(r).toMatchObject({ ok: false, error: { codigo: 'ARGUMENTOS_NO_VALIDOS' } })
    expect(youtube.confirmar).toHaveBeenCalledTimes(1)

    const sin = crearManejadores(deps)
    for (const [canal, args] of [
      [CANALES.fuente.infoYoutube, ['https://youtu.be/aaaaaaaaaaa']],
      [CANALES.fuente.cancelarInfo, []],
      [CANALES.fuente.confirmarYoutube, ['c1', meta]],
      [CANALES.fuente.reintentar, ['abc']]
    ] as [string, unknown[]][]) {
      expect(await sin[canal as keyof typeof sin](args), canal).toMatchObject({
        ok: false,
        error: { codigo: 'ARGUMENTOS_NO_VALIDOS' }
      })
    }
  })

  it('fuente: el error de la importación llega con código y detalles', async () => {
    const { deps } = crearDeps()
    deps.fuente.importar.mockRejectedValueOnce(
      Object.assign(new Error('No podemos leerlo'), {
        codigo: 'FORMATO_NO_SOPORTADO',
        detalles: 'x'
      })
    )
    const r = await crearManejadores(deps)[CANALES.fuente.importarArchivo](['/x/a.wav'])
    expect(r).toEqual({
      ok: false,
      error: { codigo: 'FORMATO_NO_SOPORTADO', mensaje: 'No podemos leerlo', detalles: 'x' }
    })
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
      aviso_youtube_aceptado: '2026-01-01T00:00:00.000Z'
    }
    const r = await crearManejadores(deps)[CANALES.config.actualizar]([parcial])
    expect(r.ok).toBe(true)
    expect(deps.config.actualizar).toHaveBeenCalledWith(parcial)
  })

  it('config.actualizar rechaza separacion.modo y separacion.rapido_aceptado', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    for (const separacion of [{ modo: 'rapido' }, { rapido_aceptado: '2026-11-05T10:00:00Z' }]) {
      const r = await m[CANALES.config.actualizar]([{ separacion }])
      expect(r.ok).toBe(false)
    }
    expect(deps.config.actualizar).not.toHaveBeenCalled()
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

  it('textoLegal devuelve el texto y rechaza tipos no válidos', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    expect(await m[CANALES.sistema.textoLegal](['gpl'])).toEqual({ ok: true, valor: 'texto gpl' })
    expect(await m[CANALES.sistema.textoLegal](['terceros'])).toEqual({
      ok: true,
      valor: 'texto terceros'
    })
    for (const mal of [['../LICENSE'], [], ['gpl', 'x'], [1]]) {
      expect(await m[CANALES.sistema.textoLegal](mal)).toMatchObject({
        ok: false,
        error: { codigo: 'ARGUMENTOS_NO_VALIDOS' }
      })
    }
    expect(deps.textoLegal).toHaveBeenCalledTimes(2)
  })

  it('abrirCarpetaDatos delega en main', async () => {
    const { deps } = crearDeps()
    expect(await crearManejadores(deps)[CANALES.sistema.abrirCarpetaDatos]([])).toMatchObject({
      ok: true
    })
    expect(deps.abrirCarpetaDatos).toHaveBeenCalledOnce()
  })

  it('sistema.info devuelve versión, SO y plataforma', async () => {
    const { deps } = crearDeps()
    expect(await crearManejadores(deps)[CANALES.sistema.info]([])).toEqual({
      ok: true,
      valor: {
        version: '1.0.0',
        so: 'Test 1',
        plataforma: 'linux',
        youtube: true,
        versionSo: '6.1',
        arquitectura: 'x64',
        emulada: false,
        ytdlp: { version: '2026.10.01', ultimaComprobacion: null }
      }
    })
  })
})

describe('runtime y cierre (0036)', () => {
  it('estado, instalar, pausar, detalles y confirmarCierre llegan al servicio', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    expect(await m[CANALES.runtime.estado]([])).toEqual({ ok: true, valor: estadoRt })
    expect(await m[CANALES.runtime.instalar]([])).toEqual({ ok: true, valor: undefined })
    expect(deps.runtime.instalar).toHaveBeenCalledOnce()
    await m[CANALES.runtime.pausar]([])
    expect(deps.runtime.pausar).toHaveBeenCalledOnce()
    expect(await m[CANALES.runtime.detalles]([])).toEqual({ ok: true, valor: 'detalles' })
    await m[CANALES.app.confirmarCierre]([])
    expect(deps.confirmarCierre).toHaveBeenCalledOnce()
  })

  it('app.salir llama a salir() de main y rechaza argumentos', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    expect(await m[CANALES.app.salir]([])).toEqual({ ok: true, valor: undefined })
    expect(deps.salir).toHaveBeenCalledOnce()
    expect(await m[CANALES.app.salir](['x'])).toMatchObject({ ok: false })
    expect(deps.salir).toHaveBeenCalledOnce()
  })

  it('requisitos pasa recalcularEspacio y estimarSeparacion la duración', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    await m[CANALES.runtime.requisitos]([{ recalcularEspacio: true }])
    expect(deps.runtime.requisitos).toHaveBeenCalledWith(true)
    expect(await m[CANALES.runtime.estimarSeparacion]([240000])).toEqual({
      ok: true,
      valor: { min: 1, max: 2, origen: 'estimado' }
    })
    expect(deps.runtime.estimarSeparacion).toHaveBeenCalledWith(240000, undefined)
  })

  it('aceptarYUsarRapido valida el origen (sin "ajustes") y volverACalidad llega al servicio (0057)', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    for (const origen of ['primer_arranque', 'separacion']) {
      expect(await m[CANALES.runtime.aceptarYUsarRapido]([origen])).toEqual({
        ok: true,
        valor: undefined
      })
      expect(deps.runtime.aceptarYUsarRapido).toHaveBeenLastCalledWith(origen)
    }
    for (const mal of [[], ['ajustes'], [1], ['separacion', 'x']]) {
      expect(await m[CANALES.runtime.aceptarYUsarRapido](mal)).toMatchObject({
        ok: false,
        error: { codigo: 'ARGUMENTOS_NO_VALIDOS' }
      })
    }
    expect(deps.runtime.aceptarYUsarRapido).toHaveBeenCalledTimes(2)
    await m[CANALES.runtime.volverACalidad]([])
    await m[CANALES.runtime.cancelarVolverACalidad]([])
    expect(deps.runtime.volverACalidad).toHaveBeenCalledOnce()
    expect(deps.runtime.cancelarVolverACalidad).toHaveBeenCalledOnce()
  })

  it('el error del servicio llega con su código (p. ej. sin oferta vigente)', async () => {
    const { deps } = crearDeps()
    vi.mocked(deps.runtime.aceptarYUsarRapido).mockRejectedValueOnce(
      Object.assign(new Error('sin oferta'), { codigo: 'ARGUMENTOS_NO_VALIDOS' })
    )
    const m = crearManejadores(deps)
    expect(await m[CANALES.runtime.aceptarYUsarRapido](['separacion'])).toMatchObject({
      ok: false,
      error: { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: 'sin oferta' }
    })
  })

  it('no hay otra vía de IPC que descargue el modelo Rápido', () => {
    const canales = Object.values(CANALES.runtime) as string[]
    expect(canales.filter((c) => /modelo|rapido|descarg/i.test(c))).toEqual([
      CANALES.runtime.aceptarYUsarRapido
    ])
    expect(Object.keys(CONTRATO).filter((c) => /modelo|descargar/i.test(c))).toEqual([])
  })

  it('rechaza argumentos inválidos sin llamar al servicio', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    const casos: [string, unknown[]][] = [
      [CANALES.runtime.estado, ['sobra']],
      [CANALES.runtime.instalar, [1]],
      [CANALES.runtime.pausar, ['x']],
      [CANALES.runtime.requisitos, []],
      [CANALES.runtime.requisitos, [{}]],
      [CANALES.runtime.requisitos, [{ recalcularEspacio: 'si' }]],
      [CANALES.runtime.requisitos, [{ recalcularEspacio: true, otro: 1 }]],
      [CANALES.runtime.estimarSeparacion, [-1]],
      [CANALES.runtime.estimarSeparacion, ['240000']],
      [CANALES.runtime.estimarSeparacion, [Number.NaN]],
      [CANALES.app.confirmarCierre, ['x']]
    ]
    for (const [canal, args] of casos) {
      const r = await m[canal as keyof typeof m](args)
      expect(r, canal).toMatchObject({ ok: false, error: { codigo: 'ARGUMENTOS_NO_VALIDOS' } })
    }
    expect(deps.runtime.instalar).not.toHaveBeenCalled()
    expect(deps.runtime.pausar).not.toHaveBeenCalled()
    expect(deps.runtime.requisitos).not.toHaveBeenCalled()
    expect(deps.confirmarCierre).not.toHaveBeenCalled()
  })

  it('los canales de runtime y cierre rechazan remitentes ajenos', async () => {
    const { deps } = crearDeps()
    const manejadores = new Map<string, (e: unknown, ...a: unknown[]) => unknown>()
    registrarIpc(
      { handle: (c, f) => void manejadores.set(c, f), removeHandler: () => undefined },
      deps,
      { remitenteValido: (e) => e === 'mio', difundir: vi.fn() }
    )
    for (const canal of [
      CANALES.runtime.instalar,
      CANALES.runtime.pausar,
      CANALES.runtime.aceptarYUsarRapido,
      CANALES.runtime.volverACalidad,
      CANALES.app.confirmarCierre,
      CANALES.app.salir
    ]) {
      expect(await manejadores.get(canal)?.('ajeno')).toMatchObject({ ok: false })
    }
    expect(deps.runtime.instalar).not.toHaveBeenCalled()
    expect(deps.runtime.aceptarYUsarRapido).not.toHaveBeenCalled()
    expect(deps.runtime.volverACalidad).not.toHaveBeenCalled()
    expect(deps.confirmarCierre).not.toHaveBeenCalled()
    expect(deps.salir).not.toHaveBeenCalled()
  })
})

describe('enlacePermitido', () => {
  it.each([
    ['https://lrclib.net', true],
    ['https://support.apple.com/es-es/108382', true],
    ['http://support.apple.com/es-es/108382', false],
    ['https://support.apple.com/es-es/108383', false],
    ['https://support.apple.com/es-es/1083829', false],
    ['https://support.apple.com/', false],
    ['https://apple.com/es-es/108382', false],
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

  it('registra 31 canales, rechaza remitentes ajenos y difunde eventos con URL de medios', async () => {
    const {
      deps,
      oyentesCancion,
      oyentesConfig,
      oyentesTrabajo,
      oyentesProgreso,
      oyentesRtProgreso,
      oyentesRtCambio
    } = crearDeps()
    const { ipc, manejadores } = ipcFalso()
    const difundir = vi.fn()
    const deshacer = registrarIpc(ipc, deps, {
      remitenteValido: (e) => e === 'mio',
      difundir
    })
    expect(manejadores.size).toBe(Object.keys(CONTRATO).length)
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

    oyentesRtProgreso[0]?.({ porcentajeGlobal: 5 })
    oyentesRtCambio[0]?.(estadoRt)
    expect(difundir).toHaveBeenNthCalledWith(6, CANALES.eventos.runtimeProgreso, {
      porcentajeGlobal: 5
    })
    expect(difundir).toHaveBeenNthCalledWith(7, CANALES.eventos.runtimeCambio, estadoRt)

    deshacer()
    expect(manejadores.size).toBe(0)
  })
})

describe('separación (0059)', () => {
  it('sin servicio, separar y estimar responden ERROR_INTERNO; valida los argumentos', async () => {
    const { deps } = crearDeps()
    const m = crearManejadores(deps)
    for (const canal of [CANALES.separacion.separar, CANALES.separacion.estimar]) {
      expect(await m[canal](['abc'])).toEqual({
        ok: false,
        error: { codigo: 'ERROR_INTERNO', mensaje: 'Algo salió mal.' }
      })
      expect(await m[canal]([])).toMatchObject({
        ok: false,
        error: { codigo: 'ARGUMENTOS_NO_VALIDOS' }
      })
    }
  })

  it('con servicio, delega en él', async () => {
    const { deps } = crearDeps()
    const separacion = {
      separar: vi.fn().mockResolvedValue(undefined),
      estimar: vi.fn().mockReturnValue({ min: 5, max: 6, origen: 'estimado' })
    }
    const m = crearManejadores({ ...deps, separacion })
    expect(await m[CANALES.separacion.separar](['abc'])).toEqual({ ok: true, valor: undefined })
    expect(await m[CANALES.separacion.estimar](['abc'])).toEqual({
      ok: true,
      valor: { min: 5, max: 6, origen: 'estimado' }
    })
    expect(separacion.separar).toHaveBeenCalledWith('abc')
  })
})
