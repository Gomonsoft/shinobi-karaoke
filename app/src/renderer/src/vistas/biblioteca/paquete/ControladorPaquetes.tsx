import { useCallback, useEffect } from 'react'
import { useNavegacion } from '../../../navegacion/estado'
import { suscribirCopias, usePaquetes } from './almacen'
import { DialogoExportarPaquete } from './DialogoExportarPaquete'
import { DialogoImportarPaquete } from './DialogoImportarPaquete'
import { DialogoResultadoLrc } from './DialogoResultadoLrc'

/**
 * Pinta los diálogos de paquetes, copias y letras (docs/ux/02 y 08 · Feature 9) y escucha `copias:cambio`
 * y `copias:progreso` una sola vez. Va en `App`, fuera de las vistas: el trabajo sigue si se cambia de
 * vista o se cierra el diálogo.
 */
export function ControladorPaquetes() {
  const { exportar, importar, resultadoLetras } = usePaquetes()
  const { vista, ir } = useNavegacion()
  useEffect(() => suscribirCopias(), [])

  // Al cerrar el resultado: de vuelta a la Biblioteca con la primera importada enfocada y todas resaltadas (sin cambiar de
  // vista si la persona está en otra, como el editor).
  const alTerminar = useCallback(
    (importadas: string[]) => {
      const primera = importadas[0]
      if (!primera) return
      if (vista.tipo === 'biblioteca' || vista.tipo === 'ajustes') {
        ir({ tipo: 'biblioteca', enfocar: { id: primera, resaltar: false, tambien: importadas } })
      }
    },
    [vista.tipo, ir]
  )

  return (
    <>
      {exportar && <DialogoExportarPaquete peticion={exportar} />}
      {importar && <DialogoImportarPaquete peticion={importar} alTerminar={alTerminar} />}
      {resultadoLetras && <DialogoResultadoLrc resultado={resultadoLetras} />}
    </>
  )
}
