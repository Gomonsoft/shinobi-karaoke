import { anuncio, formatearMB, instantanea, modeloDeProgreso, textoEtaLargo } from './modelo'

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
})
