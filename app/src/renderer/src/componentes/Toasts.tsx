import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { Boton } from './Boton'
import { BotonIcono } from './BotonIcono'
import { Icono } from './Icono'
import { cerrarToast, DURACION_TOAST_MS, useToasts, type Toast } from './gestorToasts'
import estilos from './componentes.module.css'

const ICONOS = { info: Info, aviso: TriangleAlert, error: CircleAlert, exito: CircleCheck }

function ToastItem({ toast }: { toast: Toast }) {
  const [pausado, setPausado] = useState(false)
  const conAccion = Boolean(toast.accion)

  // No caduca si tiene acción ni mientras el ratón o el foco están encima.
  useEffect(() => {
    if (conAccion || pausado) return
    const t = setTimeout(() => cerrarToast(toast.id), DURACION_TOAST_MS)
    return () => clearTimeout(t)
  }, [conAccion, pausado, toast.id])

  return (
    <div
      className={`${estilos.toast} ${estilos[toast.tipo]}`}
      data-testid="toast"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <Icono icono={ICONOS[toast.tipo]} />
      <div className={estilos.toastTexto}>
        <span style={{ color: 'var(--texto-1)' }}>{toast.mensaje}</span>
        {toast.accion && (
          <Boton
            variante="fantasma"
            onClick={() => {
              toast.accion!.alAccionar()
              cerrarToast(toast.id)
            }}
          >
            {toast.accion.etiqueta}
          </Boton>
        )}
      </div>
      <BotonIcono icono={X} etiqueta="Cerrar notificación" onClick={() => cerrarToast(toast.id)} />
    </div>
  )
}

/** Se monta una sola vez en la raíz de la app; la región en vivo existe aunque esté vacía. */
export function ContenedorToasts() {
  const toasts = useToasts()
  return (
    <div className={estilos.toasts} aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
