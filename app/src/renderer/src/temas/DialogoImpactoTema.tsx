import { useEffect, useRef, type ReactNode } from 'react'
import type { ImpactoIpc, OperacionTema, ResultadoOperacionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../componentes/AvisoEnLinea'
import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import { ListaFalloAMitad } from './ListaFalloAMitad'
import { ListaCancionesImpacto, ProgresoOperacion } from './piezas'
import { AJ_TEMAS, TEMA, lineasDesglose } from './textos'
import { derivarFallo, useOperacionTema } from './useOperacionTema'
import estilos from './temas.module.css'

export type VarianteImpacto =
  /** `tema.dialogo.guardar` (editar un tema). */
  | { tipo: 'guardar'; tema: string; incluidaEsta?: boolean }
  /** `aj.temas.dialogo.predet`; `anterior` `null` = sin predeterminado (variante «sin anterior»). */
  | { tipo: 'predeterminado'; nuevo: string; anterior: string | null }
  /** `aj.temas.dialogo.ninguno` (B1: quitar el predeterminado). */
  | { tipo: 'ninguno'; anterior: string }

interface Props {
  abierto: boolean
  variante: VarianteImpacto
  /** Operación que se previsualiza al abrir y se ejecuta al confirmar. */
  op: OperacionTema
  onCancelar(): void
  /** La operación terminó sin fallo a mitad: el consumidor cierra y avisa. */
  onHecho(resultado: ResultadoOperacionIpc, impacto: ImpactoIpc): void
  /** Errores que el diálogo no explica por sí mismo (escritura, etc.): el consumidor decide. */
  onError?(err: unknown): void
  /** `guardar`: «Guardar como tema nuevo…» (cierra este diálogo y abre el del nombre). */
  onGuardarNuevo?(): void
}

export function DialogoImpactoTema(props: Props) {
  if (!props.abierto) return null
  return <Interno {...props} />
}

function Interno({ variante, op, onCancelar, onHecho, onError, onGuardarNuevo }: Props) {
  const o = useOperacionTema()
  const cancelar = useRef<HTMLButtonElement>(null)
  const confirmar = useRef<HTMLButtonElement>(null)
  const reintentar = useRef<HTMLButtonElement>(null)
  const volverACancelar = useRef(false)
  const clave = JSON.stringify(op)

  useEffect(() => {
    void o.previsualizar(op)
    // Solo al abrir (o si cambia la operación).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  // Confirmación obsoleta: el foco se queda en el botón pulsado.
  useEffect(() => {
    if (o.obsoleto) confirmar.current?.focus()
  }, [o.obsoleto, o.impacto])

  useEffect(() => {
    if (o.fase === 'fallo') reintentar.current?.focus()
    else if (o.fase === 'confirmando' && volverACancelar.current) {
      volverACancelar.current = false
      cancelar.current?.focus()
    }
  }, [o.fase, o.fallo])

  const codigoError = o.error?.codigo
  const conocido =
    codigoError === 'TEMA_NO_ENCONTRADO' ||
    codigoError === 'BORRADO_PENDIENTE' ||
    codigoError === 'TEMAS_SOLO_LECTURA'
  useEffect(() => {
    if (o.fase === 'error' && o.error && !conocido) onError?.(o.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.fase, o.error])

  const ocupado = o.fase === 'ejecutando'
  const n = o.impacto?.afectadas.length ?? 0
  const quitando = variante.tipo === 'ninguno'

  async function pulsarConfirmar(): Promise<void> {
    if (o.fase !== 'confirmando' || !o.impacto) return
    const impacto = o.impacto
    const r = await o.ejecutar()
    if (!r) return
    const f = op.tipo === 'predeterminado' && op.temaId === null ? derivarFallo(r) : null
    if (!f) onHecho(r, impacto)
  }

  const titulo =
    variante.tipo === 'guardar'
      ? TEMA.guardar.titulo(variante.tema)
      : variante.tipo === 'predeterminado'
        ? AJ_TEMAS.predet.titulo(variante.nuevo)
        : AJ_TEMAS.quitar.titulo
  const etiquetaConfirmar =
    variante.tipo === 'guardar'
      ? TEMA.guardar.guardarEn(variante.tema)
      : variante.tipo === 'predeterminado'
        ? AJ_TEMAS.predet.boton(variante.nuevo)
        : AJ_TEMAS.quitar.boton

  let cuerpo: ReactNode = null
  if (o.fase === 'fallo' && o.fallo && variante.tipo === 'ninguno') {
    cuerpo = (
      <ListaFalloAMitad fallo={o.fallo} texto={{ clave: 'ninguno', anterior: variante.anterior }} />
    )
  } else if (o.fase === 'error' && conocido) {
    cuerpo = (
      <AvisoEnLinea tipo="error">
        {codigoError === 'TEMA_NO_ENCONTRADO'
          ? TEMA.errorNoExiste
          : codigoError === 'BORRADO_PENDIENTE'
            ? TEMA.borradoPendiente
            : TEMA.soloLectura}
      </AvisoEnLinea>
    )
  } else if (o.impacto) {
    const i = o.impacto
    const lineas = variante.tipo === 'guardar' ? lineasDesglose(i.desglose) : []
    cuerpo = (
      <div className={estilos.ancho}>
        {o.obsoleto && <AvisoEnLinea tipo="error">{TEMA.obsoleto}</AvisoEnLinea>}
        <p className={estilos.texto}>
          {variante.tipo === 'guardar'
            ? TEMA.guardar.cuerpo(n, variante.incluidaEsta ?? false)
            : variante.tipo === 'predeterminado'
              ? AJ_TEMAS.predet.cuerpo(n, variante.anterior)
              : AJ_TEMAS.quitar.cuerpo(n, variante.anterior)}
        </p>
        {lineas.length > 0 && (
          <ul className={estilos.desglose}>
            {lineas.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <ListaCancionesImpacto canciones={i.afectadas} />
        <p className={estilos.nota}>
          {variante.tipo === 'guardar'
            ? TEMA.guardar.nota
            : variante.tipo === 'predeterminado'
              ? AJ_TEMAS.predet.nota
              : AJ_TEMAS.quitar.nota}
        </p>
        {variante.tipo === 'guardar' && i.sesionEnCurso && (
          <p className={estilos.nota}>{TEMA.guardar.sesion}</p>
        )}
        <ProgresoOperacion
          progreso={ocupado ? o.progreso : null}
          texto={quitando ? AJ_TEMAS.quitar.progreso : TEMA.eliminar.progreso}
        />
      </div>
    )
  }

  const enFallo = o.fase === 'fallo'
  const acciones = enFallo ? (
    <>
      <Boton
        ref={reintentar}
        variante="primario"
        onClick={() => {
          volverACancelar.current = true
          void o.previsualizar(op)
        }}
      >
        {TEMA.reintentar}
      </Boton>
      <Boton onClick={onCancelar}>{TEMA.cerrar}</Boton>
    </>
  ) : (
    <>
      {!ocupado && (
        <Boton ref={cancelar} data-foco-inicial="" onClick={onCancelar}>
          {TEMA.cancelar}
        </Boton>
      )}
      {variante.tipo === 'guardar' && !ocupado && onGuardarNuevo && (
        <Boton onClick={onGuardarNuevo}>{TEMA.guardar.guardarNuevo}</Boton>
      )}
      {!(o.fase === 'error' && conocido) && (
        <Boton
          ref={confirmar}
          variante="primario"
          cargando={ocupado}
          textoCargando={quitando ? AJ_TEMAS.quitar.quitando : etiquetaConfirmar}
          onClick={() => void pulsarConfirmar()}
        >
          {etiquetaConfirmar}
        </Boton>
      )}
    </>
  )

  return (
    <Dialogo
      abierto
      titulo={titulo}
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
