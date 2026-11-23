import { useCallback, useEffect, useId, useMemo, useRef, useState, type Ref } from 'react'
import {
  Check,
  CircleHelp,
  Clock,
  Info,
  LoaderCircle,
  MoveHorizontal,
  TriangleAlert,
  X
} from 'lucide-react'
import {
  MIN_LINEAS_ENCAJE,
  corregirDesfase,
  evaluarEncajeConPicos,
  quitarCorreccion
} from '@shared/encaje'
import { contarLineas, type Letra } from '@shared/letra'
import { aplicarTextoEditado, letraATexto } from '@shared/letras'
import type { ErrorIpc, ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { AreaTexto } from '../../componentes/Campos'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import {
  detalleNoCoincide,
  deVeredicto,
  motivosNoCoincide,
  sinPicos,
  type Comprobacion
} from './comprobacion'
import { hayMarcasDeTiempo, huella, sincroniaActual, tieneLineas } from './modeloElegida'
import { TEXTO } from './textos'
import { textoSuperaLimites } from './limiteTexto'
import { TEXTO_IMPORTAR } from './textosPegar'
import { TEXTO_ELEGIDA as T } from './textosElegida'
import { CC, segundosDe } from './textosComprobacion'
import { FilaConIcono } from './FilaConIcono'
import { usePicosBase } from './usePicosLetra'
import { escribirDesfaseGuardado } from './escribirDesfase'
import { copiarDetalles } from '../../soporte/detalles'
import estilosComponentes from '../../componentes/componentes.module.css'
import estilos from './letra.module.css'

const URL_LRCLIB = 'https://lrclib.net'
/** Espera sin escribir antes de guardar (docs/ux/05, "Edición en C"). */
const ESPERA_MS = 1000

interface Props {
  cancionId: string
  /** Letra guardada al entrar (siempre con ≥ 1 línea en la primera carga). */
  letraInicial: Letra
  estado: ResumenCancionIpc['estado']
  fuenteLista: boolean
  esperandoFuente: boolean
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
  /** La separación terminó: sin ella no hay picos que comparar (comprobación con la voz). */
  separada?: boolean
  /** Duración de la canción; 0 = desconocida (no se comprueba). */
  duracionMs?: number
}

/** Comprobación de la letra guardada contra la voz (spec 05, «Cuándo se comprueba»: en C, al entrar y tras cada autoguardado). */
function useComprobacionGuardada(
  cancionId: string,
  letra: Letra,
  duracionMs: number,
  separada: boolean
): { comprobacion: Comprobacion; motivos: string[] } {
  const comprobable =
    duracionMs > 0 &&
    letra.lineas.filter((l) => l.tipo === 'linea' && l.inicio_ms !== null).length >=
      MIN_LINEAS_ENCAJE
  const picos = usePicosBase(cancionId, duracionMs, comprobable, separada)
  return useMemo(() => {
    const ninguna = { comprobacion: { tipo: 'ninguna' } as Comprobacion, motivos: [] }
    if (!comprobable) return ninguna
    if (picos === null) return { ...ninguna, comprobacion: { tipo: 'comprobando' } }
    if (picos.estado !== 'lista')
      return { ...ninguna, comprobacion: sinPicos(picos.estado, separada) ?? ninguna.comprobacion }
    const r = evaluarEncajeConPicos(letra, picos, { duracionMs })
    return {
      comprobacion: deVeredicto(r.veredicto, r.desfaseMs, r.limitacion),
      motivos:
        r.veredicto === 'no_coincide'
          ? motivosNoCoincide(detalleNoCoincide(letra, r, duracionMs))
          : []
    }
  }, [comprobable, picos, letra, duracionMs, separada])
}

/** Wireframe C de docs/ux/05: letra elegida, edición con autoguardado y salidas. */
export function LetraElegida({
  cancionId,
  letraInicial,
  estado,
  fuenteLista,
  esperandoFuente,
  ignoradas,
  onCerrarIgnoradas,
  onResumen,
  onOtra,
  onImportar,
  onIrAlEditor,
  refEditor,
  separada = false,
  duracionMs = 0
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

  // «Corregir el desfase» y «Quitar la corrección» (spec 05): escriben `offset_ms` y
  // `desfase_corregido_ms` con la misma escritura que el editor; ningún tiempo de línea cambia.
  const [anuncio, setAnuncio] = useState('')
  const [errorCorregir, setErrorCorregir] = useState<Partial<ErrorIpc> | null>(null)
  const [verPorQue, setVerPorQue] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const idPorQue = useId()
  const refBotonComp = useRef<HTMLButtonElement>(null)
  const { comprobacion, motivos } = useComprobacionGuardada(cancionId, letra, duracionMs, separada)

  const moverLetra = async (
    calcular: (l: Letra) => Pick<Letra, 'offset_ms' | 'desfase_corregido_ms'>,
    mensaje: (nueva: Letra) => string
  ): Promise<void> => {
    if (ocupado) return
    setOcupado(true)
    setErrorCorregir(null)
    // Lo pendiente del texto se guarda primero para que la escritura vea la letra vigente.
    await guardar()
    try {
      const { resumen, letra: local } = await escribirDesfaseGuardado(cancionId, calcular)
      if (!montado.current) return
      refLetra.current = local
      setLetra(local)
      onResumenRef.current(resumen)
      setAnuncio(mensaje(local))
      window.setTimeout(() => refBotonComp.current?.focus())
    } catch (e) {
      if (montado.current) setErrorCorregir(e as ErrorIpc)
    } finally {
      if (montado.current) setOcupado(false)
    }
  }
  const corregir = (d: number): Promise<void> =>
    moverLetra(
      (l) => corregirDesfase(l, d),
      (n) =>
        CC.anuncio.corregida(
          segundosDe(n.desfase_corregido_ms ?? d),
          (n.desfase_corregido_ms ?? d) > 0
        )
    )
  const quitar = (): Promise<void> => moverLetra(quitarCorreccion, () => CC.anuncio.quitada)

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

      {!vacia && (
        <LineaComprobacionActual
          letra={letra}
          comprobacion={comprobacion}
          motivos={motivos}
          idPorQue={idPorQue}
          verPorQue={verPorQue}
          ocupado={ocupado}
          refBoton={refBotonComp}
          onCorregir={(d) => void corregir(d)}
          onQuitar={() => void quitar()}
          onPorQue={() => setVerPorQue((v) => !v)}
          onOtra={onOtra}
        />
      )}
      {errorCorregir && (
        <AvisoEnLinea
          tipo="error"
          accion={
            <Boton
              variante="secundario"
              onClick={() =>
                void copiarDetalles(
                  [errorCorregir.codigo, errorCorregir.mensaje, errorCorregir.detalles]
                    .filter(Boolean)
                    .join('\n')
                ).catch(() => undefined)
              }
            >
              {CC.copiarDetalles}
            </Boton>
          }
        >
          {CC.errorGuardar}
        </AvisoEnLinea>
      )}
      <p className={estilos.soloLector} role="status">
        {anuncio}
      </p>

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
      {!vacia && esperandoFuente && (
        <p className={estilos.esperando} role="status">
          <Icono icono={LoaderCircle} className={estilosComponentes.girando} />
          {T.esperandoAudio}
        </p>
      )}

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
          noDisponible={
            vacia
              ? T.editorInactivo
              : !fuenteLista
                ? esperandoFuente
                  ? T.editorEsperando
                  : T.editorAudioNoListo
                : undefined
          }
          onClick={onIrAlEditor}
        >
          {T.editor}
        </Boton>
      </div>
    </div>
  )
}

interface PropsLinea {
  letra: Letra
  comprobacion: Comprobacion
  motivos: string[]
  idPorQue: string
  verPorQue: boolean
  ocupado: boolean
  refBoton: Ref<HTMLButtonElement>
  onCorregir(desfaseMs: number): void
  onQuitar(): void
  onPorQue(): void
  onOtra(): void
}

/** Línea de comprobación de la letra elegida (wireframe C de la feature 4, `let.comp.actual.*`). */
function LineaComprobacionActual({
  letra,
  comprobacion,
  motivos,
  idPorQue,
  verPorQue,
  ocupado,
  refBoton,
  onCorregir,
  onQuitar,
  onPorQue,
  onOtra
}: PropsLinea) {
  const corregidaMs = letra.desfase_corregido_ms ?? 0
  const noCoincide = comprobacion.tipo === 'noCoincide'
  // Con la corrección hecha y que no deje de coincidir, C recuerda lo que se movió.
  if (corregidaMs !== 0 && !noCoincide) {
    return (
      <div className={estilos.lineaComp}>
        <p>
          <FilaConIcono icono={Info}>
            {CC.actual.corregida(segundosDe(corregidaMs), corregidaMs > 0)}
          </FilaConIcono>
        </p>
        <div className={estilos.lineaCompFila}>
          <Boton ref={refBoton} variante="fantasma" disabled={ocupado} onClick={onQuitar}>
            {CC.boton.quitar}
          </Boton>
        </div>
      </div>
    )
  }
  switch (comprobacion.tipo) {
    case 'ninguna':
      return null
    case 'comprobando':
    case 'pendiente':
    case 'noDisponible':
      return (
        <p className={estilos.compTenue}>
          <FilaConIcono icono={comprobacion.tipo === 'noDisponible' ? Info : Clock}>
            {comprobacion.tipo === 'comprobando'
              ? CC.comprobando
              : comprobacion.tipo === 'pendiente'
                ? CC.actual.pendiente
                : CC.noDisponible}
          </FilaConIcono>
        </p>
      )
    case 'coincide':
      return (
        <p>
          <FilaConIcono icono={Check}>{CC.actual.coincide}</FilaConIcono>
        </p>
      )
    case 'dudosa':
      // Con limitación es información, no un aviso: en gris, sin acciones (spec 05, F4).
      return (
        <p className={comprobacion.limitacion ? estilos.compTenue : undefined}>
          <FilaConIcono icono={CircleHelp}>
            {comprobacion.limitacion
              ? CC.actual.limitada(comprobacion.limitacion)
              : CC.actual.dudosa}
          </FilaConIcono>
        </p>
      )
    case 'desfasada':
      return (
        <div className={estilos.lineaComp}>
          <p>
            <FilaConIcono icono={MoveHorizontal}>
              {comprobacion.desfaseMs > 0
                ? CC.actual.adelantada(segundosDe(comprobacion.desfaseMs))
                : CC.actual.atrasada(segundosDe(comprobacion.desfaseMs))}
            </FilaConIcono>
          </p>
          <div className={estilos.lineaCompFila}>
            <Boton
              ref={refBoton}
              variante="secundario"
              disabled={ocupado}
              onClick={() => onCorregir(comprobacion.desfaseMs)}
            >
              {CC.boton.corregir}
            </Boton>
          </div>
        </div>
      )
    case 'noCoincide':
      return (
        <div className={estilos.lineaComp}>
          <p>
            <FilaConIcono icono={TriangleAlert} className={estilos.compAviso}>
              {CC.actual.noCoincide}
            </FilaConIcono>
          </p>
          <div className={estilos.lineaCompFila}>
            <Boton
              variante="fantasma"
              aria-expanded={verPorQue}
              aria-controls={idPorQue}
              onClick={onPorQue}
            >
              {CC.boton.porque}
            </Boton>
            <Boton variante="fantasma" onClick={onOtra}>
              {T.otra}
            </Boton>
          </div>
          {verPorQue && (
            <div id={idPorQue}>
              {motivos.length > 0 && (
                <ul>
                  {motivos.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              <p>{CC.noCoincideAyuda}</p>
            </div>
          )}
        </div>
      )
  }
}
