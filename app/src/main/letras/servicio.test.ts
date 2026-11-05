import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cancionSchema, type ElementoLetra } from '../../shared'
import { ServicioBiblioteca } from '../biblioteca'
import type { EventoCancion } from '../biblioteca/operaciones'
import { ServicioSeparacion } from '../separacion/servicio'
import {
  cancionConFuente,
  configEnMemoria,
  manifiesto,
  nuevoDirDatos
} from '../separacion/servicio.testutil'
import { GestorTrabajos, type EjecutarWorker } from '../trabajos'
import { ServicioLetras } from './servicio'

let datos: string
let biblioteca: ServicioBiblioteca
let eleccion: { canceled: boolean; filePaths: string[] }
let servicio: ServicioLetras
let eventos: EventoCancion[]

const el = (id: string, texto: string, inicio: number | null = null): ElementoLetra => ({
  id,
  tipo: 'linea',
  texto,
  inicio_ms: inicio,
  fin_ms: null,
  palabras: null
})

beforeEach(async () => {
  datos = await nuevoDirDatos()
  biblioteca = new ServicioBiblioteca(datos)
  eventos = []
  biblioteca.suscribir((e) => eventos.push(e))
  eleccion = { canceled: true, filePaths: [] }
  servicio = new ServicioLetras({
    biblioteca,
    dialogo: { showOpenDialog: () => Promise.resolve(eleccion) },
    debounceEdicionMs: 5
  })
})
afterEach(async () => {
  await biblioteca.flushTodo()
  await rm(datos, { recursive: true, force: true })
})

const enDisco = async (id: string) =>
  cancionSchema.parse(
    JSON.parse(await readFile(join(datos, 'biblioteca', id, 'cancion.json'), 'utf8'))
  )

