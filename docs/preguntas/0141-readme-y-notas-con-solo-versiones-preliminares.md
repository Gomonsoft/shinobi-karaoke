# 0141 — README y notas de la *Release* cuando solo hay versiones preliminares (alfas)
- De: arquitecto
- Para: disenador-ux
- Estado: Abierta
- Bloquea: no. La tarea 0193 usa los textos provisionales de abajo y los sustituye cuando respondas. Condiciona el paso del README a E1 (tarea 0142).

## Contexto
El [ADR 0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md) publica cada versión como *Release* de GitHub. Las de 0.2.0 serán **preliminares** (`v0.2.0-alpha.1`, `-alpha.2`…), marcadas como *pre-release*. Esto choca con [`ux/09`](../ux/09-descarga-e-instalacion.md) en tres puntos:

1. **Enlaces del README (§1.2 y §4).** `…/releases/latest/download/<archivo>` lleva a la última *Release* **estable**. GitHub no considera "latest" a una *pre-release* (documentación de la API REST: "Drafts and prereleases cannot be set as latest"). Mientras solo haya alfas, esos 4 enlaces dan 404. Existen dos formas de enlazar que sí funcionan: la página de una versión concreta (`…/releases/tag/v0.2.0-alpha.1`) o el archivo de una versión concreta (`…/releases/download/v0.2.0-alpha.1/<archivo>`); las dos hay que cambiarlas en cada alfa. La página `…/releases` siempre funciona y lista también las preliminares.
2. **Notas (§3).** Falta un aviso de que es una versión preliminar. Lo añade el workflow solo cuando la versión lleva sufijo, desde `.github/publicacion/aviso-previa.md`.
3. **Marcadores.** La cabecera de §3 lleva ⟦R0045⟧ y el workflow rechaza notas con marcadores. Hace falta el texto final de la línea "¿Qué archivo descargo?" mientras 0045 siga con su opción provisional A.

Además, cada *Release* lleva una sección propia de novedades, escrita a mano en `docs/versiones/<X.Y.Z>/notas/<versión>.md` (o, si no existe, la lista que genera GitHub). La tarea 0195 añade en ella "Sin probar en esta versión".

## Pregunta
1. ¿Qué muestra el README mientras solo haya alfas? Opciones que veo:
   - **A. Un estado intermedio "E½ — versión preliminar"**: texto breve de que hay una versión de prueba y **un solo enlace** a `…/releases` (la página de versiones), sin enlaces directos a archivos. No hay que tocarlo en cada alfa (mi preferencia técnica).
   - **B. Enlaces directos a la última alfa** (`…/releases/download/v0.2.0-alpha.N/<archivo>`), actualizados en cada publicación. Más cómodo para el usuario; un paso manual más por versión, fácil de olvidar.
   - **C. Seguir en E0** hasta la primera versión estable.
2. Texto del aviso de versión preliminar al principio de las notas. Provisional: «**Versión preliminar.** Es una versión de prueba: puede tener errores y cambiar antes de la versión estable. Haz una copia de tu carpeta de canciones antes de instalarla.»
3. Texto final de la línea de Linux en "¿Qué archivo descargo?" sin ⟦R0045⟧. Provisional: el actual de §3 sin el marcador (`.deb` para Ubuntu, Debian y Linux Mint; AppImage para otras distribuciones).
4. ¿Hay que cambiar algo de `INSTALAR.md` para las preliminares (p. ej., que el enlace "página oficial del proyecto" apunte a `…/releases`, que ya lista las preliminares)?

## Opción provisional tomada (si no bloquea)
README sin cambios (E0) hasta tu respuesta y la de [0140](0140-publicar-las-alfas-como-pre-release-publica.md). Notas con los textos provisionales de los puntos 2 y 3.

## Respuesta
