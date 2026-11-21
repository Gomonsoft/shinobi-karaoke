# 0246 — E2E de captura en Windows y comprobación en Linux (cierre de 0242)
- Estado: Pendiente
- Paso del pipeline: 6 (exportación)
- Depende de: 0244
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md), «Revisión para 0.2.0 — alpha.2», puntos 4 y 5; [0007](../adr/0007-herramientas-de-desarrollo-y-calidad.md) (CI)
- Spec UX: —
- Versión: 0.2.0-alpha.2 · Bloque B3 (correcciones de alpha.1)

## Objetivo
El defecto de 0244 no se detectó porque `exportacion-captura.spec.ts` solo corre en Linux, con una pantalla virtual de 3840 × 2160. En `.github/workflows/ci.yml:59-67` (comprobado) los pasos E2E llevan `if: runner.os == 'Linux'`. Hay que ejecutar esa spec también en `windows-latest`, con un caso mayor que el área de trabajo del runner, y averiguar si 0244 corrige además el 3839 × 2159 de Linux.

## Contrato
- `.github/workflows/ci.yml`, trabajo `app`: un paso nuevo, solo con `runner.os == 'Windows'`, que ejecute **solo** `npx playwright test e2e/exportacion-captura.spec.ts --workers=1` tras `npm run build`. No se ejecuta la suite E2E completa en Windows: QA vio fallos de entorno al lanzar muchos procesos (0xC0000142) y su coste no compensa. macOS no se añade.
- `app/e2e/exportacion-captura.spec.ts`:
  - Casos: 640 × 480, **1920 × 1080** (el perfil predeterminado) y 3840 × 2160. Se puede añadir 2560 × 1440 si cuesta poco.
  - Fuera de Linux, una aserción lee `screen.getPrimaryDisplay().workAreaSize` con `app.evaluate` y exige que 3840 × 2160 sea mayor que el área de trabajo en ancho o en alto, para que la prueba no deje de cubrir el recorte si cambia la pantalla del runner. Si alguna vez no lo es, la prueba falla con un mensaje que lo explique, no se omite.
- **Linux (0242).** Con 0244 integrada, mirar en el CI si la captura de 3840 × 2160 sale exacta:
  - Si sale exacta: quitar `omitirSiEntornoSinSuperficie`, pedir a `qa` que retire la regla 10 de `docs/pruebas.md` y la nota de la fila del inventario, y cerrar 0242 con una nota («resuelta por 0244»).
  - Si no: dejar la omisión como está y anotar en 0242 el resultado y el enlace a la ejecución.

## Criterios de aceptación
- [ ] En el CI de `alpha-2`, `app (windows-latest)` ejecuta la spec de captura y pasa con 0244. Comprobación del sentido de la prueba: con 0244 revertida en local o en una rama, el caso de 3840 × 2160 falla en Windows.
- [ ] El caso de 1920 × 1080 existe y pasa en los dos sistemas.
- [ ] 0242 queda cerrada o actualizada con el resultado de Linux y el enlace a la ejecución.

## Pruebas de feedback
- Unitarias: ninguna.
- E2E: `npx playwright test e2e/exportacion-captura.spec.ts` en local (Windows), tras `npm run build`.
- Críticos: no.
- Manual: ninguno nuevo.

## Notas de implementación
