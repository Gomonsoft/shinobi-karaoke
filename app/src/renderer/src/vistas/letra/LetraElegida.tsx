import { useCallback, useEffect, useRef, useState, type Ref } from 'react'
import { X } from 'lucide-react'
import { contarLineas, type Letra } from '@shared/letra'
import { aplicarTextoEditado, letraATexto } from '@shared/letras'
import type { ErrorIpc, ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { AreaTexto } from '../../componentes/Campos'
import { mostrarToast } from '../../componentes/gestorToasts'
import { hayMarcasDeTiempo, huella, sincroniaActual, tieneLineas } from './modeloElegida'
import { TEXTO } from './textos'
import { textoSuperaLimites } from './limiteTexto'
import { TEXTO_IMPORTAR } from './textosPegar'
import { TEXTO_ELEGIDA as T } from './textosElegida'
import estilos from './letra.module.css'

const URL_LRCLIB = 'https://lrclib.net'
/** Espera sin escribir antes de guardar (docs/ux/05, "Edición en C"). */
const ESPERA_MS = 1000

interface Props {
  cancionId: string
  /** Letra guardada al entrar (siempre con ≥ 1 línea en la primera carga). */
  letraInicial: Letra
  estado: ResumenCancionIpc['estado']
  /** Renglones sin tiempo ignorados al importar (0085); 0 = sin aviso. */
  ignoradas: number
  onCerrarIgnoradas: () => void
  /** Resumen devuelto por cada guardado, para refrescar la cabecera. */
  onResumen: (resumen: ResumenCancionIpc) => void
  onOtra: () => void
  onImportar?: () => void
  onIrAlEditor: () => void
  /** Ref del botón "Ir al editor" (foco tras elegir una letra). */
  refEditor?: Ref<HTMLButtonElement>
}

/** Wireframe C de docs/ux/05: letra elegida, edición con autoguardado y salidas. */
export function LetraElegida({
  cancionId,
  letraInicial,
  estado,
  ignoradas,
  onCerrarIgnoradas,
  onResumen,
  onOtra,
  onImportar,
  onIrAlEditor,
  refEditor
}: Props) {
  const [letra, setLetra] = useState<Letra>(letraInicial)
  const [texto, setTexto] = useState(() => letraATexto(letraInicial))
  const [errorLista, setErrorLista] = useState(false)
  const [demasiadoLarga, setDemasiadoLarga] = useState(false)
  const limite = useRef(false)
  const refArea = useRef<HTMLTextAreaElement>(null)
  const refTexto = useRef(texto)
  // Último texto que el main ya tiene (o está recibiendo); `refTexto` ≠ esto = cambios pendientes.
  const guardado = useRef(texto)
  const refLetra = useRef(letra)
  const refEstado = useRef(estado)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(true)
  const onResumenRef = useRef(onResumen)
  useEffect(() => {
    refLetra.current = letra
    refEstado.current = estado
    onResumenRef.current = onResumen
  })

  const guardar = useCallback(async (): Promise<void> => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
    const enviado = refTexto.current
    if (enviado === guardado.current || limite.current) return
    const previo = guardado.current
    guardado.current = enviado
    try {
      const resumen = await window.shinobi.letras.editarTexto({ cancionId, texto: enviado })
      if (!montado.current) return
      const nueva = aplicarTextoEditado(refLetra.current, enviado)
      refLetra.current = nueva
      setLetra(nueva)
      setErrorLista(false)
      onResumenRef.current(resumen)
    } catch (e) {
      if (guardado.current === enviado) guardado.current = previo
      if (!montado.current) return
      const error = e as Partial<ErrorIpc> | null
      if (
        error?.codigo === 'ARGUMENTOS_NO_VALIDOS' &&
        /demasiado (?:largo|grande)|supera|m[aá]s de \d+ (?:KB|elementos|renglones)/i.test(
          error.mensaje ?? ''
        )
      ) {
        if (refTexto.current === enviado) {
          limite.current = true
          setDemasiadoLarga(true)
        }
      } else if (!tieneLineas(enviado) && refEstado.current === 'lista') setErrorLista(true)
      else mostrarToast({ tipo: 'error', mensaje: TEXTO.errorGuardar })
    }
  }, [cancionId])

  // Al desmontar, se guarda lo pendiente; sin esperar ni tocar el estado.
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      if (temporizador.current) clearTimeout(temporizador.current)
      if (refTexto.current !== guardado.current && !limite.current) {
        void window.shinobi.letras
          .editarTexto({ cancionId, texto: refTexto.current })
          .catch(() => undefined)
      }
    }
  }, [cancionId])

  // Una letra distinta llegada de fuera (p. ej. al sustituirla) se recarga si no hay nada en juego.
  useEffect(() => {
    let activo = true
    const baja = window.shinobi.alCambiarCancion((ev) => {
      if (ev.id !== cancionId || ev.eliminada) return
      if (document.activeElement === refArea.current) return
      if (refTexto.current !== guardado.current) return
      void window.shinobi.biblioteca.obtener(cancionId).then(
        (c) => {
          if (!activo || !c?.letra) return
          if (document.activeElement === refArea.current) return
          if (refTexto.current !== guardado.current) return
          if (huella(c.letra) === huella(refLetra.current)) return
          const nuevo = letraATexto(c.letra)
          refTexto.current = nuevo
          guardado.current = nuevo
          refLetra.current = c.letra
          setLetra(c.letra)
          setTexto(nuevo)
          setErrorLista(false)
        },
        () => undefined
      )
    })
    return () => {
      activo = false
      baja()
    }
  }, [cancionId])

  const alEscribir = (valor: string): void => {
    refTexto.current = valor
    setTexto(valor)
    limite.current = textoSuperaLimites(valor)
    setDemasiadoLarga(limite.current)
    if (errorLista && tieneLineas(valor)) setErrorLista(false)
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = limite.current ? null : setTimeout(() => void guardar(), ESPERA_MS)
  }

  const n = contarLineas(letra)
  const vacia = n === 0
  return (
    <div className={estilos.elegida}>
      {vacia ? (
        <p>{T.vacia}</p>
      ) : (
        <div>
          <p>{T.actual(T.origen[letra.origen], T.sync[sincroniaActual(letra.lineas)], n)}</p>
          {letra.origen === 'lrclib' && (
            <a
              className={estilos.atribucion}
              href={URL_LRCLIB}
              onClick={(e) => {
                e.preventDefault()
                void window.shinobi.sistema.abrirEnlace(URL_LRCLIB)
              }}
            >
              {TEXTO.atribucion}
            </a>
          )}
        </div>
      )}

      {ignoradas > 0 && (
        <AvisoEnLinea
          tipo="info"
          accion={<BotonIcono icono={X} etiqueta={T.cerrarAviso} onClick={onCerrarIgnoradas} />}
        >
          {TEXTO_IMPORTAR.ignoradas(ignoradas)}
        </AvisoEnLinea>
      )}

      <AreaTexto
        ref={refArea}
        etiqueta={T.etiquetaArea}
        value={texto}
        onChange={(e) => alEscribir(e.target.value)}
        onBlur={() => void guardar()}
        rows={14}
        spellCheck={false}
      />

      {demasiadoLarga && <AvisoEnLinea tipo="error">{T.demasiadoLarga}</AvisoEnLinea>}
      {errorLista && <AvisoEnLinea tipo="aviso">{T.errorListaSinLineas}</AvisoEnLinea>}
      {hayMarcasDeTiempo(texto) && <AvisoEnLinea tipo="info">{T.marcas}</AvisoEnLinea>}
      <AvisoEnLinea tipo="info">{T.aviso}</AvisoEnLinea>

      <div className={estilos.alternativa}>
        <Boton variante="secundario" onClick={onOtra}>
          {T.otra}
        </Boton>
        <Boton variante="secundario" onClick={onImportar}>
          {T.importar}
        </Boton>
        <span className={estilos.espacio} />
        <Boton
          ref={refEditor}
          variante="primario"
          data-foco-inicial
          noDisponible={vacia ? T.editorInactivo : undefined}
          onClick={onIrAlEditor}
        >
          {T.editor}
        </Boton>
      </div>
    </div>
  )
}
