import { describe, expect, it } from 'vitest'
import type { ValoresDatosIpc } from '../../shared'
import { origenAlConfirmar, proponerDatos, type EntradaYoutube } from './propuestaDatos'

const SIN_BIBLIOTECA: ValoresDatosIpc = { artistas: [], albumes: [] }
const val = (valor: string, canciones = 1): ValoresDatosIpc['artistas'][number] => ({
  valor,
  clave: valor.toLowerCase(),
  canciones
})
const archivo = (
  nombre: string,
  etiquetas = {},
  valores = SIN_BIBLIOTECA,
  carpeta: string | null = null
) => proponerDatos({ tipo: 'archivo', nombre, etiquetas, carpeta }, valores)
const video = (e: Partial<EntradaYoutube>, valores = SIN_BIBLIOTECA) =>
  proponerDatos({ tipo: 'youtube', tituloLimpio: '', canalLimpio: '', ...e }, valores)

describe('archivo del equipo', () => {
  it('las etiquetas mandan sobre el nombre', () => {
    const { datos, guardado } = archivo('x.mp3', {
      title: 'Tema Alfa',
      artist: 'Grupo Uno',
      album: 'Disco Beta'
    })
    expect(datos.titulo).toEqual({ valor: 'Tema Alfa', origen: 'etiquetas', dudoso: false })
    expect(datos.artista.origen).toBe('etiquetas')
    expect(datos.album.origen).toBe('etiquetas')
    expect(guardado).toEqual({ titulo: 'fuente', artista: 'fuente', album: 'fuente' })
  })
  it('artista vacío cae al artista del álbum', () => {
    const { datos } = archivo('x.mp3', { title: 'T', album_artist: 'Grupo Uno' })
    expect(datos.artista).toMatchObject({ valor: 'Grupo Uno', origen: 'etiquetas' })
  })
  it('Artista - Título del nombre', () => {
    const { datos, guardado } = archivo('Grupo Uno - Tema Alfa.mp3')
    expect(datos.titulo).toMatchObject({ valor: 'Tema Alfa', origen: 'nombre', dudoso: false })
    expect(datos.artista).toMatchObject({ valor: 'Grupo Uno', origen: 'nombre' })
    expect(datos.album).toMatchObject({ valor: '', origen: null })
    expect(guardado.artista).toBe('nombre')
    expect(guardado.album).toBeUndefined()
  })
  it('con número de pista: título sin artista', () => {
    const { datos } = archivo('03 - Tema Alfa.flac')
    expect(datos.titulo).toMatchObject({ valor: 'Tema Alfa', origen: 'nombre', dudoso: false })
    expect(datos.artista).toMatchObject({ valor: '', origen: null })
  })
  it('un nombre sin patrón es el título y es dudoso', () => {
    const { datos } = archivo('audio_final2.wav')
    expect(datos.titulo).toEqual({ valor: 'audio final2', origen: 'nombre', dudoso: true })
  })
  it('Artista - Álbum - NN - Título', () => {
    const { datos } = archivo('Grupo Uno - Disco Beta - 03 - Tema Alfa.mp3')
    expect(datos.album).toMatchObject({ valor: 'Disco Beta', origen: 'nombre' })
    expect(datos.titulo.valor).toBe('Tema Alfa')
  })
  it('un título del nombre con restos es dudoso', () => {
    expect(archivo('Grupo Uno - Tema (en vivo).mp3').datos.titulo.dudoso).toBe(true)
  })
  it('en un lote desde carpeta, la carpeta pone artista y álbum', () => {
    const { datos } = archivo('01 Tema Alfa.mp3', {}, SIN_BIBLIOTECA, 'Grupo Uno - Disco Beta')
    expect(datos.artista).toMatchObject({ valor: 'Grupo Uno', origen: 'carpeta' })
    expect(datos.album).toMatchObject({ valor: 'Disco Beta', origen: 'carpeta' })
  })
  it('título y artista al revés si el de la derecha es un artista de la biblioteca', () => {
    const { datos } = archivo(
      'Tema Alfa - Grupo Uno.mp3',
      {},
      { artistas: [val('Grupo Uno')], albumes: [] }
    )
    expect(datos.titulo).toMatchObject({ valor: 'Tema Alfa', dudoso: true, invertido: true })
    expect(datos.artista).toMatchObject({ valor: 'Grupo Uno', dudoso: true, invertido: true })
  })
})

