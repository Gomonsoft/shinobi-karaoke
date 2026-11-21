import { entrada } from '@shared/__fixtures__/sesion'
import {
  antesDeParaIndice,
  filaTrasQuitar,
  huecoPorPosicion,
  indiceTras,
  indiceTrasSoltar
} from './ordenCola'

const lista = [entrada(1), entrada(2), entrada(3), entrada(4)]
const id = (n: number) => entrada(n).entradaId

describe('ordenCola', () => {
  it('indiceTras respeta los extremos', () => {
    expect(indiceTras('subir', 0, 4)).toBeNull()
    expect(indiceTras('subir', 2, 4)).toBe(1)
    expect(indiceTras('bajar', 3, 4)).toBeNull()
    expect(indiceTras('bajar', 1, 4)).toBe(2)
    expect(indiceTras('inicio', 2, 4)).toBe(0)
    expect(indiceTras('inicio', 0, 4)).toBeNull()
    expect(indiceTras('fin', 1, 4)).toBe(3)
    expect(indiceTras('fin', 3, 4)).toBeNull()
  })

  it('antesDeParaIndice da la entrada que quedará detrás', () => {
    expect(antesDeParaIndice(lista, id(3), 0)).toBe(id(1))
    expect(antesDeParaIndice(lista, id(1), 1)).toBe(id(3))
    expect(antesDeParaIndice(lista, id(1), 3)).toBeNull()
    expect(antesDeParaIndice(lista, id(2), 1)).toBe(id(3))
  })

  it('indiceTrasSoltar ignora los huecos pegados a la propia fila', () => {
    expect(indiceTrasSoltar(1, 1)).toBeNull()
    expect(indiceTrasSoltar(1, 2)).toBeNull()
    expect(indiceTrasSoltar(1, 0)).toBe(0)
    expect(indiceTrasSoltar(1, 4)).toBe(3)
    expect(indiceTrasSoltar(1, 3)).toBe(2)
  })

  it('huecoPorPosicion cuenta los centros superados', () => {
    expect(huecoPorPosicion([10, 30, 50], 0)).toBe(0)
    expect(huecoPorPosicion([10, 30, 50], 31)).toBe(2)
    expect(huecoPorPosicion([10, 30, 50], 99)).toBe(3)
  })

  it('filaTrasQuitar: siguiente, si no anterior, si no encabezado', () => {
    expect(filaTrasQuitar(['a', 'b', 'c'], ['a', 'c'], 'b')).toBe('c')
    expect(filaTrasQuitar(['a', 'b', 'c'], ['a', 'b'], 'c')).toBe('b')
    expect(filaTrasQuitar(['a'], [], 'a')).toBeNull()
    expect(filaTrasQuitar(['a', 'b', 'c'], ['c'], 'a')).toBe('c')
  })
})
