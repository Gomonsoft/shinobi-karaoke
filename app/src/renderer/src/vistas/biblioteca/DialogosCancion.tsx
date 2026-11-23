import { useState, type FormEvent } from 'react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { CamposDatos, MAX_METADATO, type DatosLrclib } from '../anadir/CamposDatos'
import { mensajeDeError } from './errores'

export { MAX_METADATO }

interface ConfirmarProps {
  titulo: string
  cuerpo: string
  etiquetaConfirmar: string
  destructivo?: boolean
  alConfirmar: () => Promise<void>
  alCancelar: () => void
}

/** Diálogo de confirmación; el foco inicial va a "Cancelar" (la opción segura). */
export function DialogoConfirmar({
  titulo,
  cuerpo,
  etiquetaConfirmar,
  destructivo,
  alConfirmar,
  alCancelar
}: ConfirmarProps) {
  const [ocupado, setOcupado] = useState(false)
  const confirmar = async () => {
    setOcupado(true)
    try {
      await alConfirmar()
    } finally {
      setOcupado(false)
    }
  }
  return (
    <Dialogo
      abierto
      titulo={titulo}
      onCancelar={alCancelar}
      enfoqueInicial="[data-cancelar]"
      acciones={
        <>
          <Boton data-cancelar onClick={alCancelar}>
            Cancelar
          </Boton>
          <Boton
            variante={destructivo ? 'destructivo' : 'primario'}
            cargando={ocupado}
            onClick={() => void confirmar()}
          >
            {etiquetaConfirmar}
          </Boton>
        </>
      }
    >
      <p>{cuerpo}</p>
    </Dialogo>
  )
}

export interface DatosEditables {
  titulo: string
  artista: string
  album: string | null
}

/** Lo que se muestra al abrir «Editar datos»: los datos y lo que LRCLIB dejó en la canción. */
export interface InicialEditar extends DatosEditables {
  lrclib?: DatosLrclib | null
}

interface EditarProps {
  inicial: InicialEditar
  alGuardar: (datos: DatosEditables) => Promise<void>
  alCancelar: () => void
}

/** "Editar datos": título (obligatorio), artista y álbum, máx. 200 caracteres, sin espacios sobrantes. */
export function DialogoEditarDatos({ inicial, alGuardar, alCancelar }: EditarProps) {
  const [titulo, setTitulo] = useState(inicial.titulo)
  const [artista, setArtista] = useState(inicial.artista)
  const [album, setAlbum] = useState(inicial.album ?? '')
  const [errorTitulo, setErrorTitulo] = useState<string | undefined>()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const t = titulo.trim()
    if (t === '') {
      setErrorTitulo('Escribe un título.')
      document.getElementById('editar-titulo')?.focus()
      return
    }
    setErrorTitulo(undefined)
    setErrorGeneral(null)
    setOcupado(true)
    try {
      const a = album.trim()
      await alGuardar({ titulo: t, artista: artista.trim(), album: a === '' ? null : a })
    } catch (err) {
      setErrorGeneral(`No se pudieron guardar los datos. ${mensajeDeError(err)}`.trim())
      setOcupado(false)
    }
  }

  return (
    <Dialogo
      abierto
      titulo="Editar datos"
      onCancelar={alCancelar}
      enfoqueInicial="#editar-titulo"
      acciones={
        <>
          <Boton onClick={alCancelar}>Cancelar</Boton>
          <Boton variante="primario" type="submit" form="form-editar-datos" cargando={ocupado}>
            Guardar
          </Boton>
        </>
      }
    >
      <form
        id="form-editar-datos"
        noValidate
        onSubmit={(e) => void enviar(e)}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e-3)' }}
      >
        <CamposDatos
          valores={{ titulo, artista, album }}
          onCambio={(v) => {
            setTitulo(v.titulo)
            setArtista(v.artista)
            setAlbum(v.album)
          }}
          idTitulo="editar-titulo"
          etiquetaTitulo="Título"
          etiquetaAlbum="Álbum (opcional)"
          errorTitulo={errorTitulo}
          lrclib={inicial.lrclib}
        />
        {errorGeneral && <AvisoEnLinea tipo="error">{errorGeneral}</AvisoEnLinea>}
      </form>
    </Dialogo>
  )
}
