import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { ZipFile } from 'yazl'
import {
  ID_A,
  ID_B,
  esperarFin,
  exportarA,
  importarEsperando,
  leerCancionDeDisco,
  montarEquipo,
  sembrarCancion,
  type Equipo
} from './montajeDePrueba'
import type { ResultadoImportacionIpc } from '../../shared/ipc'
import { PaqueteLector } from './zip'

/**
 * Paquetes rotos u hostiles: se fabrican a partir de uno bueno exportado por la propia app o con `yazl`.
 * Todo en carpetas temporales; nada se escribe fuera de la carpeta de la biblioteca de prueba.
 */

const equipos: Equipo[] = []
const nuevo = async (): Promise<Equipo> => {
  const e = await montarEquipo({ baseIdTemas: 1900 })
  equipos.push(e)
  return e
}
afterEach(async () => {
  await Promise.all(equipos.splice(0).map((e) => e.limpiar()))
})

interface Entrada {
  nombre: string
  contenido: Buffer
  mode?: number
  /** Fuerza deflate en una entrada que no es JSON. */
  comprimir?: boolean
}

async function escribirZip(ruta: string, entradas: Entrada[]): Promise<void> {
  const zip = new ZipFile()
  for (const e of entradas) {
    zip.addBuffer(e.contenido, e.nombre, {
      compress: e.comprimir ?? e.nombre.endsWith('.json'),
      ...(e.mode !== undefined ? { mode: e.mode } : {})
    })
  }
  zip.end()
  await pipeline(zip.outputStream, createWriteStream(ruta))
}

async function leerEntradas(ruta: string): Promise<Entrada[]> {
  const lector = await PaqueteLector.abrir(ruta)
  try {
    const salida: Entrada[] = []
    for (const nombre of lector.entradas.keys()) {
      salida.push({ nombre, contenido: await lector.leerBuffer(nombre, 1e9) })
    }
    return salida
  } finally {
    lector.cerrar()
  }
}

type Manifiesto = {
  version_formato: number
  canciones: {
    id: string
    esquema_cancion: number
    archivos: { ruta: string; bytes: number; sha256: string }[]
  }[]
  [k: string]: unknown
}

/** Un paquete bueno con dos canciones (A con pistas, B borrador), reescrito con `cambio`. */
async function paquete(
  e: Equipo,
  conAudio: boolean,
  cambio: (entradas: Entrada[], m: Manifiesto) => Entrada[] | void = () => undefined,
  nombre = 'roto.shinobi'
): Promise<string> {
  await sembrarCancion(e.biblio, ID_A, { titulo: 'Luna de papel' })
  await sembrarCancion(e.biblio, ID_B, { titulo: 'Río imaginario', conPistas: false })
  await e.biblioteca.escanear()
  const { ruta } = await exportarA(e, { tipo: 'canciones', ids: [ID_A, ID_B], conAudio })
  const entradas = await leerEntradas(ruta)
  const manifiesto = entradas.find((x) => x.nombre === 'manifiesto.json')!
  const m = JSON.parse(manifiesto.contenido.toString()) as Manifiesto
  const nuevas = cambio(entradas, m) ?? entradas
  manifiesto.contenido = Buffer.from(JSON.stringify(m))
  const destino = join(e.salida, nombre)
  await escribirZip(destino, nuevas)
  // La biblioteca de origen se vacía: el paquete se importa en una limpia.
  for (const id of [ID_A, ID_B]) await e.biblioteca.eliminar(id)
  return destino
}

/** Reescribe el `cancion.json` de la canción `i` del manifiesto con `cambio`, dejando bien tamaño y SHA. */
function reescribirCancion(
  entradas: Entrada[],
  m: Manifiesto,
  i: number,
  cambio: (c: Record<string, any>) => void // eslint-disable-line @typescript-eslint/no-explicit-any
): void {
  const id = m.canciones[i]!.id
  const json = entradas.find((x) => x.nombre === `canciones/${id}/cancion.json`)!
  const c = JSON.parse(json.contenido.toString()) as Record<string, unknown>
  cambio(c)
  json.contenido = Buffer.from(JSON.stringify(c))
  const a = m.canciones[i]!.archivos.find((x) => x.ruta.endsWith('cancion.json'))!
  a.bytes = json.contenido.length
  a.sha256 = createHash('sha256').update(json.contenido).digest('hex')
}

