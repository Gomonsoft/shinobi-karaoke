import { X } from 'lucide-react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { LP } from './preparacion'

interface Props {
  /** Texto de `let.prep.elegida` o `let.prep.elegida.corregida`. */
  texto: string
  alVerOtras(): void
  alCerrar(): void
}

/** Aviso sobre el resumen de C cuando la preparación eligió la letra por el usuario (F5-L1). */
export function AvisoEleccion({ texto, alVerOtras, alCerrar }: Props) {
  return (
    <AvisoEnLinea
      tipo="info"
      accion={
        <>
          <Boton variante="secundario" onClick={alVerOtras}>
            {LP.verOtras}
          </Boton>
          <BotonIcono icono={X} etiqueta={LP.cerrarAviso} onClick={alCerrar} />
        </>
      }
    >
      {texto}
    </AvisoEnLinea>
  )
}
