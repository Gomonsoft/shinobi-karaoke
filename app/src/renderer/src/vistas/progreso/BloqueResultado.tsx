import type { ReactNode } from 'react'
import { Check, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { Preparacion } from '@shared/cancion'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { LP } from '../letra/preparacion'
import { K } from '../editor/comprobar/textos'
import type { ResultadoPrep } from './preparacion'
import { PREP } from './textosPreparacion'
import estilos from './progreso.module.css'

interface Props {
  resultado: ResultadoPrep
  registro: Preparacion | null | undefined
  desfaseCorregidoMs: number | null
  /** Texto del candado de sesión de «Revisar» y «Elegir/Añadir la letra». */
  atributos(etiqueta: string): { 'aria-disabled'?: true; 'aria-label'?: string }
  candado: ReactNode
  alRevisar(): void
  alProbar(): void
  alAbrirLetra(): void
  alReintentar(): void
}

const ICONO: Record<ResultadoPrep, LucideIcon> = {
  revisar: Check,
  elige: Info,
  sinLetra: Info,
  instrumental: Info,
  pendiente: TriangleAlert
}

/**
 * Bloque de resultado de la preparación (R1 a R4 de docs/ux/04 · Feature 5): sustituye a «Terminado».
 * R2 y R3 son `info` (necesitan al usuario, no son fallos); R4 es un aviso por la red.
 */
export function BloqueResultado({
  resultado,
  registro,
  desfaseCorregidoMs,
  atributos,
  candado,
  alRevisar,
  alProbar,
  alAbrirLetra,
  alReintentar
}: Props) {
  const Ic = ICONO[resultado]
  const candidatas = registro?.busqueda?.candidatas ?? 0
  let titulo: string
  let lineas: string[] = []
  let pie: string | null = null
  let botones: ReactNode
  switch (resultado) {
    case 'revisar':
      titulo = PREP.r1.titulo
      lineas = [
        registro?.eleccion?.por === 'usuario' ? PREP.r1.letraUsuario : PREP.r1.letraApp,
        ...(desfaseCorregidoMs ? [K.desfase.corregido(desfaseCorregidoMs)] : []),
        ...(registro?.fines?.lineas ? [PREP.r1.fines(registro.fines.lineas)] : [])
      ]
      pie = PREP.r1.pie
      botones = (
        <>
          <Boton
            variante="primario"
            data-foco-inicial
            {...atributos(PREP.botonRevisar)}
            onClick={alRevisar}
          >
            {candado}
            {PREP.botonRevisar}
          </Boton>
          <Boton variante="secundario" onClick={alProbar}>
            {PREP.botonProbar}
          </Boton>
        </>
      )
      break
    case 'elige':
      titulo = PREP.r2.titulo
      pie = PREP.r2.cuerpo(candidatas, LP.motivo[registro?.busqueda?.no_elige ?? 'duda'])
      botones = (
        <Boton
          variante="primario"
          data-foco-inicial
          {...atributos(PREP.botonElegir)}
          onClick={alAbrirLetra}
        >
          {candado}
          {PREP.botonElegir}
        </Boton>
      )
      break
    case 'sinLetra':
    case 'instrumental': {
      const instrumental = resultado === 'instrumental'
      titulo = instrumental ? PREP.r3.tituloInstrumental : PREP.r3.titulo
      pie = instrumental ? PREP.r3.cuerpoInstrumental : PREP.r3.cuerpo
      botones = (
        <Boton
          variante="primario"
          data-foco-inicial
          {...atributos(PREP.botonAnadir)}
          onClick={alAbrirLetra}
        >
          {candado}
          {PREP.botonAnadir}
        </Boton>
      )
      break
    }
    default:
      titulo =
        registro?.busqueda?.motivo === 'SERVICIO_NO_DISPONIBLE'
          ? PREP.r4.tituloServicio
          : PREP.r4.titulo
      pie = PREP.r4.cuerpo
      botones = (
        <>
          <Boton variante="primario" data-foco-inicial onClick={alReintentar}>
            {PREP.botonReintentar}
          </Boton>
          <Boton variante="secundario" {...atributos(PREP.botonAnadir)} onClick={alAbrirLetra}>
            {candado}
            {PREP.botonAnadir}
          </Boton>
        </>
      )
  }
  return (
    <div
      className={`${estilos.resultado} ${estilos[`resultado_${resultado}`]}`}
      data-resultado={resultado}
    >
      <h2 className={`t-subtitulo ${estilos.resultadoTitulo}`}>
        <Icono
          icono={resultado === 'revisar' ? Check : resultado === 'pendiente' ? TriangleAlert : Ic}
          tamano={18}
        />
        {titulo}
      </h2>
      {lineas.length > 0 && (
        <ul className={estilos.resultadoLineas}>
          {lineas.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {pie && <p>{pie}</p>}
      <div className={estilos.acciones}>{botones}</div>
    </div>
  )
}
