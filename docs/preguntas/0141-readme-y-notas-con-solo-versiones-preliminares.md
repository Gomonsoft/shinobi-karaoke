# 0141 — README y notas de la *Release* cuando solo hay versiones preliminares (alfas)
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
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
Disenador-ux, 2026-11-20. Incorporado en [`ux/09`](../ux/09-descarga-e-instalacion.md) (§1.1b, §2, §3, §5 P17, §6 y criterios 17–20). Los textos exactos están allí; aquí, lo que cambia para el arquitecto y el programador.

1. **README: opción A, con lista de archivos.** Nuevo estado **E½ — Solo versiones preliminares** (§1.1b): requisitos, un solo enlace **"Ir a la página de versiones"** a `…/releases` y, debajo, qué archivo elegir según el sistema (los nombres no llevan versión, 0040), más "¿Qué Mac tengo?" y que **Source code** no es la app. No hay ningún enlace a un archivo ni a una versión concreta, así que **no se toca en cada alfa**. Descarto B (un enlace olvidado manda a una alfa vieja sin que nadie lo note) y C (con alfas públicas, el README diría que no hay nada que descargar, y sería falso).
   - E½ empieza cuando hay una *pre-release* **pública** y ninguna estable; una en borrador (0140, B) no cuenta. El cambio de E0 a E½ se hace **una sola vez**, en un commit posterior a la primera *Release* preliminar, después de comprobar sin sesión que aparece en `/releases`. E½ → E1 con la primera estable (0142). En E1, las preliminares de versiones siguientes no cambian el README.
   - Nuevo ⟦P17⟧: los rótulos de GitHub (**Assets**, **Source code**, **Pre-release**) y que la más reciente sale la primera. Se comprueba con la primera alfa publicada.
2. **Aviso de versión preliminar** (`.github/publicacion/aviso-previa.md`), texto final:
   ```markdown
   > **Versión preliminar.** Es una versión de prueba: puede tener errores y algunas cosas cambiarán antes de la versión estable.
   >
   > Si ya tienes canciones en Shinobi Karaoke, haz una copia antes de instalarla: en la app, entra en **Ajustes → Abrir carpeta de datos** y copia la carpeta **biblioteca** a otro sitio.
   ```
   Pide copiar solo `biblioteca` (ADR 0006), no toda la carpeta de datos con los GB del motor. **Cambio de orden respecto al ADR 0020 §4 y la tarea 0193:** `notas.md` = **aviso (si es previa) → cabecera** → notas de la versión. El aviso va primero porque la etiqueta *Pre-release* de GitHub sale en inglés. Hay que ajustar el criterio de composición de 0193 y su prueba unitaria.
3. **Línea de Linux de la cabecera** (`.github/publicacion/cabecera.md`): la provisional se da por buena sin el marcador. `Linux: \`shinobi-karaoke-linux-x64.deb\` (Ubuntu, Debian, Linux Mint) o \`Shinobi-Karaoke-Linux-x64.AppImage\` (otras distribuciones).` Además, la cabecera añade, tras la línea de Intel: «Los archivos **Source code** son el código fuente, no la app.» El texto completo y final está en §3. Si 0045 acaba en B y el AppImage no se publica, §3 tiene la línea alternativa (y el workflow dejaría de esperar 4 instaladores, cosa que decidiría el arquitecto).
4. **`INSTALAR.md`: sí, dos cambios.**
   - **Aviso E½** en lugar del aviso E0 (§2): dice que solo hay versiones preliminares, enlaza a `…/releases`, avisa de que pueden tener errores y da la misma indicación de copia de seguridad. El enlace "página oficial del proyecto" ya apunta a `…/releases` y no cambia.
   - **Límite del AppImage**, que exige la opción provisional A de 0045 ("declarando el límite en la guía") y que hasta ahora no estaba escrito. En la sección Linux: «En Ubuntu 24.04 o posterior, el AppImage puede abrirse con una capa de protección menos que el `.deb` (el aislamiento de seguridad del sistema). Por eso, en Ubuntu, Debian y Linux Mint te recomendamos el `.deb`.» No recomienda desactivar nada. Se quita si la 0137 demuestra que el AppImage conserva el sandbox (P16).

No queda ninguna decisión de producto nueva: que las alfas se vean en el README depende solo de que sean públicas, y eso ya lo pregunta 0140. No abro preguntas 0143–0145.
