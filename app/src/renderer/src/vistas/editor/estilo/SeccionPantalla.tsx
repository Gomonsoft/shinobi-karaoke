import { useEffect, useId, useRef } from 'react'
import { Info, Play, Square } from 'lucide-react'
import {
  pasadasEfectivas,
  pasadasMaximas,
  TRANSICIONES_PANTALLA,
  ZONAS_PANTALLA,
  zonasEfectivas,
  type Pantalla,
  type TransicionPantalla
} from '@shared/pantalla'
import { Boton } from '../../../componentes/Boton'
import { ControlSegmentado } from '../../../componentes/ControlSegmentado'
import { Icono } from '../../../componentes/Icono'
import estilosPanel from '../panelEstilo.module.css'
import estilos from './espera.module.css'
import estilosPantalla from './pantalla.module.css'
import { T_PANTALLA as T } from './textosPantalla'

/** Control de la sección: la lectura y las acciones salen del editor (`useControlPantalla`). */
export interface ControlPantalla {
  /** D1/D4 sin bloque propio: resumen. En los demás casos, controles editables. */
  resumen: boolean
  /** D1/D4 con la letra en pantalla propia de la canción. */
  propia: boolean
  /** Edición de un tema (D3) en una canción con letra en pantalla propia. */
  d3Propia: boolean
  pantalla: Pantalla
  /** Canción con reparto (y siempre en D3): muestra «Varias voces» (0363). */
  varias?: boolean
  procedencia: string
  temaNombre: string | null
  ejemploActivo: boolean
  movimientoReducido: boolean
  /** `clave` empieza por `lineas`, `pasadas` o `cambio` (cada cambio es un paso de deshacer). */
  cambiar(pantalla: Pantalla, clave: string): void
  cambiarSoloCancion(): void
  usarLaDelTema(): void
  alternarEjemplo(): void
}

const LINEAS = [2, 3, 4, 5, 6, 7]

