import { useId, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, Info, Plus, TriangleAlert, X } from 'lucide-react'
import { estiloSchema, type Estilo, type Fondo } from '@shared/estilo'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { DialAngulo } from '../../componentes/DialAngulo'
import { Icono } from '../../componentes/Icono'
import { SelectorColor } from '../../componentes/SelectorColor'
import { SelectorFuente } from '../../componentes/SelectorFuente'
import { mostrarToast } from '../../componentes/gestorToasts'
import base from '../../componentes/componentes.module.css'
import {
  aDegradado,
  aSolido,
  repartirParadas,
  SUGERIDOS_FONDO,
  SUGERIDOS_LETRA,
  variarLuminosidad30
} from '../../karaoke/colores'
import { sugerirResaltado, type EvaluacionContraste } from '../../karaoke/contraste'
import { E } from './textos'
import estilos from './panelEstilo.module.css'

export interface PanelEstiloProps {
  estilo: Estilo
  predeterminado: Estilo
  contraste: EvaluacionContraste
  inactivo: boolean
  alCambiar(estilo: Estilo, clave: string, agruparGesto?: boolean): void
  alCambiarPredeterminado(estilo: Estilo): void
}

type OrigenColor = 'hex' | 'nativo' | 'sugerido'
type CampoColorLetra = 'color' | 'color_resaltado'

const AVISOS = {
  letra: E.contrasteLetra,
  resaltado: E.contrasteResaltado,
  diferencia: E.contrasteDiferencia
}
const TEXTO_NIVEL = {
  ok: E.contrasteOk,
  justo: E.contrasteJusto,
  aviso: 'Contraste bajo'
}
const ACCIONES_LETRA = {
  blanca: { etiqueta: E.usarBlanca, color: '#FFFFFF' },
  negra: { etiqueta: E.usarNegra, color: '#111111' }
}

function MensajeContraste({
  tipo,
  children
}: {
  tipo: 'exito' | 'info' | 'aviso'
  children: ReactNode
}) {
  const icono = tipo === 'exito' ? CircleCheck : tipo === 'info' ? Info : TriangleAlert
  return (
    <div className={[base.banner, base[tipo]].join(' ')}>
      <Icono icono={icono} className={base.bannerIcono} />
      <div className={base.bannerTexto}>{children}</div>
    </div>
  )
}

export function PanelEstilo(props: PanelEstiloProps | { estilo?: undefined }) {
  return props.estilo ? <PanelEstiloActivo {...props} /> : null
}

