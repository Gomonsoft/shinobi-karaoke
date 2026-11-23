import { useRef, useState } from 'react'
import { Play } from 'lucide-react'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { Cancion } from '@shared/cancion'
import type { Letra } from '@shared/letra'
import { motivosParaNoEstarLetraLista } from '@shared/derivados'
import { contador } from '@shared/letras/tiempos'
import { Boton } from '../../componentes/Boton'
import { Popover } from '../../componentes/Popover'
import estilosBoton from '../../componentes/componentes.module.css'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { useReproductor } from '../../navegacion/reproductor'
import { useSesion } from '../../sesion/ProveedorSesion'
import { mensajeListaMarcada } from '../biblioteca/tarjeta'
import { avisarError, PopoverPendientes, RenglonesFaltas, type AvisoRevision } from './BotonLista'
import { DialogoLetraLista, guardarOmitirAviso } from './DialogoLetraLista'
import { E } from './textos'
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
  /** Líneas dudosas pendientes (feature 11): la primera pulsación de la visita pregunta. */
  revision?: AvisoRevision
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
  alEnfocarPrimera,
  revision
}: Props) {
  const { ir } = useNavegacion()
  const { abrir } = useReproductor()
  const { haySesion } = useSesion()
  const ancla = useRef<HTMLButtonElement>(null)
  const [popover, setPopover] = useState(false)
  const [avisoRevision, setAvisoRevision] = useState(false)
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
    else if (revision && revision.pendientes > 0 && revision.primeraPulsacion())
      setAvisoRevision(true)
    else continuar()
  }

  function continuar() {
    if (omitirAviso) void marcar(false)
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
      <PopoverPendientes
        abierto={avisoRevision}
        ancla={ancla}
        pendientes={revision?.pendientes ?? 0}
        alCerrar={() => setAvisoRevision(false)}
        revisarAhora={() => {
          setAvisoRevision(false)
          revision?.revisarAhora()
        }}
        marcarIgualmente={() => {
          setAvisoRevision(false)
          continuar()
        }}
      />
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

interface PropsCambio {
  /** Modalidad a la que cambia: `letra_lista` desde Lista, `karaoke` («Marcar como lista») desde Letra lista. */
  destino: 'letra_lista' | 'karaoke'
  resumen: ResumenCancionIpc
  letra: Letra
  omitirAviso: boolean
  alOmitirAviso(): void
  vaciar(): Promise<boolean>
  alEnfocarPrimera(): void
  /** Compartida con «Hecho»: `true` solo la primera vez en la visita (el aviso de líneas sin inicio). */
  primeraPulsacionIncompleta(): boolean
}

/**
 * «Marcar como letra lista» (en Lista) y «Marcar como lista» (en Letra lista) del dock (spec 06, 8.6):
 * cambian la modalidad y vuelven a la Biblioteca con la tarjeta enfocada y resaltada. No exigen que
 * todas las líneas tengan inicio: con líneas sin inicio comparten con «Hecho» el aviso de la primera pulsación.
 */
export function BotonCambiarModalidad({
  destino,
  resumen,
  letra,
  omitirAviso,
  alOmitirAviso,
  vaciar,
  alEnfocarPrimera,
  primeraPulsacionIncompleta
}: PropsCambio) {
  const { ir } = useNavegacion()
  const { abrir } = useReproductor()
  const { haySesion } = useSesion()
  const ancla = useRef<HTMLButtonElement>(null)
  const [popover, setPopover] = useState(false)
  const [dialogo, setDialogo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const cambiando = useRef(false)
  const { sincronizadas, total } = contador(letra)
  const pendientes = total - sincronizadas
  const id = resumen.id
  const aLetraLista = destino === 'letra_lista'

  async function cambiar(omitir: boolean) {
    if (cambiando.current) return
    cambiando.current = true
    setOcupado(true)
    try {
      if (omitir) {
        await guardarOmitirAviso()
        alOmitirAviso()
      }
      if (!(await vaciar())) return
      const guardada = await window.shinobi.biblioteca.marcarLista(id, { modalidad: destino })
      setDialogo(false)
      setPopover(false)
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
      avisarError(LL.errorCambiar, error)
    } finally {
      cambiando.current = false
      setOcupado(false)
    }
  }

  function aplicar() {
    setPopover(false)
    if (aLetraLista && !omitirAviso) setDialogo(true)
    else void cambiar(false)
  }

  function pulsar() {
    if (cambiando.current) return
    if (pendientes > 0 && primeraPulsacionIncompleta()) {
      setPopover(true)
    } else aplicar()
  }

  return (
    <>
      <button
        type="button"
        ref={ancla}
        className={`${estilosBoton.boton} ${estilosBoton.secundario}`}
        aria-disabled={ocupado || undefined}
        aria-busy={ocupado || undefined}
        aria-haspopup={pendientes > 0 ? 'dialog' : undefined}
        aria-expanded={pendientes > 0 ? popover : undefined}
        onClick={pulsar}
      >
        {aLetraLista ? LL.boton : E.marcarLista}
      </button>
      <Popover
        abierto={popover && pendientes > 0}
        ancla={ancla}
        alCerrar={() => setPopover(false)}
        etiqueta={E.hechoIncompleta(pendientes)}
        anunciar
      >
        <p>{E.hechoIncompleta(pendientes)}</p>
        <Boton
          variante="primario"
          onClick={() => {
            setPopover(false)
            alEnfocarPrimera()
          }}
        >
          {E.sincronizarAhora}
        </Boton>
        <Boton variante="fantasma" onClick={aplicar}>
          {E.salirIgualmente}
        </Boton>
      </Popover>
      {dialogo && (
        <DialogoLetraLista
          variante="marcar"
          alCancelar={() => setDialogo(false)}
          alConfirmar={cambiar}
        />
      )}
    </>
  )
}
