import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ElementoLetra } from '@shared/letra'
import { contarLineas } from '@shared/letra'
import type { ResumenCancionIpc } from '@shared/ipc'
import { esLrc, lrcALetra, textoPlanoALetra } from '@shared/letras'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { AreaTexto } from '../../componentes/Campos'
import { mostrarToast } from '../../componentes/gestorToasts'
import type { ConfirmarSustituir } from './sustituir'
import { TEXTO } from './textos'
import { TEXTO_PEGAR } from './textosPegar'
import estilos from './letra.module.css'

interface Conversion {
  lineas: ElementoLetra[]
  esLrc: boolean
  ignoradas: number
  demasiado: boolean
}

/** Toda la conversión es del renderer (preguntas/0023 §1): LRC con tiempos o texto plano. */
function convertir(texto: string): Conversion {
  try {
    const generarId = (): string => crypto.randomUUID()
    if (esLrc(texto)) {
      const { lineas, ignoradas } = lrcALetra(texto, generarId)
      return { lineas, esLrc: true, ignoradas, demasiado: false }
    }
    return {
      lineas: textoPlanoALetra(texto, generarId),
      esLrc: false,
      ignoradas: 0,
      demasiado: false
    }
  } catch {
    return { lineas: [], esLrc: false, ignoradas: 0, demasiado: true }
  }
}

interface Props {
  cancionId: string
  /** El texto vive en la vista Letra para conservarse al ir a A y volver. */
  texto: string
  onTexto: (texto: string) => void
  confirmar: ConfirmarSustituir
  onVolver: () => void
  onImportar: () => void
  onUsada: (resumen: ResumenCancionIpc, lineas: ElementoLetra[]) => void
}

/** Wireframe B de docs/ux/05: pegar la letra. */
export function PegarLetra({
  cancionId,
  texto,
  onTexto,
  confirmar,
  onVolver,
  onImportar,
  onUsada
}: Props) {
  const [guardando, setGuardando] = useState(false)
  const refArea = useRef<HTMLTextAreaElement>(null)
  const diferido = useDeferredValue(texto)
  const previa = useMemo(() => convertir(diferido), [diferido])
  const n = contarLineas({ lineas: previa.lineas })

  useEffect(() => {
    refArea.current?.focus()
  }, [])

  const usar = async (): Promise<void> => {
    if (guardando) return
    const actual = convertir(texto)
    if (contarLineas({ lineas: actual.lineas }) < 1) return
    if (!(await confirmar())) return
    setGuardando(true)
    try {
      const resumen = await window.shinobi.letras.guardar({
        cancionId,
        origen: 'manual',
        lrclib_id: null,
        lineas: actual.lineas
      })
      onUsada(resumen, actual.lineas)
    } catch {
      setGuardando(false)
      mostrarToast({ tipo: 'error', mensaje: TEXTO.errorGuardar })
    }
  }

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void usar()
    }
  }

  return (
    // Ctrl/Cmd+Intro vale en toda la vista (spec 05, teclado).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={estilos.busqueda} onKeyDown={alTeclear}>
      <h2 className={estilos.subtitulo}>{TEXTO_PEGAR.titulo}</h2>
      <p>{TEXTO_PEGAR.ayuda}</p>
      <AreaTexto
        ref={refArea}
        etiqueta={TEXTO_PEGAR.etiquetaArea}
        value={texto}
        spellCheck={false}
        data-foco-inicial
        onChange={(e) => onTexto(e.target.value)}
      />
      <p role="status" className={estilos.total}>
        {TEXTO_PEGAR.contador(n)}
      </p>
      {previa.demasiado && <AvisoEnLinea tipo="error">{TEXTO_PEGAR.demasiado}</AvisoEnLinea>}
      {previa.esLrc && <AvisoEnLinea tipo="info">{TEXTO_PEGAR.lrc}</AvisoEnLinea>}
      {previa.esLrc && previa.ignoradas > 0 && (
        <AvisoEnLinea tipo="info">{TEXTO_PEGAR.ignoradas(previa.ignoradas)}</AvisoEnLinea>
      )}
      <div className={estilos.alternativa}>
        <Boton variante="fantasma" onClick={onVolver}>
          {TEXTO_PEGAR.volver}
        </Boton>
        <Boton variante="secundario" onClick={onImportar}>
          {TEXTO.importar}
        </Boton>
        <span className={estilos.espacio} />
        <Boton
          variante="primario"
          disabled={n < 1}
          cargando={guardando}
          textoCargando={TEXTO.usando}
          onClick={() => void usar()}
        >
          {TEXTO.usar}
        </Boton>
      </div>
    </div>
  )
}
