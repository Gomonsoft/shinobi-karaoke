# 0022 — Huecos de UX de la vista Letra (Fase 4)
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no. Las tareas 0084–0087 llevan una opción provisional en cada punto y se ajustan con la respuesta.

## Contexto
Al desglosar la Fase 4 (tareas 0077–0089) a partir de `ux/05-letra.md` y de la Revisión 2026-11-05 de los ADR 0005 y 0006, han salido casos que la spec no define. Las respuestas técnicas ya están decididas: estrategia `get` + `search`, orden, errores, regla de `pasos.letra` (completado con ≥ 1 línea) y que la letra vive en `cancion.json`. Aquí solo hay preguntas de presentación y comportamiento.

## Pregunta
1. **Textos de `let.actual`** ("Letra actual · origen: {origen} ({sincronía}) · {n} líneas"). Faltan los valores:
   - `{origen}` para `lrclib`, `manual` (pegada) y `archivo`. ¿Se muestra el nombre del archivo? Hoy no se guarda: si se quiere, hay que añadirlo al esquema.
   - `{sincronía}` para palabra, línea, sin sincronizar y en parte (unas líneas con tiempo y otras sin él, tras editar).
   - **Provisional**: "LRCLIB" / "pegada" / "archivo"; "sincronizada por palabra" / "sincronizada por línea" / "sin sincronizar" / "sincronizada en parte".
2. **Vaciar el área de texto de C** (cero líneas).
   - En **borrador**, el paso Letra vuelve a pendiente (○) y Editor deja de ser navegable. ¿Se queda en C con el área vacía o vuelve a A? Si se sale y se vuelve a entrar, la búsqueda se lanza sola. **Provisional**: se queda en C mientras se está en la vista.
   - En una canción **lista**, que no puede quedarse sin letra (ADR 0006 no la devuelve sola a borrador), el main rechaza el guardado. **Provisional**: aviso en línea "Una canción lista necesita al menos una línea de letra." y no se guarda. ¿Texto definitivo, o se prefiere otra solución (por ejemplo, ofrecer "Volver a borrador")?
3. **Marcas `[mm:ss]` escritas o pegadas en el área de C**. **Provisional**: son texto literal, sin detectar LRC (eso solo pasa en B y al importar). ¿Hace falta algún aviso?
4. **Confirmación "¿Sustituir la letra actual?"**:
   - ¿Se pide también al **pegar** (B) y al **importar**? La spec solo lo dice de "Usar esta letra", y que importar "se aplica igual".
   - Al importar, ¿se pregunta antes de abrir el selector o después de leer el archivo?
   - **Provisional**: en los tres casos; al importar, después de leer el archivo y solo si es válido.
5. **Instrumental con candidatos**: LRCLIB puede marcar como instrumental la mejor coincidencia (`get`) y aun así `search` devolver otros registros con letra. **Provisional**: se muestra la lista con el banner `let.error.INSTRUMENTAL` encima. ¿Es correcto, o debería haber otro texto ("La versión más parecida es instrumental…")? Los registros instrumentales nunca aparecen como candidatos.
6. **Renglones de estructura** al pegar o importar texto plano ("[Estribillo]", "(x2)", "Verse 1:"). **Provisional**: se conservan como líneas normales y el usuario las borra en C. ¿Se quiere algún aviso o filtrado?
7. **Resultados y texto pegado al navegar**:
   - ¿Al volver a la vista Letra sin haber elegido se muestran los resultados anteriores o se busca de nuevo? **Provisional**: los anteriores durante 10 min (sin red), y "Buscar" siempre consulta de nuevo.
   - ¿"Volver a los resultados" (B) conserva el texto pegado si se vuelve a "Pegar la letra"? **Provisional**: no se conserva.
8. **Motivos del stepper**: la tarea 0043 dejó como provisionales "Primero añade el audio" (pasos 2–4 sin fuente) y "Primero elige una letra" (Editor sin letra). ¿Son definitivos?
9. **Renglones ignorados en un LRC**: en un LRC, los renglones con texto pero sin marca de tiempo se ignoran (ADR 0005, Revisión 2026-11-05). **Provisional**: sin aviso. ¿Se quiere uno ("Hemos ignorado {n} renglones sin tiempo")?

## Opción provisional tomada (si no bloquea)
La indicada en cada punto, recogida en las tareas 0083–0087.

