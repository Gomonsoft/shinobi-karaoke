import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Minus, Play, Plus, Square } from 'lucide-react'
import type { Espera } from '@shared/espera'
import { Boton } from '../../../componentes/Boton'
import { BotonIcono } from '../../../componentes/BotonIcono'
import { Icono } from '../../../componentes/Icono'
import estilosPanel from '../panelEstilo.module.css'
import estilos from './espera.module.css'
import { T_ESPERA as T, decimal } from './textosEspera'

export const UMBRAL_MIN_MS = 1000
export const UMBRAL_MAX_MS = 60_000
const PASO_MS = 500
const PASO_GRANDE_MS = 5000

/** Control de la sección: la lectura y las acciones salen del editor (`useControlEspera`). */
export interface ControlEspera {
  /** D1/D4 sin indicadores propios: resumen. En los demás casos, controles editables. */
  resumen: boolean
  /** D1/D4 con indicadores propios de la canción. */
  propios: boolean
  /** Edición de un tema (D3) en una canción con indicadores propios. */
  d3Propios: boolean
  espera: Espera
  procedencia: string
  temaNombre: string | null
  ejemploActivo: boolean
  cambiar(espera: Espera, clave: string): void
  cambiarSoloCancion(): void
  usarLosDelTema(): void
  alternarEjemplo(): void
}

/** Interpreta «4,5», «4.5» o «4,5 s» y lo redondea a la décima; `null` si no es un número. */
export function interpretarUmbral(texto: string): number | null {
  const limpio = texto.trim().replace(/\s*s$/i, '').replace(',', '.')
  if (!/^\d*\.?\d+$|^\d+\.$/.test(limpio)) return null
  return Math.round(Number(limpio) * 10) * 100
}

export const limitarUmbral = (ms: number): number =>
  Math.min(UMBRAL_MAX_MS, Math.max(UMBRAL_MIN_MS, ms))

const formato = (ms: number): string => `${decimal(ms)} s`

function CampoUmbral({ valor, alCambiar }: { valor: number; alCambiar(ms: number): void }) {
  const idEtiqueta = useId()
  const idRango = useId()
  const [borrador, setBorrador] = useState<string | null>(null)
  const [fuera, setFuera] = useState(false)

  function confirmar(ms: number | null) {
    setBorrador(null)
    if (ms === null) return
    const limitado = limitarUmbral(ms)
    setFuera(limitado !== ms)
    if (limitado !== valor) alCambiar(limitado)
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    const paso =
      e.key === 'ArrowUp'
        ? PASO_MS
        : e.key === 'ArrowDown'
          ? -PASO_MS
          : e.key === 'PageUp'
            ? PASO_GRANDE_MS
            : e.key === 'PageDown'
              ? -PASO_GRANDE_MS
              : 0
    if (paso) {
      e.preventDefault()
      confirmar(valor + paso)
    } else if (e.key === 'Enter') {
      confirmar(borrador === null ? null : interpretarUmbral(borrador))
    }
  }

  return (
    <div className={estilos.umbral}>
      <span id={idEtiqueta}>{T.umbral}</span>
      <div className={estilos.spin}>
        <BotonIcono
          icono={Minus}
          etiqueta={T.menos}
          disabled={valor <= UMBRAL_MIN_MS}
          onClick={() => confirmar(valor - PASO_MS)}
        />
        <input
          type="text"
          inputMode="decimal"
          role="spinbutton"
          aria-labelledby={idEtiqueta}
          aria-describedby={fuera ? idRango : undefined}
          aria-valuemin={UMBRAL_MIN_MS / 1000}
          aria-valuemax={UMBRAL_MAX_MS / 1000}
          aria-valuenow={valor / 1000}
          aria-valuetext={formato(valor)}
          value={borrador ?? formato(valor)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setBorrador(e.currentTarget.value)}
          onBlur={() => confirmar(borrador === null ? null : interpretarUmbral(borrador))}
          onKeyDown={alTeclear}
        />
        <BotonIcono
          icono={Plus}
          etiqueta={T.mas}
          disabled={valor >= UMBRAL_MAX_MS}
          onClick={() => confirmar(valor + PASO_MS)}
        />
      </div>
      {fuera && (
        <p id={idRango} role="status" className={estilos.rango}>
          {T.umbralRango}
        </p>
      )}
    </div>
  )
}

