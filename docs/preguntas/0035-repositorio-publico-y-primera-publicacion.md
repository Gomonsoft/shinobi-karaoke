# 0035 — ¿Cuándo se hace público el repositorio y cómo se publica la primera versión?
- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: tarea 0142 (primera versión pública) y el estado "con versión" de `ux/09`. **No bloquea** ninguna otra tarea de la Fase 7.

## Contexto
`github.com/Gomonsoft/shinobi-karaoke` es **privado** (comprobado con `gh repo view` el 2026-11-06) y responde 404 sin sesión. Mientras siga así:

- Los enlaces de descarga, las incidencias y la guía de instalación no funcionan para el público.
- La licencia GPL obliga a ofrecer el código fuente a quien reciba el programa. Publicar los instaladores sin dar acceso al código no cumpliría la licencia.

Esta fase solo genera instaladores como archivos internos del workflow, que solo ve quien tiene acceso al repositorio. El README y la guía dirán "todavía no hay ninguna versión publicada".

## Pregunta
1. **¿Cuándo pasa a público el repositorio?**
   - **A. Justo antes de publicar la primera versión** (recomendada). Se revisa antes el historial en busca de datos que no deban verse.
   - **B. Ya.** Permite recibir incidencias y mostrar el proyecto, y da más minutos de GitHub. Pero el proyecto se ve a medio terminar.
   - **C. Sigue privado**: no hay publicación. Habría que dar el código por otra vía, y los enlaces de `ux/09` no servirían.
2. **¿Cuándo se publica la primera versión?**
   - **A. Cuando pasen la prueba manual y las capturas** (tarea 0139) (recomendada).
   - **B. Como versión de prueba** para unas pocas personas, antes de eso.
3. **¿Cómo se lanza cada versión?** Propuesta: al crear una etiqueta `vX.Y.Z` se construye todo y se deja una *Release* en **borrador**, que tú revisas y publicas a mano. No se implementa ahora.
4. **Datos del paquete de Linux**: el `.deb` exige un responsable con correo y queda visible para quien lo instale. He puesto de forma provisional `Gomonsoft <contacto@gomonsoft.com>`, el contacto oficial. ¿Te parece bien?

## Opción provisional tomada (si no bloquea)
Repositorio privado y **ninguna publicación**. README y guía en el estado "sin versión". `author` provisional en `package.json`.

## Respuesta
