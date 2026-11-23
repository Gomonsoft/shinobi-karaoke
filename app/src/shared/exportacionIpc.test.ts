import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CANALES, ROLES_POR_CANAL } from './canales'
import { configPredeterminada, configSchema } from './config'
import { CODIGOS_ERROR, CODIGOS_SOLO_MAIN } from './errores'
import { CONTRATO, configParcialRendererSchema } from './ipc'
import { mensajeErrorSchema } from './protocolo'
import {
  ID_DESTINO,
  ID_TRABAJO,
  crearApiExportacionFalsa,
  destinoDePrueba,
  exportacionCompletada,
  exportacionDePrueba,
  exportacionEnCola,
  exportacionFallida,
  inicialDePrueba,
  perfilesDePrueba
} from './__fixtures__/exportacion'

const args = (canal: keyof typeof CONTRATO, a: unknown[]): boolean =>
  CONTRATO[canal].args.safeParse(a).success

const iniciar = {
  cancionId: 'c1',
  formato: 'mkv_av1',
  ancho: 1920,
  alto: 1080,
  fps: 30,
  audio: 'instrumental',
  destinoId: ID_DESTINO
}

describe('esquemas de la exportación', () => {
  it('iniciar acepta el perfil del catálogo y rechaza lo demás', () => {
    const canal = CANALES.exportacion.iniciar
    expect(args(canal, [iniciar])).toBe(true)
    expect(args(canal, [{ ...iniciar, ancho: 1921 }])).toBe(false)
    expect(args(canal, [{ ...iniciar, ancho: 1280 }])).toBe(false) // 1280 × 1080
    expect(args(canal, [{ ...iniciar, fps: 25 }])).toBe(false)
    expect(args(canal, [{ ...iniciar, formato: 'mp4' }])).toBe(false)
    expect(args(canal, [{ ...iniciar, audio: 'voz' }])).toBe(false)
    expect(args(canal, [{ ...iniciar, destinoId: 'no-uuid' }])).toBe(false)
  })

  it('iniciar rechaza rutas y campos extra', () => {
    const canal = CANALES.exportacion.iniciar
    expect(args(canal, [{ ...iniciar, ruta: '/tmp/a.mkv' }])).toBe(false)
    expect(args(canal, [{ ...iniciar, destino: '/tmp/a.mkv' }])).toBe(false)
  })

  it('estimar usa el mismo catálogo y no pide destino', () => {
    const estimar: Record<string, unknown> = { ...iniciar }
    delete estimar.destinoId
    expect(args(CANALES.exportacion.estimar, [estimar])).toBe(true)
    expect(args(CANALES.exportacion.estimar, [{ ...estimar, alto: 1000 }])).toBe(false)
  })

  it('destinoPropuesto admite desdeDestinoId opcional (0124)', () => {
    const canal = CANALES.exportacion.destinoPropuesto
    const base = { cancionId: 'c1', formato: 'webm_vp9' }
    expect(args(canal, [base])).toBe(true)
    expect(args(canal, [{ ...base, desdeDestinoId: ID_DESTINO }])).toBe(true)
    expect(args(canal, [{ ...base, desdeDestinoId: 'x' }])).toBe(false)
    expect(args(canal, [{ ...base, ruta: '/tmp' }])).toBe(false)
  })

  it('destinoPropuesto admite desdeTrabajoId y es excluyente con desdeDestinoId (0133)', () => {
    const canal = CANALES.exportacion.destinoPropuesto
    const base = { cancionId: 'c1', formato: 'mkv_av1' }
    expect(args(canal, [{ ...base, desdeTrabajoId: ID_TRABAJO }])).toBe(true)
    expect(args(canal, [{ ...base, desdeTrabajoId: 'x' }])).toBe(false)
    expect(args(canal, [{ ...base, desdeTrabajoId: ID_TRABAJO, desdeDestinoId: ID_DESTINO }])).toBe(
      false
    )
  })

  it('mostrarEnCarpeta acepta un trabajoId o un avisoId, uno solo (0132)', () => {
    const canal = CANALES.exportacion.mostrarEnCarpeta
    expect(args(canal, [{ trabajoId: ID_TRABAJO }])).toBe(true)
    expect(args(canal, [{ avisoId: ID_TRABAJO }])).toBe(true)
    expect(args(canal, [{ trabajoId: ID_TRABAJO, avisoId: ID_TRABAJO }])).toBe(false)
    expect(args(canal, [{ avisoId: 'x' }])).toBe(false)
    expect(args(canal, [{ ruta: '/tmp/a' }])).toBe(false)
  })

  it('avisosPendientes responde una lista de avisos con tipo conocido', () => {
    const res = CONTRATO[CANALES.exportacion.avisosPendientes].res
    const aviso = { avisoId: ID_TRABAJO, tipo: 'interrumpida', cancionId: 'c1', titulo: 'T' }
    expect(res.safeParse([aviso, { ...aviso, tipo: 'limpieza_fallida' }]).success).toBe(true)
    expect(res.safeParse([{ ...aviso, tipo: 'otro' }]).success).toBe(false)
  })

  it('ExportacionIpc lleva destinoExistia, iniciadaEn, terminadaEn y limpiezaFallida', () => {
    const res = CONTRATO[CANALES.exportacion.estado].res
    const e = exportacionCompletada()
    expect(e).toMatchObject({ destinoExistia: false, limpiezaFallida: false })
    expect(res.safeParse([{ ...e, limpiezaFallida: true, destinoExistia: true }]).success).toBe(
      true
    )
    const sin: Partial<typeof e> = { ...e }
    delete sin.limpiezaFallida
    expect(res.safeParse([sin]).success).toBe(false)
  })

  it('listo rechaza n negativo o no entero y trabajoId que no es UUID', () => {
    const listo = (o: object) =>
      args(CANALES.exportacion.listo, [{ trabajoId: ID_TRABAJO, n: 0, ...o }])
    expect(listo({})).toBe(true)
    expect(listo({ n: 41 })).toBe(true)
    expect(listo({ n: -1 })).toBe(false)
    expect(listo({ n: 1.5 })).toBe(false)
    expect(listo({ trabajoId: 'abc' })).toBe(false)
  })

  it('las respuestas de los fixtures cumplen su esquema', () => {
    const res = (canal: keyof typeof CONTRATO, v: unknown) =>
      CONTRATO[canal].res.safeParse(v).success
    expect(res(CANALES.exportacion.perfiles, perfilesDePrueba())).toBe(true)
    expect(res(CANALES.exportacion.elegirDestino, destinoDePrueba())).toBe(true)
    expect(res(CANALES.exportacion.elegirDestino, null)).toBe(true)
    expect(res(CANALES.exportacion.inicial, inicialDePrueba())).toBe(true)
    const estado = [
      exportacionDePrueba(),
      exportacionCompletada(),
      exportacionEnCola(),
      exportacionFallida()
    ]
    expect(res(CANALES.exportacion.estado, estado)).toBe(true)
  })

  it('el catálogo de perfiles marca los no soportados con su motivo', () => {
    const p = perfilesDePrueba((x) => (x.alto === 2160 ? 'memoria' : null))
    expect(p.perfiles).toHaveLength(48)
    expect(p.perfiles.filter((x) => !x.soportado)).toHaveLength(12)
  })
})

