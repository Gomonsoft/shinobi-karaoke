# Cómo continuar la Fase 5 (Editor)

Estado al **2026-11-06**, rama `fase-5-editor` (subida a GitHub; `main` no la incluye todavía).

| Estado | Tareas |
|---|---|
| ✅ Hechas (21) | 0090–0110 (0108–0110 pendientes de commit) |
| ⏳ Pendientes (1) | **0111** prueba manual de precisión (la hace una persona: no implementar) |
| ❓ Pregunta abierta | **0029** (para arquitecto, no bloquea): la semilla «Editor: separando» llega interrumpida al editor, sin porcentaje |

## Prompt para continuar con Claude Code

Abrir Claude Code en la raíz del repositorio y pegar:

```text
Vas a continuar la Fase 5 (Editor) de Shinobi Karaoke. Todo el proyecto está en español.

CONTEXTO (léelo antes de tocar nada):
- CLAUDE.md y AGENTS.md (estructura, reglas, comandos).
- docs/continuar-fase-5.md (este estado), docs/plan.md y la sección "Fase 5" de docs/backlog.md.
- docs/adr/0010-editor-motor-de-audio-reloj-y-guardado.md y docs/ux/06-editor.md.
- Los agentes del proyecto están en .claude/agents/: arquitecto, disenador-ux y programador. Úsalos con la herramienta Agent (subagent_type "programador", etc.).

PREPARACIÓN:
- git fetch && git checkout fase-5-editor && git pull
- brew install uv (si `which uv` no devuelve nada); en cada verificación: export SHINOBI_UV="$(which uv)"
- cd app && npm install

TRABAJO, en este orden:
1. Lanza al agente "arquitecto" para responder docs/preguntas/0028 (márcala Respondida).
2. Lanza al agente "programador" para terminar 0108 y 0109 partiendo del commit WIP (revisar el código existente, no rehacerlo) (pueden ir en paralelo; ambos tocan vistas/editor/Editor.tsx solo añadiendo; 0109 además navegacion/estado.ts y Biblioteca.tsx).
3. 0110 (E2E del editor sin red) ya está hecha.
4. No implementes 0111 (prueba manual).

REGLAS PARA QUE SE PUEDA REANUDAR SI SE CORTA LA SESIÓN (obligatorias):
- Una tarea cada vez por agente; nunca más de 2 agentes en paralelo.
- Al terminar CADA tarea: verificación completa en verde
  (cd app && npm run lint && npm run typecheck && npm run format:check && npm test && npm run build && npx playwright test),
  tarea marcada "Hecha" con sus "Notas de implementación", fila actualizada en docs/backlog.md,
  commit "Tarea NNNN: <título>" y `git push origin fase-5-editor`.
- Si una tarea no se puede terminar, deja el código compilando, marca la tarea "En curso" con una lista de lo pendiente en sus Notas, haz commit "WIP: tarea NNNN (<qué falta>)" y push.
- Actualiza la tabla de estado de docs/continuar-fase-5.md tras cada tarea (es lo primero que leerá quien retome).
- No hagas merge a main ni push a main: al cerrar la fase escribe docs/informe-fase-5.md (formato de docs/informe-fase-4.md), actualiza docs/plan.md y avisa para que el dueño del proyecto revise y fusione.
- No uses librerías fuera de los ADR, ni red ni modelos reales en tests; solo audio generado y letras inventadas; no formatees globalmente.
```
