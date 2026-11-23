import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Cancion } from '../../shared'
import { FIXTURES, idDePrueba } from '../../shared/__fixtures__'
import { lrcALetra } from '../../shared/letras'
import { ExportadorLrc, nombreLrc } from './exportarLrc'

let base: string
let datos: string
let salida: string
const mostradas: string[] = []

const cancion = (n: number, titulo: string, artista = 'Artista inventado'): Cancion => {
  const c = FIXTURES.lista()
  return { ...c, id: idDePrueba(n), metadatos: { ...c.metadatos, titulo, artista } }
}

function exportador(
  canciones: Cancion[],
  elige: { guardar?: string | null; carpeta?: string | null }
): ExportadorLrc<null> {
  let n = 0
  return new ExportadorLrc<null>({
    biblioteca: { obtener: (id) => canciones.find((c) => c.id === id) ?? null },
    directorioDatos: datos,
    ventana: () => null,
    dialogoGuardar: () => Promise.resolve(elige.guardar === undefined ? null : elige.guardar),
    dialogoCarpeta: () => Promise.resolve(elige.carpeta === undefined ? null : elige.carpeta),
    carpetaDocumentos: () => salida,
    mostrarEnCarpeta: (r) => void mostradas.push(r),
    uuid: () => idDePrueba(5000 + ++n)
  })
}

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'shinobi-lrc-'))
  datos = join(base, 'datos')
  salida = join(base, 'salida')
  await mkdir(datos)
  await mkdir(salida)
  mostradas.length = 0
})
afterEach(() => rm(base, { recursive: true, force: true }))

describe('nombre del archivo', () => {
  it('«título — artista.lrc», saneado, y solo el título si no hay artista', () => {
    expect(nombreLrc('Luna: de *papel*', 'Ana / Luis')).toBe('Luna- de -papel- — Ana - Luis.lrc')
    expect(nombreLrc('Solo título', '  ')).toBe('Solo título.lrc')
    expect(nombreLrc('', '')).toBe('Sin título.lrc')
  })
})

describe('exportar una canción', () => {
  it('escribe el .lrc en el destino elegido y recuerda la carpeta', async () => {
    const c = cancion(1, 'Luna de papel')
    const destino = join(salida, 'mi letra.lrc')
    const e = exportador([c], { guardar: destino })
    const r = await e.exportarUna(c.id)
    expect(r).toMatchObject({ lineasOmitidas: 0 })
    const texto = await readFile(destino, 'utf8')
    expect(texto.startsWith('[ti:Luna de papel]\n[ar:Artista inventado]\n')).toBe(true)
    expect(lrcALetra(texto).lineas.filter((l) => l.tipo === 'linea').length).toBeGreaterThan(0)
    expect((await readdir(salida)).filter((n) => n.includes('parcial'))).toEqual([])
    e.mostrarEnCarpeta(r!.ubicacionId)
    expect(mostradas).toEqual([destino])
    expect(() => e.mostrarEnCarpeta(idDePrueba(9))).toThrow()
  })

  it('cancelar el diálogo devuelve null y no escribe nada', async () => {
    const c = cancion(1, 'Luna de papel')
    expect(await exportador([c], { guardar: null }).exportarUna(c.id)).toBeNull()
    expect(await readdir(salida)).toEqual([])
  })

  it('cuenta las líneas sin inicio que se omiten', async () => {
    const c = cancion(1, 'Luna de papel')
    c.letra!.lineas = c.letra!.lineas.map((l, i) =>
      i === 0 ? { ...l, inicio_ms: null, fin_ms: null, palabras: null } : l
    )
    const r = await exportador([c], { guardar: join(salida, 'a.lrc') }).exportarUna(c.id)
    expect(r?.lineasOmitidas).toBe(1)
  })

  it('sin ninguna línea con inicio: error y sin diálogo; dentro de los datos: rechazado', async () => {
    const sin = { ...cancion(1, 'Sin tiempos'), letra: null }
    await expect(
      exportador([sin], { guardar: join(salida, 'x.lrc') }).exportarUna(sin.id)
    ).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    const c = cancion(2, 'Luna')
    await expect(
      exportador([c], { guardar: join(datos, 'biblioteca', 'x.lrc') }).exportarUna(c.id)
    ).rejects.toMatchObject({ codigo: 'DESTINO_NO_DISPONIBLE' })
    await expect(
      exportador([c], { guardar: join(salida, 'no-existe', 'x.lrc') }).exportarUna(c.id)
    ).rejects.toMatchObject({ codigo: 'DESTINO_NO_DISPONIBLE' })
  })
})

describe('exportar varias', () => {
  it('un .lrc por canción, con « (2)» si el nombre ya existe (nunca sustituye), y omite las que no se pueden', async () => {
    const a = cancion(1, 'Luna de papel')
    const b = cancion(2, 'Luna de papel') // mismo nombre
    const sin = { ...cancion(3, 'Sin tiempos'), letra: null }
    await writeFile(join(salida, 'Luna de papel — Artista inventado.lrc'), 'mío, no se toca')
    const e = exportador([a, b, sin], { carpeta: salida })
    const r = await e.exportarVarias([a.id, b.id, sin.id, idDePrueba(77)])
    expect(r).toMatchObject({
      escritas: 2,
      carpeta: basename(salida),
      omitidas: [
        { id: sin.id, motivo: 'SIN_TIEMPOS' },
        { id: idDePrueba(77), motivo: 'CANCION_NO_DISPONIBLE' }
      ]
    })
    expect((await readdir(salida)).sort()).toEqual([
      'Luna de papel — Artista inventado (2).lrc',
      'Luna de papel — Artista inventado (3).lrc',
      'Luna de papel — Artista inventado.lrc'
    ])
    expect(await readFile(join(salida, 'Luna de papel — Artista inventado.lrc'), 'utf8')).toBe(
      'mío, no se toca'
    )
    e.mostrarEnCarpeta(r!.ubicacionId)
    expect(mostradas).toHaveLength(1)
  })

  it('cancelar «Elegir carpeta» devuelve null', async () => {
    const a = cancion(1, 'Luna')
    expect(await exportador([a], { carpeta: null }).exportarVarias([a.id])).toBeNull()
  })
})
