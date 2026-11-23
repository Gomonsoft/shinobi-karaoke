import { useEffect, useRef, useState } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { mostrarToast } from '../../../componentes/gestorToasts'
import comunes from '../../../componentes/componentes.module.css'
import temas from '../../../temas/temas.module.css'
import { TEMA, tituloYArtista } from '../../../temas/textos'
import { copiarDetalles } from '../../../soporte/detalles'
import { tituloDeError } from '../textosError'
import { ListaCanciones, type FilaCancion } from './ListaCanciones'
import type { SalidaAccion } from './DialogoPreparar'
import { falladas, filaDeResultado, esProblema, hechas } from './resultado'
import { ACC, motivoDe } from './textos'
import { useAccionVarias } from './useAccionVarias'

const estadoDe = (r: ResumenCancionIpc): string =>
  r.danada ? 'Dañada' : r.estado === 'lista' ? 'Lista' : 'Borrador'

interface Props {
  canciones: ResumenCancionIpc[]
  alCerrar(salida: SalidaAccion): void
}

const ops = {
  previsualizar: (ids: string[]) => window.shinobi.biblioteca.eliminarVarias.previsualizar(ids),
  ejecutar: (ids: string[], version: string) =>
    window.shinobi.biblioteca.eliminarVarias.ejecutar(ids, version)
}

