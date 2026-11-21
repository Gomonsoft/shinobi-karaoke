import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ESTILO_PREDETERMINADO, estiloPredeterminado } from '@shared/estilo'
import { aparienciaResumenPrueba, resumenPrueba } from '../biblioteca/resumenPrueba'
import { catalogoPrueba, temaCatalogoPrueba } from '../biblioteca/temasFalsos'
import { estiloVisible, seleccionDeDisco, vistaTema, type EntradaVista } from './aparienciaVista'

const SOL = '11111111-1111-4111-8111-111111111111'
const NEON = '22222222-2222-4222-8222-222222222222'
const estiloNeon = {
  ...estiloPredeterminado(),
  fondo: { tipo: 'solido' as const, color: '#112233' }
}

function entrada(cambios: Partial<EntradaVista> = {}, apariencia = {}): EntradaVista {
  return {
    seleccion: { modo: 'propio' },
    estiloPropio: estiloPredeterminado(),
    resumen: resumenPrueba({
      estilo: estiloPredeterminado(),
      apariencia: aparienciaResumenPrueba(apariencia)
    }),
    catalogo: catalogoPrueba({
      temas: [
        temaCatalogoPrueba({ id: SOL, nombre: 'Sol' }),
        temaCatalogoPrueba({ id: NEON, nombre: 'Neón', estilo: estiloNeon })
      ]
    }),
    borrador: null,
    ...cambios
  }
}

describe('vistaTema', () => {
  it('estilo propio es D2; tema asignado y coincidente toma la procedencia del resumen', () => {
    expect(vistaTema(entrada()).estado).toBe('d2')
    const v = vistaTema(
      entrada(
        { seleccion: { modo: 'tema', temaId: NEON } },
        { modo: 'tema', procedencia: 'cancion', temaId: NEON, temaNombre: 'Neón' }
      )
    )
    expect(v).toMatchObject({ estado: 'd1', procedencia: 'cancion', temaNombre: 'Neón' })
    expect(v.tema?.id).toBe(NEON)
  })

  it('una selección aún no guardada se traduce sin resolver niveles', () => {
    const asignado = vistaTema(entrada({ seleccion: { modo: 'tema', temaId: NEON } }))
    expect(asignado).toMatchObject({ procedencia: 'cancion', temaNombre: 'Neón' })
    const hereda = vistaTema(
      entrada(
        { seleccion: { modo: 'heredar' } },
        { alHeredar: { procedencia: 'artista', temaId: SOL, temaNombre: 'Sol' } }
      )
    )
    expect(hereda).toMatchObject({ procedencia: 'artista', temaId: SOL })
    const inexistente = vistaTema(
      entrada({ seleccion: { modo: 'tema', temaId: '33333333-3333-4333-8333-333333333333' } })
    )
    expect(inexistente.estado).toBe('d4')
  })

  it('el borrador manda sobre todo y se bloquea el tema en borrado o el catálogo de solo lectura', () => {
    const base = estiloPredeterminado()
    const borrador = { temaId: SOL, nombre: 'Sol', revision: 1, base, estilo: estiloNeon }
    const conBorrador = entrada({ seleccion: { modo: 'tema', temaId: SOL }, borrador })
    expect(vistaTema(conBorrador).estado).toBe('d3')
    expect(estiloVisible(conBorrador)).toBe(estiloNeon)
    const enBorrado = entrada({
      seleccion: { modo: 'tema', temaId: SOL },
      catalogo: catalogoPrueba({ temas: [temaCatalogoPrueba({ id: SOL, enBorrado: true })] })
    })
    expect(vistaTema(enBorrado).bloqueo).toBe('borrado')
    expect(
      vistaTema({ ...enBorrado, catalogo: catalogoPrueba({ soloLectura: true }) }).bloqueo
    ).toBe('solo_lectura')
  })
})

describe('estiloVisible', () => {
  it('elegir un tema pinta su estilo del catálogo sin esperar a main', () => {
    expect(estiloVisible(entrada({ seleccion: { modo: 'tema', temaId: NEON } }))).toBe(estiloNeon)
  })
  it('heredar con destino incluido pinta el estilo incluido', () => {
    expect(estiloVisible(entrada({ seleccion: { modo: 'heredar' } }))).toBe(ESTILO_PREDETERMINADO)
  })
})

describe('seleccionDeDisco', () => {
  it('sin apariencia (0.1.0) es estilo propio', () => {
    expect(seleccionDeDisco(undefined)).toEqual({ modo: 'propio' })
    expect(seleccionDeDisco({ modo: 'tema', tema_id: SOL })).toEqual({ modo: 'tema', temaId: SOL })
    expect(seleccionDeDisco({ modo: 'heredar' })).toEqual({ modo: 'heredar' })
  })
})

describe('el editor no resuelve apariencias', () => {
  it('ningún archivo de vistas/editor importa resolverApariencia', () => {
    const dir = __dirname
    const fuentes = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    expect(fuentes.length).toBeGreaterThan(10)
    for (const f of fuentes) {
      expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/import[^;]*resolverApariencia/)
    }
  })
})
