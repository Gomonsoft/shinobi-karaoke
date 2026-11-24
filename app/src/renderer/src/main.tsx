import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LimiteErrores } from './navegacion/LimiteErrores'
import './estilos/base.css'
import { instalarFuentesIncluidas } from './estilos/fuentesIncluidas'
import { iniciarAvisoReanudacion } from './vistas/biblioteca/avisoReanudacion'
import { instalarCapturaErrores } from './soporte/erroresInterfaz'
if (import.meta.env.DEV) void import('./estilos/muestrario.css')

// Antes que nada: un error al montar también debe quedar en app.log (I-1).
instalarCapturaErrores()
instalarFuentesIncluidas()
// Antes de pintar: el evento de reanudación puede salir en cuanto termina de cargar la ventana.
iniciarAvisoReanudacion()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('No se encontró #root')

createRoot(raiz).render(
  <StrictMode>
    <LimiteErrores variante="global">
      <App />
    </LimiteErrores>
  </StrictMode>
)
