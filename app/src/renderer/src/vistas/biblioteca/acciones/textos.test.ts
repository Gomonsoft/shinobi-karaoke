import { ACC, motivoDe } from './textos'

describe('textos de las acciones por lotes', () => {
  it('SIN_FUENTE explica qué falta y qué hacer (0300 n.º 1)', () => {
    expect(motivoDe('SIN_FUENTE')).toBe(
      'No se prepara: falta el audio. Ábrela con «Continuar» para elegir el archivo o descargarlo.'
    )
  })

  it('las notas de «Preparar» solo con fines y de «Eliminar» con trabajo (0300 n.º 2 y 5)', () => {
    expect(ACC.prep.notaFines).toBe('Ya tiene letra: ajustará los fines')
    expect(ACC.eliminar.nota.trabajo).toBe('Se cancelará su trabajo en curso')
  })
})
