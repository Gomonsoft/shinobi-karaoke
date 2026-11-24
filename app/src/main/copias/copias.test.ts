import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { estiloPredeterminado, type Cancion, type Catalogo, type Estilo } from '../../shared'
import { idDePrueba } from '../../shared/__fixtures__'
import {
  ID_A,
  ID_B,
  ID_C,
  TEMA_NEON,
  TEMA_SOL,
  esperarFin,
  importarEsperando,
  exportarA,
  leerCancionDeDisco,
  montarEquipo,
  sembrarCancion,
  type Equipo
} from './montajeDePrueba'
import { PaqueteLector } from './zip'

const equipos: Equipo[] = []
const nuevo = async (o: Parameters<typeof montarEquipo>[0] = {}): Promise<Equipo> => {
  const e = await montarEquipo(o)
  equipos.push(e)
  return e
}
afterEach(async () => {
  await Promise.all(equipos.splice(0).map((e) => e.limpiar()))
})

const estiloNeon: Estilo = {
  ...estiloPredeterminado(),
  fondo: { tipo: 'solido', color: '#112233' }
}
const estiloSol: Estilo = {
  ...estiloPredeterminado(),
  fondo: { tipo: 'solido', color: '#aa7700' }
}

async function entradas(ruta: string): Promise<string[]> {
  const lector = await PaqueteLector.abrir(ruta)
  try {
    return [...lector.entradas.keys()].sort()
  } finally {
    lector.cerrar()
  }
}

/** Carpeta de una canción sin las cachés regenerables ni los `.bak`: lo que de verdad viaja. */
async function archivosDe(biblio: string, id: string): Promise<string[]> {
  const todo: string[] = []
  const recorrer = async (rel: string): Promise<void> => {
    for (const d of await readdir(join(biblio, id, rel), { withFileTypes: true })) {
      const r = rel === '' ? d.name : `${rel}/${d.name}`
      if (d.isDirectory()) await recorrer(r)
      else if (!d.name.endsWith('.bak') && d.name !== 'picos.bin') todo.push(r)
    }
  }
  await recorrer('')
  return todo.sort()
}

async function sembrarBiblioteca(e: Equipo): Promise<void> {
  await sembrarCancion(e.biblio, ID_A, { titulo: 'Luna de papel', miniatura: true })
  await sembrarCancion(e.biblio, ID_B, {
    titulo: 'Río imaginario',
    conPistas: false,
    album: 'Disco de prueba'
  })
  await e.biblioteca.escanear()
}

async function importar(
  e: Equipo,
  ruta: string,
  conflictos: 'sustituir' | 'conservar_ambas' | 'omitir' = 'omitir',
  ajustes = false
) {
  e.elegirAbrir.ruta = ruta
  const origen = await e.copias.elegirOrigen()
  expect(origen).not.toBeNull()
  return importarEsperando(e, { origenId: origen!.origenId, conflictos, ajustes })
}

