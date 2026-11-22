# 0283 — Contratos compartidos de 0.2.1 y canal `letras.editarTextoLinea`

- Estado: Hecha
- Paso del pipeline: 3–6 (contratos IPC)
- Fase: 8 y 9 de 0.2.1 (y 7) · Lote B1 (contratos y main de letras), **primera del lote: empezar por aquí; 0258, 0260 y 0266 la esperan**
- Depende de: —
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §7; [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-021--fases-8-y-9); [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md#revisión-para-021--fase-7-correcciones-pendientes-de-alpha1) §1.6 y §4; [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md#revisión-para-021--agrupar-por-fecha-de-añadido) §2; [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md) (validación Zod, roles)
- Spec UX: sin interfaz. Respuestas a [0145](../preguntas/0145-contratos-de-las-fases-8-y-9-para-las-specs.md) §4 y §7 y [0146](../preguntas/0146-captura-reintentar-y-errores-tempranos-de-la-exportacion.md) §2–§4
- Tamaño: M

## Objetivo

Concentrar en una sola tarea temprana los cambios de los archivos de contrato que necesitan varios lotes (`shared/ipc.ts`, `shared/canales.ts`, `shared/errores.ts`, `preload/index.ts`, `main/index.ts`), para que ningún otro lote los toque a la vez.

## Archivos (solo estos)

- `app/src/shared/ipc.ts`, `shared/canales.ts`, `shared/errores.ts` y sus tests (`exportacionIpc.test.ts`, el de roles por canal)
- `app/src/shared/letrasBusqueda.ts`: **solo** el esquema nuevo `editarTextoLineaSchema` (0262 toca después `tiempoElementoSchema`; mismo lote, en orden)
- `app/src/preload/index.ts`
- `app/src/main/index.ts` (registro del canal) y `app/src/main/letras/servicio.ts` + `servicio.test.ts` (método `editarTextoLinea`)
- Dobles de la API del renderer que tipan `window.shinobi` (`vistas/editor/fixturesApi.ts`, `vistas/biblioteca/fixturesApi.ts`, `vistas/letra/fixturesApi.ts`): **solo** añadir el método o campo nuevo con un valor por defecto para que compilen

## Criterios de aceptación

- [ ] **Resumen**: `resumenCancionSchema` añade `creada: string | null` (ISO o `null` si no es válida). El cálculo lo hace 0266 en `main/biblioteca/resumen.ts`; aquí basta con que el esquema y los tipos existan y que `resumirCancion` devuelva provisionalmente `cancion.creada` (lo que permita compilar).
- [ ] **Exportación**: `ExportacionIpc.error` admite `detalle` opcional y estricto: `{ causa: "captura", reintentable: boolean } | { campo: "destino" } | { trabajoId: uuid }`. `errores.ts` añade `CANCION_EXPORTANDOSE` a los códigos de exportación (y a los textos genéricos si el catálogo lo exige).
- [ ] **Canal `letras.editarTextoLinea`**: `{ cancionId, id, texto }` con `texto` sin `\n`/`\r`, sin espacios en los extremos, 1 a la longitud máxima por línea de la vista Letra; `sesionId` UUID como segundo argumento; rol principal; respuesta `ResumenCancionIpc`. Preload y `main/index.ts` lo exponen.
- [ ] `ServicioLetras.editarTextoLinea`: visita vigente (si no, `LETRA_DESACTUALIZADA`), `id` de una `linea`, conserva `id`, `inicio_ms` y `fin_ms`, deja `palabras: null` sin `origen_palabras`, **actualiza la referencia de la visita** (no la invalida), escribe sin *debounce* en la misma cola que `guardarTiempos` y responde el resumen. Sin cambios de texto, no escribe.
- [ ] Durante una sesión en vivo responde `EDICION_BLOQUEADA` (se añade a la lista de canales bloqueados de ADR 0017 §9).
- [ ] `ROLES_POR_CANAL` cubre el canal nuevo (prueba de seguridad existente).

## Pruebas de feedback

- Unitarias: `servicio.test.ts` (`editarTextoLinea`: conserva tiempos, quita palabras, referencia actualizada y un `guardarTiempos` posterior válido contra el texto nuevo, visita caducada, pausa, bloqueo en sesión), esquemas nuevos en `shared/`.
- E2E: ninguna (`ipc.spec.ts` solo si comprueba la lista de canales del puente: ejecutarla en ese caso).
- Críticos: sí (`main/`, `preload/`, `shared/`).
- Manual: ninguna.

## Notas de implementación

- **Hecho**: `resumenCancionSchema` y `ResumenCancion` con `creada: string | null` (`resumirCancion` devuelve `cancion.creada`, `resumenDanadaPorJson` devuelve `null`; el cálculo real es de 0266). `ErrorExportacionIpc` (en `shared/exportacion.ts`, archivo del lote A: cambio mínimo) y `exportacionIpcSchema` con `detalle` estricto `{ causa: "captura", reintentable } | { campo: "destino" } | { trabajoId }` (`detalleErrorExportacionSchema`). Código `CANCION_EXPORTANDOSE` en `CODIGOS_ERROR` y `CODIGOS_SOLO_MAIN`. Canal `letras.editarTextoLinea` (canales, `ROLES_POR_CANAL` principal, contrato `[editarTextoLineaSchema, uuid]`, preload, `main/index.ts`, `main/ipc/handlers.ts` con `sinSesion()` -> `EDICION_BLOQUEADA`). `ServicioLetras.editarTextoLinea` y `escribirTiempos` (cola compartida con `guardarTiempos`). Dobles de `fixturesApi` (editor y letra: método nuevo; editor y letra: `creada`).
- **Decisión (sin tope previo)**: la vista Letra no tenía máximo por línea; se fija `MAX_CARACTERES_LINEA = 500` en `shared/letrasBusqueda.ts` (lo puede reutilizar el editor preciso para su campo de texto).
- **Decisión sobre la referencia**: `editarTextoLinea` actualiza el **texto** de la línea en la referencia de la visita y **conserva sus palabras** (importadas o no), para que Deshacer pueda restaurar con `guardarTiempos` unas palabras importadas (ADR 0021 §7). En el archivo la línea queda con `palabras: null` y sin `origen_palabras`.
- Archivos: `shared/{canales,errores,ipc,exportacion,letrasBusqueda}.ts`, `preload/index.ts`, `main/index.ts`, `main/ipc/handlers.ts`, `main/letras/servicio.ts`, `main/biblioteca/resumen.ts`, `renderer/src/vistas/{editor,letra}/fixturesApi.ts`; tests: `servicio.test.ts` (5 casos), `letrasBusqueda.test.ts`, `handlers.sesion.test.ts`, `separacion.test.ts`, `exportacionIpc.test.ts`, y fixtures con `creada` (`handlers.test.ts`, `__fixtures__/fase5.ts`, `temasIpc.test.ts`).
- Probar: `npx vitest run src/main/letras/servicio.test.ts src/shared/letrasBusqueda.test.ts src/main/ipc`.
- Deuda: `biblioteca/fixturesApi.ts` no necesitó cambios (compila). La integración de `useGuardadoEditor` con el canal es de 0279.
