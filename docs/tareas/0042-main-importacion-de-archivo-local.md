# 0042 — Main: importación de archivo local (`.importando`, consulta interactiva y materializar)
- Estado: Hecha
- Paso del pipeline: 1
- Depende de: 0010, 0011, 0013, 0041
- ADRs: 0003, 0006 (creación de una canción), 0008, 0009 §7
- Spec UX: docs/ux/03-anadir-cancion.md (flujo "Archivo", criterios 2, 10, 11)

## Objetivo
Orquestar en el proceso principal el flujo de archivo local: preparar la carpeta oculta, ejecutar `importar-archivo` como consulta interactiva (fuera de las colas), y crear la canción solo cuando el usuario confirma.

## Criterios de aceptación
- [x] `app/src/main/fuente/archivo.ts` + IPC (contrato de 0011, validado con Zod):
  - `sistema.elegirArchivoAudio()` → ruta o `null`: `dialog.showOpenDialog` con filtro "Audio y vídeo" (extensiones de `add.formatos`) y "Todos los archivos", un solo archivo.
  - `fuente.importarArchivo(ruta)` → `{ importacionId, nombre, duracionMs, metadatos, gananciaDb, larga }`: comprueba que la ruta es un archivo regular legible (no directorio, no dentro del directorio de datos), llama a `prepararImportacion()` (0010) y ejecuta `importar-archivo` con salida en `.importando/<id>/`. Una nueva importación cancela y descarta la anterior.
  - `fuente.cancelarImportacion(importacionId)`: aborta el proceso (0013) y borra la carpeta cuando el proceso ha muerto.
  - `fuente.confirmarArchivo(importacionId, metadatos)` → `ResumenCancion`: valida los metadatos (mismas reglas que `metadatosEditablesSchema`), llama a `materializar()` con `fuente.tipo = "archivo"`, `nombre_original`, `mezcla`, `ganancia_db`, `metadatos.duracion_ms`, `pasos.fuente = completado` y el `estilo_predeterminado` de la config. (El encolado de la separación llega en la Fase 3; aquí `separacion` queda `pendiente`.)
  - **Sustitución de la fuente** (`preguntas/0014` §3, ADR 0006 Revisiones): `fuente.confirmarArchivo(importacionId, metadatos, { cancionId })` sobre una canción (normalmente de YouTube) con `pasos.fuente` en `pendiente`/`error`/`interrumpido`, sin trabajo vivo y sin `fuente/mezcla.flac`; si no → `ARGUMENTOS_NO_VALIDOS`. Pasos:
    1. `rename` de `.importando/<id>/mezcla.flac` a `<cancion>/fuente/mezcla.flac`.
    2. Borra `fuente/miniatura.jpg` y `fuente/descarga.*`.
    3. Al final, una escritura atómica de `cancion.json` con `fuente.tipo = "archivo"`, `nombre_original`, `ganancia_db`, `duracion_ms` real y `pasos.fuente = completado`.
    Se conservan id, carpeta, estilo y `letra.json`. Si algo falla antes de escribir `cancion.json`, se borra la `mezcla.flac` movida y la canción queda como estaba.
  - `fuente.descartarImportacion(importacionId)`: borra la carpeta (abandono: Cancelar, ‹ Biblioteca, Esc).
- [x] El resultado del worker se guarda en main asociado al `importacionId` (el renderer no puede inyectar `ganancia_db` ni rutas); los ids desconocidos → `ARGUMENTOS_NO_VALIDOS`.
- [x] Al cerrar la app con una importación sin confirmar se aborta el proceso y se borra la carpeta; al arrancar ya se vacía `.importando/` (0010).
- [x] Errores del worker propagados con su código (`FORMATO_NO_SOPORTADO`, `AUDIO_DEMASIADO_CORTO`, `SIN_ESPACIO`, `RUNTIME_NO_DISPONIBLE`, `CANCELADO`, `ERROR_INTERNO`) y `detalles` para "Copiar detalles"; en cualquier error se borra la carpeta.
- [x] Tests (Vitest, worker de desarrollo real de 0041 y audio WAV generado por el propio test): importar → confirmar crea `biblioteca/<id>/cancion.json` válido + `fuente/mezcla.flac` y desaparece de `.importando/`; importar → descartar no deja nada; cancelar a mitad no deja nada ni procesos; importar dos veces seguidas cancela la primera; archivo corrupto → `FORMATO_NO_SOPORTADO` sin restos; el archivo original queda intacto; metadatos no válidos rechazados sin materializar; sustitución sobre una canción de YouTube `pendiente` (mismo id, `letra.json` intacta, sin miniatura, `completado`) y rechazo si la canción tiene `mezcla.flac` o un trabajo vivo.

## Notas de implementación
- **Qué se hizo**: `app/src/main/fuente/archivo.ts` (`ServicioImportacionArchivo`, `elegirArchivoAudio`, `EXTENSIONES_AUDIO_VIDEO`, `ErrorImportacion`) y cableado en `main/index.ts` (servicio, diálogo, `cerrar()` en `before-quit` antes del volcado). Canales nuevos en `shared/canales.ts`/`ipc.ts`/preload/handlers: `sistema.elegirArchivoAudio`, `fuente.importarArchivo`, `cancelarImportacion`, `confirmarArchivo(id, metadatos, { cancionId }?)`, `descartarImportacion`. Nuevo `ServicioBiblioteca.sustituirFuente(id, datos)` (mueve `mezcla.flac`, escribe `cancion.json` al final, borra `miniatura.jpg` y `descarga.*` solo tras el éxito, y si falla borra la mezcla movida).
- **Decisiones**: el resultado del worker (ganancia, mezcla) se queda en main asociado al `importacionId`; una sola importación a la vez (la nueva aborta, espera a que el proceso muera y borra la anterior; el arranque está serializado). `cancelarImportacion` admite id opcional: mientras se lee, el renderer aún no conoce el id, así que sin id cancela la lectura en curso; con id desconocido -> `ARGUMENTOS_NO_VALIDOS`. Ruta de entrada: absoluta, `realpath` (sigue enlaces), archivo regular legible (si no se puede leer -> `FORMATO_NO_SOPORTADO`; directorio, relativa o dentro del directorio de datos -> `ARGUMENTOS_NO_VALIDOS`). `ErrorIpc` gana `detalles?` (últimas líneas del worker) que el preload conserva; códigos desconocidos del worker -> `ERROR_INTERNO`. Sustitución: requiere fuente `pendiente`/`error`/`interrumpido`, sin `mezcla.flac` y sin trabajo vivo (`hayTrabajoVivo` inyectado desde el gestor); aplica también los metadatos revisados y la `duracion_ms` real.
- **Cómo probarlo** (desde `app/`): `SHINOBI_UV=/ruta/uv npx vitest run src/main/fuente src/main/ipc` (16 + 25 tests; los del worker real se omiten sin uv), `npm run build && npx playwright test` (se actualizó `e2e/ipc.spec.ts` con la clave `fuente`).
- **Deuda técnica**: sin E2E del flujo (0046); el selector de archivo no tiene doble de pruebas para E2E (0046 lo necesitará, p. ej. por variable de entorno honrada solo sin empaquetar); el pico de RAM del worker con archivos largos es el de 0041; no se probó en Windows/Linux.
