# Estrategia de pruebas

> Decisión del usuario (2026-11-20): en las sesiones de trabajo, las pruebas existen **para dar feedback a los agentes de IA**. Los tokens se invierten en features; la regresión completa la ejecuta el CI y lo demás se verifica a mano con las guías de [`Test-manuales/`](Test-manuales/README.md).

## Niveles

| Nivel | Qué cubre | Quién lo ejecuta | Cuándo | Comando (en `app/`) |
|---|---|---|---|---|
| **1 · Críticos** | El flujo principal de punta a punta: Inicio → Biblioteca → Añadir canción → Letra → Editor → Reproductor. Pocas pruebas, estables y rápidas, etiquetadas `@critico`. | Agentes | Al terminar una tarea que toque `main/`, `preload/`, `shared/` o una vista del flujo principal | `npm run test:e2e:criticos` |
| **2 · De la feature** | Tests unitarios relacionados con los archivos cambiados y specs E2E creadas o modificadas en la tarea. | Agentes | Durante y al terminar cada tarea | `npm run test:cambios` · `npm run test:e2e:cambios` |
| **3 · Regresión completa** | Toda la suite Vitest y todos los E2E (secundarios incluidos) en Windows, macOS y Linux. | CI de GitHub (`.github/workflows/ci.yml`) | En cada push y PR a `develop`/`main`, y en el PR borrador de la fase | — (CI) |
| **4 · Manual** | Lo que no conviene automatizar o necesita hardware real: dos pantallas, audio por HDMI, Wayland, sensaciones de uso, capturas. | Usuario | Al cerrar la fase o la feature | Guías en [`Test-manuales/`](Test-manuales/README.md) |

Siempre, antes de dar una tarea por terminada: `npm run typecheck`, `npm run lint` y `npm run format:check` (baratos y sin ejecutar la app).

### Pruebas críticas y secundarias

- **Críticas** (`@critico`): solo las del flujo principal. Viven en `app/e2e/criticos/` y las mantiene el agente `qa`. Si un crítico falla, la tarea no está terminada.
- **Secundarias**: el resto de los E2E (`app/e2e/*.spec.ts`), que prueban features que usan esas pantallas (temas, separación con errores, YouTube, layout del editor, etc.). Los agentes no las ejecutan en bloque: solo las que su tarea crea o modifica (nivel 2). El CI las ejecuta todas (nivel 3).

### Comandos de feedback

| Comando | Qué hace |
|---|---|
| `npm run test:cambios` | `vitest run --changed`: tests unitarios afectados por los cambios sin commit (incluye los que importan archivos cambiados). Con otra base: `npx vitest run --changed <ref>`. |
| `npm run test:e2e:criticos` | Compila y ejecuta solo los E2E con la etiqueta `@critico`. |
| `npm run test:e2e:cambios` | Compila y ejecuta solo las specs E2E cambiadas sin commit (`playwright test --only-changed`). Con otra base: `npx playwright test --only-changed=<ref>`. |
| `npx playwright test e2e/<archivo>.spec.ts` | Una spec concreta, tras `npm run build`. |

## Reglas para los agentes

1. **Feedback, no cobertura.** Escribe el test más pequeño que te diga si lo que implementas funciona. Prefiere Vitest (lógica pura, `main/`, componentes con dobles) a E2E.
2. **E2E solo si aporta feedback que Vitest no da**: integración real entre procesos o ventanas, protocolo, IPC por rol, arranque. Una spec por feature como máximo, con los escenarios imprescindibles.
3. **No ejecutes la suite E2E completa ni `npm test` completo** salvo que el usuario o la sesión principal lo pidan. La regresión es del CI.
4. Si un test ajeno falla en `test:cambios`, comprueba si lo rompe tu cambio. Si no es tuyo (entorno, inestabilidad), anótalo en las notas de la tarea y sigue.
5. Lo que solo se puede comprobar a mano (hardware, varios monitores, sensación visual) **no es una tarea de agente**: se añade a la guía manual de la fase en `Test-manuales/`.
6. Las capturas de revisión visual solo se toman cuando la spec UX las pide para una revisión del diseñador.

## Regresión en el CI

- Cada fase abre pronto un **PR borrador** de `fase/0.2.0-N-…` a `develop`; cada push ejecuta `ci.yml` completo.
- La sesión principal lee los fallos (`gh run list`, `gh run view --log-failed`) y el agente `qa` los clasifica: regresión de la fase (vuelve a la tarea responsable), inestable (se marca y se corrige aparte) o de entorno.
- Los criterios de cierre de la fase exigen el CI en verde, no ejecuciones locales completas.

## Responsables

- **`qa`**: mantiene los críticos y esta estrategia, clasifica fallos del CI, escribe las guías manuales y propone qué pruebas de feedback necesita cada tarea. Ver `.claude/agents/qa.md`.
- **`arquitecto`**: en cada tarea indica en «Pruebas de feedback» los tests mínimos y qué va a la guía manual.
- **`programador`**: escribe y ejecuta las pruebas de feedback de su tarea (niveles 1 y 2).
