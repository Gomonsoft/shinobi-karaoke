import { useEffect, useRef, useState } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import comunes from '../../componentes/componentes.module.css'
import { Dialogo } from '../../componentes/Dialogo'
import { SelectorTema } from '../../temas/SelectorTema'
import { TEMA, tituloYArtista } from '../../temas/textos'
import type { CatalogoTemas } from '../../temas/useCatalogoTemas'
import { useOperacionTema } from '../../temas/useOperacionTema'
import temas from '../../temas/temas.module.css'
import { tituloDeTarjeta } from './tarjeta'
import { tituloDeError } from './textosError'
import { LOTE, resumirLote } from './textosSeleccion'
import estilos from './biblioteca.module.css'

/** Cómo se cierra el diálogo (la Biblioteca decide el modo selección y el foco con esto). */
export type SalidaLote =
  { tipo: 'cancelado' } | { tipo: 'terminado'; conFallos: boolean; reintentables: string[] }

interface Props {
  /** Canciones a las que aplicar, en el orden de la Biblioteca (sin agrupar). */
  canciones: ResumenCancionIpc[]
  catalogo: CatalogoTemas
  /** Una sola canción desde el ⋯ de su tarjeta: título «Aplicar tema a «{título}»». */
  desdeTarjeta?: boolean
  alCerrar(salida: SalidaLote): void
}

function temaInicial(catalogo: CatalogoTemas): string {
  const predet = catalogo.catalogo?.predeterminado ?? null
  return catalogo.ofrecibles.find((t) => t.id === predet)?.id ?? catalogo.ofrecibles[0]?.id ?? ''
}

