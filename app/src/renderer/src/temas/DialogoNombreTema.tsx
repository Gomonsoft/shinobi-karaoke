import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { claveNombreTema, normalizarNombreTema } from '@shared/identidad'
import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import comunes from '../componentes/componentes.module.css'
import { TEMA } from './textos'
import estilos from './temas.module.css'

const MAX = 60
const CONTADOR_DESDE = 50

interface NombreExistente {
  id: string
  nombre: string
}

/** ¿Ya hay otro tema con esa identidad (NFC, espacios, mayúsculas; con tildes)? */
export function nombreRepetido(
  nombre: string,
  existentes: readonly NombreExistente[],
  excluirId?: string
): boolean {
  const clave = claveNombreTema(nombre)
  return (
    clave !== null &&
    existentes.some((t) => t.id !== excluirId && claveNombreTema(t.nombre) === clave)
  )
}

/** Propuesta única: la base y, si existe, « 2», « 3»… */
export function proponerNombre(base: string, existentes: readonly NombreExistente[]): string {
  if (!nombreRepetido(base, existentes)) return base
  for (let i = 2; ; i++) {
    const candidato = `${base} ${i}`
    if (!nombreRepetido(candidato, existentes)) return candidato
  }
}

export type ModoNombreTema = 'nuevo' | 'duplicar' | 'renombrar'

interface Props {
  abierto: boolean
  modo: ModoNombreTema
  /** Nombre propuesto (se hace único con « 2», « 3»…; en `renombrar` es el nombre actual). */
  propuesta: string
  existentes: readonly NombreExistente[]
  /** Renombrar: el tema que se renombra (no cuenta como repetido de sí mismo). */
  excluirId?: string
  /** Ayuda según el origen (`tema.dialogo.nuevo` D3 / D2-D4, `duplicar`). */
  ayuda?: string
  onCancelar(): void
  /** Hace la llamada. Debe lanzar el `ErrorIpc` si falla; el consumidor cierra al resolver. */
  onConfirmar(nombre: string): Promise<void>
  /** Errores distintos de `TEMA_NOMBRE_DUPLICADO`. */
  onError?(err: unknown): void
}

export function DialogoNombreTema(props: Props) {
  if (!props.abierto) return null
  return <Interno {...props} />
}

function Interno({
  modo,
  propuesta,
  existentes,
  excluirId,
  ayuda,
  onCancelar,
  onConfirmar,
  onError
}: Props) {
  const idForm = useId()
  const idAyuda = useId()
  const idError = useId()
  const entrada = useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = useState(() =>
    modo === 'renombrar' ? propuesta : proponerNombre(propuesta, existentes)
  )
  const [intentado, setIntentado] = useState(false)
  const [duplicadoServidor, setDuplicadoServidor] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    entrada.current?.focus()
    entrada.current?.select()
  }, [])

  const limpio = normalizarNombreTema(nombre)
  const problema =
    limpio === ''
      ? TEMA.nombre.vacio
      : nombreRepetido(limpio, existentes, excluirId) || duplicadoServidor
        ? TEMA.nombre.repetido
        : null
  const mostrarError = (intentado || duplicadoServidor) && problema !== null

  const titulo =
    modo === 'nuevo'
      ? TEMA.nombre.tituloNuevo
      : modo === 'duplicar'
        ? TEMA.nombre.tituloDuplicar
        : TEMA.nombre.tituloRenombrar
  const boton =
    modo === 'nuevo'
      ? TEMA.nombre.botonNuevo
      : modo === 'duplicar'
        ? TEMA.nombre.botonDuplicar
        : TEMA.nombre.botonRenombrar

  async function enviar(e?: FormEvent): Promise<void> {
    e?.preventDefault()
    if (enviando) return
    setIntentado(true)
    if (problema !== null) {
      entrada.current?.focus()
      return
    }
    if (modo === 'renombrar' && limpio === normalizarNombreTema(propuesta)) {
      onCancelar()
      return
    }
    setEnviando(true)
    try {
      await onConfirmar(limpio)
    } catch (err) {
      setEnviando(false)
      if (
        err &&
        typeof err === 'object' &&
        'codigo' in err &&
        err.codigo === 'TEMA_NOMBRE_DUPLICADO'
      ) {
        setDuplicadoServidor(true)
        entrada.current?.focus()
        entrada.current?.select()
      } else {
        onError?.(err)
      }
    }
  }

  return (
    <Dialogo
      abierto
      titulo={titulo}
      onCancelar={() => {
        if (!enviando) onCancelar()
      }}
      acciones={
        <>
          <Boton onClick={onCancelar}>{TEMA.cancelar}</Boton>
          <Boton
            variante="primario"
            type="submit"
            form={idForm}
            cargando={enviando}
            textoCargando={boton}
          >
            {boton}
          </Boton>
        </>
      }
    >
      <form id={idForm} className={estilos.campoNombre} onSubmit={(e) => void enviar(e)} noValidate>
        <label htmlFor={`${idForm}-nombre`} className={comunes.etiqueta}>
          {TEMA.nombre.campo}
        </label>
        <input
          ref={entrada}
          id={`${idForm}-nombre`}
          className={comunes.entrada}
          value={nombre}
          maxLength={MAX}
          aria-invalid={mostrarError || undefined}
          aria-describedby={
            [ayuda ? idAyuda : null, mostrarError ? idError : null].filter(Boolean).join(' ') ||
            undefined
          }
          onChange={(e) => {
            setNombre(e.target.value)
            setDuplicadoServidor(false)
          }}
        />
        {nombre.length >= CONTADOR_DESDE && (
          <span className={`${comunes.ayuda} ${estilos.contador}`}>
            {TEMA.nombre.contador(nombre.length)}
          </span>
        )}
        {mostrarError && (
          <span id={idError} className={comunes.mensajeError}>
            {problema}
          </span>
        )}
        {ayuda && (
          <span id={idAyuda} className={comunes.ayuda}>
            {ayuda}
          </span>
        )}
      </form>
    </Dialogo>
  )
}