/** Sección «Indicadores de espera» del panel Estilo (spec 06 · IE). */
export function SeccionEspera({
  control,
  inactivo
}: {
  control: ControlEspera
  inactivo: boolean
}) {
  const { espera } = control
  const seq = useRef(0)
  const raiz = useRef<HTMLElement>(null)
  const foco = useRef<'primera' | 'cambiar' | null>(null)
  const idAyuda = useId()
  const modo = control.resumen

  // Tras cambiar de modo, el foco va a la primera casilla o a «Cambiar solo en esta canción».
  useEffect(() => {
    if (!foco.current) return
    const destino = raiz.current?.querySelector<HTMLElement>(
      foco.current === 'primera' ? 'input[type="checkbox"]' : '[data-espera-cambiar]'
    )
    destino?.focus()
    foco.current = null
  }, [modo])

  const ninguno = !espera.puntos && !espera.barra && !espera.cuenta
  const cambiar = (parcial: Partial<Espera>, campo: string) =>
    control.cambiar({ ...espera, ...parcial }, `espera.${campo}.${++seq.current}`)

  const ejemplo = (
    <Boton onClick={control.alternarEjemplo} aria-pressed={control.ejemploActivo}>
      <Icono icono={control.ejemploActivo ? Square : Play} tamano={16} />
      {control.ejemploActivo ? T.detenerEjemplo : T.ejemplo}
    </Boton>
  )

  return (
    <section ref={raiz} className={estilosPanel.bloque} aria-labelledby={idAyuda}>
      <h3 id={idAyuda}>{T.titulo}</h3>
      {control.resumen ? (
        <>
          <p className={estilos.nota}>{T.resumenCorto(espera)}</p>
          <p className={estilos.nota}>{T.origen(control.procedencia, control.temaNombre)}</p>
          <div className={estilosPanel.acciones}>
            <Boton
              data-espera-cambiar
              disabled={inactivo}
              onClick={() => {
                control.cambiarSoloCancion()
                foco.current = 'primera'
              }}
            >
              {T.cambiar}
            </Boton>
            {ejemplo}
          </div>
        </>
      ) : (
        <>
          {control.propios ? (
            <p className={estilos.nota}>{T.propios(control.temaNombre)}</p>
          ) : (
            <p className={estilos.nota}>{T.ayuda}</p>
          )}
          {(
            [
              ['puntos', T.puntos, T.puntosAria],
              ['barra', T.barra, undefined],
              ['cuenta', T.cuenta, T.cuentaAria]
            ] as const
          ).map(([campo, texto, aria]) => (
            <label key={campo} className={estilosPanel.casilla}>
              <input
                type="checkbox"
                aria-label={aria}
                checked={espera[campo]}
                onChange={(e) => cambiar({ [campo]: e.currentTarget.checked }, campo)}
              />
              {texto}
            </label>
          ))}
          <label className={estilosPanel.casilla}>
            <input
              type="checkbox"
              checked={espera.primera_entrada}
              disabled={ninguno}
              onChange={(e) => cambiar({ primera_entrada: e.currentTarget.checked }, 'primera')}
            />
            {T.primera}
          </label>
          <CampoUmbral
            valor={espera.umbral_ms}
            alCambiar={(ms) => control.cambiar({ ...espera, umbral_ms: ms }, 'espera.umbral')}
          />
          <p className={estilos.nota}>{T.resumen(espera)}</p>
          {control.d3Propios && <p className={estilos.nota}>{T.d3Propios}</p>}
          <div className={estilosPanel.acciones}>
            {control.propios && (
              <Boton
                disabled={inactivo}
                onClick={() => {
                  control.usarLosDelTema()
                  foco.current = 'cambiar'
                }}
              >
                {T.usarTema}
              </Boton>
            )}
            {ejemplo}
          </div>
        </>
      )}
    </section>
  )
}
