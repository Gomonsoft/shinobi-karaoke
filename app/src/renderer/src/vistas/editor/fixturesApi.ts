import { linea, lista, pausa, separando } from '@shared/__fixtures__'
import {
  configPredeterminada,
  letraSchema,
  numerosLineasSinInicio,
  puedeMarcarseLista,
  type Cancion,
  type CodigoError
} from '@shared/index'
import type { ApiShinobi, ErrorIpc, ResumenCancionIpc } from '@shared/ipc'
import { ventanaFalsa } from '../biblioteca/ventanaFalsa'

export function cancionSincronizadaLrclib(): Cancion {
  const cancion = cancionLista()
  cancion.estado = 'borrador'
  cancion.pasos.edicion = { estado: 'pendiente', actualizado: null, error: null }
  return cancion
}

export function cancionLista(): Cancion {
  const cancion = lista()
  cancion.metadatos.duracion_ms = 30_000
  cancion.letra = {
    origen: 'lrclib',
    lrclib_id: 12345,
    offset_ms: 0,
    lineas: [
      linea('l1', 'Baila la lluvia', 2000),
      linea('l2', 'En la ventana', 5000),
      linea('l3', 'Suena en el patio', 8000),
      pausa('p1'),
      linea('l4', 'La madrugada', 15_000),
      linea('l5', 'Navega un barco', 19_000),
      linea('l6', 'De papel blanco', 23_000)
    ]
  }
  return cancion
}

export function cancionSinSincronizar(): Cancion {
  const cancion = cancionSincronizadaLrclib()
  if (cancion.letra) {
    cancion.letra.origen = 'manual'
    cancion.letra.lrclib_id = null
    for (const elemento of cancion.letra.lineas) elemento.inicio_ms = null
  }
  return cancion
}

export function cancionConPalabras(): Cancion {
  const cancion = cancionSincronizadaLrclib()
  if (cancion.letra) {
    cancion.letra.lineas[0]!.palabras = [
      { texto: 'Baila', inicio_ms: 2000, fin_ms: 2200 },
      { texto: 'la', inicio_ms: 2300, fin_ms: 2500 },
      { texto: 'lluvia', inicio_ms: 2500, fin_ms: 2900 }
    ]
    cancion.letra.lineas[3]!.inicio_ms = 11_000
  }
  return cancion
}

export function cancionSeparando(): Cancion {
  const cancion = cancionSinSincronizar()
  cancion.pistas = null
  cancion.pasos.separacion = separando().pasos.separacion
  return cancion
}

export function cancionListaIncompleta(): Cancion {
  const cancion = cancionLista()
  if (cancion.letra) cancion.letra.lineas[0]!.inicio_ms = null
  return cancion
}

type ApiEditor = {
  [K in 'biblioteca' | 'letras' | 'app' | 'trabajos']: Partial<ApiShinobi[K]>
} & Pick<ApiShinobi, 'config' | 'alCambiarCancion'> & { ventana: ReturnType<typeof ventanaFalsa> }

type OpcionesApiEditor = {
  cancion?: Cancion
  danada?: boolean
  config?: Awaited<ReturnType<ApiShinobi['config']['obtener']>>
  trabajos?: Awaited<ReturnType<ApiShinobi['trabajos']['listar']>>
}

function error(codigo: CodigoError): ErrorIpc {
  return { codigo, mensaje: codigo }
}

