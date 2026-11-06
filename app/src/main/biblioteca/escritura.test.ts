import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIXTURES } from '../../shared/__fixtures__'
import { ESTILO_PREDETERMINADO, type Cancion, type Estilo } from '../../shared'
import { silencioFlac } from './flac'
import { ErrorBiblioteca, type DatosNuevaCancion, type EventoCancion } from './operaciones'
import { ServicioBiblioteca } from './servicio'
import { writeFile } from 'node:fs/promises'

let datos: string
let biblio: string
let eventos: EventoCancion[]
const shell = {
  trashItem: vi.fn<(ruta: string) => Promise<void>>(async () => undefined),
  openPath: vi.fn<(ruta: string) => Promise<string>>(async () => '')
}
const estiloConfig: Estilo = {
  ...ESTILO_PREDETERMINADO,
  fondo: { tipo: 'solido', color: '#112233' }
} as Estilo

beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-escritura-'))
  biblio = join(datos, 'biblioteca')
  await mkdir(join(biblio, '.importando'), { recursive: true })
  eventos = []
  shell.trashItem.mockReset().mockResolvedValue(undefined)
  shell.openPath.mockReset().mockResolvedValue('')
})
afterEach(async () => {
  await rm(datos, { recursive: true, force: true })
})

function servicio(): ServicioBiblioteca {
  const s = new ServicioBiblioteca(datos, { shell, estiloPredeterminado: () => estiloConfig })
  s.suscribir((e) => eventos.push(e))
  return s
}

function datosNuevos(): DatosNuevaCancion {
  const b = FIXTURES.borradorRecienCreado()
  return {
    metadatos: b.metadatos,
    fuente: b.fuente,
    pasos: { fuente: b.pasos.fuente }
  }
}

async function leerDisco(id: string): Promise<Cancion> {
  return JSON.parse(await readFile(join(biblio, id, 'cancion.json'), 'utf8')) as Cancion
}

async function cancionLista(s: ServicioBiblioteca): Promise<string> {
  const f = FIXTURES.lista()
  const r = await s.crear({
    metadatos: f.metadatos,
    fuente: f.fuente,
    pistas: f.pistas,
    letra: f.letra,
    pasos: f.pasos
  })
  const carpeta = join(biblio, r.id, 'pistas')
  await mkdir(carpeta, { recursive: true })
  await writeFile(join(carpeta, 'voz.flac'), silencioFlac(1))
  await writeFile(join(carpeta, 'instrumental.flac'), silencioFlac(1))
  await s.marcarLista(r.id)
  return r.id
}

describe('comprobarPistas', () => {
  it.each(['instrumental.flac', 'voz.flac'])('detecta que falta %s sin escribir', async (pista) => {
    const s = servicio()
    const id = await cancionLista(s)
    const cancionJson = join(biblio, id, 'cancion.json')
    const antes = await readFile(cancionJson, 'utf8')
    eventos.length = 0
    await rm(join(biblio, id, 'pistas', pista))

    const resumen = await s.comprobarPistas(id)
    expect(resumen).toMatchObject({ estado: 'lista', danada: true, motivo: 'pistas' })
    expect(s.obtenerResumen(id)).toEqual(resumen)
    expect(await s.comprobarPistas(id)).toEqual(resumen)
    expect(eventos).toEqual([{ id, resumen }])
    expect(await readFile(cancionJson, 'utf8')).toBe(antes)

    await writeFile(join(biblio, id, 'pistas', pista), silencioFlac(1))
    expect(await s.comprobarPistas(id)).toMatchObject({ estado: 'lista', danada: false })
    expect(eventos).toHaveLength(2)
  })

  it('devuelve null sin emitir si la canción no existe o tiene JSON ilegible', async () => {
    const s = servicio()
    const id = 'danada'
    await mkdir(join(biblio, id))
    await writeFile(join(biblio, id, 'cancion.json'), '{')
    await s.escanear()
    expect(await s.comprobarPistas(id)).toBeNull()
    expect(await s.comprobarPistas('ausente')).toBeNull()
    expect(eventos).toEqual([])
  })
})

