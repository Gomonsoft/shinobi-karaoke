import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Cancion } from '@shared/cancion'
import type { Config } from '@shared/config'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import {
  contador,
  indiceLineaActual,
  lineaVecina,
  primeraSinInicio,
  tiempoMostrado
} from '@shared/letras/tiempos'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { mostrarToast } from '../../componentes/gestorToasts'
import { PantallaLetra } from '../../karaoke/PantallaLetra'
import type { Pista } from '../../karaoke/pistas'
import { useMotorAudio } from '../../karaoke/useMotorAudio'
import { useNavegacion } from '../../navegacion/estado'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import { CabeceraCancion } from '../cancion/CabeceraCancion'
import { BannerSincronizar } from './BannerSincronizar'
import { DialogoAtajos } from './DialogoAtajos'
import { ListaLineas } from './ListaLineas'
import { PanelEstilo } from './PanelEstilo'
import { PanelSincronia } from './PanelSincronia'
import { Transporte, type SeparacionEditor } from './Transporte'
import { estadoInicial, puedeDeshacer, puedeRehacer, reducirEditor } from './estado'
import { E } from './textos'
import { useAtajosEditor } from './useAtajosEditor'
import { useGuardadoEditor } from './useGuardadoEditor'
import estilos from './editor.module.css'

type Carga = { cancion: Cancion; config: Config; resumen: ResumenCancionIpc }
type Pestana = 'sincronia' | 'estilo'
const VACIA: Letra = { origen: 'manual', lrclib_id: null, offset_ms: 0, lineas: [] }

function seleccionarInicial(letra: Letra): string | null {
  return primeraSinInicio(letra) ?? lineaVecina(letra, null, 1)
}

export function desdeLinea(letra: Letra, id: string): number {
  const indice = letra.lineas.findIndex((l) => l.id === id)
  const inicio = letra.lineas[indice]?.inicio_ms
  if (inicio != null) return Math.max(0, tiempoMostrado(inicio, letra.offset_ms) - 2000)
  for (let i = indice - 1; i >= 0; i--) {
    const previo = letra.lineas[i]?.inicio_ms
    if (previo != null) return tiempoMostrado(previo, letra.offset_ms)
  }
  return 0
}

export function Editor({ id }: { id: string }) {
  const { ir } = useNavegacion()
  const [carga, setCarga] = useState<Carga | 'error' | null>(null)
  const sesion = useRef<string | null>(null)
  const generacion = useRef(0)
  const [resumenVivo, setResumenVivo] = useState<ResumenCancionIpc | null>(null)

  const leerVisita = useCallback(async (): Promise<Cancion | null> => {
    const vigente = generacion.current
    const visita = await window.shinobi.letras.abrirEdicion(id)
    if (vigente !== generacion.current) {
      if (visita) void window.shinobi.letras.cerrarEdicion(visita.sesionId).catch(() => undefined)
      return null
    }
    sesion.current = visita?.sesionId ?? null
    return visita?.cancion ?? null
  }, [id])

  useEffect(() => {
    const api = window.shinobi
    const vigente = ++generacion.current
    const baja = api.alCambiarCancion((evento) => {
      if (evento.id === id) {
        if (evento.eliminada) setCarga('error')
        else setResumenVivo(evento.resumen)
      }
    })
    void Promise.all([leerVisita(), api.biblioteca.listar(), api.config.obtener()]).then(
      ([cancion, lista, config]) => {
        if (vigente !== generacion.current) return
        const resumen = lista.find((c) => c.id === id)
        setCarga(cancion && resumen ? { cancion, resumen, config } : 'error')
      },
      () => {
        if (vigente === generacion.current) setCarga('error')
      }
    )
    return () => {
      generacion.current = vigente + 1
      baja()
      const token = sesion.current
      sesion.current = null
      if (token) void api.letras.cerrarEdicion(token).catch(() => undefined)
    }
  }, [id, leerVisita])

  const obtenerSesion = useCallback(() => sesion.current, [])
  const biblioteca = () => ir({ tipo: 'biblioteca' })
  const irALetra = () => ir({ tipo: 'cancion', id, paso: 'letra' })
  if (!carga) return <p>{E.cargando}</p>
  if (carga === 'error')
    return (
      <AvisoEnLinea tipo="error" accion={<Boton onClick={biblioteca}>{E.verBiblioteca}</Boton>}>
        {E.errorAudio}
      </AvisoEnLinea>
    )
  if (contador(carga.cancion.letra ?? VACIA).total === 0)
    return (
      <AvisoEnLinea tipo="info" accion={<Boton onClick={irALetra}>{E.buscarLetra}</Boton>}>
        {E.sinLetra}
      </AvisoEnLinea>
    )
  return (
    <EditorActivo
      carga={carga}
      resumen={resumenVivo ?? carga.resumen}
      leerVisita={leerVisita}
      obtenerSesion={obtenerSesion}
    />
  )
}

