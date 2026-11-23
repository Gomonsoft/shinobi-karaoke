import { useCallback } from 'react'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { useReproductor } from '../../navegacion/reproductor'
import { copiarDetalles } from '../../soporte/detalles'
import { detallesDeError } from './errores'
import { mensajeListaMarcada } from './tarjeta'
import { tituloDeError } from './textosError'
import { BIB_PREP } from './textosPreparacion'

const DURACION_TOAST_PROBADA_MS = 10_000

/**
 * «▶ Probar» (docs/ux/02 · Feature 5): abre el reproductor local con el borrador tal como está y, al
 * salir, ofrece `bib.prep.toast.probada` con [Marcar como lista] y [Revisar]. No cambia su estado.
 */
export function useProbar(
  /** Con líneas por revisar pregunta antes (`bib.revision.dialogo`); sin él, marca directamente. */
  pedirMarcar?: (id: string, modalidad: 'karaoke') => void
): (id: string, titulo: string) => void {
  const { ir } = useNavegacion()
  const { abrir } = useReproductor()

  const marcarLista = useCallback(
    async (id: string) => {
      try {
        const resumen = await window.shinobi.biblioteca.marcarLista(id)
        mostrarToast({ tipo: 'exito', mensaje: mensajeListaMarcada(resumen) })
        ir({ tipo: 'biblioteca', enfocar: { id, resaltar: true } })
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
    [ir]
  )

  return useCallback(
    (id: string, titulo: string) =>
      abrir(id, {
        prueba: true,
        alCerrar: () =>
          mostrarToast({
            tipo: 'info',
            mensaje: BIB_PREP.toastProbada(titulo),
            duracionMs: DURACION_TOAST_PROBADA_MS,
            accion: {
              etiqueta: BIB_PREP.marcarLista,
              alAccionar: () => (pedirMarcar ? pedirMarcar(id, 'karaoke') : void marcarLista(id))
            },
            accionSecundaria: {
              etiqueta: BIB_PREP.accion.revisar,
              alAccionar: () => ir({ tipo: 'cancion', id, paso: 'editor', revisar: true })
            }
          })
      }),
    [abrir, marcarLista, ir, pedirMarcar]
  )
}
