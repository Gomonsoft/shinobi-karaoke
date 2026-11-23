import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  esAudioOVideo,
  MAX_ARCHIVOS_CARPETA,
  MAX_ENTRADAS_LISTADAS,
  recorrerCarpeta
} from './carpeta'

let raiz: string
beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'shinobi-carpeta-'))
})
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true })
})

const crear = async (...rutas: string[]): Promise<void> => {
  for (const r of rutas) {
    await mkdir(join(raiz, r, '..'), { recursive: true })
    await writeFile(join(raiz, r), '')
  }
}
const nombres = (r: Awaited<ReturnType<typeof recorrerCarpeta>>): string[] =>
  r.archivos.map((a) => a.ruta.slice(raiz.length + 1))

describe('recorrerCarpeta (ADR 0026 §1)', () => {
  it('toma audio y vídeo, cuenta lo demás y ordena de forma natural con cada subcarpeta en su sitio', async () => {
    await crear('2 b.mp3', '10 a.FLAC', 'notas.txt', 'portada.jpg', 'paquete.shinobi', 'CD1/01.wav')
    const r = await recorrerCarpeta(raiz)
    expect(nombres(r)).toEqual(['2 b.mp3', '10 a.FLAC', join('CD1', '01.wav')])
    expect(r.ignorados).toBe(3)
    expect(r.truncado).toBe(false)
    expect(r.archivos[2]?.carpeta).toBe('CD1')
    expect(r.archivos[0]?.carpeta).toBe(basename(raiz))
  })

  it('baja hasta 3 niveles de subcarpetas y no más', async () => {
    await crear('n0.mp3', 'a/n1.mp3', 'a/b/n2.mp3', 'a/b/c/n3.mp3', 'a/b/c/d/n4.mp3')
    expect(nombres(await recorrerCarpeta(raiz))).toEqual([
      join('a', 'b', 'c', 'n3.mp3'),
      join('a', 'b', 'n2.mp3'),
      join('a', 'n1.mp3'),
      'n0.mp3'
    ])
  })

  it('ignora los ocultos y los enlaces simbólicos', async () => {
    await crear('visible.mp3', '.oculto.mp3', '.carpeta/dentro.mp3', 'real/x.mp3')
    await symlink(join(raiz, 'real'), join(raiz, 'enlace-carpeta'))
    await symlink(join(raiz, 'visible.mp3'), join(raiz, 'enlace.mp3'))
    expect(nombres(await recorrerCarpeta(raiz))).toEqual([join('real', 'x.mp3'), 'visible.mp3'])
  })

  it('devuelve como mucho 500 archivos de audio y avisa de que se cortó', async () => {
    await mkdir(join(raiz, 'a'))
    await Promise.all(
      Array.from({ length: MAX_ARCHIVOS_CARPETA + 20 }, (_, i) =>
        writeFile(join(raiz, 'a', `p${String(i).padStart(4, '0')}.mp3`), '')
      )
    )
    const r = await recorrerCarpeta(raiz)
    expect(r.truncado).toBe(true)
    expect(r.archivos).toHaveLength(MAX_ARCHIVOS_CARPETA)
  })

  it('exactamente 500 no es truncar, y 5 000 entradas listadas sí', async () => {
    await mkdir(join(raiz, 'a'))
    await Promise.all(
      Array.from({ length: MAX_ARCHIVOS_CARPETA }, (_, i) =>
        writeFile(join(raiz, 'a', `p${i}.mp3`), '')
      )
    )
    expect((await recorrerCarpeta(raiz)).truncado).toBe(false)
    await mkdir(join(raiz, 'b'))
    await Promise.all(
      Array.from({ length: MAX_ENTRADAS_LISTADAS }, (_, i) =>
        writeFile(join(raiz, 'b', `n${i}.txt`), '')
      )
    )
    const r = await recorrerCarpeta(raiz)
    expect(r.truncado).toBe(true)
    expect(r.archivos).toHaveLength(MAX_ARCHIVOS_CARPETA)
  })

  it('una carpeta sin audio da un resultado vacío y una ilegible no falla', async () => {
    await crear('solo.txt')
    expect((await recorrerCarpeta(raiz)).archivos).toEqual([])
    expect((await recorrerCarpeta(join(raiz, 'no-existe'))).archivos).toEqual([])
  })

  it('esAudioOVideo reconoce las extensiones de ADR 0003 sin distinguir mayúsculas', () => {
    expect(esAudioOVideo('/x/A.MP3')).toBe(true)
    expect(esAudioOVideo('/x/a.mkv')).toBe(true)
    expect(esAudioOVideo('/x/a.shinobi')).toBe(false)
    expect(esAudioOVideo('/x/mp3')).toBe(false)
  })
})
