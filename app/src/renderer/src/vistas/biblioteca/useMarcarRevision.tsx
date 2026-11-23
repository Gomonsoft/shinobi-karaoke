import { useCallback, useState, type ReactNode } from 'react'
import { Play } from 'lucide-react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { useReproductor } from '../../navegacion/reproductor'
import { useSesion } from '../../sesion/ProveedorSesion'
import { copiarDetalles } from '../../soporte/detalles'
import { DialogoLetraLista, guardarOmitirAviso } from '../editor/DialogoLetraLista'
import { detallesDeError } from './errores'
import { mensajeListaMarcada, tituloDeTarjeta } from './tarjeta'
import { tituloDeError } from './textosError'
import { BIB_PREP } from './textosPreparacion'

export type ModalidadMarcar = 'karaoke' | 'letra_lista'
type Fase = {
  id: string
  modalidad: ModalidadMarcar
  fase: 'revision' | 'letraLista'
  /** Líneas por revisar que mostró el diálogo de pendientes. */
  pendientes: number
}

/**
 * «Marcar como lista» / «Marcar como letra lista» sin abrir el editor (spec 02 · Feature 11): con líneas
 * pendientes (`resumen.revision`, o `recuentoRevision` si main aún no lo ha calculado) pregunta antes con `bib.revision.dialogo`; para «Letra lista» sigue
 * el aviso de la primera activación si no está silenciado. La canción nunca pasa a lista sola.
 */
export function useMarcarRevision(resumenDe: (id: string) => ResumenCancionIpc | undefined): {
  pedir(id: string, modalidad: ModalidadMarcar): void
  dialogos: ReactNode
} {
  const { ir } = useNavegacion()
  const { abrir } = useReproductor()
  const { haySesion } = useSesion()
  const [fase, setFase] = useState<Fase | null>(null)

  const marcar = useCallback(
    async (id: string, modalidad: ModalidadMarcar) => {
      try {
        const resumen = await window.shinobi.biblioteca.marcarLista(id, { modalidad })
        ir({ tipo: 'biblioteca', enfocar: { id, resaltar: true } })
        mostrarToast({
          tipo: 'exito',
          mensaje: mensajeListaMarcada(resumen),
          accion: haySesion
            ? undefined
            : { etiqueta: 'Reproducir', icono: Play, alAccionar: () => abrir(id) }
        })
      } catch (err) {
        const codigo =
          err && typeof err === 'object' && 'codigo' in err && typeof err.codigo === 'string'
            ? err.codigo
            : ''
        mostrarToast({
          tipo: 'error',
          mensaje: tituloDeError(codigo),
          accion: {
            etiqueta: 'Copiar detalles',
            alAccionar: () => void copiarDetalles(detallesDeError(err))
          }
        })
      }
    },
    [ir, abrir, haySesion]
  )

  /** Tras el aviso de pendientes: el de «Letra lista» (si toca) y marcar. */
  const continuar = useCallback(
    async (id: string, modalidad: ModalidadMarcar) => {
      if (modalidad === 'letra_lista') {
        const omitido = await window.shinobi.config
          .obtener()
          .then((c) => c.editor.omitir_aviso_letra_lista)
          .catch(() => false)
        if (!omitido) {
          setFase({ id, modalidad, fase: 'letraLista', pendientes: 0 })
          return
        }
      }
      setFase(null)
      await marcar(id, modalidad)
    },
    [marcar]
  )

  const pedir = useCallback(
    (id: string, modalidad: ModalidadMarcar) => {
      const decidir = (r: { dudosas: number; dudosasImportantes: number } | null): void => {
        const n = r?.dudosasImportantes ?? 0
        if (n > 0) setFase({ id, modalidad, fase: 'revision', pendientes: n })
        else void continuar(id, modalidad)
      }
      const revision = resumenDe(id)?.revision
      if (revision !== undefined && revision !== null) decidir(revision)
      else {
        // Sin recuento en memoria: main lo calcula al momento, igual que el editor.
        void window.shinobi.biblioteca
          .recuentoRevision(id)
          .catch(() => null)
          .then(decidir)
      }
    },
    [resumenDe, continuar]
  )

  const resumen = fase ? resumenDe(fase.id) : undefined
  const cerrar = () => setFase(null)
  const dialogos = !fase ? null : fase.fase === 'revision' ? (
    <Dialogo
      abierto
      titulo={BIB_PREP.revision.dialogoTitulo}
      onCancelar={cerrar}
      enfoqueInicial="[data-revisar-ahora]"
      acciones={
        <>
          <Boton onClick={cerrar}>Cancelar</Boton>
          <Boton onClick={() => void continuar(fase.id, fase.modalidad)}>
            {BIB_PREP.revision.marcarIgualmente}
          </Boton>
          <Boton
            data-revisar-ahora
            variante="primario"
            onClick={() => {
              cerrar()
              ir({ tipo: 'cancion', id: fase.id, paso: 'editor', revisar: true })
            }}
          >
            {BIB_PREP.revision.revisarAhora}
          </Boton>
        </>
      }
    >
      <p>
        {BIB_PREP.revision.dialogoCuerpo(resumen ? tituloDeTarjeta(resumen) : '', fase.pendientes)}
      </p>
    </Dialogo>
  ) : (
    <DialogoLetraLista
      variante="marcar"
      alCancelar={cerrar}
      alConfirmar={async (omitir) => {
        if (omitir) await guardarOmitirAviso()
        cerrar()
        await marcar(fase.id, fase.modalidad)
      }}
    />
  )

  return { pedir, dialogos }
}
