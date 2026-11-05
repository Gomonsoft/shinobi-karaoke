import type { KeyboardEvent, Ref } from 'react'
import { CampoTexto } from '../../componentes/Campos'
import { MAX_METADATO } from '../biblioteca/DialogosCancion'
import { TEXTO } from './textos'

export interface ValoresDatos {
  titulo: string
  artista: string
  album: string
}

interface CamposDatosProps {
  valores: ValoresDatos
  onCambio: (valores: ValoresDatos) => void
  errorTitulo?: string
  refTitulo?: Ref<HTMLInputElement>
  /** Al salir de un campo (autoguardado del resumen). */
  onSalir?: () => void
  /** Intro en el último campo (Álbum). En los demás, Intro pasa al campo siguiente. */
  onIntroUltimo?: () => void
}

/** Pasa el foco al siguiente campo con Intro (la spec solo envía con Intro en el último). */
function introSiguiente(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
  e.preventDefault()
  const campos = Array.from(
    e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[type="text"]') ?? []
  )
  campos[campos.indexOf(e.currentTarget) + 1]?.focus()
}

/** Título (obligatorio), artista y álbum: común a "Revisar datos" y al resumen del paso 1. */
export function CamposDatos({
  valores,
  onCambio,
  errorTitulo,
  refTitulo,
  onSalir,
  onIntroUltimo
}: CamposDatosProps) {
  return (
    <>
      <CampoTexto
        ref={refTitulo}
        type="text"
        etiqueta={`${TEXTO.campoTitulo} *`}
        value={valores.titulo}
        maxLength={MAX_METADATO}
        error={errorTitulo}
        aria-required="true"
        onChange={(e) => onCambio({ ...valores, titulo: e.target.value })}
        onBlur={onSalir}
        onKeyDown={introSiguiente}
      />
      <CampoTexto
        type="text"
        etiqueta={TEXTO.campoArtista}
        value={valores.artista}
        maxLength={MAX_METADATO}
        onChange={(e) => onCambio({ ...valores, artista: e.target.value })}
        onBlur={onSalir}
        onKeyDown={introSiguiente}
      />
      <CampoTexto
        type="text"
        etiqueta={TEXTO.campoAlbum}
        ayuda={TEXTO.campoAlbumAyuda}
        value={valores.album}
        maxLength={MAX_METADATO}
        onChange={(e) => onCambio({ ...valores, album: e.target.value })}
        onBlur={onSalir}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onIntroUltimo && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onIntroUltimo()
          }
        }}
      />
    </>
  )
}

/** Valores listos para IPC: recortados, álbum vacío -> `null`. */
export function metadatosParaIpc(v: ValoresDatos): {
  titulo: string
  artista: string
  album: string | null
} {
  const album = v.album.trim()
  return { titulo: v.titulo.trim(), artista: v.artista.trim(), album: album === '' ? null : album }
}