describe('YouTube', () => {
  it('los campos de música mandan y llevan origen «pista»', () => {
    const { datos, guardado } = video({
      musica: { track: 'Tema Alfa', artist: 'Grupo Uno', album: 'Disco Beta' },
      tituloLimpio: 'otro',
      canalLimpio: 'Canal'
    })
    expect(datos.titulo.origen).toBe('pista')
    expect(datos.artista).toEqual({ valor: 'Grupo Uno', origen: 'pista', dudoso: false })
    expect(datos.album.origen).toBe('pista')
    expect(guardado.titulo).toBe('fuente')
  })
  it('«Grupo – Tema» del canal «Grupo Official»: título y artista del título del vídeo', () => {
    const { datos, guardado } = video({
      tituloLimpio: 'Grupo Uno – Tema Alfa',
      canalLimpio: 'Grupo Uno'
    })
    expect(datos.titulo).toMatchObject({ valor: 'Tema Alfa', origen: 'video', dudoso: false })
    expect(datos.artista).toMatchObject({ valor: 'Grupo Uno', origen: 'video', dudoso: false })
    expect(guardado.artista).toBe('nombre')
  })
  it('sin artista en el título, el canal es el artista y es dudoso', () => {
    const { datos } = video({ tituloLimpio: 'Tema Alfa', canalLimpio: 'Grupo Uno' })
    expect(datos.artista).toEqual({ valor: 'Grupo Uno', origen: 'canal', dudoso: true })
  })
  it('título con restos tras limpiar es dudoso', () => {
    const { datos } = video({ tituloLimpio: 'Tema Alfa (en directo)', canalLimpio: 'Grupo' })
    expect(datos.titulo.dudoso).toBe(true)
  })
  it('intercambia si la derecha es el canal y la izquierda no', () => {
    const { datos } = video({ tituloLimpio: 'Tema Alfa - Grupo Uno', canalLimpio: 'Grupo Uno' })
    expect(datos.titulo).toMatchObject({ valor: 'Tema Alfa', invertido: true, dudoso: true })
    expect(datos.artista).toMatchObject({ valor: 'Grupo Uno', invertido: true })
  })
  it('el álbum de una lista que es un álbum', () => {
    const { datos } = video({ tituloLimpio: 'T', canalLimpio: 'C', lista: 'Disco Beta' })
    expect(datos.album).toMatchObject({ valor: 'Disco Beta', origen: 'lista' })
  })
})

describe('como en tu biblioteca', () => {
  const valores: ValoresDatosIpc = {
    artistas: [val('Grupo Uno', 7)],
    albumes: [val('Querido…', 3)]
  }
  it('usa la grafía existente y guarda la propuesta como alternativa', () => {
    const { datos, guardado } = archivo(
      'x.mp3',
      { title: 'T', artist: 'Grupo Uno', album: 'Querido...' },
      valores
    )
    expect(datos.album).toEqual({
      valor: 'Querido…',
      origen: 'biblioteca',
      dudoso: false,
      alternativa: 'Querido...'
    })
    expect(guardado.album).toBe('fuente')
  })
  it('una propuesta que solo difiere en mayúsculas usa la grafía de la biblioteca (D3, pregunta 0232)', () => {
    const { datos } = archivo('x.mp3', { title: 'T', artist: 'grupo uno' }, valores)
    expect(datos.artista).toMatchObject({
      valor: 'Grupo Uno',
      origen: 'biblioteca',
      alternativa: 'grupo uno'
    })
  })
  it('una propuesta idéntica a la de la biblioteca conserva su procedencia', () => {
    const { datos } = archivo('x.mp3', { title: 'T', artist: 'Grupo Uno' }, valores)
    expect(datos.artista).toMatchObject({ valor: 'Grupo Uno', origen: 'etiquetas' })
  })
  it('«03 Artista - Título»: el número se descarta y el artista sale dudoso (0231)', () => {
    const { datos } = archivo('03 Artista Nuevo - Tema Alfa.mp3')
    expect(datos.artista).toMatchObject({ valor: 'Artista Nuevo', origen: 'nombre', dudoso: true })
    expect(datos.titulo.dudoso).toBe(false)
  })
  it('«3 Doors Down - Tema» conserva el número y el artista no es dudoso', () => {
    const { datos } = archivo('3 Doors Down - Tema Alfa.mp3')
    expect(datos.artista).toMatchObject({ valor: '3 Doors Down', dudoso: false })
  })
})

describe('origenAlConfirmar', () => {
  const r = archivo('Grupo Uno - Tema Alfa.mp3')
  it('lo que queda igual conserva la procedencia; lo cambiado es del usuario', () => {
    expect(origenAlConfirmar(r, { titulo: 'Tema Alfa', artista: 'Otro', album: null })).toEqual({
      titulo: 'nombre',
      artista: 'usuario',
      album: undefined
    })
  })
  it('escribir un álbum vacío en la propuesta lo marca como usuario', () => {
    expect(
      origenAlConfirmar(r, { titulo: 'Tema Alfa', artista: 'Grupo Uno', album: 'Mío' })?.album
    ).toBe('usuario')
  })
  it('sin ningún origen no devuelve objeto', () => {
    expect(
      origenAlConfirmar(archivo('x.mp3', {}), { titulo: '', artista: '', album: '' })
    ).toBeUndefined()
  })
})
