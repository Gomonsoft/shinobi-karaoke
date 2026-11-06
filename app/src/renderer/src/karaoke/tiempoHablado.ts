export function tiempoHablado(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000)
  const minutos = Math.floor(s / 60)
  const segundos = s % 60
  const partes = [
    minutos ? `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}` : '',
    segundos || !minutos ? `${segundos} ${segundos === 1 ? 'segundo' : 'segundos'}` : ''
  ]
  return partes.filter(Boolean).join(' ')
}