describe('exportar un paquete de canción', () => {
  it('con audio: solo las entradas del formato, sin .bak ni picos, y el manifiesto con SHA-256 y bytes', async () => {
    const e = await nuevo()
    await sembrarBiblioteca(e)
    const { ruta, fin } = await exportarA(e, { tipo: 'canciones', ids: [ID_A], conAudio: true })
    expect(fin.estado).toBe('terminada')
    expect(fin.resultado).toMatchObject({ canciones: 1, omitidas: [] })
    expect(await entradas(ruta)).toEqual(
      [
        'manifiesto.json',
        `canciones/${ID_A}/cancion.json`,
        `canciones/${ID_A}/fuente/mezcla.flac`,
        `canciones/${ID_A}/fuente/miniatura.jpg`,
        `canciones/${ID_A}/pistas/voz.flac`,
        `canciones/${ID_A}/pistas/instrumental.flac`
      ].sort()
    )
    const lector = await PaqueteLector.abrir(ruta)
    const m = JSON.parse((await lector.leerBuffer('manifiesto.json', 1e6)).toString()) as {
      tipo: string
      con_audio: boolean
      app: string
      canciones: { archivos: { ruta: string; bytes: number; sha256: string }[] }[]
    }
    lector.cerrar()
    expect(m).toMatchObject({ tipo: 'cancion', con_audio: true, app: '0.2.2-prueba' })
    const voz = m.canciones[0]!.archivos.find((a) => a.ruta.endsWith('voz.flac'))!
    expect(voz.bytes).toBe((await stat(join(e.biblio, ID_A, 'pistas', 'voz.flac'))).size)
    expect(voz.sha256).toMatch(/^[0-9a-f]{64}$/)
    // El temporal desapareció y el resultado trae la ubicación para «Mostrar en la carpeta».
    expect((await readdir(e.salida)).filter((n) => n.endsWith('.shinobi-parcial'))).toEqual([])
    expect((fin.resultado as { ubicacionId: string }).ubicacionId).toContain(ruta)
  })

  it('ligero: sin audio y de unos pocos KB', async () => {
    const e = await nuevo()
    await sembrarBiblioteca(e)
    const { ruta } = await exportarA(e, { tipo: 'canciones', ids: [ID_A], conAudio: false })
    expect(await entradas(ruta)).toEqual(
      [
        'manifiesto.json',
        `canciones/${ID_A}/cancion.json`,
        `canciones/${ID_A}/fuente/miniatura.jpg`
      ].sort()
    )
    expect((await stat(ruta)).size).toBeLessThan(20_000)
  })

  it('una canción que se está separando entra sin pistas y pendiente; se cuenta como en curso', async () => {
    const e = await nuevo()
    await sembrarCancion(e.biblio, ID_A, { titulo: 'Quieta' })
    await sembrarCancion(e.biblio, ID_B, {
      titulo: 'Ocupada',
      mutar: (c) => {
        c.estado = 'borrador'
        c.pasos.separacion = { estado: 'en_curso', actualizado: null, error: null, progreso: 0.3 }
      }
    })
    await e.biblioteca.escanear({})
    const { ruta, fin } = await exportarA(e, {
      tipo: 'canciones',
      ids: [ID_A, ID_B],
      conAudio: true
    })
    expect(fin.resultado).toMatchObject({ canciones: 2, omitidas: [], enCurso: 1 })
    const dentro = await entradas(ruta)
    expect(dentro).toContain(`canciones/${ID_B}/fuente/mezcla.flac`)
    expect(dentro.some((n) => n.startsWith(`canciones/${ID_B}/pistas/`))).toBe(false)
    expect(dentro).toContain(`canciones/${ID_A}/pistas/voz.flac`)
    const lector = await PaqueteLector.abrir(ruta)
    const c = JSON.parse(
      (await lector.leerBuffer(`canciones/${ID_B}/cancion.json`, 1e6)).toString()
    ) as Cancion
    lector.cerrar()
    expect(c).toMatchObject({
      estado: 'borrador',
      pistas: null,
      pasos: { separacion: { estado: 'pendiente' } }
    })
    // La del índice no cambia.
    expect(e.biblioteca.obtener(ID_B)!.pasos.separacion.estado).toBe('en_curso')

    // Al importarla en otra biblioteca con audio local, se comporta como un paquete ligero.
    const destino = await nuevo({ baseIdTemas: 1900 })
    await sembrarCancion(destino.biblio, ID_B, {
      titulo: 'Mi versión',
      modificada: '2026-11-21T10:00:00.000Z'
    })
    await destino.biblioteca.escanear()
    const r = await importar(destino, ruta, 'sustituir')
    expect(r.resultados.find((x) => x.id === ID_B)).toMatchObject({
      resultado: 'sustituida',
      ligera: true
    })
    expect(destino.biblioteca.obtener(ID_B)!.pistas).not.toBeNull()
    expect(await readdir(destino.papelera)).toHaveLength(0)
    // En una biblioteca vacía entra como borrador con la separación pendiente.
    const vacia = await nuevo({ baseIdTemas: 2900 })
    await importar(vacia, ruta)
    expect(await leerCancionDeDisco(vacia.biblio, ID_B)).toMatchObject({
      estado: 'borrador',
      pistas: null,
      pasos: { separacion: { estado: 'pendiente' } }
    })
  })

  it('con la fuente en curso no entra ningún archivo de audio, solo cancion.json', async () => {
    const e = await nuevo()
    await sembrarCancion(e.biblio, ID_A, {
      miniatura: true,
      mutar: (c) => {
        c.pasos.fuente = { estado: 'en_curso', actualizado: null, error: null }
      }
    })
    await e.biblioteca.escanear({})
    const { ruta, fin } = await exportarA(e, { tipo: 'canciones', ids: [ID_A], conAudio: true })
    expect(fin.resultado).toMatchObject({ canciones: 1, enCurso: 1 })
    expect(await entradas(ruta)).toEqual(expect.arrayContaining([`canciones/${ID_A}/cancion.json`]))
    expect((await entradas(ruta)).filter((n) => /flac|jpg/.test(n))).toHaveLength(2) // las pistas completadas
  })

  it('una canción ilegible se omite y si no queda ninguna: NADA_QUE_HACER y ningún archivo', async () => {
    const e = await nuevo()
    await sembrarCancion(e.biblio, ID_A)
    await writeFile(join(e.biblio, ID_A, 'cancion.json'), '{ roto')
    await e.biblioteca.escanear({})
    const { fin } = await exportarA(e, { tipo: 'canciones', ids: [ID_A], conAudio: true })
    expect(fin).toMatchObject({ estado: 'error', codigo: 'NADA_QUE_HACER' })
    expect((await readdir(e.salida)).filter((n) => n.includes('shinobi'))).toEqual([])
  })

  it('sin espacio: SIN_ESPACIO antes de escribir nada', async () => {
    const e = await nuevo()
    await sembrarBiblioteca(e)
    e.libre.bytes = 100
    const { fin } = await exportarA(e, { tipo: 'canciones', ids: [ID_A], conAudio: true })
    expect(fin).toMatchObject({ estado: 'error', codigo: 'SIN_ESPACIO' })
    expect(await readdir(e.salida)).toEqual([])
  })

  it('cancelar a mitad borra el temporal y deja intacto el archivo que había', async () => {
    const e = await nuevo()
    await sembrarBiblioteca(e)
    const destino = await e.copias.destinoPropuesto({ tipo: 'canciones', ids: [ID_A] })
    const previo = join(destino.carpeta, destino.nombre)
    await writeFile(previo, 'contenido anterior')
    const { trabajoId } = await e.copias.exportarCanciones({
      ids: [ID_A],
      conAudio: true,
      destinoId: destino.destinoId
    })
    e.copias.cancelar(trabajoId)
    const fin = await esperarFin(e, trabajoId)
    expect(fin.estado).toBe('cancelada')
    expect(await readFile(previo, 'utf8')).toBe('contenido anterior')
    expect((await readdir(e.salida)).filter((n) => n.endsWith('.shinobi-parcial'))).toEqual([])
  })

  it('no se guarda dentro de la carpeta de datos', async () => {
    const e = await nuevo()
    await sembrarBiblioteca(e)
    const destino = await e.copias.destinoPropuesto({ tipo: 'canciones', ids: [ID_A] })
    // Un destinoId de otra sesión no sirve; y la carpeta propuesta nunca es la de datos.
    expect(destino.carpeta.startsWith(e.datos)).toBe(false)
    await expect(
      e.copias.exportarCanciones({ ids: [ID_A], conAudio: true, destinoId: idDePrueba(1) })
    ).rejects.toMatchObject({ codigo: 'DESTINO_NO_DISPONIBLE' })
  })

  it('un destinoId se gasta una sola vez', async () => {
    const e = await nuevo()
    await sembrarBiblioteca(e)
    const destino = await e.copias.destinoPropuesto({ tipo: 'canciones', ids: [ID_A] })
    await e.copias.exportarCanciones({ ids: [ID_A], conAudio: false, destinoId: destino.destinoId })
    await expect(
      e.copias.exportarCanciones({ ids: [ID_A], conAudio: false, destinoId: destino.destinoId })
    ).rejects.toMatchObject({ codigo: 'DESTINO_NO_DISPONIBLE' })
  })

  it('estimación: la variante completa pesa más que la ligera', async () => {
    const e = await nuevo()
    await sembrarBiblioteca(e)
    const d = await e.copias.destinoPropuesto({ tipo: 'canciones', ids: [ID_A] })
    expect(d.estimacion.completoBytes).toBeGreaterThan(d.estimacion.ligeroBytes)
    expect(d.nombre).toMatch(/^Luna de papel — Artista inventado\.shinobi$/)
    const varias = await e.copias.destinoPropuesto({ tipo: 'canciones', ids: [ID_A, ID_B] })
    expect(varias.nombre).toMatch(/^2 canciones de Shinobi Karaoke \d{4}-\d{2}-\d{2}\.shinobi$/)
  })
})

