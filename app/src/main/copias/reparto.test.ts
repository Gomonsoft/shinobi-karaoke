import { afterEach, describe, expect, it } from 'vitest'
import { estiloPredeterminado, normalizarEstilo, type Catalogo, type Estilo } from '../../shared'
import { cancionDosCantantes } from '../../shared/__fixtures__/reparto'
import {
  ID_A,
  TEMA_NEON,
  exportarA,
  importarEsperando,
  leerCancionDeDisco,
  montarEquipo,
  sembrarCancion,
  type Equipo
} from './montajeDePrueba'

/** El reparto viaja en paquetes y copias (0.2.3, tarea 0341). Datos inventados. */

const equipos: Equipo[] = []
const nuevo = async (o: Parameters<typeof montarEquipo>[0] = {}): Promise<Equipo> => {
  const e = await montarEquipo(o)
  equipos.push(e)
  return e
}
afterEach(async () => {
  await Promise.all(equipos.splice(0).map((e) => e.limpiar()))
})

async function importar(e: Equipo, ruta: string) {
  e.elegirAbrir.ruta = ruta
  const origen = await e.copias.elegirOrigen()
  return importarEsperando(e, { origenId: origen!.origenId, conflictos: 'omitir', ajustes: false })
}

const base = normalizarEstilo(estiloPredeterminado())
const estiloConPartes: Estilo = {
  ...base,
  letra: {
    ...base.letra,
    colores_partes: { c2: '#112233', coro: '#445566' }
  },
  pantalla: { ...base.pantalla, zonas: 'una' }
}

const catalogo = (estilo: Estilo): Catalogo => ({
  esquema: 1,
  claves: 1,
  predeterminado: TEMA_NEON,
  temas: [
    {
      id: TEMA_NEON,
      nombre: 'Neón',
      creado: '2026-11-01T10:00:00.000Z',
      modificado: '2026-11-01T10:00:00.000Z',
      revision: 1,
      estilo
    }
  ],
  asignaciones: { artistas: [], albumes: [] },
  borrado_pendiente: null,
  apartado: null
})

describe('paquete con reparto', () => {
  it('una canción con cantantes, partes y coros se importa entera', async () => {
    const origen = await nuevo()
    const letra = cancionDosCantantes().letra!
    await sembrarCancion(origen.biblio, ID_A, { mutar: (c) => void (c.letra = letra) })
    await origen.biblioteca.escanear()
    const { ruta } = await exportarA(origen, { tipo: 'canciones', ids: [ID_A], conAudio: false })
    const destino = await nuevo({ baseIdTemas: 1900 })
    await importar(destino, ruta)
    expect((await leerCancionDeDisco(destino.biblio, ID_A)).letra).toEqual(letra)
  })

  it('un tema con colores_partes y zonas los conserva; el mismo estilo con valores por defecto explícitos se reutiliza', async () => {
    const origen = await nuevo()
    await origen.temas.enCola(() => origen.temas.confirmarCatalogo(catalogo(estiloConPartes)))
    await sembrarCancion(origen.biblio, ID_A, {
      apariencia: { modo: 'tema', tema_id: TEMA_NEON, tema_nombre: 'Neón' }
    })
    await origen.biblioteca.escanear()
    const { ruta } = await exportarA(origen, { tipo: 'canciones', ids: [ID_A], conAudio: false })

    const vacio = await nuevo({ baseIdTemas: 1900 })
    const r = await importar(vacio, ruta)
    expect(r.temas?.importados).toEqual(['Neón'])
    const importado = vacio.temas.datos()!.temas.find((t) => t.nombre === 'Neón')!
    expect(importado.estilo.letra.colores_partes).toEqual({ c2: '#112233', coro: '#445566' })
    expect(importado.estilo.pantalla?.zonas).toBe('una')

    // Un tema local igual salvo que escribe los colores por defecto de otras ranuras: mismo estilo efectivo.
    const local = await nuevo({ baseIdTemas: 2900 })
    const explicito: Estilo = {
      ...importado.estilo,
      letra: {
        ...importado.estilo.letra,
        colores_partes: { c2: '#112233', coro: '#445566', c3: '#FF5C8A' }
      }
    }
    await local.temas.enCola(() => local.temas.confirmarCatalogo(catalogo(explicito)))
    const igual = await importar(local, ruta)
    expect(igual.temas).toEqual({ importados: [], reutilizados: 1 })
  })
})
