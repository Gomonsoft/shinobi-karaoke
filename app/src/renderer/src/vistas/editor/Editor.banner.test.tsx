import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import type { Cancion } from '@shared/cancion'
import { apiPicosFalsa } from '../letra/fixturesPicos'
import { apiEditorFalsa, cancionSincronizadaLrclib } from './fixturesApi'
import { olvidarPicosBase } from './picosBase'
import { Editor } from './Editor'

const motor = vi.hoisted(() => ({
  usarPista: vi.fn(async () => undefined),
  posicionMs: vi.fn(() => 4200),
  buscar: vi.fn(),
  pausar: vi.fn(),
  liberarAudio: vi.fn(),
  reproducir: vi.fn(async () => undefined),
  fijarVelocidad: vi.fn(),
  fijarBucle: vi.fn(() => true),
  suscribir: vi.fn(() => () => undefined),
  estado: vi.fn(() => ({ sonando: false, duracionMs: 30_000, pista: 'original', velocidad: 1 }))
}))
vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => ({
    motor,
    estado: { sonando: false, pista: 'original', velocidad: 1, duracionMs: 30_000 }
  })
}))

const ahora = '2026-11-21T10:00:00Z'

/** Borrador preparado por la app: letra de LRCLIB elegida sola, desfase corregido y fines de la preparación. */
function preparada(conRegistro = true): Cancion {
  const c = cancionSincronizadaLrclib()
  const letra = c.letra!
  letra.desfase_corregido_ms = 800
  letra.offset_ms = 800
  for (const l of letra.lineas) {
    if (l.tipo !== 'linea' || l.inicio_ms === null) continue
    l.fin_ms = l.inicio_ms + 2000
    if (l.id !== 'l3') l.origen_fin = 'preparacion'
  }
  if (conRegistro) {
    c.preparacion = {
      estado: 'lista_para_revisar',
      paso: null,
      origen: 'automatica',
      actualizado: ahora,
      busqueda: { resultado: 'elegida', candidatas: 2, motivo: null, ids: [] },
      eleccion: { por: 'app', fecha: ahora, lrclib_id: letra.lrclib_id },
      desfase_ms: 800,
      fines: { metodo: 'silencios', lineas: 5 },
      dudosas: 0,
      revisada: false
    }
  }
  return c
}

function montar(cancion: Cancion, revisar: boolean) {
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = {
    ...falso.api,
    picos: apiPicosFalsa([])
  } as unknown as typeof window.shinobi
  render(
    <NavegacionContexto.Provider
      value={{
        vista: {
          tipo: 'cancion',
          id: cancion.id,
          paso: 'editor',
          ...(revisar ? { revisar: true } : {})
        },
        ir: vi.fn()
      }}
    >
      <Editor id={cancion.id} />
    </NavegacionContexto.Provider>
  )
}

const PREPARO = /Shinobi Karaoke preparó esta canción/
const YA_SYNC = /Esta letra ya viene sincronizada/

/** Fotogramas cada 50 ms durante `ms`: devuelve los textos de banner vistos en cada uno. */
async function fotogramas(ms: number): Promise<{ prep: boolean; yaSync: boolean }[]> {
  const vistos: { prep: boolean; yaSync: boolean }[] = []
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    vistos.push({
      prep: screen.queryByText(PREPARO) !== null,
      yaSync: screen.queryByText(YA_SYNC) !== null
    })
  }
  return vistos
}

beforeEach(() => {
  olvidarPicosBase()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  act(() => cerrarTodosLosToasts())
})

it('F5-E6: con «Revisar» no sale en ningún momento banner de preparación ni yaSync (primer segundo, cada 50 ms)', async () => {
  montar(preparada(), true)
  const vistos = await fotogramas(1000)
  expect(vistos.some((v) => v.prep || v.yaSync)).toBe(false)
})

it('F5-E6: por «Editar» el banner de la preparación sale una vez, sin parpadeo, y sigue a los 2 s', async () => {
  montar(preparada(), false)
  const vistos = await fotogramas(2000)
  const primero = vistos.findIndex((v) => v.prep)
  expect(primero).toBeGreaterThanOrEqual(0)
  expect(vistos.slice(primero).every((v) => v.prep)).toBe(true)
  // El sitio estuvo vacío hasta decidirse, nunca con yaSync.
  expect(vistos.some((v) => v.yaSync)).toBe(false)
})

it('F5-E6: yaSync nunca sale con registro de preparación (ni revisada) y sí sin él', async () => {
  const c = preparada()
  c.preparacion!.revisada = true
  montar(c, false)
  expect((await fotogramas(1000)).some((v) => v.yaSync || v.prep)).toBe(false)
  cleanup()
  montar(preparada(false), false)
  const vistos = await fotogramas(1000)
  expect(vistos.at(-1)!.yaSync).toBe(true)
  expect(vistos.some((v) => v.prep)).toBe(false)
})
