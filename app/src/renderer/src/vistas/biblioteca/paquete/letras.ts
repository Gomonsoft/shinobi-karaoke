import { mostrarToast } from '../../../componentes/gestorToasts'
import { copiarDetalles } from '../../../soporte/detalles'
import { detallesDeError } from '../errores'
import { mostrarResultadoLetras } from './almacen'
import { LRC } from './textos'

export interface CancionLetra {
  id: string
  titulo: string
  artista: string
}

const mostrarCarpeta = (ubicacionId: string): void => {
  void window.shinobi.letras.mostrarEnCarpeta(ubicacionId).catch(() => undefined)
}

function avisarError(e: unknown): void {
  mostrarToast({
    tipo: 'error',
    mensaje: LRC.error,
    accion: { etiqueta: LRC.copiar, alAccionar: () => void copiarDetalles(detallesDeError(e)) }
  })
}

/**
 * «Exportar la letra (.lrc)…» (docs/ux/02 · Feature 9). Una canción: el «Guardar» del sistema y un toast;
 * varias: «Elegir carpeta» y, si alguna se omitió, el resultado por canción. Cancelar el diálogo no hace
 * nada. El renderer nunca ve rutas: «Mostrar en la carpeta» usa el `ubicacionId` que da main.
 */
export async function exportarLetras(canciones: readonly CancionLetra[]): Promise<void> {
  if (canciones.length === 0) return
  try {
    if (canciones.length === 1) {
      const r = await window.shinobi.letras.exportarLrc(canciones[0]!.id)
      if (r === null) return
      mostrarToast({
        tipo: 'exito',
        mensaje:
          r.lineasOmitidas === 0
            ? LRC.ok
            : r.lineasOmitidas === 1
              ? LRC.omitidasUna
              : LRC.omitidas(r.lineasOmitidas),
        accion: { etiqueta: LRC.mostrar, alAccionar: () => mostrarCarpeta(r.ubicacionId) }
      })
      return
    }
    const r = await window.shinobi.letras.exportarLrcVarias(canciones.map((c) => c.id))
    if (r === null) return
    if (r.omitidas.length > 0) {
      const porId = new Map(canciones.map((c) => [c.id, c]))
      mostrarResultadoLetras({
        escritas: r.escritas,
        total: canciones.length,
        ubicacionId: r.ubicacionId,
        omitidas: r.omitidas.map((o) => ({
          id: o.id,
          motivo: o.motivo,
          titulo: porId.get(o.id)?.titulo ?? o.id,
          artista: porId.get(o.id)?.artista ?? ''
        }))
      })
      return
    }
    mostrarToast({
      tipo: 'exito',
      mensaje: r.carpeta
        ? r.escritas === 1
          ? LRC.variasUna(r.carpeta)
          : LRC.varias(r.escritas, r.carpeta)
        : r.escritas === 1
          ? '1 letra exportada.'
          : LRC.variasSinCarpeta(r.escritas),
      accion: { etiqueta: LRC.mostrarCarpeta, alAccionar: () => mostrarCarpeta(r.ubicacionId) }
    })
  } catch (e) {
    avisarError(e)
  }
}
