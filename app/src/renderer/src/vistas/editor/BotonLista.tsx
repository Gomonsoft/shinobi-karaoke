import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Play } from 'lucide-react'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import { contador } from '@shared/letras/tiempos'
import { Boton } from '../../componentes/Boton'
import { Popover } from '../../componentes/Popover'
import estilosBoton from '../../componentes/componentes.module.css'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion, type Vista } from '../../navegacion/estado'
import { useReproductor } from '../../navegacion/reproductor'
import { useSesion } from '../../sesion/ProveedorSesion'
import { DialogoConfirmar } from '../biblioteca/DialogosCancion'
import { detallesDeError } from '../biblioteca/errores'
import { mensajeListaMarcada, tituloDeTarjeta } from '../biblioteca/tarjeta'
import { E } from './textos'
import { R } from './revision/textos'
import type { SeparacionEditor } from './Transporte'
import { copiarDetalles } from '../../soporte/detalles'

interface Props {
  resumen: ResumenCancionIpc
  letra: Letra
  separacion: SeparacionEditor
  vaciar(): Promise<boolean>
  alEnfocarPrimera(): void
  /**
   * `true` solo la primera vez que se pregunta en la visita (y la consume): el aviso de líneas
   * sin inicio lo comparten «Hecho» y «Marcar como …» del dock (spec 06, 8.6). Si no se pasa,
   * el botón lleva el suyo.
   */
  primeraPulsacionIncompleta?(): boolean
  /** Líneas dudosas pendientes (feature 11): en un borrador, la primera pulsación de la visita pregunta. */
  revision?: AvisoRevision
  /** Contorno de 2 s al terminar la revisión (la canción no cambia de estado sola). */
  resaltado?: boolean
}

export interface AvisoRevision {
  pendientes: number
  /** `true` solo la primera vez en la visita (y la consume). */
  primeraPulsacion(): boolean
  revisarAhora(): void
}

/** Cuerpo del popover `edi.revision.pendientes`, compartido por «Marcar como lista» y «…letra lista». */
export function PopoverPendientes({
  abierto,
  ancla,
  pendientes,
  alCerrar,
  revisarAhora,
  marcarIgualmente
}: {
  abierto: boolean
  ancla: RefObject<HTMLElement | null>
  pendientes: number
  alCerrar(): void
  revisarAhora(): void
  marcarIgualmente(): void
}) {
  // El foco va a «Revisar ahora» al abrirse (spec 06 · F11-E12).
  const primero = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (abierto) primero.current?.focus()
  }, [abierto])
  return (
    <Popover
      abierto={abierto}
      ancla={ancla}
      alCerrar={alCerrar}
      etiqueta={R.pendientes(pendientes)}
      anunciar
    >
      <p>{R.pendientes(pendientes)}</p>
      <Boton ref={primero} variante="primario" onClick={revisarAhora}>
        {R.revisarAhora}
      </Boton>
      <Boton variante="fantasma" onClick={marcarIgualmente}>
        {R.marcarIgualmente}
      </Boton>
    </Popover>
  )
}

export function avisarError(mensaje: string, error: unknown) {
  mostrarToast({
    tipo: 'error',
    mensaje,
    accion: {
      etiqueta: 'Copiar detalles',
      alAccionar: () => void copiarDetalles(detallesDeError(error))
    }
  })
}

interface PropsRenglones {
  id: string
  separacion: SeparacionEditor
  total: number
  pendientes: number
  cerrar(): void
  alEnfocarPrimera(): void
  /** Renglones adicionales (p. ej. el fin no válido de «Letra lista»). */
  extra?: ReactNode
}

/** Renglones del popover «Para marcarla como lista falta:» (también el de «Letra lista»). */
export function RenglonesFaltas({
  id,
  separacion,
  total,
  pendientes,
  cerrar,
  alEnfocarPrimera,
  extra
}: PropsRenglones) {
  const { ir } = useNavegacion()
  return (
    <ul>
      {!separacion.disponible && (
        <li>
          {separacion.enCola ? (
            E.faltaCola
          ) : separacion.porcentaje !== null ? (
            E.faltaSeparando(separacion.porcentaje, separacion.minutos)
          ) : (
            <>
              {E.faltaSeparar}
              <Boton
                variante="fantasma"
                onClick={() => {
                  cerrar()
                  ir({ tipo: 'cancion', id, paso: 'progreso' })
                }}
              >
                {E.irSeparacion}
              </Boton>
            </>
          )}
        </li>
      )}
      {total === 0 && (
        <li>
          {E.sinLetra}
          <Boton
            variante="fantasma"
            onClick={() => {
              cerrar()
              ir({ tipo: 'cancion', id, paso: 'letra' })
            }}
          >
            {E.buscarLetra}
          </Boton>
        </li>
      )}
      {pendientes > 0 && (
        <li>
          {E.faltaLineas(pendientes)}
          <Boton variante="fantasma" onClick={alEnfocarPrimera}>
            {E.irPrimera(pendientes)}
          </Boton>
        </li>
      )}
      {extra}
    </ul>
  )
}

