import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { estiloPredeterminado, type ProgresoLoteIpc } from '../../shared'
import type { EstadoSesionIpc } from '../../shared/sesion'
import { FIXTURES } from '../../shared/__fixtures__'
import { flush } from '../persistencia'
import { ServicioTemas } from '../temas'
import { ErrorLotes, ServicioLotes, type SesionLotes } from './lotes'
import { silencioFlac } from './flac'
import { ServicioBiblioteca } from './servicio'

let datos: string
let b: ServicioBiblioteca
let t: ServicioTemas
const papelera: string[] = []
const fallaPapelera = new Set<string>()
const progreso: ProgresoLoteIpc[] = []
let trabajos: Record<string, number> = {}
let sesion: FalsaSesion

/** Sesión de pruebas: la cola es una lista; `activa` es la canción que suena. */
class FalsaSesion implements SesionLotes {
  bloqueada = false
  activa: string | null = null
  limite = 500
  pendientes: { entradaId: string; cancionId: string }[] = []
  edicionBloqueada = (): boolean => this.bloqueada
  cancionActiva = (id: string): boolean => this.activa === id
  estadoPrincipal(): EstadoSesionIpc {
    return { pendientes: this.pendientes } as unknown as EstadoSesionIpc
  }
  agregar(cancionId: string): Promise<{ entradaId: string }> {
    if (this.pendientes.length >= this.limite) {
      return Promise.reject(Object.assign(new Error('llena'), { codigo: 'COLA_LLENA' }))
    }
    const entradaId = `e${this.pendientes.length}-${cancionId}`
    this.pendientes.push({ entradaId, cancionId })
    return Promise.resolve({ entradaId })
  }
  quitar(entradaId: string): Promise<{ estado: EstadoSesionIpc; antesDe: string | null }> {
    const i = this.pendientes.findIndex((p) => p.entradaId === entradaId)
    if (i < 0) {
      return Promise.reject(Object.assign(new Error('no'), { codigo: 'ENTRADA_NO_ENCONTRADA' }))
    }
    this.pendientes.splice(i, 1)
    return Promise.resolve({ estado: this.estadoPrincipal(), antesDe: null })
  }
}

beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-lotes-'))
  await mkdir(join(datos, 'biblioteca'), { recursive: true })
  papelera.length = 0
  fallaPapelera.clear()
  progreso.length = 0
  trabajos = {}
  sesion = new FalsaSesion()
  b = new ServicioBiblioteca(datos, {
    shell: {
      trashItem: (ruta) => {
        const id = basename(ruta)
        if (fallaPapelera.has(id)) return Promise.reject(new Error('sin papelera'))
        papelera.push(id)
        return rm(ruta, { recursive: true, force: true })
      },
      openPath: () => Promise.resolve('')
    }
  })
  t = await ServicioTemas.abrir({
    dirBiblioteca: join(datos, 'biblioteca'),
    puerto: b.puerto(),
    estiloInicial: estiloPredeterminado(),
    esperaIndiceMs: 5
  })
  b.conectarTemas(t)
  await b.arrancar()
})
afterEach(async () => {
  await flush()
  await rm(datos, { recursive: true, force: true })
})

const lotes = (): ServicioLotes =>
  new ServicioLotes({
    biblioteca: b,
    eliminar: (id) => b.eliminar(id),
    sesion,
    trabajosDe: (id) => trabajos[id] ?? 0,
    emitirProgreso: (p) => progreso.push({ ...p })
  })

async function nueva(artista: string, album: string | null, titulo = 'Pieza'): Promise<string> {
  const base = FIXTURES.borradorRecienCreado()
  const r = await b.crear({
    metadatos: { ...base.metadatos, titulo, artista, album },
    fuente: base.fuente,
    pasos: { fuente: base.pasos.fuente }
  })
  return r.id
}

async function lista(artista: string, album: string | null, titulo = 'Pieza'): Promise<string> {
  const c = FIXTURES.lista()
  const r = await b.crear({
    metadatos: { ...c.metadatos, titulo, artista, album },
    fuente: c.fuente,
    pistas: c.pistas,
    letra: c.letra,
    pasos: c.pasos
  })
  const carpeta = join(datos, 'biblioteca', r.id)
  await mkdir(join(carpeta, 'pistas'), { recursive: true })
  await mkdir(join(carpeta, 'fuente'), { recursive: true })
  for (const f of ['pistas/voz.flac', 'pistas/instrumental.flac', 'fuente/mezcla.flac']) {
    await writeFile(join(carpeta, f), silencioFlac(1))
  }
  await b.comprobarPistas(r.id)
  await b.marcarLista(r.id)
  return r.id
}

const motivos = (r: { resultados: { id: string; resultado: string; motivo?: string }[] }) =>
  Object.fromEntries(r.resultados.map((x) => [x.id, [x.resultado, x.motivo]]))

