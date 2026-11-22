import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ElementoLetra } from '../../shared'
import { generarPicos } from '../../shared/__fixtures__/picos'
import { ServicioBiblioteca } from '../biblioteca'
import { cancionConFuente, nuevoDirDatos } from '../separacion/servicio.testutil'
import { comprobarLetraGuardada, type DepsComprobacion } from './comprobacion'
import { ServicioLetras } from './servicio'

let datos: string
let biblioteca: ServicioBiblioteca
let servicio: ServicioLetras
let id: string
const DUR = 60_000

/** Cantos de 2 s cada 5 s desde el segundo 3 (voz sintética). */
const CANTOS: [number, number][] = [3, 8, 13, 18, 23, 28].map((t) => [t * 1000, t * 1000 + 2000])
const picos = (): DepsComprobacion['picos'] => {
  const { pares } = generarPicos({
    duracionMs: DUR,
    tramos: CANTOS.map(([desdeMs, hastaMs]) => ({ desdeMs, hastaMs, dbfs: -6 }))
  })
  return { nivelBase: () => Promise.resolve({ pasoMs: 10, pares, duracionMs: DUR }) }
}
const lineas = (desfase: number): ElementoLetra[] =>
  CANTOS.map(([a, b], i) => ({
    id: `x${i}`,
    tipo: 'linea',
    texto: `Verso inventado ${i + 1}`,
    inicio_ms: a - desfase,
    fin_ms: b - desfase,
    palabras: null
  }))

beforeEach(async () => {
  datos = await nuevoDirDatos()
  biblioteca = new ServicioBiblioteca(datos)
  servicio = new ServicioLetras({
    biblioteca,
    dialogo: { showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }) },
    debounceEdicionMs: 5
  })
  id = await cancionConFuente(biblioteca, datos)
})
afterEach(async () => {
  await biblioteca.flushTodo()
  await rm(datos, { recursive: true, force: true })
})

const guardar = (desfase: number) =>
  servicio.guardar({ cancionId: id, origen: 'lrclib', lrclib_id: 1, lineas: lineas(desfase) })
const deps = (extra: Partial<DepsComprobacion> = {}): DepsComprobacion => ({
  biblioteca,
  letras: servicio,
  picos: picos(),
  ...extra
})

describe('comprobarLetraGuardada (F4-L7)', () => {
  it('corrige sola una letra intacta desfasada y avisa con [Deshacer]', async () => {
    await guardar(800)
    const avisar = vi.fn()
    const r = await comprobarLetraGuardada(deps({ avisar }), id)
    expect(r).toMatchObject({ veredicto: 'desfasada' })
    expect(Math.abs(r!.corregido! - 800)).toBeLessThanOrEqual(20)
    const letra = biblioteca.obtener(id)!.letra!
    expect(letra.offset_ms).toBe(r!.corregido)
    expect(letra.desfase_corregido_ms).toBe(r!.corregido)
    expect(letra.intacta).toBe(true)
    expect(letra.lineas.map((l) => l.inicio_ms)).toEqual(lineas(800).map((l) => l.inicio_ms))
    expect(avisar).toHaveBeenCalledOnce()
    expect(avisar.mock.calls[0]![0]).toMatchObject({
      cancionId: id,
      tipo: 'desfase',
      etiqueta: 'Deshacer'
    })
    expect(avisar.mock.calls[0]![0].texto).toMatch(
      /0,8 s más tarde para que coincida con la voz\.$/
    )
    // Una segunda comprobación ya no toca nada (hay corrección previa).
    const otra = await comprobarLetraGuardada(deps({ avisar }), id)
    expect(otra?.corregido).toBeNull()
    expect(avisar).toHaveBeenCalledOnce()
  })

  it('no corrige si se cambió algún tiempo (intacta retirada): solo informa', async () => {
    await guardar(800)
    const { cancion, sesionId } = servicio.abrirEdicion(id)!
    const l = cancion.letra!
    const tiempos = l.lineas.map((e, i) => ({
      id: e.id,
      inicio_ms: i === 0 ? e.inicio_ms! + 10 : e.inicio_ms,
      fin_ms: e.fin_ms,
      palabras: null
    }))
    await servicio.guardarTiempos({ cancionId: id, offset_ms: 0, tiempos }, sesionId)
    servicio.liberarEdicion()
    const avisar = vi.fn()
    const r = await comprobarLetraGuardada(deps({ avisar }), id)
    expect(r?.corregido).toBeNull()
    expect(biblioteca.obtener(id)!.letra!.offset_ms).toBe(0)
    expect(avisar).not.toHaveBeenCalled()
  })

  it('nunca corrige una canción Lista ni la que el editor tiene abierta', async () => {
    await guardar(800)
    servicio.abrirEdicion(id)
    expect((await comprobarLetraGuardada(deps(), id))?.corregido).toBeNull()
    servicio.liberarEdicion()
    // Se fuerza `lista` sin las comprobaciones de marcarLista (no es lo que se prueba aquí).
    await biblioteca.flushTodo()
    const ruta = join(datos, 'biblioteca', id, 'cancion.json')
    const json = JSON.parse(await readFile(ruta, 'utf8'))
    json.estado = 'lista'
    await writeFile(ruta, JSON.stringify(json))
    await biblioteca.escanear()
    expect(biblioteca.obtener(id)?.estado).toBe('lista')
    expect((await comprobarLetraGuardada(deps(), id))?.corregido).toBeNull()
    expect(biblioteca.obtener(id)!.letra!.offset_ms).toBe(0)
  })

  it('dentro de una tanda de varias canciones corrige sin aviso', async () => {
    await guardar(800)
    const avisar = vi.fn()
    const r = await comprobarLetraGuardada(deps({ avisar, enTandaDeVarias: () => true }), id)
    expect(r?.corregido).not.toBeNull()
    expect(avisar).not.toHaveBeenCalled()
  })

  it('una letra que coincide no se toca; sin picos devuelve null', async () => {
    await guardar(0)
    const r = await comprobarLetraGuardada(deps(), id)
    expect(r).toMatchObject({ veredicto: 'coincide', corregido: null })
    const sin = await comprobarLetraGuardada(
      deps({ picos: { nivelBase: () => Promise.resolve(null) } }),
      id
    )
    expect(sin).toBeNull()
  })
})
