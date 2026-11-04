# 0010 — Servicio de biblioteca: crear, materializar, actualizar, volver a borrador y eliminar
- Estado: Pendiente
- Paso del pipeline: 1 y 5
- Depende de: 0009
- ADRs: 0003, 0006
- Spec UX: docs/ux/02-biblioteca.md (menú ⋯, diálogos), docs/ux/03-anadir-cancion.md (momento de creación del borrador)

## Objetivo
Todas las operaciones que modifican canciones pasan por el servicio de biblioteca (único escritor de `cancion.json`) y notifican los cambios.

## Criterios de aceptación
- [ ] `prepararImportacion()` → crea `biblioteca/.importando/<uuid>/` y devuelve id y ruta (la usará el trabajo `importar-archivo` en la Fase 2).
- [ ] `materializar(id, datos)` → escribe `cancion.json` (estado `borrador`, `estilo` copiado de `config.estilo_predeterminado`, pasos según `datos`) dentro de la carpeta de preparación y la renombra a `biblioteca/<id>/`; si el destino existe, falla sin tocar nada. `descartarImportacion(id)` borra la carpeta de preparación.
- [ ] `crear(datos)` → crea directamente `biblioteca/<id>/cancion.json` (caso YouTube, ADR 0006).
- [ ] `actualizar(id, cambio)` → aplica un cambio parcial tipado (metadatos, pasos, letra, estilo…), valida el resultado completo, actualiza `modificada` y escribe con la cola de 0007 (*debounce* configurable por llamada). Un cambio que no supere la validación se rechaza con error y no se escribe.
- [ ] `marcarLista(id)` solo si `puedeMarcarseLista` (0006), y pone `pasos.edicion` en `completado`; `volverABorrador(id)` cambia solo `estado`. Ninguna otra operación cambia `estado` (una lista nunca vuelve sola a borrador).
- [ ] `eliminar(id)` → mueve la carpeta a la papelera con `shell.trashItem` (si falla, devuelve error sin borrar nada). La cancelación de trabajos en curso se conectará en 0014.
- [ ] `mostrarEnCarpeta(id)` → `shell.openPath` de la carpeta de la canción.
- [ ] Emite `cancion:cambiada` (id + resumen nuevo, o `eliminada: true`) tras cada escritura confirmada.
- [ ] `flushTodo()` se llama en `before-quit` para no perder escrituras pendientes.
- [ ] Tests: materializar es atómico (la canción no aparece en el escaneo antes del renombrado), descartar no deja restos, rechazo de cambios inválidos, `marcarLista` con y sin condiciones, eventos emitidos.

## Notas de implementación
(las rellena el programador al terminar)
