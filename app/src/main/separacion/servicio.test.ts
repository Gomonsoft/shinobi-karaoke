import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServicioBiblioteca } from '../biblioteca'
import { GestorTrabajos, type EjecutarWorker } from '../trabajos'
import { ALFA_FACTOR, entornoSeparadorFalso, ServicioSeparacion } from './servicio'
import { cancionConFuente, configEnMemoria, manifiesto, nuevoDirDatos } from './servicio.testutil'

const reposo = (ms = 20) => new Promise((r) => setTimeout(r, ms))
const esperarHasta = async (cond: () => boolean, ms = 8000): Promise<void> => {
  const fin = Date.now() + ms
  while (!cond()) {
    if (Date.now() > fin) throw new Error('tiempo agotado')
    await reposo(10)
  }
}

interface Llamada {
  comando: string
  args: Record<string, unknown>
  resolver: (d?: Record<string, unknown>) => void
  fallar: (codigo: string) => void
}

let datos: string
let biblioteca: ServicioBiblioteca
let llamadas: Llamada[]
let gestor: GestorTrabajos
let config: ReturnType<typeof configEnMemoria>
let servicio: ServicioSeparacion
const alMotorIncompleto = vi.fn()

function resultado(extra: Record<string, unknown> = {}) {
  return {
    voz: 'voz.flac',
    instrumental: 'instrumental.flac',
    modelo: {
      id: 'calidad',
      archivo: 'vocals_mel_band_roformer.ckpt',
      version_audio_separator: '0.48.0'
    },
    dispositivo: 'cpu',
    segundos_separando: 100,
    segundos_total: 120,
    ...extra
  }
}

/** Como el worker: deja las pistas en `salida_dir`. */
async function escribirPistas(l: Llamada): Promise<void> {
  const dir = l.args.salida_dir as string
  await writeFile(join(dir, 'voz.flac'), 'voz-nueva')
  await writeFile(join(dir, 'instrumental.flac'), 'inst-nueva')
}

function montar(parcialConfig = {}): void {
  config = configEnMemoria(parcialConfig)
  llamadas = []
  const ejecutar: EjecutarWorker = (comando, args, op) =>
    new Promise((resolver, rechazar) => {
      const l: Llamada = {
        comando,
        args,
        resolver: (d = resultado()) => resolver(d),
        fallar: (codigo) => rechazar({ codigo, mensaje: codigo, reintentable: false })
      }
      llamadas.push(l)
      op.señal?.addEventListener('abort', () =>
        setTimeout(() => rechazar({ codigo: 'CANCELADO', mensaje: 'c', reintentable: false }), 5)
      )
    })
  biblioteca = new ServicioBiblioteca(datos, {
    shell: {
      trashItem: (r) => rm(r, { recursive: true, force: true }),
      openPath: () => Promise.resolve('')
    },
    antesDeEliminar: (id) => gestor.cancelarDeCancion(id)
  })
  gestor = new GestorTrabajos({ biblioteca, ejecutar })
  servicio = new ServicioSeparacion({
    biblioteca,
    gestor,
    config,
    manifiesto: () => manifiesto,
    dirDatos: datos,
    estimarSeparacion: () => null,
    alMotorIncompleto
  })
}

beforeEach(async () => {
  alMotorIncompleto.mockClear()
  datos = await nuevoDirDatos()
  montar()
})
afterEach(async () => {
  servicio.cerrar()
  await gestor.cancelarTodos()
  await biblioteca.flushTodo()
  await rm(datos, { recursive: true, force: true })
})

const arrancado = async (): Promise<Llamada> => {
  await esperarHasta(() => llamadas.length > 0)
  return llamadas[llamadas.length - 1]!
}

