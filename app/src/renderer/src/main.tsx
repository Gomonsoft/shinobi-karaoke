import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './estilos/base.css'
import { instalarFuentesIncluidas } from './estilos/fuentesIncluidas'
import { iniciarAvisoReanudacion } from './vistas/biblioteca/avisoReanudacion'
if (import.meta.env.DEV) void import('./estilos/muestrario.css')

instalarFuentesIncluidas()
// Antes de pintar: el evento de reanudación puede salir en cuanto termina de cargar la ventana.
iniciarAvisoReanudacion()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('No se encontró #root')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>
)
