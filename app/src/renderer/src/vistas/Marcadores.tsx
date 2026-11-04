import { Boton } from '../componentes/Boton'
import { useNavegacion, type Vista } from '../navegacion/estado'
import estilos from '../navegacion/marco.module.css'

interface MarcadorProps {
  titulo: string
  /** Si es `false` no se muestra "‹ Biblioteca" (p. ej. Primer arranque, sin barra). */
  conVolver?: boolean
  /** Texto de ayuda: indica a qué fase pertenece la vista real. */
  nota?: string
  /** Acciones extra (solo marcadores). */
  siguiente?: { etiqueta: string; vista: Vista }
}

/** Marcador de posición de una vista de fases posteriores (0018). */
export function Marcador({ titulo, conVolver = true, nota, siguiente }: MarcadorProps) {
  const { ir } = useNavegacion()
  return (
    <section className={estilos.marcador} aria-labelledby="titulo-vista">
      {conVolver && (
        <Boton variante="fantasma" onClick={() => ir({ tipo: 'biblioteca' })}>
          ‹ Biblioteca
        </Boton>
      )}
      <h1 id="titulo-vista" className="t-titulo" tabIndex={-1} data-foco-inicial>
        {titulo}
      </h1>
      {nota && <p>{nota}</p>}
      {siguiente && (
        <Boton variante="primario" onClick={() => ir(siguiente.vista)}>
          {siguiente.etiqueta}
        </Boton>
      )}
    </section>
  )
}
