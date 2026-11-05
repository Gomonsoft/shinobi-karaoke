import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { EventoProgresoIpc, ModeloId } from '../../shared'
import { ServicioBiblioteca } from '../biblioteca'
import { GestorTrabajos, type EjecutarWorker } from '../trabajos'
import { ServicioSeparacion, type PuertoModelos } from './servicio'
import { cancionConFuente, configEnMemoria, manifiesto, nuevoDirDatos } from './servicio.testutil'

/* 0066: reintentos por memoria, modelo que falta y oferta de Rápido (gestor real, worker simulado). */

const esperarHasta = async (cond: () => boolean, ms = 8000): Promise<void> => {
  const fin = Date.now() + ms
  while (!cond()) {
    if (Date.now() > fin) throw new Error('tiempo agotado')
    await new Promise((r) => setTimeout(r, 10))
  }
}

type Guion = (n: number, args: Record<string, unknown>) => { codigo: string } | 'ok'

let datos: string
let biblioteca: ServicioBiblioteca
let gestor: GestorTrabajos
let config: ReturnType<typeof configEnMemoria>
let servicio: ServicioSeparacion
let lanzadas: { args: Record<string, unknown>; env: Record<string, string> | undefined }[]
let verificados: Set<ModeloId>
let descargas: ModeloId[]
let borrados: ModeloId[]
let fallaDescarga: string | null
let progresos: EventoProgresoIpc[]

function montar(guion: Guion, parcialConfig = {}): void {
  config = configEnMemoria(parcialConfig)
  lanzadas = []
  descargas = []
  borrados = []
  fallaDescarga = null
  progresos = []
  verificados = new Set<ModeloId>(['calidad'])
  const ejecutar: EjecutarWorker = async (_c, args, op) => {
    lanzadas.push({ args, env: op.env })
    const r = guion(lanzadas.length, args)
    if (r !== 'ok') throw { codigo: r.codigo, mensaje: r.codigo, reintentable: true }
    const dir = args.salida_dir as string
    await writeFile(join(dir, 'voz.flac'), 'v')
    await writeFile(join(dir, 'instrumental.flac'), 'i')
    return {
      voz: 'voz.flac',
      instrumental: 'instrumental.flac',
      modelo: {
        id: (args.modelo as { id: string }).id,
        archivo: 'm',
        version_audio_separator: '1'
      },
      dispositivo: args.dispositivo,
      segundos_separando: 1,
      segundos_total: 2
    }
  }
  const modelos: PuertoModelos = {
    verificado: (id) => Promise.resolve(verificados.has(id)),
    descargar: async (id, señal, alProgreso) => {
      descargas.push(id)
      alProgreso({ bytes: 5, total: 10 })
      if (señal.aborted) throw { codigo: 'CANCELADO' }
      if (fallaDescarga) throw { codigo: fallaDescarga }
      verificados.add(id)
    },
    borrar: (id) => {
      borrados.push(id)
      verificados.delete(id)
      return Promise.resolve()
    }
  }
  biblioteca = new ServicioBiblioteca(datos, {
    shell: {
      trashItem: (r) => rm(r, { recursive: true, force: true }),
      openPath: () => Promise.resolve('')
    },
    antesDeEliminar: (id) => gestor.cancelarDeCancion(id)
  })
  gestor = new GestorTrabajos({ biblioteca, ejecutar })
  gestor.suscribirProgreso((p) => progresos.push(p))
  servicio = new ServicioSeparacion({
    biblioteca,
    gestor,
    config,
    manifiesto: () => manifiesto,
    dirDatos: datos,
    estimarSeparacion: () => null,
    modelos,
    intentoEnEntorno: true
  })
}

beforeEach(async () => {
  datos = await nuevoDirDatos()
})
afterEach(async () => {
  servicio.cerrar()
  await gestor.cancelarTodos()
  await biblioteca.flushTodo()
  await rm(datos, { recursive: true, force: true })
})

