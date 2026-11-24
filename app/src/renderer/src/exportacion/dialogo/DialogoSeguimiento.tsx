import { useContext, useEffect, useId, useState, type ReactNode } from 'react'
import { Check, Circle, LoaderCircle, X } from 'lucide-react'
import { FORMATOS } from '@shared/exportacion'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import estilosComponentes from '../../componentes/componentes.module.css'
import { NavegacionContexto } from '../../navegacion/estado'
import { textoEtaLargo } from '../../vistas/progreso/modelo'
import { useExportaciones } from '../contexto'
import { duracionDe, porcentajeDe, type ExportacionVista } from '../estado'
import {
  codigoDeError,
  ERRORES_CAPTURA,
  EXP,
  formatearPosicion,
  formatearTamano,
  medidas,
  NOMBRES_AUDIO,
  textoErrorExp
} from './textos'
import { porcentajeCoros } from './modelo'
import { EXP_PROGRESO, EXP_TOAST, formatearDuracionTrabajo } from './textosProgreso'
import estilos from './exportacion.module.css'
import { copiarDetalles as copiarConVersion } from '../../soporte/detalles'

/** Tiempo que se espera a que aparezca la exportación recién iniciada antes de cerrar. */
const ESPERA_EXPORTACION_MS = 3000

interface Props {
  trabajoId: string
  alCerrar(): void
}

type EstadoSubpaso = 'pendiente' | 'curso' | 'hecho' | 'fallo'

const ICONOS = { pendiente: Circle, curso: LoaderCircle, hecho: Check, fallo: X }
const CLASES = {
  pendiente: estilos.pendiente,
  curso: estilos.enCurso,
  hecho: estilos.hecho,
  fallo: estilos.fallo
}

function Subpaso({
  estado,
  nombre,
  children
}: {
  estado: EstadoSubpaso
  nombre: string
  children?: ReactNode
}) {
  return (
    <li className={estilos.subpaso} data-estado={estado}>
      <span className={CLASES[estado]}>
        <Icono
          icono={ICONOS[estado]}
          tamano={20}
          className={estado === 'curso' ? estilosComponentes.girando : undefined}
        />
      </span>
      <span className={estado === 'pendiente' ? estilos.pendiente : undefined}>{nombre}</span>
      {children && <div className={estilos.subpasoDetalle}>{children}</div>}
    </li>
  )
}

/** `exp.resumen`: «1920 × 1080 · 30 FPS · Solo instrumental · MKV». */
export function resumenDe(e: ExportacionVista): string {
  return `${medidas(e.ancho, e.alto)} · ${e.fps} FPS · ${audioDe(e)} · ${FORMATOS[e.formato].nombreCorto}`
}

/** `exp.audio.coros` si el video lleva la voz de los coros; si no, el nombre del audio de siempre. */
const audioDe = (e: Pick<ExportacionVista, 'audio' | 'corosNivel'>): string =>
  e.audio === 'instrumental' && e.corosNivel !== undefined
    ? EXP.audioCoros(porcentajeCoros(e.corosNivel))
    : NOMBRES_AUDIO[e.audio]

