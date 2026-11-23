import { expect, it } from 'vitest'
import { CREADA_POR_DEFECTO } from '../../shared'
import { lista } from '../../shared/__fixtures__'
import { resumirCancion } from './resumen'

it('0266: `creada` es la fecha, o `null` si es la fecha por defecto', () => {
  const c = lista()
  expect(resumirCancion('a', c, null, null).creada).toBe(c.creada)
  expect(resumirCancion('a', { ...c, creada: CREADA_POR_DEFECTO }, null, null).creada).toBeNull()
})

it('0380: `prepararFinesSinMarca` solo si Preparar pondría fines y exige confirmar', () => {
  const c = lista()
  c.letra!.intacta = true
  expect(resumirCancion('a', c, null, null).prepararFinesSinMarca).toBe(false)
  const borrador = {
    ...c,
    estado: 'borrador' as const,
    letra: {
      ...c.letra!,
      lineas: c.letra!.lineas.map((l) => ({ ...l, fin_ms: null }))
    }
  }
  delete borrador.letra.intacta
  expect(resumirCancion('a', borrador, null, null).prepararFinesSinMarca).toBe(true)
  borrador.letra.intacta = true
  expect(resumirCancion('a', borrador, null, null).prepararFinesSinMarca).toBe(false)
})

it('0386: una Lista sin `intacta`, con líneas sin fin y sin fines de la preparación también lo ofrece', () => {
  const c = lista()
  c.letra = { ...c.letra!, lineas: c.letra!.lineas.map((l) => ({ ...l, fin_ms: null })) }
  delete c.letra.intacta
  expect(resumirCancion('a', c, null, null).prepararFinesSinMarca).toBe(true)
  c.letra.lineas[0] = { ...c.letra.lineas[0]!, fin_ms: 100, origen_fin: 'preparacion' }
  expect(resumirCancion('a', c, null, null).prepararFinesSinMarca).toBe(false)
})

it('0389: sin pista de voz (pistas dañadas o sin separar) la Lista no ofrece «Ajustar los fines…»', () => {
  const c = lista()
  c.letra = { ...c.letra!, lineas: c.letra!.lineas.map((l) => ({ ...l, fin_ms: null })) }
  delete c.letra.intacta
  expect(resumirCancion('a', c, null, null).prepararFinesSinMarca).toBe(true)
  // Pistas dañadas: la biblioteca las da por dañadas.
  expect(resumirCancion('a', c, null, 'pistas').prepararFinesSinMarca).toBe(false)
  // Sin separar: no hay voz de la que sacar picos.
  const sinSeparar = structuredClone(c)
  sinSeparar.pasos.separacion.estado = 'pendiente'
  expect(resumirCancion('a', sinSeparar, null, null).prepararFinesSinMarca).toBe(false)
})