function useVolumenEditor(inicial: Config['reproductor']) {
  const [reproductor, setReproductor] = useState(inicial)
  const pendiente = useRef<Config['reproductor'] | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const escribir = useCallback(() => {
    const reproductor = pendiente.current
    pendiente.current = null
    temporizador.current = undefined
    if (reproductor) void window.shinobi.config.actualizar({ reproductor }).catch(() => undefined)
  }, [])
  useEffect(
    () => () => {
      clearTimeout(temporizador.current)
      escribir()
    },
    [escribir]
  )

  function cambiar(cambio: Config['reproductor']) {
    pendiente.current = cambio
    setReproductor(cambio)
    temporizador.current ??= setTimeout(escribir, 500)
  }

  return { ...reproductor, cambiar }
}

interface PropsActiva {
  carga: Carga
  resumen: ResumenCancionIpc
  leerVisita(): Promise<Cancion | null>
  obtenerSesion(): string | null
}

function EditorActivo({ carga, resumen, leerVisita, obtenerSesion }: PropsActiva) {
  const { cancion, config } = carga
  const { id, metadatos } = cancion
  const { ir } = useNavegacion()
  const { trabajos, progreso } = useTrabajosVivos()
  const letraInicial = cancion.letra ?? VACIA
  const [edicion, despachar] = useReducer(reducirEditor, null, () =>
    estadoInicial({ letra: letraInicial, estilo: cancion.estilo }, seleccionarInicial(letraInicial))
  )
  const { letra, estilo } = edicion.actual
  const [pestana, setPestana] = useState<Pestana>('sincronia')
  const [dialogoAtajos, setDialogoAtajos] = useState(false)
  const [focoLinea, setFocoLinea] = useState(() =>
    contador(letraInicial).sincronizadas > 0 ? 1 : 0
  )
  const refSync = useRef<HTMLButtonElement>(null)
  const focoInicialSync = useRef(contador(letraInicial).sincronizadas === 0)
  const [cerradoYaSync, setCerradoYaSync] = useState(false)
  const [posicion, setPosicion] = useState(0)
  const volumen = useVolumenEditor(config.reproductor)
  const { motor, estado: audio } = useMotorAudio({
    cancionId: id,
    gananciaDb: cancion.fuente.ganancia_db ?? 0,
    volumen: volumen.silenciado ? 0 : volumen.volumen
  })

  const trabajo = trabajos.find((t) => t.cancionId === id && t.paso === 'separacion')
  const paso = resumen.pasos?.separacion
  const avance = trabajo ? (progreso[trabajo.id] ?? trabajo.progreso) : null
  const eta = avance?.etaSegundos
  const separacion: SeparacionEditor = {
    disponible: paso?.estado === 'completado' && !resumen.danada,
    enCola: trabajo?.estado === 'en_cola',
    porcentaje:
      paso?.estado === 'en_curso' || trabajo?.estado === 'en_curso'
        ? Math.round(100 * (avance?.valor ?? paso?.progreso ?? 0))
        : null,
    minutos: eta == null ? undefined : Math.max(1, Math.round(eta / 60))
  }

  const pistaInicial = useRef<Pista>(
    carga.resumen.pasos?.separacion.estado === 'completado' && !carga.resumen.danada
      ? 'voz'
      : 'original'
  )
  useEffect(() => {
    if (motor) void motor.usarPista(pistaInicial.current)
  }, [motor])

  useEffect(() => {
    if (focoInicialSync.current && audio?.duracionMs != null) {
      focoInicialSync.current = false
      refSync.current?.focus()
    }
  }, [audio?.duracionMs])

  const sonando = audio?.sonando ?? false
  const duracionMs = audio?.duracionMs ?? metadatos.duracion_ms
  const obtenerTiempoAudio = useCallback(() => motor?.posicionMs() ?? 0, [motor])
  useEffect(() => {
    if (!motor) return
    const actualizar = () => setPosicion(Math.floor(motor.posicionMs() / 100) * 100)
    const final = setTimeout(actualizar, 0)
    if (!sonando) return () => clearTimeout(final)
    const intervalo = setInterval(actualizar, 80)
    return () => {
      clearTimeout(final)
      clearInterval(intervalo)
    }
  }, [motor, sonando])

  const {
    estado: guardado,
    cambiarLetra,
    cambiarEstilo,
    dialogoSalida
  } = useGuardadoEditor(id, metadatos.titulo, obtenerSesion, async () => {
    motor?.pausar()
    const actual = await leerVisita()
    const nueva = actual?.letra ?? VACIA
    const seleccion = nueva.lineas.some((l) => l.id === edicion.seleccion && l.tipo === 'linea')
      ? edicion.seleccion
      : seleccionarInicial(nueva)
    despachar({ tipo: 'cargar', instantanea: { letra: nueva, estilo }, seleccion })
    mostrarToast({ tipo: 'aviso', mensaje: E.recargada, persistente: true })
  })
  const previa = useRef(edicion.actual)
  useEffect(() => {
    const ultima = previa.current
    previa.current = edicion.actual
    if (edicion.version === 0) return
    if (ultima.letra !== letra) cambiarLetra(letra)
    if (ultima.estilo !== estilo) cambiarEstilo(estilo)
  }, [edicion.actual, edicion.version, letra, estilo, cambiarLetra, cambiarEstilo])

  function buscar(ms: number) {
    if (!motor) return
    motor.buscar(ms)
    setPosicion(motor.posicionMs())
  }
  function alternar() {
    if (sonando) motor?.pausar()
    else void motor?.reproducir()
  }
  function usarPista(pista: Pista) {
    if (pista === 'original' || separacion.disponible) void motor?.usarPista(pista)
  }
  function escuchar(id: string) {
    if (!edicion.sync.activo) void motor?.reproducir({ desdeMs: desdeLinea(letra, id) })
  }
  function seleccionar(id: string, enfocar = false) {
    despachar(edicion.sync.activo ? { tipo: 'sync_siguiente', id } : { tipo: 'seleccionar', id })
    if (enfocar) {
      setPestana('sincronia')
      setFocoLinea((n) => n + 1)
    }
  }

  useAtajosEditor(edicion.sync.activo, (accion) => {
    switch (accion.tipo) {
      case 'reproducir':
        alternar()
        break
      case 'principio':
        buscar(0)
        break
      case 'buscar':
        buscar(obtenerTiempoAudio() + accion.deltaMs)
        break
      case 'pista':
        usarPista(accion.pista)
        break
      case 'mover_seleccion':
        despachar(accion)
        setPestana('sincronia')
        setFocoLinea((n) => n + 1)
        break
      case 'deshacer':
        despachar({ tipo: 'deshacer' })
        break
      case 'rehacer':
        despachar({ tipo: 'rehacer' })
        break
      case 'atajos':
        setDialogoAtajos(true)
        break
      case 'escapar':
        ir({ tipo: 'biblioteca' })
        break
    }
  })

  useEffect(() => {
    if (!edicion.sync.activo) return
    const pausarAlPerderFoco = () => motor?.pausar()
    window.addEventListener('blur', pausarAlPerderFoco)
    return () => window.removeEventListener('blur', pausarAlPerderFoco)
  }, [motor, edicion.sync.activo])

  const irALetra = () => ir({ tipo: 'cancion', id, paso: 'letra' })
  const cuentas = contador(letra)
  const todasAlEntrar = contador(letraInicial).sincronizadas === contador(letraInicial).total
  const banner =
    cuentas.sincronizadas === 0 ? (
      <AvisoEnLinea tipo="info">{E.sinSync}</AvisoEnLinea>
    ) : todasAlEntrar &&
      resumen.estado === 'borrador' &&
      letra === letraInicial &&
      !cerradoYaSync ? (
      <AvisoEnLinea
        tipo="info"
        accion={
          <BotonIcono icono={X} etiqueta="Cerrar aviso" onClick={() => setCerradoYaSync(true)} />
        }
      >
        {E.yaSync}
      </AvisoEnLinea>
    ) : undefined

  return (
    <div className={estilos.editor} data-pestana={pestana}>
      <a
        className="saltar-al-contenido"
        href="#lineas-editor"
        onClick={(e) => {
          e.preventDefault()
          setPestana('sincronia')
          setFocoLinea((n) => n + 1)
        }}
      >
        Saltar al contenido
      </a>
      <h1 className={estilos.soloLector}>Editor</h1>
      <header role="banner">
        <CabeceraCancion
          resumen={resumen}
          actual="editor"
          guardado={guardado}
          incompleta={cuentas.total - cuentas.sincronizadas}
          historial={{
            puedeDeshacer: puedeDeshacer(edicion),
            puedeRehacer: puedeRehacer(edicion),
            alDeshacer: () => despachar({ tipo: 'deshacer' }),
            alRehacer: () => despachar({ tipo: 'rehacer' })
          }}
          menu={[
            { id: 'atajos', etiqueta: E.menuAtajos, alSeleccionar: () => setDialogoAtajos(true) }
          ]}
        />
      </header>
      {cuentas.total === 0 ? (
        <AvisoEnLinea tipo="info" accion={<Boton onClick={irALetra}>{E.buscarLetra}</Boton>}>
          {E.sinLetra}
        </AvisoEnLinea>
      ) : (
        <div className={estilos.cuerpo}>
          <ListaLineas
            letra={letra}
            seleccion={edicion.seleccion}
            actual={sonando ? indiceLineaActual(letra, posicion) : -1}
            foco={focoLinea}
            seleccionar={seleccionar}
            escuchar={escuchar}
            corregir={irALetra}
            banner={banner}
          />
          <section
            className={estilos.previa}
            aria-label={E.previa}
            aria-describedby="descripcion-previa"
          >
            <h2>{E.previa}</h2>
            <p id="descripcion-previa" className={estilos.soloLector}>
              {E.previaAria}
            </p>
            <div className={estilos.pantalla}>
              <PantallaLetra
                letra={letra}
                estilo={estilo}
                duracionMs={duracionMs}
                titulo={metadatos.titulo}
                artista={metadatos.artista}
                idEstatico={edicion.seleccion}
                reproduciendo={sonando}
                obtenerTiempoAudio={obtenerTiempoAudio}
              />
            </div>
          </section>
          <div className={estilos.pestanas} data-foco-editor="segmentado">
            <ControlSegmentado
              etiqueta="Panel del editor"
              valor={pestana}
              opciones={[
                { valor: 'sincronia', etiqueta: 'Sincronía' },
                { valor: 'estilo', etiqueta: 'Estilo' }
              ]}
              onCambio={setPestana}
            />
          </div>
          <div className={estilos.panel}>
            {pestana === 'sincronia' ? (
              <section aria-label="Ajuste de sincronía">
                <PanelSincronia />
              </section>
            ) : (
              <aside aria-label="Estilo">
                <PanelEstilo />
              </aside>
            )}
          </div>
        </div>
      )}
      {audio?.error && (
        <AvisoEnLinea
          tipo="error"
          accion={<Boton onClick={() => ir({ tipo: 'biblioteca' })}>{E.verBiblioteca}</Boton>}
        >
          {E.errorAudio}
        </AvisoEnLinea>
      )}
      <Transporte
        estado={audio}
        posicionMs={posicion}
        duracionMs={duracionMs}
        letra={letra}
        separacion={separacion}
        volumen={volumen.volumen}
        silenciado={volumen.silenciado}
        usarPista={usarPista}
        reproducir={alternar}
        buscar={buscar}
        fijarVelocidad={(v) => motor?.fijarVelocidad(v)}
        fijarVolumen={(v) => volumen.cambiar({ volumen: v, silenciado: volumen.silenciado })}
        alternarSilencio={() =>
          volumen.cambiar({ volumen: volumen.volumen, silenciado: !volumen.silenciado })
        }
        entrarSync={() => undefined}
        refSync={refSync}
        acciones={
          <Boton variante="primario" disabled>
            {resumen.estado === 'lista' ? E.hecho : E.marcarLista}
          </Boton>
        }
        bannerSync={edicion.sync.activo ? <BannerSincronizar /> : undefined}
      />
      <DialogoAtajos abierto={dialogoAtajos} cerrar={() => setDialogoAtajos(false)} />
      {dialogoSalida}
    </div>
  )
}
