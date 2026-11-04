import { useEffect, useRef, type ReactNode } from 'react'
import { Mic, Plus, Settings } from 'lucide-react'
import { Boton } from '../componentes/Boton'
import { BotonIcono } from '../componentes/BotonIcono'
import { Icono } from '../componentes/Icono'
import { IndicadorActividad } from './IndicadorActividad'
import { claveVista, VISTAS_SIN_BARRA, useNavegacion } from './estado'
import estilos from './marco.module.css'

interface MarcoProps {
  /** `true` si la biblioteca no tiene canciones (oculta el botón primario de la barra). */
  bibliotecaVacia: boolean
  children: ReactNode
}

/**
 * Marco común de la ventana (docs/ux/00 §2): barra superior (`banner`), área de contenido
 * (`main`) y enlace "Saltar al contenido". Al cambiar de vista mueve el foco al título.
 */
export function Marco({ bibliotecaVacia, children }: MarcoProps) {
  const { vista, ir } = useNavegacion()
  const main = useRef<HTMLElement>(null)
  const conBarra = !VISTAS_SIN_BARRA.includes(vista.tipo)
  const clave = claveVista(vista)
  const primera = useRef(true)

  useEffect(() => {
    // En el arranque no se roba el foco; en los cambios de vista va al primer elemento lógico.
    if (primera.current) {
      primera.current = false
      return
    }
    const nodo = main.current
    if (!nodo) return
    const destino =
      nodo.querySelector<HTMLElement>('[data-foco-inicial]') ??
      nodo.querySelector<HTMLElement>('h1') ??
      nodo
    destino.focus()
  }, [clave])

  return (
    <>
      <a
        className="saltar-al-contenido"
        href="#contenido"
        onClick={(e) => {
          e.preventDefault()
          main.current?.focus()
        }}
      >
        Saltar al contenido
      </a>
      {conBarra && (
        <header className={estilos.barra} role="banner">
          <button type="button" className={estilos.logo} onClick={() => ir({ tipo: 'biblioteca' })}>
            <Icono icono={Mic} />
            Shinobi Karaoke
          </button>
          <div className={estilos.contexto} />
          <div className={estilos.acciones}>
            <IndicadorActividad />
            <BotonIcono
              icono={Settings}
              etiqueta="Ajustes"
              onClick={() => ir({ tipo: 'ajustes' })}
            />
            {vista.tipo === 'biblioteca' && !bibliotecaVacia && (
              <Boton variante="primario" onClick={() => ir({ tipo: 'anadir' })}>
                <Icono icono={Plus} tamano={16} />
                Añadir canción
              </Boton>
            )}
          </div>
        </header>
      )}
      <main
        id="contenido"
        ref={main}
        tabIndex={-1}
        className={conBarra ? estilos.contenido : estilos.contenidoCompleto}
      >
        {children}
      </main>
    </>
  )
}
