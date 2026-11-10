import { describe, expect, it } from 'vitest'
import {
  CANALES,
  CONTRATO,
  catalogoIpcSchema,
  cancionIpcSchema,
  destinoHeredarSchema,
  impactoIpcSchema,
  operacionTemaSchema,
  progresoTemaSchema,
  resultadoOperacionIpcSchema,
  resumenCancionSchema,
  seleccionAparienciaSchema,
  temaIpcSchema,
  PROCEDENCIAS
} from './ipc'
import { estiloPredeterminado } from './estilo'
import { lista } from './__fixtures__'

const id = '0b9f7a4e-3c1d-4f6a-9d2e-5a8b1c7e4f30'
const ficha = '5d2c8f10-7b3a-4e1d-8c6f-2a9e0b4d7c11'
const estilo = estiloPredeterminado()
const ok = (esquema: { safeParse(v: unknown): { success: boolean } }, v: unknown): boolean =>
  esquema.safeParse(v).success
const args = (canal: keyof typeof CONTRATO, a: unknown[]): boolean =>
  CONTRATO[canal].args.safeParse(a).success

const origen = { procedencia: 'predeterminado', temaId: id, temaNombre: 'Noche ninja' }
const desglose = {
  cancion: 0,
  album: 0,
  artista: 0,
  predeterminado: 1,
  aleatorio: 0,
  predeterminadoAnterior: 0,
  propio: 0,
  respaldo: 0,
  incluido: 0
}
const impacto = {
  ficha,
  afectadas: [
    {
      id: 'c1',
      titulo: 'T',
      artista: 'A',
      antes: origen,
      despues: { procedencia: 'cancion', temaId: id, temaNombre: 'Noche ninja' },
      efecto: 'cambia'
    }
  ],
  desglose,
  excluidas: { propio: 0, cancion: 0, album: 0 },
  totalGrupo: null,
  esPredeterminado: false,
  asignacionesRetiradas: { artistas: [], albumes: [] },
  revisionTema: 1,
  sesionEnCurso: false
}

describe('canales de la fase 3', () => {
  it('guardarEstilo se retira y los nuevos canales están en el contrato', () => {
    expect(CANALES.biblioteca).not.toHaveProperty('guardarEstilo')
    expect(Object.keys(CONTRATO)).not.toContain('biblioteca:guardarEstilo')
    for (const canal of Object.values(CANALES.temas)) expect(CONTRATO).toHaveProperty([canal])
    expect(CONTRATO).toHaveProperty([CANALES.biblioteca.guardarApariencia])
    expect(CANALES.eventos.temasCambiado).toBe('temas:cambiado')
    expect(CANALES.eventos.temasProgreso).toBe('temas:progreso')
  })
})

describe('seleccionAparienciaSchema', () => {
  it('acepta propio, tema y heredar', () => {
    expect(ok(seleccionAparienciaSchema, { modo: 'propio', estilo })).toBe(true)
    expect(ok(seleccionAparienciaSchema, { modo: 'tema', temaId: id })).toBe(true)
    expect(ok(seleccionAparienciaSchema, { modo: 'heredar' })).toBe(true)
  })
  it('rechaza estilo incompleto, temaId no UUID y claves extra', () => {
    expect(ok(seleccionAparienciaSchema, { modo: 'propio', estilo: { version: 1 } })).toBe(false)
    expect(ok(seleccionAparienciaSchema, { modo: 'propio' })).toBe(false)
    expect(ok(seleccionAparienciaSchema, { modo: 'tema', temaId: 'x' })).toBe(false)
    expect(ok(seleccionAparienciaSchema, { modo: 'tema' })).toBe(false)
    expect(ok(seleccionAparienciaSchema, { modo: 'heredar', temaId: id })).toBe(false)
    expect(ok(seleccionAparienciaSchema, { modo: 'otro' })).toBe(false)
  })
  it('guardarApariencia valida id y selección', () => {
    const c = CANALES.biblioteca.guardarApariencia
    expect(args(c, ['c1', { modo: 'heredar' }])).toBe(true)
    expect(args(c, ['', { modo: 'heredar' }])).toBe(false)
    expect(args(c, ['c1'])).toBe(false)
  })
})

