/**
 * Anfitrión provisional de la ventana de exportación (0234): pinta un fondo rojo y el número `n`.
 * Lo sustituye `AppExportacion` (0235).
 */
const api = window.shinobiExportacion

async function iniciar(): Promise<void> {
  const raiz = document.getElementById('root')!
  raiz.style.cssText = 'width:100vw;height:100vh;background:#f00;color:#fff;font:48px sans-serif'
  api.alFotograma(({ trabajoId, n }) => {
    raiz.textContent = String(n)
    requestAnimationFrame(() => requestAnimationFrame(() => void api.listo(trabajoId, n)))
  })
  await api.inicial()
}

void iniciar()
