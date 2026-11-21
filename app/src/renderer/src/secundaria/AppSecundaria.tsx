import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiReproductor } from '@shared/ipc'
import type {
  ComandoSecundariaIpc,
  EntradaCargarIpc,
  EstadoSecundariaIpc,
  FaseSesion,
  InformeSecundariaIpc
} from '@shared/sesion'
import type { MotorReproductor, OpcionesMotorReproductor } from '../karaoke/motorReproductor'
import {
  Reproductor,
  type ControlSesion,
  type InformeMotor
} from '../vistas/reproductor/Reproductor'
import { R } from '../vistas/reproductor/textos'
import {
  PantallaEstadoSesion,
  type UltimaEntrada
} from '../vistas/reproductor/sesion/PantallaEstadoSesion'
import { DialogoCierreSesion } from './DialogoCierreSesion'
import { useVolumenSecundaria } from './useVolumenSecundaria'

/** Fases que se pintan con S1–S4 en lugar del reproductor. */
const FASES_DE_ESTADO: ReadonlySet<FaseSesion> = new Set([
  'transicion',
  'espera',
  'fin_de_cola',
  'error'
])

interface Activa {
  clave: number
  entrada: EntradaCargarIpc
  desdeMs: number
  pausada: boolean
  anuncio: 'inicio' | 'reanudacion'
  /** Revisión del comando `cargar`: un estado anterior no puede sustituir al reproductor. */
  revision: number
  /** El motor ya informó `fin`: un `cargar` de la misma entrada es una repetición, no un duplicado. */
  terminada: boolean
}

export interface PropsAppSecundaria {
  /** Por defecto, la API del preload (`window.shinobiReproductor`). */
  api?: ApiReproductor
  crearMotor?: (o: OpcionesMotorReproductor) => MotorReproductor
}

function esEstadoSecundaria(e: unknown): e is EstadoSecundariaIpc {
  return (
    typeof e === 'object' &&
    e !== null &&
    'sesionId' in e &&
    typeof (e as { pendientes?: unknown }).pendientes === 'number'
  )
}

/**
 * Anfitrión de la ventana secundaria (ADR 0017 §10): traduce los comandos de main al único
 * `MotorReproductor` de la sesión (dentro de `Reproductor` con `origen: 'sesion'`), informa a main y
 * pinta S1–S4 y el diálogo de cierre a partir de `EstadoSecundariaIpc`.
 */
