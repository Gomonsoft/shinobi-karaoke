import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, Info, Plus, TriangleAlert, X } from 'lucide-react'
import type { Estilo, Fondo } from '@shared/estilo'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { Icono } from '../../componentes/Icono'
import { SelectorColor } from '../../componentes/SelectorColor'
import { SelectorFuente } from '../../componentes/SelectorFuente'
import base from '../../componentes/componentes.module.css'
import {
  aDegradado,
  aSolido,
  SUGERIDOS_FONDO,
  SUGERIDOS_LETRA,
  variarLuminosidad30
} from '../../karaoke/colores'
import { sugerirResaltado, type EvaluacionContraste } from '../../karaoke/contraste'
import { fondoCss } from '../../karaoke/estiloCss'
import { buscarFuente } from '@shared/fuentes'
import { ofreceEditarTema, puedeEditarTema, SeccionTema, type ControlTema } from './SeccionTema'
import { ControlesFondo, ControlesMovimiento, resumenFondo } from './estilo/ControlesFondo'
import { paradasRepartidas } from './estilo/paradas'
import { SeccionEspera, type ControlEspera } from './estilo/SeccionEspera'
import { SeccionPantalla, type ControlPantalla } from './estilo/SeccionPantalla'
import { T_SUBRAYADO as TS } from './estilo/textosSubrayado'
import { E } from './textos'
import { LL } from './textosLetraLista'
import estilos from './panelEstilo.module.css'

export interface PanelEstiloProps {
  /** Estilo visible: el propio (D2), el borrador (D3) o el del tema (D1, D4, solo lectura). */
  estilo: Estilo
  contraste: EvaluacionContraste
  /** Letra lista: «resaltado» y «diferencia» se presentan como informativos (salvo en D3). */
  soloEditor?: boolean
  inactivo: boolean
  alCambiar(estilo: Estilo, clave: string, agruparGesto?: boolean): void
  tema: ControlTema
  /** Sección «Indicadores de espera» (0212); sin él no se muestra. */
  espera?: ControlEspera
  /** Sección «Letra en pantalla» (0291); sin él no se muestra. */
  pantalla?: ControlPantalla
  /** Ajustes activa «Subrayar siempre lo ya cantado» en este equipo: nota bajo la casilla. */
  subrayadoDelEquipo?: boolean
}

type OrigenColor = 'hex' | 'nativo' | 'sugerido'
type CampoColorLetra = 'color' | 'color_resaltado'

