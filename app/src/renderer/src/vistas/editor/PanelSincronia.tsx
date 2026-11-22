import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { Icono } from '../../componentes/Icono'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { WholeWord, X } from 'lucide-react'
import { tienePalabrasManuales } from '@shared/letra'
import { contarLineas, finEfectivo } from '@shared/letra'
import { formatearTiempo, numeroDeLinea, tiempoMostrado, type Limite } from '@shared/letras/tiempos'
import { CampoTiempo } from './CampoTiempo'
import type { EstadoEditor } from './estado'
import { E } from './textos'
import estilos from './editor.module.css'

type Campo = 'inicio' | 'fin'
interface Props {
  edicion: EstadoEditor
  duracionMs: number
  escucharAjustes: boolean
  fijarEscucharAjustes(valor: boolean): void
  bucle?: boolean
  motivoBucle?: string
  alternarBucle?(): void
  fijar(campo: Campo, msAudio?: number): void
  finAutomatico(): void
  escuchar(): void
  /** Mayús + L: de 0,5 s antes a 0,5 s después de la línea. */
  escucharTramo(): void
  borrar(): void
  ayudaBluetooth?: boolean
  /** Abre el editor preciso de la línea; `motivoPreciso` si no se puede (sin inicio, ritmo…). */
  abrirPreciso?(): void
  motivoPreciso?: string
  /** La línea está abierta en el editor preciso: sus controles de tiempo quedan inactivos. */
  ocupada?: boolean
  cerrarBluetooth?(): void
}

let bluetoothVisto = false
export function mostrarAyudaBluetooth(): boolean {
  if (bluetoothVisto) return false
  bluetoothVisto = true
  return true
}

export function textoLimite(limite: Limite, pausaFin: boolean): string | null {
  switch (limite.tipo) {
    case 'inicio_anterior':
      return E.limiteAnterior(limite.vecino === 'pausa')
    case 'inicio_siguiente':
      return E.limiteSiguiente(limite.vecino === 'pausa')
    case 'fin_antes_del_inicio':
      return E.limiteFinInicio
    case 'fin_siguiente':
      return pausaFin
        ? 'El fin no puede pasar del inicio de la pausa siguiente.'
        : E.limiteFinSiguiente
    default:
      return null
  }
}

/**
 * Aviso de límite vigente de un campo de la línea seleccionada. Lo comparten
 * el panel completo, que lo enseña junto al campo, y los rieles minimizados, junto a su botón.
 */
export function limiteDeCampo(
  edicion: EstadoEditor,
  campo: Campo
): { mensaje: string; clave: number } | undefined {
  const { aviso, seleccion } = edicion
  if (!aviso?.limite || !aviso.limite.tipo.startsWith(campo)) return undefined
  if (aviso.id !== seleccion) return undefined
  const { letra } = edicion.actual
  const indice = letra.lineas.findIndex((el) => el.id === seleccion && el.tipo === 'linea')
  const siguiente = letra.lineas.slice(indice + 1).find((e) => e.inicio_ms !== null)
  const mensaje = textoLimite(aviso.limite, siguiente?.tipo === 'pausa')
  return mensaje ? { mensaje, clave: aviso.n } : undefined
}

