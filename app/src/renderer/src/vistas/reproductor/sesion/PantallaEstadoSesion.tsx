import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Keyboard, Maximize, Minimize, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import type { Estilo } from '@shared/estilo'
import type { EstadoSecundariaIpc } from '@shared/sesion'
import { BotonIcono } from '../../../componentes/BotonIcono'
import { Deslizador } from '../../../componentes/Deslizador'
import estilosComponentes from '../../../componentes/componentes.module.css'
import { Icono } from '../../../componentes/Icono'
import { Tooltip } from '../../../componentes/Tooltip'
import { fondoCssEn, variablesEstilo } from '../../../karaoke/estiloCss'
import { useMovimientoReducido } from '../../../karaoke/useMovimientoReducido'
import type { useVolumenCompartido } from '../../../karaoke/useVolumenCompartido'
import { accionDeTeclaReproductor } from '../atajos'
import { DialogoAtajosReproductor } from '../DialogoAtajosReproductor'
import { pasoVolumen, VisibilidadControles } from '../modelo'
import { R } from '../textos'
import estilos from '../reproductor.module.css'
import { CuentaTransicion } from './CuentaTransicion'
import { numeroDeCuenta } from './cuenta'
import { PantallaEspera } from './PantallaEspera'
import { PantallaFallo } from './PantallaFallo'
import { PantallaFinCola } from './PantallaFinCola'
import { TarjetaSiguiente } from './TarjetaSiguiente'
import estilosSesion from './sesion.module.css'

type Volumen = ReturnType<typeof useVolumenCompartido>

/** Lo último que la secundaria sabe de la entrada que sonó (S3 y S4 lo necesitan). */
export interface UltimaEntrada {
  titulo: string
  artista: string
  estilo: Estilo
  /** Posición del último informe de la entrada: S3 conserva la fase del fondo de ese instante. */
  posicionFinalMs?: number
}

interface Props {
  estado: EstadoSecundariaIpc
  ultima: UltimaEntrada | null
  /** Título de la entrada que falló, si la propia secundaria lo sabe. */
  tituloFallo: string | null
  volumen: Volumen
  pantallaCompleta: boolean
  /** Sin teclas ni foco propios mientras hay un diálogo encima. */
  teclasActivas: boolean
  alEmpezar(): void
  alDetener(transicionId: string): void
  alPasar(): void
  alOtraVez(): void
  alCerrar(): void
  alPantallaCompleta(activa: boolean): void
  ahora?: () => number
}

function textoAnuncio(estado: EstadoSecundariaIpc, previaTransicion: boolean): string {
  const candidata = estado.candidata
  if (estado.fase === 'transicion' && candidata && estado.transicion) {
    const n = numeroDeCuenta(estado.transicion.restanteMs)
    const dice = previaTransicion ? R.cola.aria.cambio : R.cola.aria.cuenta
    return dice(candidata.titulo, candidata.artista, n)
  }
  if (estado.fase === 'espera') return R.cola.aria.espera(candidata?.titulo)
  if (estado.fase === 'fin_de_cola') return R.cola.aria.fin
  return ''
}

/**
 * Estados S1 (cuenta), S2 (en espera), S3 (fin de la cola) y S4 (fallo) de la ventana secundaria
 * (spec 07, fase 4). Se pinta solo a partir de `EstadoSecundariaIpc`.
 */
