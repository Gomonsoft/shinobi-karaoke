import { useRef, useState } from 'react'
import { Play } from 'lucide-react'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { Cancion } from '@shared/cancion'
import type { Letra } from '@shared/letra'
import { motivosParaNoEstarLetraLista } from '@shared/derivados'
import { contador } from '@shared/letras/tiempos'
import { Popover } from '../../componentes/Popover'
import estilosBoton from '../../componentes/componentes.module.css'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { useReproductor } from '../../navegacion/reproductor'
import { useSesion } from '../../sesion/ProveedorSesion'
import { mensajeListaMarcada } from '../biblioteca/tarjeta'
import { avisarError, RenglonesFaltas } from './BotonLista'
import { DialogoLetraLista, guardarOmitirAviso } from './DialogoLetraLista'
import { LL } from './textosLetraLista'
import type { SeparacionEditor } from './Transporte'

interface Props {
  resumen: ResumenCancionIpc
  /** La canción cargada; la letra en edición se pasa aparte. */
  cancion: Cancion
  letra: Letra
  separacion: SeparacionEditor
  omitirAviso: boolean
  alOmitirAviso(): void
  vaciar(): Promise<boolean>
  alEnfocarPrimera(): void
}

/** «Marcar como letra lista» (spec 06, LL): mismos requisitos que «Marcar como lista». */
export function BotonLetraLista({
  resumen,
  cancion,
  letra,
  separacion,
  omitirAviso,
  alOmitirAviso,
  vaciar,
  alEnfocarPrimera
}: Props) {
  const { ir } = useNavegacion()
  const { abrir } = useReproductor()
  const { haySesion } = useSesion()
  const ancla = useRef<HTMLButtonElement>(null)
  const [popover, setPopover] = useState(false)
  const [dialogo, setDialogo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const marcando = useRef(false)
  const { sincronizadas, total } = contador(letra)
  const pendientes = total - sincronizadas
  const finInvalido = motivosParaNoEstarLetraLista({ ...cancion, letra }).filter(
    (m) => m.codigo === 'FIN_NO_VALIDO'
  )
  const falta = !separacion.disponible || total === 0 || pendientes > 0 || finInvalido.length > 0
  const id = resumen.id

  async function marcar(omitir: boolean) {
    if (marcando.current) return
    marcando.current = true
    setOcupado(true)
    try {
      if (omitir) {
        await guardarOmitirAviso()
        alOmitirAviso()
      }
      if (!(await vaciar())) return
      const guardada = await window.shinobi.biblioteca.marcarLista(id, { modalidad: 'letra_lista' })
      setDialogo(false)
      ir({ tipo: 'biblioteca', enfocar: { id, resaltar: true } })
      mostrarToast({
        tipo: 'exito',
        mensaje: mensajeListaMarcada(guardada),
        accion: haySesion
          ? undefined
          : { etiqueta: 'Reproducir', icono: Play, alAccionar: () => abrir(id) }
      })
    } catch (error) {
      setDialogo(false)
      avisarError(LL.errorMarcar, error)
    } finally {
      marcando.current = false
      setOcupado(false)
    }
  }

  function pulsar() {
    if (marcando.current) return
    if (falta) setPopover(true)
    else if (omitirAviso) void marcar(false)
    else setDialogo(true)
  }

  return (
    <>
      <button
        type="button"
        ref={ancla}
        className={`${estilosBoton.boton} ${estilosBoton.secundario}`}
        aria-disabled={falta || ocupado || undefined}
        aria-busy={ocupado || undefined}
        aria-haspopup={falta ? 'dialog' : undefined}
        aria-expanded={falta ? popover : undefined}
        onFocus={(e) => {
          if (falta && e.currentTarget.matches(':focus-visible')) setPopover(true)
        }}
        onClick={pulsar}
      >
        {LL.boton}
      </button>
      <Popover
        abierto={falta && popover}
        ancla={ancla}
        alCerrar={() => setPopover(false)}
        titulo={LL.faltaTitulo}
        etiqueta={LL.faltaTitulo}
        anunciar
      >
        <RenglonesFaltas
          id={id}
          separacion={separacion}
          total={total}
          pendientes={pendientes}
          cerrar={() => setPopover(false)}
          alEnfocarPrimera={() => {
            setPopover(false)
            alEnfocarPrimera()
          }}
          extra={finInvalido.map((m) => (
            <li key={m.codigo}>{m.mensaje}</li>
          ))}
        />
      </Popover>
      {dialogo && (
        <DialogoLetraLista
          variante="marcar"
          alCancelar={() => setDialogo(false)}
          alConfirmar={marcar}
        />
      )}
    </>
  )
}
