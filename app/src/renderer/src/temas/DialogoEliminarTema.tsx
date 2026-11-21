import { useEffect, useRef, type ReactNode } from 'react'
import type { ResultadoOperacionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../componentes/AvisoEnLinea'
import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import { ListaFalloAMitad } from './ListaFalloAMitad'
import { ListaCancionesImpacto, ProgresoOperacion } from './piezas'
import { TEMA } from './textos'
import { derivarFallo, useOperacionTema } from './useOperacionTema'
import estilos from './temas.module.css'

interface Props {
  abierto: boolean
  temaId: string
  temaNombre: string
  /** Abre directamente en progreso con `temas.reanudarBorrado` (Ajustes › «Terminar de eliminar»). */
  reanudar?: boolean
  onCancelar(): void
  /** Borrado completo; `convertidas` = canciones guardadas como «Tema personalizado» en el último intento. */
  onEliminado(resultado: ResultadoOperacionIpc, convertidas: number): void
  /** [Cancelar el borrado]: `convertidas` = las que ya se habían guardado. */
  onBorradoCancelado(convertidas: number): void
  /** Errores que el diálogo no explica (escritura, etc.). */
  onError?(err: unknown): void
}

export function DialogoEliminarTema(props: Props) {
  if (!props.abierto) return null
  return <Interno {...props} />
}

const aplicadas = (r: ResultadoOperacionIpc): number =>
  r.canciones.filter((c) => c.estado === 'aplicada').length

function Interno({
  temaId,
  temaNombre,
  reanudar = false,
  onCancelar,
  onEliminado,
  onBorradoCancelado,
  onError
}: Props) {
  const o = useOperacionTema()
  const cancelar = useRef<HTMLButtonElement>(null)
  const reintentar = useRef<HTMLButtonElement>(null)
  const confirmar = useRef<HTMLButtonElement>(null)

  function terminarCon(r: ResultadoOperacionIpc | null): void {
    if (r && !derivarFallo(r)) onEliminado(r, aplicadas(r))
  }

  useEffect(() => {
    if (reanudar) void o.reanudarBorrado(temaId).then(terminarCon)
    else void o.previsualizar({ tipo: 'borrar', temaId })
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (o.fase === 'fallo') reintentar.current?.focus()
  }, [o.fase, o.fallo])

  useEffect(() => {
    if (o.obsoleto) confirmar.current?.focus()
  }, [o.obsoleto, o.impacto])

  const codigo = o.error?.codigo
  const conocido =
    codigo === 'TEMA_NO_ENCONTRADO' ||
    codigo === 'BORRADO_PENDIENTE' ||
    codigo === 'TEMAS_SOLO_LECTURA'
  useEffect(() => {
    if (o.fase === 'error' && o.error && !conocido) onError?.(o.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.fase, o.error])

  const ocupado = o.fase === 'ejecutando'
  const i = o.impacto
  const n = i?.afectadas.length ?? 0

  async function cancelarBorrado(): Promise<void> {
    let convertidas = o.resultado ? aplicadas(o.resultado) : 0
    try {
      const pendiente = (await window.shinobi.temas.catalogo()).borradoPendiente
      if (pendiente) convertidas = Math.max(pendiente.total - pendiente.restantes, 0)
    } catch {
      // Se usa el recuento del último resultado.
    }
    try {
      await window.shinobi.temas.cancelarBorrado()
      onBorradoCancelado(convertidas)
    } catch (e) {
      onError?.(e)
    }
  }

  let cuerpo: ReactNode = null
  if (o.fase === 'fallo' && o.fallo) {
    cuerpo = <ListaFalloAMitad fallo={o.fallo} texto={{ clave: 'eliminar' }} />
  } else if (o.fase === 'error' && conocido) {
    cuerpo = (
      <AvisoEnLinea tipo="error">
        {codigo === 'TEMA_NO_ENCONTRADO'
          ? TEMA.errorNoExiste
          : codigo === 'BORRADO_PENDIENTE'
            ? TEMA.borradoPendiente
            : TEMA.soloLectura}
      </AvisoEnLinea>
    )
  } else if (i || ocupado) {
    const grupos = i
      ? TEMA.eliminar.grupos(
          i.asignacionesRetiradas.artistas.length,
          i.asignacionesRetiradas.albumes.length
        )
      : null
    cuerpo = (
      <div className={estilos.ancho}>
        {o.obsoleto && <AvisoEnLinea tipo="error">{TEMA.obsoleto}</AvisoEnLinea>}
        {i && <p className={estilos.texto}>{TEMA.eliminar.cuerpo(n, temaNombre)}</p>}
        {i && <ListaCancionesImpacto canciones={i.afectadas} />}
        {grupos && <p className={estilos.texto}>{grupos}</p>}
        {i?.esPredeterminado && <p className={estilos.texto}>{TEMA.eliminar.predeterminado}</p>}
        {i && <p className={estilos.texto}>{TEMA.eliminar.cierre}</p>}
        <ProgresoOperacion progreso={ocupado ? o.progreso : null} texto={TEMA.eliminar.progreso} />
      </div>
    )
  }

  const acciones =
    o.fase === 'fallo' ? (
      <>
        <Boton
          ref={reintentar}
          variante="primario"
          onClick={() => void o.reanudarBorrado(temaId).then(terminarCon)}
        >
          {TEMA.reintentar}
        </Boton>
        <Boton onClick={() => void cancelarBorrado()}>{TEMA.eliminar.cancelarBorrado}</Boton>
        <Boton onClick={onCancelar}>{TEMA.cerrar}</Boton>
      </>
    ) : (
      <>
        {!ocupado && (
          <Boton ref={cancelar} data-foco-inicial="" onClick={onCancelar}>
            {TEMA.cancelar}
          </Boton>
        )}
        {!(o.fase === 'error' && conocido) && (
          <Boton
            ref={confirmar}
            variante="destructivo"
            cargando={ocupado}
            textoCargando={TEMA.eliminar.eliminando}
            onClick={() => {
              if (o.fase === 'confirmando') void o.ejecutar().then(terminarCon)
            }}
          >
            {TEMA.eliminar.boton}
          </Boton>
        )}
      </>
    )

  return (
    <Dialogo
      abierto
      titulo={TEMA.eliminar.titulo(temaNombre)}
      ancho="35rem"
      enfoqueInicial="[data-foco-inicial]"
      onCancelar={() => {
        if (!ocupado) onCancelar()
      }}
      acciones={acciones}
    >
      {cuerpo}
    </Dialogo>
  )
}
