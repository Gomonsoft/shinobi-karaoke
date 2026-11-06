import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { estiloPredeterminado } from '@shared/estilo'
import { FUENTES_REGISTRO } from '@shared/fuentes'
import { letra, linea } from '@shared/__fixtures__'
import { PantallaLetra } from '../karaoke/PantallaLetra'
import { Copy, Pencil, Play, Settings, Trash2 } from 'lucide-react'
import { AreaTexto, CampoTexto } from '../componentes/Campos'
import { AvisoEnLinea } from '../componentes/AvisoEnLinea'
import { BarraProgreso } from '../componentes/BarraProgreso'
import { Boton } from '../componentes/Boton'
import { BotonIcono } from '../componentes/BotonIcono'
import { ControlSegmentado } from '../componentes/ControlSegmentado'
import { Dialogo } from '../componentes/Dialogo'
import { SelectorColor } from '../componentes/SelectorColor'
import { SelectorFuente } from '../componentes/SelectorFuente'
import { DialAngulo } from '../componentes/DialAngulo'
import { Deslizador } from '../componentes/Deslizador'
import { SUGERIDOS_FONDO } from '../karaoke/colores'
import { Icono } from '../componentes/Icono'
import { InsigniaEstado, type EstadoInsignia } from '../componentes/InsigniaEstado'
import { MenuContextual } from '../componentes/MenuContextual'
import { Popover } from '../componentes/Popover'
import { Tooltip } from '../componentes/Tooltip'
import { mostrarToast } from '../componentes/gestorToasts'
import { Reproductor, type CancionReproductor } from './reproductor/Reproductor'
import type { EstadoMotorReproductor } from '../karaoke/motorReproductor'
import { MuestrarioFuentes } from './MuestrarioFuentes'

const SUPERFICIES = ['fondo-0', 'fondo-1', 'fondo-2', 'fondo-3', 'borde', 'borde-control']
const TEXTOS = ['texto-1', 'texto-2', 'texto-3']
const ACENTOS = ['acento', 'acento-hover', 'acento-pulsado', 'acento-texto', 'foco']
const ESTADOS: [string, string][] = [
  ['exito', 'exito-tenue'],
  ['aviso', 'aviso-tenue'],
  ['error', 'error-tenue'],
  ['info', 'info-tenue']
]
const ESCALA = [
  't-display',
  't-titulo',
  't-subtitulo',
  't-cuerpo',
  't-cuerpo-fuerte',
  't-pequeno',
  't-tiempo'
]

const muestra = (token: string) => (
  <li key={token} className="muestra">
    <span className="muestra__color" style={{ background: `var(--${token})` }} />
    <code className="t-pequeno">--{token}</code>
  </li>
)

/** Página de desarrollo (solo `npm run dev`) para revisión visual del diseñador. */
export function Muestrario() {
  return (
    <main id="contenido" className="muestrario">
      <h1 className="t-titulo">Muestrario del sistema visual</h1>

      <section aria-labelledby="m-paleta">
        <h2 id="m-paleta" className="t-subtitulo">
          Paleta
        </h2>
        <ul className="muestras">
          {[...SUPERFICIES, ...TEXTOS, ...ACENTOS].map(muestra)}
          {ESTADOS.flatMap(([a, b]) => [muestra(a), muestra(b)])}
        </ul>
      </section>

      <section aria-labelledby="m-tipo">
        <h2 id="m-tipo" className="t-subtitulo">
          Escala tipográfica
        </h2>
        {ESCALA.map((t) => (
          <p key={t} className={t}>
            {t}: ¿Cantamos? Ñandú 0123456789 Il1O0 <span className="t-tiempo">01:23.45</span>
          </p>
        ))}
      </section>

      <section aria-labelledby="m-foco">
        <h2 id="m-foco" className="t-subtitulo">
          Foco (usa Tab)
        </h2>
        <div className="fila">
          <Boton variante="primario">
            <Icono icono={Play} /> Primario
          </Boton>
          <Boton>Secundario</Boton>
          <CampoTexto etiqueta="Campo de ejemplo" defaultValue="Campo" />
        </div>
        <div className="foco-doble fila" style={{ background: '#f2e8d5', padding: 16 }}>
          <Boton>Foco doble sobre fondo claro</Boton>
        </div>
      </section>

      <MuestrarioFuentes />

      <Componentes />
      <ControlesEditor />
      <MuestrarioReproductor />
      <PreviasKaraoke />
    </main>
  )
}

