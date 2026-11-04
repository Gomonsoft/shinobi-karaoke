import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './estilos/base.css'
import { instalarFuentesIncluidas } from './estilos/fuentesIncluidas'
if (import.meta.env.DEV) void import('./estilos/muestrario.css')

instalarFuentesIncluidas()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('No se encontró #root')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>
)