describe('separar: reglas de aceptación', () => {
  it('encola en la cola pesada con args de Calidad en CPU y pistas.tmp vaciada', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    const tmp = join(datos, 'biblioteca', id, 'pistas.tmp')
    await mkdir(tmp, { recursive: true })
    await writeFile(join(tmp, 'resto.flac'), 'x')
    await servicio.separar(id)
    const [t] = gestor.listar()
    expect(t).toMatchObject({ cola: 'pesada', paso: 'separacion', comando: 'separar' })
    const l = await arrancado()
    expect(l.args).toEqual({
      entrada: join(datos, 'biblioteca', id, 'fuente', 'mezcla.flac'),
      salida_dir: tmp,
      modelo: {
        id: 'calidad',
        archivo: 'vocals_mel_band_roformer.ckpt',
        dir: join(datos, 'modelos')
      },
      dispositivo: 'cpu',
      bloques: 'normal'
    })
    expect(await readdir(tmp)).toEqual([])
    expect(gestor.listar()[0]).toMatchObject({ modo: 'calidad', dispositivo: 'cpu' })
  })

  it('usa cuda con el perfil cuda', async () => {
    montar({ instalacion: { perfil_hardware: 'cuda' } })
    const id = await cancionConFuente(biblioteca, datos)
    await servicio.separar(id)
    expect((await arrancado()).args.dispositivo).toBe('cuda')
  })

  it('rechaza sin escribir: canción inexistente, sin mezcla, fuente no completada, trabajo vivo, paso en curso o completado', async () => {
    await expect(servicio.separar('nope')).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    const sinMezcla = await cancionConFuente(biblioteca, datos, { mezcla: null })
    await expect(servicio.separar(sinMezcla)).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    const b = await biblioteca.crear({
      metadatos: { titulo: 'a', artista: 'b', album: null, duracion_ms: 1000 },
      fuente: biblioteca.obtener(sinMezcla)!.fuente
    })
    await mkdir(join(datos, 'biblioteca', b.id, 'fuente'), { recursive: true })
    await writeFile(join(datos, 'biblioteca', b.id, 'fuente', 'mezcla.flac'), 'x')
    await expect(servicio.separar(b.id)).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })

    const id = await cancionConFuente(biblioteca, datos)
    await servicio.separar(id)
    await expect(servicio.separar(id)).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    await arrancado()
    // Con el trabajo en curso tampoco se acepta.
    await expect(servicio.separar(id)).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    expect(llamadas).toHaveLength(1)
  })

  it('sin instalación completa -> RUNTIME_NO_DISPONIBLE', async () => {
    montar({ instalacion: { estado: 'no_instalada' } })
    const id = await cancionConFuente(biblioteca, datos)
    await expect(servicio.separar(id)).rejects.toMatchObject({ codigo: 'RUNTIME_NO_DISPONIBLE' })
    expect(gestor.listar()).toEqual([])
    expect(alMotorIncompleto).not.toHaveBeenCalled()
  })

  it('notifica una vez un motor incompleto detectado por el worker, sin reintentar ni ofrecer Rápido', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    await servicio.separar(id)
    const l = await arrancado()
    expect(alMotorIncompleto).not.toHaveBeenCalled()

    l.fallar('RUNTIME_NO_DISPONIBLE')
    await esperarHasta(() => gestor.listar().length === 0)
    expect(alMotorIncompleto).toHaveBeenCalledTimes(1)
    expect(llamadas).toHaveLength(1)
    expect(biblioteca.obtener(id)?.pasos.separacion.error).toMatchObject({
      codigo: 'RUNTIME_NO_DISPONIBLE'
    })
    expect(servicio.ofertaRapidoVigente(id)).toBe(false)
  })

  it('acepta paso en error o interrumpido, y completado solo con las pistas perdidas', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    await biblioteca.actualizar(id, {
      pasos: { separacion: { estado: 'error', error: { codigo: 'X', mensaje: 'x' } } }
    })
    await servicio.separar(id)
    await gestor.cancelarDeCancion(id)
    await biblioteca.actualizar(id, { pasos: { separacion: { estado: 'interrumpido' } } })
    await servicio.separar(id)
    await gestor.cancelarDeCancion(id)
    // Completado con pistas presentes: no.
    await mkdir(join(datos, 'biblioteca', id, 'pistas'), { recursive: true })
    await writeFile(join(datos, 'biblioteca', id, 'pistas', 'voz.flac'), 'x')
    await writeFile(join(datos, 'biblioteca', id, 'pistas', 'instrumental.flac'), 'x')
    await biblioteca.actualizar(id, {
      pasos: { separacion: { estado: 'completado', error: null } }
    })
    await expect(servicio.separar(id)).rejects.toMatchObject({ codigo: 'ARGUMENTOS_NO_VALIDOS' })
    // Pistas perdidas ("Re-separar pistas").
    await rm(join(datos, 'biblioteca', id, 'pistas'), { recursive: true })
    await biblioteca.escanear()
    expect(biblioteca.obtenerResumen(id)?.motivo).toBe('pistas')
    await servicio.separar(id)
    expect(gestor.listar()).toHaveLength(1)
  })
})

