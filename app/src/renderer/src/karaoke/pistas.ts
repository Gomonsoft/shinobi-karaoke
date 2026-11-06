export type Pista = 'original' | 'voz' | 'instrumental'

const RUTAS: Record<Pista, string> = {
  original: 'fuente/mezcla.flac',
  voz: 'pistas/voz.flac',
  instrumental: 'pistas/instrumental.flac'
}

export function urlPista(cancionId: string, pista: Pista): string {
  return `shinobi-media://${cancionId}/${RUTAS[pista]}`
}

export function gananciaLineal(gananciaDb: number, volumen: number): number {
  return 10 ** (gananciaDb / 20) * volumen
}