describe('operacionTemaSchema', () => {
  const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `c${i}`)
  const aplicar = (cancionIds: string[], seleccion: unknown = { modo: 'heredar' }) => ({
    tipo: 'aplicar',
    cancionIds,
    seleccion
  })

  it('editar exige revisión >= 1 y estilo completo', () => {
    const base = { tipo: 'editar', temaId: id, revisionTema: 1, estilo }
    expect(ok(operacionTemaSchema, base)).toBe(true)
    expect(ok(operacionTemaSchema, { ...base, revisionTema: 0 })).toBe(false)
    expect(ok(operacionTemaSchema, { ...base, estilo: { version: 1 } })).toBe(false)
    expect(ok(operacionTemaSchema, { ...base, temaId: 'x' })).toBe(false)
  })
  it('borrar y predeterminado', () => {
    expect(ok(operacionTemaSchema, { tipo: 'borrar', temaId: id })).toBe(true)
    expect(ok(operacionTemaSchema, { tipo: 'borrar', temaId: 'x' })).toBe(false)
    expect(ok(operacionTemaSchema, { tipo: 'predeterminado', temaId: null })).toBe(true)
    expect(ok(operacionTemaSchema, { tipo: 'predeterminado', temaId: id })).toBe(true)
    expect(ok(operacionTemaSchema, { tipo: 'predeterminado' })).toBe(false)
  })
  it('aplicar: de 1 a 2000 ids únicos', () => {
    expect(ok(operacionTemaSchema, aplicar(ids(0)))).toBe(false)
    expect(ok(operacionTemaSchema, aplicar(ids(1)))).toBe(true)
    expect(ok(operacionTemaSchema, aplicar(ids(2000)))).toBe(true)
    expect(ok(operacionTemaSchema, aplicar(ids(2001)))).toBe(false)
    expect(ok(operacionTemaSchema, aplicar(['a', 'a']))).toBe(false)
    expect(ok(operacionTemaSchema, aplicar(['a'], { modo: 'tema', temaId: id }))).toBe(true)
    expect(ok(operacionTemaSchema, aplicar(['a'], { modo: 'propio', estilo }))).toBe(false)
  })
  it('asignarGrupo: álbum obligatorio solo con nivel "album"', () => {
    const g = { tipo: 'asignarGrupo', temaId: id }
    expect(ok(operacionTemaSchema, { ...g, nivel: 'artista', artista: 'Queen' })).toBe(true)
    expect(
      ok(operacionTemaSchema, { ...g, nivel: 'artista', artista: 'Queen', temaId: null })
    ).toBe(true)
    expect(ok(operacionTemaSchema, { ...g, nivel: 'album', artista: 'Queen' })).toBe(false)
    expect(ok(operacionTemaSchema, { ...g, nivel: 'album', artista: 'Queen', album: 'Jazz' })).toBe(
      true
    )
    expect(
      ok(operacionTemaSchema, { ...g, nivel: 'artista', artista: 'Queen', album: 'Jazz' })
    ).toBe(false)
  })
  it('asignarGrupo: artista de 1 a 200 caracteres y con clave no vacía', () => {
    const g = { tipo: 'asignarGrupo', temaId: id, nivel: 'artista' }
    expect(ok(operacionTemaSchema, { ...g, artista: 'a'.repeat(200) })).toBe(true)
    expect(ok(operacionTemaSchema, { ...g, artista: 'a'.repeat(201) })).toBe(false)
    expect(ok(operacionTemaSchema, { ...g, artista: '' })).toBe(false)
    expect(ok(operacionTemaSchema, { ...g, artista: '   ' })).toBe(false)
    expect(ok(operacionTemaSchema, { ...g, nivel: 'album', artista: 'Queen', album: '   ' })).toBe(
      false
    )
  })
  it('un tipo desconocido se rechaza', () => {
    expect(ok(operacionTemaSchema, { tipo: 'otro' })).toBe(false)
  })
  it('previsualizar y ejecutar: la ficha es un UUID', () => {
    const op = { tipo: 'borrar', temaId: id }
    expect(args(CANALES.temas.previsualizar, [op])).toBe(true)
    expect(args(CANALES.temas.ejecutar, [op, ficha])).toBe(true)
    expect(args(CANALES.temas.ejecutar, [op, 'f'])).toBe(false)
    expect(args(CANALES.temas.ejecutar, [op])).toBe(false)
  })
})

