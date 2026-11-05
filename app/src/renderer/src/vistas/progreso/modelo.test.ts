import {
  anuncio,
  formatearDuracion,
  formatearMB,
  instantanea,
  modeloDeProgreso,
  textoEtaLargo
} from './modelo'

const base = {
  tipoFuente: 'youtube' as const,
  fuente: { estado: 'pendiente', error: null },
  tituloOtra: null,
  colaOcupada: false,
  bytesFinales: null,
  vivo: null
}
const vivo = (valor: number | null, fase = 'descargando') =>
  ({
    trabajo: { id: 't', estado: 'en_curso', posicion: null, progreso: null },
    progreso: { fase, valor, etaSegundos: null }
  }) as never

describe('modelo de progreso', () => {
  it('formatea MB y ETA', () => {
    expect(formatearMB(5_800_000)).toBe('5,8 MB')
    expect(textoEtaLargo(30)).toBe('menos de 1 minuto')
    expect(textoEtaLargo(70)).toBe('queda 1 minuto aprox.')
    expect(textoEtaLargo(300)).toBe('quedan unos 5 minutos')
  })

  it('la barra no retrocede (piso)', () => {
    const m = modeloDeProgreso({ ...base, vivo: vivo(0.3), piso: 0.5 })
    expect(m.filas[0]!.barra).toBe(50)
  })

  it('anuncia inicio, tramos, fin y error', () => {
    const a = (v: number | null) => modeloDeProgreso({ ...base, vivo: vivo(v) })
    const m0 = a(0.1)
    expect(anuncio(null, instantanea(m0), m0)).toBeNull()
    const pend = modeloDeProgreso(base)
    expect(anuncio(instantanea(pend), instantanea(m0), m0)).toBe('Descargar de YouTube: en curso')
    const m1 = a(0.3)
    expect(anuncio(instantanea(m0), instantanea(m1), m1)).toBe('Descargar de YouTube: 25 %')
    const fin = modeloDeProgreso({ ...base, fuente: { estado: 'completado', error: null } })
    expect(anuncio(instantanea(m1), instantanea(fin), fin)).toBe('Descargar de YouTube: terminado')
    const err = modeloDeProgreso({ ...base, fuente: { estado: 'error', error: null } })
    expect(anuncio(instantanea(m1), instantanea(err), err)).toBe('Error: Descargar de YouTube')
  })

  it('una descarga en cola por mantenimiento muestra prog.cola.descarga.mantenimiento', () => {
    const vivoCola = {
      trabajo: { id: 't', estado: 'en_cola', posicion: 1, progreso: null, motivo: 'mantenimiento' },
      progreso: null
    } as never
    const m = modeloDeProgreso({ ...base, vivo: vivoCola })
    expect(m.filas[0]!.texto).toContain('se está actualizando')
  })

  it('cancelar solo con trabajo de YouTube', () => {
    expect(modeloDeProgreso({ ...base, vivo: vivo(0.1) }).cancelar).toBe('curso')
    expect(modeloDeProgreso({ ...base, tipoFuente: 'archivo' }).cancelar).toBeNull()
  })

  it('espera de un reintento de red: prog.reintento.red, sin barra, icono de curso y cancelar disponible', () => {
    const m = modeloDeProgreso({ ...base, vivo: vivo(null, 'reintentando'), esperaS: 15 })
    expect(m.filas[0]).toMatchObject({
      icono: 'curso',
      texto: 'Reintentando en 15 s…',
      barra: null
    })
    expect(m.bloque).toEqual({ tipo: 'mientras' })
    expect(m.cancelar).toBe('curso')
  })

  describe('separación', () => {
    const entrada = {
      ...base,
      fuente: { estado: 'completado', error: null },
      separacion: { estado: 'en_curso', error: null }
    }
    const sep = (fase: string, valor: number | null, extra = {}) =>
      ({
        trabajo: { id: 's', estado: 'en_curso', posicion: null, progreso: null, modo: 'calidad' },
        progreso: { fase, valor, etaSegundos: null, ...extra }
      }) as never
    const fila = (m: ReturnType<typeof modeloDeProgreso>) => m.filas[m.filas.length - 1]!

    it('terminada: duración real a la derecha, bloque terminado y anuncio "Terminado"', () => {
      const hecha = { estado: 'completado', error: null, segundos: 108 }
      const m = modeloDeProgreso({ ...entrada, separacion: hecha })
      expect(fila(m)).toMatchObject({ icono: 'completado', dato: '1 min 48 s' })
      expect(m.bloque).toEqual({ tipo: 'terminado' })
      expect(modeloDeProgreso({ ...entrada, separacion: hecha, hayLetra: true }).bloque).toEqual({
        tipo: 'terminado',
        editor: true
      })
      const antes = modeloDeProgreso(entrada)
      expect(anuncio(instantanea(antes), instantanea(m), m)).toBe('Terminado')
    })

    it('terminada sin duración guardada: sin dato', () => {
      const m = modeloDeProgreso({ ...entrada, separacion: { estado: 'completado', error: null } })
      expect(fila(m).dato).toBeNull()
    })

    it('formatearDuracion', () => {
      expect(formatearDuracion(48.4)).toBe('48 s')
      expect(formatearDuracion(120)).toBe('2 min')
      expect(formatearDuracion(108)).toBe('1 min 48 s')
    })

    it('la barra de separando no retrocede (pisoSep) y solo cancela la separación', () => {
      const m = modeloDeProgreso({ ...entrada, vivoSep: sep('separando', 0.3), pisoSep: 0.5 })
      expect(fila(m)).toMatchObject({
        barra: 50,
        texto: 'Separando… 50 %',
        eta: 'Calculando tiempo…'
      })
      expect(m.cancelar).toBe('curso')
      expect(m.cancelarPaso).toBe('separacion')
    })

    it('anuncia el inicio de cada fase y los tramos, no los valores interpolados', () => {
      const ant = modeloDeProgreso({ ...entrada, vivoSep: sep('cargando_modelo', null) })
      const s0 = modeloDeProgreso({ ...entrada, vivoSep: sep('separando', 0.1) })
      expect(anuncio(instantanea(ant), instantanea(s0), s0)).toBe('Separando la voz de la música.')
      const s1 = modeloDeProgreso({ ...entrada, vivoSep: sep('separando', 0.3) })
      expect(anuncio(instantanea(s0), instantanea(s1), s1)).toBe('Separar voz e instrumental: 25 %')
      const s2 = modeloDeProgreso({ ...entrada, vivoSep: sep('separando', 0.32) })
      expect(anuncio(instantanea(s1), instantanea(s2), s2)).toBeNull()
      const g = modeloDeProgreso({ ...entrada, vivoSep: sep('guardando', null) })
      expect(anuncio(instantanea(s2), instantanea(g), g)).toBe('Guardando las pistas…')
    })

    it('la oferta solo con ofrecerRapido y código ofertable', () => {
      const err = (codigo: string, extra = {}) =>
        modeloDeProgreso({
          ...entrada,
          separacion: { estado: 'error', error: { codigo, mensaje: '' } },
          ...extra
        }).bloque
      expect(err('MEMORIA_INSUFICIENTE', { ofrecerRapido: true })).toMatchObject({
        oferta: 'dialogo',
        textoOferta: true
      })
      expect(err('SIN_ESPACIO', { ofrecerRapido: true })).toMatchObject({ oferta: null })
      expect(err('MEMORIA_INSUFICIENTE')).toMatchObject({ oferta: null, textoOferta: false })
      expect(err('MEMORIA_INSUFICIENTE', { rapidoPendiente: true })).toMatchObject({
        oferta: 'directa',
        reintentaRapido: true
      })
    })
  })
})
