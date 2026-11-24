import { useEffect, useRef, useState } from 'react'
import { CircleCheck, Clock, LoaderCircle, TriangleAlert } from 'lucide-react'
import { Boton } from '../componentes/Boton'
import { Icono } from '../componentes/Icono'
import estilosComponentes from '../componentes/componentes.module.css'
import { mostrarToast } from '../componentes/gestorToasts'
import { copiarDetalles } from '../soporte/detalles'
import { esperarSalvamento, useEstadoSalvamento } from '../soporte/salvamento'
import { ERR } from './textosError'
import estilos from './pantallaError.module.css'

/** Lo que se ve y se copia del fallo: ni letras ni títulos de canciones (sí el id). */
export interface DetallesError {
  hora: string
  /** `cancion/editor`, `biblioteca`… */
  vista: string
  cancionId?: string
  mensaje: string
  pila: string
  componentes: string
}

export type VarianteError = 'vista' | 'global' | 'reproductor' | 'publico'

interface Props {
  variante: VarianteError
  detalles: DetallesError
  /** La vista que falló es el editor: muestra el estado del guardado y la pérdida del historial. */
  esEditor?: boolean
  /** Falló de nuevo en menos de 10 s: el primario pasa a «Ir a la Biblioteca». */
  repetido?: boolean
  /** V: vuelve a montar la vista. G: recarga la ventana. */
  alRecargar?: () => void
  /** V: ausente si la vista que falló es la propia Biblioteca. */
  alBiblioteca?: () => void
  /** R: sale del reproductor. */
  alSalir?: () => void
}

/** «Detalles» abierto o cerrado se recuerda durante la sesión. */
let detallesAbiertos = false

export function textoDetalles(d: DetallesError): string {
  return [
    'Shinobi Karaoke · error de la interfaz',
    `Hora: ${d.hora}`,
    `Vista: ${d.vista}${d.cancionId ? ` (canción ${d.cancionId})` : ''}`,
    `Mensaje: ${d.mensaje}`,
    `Pila:\n${d.pila || '(sin pila)'}`,
    `Componentes:\n${d.componentes.trim() || '(sin pila de componentes)'}`
  ].join('\n')
}

function LineaGuardado() {
  const estado = useEstadoSalvamento()
  const reducido =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const guardando = estado === 'guardando'
  return (
    <>
      <div role="status">
        {estado !== 'ninguno' && (
          <p className={estilos.guardado} data-estado={estado} data-guardado-error="">
            {guardando ? (
              <Icono
                icono={reducido ? Clock : LoaderCircle}
                tamano={14}
                className={reducido ? undefined : estilosComponentes.girando}
              />
            ) : estado === 'guardado' ? (
              <Icono icono={CircleCheck} tamano={14} />
            ) : (
              <Icono icono={TriangleAlert} tamano={14} />
            )}
            {guardando
              ? ERR.editor.guardando
              : estado === 'guardado'
                ? ERR.editor.guardado
                : ERR.editor.noGuardado}
          </p>
        )}
      </div>
      <p className={estilos.historial}>{ERR.editor.historial}</p>
    </>
  )
}

/**
 * Pantalla de error de la interfaz (ux/00): variantes V (área de contenido), G (ventana), R (reproductor) y P
 * (ventana secundaria, sin detalles). No usa contextos de la app: solo componentes base.
 */
export function PantallaError({
  variante,
  detalles,
  esEditor = false,
  repetido = false,
  alRecargar,
  alBiblioteca,
  alSalir
}: Props) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const [cargando, setCargando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [abierto, setAbierto] = useState(detallesAbiertos)

  useEffect(() => {
    titulo.current?.focus()
  }, [])

  useEffect(() => {
    if (variante !== 'reproductor' || !alSalir) return
    const alTecla = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      alSalir()
    }
    window.addEventListener('keydown', alTecla)
    return () => window.removeEventListener('keydown', alTecla)
  }, [variante, alSalir])

  if (variante === 'publico') {
    return (
      <div
        className={`${estilos.raiz} ${estilos.publico}`}
        role="alert"
        data-pantalla-error="publico"
      >
        {ERR.publico}
      </div>
    )
  }

  const copiar = (): void => {
    copiarDetalles(textoDetalles(detalles)).then(
      () => {
        setCopiado(true)
        if (variante === 'vista') mostrarToast({ tipo: 'exito', mensaje: ERR.copiado })
      },
      () => undefined
    )
  }
  const recargar = async (): Promise<void> => {
    setCargando(true)
    await esperarSalvamento()
    setCargando(false)
    alRecargar?.()
  }

  const textos: { titulo: string; texto?: string } =
    variante === 'global' ? ERR.global : variante === 'reproductor' ? ERR.rep : ERR.vista
  const clase = { vista: estilos.vista, global: estilos.global, reproductor: estilos.reproductor }[
    variante
  ]

  const botonRecargar = alRecargar && (
    <Boton
      key="recargar"
      variante={variante === 'vista' && repetido && alBiblioteca ? 'secundario' : 'primario'}
      cargando={cargando}
      textoCargando={ERR.guardandoBoton}
      onClick={() => void recargar()}
    >
      {variante === 'global' ? ERR.global.recargar : ERR.vista.recargar}
    </Boton>
  )
  const botonBiblioteca = variante === 'vista' && alBiblioteca && (
    <Boton key="biblioteca" variante={repetido ? 'primario' : 'secundario'} onClick={alBiblioteca}>
      {ERR.vista.biblioteca}
    </Boton>
  )
  const botonCopiar = (
    <Boton onClick={copiar} data-copiar-detalles="">
      {ERR.copiar}
    </Boton>
  )

  return (
    <div
      className={`${estilos.raiz} ${clase}`}
      data-pantalla-error={variante}
      data-vista-error={detalles.vista}
    >
      {variante === 'global' && <span className={estilos.marcaG}>Shinobi Karaoke</span>}
      <div className={estilos.columna}>
        <div className={estilos.alerta} role="alert">
          <Icono icono={TriangleAlert} tamano={40} className={estilos.icono} />
          <h1 ref={titulo} tabIndex={-1} className={estilos.titulo}>
            {textos.titulo}
          </h1>
          {textos.texto && <p className={estilos.cuerpo}>{textos.texto}</p>}
        </div>
        {variante === 'vista' && repetido && <p className={estilos.cuerpo}>{ERR.vista.repetido}</p>}
        {variante === 'vista' && esEditor && <LineaGuardado />}
        {variante === 'reproductor' ? (
          <div className={estilos.acciones}>
            <Boton variante="primario" onClick={alSalir}>
              {ERR.rep.salir}
            </Boton>
            {botonCopiar}
          </div>
        ) : (
          <div className={estilos.acciones}>
            {repetido ? [botonBiblioteca, botonRecargar] : [botonRecargar, botonBiblioteca]}
          </div>
        )}
        {variante !== 'reproductor' && (
          <details
            className={estilos.detalles}
            open={abierto}
            onToggle={(e) => {
              detallesAbiertos = e.currentTarget.open
              setAbierto(e.currentTarget.open)
            }}
          >
            <summary>{ERR.detalles}</summary>
            <p className={estilos.mensaje} data-mensaje-error="">
              {detalles.mensaje}
            </p>
            <div className={estilos.acciones}>{botonCopiar}</div>
            {copiado && (
              <p className={estilos.aviso} role="status">
                {ERR.copiado}
              </p>
            )}
          </details>
        )}
      </div>
    </div>
  )
}