describe('crear, renombrar y duplicar', () => {
  it('el nombre se normaliza y mide 1-60 caracteres', () => {
    const crear = (nombre: string): boolean => args(CANALES.temas.crear, [{ nombre, estilo }])
    expect(crear('a'.repeat(60))).toBe(true)
    expect(crear('a'.repeat(61))).toBe(false)
    expect(crear('')).toBe(false)
    expect(crear('   ')).toBe(false)
    expect(crear('  Noche   ninja ')).toBe(true)
    expect(
      CONTRATO[CANALES.temas.crear].args.parse([{ nombre: '  Noche   ninja ', estilo }])
    ).toEqual([{ nombre: 'Noche ninja', estilo }])
  })
  it('renombrar y duplicar exigen temaId UUID', () => {
    expect(args(CANALES.temas.renombrar, [{ temaId: id, revisionTema: 1, nombre: 'N' }])).toBe(true)
    expect(args(CANALES.temas.renombrar, [{ temaId: 'x', revisionTema: 1, nombre: 'N' }])).toBe(
      false
    )
    expect(args(CANALES.temas.renombrar, [{ temaId: id, nombre: 'N' }])).toBe(false)
    expect(args(CANALES.temas.duplicar, [{ temaId: id, nombre: 'N' }])).toBe(true)
    expect(args(CANALES.temas.duplicar, [{ temaId: 'x', nombre: 'N' }])).toBe(false)
    expect(args(CANALES.temas.duplicar, [{ temaId: id, nombre: 'a'.repeat(61) }])).toBe(false)
  })
  it('los canales sin argumentos rechazan los que sobran', () => {
    for (const c of [
      CANALES.temas.catalogo,
      CANALES.temas.reanudarBorrado,
      CANALES.temas.cancelarBorrado,
      CANALES.temas.descartarAvisoApartado
    ]) {
      expect(args(c, [])).toBe(true)
      expect(args(c, [1])).toBe(false)
    }
  })
})

describe('respaldo con nombre', () => {
  it('alHeredar y despues admiten respaldo con temaNombre relleno', () => {
    const respaldo = { procedencia: 'respaldo', temaId: id, temaNombre: 'Noche ninja' }
    expect(ok(destinoHeredarSchema, respaldo)).toBe(true)
    const [a] = impacto.afectadas
    expect(ok(impactoIpcSchema, { ...impacto, afectadas: [{ ...a, despues: respaldo }] })).toBe(
      true
    )
  })
})

describe('destinoHeredarSchema', () => {
  it('rechaza propio y cancion y acepta las demás', () => {
    const d = (procedencia: string) => ({ procedencia, temaId: null, temaNombre: null })
    expect(ok(destinoHeredarSchema, d('propio'))).toBe(false)
    expect(ok(destinoHeredarSchema, d('cancion'))).toBe(false)
    for (const p of PROCEDENCIAS.filter((x) => x !== 'propio' && x !== 'cancion')) {
      expect(ok(destinoHeredarSchema, d(p))).toBe(true)
    }
    expect(ok(destinoHeredarSchema, { ...d('album'), temaId: 'x' })).toBe(false)
  })
})