describe('modo leído al empezar', () => {
  it('el cambio de modo con el trabajo en cola se aplica al empezar', async () => {
    const a = await cancionConFuente(biblioteca, datos)
    const b = await cancionConFuente(biblioteca, datos)
    await servicio.separar(a)
    await servicio.separar(b)
    const la = await arrancado()
    expect(la.args.modelo).toMatchObject({ id: 'calidad' })
    await config.actualizar({
      separacion: { modo: 'rapido', rapido_aceptado: new Date().toISOString() }
    })
    await escribirPistas(la)
    la.resolver()
    await esperarHasta(() => llamadas.length === 2)
    const lb = llamadas[1]!
    expect(lb.args.modelo).toMatchObject({ id: 'rapido', archivo: 'UVR-MDX-NET-Inst_HQ_4.onnx' })
    expect(gestor.listar()[0]).toMatchObject({ modo: 'rapido' })
  })

  it('Rápido sin consentimiento no se usa', async () => {
    montar({ separacion: { modo: 'rapido', rapido_aceptado: null } })
    const id = await cancionConFuente(biblioteca, datos)
    await servicio.separar(id)
    expect((await arrancado()).args.modelo).toMatchObject({ id: 'calidad' })
  })
})

describe('resultado, factor y descarte', () => {
  it('mueve las pistas, escribe pistas y paso completado, y guarda el factor', async () => {
    const id = await cancionConFuente(biblioteca, datos, { duracionMs: 60_000 })
    await servicio.separar(id)
    const l = await arrancado()
    await escribirPistas(l)
    l.resolver(resultado({ segundos_total: 120 }))
    await esperarHasta(() => !gestor.hayPendientes())
    const c = biblioteca.obtener(id)!
    expect(c.pasos.separacion).toMatchObject({
      estado: 'completado',
      error: null,
      segundos: 120
    })
    expect(biblioteca.obtenerResumen(id)?.pasos?.separacion.segundos).toBe(120)
    expect(c.pistas).toEqual({
      voz: 'pistas/voz.flac',
      instrumental: 'pistas/instrumental.flac',
      modelo: { perfil: 'calidad', nombre: 'vocals_mel_band_roformer.ckpt', version: '0.48.0' }
    })
    const dir = join(datos, 'biblioteca', id)
    expect(existsSync(join(dir, 'pistas.tmp'))).toBe(false)
    expect(existsSync(join(dir, 'pistas', 'voz.flac'))).toBe(true)
    expect(biblioteca.obtenerResumen(id)?.danada).toBe(false)
    // 120 s / 60 / 1 min = 2
    expect(config.obtener().separacion.factores_medidos.calidad).toBeCloseTo(2)
  })

  it('el segundo factor es media móvil con α = 0,5', async () => {
    expect(ALFA_FACTOR).toBe(0.5)
    await config.actualizar({ separacion: { factores_medidos: { calidad: 2 } } })
    const id = await cancionConFuente(biblioteca, datos, { duracionMs: 60_000 })
    await servicio.separar(id)
    const l = await arrancado()
    await escribirPistas(l)
    l.resolver(resultado({ segundos_total: 240 })) // factor 4
    await esperarHasta(() => !gestor.hayPendientes())
    expect(config.obtener().separacion.factores_medidos.calidad).toBeCloseTo(3)
  })

  it('no guarda el factor si el dispositivo cambió', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    await servicio.separar(id)
    const l = await arrancado()
    await escribirPistas(l)
    l.resolver(resultado({ dispositivo: 'cuda' }))
    await esperarHasta(() => !gestor.hayPendientes())
    expect(config.obtener().separacion.factores_medidos).toEqual({})
  })

  it('cancelar borra pistas.tmp y deja intactas las pistas anteriores', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    const dir = join(datos, 'biblioteca', id)
    await mkdir(join(dir, 'pistas'), { recursive: true })
    await writeFile(join(dir, 'pistas', 'voz.flac'), 'vieja')
    await servicio.separar(id)
    const l = await arrancado()
    await writeFile(join(l.args.salida_dir as string, 'voz.flac'), 'parcial')
    const [t] = gestor.listar()
    await gestor.cancelar(t!.id)
    expect(existsSync(join(dir, 'pistas.tmp'))).toBe(false)
    expect(existsSync(join(dir, 'pistas', 'voz.flac'))).toBe(true)
    expect(biblioteca.obtener(id)!.pasos.separacion.estado).toBe('pendiente')
  })

  it('fallo -> paso en error y pistas.tmp borrada', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    await servicio.separar(id)
    const l = await arrancado()
    l.fallar('ERROR_INTERNO')
    await esperarHasta(() => !gestor.hayPendientes())
    expect(biblioteca.obtener(id)!.pasos.separacion).toMatchObject({
      estado: 'error',
      error: { codigo: 'ERROR_INTERNO' }
    })
    expect(existsSync(join(datos, 'biblioteca', id, 'pistas.tmp'))).toBe(false)
  })

  it('eliminar la canción cancela antes la separación viva', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    await servicio.separar(id)
    await arrancado()
    await biblioteca.eliminar(id)
    expect(gestor.listar()).toEqual([])
    expect(existsSync(join(datos, 'biblioteca', id))).toBe(false)
  })
})