async function leer(e: Equipo, ruta: string) {
  e.elegirAbrir.ruta = ruta
  const o = await e.copias.elegirOrigen()
  return { origenId: o!.origenId, leer: () => e.copias.leer(o!.origenId) }
}

async function importar(e: Equipo, ruta: string) {
  const o = await leer(e, ruta)
  return importarEsperando(e, { origenId: o.origenId, conflictos: 'omitir', ajustes: false })
}

describe('un paquete que no se puede abrir se rechaza entero, sin tocar nada', () => {
  it('cortado (truncado): PAQUETE_INCOMPLETO en el paso 1, sin lista parcial', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, true)
    const bytes = await readFile(ruta)
    const cortado = join(e.salida, 'cortado.shinobi')
    await writeFile(cortado, bytes.subarray(0, Math.floor(bytes.length * 0.6)))
    const o = await leer(e, cortado)
    await expect(o.leer()).rejects.toMatchObject({ codigo: 'PAQUETE_INCOMPLETO' })
    await expect(
      importarEsperando(e, { origenId: o.origenId, conflictos: 'omitir', ajustes: false })
    ).rejects.toMatchObject({ codigo: 'PAQUETE_INCOMPLETO' })
    expect(e.biblioteca.listar()).toEqual([])
  })

  it('un archivo que no es un ZIP, o vacío: PAQUETE_NO_VALIDO', async () => {
    const e = await nuevo()
    const texto = join(e.salida, 'texto.shinobi')
    await writeFile(texto, 'esto no es un paquete')
    await expect((await leer(e, texto)).leer()).rejects.toMatchObject({
      codigo: 'PAQUETE_NO_VALIDO'
    })
    const vacio = join(e.salida, 'vacio.shinobi')
    await writeFile(vacio, '')
    await expect((await leer(e, vacio)).leer()).rejects.toMatchObject({
      codigo: 'PAQUETE_NO_VALIDO'
    })
  })

  it('un ZIP cualquiera sin manifiesto, o con un manifiesto ilegible: PAQUETE_NO_VALIDO', async () => {
    const e = await nuevo()
    const sin = join(e.salida, 'sin.shinobi')
    await escribirZip(sin, [{ nombre: 'otra-cosa.txt', contenido: Buffer.from('hola') }])
    await expect((await leer(e, sin)).leer()).rejects.toMatchObject({ codigo: 'PAQUETE_NO_VALIDO' })
    const roto = join(e.salida, 'roto.shinobi')
    await escribirZip(roto, [{ nombre: 'manifiesto.json', contenido: Buffer.from('{ no json') }])
    await expect((await leer(e, roto)).leer()).rejects.toMatchObject({
      codigo: 'PAQUETE_NO_VALIDO'
    })
    const ajeno = join(e.salida, 'ajeno.shinobi')
    await escribirZip(ajeno, [
      { nombre: 'manifiesto.json', contenido: Buffer.from('{"formato":"otro"}') }
    ])
    await expect((await leer(e, ajeno)).leer()).rejects.toMatchObject({
      codigo: 'PAQUETE_NO_VALIDO'
    })
  })

  it('version_formato más nuevo: PAQUETE_VERSION_NUEVA y no se cambia nada', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, false, (_, m) => {
      m.version_formato = 2
    })
    const o = await leer(e, ruta)
    await expect(o.leer()).rejects.toMatchObject({ codigo: 'PAQUETE_VERSION_NUEVA' })
    await expect(
      importarEsperando(e, { origenId: o.origenId, conflictos: 'omitir', ajustes: false })
    ).rejects.toMatchObject({ codigo: 'PAQUETE_VERSION_NUEVA' })
    expect(e.biblioteca.listar()).toEqual([])
  })

  it('demasiadas entradas (bomba de entradas): PAQUETE_NO_VALIDO', async () => {
    const e = await nuevo()
    const ruta = join(e.salida, 'bomba.shinobi')
    const entradas: Entrada[] = [{ nombre: 'manifiesto.json', contenido: Buffer.from('{}') }]
    for (let i = 0; i < 26_000; i++) {
      entradas.push({ nombre: `relleno/${i}.txt`, contenido: Buffer.alloc(0) })
    }
    await escribirZip(ruta, entradas)
    await expect((await leer(e, ruta)).leer()).rejects.toMatchObject({
      codigo: 'PAQUETE_NO_VALIDO'
    })
  })

  it('un archivo declarado con un tamaño absurdo en el manifiesto: PAQUETE_NO_VALIDO', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, true, (_, m) => {
      m.canciones[0]!.archivos[0]!.bytes = 40 * 1024 ** 3
    })
    await expect((await leer(e, ruta)).leer()).rejects.toMatchObject({
      codigo: 'PAQUETE_NO_VALIDO'
    })
  })
})

