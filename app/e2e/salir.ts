import type { ElectronApplication } from '@playwright/test'

/**
 * Cierra la app de una prueba con la sesión abierta sin pasar por la confirmación de salida (0189).
 *
 * `app.close()` de Playwright cierra las ventanas; con una sesión activa main intercepta el `close`
 * y pide confirmación al renderer, que nadie contesta: la prueba agota el tiempo en el `finally`.
 * `app.exit(0)` sale sin preguntar y es independiente de la plataforma.
 */
export async function salirSinConfirmar(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined)
}
