import type { EstadoRuntimeIpc, ProgresoRuntimeIpc } from '@shared/ipc'
import {
  acumuladoVacio,
  acumular,
  decidirPantalla,
  formatearGb,
  formatearGbLibre,
  mensajeModo,
  nombreFase,
  nombreModoFinal,
  textoDeError,
  textoDescargaGenerica,
  textoEta,
  textoOfertaRapido,
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
    expect(textoTiempoListo({ min: 6, max: 14.2, origen: 'estimado' })).toBe(
      'Una canción de 4 minutos tardará entre 6 y 15 minutos, aproximadamente. Lo ajustaremos tras tu primera canción.'
    )
  })

  it('el mensaje de modelo es siempre Calidad y nunca anuncia Rápido', () => {
    expect(mensajeModo('calidad', 'cpu', null, { min: 6, max: 15 })).toBe(
      'Tu equipo no tiene una tarjeta gráfica compatible: separaremos las pistas con el modelo Calidad usando el procesador. Es más lento: una canción de 4 minutos tardará entre 6 y 15 minutos.'
    )
    expect(mensajeModo('calidad', 'cpu', 'memoria', null)).toMatch(
      /modelo Calidad usando el procesador/
    )
    expect(mensajeModo('calidad', 'mps', null)).toMatch(/chip Apple/)
    expect(mensajeModo('calidad', 'cuda', null)).toMatch(/NVIDIA/)
    for (const p of ['cpu', 'cuda', 'mps'] as const)
      expect(mensajeModo('calidad', p, null, { min: 1, max: 2 })).not.toMatch(/Rápido/)
    expect(nombreModoFinal('calidad', 'cpu')).toBe('Calidad, con el procesador')
  })

  it('la descarga genérica redondea hacia abajo y hacia arriba', () => {
    expect(textoDescargaGenerica([1_233_000_000, 5_350_000_000])).toBe(
      'Descarga: entre 1 y 6 GB según tu equipo'
    )
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
    rapidoPendiente: false,
    ofrecerRapido: false,
    volverACalidad: null,
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

describe('Rápido tras el consentimiento (0057)', () => {
  it('mensajeModo dice Rápido solo con modo rapido, también con rebaja', () => {
    expect(mensajeModo('rapido', 'cpu', null)).toBe(
      'Separaremos las pistas con el modelo Rápido usando el procesador.'
    )
    expect(mensajeModo('rapido', 'cpu', 'memoria')).toContain('modelo Rápido')
    expect(mensajeModo('calidad', 'cpu', null) ?? '').not.toContain('Rápido')
  })

  it('nombreFase: la fase del modelo dice (Rápido) solo al descargar Rápido', () => {
    expect(nombreFase('modelo', 'rapido')).toBe('Descargando el modelo de separación (Rápido)')
    expect(nombreFase('modelo', 'calidad')).toBe('Descargando el modelo de separación')
    expect(nombreFase('motor', 'rapido')).toBe('Preparando el motor de audio')
  })

  it('textoDeError: servidores "todos" en la fase de modelo y verificación completa', () => {
    expect(textoDeError('SERVICIO_NO_DISPONIBLE', null, 'modelo').titulo).toBe(
      'Los servidores de descarga no responden.'
    )
    expect(textoDeError('SERVICIO_NO_DISPONIBLE', null, 'componentes').titulo).toBe(
      'Uno de los servidores de descarga no responde.'
    )
    expect(textoDeError('VERIFICACION_FALLIDA', null).cuerpo).toContain('dos veces')
  })

  it('textoOfertaRapido: con SIN_ESPACIO dice cuánto ocupa Rápido', () => {
    expect(textoOfertaRapido('SIN_ESPACIO', 59_074_342)).toContain('(59 MB)')
    expect(textoOfertaRapido('VERIFICACION_FALLIDA', 59_074_342)).toContain('Si no puedes esperar')
  })
})