describe('editar datos de varias', () => {
  it('previsualiza qué cambia y qué cambia de tema; ejecuta sin tocar el título', async () => {
    const tema = await t.crear({ nombre: 'Rojo', estilo: estiloPredeterminado() })
    const op = {
      tipo: 'asignarGrupo',
      nivel: 'album',
      artista: 'Ana',
      album: 'Disco Nuevo',
      temaId: tema.id
    } as const
    await t.ejecutar(op, (await t.previsualizar(op)).ficha)
    const a = await nueva('Ana', 'Disco Viejo', 'Uno')
    const c = await nueva('Ana', 'Disco Nuevo', 'Dos')
    const d = await nueva('Ana', 'Disco Viejo', 'Tres')
    const s = lotes()
    const prev = s.previsualizarDatos([a, c, d], { album: 'Disco Nuevo' })
    expect(prev.canciones.map((x) => [x.aplica, x.motivo, x.cambiaTema])).toEqual([
      [true, undefined, true],
      [false, 'NADA_QUE_HACER', false],
      [true, undefined, true]
    ])

    const r = await s.ejecutarDatos([a, c, d], { album: 'Disco Nuevo' }, prev.version)
    expect(motivos(r)).toEqual({
      [a]: ['hecho', undefined],
      [c]: ['omitida', 'NADA_QUE_HACER'],
      [d]: ['hecho', undefined]
    })
    expect(progreso).toEqual([
      { hechas: 0, total: 3 },
      { hechas: 1, total: 3 },
      { hechas: 2, total: 3 },
      { hechas: 3, total: 3 }
    ])
    const sa = b.obtener(a)!
    expect(sa.metadatos).toMatchObject({ titulo: 'Uno', artista: 'Ana', album: 'Disco Nuevo' })
    expect(sa.metadatos.origen).toMatchObject({ album: 'usuario' })
    expect(b.obtener(d)?.metadatos.titulo).toBe('Tres')
  })

  it('un campo vacío quita el dato (álbum null) y el artista lo pone', async () => {
    const a = await nueva('Ana', 'Disco')
    const s = lotes()
    const prev = s.previsualizarDatos([a], { album: null, artista: ' Beto ' })
    await s.ejecutarDatos([a], { album: null, artista: ' Beto ' }, prev.version)
    expect(b.obtener(a)?.metadatos).toMatchObject({ artista: 'Beto', album: null })
  })

  it('CONFIRMACION_OBSOLETA si la selección cambió: no escribe y trae la vista nueva', async () => {
    const a = await nueva('Ana', null, 'Uno')
    const c = await nueva('Ana', null, 'Dos')
    const s = lotes()
    const prev = s.previsualizarDatos([a, c], { album: 'Nuevo' })
    await b.actualizar(c, { metadatos: { album: 'Nuevo' } }) // alguien lo cambia a mano
    const err = await s.ejecutarDatos([a, c], { album: 'Nuevo' }, prev.version).catch((e) => e)
    expect(err).toBeInstanceOf(ErrorLotes)
    expect(err.codigo).toBe('CONFIRMACION_OBSOLETA')
    expect(err.detalles.canciones.map((x: { aplica: boolean }) => x.aplica)).toEqual([true, false])
    expect(b.obtener(a)?.metadatos.album).toBeNull()
    // Y otra cosa pedida con la misma versión tampoco vale.
    await expect(s.ejecutarDatos([a], { album: 'Otro' }, prev.version)).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
  })

  it('EDICION_BLOQUEADA para la que suena en la otra pantalla; las demás siguen', async () => {
    const a = await lista('Ana', null, 'Uno')
    const c = await lista('Ana', null, 'Dos')
    sesion.bloqueada = true
    sesion.activa = a
    const s = lotes()
    const prev = s.previsualizarDatos([a, c], { artista: 'Beto' })
    expect(prev.canciones[0]).toMatchObject({ aplica: false, motivo: 'EDICION_BLOQUEADA' })
    const r = await s.ejecutarDatos([a, c], { artista: 'Beto' }, prev.version)
    expect(motivos(r)).toEqual({ [a]: ['omitida', 'EDICION_BLOQUEADA'], [c]: ['hecho', undefined] })
  })

  it('una canción desconocida es omitida y una acción a la vez (EN_CURSO)', async () => {
    const a = await nueva('Ana', null)
    const s = lotes()
    const prev = s.previsualizarDatos([a, '5eed0000-0000-4000-8000-0000000000ff'], { artista: 'X' })
    expect(prev.canciones[1]).toMatchObject({ aplica: false, motivo: 'CANCION_NO_DISPONIBLE' })
    const primera = s.ejecutarDatos([a, prev.canciones[1]!.id], { artista: 'X' }, prev.version)
    await expect(
      s.ejecutarDatos([a, prev.canciones[1]!.id], { artista: 'X' }, prev.version)
    ).rejects.toMatchObject({ codigo: 'EN_CURSO' })
    await primera
  })
})

