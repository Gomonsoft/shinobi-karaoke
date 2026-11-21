import { useEffect, useRef, useState } from 'react'
import type { OperacionTema, ResultadoOperacionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../componentes/AvisoEnLinea'
import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import { textoFilaQuitar, textoQuitarGrupo } from './impactoGrupo'
import { ListaCancionesImpacto } from './piezas'
import { SelectorTema } from './SelectorTema'
import { BIB_GRUPO, TEMA } from './textos'
import { useOperacionTema } from './useOperacionTema'
import type { TemaCatalogo } from './useCatalogoTemas'
import estilos from './temas.module.css'

interface Props {
  abierto: boolean
  nivel: 'artista' | 'album'
  /** Nombres visibles del grupo. */
  artista: string
  album?: string
  /** Tema asignado hoy al grupo (`null` = sin tema propio). */
  temaActualId: string | null
  /** Temas ofrecibles, ordenados. */
  temas: TemaCatalogo[]
  predeterminadoId?: string | null
  onCancelar(): void
  onAplicado(resultado: ResultadoOperacionIpc, tema: { id: string; nombre: string } | null): void
  onError?(err: unknown): void
}

export function DialogoTemaGrupo(props: Props) {
  if (!props.abierto) return null
  return <Interno {...props} />
}

function Interno({
  nivel,
  artista,
  album,
  temaActualId,
  temas,
  predeterminadoId = null,
  onCancelar,
  onAplicado,
  onError
}: Props) {
  const o = useOperacionTema()
  const [seleccion, setSeleccion] = useState<string | null>(temaActualId)
  const confirmar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const op: OperacionTema = {
      tipo: 'asignarGrupo',
      nivel,
      artista,
      ...(nivel === 'album' && album !== undefined ? { album } : {}),
      temaId: seleccion
    }
    void o.previsualizar(op)
    // Una previsualización por cambio de opción; el hook descarta las respuestas antiguas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion])

  useEffect(() => {
    if (o.obsoleto) confirmar.current?.focus()
  }, [o.obsoleto, o.impacto])

  const codigo = o.error?.codigo
  const noExiste = codigo === 'TEMA_NO_ENCONTRADO'
  useEffect(() => {
    if (o.fase === 'error' && o.error && !noExiste) onError?.(o.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.fase, o.error])

  const ocupado = o.fase === 'ejecutando'
  const i = o.impacto
  const n = i?.afectadas.length ?? 0
  const quitando = seleccion === null

  async function aplicar(): Promise<void> {
    if (o.fase !== 'confirmando') return
    const r = await o.ejecutar()
    if (!r) return
    const tema = temas.find((t) => t.id === seleccion)
    onAplicado(r, tema ? { id: tema.id, nombre: tema.nombre } : null)
  }

  const ctx = { nivel, artista, ...(album !== undefined ? { album } : {}) }
  const quitar = i && quitando && n > 0 ? textoQuitarGrupo(i.afectadas, ctx) : null
  const excluidas = i
    ? i.excluidas.propio + i.excluidas.cancion + (nivel === 'artista' ? i.excluidas.album : 0)
    : 0

  return (
    <Dialogo
      abierto
      titulo={
        nivel === 'album'
          ? BIB_GRUPO.tituloAlbum(album ?? '', artista)
          : BIB_GRUPO.tituloArtista(artista)
      }
      ancho="35rem"
      enfoqueInicial="[data-foco-inicial]"
      onCancelar={() => {
        if (!ocupado) onCancelar()
      }}
      acciones={
        <>
          {!ocupado && <Boton onClick={onCancelar}>{TEMA.cancelar}</Boton>}
          <Boton
            ref={confirmar}
            variante="primario"
            cargando={ocupado}
            textoCargando={BIB_GRUPO.aplicar}
            onClick={() => void aplicar()}
          >
            {BIB_GRUPO.aplicar}
          </Boton>
        </>
      }
    >
      <div className={estilos.ancho}>
        <SelectorTema
          temas={temas}
          valor={seleccion}
          predeterminadoId={predeterminadoId}
          etiqueta={BIB_GRUPO.selector}
          opcionInicial={{
            texto: nivel === 'album' ? BIB_GRUPO.sinTemaAlbum : BIB_GRUPO.sinTemaArtista
          }}
          alElegir={(id) => {
            if (!ocupado) setSeleccion(id)
          }}
          deshabilitado={ocupado}
          focoInicial
        />
        {o.fase === 'error' && noExiste && (
          <AvisoEnLinea tipo="error">{TEMA.errorNoExiste}</AvisoEnLinea>
        )}
        {o.obsoleto && <AvisoEnLinea tipo="error">{TEMA.obsoleto}</AvisoEnLinea>}
        {i && (
          <>
            {n === 0 ? (
              <p className={estilos.texto}>{BIB_GRUPO.ninguna}</p>
            ) : quitar ? (
              <>
                <p className={estilos.texto}>{quitar.principal}</p>
                {quitar.noDisponible && (
                  <p className={`${estilos.texto} ${estilos.aviso}`}>⚠ {quitar.noDisponible}</p>
                )}
              </>
            ) : (
              <p className={estilos.texto}>{BIB_GRUPO.impacto(n, i.totalGrupo ?? n)}</p>
            )}
            {excluidas > 0 && (
              <p className={estilos.nota}>{BIB_GRUPO.excluidas(excluidas, nivel)}</p>
            )}
            <ListaCancionesImpacto
              canciones={i.afectadas}
              fila={
                quitando
                  ? (a) => {
                      const f = textoFilaQuitar(a)
                      return f.aviso ? (
                        <>
                          <span aria-hidden="true" className={estilos.aviso}>
                            ⚠
                          </span>{' '}
                          {f.texto}
                        </>
                      ) : (
                        f.texto
                      )
                    }
                  : undefined
              }
            />
            {!quitando && <p className={estilos.nota}>{BIB_GRUPO.futuras(nivel)}</p>}
          </>
        )}
      </div>
    </Dialogo>
  )
}
