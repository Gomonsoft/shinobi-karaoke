import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancionDosCantantes } from '@shared/__fixtures__/reparto'
import { estiloPredeterminado } from '@shared/estilo'
import { PANTALLA_PREDETERMINADA } from '@shared/pantalla'
import { anadirCantante } from '@shared/reparto'
import { PantallaLetra } from './PantallaLetra'

/*
 * I-1 (pantalla en negro): con la reproducción en marcha, el número de zonas cambia (estilo «Varias voces», un
 * cantante añadido, un coro nuevo) y el render lee un fotograma que aún no existe. Antes: «Cannot read
 * properties of undefined (reading 'espera')» desmontaba todo el editor.
 */
const estiloCon = (zonas: 'una' | 'por_parte') => {
  const e = estiloPredeterminado()
  e.pantalla = { ...PANTALLA_PREDETERMINADA, zonas }
  return e
}
const base = {
  titulo: 'Inventada',
  artista: 'Shinobi',
  duracionMs: 30_000,
  movimiento: 'completo' as const
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(720)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

async function conReloj(ui: (t: () => number) => React.ReactElement) {
  const reloj = () => 5500
  const r = render(ui(reloj))
  // Deja correr el bucle de la reproducción: es lo que guarda `vivo`.
  await act(async () => {
    await new Promise((res) => setTimeout(res, 60))
  })
  return { r, reloj }
}

describe('cambio del número de zonas con la canción sonando', () => {
  const duo = cancionDosCantantes().letra!

  it('de «Una» a «Cada una en su zona»', async () => {
    const { r, reloj } = await conReloj((t) => (
      <PantallaLetra
        {...base}
        letra={duo}
        estilo={estiloCon('una')}
        reproduciendo
        obtenerTiempoAudio={t}
      />
    ))
    expect(() =>
      r.rerender(
        <PantallaLetra
          {...base}
          letra={duo}
          estilo={estiloCon('por_parte')}
          reproduciendo
          obtenerTiempoAudio={reloj}
        />
      )
    ).not.toThrow()
  })

  it('al añadir un cantante', async () => {
    const { r, reloj } = await conReloj((t) => (
      <PantallaLetra
        {...base}
        letra={duo}
        estilo={estiloCon('por_parte')}
        reproduciendo
        obtenerTiempoAudio={t}
      />
    ))
    expect(() =>
      r.rerender(
        <PantallaLetra
          {...base}
          letra={anadirCantante(duo)}
          estilo={estiloCon('por_parte')}
          reproduciendo
          obtenerTiempoAudio={reloj}
        />
      )
    ).not.toThrow()
  })

  it('al empezar a sonar con un `vivo` de antes de añadir el cantante', async () => {
    const { r, reloj } = await conReloj((t) => (
      <PantallaLetra
        {...base}
        letra={duo}
        estilo={estiloCon('por_parte')}
        reproduciendo
        obtenerTiempoAudio={t}
      />
    ))
    // Pausa, se añade un cantante y se vuelve a reproducir (doble clic en una línea).
    r.rerender(
      <PantallaLetra
        {...base}
        letra={duo}
        estilo={estiloCon('por_parte')}
        reproduciendo={false}
        obtenerTiempoAudio={reloj}
      />
    )
    r.rerender(
      <PantallaLetra
        {...base}
        letra={anadirCantante(duo)}
        estilo={estiloCon('por_parte')}
        reproduciendo={false}
        obtenerTiempoAudio={reloj}
      />
    )
    expect(() =>
      r.rerender(
        <PantallaLetra
          {...base}
          letra={anadirCantante(duo)}
          estilo={estiloCon('por_parte')}
          reproduciendo
          obtenerTiempoAudio={reloj}
        />
      )
    ).not.toThrow()
  })
})
