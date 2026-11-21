# 0055 — Textos de «Tema predeterminado anterior» y ajustes menores de las specs de la fase 3

- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no (las tareas 0169, 0170 y 0172 siguen con la opción provisional)

## Contexto

El usuario respondió [0052](0052-predeterminado-y-canciones-que-dependen-de-el.md) con A1, B1 y C1. El [ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §3 y §6 lo recoge así: al quitar el predeterminado, las canciones que lo seguían reciben `base: predeterminado_anterior` con ese tema, conservan su aspecto y siguen vinculadas a él. Main entrega la procedencia nueva `predeterminado_anterior`. La spec 08 ya tiene `aj.temas.origen.anterior` («Tema predeterminado anterior»), pero el editor y la tarjeta no.

## Preguntas

1. **Editor y tarjeta.** Faltan `tema.origen.*` (larga) y `tema.origen.corta.*` (tarjeta) para `predeterminado_anterior`, su fila en la tabla de «Conceptos y procedencia» y el texto de `tema.heredar.destino` cuando el destino es ese tema. (Provisional: larga «Tema predeterminado anterior», corta «predeterminado anterior».)
2. **Desglose del diálogo de impacto.** `ImpactoIpc.desglose` trae `predeterminadoAnterior` aparte. ¿Línea propia («{e} lo conservan como predeterminado anterior») o se suma a «lo usan como tema predeterminado»? (Provisional: línea propia, con el mismo criterio que «al azar».)
3. **Portada.** El ADR cuenta `predeterminado_anterior` como apariencia neutra (miniatura de YouTube con velo), porque nadie eligió nada para esa canción y antes de quitar el predeterminado ya mostraba la miniatura. Así quitar el predeterminado no cambia ninguna portada. ¿Lo confirmas para B14?
4. **Spec 08, retirar «provisional».** Con 0052 respondida, sobran las marcas «provisional, 0052» en la fila «Qué cambia al cambiar el predeterminado», `aj.temas.dialogo.ninguno` y `aj.temas.origen.anterior`. El párrafo de la spec 06 que remite a 0052 también puede cerrarse.
5. **Spec 08, tabla de microcopy.** La fila de `aj.temas.pendiente` y la de `aj.temas.faltan` están unidas en una sola línea (`… [Cancelar el borrado] || \`aj.temas.faltan\` …`), y la tabla se rompe al renderizar.
6. **`aj.temas.faltan`.** El texto dice «{n} canciones o grupos». Un grupo nunca puede apuntar a un tema que falta: el catálogo es válido por construcción y sus asignaciones se retiran al borrar. Main solo cuenta canciones (`referenciasFaltantes`). ¿Cambias el texto a «{n} canciones usan temas que no están en tu lista…» con su plural?

## Opción provisional tomada (si no bloquea)

Las de cada punto. 0169 pone los textos en `renderer/src/temas/textos.ts` para cambiarlos en un solo sitio.

## Respuesta

De: disenador-ux · 2026-11-09. Se confirman las seis opciones provisionales, con algunos detalles añadidos. Ya están en las specs.

1. **Editor y tarjeta** ([06 · Conceptos y procedencia](../ux/06-editor.md#conceptos-y-procedencia) y microcopy):
   - Larga: `tema.origen.anterior` = «Tema predeterminado anterior». `aj.temas.origen.anterior` (spec 08) es la misma cadena: en `textos.ts` debe haber una sola.
   - Corta: «predeterminado anterior», en `tema.origen.corta.*`. En la tarjeta se ve «◐ Noche ninja · predeterminado anterior». Si no cabe, se corta con «…» y el texto completo va en `title` y en el nombre accesible.
   - La tabla de conceptos tiene una fila nueva. Se aclara también que «al azar», «predeterminado anterior» y «estilo incluido» son la **base** de la canción, que va antes del predeterminado global.
   - `tema.heredar.destino` tiene una variante propia para este caso: «Usará «{tema}», el tema predeterminado anterior.».
   - «Volver a heredar» conserva la base. Hay un criterio nuevo, T2b.
2. **Desglose**: va en línea propia, después de «al azar»: «{e} lo conservan como predeterminado anterior» (singular: «1 lo conserva como predeterminado anterior»). No se suma a la del predeterminado, porque esas canciones no cambiarían si se eligiera otro predeterminado. En la spec 06 queda escrita la correspondencia completa entre `ImpactoIpc.desglose` y las líneas: álbum + artista en una sola, y `propio`/`respaldo`/`incluido` no se muestran en el diálogo de editar. También se añaden los singulares de cada línea.
3. **Portada**: confirmado. `predeterminado_anterior` cuenta como neutra, así que quitar el predeterminado no cambia ninguna portada. La spec 02 (portada y B14) dice ahora que el renderer usa `apariencia.neutra` tal cual, sin comparar estilos ni leer `config.estilo_predeterminado`.
4. **«Provisional» retirado** en la spec 08: fila «Qué cambia al cambiar el predeterminado» (reescrita con A1/B1/C1), `aj.temas.dialogo.ninguno`, `aj.temas.origen.anterior` y la cabecera. El párrafo de la spec 06 que remitía a 0052 resume ahora la decisión. Al cerrar esto he especificado lo que faltaba de B1:
   - progreso: `aj.temas.ninguno.quitando`, `aj.temas.ninguno.progreso` con `temas:progreso`;
   - fallo a mitad: `aj.temas.ninguno.parcial`, con [Reintentar] y [Cerrar];
   - la variante «sin anterior» de `aj.temas.dialogo.predet` (de «Ninguno…» a un tema, para las canciones con el estilo incluido sin base);
   - la nota de C1 en ese diálogo;
   - los criterios A13–A15 y la captura `dialogo-quitar-predeterminado`.
5. **Tabla rota**: corregida. `aj.temas.pendiente` y `aj.temas.faltan` van en filas separadas.
6. **`aj.temas.faltan`**: «{n} canciones usan temas que no están en tu lista (por ejemplo, al restaurar una copia). Se ven con el aspecto guardado en cada una.» En singular: «1 canción usa un tema que no está en tu lista (por ejemplo, al restaurar una copia). Se ve con el aspecto guardado en ella.» El estado de la spec 08 ya no habla de grupos y lee `referenciasFaltantes`.

Otros ajustes de coherencia con el ADR 0016 revisado:
- spec 08: aviso de catálogo apartado con `CatalogoIpc.apartado`. ✕ (`aj.temas.apartado.cerrar`) llama a `temas.descartarAvisoApartado()` y deja el foco en «Temas». Criterio A7c.
- spec 08: usos y grupos de la lista vienen de `CatalogoIpc`; `predeterminadoUsos` decide si hace falta diálogo.
- spec 02: «Agrupar por» se guarda en `config.biblioteca.agrupar`.
- spec 02: el progreso del lote viene de `temas:progreso`.
- spec 02: al quitar el tema de un grupo, el destino puede variar por canción; hay una variante de `bib.grupo.impacto` y otra de fila de la lista.
- spec 06: el progreso de eliminar viene de `temas:progreso` y muestra su `total`.

**Pendiente para el arquitecto (no bloquea)**: `tema.heredar.destino` necesita saber qué resolvería la canción sin su tema asignado. El renderer no calcula procedencias y ni `obtener` ni `guardarApariencia` lo entregan. Propuesta: añadir a `resuelta` un campo `alHeredar: { procedencia, temaId, temaNombre }` calculado en main. Si no, 0170 tendría que resolverlo en el renderer con `resolverApariencia` de `shared/`.

### Decisión del arquitecto sobre el hueco (2026-11-09)

Se acepta la propuesta, calculado en main, con un ajuste: el campo también va en el **resumen**, no solo en `resuelta`. Queda en el [ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §3 y §9 (revisión 2).

- `alHeredar: { procedencia, temaId, temaNombre }` = `resolverApariencia` sobre la canción con `modo: "heredar"`, sin `tema_id` y conservando la `base`. Lo calcula `ServicioTemas.resolver` (0165) y viaja en `ResumenCancionIpc.apariencia.alHeredar` y en `resuelta.alHeredar` (0164, 0168).
- El editor lo lee del **resumen vivo**, igual que la procedencia: `listar()` al abrir, respuesta de `guardarApariencia`, `cancion:cambiada` y un nuevo `listar()` tras `temas:cambiado`. Así el texto cambia en vivo si se asigna un tema al artista o al álbum, o si cambia el predeterminado, sin canal nuevo (0170).
- Se descarta calcularlo en el renderer. Habría un segundo ejecutor de la resolución, que necesita la base y las asignaciones por clave y puede discrepar de main con un catálogo en solo lectura o con un tema en borrado. Eso contradice «main es la única autoridad».
- Queda un caso sin texto en la spec: un destino `respaldo`, cuando la base apunta a un tema que falta. Pasa a [0056](0056-destino-respaldo-y-canciones-pendientes.md) junto con la presentación de las canciones `pendiente` tras un fallo.
