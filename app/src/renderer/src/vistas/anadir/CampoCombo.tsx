import { useId, useMemo, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { ChevronDown } from 'lucide-react'
import { CampoTexto } from '../../componentes/Campos'
import { Icono } from '../../componentes/Icono'
import { TEXTO } from './textos'
import estilos from './anadir.module.css'

export interface OpcionCombo {
  valor: string
  canciones: number
}

/** Máximo de sugerencias a la vez (spec 03 · Feature 6). */
export const MAX_SUGERENCIAS = 8

const plano = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Valores que contienen lo escrito (sin distinguir mayúsculas ni tildes); sin texto, todos. */
export function filtrarOpciones(opciones: OpcionCombo[], escrito: string): OpcionCombo[] {
  const buscado = plano(escrito.trim())
  return opciones.filter((o) => buscado === '' || plano(o.valor).includes(buscado))
}

interface CampoComboProps {
  etiqueta: string
  value: string
  onChange: (valor: string) => void
  /** Valores de la biblioteca, ya ordenados. Vacío: campo de texto normal, sin lista ni ▾. */
  opciones: OpcionCombo[]
  ayuda?: ReactNode
  maxLength?: number
  id?: string
  inputRef?: Ref<HTMLInputElement>
  onBlur?: () => void
  /**
   * El valor quedó definido sin salir del campo: se eligió de la lista o se cerró (Esc, Tab, ▾). Con él
   * se calcula la sugerencia de unificar (spec 03: nunca en el `blur`).
   */
  alResolver?: (valor: string) => void
  /** Teclas que la lista no usa (p. ej. Intro pasa al campo siguiente). */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}

/** Campo de texto con lista de valores existentes: patrón *combobox* editable de la spec 03. */
export function CampoCombo({
  etiqueta,
  value,
  onChange,
  opciones,
  ayuda,
  maxLength,
  id,
  inputRef,
  onBlur,
  alResolver,
  onKeyDown
}: CampoComboProps) {
  const base = useId()
  const idLista = `${base}-lista`
  const [abierta, setAbierta] = useState(false)
  const [activa, setActiva] = useState(-1)
  const visibles = useMemo(
    () => filtrarOpciones(opciones, value).slice(0, MAX_SUGERENCIAS),
    [opciones, value]
  )
  // La lista se cierra sola cuando lo escrito coincide exactamente con la única opción.
  const unicaExacta = visibles.length === 1 && visibles[0]?.valor === value.trim()
  const mostrada = abierta && visibles.length > 0 && !unicaExacta
  const idOpcion = (i: number): string => `${base}-op-${i}`

  const cerrar = (): void => {
    setAbierta(false)
    setActiva(-1)
  }
  const elegir = (valor: string): void => {
    onChange(valor)
    cerrar()
    alResolver?.(valor)
  }

  if (opciones.length === 0) {
    return (
      <CampoTexto
        id={id}
        ref={inputRef}
        type="text"
        etiqueta={etiqueta}
        ayuda={ayuda}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    )
  }

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!mostrada) {
        setAbierta(true)
        setActiva(e.key === 'ArrowDown' ? 0 : visibles.length - 1)
        return
      }
      const paso = e.key === 'ArrowDown' ? 1 : -1
      // Sin opción activa, ↓ activa la primera y ↑ la última.
      setActiva((a) =>
        a < 0
          ? paso === 1
            ? 0
            : visibles.length - 1
          : (a + paso + visibles.length) % visibles.length
      )
      return
    }
    if (e.key === 'Escape' && mostrada) {
      // Cierra la lista sin salir de la vista ni del diálogo.
      e.preventDefault()
      e.stopPropagation()
      cerrar()
      alResolver?.(value)
      return
    }
    if (e.key === 'Enter' && mostrada && activa >= 0) {
      e.preventDefault()
      const o = visibles[activa]
      if (o) elegir(o.valor)
      return
    }
    if (e.key === 'Tab') {
      cerrar()
      // Antes de que el foco salte: así el Tab siguiente ya encuentra [Usar «…»].
      alResolver?.(value)
    }
    onKeyDown?.(e)
  }

  return (
    <CampoTexto
      id={id ?? `${base}-campo`}
      ref={inputRef}
      type="text"
      role="combobox"
      etiqueta={etiqueta}
      ayuda={ayuda}
      value={value}
      maxLength={maxLength}
      autoComplete="off"
      aria-autocomplete="list"
      aria-expanded={mostrada}
      aria-controls={mostrada ? idLista : undefined}
      aria-activedescendant={mostrada && activa >= 0 ? idOpcion(activa) : undefined}
      style={{ paddingRight: '2.5rem' }}
      onChange={(e) => {
        onChange(e.target.value)
        setAbierta(e.target.value.trim() !== '')
        setActiva(-1)
      }}
      onBlur={() => {
        cerrar()
        onBlur?.()
      }}
      onKeyDown={alTeclear}
      junto={
        <>
          <button
            type="button"
            tabIndex={-1}
            className={estilos.desplegar}
            aria-label={TEXTO.sugerencias}
            // Sin quitar el foco al campo.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (mostrada) {
                cerrar()
                alResolver?.(value)
              } else setAbierta(true)
            }}
          >
            <Icono icono={ChevronDown} tamano={18} />
          </button>
          {mostrada && (
            <ul id={idLista} role="listbox" aria-label={etiqueta} className={estilos.lista}>
              {visibles.map((o, i) => (
                // El teclado lo gestiona el campo (aria-activedescendant); el clic es solo para el ratón.
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <li
                  key={o.valor}
                  id={idOpcion(i)}
                  role="option"
                  aria-selected={i === activa}
                  aria-label={TEXTO.opcionSugerencia(o.valor, o.canciones)}
                  className={i === activa ? `${estilos.opcion} ${estilos.activa}` : estilos.opcion}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir(o.valor)}
                >
                  <span className={estilos.opcionValor}>{o.valor}</span>
                  <span className={estilos.opcionCantidad}>{TEXTO.numCanciones(o.canciones)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      }
    />
  )
}
