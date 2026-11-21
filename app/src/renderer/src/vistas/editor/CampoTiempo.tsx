import { useState, type ReactNode } from 'react'
import { interpretarTiempo } from '@shared/letras/tiempos'
import { CampoTexto } from '../../componentes/Campos'
import { Tooltip } from '../../componentes/Tooltip'
import { E } from './textos'

interface Props {
  etiqueta: string
  /** Nombre accesible sin etiqueta visible (otro título ya encabeza el campo). */
  etiquetaOculta?: boolean
  /** Id de un texto de ayuda externo al campo. */
  describedBy?: string
  valor: string
  aplicar(msMostrado: number): void
  interpretar?(texto: string): number | null
  errorFormato?: string
  inactivo?: boolean
  ayuda?: ReactNode
  limite?: { mensaje: string; clave: number }
}

export function CampoTiempo({
  etiqueta,
  etiquetaOculta,
  describedBy,
  valor,
  aplicar,
  interpretar = interpretarTiempo,
  errorFormato = E.formatoTiempo,
  inactivo,
  ayuda,
  limite
}: Props) {
  const [borrador, setBorrador] = useState<{ base: string; texto: string; error: boolean } | null>(
    null
  )
  const edicion = borrador?.base === valor ? borrador : null
  function confirmar() {
    if (!edicion || inactivo) return
    const ms = interpretar(edicion.texto)
    if (ms === null) {
      setBorrador({ ...edicion, error: true })
      return
    }
    aplicar(ms)
    setBorrador(null)
  }
  return (
    <Tooltip
      contenido={limite?.mensaje ?? ''}
      forzar={limite && { clave: limite.clave, ms: 2000 }}
      suprimir={!limite}
    >
      <CampoTexto
        etiqueta={etiqueta}
        etiquetaOculta={etiquetaOculta}
        aria-describedby={describedBy}
        value={edicion?.texto ?? valor}
        disabled={inactivo}
        ayuda={ayuda}
        error={edicion?.error ? errorFormato : undefined}
        spellCheck={false}
        onChange={(e) => setBorrador({ base: valor, texto: e.currentTarget.value, error: false })}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            confirmar()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setBorrador(null)
          }
        }}
      />
    </Tooltip>
  )
}