describe('ida y vuelta de un paquete', () => {
  it('con audio: otra biblioteca recibe los mismos cancion.json y los mismos archivos', async () => {
    const origen = await nuevo()
    await sembrarBiblioteca(origen)
    const { ruta } = await exportarA(origen, { tipo: 'canciones', ids: [ID_A], conAudio: true })

    const destino = await nuevo({ baseIdTemas: 1900 })
    const leido = await (async () => {
      destino.elegirAbrir.ruta = ruta
      const o = await destino.copias.elegirOrigen()
      return destino.copias.leer(o!.origenId)
    })()
    expect(leido).toMatchObject({
      tipo: 'paquete',
      conAudio: true,
      canciones: [{ id: ID_A, titulo: 'Luna de papel', existe: false, igual: false }]
    })

    const r = await importar(destino, ruta)
    expect(r.resultados).toEqual([{ id: ID_A, resultado: 'importada', idLocal: ID_A }])
    expect(await archivosDe(destino.biblio, ID_A)).toEqual(await archivosDe(origen.biblio, ID_A))
    const a = await leerCancionDeDisco(origen.biblio, ID_A)
    const b = await leerCancionDeDisco(destino.biblio, ID_A)
    // `creada` y `modificada` se conservan; la apariencia hereda su tema, que viaja asignado.
    expect(b.creada).toBe(a.creada)
    expect(b.modificada).toBe(a.modificada)
    expect({ ...b, apariencia: undefined }).toEqual({ ...a, apariencia: undefined })
    expect(destino.biblioteca.obtenerResumen(ID_A)).toMatchObject({
      estado: 'lista',
      danada: false,
      titulo: 'Luna de papel'
    })
    // Lo extraído no se deja a medias.
    expect(await readdir(join(destino.biblio, '.importando'))).toEqual([])
  })

  it('ligero en otro equipo: borrador sin audio con la fuente pendiente y la letra intacta', async () => {
    const origen = await nuevo()
    await sembrarCancion(origen.biblio, ID_A, {
      titulo: 'Ola sin nombre',
      mutar: (c) => {
        c.fuente = {
          ...c.fuente,
          tipo: 'youtube',
          url: 'https://example.invalid/v',
          youtube_id: 'abc123',
          nombre_original: null
        }
        c.modalidad = 'karaoke'
      }
    })
    await origen.biblioteca.escanear()
    const original = await leerCancionDeDisco(origen.biblio, ID_A)
    const { ruta } = await exportarA(origen, { tipo: 'canciones', ids: [ID_A], conAudio: false })

    const destino = await nuevo({ baseIdTemas: 1900 })
    const r = await importar(destino, ruta)
    expect(r.resultados[0]).toMatchObject({ resultado: 'importada' })
    const c = await leerCancionDeDisco(destino.biblio, ID_A)
    expect(c).toMatchObject({
      estado: 'borrador',
      pistas: null,
      pasos: { fuente: { estado: 'pendiente' }, separacion: { estado: 'pendiente' } },
      fuente: { tipo: 'youtube', url: 'https://example.invalid/v', youtube_id: 'abc123' }
    })
    expect(c.modalidad).toBeUndefined()
    expect(c.letra).toEqual(original.letra)
    expect(await archivosDe(destino.biblio, ID_A)).toEqual(['cancion.json'])
    expect(destino.biblioteca.obtenerResumen(ID_A)).toMatchObject({ estado: 'borrador' })
  })
})

