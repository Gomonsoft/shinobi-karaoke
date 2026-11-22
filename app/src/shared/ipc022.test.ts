import { describe, expect, it } from 'vitest'
import { CANALES, ROLES_POR_CANAL } from './canales'
import { CODIGOS_ERROR } from './errores'
import { CONTRATO } from './ipc'

const NUEVOS = [
  ...Object.values(CANALES.actualizaciones),
  ...Object.values(CANALES.preparacion),
  ...Object.values(CANALES.copias),
  ...Object.values(CANALES.alineacion),
  CANALES.letras.candidatoPorId,
  CANALES.letras.exportarLrc,
  CANALES.letras.exportarLrcVarias,
  CANALES.letras.mostrarEnCarpeta,
  CANALES.fuente.lote,
  CANALES.fuente.leerArchivos,
  CANALES.fuente.leerCarpeta,
  CANALES.fuente.infoLista,
  CANALES.biblioteca.valoresDatos,
  CANALES.biblioteca.editarDatosVariasPrevisualizar,
  CANALES.biblioteca.editarDatosVariasEjecutar,
  CANALES.biblioteca.eliminarVariasPrevisualizar,
  CANALES.biblioteca.eliminarVariasEjecutar,
  CANALES.cola.agregarVarias,
  CANALES.cola.quitarVarias,
  CANALES.exportacion.destinoCarpeta,
  CANALES.exportacion.iniciarLote,
  CANALES.exportacion.cancelarLote,
  CANALES.exportacion.reintentarLote
] as const
const UUID = '123e4567-e89b-42d3-a456-426614174000'

describe('canales de 0.2.2', () => {
  it('todos están en el contrato y son solo de la principal', () => {
    for (const canal of NUEVOS) {
      expect(CONTRATO[canal], canal).toBeDefined()
      expect(ROLES_POR_CANAL[canal], canal).toEqual(['principal'])
    }
  })

  it('los nombres de canal no se repiten', () => {
    const grupos = Object.entries(CANALES).filter(([g]) => g !== 'eventos')
    const todos = grupos.flatMap(([, g]) => Object.values(g))
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('los códigos de error nuevos existen', () => {
    for (const c of [
      'LISTA_NO_DISPONIBLE',
      'ARCHIVO_NO_ENCONTRADO',
      'NADA_QUE_HACER',
      'YA_EN_COLA',
      'YA_EXISTE',
      'CONFIRMACION_OBSOLETA',
      'PAQUETE_NO_VALIDO',
      'PAQUETE_VERSION_NUEVA',
      'PAQUETE_INCOMPLETO',
      'CANCION_MAS_NUEVA',
      'EN_CURSO',
      'ALINEACION_NO_DISPONIBLE',
      'IDIOMA_NO_ADMITIDO'
    ]) {
      expect(CODIGOS_ERROR).toContain(c)
    }
  })
})

describe('argumentos de los canales de 0.2.2', () => {
  const args = (canal: keyof typeof CONTRATO, ...a: unknown[]) =>
    CONTRATO[canal].args.safeParse(a).success

  it('rechazan lo inválido', () => {
    expect(args(CANALES.preparacion.preparar, { ids: [] })).toBe(false)
    expect(args(CANALES.preparacion.preparar, { ids: ['a'], extra: 1 })).toBe(false)
    expect(args(CANALES.preparacion.preparar, { ids: ['a'] })).toBe(true)
    expect(args(CANALES.actualizaciones.marcarVista, { version: '' })).toBe(false)
    expect(args(CANALES.letras.candidatoPorId, { cancionId: 'a', lrclibId: 0 })).toBe(false)
    expect(args(CANALES.cola.quitarVarias, { entradaIds: [] })).toBe(false)
    expect(args(CANALES.biblioteca.eliminarVariasEjecutar, { ids: ['a'] })).toBe(false)
    expect(
      args(CANALES.copias.importar, { origenId: UUID, conflictos: 'borrar', ajustes: false })
    ).toBe(false)
    expect(
      args(CANALES.copias.importar, { origenId: UUID, conflictos: 'omitir', ajustes: false })
    ).toBe(true)
    expect(args(CANALES.exportacion.cancelarLote, { loteId: 'no-uuid' })).toBe(false)
  })

  it('el lote de Añadir no pasa de 50 y exige un metadato por entrada', () => {
    const entrada = { tipo: 'youtube', id: 'abc' }
    const meta = { titulo: 't', artista: 'a', album: null }
    expect(args(CANALES.fuente.lote, { entradas: [entrada], metadatos: [meta] })).toBe(true)
    expect(args(CANALES.fuente.lote, { entradas: [entrada], metadatos: [] })).toBe(false)
    const muchas = Array.from({ length: 51 }, () => entrada)
    expect(args(CANALES.fuente.lote, { entradas: muchas, metadatos: muchas.map(() => meta) })).toBe(
      false
    )
    // El renderer no envía rutas: una entrada de archivo lleva solo `ref`.
    expect(
      args(CANALES.fuente.lote, { entradas: [{ tipo: 'archivo', ruta: '/x' }], metadatos: [meta] })
    ).toBe(false)
  })

  it('exportar un lote exige un perfil del catálogo', () => {
    const base = {
      cancionIds: ['a'],
      formato: 'webm_vp9',
      audio: 'instrumental',
      ancho: 1920,
      alto: 1080,
      fps: 30,
      carpetaId: UUID,
      siExiste: 'numerar'
    }
    expect(args(CANALES.exportacion.iniciarLote, base)).toBe(true)
    expect(args(CANALES.exportacion.iniciarLote, { ...base, ancho: 1234 })).toBe(false)
    expect(args(CANALES.exportacion.iniciarLote, { ...base, siExiste: 'borrar' })).toBe(false)
  })
})
