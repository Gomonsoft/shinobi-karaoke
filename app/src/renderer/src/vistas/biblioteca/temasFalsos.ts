import { ESTILO_PREDETERMINADO } from '@shared/estilo'
import type {
  ApiShinobi,
  CatalogoIpc,
  ErrorIpc,
  ImpactoIpc,
  OperacionTema,
  ProgresoTemaIpc,
  ResultadoOperacionIpc,
  TemaIpc
} from '@shared/ipc'
import type { CodigoError } from '@shared/index'

/**
 * Doble de `window.shinobi.temas` (y de `alCambiarTemas`) para las pruebas del renderer (0164): un
 * catálogo en memoria con impactos, resultados, fallos y progreso programables, sin pasar por main.
 */

export const ID_TEMA_PRUEBA = '0b9f7a4e-3c1d-4f6a-9d2e-5a8b1c7e4f30'
export const FICHA_PRUEBA = '5d2c8f10-7b3a-4e1d-8c6f-2a9e0b4d7c11'

type TemaCatalogoIpc = CatalogoIpc['temas'][number]

/** Tema del catálogo con valores por defecto; `cambios` los sustituye. */
export function temaCatalogoPrueba(cambios: Partial<TemaCatalogoIpc> = {}): TemaCatalogoIpc {
  return {
    id: ID_TEMA_PRUEBA,
    nombre: 'Noche ninja',
    revision: 1,
    estilo: structuredClone(ESTILO_PREDETERMINADO),
    enBorrado: false,
    usos: {
      total: 0,
      cancion: 0,
      album: 0,
      artista: 0,
      predeterminado: 0,
      aleatorio: 0,
      predeterminadoAnterior: 0
    },
    grupos: { artistas: [], albumes: [] },
    ...cambios
  }
}

export function catalogoPrueba(cambios: Partial<CatalogoIpc> = {}): CatalogoIpc {
  return {
    temas: [temaCatalogoPrueba()],
    predeterminado: null,
    predeterminadoUsos: 0,
    asignaciones: { artistas: [], albumes: [] },
    borradoPendiente: null,
    soloLectura: false,
    apartado: null,
    referenciasFaltantes: 0,
    ...cambios
  }
}

export function impactoPrueba(cambios: Partial<ImpactoIpc> = {}): ImpactoIpc {
  return {
    ficha: FICHA_PRUEBA,
    afectadas: [],
    desglose: {
      cancion: 0,
      album: 0,
      artista: 0,
      predeterminado: 0,
      aleatorio: 0,
      predeterminadoAnterior: 0,
      propio: 0,
      respaldo: 0,
      incluido: 0
    },
    excluidas: { propio: 0, cancion: 0, album: 0 },
    totalGrupo: null,
    esPredeterminado: false,
    asignacionesRetiradas: { artistas: [], albumes: [] },
    revisionTema: null,
    sesionEnCurso: false,
    ...cambios
  }
}

/** Entrada programable de un resultado: `titulo` y `artista` se rellenan con '' si faltan. */
type CancionResultadoProgramada = Omit<
  ResultadoOperacionIpc['canciones'][number],
  'titulo' | 'artista'
> &
  Partial<Pick<ResultadoOperacionIpc['canciones'][number], 'titulo' | 'artista'>>
type ResultadoProgramado = {
  catalogoEscrito: boolean
  canciones: CancionResultadoProgramada[]
}

type Respuesta<T> = T | ((op: OperacionTema) => T)

type ApiTemas = Pick<ApiShinobi, 'temas' | 'alCambiarTemas'>

export interface TemasFalsos {
  api: ApiTemas
  llamadas: { metodo: string; args: unknown[] }[]
  /** Sustituye el catálogo en memoria y avisa a los suscriptores de `alCambiarTemas`. */
  fijarCatalogo(catalogo: CatalogoIpc): void
  /** Impacto que devuelve `previsualizar` (por defecto, uno vacío con la ficha de prueba). */
  programarImpacto(impacto: Respuesta<ImpactoIpc>): void
  /** Resultado de `ejecutar` y de `reanudarBorrado` (por defecto, `aplicada` para cada id de `aplicar`). */
  programarResultado(resultado: Respuesta<ResultadoProgramado>): void
  /** Hace que el método falle `veces` veces con ese código (y `detalles`, si se indica). */
  fallar(
    metodo: string,
    codigo: CodigoError,
    opciones?: { veces?: number; detalles?: string }
  ): void
  /**
   * El siguiente `ejecutar` responde `CONFIRMACION_OBSOLETA` con `impacto` serializado en `detalles`
   * (ADR 0016 §7); los demás códigos de la fase se programan con `fallar`.
   */
  obsoleta(impacto: ImpactoIpc): void
  emitirProgreso(progreso: ProgresoTemaIpc): void
  emitirCambio(): void
}

