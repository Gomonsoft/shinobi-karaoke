import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref
} from 'react'
import { ArrowLeftRight, Info, TriangleAlert } from 'lucide-react'
import { claveFlexible, claveTexto } from '@shared/identidad'
import type { CampoPropuesto, PropuestaDatos, ValoresDatosIpc } from '@shared/ipc'
import { Boton } from '../../componentes/Boton'
import { CampoTexto } from '../../componentes/Campos'
import { Icono } from '../../componentes/Icono'
import { CampoCombo, type OpcionCombo } from './CampoCombo'
import { ORIGEN_DATO, TEXTO } from './textos'
import estilos from './anadir.module.css'

export interface ValoresDatos {
  titulo: string
  artista: string
  album: string
}

/** Espera tras la última tecla antes de proponer unificar con un valor de la biblioteca. */
export const RETRASO_UNIFICAR_MS = 400

/** Máximo de caracteres de título, artista y álbum. */
export const MAX_METADATO = 200

type Campo = keyof ValoresDatos

const SIN_VALORES: ValoresDatosIpc = { artistas: [], albumes: [] }

/** Artistas y álbumes de la biblioteca (sale del índice en memoria); sin ellos, sin autocompletado. */
function useValoresBiblioteca(): ValoresDatosIpc {
  const [valores, setValores] = useState<ValoresDatosIpc>(SIN_VALORES)
  useEffect(() => {
    let activo = true
    Promise.resolve()
      .then(() => window.shinobi.biblioteca.valoresDatos())
      .then((v) => activo && setValores(v))
      .catch(() => undefined)
    return () => {
      activo = false
    }
  }, [])
  return valores
}

/** El valor existente que solo se diferencia en tildes, puntuación, comillas, guiones o espacios. */
export function sugerenciaDeUnificar(
  escrito: string,
  existentes: { valor: string }[]
): string | null {
  const k = claveFlexible(escrito)
  const t = claveTexto(escrito)
  if (k === null || t === null) return null
  const mismoGrupo = existentes.some((e) => claveTexto(e.valor) === t)
  if (mismoGrupo) return null
  return existentes.find((e) => claveFlexible(e.valor) === k)?.valor ?? null
}

/** Lo que LRCLIB dejó en la canción (spec 03 · F6-N7), para el resumen del paso 1 y «Editar datos». */
export interface DatosLrclib {
  /** El álbum lo rellenó LRCLIB (`metadatos.origen.album === 'lrclib'`): `add.dato.origen.lrclib` con [Quitar]. */
  albumDeLrclib: boolean
  /** Título y artista del registro de LRCLIB (`letra.datos_lrclib`), si la canción tiene letra de allí. */
  registro: { titulo: string; artista: string } | null
}

interface CamposDatosProps {
  valores: ValoresDatos
  onCambio: (valores: ValoresDatos) => void
  errorTitulo?: string
  refTitulo?: Ref<HTMLInputElement>
  /** `id` del campo Título (para el enfoque inicial de un diálogo). */
  idTitulo?: string
  /** Etiquetas de Título y Álbum si no son las de siempre («Editar datos» las tiene propias). */
  etiquetaTitulo?: string
  etiquetaAlbum?: string
  /** Al salir de un campo (autoguardado del resumen). */
  onSalir?: () => void
  /** Intro en el último campo (Álbum). En los demás, Intro pasa al campo siguiente. */
  onIntroUltimo?: () => void
  /** Procedencia de los valores iniciales (solo al añadir la canción; «Editar datos» no la lleva). */
  propuesta?: PropuestaDatos | null
  /** Datos de LRCLIB de una canción que ya existe: procedencia del álbum y sugerencia de título y artista. */
  lrclib?: DatosLrclib | null
  /** Tras [Quitar] o [Usar estos datos]: los valores nuevos (el resumen los guarda en el acto). */
  onAplicar?: (valores: ValoresDatos) => void
}

