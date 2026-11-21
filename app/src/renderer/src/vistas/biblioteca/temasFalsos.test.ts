import { expect, it, vi } from 'vitest'
import { impactoIpcSchema, resultadoOperacionIpcSchema } from '@shared/ipc'
import { apiEditorFalsa, cancionLista } from '../editor/fixturesApi'
import {
  ID_TEMA_PRUEBA,
  FICHA_PRUEBA,
  catalogoPrueba,
  impactoPrueba,
  temasFalsos
} from './temasFalsos'

const op = { tipo: 'borrar', temaId: ID_TEMA_PRUEBA } as const

it('los valores por defecto cumplen el contrato', async () => {
  const t = temasFalsos()
  expect(impactoIpcSchema.safeParse(await t.api.temas.previsualizar(op)).success).toBe(true)
  const r = await t.api.temas.ejecutar(
    { tipo: 'aplicar', cancionIds: ['a', 'b'], seleccion: { modo: 'heredar' } },
    FICHA_PRUEBA
  )
  expect(resultadoOperacionIpcSchema.safeParse(r).success).toBe(true)
  expect(r.canciones.map((c) => c.estado)).toEqual(['aplicada', 'aplicada'])
  expect(r.canciones[0]).toMatchObject({ titulo: '', artista: '' })
})

it('programa CONFIRMACION_OBSOLETA con el impacto nuevo en detalles', async () => {
  const t = temasFalsos()
  const nuevo = impactoPrueba({ revisionTema: 2 })
  t.obsoleta(nuevo)
  const fallo = await t.api.temas.ejecutar(op, FICHA_PRUEBA).catch((e: unknown) => e)
  expect(fallo).toMatchObject({ codigo: 'CONFIRMACION_OBSOLETA' })
  expect(JSON.parse((fallo as { detalles: string }).detalles)).toEqual(nuevo)
  // Un solo uso: la siguiente llamada ya responde.
  await expect(t.api.temas.ejecutar(op, FICHA_PRUEBA)).resolves.toBeDefined()
})

it.each(['TEMA_NOMBRE_DUPLICADO', 'TEMAS_SOLO_LECTURA', 'BORRADO_PENDIENTE'] as const)(
  'programa %s',
  async (codigo) => {
    const t = temasFalsos()
    t.fallar('temas.crear', codigo)
    await expect(
      t.api.temas.crear({ nombre: 'N', estilo: catalogoPrueba().temas[0]!.estilo })
    ).rejects.toMatchObject({
      codigo
    })
  }
)

it('programa resultados con pendiente y progreso con ficha null', async () => {
  const t = temasFalsos()
  t.programarResultado({
    catalogoEscrito: false,
    canciones: [
      { id: 'a', estado: 'aplicada' },
      { id: 'b', estado: 'error', codigo: 'ERROR_INTERNO' },
      { id: 'c', estado: 'pendiente' }
    ]
  })
  const reanudado = await t.api.temas.reanudarBorrado()
  expect(reanudado.canciones.map((c) => c.estado)).toEqual(['aplicada', 'error', 'pendiente'])
  expect(reanudado.canciones.every((c) => c.titulo === '' && c.artista === '')).toBe(true)
  const cb = vi.fn()
  t.api.temas.alProgreso(cb)
  t.emitirProgreso({
    ficha: null,
    operacion: 'borrar',
    temaId: ID_TEMA_PRUEBA,
    hechas: 1,
    total: 3
  })
  expect(cb).toHaveBeenCalledWith(expect.objectContaining({ ficha: null }))
})

it('emite el catálogo a quien escucha alCambiarTemas', () => {
  const t = temasFalsos()
  const cb = vi.fn()
  t.api.alCambiarTemas(cb)
  t.fijarCatalogo(catalogoPrueba({ soloLectura: true }))
  expect(cb).toHaveBeenCalledWith(expect.objectContaining({ soloLectura: true }))
})

it('el doble del editor programa alHeredar y guarda la apariencia', async () => {
  const { api, fijarApariencia } = apiEditorFalsa({ cancion: cancionLista() })
  const cb = vi.fn()
  api.alCambiarCancion(cb)
  fijarApariencia({
    modo: 'tema',
    procedencia: 'cancion',
    alHeredar: { procedencia: 'album', temaId: ID_TEMA_PRUEBA, temaNombre: 'X' }
  })
  expect(cb.mock.calls[0]![0].resumen.apariencia.alHeredar.procedencia).toBe('album')
  const id = cancionLista().id
  const r = await api.biblioteca.guardarApariencia!(id, { modo: 'heredar' })
  expect(r.apariencia).toMatchObject({ modo: 'heredar', procedencia: 'album' })
  expect((await api.biblioteca.obtener!(id))?.resuelta.alHeredar.procedencia).toBe('album')
})