describe('eliminar varias', () => {
  it('previsualiza lo que arrastra; la que suena no se elimina; el resto va a la papelera', async () => {
    const a = await lista('Ana', null, 'Uno')
    const c = await nueva('Ana', null, 'Dos')
    const d = await lista('Ana', null, 'Tres')
    trabajos[c] = 2
    await sesion.agregar(a)
    sesion.activa = d
    const s = lotes()
    const prev = s.previsualizarEliminar([a, c, d])
    expect(prev.canciones).toMatchObject([
      { id: a, aplica: true, trabajos: 0, entradasCola: 1 },
      { id: c, aplica: true, trabajos: 2, entradasCola: 0 },
      { id: d, aplica: false, motivo: 'CANCION_EN_REPRODUCCION' }
    ])
    const r = await s.ejecutarEliminar([a, c, d], prev.version)
    expect(motivos(r)).toEqual({
      [a]: ['hecho', undefined],
      [c]: ['hecho', undefined],
      [d]: ['omitida', 'CANCION_EN_REPRODUCCION']
    })
    expect(papelera).toEqual([a, c])
    expect(b.obtenerResumen(a)).toBeNull()
    expect(b.obtenerResumen(d)).not.toBeNull()
  })

  it('un fallo de la papelera deja esa canción y no detiene las demás; reintentar solo esa', async () => {
    const ids = [
      await nueva('Ana', null, 'Uno'),
      await nueva('Ana', null, 'Dos'),
      await nueva('Ana', null, 'Tres'),
      await nueva('Ana', null, 'Cuatro')
    ]
    fallaPapelera.add(ids[1]!)
    const s = lotes()
    const r = await s.ejecutarEliminar(ids, s.previsualizarEliminar(ids).version)
    expect(r.resultados.map((x) => x.resultado)).toEqual(['hecho', 'error', 'hecho', 'hecho'])
    expect(r.resultados[1]).toMatchObject({ motivo: 'ERROR_INTERNO' })
    expect(b.obtenerResumen(ids[1]!)).not.toBeNull()
    fallaPapelera.clear()
    const quedan = [ids[1]!]
    const otra = await s.ejecutarEliminar(quedan, s.previsualizarEliminar(quedan).version)
    expect(otra.resultados).toEqual([{ id: ids[1], resultado: 'hecho' }])
    expect(papelera).toHaveLength(4)
  })

  it('CONFIRMACION_OBSOLETA si empezó un trabajo tras la confirmación: no elimina nada', async () => {
    const ids = [await nueva('Ana', null, 'Uno'), await nueva('Ana', null, 'Dos')]
    const s = lotes()
    const prev = s.previsualizarEliminar(ids)
    trabajos[ids[0]!] = 1
    await expect(s.ejecutarEliminar(ids, prev.version)).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
    expect(papelera).toEqual([])
  })

  it('si pasa a sonar entre la vista previa y la ejecución, la selección es obsoleta y no se borra', async () => {
    const a = await lista('Ana', null, 'Uno')
    const s = lotes()
    const prev = s.previsualizarEliminar([a])
    sesion.activa = a
    await expect(s.ejecutarEliminar([a], prev.version)).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
    expect(papelera).toEqual([])
  })
})

describe('A la cola de varias', () => {
  it('añade las Listas al final en el orden dado; los borradores se omiten', async () => {
    const a = await lista('Ana', null, 'Uno')
    const borrador = await nueva('Ana', null, 'Dos')
    const c = await lista('Ana', null, 'Tres')
    const r = await lotes().agregarACola([c, borrador, a])
    expect(sesion.pendientes.map((p) => p.cancionId)).toEqual([c, a])
    expect(r.entradaIds).toHaveLength(2)
    expect(r.omitidas).toEqual([{ id: borrador, motivo: 'CANCION_NO_DISPONIBLE' }])
  })

  it('COLA_LLENA corta el resto con ese motivo (parcial) y deshacer quita solo lo no consumido', async () => {
    const ids = [
      await lista('Ana', null, 'Uno'),
      await lista('Ana', null, 'Dos'),
      await lista('Ana', null, 'Tres')
    ]
    sesion.limite = 2
    const s = lotes()
    const r = await s.agregarACola(ids)
    expect(r.entradaIds).toHaveLength(2)
    expect(r.omitidas).toEqual([{ id: ids[2], motivo: 'COLA_LLENA' }])
    // La primera ya se consumió (sale de las pendientes por su cuenta).
    sesion.pendientes.shift()
    await s.quitarDeCola(r.entradaIds)
    expect(sesion.pendientes).toEqual([])
  })

  it('quitar sin nada que quitar devuelve el estado sin error', async () => {
    const r = await lotes().quitarDeCola(['no-existe'])
    expect(r.antesDe).toBeNull()
  })
})

describe('contrato de la versión', () => {
  it('es estable para la misma selección y cambia con el estado de una canción', async () => {
    const a = await nueva('Ana', null)
    const s = lotes()
    const antes = s.previsualizarEliminar([a]).version
    expect(s.previsualizarEliminar([a]).version).toBe(antes)
    await b.actualizar(a, { metadatos: { titulo: 'Otro título' } })
    expect(s.previsualizarEliminar([a]).version).not.toBe(antes)
  })
})
