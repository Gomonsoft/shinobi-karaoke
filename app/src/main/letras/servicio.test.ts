import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aPeticionTiempos, cancionSchema, type ElementoLetra } from '../../shared'
import { pausa } from '../../shared/__fixtures__'
import { silencioFlac } from '../biblioteca/flac'
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

  it('guarda la letra mientras la fuente de YouTube sigue descargándose', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    await biblioteca.actualizar(id, { pasos: { fuente: { estado: 'en_curso', progreso: 0.4 } } })

    await servicio.guardar({
      cancionId: id,
      origen: 'lrclib',
      lrclib_id: 42,
      lineas: [el('a', 'Una línea inventada')]
    })

    const c = await enDisco(id)
    expect(c.pasos.fuente.estado).toBe('en_curso')
    expect(c.pasos.letra.estado).toBe('completado')
    expect(c.letra?.lineas.map((linea) => linea.texto)).toEqual(['Una línea inventada'])
  })

  it('rechaza canción inexistente y letra sin líneas', async () => {
    await expect(
      servicio.guardar({
        cancionId: 'nope',
        origen: 'manual',
        lrclib_id: null,
        lineas: [el('a', 'x')]
      })
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    const id = await cancionConFuente(biblioteca, datos)
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

describe('guardarTiempos en una visita', () => {
  async function abrir(inicios = true) {
    const id = await cancionConFuente(biblioteca, datos, { mezcla: silencioFlac() })
    const a = el('a', 'Canta el río', inicios ? 1000 : null)
    if (inicios) a.palabras = [{ texto: 'Canta', inicio_ms: 1050, fin_ms: 1250 }]
    await servicio.guardar({
      cancionId: id,
      origen: 'lrclib',
      lrclib_id: 32,
      lineas: [
        a,
        pausa('pausa', inicios ? 3000 : null),
        el('b', 'El aire vuelve', inicios ? 5000 : null)
      ]
    })
    const { cancion, sesionId } = servicio.abrirEdicion(id)!
    const peticion = aPeticionTiempos(id, cancion.letra!)
    return { id, peticion, sesionId }
  }

  it('dos envíos seguidos conservan texto y origen, y gana el último desplazamiento', async () => {
    const { id, peticion, sesionId } = await abrir()
    const tiempos = structuredClone(peticion.tiempos)
    tiempos[0]!.inicio_ms = 1500
    tiempos[0]!.palabras = [{ texto: 'Canta', inicio_ms: 1550, fin_ms: 1750 }]
    await Promise.all([
      servicio.guardarTiempos({ ...peticion, tiempos }, sesionId),
      servicio.guardarTiempos({ ...peticion, offset_ms: -250, tiempos }, sesionId)
    ])
    const { letra } = await enDisco(id)
    expect(letra).toMatchObject({
      origen: 'lrclib',
      lrclib_id: 32,
      offset_ms: -250,
      lineas: [
        { texto: 'Canta el río', inicio_ms: 1500, palabras: tiempos[0]!.palabras },
        { tipo: 'pausa', inicio_ms: 3000 },
        { texto: 'El aire vuelve' }
      ]
    })
  })

  it('restaura palabras y pausas originales después de guardar su borrado', async () => {
    const { id, peticion, sesionId } = await abrir()
    const tiempos = peticion.tiempos.map((t, i) =>
      i < 2 ? { ...t, inicio_ms: null, fin_ms: null, palabras: null } : t
    )
    await servicio.guardarTiempos({ ...peticion, tiempos }, sesionId)
    expect((await enDisco(id)).letra?.lineas[0]).toMatchObject({ inicio_ms: null, palabras: null })
    expect((await enDisco(id)).letra?.lineas[1]?.inicio_ms).toBeNull()
    await servicio.guardarTiempos(peticion, sesionId)
    expect(aPeticionTiempos(id, (await enDisco(id)).letra!)).toEqual(peticion)
  })

  it('rechaza ids, longitud, orden y sesiones que ya no coinciden', async () => {
    const { id, peticion, sesionId } = await abrir()
    const caduca = { codigo: 'LETRA_DESACTUALIZADA' }
    const tiempos = peticion.tiempos
    for (const alterados of [
      tiempos.slice(1),
      tiempos.map((t, i) => (i === 0 ? { ...t, id: 'otro' } : t)),
      tiempos.toReversed()
    ]) {
      await expect(
        servicio.guardarTiempos({ ...peticion, tiempos: alterados }, sesionId)
      ).rejects.toMatchObject(caduca)
    }
    const nueva = servicio.abrirEdicion(id)!
    servicio.cerrarEdicion(sesionId)
    await expect(servicio.guardarTiempos(peticion, sesionId)).rejects.toMatchObject(caduca)
    await expect(servicio.guardarTiempos(peticion, nueva.sesionId)).resolves.toMatchObject({ id })
    servicio.cerrarEdicion(nueva.sesionId)
    await expect(servicio.guardarTiempos(peticion, nueva.sesionId)).rejects.toMatchObject(caduca)

    const sinLetra = await cancionConFuente(biblioteca, datos)
    const sesionVacia = servicio.abrirEdicion(sinLetra)!.sesionId
    await expect(
      servicio.guardarTiempos(
        {
          cancionId: sinLetra,
          offset_ms: 0,
          tiempos: []
        },
        sesionVacia
      )
    ).rejects.toMatchObject(caduca)
    await expect(
      servicio.guardarTiempos(
        {
          cancionId: 'inexistente',
          offset_ms: 0,
          tiempos: []
        },
        sesionVacia
      )
    ).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
  })

  it('rechaza palabras nuevas, movidas individualmente, pausas alteradas e inicios no crecientes', async () => {
    const { id, peticion, sesionId } = await abrir()
    const [a, p, b] = peticion.tiempos
    const casos = [
      [{ ...a!, palabras: [{ texto: 'Otro', inicio_ms: 1050, fin_ms: 1250 }] }, p!, b!],
      [{ ...a!, palabras: [{ texto: 'Canta', inicio_ms: 1051, fin_ms: 1250 }] }, p!, b!],
      [a!, p!, { ...b!, palabras: [{ texto: 'El', inicio_ms: 5000, fin_ms: 5100 }] }],
      [a!, { ...p!, inicio_ms: 3100 }, b!],
      [a!, p!, { ...b!, inicio_ms: 3000 }]
    ]
    const original = await enDisco(id)
    for (const tiempos of casos) {
      await expect(
        servicio.guardarTiempos({ ...peticion, tiempos }, sesionId)
      ).rejects.toMatchObject({
        codigo: 'ARGUMENTOS_NO_VALIDOS'
      })
    }
    expect(await enDisco(id)).toEqual(original)
  })

  it('conserva la visita con texto idéntico y la invalida si cambia el texto', async () => {
    const { id, peticion, sesionId } = await abrir()
    const actualizar = vi.spyOn(biblioteca, 'actualizar')
    await servicio.editarTexto({ cancionId: id, texto: 'Canta el río\n\nEl aire vuelve' })
    await servicio.guardarTiempos(peticion, sesionId)
    expect(actualizar).not.toHaveBeenCalled()
    await servicio.editarTexto({ cancionId: id, texto: 'Canta el río\n\nCambia el viento' })
    await expect(servicio.guardarTiempos(peticion, sesionId)).rejects.toMatchObject({
      codigo: 'LETRA_DESACTUALIZADA'
    })
  })

  it('escribe antes de marcar como lista y conserva el estado al quitar un inicio', async () => {
    const { id, peticion, sesionId } = await abrir(false)
    const carpeta = join(datos, 'biblioteca', id, 'pistas')
    await mkdir(carpeta, { recursive: true })
    for (const pista of ['voz', 'instrumental'])
      await writeFile(join(carpeta, `${pista}.flac`), silencioFlac())
    await biblioteca.actualizar(id, {
      pistas: {
        voz: 'pistas/voz.flac',
        instrumental: 'pistas/instrumental.flac',
        modelo: {
          perfil: 'calidad',
          nombre: 'prueba',
          version: '1'
        }
      },
      pasos: { separacion: { estado: 'completado', actualizado: null, error: null } }
    })
    const tiempos = peticion.tiempos.map((t, i) => ({
      ...t,
      inicio_ms: i === 1 ? null : 1000 * (i + 1)
    }))
    const guardado = servicio.guardarTiempos({ ...peticion, tiempos }, sesionId)
    await Promise.all([guardado, biblioteca.marcarLista(id)])
    await biblioteca.flushTodo()
    expect((await enDisco(id)).estado).toBe('lista')
    expect(aPeticionTiempos(id, (await enDisco(id)).letra!).tiempos).toEqual(tiempos)
    const resultado = await servicio.guardarTiempos(peticion, sesionId)
    expect(resultado).toMatchObject({ estado: 'lista', incompleta: true })
  })

  it('mantiene el progreso de separación cuando se intercala con el guardado', async () => {
    const { id, peticion, sesionId } = await abrir()
    const progreso = (p: number) =>
      biblioteca.actualizar(id, {
        pasos: { separacion: { estado: 'en_curso', actualizado: null, progreso: p, error: null } }
      })
    await progreso(0.42)
    await Promise.all([
      servicio.guardarTiempos({ ...peticion, offset_ms: 300 }, sesionId),
      progreso(0.6),
      servicio.guardarTiempos({ ...peticion, offset_ms: 400 }, sesionId)
    ])
    const cancion = await enDisco(id)
    expect(cancion.letra?.offset_ms).toBe(400)
    expect(cancion.pasos.separacion).toMatchObject({ estado: 'en_curso', progreso: 0.6 })
  })
})
