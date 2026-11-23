import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Pause, Play, X } from 'lucide-react'
import type { TandaPreparacionIpc, TrabajoIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../componentes/AvisoEnLinea'
import { BarraProgreso } from '../componentes/BarraProgreso'
import { Boton } from '../componentes/Boton'
import { BotonIcono } from '../componentes/BotonIcono'
import { Dialogo } from '../componentes/Dialogo'
import { Icono } from '../componentes/Icono'
import { tituloDeError } from '../vistas/biblioteca/textosError'
import { textoDeError } from '../vistas/progreso/textos'
import {
  COLA,
  faltan,
  fraccionGlobal,
  pausaDelUsuario,
  textoEtaCola,
  textoResultado,
  type CancionTanda
} from './cola'
import estilos from './marco.module.css'

const sinFallo = (p: Promise<unknown>): void => void p.catch(() => undefined)

interface CabeceraProps {
  tanda: TandaPreparacionIpc
  /** Avance 0–1 de las canciones en curso (suma de su progreso visible). */
  avanceEnCurso: number
  haySesion: boolean
  alAbrirResultado(): void
  alReparar(): void
  alVerCancion(id: string): void
  /** Cancelar lo que falta (tras confirmar). */
  alCancelarTodo(): void
}

/** Cabecera de la cola de preparación en el panel de actividad (docs/ux/04 · «Panel de actividad con cola»). */
export function CabeceraCola({
  tanda,
  avanceEnCurso,
  haySesion,
  alAbrirResultado,
  alReparar,
  alVerCancion,
  alCancelarTodo
}: CabeceraProps) {
  const [cancelando, setCancelando] = useState(false)
  const terminada = tanda.terminadas >= tanda.total
  const pausa = pausaDelUsuario(tanda)
  const m = faltan(tanda)
  const fraccion = fraccionGlobal(tanda, avanceEnCurso)
  const titulo = terminada
    ? COLA.tituloFin(tanda.total)
    : pausa
      ? COLA.tituloPausa(tanda.terminadas, tanda.total)
      : COLA.titulo(tanda.terminadas, tanda.total)
  const k = tanda.canciones.filter((c) => c.resultado === null).length
  const primeraError = tanda.canciones.find((c) => c.resultado === 'error')
  return (
    <div className={estilos.cola} data-cola>
      <h3 className={estilos.colaTitulo}>{titulo}</h3>
      {terminada ? (
        <Boton variante="secundario" onClick={alAbrirResultado}>
          {COLA.verResultado}
        </Boton>
      ) : (
        <>
          <BarraProgreso
            etiqueta={titulo}
            valor={fraccion * 100}
            textoValor={`${Math.round(fraccion * 100)} %`}
          />
          <p className={estilos.colaEta}>{textoEtaCola(tanda.estimacionMin)}</p>
          <div className={estilos.colaBotones}>
            {pausa || tanda.motivoPausa !== null ? (
              <Boton
                variante="secundario"
                onClick={() => sinFallo(window.shinobi.preparacion.reanudar())}
              >
                <Icono icono={Play} tamano={16} /> {COLA.reanudar}
              </Boton>
            ) : (
              <Boton
                variante="secundario"
                onClick={() => sinFallo(window.shinobi.preparacion.pausar())}
              >
                <Icono icono={Pause} tamano={16} /> {COLA.pausar}
              </Boton>
            )}
            <Boton variante="fantasma" onClick={() => setCancelando(true)}>
              {COLA.cancelarBoton}
            </Boton>
          </div>
          {pausa && <p className={estilos.colaEta}>{COLA.pausaAyuda}</p>}
        </>
      )}
      {!terminada && tanda.descargasParadas === 'YOUTUBE_BLOQUEADO' && (
        <AvisoEnLinea
          tipo="aviso"
          accionesAbajo
          accion={
            <Boton onClick={() => sinFallo(window.shinobi.preparacion.reanudar())}>
              {COLA.reintentarDescargas}
            </Boton>
          }
        >
          {COLA.youtube(k)}
        </AvisoEnLinea>
      )}
      {!terminada && tanda.descargasParadas === 'SIN_CONEXION' && (
        <AvisoEnLinea
          tipo="aviso"
          accionesAbajo
          accion={
            <Boton onClick={() => sinFallo(window.shinobi.preparacion.reanudar())}>
              {COLA.reintentarAhora}
            </Boton>
          }
        >
          {COLA.sinConexion(k)}
        </AvisoEnLinea>
      )}
      {!terminada && tanda.motivoPausa === 'SIN_ESPACIO' && (
        <AvisoEnLinea
          tipo="aviso"
          accionesAbajo
          accion={
            <Boton onClick={() => sinFallo(window.shinobi.preparacion.reanudar())}>
              {COLA.reanudar}
            </Boton>
          }
        >
          {COLA.espacio}
        </AvisoEnLinea>
      )}
      {!terminada && tanda.separacionesParadas === 'RUNTIME_NO_DISPONIBLE' && (
        <AvisoEnLinea
          tipo="aviso"
          accionesAbajo
          accion={<Boton onClick={alReparar}>{COLA.repararMotor}</Boton>}
        >
          {COLA.motor}
        </AvisoEnLinea>
      )}
      {!terminada && tanda.motivoPausa === 'RUNTIME_NO_DISPONIBLE' && (
        <AvisoEnLinea
          tipo="aviso"
          accionesAbajo
          accion={<Boton onClick={alReparar}>{COLA.repararMotor}</Boton>}
        >
          {COLA.motor}
        </AvisoEnLinea>
      )}
      {!terminada &&
        tanda.motivoPausa !== null &&
        tanda.motivoPausa !== 'SIN_ESPACIO' &&
        tanda.motivoPausa !== 'RUNTIME_NO_DISPONIBLE' && (
          <AvisoEnLinea
            tipo="aviso"
            accionesAbajo
            accion={
              <>
                <Boton onClick={() => sinFallo(window.shinobi.preparacion.reanudar())}>
                  {COLA.reanudar}
                </Boton>
                {primeraError && (
                  <Boton variante="fantasma" onClick={() => alVerCancion(primeraError.id)}>
                    {COLA.verPrimera}
                  </Boton>
                )}
              </>
            }
          >
            {COLA.repetido(tituloDeError(tanda.motivoPausa))}
          </AvisoEnLinea>
        )}
      {!terminada && haySesion && <p className={estilos.colaEta}>{COLA.sesion}</p>}
      {cancelando && (
        <Dialogo
          abierto
          titulo={COLA.cancelarTitulo(m)}
          enfoqueInicial="[data-seguir]"
          onCancelar={() => setCancelando(false)}
          acciones={
            <>
              <Boton data-seguir variante="primario" onClick={() => setCancelando(false)}>
                {COLA.seguir}
              </Boton>
              <Boton
                variante="destructivo"
                onClick={() => {
                  setCancelando(false)
                  alCancelarTodo()
                }}
              >
                {COLA.cancelarConfirmar}
              </Boton>
            </>
          }
        >
          <p>{COLA.cancelarCuerpo(m)}</p>
        </Dialogo>
      )}
    </div>
  )
}

interface GrupoProps {
  titulo: string
  abiertoInicial: boolean
  accion?: ReactNode
  children: ReactNode
}

function Grupo({ titulo, abiertoInicial, accion, children }: GrupoProps) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  return (
    <li className={estilos.grupoCola}>
      <div className={estilos.grupoColaCabecera}>
        <button
          type="button"
          className={estilos.grupoColaBoton}
          aria-expanded={abierto}
          onClick={() => setAbierto((a) => !a)}
        >
          <Icono icono={abierto ? ChevronDown : ChevronRight} tamano={16} />
          {titulo}
        </button>
        {accion}
      </div>
      {abierto && <ul className={estilos.grupoColaLista}>{children}</ul>}
    </li>
  )
}

