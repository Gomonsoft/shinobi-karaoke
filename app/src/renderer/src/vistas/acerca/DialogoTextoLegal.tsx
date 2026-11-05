import { useEffect, useState } from 'react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import type { TextoLegal } from '@shared/ipc'
import estilos from './acerca.module.css'
import { TEXTOS_ACERCA as T } from './textos'

interface Props {
  tipo: TextoLegal
  alCerrar: () => void
}

/**
 * Texto completo de la GPL o de los avisos de terceros, leído sin conexión por main.
 * Se muestra como texto preformateado (nunca HTML, ADR 0008).
 */
export function DialogoTextoLegal({ tipo, alCerrar }: Props) {
  const [texto, setTexto] = useState<string | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let activo = true
    window.shinobi.sistema.textoLegal(tipo).then(
      (t) => activo && setTexto(t),
      () => activo && setError(true)
    )
    return () => {
      activo = false
    }
  }, [tipo])

  return (
    <Dialogo
      abierto
      titulo={tipo === 'gpl' ? T.tituloLicencia : T.tituloTerceros}
      onCancelar={alCerrar}
      enfoqueInicial="[data-cerrar]"
      acciones={
        <Boton data-cerrar variante="primario" onClick={alCerrar}>
          {T.cerrar}
        </Boton>
      }
    >
      {error ? (
        <AvisoEnLinea tipo="error">{T.errorTexto}</AvisoEnLinea>
      ) : (
        <pre
          className={estilos.legal}
          // Región desplazable: debe poder enfocarse para leerla con el teclado.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-label={tipo === 'gpl' ? T.tituloLicencia : T.tituloTerceros}
        >
          {texto ?? T.cargando}
        </pre>
      )}
    </Dialogo>
  )
}
