import { describe, expect, it } from 'vitest'
import type { Cancion } from './cancion'
import {
  aplicaPreparar,
  estadoPreparacion,
  recuentosBandeja,
  estaIncompleta,
  etiquetaPasoActual,
  motivosParaNoEstarLista,
  pasoActual,
  puedeMarcarseLista,
  vistaAlContinuar
} from './derivados'
import {
  borradorRecienCreado,
  conError,
  descargando,
  interrumpida,
  letraAMediasUnaSinInicio,
  letraAMediasVariasSinInicio,
  letraMientrasSepara,
  lista,
  listaConPalabras,
  listaIncompletaUna,
  listaIncompletaVarias,
  separando,
  sinLetra
} from './__fixtures__'
import { letra } from './__fixtures__'

describe('pasoActual / etiquetaPasoActual', () => {
  it('es el primer paso no completado', () => {
    expect(pasoActual(descargando())).toBe('fuente')
    expect(pasoActual(borradorRecienCreado())).toBe('separacion')
    expect(pasoActual(separando())).toBe('separacion')
    expect(pasoActual(conError())).toBe('separacion')
    expect(pasoActual(sinLetra())).toBe('letra')
    expect(pasoActual(letraAMediasUnaSinInicio())).toBe('edicion')
  })
  it('letra y edición pueden avanzar mientras la separación sigue en curso: el paso actual sigue siendo la separación', () => {
    expect(pasoActual(letraMientrasSepara())).toBe('separacion')
  })
  it('lista', () => {
    expect(pasoActual(lista())).toBe('lista')
  })
  it('borrador con todos los pasos completados cae en edición', () => {
    const c = lista()
    c.estado = 'borrador'
    expect(pasoActual(c)).toBe('edicion')
  })
  it('etiquetas orientativas', () => {
    expect(etiquetaPasoActual(descargando())).toBe('borrador:fuente')
    expect(etiquetaPasoActual(separando())).toBe('borrador:separando')
    expect(etiquetaPasoActual(borradorRecienCreado())).toBe('borrador:separacion')
    expect(etiquetaPasoActual(sinLetra())).toBe('borrador:letra')
    expect(etiquetaPasoActual(letraAMediasUnaSinInicio())).toBe('borrador:edicion')
    expect(etiquetaPasoActual(lista())).toBe('lista')
  })
})

describe('motivosParaNoEstarLista / puedeMarcarseLista', () => {
  it('canción completa: sin motivos', () => {
    const c = lista()
    c.estado = 'borrador'
    expect(motivosParaNoEstarLista(c)).toEqual([])
    expect(puedeMarcarseLista(c)).toBe(true)
    expect(puedeMarcarseLista(listaConPalabras())).toBe(true)
  })
  it('borrador recién creado: faltan pistas y letra', () => {
    const codigos = motivosParaNoEstarLista(borradorRecienCreado()).map((m) => m.codigo)
    expect(codigos).toEqual(['SIN_PISTAS', 'SIN_LETRA'])
    expect(puedeMarcarseLista(borradorRecienCreado())).toBe(false)
  })
  it('fuente sin terminar', () => {
    expect(motivosParaNoEstarLista(descargando()).map((m) => m.codigo)).toContain(
      'FUENTE_INCOMPLETA'
    )
  })
  it('pistas null con separación completada también cuenta como sin pistas', () => {
    const c = sinLetra()
    c.pistas = null
    expect(motivosParaNoEstarLista(c).map((m) => m.codigo)).toContain('SIN_PISTAS')
  })
  it('una línea sin inicio: indica su número', () => {
    const m = motivosParaNoEstarLista(letraAMediasUnaSinInicio())
    expect(m).toEqual([
      { codigo: 'LINEAS_SIN_INICIO', mensaje: 'Falta sincronizar la línea 4.', lineas: [4] }
    ])
  })
  it('varias líneas sin inicio: lista sus números (sin contar pausas)', () => {
    const m = motivosParaNoEstarLista(letraAMediasVariasSinInicio())
    expect(m[0]?.lineas).toEqual([2, 3, 4])
    expect(m[0]?.mensaje).toBe('Falta sincronizar las líneas 2, 3, 4.')
  })
  it('letra solo con pausas o vacía cuenta como sin letra', () => {
    const c = sinLetra()
    c.letra = letra([])
    expect(motivosParaNoEstarLista(c).map((m) => m.codigo)).toEqual(['SIN_LETRA'])
  })
})

describe('estaIncompleta', () => {
  it('solo las listas con líneas sin inicio', () => {
    expect(estaIncompleta(lista())).toBe(false)
    expect(estaIncompleta(listaConPalabras())).toBe(false)
    expect(estaIncompleta(listaIncompletaUna())).toBe(true)
    expect(estaIncompleta(listaIncompletaVarias())).toBe(true)
    expect(estaIncompleta(letraAMediasUnaSinInicio())).toBe(false)
  })
})

