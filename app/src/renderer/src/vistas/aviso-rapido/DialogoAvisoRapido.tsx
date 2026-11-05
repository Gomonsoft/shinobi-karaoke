import { useId, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { Icono } from '../../componentes/Icono'
import { DialogoTextoLegal } from '../acerca/DialogoTextoLegal'
import estilos from './avisoRapido.module.css'
import { RAPIDO, type MotivoRapido } from './textos'

interface Props {
  abierto: boolean
  /** Primera línea: de dónde viene la oferta (primer arranque o separación). */
  motivo: MotivoRapido
  /** Tamaño de Rápido en bytes; `null` si ya está descargado y verificado. */
  bytes: number | null
  /** Cancelar, Esc o cerrar: no guarda ni descarga nada. */
  alCancelar: () => void
  /** Pulsar "Usar el modelo Rápido" **es** el consentimiento (ux/01). */
  alAceptar: () => void
}

/** Tamaño en MB redondeado, como en el resto de la vista de instalación (`59 MB`). */
export const textoTamanoRapido = (bytes: number | null): string | null =>
  bytes === null ? null : `${String(Math.round(bytes / 1e6))} MB`

/**
 * Diálogo `aviso-rapido` (ux/01, 0057): el único texto de riesgo del modelo Rápido. Lo usan el
 * primer arranque y, más adelante, la vista de progreso (0068).
 */
export function DialogoAvisoRapido({ abierto, motivo, bytes, alCancelar, alAceptar }: Props) {
  const idDescripcion = useId()
  const [creditos, setCreditos] = useState(false)
  return (
    <>
      <Dialogo
        abierto={abierto}
        titulo={RAPIDO.titulo}
        onCancelar={alCancelar}
        enfoqueInicial="[data-cancelar]"
        descripcionId={idDescripcion}
        ancho="32.5rem"
        acciones={
          <>
            <Boton data-cancelar onClick={alCancelar}>
              {RAPIDO.cancelar}
            </Boton>
            <Boton variante="primario" onClick={alAceptar}>
              {RAPIDO.aceptar}
            </Boton>
          </>
        }
      >
        <div id={idDescripcion}>
          <p className={estilos.motivo}>{RAPIDO.motivo[motivo]}</p>
          <p className={estilos.cuerpo}>{RAPIDO.cuerpo}</p>
          <div className={estilos.recuadro}>
            <p className={estilos.recuadroTitulo}>
              <Icono icono={TriangleAlert} tamano={16} /> {RAPIDO.avisoTitulo}
            </p>
            <ul className={estilos.lista}>
              <li>{RAPIDO.licencia}</li>
              <li>{RAPIDO.origen(textoTamanoRapido(bytes))}</li>
              <li>{RAPIDO.responsabilidad}</li>
            </ul>
            <button type="button" className={estilos.enlace} onClick={() => setCreditos(true)}>
              {RAPIDO.creditos}
            </button>
          </div>
          <p className={estilos.alcance}>{RAPIDO.alcance}</p>
        </div>
      </Dialogo>
      {creditos && <DialogoTextoLegal tipo="terceros" alCerrar={() => setCreditos(false)} />}
    </>
  )
}