/** «Eliminar…» de varias (docs/ux/02 · Feature 8): confirmación con lo que arrastra cada canción. */
export function DialogoEliminar({ canciones, alCerrar }: Props) {
  const [ids, setIds] = useState(() => canciones.map((c) => c.id))
  // La casilla vale para la vista previa (versión) en la que se marcó: una nueva pide marcarla otra vez.
  const [entiendoPara, setEntiendoPara] = useState<string | null>(null)
  const a = useAccionVarias(ops, ids, '')
  const porId = new Map(canciones.map((c) => [c.id, c]))
  const principal = useRef<HTMLButtonElement>(null)

  const previa = a.previa
  const aplicables = previa?.canciones.filter((c) => c.aplica) ?? []
  const n = aplicables.length
  const listas = aplicables.filter((c) => {
    const r = porId.get(c.id)
    return r?.estado === 'lista' && !r.danada
  }).length
  const necesitaCasilla = n >= ACC.eliminar.umbralCasilla
  const ocupado = a.fase === 'ejecutando'
  // Un resultado sin problemas no se pinta: el diálogo se cierra solo con su toast.
  const hecha =
    a.fase === 'hecha' && a.resultado !== null && a.resultado.resultados.some(esProblema)

  const entiendo = previa !== null && entiendoPara === previa.version
  useEffect(() => {
    if (a.obsoleta) principal.current?.focus()
  }, [a.obsoleta, previa])

  // Todo bien: el diálogo se cierra solo con su toast.
  const resultado = a.resultado
  useEffect(() => {
    if (!resultado || resultado.resultados.some(esProblema)) return
    mostrarToast({ tipo: 'exito', mensaje: ACC.eliminar.toast(hechas(resultado)) })
    alCerrar({ tipo: 'hecho' })
    // Solo al llegar un resultado nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado])

  const nombre = (id: string): { texto: string; aria: string } => {
    const r = porId.get(id)
    return {
      texto: tituloYArtista(r?.titulo ?? '', r?.artista ?? ''),
      aria: `${r?.titulo ?? ''}, ${r?.artista ?? ''}`
    }
  }

  let filas: FilaCancion[] = []
  if (hecha) {
    filas = a.resultado!.resultados.map((r) => ({
      ...filaDeResultado(r, nombre(r.id), ACC.eliminar.fallo),
      extra:
        r.resultado === 'error' ? (
          <Boton variante="fantasma" onClick={() => void copiarDetalles(r.motivo ?? '')}>
            {ACC.copiarDetalles}
          </Boton>
        ) : undefined
    }))
  } else if (previa) {
    const ordenadas = [
      ...previa.canciones.filter((c) => c.aplica),
      ...previa.canciones.filter((c) => !c.aplica)
    ]
    filas = ordenadas.map((c) => {
      const r = porId.get(c.id)
      const notas = c.aplica
        ? (
            [
              c.trabajos > 0 ? ACC.eliminar.nota.trabajo : '',
              c.entradasCola > 0 ? ACC.eliminar.nota.cola : ''
            ] as string[]
          ).filter(Boolean)
        : [motivoDe(c.motivo)]
      const n = nombre(c.id)
      return {
        id: c.id,
        texto: `${n.texto} · ${r ? estadoDe(r) : ''}${c.aplica && c.entradasCola > 0 ? ' · En la cola' : ''}`,
        nota: notas.join('. ') || undefined,
        atenuada: !c.aplica,
        aria: `${n.aria}: ${notas.join('. ') || (r ? estadoDe(r) : '')}`
      }
    })
  }

  const cerrar = (): void => {
    if (a.resultado) {
      const f = falladas(a.resultado)
      alCerrar(
        a.resultado.resultados.some(esProblema) ? { tipo: 'faltan', ids: f } : { tipo: 'hecho' }
      )
    } else alCerrar({ tipo: 'cancelado' })
  }
  const reintentar = (): void => {
    if (a.resultado) setIds(falladas(a.resultado))
  }
  const titulo = hecha
    ? `${hechas(a.resultado!)} de ${a.resultado!.resultados.length} canciones se movieron a la papelera.`
    : ACC.eliminar.titulo(ids.length)
  const reintentables = hecha ? falladas(a.resultado!).length : 0

  return (
    <Dialogo
      abierto
      titulo={titulo}
      ancho="35rem"
      enfoqueInicial="[data-cancelar]"
      onCancelar={() => !ocupado && cerrar()}
      acciones={
        hecha ? (
          <>
            {reintentables > 0 && (
              <Boton variante="primario" onClick={reintentar}>
                {ACC.reintentarFaltan}
              </Boton>
            )}
            <Boton
              data-cancelar
              variante={reintentables > 0 ? 'secundario' : 'primario'}
              onClick={cerrar}
            >
              {ACC.cerrar}
            </Boton>
          </>
        ) : (
          <>
            {!ocupado && (
              <Boton data-cancelar onClick={cerrar}>
                {ACC.cancelar}
              </Boton>
            )}
            <Boton
              ref={principal}
              variante="destructivo"
              cargando={ocupado}
              textoCargando={ACC.eliminar.eliminando(
                a.progreso?.hechas ?? 0,
                a.progreso?.total ?? n
              )}
              noDisponible={
                a.fase === 'calculando'
                  ? ACC.calculando
                  : n === 0
                    ? ACC.eliminar.nada
                    : necesitaCasilla && !entiendo
                      ? ACC.eliminar.entiendo(n)
                      : undefined
              }
              onClick={() => void a.ejecutar()}
            >
              {a.fase === 'calculando' ? ACC.calculando : ACC.eliminar.boton(n)}
            </Boton>
          </>
        )
      }
    >
      <div className={temas.ancho}>
        <p role="status" className={comunes.soloLector}>
          {hecha ? titulo : ''}
        </p>
        {!hecha && <p className={temas.texto}>{ACC.eliminar.cuerpo}</p>}
        {a.obsoleta && <AvisoEnLinea tipo="error">{TEMA.obsoleto}</AvisoEnLinea>}
        {a.fase === 'error' && (
          <AvisoEnLinea
            tipo="error"
            accion={<Boton onClick={() => void a.reintentar()}>{TEMA.reintentar}</Boton>}
          >
            {tituloDeError(a.error ?? '')}
          </AvisoEnLinea>
        )}
        <ListaCanciones
          filas={filas}
          calculando={a.fase === 'calculando'}
          etiqueta={ACC.canciones}
        />
        {!hecha && listas > 0 && (
          <p className={`${temas.texto} ${temas.aviso}`}>{ACC.eliminar.listas(listas, n)}</p>
        )}
        {!hecha && necesitaCasilla && (
          <label className={temas.texto}>
            <input
              type="checkbox"
              checked={entiendo}
              disabled={ocupado}
              onChange={(e) => setEntiendoPara(e.target.checked && previa ? previa.version : null)}
            />{' '}
            {ACC.eliminar.entiendo(n)}
          </label>
        )}
      </div>
    </Dialogo>
  )
}
