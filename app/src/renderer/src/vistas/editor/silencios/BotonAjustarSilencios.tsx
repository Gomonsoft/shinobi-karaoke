import { useEffect, useRef, useState } from 'react'
import { AudioWaveform } from 'lucide-react'
import { Boton } from '../../../componentes/Boton'
import { Icono } from '../../../componentes/Icono'
import { Popover } from '../../../componentes/Popover'
import { Tooltip } from '../../../componentes/Tooltip'
import { E } from '../textos'
import estilos from './silencios.module.css'
import { S } from './textos'
import type { Motivo } from './useAjustarSilencios'

const CONSULTA_COMPACTA = '(max-width: 1279px)'

/** Por debajo de 1280 px de ancho el botón es solo el icono (36 × 36). */
function useSoloIcono(): boolean {
  const [solo, setSolo] = useState(() => window.matchMedia?.(CONSULTA_COMPACTA).matches ?? false)
  useEffect(() => {
    const lista = window.matchMedia?.(CONSULTA_COMPACTA)
    if (!lista) return
    const alCambiar = () => setSolo(lista.matches)
    lista.addEventListener('change', alCambiar)
    return () => lista.removeEventListener('change', alCambiar)
  }, [])
  return solo
}

interface Props {
  motivos: Motivo[]
  /** Modo «Sincronizar al ritmo» (tooltip, sin popover). */
  ritmo: boolean
  buscando: boolean
  alPulsar(): void
  alReintentar(): void
  alIrAPrimera(): void
}

export function textoMotivo(m: Motivo): string {
  switch (m.tipo) {
    case 'lineas':
      return E.faltaLineas(m.pendientes)
    case 'separacion':
      return S.falta.separacion
    case 'preparando':
      return S.falta.preparando
    case 'error':
      return S.falta.error
    case 'noDisponible':
      return S.falta.noDisponible
    case 'tema':
      return S.falta.tema
  }
}

export function BotonAjustarSilencios({
  motivos,
  ritmo,
  buscando,
  alPulsar,
  alReintentar,
  alIrAPrimera
}: Props) {
  const ancla = useRef<HTMLButtonElement>(null)
  const [popover, setPopover] = useState(false)
  const soloIcono = useSoloIcono()
  const falta = motivos.length > 0
  const mostrar = popover && falta

  const propiedades = {
    ref: ancla,
    className: `${estilos.boton} ${soloIcono ? estilos.icono : ''}`,
    'data-silencios-boton': true,
    'aria-label': soloIcono ? S.boton : undefined,
    'aria-haspopup': falta ? ('dialog' as const) : undefined,
    'aria-expanded': falta ? mostrar : undefined,
    'aria-disabled': falta || undefined,
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
      if (falta && e.currentTarget.matches(':focus-visible')) setPopover(true)
    },
    onClick: () => {
      if (falta) setPopover(true)
      else alPulsar()
    }
  }
  const contenido = (
    <>
      <Icono icono={AudioWaveform} />
      {!soloIcono && (buscando ? S.buscando : S.boton)}
    </>
  )

  return (
    <>
      {ritmo ? (
        <Boton {...propiedades} noDisponible={S.falta.ritmo} onClick={undefined}>
          {contenido}
        </Boton>
      ) : (
        <Tooltip contenido={S.boton}>
          <Boton
            {...propiedades}
            cargando={buscando && !soloIcono}
            aria-busy={buscando || undefined}
            textoCargando={S.buscando}
          >
            {contenido}
          </Boton>
        </Tooltip>
      )}
      <Popover
        abierto={mostrar}
        ancla={ancla}
        alCerrar={() => setPopover(false)}
        titulo={S.falta.titulo}
        etiqueta={S.falta.titulo}
        anunciar
      >
        <ul className={estilos.faltas}>
          {motivos.map((m) => (
            <li key={m.tipo}>
              {textoMotivo(m)}
              {m.tipo === 'lineas' && (
                <Boton
                  variante="fantasma"
                  onClick={() => {
                    setPopover(false)
                    alIrAPrimera()
                  }}
                >
                  {E.irPrimera(m.pendientes)}
                </Boton>
              )}
              {m.tipo === 'error' && (
                <Boton variante="fantasma" onClick={alReintentar}>
                  {S.falta.reintentar}
                </Boton>
              )}
            </li>
          ))}
        </ul>
      </Popover>
    </>
  )
}
