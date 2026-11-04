# 0010 — Servicio de biblioteca: crear, materializar, actualizar, volver a borrador y eliminar
- Estado: Hecha
- Paso del pipeline: 1 y 5
- Depende de: 0009
- ADRs: 0003, 0006
- Spec UX: docs/ux/02-biblioteca.md (menú ⋯, diálogos), docs/ux/03-anadir-cancion.md (momento de creación del borrador)

## Objetivo
Todas las operaciones que modifican canciones pasan por el servicio de biblioteca (único escritor de `cancion.json`) y notifican los cambios.

## Criterios de aceptación
- [x] `prepararImportacion()` → crea `biblioteca/.importando/<uuid>/` y devuelve id y ruta (la usará el trabajo `importar-archivo` en la Fase 2).
- [x] `materializar(id, datos)` → escribe `cancion.json` (estado `borrador`, `estilo` copiado de `config.estilo_predeterminado`, pasos según `datos`) dentro de la carpeta de preparación y la renombra a `biblioteca/<id>/`; si el destino existe, falla sin tocar nada. `descartarImportacion(id)` borra la carpeta de preparación.
- [x] `crear(datos)` → crea directamente `biblioteca/<id>/cancion.json` (caso YouTube, ADR 0006).
- [x] `actualizar(id, cambio)` → aplica un cambio parcial tipado (metadatos, pasos, letra, estilo…), valida el resultado completo, actualiza `modificada` y escribe con la cola de 0007 (*debounce* configurable por llamada). Un cambio que no supere la validación se rechaza con error y no se escribe.
- [x] `marcarLista(id)` solo si `puedeMarcarseLista` (0006), y pone `pasos.edicion` en `completado`; `volverABorrador(id)` cambia solo `estado`. Ninguna otra operación cambia `estado` (una lista nunca vuelve sola a borrador).
- [x] `eliminar(id)` → mueve la carpeta a la papelera con `shell.trashItem` (si falla, devuelve error sin borrar nada). La cancelación de trabajos en curso se conectará en 0014.
- [x] `mostrarEnCarpeta(id)` → `shell.openPath` de la carpeta de la canción.
- [x] Emite `cancion:cambiada` (id + resumen nuevo, o `eliminada: true`) tras cada escritura confirmada.
- [x] `flushTodo()` se llama en `before-quit` para no perder escrituras pendientes.
- [x] Tests: materializar es atómico (la canción no aparece en el escaneo antes del renombrado), descartar no deja restos, rechazo de cambios inválidos, `marcarLista` con y sin condiciones, eventos emitidos.

## Notas de implementación
- **Qué se hizo**: `ServicioBiblioteca` (`app/src/main/biblioteca/servicio.ts`) ahora es el único escritor de `cancion.json`: `prepararImportacion`, `materializar`, `descartarImportacion`, `crear`, `actualizar(id, cambio, {debounceMs})`, `marcarLista`, `volverABorrador`, `eliminar`, `mostrarEnCarpeta`, `flushTodo` y `suscribir(cb)` (eventos `{id, resumen}` o `{id, eliminada: true}`). Tipos y `ErrorBiblioteca` (con `codigo` estable) en `operaciones.ts`. Cierra la deuda de 0009: el índice se actualiza en cada escritura.
- **Decisiones**: `actualizar` modifica el índice en el acto (lectura inmediata del último valor) y emite el evento al confirmarse la escritura; si falla, revierte el índice. `CambioCancion` no admite `id`, `creada`, `modificada` ni `estado`; `metadatos`/`fuente` y cada paso se fusionan, `letra`/`pistas`/`estilo` se sustituyen. El estilo inicial y `shell` se inyectan por opciones (`estiloPredeterminado`, `shell`) y se cablean en `main/index.ts` (config + `electron.shell`). Tras escribir se recalcula "dañada por pistas". `materializar` comprueba el destino antes de escribir; `eliminar` hace flush de la escritura pendiente antes de la papelera. Ids con `/`, `\`, `..` o punto inicial se rechazan. `before-quit` ahora espera a `flushTodo()` (preventDefault una vez y `app.quit()`).
- **Cómo probarlo** (desde `app/`): `npx vitest run --project node src/main/biblioteca` (35 tests; `escritura.test.ts` cubre las 10 operaciones), `npx eslint src/main`, `npx tsc --noEmit -p tsconfig.node.json`.
- **Deuda técnica**: `eliminar` no cancela trabajos en curso (0014); sin IPC aún (0011); `crear`/`materializar` dejan todos los pasos `pendiente` salvo los indicados en `datos.pasos`; el cableado de `index.ts` (shell, before-quit) no tiene test (requiere Electron). `jsonAtomico.test` "100 escrituras concurrentes" agota 5 s ocasionalmente con la suite completa en paralelo (ajeno a esta tarea).