function Subpasos({ e, cancelando }: { e: ExportacionVista; cancelando: boolean }) {
  const p = e.progreso
  const fase = p?.fase ?? 'preparando'
  const estado = (n: number): EstadoSubpaso => {
    const actual = fase === 'preparando' ? 0 : fase === 'codificando' ? 1 : 2
    return n < actual ? 'hecho' : n === actual ? 'curso' : 'pendiente'
  }
  const n = porcentajeDe(p)
  const eta =
    p && p.etaSegundos !== null ? textoEtaLargo(p.etaSegundos) : EXP_PROGRESO.etaCalculando
  return (
    <ol className={estilos.subpasos} aria-label={EXP_PROGRESO.titulo}>
      <Subpaso estado={estado(0)} nombre={EXP_PROGRESO.subpasoPreparar}>
        {estado(0) === 'curso' && (
          <>
            <span>{cancelando ? EXP_PROGRESO.cancelando : EXP_PROGRESO.fasePreparando}</span>
            <BarraProgreso etiqueta={EXP_PROGRESO.fasePreparando} indeterminada grande />
          </>
        )}
      </Subpaso>
      <Subpaso estado={estado(1)} nombre={EXP_PROGRESO.subpasoCrear}>
        {estado(1) === 'curso' && (
          <>
            <div className={estilos.subpasoFila}>
              <span>{cancelando ? EXP_PROGRESO.cancelando : EXP_PROGRESO.faseCreando(n)}</span>
              {!cancelando && <span data-eta>{eta}</span>}
            </div>
            <BarraProgreso
              etiqueta={EXP_PROGRESO.subpasoCrear}
              valor={n}
              indeterminada={cancelando}
              textoValor={`${n} %`}
              grande
            />
            {p && !cancelando && (
              <span className={`t-tiempo ${estilos.tiempo}`}>
                {EXP_PROGRESO.fasePosicion(
                  formatearPosicion(p.posicionMs),
                  formatearPosicion(p.duracionMs)
                )}
              </span>
            )}
          </>
        )}
      </Subpaso>
      <Subpaso estado={estado(2)} nombre={EXP_PROGRESO.subpasoTerminar}>
        {estado(2) === 'curso' && (
          <>
            <span>{cancelando ? EXP_PROGRESO.cancelando : EXP_PROGRESO.faseTerminando}</span>
            <BarraProgreso etiqueta={EXP_PROGRESO.faseTerminando} indeterminada grande />
          </>
        )}
      </Subpaso>
    </ol>
  )
}