describe('guardar', () => {
  it.each([
    ['lrclib', 42],
    ['manual', null],
    ['archivo', null]
  ] as const)('origen %s: letra válida, paso completado y evento', async (origen, lrclib_id) => {
    const id = await cancionConFuente(biblioteca, datos)
    eventos.length = 0
    await servicio.guardar({
      cancionId: id,
      origen,
      lrclib_id,
      lineas: [el('x', 'Hola mundo', 1000), el('y', 'Adiós', 3000)]
    })
    const c = await enDisco(id)
    expect(c.letra).toMatchObject({ origen, lrclib_id, offset_ms: 0 })
    expect(c.letra?.lineas.map((l) => l.texto)).toEqual(['Hola mundo', 'Adiós'])
    expect(c.letra?.lineas.map((l) => l.id)).not.toContain('x')
    expect(c.pasos.letra.estado).toBe('completado')
    expect(c.pasos.letra.actualizado).not.toBeNull()
    expect(eventos.length).toBeGreaterThan(0)
  })

  it('sustituye una letra con sincronía y deja la canción lista como lista', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    await servicio.guardar({
      cancionId: id,
      origen: 'manual',
      lrclib_id: null,
      lineas: [el('a', 'Uno', 1000)]
    })
    await servicio.guardar({
      cancionId: id,
      origen: 'manual',
      lrclib_id: null,
      lineas: [el('b', 'Dos'), el('c', 'Tres')]
    })
    const c = await enDisco(id)
    expect(c.letra?.lineas.map((l) => l.texto)).toEqual(['Dos', 'Tres'])
    expect(c.letra?.lineas.every((l) => l.inicio_ms === null)).toBe(true)
  })

  it('rechaza canción inexistente, fuente sin completar y letra sin líneas', async () => {
    await expect(
      servicio.guardar({
        cancionId: 'nope',
        origen: 'manual',
        lrclib_id: null,
        lineas: [el('a', 'x')]
      })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    const id = await cancionConFuente(biblioteca, datos)
    await biblioteca.actualizar(id, { pasos: { fuente: { estado: 'pendiente' } } })
    await expect(
      servicio.guardar({ cancionId: id, origen: 'manual', lrclib_id: null, lineas: [el('a', 'x')] })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    await biblioteca.actualizar(id, { pasos: { fuente: { estado: 'completado' } } })
    await expect(
      servicio.guardar({
        cancionId: id,
        origen: 'manual',
        lrclib_id: null,
        lineas: [el('a', '  ')]
      })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
  })

  it('no pisa el progreso ni el resultado de una separación en curso', async () => {
    const config = configEnMemoria()
    const llamadas: { alProgreso: (m: never) => void; resolver: () => void }[] = []
    const ejecutar: EjecutarWorker = (_c, args, op) =>
      new Promise((resolver) => {
        llamadas.push({
          alProgreso: (m) => op.alProgreso?.(m),
          resolver: () => {
            void (async () => {
              const dir = args.salida_dir as string
              await mkdir(dir, { recursive: true })
              await writeFile(join(dir, 'voz.flac'), 'v')
              await writeFile(join(dir, 'instrumental.flac'), 'i')
              resolver({
                voz: 'voz.flac',
                instrumental: 'instrumental.flac',
                modelo: { id: 'calidad', archivo: 'm.ckpt', version_audio_separator: '0.48.0' },
                dispositivo: 'cpu',
                segundos_separando: 1,
                segundos_total: 2
              })
            })()
          }
        })
      })
    const gestor = new GestorTrabajos({ biblioteca, ejecutar })
    const separacion = new ServicioSeparacion({
      biblioteca,
      gestor,
      config,
      manifiesto: () => manifiesto,
      dirDatos: datos,
      estimarSeparacion: () => null
    })
    const id = await cancionConFuente(biblioteca, datos)
    await separacion.separar(id)
    const espera = Date.now() + 5000
    while (llamadas.length === 0 && Date.now() < espera) await new Promise((r) => setTimeout(r, 10))
    llamadas[0]!.alProgreso({ tipo: 'progreso', fase: 'separando', valor: 0.5 } as never)
    await servicio.guardar({
      cancionId: id,
      origen: 'manual',
      lrclib_id: null,
      lineas: [el('a', 'Hola')]
    })
    llamadas[0]!.alProgreso({ tipo: 'progreso', fase: 'separando', valor: 0.9 } as never)
    expect(biblioteca.obtener(id)?.pasos.separacion.estado).toBe('en_curso')
    expect(biblioteca.obtener(id)?.pasos.letra.estado).toBe('completado')
    llamadas[0]!.resolver()
    while (
      biblioteca.obtener(id)?.pasos.separacion.estado !== 'completado' &&
      Date.now() < espera
    ) {
      await new Promise((r) => setTimeout(r, 10))
    }
    await biblioteca.flushTodo()
    const c = await enDisco(id)
    expect(c.pasos.separacion.estado).toBe('completado')
    expect(c.pistas).not.toBeNull()
    expect(c.letra?.lineas[0]?.texto).toBe('Hola')
    expect(c.pasos.letra.estado).toBe('completado')
    separacion.cerrar()
    await gestor.cancelarTodos()
  })
})

describe('editarTexto', () => {
  const base = async () => {
    const id = await cancionConFuente(biblioteca, datos)
    await servicio.guardar({
      cancionId: id,
      origen: 'manual',
      lrclib_id: null,
      lineas: [el('a', 'Uno', 1000), el('b', 'Dos', 2000), el('c', 'Tres', 3000)]
    })
    return id
  }

  it('conserva ids y tiempos de las líneas que no cambian', async () => {
    const id = await base()
    const antes = (await enDisco(id)).letra!.lineas
    await servicio.editarTexto({ cancionId: id, texto: 'Uno\nDos\nTres y más' })
    await biblioteca.flushTodo()
    const despues = (await enDisco(id)).letra!.lineas
    expect(despues.map((l) => l.id).slice(0, 2)).toEqual(antes.slice(0, 2).map((l) => l.id))
    expect(despues.map((l) => l.inicio_ms)).toEqual([1000, 2000, null])
    expect(despues[2]!.texto).toBe('Tres y más')
  })

  it('dos llamadas seguidas se aplican en orden', async () => {
    const id = await base()
    const p1 = servicio.editarTexto({ cancionId: id, texto: 'Uno\nDos' })
    const p2 = servicio.editarTexto({ cancionId: id, texto: 'Uno\nDos\nCuatro' })
    await Promise.all([p1, p2])
    await biblioteca.flushTodo()
    expect((await enDisco(id)).letra!.lineas.map((l) => l.texto)).toEqual(['Uno', 'Dos', 'Cuatro'])
  })

  it('si el resultado es idéntico no escribe', async () => {
    const id = await base()
    await biblioteca.flushTodo()
    eventos.length = 0
    await servicio.editarTexto({ cancionId: id, texto: 'Uno\nDos\nTres' })
    await biblioteca.flushTodo()
    expect(eventos).toEqual([])
  })

  it('cero líneas en borrador: se guarda y el paso pasa a pendiente', async () => {
    const id = await base()
    await servicio.editarTexto({ cancionId: id, texto: '' })
    await biblioteca.flushTodo()
    const c = await enDisco(id)
    expect(c.letra?.lineas).toEqual([])
    expect(c.pasos.letra.estado).toBe('pendiente')
  })

  it('cero líneas en una canción lista: se rechaza sin escribir', async () => {
    const id = await base()
    biblioteca.obtener(id)
    // Se fuerza `lista` sin pasar por las comprobaciones de marcarLista (fuera del alcance de esta prueba).
    const ruta = join(datos, 'biblioteca', id, 'cancion.json')
    await biblioteca.flushTodo()
    const json = JSON.parse(await readFile(ruta, 'utf8'))
    json.estado = 'lista'
    await writeFile(ruta, JSON.stringify(json))
    await biblioteca.escanear()
    expect(biblioteca.obtener(id)?.estado).toBe('lista')
    eventos.length = 0
    await expect(servicio.editarTexto({ cancionId: id, texto: '  \n' })).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    expect(eventos).toEqual([])
    expect(biblioteca.obtener(id)?.letra?.lineas).toHaveLength(3)
  })
})

describe('leerArchivo', () => {
  const escribir = async (nombre: string, contenido: Buffer | string): Promise<void> => {
    const ruta = join(datos, nombre)
    await writeFile(ruta, contenido)
    eleccion = { canceled: false, filePaths: [ruta] }
  }

  it('cancelado', async () => {
    expect(await servicio.leerArchivo()).toEqual({ cancelado: true })
  })

  it('UTF-8 con BOM, y no escribe en la canción', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    await escribir(
      'a.txt',
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Hola\nmundo')])
    )
    const r = await servicio.leerArchivo()
    expect(r).toMatchObject({ cancelado: false, nombre: 'a.txt', sincronia: 'texto', ignoradas: 0 })
    if (!r.cancelado) expect(r.lineas.map((l) => l.texto)).toEqual(['Hola', 'mundo'])
    expect(biblioteca.obtener(id)?.letra).toBeNull()
  })

  it('UTF-16 LE y BE con BOM', async () => {
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('canción', 'utf16le')])
    await escribir('le.txt', le)
    let r = await servicio.leerArchivo()
    if (!r.cancelado) expect(r.lineas[0]?.texto).toBe('canción')
    const be = Buffer.from(le.subarray(2))
    be.swap16()
    await escribir('be.txt', Buffer.concat([Buffer.from([0xfe, 0xff]), be]))
    r = await servicio.leerArchivo()
    if (!r.cancelado) expect(r.lineas[0]?.texto).toBe('canción')
    expect(r.cancelado).toBe(false)
  })

  it('Windows-1252 cuando no es UTF-8 válido', async () => {
    await escribir('w.txt', Buffer.from([0x63, 0x61, 0x6e, 0x63, 0x69, 0xf3, 0x6e]))
    const r = await servicio.leerArchivo()
    if (!r.cancelado) expect(r.lineas[0]?.texto).toBe('canción')
    expect(r.cancelado).toBe(false)
  })

  it('binario, vacío y demasiado grande → ARCHIVO_SIN_LETRA', async () => {
    await escribir('b.txt', Buffer.from([0x89, 0x50, 0x00, 0x47, 0x0d, 0x0a]))
    await expect(servicio.leerArchivo()).rejects.toMatchObject({ codigo: 'ARCHIVO_SIN_LETRA' })
    await escribir('v.txt', '')
    await expect(servicio.leerArchivo()).rejects.toMatchObject({ codigo: 'ARCHIVO_SIN_LETRA' })
    await escribir('g.txt', 'a\n'.repeat(300 * 1024))
    await expect(servicio.leerArchivo()).rejects.toMatchObject({ codigo: 'ARCHIVO_SIN_LETRA' })
    eleccion = { canceled: false, filePaths: [join(datos, 'no-existe.txt')] }
    await expect(servicio.leerArchivo()).rejects.toMatchObject({ codigo: 'ARCHIVO_SIN_LETRA' })
  })

  it('un .txt que es LRC se detecta por el contenido', async () => {
    await escribir('l.txt', '[00:01.00]Hola\n[00:03.00]Mundo\n')
    const r = await servicio.leerArchivo()
    expect(r).toMatchObject({ cancelado: false, sincronia: 'linea', ignoradas: 0 })
  })

  it('LRC con 2 renglones de texto sin marca → ignoradas: 2; texto plano → 0', async () => {
    await escribir('l.lrc', '[00:01.00]Hola\nsuelto uno\n[00:03.00]Mundo\nsuelto dos\n')
    const r = await servicio.leerArchivo()
    expect(r).toMatchObject({ cancelado: false, ignoradas: 2 })
    await escribir('p.txt', 'Hola\nmundo\n')
    expect(await servicio.leerArchivo()).toMatchObject({ ignoradas: 0 })
  })
})
