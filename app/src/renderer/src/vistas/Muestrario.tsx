import { useState } from 'react'
import { Copy, Pencil, Play, Settings, Trash2 } from 'lucide-react'
import { AreaTexto, CampoTexto } from '../componentes/Campos'
import { AvisoEnLinea } from '../componentes/AvisoEnLinea'
import { BarraProgreso } from '../componentes/BarraProgreso'
import { Boton } from '../componentes/Boton'
import { BotonIcono } from '../componentes/BotonIcono'
import { ControlSegmentado } from '../componentes/ControlSegmentado'
import { Dialogo } from '../componentes/Dialogo'
import { Icono } from '../componentes/Icono'
import { InsigniaEstado, type EstadoInsignia } from '../componentes/InsigniaEstado'
import { MenuContextual } from '../componentes/MenuContextual'
import { Tooltip } from '../componentes/Tooltip'
import { mostrarToast } from '../componentes/gestorToasts'
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
        </div>
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
