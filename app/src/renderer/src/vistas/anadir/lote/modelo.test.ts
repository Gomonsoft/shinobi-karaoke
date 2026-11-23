import type { LecturaLoteIpc } from '@shared/ipc'
import { clasificarEnlaces } from './enlaces'
import {
  armarLote,
  comunesDe,
  filasDeLectura,
  fusionarRepetidas,
  lineasDeFila,
  resumirTabla
} from './modelo'

const REF = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const lectura = (
  n: number,
  extra: Partial<LecturaLoteIpc['filas'][number]>[] = []
): LecturaLoteIpc => ({
  filas: Array.from({ length: n }, (_, i) => ({
    ref: REF(i),
    nombre: `pista-${i}.mp3`,
    duracionMs: 240_000,
    metadatos: { titulo: `Canción ${i}`, artista: 'Grupo Inventado', album: null },
    duplicado: null,
    problema: null,
    ...(extra[i] ?? {})
  })),
  rechazadas: 0,
  truncada: false,
  libreBytes: null,
  factorMinutos: null
})

describe('filasDeLectura', () => {
  it('marca las 50 primeras añadibles; el resto sale desmarcado y fuera del límite', () => {
    const filas = filasDeLectura(lectura(80))
    expect(filas.filter((f) => f.marcada)).toHaveLength(50)
    expect(filas[49]!.marcada).toBe(true)
    expect(filas[50]!.marcada).toBe(false)
    expect(lineasDeFila(filas[50]!, { artista: null })[0]?.texto).toBe(
      'Fuera del límite de este lote'
    )
  })

  it('los duplicados salen desmarcados y no gastan el límite; las filas con ✕ no se marcan', () => {
    const filas = filasDeLectura(
      lectura(4, [
        { duplicado: 'YA_EN_BIBLIOTECA' },
        { problema: 'ilegible' },
        { problema: 'corta' }
      ])
    )
    expect(filas.map((f) => f.marcada)).toEqual([false, false, false, true])
    expect(lineasDeFila(filas[0]!, { artista: null })[0]?.texto).toBe('Ya está en tu biblioteca')
    expect(lineasDeFila(filas[1]!, { artista: null })).toEqual([
      { tipo: 'error', texto: 'No podemos leer este archivo' }
    ])
    expect(lineasDeFila(filas[2]!, { artista: null })[0]?.texto).toBe('Dura menos de 10 segundos')
  })
})

describe('resumirTabla y armarLote', () => {
  it('usa las funciones de main: espacio, tiempo, «caben» y el orden de la tabla', () => {
    const filas = filasDeLectura(lectura(3))
    const r = resumirTabla(filas, null, 2)
    expect(r.marcadas).toBe(3)
    expect(r.tiempo).toEqual({ minutos: 24, conocida: true })
    expect(r.sinEspacio).toBe(false)
    expect(resumirTabla(filas, null, null).tiempo).toBeNull()
    const justo = resumirTabla(filas, 1024 ** 3 + 120 * 1024 * 1024, 2)
    expect(justo.sinEspacio).toBe(true)
    expect(justo.caben).toBe(1)
    const lote = armarLote(filas.map((f, i) => (i === 1 ? { ...f, marcada: false } : f)))
    expect(lote.entradas).toEqual([
      { tipo: 'archivo', ref: REF(0) },
      { tipo: 'archivo', ref: REF(2) }
    ])
    expect(lote.metadatos[0]).toEqual({
      titulo: 'Canción 0',
      artista: 'Grupo Inventado',
      album: null
    })
  })

  it('una duración desconocida da «al menos» (conocida: false)', () => {
    const filas = filasDeLectura(lectura(2, [{ duracionMs: null }]))
    expect(resumirTabla(filas, null, 1).tiempo?.conocida).toBe(false)
  })
})

describe('comunes y repetidas', () => {
  it('el álbum de una lista que se puso a todas es un dato común', () => {
    const filas = filasDeLectura(lectura(3)).map((f) => ({
      ...f,
      album: 'Álbum Inventado',
      datos: {
        titulo: { valor: f.titulo, origen: null, dudoso: false },
        artista: { valor: f.artista, origen: 'etiquetas' as const, dudoso: false },
        album: { valor: 'Álbum Inventado', origen: 'lista' as const, dudoso: false }
      }
    }))
    expect(comunesDe(filas)).toEqual({ album: 'Álbum Inventado', artista: null })
    expect(
      comunesDe(filas.map((f, i) => (i === 0 ? { ...f, tocados: ['album' as const] } : f))).album
    ).toBeNull()
  })

  it('funde las filas con la misma clave', () => {
    const f = filasDeLectura(lectura(2))
    const r = fusionarRepetidas([f[0]!, f[1]!, f[0]!])
    expect(r.filas).toHaveLength(2)
    expect(r.repetidas).toBe(1)
  })
})

describe('clasificarEnlaces', () => {
  const V1 = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  const V2 = 'https://youtu.be/aaaaaaaaaaa'
  const LISTA = 'https://www.youtube.com/playlist?list=OLAK5uy_inventadoLista01'

  it('separa videos, listas, repetidos y renglones ignorados', () => {
    const c = clasificarEnlaces(
      `${V1}\n${V2}\n${V1}\nhola\n${LISTA}\nhttps://www.youtube.com/@canal`
    )
    expect(c.enlaces.map((e) => e.tipo)).toEqual(['video', 'video', 'lista'])
    expect(c.repetidos).toBe(1)
    expect(c.ignorados).toBe(2)
    expect(c.noSoportadas).toBe(1)
  })

  it('un video con lista conserva el id de la lista; una mezcla automática no cuenta como lista', () => {
    const a = clasificarEnlaces(`${V1}&list=PLinventadaLista01`).enlaces[0]
    expect(a).toMatchObject({ tipo: 'video', listaId: 'PLinventadaLista01' })
    const b = clasificarEnlaces(`${V1}&list=RDdQw4w9WgXcQ`).enlaces[0]
    expect(b).toMatchObject({ tipo: 'video', listaId: null })
  })
})
