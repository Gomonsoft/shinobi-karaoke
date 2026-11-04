# Flujo de trabajo entre agentes

El proyecto se construye con tres agentes de Claude Code (definidos en `.claude/agents/`), coordinados desde la sesión principal:

| Agente | Rol | Escribe en |
|--------|-----|------------|
| `arquitecto` | Decisiones tecnológicas, arquitectura, desglose de tareas | `docs/adr/`, `docs/arquitectura.md`, `docs/tareas/`, respuestas en `docs/preguntas/` |
| `disenador-ux` | Vistas, flujos, wireframes, sistema visual, microcopy | `docs/ux/`, respuestas en `docs/preguntas/` |
| `programador` | Implementación de tareas | Código del proyecto, notas en `docs/tareas/`, preguntas en `docs/preguntas/` |

```mermaid
flowchart TD
    U[Usuario] --> S[Sesión principal]
    S --> AR[arquitecto]
    S --> UX[disenador-ux]
    AR <-->|preguntas/| UX
    AR -->|tareas/ + adr/| P[programador]
    UX -->|ux/| P
    P -->|preguntas/| AR
    P -->|preguntas/| UX
```

> Los subagentes no se invocan entre sí directamente: **se comunican a través de `docs/`**. La sesión principal lee las preguntas abiertas y lanza al agente destinatario para que responda.

## Ciclo por cada paso del pipeline
1. **Arquitecto** decide la tecnología del paso → ADR.
2. **Diseñador UX** define las vistas afectadas → spec en `docs/ux/` (consultando restricciones de los ADRs).
3. **Arquitecto** desglosa en tareas → `docs/tareas/`, enlazando ADRs y specs.
4. **Programador** implementa tarea a tarea. Dudas → `docs/preguntas/`.
5. Sesión principal enruta preguntas abiertas al agente correspondiente y, si son de producto, al usuario.

## Formato de tarea — `docs/tareas/NNNN-titulo.md`
```markdown
# NNNN — Título
- Estado: Pendiente | En curso | Bloqueada | Hecha
- Paso del pipeline: 0-6
- Depende de: NNNN, NNNN
- ADRs: 0001, 0003
- Spec UX: docs/ux/NN-vista.md (si aplica)

## Objetivo
## Criterios de aceptación
- [ ] ...
## Notas de implementación
(las rellena el programador al terminar)
```

## Formato de pregunta — `docs/preguntas/NNNN-titulo.md`
```markdown
# NNNN — Pregunta breve
- De: programador | arquitecto | disenador-ux
- Para: arquitecto | disenador-ux | usuario
- Estado: Abierta | Respondida
- Bloquea: tarea NNNN (o "no")

## Contexto
## Pregunta
## Opción provisional tomada (si no bloquea)
## Respuesta
```