function PanelEstiloActivo({
  estilo,
  predeterminado,
  contraste,
  inactivo,
  alCambiar,
  alCambiarPredeterminado
}: PanelEstiloProps) {
  const id = useId()
  const secuencia = useRef(0)
  const selectorNativo = useRef<{ campo: string; clave: string } | null>(null)
  const gestoAngulo = useRef<string | null>(null)
  const [guardandoPredeterminado, setGuardandoPredeterminado] = useState(false)
  const { fondo, letra } = estilo
  // El esquema fija el orden de las propiedades de ambos objetos antes de comparar.
  const esPredeterminado =
    JSON.stringify(estiloSchema.parse(estilo)) ===
    JSON.stringify(estiloSchema.parse(predeterminado))

  function claveNueva(campo: string): string {
    return [campo, id, ++secuencia.current].join(':')
  }

  function abrirNativo(campo: string): void {
    selectorNativo.current = { campo, clave: claveNueva(campo) }
  }

  function cambiarColor(nuevo: Estilo, campo: string, origen: OrigenColor): void {
    if (inactivo) return
    if (origen === 'nativo') {
      if (selectorNativo.current?.campo !== campo) abrirNativo(campo)
      alCambiar(nuevo, selectorNativo.current!.clave, true)
      return
    }
    selectorNativo.current = null
    alCambiar(nuevo, campo)
  }

  function cambiarFondo(nuevo: Fondo, clave: string, agruparGesto?: boolean): void {
    if (!inactivo) alCambiar({ ...estilo, fondo: nuevo }, clave, agruparGesto)
  }

  function accionColor(campo: CampoColorLetra, color: string): void {
    if (!inactivo) alCambiar({ ...estilo, letra: { ...letra, [campo]: color } }, claveNueva(campo))
  }

  async function guardarPredeterminado(): Promise<void> {
    if (inactivo || esPredeterminado || guardandoPredeterminado) return
    setGuardandoPredeterminado(true)
    try {
      const config = await window.shinobi.config.actualizar({ estilo_predeterminado: estilo })
      alCambiarPredeterminado(config.estilo_predeterminado)
      mostrarToast({ tipo: 'exito', mensaje: E.estiloPredeterminadoToast })
    } catch {
      mostrarToast({ tipo: 'error', mensaje: E.errorGuardado })
    } finally {
      setGuardandoPredeterminado(false)
    }
  }

  return (
    <div className={estilos.panel} inert={inactivo} aria-disabled={inactivo || undefined}>
      <section className={estilos.bloque}>
        <h3>{E.fondo}</h3>
        <div data-foco-editor="segmentado">
          <ControlSegmentado
            etiqueta={E.fondo}
            valor={fondo.tipo}
            opciones={[
              { valor: 'solido', etiqueta: E.solido },
              { valor: 'degradado', etiqueta: E.degradado }
            ]}
            onCambio={(tipo) =>
              cambiarFondo(
                tipo === 'solido' ? aSolido(fondo) : aDegradado(fondo),
                claveNueva('fondo.tipo')
              )
            }
          />
        </div>
        {fondo.tipo === 'solido' ? (
          <div data-foco-editor="segmentado">
            <SelectorColor
              etiqueta={E.color}
              valor={fondo.color}
              sugeridos={SUGERIDOS_FONDO}
              alAbrirNativo={() => abrirNativo('fondo.color')}
              alCambiar={(color, origen) =>
                cambiarColor({ ...estilo, fondo: { ...fondo, color } }, 'fondo.color', origen)
              }
            />
          </div>
        ) : (
          <>
            <div data-foco-editor="dial">
              <DialAngulo
                etiqueta={E.angulo}
                valor={fondo.angulo_grados}
                alCambiar={(angulo_grados, { arrastrando }) => {
                  if (arrastrando) gestoAngulo.current ??= claveNueva('fondo.angulo')
                  const clave = gestoAngulo.current
                  if (!arrastrando) gestoAngulo.current = null
                  cambiarFondo({ ...fondo, angulo_grados }, clave ?? 'fondo.angulo', clave !== null)
                }}
              />
            </div>
            <h4>{E.colores}</h4>
            <ol className={estilos.paradas}>
              {fondo.paradas.map((parada, i) => {
                const campo = 'fondo.paradas.' + i
                return (
                  <li key={i} className={estilos.parada}>
                    <div data-foco-editor="segmentado">
                      <SelectorColor
                        etiqueta={E.color + ' ' + (i + 1)}
                        valor={parada.color}
                        sugeridos={SUGERIDOS_FONDO}
                        alAbrirNativo={() => abrirNativo(campo)}
                        alCambiar={(color, origen) => {
                          const colores = fondo.paradas.map((p, j) => (i === j ? color : p.color))
                          cambiarColor(
                            { ...estilo, fondo: { ...fondo, paradas: repartirParadas(colores) } },
                            campo,
                            origen
                          )
                        }}
                      />
                    </div>
                    {fondo.paradas.length > 2 && (
                      <BotonIcono
                        icono={X}
                        etiqueta={E.quitarColor}
                        className={estilos.quitar}
                        onClick={() => {
                          const colores = fondo.paradas.flatMap((p, j) =>
                            i === j ? [] : [p.color]
                          )
                          cambiarFondo(
                            { ...fondo, paradas: repartirParadas(colores) },
                            claveNueva('fondo.quitar')
                          )
                        }}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
            {fondo.paradas.length < 4 && (
              <Boton
                onClick={() => {
                  const colores = fondo.paradas.map((p) => p.color)
                  colores.push(variarLuminosidad30(colores.at(-1)!))
                  cambiarFondo(
                    { ...fondo, paradas: repartirParadas(colores) },
                    claveNueva('fondo.anadir')
                  )
                }}
              >
                <Icono icono={Plus} tamano={16} />
                {E.anadirColor}
              </Boton>
            )}
          </>
        )}
      </section>
      <section className={estilos.bloque}>
        <h3>{E.letra}</h3>
        <div data-foco-editor="segmentado">
          <SelectorFuente
            valor={letra.fuente.familia}
            alCambiar={(familia) => {
              if (!inactivo)
                alCambiar(
                  { ...estilo, letra: { ...letra, fuente: { ...letra.fuente, familia } } },
                  'letra.fuente'
                )
            }}
          />
        </div>
        {(['color', 'color_resaltado'] as const).map((campo) => {
          const clave = 'letra.' + campo
          return (
            <div key={campo} data-foco-editor="segmentado">
              <SelectorColor
                etiqueta={campo === 'color' ? E.colorLetra : E.colorResaltado}
                valor={letra[campo]}
                sugeridos={SUGERIDOS_LETRA}
                alAbrirNativo={() => abrirNativo(clave)}
                alCambiar={(color, origen) =>
                  cambiarColor({ ...estilo, letra: { ...letra, [campo]: color } }, clave, origen)
                }
              />
            </div>
          )
        })}
      </section>
      <div className={estilos.bloque}>
        <div role="status">
          {contraste.nivel === 'aviso' ? (
            <span className={base.soloLector}>{TEXTO_NIVEL.aviso}</span>
          ) : (
            <MensajeContraste tipo={contraste.nivel === 'ok' ? 'exito' : 'info'}>
              {TEXTO_NIVEL[contraste.nivel]}
            </MensajeContraste>
          )}
        </div>
        {contraste.avisos.map((aviso) => (
          <MensajeContraste key={aviso} tipo="aviso">
            <p>{AVISOS[aviso]}</p>
            {aviso === 'letra' ? (
              <>
                {contraste.sugerirFondo && <p>{E.contrasteFondo}</p>}
                <div className={estilos.acciones}>
                  {contraste.accionesLetra.map((accion) => (
                    <Boton
                      key={accion}
                      onClick={() => accionColor('color', ACCIONES_LETRA[accion].color)}
                    >
                      {ACCIONES_LETRA[accion].etiqueta}
                    </Boton>
                  ))}
                </div>
              </>
            ) : (
              <Boton onClick={() => accionColor('color_resaltado', sugerirResaltado(estilo))}>
                {E.sugerirResaltado}
              </Boton>
            )}
          </MensajeContraste>
        ))}
      </div>
      <div className={estilos.bloque}>
        <Boton
          onClick={() => {
            if (!inactivo) alCambiar(predeterminado, claveNueva('restablecer'))
          }}
        >
          {E.resetEstilo}
        </Boton>
        <Boton
          disabled={inactivo || esPredeterminado || guardandoPredeterminado}
          onClick={() => void guardarPredeterminado()}
        >
          {E.estiloPredeterminado}
        </Boton>
      </div>
    </div>
  )
}
