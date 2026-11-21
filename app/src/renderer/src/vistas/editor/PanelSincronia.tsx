import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Icono } from '../../componentes/Icono'
import { Diamond, RotateCcw, X } from 'lucide-react'
import { contarLineas, finEfectivo } from '@shared/letra'
import {
  formatearDesplazamiento,
  formatearTiempo,
  interpretarDesplazamiento,
  numeroDeLinea,
  tiempoMostrado,
  type Limite
} from '@shared/letras/tiempos'
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
  borrar(): void
  desplazar(delta: number): void
  fijarDesplazamiento(ms: number): void
  ayudaBluetooth?: boolean
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
    case 'desplazamiento':
      return E.offsetRango
    default:
      return null
  }
}

/**
 * Aviso de límite vigente de un campo de la línea seleccionada (o del desplazamiento). Lo comparten
 * el panel completo, que lo enseña junto al campo, y los rieles minimizados, junto a su botón.
 */
export function limiteDeCampo(
  edicion: EstadoEditor,
  campo: Campo | 'desplazamiento'
): { mensaje: string; clave: number } | undefined {
  const { aviso, seleccion } = edicion
  if (!aviso?.limite || !aviso.limite.tipo.startsWith(campo)) return undefined
  if (campo !== 'desplazamiento' && aviso.id !== seleccion) return undefined
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
  borrar,
  desplazar,
  fijarDesplazamiento,
  ayudaBluetooth,
  cerrarBluetooth
}: Props) {
  const { letra } = edicion.actual
  const { seleccion } = edicion
  const bloqueado = edicion.sync.activo
  const indice = letra.lineas.findIndex((el) => el.id === seleccion && el.tipo === 'linea')
  const linea = letra.lineas[indice]
  const fin = linea ? finEfectivo(letra, linea.id, duracionMs) : null
  const tiempo = (ms: number | null) =>
    formatearTiempo(ms === null ? null : tiempoMostrado(ms, letra.offset_ms))
  const limite = (campo: Campo | 'desplazamiento') => limiteDeCampo(edicion, campo)
  return (
    <fieldset className={estilos.panelSincronia} disabled={bloqueado} aria-label="Sincronía">
      {linea ? (
        <div className={estilos.ajustesLinea}>
          <h3>{E.lineaN(numeroDeLinea(letra, linea.id), contarLineas(letra))}</h3>
          <p className={estilos.lineaDetalle}>
            «{linea.texto}»{' '}
            {linea.palabras && (
              <span>
                <Icono icono={Diamond} tamano={14} /> {E.palabrasEtiqueta}
              </span>
            )}
          </p>
          <CampoTiempo
            etiqueta={E.inicio}
            valor={tiempo(linea.inicio_ms)}
            aplicar={(ms) => fijar('inicio', ms)}
            limite={limite('inicio')}
          />
          <Boton onClick={() => fijar('inicio')}>{E.fijarInicio} (I)</Boton>
          <CampoTiempo
            etiqueta={E.fin}
            valor={tiempo(fin)}
            aplicar={(ms) => fijar('fin', ms)}
            inactivo={linea.inicio_ms === null}
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
          <Boton disabled={linea.inicio_ms === null} onClick={() => fijar('fin')}>
            {E.fijarFin} (O)
          </Boton>
          {linea.fin_ms !== null && <Boton onClick={finAutomatico}>{E.usarFinAuto}</Boton>}
          <Boton onClick={escuchar}>{E.escucharLinea} (L)</Boton>
          <Boton disabled={linea.inicio_ms === null} onClick={borrar}>
            {E.borrarTiempos} (Supr)
          </Boton>
          <label className={estilos.casilla}>
            <input
              type="checkbox"
              checked={escucharAjustes}
              disabled={bucle}
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
              disabled={!bucle && (!!motivoBucle || !alternarBucle)}
              aria-describedby={motivoBucle ? 'motivo-bucle' : undefined}
              onChange={alternarBucle}
            />{' '}
            {E.timeline.bucle}
          </label>
          <div aria-live="polite">{motivoBucle && <p id="motivo-bucle">{motivoBucle}</p>}</div>
        </div>
      ) : (
        <p>{E.sinSeleccion}</p>
      )}
      <div className={estilos.desplazamiento} role="group" aria-labelledby="titulo-desplazamiento">
        <h3 id="titulo-desplazamiento">{E.offsetTitulo}</h3>
        <div className={estilos.ajustesTiempo}>
          <Boton onClick={() => desplazar(-100)}>−0,1 s</Boton>
          <CampoTiempo
            etiqueta={E.offsetCampo}
            etiquetaOculta
            describedBy="ayuda-desplazamiento"
            valor={formatearDesplazamiento(letra.offset_ms).replace(' s', '')}
            aplicar={fijarDesplazamiento}
            interpretar={interpretarDesplazamiento}
            errorFormato={E.offsetRango}
            limite={limite('desplazamiento')}
          />
          <Boton onClick={() => desplazar(100)}>+0,1 s</Boton>
          <BotonIcono
            icono={RotateCcw}
            etiqueta={E.offsetRestablecer}
            disabled={letra.offset_ms === 0}
            onClick={() => fijarDesplazamiento(0)}
          />
        </div>
        <p id="ayuda-desplazamiento">{E.offsetAyuda}</p>
        {ayudaBluetooth && (
          <AvisoEnLinea
            tipo="info"
            accion={<BotonIcono icono={X} etiqueta="Cerrar aviso" onClick={cerrarBluetooth} />}
          >
            {E.bluetooth}
          </AvisoEnLinea>
        )}
      </div>
    </fieldset>
  )
}
