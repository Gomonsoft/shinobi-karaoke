import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { Dialogo } from '../../componentes/Dialogo'
import { mostrarToast } from '../../componentes/gestorToasts'
import estilosComponentes from '../../componentes/componentes.module.css'
import { copiarDetalles } from '../../soporte/detalles'
import { useExportaciones } from '../contexto'
import { porcentajeDe } from '../estado'
import { formatearTamano, textoErrorExp } from '../dialogo/textos'
import { EXP_PROGRESO, EXP_TOAST, formatearDuracionTrabajo } from '../dialogo/textosProgreso'
import estilos from '../dialogo/exportacion.module.css'
import {
  filasDelLote,
  minutosRestantes,
  reintentables,
  resumirLote,
  type FilaLote,
  type LoteVista
} from './modelo'
import { EXP_LOTE } from './textos'

interface Props {
  lote: LoteVista
  /** Abre con la confirmación de «Cancelar las que faltan» ya visible (✕ de la fila del panel de actividad). */
  confirmarInicial?: boolean
  alCerrar(): void
  /** Main aceptó «Reintentar las fallidas»: el lote sigue con solo esas. */
  alReintentado(cambios: Partial<LoteVista>): void
}

const SIMBOLO: Record<FilaLote['estado'], string> = {
  terminada: '✓',
  enCurso: '⟳',
  enCola: '🕒',
  error: '✕',
  noIntentada: '–',
  cancelada: '–'
}

/** Detalles que copia «Copiar detalles» de una fila fallida. */
function detallesDe(f: FilaLote): string {
  const e = f.exportacion?.error
  return e ? `${e.codigo}: ${e.mensaje}`.trim() : ''
}