async function separarYEsperar(): Promise<string> {
  const id = await cancionConFuente(biblioteca, datos)
  await servicio.separar(id)
  await esperarHasta(() => !gestor.hayPendientes())
  return id
}
const paso = (id: string) => biblioteca.obtener(id)!.pasos.separacion

describe('reintentos por memoria', () => {
  it('memoria en el intento 1 -> éxito en el 2 con bloques pequeños, mismo modelo y dispositivo', async () => {
    montar((n) => (n === 1 ? { codigo: 'MEMORIA_INSUFICIENTE' } : 'ok'))
    const id = await separarYEsperar()
    expect(lanzadas).toHaveLength(2)
    expect(lanzadas[0]!.args).toMatchObject({ bloques: 'normal', dispositivo: 'cpu' })
    expect(lanzadas[1]!.args).toMatchObject({ bloques: 'pequenos', dispositivo: 'cpu' })
    expect(lanzadas[1]!.args.modelo).toMatchObject({ id: 'calidad' })
    expect(lanzadas.map((l) => l.env)).toEqual([{ SHINOBI_INTENTO: '1' }, { SHINOBI_INTENTO: '2' }])
    expect(paso(id).estado).toBe('completado')
    const reint = progresos.filter((p) => p.fase === 'reintentando')
    expect(reint[0]).toMatchObject({ detalle: { motivo: 'memoria' } })
  })

  it('CUDA: los intentos 1 y 2 fallan -> el 3.º en CPU con bloques pequeños', async () => {
    montar((n) => (n < 3 ? { codigo: 'MEMORIA_INSUFICIENTE' } : 'ok'), {
      instalacion: { perfil_hardware: 'cuda' }
    })
    const id = await separarYEsperar()
    expect(lanzadas.map((l) => [l.args.dispositivo, l.args.bloques])).toEqual([
      ['cuda', 'normal'],
      ['cuda', 'pequenos'],
      ['cpu', 'pequenos']
    ])
    expect(progresos.filter((p) => p.fase === 'reintentando').map((p) => p.detalle)).toEqual([
      expect.objectContaining({ motivo: 'memoria' }),
      expect.objectContaining({ motivo: 'memoria_cpu' })
    ])
    expect(paso(id).estado).toBe('completado')
    // El trabajo cambió de dispositivo: no se guarda el factor medido.
    expect(config.obtener().separacion.factores_medidos.calidad).toBeUndefined()
  })

  it('CPU: dos fallos -> error definitivo MEMORIA_INSUFICIENTE y oferta de Rápido', async () => {
    montar(() => ({ codigo: 'MEMORIA_INSUFICIENTE' }))
    const id = await separarYEsperar()
    expect(lanzadas).toHaveLength(2)
    expect(paso(id)).toMatchObject({
      estado: 'error',
      error: { codigo: 'MEMORIA_INSUFICIENTE', modelo: 'calidad' }
    })
    expect(servicio.ofertaRapidoVigente(id)).toBe(true)
    expect(servicio.ofertaRapidoVigente()).toBe(true)
  })

  it('PROCESO_TERMINADO se trata como memoria, también en el error final', async () => {
    montar(() => ({ codigo: 'PROCESO_TERMINADO' }))
    const id = await separarYEsperar()
    expect(lanzadas).toHaveLength(2)
    expect(lanzadas[1]!.args.bloques).toBe('pequenos')
    expect(paso(id).error).toMatchObject({ codigo: 'MEMORIA_INSUFICIENTE', modelo: 'calidad' })
    expect(servicio.ofertaRapidoVigente(id)).toBe(true)
  })

  it('otros códigos no se reintentan y no ofrecen Rápido', async () => {
    montar(() => ({ codigo: 'ERROR_INTERNO' }))
    const id = await separarYEsperar()
    expect(lanzadas).toHaveLength(1)
    expect(paso(id).error?.codigo).toBe('ERROR_INTERNO')
    expect(servicio.ofertaRapidoVigente(id)).toBe(false)
  })

  it('separando con Rápido, la memoria no tiene oferta', async () => {
    montar(() => ({ codigo: 'MEMORIA_INSUFICIENTE' }), {
      separacion: { modo: 'rapido', rapido_aceptado: new Date().toISOString() }
    })
    verificados.add('rapido')
    const id = await separarYEsperar()
    expect(paso(id).error).toMatchObject({ codigo: 'MEMORIA_INSUFICIENTE', modelo: 'rapido' })
    expect(servicio.ofertaRapidoVigente(id)).toBe(false)
  })
})

