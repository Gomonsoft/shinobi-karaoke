/**
 * Dobles de la fase 4 para las pruebas del renderer (0182–0187): estados de la sesión para cada
 * pantalla de la spec 02 (P1–P6) y de la secundaria (spec 07, S1–S4), y una `ApiReproductor` falsa.
 * Cada constructor devuelve objetos nuevos.
 */
import type { ApiReproductor } from '../ipc'
import { configPredeterminada } from '../config'
import { estiloPredeterminado } from '../estilo'
import type {
  ComandoSecundariaIpc,
  EntradaIpc,
  EstadoSecundariaIpc,
  EstadoSesionIpc,
  InformeSecundariaIpc,
  PantallaIpc,
  SesionActivaIpc
} from '../sesion'

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const SESION_ID = uuid(900)
export const TRANSICION_ID = uuid(901)

export function entrada(n: number, extra: Partial<EntradaIpc> = {}): EntradaIpc {
  return {
    entradaId: uuid(n),
    cancionId: `cancion-${n}`,
    titulo: `Canción ${n}`,
    artista: `Artista ${n}`,
    disponibilidad: 'ok',
    ...extra
  }
}

export function pantalla(n = 2, extra: Partial<PantallaIpc> = {}): PantallaIpc {
  return {
    id: 1000 + n,
    etiqueta: `Pantalla ${n}`,
    ancho: 1920,
    alto: 1080,
    escala: 1,
    principal: n === 1,
    conVentanaPrincipal: n === 1,
    ...extra
  }
}

function sesion(extra: Partial<SesionActivaIpc> = {}): SesionActivaIpc {
  return {
    sesionId: SESION_ID,
    fase: 'reproduciendo',
    pantalla: pantalla(2),
    pantallaCompleta: true,
    cierrePendiente: null,
    transicion: null,
    error: null,
    incidencia: null,
    ...extra
  }
}

const vacio = (): EstadoSesionIpc => ({
  revision: 1,
  sesion: null,
  activa: null,
  pendientes: [],
  contexto: null,
  incidencia: null
})

/** P1 · Sesión, reproduciendo: activa 1 y dos pendientes. */
export function estadoP1(extra: Partial<EstadoSesionIpc> = {}): EstadoSesionIpc {
  return {
    ...vacio(),
    revision: 5,
    sesion: sesion(),
    activa: { ...entrada(1), posicionMs: 42_000, duracionMs: 180_000 },
    pendientes: [entrada(2), entrada(3)],
    ...extra
  }
}

/** P2 · Cuenta entre canciones hacia la entrada 2. */
export function estadoP2(extra: Partial<EstadoSesionIpc> = {}): EstadoSesionIpc {
  return {
    ...vacio(),
    revision: 8,
    sesion: sesion({
      fase: 'transicion',
      transicion: {
        transicionId: TRANSICION_ID,
        candidataId: uuid(2),
        restanteMs: 3000,
        duracionMs: 4000,
        congelada: false
      }
    }),
    pendientes: [entrada(2), entrada(3)],
    contexto: { entrada: entrada(1), posicionMs: null, pausada: false, terminada: true },
    ...extra
  }
}

/** P3 · Fallo de la entrada activa; quedan pendientes. */
export function estadoP3(extra: Partial<EstadoSesionIpc> = {}): EstadoSesionIpc {
  return {
    ...vacio(),
    revision: 9,
    sesion: sesion({
      fase: 'error',
      error: { entradaId: uuid(1), motivo: 'sin_pistas', codigo: 'SIN_PISTAS' }
    }),
    activa: { ...entrada(1), posicionMs: 0, duracionMs: 180_000 },
    pendientes: [entrada(2)],
    ...extra
  }
}

/** P4 · En espera con candidata (sin cuenta). `estadoP4FinDeCola` es el fin de la cola. */
export function estadoP4(extra: Partial<EstadoSesionIpc> = {}): EstadoSesionIpc {
  return {
    ...vacio(),
    revision: 10,
    sesion: sesion({ fase: 'espera' }),
    pendientes: [entrada(2)],
    contexto: { entrada: entrada(1), posicionMs: null, pausada: false, terminada: true },
    ...extra
  }
}

export function estadoP4FinDeCola(extra: Partial<EstadoSesionIpc> = {}): EstadoSesionIpc {
  return estadoP4({ sesion: sesion({ fase: 'fin_de_cola' }), pendientes: [], ...extra })
}

/** P5 · Sin sesión, cola conservada con la última reproducida a mitad de canción. */
export function estadoP5(extra: Partial<EstadoSesionIpc> = {}): EstadoSesionIpc {
  return {
    ...vacio(),
    revision: 12,
    pendientes: [entrada(2), entrada(3)],
    contexto: { entrada: entrada(1), posicionMs: 95_000, pausada: false, terminada: false },
    ...extra
  }
}

/** P6 · Sin sesión, preparando la cola (sin última reproducida). */
export function estadoP6(extra: Partial<EstadoSesionIpc> = {}): EstadoSesionIpc {
  return { ...vacio(), revision: 2, pendientes: [entrada(1), entrada(2)], ...extra }
}

/** Sin sesión y sin cola. */
export function estadoSinCola(extra: Partial<EstadoSesionIpc> = {}): EstadoSesionIpc {
  return { ...vacio(), ...extra }
}

