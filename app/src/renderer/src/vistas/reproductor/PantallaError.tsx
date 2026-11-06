import { useEffect, useRef } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import type { EstadoMotorReproductor, ModoAudio } from '../../karaoke/motorReproductor'
import type { OrigenReproductor } from './atajos'
import { R } from './textos'
import estilos from './reproductor.module.css'

export function PantallaError({
  error,
  modo,
  origen,
  alSalir
}: {
  error: NonNullable<EstadoMotorReproductor['errorPrincipal']>
  modo: ModoAudio
  origen: OrigenReproductor
  alSalir(): void
}) {
  const volver = useRef<HTMLButtonElement>(null)
  useEffect(() => volver.current?.focus({ preventScroll: true }), [])

  async function copiar(): Promise<void> {
    const { version, so } = await window.shinobi.sistema.info()
    const pista = modo === 'karaoke' ? 'instrumental' : 'original'
    await navigator.clipboard.writeText(
      `Shinobi Karaoke ${version} · ${so}\nReproductor: ${pista} (${error.ruta}) · ${error.tipo} · ${error.detalle}`
    )
  }

  const mensaje =
    error.tipo === 'no_encontrada'
      ? modo === 'karaoke'
        ? R.error.pistas
        : R.error.mezcla
      : R.error.audio
  return (
    <div className={estilos.pantallaError} role="alert">
      <h2 className="t-subtitulo">
        <Icono icono={TriangleAlert} /> {R.error.titulo}
      </h2>
      <p>{mensaje}</p>
      <div className={estilos.accionesFinal}>
        <Boton tamano="grande" onClick={() => void copiar().catch(() => undefined)}>
          {R.copiar}
        </Boton>
        <Boton ref={volver} tamano="grande" variante="primario" onClick={alSalir}>
          {R.volver[origen]}
        </Boton>
      </div>
    </div>
  )
}