describe('rutas y nombres que vienen dentro de cancion.json y del manifiesto', () => {
  it('una ruta interna fuera de la carpeta (pistas.voz): esa canción falla con PAQUETE_INCOMPLETO y no se importa', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, true, (entradas, m) => {
      reescribirCancion(entradas, m, 0, (c) => {
        c.pistas.voz = '../../fuera/voz.flac'
      })
    })
    const r = await importar(e, ruta)
    expect(r.resultados[0]).toEqual({ id: ID_A, resultado: 'error', motivo: 'PAQUETE_INCOMPLETO' })
    expect(r.resultados[1]).toMatchObject({ id: ID_B, resultado: 'importada' })
    expect(e.biblioteca.obtenerResumen(ID_A)).toBeNull()
    expect(await readdir(e.biblio)).not.toContain(ID_A)
  })

  it('rutas absolutas o con barra invertida también se rechazan', async () => {
    for (const mala of ['/etc/hosts', 'C:\\Windows\\x.flac', 'pistas\\..\\x.flac']) {
      const e = await nuevo()
      const ruta = await paquete(e, true, (entradas, m) => {
        reescribirCancion(entradas, m, 0, (c) => {
          c.fuente.mezcla = mala
        })
      })
      const r = await importar(e, ruta)
      expect(r.resultados[0], mala).toMatchObject({ id: ID_A, resultado: 'error' })
    }
  })

  it('fuente.ruta_pendiente que trae un paquete se descarta al importar', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, false, (entradas, m) => {
      reescribirCancion(entradas, m, 1, (c) => {
        c.fuente.ruta_pendiente = '/etc/hosts'
      })
    })
    const r = await importar(e, ruta)
    expect(r.resultados[1]).toMatchObject({ id: ID_B, resultado: 'importada' })
    const c = await leerCancionDeDisco(e.biblio, ID_B)
    expect(c.fuente.ruta_pendiente).toBeUndefined()
    expect(JSON.stringify(c)).not.toContain('/etc/hosts')
  })

  it('al exportar, una canción con ruta_pendiente entra sin ella (paquete y copia)', async () => {
    const e = await nuevo()
    await sembrarCancion(e.biblio, ID_B, {
      titulo: 'Río imaginario',
      conPistas: false,
      mutar: (c) => {
        c.fuente.ruta_pendiente = '/Users/persona-inventada/musica/rio.wav'
      }
    })
    await e.biblioteca.escanear()
    expect(e.biblioteca.obtener(ID_B)?.fuente.ruta_pendiente).toBeDefined()
    for (const peticion of [
      { tipo: 'canciones' as const, ids: [ID_B], conAudio: false },
      { tipo: 'biblioteca' as const, conAudio: false }
    ]) {
      const { ruta } = await exportarA(e, peticion)
      const entradas = await leerEntradas(ruta)
      const json = entradas.find((x) => x.nombre === `canciones/${ID_B}/cancion.json`)!
      const texto = json.contenido.toString()
      expect(texto).not.toContain('ruta_pendiente')
      expect(texto).not.toContain('persona-inventada')
    }
    // La canción local conserva su ruta: solo la copia del paquete la pierde.
    expect(e.biblioteca.obtener(ID_B)?.fuente.ruta_pendiente).toBeDefined()
  })

  it('un id de canción con nombre de dispositivo de Windows rechaza el paquete entero', async () => {
    for (const id of ['CON', 'nul', 'Aux', 'PRN', 'COM1', 'lpt9']) {
      const e = await nuevo()
      const ruta = await paquete(e, false, (_, m) => {
        m.canciones[0]!.id = id
      })
      await expect((await leer(e, ruta)).leer(), id).rejects.toMatchObject({
        codigo: 'PAQUETE_NO_VALIDO'
      })
    }
  })
})

