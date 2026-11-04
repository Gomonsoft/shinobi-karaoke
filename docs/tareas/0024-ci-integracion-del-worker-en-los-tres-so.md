# 0024 — CI: integración real con el worker en los tres SO y verificación de la primera ejecución
- Estado: Hecha (parcial: falta la primera ejecución real en GitHub)
- Paso del pipeline: — (calidad)
- Depende de: 0004, 0013, 0014
- ADRs: 0001, 0007
- Spec UX: —

## Objetivo
Cerrar la deuda de 0003, 0004 y 0013: hoy los tests de integración del cliente del worker y del gestor de trabajos se **omiten** en CI (el trabajo `app` no instala `uv`), así que la cancelación con `taskkill /T /F` en Windows y la ausencia de procesos huérfanos no se han ejecutado nunca fuera de macOS; y el workflow no se ha visto correr en GitHub.

## Criterios de aceptación
- [ ] El trabajo `app` instala `uv` con `astral-sh/setup-uv` (misma versión fijada que el trabajo `worker`) y ejecuta `uv sync --locked` en `worker/` antes de `npm test`, de modo que `worker.test.ts` y `gestor.integracion.test.ts` **no** se omiten en ninguno de los 3 SO (comprobar en el log que el número de tests omitidos baja).
- [ ] En Windows se ejecuta la cancelación a mitad del `demo` y se verifica que no queda ningún proceso `python`/`uv` hijo (si el test actual lo omite en `win32`, adaptarlo con `tasklist`).
- [ ] La versión de `uv` queda fijada en un único sitio (CI y `app/README.md`); `uv.lock` regenerado con esa versión si difiere de la 0.13.7 usada en 0003.
- [ ] Se añade `npm run format:check` (Prettier) al trabajo `app`.
- [ ] Primera ejecución real del workflow en GitHub en verde en los 3 SO (enlace a la ejecución en las notas); se revisan las versiones de las acciones (`checkout`, `setup-node`, `setup-uv`) y el paso de AppArmor del E2E en Ubuntu.
- [ ] `npm audit --omit=dev` sin avisos altos o críticos (los de desarrollo se anotan, no bloquean).

## Notas de implementación
- **Qué se hizo**: `.github/workflows/ci.yml`: `UV_VERSION: '0.13.7'` a nivel de workflow (único sitio, citado en `app/README.md`) usado por `setup-uv` en `app` y `worker`; el trabajo `app` instala uv y ejecuta `uv sync --locked` en `worker/` antes de los tests (los de integración con el worker real ya no se omiten); añadidos `npm run format:check` y `npm audit --omit=dev --audit-level=high`; `npm test` con `--reporter=verbose` para ver omitidos en el log; acciones actualizadas a `checkout@v7`, `setup-node@v7`, `setup-uv@v10.3.3` (última release; setup-uv ya no publica etiqueta mayor móvil, por eso versión exacta). `uv.lock` no cambia (0.13.7 coincide).
- **Windows**: nuevo `app/src/main/trabajos/procesosCon.testutil.ts` (pgrep en POSIX; PowerShell/CIM en Windows filtrando procesos `python*`/`uv*` por nombre de archivo del parcial). Se quitó el `skipIf` de win32 en la cancelación a mitad (`worker.test.ts`) y en el cierre con trabajos (`gestor.integracion.test.ts`). La rama de Windows NO se ha ejecutado (solo hay macOS): es el punto a vigilar en la primera ejecución.
- **Validación local** (uv 0.13.7 en un venv temporal fuera del repo): YAML parseado con Ruby; `uv sync --locked` ok; `format:check`, `lint`, `typecheck` ok; `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades; `npm test`: 553 pasan, 0 omitidos en worker.test.ts y gestor.integracion.test.ts (con uv en PATH).
- **Pendiente (requiere GitHub)**: ejecución real del workflow en verde en los 3 SO (enlace aquí), comprobar el paso de AppArmor en Ubuntu y el comando PowerShell en Windows. No se pudo comprobar `actions/*` más allá de que los tags existen (`gh api`).
- **Deuda**: si el patrón por nombre de archivo en Windows diera falsos positivos entre tests concurrentes, usar un nombre de parcial único por test.