describe('importación preparada', () => {
  it('prepara, materializa de forma atómica y emite el evento', async () => {
    const s = servicio()
    const { id, ruta } = await s.prepararImportacion()
    expect(ruta).toBe(join(biblio, '.importando', id))
    await mkdir(join(ruta, 'fuente'))
    await writeFile(join(ruta, 'fuente', 'mezcla.flac'), silencioFlac(1))

    // Antes del renombrado la canción no aparece en el escaneo.
    expect(await s.escanear()).toEqual([])

    const resumen = await s.materializar(id, datosNuevos())
    expect(resumen).toMatchObject({ id, estado: 'borrador', danada: false })
    const c = await leerDisco(id)
    expect(c.estilo).toEqual(estiloConfig)
    expect(c.pasos.fuente.estado).toBe('completado')
    expect(c.pasos.separacion.estado).toBe('pendiente')
    await expect(stat(ruta)).rejects.toThrow()
    expect((await s.escanear()).map((r) => r.id)).toEqual([id])
    expect(eventos).toEqual([{ id, resumen }])
  })

  it('si el destino existe, falla sin tocar nada', async () => {
    const s = servicio()
    const { id, ruta } = await s.prepararImportacion()
    await mkdir(join(biblio, id))
    await expect(s.materializar(id, datosNuevos())).rejects.toBeInstanceOf(ErrorBiblioteca)
    expect(await readdir(ruta)).toEqual([])
    expect(await readdir(join(biblio, id))).toEqual([])
    expect(eventos).toEqual([])
  })

  it('materializar sin preparación o con datos inválidos falla', async () => {
    const s = servicio()
    await expect(s.materializar('no-existe', datosNuevos())).rejects.toThrow(ErrorBiblioteca)
    const { id, ruta } = await s.prepararImportacion()
    const malos = datosNuevos()
    malos.metadatos.duracion_ms = -1
    await expect(s.materializar(id, malos)).rejects.toThrow(ErrorBiblioteca)
    expect(await readdir(ruta)).toEqual([])
  })

  it('descartar no deja restos', async () => {
    const s = servicio()
    const { id, ruta } = await s.prepararImportacion()
    await writeFile(join(ruta, 'x.bin'), 'x')
    await s.descartarImportacion(id)
    expect(await readdir(join(biblio, '.importando'))).toEqual([])
    await s.descartarImportacion(id)
  })
})

describe('crear', () => {
  it('crea biblioteca/<id>/cancion.json y la indexa', async () => {
    const s = servicio()
    const r = await s.crear(datosNuevos())
    expect((await leerDisco(r.id)).id).toBe(r.id)
    expect(s.obtener(r.id)?.estilo).toEqual(estiloConfig)
    expect(s.listar()).toHaveLength(1)
    expect(eventos).toHaveLength(1)
  })

  it('rechaza un id repetido o inseguro', async () => {
    const s = servicio()
    await s.crear(datosNuevos(), 'a')
    await expect(s.crear(datosNuevos(), 'a')).rejects.toThrow(ErrorBiblioteca)
    await expect(s.crear(datosNuevos(), '../x')).rejects.toThrow(ErrorBiblioteca)
    await expect(s.crear(datosNuevos(), '.importando')).rejects.toThrow(ErrorBiblioteca)
  })
})

