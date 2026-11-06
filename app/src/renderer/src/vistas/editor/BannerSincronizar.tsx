import { useEffect, useRef, useState } from 'react'
import { Boton } from '../../componentes/Boton'
import { E } from './textos'
import estilos from './editor.module.css'

interface Props {
  siguiente: string | null
  sonando: boolean
  contando: boolean
  hayMarca: boolean
  pronto: boolean
  marcar(ts: number): void
  soltar(ts: number): void
  deshacer(): void
  alternar(): void
  terminar(): void
}

export function BannerSincronizar({
  siguiente,
  sonando,
  contando,
  hayMarca,
  pronto,
  marcar,
  soltar,
  deshacer,
  alternar,
  terminar
}: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const [entrada] = useState(siguiente)
  const enfocado = useRef(false)
  useEffect(() => {
    if (!contando && sonando && !enfocado.current) {
      enfocado.current = true
      ref.current?.focus({ preventScroll: true })
    }
  }, [contando, sonando])

  return (
    <section className={`${estilos.bannerSync} foco-doble`} aria-label={E.syncTitulo}>
      <p className={estilos.soloLector} aria-live="polite">
        {E.syncTitulo}. {entrada}
      </p>
      <h3>{E.syncTitulo}</h3>
      <p>{E.syncAyuda}</p>
      {siguiente ? <p>{siguiente}</p> : <p role="status">{E.syncFin}</p>}
      {pronto && <p className={estilos.syncPronto}>{E.syncPronto}</p>}
      <div className={estilos.transporteFila}>
        <Boton
          ref={ref}
          variante="primario"
          tamano="grande"
          disabled={contando || !sonando}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.currentTarget.setPointerCapture?.(e.pointerId)
            marcar(e.timeStamp)
          }}
          onPointerUp={(e) => soltar(e.timeStamp)}
          onClick={(e) => {
            if (e.detail === 0) {
              marcar(e.timeStamp)
              soltar(e.timeStamp)
            }
          }}
        >
          {E.syncMarcar}
        </Boton>
        <Boton onClick={deshacer} disabled={!hayMarca}>
          {E.syncDeshacer}
        </Boton>
        <Boton onClick={alternar} disabled={contando}>
          {sonando ? E.syncPausa : E.syncSeguir}
        </Boton>
        <Boton onClick={terminar}>{E.syncTerminar}</Boton>
      </div>
    </section>
  )
}
