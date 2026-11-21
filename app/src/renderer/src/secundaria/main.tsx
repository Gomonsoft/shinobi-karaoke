import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * Documento provisional de la ventana secundaria (0179): fondo negro y el título accesible.
 * Lo sustituye 0182 con el reproductor en modo sesión.
 */
function Secundaria(): React.JSX.Element {
  return (
    <main
      aria-label="Shinobi Karaoke · Reproductor"
      style={{ background: '#000', height: '100vh', width: '100vw' }}
    >
      <h1
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap'
        }}
      >
        Shinobi Karaoke · Reproductor
      </h1>
    </main>
  )
}

const raiz = document.getElementById('root')
if (!raiz) throw new Error('No se encontró #root')

createRoot(raiz).render(
  <StrictMode>
    <Secundaria />
  </StrictMode>
)
