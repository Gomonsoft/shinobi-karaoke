import estilos from './reproductor.module.css'

export function IndicadorBreve({ texto }: { texto: string | null }) {
  return (
    texto && (
      <span className={`${estilos.pildora} ${estilos.indicador}`} aria-hidden="true">
        {texto}
      </span>
    )
  )
}
