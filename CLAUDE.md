# Shinobi Karaoke — guía para Claude

Software libre y gratuito para crear karaokes: fuente (archivo/YouTube) → separación voz/instrumental → letra → editor (estilo + sincronía) → borrador/lista → reproductor a pantalla completa.

- Versión en curso: `docs/versiones/0.2.2/plan-4.md` y `docs/versiones/0.2.2/backlog.md`. Para retomar el trabajo en un equipo o una sesión nuevos, empieza por `docs/versiones/0.2.2/traspaso.md`.
- Alcance por versión: `docs/00-vision-y-alcance.md` (no añadir funcionalidades fuera del alcance autorizado sin preguntar al usuario).
- Pipeline: `docs/01-pipeline.md`.
- Toda la documentación generada va en `docs/`. Idioma: español.
- Ideas fuera del alcance: no se implementan; se registran en `docs/propuestas/` (una por archivo) para que el usuario decida.
- Rama de trabajo de la versión en curso: `version-0.2.2` (sale de `develop`), con `docs/` en la rama `version-0.2.2` de shinobidocs. Una feature = una fase; un único PR por versión hacia `develop`.
- Siguiente versión: 0.2.3, varios cantantes y coros (`docs/versiones/0.2.3/plan-5.md`).

## Agentes (`.claude/agents/`)
- `arquitecto` — decisiones tecnológicas (ADRs en `docs/adr/`), arquitectura y tareas.
- `disenador-ux` — vistas y experiencia de usuario (`docs/ux/`).
- `programador` — implementa tareas de `docs/tareas/`.
- `qa` — suite crítica del flujo principal, clasificación de fallos del CI y guías manuales (`docs/Test-manuales/`).

Flujo y formatos: `docs/02-flujo-de-agentes.md`. Los agentes se comunican mediante `docs/preguntas/`; la sesión principal revisa las preguntas con estado `Abierta` y lanza al agente destinatario (o pregunta al usuario si `Para: usuario`).

## Reglas
- Decisiones abiertas de producto o de diseño: se aplica la opción recomendada por el agente, se anota como provisional en una pregunta `Para: usuario` y se sigue; el usuario pide cambios después. No cubre acciones hacia fuera o difíciles de deshacer (etiquetar, publicar una Release, fusionar un PR, borrar datos): esas necesitan su orden expresa.
- Nunca escribir en la carpeta de datos real del usuario ni copiar letras reales al repositorio; las pruebas usan copias temporales o la semilla.
- No elegir tecnologías fuera de los ADRs aceptados.
- Antes de implementar algo con interfaz, debe existir su spec en `docs/ux/`.
- Pruebas: solo como feedback para los agentes (`docs/pruebas.md`). Por tarea: typecheck, lint, format:check, `npm run test:cambios`, specs E2E cambiadas y, si toca el flujo principal, `npm run test:e2e:criticos`. La regresión completa es del CI; lo demás va a guías manuales.

## Documentación en un repositorio aparte
`docs/` es un submódulo: el repositorio [`Gomonsoft/shinobidocs`](https://github.com/Gomonsoft/shinobidocs). Las rutas `docs/…` no cambian.
- Si `docs/` está vacío: `git submodule update --init`.
- Un cambio de documentación son dos commits: primero dentro de `docs/` (commit y push a `main` de shinobidocs, o a su rama `version-X.Y.Z` si define una versión aún sin implementar) y después `git add docs` en este repositorio, junto con el código al que acompaña. Detalle en `docs/workflow.md` («Dos repositorios»).
- El puntero de `develop` y `main` apunta siempre a un commit ya subido de `main` de shinobidocs.
- El CI no descarga el submódulo: nada que se construya o se pruebe puede leer de `docs/`. Lo que la publicación necesita vive en `lanzamientos/` (notas de versión en `lanzamientos/notas/<X.Y.Z>/<versión>.md`, botones de descarga y plantilla del README).
- Pruebas de concepto: `docs/spikes/`. Capturas de revisión: `docs/ux/revisiones/<fase>/`.
