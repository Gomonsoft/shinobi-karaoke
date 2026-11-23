import { type ActionDispatch } from 'react'
import type { Estilo } from '@shared/estilo'
import type { Pantalla } from '@shared/pantalla'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { VistaTema } from '../aparienciaVista'
import type { AccionEditor, AparienciaEditor } from '../estado'
import { pantallaVisible } from './pantallaEfectiva'
import type { ControlPantalla } from './SeccionPantalla'
import { T_PANTALLA as T } from './textosPantalla'

interface OpcionesControl {
  vista: VistaTema
  resumen: ResumenCancionIpc
  apariencia: AparienciaEditor
  /** Estilo visible: el propio (D2), el borrador (D3) o el del tema (D1, D4). */
  estilo: Estilo
  despachar: ActionDispatch<[AccionEditor]>
  anunciar(texto: string): void
  ejemploActivo: boolean
  alternarEjemplo(): void
  sonando: boolean
  /** El sistema pide reducir el movimiento (nota `edi.pantalla.reducido`). */
  movimientoReducido: boolean
  /** La canción tiene reparto: «Varias voces» (en D3 se muestra siempre). */
  reparto?: boolean
}

const ahora = (): number => Date.now()

/** Une la lectura de la letra en pantalla con las acciones del historial para `SeccionPantalla`. */
export function useControlPantalla(o: OpcionesControl): ControlPantalla {
  const { vista, apariencia, estilo, despachar, anunciar } = o
  const pantalla = pantallaVisible(vista, apariencia, estilo)
  const reemplazo =
    apariencia.seleccion.modo === 'propio' ? undefined : apariencia.reemplazos?.pantalla
  const vinculado = vista.estado === 'd1' || vista.estado === 'd4'
  const propia = vinculado && reemplazo !== undefined

  return {
    resumen: vinculado && !propia,
    propia,
    d3Propia: vista.estado === 'd3' && reemplazo !== undefined,
    pantalla,
    varias: !!o.reparto || vista.estado === 'd3',
    procedencia: vista.procedencia,
    temaNombre: vista.temaNombre,
    ejemploActivo: o.ejemploActivo,
    movimientoReducido: o.movimientoReducido,
    cambiar: (nueva: Pantalla, clave: string) => {
      if (vista.estado === 'd3') {
        despachar({
          tipo: 'estilo_borrador',
          estilo: { ...estilo, pantalla: nueva },
          clave: `pantalla.${clave}`,
          ahora: ahora()
        })
      } else despachar({ tipo: 'pantalla', pantalla: nueva, clave, ahora: ahora() })
      // Elegir otro cambio de línea con el audio en pausa enseña el ejemplo una vez.
      if (clave.startsWith('cambio') && !o.sonando && !o.ejemploActivo) o.alternarEjemplo()
    },
    cambiarSoloCancion: () => {
      despachar({ tipo: 'pantalla', pantalla, clave: 'propia', ahora: ahora() })
      anunciar(T.anuncio.propia)
    },
    usarLaDelTema: () => {
      despachar({ tipo: 'pantalla', pantalla: null, clave: 'usarTema', ahora: ahora() })
      anunciar(T.anuncio.usarTema)
    },
    alternarEjemplo: o.alternarEjemplo
  }
}