/** Texto de «Copiar detalles»: código, mensaje, perfil, formato y posición (la versión la añade `copiarConVersion`). */
function detallesDe(e: ExportacionVista): string {
  return [
    `${e.error?.codigo ?? 'ERROR_INTERNO'}: ${e.error?.mensaje ?? ''}`.trim(),
    e.error?.detalles ?? '',
    `Perfil: ${medidas(e.ancho, e.alto)} · ${e.fps} FPS · ${audioDe(e)}`,
    `Formato: ${FORMATOS[e.formato].nombre}`,
    e.error?.posicionMs != null
      ? `Posición: ${formatearPosicion(e.error.posicionMs)} de ${formatearPosicion(e.duracionMs)}`
      : 'Posición: antes del primer fotograma'
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Estados B (exportando), B2 (en cola), B3 (confirmar), B4 (cancelando), C (éxito) y D (fallo) del
 * diálogo «Exportar video» (docs/ux/10). Sigue una exportación del almacén; no cancela al cerrarse.
 */
export function DialogoSeguimiento({ trabajoId, alCerrar }: Props) {
  const ctx = useExportaciones()
  const navegacion = useContext(NavegacionContexto)
  const idCabecera = useId()
  const e = ctx.exportaciones.find((x) => x.trabajoId === trabajoId)
  const [confirmando, setConfirmando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [reintentando, setReintentando] = useState(false)

  const terminadaCancelada = e?.estado === 'terminada' && e.resultado === 'cancelada'
  const existe = e !== undefined
  useEffect(() => {
    if (terminadaCancelada) {
      alCerrar()
      return
    }
    if (existe) return
    // `iniciar` puede responder antes de que llegue el evento con la exportación nueva.
    const espera = setTimeout(alCerrar, ESPERA_EXPORTACION_MS)
    return () => clearTimeout(espera)
  }, [existe, terminadaCancelada, alCerrar])
  if (!e || terminadaCancelada) return null

  const existia = e.destinoExistia
  const tardo = duracionDe(e)
  const cabecera = (
    <p id={idCabecera} className={estilos.cabecera}>
      «{e.titulo}»{e.artista ? ` · ${e.artista}` : ''}
    </p>
  )

  const mostrarError = (mensaje: string) =>
    mostrarToast({ tipo: 'error', mensaje, persistente: true })

  async function cancelar(): Promise<void> {
    setConfirmando(false)
    setCancelando(true)
    try {
      await window.shinobi.exportacion.cancelar(trabajoId)
    } catch {
      setCancelando(false)
      mostrarError(EXP_PROGRESO.noSeCancelo)
    }
  }

  async function quitarDeLaCola(): Promise<void> {
    try {
      await window.shinobi.exportacion.cancelar(trabajoId)
    } catch {
      mostrarError(EXP_PROGRESO.noSeCancelo)
    }
  }

  async function mostrarEnCarpeta(): Promise<void> {
    try {
      await window.shinobi.exportacion.mostrarEnCarpeta({ trabajoId })
    } catch {
      mostrarToast({ tipo: 'aviso', mensaje: EXP_TOAST.noExiste })
    }
  }

  // --- B2: en cola -------------------------------------------------------------
  if (e.estado === 'en_cola') {
    const otra = ctx.exportaciones.find((x) => x.estado === 'en_curso')
    const posicion = e.posicion ?? 1
    const texto =
      posicion > 1
        ? EXP_PROGRESO.colaPosicion(posicion)
        : otra
          ? EXP_PROGRESO.colaTras(otra.titulo)
          : EXP_PROGRESO.colaSinOtra
    return (
      <Dialogo
        key="cola"
        abierto
        titulo={EXP_PROGRESO.titulo}
        onCancelar={alCerrar}
        ancho="35rem"
        descripcionId={idCabecera}
        enfoqueInicial="[data-segundo-plano]"
        acciones={
          <>
            <Boton
              variante="fantasma"
              style={{ marginRight: 'auto' }}
              onClick={() => void quitarDeLaCola()}
            >
              {EXP_PROGRESO.quitarDeLaCola}
            </Boton>
            <Boton variante="primario" data-segundo-plano onClick={alCerrar}>
              {EXP_PROGRESO.segundoPlano}
            </Boton>
          </>
        }
      >
        {cabecera}
        <p className={estilos.resumen}>{resumenDe(e)}</p>
        <AvisoEnLinea tipo="info">{texto}</AvisoEnLinea>
        <ol className={estilos.subpasos}>
          <Subpaso estado="pendiente" nombre={EXP_PROGRESO.subpasoPreparar} />
          <Subpaso estado="pendiente" nombre={EXP_PROGRESO.subpasoCrear} />
          <Subpaso estado="pendiente" nombre={EXP_PROGRESO.subpasoTerminar} />
        </ol>
      </Dialogo>
    )
  }

  // --- B, B3, B4: en curso ---------------------------------------------------------
  if (e.estado === 'en_curso') {
    if (confirmando) {
      return (
        <Dialogo
          key="confirmar"
          abierto
          titulo={EXP_PROGRESO.titulo}
          onCancelar={() => setConfirmando(false)}
          ancho="35rem"
          descripcionId={idCabecera}
          enfoqueInicial="[data-seguir]"
          acciones={
            <>
              <Boton variante="secundario" data-seguir onClick={() => setConfirmando(false)}>
                {EXP_PROGRESO.seguirExportando}
              </Boton>
              <Boton variante="destructivo" onClick={() => void cancelar()}>
                {EXP_PROGRESO.cancelarExportacion}
              </Boton>
            </>
          }
        >
          {cabecera}
          <p className={estilos.resumen}>{resumenDe(e)}</p>
          <Subpasos e={e} cancelando={false} />
          <div
            className={estilos.confirmacion}
            role="group"
            aria-label={EXP_PROGRESO.cancelarPregunta}
          >
            <p>
              <strong>{EXP_PROGRESO.cancelarPregunta}</strong> {EXP_PROGRESO.cancelarCuerpo}
            </p>
            {existia && <p>{EXP_PROGRESO.cancelarConservado}</p>}
          </div>
        </Dialogo>
      )
    }
    return (
      <Dialogo
        key={cancelando ? 'cancelando' : 'curso'}
        abierto
        titulo={EXP_PROGRESO.titulo}
        onCancelar={() => {
          if (!cancelando) alCerrar()
        }}
        ancho="35rem"
        descripcionId={idCabecera}
        enfoqueInicial="[data-segundo-plano]"
        acciones={
          <>
            <Boton
              variante="fantasma"
              style={{ marginRight: 'auto' }}
              disabled={cancelando}
              onClick={() => setConfirmando(true)}
            >
              {EXP_PROGRESO.cancelarExportacion}
            </Boton>
            <Boton variante="primario" data-segundo-plano disabled={cancelando} onClick={alCerrar}>
              {EXP_PROGRESO.segundoPlano}
            </Boton>
          </>
        }
      >
        {cabecera}
        <p className={estilos.resumen}>{resumenDe(e)}</p>
        <Subpasos e={e} cancelando={cancelando} />
        {!cancelando && <p className={estilos.pista}>{EXP_PROGRESO.ayudaSegundoPlano}</p>}
      </Dialogo>
    )
  }

  // --- C: éxito ---------------------------------------------------------------------
  if (e.resultado === 'completada') {
    const partes = [
      `${medidas(e.ancho, e.alto)} · ${e.fps} FPS · ${FORMATOS[e.formato].nombreCorto}`,
      formatearPosicion(e.duracionMs),
      e.bytes != null ? formatearTamano(e.bytes) : null
    ].filter(Boolean)
    return (
      <Dialogo
        key="exito"
        abierto
        titulo={EXP_PROGRESO.okTitulo}
        onCancelar={alCerrar}
        ancho="35rem"
        descripcionId={idCabecera}
        enfoqueInicial="[data-mostrar]"
        acciones={
          <>
            <Boton onClick={alCerrar}>{EXP.botonCerrar}</Boton>
            <Boton variante="primario" data-mostrar onClick={() => void mostrarEnCarpeta()}>
              {EXP_PROGRESO.mostrar}
            </Boton>
          </>
        }
      >
        <div className={estilos.exito}>
          <span className={estilos.hecho}>
            <Icono icono={Check} tamano={20} />
          </span>
          <div>
            {cabecera}
            <p className={estilos.nombreArchivo}>{e.archivo}</p>
            <p>{partes.join(' · ')}</p>
            {tardo !== null && <p>{EXP_PROGRESO.okTardo(formatearDuracionTrabajo(tardo))}</p>}
            <p className={estilos.pista}>{EXP_PROGRESO.okEn(e.carpeta)}</p>
          </div>
        </div>
      </Dialogo>
    )
  }

  // --- D: fallo ---------------------------------------------------------------------
  const codigo = e.error?.codigo ?? 'ERROR_INTERNO'
  // Fallo de captura (0260): `detalle.reintentable` distingue el pasajero del que no se arregla.
  const detalleCaptura =
    codigo === 'PERFIL_NO_SOPORTADO' &&
    e.error?.detalle &&
    'causa' in e.error.detalle &&
    e.error.detalle.causa === 'captura'
      ? e.error.detalle
      : null
  const texto = detalleCaptura
    ? detalleCaptura.reintentable
      ? ERRORES_CAPTURA.pasajera
      : ERRORES_CAPTURA.captura(e.ancho, e.alto)
    : textoErrorExp(codigo)
  const posicion =
    e.error?.posicionMs != null
      ? EXP_PROGRESO.errorPosicion(
          formatearPosicion(e.error.posicionMs),
          formatearPosicion(e.duracionMs)
        )
      : EXP_PROGRESO.errorPosicionPreparando
  const puedeReintentar =
    ['SIN_ESPACIO', 'DESTINO_NO_DISPONIBLE', 'MEMORIA_INSUFICIENTE', 'ERROR_INTERNO'].includes(
      codigo
    ) || detalleCaptura?.reintentable === true
  const puedeCambiar =
    codigo !== 'CANCION_NO_DISPONIBLE' &&
    codigo !== 'RUNTIME_NO_DISPONIBLE' &&
    codigo !== 'ERROR_INTERNO'
  const soloCerrar = codigo === 'CANCION_NO_DISPONIBLE'
  const reparar = codigo === 'RUNTIME_NO_DISPONIBLE'

  const copiar = async () => {
    await copiarConVersion(detallesDe(e)).catch(() => undefined)
    mostrarToast({ tipo: 'exito', mensaje: EXP.copiados })
  }
  const cambiarOpciones = () => {
    ctx.abrir({
      cancionId: e.cancionId,
      opciones: {
        audio: e.audio,
        formato: e.formato,
        ancho: e.ancho,
        alto: e.alto,
        fps: e.fps,
        // Con «Solo instrumental», la casilla vuelve como estaba; con otro audio, la marcada de siempre.
        ...(e.audio === 'instrumental' ? { coros: e.corosNivel !== undefined } : {})
      },
      desdeTrabajoId: e.trabajoId
    })
  }
  const reintentar = async () => {
    setReintentando(true)
    try {
      const api = window.shinobi.exportacion
      // Misma carpeta y nombre que el intento fallido, aunque se hubieran cambiado a mano (0133).
      const destino = await api.destinoPropuesto({
        cancionId: e.cancionId,
        formato: e.formato,
        desdeTrabajoId: e.trabajoId
      })
      const { trabajoId: nuevo } = await api.iniciar({
        cancionId: e.cancionId,
        formato: e.formato,
        ancho: e.ancho,
        alto: e.alto,
        fps: e.fps,
        audio: e.audio,
        destinoId: destino.destinoId
      })
      ctx.iniciada(nuevo, e.cancionId)
    } catch (err) {
      setReintentando(false)
      mostrarError(`${EXP_PROGRESO.noSeReintento} ${textoErrorExp(codigoDeError(err)).titulo}`)
    }
  }
  const repararMotor = () => {
    alCerrar()
    navegacion?.ir({ tipo: 'primer-arranque' })
  }
  const foco = reparar
    ? 'data-reparar'
    : soloCerrar
      ? 'data-cerrar'
      : puedeReintentar
        ? 'data-reintentar'
        : 'data-cambiar'

  return (
    <Dialogo
      key="fallo"
      abierto
      titulo={EXP_PROGRESO.errorTitulo}
      onCancelar={alCerrar}
      ancho="35rem"
      descripcionId={idCabecera}
      enfoqueInicial={`[${foco}]`}
      acciones={
        <>
          <Boton variante="fantasma" style={{ marginRight: 'auto' }} onClick={() => void copiar()}>
            {EXP.botonCopiar}
          </Boton>
          {soloCerrar && (
            <Boton variante="primario" data-cerrar onClick={alCerrar}>
              {EXP.botonCerrar}
            </Boton>
          )}
          {reparar && (
            <Boton variante="primario" data-reparar onClick={repararMotor}>
              {EXP.reparar}
            </Boton>
          )}
          {puedeCambiar && (
            <Boton
              variante={puedeReintentar ? 'secundario' : 'primario'}
              data-cambiar
              onClick={cambiarOpciones}
            >
              {EXP_PROGRESO.cambiarOpciones}
            </Boton>
          )}
          {puedeReintentar && (
            <Boton
              variante="primario"
              data-reintentar
              cargando={reintentando}
              onClick={() => void reintentar()}
            >
              {EXP_PROGRESO.reintentar}
            </Boton>
          )}
        </>
      }
    >
      {cabecera}
      <AvisoEnLinea tipo="error">
        <strong>{texto.titulo}</strong> {texto.explicacion}
        {existia && <> {EXP_PROGRESO.errorConservado}</>}
      </AvisoEnLinea>
      <p className={estilos.resumen}>{resumenDe(e)}</p>
      <p className={estilos.resumen}>{posicion}</p>
    </Dialogo>
  )
}