describe('encolado automático y arranque', () => {
  it('tras completar descargar-youtube encola la separación; la de archivo, con alCompletarFuente', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    gestor.encolar({
      cancionId: id,
      paso: 'fuente',
      cola: 'ligera',
      comando: 'descargar-youtube',
      args: {}
    })
    await esperarHasta(() => llamadas.length > 0)
    llamadas.find((l) => l.comando === 'descargar-youtube')!.resolver({})
    await esperarHasta(() => llamadas.some((l) => l.comando === 'separar'))
    expect(llamadas.some((l) => l.comando === 'separar')).toBe(true)

    const otro = await cancionConFuente(biblioteca, datos)
    await servicio.alCompletarFuente(otro)
    expect(gestor.listar().some((t) => t.cancionId === otro)).toBe(true)
  })

  it('alCompletarFuente no lanza si no se puede', async () => {
    await expect(servicio.alCompletarFuente('nope')).resolves.toBeUndefined()
  })

  it('al arrancar borra pistas.tmp y *.partial, y no encola nada', async () => {
    const id = await cancionConFuente(biblioteca, datos)
    const tmp = join(datos, 'biblioteca', id, 'pistas.tmp')
    await mkdir(tmp, { recursive: true })
    await mkdir(join(datos, 'modelos'), { recursive: true })
    await writeFile(join(datos, 'modelos', 'm.ckpt.partial'), 'x')
    await servicio.limpiarAlArrancar()
    expect(existsSync(tmp)).toBe(false)
    expect(existsSync(join(datos, 'modelos', 'm.ckpt.partial'))).toBe(false)
    expect(gestor.listar()).toEqual([])
  })
})

describe('entornoSeparadorFalso', () => {
  const env = { SHINOBI_SEPARADOR_FALSO: '/e.json', SHINOBI_INTENTO: '2' }
  it('solo sin empaquetar', () => {
    expect(entornoSeparadorFalso(env, false)).toEqual(env)
    expect(entornoSeparadorFalso(env, true)).toEqual({})
    expect(entornoSeparadorFalso({}, false)).toEqual({})
  })
})