describe('actualizar', () => {
  it('aplica el cambio, actualiza modificada, escribe y emite', async () => {
    let t = 0
    const s = new ServicioBiblioteca(datos, {
      shell,
      ahora: () => new Date(Date.UTC(2026, 10, 4, 0, 0, t++))
    })
    s.suscribir((e) => eventos.push(e))
    const { id, modificada } = await s.crear(datosNuevos())
    const r = await s.actualizar(id, {
      metadatos: { titulo: 'Nuevo' },
      pasos: { letra: { estado: 'en_curso', progreso: 0.5, actualizado: '2026-11-04T00:00:00Z' } }
    })
    expect(r.titulo).toBe('Nuevo')
    expect(r.pasos?.letra.progreso).toBe(0.5)
    expect(r.modificada > modificada).toBe(true)
    const c = await leerDisco(id)
    expect(c.metadatos).toMatchObject({ titulo: 'Nuevo', artista: 'Artista' })
    expect(s.obtenerResumen(id)?.titulo).toBe('Nuevo')
    expect(eventos.at(-1)).toEqual({ id, resumen: r })
  })

  it('rechaza un cambio inválido sin escribir ni emitir', async () => {
    const s = servicio()
    const { id } = await s.crear(datosNuevos())
    const antes = await readFile(join(biblio, id, 'cancion.json'), 'utf8')
    const n = eventos.length
    await expect(s.actualizar(id, { metadatos: { duracion_ms: -5 } })).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    await expect(
      s.actualizar(id, {
        letra: {
          origen: 'manual',
          lrclib_id: null,
          offset_ms: 0,
          lineas: [
            { id: 'a', tipo: 'linea', texto: 'a', inicio_ms: 5000, fin_ms: null, palabras: null },
            { id: 'b', tipo: 'linea', texto: 'b', inicio_ms: 1000, fin_ms: null, palabras: null }
          ]
        }
      })
    ).rejects.toThrow(ErrorBiblioteca)
    expect(await readFile(join(biblio, id, 'cancion.json'), 'utf8')).toBe(antes)
    expect(s.obtener(id)?.metadatos.duracion_ms).toBe(215000)
    expect(eventos).toHaveLength(n)
  })

  it('canción inexistente o dañada: error', async () => {
    const s = servicio()
    await expect(s.actualizar('nada', {})).rejects.toThrow(ErrorBiblioteca)
    await mkdir(join(biblio, 'rota'))
    await writeFile(join(biblio, 'rota', 'cancion.json'), '{no')
    await s.escanear()
    await expect(s.actualizar('rota', {})).rejects.toThrow(ErrorBiblioteca)
  })

  it('agrupa con debounce: el índice ve el último valor y se escribe una vez', async () => {
    const s = servicio()
    const { id } = await s.crear(datosNuevos())
    const ps = [1, 2, 3].map((i) =>
      s.actualizar(id, { metadatos: { titulo: `T${i}` } }, { debounceMs: 30 })
    )
    expect(s.obtenerResumen(id)?.titulo).toBe('T3')
    await Promise.all(ps)
    expect((await leerDisco(id)).metadatos.titulo).toBe('T3')
  })

  it('flushTodo escribe lo pendiente', async () => {
    const s = servicio()
    const { id } = await s.crear(datosNuevos())
    const p = s.actualizar(id, { metadatos: { titulo: 'Pendiente' } }, { debounceMs: 60_000 })
    await s.flushTodo()
    await p
    expect((await leerDisco(id)).metadatos.titulo).toBe('Pendiente')
  })

  it('recalcula "dañada por pistas" al cambiar las pistas', async () => {
    const s = servicio()
    const id = await cancionLista(s)
    expect(s.obtenerResumen(id)?.danada).toBe(false)
    const r = await s.actualizar(id, {
      pistas: { ...s.obtener(id)!.pistas!, voz: 'pistas/otra.flac' }
    })
    expect(r).toMatchObject({ danada: true, motivo: 'pistas' })
  })
})

describe('estado lista / borrador', () => {
  it('marcarLista falla sin condiciones y no cambia nada', async () => {
    const s = servicio()
    const { id } = await s.crear(datosNuevos())
    await expect(s.marcarLista(id)).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    expect((await leerDisco(id)).estado).toBe('borrador')
  })

  it('marcarLista con condiciones pone estado lista y edición completada', async () => {
    const s = servicio()
    const id = await cancionLista(s)
    await s.volverABorrador(id)
    await s.actualizar(id, { pasos: { edicion: { estado: 'pendiente', actualizado: null } } })
    expect(s.obtener(id)!.pasos.edicion.estado).toBe('pendiente')
    const r = await s.marcarLista(id)
    expect(r.estado).toBe('lista')
    expect(r.pasos?.edicion.estado).toBe('completado')
    expect((await leerDisco(id)).estado).toBe('lista')
  })

  it('volverABorrador cambia solo el estado; actualizar nunca cambia estado', async () => {
    const s = servicio()
    const id = await cancionLista(s)
    const antes = s.obtener(id)!
    await s.actualizar(id, { metadatos: { titulo: 'Otro' } })
    expect(s.obtener(id)!.estado).toBe('lista')
    const r = await s.volverABorrador(id)
    expect(r.estado).toBe('borrador')
    const despues = s.obtener(id)!
    expect(despues.letra).toEqual(antes.letra)
    expect(despues.pasos).toEqual(antes.pasos)
    expect(despues.metadatos.titulo).toBe('Otro')
  })
})