/** Estados H (exportando el lote) e I (resultado) del diálogo de lote (docs/ux/10 · Feature 8). */
export function SeguimientoLote({
  lote,
  confirmarInicial = false,
  alCerrar,
  alReintentado
}: Props) {
  const { exportaciones, pedirCancelar } = useExportaciones()
  const filasRonda = filasDelLote(lote, exportaciones)
  const resumen = resumirLote(filasRonda)
  const fin = resumen.acabado || filasRonda.length === 0
  const [confirmando, setConfirmando] = useState(confirmarInicial)
  const [reintentando, setReintentando] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fin) return
    const t = setInterval(() => setAhora(Date.now()), 5000)
    return () => clearInterval(t)
  }, [fin])

  // Anuncios (`role="status"`): la última canción terminada o fallida y el fin del lote; nunca los porcentajes.
  const ultima = filasRonda
    .filter((f) => f.estado === 'terminada' || f.estado === 'error')
    .sort(
      (x, y) =>
        Date.parse(y.exportacion?.terminadaEn ?? '') - Date.parse(x.exportacion?.terminadaEn ?? '')
    )[0]
  const anuncio = fin
    ? resumen.total > 0
      ? EXP_LOTE.anuncio.fin(resumen.completadas, resumen.total)
      : ''
    : ultima
      ? EXP_LOTE.anuncio.cancion(
          resumen.terminadas,
          resumen.total,
          ultima.cancion.titulo,
          ultima.estado === 'terminada'
        )
      : ''

  // Foco: H → «Seguir en segundo plano»; I → «Mostrar la carpeta» (o el botón que quede).
  const faseAnterior = useRef<'H' | 'I' | null>(null)
  const fase = fin ? 'I' : 'H'
  useEffect(() => {
    if (faseAnterior.current === fase) return
    faseAnterior.current = fase
    const sel = fase === 'H' ? '[data-segundo-plano]' : '[data-principal]'
    ;(
      raiz.current?.parentElement?.querySelector<HTMLElement>(sel) ??
      raiz.current?.parentElement?.querySelector<HTMLElement>('[data-cerrar]')
    )?.focus()
  }, [fase])

  const faltan = filasRonda.filter((f) => f.estado === 'enCola' || f.estado === 'enCurso').length
  const cancelarFaltan = (): void => {
    setConfirmando(false)
    void window.shinobi.exportacion
      .cancelarLote(lote.loteId)
      .catch(() => mostrarToast({ tipo: 'error', mensaje: EXP_PROGRESO.noSeCancelo }))
  }
  const quitar = (f: FilaLote): void => {
    const id = f.exportacion?.trabajoId ?? lote.trabajos[f.cancion.id]
    if (!id) return
    if (f.estado === 'enCola') {
      void window.shinobi.exportacion
        .cancelar(id)
        .catch(() => mostrarToast({ tipo: 'error', mensaje: EXP_PROGRESO.noSeCancelo }))
    } else pedirCancelar(id)
  }

  const textoFila = (f: FilaLote): string => {
    const e = f.exportacion
    switch (f.estado) {
      case 'terminada':
        return fin && e?.archivo ? e.archivo : formatearTamano(e?.bytes ?? 0)
      case 'enCurso': {
        const p = e?.progreso
        return p?.fase === 'codificando' && p.valor !== null
          ? EXP_LOTE.fila.creando(porcentajeDe(p))
          : EXP_LOTE.fila.preparando
      }
      case 'enCola':
        return EXP_LOTE.fila.enCola
      case 'noIntentada':
        return EXP_LOTE.fila.noIntentada
      case 'error':
        return textoErrorExp(e?.error?.codigo ?? 'ERROR_INTERNO').titulo
      default:
        return EXP_LOTE.fila.cancelada
    }
  }

  const reintentar = async (): Promise<void> => {
    setReintentando(true)
    try {
      const r = await window.shinobi.exportacion.reintentarLote(lote.loteId)
      const porId = new Map(lote.canciones.map((c) => [c.id, c]))
      alReintentado({
        trabajos: {
          ...lote.trabajos,
          ...Object.fromEntries(r.encoladas.map((e) => [e.cancionId, e.trabajoId]))
        },
        ronda: r.encoladas.map((e) => e.cancionId),
        omitidas: r.omitidas.map((o) => ({
          id: o.id,
          titulo: porId.get(o.id)?.titulo ?? '',
          artista: porId.get(o.id)?.artista ?? '',
          motivo: o.motivo
        })),
        iniciadoEn: Date.now()
      })
    } catch (err) {
      mostrarToast({ tipo: 'error', mensaje: EXP_PROGRESO.noSeReintento })
      void err
    } finally {
      setReintentando(false)
    }
  }

  const mostrarCarpeta = (): void => {
    const hecha = filasDelLote(lote, exportaciones, false).find((f) => f.estado === 'terminada')
    const id = hecha?.exportacion?.trabajoId
    if (!id) return
    void window.shinobi.exportacion
      .mostrarEnCarpeta({ trabajoId: id })
      .catch(() => mostrarToast({ tipo: 'aviso', mensaje: EXP_TOAST.noExiste }))
  }

  const todas = filasDelLote(lote, exportaciones, false)
  const resumenTodas = resumirLote(todas)
  const totalVideos = todas.length + lote.omitidas.length
  const minutos = minutosRestantes(resumen.fraccion, ahora - lote.iniciadoEn)
  const detenido = resumen.detenidoPor?.error?.codigo
  const textoDetenido = detenido ? textoErrorExp(detenido as never) : null
  const retos = reintentables(todas)
  const ninguno = resumenTodas.completadas === 0

  // ---- H: exportando ----
  if (!fin) {
    return (
      <Dialogo
        abierto
        titulo={EXP_LOTE.progresoTitulo(resumen.total)}
        onCancelar={alCerrar}
        enfoqueInicial="[data-segundo-plano]"
        ancho="40rem"
        acciones={
          confirmando ? undefined : (
            <>
              <Boton variante="fantasma" onClick={() => setConfirmando(true)}>
                {EXP_LOTE.cancelarBoton}
              </Boton>
              <Boton data-segundo-plano variante="primario" onClick={alCerrar}>
                {EXP_LOTE.segundoPlano}
              </Boton>
            </>
          )
        }
      >
        <div ref={raiz} data-estado="lote-exportando" className={estilos.contenedor}>
          <p className={`t-pequeno ${estilos.texto2}`}>
            {lote.opciones.ancho} × {lote.opciones.alto} · {lote.opciones.fps} FPS · en{' '}
            {lote.carpeta}
          </p>
          <p>
            {EXP_LOTE.progreso(resumen.terminadas, resumen.total)}
            {' · '}
            {minutos === null ? EXP_PROGRESO.etaCalculando : EXP_LOTE.restante(minutos)}
          </p>
          <BarraProgreso
            etiqueta={EXP_LOTE.progreso(resumen.terminadas, resumen.total)}
            valor={Math.round(resumen.fraccion * 100)}
          />
          {textoDetenido && (
            <AvisoEnLinea tipo="error">
              {EXP_LOTE.detenido(textoDetenido.titulo, textoDetenido.explicacion)}
            </AvisoEnLinea>
          )}
          <Filas
            filas={filasRonda}
            omitidas={lote.omitidas}
            textoFila={textoFila}
            alQuitar={quitar}
            conSimbolo
          />
          {confirmando ? (
            <AvisoEnLinea
              tipo="aviso"
              accion={
                <>
                  <Boton ref={(nodo) => nodo?.focus()} onClick={() => setConfirmando(false)}>
                    {EXP_LOTE.seguirExportando}
                  </Boton>
                  <Boton variante="destructivo" onClick={cancelarFaltan}>
                    {EXP_LOTE.cancelarBoton}
                  </Boton>
                </>
              }
            >
              {EXP_LOTE.cancelar(faltan, resumen.completadas)}
            </AvisoEnLinea>
          ) : (
            <p className={`t-pequeno ${estilos.texto2}`}>{EXP_LOTE.ayudaSegundoPlano}</p>
          )}
          <p role="status" className={estilosComponentes.soloLector}>
            {anuncio}
          </p>
        </div>
      </Dialogo>
    )
  }

  // ---- I: resultado ----
  return (
    <Dialogo
      abierto
      titulo={ninguno ? EXP_LOTE.resultadoNinguno : EXP_LOTE.resultadoTitulo}
      onCancelar={alCerrar}
      enfoqueInicial="[data-principal]"
      ancho="40rem"
      acciones={
        <>
          {retos.length > 0 && (
            <Boton
              data-principal={ninguno ? '' : undefined}
              cargando={reintentando}
              textoCargando={EXP_LOTE.reintentar}
              onClick={() => void reintentar()}
            >
              {EXP_LOTE.reintentar}
            </Boton>
          )}
          <Boton data-cerrar onClick={alCerrar}>
            {EXP_LOTE.cerrar}
          </Boton>
          {!ninguno && (
            <Boton data-principal variante="primario" onClick={mostrarCarpeta}>
              {EXP_LOTE.mostrar}
            </Boton>
          )}
        </>
      }
    >
      <div ref={raiz} data-estado="lote-resultado" className={estilos.contenedor}>
        {!ninguno && (
          <p>
            {EXP_LOTE.resultado(
              resumenTodas.completadas,
              totalVideos,
              formatearTamano(resumenTodas.bytes),
              formatearDuracionTrabajo(resumenTodas.duracionMs ?? 0)
            )}
          </p>
        )}
        <p className={`t-pequeno ${estilos.texto2}`}>{EXP_LOTE.enCarpeta(lote.carpeta)}</p>
        {textoDetenido && (
          <AvisoEnLinea tipo="error">
            {EXP_LOTE.detenido(textoDetenido.titulo, textoDetenido.explicacion)}
          </AvisoEnLinea>
        )}
        <Filas
          filas={todas}
          omitidas={lote.omitidas}
          textoFila={textoFila}
          conSimbolo
          alCopiar={(f) => {
            void copiarDetalles(detallesDe(f))
            mostrarToast({ tipo: 'exito', mensaje: 'Detalles copiados.' })
          }}
        />
        <p role="status" className={estilosComponentes.soloLector}>
          {anuncio}
        </p>
      </div>
    </Dialogo>
  )
}

