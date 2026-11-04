import { describe, expect, it } from 'vitest'
import {
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