/** Doble local con escrituras, eventos y fallos inyectables para las pruebas del editor. */
export function apiEditorFalsa(opciones: OpcionesApiEditor = {}): {
  api: ApiEditor
  llamadas: { metodo: string; args: unknown[] }[]
  emitirCambio(resumen: ResumenCancionIpc): void
  fallar(metodo: string, codigo: CodigoError, veces?: number): void
} {
  const cancion = structuredClone(opciones.cancion ?? cancionSinSincronizar())
  const config = structuredClone(opciones.config ?? configPredeterminada())
  let sesionActiva: string | null = null
  const llamadas: { metodo: string; args: unknown[] }[] = []
  const fallos = new Map<string, { codigo: CodigoError; veces: number }>()
  const oyentes = new Set<Parameters<ApiShinobi['alCambiarCancion']>[0]>()

  function registrar(metodo: string, ...args: unknown[]): void {
    llamadas.push({ metodo, args: structuredClone(args) })
    const fallo = fallos.get(metodo)
    if (!fallo) return
    if (--fallo.veces <= 0) fallos.delete(metodo)
    throw error(fallo.codigo)
  }

  function resumen(): ResumenCancionIpc {
    const pendientes = numerosLineasSinInicio(cancion.letra).length
    const paso = (nombre: keyof Cancion['pasos']) => {
      const valor = structuredClone(cancion.pasos[nombre])
      return { ...valor, progreso: valor.progreso ?? null }
    }
    return {
      id: cancion.id,
      titulo: cancion.metadatos.titulo,
      artista: cancion.metadatos.artista,
      duracionMs: cancion.metadatos.duracion_ms,
      estado: cancion.estado,
      modificada: cancion.modificada,
      estilo: structuredClone(cancion.estilo),
      miniatura: null,
      pasos: {
        fuente: paso('fuente'),
        separacion: paso('separacion'),
        letra: paso('letra'),
        edicion: paso('edicion')
      },
      lineasSinSincronizar: pendientes,
      incompleta: cancion.estado === 'lista' && pendientes > 0,
      danada: opciones.danada ?? false,
      motivo: null
    }
  }

  function emitirCambio(cambio: ResumenCancionIpc): void {
    for (const oyente of oyentes) oyente({ id: cambio.id, resumen: cambio })
  }

  function publicar(): ResumenCancionIpc {
    const cambio = resumen()
    emitirCambio(cambio)
    return cambio
  }

  function exigirId(id: string): void {
    if (id !== cancion.id) throw error('ARGUMENTOS_NO_VALIDOS')
  }

  const api: ApiEditor = {
    ventana: ventanaFalsa(),
    biblioteca: {
      async listar() {
        registrar('biblioteca.listar')
        return [resumen()]
      },
      async comprobarPistas(id) {
        registrar('biblioteca.comprobarPistas', id)
        return id === cancion.id ? resumen() : null
      },
      async obtener(id) {
        registrar('biblioteca.obtener', id)
        return id === cancion.id ? structuredClone(cancion) : null
      },
      async guardarEstilo(id, estilo) {
        registrar('biblioteca.guardarEstilo', id, estilo)
        exigirId(id)
        cancion.estilo = structuredClone(estilo)
        return publicar()
      },
      async marcarLista(id) {
        registrar('biblioteca.marcarLista', id)
        exigirId(id)
        if (!puedeMarcarseLista(cancion)) throw error('ARGUMENTOS_NO_VALIDOS')
        cancion.estado = 'lista'
        cancion.pasos.edicion = {
          estado: 'completado',
          actualizado: cancion.modificada,
          error: null
        }
        return publicar()
      },
      async volverABorrador(id) {
        registrar('biblioteca.volverABorrador', id)
        exigirId(id)
        cancion.estado = 'borrador'
        return publicar()
      }
    },
    letras: {
      async abrirEdicion(id) {
        registrar('letras.abrirEdicion', id)
        sesionActiva = id === cancion.id ? crypto.randomUUID() : null
        return sesionActiva ? { cancion: structuredClone(cancion), sesionId: sesionActiva } : null
      },
      async cerrarEdicion(id) {
        registrar('letras.cerrarEdicion', id)
        if (sesionActiva === id) sesionActiva = null
      },
      async guardarTiempos(peticion, sesionId) {
        registrar('letras.guardarTiempos', peticion, sesionId)
        exigirId(peticion.cancionId)
        const { letra } = cancion
        const { tiempos, offset_ms } = peticion
        if (
          sesionId !== sesionActiva ||
          !letra ||
          letra.lineas.length !== tiempos.length ||
          letra.lineas.some((linea, i) => linea.id !== tiempos[i]?.id)
        )
          throw error('LETRA_DESACTUALIZADA')
        const resultado = letraSchema.safeParse({
          ...letra,
          offset_ms,
          lineas: letra.lineas.map((linea, i) => ({ ...linea, ...tiempos[i] }))
        })
        if (!resultado.success) throw error('ARGUMENTOS_NO_VALIDOS')
        cancion.letra = resultado.data
        return publicar()
      }
    },
    config: {
      async obtener() {
        registrar('config.obtener')
        return structuredClone(config)
      },
      async actualizar(cambio) {
        registrar('config.actualizar', cambio)
        if (cambio.reproductor) Object.assign(config.reproductor, cambio.reproductor)
        if (cambio.estilo_predeterminado) {
          config.estilo_predeterminado = structuredClone(cambio.estilo_predeterminado)
        }
        return structuredClone(config)
      }
    },
    app: {
      async guardadoPendiente(pendiente) {
        registrar('app.guardadoPendiente', pendiente)
      }
    },
    trabajos: {
      async listar() {
        registrar('trabajos.listar')
        return structuredClone(opciones.trabajos ?? [])
      },
      alCambiar: () => () => undefined,
      alProgreso: () => () => undefined
    },
    alCambiarCancion(oyente) {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    }
  }

  return {
    api,
    llamadas,
    emitirCambio,
    fallar: (metodo, codigo, veces = 1) => fallos.set(metodo, { codigo, veces })
  }
}
