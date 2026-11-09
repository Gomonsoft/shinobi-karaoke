# 0167 — Borrado recuperable de temas con diario

- Estado: Hecha
- Paso del pipeline: 4 y 5
- Depende de: [0166](0166-impactos-fichas-y-operaciones-confirmadas.md)
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §8
- Specs: [Editor · Fase 3, «Eliminar tema»](../ux/06-editor.md#diálogos) (T17–T19), [Ajustes · Fase 3, «Borrado pendiente»](../ux/08-ajustes-y-acerca.md#estados-y-errores) (A4, A9), [0047](../preguntas/0047-temas-asignados-edicion-y-borrado.md)

## Objetivo

Implementar `borrar` dentro de `previsualizar`/`ejecutar`, y `reanudarBorrado()` y `cancelarBorrado()`, con congelación previa de las apariencias efectivas, diario en el catálogo y retirada final, de forma idempotente y recuperable tras un fallo o un cierre.

## Contrato

- **Impacto de `borrar`**: canciones que resuelven al tema por cualquier nivel (incluidos `aleatorio`, `predeterminado_anterior` y `predeterminado`), `asignacionesRetiradas` y `esPredeterminado`.
- **Pasos** (ADR 0016 §8): diario (`borrado_pendiente`) → congelación canción a canción (a `propio` con el estilo resuelto completo; a las que tienen `base` con ese tema y heredan de un nivel superior se les quita la base) → retirada (tema, asignaciones, `predeterminado` a `null` si era él, diario a `null`) en una sola escritura.
- El conjunto se **recalcula** al reanudar; la lista del diario solo sirve para el informe (`borradoPendiente.total`/`restantes` del catálogo).
- **Fallo en la congelación**: se detiene; el resultado lista **todas** las canciones que iba a escribir (también las que solo pierden la base), en orden, como `aplicada`, `error` (con `codigo`) o `pendiente` (no intentada), y `catalogoEscrito: false`; el tema queda en borrado.
- **Arranque con diario**: no reanuda solo; `catalogo().borradoPendiente` lo expone; el tema no se ofrece (`enBorrado: true`), no entra en el sorteo ni se puede elegir como predeterminado, pero sigue resolviendo.
- `cancelarBorrado()` quita el diario en una escritura; las canciones ya convertidas siguen como propias.
- Cualquier otra operación sobre ese tema → `BORRADO_PENDIENTE`. Progreso con `temas:progreso` (`operacion: "borrar"`, `temaId` del tema; `ficha` de la confirmación, o `null` en `reanudarBorrado`). `total` = canciones que se van a escribir, incluidas las que solo pierden la base.

## Archivos

- `app/src/main/temas/borrado.ts`, `borrado.test.ts` (nuevos).
- `app/src/main/temas/servicio.ts`, `impacto.ts` (rama `borrar`), `operaciones.ts`.

## Criterios de aceptación

- [x] T18/A4: borrar el predeterminado usado por 2 canciones de predeterminado, 1 de álbum y 1 asignada deja las 4 como `propio` con estilo idéntico al resuelto antes (comparación campo a campo), retira sus asignaciones y deja `predeterminado: null`.
- [x] Una canción con `base: aleatorio` (o `predeterminado_anterior`) de ese tema que hereda de su artista pierde la base y conserva su aspecto; una que resolvía por esa base queda congelada.
- [x] T19: con fallo inyectado en la 3.ª de 5, el resultado es `[aplicada, aplicada, error, pendiente, pendiente]`, el tema sigue en el catálogo con diario, `restantes = 3`; `reanudarBorrado()` emite progreso con `ficha: null`; `reanudarBorrado()` completa y retira el tema; en otra prueba `cancelarBorrado()` lo deja disponible y las 2 convertidas como `propio`. Ninguna canción resuelve a `respaldo` en ningún momento.
- [x] Fallo al escribir el diario → nada cambia y se informa del error.
- [x] Cierre simulado entre congelación y retirada (proceso nuevo sobre los mismos archivos): arranca con `borradoPendiente`, no reanuda solo, y `reanudarBorrado()` termina; una canción creada en el álbum del tema mientras tanto también se congela.
- [x] Mientras dura el borrado, `aparienciaInicial` nunca elige ese tema y `renombrar`, `duplicar`, `editar`, `aplicar`, `asignarGrupo` y `predeterminado` con ese tema dan `BORRADO_PENDIENTE`.

## Notas de implementación

**Qué se hizo.** `main/temas/borrado.ts`: `planBorrado` (recalculado siempre, ordenado por título, incluye las que solo pierden la base), `iniciarBorrado` (diario), `continuarBorrado` (congelación + retirada, compartido por `ejecutar` y `reanudarBorrado`), `cancelarDiario`, `retirarTema`. `usos.ts`: `pasoBorrado` (puro) y `borradoPendiente.restantes` real. `servicio.ts`: rama `borrar` en `ejecutar`, `reanudarBorrado()` y `cancelarBorrado()` (ya no lanzan `NO_IMPLEMENTADO`; `ErrorNoImplementado` eliminado).
- Cada entrada del resultado lleva `titulo` y `artista` (ADR 0016 rev. 3), también las que solo pierden la base, tomados del índice recalculado.
- `restantes` = canciones que aún habría que escribir (recalculado en cada `catalogo()`); `total` = `max(diario, restantes)` para no quedar por debajo.
- Congelación: `{ modo: "propio" }` con el estilo resuelto completo. Quitar base: se elimina `base` y se refresca la instantánea (`estilo`, `tema_nombre`).

**Decisiones.**
- Impacto de `borrar`: `efecto: "fija_base"` y `despues` = `propio` sin tema (conserva el aspecto; el contrato no fijaba el valor).
- `reanudarBorrado()` sin diario: `TEMA_NO_ENCONTRADO`. `cancelarBorrado()` sin diario: no hace nada.
- Si falla la escritura final del catálogo (retirada) tras congelar todo: `catalogoEscrito: false` con todas `aplicada`; reanudar solo retira.
- Un fallo al escribir el diario se propaga tal cual (nada cambia, `estado` no se adopta).

**Cómo probarlo.** `npx vitest run src/main/temas/borrado.test.ts` (7 pruebas: T18/A4, base latente y por base, T19 con reanudar y progreso `ficha: null`, cancelar, fallo del diario, cierre simulado con canción nueva en el álbum, sorteo sin el tema en borrado). Ninguna canción resuelve a `respaldo` en los puntos intermedios.

**Deuda.** El progreso de `reanudarBorrado` y el de `borrar` comparten `Avance`; no hay cancelación a medias (por diseño).