/** Sección «Letra en pantalla» del panel Estilo (spec 06 · Feature 1). */
export function SeccionPantalla({
  control,
  inactivo
}: {
  control: ControlPantalla
  inactivo: boolean
}) {
  const { pantalla } = control
  const raiz = useRef<HTMLElement>(null)
  const foco = useRef<'lineas' | 'cambiar' | null>(null)
  const idTitulo = useId()
  const idMotivo = useId()
  const idCambio = useId()
  const idVoces = useId()
  const modo = control.resumen
  const efectivas = pasadasEfectivas(pantalla)
  const maximo = pasadasMaximas(pantalla.lineas)

  // Tras cambiar de modo, el foco va a «Líneas a la vez» o a «Cambiar solo en esta canción».
  useEffect(() => {
    if (!foco.current) return
    const destino = raiz.current?.querySelector<HTMLElement>(
      foco.current === 'lineas' ? '[role="radio"][aria-checked="true"]' : '[data-pantalla-cambiar]'
    )
    destino?.focus()
    foco.current = null
  }, [modo])

  const ejemplo = (
    <Boton onClick={control.alternarEjemplo} aria-pressed={control.ejemploActivo}>
      <Icono icono={control.ejemploActivo ? Square : Play} tamano={16} />
      {control.ejemploActivo ? T.detenerEjemplo : T.ejemplo}
    </Boton>
  )

  if (control.resumen) {
    return (
      <section ref={raiz} className={estilosPanel.bloque} aria-labelledby={idTitulo}>
        <h3 id={idTitulo}>{T.titulo}</h3>
        <p className={estilos.nota}>{T.resumenCorto(pantalla, efectivas, control.varias)}</p>
        <p className={estilos.nota}>{T.origen(control.procedencia, control.temaNombre)}</p>
        <div className={estilosPanel.acciones}>
          <Boton
            data-pantalla-cambiar
            disabled={inactivo}
            onClick={() => {
              control.cambiarSoloCancion()
              foco.current = 'lineas'
            }}
          >
            {T.soloCancion}
          </Boton>
          {ejemplo}
        </div>
      </section>
    )
  }

  const motivo = maximo === 0 ? T.minimo1 : maximo === 1 ? T.minimo2 : null
  const pasadas = [
    { valor: '0', etiqueta: T.ninguna },
    {
      valor: '1',
      etiqueta: '1',
      noDisponible: maximo < 1 ? T.minimo1 : undefined
    },
    {
      valor: '2',
      etiqueta: '2',
      noDisponible: maximo < 2 ? (maximo === 0 ? T.minimo1 : T.minimo2) : undefined
    }
  ]

  return (
    <section ref={raiz} className={estilosPanel.bloque} aria-labelledby={idTitulo}>
      <h3 id={idTitulo}>{T.titulo}</h3>
      <p className={estilos.nota}>{control.propia ? T.propia(control.temaNombre) : T.ayuda}</p>

      {control.varias && (
        <>
          <h4 id={idVoces}>{T.voces}</h4>
          <div role="radiogroup" aria-labelledby={idVoces} className={estilosPantalla.cambios}>
            {ZONAS_PANTALLA.map((valor) => (
              <div key={valor} className={estilosPantalla.cambio}>
                <input
                  id={`${idVoces}-${valor}`}
                  type="radio"
                  name={idVoces}
                  aria-describedby={`${idVoces}-${valor}-ayuda`}
                  checked={zonasEfectivas(pantalla) === valor}
                  onChange={() => control.cambiar({ ...pantalla, zonas: valor }, `zonas.${valor}`)}
                />
                <div>
                  <label htmlFor={`${idVoces}-${valor}`} className={estilosPantalla.cambioNombre}>
                    {T.vocesOpciones[valor][0]}
                  </label>
                  <span id={`${idVoces}-${valor}-ayuda`} className={estilos.nota}>
                    {T.vocesOpciones[valor][1]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h4>{T.lineas}</h4>
      <div data-foco-editor="segmentado">
        <ControlSegmentado
          etiqueta={T.lineas}
          valor={String(pantalla.lineas)}
          opciones={LINEAS.map((n) => ({ valor: String(n), etiqueta: String(n) }))}
          onCambio={(v) => control.cambiar({ ...pantalla, lineas: Number(v) }, `lineas.${v}`)}
        />
      </div>

      <h4>{T.pasadas}</h4>
      <div data-foco-editor="segmentado">
        <ControlSegmentado
          etiqueta={T.pasadas}
          // Se muestra lo que se ve; la elección se conserva en `pasadas` (se recupera sola).
          valor={String(efectivas)}
          opciones={pasadas}
          describedBy={motivo ? idMotivo : undefined}
          onCambio={(v) => control.cambiar({ ...pantalla, pasadas: Number(v) }, `pasadas.${v}`)}
        />
      </div>
      <p className={estilos.nota}>{T.pasadasAyuda}</p>
      {control.varias && zonasEfectivas(pantalla) === 'por_parte' && (
        <p className={`${estilos.nota} ${estilosPantalla.motivo}`}>
          <Icono icono={Info} tamano={16} />
          {T.zonas}
        </p>
      )}
      {motivo && (
        <p id={idMotivo} className={`${estilos.nota} ${estilosPantalla.motivo}`}>
          <Icono icono={Info} tamano={16} />
          {motivo}
        </p>
      )}

      <h4 id={idCambio}>{T.cambio}</h4>
      <div role="radiogroup" aria-labelledby={idCambio} className={estilosPantalla.cambios}>
        {TRANSICIONES_PANTALLA.map((tipo: TransicionPantalla) => (
          <div key={tipo} className={estilosPantalla.cambio}>
            <input
              id={`${idCambio}-${tipo}`}
              type="radio"
              name={idCambio}
              aria-describedby={`${idCambio}-${tipo}-ayuda`}
              checked={pantalla.transicion === tipo}
              onChange={() => control.cambiar({ ...pantalla, transicion: tipo }, `cambio.${tipo}`)}
            />
            <div>
              <label htmlFor={`${idCambio}-${tipo}`} className={estilosPantalla.cambioNombre}>
                {T.opciones[tipo][0]}
              </label>
              <span id={`${idCambio}-${tipo}-ayuda`} className={estilos.nota}>
                {T.opciones[tipo][1]}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className={estilos.nota} aria-live="polite">
        {T.resumen(pantalla, efectivas)}
      </p>
      {control.movimientoReducido && (
        <p className={`${estilos.nota} ${estilosPantalla.motivo}`}>
          <Icono icono={Info} tamano={16} />
          {T.reducido}
        </p>
      )}
      {control.d3Propia && <p className={estilos.nota}>{T.d3Propia}</p>}
      <div className={estilosPanel.acciones}>
        {control.propia && (
          <Boton
            disabled={inactivo}
            onClick={() => {
              control.usarLaDelTema()
              foco.current = 'cambiar'
            }}
          >
            {T.usarTema}
          </Boton>
        )}
        {ejemplo}
      </div>
    </section>
  )
}
