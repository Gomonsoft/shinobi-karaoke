import { useEffect, useId, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { copiarDetalles } from '../../soporte/detalles'
import { detallesDeError } from '../biblioteca/errores'
import estilos from './ajustes.module.css'
import { AJPREP, AJREP } from './textos'

/** Enlace de «Qué es LRCLIB» (está en la lista de enlaces permitidos de main). */
const URL_LRCLIB = 'https://lrclib.net'

/**
 * Sección «Letras y preparación automática» (docs/ux/08 · Feature 5): el interruptor de privacidad de
 * la búsqueda automática. Marcada por defecto; se guarda al cambiarla y, si falla, vuelve a su valor.
 * Al marcarla con borradores sin letra avisa de que esos se preparan desde la Biblioteca.
 */
interface Props {
  /** Abierta con «Cambiar en Ajustes» (spec 03 · F6-N8): el foco inicial va al encabezado. */
  enfocarAlAbrir?: boolean
}

export function PreparacionAjustes({ enfocarAlAbrir = false }: Props) {
  const { ir } = useNavegacion()
  const [activa, setActiva] = useState(true)
  const [pendientes, setPendientes] = useState<number | null>(null)
  const idTitulo = useId()
  const idCasilla = useId()
  const idAyuda = useId()
  // Si el usuario cambia la casilla antes de que llegue la configuración, esa lectura no la pisa.
  const tocada = useRef(false)

  useEffect(() => {
    let activo = true
    window.shinobi.config.obtener().then(
      (c) => activo && !tocada.current && setActiva(c.preparacion?.automatica !== false),
      () => undefined
    )
    return () => {
      activo = false
    }
  }, [])

  const alternar = async (nuevo: boolean) => {
    const anterior = activa
    tocada.current = true
    setActiva(nuevo)
    setPendientes(null)
    try {
      await window.shinobi.config.actualizar({ preparacion: { automatica: nuevo } })
    } catch (err) {
      setActiva(anterior)
      mostrarToast({
        tipo: 'error',
        mensaje: AJREP.errorGuardar,
        accion: {
          etiqueta: AJREP.copiar,
          alAccionar: () => void copiarDetalles(detallesDeError(err))
        }
      })
      return
    }
    if (!nuevo) return
    // Borradores «Falta la letra»: sin letra y sin ninguna preparación hecha ni en curso.
    try {
      const lista = await window.shinobi.biblioteca.listar()
      const n = lista.filter(
        (c) =>
          c.estado === 'borrador' &&
          !c.danada &&
          c.pasos?.letra.estado !== 'completado' &&
          !c.preparacion
      ).length
      setPendientes(n > 0 ? n : null)
    } catch {
      setPendientes(null)
    }
  }

  return (
    <div className={estilos.seccion} role="group" aria-labelledby={idTitulo}>
      <h2
        id={idTitulo}
        tabIndex={-1}
        data-foco-inicial={enfocarAlAbrir ? '' : undefined}
        className={estilos.subtitulo}
      >
        {AJPREP.titulo}
      </h2>
      <label htmlFor={idCasilla} className={estilos.casilla}>
        <input
          id={idCasilla}
          type="checkbox"
          aria-describedby={idAyuda}
          checked={activa}
          onChange={(e) => void alternar(e.target.checked)}
        />
        {AJPREP.casilla}
      </label>
      <p id={idAyuda} className={estilos.suave}>
        {activa ? AJPREP.privacidad : AJPREP.desactivado}
      </p>
      <div>
        <Boton
          variante="fantasma"
          onClick={() => void window.shinobi.sistema.abrirEnlace(URL_LRCLIB)}
        >
          {AJPREP.lrclib}
          <Icono icono={ExternalLink} tamano={14} />
        </Boton>
      </div>
      {pendientes !== null && (
        <AvisoEnLinea
          tipo="info"
          accion={
            <Boton
              variante="secundario"
              onClick={() => ir({ tipo: 'biblioteca', casilla: 'letra' })}
            >
              {AJPREP.verlos(pendientes)}
            </Boton>
          }
        >
          {AJPREP.pendientes(pendientes)}
        </AvisoEnLinea>
      )}
    </div>
  )
}