describe('vistaAlContinuar (ux/00 §3)', () => {
  it('fuente pendiente / error / interrumpida → añadir canción', () => {
    const c = borradorRecienCreado()
    for (const estado of ['pendiente', 'error', 'interrumpido'] as const) {
      c.pasos.fuente.estado = estado
      expect(vistaAlContinuar(c)).toBe('anadir')
    }
  })
  it('fuente pendiente con descarga en cola → progreso', () => {
    const c = borradorRecienCreado()
    c.pasos.fuente.estado = 'pendiente'
    expect(vistaAlContinuar(c, { fuenteEnCola: true })).toBe('progreso')
  })
  it('fuente en curso → progreso', () => {
    expect(vistaAlContinuar(descargando())).toBe('progreso')
  })
  it('separación en curso / pendiente / error / interrumpida y sin letra → progreso', () => {
    expect(vistaAlContinuar(separando())).toBe('progreso')
    expect(vistaAlContinuar(borradorRecienCreado())).toBe('progreso')
    expect(vistaAlContinuar(conError())).toBe('progreso')
    expect(vistaAlContinuar(interrumpida())).toBe('progreso')
  })
  it('separación en curso, sin letra y progreso ya visto → letra', () => {
    expect(vistaAlContinuar(separando(), { progresoVisto: true })).toBe('letra')
    expect(vistaAlContinuar(conError(), { progresoVisto: true })).toBe('progreso')
  })
  it('separación completada y sin letra → letra', () => {
    expect(vistaAlContinuar(sinLetra())).toBe('letra')
  })
  it('con letra → editor, incluso con la separación en curso', () => {
    expect(vistaAlContinuar(letraAMediasUnaSinInicio())).toBe('editor')
    expect(vistaAlContinuar(letraMientrasSepara())).toBe('editor')
  })
  it('lista → editor', () => {
    expect(vistaAlContinuar(lista())).toBe('editor')
  })
})

describe('estadoPreparacion (0.2.2)', () => {
  const prep = (extra: Partial<NonNullable<Cancion['preparacion']>>): Cancion['preparacion'] => ({
    estado: 'en_curso',
    paso: null,
    origen: 'automatica',
    actualizado: '2026-11-21T10:00:00.000Z',
    dudosas: 0,
    revisada: false,
    ...extra
  })

  it('«Lista para revisar» se deriva de los pasos, la haya preparado la app o el usuario', () => {
    const c = { ...lista(), estado: 'borrador' as const }
    expect(estadoPreparacion(c)).toBe('lista_para_revisar')
    expect(estadoPreparacion({ ...c, preparacion: prep({ estado: 'lista_para_revisar' }) })).toBe(
      'lista_para_revisar'
    )
    // Una línea sin inicio la devuelve a borrador.
    expect(estadoPreparacion(letraAMediasUnaSinInicio())).toBeNull()
    // Una lista guardada no es «para revisar».
    expect(estadoPreparacion(lista())).toBeNull()
  })

  it('sin letra sale del registro; con letra, lo de la búsqueda deja de valer', () => {
    const base = sinLetra()
    expect(estadoPreparacion(base)).toBeNull()
    const con = (p: Cancion['preparacion']): Cancion => ({ ...base, preparacion: p })
    expect(estadoPreparacion(con(prep({ estado: 'en_curso' })))).toBe('preparando')
    expect(estadoPreparacion(con(prep({ estado: 'elige_letra' })))).toBe('elige_letra')
    expect(estadoPreparacion(con(prep({ estado: 'sin_letra' })))).toBe('sin_letra')
    expect(
      estadoPreparacion(
        con(
          prep({
            estado: 'sin_letra',
            busqueda: { resultado: 'instrumental', candidatas: 0, motivo: 'INSTRUMENTAL', ids: [] }
          })
        )
      )
    ).toBe('instrumental')
    expect(
      estadoPreparacion(
        con(
          prep({
            estado: 'error',
            busqueda: { resultado: 'pendiente', candidatas: 0, motivo: 'SIN_CONEXION', ids: [] }
          })
        )
      )
    ).toBe('letra_pendiente')
    expect(estadoPreparacion(con(prep({ estado: 'error' })))).toBe('error')
    expect(estadoPreparacion(con(prep({ estado: 'detenida' })))).toBe('detenida')
    const conLetra = { ...letraAMediasUnaSinInicio(), preparacion: prep({ estado: 'elige_letra' }) }
    expect(estadoPreparacion(conLetra)).toBeNull()
  })
})

