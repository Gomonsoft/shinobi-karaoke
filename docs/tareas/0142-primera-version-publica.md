# 0142 — Primera versión pública (estado E1)
- Estado: Bloqueada (por `preguntas/0035` y `0036`; `0037` y `0044` condicionan el contenido). **Fuera de lo que se implementa en esta fase.**
- Paso del pipeline: 0 (distribución)
- Depende de: 0133, 0134, 0136, 0137, 0138, 0139, 0140, 0141
- ADRs: 0012, 0013
- Spec UX: docs/ux/09-descarga-e-instalacion.md (§1.2, §3, §4; estado E1; criterios 2, 8–10, 13)
- ¿Red?: sí. Publica en GitHub: **solo con la orden expresa del usuario**.

## Objetivo
Recoger, para no perderlo, todo lo que hace falta antes de publicar. **No se implementa hasta que el usuario responda.** El flujo concreto de *Release* lo fija el arquitecto tras `preguntas/0035`, en una revisión del ADR 0013.

## Puerta de publicación
- [ ] `preguntas/0035`: repositorio público, o vía alternativa de código fuente (obligación GPL).
- [ ] `preguntas/0036`: número de versión y política.
- [ ] `preguntas/0037`: autoactualización.
- [ ] `preguntas/0044` respondida e incorporada.
- [ ] 0134: tabla de rutas sin descargas de Rápido sin consentimiento.
- [ ] `preguntas/0045` respondida e incorporada.
- [ ] 0133 completa: inventario y validación del runtime sin DiffQ según el ADR 0014.
- [ ] 0139 completa: P1–P16, Gatekeeper, primer arranque real, capturas.
- [ ] Mediciones de `docs/plan.md` hechas o aceptadas como pendientes por el usuario.
- [ ] Decidido el trato de 0111 y 0126, pruebas manuales aún pendientes.
- [ ] Consulta a UVR sobre el modelo Rápido: abierta o descartada de forma consciente (`preguntas/0012`).

## Criterios de aceptación
- [ ] README con §1.2 de `ux/09` y exactamente 4 enlaces, que descargan sin sesión. Nombres sin versión: `/releases/latest/download/<nombre>`.
- [ ] `INSTALAR.md` sin los avisos E0 y "guía provisional", sin ⟦…⟧ ni `{…}`, con C-WIN, C-MAC y C-LIN.
- [ ] Notas de la *Release* con §3 de `ux/09`, y `SHA256SUMS.txt` adjunto.
- [ ] Código fuente disponible públicamente en la etiqueta de la versión.
- [ ] Todas las URL externas comprobadas sin sesión el día de la publicación; fecha anotada (criterio 13).
- [ ] Sin ninguna *Release* fuera de esta tarea.

## Notas de implementación
(las rellena quien la ejecute)