export function AppSecundaria({ api = window.shinobiReproductor, crearMotor }: PropsAppSecundaria) {
  const volumen = useVolumenSecundaria(api)
  const [estado, setEstado] = useState<EstadoSecundariaIpc | null>(null)
  const [activa, setActiva] = useState<Activa | null>(null)
  const [ultima, setUltima] = useState<UltimaEntrada | null>(null)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)

  const sesionId = useRef<string | null>(null)
  const activaRef = useRef<Activa | null>(null)
  const revisionComando = useRef(-1)
  const revisionEstado = useRef(-1)
  const contador = useRef(0)
  const control = useRef<ControlSesion | null>(null)

  const fijarActiva = useCallback((siguiente: Activa | null) => {
    activaRef.current = siguiente
    setActiva(siguiente)
  }, [])

  useEffect(() => {
    document.title = R.cola.ventana
  }, [])

  useEffect(() => {
    let vivo = true
    const antesDeInicial: ComandoSecundariaIpc[] = []

    const aplicarEstado = (e: EstadoSecundariaIpc) => {
      if (!vivo || e.revision < revisionEstado.current) return
      if (sesionId.current !== null && e.sesionId !== sesionId.current) return
      revisionEstado.current = e.revision
      setEstado(e)
      const actual = activaRef.current
      if (actual && FASES_DE_ESTADO.has(e.fase) && e.revision > actual.revision) fijarActiva(null)
    }

    const aplicarComando = (c: ComandoSecundariaIpc) => {
      // Comandos de otra sesión, o más antiguos que el último aplicado, se descartan.
      if (c.sesionId !== sesionId.current || c.revision < revisionComando.current) return
      revisionComando.current = c.revision
      const actual = activaRef.current
      switch (c.tipo) {
        case 'cargar': {
          // Un `cargar` repetido de la entrada en curso no reinicia el audio.
          if (actual && actual.entrada.entradaId === c.entrada.entradaId && !actual.terminada)
            return
          setUltima({
            titulo: c.entrada.titulo,
            artista: c.entrada.artista,
            estilo: c.entrada.estilo
          })
          fijarActiva({
            clave: ++contador.current,
            entrada: c.entrada,
            desdeMs: c.desdeMs,
            pausada: c.pausada,
            anuncio: c.anuncio,
            revision: c.revision,
            terminada: false
          })
          break
        }
        case 'pausar':
        case 'reanudar':
        case 'reiniciar':
          // El transporte de otra entrada no actúa.
          if (actual?.entrada.entradaId !== c.entradaId) return
          if (c.tipo === 'pausar') control.current?.pausar()
          else if (c.tipo === 'reanudar') control.current?.reanudar()
          else control.current?.reiniciar()
          break
        case 'transicion':
          if (c.transicion) fijarActiva(null)
          break
        case 'fin_de_cola':
        case 'error':
          fijarActiva(null)
          break
      }
    }

    const bajas = [
      api.alComando((c) => {
        if (!vivo) return
        if (sesionId.current === null) antesDeInicial.push(c)
        else aplicarComando(c)
      }),
      api.alEstado(aplicarEstado),
      api.ventana.alCambiarPantallaCompleta((activa) => vivo && setPantallaCompleta(activa))
    ]

    void api.sesion
      .inicial()
      .then((inicial) => {
        if (!vivo) return
        sesionId.current = inicial.sesionId
        aplicarEstado(inicial.estado)
        if (inicial.comandoActual) aplicarComando(inicial.comandoActual)
        for (const c of antesDeInicial.splice(0)) aplicarComando(c)
      })
      .catch(() => undefined)
    void api.ventana
      .estaEnPantallaCompleta()
      .then((activa) => vivo && setPantallaCompleta((previa) => previa || activa))
      .catch(() => undefined)

    return () => {
      vivo = false
      for (const baja of bajas) baja()
    }
  }, [api, fijarActiva])

  const informar = useCallback(
    (a: Activa, informe: InformeMotor) => {
      const id = sesionId.current
      if (id === null) return
      if (informe.tipo === 'fin' && activaRef.current?.clave === a.clave) a.terminada = true
      const completo: InformeSecundariaIpc = {
        ...informe,
        sesionId: id,
        entradaId: a.entrada.entradaId
      } as InformeSecundariaIpc
      void api.sesion.informar(completo).catch(() => undefined)
    },
    [api]
  )

  const aplicarRespuesta = useCallback((e: unknown) => {
    if (esEstadoSecundaria(e)) {
      if (e.revision >= revisionEstado.current) {
        revisionEstado.current = e.revision
        setEstado(e)
      }
    }
  }, [])
  const sinError = (peticion: Promise<unknown>) =>
    peticion.then(aplicarRespuesta).catch(() => undefined)

  const alCerrar = () => void sinError(api.sesion.cierre.solicitar())
  const alPantallaCompleta = (activa: boolean) =>
    void api.ventana.fijarPantallaCompleta(activa).catch(() => undefined)

  if (!estado || !volumen) return <div data-testid="secundaria-cargando" />

  // Ids de los botones (ADR 0017 §10, revisión 2): el estado de main es la fuente de verdad.
  const idCandidata = (): string | null => estado.candidata?.entradaId ?? null
  const idParaAvanzar = (): string | null => estado.activa?.entradaId ?? null
  /** Solo actúa si hay una entrada de referencia; main ignora lo demás. */
  const conId = (id: string | null, accion: (id: string) => Promise<unknown>) =>
    id === null ? undefined : void sinError(accion(id))
  const cierreAbierto = estado.cierrePendiente?.origen === 'secundaria'

  return (
    <>
      {activa ? (
        <Reproductor
          key={activa.clave}
          cancion={{
            id: activa.entrada.cancionId,
            titulo: activa.entrada.titulo,
            artista: activa.entrada.artista,
            duracionMs: activa.entrada.duracionMs,
            gananciaDb: activa.entrada.gananciaDb,
            letra: activa.entrada.letra,
            estilo: activa.entrada.estilo,
            lineasSinSincronizar: activa.entrada.lineasSinSincronizar
          }}
          origen="sesion"
          modo="karaoke"
          desdeMs={activa.desdeMs}
          volumen={volumen}
          alSalir={() => undefined}
          crearMotor={crearMotor}
          sesion={{
            pausada: activa.pausada,
            anuncio: activa.anuncio,
            silencioPrevio: activa.entrada.silencioPrevio,
            hayPendientes: estado.pendientes > 0,
            ventana: api.ventana,
            control,
            informar: (i) => informar(activa, i),
            alSiguiente: () => void sinError(api.sesion.siguiente(activa.entrada.entradaId)),
            alCerrar
          }}
        />
      ) : (
        <PantallaEstadoSesion
          estado={estado}
          ultima={ultima}
          tituloFallo={estado.activa?.titulo ?? null}
          volumen={volumen}
          pantallaCompleta={pantallaCompleta}
          teclasActivas={!cierreAbierto}
          alEmpezar={() => conId(idCandidata(), api.sesion.empezar)}
          alDetener={(id) => void sinError(api.sesion.detenerTransicion(id))}
          alPasar={() => conId(idParaAvanzar(), api.sesion.siguiente)}
          alOtraVez={() => conId(idParaAvanzar(), api.sesion.repetir)}
          alCerrar={alCerrar}
          alPantallaCompleta={alPantallaCompleta}
        />
      )}
      {cierreAbierto && (
        <DialogoCierreSesion
          alConfirmar={(cola) => api.sesion.cierre.confirmar(cola, estado.revision)}
          pendientes={estado.pendientes}
          alCancelar={() => void api.sesion.cierre.cancelar().catch(() => undefined)}
        />
      )}
    </>
  )
}