describe('rutas maliciosas: nada se escribe fuera de la carpeta de destino', () => {
  /** Cambia en el archivo (cabeceras locales y directorio central) `de` por `a`, de igual longitud. */
  async function parchear(ruta: string, de: string, a: string): Promise<void> {
    const bytes = await readFile(ruta)
    let desde = 0
    let hallados = 0
    for (;;) {
      const i = bytes.indexOf(de, desde)
      if (i === -1) break
      bytes.write(a, i)
      hallados++
      desde = i + de.length
    }
    expect(hallados).toBeGreaterThanOrEqual(2) // cabecera local + directorio central
    await writeFile(ruta, bytes)
  }

  const casos: [string, string, string][] = [
    ['con ..', 'aa/evil.txt', '../evil.txt'],
    ['absoluta', 'xetc/evil.t', '/etc/evil.t'],
    ['con barra invertida', 'aa_evil.txt', 'aa\\evil.txt']
  ]
  for (const [descripcion, nombreOriginal, nombreMalicioso] of casos) {
    it(`entrada ${descripcion}: PAQUETE_NO_VALIDO y no se crea nada`, async () => {
      const e = await nuevo()
      const antes = await readdir(e.raiz)
      const ruta = await paquete(
        e,
        false,
        (entradas) => [...entradas, { nombre: nombreOriginal, contenido: Buffer.from('malo') }],
        'hostil.shinobi'
      )
      await parchear(ruta, nombreOriginal, nombreMalicioso)
      const o = await leer(e, ruta)
      await expect(o.leer()).rejects.toMatchObject({ codigo: 'PAQUETE_NO_VALIDO' })
      await expect(
        importarEsperando(e, { origenId: o.origenId, conflictos: 'omitir', ajustes: false })
      ).rejects.toMatchObject({ codigo: 'PAQUETE_NO_VALIDO' })
      expect(e.biblioteca.listar()).toEqual([])
      const despues = await readdir(e.raiz)
      expect(despues.sort()).toEqual(antes.sort())
    })
  }

  it('un enlace simbólico dentro del paquete: PAQUETE_NO_VALIDO', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, false, (entradas) => [
      ...entradas,
      { nombre: 'canciones/enlace', contenido: Buffer.from('/etc/passwd'), mode: 0o120777 }
    ])
    await expect((await leer(e, ruta)).leer()).rejects.toMatchObject({
      codigo: 'PAQUETE_NO_VALIDO'
    })
  })

  it('entradas repetidas: PAQUETE_NO_VALIDO', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, false, (entradas) => [
      ...entradas,
      { nombre: 'duplicada.txt', contenido: Buffer.from('uno') },
      { nombre: 'duplicada.txt', contenido: Buffer.from('dos') }
    ])
    await expect((await leer(e, ruta)).leer()).rejects.toMatchObject({
      codigo: 'PAQUETE_NO_VALIDO'
    })
  })

  it('entradas cifradas: PAQUETE_NO_VALIDO', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, false, (entradas) => [
      ...entradas,
      { nombre: 'secreto.json', contenido: Buffer.from('cifrado') }
    ])
    // Se marca la entrada como cifrada (bit 0 de las banderas) en su cabecera local y en el directorio central.
    const bytes = await readFile(ruta)
    const nombre = Buffer.from('secreto.json')
    let i = bytes.indexOf(nombre)
    let marcadas = 0
    while (i !== -1) {
      const cabecera = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 0)
      void cabecera
      // Local: firma + 2 versión + 2 banderas, el nombre empieza 30 bytes después de la firma.
      if (bytes.readUInt32LE(i - 30) === 0x04034b50) {
        bytes.writeUInt16LE(bytes.readUInt16LE(i - 24) | 1, i - 24)
        marcadas++
      }
      // Central: el nombre empieza 46 bytes después de la firma; banderas en +8.
      if (bytes.readUInt32LE(i - 46) === 0x02014b50) {
        bytes.writeUInt16LE(bytes.readUInt16LE(i - 38) | 1, i - 38)
        marcadas++
      }
      i = bytes.indexOf(nombre, i + 1)
    }
    expect(marcadas).toBe(2)
    await writeFile(ruta, bytes)
    await expect((await leer(e, ruta)).leer()).rejects.toMatchObject({
      codigo: 'PAQUETE_NO_VALIDO'
    })
  })

  it('una entrada válida pero no declarada se ignora: no se extrae', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, false, (entradas) => [
      ...entradas,
      { nombre: `canciones/${ID_A}/ayuda.sh`, contenido: Buffer.from('#!/bin/sh') },
      { nombre: 'canciones/otra/cancion.json', contenido: Buffer.from('{}') },
      { nombre: `canciones/${ID_A}/pistas/extra.flac`, contenido: Buffer.from('xx') }
    ])
    const r = await importar(e, ruta)
    expect(r.resultados.map((x) => x.resultado)).toEqual(['importada', 'importada'])
    expect(await readdir(join(e.biblio, ID_A))).toEqual(['cancion.json'])
    expect(await readdir(e.biblio)).not.toContain('otra')
  })
})

