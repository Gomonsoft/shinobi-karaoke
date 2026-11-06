import { useRef, useState } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import { contador } from '@shared/letras/tiempos'
import { Boton } from '../../componentes/Boton'
import { Popover } from '../../componentes/Popover'
import estilosBoton from '../../componentes/componentes.module.css'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion, type Vista } from '../../navegacion/estado'
import { DialogoConfirmar } from '../biblioteca/DialogosCancion'
import { detallesDeError } from '../biblioteca/errores'
import { tituloDeTarjeta } from '../biblioteca/tarjeta'
import { E } from './textos'
import type { SeparacionEditor } from './Transporte'

interface Props {
  resumen: ResumenCancionIpc
  letra: Letra
  separacion: SeparacionEditor
  vaciar(): Promise<boolean>
  alEnfocarPrimera(): void
}

function avisarError(mensaje: string, error: unknown) {
  mostrarToast({
    tipo: 'error',
    mensaje,
    accion: {
      etiqueta: 'Copiar detalles',
      alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(error))
    }
  })
}

/** Acción principal del editor. Las líneas sin inicio se consultan en la edición local. */
export function BotonLista({ resumen, letra, separacion, vaciar, alEnfocarPrimera }: Props) {
  const { ir } = useNavegacion()
  const ancla = useRef<HTMLButtonElement>(null)
  const [popover, setPopover] = useState<'faltas' | 'incompleta' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const marcoLista = useRef(false)
  const avisoIncompletaVisto = useRef(false)
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
        mensaje: `«${tituloDeTarjeta(guardada)}» está lista para cantar.`
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
      if (pendientes > 0 && !avisoIncompletaVisto.current) {
        avisoIncompletaVisto.current = true
        setPopover('incompleta')
      } else salir()
    } else if (falta) {
      setPopover('faltas')
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
                      setPopover(null)
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
                  setPopover(null)
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
              <Boton variante="fantasma" onClick={enfocarPrimera}>
                {E.irPrimera(pendientes)}
              </Boton>
            </li>
          )}
        </ul>
      </Popover>
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
  alCerrar
}: {
  resumen: ResumenCancionIpc
  alCerrar(): void
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