/** Diálogo «Aplicar tema» (docs/ux/02, B9–B11): confirmación con notas, progreso y resultado. */
export function DialogoAplicarTema({ canciones, catalogo, desdeTarjeta = false, alCerrar }: Props) {
  const o = useOperacionTema()
  const { previsualizar, reiniciar } = o
  const [ids, setIds] = useState(() => canciones.map((c) => c.id))
  const [temaId, setTemaId] = useState(() => temaInicial(catalogo))
  const [intento, setIntento] = useState(0)
  const aplicarRef = useRef<HTMLButtonElement>(null)
  const principalResultado = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (temaId === '') return
    void previsualizar({
      tipo: 'aplicar',
      cancionIds: ids,
      seleccion: { modo: 'tema', temaId }
    })
  }, [ids, temaId, previsualizar])

  // De vuelta a la confirmación tras «Revisar y reintentar»: el foco al selector.
  useEffect(() => {
    if (intento > 0)
      document.querySelector<HTMLElement>('[role="dialog"] [data-foco-inicial]')?.focus()
  }, [intento])

  useEffect(() => {
    if (o.obsoleto) aplicarRef.current?.focus()
  }, [o.obsoleto, o.impacto])

  const hecha = o.fase === 'hecha' && o.resultado !== null
  const resumen = hecha ? resumirLote(o.resultado!) : null
  useEffect(() => {
    if (hecha) principalResultado.current?.focus()
  }, [hecha])

  const nombreTema = catalogo.ofrecibles.find((t) => t.id === temaId)?.nombre ?? ''
  const porId = new Map(canciones.map((c) => [c.id, c]))
  const nombre = (id: string, titulo: string, artista: string): string => {
    const r = porId.get(id)
    return tituloYArtista(titulo || r?.titulo || '', artista || r?.artista || '')
  }

  const ocupado = o.fase === 'ejecutando'
  const impacto = o.impacto
  const afectadas = impacto?.afectadas ?? []
  const cambian = afectadas.filter((a) => a.efecto === 'cambia').length
  const personalizadas = afectadas.filter(
    (a) => a.efecto === 'cambia' && a.antes.procedencia === 'propio'
  ).length
  const codigo = o.error?.codigo
  const noExiste = codigo === 'TEMA_NO_ENCONTRADO' || codigo === 'BORRADO_PENDIENTE'
  const total = hecha ? resumen!.total : afectadas.length || ids.length

  const titulo = hecha
    ? LOTE.resultado(nombreTema, resumen!.correctas, resumen!.total)
    : desdeTarjeta
      ? LOTE.tituloUna(tituloDeTarjeta(canciones[0]!))
      : LOTE.titulo(total)

  async function aplicar(): Promise<void> {
    if (o.fase !== 'confirmando' || cambian === 0) return
    await o.ejecutar()
  }

  function revisarYReintentar(): void {
    if (!resumen) return
    setIds(resumen.reintentables)
    reiniciar()
    setIntento((n) => n + 1)
  }

  const cerrar = (): void => {
    if (resumen) {
      alCerrar({
        tipo: 'terminado',
        conFallos: resumen.conFallos,
        reintentables: resumen.reintentables
      })
    } else alCerrar({ tipo: 'cancelado' })
  }

  const explicacion = desdeTarjeta ? LOTE.explicacionUna(nombreTema) : LOTE.explicacion(nombreTema)

  return (
    <Dialogo
      abierto
      titulo={titulo}
      ancho="35rem"
      enfoqueInicial="[data-foco-inicial]"
      onCancelar={() => {
        if (!ocupado) cerrar()
      }}
      acciones={
        hecha ? (
          <>
            {resumen!.reintentables.length > 0 && (
              <Boton
                ref={resumen!.conFallos ? principalResultado : undefined}
                variante="primario"
                onClick={revisarYReintentar}
              >
                {LOTE.reintentar}
              </Boton>
            )}
            <Boton
              ref={resumen!.reintentables.length === 0 ? principalResultado : undefined}
              variante={resumen!.reintentables.length > 0 ? 'secundario' : 'primario'}
              onClick={cerrar}
            >
              {LOTE.cerrar}
            </Boton>
          </>
        ) : (
          <>
            {!ocupado && <Boton onClick={cerrar}>{LOTE.cancelar}</Boton>}
            <Boton
              ref={aplicarRef}
              variante="primario"
              cargando={ocupado}
              textoCargando={LOTE.aplicando(o.progreso?.hechas ?? 0, o.progreso?.total ?? cambian)}
              noDisponible={impacto && cambian === 0 ? LOTE.nadaQueCambiar : undefined}
              onClick={() => void aplicar()}
            >
              {LOTE.aplicar(impacto ? cambian : ids.length)}
            </Boton>
          </>
        )
      }
    >
      <div className={temas.ancho}>
        <p role="status" className={comunes.soloLector}>
          {hecha ? titulo : ''}
        </p>
        {hecha ? (
          // eslint-disable-next-line jsx-a11y/no-redundant-roles -- role explícito: Safari quita la semántica con list-style none
          <ul role="list" className={temas.cajaLista} style={{ maxHeight: '17.5rem' }}>
            {o.resultado!.canciones.map((c) => (
              <li key={c.id} className={temas.filaCancion}>
                <span
                  aria-hidden="true"
                  className={`${temas.simbolo} ${c.estado === 'error' ? temas.simboloError : c.estado === 'aplicada' ? estilos.simboloExito : ''}`}
                >
                  {c.estado === 'aplicada' ? '✓' : c.estado === 'error' ? '✕' : '–'}
                </span>
                <span className={temas.filaTexto}>
                  {nombre(c.id, c.titulo, c.artista)} — {LOTE.fila(c)}
                </span>
                {c.estado === 'error' && (
                  <Boton
                    variante="fantasma"
                    onClick={() => void navigator.clipboard?.writeText(c.codigo ?? '')}
                  >
                    {LOTE.copiarDetalles}
                  </Boton>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div className={estilos.campoTemaLote}>
              <span aria-hidden="true">{LOTE.campo}</span>
              <SelectorTema
                temas={catalogo.ofrecibles}
                valor={temaId}
                predeterminadoId={catalogo.catalogo?.predeterminado ?? null}
                etiqueta={LOTE.campo}
                deshabilitado={ocupado}
                alElegir={(id) => {
                  if (id && !ocupado) setTemaId(id)
                }}
                focoInicial
              />
            </div>
            {noExiste && <AvisoEnLinea tipo="error">{TEMA.errorNoExiste}</AvisoEnLinea>}
            {o.fase === 'error' && !noExiste && (
              <AvisoEnLinea
                tipo="error"
                accion={
                  <Boton
                    onClick={() =>
                      void previsualizar({
                        tipo: 'aplicar',
                        cancionIds: ids,
                        seleccion: { modo: 'tema', temaId }
                      })
                    }
                  >
                    {TEMA.reintentar}
                  </Boton>
                }
              >
                {tituloDeError(codigo ?? '')}
              </AvisoEnLinea>
            )}
            {o.obsoleto && <AvisoEnLinea tipo="error">{TEMA.obsoleto}</AvisoEnLinea>}
            {!noExiste && <p className={temas.texto}>{explicacion}</p>}
            {impacto && !noExiste && (
              // eslint-disable-next-line jsx-a11y/no-redundant-roles -- role explícito: Safari quita la semántica con list-style none
              <ul
                role="list"
                className={temas.cajaLista}
                style={{ maxHeight: '17.5rem' }}
                tabIndex={afectadas.length > 4 ? 0 : undefined}
                aria-label="Canciones"
              >
                {afectadas.map((a) => {
                  const nota = LOTE.nota(a, temaId)
                  return (
                    <li key={a.id} className={`${temas.filaCancion} ${estilos.filaLote}`}>
                      <span className={temas.filaTexto}>
                        <span className={estilos.tituloLote}>
                          {nombre(a.id, a.titulo, a.artista)}
                        </span>
                        <span
                          className={`${estilos.notaLote} ${nota.aviso ? temas.aviso : ''}`}
                          data-nota-lote
                        >
                          {nota.texto}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {personalizadas > 0 && (
              <p className={`${temas.texto} ${temas.aviso}`}>
                {LOTE.avisoPersonalizado(personalizadas)}
              </p>
            )}
          </>
        )}
      </div>
    </Dialogo>
  )
}
