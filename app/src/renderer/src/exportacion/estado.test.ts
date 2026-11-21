import {
  exportacionCompletada,
  exportacionDePrueba,
  exportacionEnCola,
  exportacionFallida,
  progresoDePrueba
} from '@shared/__fixtures__/exportacion'
import { EXP_ANUNCIO } from './dialogo/textosProgreso'
import { clasificarAviso, crearAlmacenExportaciones, hitoDe } from './estado'

const textos = {
  inicio: EXP_ANUNCIO.inicio,
  fase: EXP_ANUNCIO.fase,
  porcentaje: EXP_ANUNCIO.porcentaje,
  ok: EXP_ANUNCIO.ok,
  cancelada: EXP_ANUNCIO.cancelada
}

describe('almacén de exportaciones', () => {
  it('descarta eventos atrasados: el estado no retrocede', () => {
    const almacen = crearAlmacenExportaciones()
    almacen.cambio(exportacionDePrueba())
    almacen.cambio(exportacionEnCola())
    expect(almacen.obtener()[0]!.estado).toBe('en_curso')
    almacen.cambio(exportacionCompletada())
    almacen.cambio(exportacionDePrueba())
    expect(almacen.obtener()[0]!.estado).toBe('terminada')
  })

  it('el porcentaje nunca retrocede, ni de fase ni dentro de la fase', () => {
    const almacen = crearAlmacenExportaciones()
    almacen.cambio(
      exportacionDePrueba({ progreso: progresoDePrueba({ valor: 0.5, fotograma: 600 }) })
    )
    almacen.progreso(progresoDePrueba({ valor: 0.4, fotograma: 480 }))
    expect(almacen.obtener()[0]!.progreso!.valor).toBe(0.5)
    almacen.progreso(progresoDePrueba({ valor: 0.6, fotograma: 720 }))
    expect(almacen.obtener()[0]!.progreso!.valor).toBe(0.6)
    almacen.progreso(progresoDePrueba({ fase: 'preparando', valor: null, fotograma: 0 }))
    expect(almacen.obtener()[0]!.progreso!.fase).toBe('codificando')
    // Un cambio con progreso atrasado tampoco lo baja.
    almacen.cambio(
      exportacionDePrueba({ progreso: progresoDePrueba({ valor: 0.2, fotograma: 240 }) })
    )
    expect(almacen.obtener()[0]!.progreso!.valor).toBe(0.6)
  })

  it('el estado inicial no pisa lo que ya llegó por eventos', () => {
    const almacen = crearAlmacenExportaciones()
    almacen.cambio(exportacionCompletada())
    almacen.inicial([
      exportacionDePrueba(),
      exportacionDePrueba({ trabajoId: 'b0000000-0000-4000-8000-000000000002' })
    ])
    const lista = almacen.obtener()
    expect(lista).toHaveLength(2)
    expect(lista[0]!.estado).toBe('terminada')
  })

  it('mide lo que tardó desde que la vio en curso', () => {
    let t = 1000
    const almacen = crearAlmacenExportaciones(() => t)
    almacen.cambio(exportacionDePrueba())
    t = 433_000
    almacen.cambio(exportacionCompletada())
    expect(almacen.obtener()[0]!.tardoMs).toBe(432_000)
  })

  it('avisa a los suscriptores solo cuando algo cambia', () => {
    const almacen = crearAlmacenExportaciones()
    const cb = vi.fn()
    almacen.suscribir(cb)
    almacen.cambio(exportacionDePrueba())
    almacen.progreso(progresoDePrueba({ valor: 0.7, fotograma: 840 }))
    expect(cb).toHaveBeenCalledTimes(2)
  })
})

describe('avisos e hitos', () => {
  it('clasifica el resultado de una exportación', () => {
    const almacen = crearAlmacenExportaciones()
    const previa = almacen.cambio(exportacionDePrueba())
    expect(clasificarAviso(previa, exportacionCompletada())).toEqual({ tipo: 'ok' })
    expect(clasificarAviso(previa, exportacionFallida())).toEqual({ tipo: 'error' })
    const cancelada = exportacionDePrueba({
      estado: 'terminada',
      resultado: 'cancelada',
      progreso: null
    })
    expect(clasificarAviso(previa, cancelada)).toEqual({ tipo: 'cancelada' })
    const enCola = crearAlmacenExportaciones()
    enCola.cambio(exportacionEnCola())
    const colaPrevia = enCola.cambio(exportacionEnCola())
    expect(clasificarAviso(colaPrevia, cancelada)).toEqual({ tipo: 'quitada' })
    expect(clasificarAviso(previa, exportacionDePrueba())).toBeNull()
  })

  it('reconoce la limpieza fallida y la exportación interrumpida', () => {
    const limpieza = exportacionDePrueba({
      estado: 'terminada',
      resultado: 'cancelada',
      progreso: null,
      error: { codigo: 'LIMPIEZA_FALLIDA', mensaje: 'x', posicionMs: null }
    })
    expect(clasificarAviso(undefined, limpieza)).toEqual({ tipo: 'limpieza' })
    const interrumpida = exportacionDePrueba({
      estado: 'terminada',
      resultado: 'error',
      progreso: null,
      error: { codigo: 'PROCESO_TERMINADO', mensaje: 'x', posicionMs: null }
    })
    expect(clasificarAviso(undefined, interrumpida)).toEqual({ tipo: 'interrumpida' })
  })

  it('solo anuncia hitos: inicio, subpasos, 25/50/75 %, éxito y cancelación', () => {
    const almacen = crearAlmacenExportaciones()
    const ver = () => almacen.obtener()[0]!
    const previa = almacen.cambio(exportacionEnCola())
    almacen.cambio(exportacionDePrueba({ progreso: null }))
    expect(hitoDe(previa, ver(), textos)).toBe('Exportando «Canción de prueba».')

    let antes = ver()
    almacen.progreso(progresoDePrueba({ fase: 'preparando', valor: null, fotograma: 0 }))
    expect(hitoDe(antes, ver(), textos)).toBe('Preparando la canción…')

    antes = ver()
    almacen.progreso(progresoDePrueba({ valor: 0.1, fotograma: 120 }))
    expect(hitoDe(antes, ver(), textos)).toBe('Creando el video…')

    antes = ver()
    almacen.progreso(progresoDePrueba({ valor: 0.12, fotograma: 144 }))
    expect(hitoDe(antes, ver(), textos)).toBeNull()

    antes = ver()
    almacen.progreso(progresoDePrueba({ valor: 0.26, fotograma: 312 }))
    expect(hitoDe(antes, ver(), textos)).toBe('Creando el video: 25 %.')

    antes = ver()
    almacen.cambio(exportacionCompletada())
    expect(hitoDe(antes, ver(), textos)).toBe('Video exportado.')
  })
})
