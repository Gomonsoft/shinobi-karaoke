import { useEffect, useRef, useState } from 'react'
import { Boton } from '../../componentes/Boton'
import { mostrarToast } from '../../componentes/gestorToasts'
import { DialogoTemaGrupo } from '../../temas/DialogoTemaGrupo'
import { BIB_GRUPO, TEMA } from '../../temas/textos'
import type { CatalogoTemas } from '../../temas/useCatalogoTemas'
import { temaAsignadoAGrupo, type Grupo } from './agrupacion'
import { detallesDeError } from './errores'
import { GRUPO } from './textosTema'
import { TEMAS_NO_DISPONIBLES } from './textosSeleccion'
import estilos from './biblioteca.module.css'

interface Props {
  /** Solo grupos `asignable` (artista y álbum). */
  grupo: Grupo
  catalogo: CatalogoTemas
}

/** Hueco `tema` del encabezado de grupo (0174): tema del grupo y botón [Tema…]. */
export function TemaGrupo({ grupo, catalogo }: Props) {
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  const estabaAbierto = useRef(false)
  // Al cerrar el diálogo el foco vuelve a [Tema…], aunque el clic no lo hubiera enfocado (Safari).
  useEffect(() => {
    if (estabaAbierto.current && !abierto) boton.current?.focus()
    estabaAbierto.current = abierto
  }, [abierto])
  const nivel = grupo.tipo === 'album' ? 'album' : 'artista'
  const c = catalogo.catalogo
  const temaId = c ? temaAsignadoAGrupo(grupo, c.asignaciones) : null
  const tema = temaId ? c?.temas.find((t) => t.id === temaId) : undefined
  const borrando = tema?.enBorrado === true
  const artista = grupo.artista ?? ''
  const nombreVisible = nivel === 'album' ? (grupo.album ?? '') : artista

  const motivo = !c
    ? undefined
    : c.soloLectura
      ? TEMAS_NO_DISPONIBLES.soloLectura
      : catalogo.ofrecibles.length === 0
        ? TEMAS_NO_DISPONIBLES.vacio
        : undefined

  return (
    <>
      {tema ? (
        borrando ? (
          <span className={estilos.temaBorrando} data-tema-grupo>
            <span aria-hidden="true">⚠</span> {GRUPO.temaBorrando(tema.nombre)}
          </span>
        ) : (
          <span data-tema-grupo>{GRUPO.tema(nivel, tema.nombre)}</span>
        )
      ) : (
        <span data-tema-grupo>{GRUPO.sinTemaPropio(nivel)}</span>
      )}
      <Boton
        ref={boton}
        disabled={!c}
        noDisponible={motivo}
        aria-label={GRUPO.nombreBoton(nivel, nombreVisible)}
        onClick={() => setAbierto(true)}
      >
        {GRUPO.boton}
      </Boton>
      <DialogoTemaGrupo
        abierto={abierto}
        nivel={nivel}
        artista={artista}
        album={nivel === 'album' ? (grupo.album ?? '') : undefined}
        temaActualId={tema && !borrando ? tema.id : null}
        temas={catalogo.ofrecibles}
        predeterminadoId={c?.predeterminado ?? null}
        onCancelar={() => setAbierto(false)}
        onAplicado={(_resultado, elegido) => {
          setAbierto(false)
          mostrarToast({
            tipo: 'exito',
            mensaje: BIB_GRUPO.toast(nivel, nombreVisible, elegido?.nombre ?? null)
          })
        }}
        onError={(err) => {
          setAbierto(false)
          mostrarToast({
            tipo: 'error',
            mensaje: TEMA.toastError,
            accion: {
              etiqueta: TEMA.copiarDetalles,
              alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(err))
            }
          })
        }}
      />
    </>
  )
}
