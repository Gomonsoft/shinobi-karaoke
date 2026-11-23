import { CC, mmss } from '../../letra/textosComprobacion'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import type { DetalleNoCoincide, TramoEncaje } from '../../letra/comprobacion'
import { S } from '../silencios/textos'
import estilos from './comprobar.module.css'
import { K } from './textos'
import type { DialogoComprobar } from './useComprobarLetra'

interface Props {
  dialogo: DialogoComprobar
  mac: boolean
  alConfirmar(): void
  alCancelar(): void
  alIr(tramo: TramoEncaje): void
  alBuscarOtra(): void
}

function Tramos({
  tramos,
  motivo,
  alIr
}: {
  tramos: TramoEncaje[]
  motivo: string
  alIr(t: TramoEncaje): void
}) {
  return (
    <ul className={estilos.tramos}>
      {tramos.map((t) => (
        <li
          key={`${t.desdeMs}-${t.hastaMs}`}
          className={estilos.tramo}
          aria-label={K.noCoincide.tramoAria(mmss(t.desdeMs), mmss(t.hastaMs), motivo)}
        >
          <span>
            {mmss(t.desdeMs)} – {mmss(t.hastaMs)}
          </span>
          <Boton
            variante="fantasma"
            aria-label={K.noCoincide.irNombre(mmss(t.desdeMs))}
            onClick={() => alIr(t)}
          >
            {K.noCoincide.ir}
          </Boton>
        </li>
      ))}
    </ul>
  )
}

function MotivosNoEncaja({
  detalle,
  alIr
}: {
  detalle: DetalleNoCoincide
  alIr(t: TramoEncaje): void
}) {
  const sinTiempo = (tramos: TramoEncaje[]): [number, number][] =>
    tramos.map((t) => [t.desdeMs, t.hastaMs])
  return (
    <ul className={estilos.motivos}>
      {detalle.lineasSinVoz > 0 && (
        <li>
          {CC.detalle.silencio(detalle.lineasSinVoz, detalle.totalLineas, [])}
          <Tramos
            tramos={detalle.silencio}
            motivo={CC.detalle.silencio(
              detalle.lineasSinVoz,
              detalle.totalLineas,
              sinTiempo(detalle.silencio)
            )}
            alIr={alIr}
          />
        </li>
      )}
      {detalle.vozSinLetra.length > 0 && (
        <li>
          {detalle.vozSinLetra.length === 1
            ? CC.detalle.vozSinLetra(sinTiempo(detalle.vozSinLetra))
            : `Hay voz sin letra en ${detalle.vozSinLetra.length} tramos.`}
          <Tramos tramos={detalle.vozSinLetra} motivo="voz sin letra" alIr={alIr} />
        </li>
      )}
      {detalle.variable && <li>{CC.detalle.variable}</li>}
    </ul>
  )
}

/** Los tres diálogos de «Comprobar la letra con la voz» (spec 06 · Feature 4). */
export function DialogosComprobar({
  dialogo,
  mac,
  alConfirmar,
  alCancelar,
  alIr,
  alBuscarOtra
}: Props) {
  if (dialogo.tipo === 'desfase') {
    return (
      <Dialogo
        abierto
        titulo={K.desfase.titulo}
        onCancelar={alCancelar}
        enfoqueInicial="[data-confirmar-desfase]"
        acciones={
          <>
            <Boton variante="fantasma" onClick={alCancelar}>
              {K.desfase.cancelar}
            </Boton>
            <Boton variante="primario" data-confirmar-desfase onClick={alConfirmar}>
              {K.desfase.boton}
            </Boton>
          </>
        }
      >
        {dialogo.obsoleto && (
          <p role="alert" className={estilos.obsoleto}>
            {K.desfase.obsoleto}
          </p>
        )}
        <p>{K.desfase.explicacion(dialogo.encaje.desfaseMs, dialogo.lineas)}</p>
        {dialogo.palabras > 0 && <p>{K.desfase.palabras(dialogo.palabras)}</p>}
        <p className={estilos.nota}>{S.deshacer(mac)}</p>
      </Dialogo>
    )
  }
  if (dialogo.tipo === 'noEncaja') {
    return (
      <Dialogo
        abierto
        titulo={K.noCoincide.titulo}
        onCancelar={alCancelar}
        enfoqueInicial="[data-cerrar-noencaja]"
        acciones={
          <>
            <Boton variante="secundario" onClick={alBuscarOtra}>
              {K.noCoincide.otra}
            </Boton>
            <Boton variante="primario" data-cerrar-noencaja onClick={alCancelar}>
              {K.noCoincide.cerrar}
            </Boton>
          </>
        }
      >
        <p>{K.noCoincide.intro}</p>
        <MotivosNoEncaja detalle={dialogo.detalle} alIr={alIr} />
        {!dialogo.detalle.variable && <p>{K.noCoincide.pie}</p>}
      </Dialogo>
    )
  }
  return (
    <Dialogo
      abierto
      titulo={K.dudosa.titulo}
      onCancelar={alCancelar}
      enfoqueInicial="[data-cerrar-dudosa]"
      acciones={
        <Boton variante="primario" data-cerrar-dudosa onClick={alCancelar}>
          {K.dudosa.cerrar}
        </Boton>
      }
    >
      <p>{K.dudosa.cuerpo}</p>
    </Dialogo>
  )
}
