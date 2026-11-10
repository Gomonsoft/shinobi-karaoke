import { Boton } from '../../componentes/Boton'
import { useNavegacion, vistaDeOrigen } from '../../navegacion/estado'
import { AcercaDe } from '../acerca/AcercaDe'
import estilos from './ajustes.module.css'
import { SeparacionAjustes } from './SeparacionAjustes'
import { TemasAjustes } from './TemasAjustes'
import { AJ } from './textos'

/**
 * Vista Ajustes (`ux/08`): separación de voz (solo informativa), temas y Acerca de. «Volver» y Esc
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
      <AcercaDe />
    </section>
  )
}