const ESTADOS_INSIGNIA: EstadoInsignia[] = [
  'lista',
  'borrador',
  'en-curso',
  'en-cola',
  'interrumpido',
  'error',
  'danada'
]

function Componentes() {
  const [segmento, setSegmento] = useState('solido')
  const [dialogo, setDialogo] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [popover, setPopover] = useState(false)
  const anclaPopover = useRef<HTMLButtonElement>(null)
  return (
    <>
      <section aria-labelledby="m-botones">
        <h2 id="m-botones" className="t-subtitulo">
          Botones
        </h2>
        {(['normal', 'grande'] as const).map((tamano) => (
          <div key={tamano} className="fila">
            <Boton variante="primario" tamano={tamano}>
              Primario
            </Boton>
            <Boton tamano={tamano}>Secundario</Boton>
            <Boton variante="fantasma" tamano={tamano}>
              Fantasma
            </Boton>
            <Boton variante="destructivo" tamano={tamano}>
              Eliminar
            </Boton>
            <Boton variante="primario" tamano={tamano} noDisponible="Falta la letra sincronizada">
              No disponible
            </Boton>
            <Boton tamano={tamano} disabled>
              Desactivado trivial
            </Boton>
          </div>
        ))}
        <div className="fila">
          <Boton
            variante="primario"
            cargando={cargando}
            textoCargando="Guardando…"
            onClick={() => {
              setCargando(true)
              setTimeout(() => setCargando(false), 2000)
            }}
          >
            Guardar
          </Boton>
          <BotonIcono icono={Settings} etiqueta="Ajustes" />
          <BotonIcono icono={Pencil} etiqueta="Editar (activo)" activo />
          <BotonIcono icono={Play} etiqueta="Reproducir" tamano="grande" />
          <BotonIcono icono={Play} etiqueta="Reproducir" noDisponible="Aún no hay audio" />
          <Tooltip contenido="Tooltip a los 500 ms o con foco">
            <Boton variante="fantasma">Pasa el ratón</Boton>
          </Tooltip>
          <MenuContextual
            etiqueta="Más acciones de la canción de ejemplo"
            items={[
              { id: 'dup', etiqueta: 'Duplicar', icono: Copy, alSeleccionar: () => {} },
              {
                id: 'del',
                etiqueta: 'Eliminar',
                icono: Trash2,
                destructivo: true,
                alSeleccionar: () => {}
              }
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="m-estado">
        <h2 id="m-estado" className="t-subtitulo">
          Insignias y progreso
        </h2>
        <div className="fila">
          {ESTADOS_INSIGNIA.map((e) => (
            <InsigniaEstado key={e} estado={e} />
          ))}
        </div>
        <div style={{ display: 'grid', gap: 'var(--e-3)', maxWidth: '30rem' }}>
          <BarraProgreso
            etiqueta="Determinada"
            valor={42}
            textoValor="42 %, quedan unos 3 minutos"
          />
          <BarraProgreso etiqueta="Grande" valor={70} grande />
          <BarraProgreso etiqueta="Indeterminada" indeterminada />
          <BarraProgreso etiqueta="Con error" valor={30} error />
        </div>
      </section>

      <section aria-labelledby="m-campos">
        <h2 id="m-campos" className="t-subtitulo">
          Campos y selección
        </h2>
        <div style={{ display: 'grid', gap: 'var(--e-4)', maxWidth: '30rem' }}>
          <CampoTexto etiqueta="Título" ayuda="Aparece en la tarjeta." defaultValue="Mi canción" />
          <CampoTexto etiqueta="Artista" error="Escribe un artista." defaultValue="" />
          <CampoTexto etiqueta="Solo lectura" readOnly defaultValue="No editable" />
          <AreaTexto etiqueta="Letra" ayuda="Pega la letra, una línea por verso." />
          <ControlSegmentado
            etiqueta="Tipo de fondo"
            valor={segmento}
            onCambio={setSegmento}
            opciones={[
              { valor: 'solido', etiqueta: 'Sólido' },
              { valor: 'degradado', etiqueta: 'Degradado' },
              {
                valor: 'imagen',
                etiqueta: 'Imagen',
                noDisponible: 'Disponible en una versión futura'
              }
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="m-avisos">
        <h2 id="m-avisos" className="t-subtitulo">
          Avisos, toasts y diálogo
        </h2>
        <div style={{ display: 'grid', gap: 'var(--e-2)', maxWidth: '40rem' }}>
          <AvisoEnLinea tipo="info">Información.</AvisoEnLinea>
          <AvisoEnLinea tipo="aviso" accion={<Boton variante="fantasma">Revisar</Boton>}>
            Aviso con acción.
          </AvisoEnLinea>
          <AvisoEnLinea tipo="error">Error (role=alert).</AvisoEnLinea>
          <AvisoEnLinea tipo="exito">Éxito.</AvisoEnLinea>
        </div>
        <div className="fila">
          {(['info', 'aviso', 'error', 'exito'] as const).map((tipo) => (
            <Boton
              key={tipo}
              onClick={() => mostrarToast({ tipo, mensaje: `Toast de tipo ${tipo}` })}
            >
              Toast {tipo}
            </Boton>
          ))}
          <Boton
            onClick={() =>
              mostrarToast({
                tipo: 'info',
                mensaje: 'Toast con acción (no caduca)',
                accion: { etiqueta: 'Deshacer', alAccionar: () => {} }
              })
            }
          >
            Toast con acción
          </Boton>
          <Boton variante="primario" onClick={() => setDialogo(true)}>
            Abrir diálogo
          </Boton>
          <Boton ref={anclaPopover} onClick={() => setPopover(true)} aria-expanded={popover}>
            Mostrar requisitos
          </Boton>
        </div>
        <Popover
          abierto={popover}
          ancla={anclaPopover}
          alCerrar={() => setPopover(false)}
          titulo="Para continuar falta"
          etiqueta="Requisitos"
        >
          <Boton onClick={() => setPopover(false)}>Revisar la letra</Boton>
        </Popover>
        <Dialogo
          abierto={dialogo}
          titulo="¿Eliminar la canción?"
          onCancelar={() => setDialogo(false)}
          acciones={
            <>
              <Boton variante="fantasma" onClick={() => setDialogo(false)}>
                Cancelar
              </Boton>
              <Boton variante="destructivo" onClick={() => setDialogo(false)}>
                Eliminar
              </Boton>
            </>
          }
        >
          <p>Esta acción no se puede deshacer.</p>
        </Dialogo>
      </section>
    </>
  )
}

function ControlesEditor() {
  const [color, setColor] = useState<string>('#1B1033')
  const [fuente, setFuente] = useState('Atkinson Hyperlegible Next')
  const [angulo, setAngulo] = useState(135)
  const [volumen, setVolumen] = useState(0.8)
  return (
    <section aria-labelledby="m-editor">
      <h2 id="m-editor" className="t-subtitulo">
        Controles del editor
      </h2>
      <div style={{ display: 'grid', gap: 'var(--e-4)', maxWidth: '30rem' }}>
        <SelectorColor
          etiqueta="Fondo"
          valor={color}
          sugeridos={SUGERIDOS_FONDO}
          alCambiar={setColor}
        />
        <SelectorFuente valor={fuente} alCambiar={setFuente} />
        <DialAngulo valor={angulo} alCambiar={setAngulo} />
        <Deslizador
          etiqueta="Volumen"
          valor={volumen}
          textoValor={`${Math.round(volumen * 100)} %`}
          alCambiar={setVolumen}
        />
      </div>
    </section>
  )
}

const letraMuestrario = letra([
  linea('m1', 'El viento mueve las luces sobre la ciudad', 1000),
  linea('m2', '¿Cantamos? Ñandú', 5000)
])

function PreviasKaraoke() {
  return (
    <section aria-labelledby="m-karaoke">
      <h2 id="m-karaoke" className="t-subtitulo">
        Render de karaoke
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))',
          gap: 'var(--e-3)'
        }}
      >
        {FUENTES_REGISTRO.map(({ familia }) => {
          const estilo = estiloPredeterminado()
          estilo.letra.fuente.familia = familia
          return (
            <figure key={familia} style={{ margin: 0 }}>
              <figcaption>{familia}</figcaption>
              <div style={{ aspectRatio: '16 / 9' }}>
                <PantallaLetra
                  letra={letraMuestrario}
                  estilo={estilo}
                  duracionMs={30_000}
                  titulo="Ejemplo de karaoke"
                  artista="Shinobi"
                  reproduciendo={false}
                />
              </div>
            </figure>
          )
        })}
      </div>
    </section>
  )
}

