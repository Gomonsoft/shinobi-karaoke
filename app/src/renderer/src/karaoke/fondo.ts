import { AMPLITUD_ORBITA, type Estilo } from '@shared/estilo'

export interface GeometriaFondo {
  anguloGrados: number
  centro: { x: number; y: number }
}

const redondea = (n: number, decimales: number): number => {
  const f = 10 ** decimales
  return Math.round(n * f) / f
}

/**
 * Geometría del degradado en el instante `tAudioMs` (ADR 0018 §2). Pura: la misma en editor,
 * reproductor y exportación. Sin movimiento, con `estatico` o en un fondo sólido, fase 0.
 */
export function geometriaFondoEn(
  fondo: Estilo['fondo'],
  tAudioMs: number,
  { estatico = false }: { estatico?: boolean } = {}
): GeometriaFondo {
  const base = fondo.tipo === 'degradado' ? fondo : null
  const angulo = base?.angulo_grados ?? 0
  const centro = base?.centro ?? { x: 0.5, y: 0.5 }
  const movimiento = base?.movimiento ?? null
  if (!base || !movimiento || estatico) {
    return { anguloGrados: redondea(angulo, 2), centro: { x: centro.x, y: centro.y } }
  }

  const periodo = movimiento.periodo_s * 1000
  const fase = (((tAudioMs % periodo) + periodo) % periodo) / periodo
  const s = movimiento.sentido === 'horario' ? 1 : -1

  if ((base.forma ?? 'lineal') === 'radial') {
    const theta = 2 * Math.PI * fase * s
    return {
      anguloGrados: redondea(angulo, 2),
      centro: {
        x: redondea(centro.x + AMPLITUD_ORBITA * Math.sin(theta), 4),
        y: redondea(centro.y + AMPLITUD_ORBITA * (1 - Math.cos(theta)), 4)
      }
    }
  }
  const a = (((angulo + 360 * fase * s) % 360) + 360) % 360
  return { anguloGrados: redondea(a, 2) % 360, centro: { x: centro.x, y: centro.y } }
}