interface GruposProps {
  tanda: TandaPreparacionIpc
  /** Canciones con un trabajo en curso (se muestran arriba con su barra). */
  enCurso: ReadonlySet<string>
  titulos: ReadonlyMap<string, string>
  trabajos: TrabajoIpc[]
  busquedaAutomatica: boolean
  alIr(id: string): void
  alCancelarTrabajo(t: TrabajoIpc): void
}

/** «En cola», «Con error» y «Terminadas» como secciones plegables. */
export function GruposCola({
  tanda,
  enCurso,
  titulos,
  trabajos,
  busquedaAutomatica,
  alIr,
  alCancelarTrabajo
}: GruposProps) {
  const nombre = (id: string): string => titulos.get(id) ?? 'Canción'
  const enCola = tanda.canciones.filter((c) => c.resultado === null && !enCurso.has(c.id))
  const errores = tanda.canciones.filter((c) => c.resultado === 'error')
  const hechas = tanda.canciones.filter((c) => c.resultado !== null && c.resultado !== 'error')
  const hayReintentables = errores.some((c) => textoDeError(c.motivo ?? '').reintentable)
  const cancelarFila = (c: CancionTanda): void => {
    const t = trabajos.find((x) => x.cancionId === c.id)
    if (t) alCancelarTrabajo(t)
    else sinFallo(window.shinobi.preparacion.cancelar(c.id))
  }
  return (
    <ul className={estilos.grupos}>
      {enCola.length > 0 && (
        <Grupo titulo={COLA.grupoCola(enCola.length)} abiertoInicial={false}>
          {enCola.map((c) => (
            <li key={c.id} className={estilos.filaCola}>
              <span className={estilos.filaColaTexto}>{nombre(c.id)}</span>
              <Boton variante="secundario" onClick={() => alIr(c.id)}>
                {COLA.ir}
              </Boton>
              <BotonIcono
                icono={X}
                etiqueta={`Cancelar «${nombre(c.id)}»`}
                onClick={() => cancelarFila(c)}
              />
            </li>
          ))}
        </Grupo>
      )}
      {errores.length > 0 && (
        <Grupo
          titulo={COLA.grupoError(errores.length)}
          abiertoInicial
          accion={
            hayReintentables ? (
              <Boton
                variante="secundario"
                onClick={() => sinFallo(window.shinobi.preparacion.reintentarFallidas())}
              >
                {COLA.reintentar}
              </Boton>
            ) : undefined
          }
        >
          {errores.map((c) => (
            <li key={c.id} className={estilos.filaCola}>
              <span className={estilos.filaColaTexto}>
                {nombre(c.id)} — {textoResultado(c, busquedaAutomatica)}
              </span>
              <Boton variante="secundario" onClick={() => alIr(c.id)}>
                {COLA.ver}
              </Boton>
            </li>
          ))}
        </Grupo>
      )}
      {hechas.length > 0 && (
        <Grupo titulo={COLA.grupoTerminadas(hechas.length)} abiertoInicial={false}>
          {hechas.map((c) => (
            <li key={c.id} className={estilos.filaCola}>
              <span className={estilos.filaColaTexto}>
                {nombre(c.id)} — {textoResultado(c, busquedaAutomatica)}
              </span>
              <Boton variante="secundario" onClick={() => alIr(c.id)}>
                {COLA.ir}
              </Boton>
            </li>
          ))}
        </Grupo>
      )}
    </ul>
  )
}
