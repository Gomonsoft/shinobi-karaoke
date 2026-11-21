import { createRoot } from 'react-dom/client'
import { AppExportacion } from './AppExportacion'
import '../estilos/base.css'
import { instalarFuentesIncluidas } from '../estilos/fuentesIncluidas'

instalarFuentesIncluidas()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('No se encontró #root')

// Sin StrictMode: el anfitrión pide `inicial` una sola vez y esta ventana no tiene usuario.
createRoot(raiz).render(<AppExportacion />)