## Respuesta
Respondida por disenador-ux el 2026-11-05. Detalle en `ux/05-letra.md` (wireframes B, C y "C con el área vacía", microcopy, criterios 14–20 y sección "Casos de la Fase 4") y en `ux/00-mapa-de-vistas.md` §2 (motivos del stepper).

1. **Resumen**: el formato cambia a `Letra actual · {origen} · {sincronía} · {n} líneas` ("1 línea" en singular). Origen: "de LRCLIB" / "pegada" / "de un archivo" (sin nombre de archivo; esquema sin cambios). Sincronía: "sincronizada por palabra" / "sincronizada por línea" / "sin sincronizar" / "sincronizada en parte", con la regla de `ux/05` §1.
2. **Área vacía**: en borrador, **se acepta lo provisional** (se guarda y se queda en C) y se añade el texto `let.actual.vacia` ("Sin letra todavía. Escribe o pega aquí la letra, o busca otra.") e "Ir al editor" inactivo. En lista, se rechaza con `let.error.listaSinLineas`: "Una canción lista necesita al menos una línea de letra. Este cambio no se ha guardado." Sin botón "Volver a borrador" aquí.
3. **Marcas en C**: texto literal, como lo provisional, **más** un aviso informativo `let.edicion.marcas` mientras algún renglón empiece por una marca. No bloquea el guardado.
4. **Sustituir**: en los tres casos y, al importar, después de leer un archivo válido (como lo provisional). **Cambio**: se pide siempre que haya ≥ 1 línea, no solo con sincronía. Hay dos textos: `let.dialogo.sustituir` (con sincronía) y `let.dialogo.sustituirTexto` (sin sincronía): "¿Sustituir la letra actual? Se reemplazará el texto que tienes ahora." Foco inicial en "Cancelar".
5. **Instrumental con candidatos**: se muestra la lista, pero con un banner propio `let.aviso.instrumentalConCandidatos`: "**La versión más parecida es instrumental**, según LRCLIB. Abajo tienes otras versiones con letra: comprueba que coinciden con tu audio." `let.error.INSTRUMENTAL` solo se usa sin candidatos.
6. **Renglones de estructura**: sin filtrado (como lo provisional). Se amplía `let.pegar.ayuda` con "Borra los renglones que no se cantan, como «[Estribillo]» o «(x2)»."
7. **Navegación**: resultados anteriores durante 10 min (como lo provisional). **Cambio**: el texto de B **sí** se conserva al ir a "Volver a los resultados" y volver, mientras no se salga de la vista Letra o se use.
8. **Motivos**: "Primero añade el audio" y "Primero elige una letra" son definitivos. Se añade "Espera a que termine la descarga" para Letra y Editor con la fuente `en_curso`. Claves `paso.motivo.*`.
9. **Renglones ignorados**: **sí se avisa** ("Ignoraremos {n} renglones sin tiempo." en B, en vivo; "Hemos ignorado {n} renglones sin tiempo del archivo." en C tras importar, cerrable). Cómo llega el recuento al renderer: `preguntas/0023` (para arquitecto, no bloquea).

**Tareas que deben ajustarse** (las edita el arquitecto):
- **0083**: la respuesta de importar trae `ignoradas` (según `0023`); la confirmación se pide con ≥ 1 línea, no solo con sincronía (si 0083 decide cuándo hace falta).
- **0084**: banner `let.aviso.instrumentalConCandidatos` en vez de `let.error.INSTRUMENTAL` cuando hay candidatos (§5).
- **0085**: confirmación con ≥ 1 línea y dos variantes de texto (§4); conservar el texto de B dentro de la vista (§7); ayuda ampliada (§6); aviso `let.pegar.ignoradas` en vivo (§9).
- **0086**: nuevo formato y textos de `let.actual` (§1); `let.actual.vacia`, "Ir al editor" inactivo y texto definitivo del rechazo en lista (§2); aviso `let.edicion.marcas` (§3); aviso cerrable `let.importar.ignoradas` (§9).
- **0087**: motivos definitivos y nuevo `paso.motivo.descargando` para Letra/Editor con la fuente descargándose (§8); quitar la deuda de `MOTIVO_SIN_LETRA`.
- **0078**: sin cambios (ya devuelve `ignoradas`); quitar la nota "provisional: sin aviso".