export function PantallaEstadoSesion({
  estado,
  ultima,
  tituloFallo,
  volumen,
  pantallaCompleta,
  teclasActivas,
  alEmpezar,
  alDetener,
  alPasar,
  alOtraVez,
  alCerrar,
  alPantallaCompleta,
  ahora
}: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const visibilidad = useRef<VisibilidadControles | null>(null)
  const [visible, setVisible] = useState(true)
  const [atajosAbiertos, setAtajosAbiertos] = useState(false)
  const { fase, candidata, transicion, cierrePendiente } = estado
  const hayPendientes = estado.pendientes > 0
  const enCuenta = fase === 'transicion' && transicion !== null
  const enEspera = fase === 'espera' || (fase === 'transicion' && transicion === null)
  const enFin = fase === 'fin_de_cola'
  const enFallo = fase === 'error'

  // Anuncios `aria-live` solo en los hitos: una vez por cuenta, por cambio de candidata, espera y fin.
  const clave = enCuenta ? `t:${transicion.transicionId}` : fase
  const [claveAnterior, setClaveAnterior] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  if (clave !== claveAnterior) {
    setClaveAnterior(clave)
    setAnuncio(textoAnuncio(estado, enCuenta && (claveAnterior?.startsWith('t:') ?? false)))
  }

  useEffect(() => {
    const control = new VisibilidadControles()
    visibilidad.current = control
    const baja = control.suscribir(setVisible)
    return () => {
      baja()
      control.destruir()
      visibilidad.current = null
    }
  }, [])

  useEffect(() => {
    visibilidad.current?.fijarRetenida('atajos', atajosAbiertos)
  }, [atajosAbiertos])

  useEffect(() => {
    raiz.current?.focus({ preventScroll: true })
  }, [])

  const alTeclear = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || !teclasActivas || atajosAbiertos) return
    if (e.key === 'Tab') {
      visibilidad.current?.actividad()
      return
    }
    const accion = accionDeTeclaReproductor(e, {
      origen: 'sesion',
      vozDisponible: false,
      focoEnBoton: e.target instanceof HTMLElement && !!e.target.closest('button')
    })
    if (!accion) return
    switch (accion.tipo) {
      case 'alternar':
        if (!enCuenta && !(enEspera && candidata)) return
        alEmpezar()
        break
      case 'siguiente':
        if (!enFallo || !hayPendientes) return
        alPasar()
        break
      case 'cerrar':
        alCerrar()
        break
      case 'esc':
        if (pantallaCompleta) alPantallaCompleta(false)
        break
      case 'pantalla_completa':
        alPantallaCompleta(!pantallaCompleta)
        break
      case 'atajos':
        setAtajosAbiertos(true)
        break
      case 'silenciar':
        volumen.cambiar({ silenciado: !volumen.silenciado })
        break
      case 'volumen':
        volumen.cambiar(pasoVolumen(volumen.volumen, accion.delta))
        break
      default:
        return
    }
    e.preventDefault()
  }
  const manejador = useRef(alTeclear)
  useEffect(() => {
    manejador.current = alTeclear
  })
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => manejador.current(e)
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [])

  const estiloFondo = candidata?.estilo ?? (enFin ? ultima?.estilo : undefined)
  const conFondo = !enFallo && estiloFondo !== undefined
  const reducido = useMovimientoReducido()
  // S1, S2 y S4: fase 0 (`variablesEstilo`). S3: la fase del último instante de la última canción.
  const variablesFondo = estiloFondo
    ? {
        ...variablesEstilo(estiloFondo),
        ...(enFin && !candidata && ultima?.posicionFinalMs !== undefined
          ? {
              '--k-fondo': fondoCssEn(estiloFondo.fondo, ultima.posicionFinalMs, {
                estatico: reducido
              })
            }
          : {})
      }
    : undefined
  const retener = (motivo: string, activa: boolean) =>
    visibilidad.current?.fijarRetenida(motivo, activa)
  const franjas = enCuenta || enEspera
  const oculto = visible ? '' : estilos.oculta

  return createPortal(
    <div
      ref={raiz}
      role="region"
      aria-label={R.cola.ventana}
      tabIndex={-1}
      data-fase={fase}
      className={`${estilosSesion.estado} ${conFondo ? estilosSesion.conFondo : ''} ${
        visible ? '' : estilosSesion.sinCursor
      }`}
      style={variablesFondo as CSSProperties | undefined}
      onPointerMove={() => visibilidad.current?.actividad()}
      onPointerDown={() => visibilidad.current?.actividad()}
    >
      {enCuenta && (
        <CuentaTransicion
          transicion={transicion}
          cierrePendiente={cierrePendiente !== null}
          ahora={ahora}
        />
      )}
      {enCuenta && candidata && <TarjetaSiguiente {...candidata} />}
      {enEspera && <PantallaEspera candidata={candidata} />}
      {enFin && (
        <PantallaFinCola
          titulo={ultima?.titulo ?? ''}
          artista={ultima?.artista ?? ''}
          visible={visible}
          alOtraVez={alOtraVez}
          alCerrar={alCerrar}
        />
      )}
      {enFallo && (
        <PantallaFallo
          titulo={tituloFallo}
          hayPendientes={hayPendientes}
          visible={visible}
          alPasar={alPasar}
          alCerrar={alCerrar}
        />
      )}
      {franjas && (
        <>
          <div
            className={`${estilos.franja} ${estilos.superior} ${oculto}`}
            data-franja="superior"
            aria-hidden={!visible || undefined}
            inert={!visible}
            onPointerEnter={() => retener('superior', true)}
            onPointerLeave={() => retener('superior', false)}
          >
            <Tooltip contenido={R.cola.tooltipCerrar}>
              <button
                className={`${estilos.control} ${estilos.salir}`}
                type="button"
                aria-keyshortcuts="Control+W Meta+W"
                onClick={alCerrar}
              >
                <Icono icono={X} /> {R.cola.cerrar}
              </button>
            </Tooltip>
          </div>
          <div
            className={`${estilos.franja} ${estilos.inferior} ${oculto}`}
            data-franja="inferior"
            aria-hidden={!visible || undefined}
            inert={!visible}
            onPointerEnter={() => retener('inferior', true)}
            onPointerLeave={() => retener('inferior', false)}
          >
            <div className={estilos.fila}>
              <div className={estilos.grupo}>
                {enCuenta ? (
                  <>
                    <button
                      className={`${estilos.control} ${estilos.salir}`}
                      type="button"
                      aria-keyshortcuts="Space K"
                      onClick={alEmpezar}
                    >
                      <Icono icono={Play} /> {R.cola.empezarYa}
                    </button>
                    <button
                      className={`${estilos.control} ${estilos.salir}`}
                      type="button"
                      onClick={() => alDetener(transicion.transicionId)}
                    >
                      <Icono icono={Pause} /> {R.cola.detener}
                    </button>
                  </>
                ) : (
                  candidata && (
                    <button
                      className={`${estilos.control} ${estilos.salir}`}
                      type="button"
                      aria-keyshortcuts="Space K"
                      onClick={alEmpezar}
                    >
                      <Icono icono={Play} /> {R.cola.iniciar(candidata.titulo)}
                    </button>
                  )
                )}
              </div>
              <div className={estilos.grupo}>
                <BotonIcono
                  icono={volumen.silenciado ? VolumeX : Volume2}
                  etiqueta={volumen.silenciado ? R.tooltip.activarSonido : R.tooltip.silenciar}
                  aria-keyshortcuts="M"
                  tamano="grande"
                  className={estilos.control}
                  onClick={() => volumen.cambiar({ silenciado: !volumen.silenciado })}
                />
                <Tooltip contenido={R.tooltip.volumen}>
                  <Deslizador
                    className={estilos.volumen}
                    etiqueta={R.aria.volumen}
                    valor={volumen.volumen}
                    textoValor={`${Math.round(volumen.volumen * 100)} %`}
                    step={0.01}
                    onPointerDown={() => retener('arrastre', true)}
                    onPointerUp={() => retener('arrastre', false)}
                    alCambiar={(v) => volumen.cambiar({ volumen: v, silenciado: false })}
                  />
                </Tooltip>
                <BotonIcono
                  icono={Keyboard}
                  etiqueta={R.tooltip.atajos}
                  aria-keyshortcuts="F1 ?"
                  tamano="grande"
                  className={estilos.control}
                  onClick={() => setAtajosAbiertos(true)}
                />
                <BotonIcono
                  icono={pantallaCompleta ? Minimize : Maximize}
                  etiqueta={pantallaCompleta ? R.tooltip.ventana : R.tooltip.completa}
                  aria-keyshortcuts="F"
                  tamano="grande"
                  className={estilos.control}
                  onClick={() => alPantallaCompleta(!pantallaCompleta)}
                />
              </div>
            </div>
          </div>
        </>
      )}
      <div className={estilosComponentes.soloLector} aria-live="polite" aria-atomic="true">
        {anuncio}
      </div>
      <DialogoAtajosReproductor
        abierto={atajosAbiertos}
        vozDisponible={false}
        puedeDesplazar={false}
        sesion
        alCerrar={() => setAtajosAbiertos(false)}
      />
    </div>,
    document.body
  )
}
