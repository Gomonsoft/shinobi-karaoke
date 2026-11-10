import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { OperacionTema } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { mostrarToast } from '../../componentes/gestorToasts'
import comunes from '../../componentes/componentes.module.css'
import { DialogoEliminarTema } from '../../temas/DialogoEliminarTema'
import { DialogoImpactoTema, type VarianteImpacto } from '../../temas/DialogoImpactoTema'
import { DialogoNombreTema } from '../../temas/DialogoNombreTema'
import { SelectorTema } from '../../temas/SelectorTema'
import { AJ_TEMAS, TEMA } from '../../temas/textos'
import { ordenarTemas, useCatalogoTemas, type TemaCatalogo } from '../../temas/useCatalogoTemas'
import estilos from './ajustes.module.css'
import { ListaTemas } from './ListaTemas'
import { AJT } from './textos'

/** Aviso de catálogo apartado ya cerrado en esta sesión (aunque `descartarAvisoApartado` falle). */
let apartadoCerrado: string | null = null
/** Solo para las pruebas. */
export function reiniciarAvisoApartado(): void {
  apartadoCerrado = null
}

type Dialogo =
  | { tipo: 'predeterminado'; op: OperacionTema; variante: VarianteImpacto }
  | { tipo: 'nombre'; modo: 'renombrar' | 'duplicar'; tema: TemaCatalogo }
  | {
      tipo: 'eliminar'
      tema: TemaCatalogo
      reanudar: boolean
      eraPredeterminado: boolean
      siguienteId: string | null
    }

interface Props {
  /** Abierta con «Administrar temas…»: el foco inicial va al encabezado «Temas». */
  enfocarAlAbrir?: boolean
}

const codigoDe = (e: unknown): string | null =>
  e && typeof e === 'object' && 'codigo' in e && typeof e.codigo === 'string' ? e.codigo : null