function errorIpc(codigo: CodigoError, detalles?: string): ErrorIpc {
  return { codigo, mensaje: codigo, ...(detalles === undefined ? {} : { detalles }) }
}

/** Crea el doble. Los métodos registran la llamada antes de fallar o responder. */
export function temasFalsos(inicial: Partial<CatalogoIpc> = {}): TemasFalsos {
  let catalogo = catalogoPrueba(inicial)
  let impacto: Respuesta<ImpactoIpc> = impactoPrueba()
  let resultado: Respuesta<ResultadoProgramado> | null = null
  const llamadas: { metodo: string; args: unknown[] }[] = []
  const fallos = new Map<string, { error: ErrorIpc; veces: number }>()
  const oyentesCambio = new Set<(c: CatalogoIpc) => void>()
  const oyentesProgreso = new Set<(p: ProgresoTemaIpc) => void>()

  function registrar(metodo: string, ...args: unknown[]): void {
    llamadas.push({ metodo, args: structuredClone(args) })
    const fallo = fallos.get(metodo)
    if (!fallo) return
    if (--fallo.veces <= 0) fallos.delete(metodo)
    throw fallo.error
  }

  const completo = (r: ResultadoProgramado): ResultadoOperacionIpc => ({
    catalogoEscrito: r.catalogoEscrito,
    canciones: r.canciones.map((c) => ({ titulo: '', artista: '', ...c }))
  })

  const valor = <T>(r: Respuesta<T>, op: OperacionTema): T =>
    structuredClone(typeof r === 'function' ? (r as (o: OperacionTema) => T)(op) : r)

  function cambiado(): void {
    for (const oyente of oyentesCambio) oyente(structuredClone(catalogo))
  }

  const tema = (id: string): TemaIpc => {
    const t = catalogo.temas.find((x) => x.id === id) ?? temaCatalogoPrueba({ id })
    return structuredClone({ id: t.id, nombre: t.nombre, revision: t.revision, estilo: t.estilo })
  }

  const api: ApiTemas = {
    temas: {
      async catalogo() {
        registrar('temas.catalogo')
        return structuredClone(catalogo)
      },
      async previsualizar(op) {
        registrar('temas.previsualizar', op)
        return valor(impacto, op)
      },
      async ejecutar(op, ficha) {
        registrar('temas.ejecutar', op, ficha)
        if (resultado) return completo(valor(resultado, op))
        return {
          catalogoEscrito: op.tipo !== 'aplicar',
          canciones:
            op.tipo === 'aplicar'
              ? op.cancionIds.map((id) => ({
                  id,
                  titulo: '',
                  artista: '',
                  estado: 'aplicada' as const
                }))
              : []
        }
      },
      async crear(peticion) {
        registrar('temas.crear', peticion)
        return { ...tema(ID_TEMA_PRUEBA), nombre: peticion.nombre, estilo: peticion.estilo }
      },
      async renombrar(cambio) {
        registrar('temas.renombrar', cambio)
        return { ...tema(cambio.temaId), nombre: cambio.nombre, revision: cambio.revisionTema + 1 }
      },
      async duplicar(peticion) {
        registrar('temas.duplicar', peticion)
        return { ...tema(peticion.temaId), id: FICHA_PRUEBA, nombre: peticion.nombre, revision: 1 }
      },
      async reanudarBorrado() {
        registrar('temas.reanudarBorrado')
        const op = {
          tipo: 'borrar',
          temaId: catalogo.borradoPendiente?.temaId ?? ID_TEMA_PRUEBA
        } as const
        return completo(valor(resultado ?? { catalogoEscrito: true, canciones: [] }, op))
      },
      async cancelarBorrado() {
        registrar('temas.cancelarBorrado')
      },
      async descartarAvisoApartado() {
        registrar('temas.descartarAvisoApartado')
      },
      alProgreso(cb) {
        oyentesProgreso.add(cb)
        return () => oyentesProgreso.delete(cb)
      }
    },
    alCambiarTemas(cb) {
      oyentesCambio.add(cb)
      return () => oyentesCambio.delete(cb)
    }
  }

  return {
    api,
    llamadas,
    fijarCatalogo(nuevo) {
      catalogo = structuredClone(nuevo)
      cambiado()
    },
    programarImpacto(r) {
      impacto = r
    },
    programarResultado(r) {
      resultado = r
    },
    fallar(metodo, codigo, { veces = 1, detalles } = {}) {
      fallos.set(metodo, { error: errorIpc(codigo, detalles), veces })
    },
    obsoleta(nuevo) {
      fallos.set('temas.ejecutar', {
        error: errorIpc('CONFIRMACION_OBSOLETA', JSON.stringify(nuevo)),
        veces: 1
      })
    },
    emitirProgreso(progreso) {
      for (const oyente of oyentesProgreso) oyente({ ...progreso })
    },
    emitirCambio: cambiado
  }
}
