import { Boton } from '../../componentes/Boton'
import { useNavegacion } from '../../navegacion/estado'
import { AcercaDe } from '../acerca/AcercaDe'
import estilos from './ajustes.module.css'
import { SeparacionAjustes } from './SeparacionAjustes'
import { AJ } from './textos'

/** Vista Ajustes (`ux/08`): separación de voz (solo informativa) y Acerca de. Esc la cierra (marco). */
export function Ajustes() {
  const { ir } = useNavegacion()
  // Sin API de runtime (pruebas de otras vistas) solo se muestra Acerca de.
  const conRuntime = typeof window.shinobi.runtime?.estado === 'function'
  return (
    <section className={estilos.vista} aria-labelledby="titulo-vista">
      <Boton variante="fantasma" onClick={() => ir({ tipo: 'biblioteca' })}>
        {AJ.volver}
      </Boton>
      <h1 id="titulo-vista" className="t-titulo" tabIndex={-1} data-foco-inicial>
        {AJ.titulo}
      </h1>
      {conRuntime && (
        <>
          <SeparacionAjustes />
          <hr className={estilos.separador} />
        </>
      )}
      <AcercaDe />
    </section>
  )
}
