import { Pause, Play, Repeat, RotateCcw, SkipForward, TriangleAlert } from 'lucide-react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { Boton } from '../../../componentes/Boton'
import { Icono } from '../../../componentes/Icono'
import { MenuContextual } from '../../../componentes/MenuContextual'
import { useSesion } from '../../../sesion/ProveedorSesion'
import { COLA, mmss, SES } from '../../../sesion/textos'
import { textoSincronia } from '../tarjeta'
import { useAgregarACola } from '../useAgregarACola'
import estilos from './panelCola.module.css'
import { segundosRestantes, textoTiempoLargo, useAhora } from './tiempo'

const sinAccion = (): void => undefined

/** Líneas sin sincronizar de una canción Lista incompleta, según la biblioteca (0080). */
export function lineasSinSincronizar(
  canciones: readonly ResumenCancionIpc[],
  cancionId: string
): number | null {
  const c = canciones.find((x) => x.id === cancionId)
  return c && c.incompleta && c.lineasSinSincronizar > 0 ? c.lineasSinSincronizar : null
}

/**
 * Bloque «En reproducción» del panel (P1–P4): activa con progreso de solo lectura y controles,
 * cuenta entre canciones, fallo de una entrada, espera y fin de la cola.
 */
export function BloqueActiva({ canciones }: { canciones: readonly ResumenCancionIpc[] }) {
  const { estado, acciones, posicion, recibidoEn } = useSesion()
  const agregar = useAgregarACola()
  const sesion = estado?.sesion ?? null
  const transicion = sesion?.transicion ?? null
  const ahora = useAhora(transicion !== null && !transicion.congelada)
  if (!estado || !sesion) return null

  const pendientes = estado.pendientes
  // Con el cierre pedido en la secundaria, los controles de la sesión quedan inactivos.
  const esperando = sesion.cierrePendiente?.origen === 'secundaria'
  const inactivo = esperando ? SES.cierre.esperando : undefined
  const activa = estado.activa
  const contexto = estado.contexto

  // P3: fallo de una entrada.
  if (sesion.error) {
    const e = sesion.error
    const fallida = activa?.entradaId === e.entradaId ? activa : null
    const titulo = fallida?.titulo ?? contexto?.entrada.titulo ?? ''
    return (
      <div className={estilos.bloque} data-bloque-activa="error">
        <AvisoEnLinea tipo="error">
          <p className={estilos.cuerpoFuerte}>{COLA.falloTitulo(titulo)}</p>
          <p className={estilos.nota}>{COLA.causa(e.motivo)}</p>
          {pendientes.length === 0 && <p className={estilos.nota}>{COLA.falloSinSiguiente}</p>}
        </AvisoEnLinea>
        <div className={estilos.acciones}>
          {pendientes.length > 0 ? (
            <Boton
              variante="primario"
              noDisponible={inactivo}
              onClick={() => void acciones.siguiente(e.entradaId).catch(sinAccion)}
            >
              {COLA.pasar}
            </Boton>
          ) : (
            <Boton
              variante="primario"
              noDisponible={inactivo}
              onClick={() => void acciones.cola.quitar(e.entradaId).catch(sinAccion)}
            >
              {COLA.descartar}
            </Boton>
          )}
          <Boton onClick={() => void navigator.clipboard?.writeText(e.codigo)}>
            Copiar detalles
          </Boton>
        </div>
      </div>
    )
  }

  // P2: cuenta entre canciones.
  if (transicion) {
    const candidata = pendientes.find((p) => p.entradaId === transicion.candidataId)
    const s = segundosRestantes(transicion.restanteMs, transicion.congelada, recibidoEn, ahora)
    return (
      <div className={estilos.bloque} data-bloque-activa="cuenta">
        {contexto && <p className={estilos.nota}>{COLA.termino(contexto.entrada.titulo)}</p>}
        <p className={estilos.cuerpoFuerte}>{COLA.cuenta(s, candidata?.titulo ?? '')}</p>
        <div className={estilos.acciones}>
          <Boton
            variante="primario"
            noDisponible={inactivo}
            onClick={() => void acciones.empezar(transicion.candidataId).catch(sinAccion)}
          >
            <Icono icono={Play} tamano={16} />
            {COLA.empezarYa}
          </Boton>
          <Boton
            noDisponible={inactivo}
            onClick={() =>
              void acciones.detenerTransicion(transicion.transicionId).catch(sinAccion)
            }
          >
            <Icono icono={Pause} tamano={16} />
            {COLA.detener}
          </Boton>
        </div>
      </div>
    )
  }

  // P4: en espera o fin de la cola.
  if (sesion.fase === 'espera' || sesion.fase === 'fin_de_cola' || !activa) {
    const candidata = pendientes[0]
    if (sesion.fase === 'fin_de_cola') {
      return (
        <div className={estilos.bloque} data-bloque-activa="fin">
          <p className={estilos.cuerpoFuerte}>{COLA.fin}</p>
          {contexto && (
            <p className={estilos.nota}>
              {COLA.finUltima(contexto.entrada.titulo, contexto.entrada.artista)}
            </p>
          )}
          {contexto && (
            <div className={estilos.acciones}>
              <Boton
                noDisponible={inactivo}
                onClick={() => void acciones.repetir(contexto.entrada.entradaId).catch(sinAccion)}
              >
                <Icono icono={Repeat} tamano={16} />
                {COLA.finOtraVez}
              </Boton>
            </div>
          )}
        </div>
      )
    }
    return (
      <div className={estilos.bloque} data-bloque-activa="espera">
        <p className={estilos.cuerpoFuerte}>{COLA.espera}</p>
        {candidata ? (
          <div className={estilos.acciones}>
            <Boton
              variante="primario"
              noDisponible={inactivo}
              onClick={() => void acciones.empezar(candidata.entradaId).catch(sinAccion)}
            >
              <Icono icono={Play} tamano={16} />
              {COLA.iniciar(candidata.titulo)}
            </Boton>
          </div>
        ) : (
          <p className={estilos.nota}>{COLA.esperaVacia}</p>
        )}
      </div>
    )
  }

  // P1: reproduciendo o en pausa.
  const pausada = sesion.fase === 'pausada'
  const viva = posicion && posicion.entradaId === activa.entradaId ? posicion : null
  const duracion = viva?.duracionMs ?? activa.duracionMs
  const pos = Math.max(0, viva?.posicionMs ?? activa.posicionMs)
  const porcentaje = duracion > 0 ? Math.min(100, (pos / duracion) * 100) : 0
  const sinSincronizar = lineasSinSincronizar(canciones, activa.cancionId)
  return (
    <div className={estilos.bloque} data-bloque-activa="reproduciendo">
      <div className={estilos.bloqueCabecera}>
        <div className={estilos.bloqueTitulo}>
          <p className="t-subtitulo">{activa.titulo}</p>
          <p className={estilos.nota}>{activa.artista}</p>
        </div>
        <MenuContextual
          etiqueta={`Más acciones de «${activa.titulo}»`}
          items={[
            {
              id: 'otraVez',
              etiqueta: COLA.otraVez,
              alSeleccionar: () => void agregar(activa.cancionId, activa.titulo, 'final')
            }
          ]}
        />
      </div>
      {sinSincronizar !== null && (
        <p className={`t-pequeno ${estilos.aviso}`}>
          <Icono icono={TriangleAlert} tamano={14} />
          {textoSincronia(sinSincronizar)}
        </p>
      )}
      <div className={estilos.progreso}>
        <span className={estilos.tiempo}>{mmss(pos)}</span>
        <div
          className={estilos.barra}
          role="progressbar"
          aria-label={activa.titulo}
          aria-valuemin={0}
          aria-valuemax={Math.round(duracion / 1000)}
          aria-valuenow={Math.round(pos / 1000)}
          aria-valuetext={`${textoTiempoLargo(pos)} de ${textoTiempoLargo(duracion)}`}
        >
          <div className={estilos.barraRelleno} style={{ width: `${porcentaje}%` }} />
        </div>
        <span className={estilos.tiempo}>{mmss(duracion)}</span>
      </div>
      <div className={estilos.acciones}>
        <Boton
          noDisponible={inactivo}
          onClick={() =>
            void acciones
              .transporte(pausada ? 'reanudar' : 'pausar', activa.entradaId)
              .catch(sinAccion)
          }
        >
          <Icono icono={pausada ? Play : Pause} tamano={16} />
          {pausada ? COLA.reanudar : COLA.pausa}
        </Boton>
        <Boton
          noDisponible={inactivo ?? (pendientes.length === 0 ? COLA.siguienteNo : undefined)}
          onClick={() => void acciones.siguiente(activa.entradaId).catch(sinAccion)}
        >
          <Icono icono={SkipForward} tamano={16} />
          {COLA.siguiente}
        </Boton>
        <Boton
          noDisponible={inactivo}
          onClick={() => void acciones.transporte('reiniciar', activa.entradaId).catch(sinAccion)}
        >
          <Icono icono={RotateCcw} tamano={16} />
          {COLA.reiniciar}
        </Boton>
      </div>
    </div>
  )
}