describe('conflictos al importar', () => {
  async function conPaquete(
    conAudio: boolean,
    cambio?: (c: Cancion) => void
  ): Promise<{ equipo: Equipo; ruta: string }> {
    const origen = await nuevo()
    await sembrarCancion(origen.biblio, ID_A, {
      titulo: 'Luna de papel',
      modificada: '2026-11-20T10:00:00.000Z',
      mutar: cambio
    })
    await origen.biblioteca.escanear()
    const { ruta } = await exportarA(origen, { tipo: 'canciones', ids: [ID_A], conAudio })
    const equipo = await nuevo({ baseIdTemas: 1900 })
    return { equipo, ruta }
  }

  it('«Ya la tienes igual» se omite siempre, aunque se pida sustituir', async () => {
    const { equipo, ruta } = await conPaquete(true)
    await sembrarCancion(equipo.biblio, ID_A, {
      titulo: 'Luna de papel',
      modificada: '2026-11-20T10:00:00.000Z'
    })
    await equipo.biblioteca.escanear()
    const r = await importar(equipo, ruta, 'sustituir')
    expect(r.resultados).toEqual([{ id: ID_A, resultado: 'omitida', motivo: 'IGUAL' }])
  })

  it('omitir (lo predeterminado) no toca la existente', async () => {
    const { equipo, ruta } = await conPaquete(true)
    await sembrarCancion(equipo.biblio, ID_A, {
      titulo: 'Mi versión',
      modificada: '2026-11-21T10:00:00.000Z'
    })
    await equipo.biblioteca.escanear()
    const antes = await readFile(join(equipo.biblio, ID_A, 'cancion.json'), 'utf8')
    const r = await importar(equipo, ruta, 'omitir')
    expect(r.resultados[0]).toMatchObject({ resultado: 'omitida', motivo: 'OMITIDA' })
    expect(await readFile(join(equipo.biblio, ID_A, 'cancion.json'), 'utf8')).toBe(antes)
  })

  it('sustituir con audio: la existente va a la papelera y entra la del paquete', async () => {
    const { equipo, ruta } = await conPaquete(true)
    await sembrarCancion(equipo.biblio, ID_A, {
      titulo: 'Mi versión',
      modificada: '2026-11-21T10:00:00.000Z'
    })
    await equipo.biblioteca.escanear()
    const r = await importar(equipo, ruta, 'sustituir')
    expect(r.resultados[0]).toMatchObject({ resultado: 'sustituida', idLocal: ID_A })
    expect((await leerCancionDeDisco(equipo.biblio, ID_A)).metadatos.titulo).toBe('Luna de papel')
    expect(await readdir(equipo.papelera)).toHaveLength(1)
  })

  it('sustituir con un paquete ligero: cambian letra y datos y se conserva el audio local', async () => {
    const { equipo, ruta } = await conPaquete(false, (c) => {
      c.letra!.lineas[0]!.texto = 'Primera línea inventada y corregida'
    })
    await sembrarCancion(equipo.biblio, ID_A, {
      titulo: 'Mi versión',
      modificada: '2026-11-21T10:00:00.000Z'
    })
    await equipo.biblioteca.escanear()
    const voz = await readFile(join(equipo.biblio, ID_A, 'pistas', 'voz.flac'))
    const r = await importar(equipo, ruta, 'sustituir')
    expect(r.resultados[0]).toMatchObject({ resultado: 'sustituida', ligera: true })
    const c = await leerCancionDeDisco(equipo.biblio, ID_A)
    expect(c.metadatos.titulo).toBe('Luna de papel')
    expect(c.letra!.lineas[0]!.texto).toBe('Primera línea inventada y corregida')
    expect(c.pistas).not.toBeNull()
    expect(c.estado).toBe('lista')
    expect(await readFile(join(equipo.biblio, ID_A, 'pistas', 'voz.flac'))).toEqual(voz)
    // Sin papelera: la anterior queda en el `.bak` de `cancion.json`.
    expect(await readdir(equipo.papelera)).toHaveLength(0)
    expect(
      JSON.parse(await readFile(join(equipo.biblio, ID_A, 'cancion.json.bak'), 'utf8')).metadatos
        .titulo
    ).toBe('Mi versión')
  })

  it('conservar las dos: id nuevo, título con « (importada)» y las dos fechas de origen', async () => {
    const { equipo, ruta } = await conPaquete(true)
    await sembrarCancion(equipo.biblio, ID_A, {
      titulo: 'Mi versión',
      modificada: '2026-11-21T10:00:00.000Z'
    })
    await equipo.biblioteca.escanear()
    const r = await importar(equipo, ruta, 'conservar_ambas')
    const { idLocal } = r.resultados[0]!
    expect(idLocal).toBeTruthy()
    expect(idLocal).not.toBe(ID_A)
    const nueva = await leerCancionDeDisco(equipo.biblio, idLocal!)
    expect(nueva).toMatchObject({
      id: idLocal,
      creada: '2026-11-03T10:00:00.000Z',
      modificada: '2026-11-20T10:00:00.000Z',
      metadatos: { titulo: 'Luna de papel (importada)' }
    })
    expect((await leerCancionDeDisco(equipo.biblio, ID_A)).metadatos.titulo).toBe('Mi versión')
    expect(await archivosDe(equipo.biblio, idLocal!)).toContain('pistas/voz.flac')
  })

  it('una canción distinta por canción: porCancion manda sobre el valor general', async () => {
    const { equipo, ruta } = await conPaquete(true)
    await sembrarCancion(equipo.biblio, ID_A, {
      titulo: 'Mi versión',
      modificada: '2026-11-21T10:00:00.000Z'
    })
    await equipo.biblioteca.escanear()
    equipo.elegirAbrir.ruta = ruta
    const o = await equipo.copias.elegirOrigen()
    const r = await importarEsperando(equipo, {
      origenId: o!.origenId,
      conflictos: 'omitir',
      porCancion: { [ID_A]: 'sustituir' },
      ajustes: false
    })
    expect(r.resultados[0]).toMatchObject({ resultado: 'sustituida' })
  })

  it('«Sustituir» no se aplica a la canción que suena ni a la que se está procesando', async () => {
    const { equipo, ruta } = await conPaquete(true)
    await sembrarCancion(equipo.biblio, ID_A, {
      titulo: 'Mi versión',
      modificada: '2026-11-21T10:00:00.000Z'
    })
    await equipo.biblioteca.escanear()
    equipo.sonando.add(ID_A)
    const r = await importar(equipo, ruta, 'sustituir')
    expect(r.resultados[0]).toMatchObject({
      resultado: 'omitida',
      motivo: 'CANCION_EN_REPRODUCCION'
    })
    expect((await leerCancionDeDisco(equipo.biblio, ID_A)).metadatos.titulo).toBe('Mi versión')
  })

  it('sin espacio: SIN_ESPACIO antes de extraer y nada queda en .importando', async () => {
    const { equipo, ruta } = await conPaquete(true)
    equipo.libre.bytes = 10
    equipo.elegirAbrir.ruta = ruta
    const o = await equipo.copias.elegirOrigen()
    await expect(
      importarEsperando(equipo, { origenId: o!.origenId, conflictos: 'omitir', ajustes: false })
    ).rejects.toMatchObject({ codigo: 'SIN_ESPACIO' })
    expect(await readdir(join(equipo.biblio, '.importando')).catch(() => [])).toEqual([])
    expect(equipo.biblioteca.listar()).toEqual([])
  })

  it('una canción parecida (mismo título, artista y duración) se avisa pero se importa', async () => {
    const { equipo, ruta } = await conPaquete(true)
    await sembrarCancion(equipo.biblio, ID_C, { titulo: 'Luna de papel' })
    await equipo.biblioteca.escanear()
    equipo.elegirAbrir.ruta = ruta
    const o = await equipo.copias.elegirOrigen()
    const resumen = await equipo.copias.leer(o!.origenId)
    expect(resumen.canciones[0]).toMatchObject({ existe: false, parecida: true })
  })
})