describe('eliminar y mostrar en carpeta', () => {
  it('envía a la papelera, quita del índice y emite eliminada', async () => {
    const s = servicio()
    const { id } = await s.crear(datosNuevos())
    await s.eliminar(id)
    expect(shell.trashItem).toHaveBeenCalledWith(join(biblio, id))
    expect(s.obtenerResumen(id)).toBeNull()
    expect(eventos.at(-1)).toEqual({ id, eliminada: true })
  })

  it('espera a antesDeEliminar (cancelación de trabajos) antes de la papelera', async () => {
    const orden: string[] = []
    const antesDeEliminar = vi.fn(async () => {
      orden.push('antes')
    })
    shell.trashItem.mockImplementation(async () => void orden.push('papelera'))
    const s = new ServicioBiblioteca(datos, {
      shell,
      estiloPredeterminado: () => estiloConfig,
      antesDeEliminar
    })
    const { id } = await s.crear(datosNuevos())
    await s.eliminar(id)
    expect(antesDeEliminar).toHaveBeenCalledWith(id)
    expect(orden).toEqual(['antes', 'papelera'])
  })

  it('si la papelera falla, error y la canción sigue indexada', async () => {
    const s = servicio()
    const { id } = await s.crear(datosNuevos())
    shell.trashItem.mockRejectedValue(new Error('no'))
    await expect(s.eliminar(id)).rejects.toMatchObject({ codigo: 'ERROR_INTERNO' })
    expect(s.obtenerResumen(id)).not.toBeNull()
    expect(eventos).toHaveLength(1)
  })

  it('eliminar o mostrar una canción inexistente falla', async () => {
    const s = servicio()
    await expect(s.eliminar('x')).rejects.toThrow(ErrorBiblioteca)
    await expect(s.mostrarEnCarpeta('x')).rejects.toThrow(ErrorBiblioteca)
  })

  it('mostrarEnCarpeta abre la carpeta y propaga el error de openPath', async () => {
    const s = servicio()
    const { id } = await s.crear(datosNuevos())
    await s.mostrarEnCarpeta(id)
    expect(shell.openPath).toHaveBeenCalledWith(join(biblio, id))
    shell.openPath.mockResolvedValue('fallo')
    await expect(s.mostrarEnCarpeta(id)).rejects.toThrow(ErrorBiblioteca)
    await expect(s.mostrarEnCarpeta(id)).rejects.not.toThrow(/fallo/)
  })

  it('sin shell, las operaciones de sistema fallan con error', async () => {
    const s = new ServicioBiblioteca(datos)
    const { id } = await s.crear(datosNuevos())
    await expect(s.eliminar(id)).rejects.toThrow(ErrorBiblioteca)
  })
})

it('guarda el estilo inmediatamente y emite el resumen', async () => {
  const s = servicio()
  const { id } = await s.crear(datosNuevos())
  eventos.length = 0
  const estilo = structuredClone(ESTILO_PREDETERMINADO)
  const resumen = await s.guardarEstilo(id, estilo)
  expect((await leerDisco(id)).estilo).toEqual(estilo)
  expect(resumen.estilo).toEqual(estilo)
  expect(eventos).toEqual([{ id, resumen }])
  await expect(s.guardarEstilo('inexistente', estilo)).rejects.toMatchObject({
    codigo: 'ARGUMENTOS_NO_VALIDOS'
  })
})
