import { FUENTES_REGISTRO } from '@shared/fuentes'

/** Sección del Muestrario: cada familia incluida en su peso, con el texto de prueba. */
export function MuestrarioFuentes() {
  return (
    <section aria-labelledby="m-fuentes">
      <h2 id="m-fuentes" className="t-subtitulo">
        Fuentes de la letra
      </h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--e-3)' }}>
        {FUENTES_REGISTRO.map((f) => (
          <li key={f.familia}>
            <code className="t-pequeno">
              {f.familia} {f.peso}
            </code>
            <p
              style={{
                fontFamily: `'${f.familia}', sans-serif`,
                fontWeight: f.peso,
                fontSize: '2rem',
                margin: 0
              }}
            >
              ¿Cantamos? Ñandú
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
