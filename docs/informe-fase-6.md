# Informe de la Fase 6 — Reproductor

Fecha: 2026-11-06. Rama: `fase-6-reproductor`, creada desde `main`. Implementadas las tareas 0112–0125; la 0126 requiere una revisión manual de una persona.

## Cómo revisarlo

```bash
git checkout fase-6-reproductor
cd app && npm install && npm run semilla && npm run dev
export SHINOBI_UV="$(which uv)"
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && npx playwright test
cd ../worker && uv run ruff check . && uv run pytest
```

## Verificación final (2026-11-06)

| Comprobación                    | Resultado                                                     |
| ------------------------------- | ------------------------------------------------------------- |
| lint / typecheck / format:check | OK                                                            |
| Vitest                          | **1.803 pasan**, 12 omitidos; 128 archivos pasan y 1 se omite |
| Playwright completo             | **84 pasan**, 2 omitidos (pruebas con red)                    |
| Playwright del reproductor      | 5 escenarios dirigidos pasan                                  |
| Worker ruff / format / pytest   | OK; **313 pasan**, 7 omitidos por marcas                      |

## Qué se hizo

- **Contratos y ventana** (0112–0114): API IPC para pantalla completa, evitar reposo y comprobar pistas; pantalla completa conserva y restaura el estado anterior de la ventana.
- **Render y motor** (0115–0118): semillas de canciones 20/21 y renombre de la 18; entrada de letra sin tope visual; reloj y mezcla de pista principal con voz guía, silencio previo, fin y errores; estado, atajos, textos, volumen compartido y retención de toasts.
- **Reproductor** (0119–0120): capa modal con letra, franjas y controles que se ocultan, pantalla final, errores de pista, aviso por letra incompleta, atajos y desplazamiento desde el editor.
- **Entradas** (0121–0122): apertura desde tarjetas y toast «lista para cantar» sin desmontar la Biblioteca; vista previa a pantalla completa desde el editor, con guardado, restauración de pista/velocidad y desplazamiento deshecho como un único paso.
- **Deuda del motor** (0124–0125): runtime incompleto se marca dañado y ofrece reparar; la confirmación muestra trabajos activos y los cancela antes de abrir Primer arranque.
- **E2E** (0123): cinco escenarios del reproductor sin red para biblioteca, atajos, foco, letra incompleta, pantalla final, pista instrumental ausente y vista previa del editor.

## Preguntas y pendientes

- **0126 — prueba manual**: revisar legibilidad desde 5 m, sincronía, voz guía, pantalla completa y pantalla encendida en TV y Windows/macOS/Linux.
- **Pregunta 0034**: aclarar el texto/acción de reparación si el runtime deja de estar disponible durante un error de fuente. No bloquea el flujo de reparación tras una separación.
- No se hizo merge a `main`. La fase queda en la rama para revisión.
