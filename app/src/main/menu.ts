import type { MenuItemConstructorOptions } from 'electron'
import type { AccionMenu } from '@shared/ipc'
import { TITULO_APP } from '@shared/titulo'

export const IDS_ZOOM = {
  acercar: 'zoom-mas',
  acercarOculto: 'zoom-mas-oculto',
  alejar: 'zoom-menos',
  restablecer: 'zoom-restablecer'
} as const

/**
 * Plantilla del menú de aplicación mínimo (0018). En macOS es imprescindible para copiar/pegar
 * y salir. Los atajos propios envían la acción al renderer; el zoom usa los roles de Electron.
 */
export function plantillaMenu(
  plataforma: NodeJS.Platform,
  enviar: (accion: AccionMenu) => void,
  /** Durante el primer arranque devuelve `false` y "Añadir canción" y "Ajustes" se ignoran (0036). */
  permitida: () => boolean = () => true
): MenuItemConstructorOptions[] {
  const lanzar = (accion: AccionMenu): void => {
    if (permitida()) enviar(accion)
  }
  const mac = plataforma === 'darwin'
  const archivo: MenuItemConstructorOptions[] = [
    { label: 'Añadir canción', accelerator: 'CommandOrControl+N', click: () => lanzar('anadir') },
    { label: 'Ajustes', accelerator: 'CommandOrControl+,', click: () => lanzar('ajustes') }
  ]
  if (!mac) archivo.push({ type: 'separator' }, { role: 'quit', label: 'Salir' })

  const plantilla: MenuItemConstructorOptions[] = []
  if (mac) {
    plantilla.push({
      label: TITULO_APP,
      submenu: [
        { role: 'about', label: `Acerca de ${TITULO_APP}` },
        { type: 'separator' },
        { role: 'hide', label: `Ocultar ${TITULO_APP}` },
        { role: 'hideOthers', label: 'Ocultar otros' },
        { role: 'unhide', label: 'Mostrar todo' },
        { type: 'separator' },
        { role: 'quit', label: `Salir de ${TITULO_APP}` }
      ]
    })
  }
  plantilla.push(
    { label: 'Archivo', submenu: archivo },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          id: IDS_ZOOM.acercar,
          role: 'zoomIn',
          label: 'Acercar',
          accelerator: 'CommandOrControl+Plus'
        },
        // En teclados donde "+" exige Mays, Ctrl/Cmd+= también acerca (oculto).
        {
          id: IDS_ZOOM.acercarOculto,
          role: 'zoomIn',
          label: 'Acercar',
          accelerator: 'CommandOrControl+=',
          visible: false
        },
        {
          id: IDS_ZOOM.alejar,
          role: 'zoomOut',
          label: 'Alejar',
          accelerator: 'CommandOrControl+-'
        },
        {
          id: IDS_ZOOM.restablecer,
          role: 'resetZoom',
          label: 'Tamaño real',
          accelerator: 'CommandOrControl+0'
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    }
  )
  return plantilla
}