describe('roles de la exportación', () => {
  it('ROLES_POR_CANAL cubre exactamente CONTRATO', () => {
    expect(Object.keys(ROLES_POR_CANAL).sort()).toEqual(Object.keys(CONTRATO).sort())
  })

  it('la ventana de exportación solo tiene inicial y listo, y solo ella', () => {
    const deExportacion = Object.entries(ROLES_POR_CANAL)
      .filter(([, r]) => r.includes('exportacion'))
      .map(([c]) => c)
      .sort()
    expect(deExportacion).toEqual([CANALES.exportacion.inicial, CANALES.exportacion.listo].sort())
    for (const c of deExportacion) {
      expect(ROLES_POR_CANAL[c as keyof typeof ROLES_POR_CANAL]).toEqual(['exportacion'])
    }
  })

  it('el resto de canales de exportación son solo de la principal', () => {
    for (const [nombre, canal] of Object.entries(CANALES.exportacion)) {
      if (nombre === 'inicial' || nombre === 'listo') continue
      expect(ROLES_POR_CANAL[canal]).toEqual(['principal'])
    }
  })
})

describe('errores y protocolo', () => {
  it('los códigos de la exportación existen y los nuevos solo los genera main', () => {
    for (const c of [
      'SIN_ESPACIO',
      'DESTINO_NO_DISPONIBLE',
      'DESTINO_OCUPADO',
      'PERFIL_NO_SOPORTADO',
      'SIN_CODIFICADOR',
      'LIMPIEZA_FALLIDA',
      'ENTRADA_INCOMPLETA',
      'CANCION_NO_DISPONIBLE',
      'MEMORIA_INSUFICIENTE',
      'RUNTIME_NO_DISPONIBLE',
      'ERROR_INTERNO'
    ]) {
      expect(CODIGOS_ERROR).toContain(c)
    }
    for (const c of [
      'DESTINO_OCUPADO',
      'PERFIL_NO_SOPORTADO',
      'LIMPIEZA_FALLIDA',
      'CANCION_EXPORTANDOSE'
    ]) {
      expect(CODIGOS_SOLO_MAIN).toContain(c)
    }
    expect(CODIGOS_ERROR).not.toContain('EXPORTACION_BLOQUEADA')
  })

  it('el error del worker admite detalle.fotograma', () => {
    const r = mensajeErrorSchema.parse({
      tipo: 'error',
      codigo: 'SIN_ESPACIO',
      mensaje: 'x',
      detalle: { fotograma: 12 }
    })
    expect(r.detalle).toEqual({ fotograma: 12 })
    const sin = mensajeErrorSchema.parse({ tipo: 'error', codigo: 'A', mensaje: '' })
    expect(sin.detalle).toBeUndefined()
  })
})

