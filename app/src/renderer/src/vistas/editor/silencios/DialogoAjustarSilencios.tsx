import { useId, useState } from 'react'
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import { finEfectivo } from '@shared/letra'
import { contador, numeroDeLinea } from '@shared/letras/tiempos'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { Icono } from '../../../componentes/Icono'
import estilos from './silencios.module.css'
import { S } from './textos'
import type { PropuestaAbierta } from './useAjustarSilencios'

const MAX_TEXTO = 40

const truncar = (texto: string): string =>
  texto.length > MAX_TEXTO ? `${texto.slice(0, MAX_TEXTO - 1).trimEnd()}…` : texto

interface Props {
  abierta: PropuestaAbierta
  duracionMs: number
  mac: boolean
  ocupado?: boolean
  alConfirmar(): void
  alCancelar(): void
}

export function DialogoAjustarSilencios({
  abierta,
  duracionMs,
  mac,
  ocupado,
  alConfirmar,
  alCancelar
}: Props) {
  const { propuesta, letraAntes, espera, obsoleto } = abierta
  const [verLineas, setVerLineas] = useState(false)
  const idLista = useId()
  const total = contador(letraAntes).total
  const activa = propuesta.espera !== null
  const mostrarCuenta = propuesta.huecosLargos > 0

  return (
    <Dialogo
      abierto
      titulo={S.dialogo.titulo}
      onCancelar={alCancelar}
      enfoqueInicial="[data-confirmar-silencios]"
      acciones={
        <>
          <Boton variante="fantasma" onClick={alCancelar}>
            {S.dialogo.cancelar}
          </Boton>
          <Boton
            variante="primario"
            data-confirmar-silencios
            aria-busy={ocupado || undefined}
            onClick={alConfirmar}
          >
            {S.aplicar}
          </Boton>
        </>
      }
    >
      {obsoleto && (
        <p role="alert" className={estilos.obsoleto}>
          {S.obsoleto}
        </p>
      )}
      <p>{S.dialogo.explicacion}</p>
      <ul className={estilos.recuentos}>
        <li>{S.lineas(propuesta.lineasCambiadas, total)}</li>
        {propuesta.finesFijadosCambiados > 0 && (
          <li>
            <Icono icono={TriangleAlert} tamano={16} className={estilos.aviso} />{' '}
            {S.manuales(propuesta.finesFijadosCambiados)}
          </li>
        )}
        {mostrarCuenta && (
          <li>
            {activa
              ? S.cuentaActivar(propuesta.huecosLargos, espera.umbral_ms)
              : S.cuentaYaActiva(propuesta.huecosLargos, espera.umbral_ms)}
          </li>
        )}
      </ul>
      <Boton
        variante="fantasma"
        aria-expanded={verLineas}
        aria-controls={idLista}
        onClick={() => setVerLineas((v) => !v)}
      >
        <Icono icono={verLineas ? ChevronDown : ChevronRight} tamano={16} />
        {S.verLineas(verLineas)}
      </Boton>
      {verLineas && (
        <ul id={idLista} className={estilos.lista}>
          {propuesta.cambios.map((c) => {
            const el = propuesta.letra.lineas.find((l) => l.id === c.id)
            const n = numeroDeLinea(propuesta.letra, c.id)
            const texto = truncar(el?.texto ?? '')
            const antes = finEfectivo(letraAntes, c.id, duracionMs) ?? 0
            const largo = c.huecoMs !== null && c.huecoMs >= espera.umbral_ms
            return (
              <li
                key={c.id}
                aria-label={S.filaAria(n, texto, antes, c.finDespues, c.eraFijado, largo)}
              >
                {S.fila(n, texto, antes, c.finDespues, c.eraFijado, largo)}
              </li>
            )
          })}
        </ul>
      )}
      <p className={estilos.nota}>{S.deshacer(mac)}</p>
    </Dialogo>
  )
}