const cancionReproductorMuestrario: CancionReproductor = {
  id: 'muestrario-reproductor',
  titulo: 'Canción de ejemplo',
  artista: 'Shinobi Karaoke',
  duracionMs: 30_000,
  gananciaDb: 0,
  letra: letra([
    linea('r1', 'El viento mueve las luces', 2000),
    linea('r2', 'sobre el río de papel', 6000),
    linea('r3', 'y la ciudad despierta', 10_000)
  ]),
  estilo: estiloPredeterminado(),
  lineasSinSincronizar: 0
}

function MuestrarioReproductor() {
  const [abierto, setAbierto] = useState(false)
  const apiAnterior = useRef<typeof window.shinobi | null>(null)
  const completa = useRef(false)
  const oyentesPantalla = useRef(new Set<(activa: boolean) => void>())
  const oyentesMotor = useRef(new Set<(estado: EstadoMotorReproductor) => void>())
  const estadoMotor = useRef<EstadoMotorReproductor>({
    listo: true,
    cargando: false,
    sonando: true,
    finalizado: false,
    duracionMs: 30_000,
    vozDisponible: true,
    errorPrincipal: null,
    errorVoz: null
  })
  const volumen = {
    volumen: 0.8,
    silenciado: false,
    volumenVoz: 0.3,
    vozSilenciada: true,
    cambiar: () => undefined
  }

  function fabricarMotor() {
    return {
      cargar: async () => undefined,
      reproducir: async () => {
        estadoMotor.current = { ...estadoMotor.current, sonando: true }
        for (const oyente of oyentesMotor.current) oyente(estadoMotor.current)
      },
      pausar: () => {
        estadoMotor.current = { ...estadoMotor.current, sonando: false }
        for (const oyente of oyentesMotor.current) oyente(estadoMotor.current)
      },
      buscar: () => undefined,
      posicionMs: () => 0,
      fijarVolumen: () => undefined,
      fijarVoz: () => undefined,
      estado: () => estadoMotor.current,
      suscribir: (oyente: (estado: EstadoMotorReproductor) => void) => {
        oyentesMotor.current.add(oyente)
        oyente(estadoMotor.current)
        return () => oyentesMotor.current.delete(oyente)
      },
      destruir: () => undefined
    } as never
  }

  function cambiarPantalla(activa: boolean): void {
    completa.current = activa
    for (const oyente of oyentesPantalla.current) oyente(activa)
  }

  function abrir(): void {
    const api = window.shinobi
    apiAnterior.current = api
    window.shinobi = {
      ...api,
      ventana: {
        modoReproductor: async (activo) => cambiarPantalla(activo),
        fijarPantallaCompleta: async (activa) => cambiarPantalla(activa),
        estaEnPantallaCompleta: async () => completa.current,
        evitarReposo: async () => undefined,
        alCambiarPantallaCompleta: (cb) => {
          oyentesPantalla.current.add(cb)
          return () => oyentesPantalla.current.delete(cb)
        }
      }
    }
    setAbierto(true)
  }

  function cerrar(): void {
    flushSync(() => setAbierto(false))
    if (apiAnterior.current) window.shinobi = apiAnterior.current
    apiAnterior.current = null
  }

  return (
    <section aria-labelledby="m-reproductor">
      <h2 id="m-reproductor" className="t-subtitulo">
        Reproductor
      </h2>
      <p>Prueba la capa a pantalla completa con audio y controles simulados.</p>
      <Boton variante="primario" onClick={abrir}>
        Abrir reproductor de ejemplo
      </Boton>
      {abierto && (
        <Reproductor
          cancion={cancionReproductorMuestrario}
          origen="biblioteca"
          modo="karaoke"
          desdeMs={0}
          volumen={volumen}
          alSalir={cerrar}
          crearMotor={fabricarMotor}
        />
      )}
    </section>
  )
}
