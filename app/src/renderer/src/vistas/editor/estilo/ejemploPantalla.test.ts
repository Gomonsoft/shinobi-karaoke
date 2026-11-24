import { expect, it } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { fotogramaEn } from '../../../karaoke/render'
import { PANTALLA_PREDETERMINADA } from '@shared/pantalla'
import { crearEjemploPantalla } from './ejemploPantalla'

const textos = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete']
const cancion = letra(textos.map((t, i) => linea(`l${i}`, t, i * 1000)))

it('dura 12,5 s con cinco líneas desde la seleccionada, o antes si no quedan', () => {
  const e = crearEjemploPantalla(cancion, 'l1')
  expect(e.finMs - e.inicioMs).toBe(12_500)
  expect(e.letra.lineas.map((l) => l.texto)).toEqual(textos.slice(1, 6))
  expect(crearEjemploPantalla(cancion, 'l6').letra.lineas.map((l) => l.texto)).toEqual(
    textos.slice(2)
  )
  expect(crearEjemploPantalla(letra([linea('a', 'sola', 0)]), 'a').letra.lineas).toHaveLength(5)
})

it('tres relevos, un hueco de 3 s sin indicadores y una entrada', () => {
  const e = crearEjemploPantalla(cancion, 'l0')
  const ctx = { duracionMs: e.duracionMs, titulo: '', artista: '', espera: e.espera }
  // En el hueco (10 s) no hay espera; antes de la última línea siguen a la vista las ya cantadas.
  const hueco = fotogramaEn(e.letra, 10_000, { ...ctx, pantalla: PANTALLA_PREDETERMINADA })
  expect(hueco.espera).toBeNull()
  expect(hueco.actual).toBeNull()
  // Un relevo (4 s): sale una y entra otra en un solo cambio.
  const relevo = fotogramaEn(e.letra, 3100, { ...ctx, pantalla: PANTALLA_PREDETERMINADA })
  expect(relevo.cambio).not.toBeNull()
  expect(e.letra.lineas[4]!.inicio_ms! - e.letra.lineas[3]!.fin_ms!).toBe(3000)
})