function textoOmitida(motivo: string): string {
  return motivo === 'YA_EXISTE'
    ? EXP_LOTE.fila.yaExiste
    : motivo === 'YA_EN_COLA'
      ? EXP_LOTE.fila.yaEnCola
      : EXP_LOTE.fila.omitida
}

interface FilasProps {
  filas: FilaLote[]
  omitidas: LoteVista['omitidas']
  textoFila(f: FilaLote): string
  conSimbolo: boolean
  alQuitar?(f: FilaLote): void
  alCopiar?(f: FilaLote): void
}

function Filas({ filas, omitidas, textoFila, alQuitar, alCopiar }: FilasProps) {
  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- role explícito: Safari quita la semántica con list-style none
    <ul
      role="list"
      aria-label={EXP_LOTE.fila.canciones}
      className={estilos.listaLote}
      tabIndex={filas.length + omitidas.length > 5 ? 0 : undefined}
    >
      {filas.map((f) => (
        <li
          key={f.cancion.id}
          data-fila-lote={f.estado}
          aria-label={`${f.cancion.titulo}, ${f.cancion.artista}: ${textoFila(f)}`}
          className={estilos.filaLote}
        >
          <span aria-hidden="true" className={estilos.simboloLote}>
            {SIMBOLO[f.estado]}
          </span>
          <span className={estilos.textoFilaLote}>
            {f.cancion.titulo} — {f.cancion.artista} · {textoFila(f)}
          </span>
          {alQuitar && (f.estado === 'enCola' || f.estado === 'enCurso') && (
            <BotonIcono
              icono={X}
              etiqueta={EXP_LOTE.quitar(f.cancion.titulo)}
              onClick={() => alQuitar(f)}
            />
          )}
          {alCopiar && f.estado === 'error' && (
            <Boton variante="fantasma" onClick={() => alCopiar(f)}>
              {EXP_LOTE.copiarDetalles}
            </Boton>
          )}
        </li>
      ))}
      {omitidas.map((o) => (
        <li key={`o-${o.id}`} data-fila-lote="omitida" className={estilos.filaLote}>
          <span aria-hidden="true" className={estilos.simboloLote}>
            –
          </span>
          <span className={estilos.textoFilaLote}>
            {o.titulo} — {o.artista} · {textoOmitida(o.motivo)}
          </span>
        </li>
      ))}
    </ul>
  )
}
