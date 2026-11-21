import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppSecundaria } from './AppSecundaria'
import '../estilos/base.css'
import { instalarFuentesIncluidas } from '../estilos/fuentesIncluidas'

instalarFuentesIncluidas()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('No se encontró #root')

createRoot(raiz).render(
  <StrictMode>
    <AppSecundaria />
  </StrictMode>
)
