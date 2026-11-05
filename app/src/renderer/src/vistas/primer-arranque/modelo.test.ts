import type { EstadoRuntimeIpc, ProgresoRuntimeIpc } from '@shared/ipc'
import {
  acumuladoVacio,
  acumular,
  decidirPantalla,
  formatearGb,
  formatearGbLibre,
  textoEta,
  textoTiempoListo
} from './modelo'

describe('cifras', () => {
  it('redondea a una cifra decimal con coma', () => {
    expect(formatearGb(700_000_000)).toBe('0,7')
    expect(formatearGb(3_000_000_000)).toBe('3')
    expect(formatearGb(120_000_000_000)).toBe('120')
    expect(formatearGbLibre(3_149_000_000)).toBe('3,1')
  })

  it('el tiempo restante sigue la tabla de ux/01', () => {
    expect(textoEta(300, 5_000)).toBe('Calculando tiempo…')
    expect(textoEta(null, 20_000)).toBe('Calculando tiempo…')
    expect(textoEta(20, 10_000)).toBe('menos de 1 minuto')
    expect(textoEta(65, 10_000)).toBe('quedan unos 2 minutos')
    expect(textoEta(360, 10_000)).toBe('quedan unos 6 minutos')
    expect(textoEta(2000, 10_000)).toBe('más de 30 minutos')
  })

  it('el tiempo de una canción redondea el rango', () => {
    expect(textoTiempoListo({ min: 0.8, max: 1.7 })).toBe(
      'Una canción de 4 minutos tardará entre 1 y 2 minutos.'
    )
    expect(textoTiempoListo({ min: 2, max: 2 })).toBe(
      'Una canción de 4 minutos tardará unos 2 minutos.'
    )
    expect(textoTiempoListo(null)).toBeNull()
  })
})

describe('acumular', () => {
  const p = (extra: Partial<ProgresoRuntimeIpc>): ProgresoRuntimeIpc => ({
    faseVisible: 'componentes',
    estados: { motor: 'completada', componentes: 'en_curso', modelo: 'pendiente' },
    bytes: 50,
    total: 100,
    totalGlobal: 300,
    porcentajeGlobal: 40,
    etaSegundos: null,
    modo: null,
    motivoRebaja: null,
    comprobando: false,
    ...extra
  })

  it('no retrocede y limita la fase a 99 hasta completarla', () => {
    let a = acumular(acumuladoVacio(), p({ bytes: 100 }), 1000)
    expect(a.fases).toEqual({ motor: 100, componentes: 99, modelo: 0 })
    a = acumular(a, p({ bytes: 10, porcentajeGlobal: 20 }), 2000)
    expect(a.fases.componentes).toBe(99)
    expect(a.total).toBe(40)
    expect(a.inicio).toBe(1000)
  })
})

describe('decidirPantalla', () => {
  const estado = (extra: Partial<EstadoRuntimeIpc>): EstadoRuntimeIpc => ({
    estado: 'pendiente',
    fases: { motor: 'pendiente', componentes: 'pendiente', modelo: 'pendiente' },
    error: null,
    perfilPrevisto: null,
    perfil: null,
    motivoRebaja: null,
    modo: null,
    bytesRestantes: null,
    ...extra
  })
  it('espera al estado y a los requisitos', () => {
    expect(
      decidirPantalla({ estado: null, requisitos: null, sesion: false, iniciando: false })
    ).toBe('cargando')
    expect(
      decidirPantalla({ estado: estado({}), requisitos: null, sesion: false, iniciando: false })
    ).toBe('cargando')
  })
  it('completa va a la Biblioteca salvo que se haya instalado en esta sesión', () => {
    const e = estado({ estado: 'completa' })
    expect(decidirPantalla({ estado: e, requisitos: null, sesion: false, iniciando: false })).toBe(
      'biblioteca'
    )
    expect(decidirPantalla({ estado: e, requisitos: null, sesion: true, iniciando: false })).toBe(
      'b3'
    )
  })
})
