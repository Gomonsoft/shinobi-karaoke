import { CircleHelp, X } from 'lucide-react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { LP } from './preparacion'

interface Props {
  /** Texto de `let.prep.elegida` o `let.prep.elegida.corregida`. */
  texto: string
  /** Letra elegida sin comprobar con la voz (`let.prep.elegida.sinComprobar`): otro icono y una negrita. */
  sinComprobar?: boolean
  alVerOtras(): void
  alCerrar(): void
}

/** Aviso sobre el resumen de C cuando la preparación eligió la letra por el usuario (F5-L1). */
export function AvisoEleccion({ texto, sinComprobar, alVerOtras, alCerrar }: Props) {
  return (
    <AvisoEnLinea
      tipo="info"
      icono={sinComprobar ? CircleHelp : undefined}
      accion={
        <>
          <Boton variante="secundario" onClick={alVerOtras}>
            {LP.verOtras}
          </Boton>
          <BotonIcono icono={X} etiqueta={LP.cerrarAviso} onClick={alCerrar} />
        </>
      }
    >
      {sinComprobar ? (
        <>
          {LP.elegidaSinComprobar.inicio}
          <strong>{LP.elegidaSinComprobar.negrita}</strong>
          {LP.elegidaSinComprobar.fin}
        </>
      ) : (
        texto
      )}
    </AvisoEnLinea>
  )
}