describe('recuentosBandeja', () => {
  const r = (
    estadoPreparacion: Parameters<typeof recuentosBandeja>[0][number]['estadoPreparacion'],
    pasos: { fuente?: string; letra?: string; separacion?: string } = {}
  ): Parameters<typeof recuentosBandeja>[0][number] => ({
    estado: 'borrador',
    danada: false,
    estadoPreparacion,
    pasos: {
      fuente: { estado: pasos.fuente ?? 'completado' },
      separacion: { estado: pasos.separacion ?? 'completado' },
      letra: { estado: pasos.letra ?? 'pendiente' },
      edicion: { estado: 'pendiente' }
    }
  })

  it('cuenta cada casilla una sola vez', () => {
    const n = recuentosBandeja([
      r('lista_para_revisar', { letra: 'completado' }),
      r('elige_letra'),
      r('sin_letra'),
      r('instrumental'),
      r('letra_pendiente'),
      r(null), // «Falta la letra»: sin letra y sin búsqueda
      r('preparando'),
      r(null, { fuente: 'pendiente' }), // aún descargando
      r('error', { separacion: 'error' }),
      { ...r(null), estado: 'lista' },
      { ...r(null), danada: true, pasos: null }
    ])
    expect(n).toEqual({ listasParaRevisar: 1, esperanLetra: 5, conError: 1 })
  })
})

describe('aplicaPreparar', () => {
  it('borrador sin letra y con fuente: busca, comprueba y ajusta los fines', () => {
    const c = sinLetra()
    expect(aplicaPreparar(c)).toEqual({
      aplica: true,
      pasos: ['buscando_letra', 'comprobando', 'ajustando_fines']
    })
  })
  it('lista o sin fuente: no aplica y dice por qué; una letra del usuario sin fines pide confirmación', () => {
    const l = lista()
    l.letra!.intacta = true
    expect(aplicaPreparar(l)).toMatchObject({ aplica: false, motivo: 'YA_LISTA' })
    const sf = sinLetra()
    sf.pasos.fuente.estado = 'pendiente'
    expect(aplicaPreparar(sf)).toMatchObject({ aplica: false, motivo: 'SIN_FUENTE' })
    const b = lista()
    b.estado = 'borrador'
    // Antes de 0.2.2 esto era NADA_QUE_HACER; ahora ofrece los fines, solo con confirmación (pregunta 0278).
    expect(aplicaPreparar(b)).toMatchObject({ aplica: true, confirmar: 'finesSinMarca' })
  })

  /** Borrador con letra con tiempos y sin fines (como un LRC de 0.2.1). */
  const lrcSinMarca = (intacta?: boolean): Cancion => {
    const c = lista()
    c.estado = 'borrador'
    c.letra!.lineas = c.letra!.lineas.map((l) => ({ ...l, fin_ms: null }))
    delete c.letra!.intacta
    if (intacta) c.letra!.intacta = true
    return c
  }
  it('letra sin `intacta` con fines nulos: solo ajusta los fines y pide confirmación', () => {
    expect(aplicaPreparar(lrcSinMarca())).toEqual({
      aplica: true,
      pasos: ['ajustando_fines'],
      confirmar: 'finesSinMarca'
    })
  })
  it('con `intacta` sigue como siempre y sin confirmación', () => {
    const r = aplicaPreparar(lrcSinMarca(true))
    expect(r).toEqual({ aplica: true, pasos: ['comprobando', 'ajustando_fines'] })
    expect(r.confirmar).toBeUndefined()
  })
  it('sin fines nulos, sin inicios, con fines ya puestos o lista: no ofrece nada', () => {
    const sinNulos = lrcSinMarca()
    sinNulos.letra!.lineas = sinNulos.letra!.lineas.map((l) => ({ ...l, fin_ms: 1 }))
    expect(aplicaPreparar(sinNulos)).toMatchObject({ aplica: false, motivo: 'NADA_QUE_HACER' })
    const sinInicios = lrcSinMarca()
    sinInicios.letra!.lineas = sinInicios.letra!.lineas.map((l) => ({ ...l, inicio_ms: null }))
    expect(aplicaPreparar(sinInicios)).toMatchObject({ aplica: false, motivo: 'NADA_QUE_HACER' })
    const conFines = lrcSinMarca()
    conFines.preparacion = {
      estado: 'error',
      origen: 'manual',
      fines: { metodo: 'silencios', lineas: 1 }
    } as Cancion['preparacion']
    expect(aplicaPreparar(conFines)).toMatchObject({ aplica: false, motivo: 'NADA_QUE_HACER' })
    const l = lrcSinMarca(true)
    l.estado = 'lista'
    expect(aplicaPreparar(l)).toMatchObject({ aplica: false, motivo: 'YA_LISTA' })
  })

  it('Lista o Letra lista sin `intacta` y con fines nulos: solo los fines, con confirmación (0386)', () => {
    const l = lrcSinMarca()
    l.estado = 'lista'
    expect(aplicaPreparar(l)).toEqual({
      aplica: true,
      pasos: ['ajustando_fines'],
      confirmar: 'finesSinMarca'
    })
  })

  it('una Lista que ya recibió fines de la preparación no se ofrece otra vez (0386)', () => {
    const l = lrcSinMarca()
    l.estado = 'lista'
    l.letra!.lineas[0] = { ...l.letra!.lineas[0]!, fin_ms: 2000, origen_fin: 'preparacion' }
    expect(aplicaPreparar(l)).toMatchObject({ aplica: false, motivo: 'YA_LISTA' })
  })
})
