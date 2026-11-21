import { useState } from 'react'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { LL } from './textosLetraLista'

interface Props {
  /** `cambio`: desde el menú ⋯ (cambia la etiqueta de confirmar). */
  variante: 'marcar' | 'cambio'
  alCancelar(): void
  /** `omitir`: la casilla estaba marcada. */
  alConfirmar(omitir: boolean): void | Promise<void>
}

/** Aviso de la primera activación de «Letra lista» (spec 06, LL). Cancelar no escribe nada. */
export function DialogoLetraLista({ variante, alCancelar, alConfirmar }: Props) {
  const [omitir, setOmitir] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  async function confirmar() {
    setOcupado(true)
    try {
      await alConfirmar(omitir)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <Dialogo
      abierto
      titulo={LL.dialogoTitulo}
      onCancelar={alCancelar}
      enfoqueInicial="[data-confirmar]"
      acciones={
        <>
          <Boton onClick={alCancelar}>Cancelar</Boton>
          <Boton
            data-confirmar
            variante="primario"
            cargando={ocupado}
            onClick={() => void confirmar()}
          >
            {variante === 'cambio' ? LL.confirmarCambio : LL.boton}
          </Boton>
        </>
      }
    >
      <p>{LL.dialogoCuerpo}</p>
      <label>
        <input type="checkbox" checked={omitir} onChange={(e) => setOmitir(e.target.checked)} />{' '}
        {LL.noVolverAMostrar}
      </label>
    </Dialogo>
  )
}

/** Guarda la preferencia global; si falla, no bloquea (se registra el error). */
export async function guardarOmitirAviso(): Promise<void> {
  try {
    await window.shinobi.config.actualizar({ editor: { omitir_aviso_letra_lista: true } })
  } catch (error) {
    console.error('No se pudo guardar omitir_aviso_letra_lista', error)
  }
}