/** Acción principal del editor. Las líneas sin inicio se consultan en la edición local. */
export function BotonLista({
  resumen,
  letra,
  separacion,
  vaciar,
  alEnfocarPrimera,
  primeraPulsacionIncompleta,
  revision,
  resaltado
}: Props) {
  const { ir } = useNavegacion()
  const { abrir } = useReproductor()
  const { haySesion } = useSesion()
  const ancla = useRef<HTMLButtonElement>(null)
  const [popover, setPopover] = useState<'faltas' | 'incompleta' | 'revision' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const marcoLista = useRef(false)
  const incompletaVista = useRef(false)
  const primeraPulsacion =
    primeraPulsacionIncompleta ??
    (() => {
      const antes = incompletaVista.current
      incompletaVista.current = true
      return !antes
    })
  const { sincronizadas, total } = contador(letra)
  const pendientes = total - sincronizadas
  const lista = resumen.estado === 'lista'
  const falta = !lista && (!separacion.disponible || total === 0 || pendientes > 0)
  const mostrarFaltas = falta && popover === 'faltas'
  const mostrarIncompleta = lista && pendientes > 0 && popover === 'incompleta'
  const id = resumen.id

  function salir() {
    setPopover(null)
    ir({ tipo: 'biblioteca', enfocar: { id, resaltar: false } })
  }

  function enfocarPrimera() {
    setPopover(null)
    alEnfocarPrimera()
  }

  async function marcarLista() {
    marcoLista.current = true
    setOcupado(true)
    try {
      // Si el vaciado falla, el controlador de guardado ya ofrece Copiar detalles.
      if (!(await vaciar())) return
      const guardada = await window.shinobi.biblioteca.marcarLista(id)
      ir({ tipo: 'biblioteca', enfocar: { id, resaltar: true } })
      mostrarToast({
        tipo: 'exito',
        mensaje: mensajeListaMarcada(guardada),
        // Con sesión no hay reproductor local: el toast no ofrece [▶ Reproducir] (spec 02).
        accion: haySesion
          ? undefined
          : { etiqueta: 'Reproducir', icono: Play, alAccionar: () => abrir(id) }
      })
    } catch (error) {
      avisarError('No se pudo marcar la canción como lista.', error)
    } finally {
      marcoLista.current = false
      setOcupado(false)
    }
  }

  function pulsar() {
    if (marcoLista.current) return
    if (lista) {
      if (pendientes > 0 && primeraPulsacion()) {
        setPopover('incompleta')
      } else salir()
    } else if (falta) {
      setPopover('faltas')
    } else if (revision && revision.pendientes > 0 && revision.primeraPulsacion()) {
      setPopover('revision')
    } else {
      setPopover(null)
      void marcarLista()
    }
  }

  return (
    <>
      <button
        type="button"
        ref={ancla}
        className={`${estilosBoton.boton} ${estilosBoton.primario}`}
        aria-disabled={falta || ocupado || undefined}
        aria-busy={ocupado || undefined}
        data-resaltado-revision={resaltado || undefined}
        aria-haspopup={falta || (lista && pendientes > 0) ? 'dialog' : undefined}
        aria-expanded={
          falta || (lista && pendientes > 0) ? mostrarFaltas || mostrarIncompleta : undefined
        }
        onFocus={(e) => {
          if (falta && e.currentTarget.matches(':focus-visible')) setPopover('faltas')
        }}
        onClick={pulsar}
      >
        {lista ? E.hecho : E.marcarLista}
      </button>
      <Popover
        abierto={mostrarFaltas}
        ancla={ancla}
        alCerrar={() => setPopover(null)}
        titulo={E.faltaTitulo}
        etiqueta={E.faltaTitulo}
        anunciar
      >
        <RenglonesFaltas
          id={id}
          separacion={separacion}
          total={total}
          pendientes={pendientes}
          cerrar={() => setPopover(null)}
          alEnfocarPrimera={enfocarPrimera}
        />
      </Popover>
      <PopoverPendientes
        abierto={popover === 'revision'}
        ancla={ancla}
        pendientes={revision?.pendientes ?? 0}
        alCerrar={() => setPopover(null)}
        revisarAhora={() => {
          setPopover(null)
          revision?.revisarAhora()
        }}
        marcarIgualmente={() => {
          setPopover(null)
          void marcarLista()
        }}
      />
      <Popover
        abierto={mostrarIncompleta}
        ancla={ancla}
        alCerrar={() => setPopover(null)}
        etiqueta={E.hechoIncompleta(pendientes)}
        anunciar
      >
        <p>{E.hechoIncompleta(pendientes)}</p>
        <Boton variante="primario" onClick={enfocarPrimera}>
          {E.sincronizarAhora}
        </Boton>
        <Boton variante="fantasma" onClick={salir}>
          {E.salirIgualmente}
        </Boton>
      </Popover>
    </>
  )
}

export function DialogoVolverABorradorEditor({
  resumen,
  alCerrar,
  alVolver
}: {
  resumen: ResumenCancionIpc
  alCerrar(): void
  /** La canción volvió a borrador (el botón que lo abrió desaparece: el foco va a otro sitio). */
  alVolver?(): void
}) {
  return (
    <DialogoConfirmar
      titulo="¿Volver a borrador?"
      cuerpo={`«${tituloDeTarjeta(resumen)}» dejará de poder reproducirse hasta que la marques como lista otra vez. No se pierde nada.`}
      etiquetaConfirmar="Volver a borrador"
      alCancelar={alCerrar}
      alConfirmar={async () => {
        try {
          await window.shinobi.biblioteca.volverABorrador(resumen.id)
          alVolver?.()
        } catch (error) {
          avisarError('No se pudo volver a borrador.', error)
        } finally {
          alCerrar()
        }
      }}
    />
  )
}

/** Se llama desde la guarda cuando el vaciado concluye antes de volver a la Biblioteca. */
export function avisarBorradorAlSalir(
  destino: Vista,
  estado: ResumenCancionIpc['estado'],
  cambiosEnVisita: boolean
): void {
  if (
    destino.tipo === 'biblioteca' &&
    !destino.enfocar &&
    estado === 'borrador' &&
    cambiosEnVisita
  ) {
    mostrarToast({ tipo: 'exito', mensaje: E.borradorGuardado })
  }
}