describe('impactoIpcSchema', () => {
  it('acepta un impacto completo y valida sus partes', () => {
    expect(ok(impactoIpcSchema, impacto)).toBe(true)
    expect(ok(impactoIpcSchema, { ...impacto, ficha: 'x' })).toBe(false)
    expect(ok(impactoIpcSchema, { ...impacto, revisionTema: null, totalGrupo: 3 })).toBe(true)
    const [a] = impacto.afectadas
    expect(ok(impactoIpcSchema, { ...impacto, afectadas: [{ ...a, efecto: 'otro' }] })).toBe(false)
    expect(ok(impactoIpcSchema, { ...impacto, afectadas: [{ ...a, efecto: 'fija_base' }] })).toBe(
      true
    )
    expect(ok(impactoIpcSchema, { ...impacto, desglose: { ...desglose, cancion: -1 } })).toBe(false)
    expect(ok(impactoIpcSchema, { ...impacto, excluidas: { propio: 0, cancion: 0 } })).toBe(false)
    expect(
      ok(impactoIpcSchema, {
        ...impacto,
        excluidas: { propio: 0, cancion: 0, album: 0, danadas: 1, noExisten: 2 }
      })
    ).toBe(true)
  })
})

describe('resultadoOperacionIpcSchema', () => {
  it('admite los cinco estados, incluido pendiente', () => {
    const r = (estado: string, extra: object = {}) => ({
      catalogoEscrito: false,
      canciones: [{ id: 'c1', titulo: 'T', artista: 'A', estado, ...extra }]
    })
    for (const e of ['aplicada', 'sin_cambios', 'omitida', 'error', 'pendiente']) {
      expect(
        ok(resultadoOperacionIpcSchema, r(e, e === 'error' ? { codigo: 'ERROR_INTERNO' } : {}))
      ).toBe(true)
    }
    expect(ok(resultadoOperacionIpcSchema, r('hecha'))).toBe(false)
    expect(ok(resultadoOperacionIpcSchema, r('omitida', { motivo: 'cambio' }))).toBe(true)
    expect(ok(resultadoOperacionIpcSchema, r('omitida', { motivo: 'otro' }))).toBe(false)
    expect(ok(resultadoOperacionIpcSchema, r('error', { codigo: 'ERROR_INTERNO' }))).toBe(true)
    expect(ok(resultadoOperacionIpcSchema, r('error', { codigo: 'INVENTADO' }))).toBe(false)
    // `error` lleva siempre su código; titulo y artista son obligatorios (vacíos si no hay dato).
    expect(ok(resultadoOperacionIpcSchema, r('error'))).toBe(false)
    expect(
      ok(resultadoOperacionIpcSchema, {
        catalogoEscrito: false,
        canciones: [{ id: 'c1', estado: 'aplicada' }]
      })
    ).toBe(false)
    expect(
      ok(resultadoOperacionIpcSchema, {
        catalogoEscrito: true,
        canciones: [{ id: 'c1', titulo: '', artista: '', estado: 'pendiente' }]
      })
    ).toBe(true)
  })
})

describe('progresoTemaSchema', () => {
  const p = { ficha, operacion: 'aplicar', temaId: id, hechas: 1, total: 3 }
  it('acepta ficha null (reanudarBorrado) y temaId null', () => {
    expect(ok(progresoTemaSchema, p)).toBe(true)
    expect(ok(progresoTemaSchema, { ...p, ficha: null, operacion: 'borrar' })).toBe(true)
    expect(ok(progresoTemaSchema, { ...p, temaId: null })).toBe(true)
  })
  it('rechaza una operación desconocida, una ficha no UUID y recuentos negativos', () => {
    expect(ok(progresoTemaSchema, { ...p, operacion: 'editar' })).toBe(false)
    expect(ok(progresoTemaSchema, { ...p, ficha: 'x' })).toBe(false)
    expect(ok(progresoTemaSchema, { ...p, hechas: -1 })).toBe(false)
  })
})