function secundaria(extra: Partial<EstadoSecundariaIpc> = {}): EstadoSecundariaIpc {
  return {
    revision: 1,
    sesionId: SESION_ID,
    fase: 'transicion',
    candidata: { titulo: 'Canción 2', artista: 'Artista 2', estilo: estiloPredeterminado() },
    transicion: {
      transicionId: TRANSICION_ID,
      restanteMs: 3000,
      duracionMs: 4000,
      congelada: false
    },
    hayPendientes: true,
    cierrePendiente: null,
    motivoFallo: null,
    ...extra
  }
}

/** S1 · Cuenta hacia la siguiente. */
export const estadoS1 = (extra: Partial<EstadoSecundariaIpc> = {}): EstadoSecundariaIpc =>
  secundaria(extra)

/** S2 · En espera con candidata. */
export const estadoS2 = (extra: Partial<EstadoSecundariaIpc> = {}): EstadoSecundariaIpc =>
  secundaria({ fase: 'espera', transicion: null, ...extra })

/** S3 · Fin de la cola. */
export const estadoS3 = (extra: Partial<EstadoSecundariaIpc> = {}): EstadoSecundariaIpc =>
  secundaria({
    fase: 'fin_de_cola',
    candidata: null,
    transicion: null,
    hayPendientes: false,
    ...extra
  })

/** S4 · Fallo de la entrada. */
export const estadoS4 = (extra: Partial<EstadoSecundariaIpc> = {}): EstadoSecundariaIpc =>
  secundaria({
    fase: 'error',
    candidata: null,
    transicion: null,
    motivoFallo: 'sin_pistas',
    ...extra
  })

/** `ApiReproductor` falsa: registra las llamadas y permite emitir eventos desde la prueba. */
export interface ApiReproductorFalsa {
  api: ApiReproductor
  /** Llamadas recibidas, como `[método, ...argumentos]`. */
  llamadas: unknown[][]
  informes: InformeSecundariaIpc[]
  emitirComando(comando: ComandoSecundariaIpc): void
  emitirEstado(estado: EstadoSecundariaIpc): void
  emitirPreferencias(preferencias: ReturnType<typeof configPredeterminada>['reproductor']): void
  emitirPantallaCompleta(activa: boolean): void
}

export function crearApiReproductorFalsa(
  estado: EstadoSecundariaIpc = estadoS1()
): ApiReproductorFalsa {
  const llamadas: unknown[][] = []
  const informes: InformeSecundariaIpc[] = []
  const comandos = new Set<(c: ComandoSecundariaIpc) => void>()
  const estados = new Set<(e: EstadoSecundariaIpc) => void>()
  const prefs = new Set<(p: ReturnType<typeof configPredeterminada>['reproductor']) => void>()
  const completas = new Set<(a: boolean) => void>()
  let preferencias = configPredeterminada().reproductor

  const registrar =
    <A extends unknown[], R>(nombre: string, resultado: (...args: A) => R) =>
    (...args: A): Promise<Awaited<R>> => {
      llamadas.push([nombre, ...args])
      return Promise.resolve(resultado(...args)) as Promise<Awaited<R>>
    }
  const suscripcion =
    <T>(conjunto: Set<(v: T) => void>) =>
    (cb: (v: T) => void): (() => void) => {
      conjunto.add(cb)
      return () => {
        conjunto.delete(cb)
      }
    }

  const api: ApiReproductor = {
    sesion: {
      inicial: registrar('sesion.inicial', () => ({
        sesionId: SESION_ID,
        comandoActual: null,
        estado
      })),
      informar: registrar('sesion.informar', (informe: InformeSecundariaIpc) => {
        informes.push(informe)
        return { aplicado: true }
      }),
      siguiente: registrar('sesion.siguiente', () => estado),
      empezar: registrar('sesion.empezar', () => estado),
      detenerTransicion: registrar('sesion.detenerTransicion', () => estado),
      repetir: registrar('sesion.repetir', () => estado),
      cierre: {
        solicitar: registrar('sesion.cierre.solicitar', () => estado),
        confirmar: registrar('sesion.cierre.confirmar', () => undefined),
        cancelar: registrar('sesion.cierre.cancelar', () => undefined)
      },
      preferencias: registrar('sesion.preferencias', () => preferencias),
      guardarPreferencias: registrar('sesion.guardarPreferencias', (parcial) => {
        preferencias = { ...preferencias, ...parcial }
        return preferencias
      })
    },
    ventana: {
      fijarPantallaCompleta: registrar('ventana.fijarPantallaCompleta', () => undefined),
      estaEnPantallaCompleta: registrar('ventana.estaEnPantallaCompleta', () => false),
      alCambiarPantallaCompleta: suscripcion(completas)
    },
    alComando: suscripcion(comandos),
    alEstado: suscripcion(estados),
    alPreferencias: suscripcion(prefs)
  }

  return {
    api,
    llamadas,
    informes,
    emitirComando: (c) => comandos.forEach((cb) => cb(c)),
    emitirEstado: (e) => estados.forEach((cb) => cb(e)),
    emitirPreferencias: (p) => prefs.forEach((cb) => cb(p)),
    emitirPantallaCompleta: (a) => completas.forEach((cb) => cb(a))
  }
}