describe('config.exportacion', () => {
  it('sin el bloque toma los valores por defecto', () => {
    expect(configPredeterminada().exportacion).toEqual({
      formato: 'mkv_av1',
      audio: 'instrumental',
      proporcion: '16:9',
      ancho: 1920,
      alto: 1080,
      fps: 30,
      carpeta: null,
      coros: true,
      factor_corrector: 1
    })
  })

  it('lee cada campo de forma tolerante', () => {
    const c = configSchema.parse({
      exportacion: {
        formato: 'avi',
        audio: 'instrumental_voz',
        ancho: 1024,
        alto: 768,
        fps: 25,
        carpeta: 5,
        factor_corrector: 50
      }
    }).exportacion
    expect(c).toEqual({
      formato: 'mkv_av1',
      audio: 'instrumental_voz',
      proporcion: '4:3',
      ancho: 1024,
      alto: 768,
      fps: 30,
      carpeta: null,
      coros: true,
      factor_corrector: 8
    })
  })

  it('una resolución fuera del catálogo vuelve a la de por defecto', () => {
    const c = configSchema.parse({
      exportacion: { ancho: 1000, alto: 1080, formato: 'webm_vp9', carpeta: '/v' }
    }).exportacion
    expect(c).toMatchObject({
      ancho: 1920,
      alto: 1080,
      proporcion: '16:9',
      formato: 'webm_vp9',
      carpeta: '/v'
    })
    const noObjeto = configSchema.parse({ exportacion: 'x' }).exportacion
    expect(noObjeto).toEqual(configPredeterminada().exportacion)
  })

  it('el renderer no puede escribirlo', () => {
    expect(configParcialRendererSchema.safeParse({ exportacion: { fps: 60 } }).success).toBe(false)
  })
})

const expuestos = vi.hoisted(() => new Map<string, Record<string, unknown>>())
const ipc = vi.hoisted(() => ({ invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() }))
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (nombre: string, api: Record<string, unknown>) => expuestos.set(nombre, api)
  },
  ipcRenderer: ipc,
  webUtils: { getPathForFile: () => '' }
}))

describe('preloads de la exportación', () => {
  beforeEach(() => {
    vi.resetModules()
    expuestos.clear()
    ipc.invoke.mockReset()
  })

  it('window.shinobiExportacion solo expone inicial, listo y alFotograma', async () => {
    await import('../preload/exportacion')
    expect([...expuestos.keys()]).toEqual(['shinobiExportacion'])
    expect(Object.keys(expuestos.get('shinobiExportacion')!).sort()).toEqual([
      'alFotograma',
      'inicial',
      'listo'
    ])
  })

  it('invoca los canales con los argumentos del contrato', async () => {
    await import('../preload/exportacion')
    const api = expuestos.get('shinobiExportacion') as {
      listo(id: string, n: number): Promise<unknown>
      alFotograma(cb: (p: unknown) => void): () => void
    }
    ipc.invoke.mockResolvedValueOnce({ ok: true, valor: undefined })
    await api.listo(ID_TRABAJO, 3)
    const [canal, carga] = ipc.invoke.mock.calls[0]!
    expect(canal).toBe(CANALES.exportacion.listo)
    expect(args(CANALES.exportacion.listo, [carga])).toBe(true)
    api.alFotograma(() => {})
    expect(ipc.on).toHaveBeenCalledWith(CANALES.eventos.exportacionFotograma, expect.any(Function))
  })

  it('window.shinobi.exportacion envía los argumentos que valida el contrato', async () => {
    await import('../preload/index')
    const api = expuestos.get('shinobi') as {
      exportacion: Record<string, (...a: unknown[]) => Promise<unknown>>
    }
    ipc.invoke.mockResolvedValue({ ok: true, valor: undefined })
    await api.exportacion.elegirDestino!(ID_DESTINO)
    await api.exportacion.cancelar!(ID_TRABAJO)
    await api.exportacion.iniciar!(iniciar)
    for (const [canal, ...resto] of ipc.invoke.mock.calls) {
      expect(args(canal as keyof typeof CONTRATO, resto)).toBe(true)
    }
    expect(ipc.invoke).toHaveBeenCalledTimes(3)
  })
})

describe('API falsa', () => {
  it('registra llamadas, responde por defecto y emite eventos', async () => {
    const f = crearApiExportacionFalsa()
    expect((await f.api.perfiles()).perfiles).toHaveLength(48)
    const visto = vi.fn()
    const baja = f.api.alCambiar(visto)
    f.emitirCambio(exportacionEnCola())
    baja()
    f.emitirCambio(exportacionEnCola())
    expect(visto).toHaveBeenCalledTimes(1)
    expect(f.llamadas).toEqual([['perfiles']])
  })
})
