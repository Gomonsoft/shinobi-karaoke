import { expect, it } from 'vitest'
import { CREADA_POR_DEFECTO } from '../../shared'
import { lista } from '../../shared/__fixtures__'
import { resumirCancion } from './resumen'

it('0266: `creada` es la fecha, o `null` si es la fecha por defecto', () => {
  const c = lista()
  expect(resumirCancion('a', c, null, null).creada).toBe(c.creada)
  expect(resumirCancion('a', { ...c, creada: CREADA_POR_DEFECTO }, null, null).creada).toBeNull()
})