describe('una canción dañada o más nueva falla sola; las demás entran', () => {
  it('SHA-256 del manifiesto alterado: solo esa canción falla con PAQUETE_INCOMPLETO', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, true, (_, m) => {
      const voz = m.canciones[0]!.archivos.find((a) => a.ruta.endsWith('voz.flac'))!
      voz.sha256 = '0'.repeat(64)
    })
    const r = await importar(e, ruta)
    expect(r.resultados).toEqual([
      { id: ID_A, resultado: 'error', motivo: 'PAQUETE_INCOMPLETO' },
      { id: ID_B, resultado: 'importada', idLocal: ID_B }
    ])
    // La dañada no deja carpeta a medias ni en la biblioteca ni en `.importando`.
    expect(e.biblioteca.obtenerResumen(ID_A)).toBeNull()
    expect(await readdir(e.biblio)).not.toContain(ID_A)
    expect(await readdir(join(e.biblio, '.importando'))).toEqual([])
  })

  it('bytes del audio alterados dentro del ZIP: esa canción falla y la otra entra', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, true, (entradas) => {
      const voz = entradas.find((x) => x.nombre.endsWith(`${ID_A}/pistas/voz.flac`))!
      voz.contenido = Buffer.from(voz.contenido)
      voz.contenido[voz.contenido.length - 1]! ^= 0xff
    })
    const r = await importar(e, ruta)
    expect(r.resultados[0]).toEqual({ id: ID_A, resultado: 'error', motivo: 'PAQUETE_INCOMPLETO' })
    expect(r.resultados[1]).toMatchObject({ id: ID_B, resultado: 'importada' })
  })

  it('tamaño del manifiesto distinto del real, o archivo declarado que falta: INCOMPLETO solo en esa', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, true, (entradas, m) => {
      m.canciones[0]!.archivos.find((a) => a.ruta.endsWith('mezcla.flac'))!.bytes += 1
      return entradas.filter((x) => !x.nombre.endsWith(`${ID_B}/fuente/mezcla.flac`))
    })
    const r = await importar(e, ruta)
    expect(r.resultados.map((x) => [x.id, x.resultado, x.motivo])).toEqual([
      [ID_A, 'error', 'PAQUETE_INCOMPLETO'],
      [ID_B, 'error', 'PAQUETE_INCOMPLETO']
    ])
    expect(e.biblioteca.listar()).toEqual([])
  })

  it('canción de un esquema más nuevo (en el manifiesto o en su cancion.json): omitida con CANCION_MAS_NUEVA', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, false, (_, m) => {
      m.canciones[0]!.esquema_cancion = 2
    })
    const r = await importar(e, ruta)
    expect(r.resultados[0]).toEqual({ id: ID_A, resultado: 'omitida', motivo: 'CANCION_MAS_NUEVA' })
    expect(r.resultados[1]).toMatchObject({ id: ID_B, resultado: 'importada' })

    // Solo el `cancion.json` dice esquema 2 (con su SHA bien puesto en el manifiesto).
    const e2 = await nuevo()
    const ruta2 = await paquete(e2, false, (entradas, m) => {
      const json = entradas.find((x) => x.nombre === `canciones/${ID_A}/cancion.json`)!
      const c = JSON.parse(json.contenido.toString()) as { esquema: number }
      c.esquema = 2
      json.contenido = Buffer.from(JSON.stringify(c))
      const a = m.canciones[0]!.archivos.find((x) => x.ruta.endsWith('cancion.json'))!
      a.bytes = json.contenido.length
      // sha256 del nuevo contenido
      a.sha256 = createHash('sha256').update(json.contenido).digest('hex')
    })
    const r2 = await importar(e2, ruta2)
    expect(r2.resultados[0]).toEqual({
      id: ID_A,
      resultado: 'omitida',
      motivo: 'CANCION_MAS_NUEVA'
    })
  })

  it('un cancion.json con la forma equivocada y su SHA correcto: error PAQUETE_NO_VALIDO', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, false, (entradas, m) => {
      const json = entradas.find((x) => x.nombre === `canciones/${ID_B}/cancion.json`)!
      json.contenido = Buffer.from('{"esquema":1,"id":"' + ID_B + '"}')
      const a = m.canciones[1]!.archivos.find((x) => x.ruta.endsWith('cancion.json'))!
      a.bytes = json.contenido.length
      a.sha256 = createHash('sha256').update(json.contenido).digest('hex')
    })
    const r = await importar(e, ruta)
    expect(r.resultados[1]).toEqual({ id: ID_B, resultado: 'error', motivo: 'PAQUETE_NO_VALIDO' })
    expect(r.resultados[0]).toMatchObject({ id: ID_A, resultado: 'importada' })
    const c = await leerCancionDeDisco(e.biblio, ID_A)
    expect(c.metadatos.titulo).toBe('Luna de papel')
  })

  it('entrada comprimida cuyo tamaño real supera al declarado: esa canción falla y no hay excepción sin capturar', async () => {
    const e = await nuevo()
    const sinCapturar: unknown[] = []
    const alExcepcion = (err: unknown): void => void sinCapturar.push(err)
    process.on('uncaughtException', alExcepcion)
    try {
      const ruta = await paquete(e, true, (entradas, m) => {
        const voz = entradas.find((x) => x.nombre.endsWith(`${ID_A}/pistas/voz.flac`))!
        voz.contenido = Buffer.alloc(2 * 1024 * 1024) // ceros: deflate los reduce a casi nada
        voz.comprimir = true
        const a = m.canciones[0]!.archivos.find((x) => x.ruta.endsWith('voz.flac'))!
        a.bytes = 4096
        a.sha256 = createHash('sha256').update(Buffer.alloc(4096)).digest('hex')
      })
      // Se rebaja el tamaño declarado en el directorio central (offset 24 de la entrada).
      const bytes = await readFile(ruta)
      const nombre = Buffer.from(`canciones/${ID_A}/pistas/voz.flac`)
      let parcheadas = 0
      for (let i = bytes.indexOf(nombre); i !== -1; i = bytes.indexOf(nombre, i + 1)) {
        if (i >= 46 && bytes.readUInt32LE(i - 46) === 0x02014b50) {
          bytes.writeUInt32LE(4096, i - 46 + 24)
          parcheadas++
        }
      }
      expect(parcheadas).toBe(1)
      await writeFile(ruta, bytes)
      const r = await importar(e, ruta)
      expect(r.resultados[0]).toEqual({
        id: ID_A,
        resultado: 'error',
        motivo: 'PAQUETE_INCOMPLETO'
      })
      expect(r.resultados[1]).toMatchObject({ id: ID_B, resultado: 'importada' })
      expect(await readdir(join(e.biblio, '.importando'))).toEqual([])
      await new Promise((ok) => setTimeout(ok, 50))
      expect(sinCapturar).toEqual([])
    } finally {
      process.off('uncaughtException', alExcepcion)
    }
  })

  it('cancelar la importación: lo restante se omite con CANCELADO y no queda nada a medias', async () => {
    const e = await nuevo()
    const ruta = await paquete(e, true)
    const o = await leer(e, ruta)
    const { trabajoId } = await e.copias.importar({
      origenId: o.origenId,
      conflictos: 'omitir',
      ajustes: false
    })
    e.copias.cancelar(trabajoId)
    const fin = await esperarFin(e, trabajoId)
    expect(fin.estado).toBe('cancelada')
    const r = fin.resultado as ResultadoImportacionIpc
    for (const x of r.resultados) {
      if (x.resultado !== 'importada') expect(['CANCELADO']).toContain(x.motivo)
    }
    expect(await readdir(join(e.biblio, '.importando')).catch(() => [])).toEqual([])
    for (const c of e.biblioteca.listar()) expect(c.danada).toBe(false)
  })

  it('una carpeta de biblioteca aparte para el paquete: sin efectos fuera de ella', async () => {
    const e = await nuevo()
    await mkdir(join(e.datos, 'extra'), { recursive: true })
    const antes = await readdir(e.datos)
    const ruta = await paquete(e, false)
    await importar(e, ruta)
    expect((await readdir(e.datos)).sort()).toEqual(antes.sort())
  })
})