describe('modelo que falta', () => {
  it('ausente -> descargando_modelo con bytes -> éxito', async () => {
    montar(() => 'ok')
    verificados.clear()
    const id = await separarYEsperar()
    expect(descargas).toEqual(['calidad'])
    const fases = progresos.filter((p) => p.fase === 'descargando_modelo')
    expect(fases.length).toBeGreaterThan(0)
    expect(fases.some((p) => (p.detalle as { bytes?: number } | undefined)?.bytes === 5)).toBe(true)
    expect(lanzadas).toHaveLength(1)
    expect(paso(id).estado).toBe('completado')
  })

  it('descarga fallida con SIN_CONEXION -> MODELO_NO_DISPONIBLE sin oferta', async () => {
    montar(() => 'ok')
    verificados.clear()
    fallaDescarga = 'SIN_CONEXION'
    const id = await separarYEsperar()
    expect(lanzadas).toHaveLength(0)
    expect(paso(id).error).toEqual({
      codigo: 'MODELO_NO_DISPONIBLE',
      mensaje: 'SIN_CONEXION',
      modelo: 'calidad'
    })
    expect(servicio.ofertaRapidoVigente(id)).toBe(false)
  })

  it('descarga fallida con VERIFICACION_FALLIDA -> con oferta', async () => {
    montar(() => 'ok')
    verificados.clear()
    fallaDescarga = 'VERIFICACION_FALLIDA'
    const id = await separarYEsperar()
    expect(paso(id).error).toMatchObject({
      codigo: 'MODELO_NO_DISPONIBLE',
      mensaje: 'VERIFICACION_FALLIDA'
    })
    expect(servicio.ofertaRapidoVigente(id)).toBe(true)
  })

  it('checkpoint corrupto: el worker lo rechaza -> se borra y se descarga una sola vez', async () => {
    montar((n) => (n === 1 ? { codigo: 'MODELO_NO_DISPONIBLE' } : 'ok'))
    const id = await separarYEsperar()
    expect(borrados).toEqual(['calidad'])
    expect(descargas).toEqual(['calidad'])
    expect(lanzadas).toHaveLength(2)
    expect(lanzadas[1]!.args.bloques).toBe('normal')
    expect(paso(id).estado).toBe('completado')
  })

  it('checkpoint corrupto otra vez -> error definitivo (no hay segunda re-descarga)', async () => {
    montar(() => ({ codigo: 'MODELO_NO_DISPONIBLE' }))
    const id = await separarYEsperar()
    expect(descargas).toHaveLength(1)
    expect(lanzadas).toHaveLength(2)
    expect(paso(id).error).toMatchObject({ codigo: 'MODELO_NO_DISPONIBLE', modelo: 'calidad' })
  })

  it('con modo Rápido y su modelo ausente se usa Calidad', async () => {
    montar(() => 'ok', {
      separacion: { modo: 'rapido', rapido_aceptado: new Date().toISOString() }
    })
    await separarYEsperar()
    expect(lanzadas[0]!.args.modelo).toMatchObject({ id: 'calidad' })
    expect(descargas).toEqual([])
  })

  it('cancelar durante la descarga cancela el trabajo y deja el paso pendiente', async () => {
    montar(() => 'ok')
    verificados.clear()
    const original = gestor
    const id = await cancionConFuente(biblioteca, datos)
    // Descarga que espera a ser cancelada.
    ;(servicio as unknown as { deps: { modelos: PuertoModelos } }).deps.modelos.descargar = (
      _id,
      señal
    ) =>
      new Promise((_ok, rechazar) => {
        if (señal.aborted) rechazar({ codigo: 'CANCELADO' })
        señal.addEventListener('abort', () => rechazar({ codigo: 'CANCELADO' }))
      })
    await servicio.separar(id)
    await esperarHasta(() => original.listar()[0]?.estado === 'en_curso')
    await original.cancelar(original.listar()[0]!.id)
    expect(paso(id).estado).toBe('pendiente')
    expect(lanzadas).toHaveLength(0)
  })
})