describe('temas', () => {
  const catalogoConTemas = (): Catalogo => ({
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
        estilo: estiloNeon
      },
      {
        id: TEMA_SOL,
        nombre: 'Sol',
        creado: '2026-11-01T10:00:00.000Z',
        modificado: '2026-11-01T10:00:00.000Z',
        revision: 1,
        estilo: estiloSol
      }
    ],
    asignaciones: {
      artistas: [
        {
          artista: 'artista inventado',
          nombre_artista: 'artista inventado',
          tema_id: TEMA_SOL
        }
      ],
      albumes: []
    },
    borrado_pendiente: null,
    apartado: null
  })

  /** Equipo de origen con dos temas, uno heredado por artista, otro asignado a la canción. */
  async function origenConTemas(): Promise<Equipo> {
    const origen = await nuevo()
    await origen.temas.enCola(() => origen.temas.confirmarCatalogo(catalogoConTemas()))
    await sembrarCancion(origen.biblio, ID_A, {
      titulo: 'Luna de papel',
      apariencia: { modo: 'heredar' }
    })
    await sembrarCancion(origen.biblio, ID_B, {
      titulo: 'Río imaginario',
      artista: 'Otro artista',
      apariencia: { modo: 'tema', tema_id: TEMA_NEON, tema_nombre: 'Neón' }
    })
    await origen.biblioteca.escanear()
    return origen
  }

  it('paquete de canciones: lleva solo los temas que usa y las canciones entran con su tema asignado', async () => {
    const origen = await origenConTemas()
    const { ruta } = await exportarA(origen, { tipo: 'canciones', ids: [ID_A], conAudio: false })
    const lector = await PaqueteLector.abrir(ruta)
    const temas = JSON.parse((await lector.leerBuffer('temas.json', 1e6)).toString()) as Catalogo
    lector.cerrar()
    expect(temas.temas.map((t) => t.id)).toEqual([TEMA_SOL]) // el del artista; Neón no se usa
    expect(temas.asignaciones.artistas).toHaveLength(1)

    const destino = await nuevo({ baseIdTemas: 1900 })
    const r = await importar(destino, ruta)
    expect(r.temas).toEqual({ importados: ['Sol'], reutilizados: 0 })
    const c = await leerCancionDeDisco(destino.biblio, ID_A)
    expect(c.apariencia).toMatchObject({ modo: 'tema', tema_id: TEMA_SOL, tema_nombre: 'Sol' })
    // No se importaron asignaciones de artista: el catálogo de destino no las tiene.
    expect(destino.temas.datos()!.asignaciones.artistas).toEqual([])
    expect(
      destino.temas
        .datos()!
        .temas.map((t) => t.nombre)
        .sort()
    ).toEqual(['Shinobi', 'Sol'])
  })

  it('tema igual (mismo id y estilo): se reutiliza; mismo id con otro estilo o mismo nombre: copia «(importado)»', async () => {
    const origen = await origenConTemas()
    const { ruta } = await exportarA(origen, { tipo: 'canciones', ids: [ID_B], conAudio: false })
    const destino = await nuevo({ baseIdTemas: 1900 })
    const catalogoLocal = catalogoConTemas()
    // Mismo id y estilo.
    await destino.temas.enCola(() =>
      destino.temas.confirmarCatalogo({
        ...catalogoLocal,
        predeterminado: null,
        temas: [catalogoLocal.temas[0]!],
        asignaciones: { artistas: [], albumes: [] }
      })
    )
    const igual = await importar(destino, ruta)
    expect(igual.temas).toEqual({ importados: [], reutilizados: 1 })
    expect((await leerCancionDeDisco(destino.biblio, ID_B)).apariencia?.tema_id).toBe(TEMA_NEON)

    // Mismo id, otro estilo → copia con id nuevo y las canciones importadas apuntan a ella.
    const otro = await nuevo({ baseIdTemas: 2900 })
    await otro.temas.enCola(() =>
      otro.temas.confirmarCatalogo({
        ...catalogoLocal,
        predeterminado: null,
        temas: [{ ...catalogoLocal.temas[0]!, estilo: estiloSol }],
        asignaciones: { artistas: [], albumes: [] }
      })
    )
    const distinto = await importar(otro, ruta)
    expect(distinto.temas?.importados).toEqual(['Neón (importado)'])
    const c = await leerCancionDeDisco(otro.biblio, ID_B)
    expect(c.apariencia?.tema_id).not.toBe(TEMA_NEON)
    expect(otro.temas.datos()!.temas.find((t) => t.id === TEMA_NEON)!.estilo).toEqual(estiloSol)
    expect(otro.temas.datos()!.temas.find((t) => t.id === c.apariencia!.tema_id)!.nombre).toBe(
      'Neón (importado)'
    )
  })

  it('catálogo de solo lectura: no se importan temas y la canción entra con su apariencia guardada', async () => {
    const origen = await origenConTemas()
    const { ruta } = await exportarA(origen, { tipo: 'canciones', ids: [ID_B], conAudio: false })
    const destino = await nuevo({ temasSoloLectura: true })
    expect(destino.temas.soloLectura).toBe(true)
    destino.elegirAbrir.ruta = ruta
    const o = await destino.copias.elegirOrigen()
    expect(await destino.copias.leer(o!.origenId)).toMatchObject({ temasSoloLectura: true })
    const r = await importarEsperando(destino, {
      origenId: o!.origenId,
      conflictos: 'omitir',
      ajustes: false
    })
    expect(r.resultados[0]).toMatchObject({ resultado: 'importada' })
    const c = await leerCancionDeDisco(destino.biblio, ID_B)
    expect(c.apariencia).toEqual({ modo: 'propio' })
    expect(c.estilo).toEqual(estiloNeon)
  })
})

