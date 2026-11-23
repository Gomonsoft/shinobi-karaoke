import { useEffect, useRef, useState } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { mostrarToast } from '../../../componentes/gestorToasts'
import temas from '../../../temas/temas.module.css'
import { tituloYArtista } from '../../../temas/textos'
import { detallesDeError } from '../errores'
import { tituloDeError } from '../textosError'
import { esListaParaRevisar } from '../tarjeta'
import { copiarDetalles } from '../../../soporte/detalles'
import { ListaCanciones, type FilaCancion } from './ListaCanciones'
import { ACC, motivoDe } from './textos'

type Plan = {
  id: string
  aplica: boolean
  pasos: string[]
  /** Letra sin marca: solo recibe fines y exige la confirmación de este diálogo. */
  confirmar?: 'finesSinMarca'
  motivo?: string
}

/** Cómo se cierra un diálogo de lote: la Biblioteca decide el modo selección y el foco con esto. */
export type SalidaAccion =
  { tipo: 'cancelado' } | { tipo: 'hecho' } | { tipo: 'faltan'; ids: string[] }

/** Nota por canción (`bib.acc.preparar.nota.*`) según lo que main dice que va a hacer. */
export function notaDePreparar(plan: Plan, r: ResumenCancionIpc | undefined): string {
  if (plan.confirmar === 'finesSinMarca') return ACC.prep.notaFinesSinMarca
  if (plan.pasos.includes('buscando_letra')) {
    return r && r.pasos?.separacion.estado !== 'completado'
      ? ACC.prep.notaSeparaBuscara
      : ACC.prep.notaBuscara
  }
  return plan.pasos.includes('comprobando') ? ACC.prep.notaConLetra : ACC.prep.notaFines
}

/** Motivo de una canción que no se prepara; «ya lista para revisar» se distingue por el resumen. */
export function motivoDePreparar(plan: Plan, r: ResumenCancionIpc | undefined): string {
  if (r?.danada) return motivoDe('danada')
  if (plan.motivo === 'YA_LISTA' && r && r.estado === 'borrador' && esListaParaRevisar(r)) {
    return motivoDe('yaPreparada')
  }
  return motivoDe(plan.motivo)
}

interface Props {
  /** Seleccionadas en el orden de la Biblioteca (sin agrupar). */
  canciones: ResumenCancionIpc[]
  alCerrar(salida: SalidaAccion): void
}

/** «Preparar» de varias (docs/ux/02 · Feature 8): confirmación con una nota por canción. */
export function DialogoPreparar({ canciones, alCerrar }: Props) {
  const [planes, setPlanes] = useState<Plan[] | null>(null)
  const [enviando, setEnviando] = useState(false)
  const alCerrarRef = useRef(alCerrar)
  useEffect(() => {
    alCerrarRef.current = alCerrar
  })
  const ids = canciones.map((c) => c.id).join('|')

  useEffect(() => {
    let activo = true
    window.shinobi.preparacion.previsualizar(ids.split('|')).then(
      (p) => activo && setPlanes(p),
      (e: unknown) => {
        if (!activo) return
        mostrarToast({
          tipo: 'error',
          mensaje: tituloDeError(
            e && typeof e === 'object' && 'codigo' in e ? String(e.codigo) : ''
          ),
          accion: {
            etiqueta: ACC.copiarDetalles,
            alAccionar: () => void copiarDetalles(detallesDeError(e))
          }
        })
        alCerrarRef.current({ tipo: 'cancelado' })
      }
    )
    return () => {
      activo = false
    }
  }, [ids])

  const porId = new Map(canciones.map((c) => [c.id, c]))
  const todas: FilaCancion[] = []
  const aplicables: Plan[] = []
  if (planes) {
    const ordenados = [...planes.filter((p) => p.aplica), ...planes.filter((p) => !p.aplica)]
    for (const p of ordenados) {
      const r = porId.get(p.id)
      const texto = tituloYArtista(r?.titulo ?? '', r?.artista ?? '')
      const nota = p.aplica ? notaDePreparar(p, r) : motivoDePreparar(p, r)
      if (p.aplica) aplicables.push(p)
      todas.push({
        id: p.id,
        texto,
        nota,
        atenuada: !p.aplica,
        aria: `${r?.titulo ?? ''}, ${r?.artista ?? ''}: ${nota}`
      })
    }
  }
  const n = aplicables.length
  const buscaLetra = aplicables.some((p) => p.pasos.includes('buscando_letra'))
  const sinMarca = aplicables.filter((p) => p.confirmar === 'finesSinMarca').length

  async function preparar(): Promise<void> {
    if (n === 0 || enviando) return
    setEnviando(true)
    try {
      const idsAplicables = aplicables.map((p) => p.id)
      // Este diálogo es la confirmación de las de letra sin marca: no sale otro.
      const r = await (sinMarca > 0
        ? window.shinobi.preparacion.preparar(idsAplicables, { finesSinMarca: true })
        : window.shinobi.preparacion.preparar(idsAplicables))
      const aceptadas = r.aceptadas.length
      const primera = porId.get(r.aceptadas[0] ?? '')
      mostrarToast({
        tipo: 'info',
        mensaje: ACC.prep.toast(aceptadas, primera?.titulo ?? ''),
        accion: {
          etiqueta: ACC.prep.verActividad,
          alAccionar: () => window.dispatchEvent(new CustomEvent('shinobi:abrir-actividad'))
        }
      })
      alCerrar({ tipo: 'hecho' })
    } catch (e) {
      setEnviando(false)
      mostrarToast({
        tipo: 'error',
        mensaje: tituloDeError(e && typeof e === 'object' && 'codigo' in e ? String(e.codigo) : ''),
        accion: {
          etiqueta: ACC.copiarDetalles,
          alAccionar: () => void copiarDetalles(detallesDeError(e))
        }
      })
    }
  }

  return (
    <Dialogo
      abierto
      titulo={ACC.prep.titulo(n || canciones.length)}
      ancho="35rem"
      enfoqueInicial="[data-cancelar]"
      onCancelar={() => !enviando && alCerrar({ tipo: 'cancelado' })}
      acciones={
        <>
          <Boton data-cancelar onClick={() => alCerrar({ tipo: 'cancelado' })}>
            {ACC.cancelar}
          </Boton>
          <Boton
            variante="primario"
            cargando={enviando}
            textoCargando={ACC.prep.boton(n)}
            noDisponible={
              planes === null ? ACC.calculando : n === 0 ? ACC.ninguna.preparar : undefined
            }
            onClick={() => void preparar()}
          >
            {planes === null ? ACC.calculando : ACC.prep.boton(n)}
          </Boton>
        </>
      }
    >
      <div className={temas.ancho}>
        <p className={temas.texto}>{ACC.prep.explicacion}</p>
        <ListaCanciones filas={todas} calculando={planes === null} etiqueta={ACC.canciones} />
        {buscaLetra && <AvisoEnLinea tipo="info">{ACC.prep.privacidad}</AvisoEnLinea>}
        {sinMarca > 0 && (
          <AvisoEnLinea tipo="info">{ACC.prep.avisoFinesSinMarca(sinMarca)}</AvisoEnLinea>
        )}
      </div>
    </Dialogo>
  )
}
