import { useCallback, useEffect, useRef, useState, type ActionDispatch } from 'react'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { mostrarToast } from '../../componentes/gestorToasts'
import { registrarBorradorAlCerrar } from '../../navegacion/salida'
import { DialogoImpactoTema } from '../../temas/DialogoImpactoTema'
import { TEMA } from '../../temas/textos'
import { borradorModificado, type AccionEditor, type BorradorTema } from './estado'
import type { DestinoFocoTema } from './SeccionTema'
import { E } from './textos'

type Dialogos = 'impacto' | 'descartar' | 'salir' | null

interface Opciones {
  /** Borrador en memoria (vive en el estado del editor, con su historial). */
  borrador: BorradorTema | null
  despachar: ActionDispatch<[AccionEditor]>
  anunciar(texto: string): void
  /** Vuelve a leer el resumen vivo de la canción (tras escribir el tema). */
  refrescarResumen(): Promise<void>
  alFoco(destino: DestinoFocoTema): void
  /** «Guardar como tema nuevo…» desde el borrador (lo abre el panel). */
  alGuardarNuevo(): void
}

/**
 * D3 (0171): flujo del borrador de tema. El borrador y sus pasos de deshacer viven en el reducer; aquí
 * están los diálogos (guardar con impacto, descartar, salir) y la guarda de salida y de cierre.
 */
export function useBorradorTema({
  borrador,
  despachar,
  anunciar,
  refrescarResumen,
  alFoco,
  alGuardarNuevo
}: Opciones) {
  const [dialogo, setDialogo] = useState<Dialogos>(null)
  const salida = useRef<((salir: boolean) => void) | null>(null)
  const modificado = borradorModificado(borrador)
  const enSalida = useRef(false)
  const hayCambios = useRef(false)
  useEffect(() => {
    hayCambios.current = modificado
  }, [modificado])

  const resolverSalida = useCallback((salir: boolean) => {
    const fin = salida.current
    salida.current = null
    enSalida.current = false
    fin?.(salir)
  }, [])

  const pedirSalida = useCallback((): Promise<boolean> => {
    if (!hayCambios.current) return Promise.resolve(true)
    if (salida.current) return new Promise<boolean>(() => undefined)
    return new Promise<boolean>((resolver) => {
      salida.current = resolver
      enSalida.current = true
      setDialogo('salir')
    })
  }, [])

  // Cerrar la ventana con cambios en el borrador usa el mismo diálogo (ADR 0016 §10).
  useEffect(() => registrarBorradorAlCerrar(pedirSalida), [pedirSalida])
  useEffect(
    () => () => {
      salida.current?.(false)
      salida.current = null
    },
    []
  )

  function salirDeD3(): void {
    despachar({ tipo: 'salir_borrador' })
  }

  function mostrarErrorGuardado(err: unknown): void {
    const e = err as { codigo?: string; mensaje?: string } | null
    mostrarToast({
      tipo: 'error',
      mensaje: TEMA.toastError,
      accion: { etiqueta: TEMA.reintentar, alAccionar: () => setDialogo('impacto') },
      accionSecundaria: {
        etiqueta: TEMA.copiarDetalles,
        alAccionar: () =>
          void navigator.clipboard
            ?.writeText(`${e?.codigo ?? 'ERROR_INTERNO'}: ${e?.mensaje ?? ''}`)
            .catch(() => undefined)
      }
    })
  }

  function entrar(tema: {
    id: string
    nombre: string
    revision: number
    estilo: BorradorTema['estilo']
  }) {
    despachar({
      tipo: 'entrar_borrador',
      borrador: {
        temaId: tema.id,
        nombre: tema.nombre,
        revision: tema.revision,
        base: tema.estilo,
        estilo: tema.estilo
      }
    })
    anunciar(E.tema.anuncioEditando(tema.nombre))
    alFoco('banner')
  }

  function descartar(): void {
    if (!borrador) return
    if (modificado) setDialogo('descartar')
    else terminarDescarte()
  }

  function terminarDescarte(): void {
    salirDeD3()
    setDialogo(null)
    anunciar(E.tema.anuncioSaleDeEditar)
    alFoco('editar')
  }

  const abierto = dialogo !== null && borrador !== null

  const dialogos = (
    <>
      {abierto && dialogo === 'impacto' && borrador && (
        <DialogoImpactoTema
          abierto
          variante={{ tipo: 'guardar', tema: borrador.nombre, incluidaEsta: true }}
          op={{
            tipo: 'editar',
            temaId: borrador.temaId,
            revisionTema: borrador.revision,
            estilo: borrador.estilo
          }}
          onCancelar={() => setDialogo(enSalida.current ? 'salir' : null)}
          onGuardarNuevo={() => {
            setDialogo(null)
            if (enSalida.current) resolverSalida(false)
            alGuardarNuevo()
          }}
          onError={(err) => {
            setDialogo(null)
            if (enSalida.current) resolverSalida(false)
            mostrarErrorGuardado(err)
          }}
          onHecho={() => {
            const nombre = borrador.nombre
            const desdeSalida = enSalida.current
            void refrescarResumen().finally(() => {
              salirDeD3()
              setDialogo(null)
              mostrarToast({ tipo: 'exito', mensaje: TEMA.toastGuardado(nombre) })
              anunciar(TEMA.toastGuardado(nombre))
              if (desdeSalida) resolverSalida(true)
              else alFoco('editar')
            })
          }}
        />
      )}
      {abierto && dialogo === 'descartar' && borrador && (
        <Dialogo
          abierto
          titulo={E.tema.dialogoDescartar.titulo}
          enfoqueInicial="[data-seguir]"
          onCancelar={() => setDialogo(null)}
          acciones={
            <>
              <Boton data-seguir onClick={() => setDialogo(null)}>
                {E.tema.dialogoDescartar.seguir}
              </Boton>
              <Boton variante="destructivo" onClick={terminarDescarte}>
                {E.tema.dialogoDescartar.descartar}
              </Boton>
            </>
          }
        >
          <p>{E.tema.dialogoDescartar.cuerpo(borrador.nombre)}</p>
        </Dialogo>
      )}
      {abierto && dialogo === 'salir' && borrador && (
        <Dialogo
          abierto
          titulo={E.tema.dialogoSalir.titulo(borrador.nombre)}
          enfoqueInicial="[data-seguir]"
          onCancelar={() => {
            setDialogo(null)
            resolverSalida(false)
          }}
          acciones={
            <>
              <Boton
                data-seguir
                onClick={() => {
                  setDialogo(null)
                  resolverSalida(false)
                }}
              >
                {E.tema.dialogoSalir.seguir}
              </Boton>
              <Boton
                variante="destructivo"
                onClick={() => {
                  setDialogo(null)
                  resolverSalida(true)
                }}
              >
                {E.tema.dialogoSalir.descartar}
              </Boton>
              <Boton variante="primario" onClick={() => setDialogo('impacto')}>
                {E.tema.dialogoSalir.guardar}
              </Boton>
            </>
          }
        >
          <p>{E.tema.dialogoSalir.cuerpo}</p>
        </Dialogo>
      )}
    </>
  )

  return {
    modificado,
    pedirSalida,
    entrar,
    guardarEn: () => setDialogo('impacto'),
    descartar,
    salir: salirDeD3,
    dialogos
  }
}
