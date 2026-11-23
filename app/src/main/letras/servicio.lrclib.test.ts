import { rm } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ElementoLetra } from '../../shared'
import { ServicioBiblioteca } from '../biblioteca'
import { cancionConFuente, nuevoDirDatos } from '../separacion/servicio.testutil'
import { ServicioLetras } from './servicio'

let datos: string
let biblioteca: ServicioBiblioteca
let id: string

const registro = {
  titulo: 'Título de LRCLIB',
  artista: 'Artista de LRCLIB',
  album: 'Álbum de LRCLIB'
}
const lineas = (): ElementoLetra[] => [
  {
    id: 'a',
    tipo: 'linea',
    texto: 'Verso inventado',
    inicio_ms: 1000,
    fin_ms: null,
    palabras: null
  }
]
const servicio = (): ServicioLetras =>
  new ServicioLetras({
    biblioteca,
    dialogo: { showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }) },
    datosLrclib: (_c, lrclibId) => (lrclibId === 5 ? registro : null)
  })
const guardar = (s: ServicioLetras, origen: 'lrclib' | 'manual', lrclib_id: number | null) =>
  s.guardar({ cancionId: id, origen, lrclib_id, lineas: lineas() })

beforeEach(async () => {
  datos = await nuevoDirDatos()
  biblioteca = new ServicioBiblioteca(datos)
  id = await cancionConFuente(biblioteca, datos)
  await biblioteca.actualizar(id, { metadatos: { album: null } })
})
afterEach(async () => {
  await biblioteca.flushTodo()
  await rm(datos, { recursive: true, force: true })
})

describe('guardar una letra de LRCLIB elegida por el usuario (ADR 0025, pregunta 0220)', () => {
  it('guarda datos_lrclib y rellena el álbum vacío con origen lrclib, sin tocar título ni artista', async () => {
    const antes = biblioteca.obtener(id)!.metadatos
    await guardar(servicio(), 'lrclib', 5)
    const c = biblioteca.obtener(id)!
    expect(c.letra!.datos_lrclib).toStrictEqual(registro)
    expect(c.metadatos).toMatchObject({
      album: 'Álbum de LRCLIB',
      origen: { album: 'lrclib' },
      titulo: antes.titulo,
      artista: antes.artista
    })
  })

  it('no rellena con una letra manual, con un álbum previo ni tras «Quitar»', async () => {
    await guardar(servicio(), 'manual', null)
    expect(biblioteca.obtener(id)!.metadatos.album).toBeNull()
    expect(biblioteca.obtener(id)!.letra!.datos_lrclib).toBeUndefined()

    await biblioteca.actualizar(id, { metadatos: { album: 'Mi disco' } })
    await guardar(servicio(), 'lrclib', 5)
    expect(biblioteca.obtener(id)!.metadatos.album).toBe('Mi disco')

    // «Quitar»: álbum vacío con origen usuario.
    await biblioteca.actualizar(id, { metadatos: { album: null, origen: { album: 'usuario' } } })
    await guardar(servicio(), 'lrclib', 5)
    expect(biblioteca.obtener(id)!.metadatos.album).toBeNull()
  })

  it('un id que no está en la búsqueda reciente no rellena nada', async () => {
    await guardar(servicio(), 'lrclib', 6)
    expect(biblioteca.obtener(id)!.letra!.datos_lrclib).toBeUndefined()
    expect(biblioteca.obtener(id)!.metadatos.album).toBeNull()
  })
})

describe('aplicarFinesPreparacion', () => {
  it('solo pone fines en líneas que siguen con fin automático y los marca de la preparación', async () => {
    const s = servicio()
    await s.guardar({
      cancionId: id,
      origen: 'manual',
      lrclib_id: null,
      lineas: [
        ...lineas(),
        {
          id: 'b',
          tipo: 'linea',
          texto: 'Otro verso inventado',
          inicio_ms: 5000,
          fin_ms: 6000,
          palabras: null
        }
      ]
    })
    const [a, b] = biblioteca.obtener(id)!.letra!.lineas
    const n = await s.aplicarFinesPreparacion(
      id,
      new Map([
        [a!.id, 3000],
        [b!.id, 7000]
      ])
    )
    expect(n).toBe(1)
    const { lineas: l } = biblioteca.obtener(id)!.letra!
    expect(l[0]).toMatchObject({ fin_ms: 3000, origen_fin: 'preparacion' })
    expect(l[1]).toMatchObject({ fin_ms: 6000, origen_fin: 'letra' })
  })
})
