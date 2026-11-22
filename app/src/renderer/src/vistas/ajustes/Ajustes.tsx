import { useEffect } from 'react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { useNavegacion, vistaDeOrigen } from '../../navegacion/estado'
import { AcercaDe } from '../acerca/AcercaDe'
import { ID_TITULO_ACTUALIZACIONES } from '../acerca/BloqueActualizaciones'
import { hayNueva } from '../acerca/modeloActualizaciones'
import { AJACT } from '../acerca/textosActualizaciones'
import { useActualizaciones } from '../acerca/useActualizaciones'
import estilos from './ajustes.module.css'
import { ReproductorAjustes } from './ReproductorAjustes'
import { SeparacionAjustes } from './SeparacionAjustes'
import { TemasAjustes } from './TemasAjustes'
import { AJ } from './textos'

/**
 * Vista Ajustes (`ux/08`): separación de voz (solo informativa), temas, reproductor y Acerca de. «Volver» y Esc
 * regresan a la vista de origen (Biblioteca o editor de la canción, con la pestaña Estilo).
 */
export function Ajustes() {
  const { vista, ir } = useNavegacion()
  const origen = vista.tipo === 'ajustes' ? vista.origen : undefined
  const enTemas = vista.tipo === 'ajustes' && vista.seccion === 'temas'
  // Sin API de temas (pruebas de otras vistas) no se muestra la sección.
  const conTemas = typeof window.shinobi.temas?.catalogo === 'function'
  // Sin API de runtime (pruebas de otras vistas) solo se muestra Acerca de.
  const conRuntime = typeof window.shinobi.runtime?.estado === 'function'
  // Sin API de configuración (pruebas de otras vistas) no se muestra «Reproductor».
  const conConfig = typeof window.shinobi.config?.obtener === 'function'
  const { estado: actualizaciones } = useActualizaciones()
  const nueva = hayNueva(actualizaciones) ? actualizaciones?.disponible : null
  // Abrir Ajustes con una versión anunciada la deja «vista» y apaga el punto del botón (ux/08 · F3).
  useEffect(() => {
    if (nueva && actualizaciones?.vista !== nueva.version) {
      window.shinobi.actualizaciones.marcarVista(nueva.version).catch(() => undefined)
    }
  }, [nueva, actualizaciones?.vista])
  const verActualizaciones = () => {
    const titulo = document.getElementById(ID_TITULO_ACTUALIZACIONES)
    titulo?.scrollIntoView?.({ block: 'start' })
    titulo?.focus()
  }
  return (
    <section className={estilos.vista} aria-labelledby="titulo-vista">
      <Boton variante="fantasma" onClick={() => ir(vistaDeOrigen(origen))}>
        {origen?.tipo === 'editor' ? AJ.volverEditor : AJ.volver}
      </Boton>
      <h1
        id="titulo-vista"
        className="t-titulo"
        tabIndex={-1}
        data-foco-inicial={enTemas && conTemas ? undefined : ''}
      >
        {AJ.titulo}
      </h1>
      {nueva && (
        <AvisoEnLinea
          tipo="info"
          accion={
            <Boton variante="fantasma" onClick={verActualizaciones}>
              {AJACT.ver}
            </Boton>
          }
        >
          {AJACT.banner(nueva.version)}
        </AvisoEnLinea>
      )}
      {conRuntime && (
        <>
          <SeparacionAjustes />
          <hr className={estilos.separador} />
        </>
      )}
      {conTemas && (
        <>
          <TemasAjustes enfocarAlAbrir={enTemas} />
          <hr className={estilos.separador} />
        </>
      )}
      {conConfig && (
        <>
          <ReproductorAjustes />
          <hr className={estilos.separador} />
        </>
      )}
      <AcercaDe />
    </section>
  )
}
