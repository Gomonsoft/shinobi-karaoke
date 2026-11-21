# 0035 — ¿Cuándo se hace público el repositorio y cómo se publica la primera versión?
- De: arquitecto
- Para: usuario
- Estado: Parcialmente respondida (repositorio público; publicación pendiente)
- Bloquea: tarea 0142 (primera versión pública) y el estado "con versión" de `ux/09`. **No bloquea** ninguna otra tarea de la Fase 7.

## Contexto
`github.com/Gomonsoft/shinobi-karaoke` ya es **público**; solo los colaboradores pueden crear ramas. El código fuente es accesible públicamente, pero todavía no hay una versión publicada. README y guía permanecen en el estado «sin versión» hasta preparar la publicación.

- Aún no hay enlaces públicos de descarga de una versión; los artefactos de Actions son builds internos.
- El código fuente ya está disponible en el repositorio público. La publicación de binarios debe acompañarse de la versión correspondiente del código fuente para cumplir la GPL.

El README y la guía dirán «todavía no hay ninguna versión publicada» hasta que se autorice una Release.

## Pregunta
1. **Repositorio público:** resuelto. Se hizo público antes de la primera versión; solo colaboradores pueden crear ramas.
2. **¿Cuándo se publica la primera versión?**
   - **A. Cuando pasen la prueba manual y las capturas** (tarea 0139) (recomendada).
   - **B. Como versión de prueba** para unas pocas personas, antes de eso.
3. **¿Cómo se lanza cada versión?** Propuesta: al crear una etiqueta `vX.Y.Z` se construye todo y se deja una *Release* en **borrador**, que tú revisas y publicas a mano. No se implementa ahora.
4. **Datos del paquete de Linux**: el `.deb` exige un responsable con correo y queda visible para quien lo instale. He puesto de forma provisional `Gomonsoft <contacto@gomonsoft.com>`, el contacto oficial. ¿Te parece bien?

## Opción provisional tomada (si no bloquea)
Repositorio público, sin primera versión publicada. README y guía siguen en el estado "sin versión". `author` provisional en `package.json`.

## Respuesta
El usuario hizo público el repositorio; los permisos para crear ramas se limitan a colaboradores. La decisión y autorización para publicar una versión siguen pendientes.

Actualización 2026-11-20: el usuario pidió que, desde 0.2.0, cada versión tenga su *Release* generada por un GitHub Action. Eso responde al punto 3: el flujo es el del [ADR 0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md) (etiqueta `v*` → construir, probar y crear la *Release*; *pre-release* si lleva sufijo; en borrador si la variable `PUBLICACION_BORRADOR` vale `true`). Si las alfas se publican antes de cerrar la puerta de 0142 queda en [0140](0140-publicar-las-alfas-como-pre-release-publica.md).