describe('catalogoIpcSchema y temaIpcSchema', () => {
  const catalogo = {
    temas: [
      {
        id,
        nombre: 'Noche ninja',
        revision: 2,
        estilo,
        enBorrado: false,
        usos: {
          total: 3,
          cancion: 1,
          album: 1,
          artista: 0,
          predeterminado: 1,
          aleatorio: 0,
          predeterminadoAnterior: 0
        },
        grupos: { artistas: ['Queen'], albumes: [{ artista: 'Queen', album: 'Jazz' }] }
      }
    ],
    predeterminado: id,
    predeterminadoUsos: 1,
    asignaciones: {
      artistas: [{ artista: 'Queen', temaId: id }],
      albumes: [{ artista: 'Queen', album: 'Jazz', temaId: id }]
    },
    borradoPendiente: { temaId: id, nombre: 'Noche ninja', total: 5, restantes: 2 },
    soloLectura: false,
    apartado: '2026-11-09T10:00:00.000Z',
    referenciasFaltantes: 0
  }
  it('acepta un catálogo completo y rechaza los incompletos', () => {
    expect(ok(catalogoIpcSchema, catalogo)).toBe(true)
    expect(ok(catalogoIpcSchema, { ...catalogo, borradoPendiente: null, apartado: null })).toBe(
      true
    )
    const sin: Partial<typeof catalogo> = { ...catalogo }
    delete sin.referenciasFaltantes
    expect(ok(catalogoIpcSchema, sin)).toBe(false)
    expect(ok(catalogoIpcSchema, { ...catalogo, predeterminado: 'x' })).toBe(false)
  })
  it('temaIpcSchema', () => {
    expect(ok(temaIpcSchema, { id, nombre: 'N', revision: 1, estilo })).toBe(true)
    expect(ok(temaIpcSchema, { id, nombre: 'N', revision: 0, estilo })).toBe(false)
  })
})

describe('resumen y canción con apariencia', () => {
  const resumen = {
    id: 'c1',
    titulo: 'T',
    artista: 'A',
    duracionMs: null,
    estado: 'borrador',
    modificada: '2026-11-09T10:00:00.000Z',
    estilo,
    album: 'Jazz',
    claves: { artista: 'a', album: '["a","jazz"]' },
    apariencia: {
      modo: 'heredar',
      procedencia: 'predeterminado',
      temaId: id,
      temaNombre: 'Noche ninja',
      neutra: true,
      alHeredar: { procedencia: 'album', temaId: id, temaNombre: 'Noche ninja' }
    },
    miniatura: null,
    pasos: null,
    incompleta: false,
    lineasSinSincronizar: 0,
    danada: false,
    motivo: null
  }
  it('el resumen exige album, claves y apariencia con alHeredar válido', () => {
    expect(ok(resumenCancionSchema, resumen)).toBe(true)
    const sinAlbum: Partial<typeof resumen> = { ...resumen }
    delete sinAlbum.album
    expect(ok(resumenCancionSchema, sinAlbum)).toBe(false)
    expect(
      ok(resumenCancionSchema, {
        ...resumen,
        apariencia: {
          ...resumen.apariencia,
          alHeredar: { procedencia: 'cancion', temaId: null, temaNombre: null }
        }
      })
    ).toBe(false)
  })
  it('obtener devuelve la canción con `resuelta`', () => {
    const resuelta = {
      estilo,
      procedencia: 'propio',
      temaId: null,
      temaNombre: null,
      alHeredar: { procedencia: 'incluido', temaId: null, temaNombre: null }
    }
    expect(ok(cancionIpcSchema, { ...lista(), resuelta })).toBe(true)
    expect(ok(cancionIpcSchema, lista())).toBe(false)
    expect(CONTRATO[CANALES.biblioteca.obtener].res.safeParse(null).success).toBe(true)
  })
})