describe('copia de seguridad y restauración', () => {
  it('copia + restauración en una instalación vacía: no se pierde nada', async () => {
    const origen = await nuevo()
    await origen.temas.enCola(() =>
      origen.temas.confirmarCatalogo({
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
            estilo: estiloNeon
          },
          {
            id: TEMA_SOL,
            nombre: 'Sol',
            creado: '2026-11-01T10:00:00.000Z',
            modificado: '2026-11-01T10:00:00.000Z',
            revision: 1,
            estilo: estiloSol
          }
        ],
        asignaciones: {
          artistas: [
            { artista: 'artista inventado', nombre_artista: 'artista inventado', tema_id: TEMA_SOL }
          ],
          albumes: [
            {
              artista: 'artista inventado',
              album: 'disco de prueba',
              nombre_artista: 'artista inventado',
              nombre_album: 'disco de prueba',
              tema_id: TEMA_NEON
            }
          ]
        },
        borrado_pendiente: null,
        apartado: null
      })
    )
    await sembrarBiblioteca(origen)
    await sembrarCancion(origen.biblio, ID_C, { titulo: 'Ilegible' })
    await writeFile(join(origen.biblio, ID_C, 'cancion.json'), '{ no es json')
    await origen.biblioteca.escanear()
    await origen.config.actualizar({
      biblioteca: { agrupar: 'artista' },
      reproductor: { volumen: 0.35, voz_guia: 0.5 },
      aviso_youtube_aceptado: '2026-11-01T10:00:00.000Z',
      exportacion: { carpeta: '/carpeta/del/equipo' }
    })

    const { ruta, fin } = await exportarA(origen, {
      tipo: 'biblioteca',
      conAudio: true,
      ajustes: true
    })
    // La ilegible se omite y se lista; las demás van enteras.
    expect(fin.resultado).toMatchObject({
      canciones: 2,
      omitidas: [{ id: ID_C, motivo: 'CANCION_NO_DISPONIBLE' }]
    })
    const dentro = await entradas(ruta)
    expect(dentro).toContain('temas.json')
    expect(dentro).toContain('ajustes.json')
    // Nada del equipo ni regenerable.
    expect(dentro.some((n) => /\.bak$|picos|runtime|modelos|registros|config\.json$/.test(n))).toBe(
      false
    )
    const ajustes = JSON.parse(
      await (async () => {
        const l = await PaqueteLector.abrir(ruta)
        const t = (await l.leerBuffer('ajustes.json', 1e6)).toString()
        l.cerrar()
        return t
      })()
    ) as Record<string, unknown>
    expect(JSON.stringify(ajustes)).not.toMatch(
      /aviso_youtube|carpeta|instalacion|hardware|secundaria/
    )
    expect(origen.config.obtener().copias.ultima).toMatchObject({
      canciones: 2,
      tipo: 'completa'
    })

    // Instalación vacía: su catálogo sembrado se llama igual («Shinobi») que el del origen y es distinto.
    const nuevoEquipo = await nuevo({ baseIdTemas: 1900 })
    nuevoEquipo.elegirAbrir.ruta = ruta
    const o = await nuevoEquipo.copias.elegirOrigen()
    const resumen = await nuevoEquipo.copias.leer(o!.origenId)
    expect(resumen).toMatchObject({ tipo: 'copia', ajustes: true })
    expect(resumen.canciones.map((c) => c.existe)).toEqual([false, false])
    expect(resumen.asignaciones).toMatchObject({ aplicables: 2, predeterminado: 'no_aplica' })
    const r = await importarEsperando(nuevoEquipo, {
      origenId: o!.origenId,
      conflictos: 'omitir',
      ajustes: true
    })
    expect(r.resultados.map((x) => x.resultado).sort()).toEqual(['importada', 'importada'])
    expect(r.ajustes).toBe(true)
    for (const id of [ID_A, ID_B]) {
      expect(await archivosDe(nuevoEquipo.biblio, id)).toEqual(await archivosDe(origen.biblio, id))
      const a = await leerCancionDeDisco(origen.biblio, id)
      const b = await leerCancionDeDisco(nuevoEquipo.biblio, id)
      expect(b).toEqual(a)
    }
    const catalogo = nuevoEquipo.temas.datos()!
    expect(catalogo.temas.map((t) => t.nombre).sort()).toEqual(['Neón', 'Shinobi', 'Sol'])
    expect(catalogo.asignaciones.artistas).toHaveLength(1)
    expect(catalogo.asignaciones.albumes).toHaveLength(1)
    // Ajustes: los de preferencias viajan; los consentimientos y las carpetas no.
    const cfg = nuevoEquipo.config.obtener()
    expect(cfg.biblioteca.agrupar).toBe('artista')
    expect(cfg.reproductor.volumen).toBeCloseTo(0.35)
    expect(cfg.aviso_youtube_aceptado).toBeNull()
    expect(cfg.exportacion.carpeta).toBeNull()
  })

  it('restaurar sobre una biblioteca con canciones no borra nada y no restaura ajustes si no se pidió', async () => {
    const origen = await nuevo()
    await sembrarBiblioteca(origen)
    await origen.config.actualizar({ reproductor: { volumen: 0.1 } })
    const { ruta } = await exportarA(origen, { tipo: 'biblioteca', conAudio: false, ajustes: true })
    expect(origen.config.obtener().copias.ultima).toMatchObject({ tipo: 'ligera' })

    const destino = await nuevo({ baseIdTemas: 1900 })
    await sembrarCancion(destino.biblio, ID_C, { titulo: 'Solo mía' })
    await destino.biblioteca.escanear()
    const volumenAntes = destino.config.obtener().reproductor.volumen
    const r = await importar(destino, ruta, 'omitir', false)
    expect(r.ajustes).toBe(false)
    expect(destino.config.obtener().reproductor.volumen).toBe(volumenAntes)
    expect(
      destino.biblioteca
        .listar()
        .map((c) => c.id)
        .sort()
    ).toEqual([ID_A, ID_B, ID_C].sort())
    expect((await leerCancionDeDisco(destino.biblio, ID_C)).metadatos.titulo).toBe('Solo mía')
    // Dos canciones ligeras sin audio: borradores a la espera de su audio.
    expect(destino.biblioteca.obtenerResumen(ID_B)?.estado).toBe('borrador')
  })

  it('ajustes distintos de los permitidos en un ajustes.json hostil no se aplican', async () => {
    const origen = await nuevo()
    await sembrarBiblioteca(origen)
    const { ruta } = await exportarA(origen, { tipo: 'biblioteca', conAudio: false, ajustes: true })
    expect(ruta).toBeTruthy()
    // La lista blanca vive en `ajustesQueViajan`, probada con un objeto cualquiera.
    const { ajustesQueViajan } = await import('./ajustes')
    expect(
      ajustesQueViajan({
        instalacion: { estado: 'completa' },
        reproductor: { volumen: 0.2, secundaria: { x: 1 } },
        aviso_youtube_aceptado: 'x',
        rapido_aceptado: true,
        exportacion: { carpeta: '/x', fps: 30, factor_corrector: 2 },
        editor: {
          paneles: { lista: { ancho: 300 }, preciso: { geometria: { x: 1 }, margen_ms: 500 } }
        }
      })
    ).toEqual({
      reproductor: { volumen: 0.2 },
      exportacion: { fps: 30 },
      editor: { paneles: { lista: { ancho: 300 }, preciso: { margen_ms: 500 } } }
    })
  })
})

