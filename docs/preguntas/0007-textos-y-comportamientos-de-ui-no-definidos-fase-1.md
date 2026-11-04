# 0007 — Textos y comportamientos de la interfaz decididos por el programador en la Fase 1 (0018–0020)
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no

## Contexto
En la revisión de cierre de la Fase 1 (2026-11-04), las notas de implementación de las tareas 0018, 0019 y 0020 recogen textos y comportamientos que las specs (`ux/00`, `ux/02`, `ux/03`, `ux/04`) no definían. El programador tomó en cada caso una opción conservadora; todo está implementado y probado, así que **no bloquea**. Técnicamente no hay objeción a ninguno: lo que se pide es validar (o corregir) la parte de experiencia y microcopy. Si cambia algún texto, basta con actualizar la spec: el arquitecto lo convertirá en una tarea pequeña.

## Pregunta
Para cada punto, ¿se acepta tal cual o qué texto/comportamiento debe tener? (Los identificadores `bib.*`/`act.*` son los de las specs.)

**Biblioteca — estados y errores (0019)**
1. Error al listar la biblioteca: "No se pudo cargar tu biblioteca." + botón "Reintentar".
2. Toast si falla abrir una canción desde "Continuar": "No se pudo abrir la canción."
3. Borrador con la fuente hecha y la separación `pendiente` **sin trabajo en cola**: línea "En cola para separar". Borrador con la fuente `pendiente` sin trabajo: "Preparando el audio…". (Hoy no ocurre en el flujo normal; podría ocurrir tras cancelar o con datos antiguos.)
4. Paso en `error`: insignia "✕ Error", línea "✕ {título del error}" y **siempre** "Reintentar" (no hay acción "Ver"); un paso `interrumpido` muestra insignia "Borrador" + "⚠ Interrumpido".
5. Miniatura de YouTube en la portada: se muestra si el estilo de la canción es **igual al estilo predeterminado de fábrica** (`sistema-visual.md` §8). Si el usuario cambió su estilo predeterminado en Ajustes, las canciones nuevas de YouTube nunca mostrarán miniatura. ¿Debe compararse con el predeterminado vigente del usuario, con ambos, o mostrarse siempre hasta que se edite el estilo en el editor?

**Biblioteca — filtros, menú y diálogos (0020)**
6. Las canciones **dañadas** solo aparecen en *Todas* (no cuentan en *Listas* ni en *Borradores*).
7. *Borradores* vacío sin texto de búsqueda: "No hay canciones que coincidan con el filtro."; "Borrar búsqueda" solo aparece si hay texto.
8. El filtro persiste durante la sesión, pero la búsqueda se vacía al volver a la Biblioteca.
9. "Editar datos" no aparece en canciones dañadas.
10. "Volver a borrador" no muestra toast al terminar.
11. Aviso al eliminar con un trabajo de **fuente** activo: "Se cancelará la descarga en curso." (la spec solo tenía el de separación).
12. Arrastrar un archivo no admitido: toast "Ese archivo no es de audio ni de vídeo admitido." (sin navegar). Arrastrar fuera de la Biblioteca no hace nada.

**Indicador de actividad y líneas de trabajo en vivo (encargo adicional de 0020)**
13. El indicador es **informativo** (`role="status"`), no botón, hasta que exista el panel de actividad (Fase 3).
14. Con solo trabajos en cola: "{m} en cola".
15. "✓ Terminado" (4 s) solo si al menos un trabajo acabó `completado`; si todos acabaron en error, cancelados o interrumpidos, no se muestra nada.
16. Tiempo restante en la tarjeta, versión corta: "quedan unos 3 min", "queda 1 min aprox.", "menos de 1 min"; sin ETA (primeros 15 s) no se muestra tiempo.
17. Trabajo de fuente en cola: "En cola".

**Marco y navegación (0018)**
18. El marcador de "Primer arranque" (hasta la Fase 2) lleva un botón provisional "Ir a la Biblioteca". Si falla la lectura de la configuración al arrancar, se muestra Primer arranque.
19. `vistaAlContinuar` (0006): "la vista de progreso ya se ha visto" se considera estado **de la sesión** (no se guarda en disco); tras reiniciar la app, "Continuar" de un borrador separando vuelve a abrir Progreso. ¿Correcto?

## Opción provisional tomada (si no bloquea)
Lo descrito en cada punto, tal como está implementado en la rama `fase-1-esqueleto`.

## Respuesta
**Respondida por disenador-ux (2026-11-04)**, junto con la revisión visual de la Fase 1 ([docs/ux/revision-fase-1/](../ux/revision-fase-1/README.md)). Textos llevados a `ux/02` §"Microcopy" (nota "Revisión 2026-11-04"). Los cambios que piden código están resumidos en [0008](0008-ajustes-ui-tras-revision-fase-1.md).

| # | Decisión |
|---|----------|
| 1 | Se acepta (`bib.error.listar`). |
| 2 | Se acepta (`bib.toast.noabre`). |
| 3 | **Se corrige**. "En cola" y los textos ⟳ en `info` solo con un trabajo vivo. Sin trabajo: "Falta separar las pistas" / "Falta preparar el audio", en `texto-2`, sin icono, con "Continuar" (`bib.paso.falta.*`). |
| 4 | Se acepta. Cuando existan errores no reintentables (Fase 3), se usará "Ver" según la tabla. |
| 5 | Se muestra la miniatura si el estilo de la canción es igual al predeterminado **de fábrica o al predeterminado vigente del usuario** (cualquiera de los dos). Si se edita el estilo en el Editor, deja de mostrarse. |
| 6 | Se acepta; documentado en `ux/02` (fila Filtros). |
| 7 | **Se corrige**: `bib.sinborradores` = "No tienes borradores. Las canciones que añadas aparecerán aquí hasta que las marques como listas." Que "Borrar búsqueda" solo aparezca con texto: se acepta. Además, con texto y un filtro distinto de *Todas*: `bib.sinresultados.listas` / `.borradores` + "Ver todas". |
| 8 | Se acepta; documentado. |
| 9 | Se acepta. |
| 10 | Se acepta (el cambio de insignia en la propia tarjeta basta). |
| 11 | Se acepta (`bib.dialogo.eliminar.trabajo`). |
| 12 | **Se corrige** el texto: "Ese tipo de archivo no se puede usar. Prueba con un archivo de audio o de vídeo." (`bib.arrastrar.noadmitido`). Que fuera de la Biblioteca no haga nada: se acepta. |
| 13 | Se acepta hasta la Fase 3. |
| 14 | Se acepta (`act.boton`). |
| 15 | Se acepta (`act.terminado`). |
| 16 | **Se corrige**: "quedan unos {n} min" · "queda alrededor de 1 min" · "queda menos de 1 min" (`bib.eta`). Sin ETA no se muestra tiempo: se acepta. |
| 17 | **Se corrige**: "En cola para descargar" (`bib.paso.cola.descarga`). |
| 18 | Se acepta como provisional hasta la Fase 2. |
| 19 | Se acepta: estado de sesión. |