/** Sección «Temas» de Ajustes (`ux/08`, fase 3): predeterminado, lista del catálogo y avisos. */
export function TemasAjustes({ enfocarAlAbrir = false }: Props) {
  const { catalogo, cargando, soloLectura, ofrecibles, recargar } = useCatalogoTemas()
  const idAyuda = useId()
  const idUsos = useId()
  const titulo = useRef<HTMLHeadingElement>(null)
  const tituloLista = useRef<HTMLHeadingElement>(null)
  const zonaSelector = useRef<HTMLDivElement>(null)
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [foco, setFoco] = useState<{ id: string; n: number } | null>(null)
  const [focoSelector, setFocoSelector] = useState(0)
  const [focoLista, setFocoLista] = useState(0)
  const [anuncio, setAnuncio] = useState('')
  const [, redibujar] = useState(0)

  const todos = useMemo(() => ordenarTemas(catalogo?.temas ?? []), [catalogo])
  const predet = catalogo?.predeterminado ?? null
  const temaPredet = todos.find((t) => t.id === predet) ?? null

  useEffect(() => {
    if (focoSelector === 0) return
    zonaSelector.current?.querySelector<HTMLElement>('button[aria-haspopup="listbox"]')?.focus()
  }, [focoSelector])

  useEffect(() => {
    if (focoLista > 0) tituloLista.current?.focus()
  }, [focoLista])

  const pedirFoco = (id: string): void => setFoco((f) => ({ id, n: (f?.n ?? 0) + 1 }))

  function falloDeEscritura(reintentar: () => void): void {
    mostrarToast({
      tipo: 'error',
      mensaje: TEMA.toastError,
      accion: { etiqueta: TEMA.reintentar, alAccionar: reintentar }
    })
  }

  // ------------------------------------------------------------------ predeterminado

  function varianteDe(temaId: string | null): VarianteImpacto | null {
    const nuevo = todos.find((t) => t.id === temaId)
    if (temaId === null) return temaPredet ? { tipo: 'ninguno', anterior: temaPredet.nombre } : null
    if (!nuevo) return null
    return { tipo: 'predeterminado', nuevo: nuevo.nombre, anterior: temaPredet?.nombre ?? null }
  }

  function predeterminadoHecho(temaId: string | null): void {
    void recargar()
    const nombre = todos.find((t) => t.id === temaId)?.nombre ?? null
    mostrarToast({ tipo: 'exito', mensaje: AJT.toastPredet(nombre) })
    setFocoSelector((n) => n + 1)
  }

  async function cambiarPredeterminado(temaId: string | null): Promise<void> {
    if (soloLectura || temaId === predet) return
    const variante = varianteDe(temaId)
    if (!variante) return
    const op: OperacionTema = { tipo: 'predeterminado', temaId }
    try {
      // La autoridad sobre «hay canciones afectadas» es la previsualización.
      const impacto = await window.shinobi.temas.previsualizar(op)
      if (impacto.afectadas.length > 0) {
        setDialogo({ tipo: 'predeterminado', op, variante })
        return
      }
      try {
        await window.shinobi.temas.ejecutar(op, impacto.ficha)
      } catch (e) {
        if (codigoDe(e) === 'CONFIRMACION_OBSOLETA') {
          setDialogo({ tipo: 'predeterminado', op, variante })
          return
        }
        throw e
      }
      predeterminadoHecho(temaId)
    } catch {
      falloDeEscritura(() => void cambiarPredeterminado(temaId))
    }
  }

  // ------------------------------------------------------------------ acciones de fila

  async function renombrar(t: TemaCatalogo, nombre: string): Promise<void> {
    const nuevo = await window.shinobi.temas.renombrar({
      temaId: t.id,
      revisionTema: t.revision,
      nombre
    })
    setDialogo(null)
    void recargar()
    mostrarToast({ tipo: 'exito', mensaje: TEMA.toastRenombrado(nuevo.nombre) })
    pedirFoco(t.id)
  }

  async function duplicar(t: TemaCatalogo, nombre: string): Promise<void> {
    const nuevo = await window.shinobi.temas.duplicar({ temaId: t.id, nombre })
    setDialogo(null)
    await recargar()
    mostrarToast({ tipo: 'exito', mensaje: TEMA.toastCreado(nuevo.nombre) })
    pedirFoco(nuevo.id)
  }

  function abrirEliminar(t: TemaCatalogo, reanudar: boolean): void {
    const i = todos.findIndex((x) => x.id === t.id)
    const siguiente = todos[i + 1] ?? todos[i - 1] ?? null
    setDialogo({
      tipo: 'eliminar',
      tema: t,
      reanudar,
      eraPredeterminado: t.id === predet,
      siguienteId: siguiente?.id ?? null
    })
  }

  function eliminado(d: Extract<Dialogo, { tipo: 'eliminar' }>, convertidas: number): void {
    setDialogo(null)
    void recargar()
    mostrarToast({ tipo: 'exito', mensaje: TEMA.toastEliminado(d.tema.nombre, convertidas) })
    if (d.eraPredeterminado) setAnuncio(AJT.anuncioPredetBorrado)
    if (d.siguienteId) pedirFoco(d.siguienteId)
    else setFocoLista((n) => n + 1)
  }

  async function cancelarBorrado(t: TemaCatalogo): Promise<void> {
    const p = catalogo?.borradoPendiente
    const convertidas = p ? Math.max(p.total - p.restantes, 0) : 0
    try {
      await window.shinobi.temas.cancelarBorrado()
    } catch {
      falloDeEscritura(() => void cancelarBorrado(t))
      return
    }
    void recargar()
    mostrarToast({ tipo: 'exito', mensaje: TEMA.toastBorradoCancelado(t.nombre, convertidas) })
    pedirFoco(t.id)
  }

  // ------------------------------------------------------------------ avisos

  const apartado = catalogo?.apartado ?? null
  const verApartado = apartado !== null && apartado !== apartadoCerrado
  function cerrarApartado(): void {
    apartadoCerrado = apartado
    redibujar((n) => n + 1)
    titulo.current?.focus()
    // Si falla, sigue oculto en esta sesión y vuelve al reiniciar, sin toast.
    window.shinobi.temas.descartarAvisoApartado().catch(() => undefined)
  }

  // ------------------------------------------------------------------ presentación

  const faltantes = catalogo?.referenciasFaltantes ?? 0
  const usosPredet = catalogo?.predeterminadoUsos ?? 0
  const hayTemas = todos.length > 0

  let cuerpo
  if (cargando) {
    cuerpo = (
      <div aria-busy="true" aria-label={AJT.cargando} role="status" className={estilos.esqueletos}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${estilos.esqueletoFila} ${estilos.brillo}`} />
        ))}
      </div>
    )
  } else if (!catalogo) {
    cuerpo = (
      <AvisoEnLinea
        tipo="error"
        accion={<Boton onClick={() => void recargar()}>{TEMA.reintentar}</Boton>}
      >
        {AJT.errorCarga}
      </AvisoEnLinea>
    )
  } else {
    cuerpo = (
      <>
        <h3 className={estilos.subsubtitulo}>{AJT.predetTitulo}</h3>
        {hayTemas ? (
          <>
            <p id={idAyuda} className={estilos.suave}>
              {AJT.predetAyuda}
            </p>
            <div ref={zonaSelector}>
              <SelectorTema
                temas={ofrecibles}
                valor={predet}
                predeterminadoId={predet}
                etiqueta={AJT.selector}
                opcionInicial={{ texto: AJ_TEMAS.ninguno, posicion: 'ultimo' }}
                deshabilitado={soloLectura}
                descripcionId={`${idAyuda} ${idUsos}`}
                alElegir={(id) => void cambiarPredeterminado(id)}
              />
            </div>
            <p id={idUsos} className={estilos.suave}>
              {predet === null ? AJT.predetAzar : AJT.predetUsos(usosPredet)}
            </p>
          </>
        ) : (
          <p className={estilos.suave}>{AJT.vacioPredet}</p>
        )}

        <h3 ref={tituloLista} tabIndex={-1} className={estilos.subsubtitulo}>
          {AJT.listaTitulo(todos.length)}
        </h3>
        {hayTemas ? (
          <>
            <ListaTemas
              temas={todos}
              predeterminadoId={predet}
              soloLectura={soloLectura}
              borradoPendiente={catalogo.borradoPendiente}
              foco={foco}
              alUsarPredeterminado={(t) => void cambiarPredeterminado(t.id)}
              alRenombrar={(t) => setDialogo({ tipo: 'nombre', modo: 'renombrar', tema: t })}
              alDuplicar={(t) => setDialogo({ tipo: 'nombre', modo: 'duplicar', tema: t })}
              alEliminar={(t) => abrirEliminar(t, false)}
              alTerminarBorrado={(t) => abrirEliminar(t, true)}
              alCancelarBorrado={(t) => void cancelarBorrado(t)}
            />
            {faltantes > 0 && <AvisoEnLinea tipo="aviso">{AJT.faltan(faltantes)}</AvisoEnLinea>}
            <p className={estilos.nota3}>{AJT.editarNota}</p>
          </>
        ) : (
          <>
            <p className={estilos.suave}>{AJT.vacioLista}</p>
            {faltantes > 0 && <AvisoEnLinea tipo="aviso">{AJT.faltan(faltantes)}</AvisoEnLinea>}
          </>
        )}
      </>
    )
  }

  return (
    <div className={estilos.seccion} role="group" aria-labelledby="aj-temas-titulo">
      <h2
        id="aj-temas-titulo"
        ref={titulo}
        tabIndex={-1}
        data-foco-inicial={enfocarAlAbrir ? '' : undefined}
        className={estilos.subtitulo}
      >
        {AJT.titulo}
      </h2>

      {verApartado && (
        <AvisoEnLinea
          tipo="aviso"
          accion={
            <span className={estilos.accionesAviso}>
              <Boton onClick={() => void window.shinobi.sistema.abrirCarpetaDatos()}>
                {AJT.apartadoCarpeta}
              </Boton>
              <BotonIcono icono={X} etiqueta={AJT.apartadoCerrar} onClick={cerrarApartado} />
            </span>
          }
        >
          {AJT.apartado}
        </AvisoEnLinea>
      )}
      {soloLectura && <AvisoEnLinea tipo="aviso">{AJT.soloLectura}</AvisoEnLinea>}

      {cuerpo}

      <p role="status" className={comunes.soloLector}>
        {anuncio}
      </p>

      {dialogo?.tipo === 'predeterminado' && (
        <DialogoImpactoTema
          abierto
          variante={dialogo.variante}
          op={dialogo.op}
          onCancelar={() => {
            setDialogo(null)
            setFocoSelector((n) => n + 1)
          }}
          onHecho={() => {
            setDialogo(null)
            predeterminadoHecho(dialogo.op.tipo === 'predeterminado' ? dialogo.op.temaId : null)
          }}
          onError={() => {
            setDialogo(null)
            falloDeEscritura(
              () =>
                void cambiarPredeterminado(
                  dialogo.op.tipo === 'predeterminado' ? dialogo.op.temaId : null
                )
            )
          }}
        />
      )}

      {dialogo?.tipo === 'nombre' && (
        <DialogoNombreTema
          abierto
          modo={dialogo.modo}
          propuesta={
            dialogo.modo === 'duplicar'
              ? TEMA.nombre.copia(dialogo.tema.nombre)
              : dialogo.tema.nombre
          }
          existentes={todos}
          excluirId={dialogo.modo === 'renombrar' ? dialogo.tema.id : undefined}
          ayuda={
            dialogo.modo === 'duplicar' ? TEMA.nombre.ayudaDuplicar(dialogo.tema.nombre) : undefined
          }
          onCancelar={() => {
            setDialogo(null)
            pedirFoco(dialogo.tema.id)
          }}
          onConfirmar={(nombre) =>
            dialogo.modo === 'renombrar'
              ? renombrar(dialogo.tema, nombre)
              : duplicar(dialogo.tema, nombre)
          }
          onError={() => {
            const previo = dialogo
            setDialogo(null)
            falloDeEscritura(() => setDialogo(previo))
          }}
        />
      )}

      {dialogo?.tipo === 'eliminar' && (
        <DialogoEliminarTema
          abierto
          temaId={dialogo.tema.id}
          temaNombre={dialogo.tema.nombre}
          reanudar={dialogo.reanudar}
          onCancelar={() => {
            setDialogo(null)
            pedirFoco(dialogo.tema.id)
          }}
          onEliminado={(_r, convertidas) => eliminado(dialogo, convertidas)}
          onBorradoCancelado={(convertidas) => {
            setDialogo(null)
            void recargar()
            mostrarToast({
              tipo: 'exito',
              mensaje: TEMA.toastBorradoCancelado(dialogo.tema.nombre, convertidas)
            })
            pedirFoco(dialogo.tema.id)
          }}
          onError={() => {
            const previo = dialogo
            setDialogo(null)
            falloDeEscritura(() => setDialogo(previo))
          }}
        />
      )}
    </div>
  )
}
