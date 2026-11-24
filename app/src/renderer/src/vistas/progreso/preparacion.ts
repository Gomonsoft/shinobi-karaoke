import type { Preparacion } from '@shared/cancion'
import { PREP } from './textosPreparacion'
import type { Fila } from './modelo'

/** Resultado visible de la preparación (bloques R1 a R4 de la spec 04). */
export type ResultadoPrep = 'revisar' | 'elige' | 'sinLetra' | 'instrumental' | 'pendiente'

export interface ContextoPrep {
  /** La canción ya tenía letra cuando empezó la preparación (p. ej. la eligió el usuario). */
  tieneLetra: boolean
  /** `letra.desfase_corregido_ms`, si lo hay. */
  desfaseCorregidoMs: number | null
  /** La separación aún no ha terminado (la búsqueda de la letra corre en paralelo). */
  separando?: boolean
  /** La corrida es un «Ajustar los fines…» sobre una letra sin marca `intacta` (no se comprueba). */
  sinMarca?: boolean
}

const segundos = (ms: number): string => (Math.abs(ms) / 1000).toFixed(1).replace('.', ',')

const base = (id: Fila['id'], etiqueta: string): Fila => ({
  id,
  etiqueta,
  icono: 'pendiente',
  dato: null,
  texto: null,
  barra: null,
  eta: null
})

/** Filas «Buscar la letra», «Comprobar la letra con la voz» y «Ajustar los fines de línea». */
export function filasPreparacion(p: Preparacion | null | undefined, ctx: ContextoPrep): Fila[] {
  const letra = base('letra', PREP.sub.letra)
  const comprobar = base('comprobar', PREP.sub.comprobar)
  const fines = base('fines', PREP.sub.fines)
  if (!p) return [letra, comprobar, fines]
  const enCurso = p.estado === 'en_curso'
  const busqueda = p.busqueda

  if (enCurso && p.paso === 'buscando_letra') {
    Object.assign(letra, { icono: 'curso', texto: PREP.buscando, barra: 'indeterminada' })
  } else if (busqueda) {
    letra.icono = busqueda.resultado === 'pendiente' ? 'interrumpido' : 'completado'
    letra.dato =
      busqueda.resultado === 'elegida' || busqueda.resultado === 'elige'
        ? PREP.res.candidatas(busqueda.candidatas)
        : busqueda.resultado === 'sin_letra'
          ? PREP.res.noEncontrada
          : busqueda.resultado === 'instrumental'
            ? PREP.res.instrumental
            : busqueda.motivo === 'SERVICIO_NO_DISPONIBLE'
              ? PREP.res.servicio
              : PREP.res.sinConexion
  } else if (ctx.tieneLetra) {
    letra.dato = `— ${PREP.omitido.yaTieneLetra}`
  }

  // «Comprobar» espera a la separación mientras se busca la letra en paralelo (P2).
  const esperaSeparacion =
    enCurso && (p.paso === 'esperando_separacion' || (p.paso === 'buscando_letra' && ctx.separando))
  if (enCurso && ctx.sinMarca && ctx.tieneLetra) {
    comprobar.dato = `— ${PREP.omitido.sinMarca}`
  } else if (esperaSeparacion) comprobar.texto = PREP.esperaSeparacion
  else if (enCurso && p.paso === 'comprobando') {
    Object.assign(comprobar, { icono: 'curso', texto: PREP.comprobando, barra: 'indeterminada' })
  } else if (p.eleccion || (p.fines && !enCurso)) {
    comprobar.icono = 'completado'
    comprobar.dato = p.eleccion?.sin_comprobar
      ? PREP.res.duda
      : ctx.desfaseCorregidoMs !== null
        ? PREP.res.corregida(segundos(ctx.desfaseCorregidoMs))
        : PREP.res.coincide
  } else if (p.estado === 'elige_letra' && busqueda && busqueda.candidatas > 0) {
    comprobar.icono = 'completado'
    comprobar.dato = PREP.res.duda
  }

  if (enCurso && p.paso === 'ajustando_fines') {
    Object.assign(fines, { icono: 'curso', texto: PREP.ajustando, barra: 'indeterminada' })
  } else if (p.fines) {
    fines.icono = 'completado'
    fines.dato = PREP.res.fines(p.fines.lineas)
  }
  return [letra, comprobar, fines]
}

/** Qué bloque de resultado toca (según el estado derivado del resumen). */
export function resultadoDe(estado: string | null | undefined): ResultadoPrep | null {
  switch (estado) {
    case 'lista_para_revisar':
      return 'revisar'
    case 'elige_letra':
      return 'elige'
    case 'sin_letra':
      return 'sinLetra'
    case 'instrumental':
      return 'instrumental'
    case 'letra_pendiente':
      return 'pendiente'
    default:
      return null
  }
}