/** Pasa el foco al siguiente campo con Intro (la spec solo envía con Intro en el último). */
function introSiguiente(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
  e.preventDefault()
  const campos = Array.from(
    e.currentTarget.form?.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[role="combobox"]'
    ) ?? []
  )
  campos[campos.indexOf(e.currentTarget) + 1]?.focus()
}

/** Línea de procedencia: `add.dato.origen.*`, o el aviso de dato dudoso con icono y texto. */
function Procedencia({ campo }: { campo: CampoPropuesto }): ReactNode {
  if (campo.origen === null || campo.valor === '') return null
  if (campo.invertido) {
    return (
      <span className={`${estilos.procedencia} ${estilos.procedenciaDudosa}`}>
        <Icono icono={TriangleAlert} tamano={16} />
        {TEXTO.dudosoInvertido}
      </span>
    )
  }
  const texto = ORIGEN_DATO[campo.origen]
  if (!campo.dudoso) return <>{texto}</>
  return (
    <span className={`${estilos.procedencia} ${estilos.procedenciaDudosa}`}>
      <Icono icono={TriangleAlert} tamano={16} />
      {TEXTO.dudoso(texto)}
    </span>
  )
}

/** Título (obligatorio), artista y álbum: común a "Revisar datos", al resumen del paso 1 y a «Editar datos». */
export function CamposDatos({
  valores,
  onCambio,
  errorTitulo,
  refTitulo,
  idTitulo,
  etiquetaTitulo,
  etiquetaAlbum,
  onSalir,
  onIntroUltimo,
  propuesta,
  lrclib,
  onAplicar
}: CamposDatosProps) {
  const biblioteca = useValoresBiblioteca()
  // Campos que el usuario ya tocó (su procedencia desaparece) y sugerencias de unificar abiertas.
  const [tocados, setTocados] = useState<ReadonlySet<Campo>>(new Set())
  const [unificar, setUnificar] = useState<Partial<Record<'artista' | 'album', string>>>({})
  const [descartadas, setDescartadas] = useState<ReadonlySet<string>>(new Set())
  const [anuncio, setAnuncio] = useState('')
  const refArtista = useRef<HTMLInputElement>(null)
  const refAlbum = useRef<HTMLInputElement>(null)
  const refIntercambiar = useRef<HTMLButtonElement>(null)

  const cambiar = (campo: Campo, valor: string): void => {
    onCambio({ ...valores, [campo]: valor })
    setTocados((t) => new Set(t).add(campo))
    setAnuncio('')
    if (campo !== 'titulo') {
      setUnificar((u) => ({ ...u, [campo]: undefined }))
      programar(campo, valor)
    }
  }

  const opcionesArtista: OpcionCombo[] = biblioteca.artistas
  const opcionesAlbum = useMemo<OpcionCombo[]>(() => {
    // Primero los álbumes del artista escrito (el índice ya viene ordenado por canciones).
    const k = claveTexto(valores.artista)
    if (k === null) return biblioteca.albumes
    const suyos = biblioteca.albumes.filter((a) => a.artistas?.includes(k))
    return [...suyos, ...biblioteca.albumes.filter((a) => !a.artistas?.includes(k))]
  }, [biblioteca.albumes, valores.artista])

  /**
   * Calcula la sugerencia de unificar de `campo` para `valor` (spec 03, respuesta a 0230): 400 ms después
   * de la última tecla, al elegir de la lista o al cerrarla; nunca al salir del campo.
   */
  const calcular = (campo: 'artista' | 'album', valor: string): void => {
    const lista = campo === 'artista' ? biblioteca.artistas : biblioteca.albumes
    const sugerido = sugerenciaDeUnificar(valor, lista)
    const oculta = descartadas.has(`${campo}\u0000${valor}`)
    setUnificar((u) => ({ ...u, [campo]: sugerido !== null && !oculta ? sugerido : undefined }))
  }
  // El temporizador usa siempre el último `calcular` (la biblioteca puede llegar después).
  const ultimoCalcular = useRef(calcular)
  useEffect(() => {
    ultimoCalcular.current = calcular
  })
  const temporizadores = useRef<
    Partial<Record<'artista' | 'album', ReturnType<typeof setTimeout>>>
  >({})
  useEffect(() => {
    const pendientes = temporizadores.current
    return () => {
      for (const t of Object.values(pendientes)) clearTimeout(t)
    }
  }, [])
  const programar = (campo: 'artista' | 'album', valor: string): void => {
    clearTimeout(temporizadores.current[campo])
    temporizadores.current[campo] = setTimeout(
      () => ultimoCalcular.current(campo, valor),
      RETRASO_UNIFICAR_MS
    )
  }

  /**
   * La región `role="status"` existe vacía desde el principio y se rellena al aparecer la sugerencia
   * (así se anuncia). Va bajo el campo y encima de su línea de ayuda: texto y, debajo, los dos botones.
   */
  const bloqueUnificar = (campo: 'artista' | 'album'): ReactNode => {
    const sugerido = unificar[campo]
    const ref = campo === 'artista' ? refArtista : refAlbum
    return (
      <span role="status" className={estilos.regionUnificar}>
        {sugerido !== undefined && (
          <span className={estilos.unificar}>
            <span>{TEXTO.unificar(sugerido)}</span>
            <span className={estilos.botonesUnificar}>
              <Boton
                tamano="normal"
                variante="secundario"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  cambiar(campo, sugerido)
                  ref.current?.focus()
                }}
              >
                {TEXTO.usar(sugerido)}
              </Boton>
              <Boton
                variante="fantasma"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setDescartadas((d) => new Set(d).add(`${campo}\u0000${valores[campo]}`))
                  setUnificar((u) => ({ ...u, [campo]: undefined }))
                  ref.current?.focus()
                }}
              >
                {TEXTO.dejarlo}
              </Boton>
            </span>
          </span>
        )}
      </span>
    )
  }

  /** Procedencia (si el campo sigue siendo el propuesto) o la ayuda de siempre. */
  const linea = (campo: Campo, vacio: ReactNode): ReactNode => {
    if (!propuesta) return vacio
    const c = propuesta[campo]
    if (valores[campo].trim() === '') return vacio
    return tocados.has(campo) ? null : <Procedencia campo={c} />
  }

  const sinArtista =
    propuesta && valores.artista.trim() === '' ? (
      <span className={estilos.procedencia}>
        <Icono icono={Info} tamano={16} />
        {TEXTO.sinArtista}
      </span>
    ) : null
  const ayudaArtista = (
    <>
      {bloqueUnificar('artista')}
      <span className={estilos.lineaAyuda}>{linea('artista', sinArtista)}</span>
    </>
  )
  // F6-N7: álbum tomado de LRCLIB, con [Quitar] (vacía el campo; el valor pasa a ser del usuario).
  const albumDeLrclib =
    lrclib?.albumDeLrclib === true && !tocados.has('album') && valores.album.trim() !== ''
  const ayudaAlbum = (
    <>
      {bloqueUnificar('album')}
      {albumDeLrclib ? (
        <span className={estilos.procedencia}>
          {TEXTO.origenLrclib}
          <Boton
            variante="fantasma"
            onClick={() => {
              const nuevos = { ...valores, album: '' }
              cambiar('album', '')
              onAplicar?.(nuevos)
              refAlbum.current?.focus()
            }}
          >
            {TEXTO.quitar}
          </Boton>
        </span>
      ) : (
        <span className={estilos.lineaAyuda}>{linea('album', TEXTO.campoAlbumAyuda)}</span>
      )}
    </>
  )
  // F6-N7: LRCLIB llama a la canción de otra forma; nada se cambia sin que el usuario lo pida.
  const registro = lrclib?.registro ?? null
  const difiere =
    registro !== null &&
    (claveFlexible(registro.titulo) !== claveFlexible(valores.titulo) ||
      claveFlexible(registro.artista) !== claveFlexible(valores.artista))
  const sugerenciaLrclib = difiere ? (
    <span role="status" className={estilos.unificar} data-sugerencia-lrclib>
      {TEXTO.sugerenciaLrclib(registro.titulo, registro.artista)}
      <Boton
        tamano="normal"
        variante="secundario"
        onClick={() => {
          const nuevos = { ...valores, titulo: registro.titulo, artista: registro.artista }
          onCambio(nuevos)
          setTocados((t) => new Set(t).add('titulo').add('artista'))
          onAplicar?.(nuevos)
          refArtista.current?.focus()
        }}
      >
        {TEXTO.usarEstosDatos}
      </Boton>
    </span>
  ) : null
  const puedeIntercambiar = valores.titulo.trim() !== '' && valores.artista.trim() !== ''

  return (
    <>
      <CampoTexto
        id={idTitulo}
        ref={refTitulo}
        type="text"
        etiqueta={etiquetaTitulo ?? `${TEXTO.campoTitulo} *`}
        ayuda={linea('titulo', null)}
        value={valores.titulo}
        maxLength={MAX_METADATO}
        error={errorTitulo}
        aria-required="true"
        onChange={(e) => cambiar('titulo', e.target.value)}
        onBlur={onSalir}
        onKeyDown={introSiguiente}
      />
      <CampoCombo
        etiqueta={TEXTO.campoArtista}
        ayuda={ayudaArtista}
        value={valores.artista}
        opciones={opcionesArtista}
        maxLength={MAX_METADATO}
        inputRef={refArtista}
        onChange={(v) => cambiar('artista', v)}
        onBlur={onSalir}
        alResolver={(v) => calcular('artista', v)}
        onKeyDown={introSiguiente}
      />
      {sugerenciaLrclib}
      {puedeIntercambiar && (
        <div className={estilos.accionCampo}>
          <Boton
            ref={refIntercambiar}
            variante="fantasma"
            onClick={() => {
              onCambio({ ...valores, titulo: valores.artista, artista: valores.titulo })
              setTocados((t) => new Set(t).add('titulo').add('artista'))
              // Solo se recalcula la sugerencia del Artista (su valor cambió); la del Álbum se conserva.
              setUnificar((u) => ({ album: u.album }))
              calcular('artista', valores.titulo)
              setAnuncio(TEXTO.intercambiado)
              refIntercambiar.current?.focus()
            }}
          >
            <Icono icono={ArrowLeftRight} tamano={16} />
            {TEXTO.intercambiar}
          </Boton>
        </div>
      )}
      <p role="status" className={estilos.anuncio}>
        {anuncio}
      </p>
      <CampoCombo
        etiqueta={etiquetaAlbum ?? TEXTO.campoAlbum}
        ayuda={ayudaAlbum}
        value={valores.album}
        opciones={opcionesAlbum}
        maxLength={MAX_METADATO}
        inputRef={refAlbum}
        onChange={(v) => cambiar('album', v)}
        onBlur={onSalir}
        alResolver={(v) => calcular('album', v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onIntroUltimo && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onIntroUltimo()
          }
        }}
      />
    </>
  )
}

/** Valores listos para IPC: recortados, álbum vacío -> `null`. */
export function metadatosParaIpc(v: ValoresDatos): {
  titulo: string
  artista: string
  album: string | null
} {
  const album = v.album.trim()
  return { titulo: v.titulo.trim(), artista: v.artista.trim(), album: album === '' ? null : album }
}

/** Datos de LRCLIB de una canción guardada (`null` si no tiene letra de allí ni álbum de LRCLIB). */
export function datosLrclibDe(
  cancion: {
    metadatos: { origen?: { album?: string } }
    letra?: { datos_lrclib?: { titulo: string; artista: string } } | null
  } | null
): DatosLrclib | null {
  if (!cancion) return null
  const registro = cancion.letra?.datos_lrclib
  return {
    albumDeLrclib: cancion.metadatos.origen?.album === 'lrclib',
    registro: registro ? { titulo: registro.titulo, artista: registro.artista } : null
  }
}
