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
  propuesta
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
    if (campo !== 'titulo') setUnificar((u) => ({ ...u, [campo]: undefined }))
  }

  const opcionesArtista: OpcionCombo[] = biblioteca.artistas
  const opcionesAlbum = useMemo<OpcionCombo[]>(() => {
    // Primero los álbumes del artista escrito (el índice ya viene ordenado por canciones).
    const k = claveTexto(valores.artista)
    if (k === null) return biblioteca.albumes
    const suyos = biblioteca.albumes.filter((a) => a.artistas?.includes(k))
    return [...suyos, ...biblioteca.albumes.filter((a) => !a.artistas?.includes(k))]
  }, [biblioteca.albumes, valores.artista])

  const alSalir = (campo: 'artista' | 'album'): void => {
    const lista = campo === 'artista' ? biblioteca.artistas : biblioteca.albumes
    const sugerido = sugerenciaDeUnificar(valores[campo], lista)
    const oculta = descartadas.has(`${campo}\u0000${valores[campo]}`)
    setUnificar((u) => ({ ...u, [campo]: sugerido !== null && !oculta ? sugerido : undefined }))
    onSalir?.()
  }

  const bloqueUnificar = (campo: 'artista' | 'album'): ReactNode => {
    const sugerido = unificar[campo]
    if (sugerido === undefined) return null
    const ref = campo === 'artista' ? refArtista : refAlbum
    return (
      <span role="status" className={estilos.unificar}>
        {TEXTO.unificar(sugerido)}
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
      {linea('artista', sinArtista)}
    </>
  )
  const ayudaAlbum = (
    <>
      {bloqueUnificar('album')}
      {linea('album', TEXTO.campoAlbumAyuda)}
    </>
  )
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
        onBlur={() => alSalir('artista')}
        onKeyDown={introSiguiente}
      />
      {puedeIntercambiar && (
        <div className={estilos.accionCampo}>
          <Boton
            ref={refIntercambiar}
            variante="fantasma"
            onClick={() => {
              onCambio({ ...valores, titulo: valores.artista, artista: valores.titulo })
              setTocados((t) => new Set(t).add('titulo').add('artista'))
              setUnificar({})
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
        onBlur={() => alSalir('album')}
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