describe('origenDesdeRuta (archivo soltado en la ventana)', () => {
  it('acepta un .shinobi existente y lo deja leer; rechaza otra extensión, una carpeta, un archivo inexistente y los datos de la app', async () => {
    const e = await nuevo()
    await sembrarBiblioteca(e)
    const { ruta } = await exportarA(e, { tipo: 'canciones', ids: [ID_A], conAudio: false })
    const origen = await e.copias.origenDesdeRuta(ruta)
    expect(origen).toMatchObject({ nombre: expect.stringMatching(/\.shinobi$/) })
    expect((await e.copias.leer(origen!.origenId)).canciones).toHaveLength(1)

    const otra = join(e.salida, 'notas.txt')
    await writeFile(otra, 'hola')
    expect(await e.copias.origenDesdeRuta(otra)).toBeNull()
    expect(await e.copias.origenDesdeRuta(e.salida)).toBeNull()
    expect(await e.copias.origenDesdeRuta(join(e.salida, 'no-existe.shinobi'))).toBeNull()
    const dentro = join(e.datos, 'copia.shinobi')
    await writeFile(dentro, 'x')
    expect(await e.copias.origenDesdeRuta(dentro)).toBeNull()
    const carpetaShinobi = join(e.salida, 'carpeta.shinobi')
    await mkdir(carpetaShinobi)
    expect(await e.copias.origenDesdeRuta(carpetaShinobi)).toBeNull()
  })
})

describe('importar devuelve el trabajoId', () => {
  it('se acepta al momento y el resultado llega en copias:cambio', async () => {
    const e = await nuevo()
    await sembrarBiblioteca(e)
    const { ruta } = await exportarA(e, { tipo: 'canciones', ids: [ID_A], conAudio: false })
    const otro = await nuevo({ baseIdTemas: 1900 })
    otro.elegirAbrir.ruta = ruta
    const o = await otro.copias.elegirOrigen()
    const { trabajoId } = await otro.copias.importar({
      origenId: o!.origenId,
      conflictos: 'omitir',
      ajustes: false
    })
    expect(trabajoId).toMatch(/^[0-9a-f-]{36}$/)
    const fin = await esperarFin(otro, trabajoId)
    expect(fin).toMatchObject({ estado: 'terminada', tipo: 'importar' })
    expect((fin.resultado as { resultados: unknown[] }).resultados).toHaveLength(1)
  })
})
