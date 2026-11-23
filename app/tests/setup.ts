import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// Bajo carga (varias suites a la vez) la UI tarda más en asentarse: las esperas por condición
// (`findBy`, `waitFor`) tienen margen, sin retrasar a las pruebas que pasan a la primera (0208).
configure({ asyncUtilTimeout: 5000 })
