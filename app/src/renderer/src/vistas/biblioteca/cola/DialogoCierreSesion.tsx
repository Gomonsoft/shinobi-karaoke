import { useState } from 'react'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { mostrarToast } from '../../../componentes/gestorToasts'
import { ATRIBUTO_BOTON_COLA } from '../../../sesion/foco'
import { useSesion } from '../../../sesion/ProveedorSesion'
import { SES } from '../../../sesion/textos'
import { tituloDeError } from '../textosError'
import estilos from './panelCola.module.css'
import { enfocarCuando } from './tiempo'

/** Atributo del botón «Abrir en otra pantalla…» del panel (foco tras conservar la cola). */
export const ATRIBUTO_ABRIR_PANEL = 'data-panel-abrir'

const codigoDe = (err: unknown): string =>
  err && typeof err === 'object' && 'codigo' in err && typeof err.codigo === 'string'
    ? err.codigo
    : ''

/**
 * `ses.cierre` en la principal (spec 02, «Cerrar el reproductor»): se muestra cuando el cierre se
 * pidió aquí y hay pendientes. Vive junto al proveedor de sesión para que también aparezca desde
 * «Cerrar el reproductor…» del diálogo de bloqueo en Letra o el Editor. Con origen `secundaria`
 * no pinta nada (el panel muestra `ses.cierre.esperando`).
 */
export function DialogoCierreSesion() {
  const { estado } = useSesion()
  const [anuncio, setAnuncio] = useState('')
  const abierto = estado?.sesion?.cierrePendiente?.origen === 'principal'
  return (
    <>
      <p aria-live="polite" className={estilos.soloLector}>
        {anuncio}
      </p>
      {abierto && <ContenidoCierre alConservar={() => setAnuncio(SES.anuncioConservada)} />}
    </>
  )
}

function ContenidoCierre({ alConservar }: { alConservar(): void }) {
  const { estado, acciones, abrirPanel, cerrarPanel } = useSesion()
  const [obsoleto, setObsoleto] = useState(false)
  const [ocupado, setOcupado] = useState<'eliminar' | 'conservar' | null>(null)
  const pendientes = estado?.pendientes.length ?? 0

  const cancelar = () => void acciones.cancelarCierre().catch(() => undefined)

  const confirmar = async (cola: 'eliminar' | 'conservar') => {
    if (!estado || ocupado) return
    setOcupado(cola)
    setObsoleto(false)
    try {
      await acciones.confirmarCierre(cola, estado.revision)
    } catch (err) {
      setOcupado(null)
      if (codigoDe(err) === 'CONFIRMACION_OBSOLETA') setObsoleto(true)
      else mostrarToast({ tipo: 'error', mensaje: tituloDeError(codigoDe(err)) })
      return
    }
    if (cola === 'eliminar') {
      cerrarPanel()
      mostrarToast({ tipo: 'exito', mensaje: SES.toastEliminada })
      enfocarCuando(`[${ATRIBUTO_BOTON_COLA}]`)
    } else {
      abrirPanel()
      alConservar()
      enfocarCuando(`[${ATRIBUTO_ABRIR_PANEL}]`)
    }
  }

  return (
    <Dialogo
      abierto
      titulo={SES.cierre.titulo}
      ancho="30rem"
      onCancelar={cancelar}
      enfoqueInicial="[data-cancelar]"
      acciones={
        <>
          <Boton data-cancelar onClick={cancelar}>
            {SES.cierre.cancelar}
          </Boton>
          <Boton
            variante="destructivo"
            cargando={ocupado === 'eliminar'}
            onClick={() => void confirmar('eliminar')}
          >
            {SES.cierre.eliminar}
          </Boton>
          <Boton
            variante="primario"
            cargando={ocupado === 'conservar'}
            onClick={() => void confirmar('conservar')}
          >
            {SES.cierre.conservar}
          </Boton>
        </>
      }
    >
      <p>{SES.cierre.cuerpo(pendientes)}</p>
      {obsoleto && <AvisoEnLinea tipo="error">{SES.cierre.obsoleto}</AvisoEnLinea>}
    </Dialogo>
  )
}