describe('oferta de Rápido', () => {
  const conError = async (codigo: string, mensaje: string, modelo?: 'calidad' | 'rapido') => {
    const id = await cancionConFuente(biblioteca, datos)
    await biblioteca.actualizar(id, {
      pasos: {
        separacion: {
          estado: 'error',
          actualizado: new Date().toISOString(),
          error: { codigo, mensaje, ...(modelo ? { modelo } : {}) }
        }
      }
    })
    return id
  }

  it('sobrevive a un reinicio: se deriva de cancion.json', async () => {
    montar(() => 'ok')
    const id = await conError('MEMORIA_INSUFICIENTE', 'x', 'calidad')
    await biblioteca.flushTodo()
    const otra = new ServicioBiblioteca(datos)
    await otra.arrancar()
    const nuevo = new ServicioSeparacion({
      biblioteca: otra,
      gestor,
      config,
      manifiesto: () => manifiesto,
      dirDatos: datos,
      estimarSeparacion: () => null
    })
    expect(nuevo.ofertaRapidoVigente(id)).toBe(true)
    nuevo.cerrar()
  })

  it('sin modelo registrado (canciones anteriores) no hay oferta', async () => {
    montar(() => 'ok')
    const id = await conError('MEMORIA_INSUFICIENTE', 'x')
    expect(servicio.ofertaRapidoVigente(id)).toBe(false)
  })

  it('con Rápido pendiente (aceptado y sin descargar) no hay oferta', async () => {
    montar(() => 'ok', { separacion: { rapido_aceptado: new Date().toISOString() } })
    const id = await conError('MEMORIA_INSUFICIENTE', 'x', 'calidad')
    expect(servicio.ofertaRapidoVigente(id)).toBe(false)
  })

  it('tras aceptar (modo rapido + modelo), separar lanza con Rápido', async () => {
    montar(() => 'ok')
    const id = await conError('MEMORIA_INSUFICIENTE', 'x', 'calidad')
    expect(servicio.ofertaRapidoVigente(id)).toBe(true)
    // Lo que deja `runtime.aceptarYUsarRapido('separacion')`.
    verificados.add('rapido')
    await config.actualizar({
      separacion: {
        modo: 'rapido',
        rapido_aceptado: new Date().toISOString(),
        modelos_descargados: ['calidad', 'rapido']
      }
    })
    expect(servicio.ofertaRapidoVigente(id)).toBe(false)
    await servicio.separar(id)
    await esperarHasta(() => !gestor.hayPendientes())
    expect(lanzadas[0]!.args.modelo).toMatchObject({ id: 'rapido' })
    expect(paso(id).estado).toBe('completado')
  })

  it('nunca se lanza Rápido sin rapido_aceptado', async () => {
    montar(() => 'ok', { separacion: { modo: 'rapido', rapido_aceptado: null } })
    verificados.add('rapido')
    await separarYEsperar()
    expect(lanzadas[0]!.args.modelo).toMatchObject({ id: 'calidad' })
    expect(descargas).not.toContain('rapido')
  })

  it('MODELO_NO_DISPONIBLE con SIN_CONEXION no ofrece; con otra causa, sí', async () => {
    montar(() => 'ok')
    const a = await conError('MODELO_NO_DISPONIBLE', 'SIN_CONEXION', 'calidad')
    const b = await conError('MODELO_NO_DISPONIBLE', 'SIN_ESPACIO', 'calidad')
    expect(servicio.ofertaRapidoVigente(a)).toBe(false)
    expect(servicio.ofertaRapidoVigente(b)).toBe(true)
  })
})
