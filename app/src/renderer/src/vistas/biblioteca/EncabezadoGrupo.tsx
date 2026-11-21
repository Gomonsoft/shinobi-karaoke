import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Icono } from '../../componentes/Icono'
import { textoRecuentoGrupo, type Grupo } from './agrupacion'
import estilos from './biblioteca.module.css'

interface Props {
  grupo: Grupo
  plegado: boolean
  /** Con búsqueda o filtro activos el recuento es «{v} de {n} canciones». */
  filtrando: boolean
  /** Id de la región con las tarjetas (`aria-controls`). */
  idRegion: string
  alAlternar(): void
  /**
   * Hueco `casilla` (0173): casilla tri-estado del modo selección. Va antes del botón de plegar y es
   * una parada de tabulación propia.
   */
  casilla?: ReactNode
  /**
   * Hueco `tema` (0174): tema del grupo y botón [Tema…]. Solo se pinta en grupos asignables (artista
   * y álbum); en los demás se muestra el texto `bib.grupo.sinTema.*`.
   */
  tema?: ReactNode
}

/** `bib.grupo.sinTema.*`: agrupaciones visuales que no admiten tema. */
function textoSinTema(tipo: Grupo['tipo']): string | null {
  if (tipo === 'sinArtista') return 'Añade el artista con «Editar datos» para darles un tema.'
  if (tipo === 'sinAlbum') return 'Añade el álbum con «Editar datos» para darles un tema.'
  if (tipo === 'albumSinArtista') return 'Añade el artista para darle un tema.'
  return null
}

/** Encabezado de un grupo: `h2` con botón plegable, y los huecos `casilla` y `tema`. */
export function EncabezadoGrupo({
  grupo,
  plegado,
  filtrando,
  idRegion,
  alAlternar,
  casilla,
  tema
}: Props) {
  const recuento = textoRecuentoGrupo(grupo.canciones.length, grupo.total, filtrando)
  const sinTema = textoSinTema(grupo.tipo)
  return (
    <div className={estilos.encabezadoGrupo} data-encabezado-grupo={grupo.id}>
      {casilla}
      <h2 className={`t-subtitulo ${estilos.tituloGrupo}`}>
        <button
          type="button"
          className={estilos.botonGrupo}
          aria-expanded={!plegado}
          aria-controls={idRegion}
          aria-label={`${plegado ? 'Desplegar' : 'Plegar'} ${grupo.nombre}`}
          onClick={alAlternar}
        >
          <Icono icono={plegado ? ChevronRight : ChevronDown} tamano={16} />
          <span className={estilos.nombreGrupo}>{grupo.nombre}</span>
          <span className={`t-pequeno ${estilos.recuentoGrupo}`}>· {recuento}</span>
        </button>
      </h2>
      <div className={`t-pequeno ${estilos.temaGrupo}`}>
        {sinTema ? <span>{sinTema}</span> : tema}
      </div>
    </div>
  )
}