export function PanelSincronia({
  edicion,
  duracionMs,
  escucharAjustes,
  fijarEscucharAjustes,
  bucle = false,
  motivoBucle,
  alternarBucle,
  fijar,
  finAutomatico,
  escuchar,
  escucharTramo,
  borrar,
  ayudaBluetooth,
  cerrarBluetooth,
  abrirPreciso,
  motivoPreciso,
  ocupada = false
}: Props) {
  const { letra } = edicion.actual
  const { seleccion } = edicion
  const bloqueado = edicion.sync.activo
  const indice = letra.lineas.findIndex((el) => el.id === seleccion && el.tipo === 'linea')
  const linea = letra.lineas[indice]
  const fin = linea ? finEfectivo(letra, linea.id, duracionMs) : null
  const tiempo = (ms: number | null) =>
    formatearTiempo(ms === null ? null : tiempoMostrado(ms, letra.offset_ms))
  const bloqueo = ocupada ? E.preciso.ocupado : undefined
  const limite = (campo: Campo) => limiteDeCampo(edicion, campo)
  return (
    <fieldset className={estilos.panelSincronia} disabled={bloqueado} aria-label="Sincronía">
      {linea ? (
        <div className={estilos.ajustesLinea}>
          <h3>{E.lineaN(numeroDeLinea(letra, linea.id), contarLineas(letra))}</h3>
          <p className={estilos.lineaDetalle}>«{linea.texto}»</p>
          {tienePalabrasManuales(linea) && (
            <>
              <p className={estilos.indicadorPanel}>
                <Icono icono={WholeWord} tamano={14} /> {E.preciso.indicadorPanel}
              </p>
              <p className={estilos.avisoPanel}>{E.preciso.avisoDescartar}</p>
            </>
          )}
          <CampoTiempo
            etiqueta={E.inicio}
            valor={tiempo(linea.inicio_ms)}
            aplicar={(ms) => fijar('inicio', ms)}
            inactivo={ocupada}
            limite={limite('inicio')}
          />
          <Boton noDisponible={bloqueo} onClick={() => fijar('inicio')}>
            {E.fijarInicio} (I)
          </Boton>
          <CampoTiempo
            etiqueta={E.fin}
            valor={tiempo(fin)}
            aplicar={(ms) => fijar('fin', ms)}
            inactivo={linea.inicio_ms === null || ocupada}
            ayuda={
              linea.inicio_ms === null ? (
                E.finSinInicio
              ) : (
                <>
                  {linea.fin_ms === null && (
                    <>
                      {E.finAuto} <br />
                    </>
                  )}
                  {E.finAyuda}
                </>
              )
            }
            limite={limite('fin')}
          />
          <Boton
            disabled={linea.inicio_ms === null}
            noDisponible={bloqueo}
            onClick={() => fijar('fin')}
          >
            {E.fijarFin} (O)
          </Boton>
          {linea.fin_ms !== null && (
            <Boton noDisponible={bloqueo} onClick={finAutomatico}>
              {E.usarFinAuto}
            </Boton>
          )}
          <Boton onClick={escuchar}>{E.escucharLinea} (L)</Boton>
          <Boton
            aria-keyshortcuts="Shift+L"
            noDisponible={linea.inicio_ms === null ? E.escucharLineaSinInicio : undefined}
            onClick={escucharTramo}
          >
            {E.escucharLineaTramo}
          </Boton>
          <Boton disabled={linea.inicio_ms === null} noDisponible={bloqueo} onClick={borrar}>
            {E.borrarTiempos} (Supr)
          </Boton>
          <label className={estilos.casilla}>
            <input
              type="checkbox"
              checked={escucharAjustes}
              disabled={bucle || ocupada}
              aria-describedby={bucle ? 'escucha-ocupada' : undefined}
              onChange={(e) => fijarEscucharAjustes(e.currentTarget.checked)}
            />{' '}
            {E.escucharAjustar}
          </label>
          {bucle && <p id="escucha-ocupada">{E.timeline.escuchaOcupada}</p>}
          <label className={estilos.casilla}>
            <input
              type="checkbox"
              checked={bucle}
              disabled={ocupada || (!bucle && (!!motivoBucle || !alternarBucle))}
              aria-describedby={motivoBucle ? 'motivo-bucle' : undefined}
              onChange={alternarBucle}
            />{' '}
            {E.timeline.bucle}
          </label>
          <div aria-live="polite">{motivoBucle && <p id="motivo-bucle">{motivoBucle}</p>}</div>
          {abrirPreciso && (
            <Boton
              aria-keyshortcuts="P"
              data-abrir-preciso
              noDisponible={motivoPreciso}
              onClick={abrirPreciso}
            >
              <Icono icono={WholeWord} />
              {E.preciso.abrirPuntos}
            </Boton>
          )}
        </div>
      ) : (
        <p>{E.sinSeleccion}</p>
      )}
      {ayudaBluetooth && (
        <AvisoEnLinea
          tipo="info"
          accion={<BotonIcono icono={X} etiqueta="Cerrar aviso" onClick={cerrarBluetooth} />}
        >
          {E.bluetooth}
        </AvisoEnLinea>
      )}
    </fieldset>
  )
}
