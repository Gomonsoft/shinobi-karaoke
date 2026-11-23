import { describe, expect, it } from 'vitest'
import { analizarUrlLista, resultadoInfoListaSchema, resultadoLeerEtiquetasSchema } from './lista'

const LISTA = 'PLinventada0000001'
const ALBUM = 'OLAK5uy_inventado01'

/** Los mismos casos que `worker/tests/test_info_lista_youtube.py::test_analizar_url_lista`. */
const CASOS: [
  string,
  { ok: true; idLista: string; tipo: string } | { ok: false; codigo: string }
][] = [
  [`https://www.youtube.com/playlist?list=${LISTA}`, { ok: true, idLista: LISTA, tipo: 'lista' }],
  [`music.youtube.com/playlist?list=${ALBUM}`, { ok: true, idLista: ALBUM, tipo: 'album' }],
  [`https://youtu.be/aaaaaaaaaaa?list=${LISTA}`, { ok: true, idLista: LISTA, tipo: 'lista' }],
  [
    `https://www.youtube.com/watch?v=aaaaaaaaaaa&list=${LISTA}`,
    { ok: true, idLista: LISTA, tipo: 'lista' }
  ],
  [
    'https://www.youtube.com/playlist?list=RDCLAK5uy_inventadoxx',
    { ok: false, codigo: 'URL_NO_SOPORTADA' }
  ],
  [
    'https://www.youtube.com/watch?v=aaaaaaaaaaa&list=RDaaaaaaaaaaa',
    { ok: false, codigo: 'URL_NO_SOPORTADA' }
  ],
  ['https://www.youtube.com/@canalinventado', { ok: false, codigo: 'URL_NO_SOPORTADA' }],
  [
    'https://www.youtube.com/channel/UCinventado0000000000000',
    { ok: false, codigo: 'URL_NO_SOPORTADA' }
  ],
  ['https://www.youtube.com/playlist', { ok: false, codigo: 'URL_NO_VALIDA' }],
  ['https://www.youtube.com/playlist?list=corto', { ok: false, codigo: 'URL_NO_VALIDA' }],
  ['https://www.youtube.com/watch?v=aaaaaaaaaaa', { ok: false, codigo: 'URL_NO_VALIDA' }],
  [`https://example.com/playlist?list=${LISTA}`, { ok: false, codigo: 'URL_NO_VALIDA' }],
  ['no es un enlace', { ok: false, codigo: 'URL_NO_VALIDA' }]
]

describe('analizarUrlLista (ADR 0026 §1)', () => {
  it.each(CASOS)('%s', (url, esperado) => {
    expect(analizarUrlLista(url)).toMatchObject(esperado)
  })

  it('devuelve siempre la URL canónica de la lista', () => {
    expect(analizarUrlLista(`music.youtube.com/playlist?list=${ALBUM}&si=x`)).toMatchObject({
      urlCanonica: `https://www.youtube.com/playlist?list=${ALBUM}`
    })
  })
})

describe('esquemas del worker', () => {
  it('acepta la forma de info-lista-youtube y la de leer-etiquetas', () => {
    expect(
      resultadoInfoListaSchema.safeParse({
        titulo: 'T',
        tipo: 'album',
        recortada: false,
        entradas: [
          { id: 'aaaaaaaaaaa', titulo: 'x', canal: '', duracion_s: null, disponible: false }
        ]
      }).success
    ).toBe(true)
    expect(
      resultadoLeerEtiquetasSchema.safeParse({
        archivos: [
          { ruta: '/a.mp3', ok: true, duracion_ms: 1000, etiquetas: { title: 'x' } },
          { ruta: '/b.mp3', ok: false, codigo: 'FORMATO_NO_SOPORTADO' }
        ]
      }).success
    ).toBe(true)
  })
})