const AVISOS = {
  letra: E.contrasteLetra,
  resaltado: E.contrasteResaltado,
  diferencia: E.contrasteDiferencia,
  daltonismo: TS.daltonismo
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

/** D1 y D4: fondo y letra del tema en solo lectura (texto seleccionable, sin controles). */
function ResumenSoloLectura({ estilo }: { estilo: Estilo }) {
  const { fondo, letra } = estilo
  const fuente = buscarFuente(letra.fuente.familia)?.familia ?? letra.fuente.familia
  return (
    <section
      className={estilos.bloque}
      aria-label={E.tema.resumen.fondo + ' y ' + E.tema.resumen.letra}
    >
      <dl className={estilos.resumen}>
        <dt>{E.tema.resumen.fondo}</dt>
        <dd>
          <span
            className={estilos.muestraFondo}
            style={{ background: fondoCss(fondo) }}
            aria-hidden="true"
          />
          {resumenFondo(fondo)}
        </dd>
        <dt>{E.tema.resumen.letra}</dt>
        <dd>
          <span style={{ fontFamily: `"${fuente}"` }}>{fuente}</span>
          <span className={estilos.colorResumen}>
            <span
              className={estilos.muestraColor}
              style={{ background: letra.color }}
              aria-hidden="true"
            />
            Letra {letra.color}
          </span>
          <span className={estilos.colorResumen}>
            <span
              className={estilos.muestraColor}
              style={{ background: letra.color_resaltado }}
              aria-hidden="true"
            />
            Lo ya cantado {letra.color_resaltado}
          </span>
          {letra.subrayar_cantado && <span>{TS.resumen}</span>}
        </dd>
      </dl>
    </section>
  )
}

/** El pie de D3 es fijo mientras el panel mida >= 200 px de alto; por debajo, va al final. */
function usePieEstatico(raiz: React.RefObject<HTMLDivElement | null>, activo: boolean): boolean {
  const [estatico, setEstatico] = useState(false)
  useEffect(() => {
    const zona = raiz.current?.parentElement
    if (!activo || !zona || typeof ResizeObserver === 'undefined') return
    const medir = () => setEstatico(zona.clientHeight > 0 && zona.clientHeight < 200)
    const o = new ResizeObserver(medir)
    o.observe(zona)
    medir()
    return () => o.disconnect()
  }, [raiz, activo])
  return activo && estatico
}

export function PanelEstilo(props: PanelEstiloProps | { estilo?: undefined }) {
  return props.estilo ? <PanelEstiloActivo {...props} /> : null
}

function PanelEstiloActivo({
  estilo,
  contraste,
  soloEditor = false,
  inactivo,
  alCambiar,
  tema,
  espera,
  pantalla,
  subrayadoDelEquipo = false
}: PanelEstiloProps) {
  const id = useId()
  const idSubrayado = useId()
  const casillaSubrayado = useRef<HTMLInputElement>(null)
  const secuencia = useRef(0)
  const selectorNativo = useRef<{ campo: string; clave: string } | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const { vista } = tema
  const editable = vista.estado === 'd2' || vista.estado === 'd3'
  const pieEstatico = usePieEstatico(raiz, vista.estado === 'd3')
  const puedeEditar = puedeEditarTema(vista)
  const ofreceEditar = ofreceEditarTema(vista)
  const { fondo, letra } = estilo
  const forma = fondo.tipo === 'degradado' ? (fondo.forma ?? 'lineal') : 'lineal'

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

  function cambiarSubrayado(activo: boolean): void {
    if (inactivo) return
    const { subrayar_cantado: _anterior, ...resto } = letra
    void _anterior
    alCambiar(
      { ...estilo, letra: activo ? { ...resto, subrayar_cantado: true } : resto },
      'letra.subrayar_cantado'
    )
  }

  function accionSubrayar(): void {
    cambiarSubrayado(true)
    casillaSubrayado.current?.focus()
  }

  function accionColor(campo: CampoColorLetra, color: string): void {
    if (!inactivo) alCambiar({ ...estilo, letra: { ...letra, [campo]: color } }, claveNueva(campo))
  }

  return (
    <div
      ref={raiz}
      className={estilos.panel}
      data-pie-estatico={pieEstatico || undefined}
      inert={inactivo}
      aria-disabled={inactivo || undefined}
    >
      <SeccionTema control={tema} inactivo={inactivo} />
      {!editable && <ResumenSoloLectura estilo={estilo} />}
      {editable && (
        <>
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
                <ControlesFondo
                  fondo={fondo}
                  claveNueva={claveNueva}
                  alCambiar={(nuevo, clave, agrupar) => cambiarFondo(nuevo, clave, agrupar)}
                />
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
                              const colores = fondo.paradas.map((p, j) =>
                                i === j ? color : p.color
                              )
                              cambiarColor(
                                {
                                  ...estilo,
                                  fondo: { ...fondo, paradas: paradasRepartidas(colores, forma) }
                                },
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
                                { ...fondo, paradas: paradasRepartidas(colores, forma) },
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
                        { ...fondo, paradas: paradasRepartidas(colores, forma) },
                        claveNueva('fondo.anadir')
                      )
                    }}
                  >
                    <Icono icono={Plus} tamano={16} />
                    {E.anadirColor}
                  </Boton>
                )}
                <ControlesMovimiento
                  fondo={fondo}
                  claveNueva={claveNueva}
                  alCambiar={(nuevo, clave, agrupar) => cambiarFondo(nuevo, clave, agrupar)}
                />
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
                      cambiarColor(
                        { ...estilo, letra: { ...letra, [campo]: color } },
                        clave,
                        origen
                      )
                    }
                  />
                </div>
              )
            })}
            <label className={estilos.casilla}>
              <input
                ref={casillaSubrayado}
                type="checkbox"
                checked={!!letra.subrayar_cantado}
                aria-describedby={idSubrayado}
                onChange={(e) => cambiarSubrayado(e.currentTarget.checked)}
              />
              {TS.etiqueta}
            </label>
            <div id={idSubrayado}>
              <p className={estilos.nota}>{TS.ayuda}</p>
              {subrayadoDelEquipo && <p className={estilos.nota}>ⓘ {TS.global}</p>}
              {soloEditor && vista.estado !== 'd3' && (
                <p className={estilos.nota}>{LL.contrasteSoloEditor}</p>
              )}
            </div>
          </section>
        </>
      )}
      {pantalla && <SeccionPantalla control={pantalla} inactivo={inactivo} />}
      {espera && <SeccionEspera control={espera} inactivo={inactivo} />}
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
        {(editable ? contraste.avisos : contraste.avisos.slice(0, 1)).map((aviso) => (
          <MensajeContraste
            key={aviso}
            tipo={soloEditor && aviso !== 'letra' && vista.estado !== 'd3' ? 'info' : 'aviso'}
          >
            <p>{AVISOS[aviso]}</p>
            {soloEditor && aviso !== 'letra' && vista.estado !== 'd3' && (
              <p>{LL.contrasteSoloEditor}</p>
            )}
            {!editable ? (
              <>
                <p>{E.tema.contrasteAyuda(ofreceEditar)}</p>
                <div className={estilos.acciones}>
                  <Boton onClick={tema.acciones.personalizar}>{E.tema.personalizar}</Boton>
                  {ofreceEditar && (
                    <Boton
                      noDisponible={puedeEditar ? undefined : E.tema.sinTemaQueEditar}
                      onClick={tema.acciones.editar}
                    >
                      {E.tema.editar}
                    </Boton>
                  )}
                </div>
              </>
            ) : aviso === 'letra' ? (
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
              <div className={estilos.acciones}>
                {aviso !== 'resaltado' && <Boton onClick={accionSubrayar}>{TS.subrayar}</Boton>}
                <Boton onClick={() => accionColor('color_resaltado', sugerirResaltado(estilo))}>
                  {E.sugerirResaltado}
                </Boton>
              </div>
            )}
          </MensajeContraste>
        ))}
        {editable &&
          contraste.informativos.map((aviso) => (
            <MensajeContraste key={aviso} tipo="info">
              <p>{TS.diferenciaSubrayado}</p>
              <Boton onClick={() => accionColor('color_resaltado', sugerirResaltado(estilo))}>
                {E.sugerirResaltado}
              </Boton>
            </MensajeContraste>
          ))}
      </div>
      {vista.estado === 'd3' && (
        <div className={estilos.pie}>
          <Boton variante="primario" onClick={tema.acciones.guardarEn}>
            {E.tema.guardarEn}
          </Boton>
          <Boton onClick={tema.acciones.descartar}>{E.tema.descartar}</Boton>
          <Boton className={estilos.pieAncho} onClick={tema.acciones.guardarNuevo}>
            {E.tema.guardarNuevo}
          </Boton>
        </div>
      )}
    </div>
  )
}
