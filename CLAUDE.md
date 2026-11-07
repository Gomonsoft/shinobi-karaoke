# Shinobi Karaoke — guía para Claude

Software libre y gratuito para crear karaokes: fuente (archivo/YouTube) → separación voz/instrumental → letra → editor (estilo + sincronía) → borrador/lista → reproductor a pantalla completa.

- Versión en curso: `docs/versiones/0.2.0/plan-2.md` y `docs/versiones/0.2.0/backlog.md`.
- Alcance por versión: `docs/00-vision-y-alcance.md` (no añadir funcionalidades fuera del alcance autorizado sin preguntar al usuario).
- Pipeline: `docs/01-pipeline.md`.
- Toda la documentación generada va en `docs/`. Idioma: español.

## Agentes (`.claude/agents/`)
- `arquitecto` — decisiones tecnológicas (ADRs en `docs/adr/`), arquitectura y tareas.
- `disenador-ux` — vistas y experiencia de usuario (`docs/ux/`).
- `programador` — implementa tareas de `docs/tareas/`.

Flujo y formatos: `docs/02-flujo-de-agentes.md`. Los agentes se comunican mediante `docs/preguntas/`; la sesión principal revisa las preguntas con estado `Abierta` y lanza al agente destinatario (o pregunta al usuario si `Para: usuario`).

## Reglas
- No elegir tecnologías fuera de los ADRs aceptados.
- Antes de implementar algo con interfaz, debe existir su spec en `docs/ux/`.
